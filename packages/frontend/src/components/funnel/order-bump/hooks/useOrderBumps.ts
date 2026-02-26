import { useState, useEffect } from 'react'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { Product, Checkout, OrderBump } from '../types'

interface UseOrderBumpsProps {
    funnelId: string
    onUpdate: () => void
}

export const useOrderBumps = ({ funnelId, onUpdate }: UseOrderBumpsProps) => {
    const { user } = useAuthStore()
    const [products, setProducts] = useState<Product[]>([])
    const [orderBumps, setOrderBumps] = useState<OrderBump[]>([])
    const [checkouts, setCheckouts] = useState<Checkout[]>([])
    const [loading, setLoading] = useState(true)
    const [loadingCheckouts, setLoadingCheckouts] = useState(false)
    const [mainProductId, setMainProductId] = useState<string | null>(null)
    const [mainProductType, setMainProductType] = useState<string | null>(null)

    useEffect(() => {
        if (user) {
            fetchMainProduct()
            fetchProducts()
            fetchOrderBumps()
        }
    }, [user, funnelId])

    const fetchMainProduct = async () => {
        try {
            const { data: funnel, error } = await supabase
                .from('funnels')
                .select('product_id, product_type')
                .eq('id', funnelId)
                .single()

            if (error) throw error

            if (funnel?.product_id) {
                setMainProductId(funnel.product_id)
                setMainProductType(funnel.product_type)
            }
        } catch (error) {
            console.error('Error fetching main product:', error)
        }
    }

    const fetchProducts = async () => {
        try {
            if (!user?.id) {
                console.error('❌ User ID not available')
                return
            }

            // Buscar produtos do marketplace (member areas)
            const { data: marketplaceProducts, error: mpError } = await supabase
                .from('member_areas')
                .select('id, name, price, currency, image_url')
                .eq('owner_id', user.id)
                .order('name')

            if (mpError) throw mpError

            // Buscar aplicações
            const { data: applications, error: appError } = await supabase
                .from('applications')
                .select('id, name, app_type, logo_url')
                .eq('owner_id', user.id)
                .order('name')

            if (appError) throw appError

            // Buscar produtos individuais de apps
            let appProductsList: Product[] = []
            if (applications && applications.length > 0) {
                const appIds = applications.map(a => a.id)
                const { data: prods } = await supabase
                    .from('products')
                    .select('id, name, application_id, cover_url')
                    .in('application_id', appIds)

                if (prods) {
                    appProductsList = prods.map(p => {
                        const app = applications.find(a => a.id === p.application_id)
                        return {
                            id: p.id,
                            name: `${app?.name} › ${p.name}`,
                            product_type: 'digital',
                            source: 'app_product' as const,
                            image_url: p.cover_url,
                            application_id: p.application_id,
                            app_name: app?.name
                        }
                    })
                }
            }

            // Combinar ambos os tipos
            const allProducts: Product[] = [
                ...(marketplaceProducts || []).map(p => ({
                    ...p,
                    product_type: 'digital',
                    source: 'marketplace' as const,
                    image_url: p.image_url,
                    currency: p.currency || 'USD'
                })),
                ...(applications || []).map(app => ({
                    id: app.id,
                    name: app.name,
                    app_type: app.app_type,
                    product_type: 'digital',
                    source: 'application' as const,
                    image_url: app.logo_url
                })),
                ...appProductsList
            ]

            setProducts(allProducts)
        } catch (error) {
            console.error('❌ Error fetching products:', error)
        }
    }

    const fetchOrderBumps = async () => {
        try {
            setLoading(true)

            const { data: bumpsData, error } = await supabase
                .from('checkout_offers')
                .select('*')
                .eq('funnel_id', funnelId)
                .eq('offer_type', 'order_bump')
                .order('offer_position', { ascending: true })

            if (error) throw error

            if (!bumpsData || bumpsData.length === 0) {
                setOrderBumps([])
                return
            }

            const productIds = bumpsData.map(b => b.product_id)

            const { data: marketplaceProds } = await supabase
                .from('member_areas')
                .select('id, name, price, image_url')
                .in('id', productIds)

            const { data: appProds } = await supabase
                .from('applications')
                .select('id, name, app_type, logo_url')
                .in('id', productIds)

            const { data: individualProds } = await supabase
                .from('products')
                .select('id, name, cover_url, application_id')
                .in('id', productIds)

            const bumpsWithProducts = bumpsData.map(bump => {
                const marketplaceProduct = marketplaceProds?.find(p => p.id === bump.product_id)
                const appProduct = appProds?.find(p => p.id === bump.product_id)
                const individualProduct = individualProds?.find(p => p.id === bump.product_id)

                return {
                    ...bump,
                    product: marketplaceProduct
                        ? { ...marketplaceProduct, source: 'marketplace' as const, image_url: marketplaceProduct.image_url }
                        : appProduct
                            ? { ...appProduct, source: 'application' as const, image_url: appProduct.logo_url }
                            : individualProduct
                                ? { ...individualProduct, source: 'app_product' as const, image_url: individualProduct.cover_url }
                                : undefined
                }
            })

            setOrderBumps(bumpsWithProducts)
        } catch (error) {
            console.error('Error fetching order bumps:', error)
        } finally {
            setLoading(false)
        }
    }

    const fetchCheckouts = async (productId: string, productSource: 'marketplace' | 'application' | 'app_product') => {
        try {
            setLoadingCheckouts(true)

            let query = supabase.from('checkouts').select('id, name, custom_price')

            if (productSource === 'marketplace') {
                query = query.eq('member_area_id', productId)
            } else if (productSource === 'application') {
                query = query.eq('application_id', productId)
            } else {
                // app_product: use the parent application's checkout
                const product = products.find(p => p.id === productId)
                if (product?.application_id) {
                    query = query.eq('application_id', product.application_id)
                } else {
                    setCheckouts([])
                    return
                }
            }

            const { data, error } = await query

            if (error) throw error

            if (data) {
                let productPrice = 0
                if (productSource === 'marketplace') {
                    const product = products.find(p => p.id === productId && p.source === 'marketplace')
                    productPrice = product?.price || 0
                }

                const checkoutsWithPrice = data.map(checkout => ({
                    ...checkout,
                    product_price: productPrice,
                    final_price: checkout.custom_price || productPrice
                }))

                setCheckouts(checkoutsWithPrice)
            } else {
                setCheckouts([])
            }
        } catch (error) {
            console.error('❌ Erro ao buscar checkouts:', error)
            setCheckouts([])
        } finally {
            setLoadingCheckouts(false)
        }
    }

    const deleteOrderBump = async (id: string) => {
        try {
            const { error } = await supabase
                .from('checkout_offers')
                .delete()
                .eq('id', id)

            if (error) throw error

            fetchOrderBumps()
            onUpdate()
        } catch (error) {
            console.error('Error deleting order bump:', error)
            throw error
        }
    }

    const reorderOrderBumps = async (reorderedBumps: OrderBump[]) => {
        try {
            const updates = reorderedBumps.map((bump, index) => ({
                id: bump.id,
                offer_position: index + 1
            }))

            for (const update of updates) {
                await supabase
                    .from('checkout_offers')
                    .update({ offer_position: update.offer_position })
                    .eq('id', update.id)
            }

            onUpdate()
        } catch (error) {
            console.error('Erro ao reordenar order bumps:', error)
            throw error
        }
    }

    // Filter out the main product itself, but keep:
    // 1. app_products that belong to the main product (when main is an application)
    // 2. The main application entry IF it has app_products (so user can select its internal products)
    const mainAppHasProducts = mainProductId && products.some(
        p => p.source === 'app_product' && p.application_id === mainProductId
    )
    const filteredProducts = products.filter(p => {
        if (p.id === mainProductId) {
            // Keep the main app in the list only if it has internal products
            // (it will be selectable to reveal its products, but not as a direct order bump)
            return p.source === 'application' && mainAppHasProducts
        }
        return true
    })

    return {
        products,
        filteredProducts,
        orderBumps,
        setOrderBumps,
        checkouts,
        loading,
        loadingCheckouts,
        mainProductId,
        mainProductType,
        fetchCheckouts,
        fetchOrderBumps,
        deleteOrderBump,
        reorderOrderBumps
    }
}
