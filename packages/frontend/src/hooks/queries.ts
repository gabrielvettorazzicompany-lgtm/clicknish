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

            const appIds = userApps?.map(a => a.id) || []

            let appSalesQuery = supabase
                .from('user_product_access')
                .select('*, products!inner(price, currency, app_id), applications!inner(owner_id)')
                .eq('payment_status', 'completed')
                .eq('applications.owner_id', userId)
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
                const price = sale.member_areas?.price || sale.products?.price || sale.purchase_price || 0
                return sum + price
            }, 0)

            const salesCount = allSales.length

            // Calcular vendas diárias
            const salesByDate: Record<string, number> = {}
            allSales.forEach(sale => {
                const date = new Date(sale.created_at).toISOString().split('T')[0]
                const price = sale.member_areas?.price || sale.products?.price || sale.purchase_price || 0
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

            return {
                totalSales,
                salesCount,
                conversionRate: 0,
                checkouts: 0,
                paymentMethods: [
                    { name: 'Cartão de Crédito', icon: 'card', conversion: 0, value: totalSales },
                ],
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