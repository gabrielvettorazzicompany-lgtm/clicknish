// Service Worker básico para PWA
const CACHE_NAME = 'clicknich-v1'

// Instalar o service worker
self.addEventListener('install', (event) => {
    self.skipWaiting()
})

// Ativar o service worker - limpa caches antigos
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((name) => caches.delete(name))
            )
        }).then(() => clients.claim())
    )
})

// Interceptar requisições com tratamento de erro
self.addEventListener('fetch', (event) => {
    // Não interceptar requisições de módulos JS dinâmicos (chunks do Vite)
    // para evitar erros quando assets são redeployados com novos hashes
    const url = new URL(event.request.url)
    if (url.pathname.startsWith('/assets/') && url.pathname.endsWith('.js')) {
        return // deixa o browser tratar nativamente
    }

    event.respondWith(
        fetch(event.request).catch(() => {
            // Se falhar, retorna erro 503 ao invés de propagar exceção no SW
            return new Response('Service Unavailable', { status: 503 })
        })
    )
})
