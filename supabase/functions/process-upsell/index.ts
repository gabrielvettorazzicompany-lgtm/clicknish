import Stripe from 'https://esm.sh/stripe@14.11.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ---- security-middleware (inlined) ----
interface RateLimitConfig {
    maxRequests: number
    windowMs: number
    blockDurationMs?: number
}
interface SecurityContext {
    ip: string
    endpoint: string
    timestamp: number
    blocked?: boolean
}
const requestsCache = new Map<string, SecurityContext[]>()
const blockedIPs = new Map<string, number>()
function getClientIP(request: Request): string {
    return (
        request.headers.get('cf-connecting-ip') ||
        request.headers.get('x-real-ip') ||
        request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
        'unknown'
    )
}
async function rateLimit(
    request: Request,
    config: RateLimitConfig
): Promise<{ allowed: boolean; reason?: string; retryAfter?: number }> {
    const ip = getClientIP(request)
    const endpoint = new URL(request.url).pathname
    const now = Date.now()
    const blockedUntil = blockedIPs.get(ip)
    if (blockedUntil && now < blockedUntil) {
        return { allowed: false, reason: 'IP_BLOCKED', retryAfter: Math.ceil((blockedUntil - now) / 1000) }
    }
    if (blockedUntil && now >= blockedUntil) blockedIPs.delete(ip)
    const key = `${ip}:${endpoint}`
    let requests = (requestsCache.get(key) || []).filter(r => now - r.timestamp < config.windowMs)
    if (requests.length >= config.maxRequests) {
        if (config.blockDurationMs) blockedIPs.set(ip, now + config.blockDurationMs)
        return { allowed: false, reason: 'RATE_LIMIT_EXCEEDED', retryAfter: Math.ceil(config.windowMs / 1000) }
    }
    requests.push({ ip, endpoint, timestamp: now })
    requestsCache.set(key, requests)
    return { allowed: true }
}
function securityErrorResponse(reason: string, statusCode = 429, retryAfter?: number): Response {
    const messages: Record<string, string> = {
        RATE_LIMIT_EXCEEDED: 'Muitas requisições. Tente novamente mais tarde.',
        IP_BLOCKED: 'Seu IP foi temporariamente bloqueado.',
    }
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (retryAfter) headers['Retry-After'] = retryAfter.toString()
    return new Response(JSON.stringify({ error: reason, message: messages[reason] || 'Acesso negado.' }), { status: statusCode, headers })
}
async function securityMiddleware(
    request: Request,
    options: { rateLimit?: RateLimitConfig } = {}
): Promise<{ allowed: boolean; response?: Response }> {
    if (options.rateLimit) {
        const result = await rateLimit(request, options.rateLimit)
        if (!result.allowed) {
            return { allowed: false, response: securityErrorResponse(result.reason!, 429, result.retryAfter) }
        }
    }
    return { allowed: true }
}
// ---- end security-middleware ----

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')!

const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
})

const supabase = createClient(supabaseUrl, supabaseServiceKey)

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    // 🔒 SECURITY: Rate limiting para upsells
    const securityCheck = await securityMiddleware(req, {
        rateLimit: {
            maxRequests: 30,
            windowMs: 60000,
            blockDurationMs: 300000
        }
    })

    if (!securityCheck.allowed) {
        return securityCheck.response!
    }

    try {
        const {
            purchase_id,   // ID from user_product_access
            offer_id,      // checkout_offers.id
        } = await req.json()

        if (!purchase_id || !offer_id) {
            throw new Error('Missing required fields: purchase_id, offer_id')
        }

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
            // Individual product inside an app
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
            // Try as member_area first, then application
            const { data: memberProduct } = await supabase
                .from('marketplace_products')
                .select('id, name, price, currency')
                .eq('id', offer.product_id)
                .maybeSingle()

            if (memberProduct) {
                product = memberProduct
            } else {
                const { data: appProduct } = await supabase
                    .from('applications')
                    .select('id, name')
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

        // 3. Find the original purchase to get stripe customer/payment method
        // Try user_product_access first
        let stripeCustomerId: string | null = null
        let stripePaymentMethodId: string | null = null
        let customerEmail: string | null = null
        let userId: string | null = null

        const { data: productAccess } = await supabase
            .from('user_product_access')
            .select('stripe_customer_id, stripe_payment_method_id, user_id')
            .eq('id', purchase_id)
            .maybeSingle()

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
        customerEmail = stripeCustomer.email

        // 4. Determine the price
        const finalPrice = offer.offer_price || offer.original_price || product.price
        const currency = offer.currency || product.currency || 'brl'

        if (finalPrice <= 0) {
            throw new Error('Invalid price for upsell offer')
        }

        // 5. Create PaymentIntent with off_session (automatic charge)
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
        })

        if (paymentIntent.status !== 'succeeded') {
            throw new Error(`Payment failed with status: ${paymentIntent.status}`)
        }

        // 6. Grant access to the upsell product
        let newAccess: any = null
        let accessError: any = null

        if (isAppProduct && parentApplicationId) {
            // Grant access to specific product inside app
            const { data, error } = await supabase
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
            accessError = error
        } else if (isApplication) {
            // Application access via user_product_access
            const { data, error } = await supabase
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
            accessError = error
        } else {
            // Member area access via user_product_access
            const { data, error } = await supabase
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
            accessError = error
        }

        if (accessError) {
            console.error('Error granting upsell access:', accessError)
            // Payment went through but access failed — log but don't fail the response
        }

        // 7. Record analytics
        try {
            await supabase.from('offer_analytics').insert({
                checkout_offer_id: offer.id,
                user_id: userId,
                event_type: 'accepted',
            })
        } catch (analyticsError) {
            console.warn('Failed to record analytics:', analyticsError)
        }



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

        // Check if it's a Stripe card error (e.g. declined)
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
})
