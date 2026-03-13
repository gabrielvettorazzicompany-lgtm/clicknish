import { useState, useEffect, useMemo, useCallback } from 'react'
import { DateRange } from 'react-day-picker'
import { supabase } from '@/services/supabase'

export interface Order {
    id: string
    orderNumber: string
    date: string
    total: number
    currency: string
    customer: {
        name: string
        email: string
    }
    paymentMethod: string
    paymentStatus: 'completed' | 'pending' | 'failed'
    productName: string
    productId: string
    productType: 'marketplace' | 'app'
}

interface UseOrdersParams {
    tab: 'all' | 'paid' | 'pending' | 'failed'
    searchQuery: string
    paymentMethod: string
    dateRange: DateRange | undefined
    selectedProduct: string
}

export function useOrders(params: UseOrdersParams) {
    const [allOrders, setAllOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [rawStats, setRawStats] = useState({ all: 0, paid: 0, pending: 0, failed: 0 })

    // Memoizar parâmetros que afetam a query do servidor (datas)
    const serverParams = useMemo(() => ({
        fromDate: params.dateRange?.from,
        toDate: params.dateRange?.to,
    }), [params.dateRange?.from, params.dateRange?.to])

    // Fetch do Worker (apenas quando datas mudam)
    const fetchOrders = useCallback(async () => {
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { setLoading(false); return }

            const response = await fetch('https://api.clicknich.com/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    fromDate: serverParams.fromDate?.toISOString(),
                    toDate: serverParams.toDate?.toISOString(),
                })
            })

            const data = await response.json()

            if (!response.ok) {
                console.error('Error fetching orders:', data.error)
                setAllOrders([])
                return
            }

            setAllOrders(data.orders || [])
            setRawStats(data.stats || { all: 0, paid: 0, pending: 0, failed: 0 })
        } catch (err) {
            console.error('Error fetching orders:', err)
            setAllOrders([])
        } finally {
            setLoading(false)
        }
    }, [serverParams])

    useEffect(() => {
        fetchOrders()
    }, [fetchOrders])

    // Filtros locais (aplicados no frontend, sem nova requisição)
    const orders = useMemo(() => {
        let filtered = [...allOrders]

        // Filtro por produto
        if (params.selectedProduct !== 'all') {
            filtered = filtered.filter(o => o.productId === params.selectedProduct)
        }

        // Filtro por tab (status)
        if (params.tab === 'paid') filtered = filtered.filter(o => o.paymentStatus === 'completed')
        else if (params.tab === 'pending') filtered = filtered.filter(o => o.paymentStatus === 'pending')
        else if (params.tab === 'failed') filtered = filtered.filter(o => o.paymentStatus === 'failed')

        // Filtro por método de pagamento
        if (params.paymentMethod !== 'all') {
            filtered = filtered.filter(o => o.paymentMethod === params.paymentMethod)
        }

        // Filtro por busca
        if (params.searchQuery) {
            const q = params.searchQuery.toLowerCase()
            filtered = filtered.filter(o =>
                o.orderNumber.toLowerCase().includes(q) ||
                o.customer.email.toLowerCase().includes(q) ||
                o.customer.name.toLowerCase().includes(q) ||
                o.productName.toLowerCase().includes(q)
            )
        }

        return filtered
    }, [allOrders, params.tab, params.selectedProduct, params.paymentMethod, params.searchQuery])

    const stats = useMemo(() => rawStats, [rawStats])

    return { orders, loading, stats }
}

