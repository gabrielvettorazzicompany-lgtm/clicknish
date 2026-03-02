import { useState, useEffect, useRef } from 'react'
import { checkoutSupabase as supabase } from '../../../services/checkout-supabase'
import { OrderBump } from '../types'

// ✅ CACHE: Evitar recarregamentos desnecessários
const orderBumpsCache = new Map<string, OrderBump[]>()
const cacheExpiry = new Map<string, number>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutos

export const useOrderBumpsOptimized = (checkoutId?: string, productId?: string, initialBumps?: OrderBump[]) => {
    const [orderBumps, setOrderBumps] = useState<OrderBump[]>(initialBumps || [])
    const [selectedBumps, setSelectedBumps] = useState<Set<string>>(new Set())
    const [loading, setLoading] = useState(false)
    const abortControllerRef = useRef<AbortController | null>(null)

    // Cache key baseado nos parâmetros
    const cacheKey = `${checkoutId || 'none'}-${productId || 'none'}`

    // Função para alternar seleção de order bump
    const toggleBump = (bumpId: string) => {
        setSelectedBumps(prev => {
            const newSet = new Set(prev)
            if (newSet.has(bumpId)) {
                newSet.delete(bumpId)
            } else {
                newSet.add(bumpId)
            }
            return newSet
        })
    }

    // Calcular total incluindo order bumps selecionados
    const calculateBumpsTotal = () => {
        let total = 0
        selectedBumps.forEach(bumpId => {
            const bump = orderBumps.find(b => b.id === bumpId)
            if (bump) {
                const price = bump.custom_price || bump.offer_product_price
                total += price
            }
        })
        return total
    }

    // Limpar seleções
    const clearSelection = () => {
        setSelectedBumps(new Set())
    }

    useEffect(() => {
        const fetchOrderBumpsOptimized = async () => {
            // ✅ OTIMIZAÇÃO: Skip request se não há dados para buscar
            if (!checkoutId && !productId) {
                console.log('❌ useOrderBumps: Skipping fetch - no checkoutId or productId')
                return
            }

            // Skip order bumps when checkout is opened from upsell/downsell
            const urlParams = new URLSearchParams(window.location.search)
            if (urlParams.get('nobumps') === '1') {
                console.log('❌ useOrderBumps: Skipping fetch - nobumps=1 param')
                return
            }

            // Skip fetch if we already have pre-loaded bumps from RPC
            if (initialBumps && initialBumps.length > 0) {
                console.log('✅ useOrderBumps: Using pre-loaded bumps, skipping fetch')
                return
            }

            // ✅ CACHE: Verificar cache primeiro
            const now = Date.now()
            const cached = orderBumpsCache.get(cacheKey)
            const expiry = cacheExpiry.get(cacheKey)

            if (cached && expiry && now < expiry) {
                console.log('✅ useOrderBumps: Using cached data')
                setOrderBumps(cached)
                return
            }

            // ✅ ABORT: Cancelar requisições anteriores
            if (abortControllerRef.current) {
                abortControllerRef.current.abort()
            }
            abortControllerRef.current = new AbortController()
            const { signal } = abortControllerRef.current

            setLoading(true)

            try {
                console.log('🚀 useOrderBumps: Fetching optimized data...')

                // ✅ OTIMIZAÇÃO: Uma ÚNICA query com JOIN para buscar tudo
                const { data, error } = await supabase.rpc('get_checkout_order_bumps_optimized', {
                    p_checkout_id: checkoutId || null,
                    p_product_id: productId || null
                }, { signal })

                if (error) {
                    console.error('❌ useOrderBumps: RPC error:', error)
                    return
                }

                if (signal.aborted) return

                const transformedBumps: OrderBump[] = (data || []).map((item: any) => ({
                    id: item.offer_id,
                    offer_product_id: item.product_id,
                    offer_product_name: item.product_name,
                    offer_product_price: item.offer_price || item.product_price || 0,
                    offer_product_currency: item.currency || 'USD',
                    offer_product_image: item.offer_image || item.product_image,
                    custom_price: item.offer_price,
                    button_text: item.button_text,
                    offer_text: item.offer_text,
                    product_name: item.product_name,
                    product_description: item.product_description,
                    show_product_image: item.show_product_image,
                    discount_type: item.discount_percentage ? 'percentage' : 'none',
                    discount_value: item.discount_percentage
                }))

                // ✅ CACHE: Salvar resultado
                orderBumpsCache.set(cacheKey, transformedBumps)
                cacheExpiry.set(cacheKey, now + CACHE_TTL)

                setOrderBumps(transformedBumps)
                console.log(`✅ useOrderBumps: Loaded ${transformedBumps.length} order bumps`)

            } catch (error: any) {
                if (error.name === 'AbortError') return
                console.error('💥 useOrderBumps: Error fetching order bumps:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchOrderBumpsOptimized()

        // ✅ CLEANUP: Cancelar requisições no unmount
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort()
            }
        }
    }, [checkoutId, productId, cacheKey])

    return {
        orderBumps,
        selectedBumps,
        toggleBump,
        clearSelection,
        calculateBumpsTotal,
        loading
    }
}