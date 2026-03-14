import { useState, useEffect, useRef } from 'react'
import { checkoutSupabase as supabase } from '../../../services/checkout-supabase'
import { OrderBump } from '../types'

// ✅ CACHE: Evitar recarregamentos desnecessários
const orderBumpsCache = new Map<string, OrderBump[]>()
const cacheExpiry = new Map<string, number>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutos

// Converte qualquer valor (incluindo string "NaN" do PostgreSQL) para número seguro ou null
const toSafeNum = (v: any): number | null => {
    if (v == null) return null
    const n = Number(v)
    return isNaN(n) ? null : n
}

// Normaliza um offer raw (de get_checkout_data_v2) ou já transformado para OrderBump
// get_checkout_data_v2 retorna campos: id, product_id, offer_price, original_price, offer_image, product_name, ...
// get_checkout_order_bumps_optimized retorna: offer_id, product_id, offer_price, product_price, ...
const normalizeOffer = (item: any): OrderBump => {
    const offerPrice = toSafeNum(item.offer_price) ?? toSafeNum(item.custom_price)
    const originalPrice = toSafeNum(item.original_price)
    const productPrice = toSafeNum(item.product_price) ?? toSafeNum(item.offer_product_price)
    // Prioridade: offer_price > original_price > product_price > 0
    const displayPrice = offerPrice ?? originalPrice ?? productPrice ?? 0
    return {
        id: item.offer_id || item.id,
        offer_product_id: item.product_id || item.offer_product_id,
        offer_product_name: item.product_name || item.offer_product_name,
        offer_product_price: displayPrice,
        offer_product_currency: item.currency || item.offer_product_currency || 'USD',
        offer_product_image: item.offer_image || item.offer_product_image,
        custom_price: offerPrice ?? undefined,
        button_text: item.button_text,
        offer_text: item.offer_text,
        product_name: item.product_name,
        product_description: item.product_description,
        show_product_image: item.show_product_image,
        discount_type: item.discount_percentage ? 'percentage' : 'none',
        discount_value: item.discount_percentage,
        bump_border_type: item.bump_border_type || 'none',
        bump_border_color: item.bump_border_color || '#22c55e',
        bump_bg_color: item.bump_bg_color || '#ffffff',
        bump_show_arrow: item.bump_show_arrow || false,
        bump_arrow_color: item.bump_arrow_color || '#f97316',
        bump_text_color: item.bump_text_color || '#111827',
        bump_bg_gradient: item.bump_bg_gradient || '',
        bump_description_color: item.bump_description_color || '#6b7280',
    }
}

// Remove duplicatas por offer_product_id, priorizando o item com mais dados configurados
const deduplicateOffers = (offers: OrderBump[]): OrderBump[] => {
    const seen = new Map<string, OrderBump>()
    for (const offer of offers) {
        const key = offer.offer_product_id
        if (!key) continue
        const existing = seen.get(key)
        if (!existing) {
            seen.set(key, offer)
        } else {
            // Prefere o item com product_description preenchida (não padrão)
            const hasDescription = offer.product_description && offer.product_description !== 'Add to purchase'
            const existingHasDescription = existing.product_description && existing.product_description !== 'Add to purchase'
            if (hasDescription && !existingHasDescription) {
                seen.set(key, offer)
            }
        }
    }
    return Array.from(seen.values())
}

export const useOrderBumpsOptimized = (checkoutId?: string, productId?: string, initialBumps?: any[]) => {
    // Normaliza initialBumps imediatamente — evita $NaN quando chegam como objetos brutos do Worker
    const [orderBumps, setOrderBumps] = useState<OrderBump[]>(() =>
        deduplicateOffers((initialBumps || []).map(normalizeOffer))
    )
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

                // Helper: converte valor do Supabase para número seguro (trata PostgreSQL NaN → "NaN")
                // (toSafeNum e normalizeOffer definidos no topo do módulo)

                const transformedBumps: OrderBump[] = deduplicateOffers((data || []).map((item: any) => normalizeOffer(item)))

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