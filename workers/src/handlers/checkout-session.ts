/**
 * Handler: Checkout Session
 *
 * Pré-carrega e persiste no KV todos os dados necessários para processar
 * o pagamento (produto, preços, offers, produtos do app).
 * Chamado quando o checkout abre — enquanto o usuário preenche o formulário,
 * tudo já está pronto no edge para quando ele clicar em "Pagar".
 *
 * POST /api/checkout-session
 * Body: { checkoutId, productId, productType, applicationId? }
 * Response: { sessionId }  — TTL: 30 minutos
 */

import { createClient } from '../lib/supabase'
import type { Env } from '../index'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export interface CheckoutSessionData {
    sessionId: string
    createdAt: string
    productId: string
    productType: 'app' | 'marketplace'
    applicationId: string | null
    productName: string
    finalPrice: number
    currency: string
    sellerOwnerId: string | null
    checkoutId: string | null
    // Preços dos order bumps (verificados server-side)
    bumpOffers: Array<{
        id: string
        price: number
        offerProductId: string | null
    }>
    // IDs dos produtos do app para liberar acesso
    appProductIds: string[]
    // Módulos selecionados na funnel page do checkout (null = liberar todos)
    selectedModules: string[] | null
}

export async function handleCheckoutSession(
    request: Request,
    env: Env
): Promise<Response> {
    if (request.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    if (request.method !== 'POST') {
        return json({ error: 'Method not allowed' }, 405)
    }

    try {
        const body = await request.json() as {
            checkoutId?: string
            productId?: string
            productType?: string
            applicationId?: string
        }

        const { checkoutId, productId, productType = 'marketplace', applicationId } = body

        if (!productId) {
            return json({ error: 'productId required' }, 400)
        }

        // KV não configurado — retorna null de forma silenciosa.
        // process-payment fará o fallback com as queries ao Supabase.
        if (!env.CACHE) {
            return json({ sessionId: null })
        }

        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

        // ═══════════════════════════════════════════════════════════════════
        // BUSCAR TUDO EM PARALELO — igual ao Promise.all do process-payment,
        // mas acontece quando o checkout ABRE (não quando o usuário paga)
        // ═══════════════════════════════════════════════════════════════════
        const [productResult, checkoutResult, offersResult, productsResult, funnelPageResult] = await Promise.all([
            // 1. Produto / App
            productType === 'app'
                ? supabase.from('applications')
                    .select('id, name, currency, owner_id')
                    .eq('id', applicationId || productId)
                    .single()
                : supabase.from('marketplace_products')
                    .select('id, name, price, currency, owner_id')
                    .eq('id', productId)
                    .single(),

            // 2. Preço customizado do checkout
            checkoutId
                ? supabase.from('checkouts')
                    .select('custom_price')
                    .eq('id', checkoutId)
                    .single()
                : Promise.resolve({ data: null, error: null }),

            // 3. Bump offers deste checkout (preços + produto a liberar)
            checkoutId
                ? supabase.from('checkout_offers')
                    .select('id, offer_price, original_price, offer_product_id')
                    .eq('checkout_id', checkoutId)
                    .eq('is_active', true)
                    .eq('offer_type', 'order_bump')
                : Promise.resolve({ data: [], error: null }),

            // 4. Produtos do app (para liberar acesso na compra)
            productType === 'app'
                ? supabase.from('products')
                    .select('id')
                    .eq('application_id', applicationId || productId)
                : Promise.resolve({ data: [], error: null }),

            // 5. Módulos selecionados na funnel page do checkout
            productType === 'app' && checkoutId
                ? supabase.from('funnel_pages')
                    .select('settings')
                    .eq('checkout_id', checkoutId)
                    .eq('page_type', 'checkout')
                    .maybeSingle()
                : Promise.resolve({ data: null, error: null }),
        ])

        // Se o produto não existir, retorna null — process-payment fará fallback
        if (productResult.error || !productResult.data) {
            console.warn('checkout-session: product not found', productResult.error)
            return json({ sessionId: null })
        }

        const productData = productResult.data as any

        let finalPrice: number
        let productName: string
        let currency: string
        let sellerOwnerId: string | null

        if (productType === 'app') {
            sellerOwnerId = productData.owner_id || null
            finalPrice = (checkoutResult.data as any)?.custom_price || 0
            productName = (productData as any).name
            currency = (productData as any).currency || 'eur'
        } else {
            sellerOwnerId = productData.owner_id || null
            finalPrice = (checkoutResult.data as any)?.custom_price || productData.price || 0
            productName = (productData as any).name
            currency = (productData as any).currency || 'brl'
        }

        const bumpOffers = ((offersResult.data as any[]) || []).map((o: any) => ({
            id: o.id,
            price: o.offer_price ?? o.original_price ?? 0,
            offerProductId: o.offer_product_id || null,
        }))

        const appProductIds = ((productsResult.data as any[]) || []).map((p: any) => p.id)

        // Módulos selecionados na funnel page — null significa liberar todos
        const funnelPageSettings = (funnelPageResult.data as any)?.settings
        const selectedModules: string[] | null = Array.isArray(funnelPageSettings?.selected_modules) && funnelPageSettings.selected_modules.length > 0
            ? funnelPageSettings.selected_modules
            : null

        console.log('checkout-session selected_modules:', { checkoutId, selectedModules: selectedModules?.length ?? 'all' })

        // ═══════════════════════════════════════════════════════════════════
        // PERSISTIR NO KV — TTL 30 minutos (tempo suficiente para preencher)
        // ═══════════════════════════════════════════════════════════════════
        const sessionId = crypto.randomUUID()
        const session: CheckoutSessionData = {
            sessionId,
            createdAt: new Date().toISOString(),
            productId,
            productType: productType as 'app' | 'marketplace',
            applicationId: applicationId || null,
            productName,
            finalPrice,
            currency,
            sellerOwnerId,
            checkoutId: checkoutId || null,
            bumpOffers,
            appProductIds,
            selectedModules,
        }

        await env.CACHE.put(`session:${sessionId}`, JSON.stringify(session), {
            expirationTtl: 1800, // 30 minutos
        })

        console.log('checkout-session created:', { sessionId, productId, productType, bumpOffers: bumpOffers.length, appProductIds: appProductIds.length })

        return json({ sessionId })

    } catch (error: any) {
        // Nunca lança erro — process-payment faz fallback
        console.error('checkout-session error:', error)
        return json({ sessionId: null })
    }
}

function json(data: any, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
}
