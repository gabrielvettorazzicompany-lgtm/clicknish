import { useState, useEffect } from 'react'
import { supabase } from '@/services/supabase'

interface Product {
    id: string
    name: string
    type: 'marketplace' | 'app' | 'community'
}

export function useDashboardProducts(userId: string | undefined) {
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!userId) return

        const fetchProducts = async () => {
            setLoading(true)
            try {
                const allProducts: Product[] = []

                // Fetch marketplace products
                const { data: marketplaceProducts, error: marketplaceError } = await supabase
                    .from('member_areas')
                    .select('id, name')
                    .eq('owner_id', userId)

                if (!marketplaceError && marketplaceProducts) {
                    allProducts.push(
                        ...marketplaceProducts.map((p) => ({
                            id: p.id,
                            name: p.name,
                            type: 'marketplace' as const
                        }))
                    )
                }

                // Fetch apps/applications
                const { data: apps, error: appsError } = await supabase
                    .from('applications')
                    .select('id, name, app_type')
                    .eq('owner_id', userId)

                if (!appsError && apps) {
                    apps.forEach((a) => {
                        allProducts.push({
                            id: a.id,
                            name: a.name,
                            type: a.app_type === 'community' ? 'community' : 'app'
                        })
                    })
                }

                setProducts(allProducts)
            } catch (error) {
                console.error('Error fetching products:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchProducts()
    }, [userId])

    return { products, loading }
}
