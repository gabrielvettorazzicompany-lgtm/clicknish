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
                .select('id, name')
                .eq('owner_id', userId)
            const memberAreaIds = userMemberAreas?.map(m => m.id) || []
            const memberAreaNames = new Map(userMemberAreas?.map(m => [m.id, m.name]) || [])

            // Helper para resultado vazio
            const emptyResult = () => Promise.resolve({ data: [], error: null })

            // Queries em paralelo
            let mktQuery: any = emptyResult()
            if (memberAreaIds.length > 0) {
                let query = supabase
                    .from('user_product_access')
                    .select('id, created_at, purchase_price, payment_method, payment_status, payment_id, user_id, member_area_id')
                    .in('member_area_id', memberAreaIds)
                    .neq('access_type', 'manual')
                    .order('created_at', { ascending: false })
                    .limit(500)

                if (fromDateObj) query = query.gte('created_at', fromDateObj.toISOString())
                if (endOfDay) query = query.lte('created_at', endOfDay.toISOString())
                mktQuery = query
            }

            let appQuery: any = emptyResult()
            if (appIds.length > 0) {
                let query = supabase
                    .from('user_product_access')
                    .select('id, created_at, purchase_price, payment_method, payment_status, payment_id, user_id, application_id, product_id')
                    .in('application_id', appIds)
                    .neq('access_type', 'manual')
                    .order('created_at', { ascending: false })
                    .limit(500)

                if (fromDateObj) query = query.gte('created_at', fromDateObj.toISOString())
                if (endOfDay) query = query.lte('created_at', endOfDay.toISOString())
                appQuery = query
            }

            // Buscar emails via sale_locations
            const saleLocQuery = supabase
                .from('sale_locations')
                .select('customer_email, checkout_id, customer_id, payment_id')
                .eq('user_id', userId)

            const [mktResult, appResult, saleLocResult] = await Promise.all([
                mktQuery, appQuery, saleLocQuery
            ])

            // Coletar user_ids para buscar nomes
            const allUserIds = new Set<string>()
            for (const sale of [...(mktResult.data || []), ...(appResult.data || [])]) {
                if (sale.user_id) allUserIds.add(sale.user_id)
            }

            // Buscar nomes em paralelo
            const userIdList = Array.from(allUserIds)
            const [appUsersResult, memberProfilesResult] = userIdList.length > 0
                ? await Promise.all([
                    supabase.from('app_users').select('user_id, full_name, email').in('user_id', userIdList),
                    supabase.from('member_profiles').select('id, name, email').in('id', userIdList)
                ])
                : [{ data: [] }, { data: [] }]

            // Mapa user_id → nome
            const nameByUserId = new Map<string, string>()
            for (const u of (appUsersResult.data || [])) {
                if (u.user_id && (u.full_name || u.email)) {
                    nameByUserId.set(u.user_id, u.full_name || u.email.split('@')[0])
                }
            }
            for (const m of (memberProfilesResult.data || [])) {
                if (m.id && (m.name || m.email)) {
                    if (!nameByUserId.has(m.id)) {
                        nameByUserId.set(m.id, m.name || m.email.split('@')[0])
                    }
                }
            }

            // Mapa para emails
            const emailByKey = new Map<string, string>()
            for (const sl of (saleLocResult.data || [])) {
                if (sl.customer_email) {
                    if (sl.checkout_id) emailByKey.set(sl.checkout_id, sl.customer_email)
                    if (sl.customer_id) emailByKey.set(sl.customer_id, sl.customer_email)
                    if (sl.payment_id) emailByKey.set(sl.payment_id, sl.customer_email)
                }
            }

            // Combinar resultados
            const seenIds = new Set<string>()
            const rawAll: any[] = []

            for (const sale of (mktResult.data || [])) {
                if (!seenIds.has(sale.id)) {
                    seenIds.add(sale.id)
                    rawAll.push({
                        ...sale,
                        productName: memberAreaNames.get(sale.member_area_id) || 'Produto',
                        productId: sale.member_area_id,
                        source: 'marketplace'
                    })
                }
            }

            for (const sale of (appResult.data || [])) {
                if (!seenIds.has(sale.id)) {
                    seenIds.add(sale.id)
                    rawAll.push({
                        ...sale,
                        productName: appNames.get(sale.application_id) || 'App',
                        productId: sale.application_id,
                        source: 'app'
                    })
                }
            }

            // Mapear para Order
            const toStatus = (s: string): 'completed' | 'pending' | 'failed' => {
                if (s === 'completed' || s === 'paid' || s === 'approved') return 'completed'
                if (s === 'pending' || s === 'processing') return 'pending'
                return 'failed'
            }

            const normalizeMethod = (m: string | null): string => {
                if (!m) return 'credit_card'
                const l = m.toLowerCase()
                if (l.includes('pix')) return 'pix'
                if (l.includes('boleto') || l.includes('bank_slip')) return 'boleto'
                if (l.includes('paypal')) return 'paypal'
                if (l.includes('transfer')) return 'bank_transfer'
                return 'credit_card'
            }

            const orders: Order[] = rawAll.map((sale, idx) => {
                const email = emailByKey.get(sale.payment_id) ||
                    emailByKey.get(sale.id) ||
                    emailByKey.get(sale.user_id) ||
                    ''

                return {
                    id: sale.id,
                    orderNumber: `#${String(idx + 1).padStart(4, '0')}`,
                    date: sale.created_at,
                    total: sale.purchase_price || 0,
                    customer: {
                        name: nameByUserId.get(sale.user_id) || (email ? email.split('@')[0] : 'Cliente'),
                        email: email
                    },
                    paymentMethod: normalizeMethod(sale.payment_method),
                    paymentStatus: toStatus(sale.payment_status || 'completed'),
                    productName: sale.productName,
                    productId: sale.productId,
                    productType: sale.source
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
