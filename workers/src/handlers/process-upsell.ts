/**
 * Handler: Process Upsell
 * Processa upsells/downsells com 1-click (usa cartão salvo)
 */

import { createClient } from '../lib/supabase'
import { createStripeClient } from '../lib/stripe'
import type { Env } from '../index'

/**
 * Resolve a chave Stripe correta para o vendedor:
 * 1. Verifica se o vendedor tem provedor individual (override)
 * 2. Senão, usa o provedor padrão global da plataforma
 */
async function resolveStripeKey(supabase: any, ownerId: string | null): Promise<string> {
    // 1. Provedor individual do vendedor
    if (ownerId) {
        const { data: userConfig } = await supabase
            .from('user_payment_config')
            .select('provider_id, override_platform_default')
            .eq('user_id', ownerId)
            .eq('override_platform_default', true)
            .maybeSingle()

        if (userConfig?.provider_id) {
            const { data: provider } = await supabase
                .from('payment_providers')
                .select('credentials, type')
                .eq('id', userConfig.provider_id)
                .eq('is_active', true)
                .maybeSingle()
            const key = provider?.credentials?.secret_key || provider?.credentials?.api_key
            if (key) {
                console.log(`[resolveStripeKey] Using individual provider ${userConfig.provider_id} for owner ${ownerId}`)
                return key
            }
        }
    }

    // 2. Provedor padrão global
    const { data: globalProvider } = await supabase
        .from('payment_providers')
        .select('credentials, type')
        .eq('is_global_default', true)
        .eq('is_active', true)
        .maybeSingle()
    const globalKey = globalProvider?.credentials?.secret_key || globalProvider?.credentials?.api_key
    if (globalKey) {
        console.log(`[resolveStripeKey] Using global default provider for owner ${ownerId}`)
        return globalKey
    }

    throw new Error('Nenhum provedor de pagamento configurado. Cadastre um provedor no painel de administração.')
}

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export async function handleProcessUpsell(
    request: Request,
    env: Env,
    ctx: ExecutionContext
): Promise<Response> {
    try {
        const {
            purchase_id,   // UUID from payment response (not user_product_access.id)
            token,         // thankyou_token — salvo em user_product_access
            offer_id,      // checkout_offers.id
        } = await request.json()

        if ((!purchase_id && !token) || !offer_id) {
            throw new Error('Missing required fields: purchase_id or token, offer_id')
        }

        // Inicializar clientes
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
        // stripe é atribuído após resolução do provedor do vendedor
        let stripe: ReturnType<typeof createStripeClient>

        // 1. Fetch the offer details
        const { data: offer, error: offerError } = await supabase
            .from('checkout_offers')
            .select('id, product_id, product_type, application_id, offer_price, original_price, title, one_click_purchase, offer_type, currency')
            .eq('id', offer_id)
            .eq('is_active', true)
            .single()

        if (offerError || !offer) {
            throw new Error('Offer not found or inactive')
        }

        if (!offer.one_click_purchase) {
            throw new Error('This offer does not support one-click purchase')
        }

        // 2. Fetch the offer product details
        let product: any = null
        let isApplication = false
        let isAppProduct = false
        let parentApplicationId: string | null = null

        if (offer.product_type === 'app_product') {
            const { data: appProduct } = await supabase
                .from('products')
                .select('id, name, application_id')
                .eq('id', offer.product_id)
                .maybeSingle()

            if (appProduct) {
                product = { ...appProduct, price: 0, currency: 'USD' }
                isAppProduct = true
                parentApplicationId = appProduct.application_id
            }
        } else {
            const { data: memberProduct } = await supabase
                .from('marketplace_products')
                .select('id, name, price, currency, owner_id')
                .eq('id', offer.product_id)
                .maybeSingle()

            if (memberProduct) {
                product = memberProduct
            } else {
                const { data: appProduct } = await supabase
                    .from('applications')
                    .select('id, name, owner_id')
                    .eq('id', offer.product_id)
                    .maybeSingle()

                if (appProduct) {
                    product = { ...appProduct, price: 0, currency: 'USD' }
                    isApplication = true
                }
            }
        }

        if (!product) {
            throw new Error('Product not found')
        }

        // Resolver Stripe correto para o vendedor deste produto
        const productOwnerId = product.owner_id ||
            (parentApplicationId
                ? (await supabase.from('applications').select('owner_id').eq('id', parentApplicationId).maybeSingle()).data?.owner_id
                : null)
        stripe = createStripeClient(await resolveStripeKey(supabase, productOwnerId || null))

        // 3. Find the original purchase to get stripe customer/payment method
        // Busca por thankyou_token (confiável — salvo no upsert) ou fallback por id
        let stripeCustomerId: string | null = null
        let stripePaymentMethodId: string | null = null
        let userId: string | null = null

        // Tenta até 4x com delay crescente — o DB write ocorre via ctx.waitUntil
        // no process-payment e pode ainda não ter finalizado quando o usuário clica no upsell
        let productAccess: any = null
        for (let attempt = 0; attempt < 4; attempt++) {
            if (attempt > 0) await new Promise(r => setTimeout(r, attempt * 1500))

            let q = supabase
                .from('user_product_access')
                .select('stripe_customer_id, stripe_payment_method_id, user_id')

            if (token) {
                q = q.eq('thankyou_token', token)
            } else {
                q = q.eq('id', purchase_id)
            }

            const { data } = await q.maybeSingle()
            if (data?.stripe_customer_id) { productAccess = data; break }
        }

        if (productAccess?.stripe_customer_id) {
            stripeCustomerId = productAccess.stripe_customer_id
            stripePaymentMethodId = productAccess.stripe_payment_method_id
            userId = productAccess.user_id
        }

        if (!stripeCustomerId || !stripePaymentMethodId || !userId) {
            throw new Error('Payment method not found for this purchase. Cannot process one-click upsell.')
        }

        // Get customer email from Stripe
        const stripeCustomer = await stripe.customers.retrieve(stripeCustomerId)
        if (stripeCustomer.deleted) {
            throw new Error('Stripe customer was deleted')
        }

        // 4. Determine the price
        const finalPrice = offer.offer_price || offer.original_price || product.price
        const currency = offer.currency || product.currency || 'brl'

        if (finalPrice <= 0) {
            throw new Error('Invalid price for upsell offer')
        }

        // 5. Create PaymentIntent with off_session (automatic charge)
        // Idempotency key previne cobrança dupla se a request for retentada
        const idempotencyKey = `upsell_${purchase_id}_${offer_id}`
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(finalPrice * 100),
            currency: currency,
            customer: stripeCustomerId,
            payment_method: stripePaymentMethodId,
            confirm: true,
            off_session: true,
            automatic_payment_methods: {
                enabled: true,
                allow_redirects: 'never',
            },
            metadata: {
                product_id: product.id,
                product_name: product.name,
                offer_id: offer.id,
                offer_type: offer.offer_type,
                original_purchase_id: purchase_id,
                is_upsell: 'true',
            },
            description: `${offer.offer_type === 'upsell' ? 'Upsell' : 'Downsell'}: ${product.name}`,
        }, { idempotencyKey })

        if (paymentIntent.status !== 'succeeded') {
            throw new Error(`Payment failed with status: ${paymentIntent.status}`)
        }

        // 6. Grant access to the upsell product
        let newAccess: any = null

        if (isAppProduct && parentApplicationId) {
            const { data } = await supabase
                .from('user_product_access')
                .upsert({
                    user_id: userId,
                    product_id: product.id,
                    application_id: parentApplicationId,
                    access_type: 'purchase',
                    is_active: true,
                    stripe_customer_id: stripeCustomerId,
                    stripe_payment_method_id: stripePaymentMethodId,
                    created_at: new Date().toISOString(),
                }, {
                    onConflict: 'user_id,product_id',
                    ignoreDuplicates: false,
                })
                .select('id')
                .single()
            newAccess = data
        } else if (isApplication) {
            const { data } = await supabase
                .from('user_product_access')
                .upsert({
                    user_id: userId,
                    application_id: product.id,
                    access_type: 'purchase',
                    is_active: true,
                    stripe_customer_id: stripeCustomerId,
                    stripe_payment_method_id: stripePaymentMethodId,
                    created_at: new Date().toISOString(),
                }, {
                    onConflict: 'user_id,application_id',
                    ignoreDuplicates: false,
                })
                .select('id')
                .single()
            newAccess = data
        } else {
            const { data } = await supabase
                .from('user_product_access')
                .upsert({
                    user_id: userId,
                    member_area_id: product.id,
                    access_type: 'purchase',
                    is_active: true,
                    payment_id: paymentIntent.id,
                    payment_method: 'card',
                    payment_status: 'completed',
                    purchase_price: finalPrice,
                    stripe_customer_id: stripeCustomerId,
                    stripe_payment_method_id: stripePaymentMethodId,
                    created_at: new Date().toISOString(),
                }, {
                    onConflict: 'user_id,member_area_id',
                    ignoreDuplicates: false,
                })
                .select('id')
                .single()
            newAccess = data
        }

        // 7. Record analytics em background
        ctx.waitUntil(
            supabase.from('offer_analytics').insert({
                checkout_offer_id: offer.id,
                user_id: userId,
                event_type: 'accepted',
            })
        )

        return new Response(
            JSON.stringify({
                success: true,
                paymentIntentId: paymentIntent.id,
                status: paymentIntent.status,
                message: 'Upsell payment processed successfully',
                purchaseId: newAccess?.id || purchase_id,
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )

    } catch (error: any) {
        console.error('Upsell payment error:', error)

        const isCardError = error?.type === 'StripeCardError'

        return new Response(
            JSON.stringify({
                success: false,
                error: isCardError
                    ? 'Your card was declined. Please try another payment method.'
                    : (error.message || 'Upsell payment processing failed'),
                requiresNewPayment: isCardError,
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        )
    }
}
