/**
 * 🚀 INTELLIGENT LAZY LOADING SYSTEM
 * 
 * Sistema de lazy loading inteligente para checkout
 * - Preload baseado em prioridade
 * - Loading progressivo
 * - Error boundaries
 * - Performance monitoring
 */

import React, { lazy, Suspense, ComponentType, ReactNode } from 'react'

interface LazyLoadConfig {
    priority: 'critical' | 'high' | 'medium' | 'low'
    preload?: boolean
    chunkName?: string
    timeout?: number
    retries?: number
}

interface LazyLoadOptions extends LazyLoadConfig {
    fallback?: ReactNode
    errorFallback?: ComponentType<{ error: Error; retry: () => void }>
}

class LazyLoadManager {
    private loadedChunks = new Set<string>()
    private preloadPromises = new Map<string, Promise<any>>()
    private retryCount = new Map<string, number>()

    // ✅ LAZY LOAD: Com configurações avançadas
    createLazyComponent<T = any>(
        importFn: () => Promise<{ default: ComponentType<T> }>,
        options: LazyLoadOptions = { priority: 'medium' }
    ): ComponentType<T> {
        const {
            priority,
            preload = false,
            chunkName,
            timeout = 10000,
            retries = 3,
            fallback,
            errorFallback
        } = options

        // Wrapper para timeout e retry
        const importWithTimeout = async () => {
            const chunkKey = chunkName || Date.now().toString()

            try {
                // Verificar se já foi carregado
                if (this.loadedChunks.has(chunkKey)) {
                    console.log(`[LazyLoad] ⚡ Cache hit: ${chunkKey}`)
                }

                // Race entre import e timeout
                const importPromise = importFn()
                const timeoutPromise = new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error(`Timeout loading ${chunkKey}`)), timeout)
                )

                const result = await Promise.race([importPromise, timeoutPromise])

                this.loadedChunks.add(chunkKey)
                this.retryCount.delete(chunkKey)

                console.log(`[LazyLoad] ✅ Loaded: ${chunkKey} (priority: ${priority})`)
                return result

            } catch (error) {
                const currentRetries = this.retryCount.get(chunkKey) || 0

                if (currentRetries < retries) {
                    this.retryCount.set(chunkKey, currentRetries + 1)
                    console.warn(`[LazyLoad] 🔄 Retry ${currentRetries + 1}/${retries}: ${chunkKey}`)

                    // Retry com backoff exponencial
                    await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, currentRetries)))
                    return importWithTimeout()
                }

                console.error(`[LazyLoad] ❌ Failed to load: ${chunkKey}`, error)
                throw error
            }
        }

        // Criar componente lazy
        const LazyComponent = lazy(importWithTimeout)

        // Preload se solicitado
        if (preload) {
            this.preloadComponent(chunkName || 'unnamed', importWithTimeout)
        }

        // Wrapper com Suspense e error handling
        return (props: T & JSX.IntrinsicAttributes) => (
            <LazyComponentWrapper
                LazyComponent= { LazyComponent }
        fallback = { fallback }
        errorFallback = { errorFallback }
        chunkName = { chunkName }
        {...props }
            />
        )
    }

    // ✅ PRELOAD: Preload proativo
    async preloadComponent(chunkName: string, importFn: () => Promise<any>) {
        if (this.preloadPromises.has(chunkName)) {
            return this.preloadPromises.get(chunkName)
        }

        console.log(`[LazyLoad] 🔥 Preloading: ${chunkName}`)

        const promise = importFn().then(result => {
            this.loadedChunks.add(chunkName)
            console.log(`[LazyLoad] ✅ Preloaded: ${chunkName}`)
            return result
        }).catch(error => {
            console.warn(`[LazyLoad] ⚠️ Preload failed: ${chunkName}`, error)
            this.preloadPromises.delete(chunkName) // Allow retry
            throw error
        })

        this.preloadPromises.set(chunkName, promise)
        return promise
    }

    // ✅ PRELOAD CRITICAL: Recursos críticos primeiro
    async preloadCriticalChunks() {
        const criticalChunks = [
            {
                name: 'checkout-payment',
                importFn: () => import('@/components/checkout/PaymentForm')
            },
            {
                name: 'checkout-summary',
                importFn: () => import('@/components/checkout/OrderSummary')
            },
            {
                name: 'stripe-elements',
                importFn: () => import('@stripe/react-stripe-js')
            }
        ]

        console.log(`[LazyLoad] 🚀 Preloading ${criticalChunks.length} critical chunks`)

        const results = await Promise.allSettled(
            criticalChunks.map(chunk => this.preloadComponent(chunk.name, chunk.importFn))
        )

        const successful = results.filter(r => r.status === 'fulfilled').length
        console.log(`[LazyLoad] ✅ Preloaded ${successful}/${criticalChunks.length} critical chunks`)
    }

    // ✅ UTILS: Cache status
    getLoadedChunks() {
        return Array.from(this.loadedChunks)
    }

    clearCache() {
        this.loadedChunks.clear()
        this.preloadPromises.clear()
        this.retryCount.clear()
    }
}

