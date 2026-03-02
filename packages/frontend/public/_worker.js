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
        // 60s de cache na CDN Cloudflare global → 6x mais CDN hits,
        // a maioria dos usuários nem chega ao Worker
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        'X-Edge-Rendered': 'true',
        'X-Checkout-Id': shortId,
        // Early Hints (103): Cloudflare converte automaticamente para push/preload
        // O browser inicia preconnect ANTES de receber o HTML completo
        'Link': [
            '<https://js.stripe.com>; rel=preconnect; crossorigin',
            '<https://api.stripe.com>; rel=preconnect; crossorigin',
            '<https://api.clicknich.com>; rel=preconnect; crossorigin',
        ].join(', '),
    }
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url)
        const { pathname } = url

        // ── Rotas não-checkout ──────────────────────────────────────────────────
        const checkoutMatch = pathname.match(/^\/c\/([^/?#]+)/)
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

        // ── CAMADA 2: Streaming response (miss de cache) ────────────────────────
        // Busca o HTML estático e os dados do checkout em PARALELO
        // checkout.html usa checkout-main.tsx — bundle mínimo sem HeroUI/QueryClient
        const htmlPromise = env.ASSETS.fetch(new Request(`${url.origin}/checkout.html`))
        const dataPromise = fetchCheckoutData(shortId, env)

        const assetResponse = await htmlPromise
        if (!assetResponse.ok) return assetResponse

        const html = await assetResponse.text()

        // Divide o HTML no ponto de injeção
        const splitIdx = html.indexOf('</head>')
        if (splitIdx === -1) {
            // Fallback sem streaming se não tiver </head>
            const data = await dataPromise
            const full = buildInjectedHtml(html, shortId, data)
            if (env.CACHE && data) {
                ctx.waitUntil(env.CACHE.put(`html:${shortId}`, full, { expirationTtl: 86400 }).catch(() => { }))
            }
            return new Response(full, { status: 200, headers: makeHeaders(shortId) })
        }

        const headChunk = html.slice(0, splitIdx)
        const tailChunk = html.slice(splitIdx)       // </head><body>...</body></html>

        // Cria um stream: flushar head IMEDIATAMENTE → browser inicia downloads
        const { readable, writable } = new TransformStream()
        const writer = writable.getWriter()
        const enc = new TextEncoder()

        ctx.waitUntil((async () => {
            try {
                // 1. IMEDIATO: envia o <head> — preconnects, CSS crítico, modulepreload
                //    O browser já começa a baixar os bundles JS enquanto esperamos dados
                await writer.write(enc.encode(headChunk))

                // 2. Aguarda dados do KV/API (paralelo — já estava em flight)
                const checkoutData = await dataPromise
                const scriptTag = buildScriptTag(shortId, checkoutData)

                // 3. Envia injeção de dados + resto do body
                await writer.write(enc.encode(scriptTag + tailChunk))

                // 4. Background: grava HTML completo no KV para próximas requisições (TTL 30min)
                if (env.CACHE && checkoutData) {
                    const fullHtml = headChunk + scriptTag + tailChunk
                    // TTL 24h — purge ativo ao salvar checkout garante dados frescos
                    env.CACHE.put(`html:${shortId}`, fullHtml, { expirationTtl: 86400 }).catch(() => { })
                }
            } catch (_) {
                // Ignora erros de write (conexão fechada pelo cliente, etc.)
            } finally {
                writer.close().catch(() => { })
            }
        })())

        return new Response(readable, { status: 200, headers: makeHeaders(shortId) })
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
    return `<script>window.__IS_CHECKOUT_ROUTE__=true;window.__CHECKOUT_SHORT_ID__=${JSON.stringify(shortId)};window.__checkoutDataPromise=fetch('https://api.clicknich.com/api/checkout-data/'+${JSON.stringify(shortId)},{priority:'high'}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;});</script>\n`
}

/** Usado apenas como fallback quando não há </head> no HTML */
function buildInjectedHtml(html, shortId, data) {
    return html.replace('</head>', buildScriptTag(shortId, data) + '</head>')
}
