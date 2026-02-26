import { useState, useEffect } from 'react'
import { supabase } from '@/services/supabase'

interface Checkout {
    id: string
    name: string
}

interface UseFunnelCheckoutProps {
    funnelId: string
    pageId: string
    enabled: boolean
}

export function useFunnelCheckout({ funnelId, pageId, enabled }: UseFunnelCheckoutProps) {
    const [checkouts, setCheckouts] = useState<Checkout[]>([])
    const [selectedCheckout, setSelectedCheckout] = useState<string>('')
    const [loadingCheckouts, setLoadingCheckouts] = useState(false)
    const [savingCheckout, setSavingCheckout] = useState(false)

    useEffect(() => {
        if (!enabled) return

        fetchCheckouts()
        fetchCurrentCheckout()
    }, [funnelId, pageId, enabled])

    const fetchCheckouts = async () => {
        setLoadingCheckouts(true)
        try {
            // Fetch the product_id and product_type from the funnel
            const { data: funnel, error: funnelError } = await supabase
                .from('funnels')
                .select('product_id, product_type')
                .eq('id', funnelId)
                .single()

            if (funnelError) throw funnelError

            if (!funnel?.product_id) {

                setCheckouts([])
                return
            }



            // Fetch checkouts based on product type
            let query = supabase
                .from('checkouts')
                .select('id, name')
                .order('created_at', { ascending: false })

            if (funnel.product_type === 'application' || funnel.product_type === 'community') {
                query = query.eq('application_id', funnel.product_id)
            } else {
                query = query.eq('member_area_id', funnel.product_id)
            }

            const { data, error } = await query

            if (error) {
                console.error('❌ Query error:', error)
                throw error
            }

            setCheckouts(data || [])

        } catch (error) {
            console.error('Error fetching checkouts:', error)
            setCheckouts([])
        } finally {
            setLoadingCheckouts(false)
        }
    }

    const fetchCurrentCheckout = async () => {
        try {
            const { data, error } = await supabase
                .from('funnel_pages')
                .select('checkout_id')
                .eq('id', pageId)
                .single()

            if (error) throw error
            if (data?.checkout_id) {
                setSelectedCheckout(data.checkout_id)

            }
        } catch (error) {
            console.error('Error fetching current checkout:', error)
        }
    }

    const updateCheckout = async (checkoutId: string): Promise<boolean> => {
        if (!checkoutId) return false

        try {
            setSavingCheckout(true)

            const { error } = await supabase
                .from('funnel_pages')
                .update({ checkout_id: checkoutId })
                .eq('id', pageId)

            if (error) throw error

            setSelectedCheckout(checkoutId)

            return true
        } catch (error) {
            console.error('Error linking checkout:', error)
            return false
        } finally {
            setSavingCheckout(false)
        }
    }

    return {
        checkouts,
        selectedCheckout,
        loadingCheckouts,
        savingCheckout,
        updateCheckout,
        refetch: fetchCheckouts
    }
}
