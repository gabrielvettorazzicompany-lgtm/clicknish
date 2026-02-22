import { useState, useEffect, useMemo, useCallback } from 'react'
import { DateRange } from 'react-day-picker'
import { supabase } from '@/services/supabase'

interface DashboardStats {
    totalSales: number
    salesCount: number
    conversionRate: number
    checkouts: number
    paymentMethods: {
        name: string
        icon: string
        conversion: number
        value: number
    }[]
    abandonedCheckouts: number
    refundRate: number
    chargebackRate: number
    medRate: number
    pendingAmount: number
    refundCount: number
    dailySales: {
        date: string
        value: number
        formattedDate: string
    }[]
}

interface Product {
    id: string
    name: string
    type: 'marketplace' | 'app' | 'community'
}

export function useDashboardStats(
    userId: string | undefined,
    dateRange: DateRange | undefined,
    selectedApp?: string,
    selectedMarketplace?: string,
    selectedCurrency?: string
) {
    const [rawStats, setRawStats] = useState<DashboardStats>({
        totalSales: 0,
        salesCount: 0,
        conversionRate: 0,
        checkouts: 0,
        paymentMethods: [
            { name: 'Cartão de Crédito', icon: 'card', conversion: 0, value: 0 },
        ],
        abandonedCheckouts: 0,
        refundRate: 0,
        chargebackRate: 0,
        medRate: 0,
        pendingAmount: 0,
        refundCount: 0,
        dailySales: []
    })
    const [loading, setLoading] = useState(true)

    // Memoizar função de fetch para evitar recriações
    const fetchStats = useCallback(async () => {
        if (!userId) return

        setLoading(true)
        try {
            // Usar datas do DateRange se fornecido
            const fromDate = dateRange?.from
            const toDate = dateRange?.to

            // Buscar vendas de produtos marketplace do usuário
            let marketplaceSalesQuery = supabase
                .from('user_product_access')
                .select('*, member_areas!inner(price, currency, owner_id)')
                .eq('payment_status', 'completed')
                .eq('member_areas.owner_id', userId)

            // Filtrar por marketplace específico se selecionado
            if (selectedMarketplace) {
                marketplaceSalesQuery = marketplaceSalesQuery.eq('member_area_id', selectedMarketplace)
            }

            // Filtrar por moeda se selecionada
            if (selectedCurrency) {
                marketplaceSalesQuery = marketplaceSalesQuery.eq('member_areas.currency', selectedCurrency)
            }

            if (fromDate) {
                marketplaceSalesQuery = marketplaceSalesQuery.gte('created_at', fromDate.toISOString())
            }
            if (toDate) {
                const endOfDay = new Date(toDate)
                endOfDay.setHours(23, 59, 59, 999)
                marketplaceSalesQuery = marketplaceSalesQuery.lte('created_at', endOfDay.toISOString())
            }

            // Buscar vendas de apps do usuário
            const { data: userApps } = await supabase
                .from('applications')
                .select('id')
                .eq('owner_id', userId)

            const appIds = selectedApp ? [selectedApp] : (userApps?.map(app => app.id) || [])

            let appSalesQuery = supabase
                .from('user_product_access')
                .select('*')
                .eq('payment_status', 'completed')
                .in('application_id', appIds.length > 0 ? appIds : [''])

            // Apps usam USD por padrão - só buscar se moeda for USD ou não filtrada
            const shouldFetchAppSales = !selectedCurrency || selectedCurrency === 'USD'
            if (!shouldFetchAppSales) {
                appSalesQuery = supabase.from('user_product_access').select('*').eq('id', '')
            }

            if (fromDate) {
                appSalesQuery = appSalesQuery.gte('created_at', fromDate.toISOString())
            }
            if (toDate) {
                const endOfDay = new Date(toDate)
                endOfDay.setHours(23, 59, 59, 999)
                appSalesQuery = appSalesQuery.lte('created_at', endOfDay.toISOString())
            }

            // Buscar checkouts
            let marketplaceCheckoutsQuery = supabase
                .from('checkout_urls')
                .select('*, member_areas!inner(owner_id, currency)')
                .eq('member_areas.owner_id', userId)

            // Filtrar por marketplace específico se selecionado
            if (selectedMarketplace) {
                marketplaceCheckoutsQuery = marketplaceCheckoutsQuery.eq('member_area_id', selectedMarketplace)
            }

            // Filtrar por moeda se selecionada
            if (selectedCurrency) {
                marketplaceCheckoutsQuery = marketplaceCheckoutsQuery.eq('member_areas.currency', selectedCurrency)
            }

            if (fromDate) {
                marketplaceCheckoutsQuery = marketplaceCheckoutsQuery.gte('created_at', fromDate.toISOString())
            }
            if (toDate) {
                const endOfDay = new Date(toDate)
                endOfDay.setHours(23, 59, 59, 999)
                marketplaceCheckoutsQuery = marketplaceCheckoutsQuery.lte('created_at', endOfDay.toISOString())
            }

            let appCheckoutsQuery = supabase
                .from('checkout_urls')
                .select('*')
                .in('application_id', appIds.length > 0 ? appIds : [''])

            // Apps usam USD por padrão - só buscar se moeda for USD ou não filtrada
            if (!shouldFetchAppSales) {
                appCheckoutsQuery = supabase.from('checkout_urls').select('*').eq('id', '')
            }

            if (fromDate) {
                appCheckoutsQuery = appCheckoutsQuery.gte('created_at', fromDate.toISOString())
            }
            if (toDate) {
                const endOfDay = new Date(toDate)
                endOfDay.setHours(23, 59, 59, 999)
                appCheckoutsQuery = appCheckoutsQuery.lte('created_at', endOfDay.toISOString())
            }

            // Pagamentos pendentes (marketplace)
            let marketplacePendingQuery = supabase
                .from('user_product_access')
                .select('purchase_price, member_areas!inner(owner_id, currency)')
                .eq('payment_status', 'pending')
                .eq('member_areas.owner_id', userId)

            // Filtrar por marketplace específico se selecionado
            if (selectedMarketplace) {
                marketplacePendingQuery = marketplacePendingQuery.eq('member_area_id', selectedMarketplace)
            }

            // Filtrar por moeda se selecionada
            if (selectedCurrency) {
                marketplacePendingQuery = marketplacePendingQuery.eq('member_areas.currency', selectedCurrency)
            }

            // Pagamentos pendentes (apps)
            let appPendingQuery = supabase
                .from('user_product_access')
                .select('purchase_price')
                .eq('payment_status', 'pending')
                .in('application_id', appIds.length > 0 ? appIds : [''])

            // Apps usam USD por padrão - só buscar se moeda for USD ou não filtrada
            if (!shouldFetchAppSales) {
                appPendingQuery = supabase.from('user_product_access').select('purchase_price').eq('id', '')
            }

            // Reembolsos (marketplace)
            let marketplaceRefundsQuery = supabase
                .from('user_product_access')
                .select('id, member_areas!inner(owner_id, currency)')
                .in('payment_status', ['refunded', 'reversed'])
                .eq('member_areas.owner_id', userId)

            // Filtrar por marketplace específico se selecionado
            if (selectedMarketplace) {
                marketplaceRefundsQuery = marketplaceRefundsQuery.eq('member_area_id', selectedMarketplace)
            }

            // Filtrar por moeda se selecionada
            if (selectedCurrency) {
                marketplaceRefundsQuery = marketplaceRefundsQuery.eq('member_areas.currency', selectedCurrency)
            }

            // Reembolsos (apps)
            let appRefundsQuery = supabase
                .from('user_product_access')
                .select('id')
                .in('payment_status', ['refunded', 'reversed'])
                .in('application_id', appIds.length > 0 ? appIds : [''])

            // Apps usam USD por padrão - só buscar se moeda for USD ou não filtrada
            if (!shouldFetchAppSales) {
                appRefundsQuery = supabase.from('user_product_access').select('id').eq('id', '')
            }

            const [marketplaceSalesResult, appSalesResult, marketplaceCheckoutsResult, appCheckoutsResult,
                marketplacePendingResult, appPendingResult, marketplaceRefundsResult, appRefundsResult] = await Promise.all([
                    marketplaceSalesQuery,
                    appSalesQuery,
                    marketplaceCheckoutsQuery,
                    appCheckoutsQuery,
                    marketplacePendingQuery,
                    appPendingQuery,
                    marketplaceRefundsQuery,
                    appRefundsQuery
                ])

            const marketplaceSales = marketplaceSalesResult.data || []
            const appSales = appSalesResult.data || []
            const marketplaceCheckouts = marketplaceCheckoutsResult.data || []
            const appCheckouts = appCheckoutsResult.data || []
            const marketplacePending = marketplacePendingResult.data || []
            const appPending = appPendingResult.data || []
            const allRefunds = [
                ...(marketplaceRefundsResult.data || []),
                ...(appRefundsResult.data || [])
            ]

            const pendingAmount = [...marketplacePending, ...appPending]
                .reduce((sum: number, r: any) => sum + (r.purchase_price || 0), 0)
            const refundCount = allRefunds.length

            // Deduplicate app sales
            const uniqueAppSales: any[] = []
            const seenPaymentIds = new Set<string>()
            for (const sale of appSales) {
                const key = sale.payment_id || sale.id
                if (!seenPaymentIds.has(key)) {
                    seenPaymentIds.add(key)
                    uniqueAppSales.push(sale)
                }
            }

            const allSales = [
                ...marketplaceSales.map((sale: any) => ({
                    ...sale,
                    price: sale.purchase_price || sale.member_areas?.price || 0,
                    source: 'marketplace'
                })),
                ...uniqueAppSales.map((sale: any) => ({
                    ...sale,
                    price: sale.purchase_price || 0,
                    source: 'app'
                }))
            ]

            const allCheckouts = [...marketplaceCheckouts, ...appCheckouts]

            const totalSales = allSales.reduce((sum: number, sale: any) => sum + (sale.price || 0), 0)
            const salesCount = allSales.length
            const checkoutsCount = allCheckouts.length
            const abandonedCount = Math.max(0, checkoutsCount - salesCount)
            const conversionRate = checkoutsCount > 0 ? (salesCount / checkoutsCount) * 100 : 0

            // Group by payment method
            const paymentMethodsMap = new Map<string, { count: number; value: number }>()
            allSales.forEach((sale: any) => {
                let method = sale.payment_method || 'card'
                const price = sale.price || 0
                const m = method.toLowerCase()

                if (m.includes('pix')) method = 'pix'
                else if (m.includes('boleto') || m.includes('bank_slip')) method = 'boleto'
                else method = 'credit card'

                if (!paymentMethodsMap.has(method)) {
                    paymentMethodsMap.set(method, { count: 0, value: 0 })
                }

                const current = paymentMethodsMap.get(method)!
                paymentMethodsMap.set(method, {
                    count: current.count + 1,
                    value: current.value + price
                })
            })

            const defaultMethods = [
                { key: 'credit card', name: 'Cartão de Crédito', icon: 'card' },
            ]

            const paymentMethods = defaultMethods.map(method => {
                const data = paymentMethodsMap.get(method.key) || { count: 0, value: 0 }
                return {
                    name: method.name,
                    icon: method.icon,
                    conversion: salesCount > 0 ? (data.count / salesCount) * 100 : 0,
                    value: data.value
                }
            })

            // Daily sales
            const dailySalesMap = new Map<string, number>()
            allSales.forEach((sale: any) => {
                const dateKey = new Date(sale.created_at).toISOString().split('T')[0]
                const price = sale.price || 0
                dailySalesMap.set(dateKey, (dailySalesMap.get(dateKey) || 0) + price)
            })

            const dailySales = Array.from(dailySalesMap.entries())
                .map(([date, value]) => ({
                    date,
                    value,
                    formattedDate: new Date(date).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit'
                    })
                }))
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .slice(-7)

            setRawStats({
                totalSales,
                salesCount,
                conversionRate,
                checkouts: checkoutsCount,
                paymentMethods,
                abandonedCheckouts: abandonedCount,
                refundRate: 0,
                chargebackRate: 0,
                medRate: 0,
                pendingAmount,
                refundCount,
                dailySales
            })
        } catch (error) {
            console.error('Error fetching dashboard stats:', error)
        } finally {
            setLoading(false)
        }
    }, [userId, dateRange, selectedApp, selectedMarketplace, selectedCurrency])

    // useEffect para executar fetch quando parâmetros mudarem
    useEffect(() => {
        fetchStats()
    }, [fetchStats])

    // Memoizar stats finais para evitar re-renders desnecessários
    const stats = useMemo(() => rawStats, [rawStats])

    return { stats, loading }
}
