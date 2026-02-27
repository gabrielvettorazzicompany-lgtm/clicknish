/**
 * 🚀 HOOK: Service Worker Checkout Ultrafast
 * 
 * Registra e gerencia Service Worker otimizado para checkout
 * - Auto-registro inteligente
 * - Preload de recursos críticos
 * - Cache warming proativo
 * - Performance monitoring
 */

import { useEffect, useRef, useCallback } from 'react'

interface ServiceWorkerStatus {
    isSupported: boolean
    isRegistered: boolean
    isActive: boolean
    version: string | null
    cacheHitRate: number
}

interface UseCheckoutServiceWorkerReturn {
    status: ServiceWorkerStatus
    preloadCheckout: (shortId: string) => Promise<void>
    clearCache: () => Promise<void>
    refreshCache: () => Promise<void>
}

export const useCheckoutServiceWorker = (): UseCheckoutServiceWorkerReturn => {
    const swRegistration = useRef<ServiceWorker | null>(null)
    const statusRef = useRef<ServiceWorkerStatus>({
        isSupported: 'serviceWorker' in navigator,
        isRegistered: false,
        isActive: false,
        version: null,
        cacheHitRate: 0
    })

    // ✅ REGISTRO: Registrar SW automaticamente
    useEffect(() => {
        if (!statusRef.current.isSupported) {
            console.log('[SW Hook] ❌ Service Worker not supported')
            return
        }

        registerServiceWorker()

        // Cleanup no unmount
        return () => {
            if (swRegistration.current) {
                swRegistration.current = null
            }
        }
    }, [])

    // ✅ FUNCIÓN: Registrar Service Worker
    const registerServiceWorker = async () => {
        try {
            console.log('[SW Hook] 🚀 Registering checkout service worker...')

            const registration = await navigator.serviceWorker.register('/checkout-sw.js', {
                scope: '/',
                updateViaCache: 'none' // Sempre buscar atualizações
            })

            console.log('[SW Hook] ✅ Service worker registered:', registration.scope)

            // Aguardar ativação
            if (registration.active) {
                swRegistration.current = registration.active
                statusRef.current.isRegistered = true
                statusRef.current.isActive = true
                console.log('[SW Hook] ⚡ Service worker active immediately')
            } else {
                // Aguardar ativação se ainda não está ativo
                const activeWorker = registration.installing || registration.waiting

                if (activeWorker) {
                    activeWorker.addEventListener('statechange', () => {
                        if (activeWorker.state === 'activated') {
                            swRegistration.current = activeWorker
                            statusRef.current.isRegistered = true
                            statusRef.current.isActive = true
                            console.log('[SW Hook] ⚡ Service worker activated')
                        }
                    })
                }
            }

            // Listener para atualizações
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing

                if (newWorker) {
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && registration.active) {
                            console.log('[SW Hook] 🔄 New service worker available')
                            // Auto-update para checkout (crítico)
                            newWorker.postMessage({ type: 'SKIP_WAITING' })
                        }
                    })
                }
            })

            // Listener para takeover
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                console.log('[SW Hook] 🔄 New service worker took control')
                window.location.reload()
            })

        } catch (error) {
            console.error('[SW Hook] ❌ Service worker registration failed:', error)
            statusRef.current.isRegistered = false
        }
    }

    // ✅ FUNCIÓN: Preload checkout proativo
    const preloadCheckout = useCallback(async (shortId: string): Promise<void> => {
        if (!swRegistration.current || !statusRef.current.isActive) {
            console.warn('[SW Hook] ⚠️ Service worker not active for preload')
            return
        }

        try {
            console.log(`[SW Hook] 🔥 Requesting preload for checkout: ${shortId}`)

            return new Promise((resolve, reject) => {
                const messageChannel = new MessageChannel()

                messageChannel.port1.onmessage = (event) => {
                    const { success, error } = event.data
                    if (success) {
                        console.log(`[SW Hook] ✅ Preload completed: ${shortId}`)
                        resolve()
                    } else {
                        console.error(`[SW Hook] ❌ Preload failed: ${shortId}`, error)
                        reject(new Error(error))
                    }
                }

                swRegistration.current?.postMessage(
                    {
                        type: 'PRELOAD_CHECKOUT',
                        payload: { shortId }
                    },
                    [messageChannel.port2]
                )

                // Timeout após 5s
                setTimeout(() => {
                    reject(new Error('Preload timeout'))
                }, 5000)
            })

        } catch (error) {
            console.error(`[SW Hook] ❌ Preload error: ${shortId}`, error)
            throw error
        }
    }, [])

    // ✅ FUNCIÓN: Limpar cache
    const clearCache = useCallback(async (): Promise<void> => {
        try {
            console.log('[SW Hook] 🗑️ Clearing all caches...')

            const cacheNames = await caches.keys()
            const deletePromises = cacheNames
                .filter(name => name.startsWith('checkout-'))
                .map(name => caches.delete(name))

            await Promise.all(deletePromises)
            console.log(`[SW Hook] ✅ Cleared ${deletePromises.length} caches`)

            // Recarregar para aplicar
            window.location.reload()

        } catch (error) {
            console.error('[SW Hook] ❌ Clear cache failed:', error)
            throw error
        }
    }, [])

    // ✅ FUNCIÓN: Refresh cache (forçar atualização)
    const refreshCache = useCallback(async (): Promise<void> => {
        if (!swRegistration.current) return

        try {
            console.log('[SW Hook] 🔄 Refreshing service worker...')

            // Forçar atualização do SW
            await swRegistration.current.update()
            console.log('[SW Hook] ✅ Service worker update check completed')

        } catch (error) {
            console.error('[SW Hook] ❌ Refresh failed:', error)
            throw error
        }
    }, [])

    return {
        status: statusRef.current,
        preloadCheckout,
        clearCache,
        refreshCache
    }
}

// ✅ UTILITY: Preload checkout on hover (proativo)
export const preloadCheckoutOnHover = (shortId: string, delay = 100) => {
    const { preloadCheckout } = useCheckoutServiceWorker()

    return {
        onMouseEnter: () => {
            setTimeout(() => {
                preloadCheckout(shortId).catch(err => {
                    console.warn('[SW Hook] Hover preload failed:', err)
                })
            }, delay)
        }
    }
}

// ✅ UTILITY: Inicialização automática para checkout
export const initCheckoutServiceWorker = () => {
    // Auto-register on import para checkout pages
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/checkout/')) {
        useCheckoutServiceWorker()
    }
}