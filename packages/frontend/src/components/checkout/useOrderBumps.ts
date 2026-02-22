import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { OrderBump } from './types'

export const useOrderBumps = (checkoutId?: string, productId?: string) => {
    const [orderBumps, setOrderBumps] = useState<OrderBump[]>([])
    const [selectedBumps, setSelectedBumps] = useState<Set<string>>(new Set())
    const [loading, setLoading] = useState(false)

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
        const fetchOrderBumps = async () => {
            // Skip order bumps when checkout is opened from upsell/downsell
            const urlParams = new URLSearchParams(window.location.search)
            if (urlParams.get('nobumps') === '1') {

                return
            }

            if (!checkoutId && !productId) {

                return
            }

            setLoading(true)
            try {
                // Paralelizar funnel_pages e checkout_offers — ambos dependem apenas do checkoutId
                const [funnelPageResult, checkoutOffersResult] = await Promise.all([
                    checkoutId
                        ? supabase.from('funnel_pages').select('funnel_id').eq('checkout_id', checkoutId)
                        : Promise.resolve({ data: null, error: null }),
                    checkoutId
                        ? supabase.from('checkout_offers').select('*')
                            .eq('checkout_id', checkoutId)
                            .eq('offer_type', 'order_bump')
                            .eq('is_active', true)
                            .order('offer_position', { ascending: true, nullsFirst: false })
                        : Promise.resolve({ data: [], error: null }),
                ])

                let funnelId: string | null =
                    (!funnelPageResult.error && funnelPageResult.data && (funnelPageResult.data as any[]).length > 0)
                        ? (funnelPageResult.data as any[])[0].funnel_id
                        : null

                let offers: any[] =
                    (!checkoutOffersResult.error && checkoutOffersResult.data)
                        ? (checkoutOffersResult.data as any[])
                        : []

                // Fallback 1: Se não encontrou funnel_id pelo checkout_id, buscar pelo product_id
                if (!funnelId && productId) {
                    const { data: funnels, error: funnelError } = await supabase
                        .from('funnels')
                        .select('id')
                        .eq('product_id', productId)

                    if (!funnelError && funnels && funnels.length > 0) {
                        funnelId = funnels[0].id
                    }
                }

                if (!funnelId) {
                    return
                }

                // Fallback 2: Se não encontrou offers por checkout_id, buscar por funnel_id
                if (offers.length === 0 && funnelId) {
                    const { data: funnelOffers, error: funnelError } = await supabase
                        .from('checkout_offers')
                        .select('*')
                        .eq('funnel_id', funnelId)
                        .eq('offer_type', 'order_bump')
                        .eq('is_active', true)
                        .order('offer_position', { ascending: true, nullsFirst: false })

                    if (!funnelError) {
                        offers = funnelOffers || []
                    }
                }

                // Buscar informações dos produtos das ofertas
                const bumpsWithProducts = await Promise.all(
                    offers.map(async (offer: any) => {
                        // Se já tem nome do produto salvo na oferta, usar direto
                        if (offer.product_name && (offer.offer_price !== null || offer.original_price !== null)) {
                            return {
                                id: offer.id,
                                offer_product_id: offer.product_id,
                                offer_product_name: offer.product_name,
                                offer_product_price: offer.offer_price ?? offer.original_price ?? 0,
                                offer_product_currency: offer.currency || 'USD',
                                offer_product_image: offer.offer_product_image,
                                custom_price: offer.offer_price,
                                button_text: offer.button_text,
                                offer_text: offer.offer_text,
                                product_name: offer.product_name,
                                product_description: offer.product_description,
                                show_product_image: offer.show_product_image,
                                discount_type: offer.discount_percentage ? 'percentage' : 'none',
                                discount_value: offer.discount_percentage
                            }
                        }

                        // Primeiro tenta buscar em marketplace_products
                        const { data: marketplaceProducts, error: mpError } = await supabase
                            .from('marketplace_products')
                            .select('name,price,currency,image_url')
                            .eq('id', offer.product_id)
                            .single()

                        let product = null
                        if (!mpError && marketplaceProducts) {
                            product = marketplaceProducts
                        }

                        // Se não encontrou, busca em applications
                        if (!product) {
                            const { data: app, error: appError } = await supabase
                                .from('applications')
                                .select('name,logo_url')
                                .eq('id', offer.product_id)
                                .single()

                            if (!appError && app) {
                                product = {
                                    name: app.name,
                                    price: offer.offer_price ?? offer.original_price ?? 0,
                                    currency: offer.currency || 'USD',
                                    image_url: app.logo_url
                                }
                            }
                        }

                        // Se não encontrou, busca na tabela products (app_product)
                        if (!product) {
                            const { data: appProduct, error: appProdError } = await supabase
                                .from('products')
                                .select('name,cover_url,application_id')
                                .eq('id', offer.product_id)
                                .single()

                            if (!appProdError && appProduct) {
                                product = {
                                    name: appProduct.name,
                                    price: offer.offer_price ?? offer.original_price ?? 0,
                                    currency: offer.currency || 'USD',
                                    image_url: appProduct.cover_url
                                }
                            }
                        }

                        if (!product) {
                            return null
                        }

                        return {
                            id: offer.id,
                            offer_product_id: offer.product_id,
                            offer_product_name: product.name,
                            offer_product_price: product.price,
                            offer_product_currency: product.currency || 'USD',
                            offer_product_image: offer.offer_product_image || product.image_url,
                            custom_price: offer.offer_price,
                            button_text: offer.button_text,
                            offer_text: offer.offer_text,
                            product_name: offer.product_name,
                            product_description: offer.product_description,
                            show_product_image: offer.show_product_image,
                            discount_type: offer.discount_percentage ? 'percentage' : 'none',
                            discount_value: offer.discount_percentage
                        }
                    })
                )

                const validBumps = bumpsWithProducts.filter(Boolean) as OrderBump[]
                setOrderBumps(validBumps)
            } catch (error) {
                console.error('Error fetching order bumps:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchOrderBumps()
    }, [checkoutId, productId])

    return {
        orderBumps,
        selectedBumps,
        loading,
        toggleBump,
        calculateBumpsTotal,
        clearSelection
    }
}