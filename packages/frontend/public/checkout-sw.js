/**
 * Service Worker desativado.
 * Este arquivo existe apenas para que browsers que tinham o checkout-sw antigo
 * instalado recebam a atualização, limpem todos os caches e desregistrem.
 * 
 * O SW interceptava todas as navegações em scope '/' incluindo /checkout/:shortId,
 * causando 404 no iOS/Android devido a bug do Safari com streaming responses.
 */
self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
            .then(() => self.registration.unregister())
    )
})


const CACHE_VERSION = 'checkout-v8'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`
const CHECKOUT_DATA_CACHE = `${CACHE_VERSION}-data`

// ✅ RECURSOS CRÍTICOS: Cache infinito até nova versão
const CRITICAL_ASSETS = [
    // Core checkout assets
    '/assets/checkout.css',
    '/assets/checkout.js',
    '/assets/vendor-stripe.js',

    // Fonts críticas
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyeMZhrib2Bg-4.woff2',

    // Icons essenciais
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png',

    // Stripe SDK (crítico para checkout)
    'https://js.stripe.com/v3/',

    // Logo/brand
    '/assets/logo.png',
    '/assets/brand.svg'
]

// ✅ RECURSOS DINÂMICOS: Cache com TTL
const DYNAMIC_PATTERNS = [
    /^https:\/\/api\.clicknich\.com\/api\/checkout-data\//,
    /^https:\/\/api\.clicknich\.com\/api\/process-payment$/,
    /\/checkout\/.*/,
    /\/assets\/.*\.(js|css|woff2|png|webp|svg)$/
]

// ✅ INSTALL: Preload recursos críticos
self.addEventListener('install', event => {
    console.log('[SW] 🚀 Installing checkout service worker v7')

    event.waitUntil(
        Promise.all([
            // Cache crítico: Forçar cache de recursos essenciais
            caches.open(STATIC_CACHE).then(cache => {
                return Promise.allSettled(
                    CRITICAL_ASSETS.map(url => {
                        return cache.add(url).catch(err => {
                            console.warn(`[SW] ⚠️ Failed to cache critical asset: ${url}`, err)
                            return null
                        })
                    })
                ).then(results => {
                    const successful = results.filter(r => r.status === 'fulfilled').length
                    console.log(`[SW] ✅ Cached ${successful}/${CRITICAL_ASSETS.length} critical assets`)
                })
            }),

            // Preparar outros caches
            caches.open(DYNAMIC_CACHE),
            caches.open(CHECKOUT_DATA_CACHE)
        ]).then(() => {
            console.log('[SW] ⚡ Ready for ultrafast checkout loading!')
            // Skip waiting para ativar imediatamente
            self.skipWaiting()
        })
    )
})

// ✅ ACTIVATE: Cleanup old caches
self.addEventListener('activate', event => {
    console.log('[SW] 🔄 Activating new service worker')

    event.waitUntil(
        Promise.all([
            // Limpar caches antigos
            caches.keys().then(keys => {
                const deletePromises = keys
                    .filter(key => key.startsWith('checkout-') && !key.startsWith(CACHE_VERSION))
                    .map(key => {
                        console.log(`[SW] 🗑️ Deleting old cache: ${key}`)
                        return caches.delete(key)
                    })
                return Promise.all(deletePromises)
            }),

            // Claim todos os clients
            self.clients.claim()
        ]).then(() => {
            console.log('[SW] ✅ Service worker activated and ready!')
        })
    )
})

// ✅ FETCH: Estratégias de cache otimizadas
self.addEventListener('fetch', event => {
    const { request } = event
    const url = new URL(request.url)

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return
    }

    // ═══════════════════════════════════════════════════════════════════
    // CRITICAL ASSETS: Cache-First (máxima performance)
    // ═══════════════════════════════════════════════════════════════════
    if (isCriticalAsset(request.url)) {
        event.respondWith(cacheFirst(request, STATIC_CACHE))
        return
    }

    // ═══════════════════════════════════════════════════════════════════
    // CHECKOUT DATA: Stale-While-Revalidate (performance + freshness)
    // ═══════════════════════════════════════════════════════════════════
    if (isCheckoutDataRequest(request.url)) {
        event.respondWith(staleWhileRevalidate(request, CHECKOUT_DATA_CACHE, 300)) // 5min TTL
        return
    }

    // ═══════════════════════════════════════════════════════════════════
    // DYNAMIC ASSETS: Network-First with cache fallback
    // ═══════════════════════════════════════════════════════════════════
    if (isDynamicAsset(request.url)) {
        event.respondWith(networkFirst(request, DYNAMIC_CACHE))
        return
    }

    // ═══════════════════════════════════════════════════════════════════
    // FALLBACK: Network only
    // ═══════════════════════════════════════════════════════════════════
})

// ✅ HELPERS: Cache strategies

/**
 * Cache-First: Para recursos estáticos críticos
 */
async function cacheFirst(request, cacheName) {
    try {
        const cache = await caches.open(cacheName)
        const cached = await cache.match(request)

        if (cached) {
            console.log(`[SW] ⚡ Cache hit: ${request.url}`)
            return cached
        }

        console.log(`[SW] 🌐 Cache miss, fetching: ${request.url}`)
        const response = await fetch(request)

        if (response.ok) {
            cache.put(request, response.clone())
        }

        return response
    } catch (error) {
        console.error(`[SW] ❌ Cache-first failed: ${request.url}`, error)
        throw error
    }
}

/**
 * Stale-While-Revalidate: Para dados dinâmicos com TTL
 */
async function staleWhileRevalidate(request, cacheName, maxAge = 300) {
    try {
        const cache = await caches.open(cacheName)
        const cached = await cache.match(request)

        // Verificar se o cache ainda é válido
        if (cached) {
            const cachedDate = cached.headers.get('sw-cached-at')
            const isStale = !cachedDate || (Date.now() - parseInt(cachedDate)) > maxAge * 1000

            if (!isStale) {
                console.log(`[SW] ⚡ Fresh cache hit: ${request.url}`)
                return cached
            }

            // Stale - retornar cache mas revalidar em background
            console.log(`[SW] 🔄 Stale cache, revalidating: ${request.url}`)
            revalidateInBackground(request, cache)
            return cached
        }

        // Cache miss - fetch e armazenar
        console.log(`[SW] 🌐 No cache, fetching: ${request.url}`)
        const response = await fetch(request)

        if (response.ok) {
            const cloned = response.clone()
            // Adicionar timestamp para TTL
            const headers = new Headers(cloned.headers)
            headers.set('sw-cached-at', Date.now().toString())

            const modifiedResponse = new Response(cloned.body, {
                status: cloned.status,
                statusText: cloned.statusText,
                headers: headers
            })

            cache.put(request, modifiedResponse)
        }

        return response
    } catch (error) {
        console.error(`[SW] ❌ SWR failed: ${request.url}`, error)

        // Fallback para cache mesmo stale em caso de erro
        const cache = await caches.open(cacheName)
        const cached = await cache.match(request)
        if (cached) {
            console.log(`[SW] 🆘 Error fallback to stale cache: ${request.url}`)
            return cached
        }

        throw error
    }
}

/**
 * Network-First: Para recursos dinâmicos com fallback
 */
async function networkFirst(request, cacheName, timeout = 2000) {
    try {
        // Race network vs timeout
        const networkPromise = fetch(request)
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Network timeout')), timeout)
        )

        const response = await Promise.race([networkPromise, timeoutPromise])

        if (response.ok) {
            const cache = await caches.open(cacheName)
            cache.put(request, response.clone())
            console.log(`[SW] 🌐 Network success: ${request.url}`)
            return response
        }

        throw new Error(`Network response not ok: ${response.status}`)

    } catch (error) {
        console.warn(`[SW] 🌐 Network failed, trying cache: ${request.url}`, error.message)

        const cache = await caches.open(cacheName)
        const cached = await cache.match(request)

        if (cached) {
            console.log(`[SW] 💾 Cache fallback: ${request.url}`)
            return cached
        }

        throw error
    }
}

/**
 * Revalidação em background
 */
function revalidateInBackground(request, cache) {
    fetch(request)
        .then(response => {
            if (response.ok) {
                const headers = new Headers(response.headers)
                headers.set('sw-cached-at', Date.now().toString())

                const modifiedResponse = new Response(response.body, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: headers
                })

                cache.put(request, modifiedResponse)
                console.log(`[SW] 🔄 Background revalidation complete: ${request.url}`)
            }
        })
        .catch(err => {
            console.warn(`[SW] 🔄 Background revalidation failed: ${request.url}`, err)
        })
}

// ✅ URL PATTERNS

function isCriticalAsset(url) {
    return CRITICAL_ASSETS.some(asset => url.includes(asset)) ||
        url.includes('/assets/') && (url.includes('.css') || url.includes('.js') || url.includes('.woff2'))
}

function isCheckoutDataRequest(url) {
    return /^https:\/\/api\.clicknich\.com\/api\/checkout-data\//.test(url)
}

function isDynamicAsset(url) {
    return DYNAMIC_PATTERNS.some(pattern => pattern.test(url))
}

// ✅ MESSAGE HANDLING: Preload on-demand
self.addEventListener('message', event => {
    const { type, payload } = event.data

    if (type === 'PRELOAD_CHECKOUT') {
        const { shortId } = payload
        preloadCheckoutData(shortId)
            .then(() => {
                event.ports[0]?.postMessage({ success: true })
            })
            .catch(err => {
                event.ports[0]?.postMessage({ success: false, error: err.message })
            })
    }
})

/**
 * Preload checkout data proativamente
 */
async function preloadCheckoutData(shortId) {
    if (!shortId) return

    const url = `https://api.clicknich.com/api/checkout-data/${shortId}`

    try {
        console.log(`[SW] 🔥 Preloading checkout: ${shortId}`)
        const response = await fetch(url)

        if (response.ok) {
            const cache = await caches.open(CHECKOUT_DATA_CACHE)

            const headers = new Headers(response.headers)
            headers.set('sw-cached-at', Date.now().toString())

            const modifiedResponse = new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers: headers
            })

            await cache.put(url, modifiedResponse)
            console.log(`[SW] ✅ Preloaded checkout data: ${shortId}`)
        }
    } catch (error) {
        console.error(`[SW] ❌ Preload failed: ${shortId}`, error)
    }
}