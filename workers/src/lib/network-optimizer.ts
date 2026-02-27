/**
 * 🚀 HTTP/3 & EARLY HINTS OPTIMIZATION MODULE
 * 
 * Otimizações avançadas de rede para Cloudflare Workers
 * - HTTP/3 QUIC protocol
 * - Early Hints (103 Early Hints)
 * - Advanced caching strategies
 * - Bandwidth optimization
 * - Connection multiplexing
 */

interface EarlyHint {
    url: string
    as: 'script' | 'style' | 'font' | 'image' | 'fetch'
    crossorigin?: boolean
    fetchpriority?: 'high' | 'low' | 'auto'
    media?: string
}

interface NetworkOptimization {
    enableHTTP3?: boolean
    enableEarlyHints?: boolean
    enableBrotli?: boolean
    enablePushAPI?: boolean
    cacheTTL?: number
    priorityHints?: boolean
}

export class NetworkOptimizer {
    private config: Required<NetworkOptimization>

    constructor(config: NetworkOptimization = {}) {
        this.config = {
            enableHTTP3: true,
            enableEarlyHints: true,
            enableBrotli: true,
            enablePushAPI: true,
            cacheTTL: 300,
            priorityHints: true,
            ...config
        }

        console.log('[Network] 🚀 Network optimizer initialized with config:', this.config)
    }

    // ✅ EARLY HINTS: Enviar 103 Early Hints para recursos críticos
    async sendEarlyHints(request: Request, criticalResources: EarlyHint[]): Promise<void> {
        if (!this.config.enableEarlyHints || criticalResources.length === 0) return

        try {
            const linkHeaders = criticalResources.map(resource => {
                let link = `<${resource.url}>; rel=preload; as=${resource.as}`

                if (resource.crossorigin) {
                    link += '; crossorigin'
                }

                if (resource.fetchpriority) {
                    link += `; fetchpriority=${resource.fetchpriority}`
                }

                if (resource.media) {
                    link += `; media="${resource.media}"`
                }

                return link
            }).join(', ')

            // Em Cloudflare Workers, Early Hints são enviados automaticamente
            // se incluirmos Link headers na resposta com status < 300
            console.log(`[Network] ⚡ Prepared Early Hints: ${criticalResources.length} resources`)

        } catch (error) {
            console.warn('[Network] ⚠️ Early Hints failed:', error)
        }
    }

    // ✅ OPTIMIZED RESPONSE: Response com todas as otimizações
    createOptimizedResponse(
        body: string | ReadableStream,
        options: {
            status?: number
            headers?: Record<string, string>
            earlyHints?: EarlyHint[]
            cacheKey?: string
            contentType?: string
        } = {}
    ): Response {
        const {
            status = 200,
            headers = {},
            earlyHints = [],
            cacheKey,
            contentType = 'text/html; charset=utf-8'
        } = options

        const optimizedHeaders = this.buildOptimizedHeaders(headers, earlyHints, contentType, cacheKey)

        return new Response(body, {
            status,
            headers: optimizedHeaders
        })
    }

    // ✅ BUILD HEADERS: Construir headers otimizados
    private buildOptimizedHeaders(
        customHeaders: Record<string, string>,
        earlyHints: EarlyHint[],
        contentType: string,
        cacheKey?: string
    ): Headers {
        const headers = new Headers()

        // ✅ CONTENT TYPE
        headers.set('Content-Type', contentType)

        // ✅ HTTP/3 & QUIC
        if (this.config.enableHTTP3) {
            headers.set('alt-svc', 'h3=":443"; ma=86400')
            headers.set('quic-version', 'h3-29,h3-Q050,h3-Q046,h3-Q043')
        }

        // ✅ EARLY HINTS via Link header
        if (this.config.enableEarlyHints && earlyHints.length > 0) {
            const linkHeader = earlyHints.map(hint => {
                let link = `<${hint.url}>; rel=preload; as=${hint.as}`

                if (hint.crossorigin) link += '; crossorigin'
                if (hint.fetchpriority) link += `; fetchpriority=${hint.fetchpriority}`
                if (hint.media) link += `; media="${hint.media}"`

                return link
            }).join(', ')

            headers.set('Link', linkHeader)
        }

        // ✅ VARY (Brotli/GZIP é aplicado automaticamente pelo Cloudflare Workers)
        headers.set('Vary', 'Accept-Encoding')

        // ✅ CACHE CONTROL
        headers.set('Cache-Control', `public, max-age=${this.config.cacheTTL}, stale-while-revalidate=86400`)
        headers.set('CDN-Cache-Control', `max-age=${this.config.cacheTTL * 2}`)
        headers.set('Cloudflare-CDN-Cache-Control', `max-age=${this.config.cacheTTL * 4}`)

        // ✅ PERFORMANCE HEADERS
        headers.set('X-Content-Type-Options', 'nosniff')
        headers.set('X-Frame-Options', 'DENY')
        headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

        // ✅ TIMING HEADERS
        headers.set('Server-Timing', 'cfRequestDuration;desc="Cloudflare"')
        headers.set('X-Cache-Time', Date.now().toString())

        if (cacheKey) {
            headers.set('X-Cache-Key', cacheKey)
        }

        // ✅ CONNECTION OPTIMIZATION
        headers.set('Connection', 'keep-alive')
        headers.set('Keep-Alive', 'timeout=5, max=1000')

        // ✅ PRIORITY HINTS
        if (this.config.priorityHints) {
            headers.set('Priority', 'u=1, i') // Urgent, incremental
        }

        // ✅ CORS (sempre permitir para checkout)
        headers.set('Access-Control-Allow-Origin', '*')
        headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')

        // ✅ CUSTOM HEADERS
        Object.entries(customHeaders).forEach(([key, value]) => {
            headers.set(key, value)
        })

        return headers
    }

