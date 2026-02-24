// @ts-nocheck
/**
 * Handler: Dashboard Stats
 * Estatísticas do dashboard - vendas, conversões, etc.
 */

import { createClient } from '../lib/supabase'
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

        // Buscar apps do usuário
        const userAppsResult = await supabase
            .from('applications')
            .select('id')
            .eq('owner_id', userId)

        const appIds = selectedApp ? [selectedApp] : (userAppsResult.data?.map((a: any) => a.id) || [])

        // Determinar quais queries fazer baseado na moeda
        const shouldFetchMarketplace = !selectedCurrency || selectedCurrency !== 'USD'
        const shouldFetchApps = (!selectedCurrency || selectedCurrency === 'USD') && appIds.length > 0

        // Preparar filtros de data
        const fromDateObj = fromDate ? new Date(fromDate) : undefined
        const toDateObj = toDate ? new Date(toDate) : undefined
        let endOfDay: Date | undefined
        if (toDateObj) {
            endOfDay = new Date(toDateObj)
            endOfDay.setHours(23, 59, 59, 999)
        }

        // Inicializar resultados
        let marketplaceSales: any[] = []
        let appSales: any[] = []
        let marketplaceCheckouts: any[] = []
        let appCheckouts: any[] = []
        let marketplacePending: any[] = []
        let appPending: any[] = []
        let marketplaceRefunds: any[] = []
        let appRefunds: any[] = []

        // 1. Vendas marketplace
        if (shouldFetchMarketplace) {
            let q = supabase
                .from('user_product_access')
                .select('purchase_price, created_at, member_area_id')
                .eq('payment_status', 'completed')

            if (selectedMarketplace) q = q.eq('member_area_id', selectedMarketplace)
            if (fromDateObj) q = q.gte('created_at', fromDateObj.toISOString())
            if (endOfDay) q = q.lte('created_at', endOfDay.toISOString())

            const result = await q
            
            // Filtrar por owner_id via member_areas
            if (result.data && result.data.length > 0) {
                const memberAreaIds = [...new Set(result.data.map((s: any) => s.member_area_id).filter(Boolean))]
                if (memberAreaIds.length > 0) {
                    const maResult = await supabase
                        .from('member_areas')
                        .select('id, price, currency, owner_id')
                        .eq('owner_id', userId)
                        .in('id', memberAreaIds)
                    
                    const validIds = new Set((maResult.data || []).map((ma: any) => ma.id))
                    const priceMap = new Map((maResult.data || []).map((ma: any) => [ma.id, ma.price]))
                    
                    marketplaceSales = result.data
                        .filter((s: any) => validIds.has(s.member_area_id))
                        .map((s: any) => ({
                            ...s,
                            price: priceMap.get(s.member_area_id) || s.purchase_price || 0
                        }))
                }
            }
        }

        // 2. Vendas apps
        if (shouldFetchApps) {
            let q = supabase
                .from('user_product_access')
                .select('purchase_price, created_at')
                .eq('payment_status', 'completed')
                .in('application_id', appIds)

            if (fromDateObj) q = q.gte('created_at', fromDateObj.toISOString())
            if (endOfDay) q = q.lte('created_at', endOfDay.toISOString())

            const result = await q
            appSales = result.data || []
        }

        // 3. Checkouts marketplace
        if (shouldFetchMarketplace) {
            let q = supabase
                .from('checkout_urls')
                .select('id, created_at, member_area_id')

            if (selectedMarketplace) q = q.eq('member_area_id', selectedMarketplace)
            if (fromDateObj) q = q.gte('created_at', fromDateObj.toISOString())
            if (endOfDay) q = q.lte('created_at', endOfDay.toISOString())

            const result = await q
            
            // Filtrar por owner_id
            if (result.data && result.data.length > 0) {
                const memberAreaIds = [...new Set(result.data.map((c: any) => c.member_area_id).filter(Boolean))]
                if (memberAreaIds.length > 0) {
                    const maResult = await supabase
                        .from('member_areas')
                        .select('id, owner_id')
                        .eq('owner_id', userId)
                        .in('id', memberAreaIds)
                    
                    const validIds = new Set((maResult.data || []).map((ma: any) => ma.id))
                    marketplaceCheckouts = result.data.filter((c: any) => validIds.has(c.member_area_id))
                }
            }
        }

        // 4. Checkouts apps
        if (shouldFetchApps) {
            let q = supabase
                .from('checkout_urls')
                .select('id, created_at')
                .in('application_id', appIds)

            if (fromDateObj) q = q.gte('created_at', fromDateObj.toISOString())
            if (endOfDay) q = q.lte('created_at', endOfDay.toISOString())

            const result = await q
            appCheckouts = result.data || []
        }

        // 5. Pendentes marketplace
        if (shouldFetchMarketplace) {
            let q = supabase
                .from('user_product_access')
                .select('purchase_price, member_area_id')
                .eq('payment_status', 'pending')

            if (selectedMarketplace) q = q.eq('member_area_id', selectedMarketplace)

            const result = await q
            
            if (result.data && result.data.length > 0) {
                const memberAreaIds = [...new Set(result.data.map((s: any) => s.member_area_id).filter(Boolean))]
                if (memberAreaIds.length > 0) {
                    const maResult = await supabase
                        .from('member_areas')
                        .select('id, owner_id')
                        .eq('owner_id', userId)
                        .in('id', memberAreaIds)
                    
                    const validIds = new Set((maResult.data || []).map((ma: any) => ma.id))
                    marketplacePending = result.data.filter((s: any) => validIds.has(s.member_area_id))
                }
            }
        }

        // 6. Pendentes apps
        if (shouldFetchApps) {
            const result = await supabase
                .from('user_product_access')
                .select('purchase_price')
                .eq('payment_status', 'pending')
                .in('application_id', appIds)
            
            appPending = result.data || []
        }

        // 7. Reembolsos marketplace
        if (shouldFetchMarketplace) {
            let q = supabase
                .from('user_product_access')
                .select('id, member_area_id')
                .in('payment_status', ['refunded', 'reversed'])

            if (selectedMarketplace) q = q.eq('member_area_id', selectedMarketplace)

            const result = await q
            
            if (result.data && result.data.length > 0) {
                const memberAreaIds = [...new Set(result.data.map((s: any) => s.member_area_id).filter(Boolean))]
                if (memberAreaIds.length > 0) {
                    const maResult = await supabase
                        .from('member_areas')
                        .select('id, owner_id')
                        .eq('owner_id', userId)
                        .in('id', memberAreaIds)
                    
                    const validIds = new Set((maResult.data || []).map((ma: any) => ma.id))
                    marketplaceRefunds = result.data.filter((s: any) => validIds.has(s.member_area_id))
                }
            }
        }

        // 8. Reembolsos apps
        if (shouldFetchApps) {
            const result = await supabase
                .from('user_product_access')
                .select('id')
                .in('payment_status', ['refunded', 'reversed'])
                .in('application_id', appIds)
            
            appRefunds = result.data || []
        }

        // Calcular estatísticas
        const allSales = [...marketplaceSales, ...appSales]
        const allCheckouts = [...marketplaceCheckouts, ...appCheckouts]
        const allPending = [...marketplacePending, ...appPending]
        const allRefunds = [...marketplaceRefunds, ...appRefunds]

        const totalSales = allSales.reduce((sum, sale) => {
            const price = sale.price || sale.purchase_price || 0
            return sum + parseFloat(price)
        }, 0)

        const salesCount = allSales.length
        const checkoutsCount = allCheckouts.length
        const pendingAmount = allPending.reduce((sum, r) => sum + parseFloat(r.purchase_price || 0), 0)
        const refundCount = allRefunds.length

        // Calcular vendas diárias
        const salesByDate: Record<string, number> = {}
        allSales.forEach(sale => {
            const date = new Date(sale.created_at).toISOString().split('T')[0]
            const price = sale.price || sale.purchase_price || 0
            salesByDate[date] = (salesByDate[date] || 0) + parseFloat(price)
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

        // Calcular taxas
        const conversionRate = checkoutsCount > 0 ? (salesCount / checkoutsCount) * 100 : 0
        const refundRate = salesCount > 0 ? (refundCount / salesCount) * 100 : 0
        const abandonedCheckouts = checkoutsCount - salesCount

        const stats = {
            totalSales,
            salesCount,
            conversionRate: Math.round(conversionRate * 100) / 100,
            checkouts: checkoutsCount,
            paymentMethods: [
                { name: 'Cartão de Crédito', icon: 'card', conversion: conversionRate, value: totalSales },
            ],
            abandonedCheckouts: Math.max(0, abandonedCheckouts),
            refundRate: Math.round(refundRate * 100) / 100,
            chargebackRate: 0,
            medRate: 0,
            pendingAmount,
            refundCount,
            dailySales
        }

        return jsonResponse(stats)

    } catch (error: any) {
        console.error('Dashboard stats error:', error)
        return jsonResponse({ error: error.message || 'Internal error' }, 500)
    }
}
