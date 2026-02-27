/**
 * 🚀 INTELLIGENT RESOURCE PRELOADER
 * 
 * Sistema de preload inteligente para checkout ultrafast
 * - Detecção automática de recursos críticos
 * - Preload adaptativo baseado em conexão
 * - Priority hints para recursos críticos
 * - Intersection Observer para preload sob demanda
 * - Resource timing analysis
 */

interface PreloadConfig {
    priority: 'high' | 'medium' | 'low'
    type: 'script' | 'style' | 'image' | 'font' | 'fetch'
    crossorigin?: boolean
    media?: string
    condition?: () => boolean
}

interface ConnectionInfo {
    effectiveType: '2g' | '3g' | '4g' | 'slow-2g' | 'unknown'
    downlink: number
    rtt: number
    saveData: boolean
}

class IntelligentPreloader {
    private preloadedResources = new Set<string>()
    private connectionInfo: ConnectionInfo
    private intersectionObserver?: IntersectionObserver
    private performanceObserver?: PerformanceObserver

    constructor() {
        this.connectionInfo = this.getConnectionInfo()
        this.initPerformanceMonitoring()
        this.initIntersectionObserver()

        console.log('[Preloader] 🚀 Initialized with connection:', this.connectionInfo)
    }

    // ✅ PRELOAD CRÍTICO: Recursos essenciais para FCP
    async preloadCriticalResources() {
        const criticalResources = this.getCriticalResourcesByConnection()

        console.log(`[Preloader] ⚡ Loading ${criticalResources.length} critical resources`)

        const promises = criticalResources.map(resource =>
            this.preloadResource(resource.url, resource.config)
        )

        const results = await Promise.allSettled(promises)
        const successful = results.filter(r => r.status === 'fulfilled').length

        console.log(`[Preloader] ✅ Loaded ${successful}/${criticalResources.length} critical resources`)
    }

    // ✅ PRELOAD ADAPTATIVO: Baseado na conexão do usuário  
    private getCriticalResourcesByConnection() {
        const base = [
            // Fonts críticas (sempre preload)
            {
                url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
                config: { priority: 'high', type: 'style', crossorigin: true } as PreloadConfig
            },
            {
                url: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyeMZhrib2Bg-4.woff2',
                config: { priority: 'high', type: 'font', crossorigin: true } as PreloadConfig
            },

            // Stripe (crítico para checkout)
            {
                url: 'https://js.stripe.com/v3/',
                config: { priority: 'high', type: 'script', crossorigin: true } as PreloadConfig
            }
        ]

        // Conexões rápidas (4G+): preload completo
        if (this.connectionInfo.effectiveType === '4g' && !this.connectionInfo.saveData) {
            return [
                ...base,
                // Imagens críticas
                {
                    url: '/assets/logo.png',
                    config: { priority: 'medium', type: 'image' } as PreloadConfig
                },
                {
                    url: '/assets/brand.svg',
                    config: { priority: 'medium', type: 'image' } as PreloadConfig
                },
                // CSS secundário
                {
                    url: '/assets/checkout.css',
                    config: { priority: 'medium', type: 'style' } as PreloadConfig
                },
                // JavaScript chunks
                {
                    url: '/assets/vendor-stripe.js',
                    config: { priority: 'medium', type: 'script' } as PreloadConfig
                }
            ]
        }

        // Conexões médias (3G): preload seletivo
        if (this.connectionInfo.effectiveType === '3g') {
            return [
                ...base,
                {
                    url: '/assets/checkout.css',
                    config: { priority: 'low', type: 'style' } as PreloadConfig
                }
            ]
        }

        // Conexões lentas (2G) ou save data: apenas crítico
        return base
    }

    // ✅ PRELOAD RESOURCE: Com priority hints e error handling
    private async preloadResource(url: string, config: PreloadConfig): Promise<void> {
        if (this.preloadedResources.has(url)) {
            console.log(`[Preloader] 📦 Already preloaded: ${url}`)
            return
        }

        // Verificar condição se existir
        if (config.condition && !config.condition()) {
            console.log(`[Preloader] ❌ Condition failed: ${url}`)
            return
        }

        try {
            const startTime = performance.now()

            if (config.type === 'fetch') {
                // Para dados/JSON
                await this.preloadFetch(url)
            } else {
                // Para recursos estáticos
                await this.preloadLink(url, config)
            }

            this.preloadedResources.add(url)
            const duration = performance.now() - startTime

            console.log(`[Preloader] ✅ Preloaded ${config.type}: ${url} (${duration.toFixed(1)}ms)`)

        } catch (error) {
            console.warn(`[Preloader] ❌ Failed to preload: ${url}`, error)
        }
    }

