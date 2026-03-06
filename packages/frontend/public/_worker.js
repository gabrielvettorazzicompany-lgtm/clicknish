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
        // 300s de cache na CDN Cloudflare global (purge ativo garante dados frescos)
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
        'X-Edge-Rendered': 'true',
        'X-Checkout-Id': shortId,
        // Early Hints (103): Cloudflare converte automaticamente para push/preload
        // O browser inicia preconnect ANTES de receber o HTML completo
        'Link': [
            '<https://js.stripe.com>; rel=preconnect; crossorigin',
            '<https://api.stripe.com>; rel=preconnect; crossorigin',
            '<https://api.clicknich.com>; rel=preconnect; crossorigin',
            // Imagens de banner/depoimentos migradas para Supabase Storage CDN
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

        // Grava no KV em background para próximas requisições (TTL 24h)
        if (env.CACHE && checkoutData) {
            ctx.waitUntil(
                env.CACHE.put(`html:${shortId}`, fullHtml, { expirationTtl: 86400 }).catch(() => { })
            )
        }

        return new Response(fullHtml, { status: 200, headers: makeHeaders(shortId) })
    },
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Busca dados do checkout:
 * 1. KV local (Pages binding) → ~1ms
 * 2. API Worker (que também tem KV cache) → ~5-15ms no hit, ~150ms no miss
 */
async function fetchCheckoutData(shortId, env) {
    if (env.CACHE) {
        try {
            const cached = await env.CACHE.get(`checkout-data:${shortId}`, 'json')
            if (cached) return cached
        } catch (_) { }
    }

    try {
        const res = await fetch(`${CHECKOUT_API}/api/checkout-data/${shortId}`, {
            cf: { cacheTtl: 300, cacheEverything: true },
        })
        if (res.ok) return await res.json()
    } catch (_) { }

    return null
}

/**
 * Constrói o <script> de injeção de dados.
 * Se não tem dados: dispara o fetch no client (fallback).
 */
function buildScriptTag(shortId, data) {
    if (data) {
        return `<script>window.__IS_CHECKOUT_ROUTE__=true;window.__CHECKOUT_SHORT_ID__=${JSON.stringify(shortId)};window.__CHECKOUT_DATA__=${JSON.stringify(data)};window.__checkoutDataPromise=Promise.resolve(window.__CHECKOUT_DATA__);</script>\n`
    }
    return `<script>window.__IS_CHECKOUT_ROUTE__=true;window.__CHECKOUT_SHORT_ID__=${JSON.stringify(shortId)};window.__checkoutDataPromise=fetch('https://api.clicknich.com/api/checkout-data/'+${JSON.stringify(shortId)}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;});</script>\n`
}

/** Usado apenas como fallback quando não há </head> no HTML */
function buildInjectedHtml(html, shortId, data) {
    return html.replace('</head>', buildScriptTag(shortId, data) + '</head>')
}
