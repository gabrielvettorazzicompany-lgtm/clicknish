// @ts-nocheck
/**
 * Handler: Orders
 * Lista pedidos do usuário com cache
 */

import { createClient } from '../lib/supabase'
import { withCache } from '../utils/cache'
import type { Env } from '../index'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface OrdersRequest {
    userId: string
    fromDate?: string
    toDate?: string
    selectedProduct?: string
}

interface Order {
    id: string
    orderNumber: string
    date: string
    total: number
    customer: {
        name: string
        email: string
    }
    paymentMethod: string
    paymentStatus: 'completed' | 'pending' | 'failed'
    productName: string
    productId: string
    productType: 'marketplace' | 'app'
}

function jsonResponse(data: any, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
}

export async function handleOrders(
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
        const body = await request.json() as OrdersRequest
        const { userId, fromDate, toDate, selectedProduct } = body

        if (!userId) {
            return jsonResponse({ error: 'userId is required' }, 400)
        }

        // Gerar chave de cache
        const cacheKey = `orders:${userId}:${fromDate || ''}:${toDate || ''}:${selectedProduct || ''}`

        const result = await withCache(env, cacheKey, async () => {
            const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

            // Preparar filtros de data
            const fromDateObj = fromDate ? new Date(fromDate) : undefined
            let endOfDay: Date | undefined
            if (toDate) {
                endOfDay = new Date(new Date(toDate).getTime() + 24 * 60 * 60 * 1000 - 1)
            }

            // Buscar apps e member_areas do usuário (para nomes dos produtos)
            const [appsResult, memberAreasResult] = await Promise.all([
                supabase.from('applications').select('id, name').eq('owner_id', userId),
                supabase.from('member_areas').select('id, name').eq('owner_id', userId)
            ])

            const productNames = new Map<string, { name: string; type: 'app' | 'marketplace' }>()
            for (const a of (appsResult.data || [])) productNames.set(a.id, { name: a.name, type: 'app' })
            for (const m of (memberAreasResult.data || [])) productNames.set(m.id, { name: m.name, type: 'marketplace' })

            // Fonte principal: sale_locations — 1 linha por venda, com email já disponível
            let query = supabase
                .from('sale_locations')
                .select('id, sale_date, amount, currency, payment_method, customer_email, customer_id, product_id, checkout_id, user_product_access_id')
                .eq('user_id', userId)
                .order('sale_date', { ascending: false })
                .limit(500)

            if (selectedProduct) query = query.eq('product_id', selectedProduct)
            if (fromDateObj) query = query.gte('sale_date', fromDateObj.toISOString())
            if (endOfDay) query = query.lte('sale_date', endOfDay.toISOString())

            const { data: salesData } = await query
            const sales = salesData || []

            // Buscar status de pagamento via user_product_access (para apps)
            const accessIds = sales.map(s => s.user_product_access_id).filter(Boolean)
            let statusMap = new Map<string, string>()
            if (accessIds.length > 0) {
                const { data: accessData } = await supabase
                    .from('user_product_access')
                    .select('id, payment_status')
                    .in('id', accessIds)
                for (const a of (accessData || [])) statusMap.set(a.id, a.payment_status)
            }

            const toStatus = (s: string | null | undefined): 'completed' | 'pending' | 'failed' => {
                if (!s || s === 'completed' || s === 'paid' || s === 'approved') return 'completed'
                if (s === 'pending' || s === 'processing') return 'pending'
                return 'failed'
            }

            const normalizeMethod = (m: string | null): string => {
                if (!m) return 'credit_card'
                const l = m.toLowerCase()
                if (l.includes('pix')) return 'pix'
                if (l.includes('boleto') || l.includes('bank_slip')) return 'boleto'
                if (l.includes('paypal')) return 'paypal'
                if (l.includes('transfer') || l === 'banktransfer') return 'bank_transfer'
                if (l === 'ideal') return 'ideal'
                if (l === 'bancontact') return 'bancontact'
                if (l === 'sofort' || l === 'sofortbanking') return 'sofort'
                if (l === 'giropay') return 'giropay'
                if (l === 'eps') return 'eps'
                if (l === 'przelewy24' || l === 'p24') return 'przelewy24'
                if (l === 'kbc') return 'kbc'
                if (l === 'belfius') return 'belfius'
                if (l === 'applepay') return 'apple_pay'
                if (l === 'mollie') return 'mollie'
                if (l.includes('credit') || l.includes('card') || l === 'creditcard') return 'credit_card'
                return m
            }

            const orders: Order[] = sales.map((sale, idx) => {
                const product = productNames.get(sale.product_id)
                const paymentStatus = statusMap.get(sale.user_product_access_id) || null
                const email = sale.customer_email || ''

                return {
                    id: sale.id,
                    orderNumber: `#${String(idx + 1).padStart(4, '0')}`,
                    date: sale.sale_date,
                    total: parseFloat(sale.amount || 0),
                    currency: sale.currency || 'BRL',
                    customer: {
                        name: email ? email.split('@')[0] : 'Cliente',
                        email: email
                    },
                    paymentMethod: normalizeMethod(sale.payment_method),
                    paymentStatus: toStatus(paymentStatus),
                    productName: product?.name || 'Produto',
                    productId: sale.product_id,
                    productType: product?.type || 'app'
                }
            })

            // Calcular stats
            const stats = {
                all: orders.length,
                paid: orders.filter(o => o.paymentStatus === 'completed').length,
                pending: orders.filter(o => o.paymentStatus === 'pending').length,
                failed: orders.filter(o => o.paymentStatus === 'failed').length
            }

            return { orders, stats }
        }, { ttl: 60 }) // Cache por 60 segundos

        return jsonResponse(result)

    } catch (error: any) {
        console.error('Orders handler error:', error)
        return jsonResponse({ error: error.message || 'Internal error' }, 500)
    }
}
