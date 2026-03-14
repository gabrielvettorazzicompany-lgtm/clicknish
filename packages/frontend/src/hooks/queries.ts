import { useQuery, UseQueryOptions } from '@tanstack/react-query'
import { DateRange } from 'react-day-picker'
import { supabase } from '@/services/supabase'

export interface DashboardStats {
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

/**
 * Hook React Query para buscar estatísticas do dashboard
 * Com cache inteligente e invalidação automática
 */
export function useDashboardStatsQuery(
    userId: string | undefined,
    dateRange: DateRange | undefined,
    selectedApp?: string,
    selectedMarketplace?: string,
    selectedCurrency?: string,
    options?: UseQueryOptions<DashboardStats>
) {
    return useQuery({
        // Query key única baseada nos parâmetros
        queryKey: [
            'dashboard-stats',
            userId,
            dateRange?.from?.toISOString(),
            dateRange?.to?.toISOString(),
            selectedApp,
            selectedMarketplace,
            selectedCurrency
        ],
        queryFn: async (): Promise<DashboardStats> => {
            if (!userId) throw new Error('User ID é obrigatório')

            const fromDate = dateRange?.from
            const toDate = dateRange?.to

            // Helper para retornar resultado vazio sem fazer query inválida
            const emptyResult = () => Promise.resolve({ data: [], error: null })

            // Buscar member_areas do usuário primeiro
            const { data: userMemberAreas } = await supabase
                .from('member_areas')
                .select('id, price, currency')
                .eq('owner_id', userId)
            const memberAreaIds = userMemberAreas?.map(m => m.id) || []
            const memberAreaPrices = new Map(userMemberAreas?.map(m => [m.id, { price: m.price, currency: m.currency }]) || [])

            // Marketplaces usam BRL - pular quando USD selecionado
            const shouldFetchMarketplaceSales = (!selectedCurrency || selectedCurrency !== 'USD') && memberAreaIds.length > 0

            // Buscar vendas de produtos marketplace do usuário
            let marketplaceSalesQuery: any = emptyResult()
            if (shouldFetchMarketplaceSales) {
                // Filtrar member_areas por moeda se necessário
                let filteredMemberAreaIds = memberAreaIds
                if (selectedCurrency) {
                    filteredMemberAreaIds = memberAreaIds.filter(id => {
                        const info = memberAreaPrices.get(id)
                        return info?.currency === selectedCurrency
                    })
                }

                if (filteredMemberAreaIds.length > 0) {
                    let query = supabase
                        .from('user_product_access')
                        .select('*, member_area_id')
                        .eq('payment_status', 'completed')
                        .in('member_area_id', filteredMemberAreaIds)

                    // Filtrar por marketplace específico se selecionado
                    if (selectedMarketplace) {
                        query = query.eq('member_area_id', selectedMarketplace)
                    }

                    if (fromDate) {
                        query = query.gte('created_at', fromDate.toISOString())
                    }
                    if (toDate) {
                        const endOfDay = new Date(toDate)
                        endOfDay.setHours(23, 59, 59, 999)
                        query = query.lte('created_at', endOfDay.toISOString())
                    }
                    marketplaceSalesQuery = query
                }
            }

            // Buscar vendas de apps do usuário
            const { data: userApps } = await supabase
                .from('applications')
                .select('id')
                .eq('owner_id', userId)

            const appIds = userApps?.map(a => a.id) || []

            // Apps usam USD por padrão - só buscar se moeda for USD ou não filtrada
            const shouldFetchAppSales = (!selectedCurrency || selectedCurrency === 'USD') && appIds.length > 0

            let appSalesQuery: any = emptyResult()
            if (shouldFetchAppSales) {
                appSalesQuery = supabase
                    .from('user_product_access')
                    .select('*, products!inner(price, currency, app_id), applications!inner(owner_id)')
                    .eq('payment_status', 'completed')
                    .eq('applications.owner_id', userId)
                    .in('application_id', appIds)

                if (fromDate) {
                    appSalesQuery = appSalesQuery.gte('created_at', fromDate.toISOString())
                }
                if (toDate) {
                    const endOfDay = new Date(toDate)
                    endOfDay.setHours(23, 59, 59, 999)
                    appSalesQuery = appSalesQuery.lte('created_at', endOfDay.toISOString())
                }
            }

            // Executar queries em paralelo
            const [marketplaceSalesResult, appSalesResult] = await Promise.all([
                marketplaceSalesQuery,
                appSalesQuery
            ])

            const marketplaceSales = marketplaceSalesResult.data || []
            const appSales = appSalesResult.data || []
            const allSales = [...marketplaceSales, ...appSales]

            // Calcular totais
            const totalSales = allSales.reduce((sum, sale) => {
                const memberAreaInfo = memberAreaPrices.get(sale.member_area_id)
                const price = memberAreaInfo?.price || sale.products?.price || sale.purchase_price || 0
                return sum + price
            }, 0)

            const salesCount = allSales.length

            // Calcular vendas diárias
            const salesByDate: Record<string, number> = {}
            allSales.forEach(sale => {
                const date = new Date(sale.created_at).toISOString().split('T')[0]
                const memberAreaInfo = memberAreaPrices.get(sale.member_area_id)
                const price = memberAreaInfo?.price || sale.products?.price || sale.purchase_price || 0
                salesByDate[date] = (salesByDate[date] || 0) + price
            })

            const dailySales = Object.entries(salesByDate)
                .map(([date, value]) => ({
                    date,
                    value,
                    formattedDate: new Date(date).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit'
                    })
                }))
                .sort((a, b) => a.date.localeCompare(b.date))
                .slice(-7)

            // Agrupar por método de pagamento
            const normalizeMethod = (m: string | null): string => {
                if (!m) return 'card'
                const l = m.toLowerCase()
                if (l.includes('paypal')) return 'paypal'
                if (l.includes('pix')) return 'pix'
                if (l.includes('boleto') || l.includes('bank_slip')) return 'boleto'
                if (l.includes('bank_transfer') || l.includes('bank transfer')) return 'bank_transfer'
                if (l.includes('ideal')) return 'ideal'
                if (l.includes('bancontact')) return 'bancontact'
                if (l.includes('sofort') || l.includes('klarna_pay_now')) return 'sofort'
                if (l.includes('klarna')) return 'klarna'
                if (l.includes('giropay')) return 'giropay'
                if (l.includes('applepay') || l.includes('apple_pay')) return 'applepay'
                if (l.includes('googlepay') || l.includes('google_pay')) return 'googlepay'
                if (l.includes('eps')) return 'eps'
                if (l.includes('przelewy') || l.includes('p24')) return 'przelewy24'
                if (l.includes('sepa') || l.includes('direct_debit')) return 'sepa'
                if (l.includes('transfer')) return 'bank_transfer'
                return 'card'
            }
            const METHOD_NAMES: Record<string, string> = {
                card: 'Cartão de Crédito', paypal: 'PayPal', pix: 'Pix',
                boleto: 'Boleto', bank_transfer: 'Transferência Bancária',
                ideal: 'iDEAL', bancontact: 'Bancontact', sofort: 'SOFORT',
                klarna: 'Klarna', giropay: 'Giropay', applepay: 'Apple Pay',
                googlepay: 'Google Pay', eps: 'EPS', przelewy24: 'Przelewy24',
                sepa: 'SEPA Débito',
            }
            const methodGroups: Record<string, { value: number; count: number }> = {}
            allSales.forEach((sale: any) => {
                const key = normalizeMethod(sale.payment_method)
                if (!methodGroups[key]) methodGroups[key] = { value: 0, count: 0 }
                const memberAreaInfo = memberAreaPrices.get(sale.member_area_id)
                const price = memberAreaInfo?.price || sale.products?.price || sale.purchase_price || 0
                methodGroups[key].value += price
                methodGroups[key].count += 1
            })
            const paymentMethods = Object.keys(methodGroups).length > 0
                ? Object.entries(methodGroups).map(([icon, data]) => ({
                    name: METHOD_NAMES[icon] || icon,
                    icon,
                    conversion: salesCount > 0 ? Math.round((data.count / salesCount) * 10000) / 100 : 0,
                    value: data.value,
                }))
                : []

            return {
                totalSales,
                salesCount,
                conversionRate: 0,
                checkouts: 0,
                paymentMethods,
                abandonedCheckouts: 0,
                refundRate: 0,
                chargebackRate: 0,
                medRate: 0,
                pendingAmount: 0,
                refundCount: 0,
                dailySales
            }
        },
        enabled: !!userId,
        // Cache por 2 minutos para dados do dashboard (mais frequente)
        staleTime: 2 * 60 * 1000,
        ...options,
    })
}

