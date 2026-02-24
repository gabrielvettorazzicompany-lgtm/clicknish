// @ts-nocheck
/**
 * Handler: Dashboard Stats (OTIMIZADO)
 * Usa RPC function para reduzir de 8 queries para 1
 */

import { createClient } from '../lib/supabase'
import { withCache, userCacheKey } from '../utils/cache'
import type { Env } from '../index'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface DashboardRequest {
    userId: string
    fromDate?: string
    toDate?: string
    selectedApp?: string
    selectedMarketplace?: string
    selectedCurrency?: string
}

function jsonResponse(data: any, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
}

export async function handleDashboardStats(
    request: Request,
    env: Env,
    ctx: ExecutionContext
): Promise<Response> {
    if (request.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405, headers: corsHeaders })
    }

    try {
        const body = await request.json() as DashboardRequest
        const { userId, fromDate, toDate, selectedApp, selectedMarketplace, selectedCurrency } = body

        if (!userId) {
            return jsonResponse({ error: 'userId is required' }, 400)
        }

        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

        // Cache key baseada nos parâmetros
        const cacheKey = userCacheKey(userId, 'dashboard-stats', {
            fromDate: fromDate || 'all',
            toDate: toDate || 'now',
            app: selectedApp || 'all',
            marketplace: selectedMarketplace || 'all',
            currency: selectedCurrency || 'all'
        })

        // Usar cache com TTL de 60 segundos
        const stats = await withCache(env, cacheKey, async () => {
            // Chamar RPC otimizada (1 query ao invés de 8)
            const { data: rpcData, error: rpcError } = await supabase.rpc('get_dashboard_stats', {
                p_user_id: userId,
                p_from_date: fromDate || null,
                p_to_date: toDate || null,
                p_selected_app: selectedApp || null,
                p_selected_marketplace: selectedMarketplace || null,
                p_selected_currency: selectedCurrency || null
            })

            if (rpcError) {
                console.error('RPC error:', rpcError)
                throw new Error(rpcError.message)
            }

            // Buscar vendas diárias para o gráfico (query separada)
            const dailySales = await fetchDailySales(supabase, userId, fromDate, toDate, selectedApp, selectedMarketplace, selectedCurrency)

            // Calcular taxas
            const salesCount = rpcData?.salesCount || 0
            const checkoutsCount = rpcData?.totalCheckouts || 0
            const conversionRate = rpcData?.conversionRate || 0
            const refundRate = salesCount > 0 ? ((rpcData?.refundedSales || 0) / (rpcData?.totalSales || 1)) * 100 : 0

            return {
                totalSales: rpcData?.totalSales || 0,
                salesCount: salesCount,
                conversionRate: Math.round(conversionRate * 100) / 100,
                checkouts: checkoutsCount,
                paymentMethods: [
                    { name: 'Cartão de Crédito', icon: 'card', conversion: conversionRate, value: rpcData?.totalSales || 0 },
                ],
                abandonedCheckouts: Math.max(0, checkoutsCount - salesCount),
                refundRate: Math.round(refundRate * 100) / 100,
                chargebackRate: 0,
                medRate: 0,
                pendingAmount: rpcData?.pendingSales || 0,
                refundCount: 0, // RPC não retorna count de refunds, apenas valor
                dailySales
            }
        }, { ttl: 60 }) // Cache por 60 segundos

        return jsonResponse(stats)

    } catch (error: any) {
        console.error('Dashboard stats error:', error)
        return jsonResponse({ error: error.message || 'Internal error' }, 500)
    }
}

/**
 * Busca vendas diárias para o gráfico
 */
async function fetchDailySales(
    supabase: any,
    userId: string,
    fromDate?: string,
    toDate?: string,
    selectedApp?: string,
    selectedMarketplace?: string,
    selectedCurrency?: string
): Promise<any[]> {
    // Determinar range de datas (últimos 7 dias por padrão)
    const from = fromDate ? new Date(fromDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const to = toDate ? new Date(toDate) : new Date()
    to.setHours(23, 59, 59, 999)

    // Buscar apps do usuário se necessário
    let appIds: string[] = []
    if (!selectedMarketplace) {
        if (selectedApp) {
            appIds = [selectedApp]
        } else {
            const { data: apps } = await supabase
                .from('applications')
                .select('id')
                .eq('owner_id', userId)
            appIds = apps?.map((a: any) => a.id) || []
        }
    }

    // Query otimizada para vendas diárias
    let salesData: any[] = []

    // Marketplace sales
    if (!selectedApp && (!selectedCurrency || selectedCurrency === 'BRL')) {
        let q = supabase
            .from('user_product_access')
            .select('purchase_price, created_at, member_area_id')
            .eq('payment_status', 'completed')
            .gte('created_at', from.toISOString())
            .lte('created_at', to.toISOString())

        if (selectedMarketplace) {
            q = q.eq('member_area_id', selectedMarketplace)
        }

        const { data } = await q

        if (data && data.length > 0) {
            // Filtrar por owner
            const memberAreaIds = [...new Set(data.map((s: any) => s.member_area_id).filter(Boolean))]
            if (memberAreaIds.length > 0) {
                const { data: validMAs } = await supabase
                    .from('member_areas')
                    .select('id, price')
                    .eq('owner_id', userId)
                    .in('id', memberAreaIds)

                const validIds = new Set((validMAs || []).map((ma: any) => ma.id))
                const priceMap = new Map((validMAs || []).map((ma: any) => [ma.id, ma.price]))

                salesData = data
                    .filter((s: any) => validIds.has(s.member_area_id))
                    .map((s: any) => ({
                        ...s,
                        price: priceMap.get(s.member_area_id) || s.purchase_price || 0
                    }))
            }
        }
    }

    // App sales
    if (!selectedMarketplace && appIds.length > 0 && (!selectedCurrency || selectedCurrency === 'USD')) {
        const { data } = await supabase
            .from('user_product_access')
            .select('purchase_price, created_at')
            .eq('payment_status', 'completed')
            .in('application_id', appIds)
            .gte('created_at', from.toISOString())
            .lte('created_at', to.toISOString())

        if (data) {
            salesData = [...salesData, ...data.map((s: any) => ({ ...s, price: s.purchase_price || 0 }))]
        }
    }

    // Agrupar por data
    const salesByDate: Record<string, number> = {}
    salesData.forEach(sale => {
        const date = new Date(sale.created_at).toISOString().split('T')[0]
        const price = sale.price || sale.purchase_price || 0
        salesByDate[date] = (salesByDate[date] || 0) + parseFloat(price)
    })

    return Object.entries(salesByDate)
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
}
