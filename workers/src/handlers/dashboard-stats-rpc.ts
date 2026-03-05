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

            // Buscar vendas diárias e breakdown de métodos em paralelo
            const [dailySales, paymentMethods] = await Promise.all([
                fetchDailySales(supabase, userId, fromDate, toDate, selectedApp, selectedMarketplace, selectedCurrency),
                fetchPaymentMethodBreakdown(supabase, userId, fromDate, toDate, selectedApp, selectedMarketplace),
            ])

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
                paymentMethods,
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
    // Quando toDate é fornecido pelo frontend, representa meia-noite no timezone local.
    // Adiciona 24h-1ms para cobrir o dia inteiro sem bug de timezone no worker (UTC).
    const to = toDate ? new Date(new Date(toDate).getTime() + 24 * 60 * 60 * 1000 - 1) : new Date()

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

/**
 * Busca breakdown de métodos de pagamento (card, paypal, pix, boleto...)
 */
async function fetchPaymentMethodBreakdown(
    supabase: any,
    userId: string,
    fromDate?: string,
    toDate?: string,
    selectedApp?: string,
    selectedMarketplace?: string
): Promise<Array<{ name: string; icon: string; conversion: number; value: number }>> {
    const METHOD_DISPLAY_NAMES: Record<string, string> = {
        card: 'Cartão de Crédito',
        paypal: 'PayPal',
        pix: 'Pix',
        boleto: 'Boleto',
        bank_transfer: 'Transferência',
    }

    const normalizeMethod = (m: string | null): string => {
        if (!m) return 'card'
        const l = m.toLowerCase()
        if (l.includes('paypal')) return 'paypal'
        if (l.includes('pix')) return 'pix'
        if (l.includes('boleto') || l.includes('bank_slip')) return 'boleto'
        if (l.includes('transfer')) return 'bank_transfer'
        return 'card'
    }

    try {
        const queries: Promise<any>[] = []

        // Apps
        if (!selectedMarketplace) {
            let appIds: string[] = []
            if (selectedApp) {
                appIds = [selectedApp]
            } else {
                const { data: apps } = await supabase
                    .from('applications')
                    .select('id')
                    .eq('owner_id', userId)
                appIds = apps?.map((a: any) => a.id) || []
            }
            if (appIds.length > 0) {
                let q = supabase
                    .from('user_product_access')
                    .select('payment_method, purchase_price')
                    .eq('payment_status', 'completed')
                    .in('application_id', appIds)
                if (fromDate) q = q.gte('created_at', fromDate)
                if (toDate) q = q.lte('created_at', toDate)
                queries.push(q)
            }
        }

        // Marketplace
        if (!selectedApp) {
            let memberAreaIds: string[] = []
            if (selectedMarketplace) {
                memberAreaIds = [selectedMarketplace]
            } else {
                const { data: mas } = await supabase
                    .from('member_areas')
                    .select('id')
                    .eq('owner_id', userId)
                memberAreaIds = mas?.map((m: any) => m.id) || []
            }
            if (memberAreaIds.length > 0) {
                let q = supabase
                    .from('user_member_area_access')
                    .select('payment_method, purchase_price')
                    .eq('payment_status', 'completed')
                    .in('member_area_id', memberAreaIds)
                if (fromDate) q = q.gte('created_at', fromDate)
                if (toDate) q = q.lte('created_at', toDate)
                queries.push(q)
            }
        }

        const results = await Promise.all(queries)
        const allRows = results.flatMap(r => r.data || [])

        const groups: Record<string, { value: number; count: number }> = {}
        let totalCount = 0
        allRows.forEach((row: any) => {
            const key = normalizeMethod(row.payment_method)
            if (!groups[key]) groups[key] = { value: 0, count: 0 }
            groups[key].value += parseFloat(row.purchase_price || 0)
            groups[key].count += 1
            totalCount += 1
        })

        if (Object.keys(groups).length === 0) {
            return [
                { name: 'Cartão de Crédito', icon: 'card', conversion: 0, value: 0 },
                { name: 'PayPal', icon: 'paypal', conversion: 0, value: 0 },
            ]
        }

        return Object.entries(groups).map(([icon, data]) => ({
            name: METHOD_DISPLAY_NAMES[icon] || icon,
            icon,
            conversion: totalCount > 0 ? Math.round((data.count / totalCount) * 10000) / 100 : 0,
            value: data.value,
        }))
    } catch (e) {
        console.warn('fetchPaymentMethodBreakdown failed:', e)
        return [{ name: 'Cartão de Crédito', icon: 'card', conversion: 0, value: 0 }]
    }
}
