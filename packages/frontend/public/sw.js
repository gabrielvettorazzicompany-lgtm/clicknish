// Service Worker desativado.
// Este arquivo existe apenas para que browsers que tinham o SW antigo
// instalado recebam a atualização, limpem todos os caches e desregistrem.
self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
            .then(() => self.registration.unregister())
    )
})
