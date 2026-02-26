import { useState, useEffect } from 'react'
import { supabase } from '@/services/supabase'

interface FunnelProduct {
    id: string
    name: string
    price?: string
    app_type?: string
    source: string
}

export function useFunnelProduct(funnelId: string, enabled: boolean) {
    const [product, setProduct] = useState<FunnelProduct | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)

    useEffect(() => {
        if (!enabled || !funnelId) return

        const fetchProduct = async () => {
            setLoading(true)
            setError(null)

            try {
                const { data: funnel, error: funnelError } = await supabase
                    .from('funnels')
                    .select('product_id, product_type')
                    .eq('id', funnelId)
                    .single()

                if (funnelError) throw funnelError

                if (funnel?.product_id) {
                    const tableName = funnel.product_type === 'application' || funnel.product_type === 'community'
                        ? 'applications'
                        : 'member_areas'

                    const selectFields = tableName === 'applications'
                        ? 'id, name, app_type'
                        : 'id, name, price'

                    const { data: productData, error: productError } = await supabase
                        .from(tableName)
                        .select(selectFields)
                        .eq('id', funnel.product_id)
                        .maybeSingle()

                    if (productError) throw productError
                    if (productData) {
                        setProduct({ ...productData, source: funnel.product_type })
                    }
                }
            } catch (err) {
                console.error('Error fetching main product:', err)
                setError(err as Error)
            } finally {
                setLoading(false)
            }
        }

        fetchProduct()
    }, [funnelId, enabled])

    return { product, loading, error }
}
