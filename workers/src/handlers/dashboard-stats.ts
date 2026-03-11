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

        console.log('Dashboard stats request:', { userId, selectedApp, selectedMarketplace, selectedCurrency })

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

        // Determinar quais queries fazer
        // Se um produto específico foi selecionado, buscar APENAS esse tipo
        // Caso contrário, buscar baseado na moeda
        let shouldFetchMarketplace: boolean
        let shouldFetchApps: boolean

        if (selectedMarketplace) {
            // Produto marketplace selecionado - buscar APENAS marketplace
            shouldFetchMarketplace = true
            shouldFetchApps = false
        } else if (selectedApp) {
            // App selecionado - buscar APENAS apps
            shouldFetchMarketplace = false
            shouldFetchApps = appIds.length > 0
        } else {
            // Nenhum produto selecionado - buscar baseado na moeda
            // BRL = apenas marketplace; USD = apenas apps; EUR/CHF/sem filtro = ambos
            const isMarketplaceCurrency = !selectedCurrency || selectedCurrency === 'BRL' || (selectedCurrency !== 'USD')
            const isAppCurrency = !selectedCurrency || selectedCurrency === 'USD' || (selectedCurrency !== 'BRL')
            shouldFetchMarketplace = isMarketplaceCurrency
            shouldFetchApps = isAppCurrency && appIds.length > 0
        }

        console.log('Filter logic:', { selectedMarketplace, selectedApp, shouldFetchMarketplace, shouldFetchApps })

        // Preparar filtros de data
        const fromDateObj = fromDate ? new Date(fromDate) : undefined
        const toDateObj = toDate ? new Date(toDate) : undefined
        let endOfDay: Date | undefined
        if (toDateObj) {
            // Adiciona 24h-1ms ao início do dia local enviado pelo frontend (em UTC),
            // evitando o bug de timezone do setHours em ambiente UTC do worker.
            endOfDay = new Date(toDateObj.getTime() + 24 * 60 * 60 * 1000 - 1)
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
        let marketplaceAttempts: any[] = []
        let appAttempts: any[] = []
        let allSalesFromLoc: any[] = []

        // 1. Tentativas de pagamento marketplace (todos os status exceto refunded/reversed)
        if (shouldFetchMarketplace) {
            let q = supabase
                .from('user_member_area_access')
                .select('purchase_price, created_at, member_area_id, payment_method, payment_status')
                .not('payment_status', 'in', '(refunded,reversed)')

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

                    const validMas = (maResult.data || []).filter((ma: any) => {
                        if (!selectedCurrency || selectedCurrency === 'BRL') return true
                        return (ma.currency || 'BRL').toUpperCase() === selectedCurrency.toUpperCase()
                    })
                    const validIds = new Set(validMas.map((ma: any) => ma.id))
                    const priceMap = new Map(validMas.map((ma: any) => [ma.id, ma.price]))

                    marketplaceAttempts = result.data
                        .filter((s: any) => validIds.has(s.member_area_id))
                        .map((s: any) => ({
                            ...s,
                            price: priceMap.get(s.member_area_id) || s.purchase_price || 0
                        }))

                    // Separar apenas as completadas para vendas
                    marketplaceSales = marketplaceAttempts.filter((s: any) => s.payment_status === 'completed')
                }
            }
        }

        // 2. Tentativas de pagamento apps (todos os status exceto refunded/reversed)
        if (shouldFetchApps) {
            let q = supabase
                .from('user_product_access')
                .select('purchase_price, created_at, payment_method, payment_status, payment_id')
                .not('payment_status', 'in', '(refunded,reversed)')
                .in('application_id', appIds)

            if (fromDateObj) q = q.gte('created_at', fromDateObj.toISOString())
            if (endOfDay) q = q.lte('created_at', endOfDay.toISOString())

            const result = await q
            // Desduplicar por payment_id: apps com módulos geram N linhas por pedido
            const seenPaymentIds = new Set<string>()
            appAttempts = (result.data || []).filter((row: any) => {
                const key = row.payment_id ?? null
                if (!key) return true // sem payment_id: manter (ex: acesso manual)
                if (seenPaymentIds.has(key)) return false
                seenPaymentIds.add(key)
                return true
            })
            appSales = appAttempts.filter((s: any) => s.payment_status === 'completed')
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

        // 5. Pendentes marketplace (tabela: user_member_area_access)
        if (shouldFetchMarketplace) {
            let q = supabase
                .from('user_member_area_access')
                .select('purchase_price, member_area_id')
                .eq('payment_status', 'pending')

            if (selectedMarketplace) q = q.eq('member_area_id', selectedMarketplace)
            if (fromDateObj) q = q.gte('created_at', fromDateObj.toISOString())
            if (endOfDay) q = q.lte('created_at', endOfDay.toISOString())

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
            let q = supabase
                .from('user_product_access')
                .select('purchase_price, payment_id')
                .eq('payment_status', 'pending')
                .in('application_id', appIds)

            if (fromDateObj) q = q.gte('created_at', fromDateObj.toISOString())
            if (endOfDay) q = q.lte('created_at', endOfDay.toISOString())

            const result = await q
            // Desduplicar por payment_id
            const seenPendingIds = new Set<string>()
            appPending = (result.data || []).filter((row: any) => {
                const key = row.payment_id ?? null
                if (!key) return true
                if (seenPendingIds.has(key)) return false
                seenPendingIds.add(key)
                return true
            })
        }

        // 7. Reembolsos marketplace (tabela: user_member_area_access)
        if (shouldFetchMarketplace) {
            let q = supabase
                .from('user_member_area_access')
                .select('id, member_area_id')
                .in('payment_status', ['refunded', 'reversed'])

            if (selectedMarketplace) q = q.eq('member_area_id', selectedMarketplace)
            if (fromDateObj) q = q.gte('created_at', fromDateObj.toISOString())
            if (endOfDay) q = q.lte('created_at', endOfDay.toISOString())

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
            let q = supabase
                .from('user_product_access')
                .select('id, payment_id')
                .in('payment_status', ['refunded', 'reversed'])
                .in('application_id', appIds)

            if (fromDateObj) q = q.gte('created_at', fromDateObj.toISOString())
            if (endOfDay) q = q.lte('created_at', endOfDay.toISOString())

            const result = await q
            // Desduplicar por payment_id
            const seenRefundIds = new Set<string>()
            appRefunds = (result.data || []).filter((row: any) => {
                const key = row.payment_id ?? row.id
                if (seenRefundIds.has(key)) return false
                seenRefundIds.add(key)
                return true
            })
        }

        // ── SALES SOURCE: sale_locations (1 linha = 1 venda, sem duplicatas de produtos) ──
        // user_product_access tem N linhas por pedido (uma por produto do app), causando
        // contagem incorreta. sale_locations é inserido uma única vez por PaymentIntent.
        {
            let saleLq = supabase
                .from('sale_locations')
                .select('amount, currency, payment_method, sale_date')
                .eq('user_id', userId)

            if (selectedApp) {
                saleLq = saleLq.eq('product_id', selectedApp)
            } else if (selectedMarketplace) {
                saleLq = saleLq.eq('product_id', selectedMarketplace)
            } else if (selectedCurrency) {
                saleLq = (saleLq as any).ilike('currency', selectedCurrency)
            }

            if (fromDateObj) saleLq = saleLq.gte('sale_date', fromDateObj.toISOString())
            if (endOfDay) saleLq = saleLq.lte('sale_date', endOfDay.toISOString())

            const { data: saleLocData } = await saleLq
            allSalesFromLoc = saleLocData || []
        }

        // Calcular estatísticas
        const allSales = allSalesFromLoc
        const allCheckouts = [...marketplaceCheckouts, ...appCheckouts]
        const allPending = [...marketplacePending, ...appPending]
        const allRefunds = [...marketplaceRefunds, ...appRefunds]
        const allAttempts = [...marketplaceAttempts, ...appAttempts]

        const totalSales = allSales.reduce((sum, sale) => {
            return sum + parseFloat(sale.amount || 0)
        }, 0)

        const salesCount = allSales.length
        const attemptsCount = allAttempts.length
        const checkoutsCount = allCheckouts.length
        const pendingAmount = allPending.reduce((sum, r) => sum + parseFloat(r.purchase_price || 0), 0)
        const refundCount = allRefunds.length

        // Calcular vendas diárias
        const salesByDate: Record<string, number> = {}
        allSales.forEach(sale => {
            const date = new Date(sale.sale_date).toISOString().split('T')[0]
            salesByDate[date] = (salesByDate[date] || 0) + parseFloat(sale.amount || 0)
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

        // Calcular taxa de conversão: (Vendas Aprovadas ÷ Inícios de Checkout) × 100
        const conversionRate = checkoutsCount > 0 ? (salesCount / checkoutsCount) * 100 : 0
        const refundRate = salesCount > 0 ? (refundCount / salesCount) * 100 : 0
        const abandonedCheckouts = checkoutsCount - salesCount

        // Agrupar tentativas e vendas por método de pagamento
        const normalizeMethod = (m: string | null): string => {
            if (!m) return 'card'
            const l = m.toLowerCase()
            if (l.includes('paypal')) return 'paypal'
            if (l.includes('pix')) return 'pix'
            if (l.includes('boleto') || l.includes('bank_slip')) return 'boleto'
            if (l.includes('transfer')) return 'bank_transfer'
            return 'card'
        }
        const METHOD_DISPLAY_NAMES: Record<string, string> = {
            card: 'Cartão de Crédito',
            paypal: 'PayPal',
            pix: 'Pix',
            boleto: 'Boleto',
            bank_transfer: 'Transferência',
        }

        // Contar tentativas por método
        const attemptsByMethod: Record<string, number> = {}
        allAttempts.forEach((attempt: any) => {
            const key = normalizeMethod(attempt.payment_method)
            attemptsByMethod[key] = (attemptsByMethod[key] || 0) + 1
        })

        // Agrupar vendas aprovadas por método
        const methodGroups: Record<string, { value: number; count: number }> = {}
        allSales.forEach((sale: any) => {
            const key = normalizeMethod(sale.payment_method)
            if (!methodGroups[key]) methodGroups[key] = { value: 0, count: 0 }
            methodGroups[key].value += parseFloat(sale.amount || 0)
            methodGroups[key].count += 1
        })

        // Calcular taxa de conversão por método: (Aprovados ÷ Tentativas) × 100
        const paymentMethods = Object.keys(methodGroups).length > 0
            ? Object.entries(methodGroups).map(([icon, data]) => ({
                name: METHOD_DISPLAY_NAMES[icon] || icon,
                icon,
                conversion: attemptsByMethod[icon] > 0
                    ? Math.round((data.count / attemptsByMethod[icon]) * 10000) / 100
                    : 0,
                value: data.value,
            }))
            : [
                { name: 'Cartão de Crédito', icon: 'card', conversion: conversionRate, value: totalSales },
                { name: 'PayPal', icon: 'paypal', conversion: 0, value: 0 },
            ]

        // Garantir que PayPal sempre apareça na lista
        const hasPaypal = paymentMethods.some((m: any) => m.icon === 'paypal')
        if (!hasPaypal) {
            paymentMethods.push({ name: 'PayPal', icon: 'paypal', conversion: 0, value: 0 })
        }

        const stats = {
            totalSales,
            salesCount,
            conversionRate: Math.round(conversionRate * 100) / 100,
            checkouts: checkoutsCount,
            paymentMethods,
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
