/**
 * ⚡ ULTRA-FAST SERVICE WORKER for instant checkout loading
 * Cache strategy: Cache-First for static assets, Stale-While-Revalidate for dynamic content
 */

const CACHE_VERSION = 'v2.1'
const CACHE_STATIC = `clicknich-static-${CACHE_VERSION}`
const CACHE_DYNAMIC = `clicknich-dynamic-${CACHE_VERSION}`
const CACHE_CHECKOUT = `clicknich-checkout-${CACHE_VERSION}`

// Critical assets for instant loading
const CRITICAL_ASSETS = [
    '/',
    '/manifest.json',
    '/pw.jpg',
    'https://js.stripe.com/v3/'
]

// Install: Pre-cache critical assets
self.addEventListener('install', (event) => {
    console.log('🔧 SW installing ultra-fast cache')

    event.waitUntil((async () => {
        try {
            const cache = await caches.open(CACHE_STATIC)

            // Cache only essential assets to avoid errors
            const safeAssets = ['/manifest.json', '/pw.jpg']
            await Promise.allSettled(
                safeAssets.map(url =>
                    cache.add(url).catch(err =>
                        console.warn(`Cache skip ${url}:`, err.message)
                    )
                )
            )

            console.log('✅ Critical assets cached')
        } catch (error) {
            console.warn('Cache install partial failure:', error)
        }

        self.skipWaiting()
    })())
})

// Activate: Clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const cacheNames = await caches.keys()
        const deletePromises = cacheNames
            .filter(name =>
                name.includes('clicknich') &&
                ![CACHE_STATIC, CACHE_DYNAMIC, CACHE_CHECKOUT].includes(name)
            )
            .map(name => caches.delete(name))

        await Promise.all(deletePromises)
        console.log('🗑️ Old caches cleaned')

        self.clients.claim()
    })())
})

// Fetch: Ultra-fast strategy based on resource type
self.addEventListener('fetch', (event) => {
    const { request } = event
    const url = new URL(request.url)

    // Skip non-GET requests
    if (request.method !== 'GET') return

    // Skip dynamic JS chunks to avoid deployment errors
    if (url.pathname.startsWith('/assets/') && url.pathname.endsWith('.js')) {
        return // Let browser handle natively
    }

    // Strategy based on resource type
    if (isStaticAsset(url)) {
        event.respondWith(ultraFastCacheFirst(request))
    } else if (isCheckoutAPI(url)) {
        event.respondWith(staleWhileRevalidate(request))
    } else {
        event.respondWith(networkWithFallback(request))
    }
})

// ═══════════════════════════════════════════════════════════════════
// ULTRA-FAST CACHE STRATEGIES
// ═══════════════════════════════════════════════════════════════════

async function ultraFastCacheFirst(request) {
    try {
        const cache = await caches.open(CACHE_STATIC)
        const cached = await cache.match(request)

        if (cached) {
            // Background update without blocking
            fetch(request).then(response => {
                if (response.ok) cache.put(request, response.clone())
            }).catch(() => { }) // Silent fail

            return cached
        }

        const response = await fetch(request)
        if (response.ok) {
            cache.put(request, response.clone())
        }
        return response

    } catch (error) {
        return fetch(request).catch(() =>
            new Response('Offline', { status: 503 })
        )
    }
}

async function staleWhileRevalidate(request) {
    try {
        const cache = await caches.open(CACHE_CHECKOUT)
        const cached = await cache.match(request)

        const fetchPromise = fetch(request).then(response => {
            if (response.ok) {
                cache.put(request, response.clone())
            }
            return response
        })

        return cached || await fetchPromise

    } catch (error) {
        return fetch(request).catch(() =>
            new Response('Service Unavailable', { status: 503 })
        )
    }
}

async function networkWithFallback(request) {
    try {
        const response = await fetch(request)

        if (response.ok && request.url.includes('/api/checkout-data/')) {
            const cache = await caches.open(CACHE_DYNAMIC)
            cache.put(request, response.clone())
        }

        return response

    } catch (error) {
        const cache = await caches.open(CACHE_DYNAMIC)
        const cached = await cache.match(request)

        return cached || new Response('Service Unavailable', { status: 503 })
    }
}

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

function isStaticAsset(url) {
    return url.pathname.match(/\.(jpg|jpeg|png|svg|css|woff2?|ico)$/) ||
        url.pathname === '/' ||
        url.pathname === '/manifest.json'
}

function isCheckoutAPI(url) {
    return url.pathname.includes('/api/checkout-data/') ||
        url.hostname.includes('api.clicknich.com')
}

// Message handler for dynamic pre-caching
self.addEventListener('message', event => {
    if (event.data?.type === 'PRECACHE_CHECKOUT') {
        console.log('🔥 Pre-caching checkout resources')
        // Pre-cache triggered from main thread
    }
})

console.log(`🚀 Ultra-fast SW ${CACHE_VERSION} ready`)
