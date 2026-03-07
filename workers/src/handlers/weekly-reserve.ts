// @ts-nocheck
/**
 * Handler: Weekly Financial Reserve
 *
 * Executado toda segunda-feira via cron trigger.
 * Regras (PDF clicknich_financial_engine_rules_v3):
 *  - Agrupa vendas por produtor da semana anterior (seg-dom)
 *  - Calcula 15% de reserva sobre o total bruto por moeda
 *  - Salva em financial_reserves com release_date = week_start + 60 dias
 *  - Libera automaticamente reservas com release_date <= hoje
 */

import { createClient } from '../lib/supabase'
import type { Env } from '../index'

const RESERVE_RATE = 0.15       // 15% de reserva
const RELEASE_DAYS = 60         // dias até liberar
const NON_USD_SPREAD = 0.018    // spread de moeda não-USD

/**
 * Retorna a semana anterior: { weekStart: segunda-feira, weekEnd: domingo }
 * Baseado na data de hoje (UTC)
 */
function getPreviousWeekRange(): { weekStart: Date; weekEnd: Date } {
    const now = new Date()
    const dayOfWeek = now.getUTCDay() // 0=dom, 1=seg, ...

    // Quantos dias atrás foi a segunda-feira passada (início da semana anterior)
    // Se hoje é segunda (1): 7 dias atrás; se hoje é terça (2): 8 dias atrás; etc.
    const daysToLastMonday = dayOfWeek === 0 ? 8 : dayOfWeek + 6
    const weekStart = new Date(now)
    weekStart.setUTCDate(now.getUTCDate() - daysToLastMonday)
    weekStart.setUTCHours(0, 0, 0, 0)

    const weekEnd = new Date(weekStart)
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6)
    weekEnd.setUTCHours(23, 59, 59, 999)

    return { weekStart, weekEnd }
}

function toDateStr(d: Date): string {
    return d.toISOString().split('T')[0]
}

export async function handleWeeklyReserve(env: Env): Promise<void> {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
    const { weekStart, weekEnd } = getPreviousWeekRange()
    const weekStartStr = toDateStr(weekStart)
    const weekEndStr = toDateStr(weekEnd)

    console.log(`[weekly-reserve] Calculando semana ${weekStartStr} → ${weekEndStr}`)

    // ── 1. Liberar reservas com release_date <= hoje ────────────────────────
    const today = toDateStr(new Date())
    const { error: releaseError } = await supabase
        .from('financial_reserves')
        .update({ released: true })
        .eq('released', false)
        .lte('release_date', today)

    if (releaseError) {
        console.error('[weekly-reserve] Erro ao liberar reservas:', releaseError.message)
    } else {
        console.log('[weekly-reserve] Reservas antigas liberadas')
    }

    // ── 2. Buscar vendas de apps na semana (USD) ────────────────────────────
    const { data: appSales } = await supabase
        .from('user_product_access')
        .select('application_id, purchase_price, payment_status, created_at, applications!inner(owner_id)')
        .eq('payment_status', 'completed')
        .gte('created_at', weekStart.toISOString())
        .lte('created_at', weekEnd.toISOString())

    // ── 3. Buscar vendas de member_areas na semana ──────────────────────────
    const { data: memberSales } = await supabase
        .from('user_member_area_access')
        .select('member_area_id, purchase_price, payment_status, created_at, member_areas!inner(owner_id, currency)')
        .eq('payment_status', 'completed')
        .gte('created_at', weekStart.toISOString())
        .lte('created_at', weekEnd.toISOString())

    // ── 4. Agregar por produtor + moeda ─────────────────────────────────────
    // Map: userId → Map<currency, grossAmount>
    const salesMap = new Map<string, Map<string, number>>()

    const addSale = (userId: string, currency: string, rawAmount: number) => {
        const effectiveAmount = currency !== 'USD'
            ? rawAmount * (1 - NON_USD_SPREAD)
            : rawAmount
        if (!salesMap.has(userId)) salesMap.set(userId, new Map())
        const cur = salesMap.get(userId)!
        cur.set(currency, (cur.get(currency) || 0) + effectiveAmount)
    }

        ; (appSales || []).forEach((row: any) => {
            const ownerId = row.applications?.owner_id
            if (ownerId) addSale(ownerId, 'USD', Number(row.purchase_price ?? 0))
        })

        ; (memberSales || []).forEach((row: any) => {
            const ownerId = row.member_areas?.owner_id
            const currency = (row.member_areas?.currency ?? 'USD').toUpperCase()
            if (ownerId) addSale(ownerId, currency, Number(row.purchase_price ?? 0))
        })

    if (salesMap.size === 0) {
        console.log('[weekly-reserve] Nenhuma venda encontrada na semana. Encerrando.')
        return
    }

    // ── 5. Upsert das reservas ──────────────────────────────────────────────
    const releaseDate = new Date(weekStart)
    releaseDate.setUTCDate(weekStart.getUTCDate() + RELEASE_DAYS)
    const releaseDateStr = toDateStr(releaseDate)

    const rows: any[] = []
    for (const [userId, currencies] of salesMap.entries()) {
        for (const [currency, grossAmount] of currencies.entries()) {
            if (grossAmount <= 0) continue
            rows.push({
                user_id: userId,
                week_start: weekStartStr,
                week_end: weekEndStr,
                gross_amount: parseFloat(grossAmount.toFixed(2)),
                reserve_amount: parseFloat((grossAmount * RESERVE_RATE).toFixed(2)),
                currency,
                release_date: releaseDateStr,
                released: false,
            })
        }
    }

    if (rows.length === 0) {
        console.log('[weekly-reserve] Nenhuma linha para upsert.')
        return
    }

    const { error: upsertError } = await supabase
        .from('financial_reserves')
        .upsert(rows, { onConflict: 'user_id,week_start,currency' })

    if (upsertError) {
        console.error('[weekly-reserve] Erro no upsert:', upsertError.message)
    } else {
        console.log(`[weekly-reserve] ${rows.length} registro(s) de reserva salvos.`)
    }
}