// ✅ COMPONENT WRAPPER: Com error boundary
interface LazyComponentWrapperProps {
    LazyComponent: ComponentType<any>
    fallback?: ReactNode
    errorFallback?: ComponentType<{ error: Error; retry: () => void }>
    chunkName?: string
    [key: string]: any
}

const LazyComponentWrapper = ({
    LazyComponent,
    fallback,
    errorFallback: ErrorFallback,
    chunkName,
    ...props
}: LazyComponentWrapperProps) => {
    const defaultFallback = (
        <div className= "flex items-center justify-center p-6" >
        <div className="loading-spinner mr-2" > </div>
            < span className = "text-sm text-gray-500" > Carregando componente...</span>
                </div>
    )

const defaultErrorFallback = ({ error, retry }: { error: Error; retry: () => void }) => (
    <div className= "p-6 text-center border border-red-200 rounded-lg bg-red-50" >
    <p className="text-red-600 mb-4" > Erro ao carregar componente </p>
        < button
onClick = { retry }
className = "px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
    >
    Tentar novamente
        </button>
        </div>
    )

return (
    <LazyErrorBoundary 
            ErrorComponent= { ErrorFallback || defaultErrorFallback}
chunkName = { chunkName }
    >
    <Suspense fallback={ fallback || defaultFallback }>
        <LazyComponent { ...props } />
        </Suspense>
        </LazyErrorBoundary>
    )
}

// ✅ ERROR BOUNDARY: Para lazy components
class LazyErrorBoundary extends React.Component<{
    children: ReactNode
    ErrorComponent: ComponentType<{ error: Error; retry: () => void }>
    chunkName?: string
}, { hasError: boolean; error: Error | null }> {
    constructor(props: any) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, errorInfo: any) {
        console.error(`[LazyLoad] 💥 Component error: ${this.props.chunkName}`, error, errorInfo)
    }

    retry = () => {
        this.setState({ hasError: false, error: null })
    }

    render() {
        if (this.state.hasError && this.state.error) {
            return <this.props.ErrorComponent error = { this.state.error } retry = { this.retry } />
        }

        return this.props.children
    }
}

// ✅ SINGLETON: Instância global
const lazyLoadManager = new LazyLoadManager()

// ✅ EXPORTS: Utilitários
export const createLazyCheckoutComponent = <T = any>(
    importFn: () => Promise<{ default: ComponentType<T> }>,
    options?: LazyLoadOptions
) => lazyLoadManager.createLazyComponent(importFn, { priority: 'high', ...options })

export const preloadCriticalChunks = () => lazyLoadManager.preloadCriticalChunks()

export const preloadComponent = (chunkName: string, importFn: () => Promise<any>) =>
    lazyLoadManager.preloadComponent(chunkName, importFn)

export default lazyLoadManager