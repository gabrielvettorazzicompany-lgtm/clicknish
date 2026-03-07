// @ts-nocheck
/**
 * Handler: Finance
 * Dados financeiros do produtor: saldo, pedidos de saque, antecipações
 */

import { createClient } from '../lib/supabase'
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

interface FinanceStats {
    availableBalance: number
    pendingBalance: number
    awaitingAnticipation: number
    financialReserve: number
}

// Taxas por modelo de payout — percentual cobrado no saque (PDF: clicknich_financial_engine_rules_v3)
const PAYOUT_FEES: Record<string, { percentage: number }> = {
    'D+2': { percentage: 8.99 },
    'D+5': { percentage: 6.99 },
    'D+12': { percentage: 4.99 },
}

// Taxa fixa por transação (venda), deduzida do saldo disponível
const TRANSACTION_FEE = 0.49

// Spread adicional para vendas em moeda não-USD (1.8%)
const NON_USD_SPREAD = 0.018

function jsonResponse(data: any, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
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

        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

        // Preparar filtros de data
        const fromDateObj = fromDate ? new Date(fromDate) : undefined
        let endOfDay: Date | undefined
        if (toDate) {
            // Adiciona 24h-1ms ao início do dia local enviado pelo frontend (em UTC),
            // evitando o bug de timezone do setHours em ambiente UTC do worker.
            endOfDay = new Date(new Date(toDate).getTime() + 24 * 60 * 60 * 1000 - 1)
        }

        // Buscar apps e member_areas do usuário em paralelo
        const [userAppsResult, userMemberAreasResult] = await Promise.all([
            supabase.from('applications').select('id, name').eq('owner_id', userId),
            supabase.from('member_areas').select('id, name, currency').eq('owner_id', userId)
        ])

        const appIds = userAppsResult.data?.map((a: any) => a.id) || []
        const appNames = new Map(userAppsResult.data?.map((a: any) => [a.id, a.name]) || [])
        const memberAreaIds = userMemberAreasResult.data?.map((m: any) => m.id) || []
        const memberAreaInfo = new Map(userMemberAreasResult.data?.map((m: any) => [m.id, { name: m.name, currency: m.currency }]) || [])

        const emptyResult = () => Promise.resolve({ data: [], error: null })

        // Queries em paralelo: vendas de apps + vendas marketplace + pedidos de saque
        const [appSalesResult, memberSalesResult, withdrawalsResult, anticipationsResult] = await Promise.all([
            appIds.length > 0 ? (() => {
                let q = supabase
                    .from('user_product_access')
                    .select('id, payment_id, purchase_price, payment_status, payment_method, created_at, application_id')
                    .in('application_id', appIds)
                    .not('payment_status', 'eq', 'failed')
                    .order('created_at', { ascending: false })
                    .limit(500)
                if (fromDateObj) q = q.gte('created_at', fromDateObj.toISOString())
                if (endOfDay) q = q.lte('created_at', endOfDay.toISOString())
                return q
            })() : emptyResult(),

            memberAreaIds.length > 0 ? (() => {
                let q = supabase
                    .from('user_member_area_access')
                    .select('id, member_area_id, purchase_price, payment_status, payment_method, created_at')
                    .in('member_area_id', memberAreaIds)
                    .not('payment_status', 'eq', 'failed')
                    .order('created_at', { ascending: false })
                    .limit(500)
                if (fromDateObj) q = q.gte('created_at', fromDateObj.toISOString())
                if (endOfDay) q = q.lte('created_at', endOfDay.toISOString())
                return q
            })() : emptyResult(),

            // Buscar pedidos de saque e antecipações do usuário
            supabase
                .from('withdrawal_requests')
                .select('id, amount, currency, payout_schedule, fee_percentage, fee_fixed, fee_amount, net_amount, status, created_at, completed_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(100),
            supabase
                .from('anticipation_requests')
                .select('id, amount, currency, payout_schedule, fee_percentage, fee_fixed, fee_amount, net_amount, status, created_at, completed_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(100)
        ])

        // Mapear pedidos de saque
        const withdrawals = (withdrawalsResult.data || []).map((w: any) => ({
            id: w.id,
            amount: Number(w.amount),
            currency: w.currency,
            payoutSchedule: w.payout_schedule,
            feePercentage: Number(w.fee_percentage),
            feeFixed: Number(w.fee_fixed),
            feeAmount: Number(w.fee_amount),
            netAmount: Number(w.net_amount),
            status: w.status,
            createdAt: w.created_at,
            completedAt: w.completed_at,
        }))

        // Mapear pedidos de antecipação
        const anticipations = (anticipationsResult.data || []).map((a: any) => ({
            id: a.id,
            amount: Number(a.amount),
            currency: a.currency,
            payoutSchedule: a.payout_schedule,
            feePercentage: Number(a.fee_percentage),
            feeFixed: Number(a.fee_fixed),
            feeAmount: Number(a.fee_amount),
            netAmount: Number(a.net_amount),
            status: a.status,
            createdAt: a.created_at,
            completedAt: a.completed_at,
        }))

        // Calcular totais de vendas por moeda e contar transações (para taxa fixa $0.49/venda)
        const salesByCurrency: Record<string, number> = {}
        const saleCountByCurrency: Record<string, number> = {}

        // Vendas de apps (USD)
        const seenAppPayments = new Set<string>()
            ; (appSalesResult.data || []).forEach((row: any) => {
                const paymentKey = row.payment_id ?? row.id
                if (seenAppPayments.has(paymentKey)) return
                seenAppPayments.add(paymentKey)
                if (row.payment_status === 'completed') {
                    const price = Number(row.purchase_price ?? 0)
                    salesByCurrency['USD'] = (salesByCurrency['USD'] || 0) + price
                    saleCountByCurrency['USD'] = (saleCountByCurrency['USD'] || 0) + 1
                }
            })

            // Vendas de marketplace
            ; (memberSalesResult.data || []).forEach((row: any) => {
                const maInfo = memberAreaInfo.get(row.member_area_id)
                const currency = (maInfo?.currency ?? 'USD').toUpperCase()
                const rawPrice = Number(row.purchase_price ?? 0)
                // Spread 1.8% para vendas em moeda não-USD
                const effectivePrice = currency !== 'USD' ? rawPrice * (1 - NON_USD_SPREAD) : rawPrice
                if (row.payment_status === 'completed') {
                    salesByCurrency[currency] = (salesByCurrency[currency] || 0) + effectivePrice
                    saleCountByCurrency[currency] = (saleCountByCurrency[currency] || 0) + 1
                }
            })

        // Calcular saldo disponível: vendas completadas - total sacado (completed + processing)
        const withdrawnByCurrency: Record<string, number> = {}
        const pendingByCurrency: Record<string, number> = {}
            ; (withdrawalsResult.data || []).forEach((w: any) => {
                const cur = w.currency
                if (w.status === 'completed' || w.status === 'processing') {
                    withdrawnByCurrency[cur] = (withdrawnByCurrency[cur] || 0) + Number(w.amount)
                }
                if (w.status === 'processing') {
                    pendingByCurrency[cur] = (pendingByCurrency[cur] || 0) + Number(w.amount)
                }
            })

        // Buscar reservas financeiras reais do banco (ainda bloqueadas)
        const today = new Date().toISOString().split('T')[0]
        const { data: reservesData } = await supabase
            .from('financial_reserves')
            .select('currency, reserve_amount, released, release_date')
            .eq('user_id', userId)
            .eq('released', false)
            .gt('release_date', today)

        const reserveByCurrency: Record<string, number> = {}
            ; (reservesData || []).forEach((r: any) => {
                const cur = r.currency
                reserveByCurrency[cur] = (reserveByCurrency[cur] || 0) + Number(r.reserve_amount)
            })

        // Calcular stats por moeda
        const statsByCurrency: Record<string, FinanceStats> = {}
        for (const currency of new Set([...Object.keys(salesByCurrency), ...Object.keys(withdrawnByCurrency)])) {
            const totalSales = salesByCurrency[currency] || 0
            const totalWithdrawn = withdrawnByCurrency[currency] || 0
            const pending = pendingByCurrency[currency] || 0
            const financialReserve = parseFloat((reserveByCurrency[currency] || 0).toFixed(2))
            // $0.49 por transação descontado do saldo disponível
            const totalTransactionFees = parseFloat(((saleCountByCurrency[currency] || 0) * TRANSACTION_FEE).toFixed(2))
            statsByCurrency[currency] = {
                availableBalance: Math.max(0, totalSales - totalWithdrawn - financialReserve - totalTransactionFees),
                pendingBalance: pending,
                awaitingAnticipation: 0,
                financialReserve,
            }
        }

        // Stats globais (USD como padrão)
        const stats: FinanceStats = statsByCurrency['USD'] || {
            availableBalance: 0,
            pendingBalance: 0,
            awaitingAnticipation: 0,
            financialReserve: 0,
        }

        return jsonResponse({ withdrawals, anticipations, stats, statsByCurrency })

    } catch (error: any) {
        console.error('Finance handler error:', error)
        return jsonResponse({ error: error.message || 'Internal error' }, 500)
    }
}

// POST /api/finance/anticipate — Criar pedido de antecipação
export async function handleAnticipate(
    request: Request,
    env: Env,
): Promise<Response> {
    if (request.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405, headers: corsHeaders })
    }

    try {
        const body: any = await request.json()
        const { userId, amount, currency = 'USD' } = body

        if (!userId || !amount) {
            return jsonResponse({ error: 'userId e amount são obrigatórios' }, 400)
        }

        const numAmount = Number(amount)
        if (isNaN(numAmount) || numAmount <= 0) {
            return jsonResponse({ error: 'amount inválido' }, 400)
        }

        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

        // Taxa de antecipação: 2.5% + $0.49
        const feePercentage = 2.5
        const feeFixed = 0.49
        const feeAmount = numAmount * (feePercentage / 100) + feeFixed
        const netAmount = Math.max(0, numAmount - feeAmount)

        const { data, error } = await supabase
            .from('anticipation_requests')
            .insert({
                user_id: userId,
                amount: numAmount,
                currency,
                payout_schedule: 'D+2',
                fee_percentage: feePercentage,
                fee_fixed: feeFixed,
                fee_amount: parseFloat(feeAmount.toFixed(2)),
                net_amount: parseFloat(netAmount.toFixed(2)),
                status: 'processing',
            })
            .select()
            .single()

        if (error) throw error

        return jsonResponse({ success: true, anticipation: data }, 201)

    } catch (error: any) {
        console.error('Anticipate handler error:', error)
        return jsonResponse({ error: error.message || 'Internal error' }, 500)
    }
}

