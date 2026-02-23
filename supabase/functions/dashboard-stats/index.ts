import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DashboardRequest {
    userId: string
    fromDate?: string
    toDate?: string
    selectedApp?: string
    selectedMarketplace?: string
    selectedCurrency?: string
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { userId, fromDate, toDate, selectedApp, selectedMarketplace, selectedCurrency } = await req.json() as DashboardRequest

        if (!userId) {
            return new Response(
                JSON.stringify({ error: 'userId is required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL') as string
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
        const supabase = createClient(supabaseUrl, supabaseKey)

        // Buscar apps do usuário
        const { data: userApps } = await supabase
            .from('applications')
            .select('id')
            .eq('owner_id', userId)

        const appIds = selectedApp ? [selectedApp] : (userApps?.map((a: any) => a.id) || [])

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

        // Executar todas as queries em paralelo
        const queries: Promise<any>[] = []

        // 1. Vendas marketplace
        if (shouldFetchMarketplace) {
            let q = supabase
                .from('user_product_access')
                .select('purchase_price, created_at, member_areas!inner(price, currency, owner_id)')
                .eq('payment_status', 'completed')
                .eq('member_areas.owner_id', userId)

            if (selectedMarketplace) q = q.eq('member_area_id', selectedMarketplace)
            if (selectedCurrency) q = q.eq('member_areas.currency', selectedCurrency)
            if (fromDateObj) q = q.gte('created_at', fromDateObj.toISOString())
            if (endOfDay) q = q.lte('created_at', endOfDay.toISOString())

            queries.push(q.then(r => ({ type: 'marketplaceSales', data: r.data || [], error: r.error })))
        } else {
            queries.push(Promise.resolve({ type: 'marketplaceSales', data: [], error: null }))
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

            queries.push(q.then(r => ({ type: 'appSales', data: r.data || [], error: r.error })))
        } else {
            queries.push(Promise.resolve({ type: 'appSales', data: [], error: null }))
        }

        // 3. Checkouts marketplace
        if (shouldFetchMarketplace) {
            let q = supabase
                .from('checkout_urls')
                .select('id, created_at, member_areas!inner(owner_id)')
                .eq('member_areas.owner_id', userId)

            if (selectedMarketplace) q = q.eq('member_area_id', selectedMarketplace)
            if (fromDateObj) q = q.gte('created_at', fromDateObj.toISOString())
            if (endOfDay) q = q.lte('created_at', endOfDay.toISOString())

            queries.push(q.then(r => ({ type: 'marketplaceCheckouts', data: r.data || [], error: r.error })))
        } else {
            queries.push(Promise.resolve({ type: 'marketplaceCheckouts', data: [], error: null }))
        }

        // 4. Checkouts apps
        if (shouldFetchApps) {
            let q = supabase
                .from('checkout_urls')
                .select('id, created_at')
                .in('application_id', appIds)

            if (fromDateObj) q = q.gte('created_at', fromDateObj.toISOString())
            if (endOfDay) q = q.lte('created_at', endOfDay.toISOString())

            queries.push(q.then(r => ({ type: 'appCheckouts', data: r.data || [], error: r.error })))
        } else {
            queries.push(Promise.resolve({ type: 'appCheckouts', data: [], error: null }))
        }

        // 5. Pendentes marketplace
        if (shouldFetchMarketplace) {
            let q = supabase
                .from('user_product_access')
                .select('purchase_price, member_areas!inner(owner_id)')
                .eq('payment_status', 'pending')
                .eq('member_areas.owner_id', userId)

            if (selectedMarketplace) q = q.eq('member_area_id', selectedMarketplace)

            queries.push(q.then(r => ({ type: 'marketplacePending', data: r.data || [], error: r.error })))
        } else {
            queries.push(Promise.resolve({ type: 'marketplacePending', data: [], error: null }))
        }

        // 6. Pendentes apps
        if (shouldFetchApps) {
            const q = supabase
                .from('user_product_access')
                .select('purchase_price')
                .eq('payment_status', 'pending')
                .in('application_id', appIds)

            queries.push(q.then(r => ({ type: 'appPending', data: r.data || [], error: r.error })))
        } else {
            queries.push(Promise.resolve({ type: 'appPending', data: [], error: null }))
        }

        // 7. Reembolsos marketplace
        if (shouldFetchMarketplace) {
            let q = supabase
                .from('user_product_access')
                .select('id, member_areas!inner(owner_id)')
                .in('payment_status', ['refunded', 'reversed'])
                .eq('member_areas.owner_id', userId)

            if (selectedMarketplace) q = q.eq('member_area_id', selectedMarketplace)

            queries.push(q.then(r => ({ type: 'marketplaceRefunds', data: r.data || [], error: r.error })))
        } else {
            queries.push(Promise.resolve({ type: 'marketplaceRefunds', data: [], error: null }))
        }

        // 8. Reembolsos apps
        if (shouldFetchApps) {
            const q = supabase
                .from('user_product_access')
                .select('id')
                .in('payment_status', ['refunded', 'reversed'])
                .in('application_id', appIds)

            queries.push(q.then(r => ({ type: 'appRefunds', data: r.data || [], error: r.error })))
        } else {
            queries.push(Promise.resolve({ type: 'appRefunds', data: [], error: null }))
        }

        // Executar todas as queries em paralelo
        const results = await Promise.all(queries)

        // Organizar resultados por tipo
        const resultMap: Record<string, any[]> = {}
        for (const r of results) {
            if (r.error) {
                console.error(`Error in ${r.type}:`, r.error)
            }
            resultMap[r.type] = r.data || []
        }

        // Calcular estatísticas
        const allSales = [...resultMap.marketplaceSales, ...resultMap.appSales]
        const allCheckouts = [...resultMap.marketplaceCheckouts, ...resultMap.appCheckouts]
        const allPending = [...resultMap.marketplacePending, ...resultMap.appPending]
        const allRefunds = [...resultMap.marketplaceRefunds, ...resultMap.appRefunds]

        const totalSales = allSales.reduce((sum, sale) => {
            const price = sale.member_areas?.price || sale.purchase_price || 0
            return sum + price
        }, 0)

        const salesCount = allSales.length
        const checkoutsCount = allCheckouts.length
        const pendingAmount = allPending.reduce((sum, r) => sum + (r.purchase_price || 0), 0)
        const refundCount = allRefunds.length

        // Calcular vendas diárias
        const salesByDate: Record<string, number> = {}
        allSales.forEach(sale => {
            const date = new Date(sale.created_at).toISOString().split('T')[0]
            const price = sale.member_areas?.price || sale.purchase_price || 0
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

        return new Response(
            JSON.stringify(stats),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Dashboard stats error:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
