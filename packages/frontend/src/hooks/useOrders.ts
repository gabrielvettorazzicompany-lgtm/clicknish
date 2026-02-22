import { useState, useEffect, useMemo, useCallback } from 'react'
import { DateRange } from 'react-day-picker'
import { supabase } from '@/services/supabase'

export interface Order {
    id: string
    orderNumber: string
    date: string
    total: number
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
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [rawStats, setRawStats] = useState({ all: 0, paid: 0, pending: 0, failed: 0 })

    // Memoizar parâmetros para evitar re-fetches desnecessários
    const queryParams = useMemo(() => ({
        tab: params.tab,
        searchQuery: params.searchQuery,
        paymentMethod: params.paymentMethod,
        fromDate: params.dateRange?.from,
        toDate: params.dateRange?.to,
        selectedProduct: params.selectedProduct
    }), [params.tab, params.searchQuery, params.paymentMethod, params.dateRange?.from, params.dateRange?.to, params.selectedProduct])

    // Memoizar função de fetch
    const fetchOrders = useCallback(async () => {
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { setLoading(false); return }

            const fromDate = queryParams.fromDate
            const toDate = queryParams.toDate

            // IDs dos apps do usuário
            const { data: userApps } = await supabase
                .from('applications')
                .select('id')
                .eq('owner_id', user.id)
            const appIds = userApps?.map(a => a.id) || []

            // ---- Vendas de produtos marketplace ----
            let mktQuery = supabase
                .from('user_product_access')
                .select('id, created_at, purchase_price, payment_method, payment_status, payment_id, user_id, member_area_id, member_areas!inner(name, owner_id)')
                .eq('member_areas.owner_id', user.id)
                .neq('access_type', 'manual')
                .order('created_at', { ascending: false })

            if (fromDate) mktQuery = mktQuery.gte('created_at', fromDate.toISOString())
            if (toDate) {
                const end = new Date(toDate); end.setHours(23, 59, 59, 999)
                mktQuery = mktQuery.lte('created_at', end.toISOString())
            }

            // ---- Vendas de apps ----
            let appQuery = supabase
                .from('user_product_access')
                .select('id, created_at, purchase_price, payment_method, payment_status, payment_id, user_id, application_id, product_id, products(name), applications(name)')
                .in('application_id', appIds.length > 0 ? appIds : ['none'])
                .neq('access_type', 'manual')
                .order('created_at', { ascending: false })

            if (fromDate) appQuery = appQuery.gte('created_at', fromDate.toISOString())
            if (toDate) {
                const end = new Date(toDate); end.setHours(23, 59, 59, 999)
                appQuery = appQuery.lte('created_at', end.toISOString())
            }

            // ---- Emails dos clientes via sale_locations ----
            const saleLocQuery = supabase
                .from('sale_locations')
                .select('customer_email, checkout_id, customer_id')
                .eq('user_id', user.id)

            const [mktResult, appResult, saleLocResult] = await Promise.all([
                mktQuery, appQuery, saleLocQuery
            ])

            // Coletar todos os user_ids únicos para buscar nomes
            const allUserIds = new Set<string>()
            for (const sale of [...(mktResult.data || []), ...(appResult.data || [])]) {
                if (sale.user_id) allUserIds.add(sale.user_id)
            }

            // Buscar nomes em app_users e member_profiles em paralelo
            const userIdList = Array.from(allUserIds)
            const [appUsersResult, memberProfilesResult] = userIdList.length > 0
                ? await Promise.all([
                    supabase.from('app_users').select('user_id, full_name, email').in('user_id', userIdList),
                    supabase.from('member_profiles').select('id, name, email').in('id', userIdList)
                ])
                : [{ data: [] }, { data: [] }]

            // Mapa user_id → nome
            const nameByUserId = new Map<string, string>()
            for (const u of (appUsersResult.data || [])) {
                if (u.user_id && (u.full_name || u.email)) {
                    nameByUserId.set(u.user_id, u.full_name || u.email.split('@')[0])
                }
            }
            for (const m of (memberProfilesResult.data || [])) {
                if (m.id && (m.name || m.email)) {
                    if (!nameByUserId.has(m.id)) {
                        nameByUserId.set(m.id, m.name || m.email.split('@')[0])
                    }
                }
            }

            // Mapa payment_id/checkout_id/customer_id → customer_email via sale_locations
            const emailByKey = new Map<string, string>()
            for (const sl of (saleLocResult.data || [])) {
                if (sl.customer_email) {
                    if (sl.checkout_id) emailByKey.set(sl.checkout_id, sl.customer_email)
                    if (sl.customer_id) emailByKey.set(sl.customer_id, sl.customer_email)
                }
            }

            // Combinar marketplace + apps, desduplicar por payment_id
            const seenIds = new Set<string>()
            const rawAll: any[] = []

            for (const sale of (mktResult.data || [])) {
                const key = sale.id
                if (!seenIds.has(key)) {
                    seenIds.add(key)
                    rawAll.push({
                        ...sale,
                        productName: (sale as any).member_areas?.name || 'Produto',
                        source: 'marketplace'
                    })
                }
            }

            for (const sale of (appResult.data || [])) {
                const key = sale.id
                if (!seenIds.has(key)) {
                    seenIds.add(key)
                    rawAll.push({
                        ...sale,
                        productName: (sale as any).products?.name || (sale as any).applications?.name || 'App',
                        source: 'app'
                    })
                }
            }

            // Map para objeto Order
            const toStatus = (s: string): 'completed' | 'pending' | 'failed' => {
                if (s === 'completed' || s === 'paid' || s === 'approved') return 'completed'
                if (s === 'pending' || s === 'processing') return 'pending'
                return 'failed'
            }

            const normalizeMethod = (m: string | null): string => {
                if (!m) return 'credit_card'
                const l = m.toLowerCase()
                if (l.includes('pix')) return 'pix'
                if (l.includes('boleto') || l.includes('bank_slip')) return 'boleto'
                if (l.includes('paypal')) return 'paypal'
                if (l.includes('transfer')) return 'bank_transfer'
                return 'credit_card'
            }

            const mapped: Order[] = rawAll.map((sale, idx) => {
                // Tentar múltiplas chaves para encontrar o email do comprador
                const email = emailByKey.get(sale.payment_id) ||
                    emailByKey.get(sale.id) ||
                    emailByKey.get(sale.user_id) ||
                    ''

                return {
                    id: sale.id,
                    orderNumber: `#${String(idx + 1).padStart(4, '0')}`,
                    date: sale.created_at,
                    total: sale.purchase_price || 0,
                    customer: {
                        name: nameByUserId.get(sale.user_id) || (email ? email.split('@')[0] : 'Cliente'),
                        email: email
                    },
                    paymentMethod: normalizeMethod(sale.payment_method),
                    paymentStatus: toStatus(sale.payment_status || 'completed'),
                    productName: sale.productName,
                    productId: sale.member_area_id || sale.application_id || '',
                    productType: sale.source
                }
            })

            // Aplicar filtros locais
            let filtered = [...mapped]

            if (params.selectedProduct !== 'all') {
                filtered = filtered.filter(o => o.productId === params.selectedProduct)
            }

            if (params.tab === 'paid') filtered = filtered.filter(o => o.paymentStatus === 'completed')
            else if (params.tab === 'pending') filtered = filtered.filter(o => o.paymentStatus === 'pending')
            else if (params.tab === 'failed') filtered = filtered.filter(o => o.paymentStatus === 'failed')

            if (queryParams.paymentMethod !== 'all') {
                filtered = filtered.filter(o => o.paymentMethod === queryParams.paymentMethod)
            }

            if (queryParams.searchQuery) {
                const q = queryParams.searchQuery.toLowerCase()
                filtered = filtered.filter(o =>
                    o.orderNumber.toLowerCase().includes(q) ||
                    o.customer.email.toLowerCase().includes(q) ||
                    o.productName.toLowerCase().includes(q)
                )
            }

            setOrders(filtered)

            // Calcular stats baseado em todos os pedidos (mapped) sem os filtros aplicados
            const statsCalc = {
                all: mapped.length,
                paid: mapped.filter(o => o.paymentStatus === 'completed').length,
                pending: mapped.filter(o => o.paymentStatus === 'pending').length,
                failed: mapped.filter(o => o.paymentStatus === 'failed').length
            }
            setRawStats(statsCalc)
        } catch (err) {
            console.error('Error fetching orders:', err)
            setOrders([])
        } finally {
            setLoading(false)
        }
    }, [queryParams])

    // useEffect para executar fetch quando parâmetros mudarem
    useEffect(() => {
        fetchOrders()
    }, [fetchOrders])

    // Memoizar stats finais
    const stats = useMemo(() => rawStats, [rawStats])

    return { orders, loading, stats }
}