    // ✅ LINK PRELOAD: Para recursos estáticos
    private preloadLink(url: string, config: PreloadConfig): Promise<void> {
        return new Promise((resolve, reject) => {
            const link = document.createElement('link')
            link.rel = 'preload'
            link.href = url
            link.as = config.type === 'script' ? 'script' :
                config.type === 'style' ? 'style' :
                    config.type === 'font' ? 'font' :
                        config.type === 'image' ? 'image' : config.type

            if (config.crossorigin) {
                link.crossOrigin = 'anonymous'
            }

            if (config.media) {
                link.media = config.media
            }

            // Priority hints (experimental)
            if ('fetchPriority' in HTMLLinkElement.prototype) {
                (link as any).fetchPriority = config.priority
            }

            link.onload = () => resolve()
            link.onerror = () => reject(new Error(`Failed to preload: ${url}`))

            document.head.appendChild(link)

            // Timeout para evitar travamento
            setTimeout(() => reject(new Error('Preload timeout')), 5000)
        })
    }

    // ✅ FETCH PRELOAD: Para dados dinâmicos
    private async preloadFetch(url: string): Promise<void> {
        const response = await fetch(url, {
            priority: 'high',
            cache: 'force-cache'
        } as any)

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`)
        }

        // Cache na memória se possível
        await response.arrayBuffer()
    }

    // ✅ PRELOAD ON HOVER: Preload proativo
    preloadOnHover(element: HTMLElement, resources: { url: string, config: PreloadConfig }[]) {
        let hoverTimeout: number

        const handleMouseEnter = () => {
            hoverTimeout = setTimeout(() => {
                console.log('[Preloader] 🎯 Hover preload triggered')
                resources.forEach(resource => {
                    this.preloadResource(resource.url, resource.config)
                })
            }, 200) // 200ms delay
        }

        const handleMouseLeave = () => {
            clearTimeout(hoverTimeout)
        }

        element.addEventListener('mouseenter', handleMouseEnter)
        element.addEventListener('mouseleave', handleMouseLeave)

        return () => {
            element.removeEventListener('mouseenter', handleMouseEnter)
            element.removeEventListener('mouseleave', handleMouseLeave)
            clearTimeout(hoverTimeout)
        }
    }

    // ✅ PRELOAD ON VIEWPORT: Intersection Observer
    preloadOnViewport(element: HTMLElement, resources: { url: string, config: PreloadConfig }[], rootMargin = '50px') {
        if (!this.intersectionObserver) return () => { }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        console.log('[Preloader] 👁️ Viewport preload triggered')
                        resources.forEach(resource => {
                            this.preloadResource(resource.url, resource.config)
                        })
                        observer.unobserve(entry.target)
                    }
                })
            },
            { rootMargin }
        )

        observer.observe(element)

        return () => observer.unobserve(element)
    }

    // ✅ ANALYZE PERFORMANCE: Timing analysis
    private initPerformanceMonitoring() {
        if ('PerformanceObserver' in window) {
            this.performanceObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.entryType === 'navigation') {
                        console.log('[Preloader] 📊 Navigation timing:', {
                            domContentLoaded: entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart,
                            loadComplete: entry.loadEventEnd - entry.loadEventStart,
                            ttfb: entry.responseStart - entry.requestStart
                        })
                    }
                }
            })

            try {
                this.performanceObserver.observe({
                    entryTypes: ['navigation', 'resource', 'measure']
                })
            } catch (error) {
                console.warn('[Preloader] Performance observer failed:', error)
            }
        }
    }

    // ✅ CONNECTION INFO: Detectar capacidade da conexão
    private getConnectionInfo(): ConnectionInfo {
        const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection

        if (connection) {
            return {
                effectiveType: connection.effectiveType || '4g',
                downlink: connection.downlink || 10,
                rtt: connection.rtt || 100,
                saveData: connection.saveData || false
            }
        }

        // Fallback: assumir conexão boa
        return {
            effectiveType: '4g',
            downlink: 10,
            rtt: 100,
            saveData: false
        }
    }

    // ✅ INTERSECTION OBSERVER: Setup
    private initIntersectionObserver() {
        if ('IntersectionObserver' in window) {
            this.intersectionObserver = new IntersectionObserver(() => { }, {
                rootMargin: '50px'
            })
        }
    }

    // ✅ CLEANUP: Limpar recursos
    destroy() {
        this.performanceObserver?.disconnect()
        this.intersectionObserver?.disconnect()
        this.preloadedResources.clear()
    }
}

// ✅ SINGLETON: Instância global
const preloader = new IntelligentPreloader()

// ✅ EXPORTS: Funções utilitárias
export const preloadCriticalResources = () => preloader.preloadCriticalResources()

export const preloadOnHover = (element: HTMLElement, resources: { url: string, config: PreloadConfig }[]) =>
    preloader.preloadOnHover(element, resources)

export const preloadOnViewport = (element: HTMLElement, resources: { url: string, config: PreloadConfig }[], rootMargin?: string) =>
    preloader.preloadOnViewport(element, resources, rootMargin)

export const preloadCheckoutAssets = () => {
    const checkoutResources = [
        {
            url: '/assets/checkout.css',
            config: { priority: 'high', type: 'style' } as PreloadConfig
        },
        {
            url: '/assets/vendor-stripe.js',
            config: { priority: 'high', type: 'script' } as PreloadConfig
        },
        {
            url: '/assets/logo.png',
            config: { priority: 'medium', type: 'image' } as PreloadConfig
        }
    ]

    return Promise.all(
        checkoutResources.map(resource =>
            preloader.preloadResource(resource.url, resource.config)
        )
    )
}

export default preloader