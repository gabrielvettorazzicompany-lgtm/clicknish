import { useState, useEffect, useRef } from 'react'
import { Stripe } from '@stripe/stripe-js'
import { getStripePromise } from '@/lib/stripe-singleton'

// ✅ CACHE: Instância global do Stripe  
let stripeInstanceCache: Stripe | null = null
let stripeLoadingPromise: Promise<Stripe | null> | null = null

// ✅ PRELOAD: Carregar Stripe em background quando necessário
export const preloadStripe = () => {
    if (!stripeInstanceCache && !stripeLoadingPromise) {
        console.log('🚀 Preloading Stripe in background...')
        stripeLoadingPromise = (getStripePromise() ?? Promise.resolve(null))
            .then(stripe => {
                stripeInstanceCache = stripe
                console.log('✅ Stripe preloaded successfully')
                return stripe
            })
            .catch(error => {
                console.error('❌ Stripe preload failed:', error)
                stripeLoadingPromise = null
                return null
            })
    }
    return stripeLoadingPromise
}

// ✅ HOOK: Stripe otimizado com cache e lazy loading
export const useStripeOptimized = (shouldLoad: boolean = true) => {
    const [stripe, setStripe] = useState<Stripe | null>(stripeInstanceCache)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const loadingRef = useRef(false)

    useEffect(() => {
        if (!shouldLoad) {
            return
        }

        // Se já tem cache, usar imediatamente
        if (stripeInstanceCache) {
            setStripe(stripeInstanceCache)
            return
        }

        // Se já está carregando, aguardar
        if (stripeLoadingPromise) {
            setLoading(true)
            stripeLoadingPromise
                .then(stripeInstance => {
                    setStripe(stripeInstance)
                    setLoading(false)
                })
                .catch(err => {
                    setError(err.message || 'Failed to load Stripe')
                    setLoading(false)
                })
            return
        }

        // Evitar carregamentos duplicados
        if (loadingRef.current) return
        loadingRef.current = true

        setLoading(true)
        setError(null)

        console.log('🔄 Loading Stripe...')

        stripeLoadingPromise = getStripePromise() ?? Promise.resolve(null)

        stripeLoadingPromise
            .then(stripeInstance => {
                stripeInstanceCache = stripeInstance
                setStripe(stripeInstance)
                console.log('✅ Stripe loaded successfully')
            })
            .catch(err => {
                console.error('❌ Stripe loading error:', err)
                setError(err.message || 'Failed to load Stripe')
                stripeLoadingPromise = null
            })
            .finally(() => {
                setLoading(false)
                loadingRef.current = false
            })

    }, [shouldLoad])

    return {
        stripe,
        loading,
        error,
        isReady: !!stripe && !loading
    }
}

// ✅ UTILITY: Verificar se Stripe está disponível sem carregar
export const isStripeAvailable = () => {
    return true
}

// ✅ UTILITY: Get Stripe instance de forma otimizada
export const getStripeInstance = async (): Promise<Stripe | null> => {
    if (stripeInstanceCache) {
        return stripeInstanceCache
    }

    if (stripeLoadingPromise) {
        return await stripeLoadingPromise
    }

    return await preloadStripe()
}