// POST /api/finance/withdraw — Criar pedido de saque
export async function handleWithdraw(
    request: Request,
    env: Env,
): Promise<Response> {
    if (request.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405, headers: corsHeaders })
    }

    try {
        const body: any = await request.json()
        const { userId, amount, schedule, currency = 'USD', destination } = body

        if (!userId || !amount || !schedule) {
            return jsonResponse({ error: 'userId, amount e schedule são obrigatórios' }, 400)
        }

        if (!['D+2', 'D+5', 'D+12'].includes(schedule)) {
            return jsonResponse({ error: 'schedule inválido. Use D+2, D+5 ou D+12' }, 400)
        }

        const numAmount = Number(amount)
        if (isNaN(numAmount) || numAmount <= 0) {
            return jsonResponse({ error: 'amount inválido' }, 400)
        }

        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

        // Calcular taxa (apenas percentual — $0.49 é cobrado por venda, não por saque)
        const fee = PAYOUT_FEES[schedule as keyof typeof PAYOUT_FEES]
        const feeAmount = numAmount * (fee.percentage / 100)
        const netAmount = Math.max(0, numAmount - feeAmount)

        const { data, error } = await supabase
            .from('withdrawal_requests')
            .insert({
                user_id: userId,
                amount: numAmount,
                currency,
                payout_schedule: schedule,
                fee_percentage: fee.percentage,
                fee_fixed: 0,
                fee_amount: parseFloat(feeAmount.toFixed(2)),
                net_amount: parseFloat(netAmount.toFixed(2)),
                status: 'processing',
                destination: destination || null,
            })
            .select()
            .single()

        if (error) throw error

        return jsonResponse({ success: true, withdrawal: data }, 201)

    } catch (error: any) {
        console.error('Withdraw handler error:', error)
        return jsonResponse({ error: error.message || 'Internal error' }, 500)
    }
}

