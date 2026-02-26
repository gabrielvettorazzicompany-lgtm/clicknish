// @ts-nocheck
/**
 * Handler: Finance
 * Lista transações financeiras do usuário com cache
 */

import { createClient } from '../lib/supabase'
import { withCache } from '../utils/cache'
import type { Env } from '../index'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface FinanceRequest {
    userId: string
    fromDate?: string
    toDate?: string
}

interface Transaction {
    id: string
    description: string
    type: 'sale' | 'commission' | 'withdrawal' | 'refund' | 'anticipation'
    amount: number
    currency: string
    direction: 'in' | 'out'
    date: string
    status: 'completed' | 'pending' | 'processing'
    paymentMethod?: string
}

interface FinanceStats {
    availableBalance: number
    pendingBalance: number
    awaitingAnticipation: number
    financialReserve: number
}

function jsonResponse(data: any, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
}

function mapPaymentStatus(status: string): Transaction['status'] {
    if (status === 'completed') return 'completed'
    if (status === 'pending') return 'pending'
    return 'processing'
}

function mapTransactionType(status: string): Transaction['type'] {
    if (status === 'refunded' || status === 'reversed') return 'refund'
    return 'sale'
}

function mapDirection(status: string): Transaction['direction'] {
    if (status === 'refunded' || status === 'reversed') return 'out'
    return 'in'
}

export async function handleFinance(
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
        const body = await request.json() as FinanceRequest
        const { userId, fromDate, toDate } = body

        if (!userId) {
            return jsonResponse({ error: 'userId is required' }, 400)
        }

        // Gerar chave de cache
        const cacheKey = `finance:${userId}:${fromDate || ''}:${toDate || ''}`

        const result = await withCache(env, cacheKey, async () => {
            const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

            // Preparar filtros de data
            const fromDateObj = fromDate ? new Date(fromDate) : undefined
            let endOfDay: Date | undefined
            if (toDate) {
                endOfDay = new Date(toDate)
                endOfDay.setHours(23, 59, 59, 999)
            }

            // Buscar apps do usuário
            const { data: userApps } = await supabase
                .from('applications')
                .select('id, name')
                .eq('owner_id', userId)
            const appIds = userApps?.map(a => a.id) || []
            const appNames = new Map(userApps?.map(a => [a.id, a.name]) || [])

            // Buscar member_areas do usuário
            const { data: userMemberAreas } = await supabase
                .from('member_areas')
                .select('id, name, currency')
                .eq('owner_id', userId)
            const memberAreaIds = userMemberAreas?.map(m => m.id) || []
            const memberAreaInfo = new Map(userMemberAreas?.map(m => [m.id, { name: m.name, currency: m.currency }]) || [])

            // Helper para resultado vazio
            const emptyResult = () => Promise.resolve({ data: [], error: null })

            // Queries em paralelo
            let appSalesQuery: any = emptyResult()
            if (appIds.length > 0) {
                let query = supabase
                    .from('user_product_access')
                    .select('id, payment_id, purchase_price, payment_status, payment_method, created_at, application_id')
                    .in('application_id', appIds)
                    .not('payment_status', 'eq', 'failed')
                    .order('created_at', { ascending: false })
                    .limit(500)

                if (fromDateObj) query = query.gte('created_at', fromDateObj.toISOString())
                if (endOfDay) query = query.lte('created_at', endOfDay.toISOString())
                appSalesQuery = query
            }

            let memberSalesQuery: any = emptyResult()
            if (memberAreaIds.length > 0) {
                let query = supabase
                    .from('user_member_area_access')
                    .select('id, member_area_id, purchase_price, payment_status, payment_method, created_at')
                    .in('member_area_id', memberAreaIds)
                    .not('payment_status', 'eq', 'failed')
                    .order('created_at', { ascending: false })
                    .limit(500)

                if (fromDateObj) query = query.gte('created_at', fromDateObj.toISOString())
                if (endOfDay) query = query.lte('created_at', endOfDay.toISOString())
                memberSalesQuery = query
            }

            const [appSalesResult, memberSalesResult] = await Promise.all([
                appSalesQuery, memberSalesQuery
            ])

            // Mapear vendas de apps (deduplicar por payment_id)
            const seenAppPayments = new Set<string>()
            const appTransactions: Transaction[] = (appSalesResult.data ?? []).reduce((acc: Transaction[], row: any) => {
                const paymentKey = row.payment_id ?? row.id
                if (seenAppPayments.has(paymentKey)) return acc
                seenAppPayments.add(paymentKey)
                const productName = appNames.get(row.application_id) ?? 'Produto'
                const status = row.payment_status ?? 'completed'
                acc.push({
                    id: `app-${row.id}`,
                    description: `Venda - ${productName}`,
                    type: mapTransactionType(status),
                    amount: Number(row.purchase_price ?? 0),
                    currency: 'USD',
                    direction: mapDirection(status),
                    date: row.created_at,
                    status: mapPaymentStatus(status),
                    paymentMethod: row.payment_method ?? undefined,
                })
                return acc
            }, [])

            // Mapear vendas de member_areas
            const memberTransactions: Transaction[] = (memberSalesResult.data ?? []).map((row: any) => {
                const maInfo = memberAreaInfo.get(row.member_area_id)
                const productName = maInfo?.name ?? 'Produto'
                const status = row.payment_status ?? 'completed'
                return {
                    id: `member-${row.id}`,
                    description: `Venda - ${productName}`,
                    type: mapTransactionType(status),
                    amount: Number(row.purchase_price ?? 0),
                    currency: (maInfo?.currency ?? 'USD').toUpperCase(),
                    direction: mapDirection(status),
                    date: row.created_at,
                    status: mapPaymentStatus(status),
                    paymentMethod: row.payment_method ?? undefined,
                }
            })

            // Combinar e ordenar
            const transactions = [...appTransactions, ...memberTransactions]
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

            // Calcular stats por moeda
            const uniqueCurrencies = [...new Set(transactions.map(t => t.currency))]
            const statsByCurrency: Record<string, FinanceStats> = {}
            for (const currency of uniqueCurrencies) {
                const currencyTxs = transactions.filter(t => t.currency === currency)
                statsByCurrency[currency] = {
                    availableBalance: currencyTxs
                        .filter(t => t.status === 'completed' && t.direction === 'in')
                        .reduce((sum, t) => sum + t.amount, 0),
                    pendingBalance: currencyTxs
                        .filter(t => t.status === 'pending' && t.direction === 'in')
                        .reduce((sum, t) => sum + t.amount, 0),
                    awaitingAnticipation: 0,
                    financialReserve: 0
                }
            }

            // Stats totais
            const stats: FinanceStats = {
                availableBalance: transactions
                    .filter(t => t.status === 'completed' && t.direction === 'in')
                    .reduce((sum, t) => sum + t.amount, 0),
                pendingBalance: transactions
                    .filter(t => t.status === 'pending' && t.direction === 'in')
                    .reduce((sum, t) => sum + t.amount, 0),
                awaitingAnticipation: 0,
                financialReserve: 0
            }

            return { transactions, stats, statsByCurrency }
        }, { ttl: 60 }) // Cache por 60 segundos

        return jsonResponse(result)

    } catch (error: any) {
        console.error('Finance handler error:', error)
        return jsonResponse({ error: error.message || 'Internal error' }, 500)
    }
}
