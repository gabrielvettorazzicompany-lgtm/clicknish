/**
 * ⚡ Cloudflare Pages Edge Worker — Checkout SSR com Streaming
 *
 * 3 camadas de velocidade para /c/:shortId:
 *
 *  1. KV HTML cache (TTL 30s) ─── ~5ms  — HTML completo já renderizado em cache
 *  2. CDN Cloudflare (max-age 10s) ── ~1ms — CDN serve sem nem chegar ao worker
 *  3. Streaming miss ─────────────── ~0ms percebido:
 *       a. Flushar <head> imediatamente → browser baixa JS enquanto buscamos dados
 *       b. Quando dados chegam, injetar + enviar resto do HTML
 *       c. Gravar HTML completo no KV em background (próximo req: 5ms)
 *
 * Para todas as outras rotas: passa direto para assets estáticos.
 */

const CHECKOUT_API = 'https://api.clicknich.com'

// Headers comuns a todas as respostas de checkout
function makeHeaders(shortId) {
    return {
        'Content-Type': 'text/html; charset=utf-8',
        // no-store: impede que CDN do Cloudflare e browser cacheiem o HTML do checkout.
        // A performance já é garantida pelo KV cache interno do worker (~5ms).
        // Cache na CDN causava: mobile recebia HTML antigo (com streaming quebrado) por até 1h.
        'Cache-Control': 'no-store',
        'X-Edge-Rendered': 'true',
        'X-Checkout-Id': shortId,
        'Link': [
            '<https://js.stripe.com>; rel=preconnect; crossorigin',
            '<https://api.stripe.com>; rel=preconnect; crossorigin',
            '<https://api.clicknich.com>; rel=preconnect; crossorigin',
            '<https://cgeqtodbisgwvhkaahiy.supabase.co>; rel=preconnect; crossorigin',
        ].join(', '),
    }
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url)
        // Normaliza barra final: /checkout/abc/ → /checkout/abc
        // Links do WhatsApp/Instagram costumam adicionar trailing slash
        const pathname = url.pathname.length > 1 && url.pathname.endsWith('/')
            ? url.pathname.slice(0, -1)
            : url.pathname

        // ── Rotas não-checkout ──────────────────────────────────────────────────
        // Detecta /c/:shortId  OU  /checkout/:shortId (segmento único — não é URL longa)
        const checkoutMatch =
            pathname.match(/^\/c\/([^/?#]+)/) ||
            // /checkout/abc — shortId (1 segmento). Exclui /checkout/abc/def (URL longa com productId+checkoutId)
            pathname.match(/^\/checkout\/([^/?#/]+)(?:[?#]|$)/)
        if (!checkoutMatch) {
            // Tenta servir o asset estático (JS, CSS, imagens, etc.)
            const assetRes = await env.ASSETS.fetch(request)

            // Se encontrou o arquivo → retorna direto
            if (assetRes.status !== 404) return assetRes

            // 404 = rota de SPA (ex: /dashboard, /login, /c/... sem match real)
            // O _redirects é ignorado quando há _worker.js, então fazemos o fallback
            // manualmente: servir index.html para o React Router assumir
            return env.ASSETS.fetch(new Request(`${url.origin}/index.html`))
        }

        const shortId = checkoutMatch[1]

        // ── CAMADA 1: KV cache do HTML renderizado ──────────────────────────────
        // Checkouts populares: HTML completo já pronto em cache → ~5ms TTFB
        if (env.CACHE) {
            try {
                const cachedHtml = await env.CACHE.get(`html:${shortId}`)
                if (cachedHtml) {
                    return new Response(cachedHtml, {
                        status: 200,
                        headers: makeHeaders(shortId),
                    })
                }
            } catch (_) {
                // KV falhou — continua para o path normal
            }
        }

        // ── CAMADA 2: Busca HTML e dados em paralelo, resposta simples (sem streaming)
        // Streaming (TransformStream) causava bug no iOS Safari: response.clone()
        // corrompia o body original → checkout vazio no mobile. Resposta completa
        // é compatível com todos os browsers e Service Workers.
        const htmlPromise = env.ASSETS.fetch(new Request(`${url.origin}/checkout.html`))
        const dataPromise = fetchCheckoutData(shortId, env)

        const assetResponse = await htmlPromise
        if (!assetResponse.ok) {
            // checkout.html não encontrado — serve index.html como fallback
            // O React Router em App.tsx tem a rota /checkout/:shortId como pública
            return env.ASSETS.fetch(new Request(`${url.origin}/index.html`))
        }

        const [html, checkoutData] = await Promise.all([
            assetResponse.text(),
            dataPromise,
        ])

        const fullHtml = buildInjectedHtml(html, shortId, checkoutData)

        // Grava no KV em background para próximas requisições (TTL 30s)
        // TTL curto garante que mudanças de config (redirect, preço, etc.) refletem rápido.
        // Performance vem do cache de dados (checkout-data:, TTL 24h) — não do HTML.
        if (env.CACHE && checkoutData) {
            ctx.waitUntil(
                env.CACHE.put(`html:${shortId}`, fullHtml, { expirationTtl: 30 }).catch(() => { })
            )
        }

        return new Response(fullHtml, { status: 200, headers: makeHeaders(shortId) })
    },
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Busca dados do checkout sempre via API Worker.
 * O API Worker já tem cache KV próprio (~5ms no hit) e é a fonte de verdade.
 * Ler do KV local do Pages causava staleness por consistência eventual do KV
 * entre PoPs diferentes (Pages PoP vs API PoP podiam ter dados diferentes).
 */
async function fetchCheckoutData(shortId, env) {
    // Tenta 2 vezes com 1s de intervalo (novo checkout pode não estar no cache da API ainda)
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            if (attempt > 0) await new Promise(r => setTimeout(r, 1000))
            const res = await fetch(`${CHECKOUT_API}/api/checkout-data/${shortId}`)
            if (res.ok) {
                const data = await res.json()
                if (data && !data.error) return data
            }
        } catch (_) { }
    }

    return null
}

/**
 * Serializa JSON de forma segura para embutir em <script>.
 * Escapa </script> e </head> para evitar que conteúdo HTML em campos
 * de texto (ex: descrição do produto) encerre prematuramente a tag.
 */
function safeJson(value) {
    return JSON.stringify(value)
        .replace(/<\/script/gi, '<\\/script')
        .replace(/<\/head/gi, '<\\/head')
}

/**
 * Constrói o <script> de injeção de dados.
 * Se não tem dados: dispara o fetch no client (fallback).
 */
function buildScriptTag(shortId, data) {
    if (data) {
        return `<script>window.__IS_CHECKOUT_ROUTE__=true;window.__CHECKOUT_SHORT_ID__=${safeJson(shortId)};window.__CHECKOUT_DATA__=${safeJson(data)};window.__checkoutDataPromise=Promise.resolve(window.__CHECKOUT_DATA__);</script>\n`
    }
    return `<script>window.__IS_CHECKOUT_ROUTE__=true;window.__CHECKOUT_SHORT_ID__=${safeJson(shortId)};window.__checkoutDataPromise=fetch('https://api.clicknich.com/api/checkout-data/'+${safeJson(shortId)}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;});</script>\n`
}

/** Usado apenas como fallback quando não há </head> no HTML */
function buildInjectedHtml(html, shortId, data) {
    return html.replace('</head>', buildScriptTag(shortId, data) + '</head>')
}
