/**
 * 🚀 HOOK: Intelligent Resource Preloader
 * 
 * Hook React para preload inteligente de recursos
 * - Auto-preload baseado em conexão
 * - Preload on-demand por hover/viewport
 * - Performance monitoring
 * - Cleanup automático
 */

import { useEffect, useCallback, useRef } from 'react'
import { preloadCriticalResources, preloadOnHover, preloadOnViewport, preloadCheckoutAssets } from '@/lib/intelligent-preloader'

interface UseIntelligentPreloaderOptions {
    enableCriticalPreload?: boolean
    enableCheckoutPreload?: boolean
    enablePerformanceLogging?: boolean
}

interface PreloadResource {
    url: string
    priority: 'high' | 'medium' | 'low'
    type: 'script' | 'style' | 'image' | 'font' | 'fetch'
    crossorigin?: boolean
}

export const useIntelligentPreloader = (options: UseIntelligentPreloaderOptions = {}) => {
    const {
        enableCriticalPreload = true,
        enableCheckoutPreload = true,
        enablePerformanceLogging = true
    } = options

    const cleanupFunctionsRef = useRef<(() => void)[]>([])
    const startTimeRef = useRef<number>(performance.now())

    // ✅ AUTO-PRELOAD: Carregar recursos críticos automaticamente
    useEffect(() => {
        async function autoPreload() {
            const startTime = performance.now()

            try {
                // Preload recursos críticos globais
                if (enableCriticalPreload) {
                    await preloadCriticalResources()
                }

                // Preload específico do checkout se estiver na página
                if (enableCheckoutPreload && isCheckoutPage()) {
                    await preloadCheckoutAssets()
                }

                const duration = performance.now() - startTime

                if (enablePerformanceLogging) {
                    console.log(`[Preloader Hook] ✅ Auto-preload completed in ${duration.toFixed(1)}ms`)
                }

            } catch (error) {
                console.error('[Preloader Hook] ❌ Auto-preload failed:', error)
            }
        }

        // Executar após um frame para não bloquear o render inicial
        requestAnimationFrame(autoPreload)

    }, [enableCriticalPreload, enableCheckoutPreload, enablePerformanceLogging])

    // ✅ CLEANUP: Limpar listeners no unmount
    useEffect(() => {
        return () => {
            cleanupFunctionsRef.current.forEach(cleanup => cleanup())
            cleanupFunctionsRef.current = []

            if (enablePerformanceLogging) {
                const totalTime = performance.now() - startTimeRef.current
                console.log(`[Preloader Hook] 📊 Total lifecycle time: ${totalTime.toFixed(1)}ms`)
            }
        }
    }, [enablePerformanceLogging])

    // ✅ PRELOAD ON HOVER: Hook para elementos específicos
    const setupHoverPreload = useCallback((
        element: HTMLElement | null,
        resources: PreloadResource[]
    ) => {
        if (!element) return

        const formattedResources = resources.map(resource => ({
            url: resource.url,
            config: {
                priority: resource.priority,
                type: resource.type,
                crossorigin: resource.crossorigin
            }
        }))

        const cleanup = preloadOnHover(element, formattedResources)
        cleanupFunctionsRef.current.push(cleanup)

        return cleanup
    }, [])

    // ✅ PRELOAD ON VIEWPORT: Hook para lazy loading
    const setupViewportPreload = useCallback((
        element: HTMLElement | null,
        resources: PreloadResource[],
        rootMargin = '50px'
    ) => {
        if (!element) return

        const formattedResources = resources.map(resource => ({
            url: resource.url,
            config: {
                priority: resource.priority,
                type: resource.type,
                crossorigin: resource.crossorigin
            }
        }))

        const cleanup = preloadOnViewport(element, formattedResources, rootMargin)
        cleanupFunctionsRef.current.push(cleanup)

        return cleanup
    }, [])

    // ✅ PRELOAD CHECKOUT: Função específica para checkout
    const preloadCheckout = useCallback(async (shortId: string) => {
        if (!shortId) return

        const checkoutResources: PreloadResource[] = [
            {
                url: `https://api.clicknich.com/api/checkout-data/${shortId}`,
                priority: 'high',
                type: 'fetch'
            },
            {
                url: '/assets/vendor-stripe.js',
                priority: 'high',
                type: 'script'
            },
            {
                url: '/assets/checkout.css',
                priority: 'medium',
                type: 'style'
            }
        ]

        try {
            const startTime = performance.now()

            // Preload em paralelo
            await Promise.all(
                checkoutResources.map(async (resource) => {
                    const { default: preloader } = await import('@/lib/intelligent-preloader')
                    return preloader.preloadResource(resource.url, {
                        priority: resource.priority,
                        type: resource.type,
                        crossorigin: resource.crossorigin
                    } as any)
                })
            )

            const duration = performance.now() - startTime

            if (enablePerformanceLogging) {
                console.log(`[Preloader Hook] ✅ Checkout preload completed in ${duration.toFixed(1)}ms`)
            }

        } catch (error) {
            console.error(`[Preloader Hook] ❌ Checkout preload failed for ${shortId}:`, error)
        }
    }, [enablePerformanceLogging])

    // ✅ PERFORMANCE METRICS: Métricas de performance
    const getPerformanceMetrics = useCallback(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming

        if (!navigation) return null

        return {
            ttfb: Math.round(navigation.responseStart - navigation.requestStart),
            domContentLoaded: Math.round(navigation.domContentLoadedEventEnd - navigation.navigationStart),
            loadComplete: Math.round(navigation.loadEventEnd - navigation.navigationStart),
            firstPaint: getFirstPaintTime(),
            firstContentfulPaint: getFirstContentfulPaintTime()
        }
    }, [])

    return {
        setupHoverPreload,
        setupViewportPreload,
        preloadCheckout,
        getPerformanceMetrics
    }
}

// ✅ UTILITIES: Funções auxiliares

function isCheckoutPage(): boolean {
    return window.location.pathname.startsWith('/checkout/')
}

function getFirstPaintTime(): number | null {
    const paintEntries = performance.getEntriesByType('paint')
    const firstPaint = paintEntries.find(entry => entry.name === 'first-paint')
    return firstPaint ? Math.round(firstPaint.startTime) : null
}

function getFirstContentfulPaintTime(): number | null {
    const paintEntries = performance.getEntriesByType('paint')
    const firstContentfulPaint = paintEntries.find(entry => entry.name === 'first-contentful-paint')
    return firstContentfulPaint ? Math.round(firstContentfulPaint.startTime) : null
}

// ✅ HOOK ESPECÍFICO: Para checkout
export const useCheckoutPreloader = (shortId?: string) => {
    const { preloadCheckout, getPerformanceMetrics } = useIntelligentPreloader({
        enableCheckoutPreload: true,
        enablePerformanceLogging: true
    })

    useEffect(() => {
        if (shortId) {
            preloadCheckout(shortId)
        }
    }, [shortId, preloadCheckout])

    return {
        preloadCheckout,
        getPerformanceMetrics
    }
}

// ✅ HOOK ESPECÍFICO: Para hover links
export const useHoverPreload = (resources: PreloadResource[]) => {
    const { setupHoverPreload } = useIntelligentPreloader({
        enableCriticalPreload: false // Não duplicar preload crítico
    })

    const refCallback = useCallback((element: HTMLElement | null) => {
        return setupHoverPreload(element, resources)
    }, [setupHoverPreload, resources])

    return refCallback
}