/**
 * Hook React Query para buscar lista de customers
 */
export function useCustomersQuery(
    appId: string,
    type: 'app' | 'marketplace',
    options?: UseQueryOptions
) {
    return useQuery({
        queryKey: ['customers', appId, type],
        queryFn: async () => {
            if (type === 'marketplace') {
                const { data, error } = await supabase
                    .from('user_product_access')
                    .select(`
                        id,
                        user_id,
                        created_at,
                        member_profiles(id, name, email, phone, created_at)
                    `)
                    .eq('member_area_id', appId)
                    .order('created_at', { ascending: false })

                if (error) throw error

                return data?.map(access => {
                    const profile = Array.isArray(access.member_profiles) ? access.member_profiles[0] : access.member_profiles
                    return {
                        id: profile?.id || access.user_id,
                        email: profile?.email || '',
                        full_name: profile?.name || null,
                        phone: profile?.phone || null,
                        created_at: access.created_at
                    }
                }) || []
            } else {
                const { data, error } = await supabase
                    .from('user_product_access')
                    .select(`
                        id,
                        user_id,
                        created_at,
                        app_users(user_id, email, full_name, phone, created_at)
                    `)
                    .eq('application_id', appId)
                    .order('created_at', { ascending: false })

                if (error) throw error

                return data?.map(access => {
                    const appUser = Array.isArray(access.app_users) ? access.app_users[0] : access.app_users
                    return {
                        id: appUser?.user_id || access.user_id,
                        email: appUser?.email || '',
                        full_name: appUser?.full_name || null,
                        phone: appUser?.phone || null,
                        created_at: access.created_at
                    }
                }) || []
            }
        },
        enabled: !!appId,
        // Cache por 5 minutos para lista de customers
        staleTime: 5 * 60 * 1000,
        ...options,
    })
}

/**
 * Hook React Query para buscar aplicações do usuário
 */
export function useUserAppsQuery(
    userId: string | undefined,
    options?: UseQueryOptions
) {
    return useQuery({
        queryKey: ['user-apps', userId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('applications')
                .select('id, name, slug, description, icon_url')
                .eq('user_id', userId || '')
                .order('created_at', { ascending: false })

            if (error) throw error
            return data || []
        },
        enabled: !!userId,
        // Cache por 10 minutos para lista de apps (muda raramente)
        staleTime: 10 * 60 * 1000,
        ...options,
    })
}

/**
 * Hook React Query para buscar produtos do marketplace
 */
export function useMarketplaceProductsQuery(
    userId: string | undefined,
    options?: UseQueryOptions
) {
    return useQuery({
        queryKey: ['marketplace-products', userId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('marketplace_products')
                .select('id, name, description, price, currency, status')
                .eq('user_id', userId || '')
                .order('created_at', { ascending: false })

            if (error) throw error
            return data || []
        },
        enabled: !!userId,
        // Cache por 10 minutos para produtos do marketplace
        staleTime: 10 * 60 * 1000,
        ...options,
    })
}