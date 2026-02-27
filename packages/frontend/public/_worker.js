/**
 * ⚡ Cloudflare Pages Edge Worker — Checkout SSR
 *
 * Para rotas /c/:shortId:
 *   1. Busca o index.html (static asset) e os dados do checkout em PARALELO
 *   2. Injeta window.__CHECKOUT_DATA__ diretamente no HTML
 *   3. Responde com HTML pré-populado em 1 único roundtrip
 *
 * Para todas as outras rotas: passa direto para assets estáticos.
 *
 * Resultado: browser recebe HTML com dados embutidos — zero fetch adicional
 * necessário no client. O checkout renderiza com dados reais instantaneamente.
 */

const CHECKOUT_API = 'https://api.clicknich.com'

export default {
    async fetch(request, env) {
        const url = new URL(request.url)
        const { pathname } = url

        // ── Rotas que NÃO são checkout → assets estáticos normais ──────────────
        const isCheckout = /^\/c\/([^/?#]+)/.test(pathname)
        if (!isCheckout) {
            return env.ASSETS.fetch(request)
        }

        // ── Rota de checkout: /c/:shortId ────────────────────────────────────────
        const shortId = pathname.match(/^\/c\/([^/?#]+)/)[1]

        // Buscar index.html e dados do checkout EM PARALELO
        // As duas chamadas acontecem ao mesmo tempo — o tempo total é o do mais lento
        const [htmlResponse, checkoutData] = await Promise.all([
            env.ASSETS.fetch(new Request(`${url.origin}/index.html`)),
            fetchCheckoutData(shortId, env),
        ])

        // Se assets falhou, retornar erro
        if (!htmlResponse.ok) {
            return htmlResponse
        }

        const html = await htmlResponse.text()

        // Injetar dados inline no HTML — cliente não precisa fazer nenhum fetch
        const injectedHtml = injectCheckoutData(html, shortId, checkoutData)

        return new Response(injectedHtml, {
            status: 200,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                // HTML de checkout: curto porque muda (produto, preço pode mudar)
                // mas ainda aproveitamos stale-while-revalidate para velocidade
                'Cache-Control': 'public, max-age=0, stale-while-revalidate=30',
                'X-Edge-Rendered': 'true',
                'X-Checkout-Id': shortId,
                // Preconnect hints HTTP
                'Link': [
                    '<https://js.stripe.com>; rel=preconnect; crossorigin',
                    '<https://api.stripe.com>; rel=preconnect; crossorigin',
                    '<https://api.clicknich.com>; rel=preconnect; crossorigin',
                ].join(', '),
            },
        })
    },
}

/**
 * Busca dados do checkout — primeiro tenta KV local, depois API worker
 */
async function fetchCheckoutData(shortId, env) {
    // FAST PATH: KV disponível no edge worker do Pages
    if (env.CACHE) {
        try {
            const cached = await env.CACHE.get(`checkout-data:${shortId}`, 'json')
            if (cached) {
                console.log(`[_worker] KV hit: ${shortId}`)
                return cached
            }
        } catch (e) {
            // Silent fail
        }
    }

    // FALLBACK: API worker (que também tem KV cache)
    try {
        const res = await fetch(
            `${CHECKOUT_API}/api/checkout-data/${shortId}`,
            {
                cf: { cacheTtl: 300, cacheEverything: true }, // Cache na CDN Cloudflare também
            }
        )
        if (res.ok) {
            return await res.json()
        }
    } catch (e) {
        console.warn('[_worker] API fetch failed:', e)
    }

    return null
}

/**
 * Injeta os dados do checkout como window.__CHECKOUT_DATA__ no HTML
 * Substitui também o script de prefetch client-side (não é mais necessário)
 */
function injectCheckoutData(html, shortId, data) {
    const dataScript = data
        ? `<script>
        window.__IS_CHECKOUT_ROUTE__ = true;
        window.__CHECKOUT_SHORT_ID__ = ${JSON.stringify(shortId)};
        window.__CHECKOUT_DATA__ = ${JSON.stringify(data)};
        // Dados já embutidos no HTML — sem fetch adicional necessário
        window.__checkoutDataPromise = Promise.resolve(window.__CHECKOUT_DATA__);
      </script>`
        : `<script>
        window.__IS_CHECKOUT_ROUTE__ = true;
        window.__CHECKOUT_SHORT_ID__ = ${JSON.stringify(shortId)};
        // Edge não tinha dados em cache — client vai buscar normalmente
        window.__checkoutDataPromise = fetch(
          'https://api.clicknich.com/api/checkout-data/' + ${JSON.stringify(shortId)},
          { priority: 'high' }
        ).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; });
      </script>`

    // Injeta imediatamente antes do </head> para execução o mais cedo possível
    return html.replace('</head>', dataScript + '\n</head>')
}