// POST /api/finance/request-plan — Produtor solicita upgrade para D+2
export async function handleRequestPlan(
    request: Request,
    env: Env,
): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders })

    try {
        const body: any = await request.json()
        const { userId, reason } = body

        if (!userId) return jsonResponse({ error: 'userId é obrigatório' }, 400)

        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

        // Verificar se já tem solicitação pendente
        const { data: existing } = await supabase
            .from('payout_plan_requests')
            .select('id, status')
            .eq('user_id', userId)
            .eq('status', 'pending')
            .maybeSingle()

        if (existing) {
            return jsonResponse({ error: 'Você já tem uma solicitação pendente de plano D+2' }, 409)
        }

        // Verificar plano atual
        const { data: cfg } = await supabase
            .from('user_payment_config')
            .select('payout_schedule')
            .eq('user_id', userId)
            .maybeSingle()

        if (cfg?.payout_schedule === 'D+2') {
            return jsonResponse({ error: 'Você já está no plano D+2' }, 409)
        }

        const { data, error } = await supabase
            .from('payout_plan_requests')
            .insert({
                user_id: userId,
                requested_plan: 'D+2',
                current_plan: cfg?.payout_schedule || 'D+5',
                reason: reason || null,
                status: 'pending',
            })
            .select()
            .single()

        if (error) throw error

        return jsonResponse({ success: true, request: data }, 201)

    } catch (error: any) {
        console.error('RequestPlan handler error:', error)
        return jsonResponse({ error: error.message || 'Internal error' }, 500)
    }
}