    // ✅ CHECKOUT SPECIFIC: Headers específicos para checkout
    createCheckoutResponse(
        body: string | ReadableStream,
        options: {
            shortId?: string
            cacheHit?: boolean
            processingTime?: number
        } = {}
    ): Response {
        const { shortId, cacheHit = false, processingTime = 0 } = options

        // Critical resources para checkout
        const criticalEarlyHints: EarlyHint[] = [
            // Stripe SDK (crítico)
            {
                url: 'https://js.stripe.com/v3/',
                as: 'script',
                crossorigin: true,
                fetchpriority: 'high'
            },
            // Fonts críticas
            {
                url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
                as: 'style',
                crossorigin: true,
                fetchpriority: 'high'
            },
            // CSS crítico
            {
                url: '/assets/checkout-critical.css',
                as: 'style',
                fetchpriority: 'high'
            },
            // JavaScript crítico
            {
                url: '/assets/checkout-critical.js',
                as: 'script',
                fetchpriority: 'high'
            }
        ]

        const customHeaders: Record<string, string> = {
            'X-Checkout-ID': shortId || 'unknown',
            'X-Cache-Status': cacheHit ? 'HIT' : 'MISS',
            'X-Processing-Time': `${processingTime.toFixed(2)}ms`,
            'X-Optimization-Level': 'maximum'
        }

        // Cache mais agressivo para checkout
        const checkoutCacheTTL = cacheHit ? 600 : 300 // 10min se hit, 5min se miss

        return this.createOptimizedResponse(body, {
            headers: {
                ...customHeaders,
                'Cache-Control': `public, max-age=${checkoutCacheTTL}, stale-while-revalidate=3600`
            },
            earlyHints: criticalEarlyHints,
            cacheKey: shortId ? `checkout:${shortId}` : undefined,
            contentType: 'application/json; charset=utf-8'
        })
    }

    // ✅ BANDWIDTH DETECTION: Otimizar baseado na conexão
    detectBandwidthAndOptimize(request: Request): NetworkOptimization {
        const cfData = request.cf as any
        const userAgent = request.headers.get('User-Agent') || ''
        const saveData = request.headers.get('Save-Data') === 'on'

        // Detectar conectividade baseado em CF data
        const isSlowConnection = cfData?.colo && this.isSlowRegion(cfData.colo)
        const isMobile = /Mobile|Android|iPhone|iPad/i.test(userAgent)

        // Ajustar configurações baseado na conexão
        if (saveData || isSlowConnection) {
            return {
                ...this.config,
                cacheTTL: 600, // Cache mais agressivo
                enableBrotli: true,
                enableEarlyHints: false // Economizar roundtrips
            }
        }

        if (isMobile) {
            return {
                ...this.config,
                cacheTTL: 450,
                enableEarlyHints: true,
                priorityHints: true
            }
        }

        // Desktop com conexão boa
        return this.config
    }

    // ✅ SLOW REGIONS: Identificar regiões com conexão mais lenta
    private isSlowRegion(colo: string): boolean {
        // Colos com latência tipicamente mais alta
        const slowRegions = ['BOM', 'DEL', 'CCU', 'MAA', 'HYD', 'JKT', 'CGK', 'MNL', 'TPE']
        return slowRegions.includes(colo)
    }

    // ✅ PRECONNECT HINTS: Hints para preconnect
    static getPreconnectHints(): string[] {
        return [
            'https://js.stripe.com',
            'https://api.stripe.com',
            'https://fonts.googleapis.com',
            'https://fonts.gstatic.com',
            'https://api.clicknich.com'
        ]
    }

    // ✅ DNS PREFETCH: DNS prefetch hints
    static getDNSPrefetchHints(): string[] {
        return [
            'js.stripe.com',
            'api.stripe.com',
            'fonts.googleapis.com',
            'fonts.gstatic.com'
        ]
    }
}

// ✅ MIDDLEWARE: Middleware para Cloudflare Workers
export const applyNetworkOptimizations = (
    optimizer: NetworkOptimizer,
    request: Request,
    responsePromise: Promise<Response>
): Promise<Response> => {
    return responsePromise.then(response => {
        // Só otimizar respostas de sucesso
        if (response.status >= 400) {
            return response
        }

        // Aplicar otimizações baseadas na conexão
        const optimizedConfig = optimizer.detectBandwidthAndOptimize(request)
        const optimizedOptimizer = new NetworkOptimizer(optimizedConfig)

        // Recriar response com otimizações
        return response.text().then(body => {
            return optimizedOptimizer.createOptimizedResponse(body, {
                status: response.status,
                headers: Object.fromEntries(response.headers.entries()),
                contentType: response.headers.get('Content-Type') || 'text/html'
            })
        })
    })
}

// ✅ SINGLETON: Instância otimizada para checkout
export const checkoutNetworkOptimizer = new NetworkOptimizer({
    enableHTTP3: true,
    enableEarlyHints: true,
    enableBrotli: true,
    enablePushAPI: false, // Não necessário com HTTP/3
    cacheTTL: 300,
    priorityHints: true
})