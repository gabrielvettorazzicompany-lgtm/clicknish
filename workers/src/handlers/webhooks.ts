import { createClient } from '../lib/supabase'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hotmart-hottok, x-user-id',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
}

export async function handleWebhooks(request: Request, env: any, pathSegments: string[]): Promise<Response> {
    if (request.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

        // POST /api/webhooks/:platform
        if (request.method === 'POST' && pathSegments.length >= 1) {
            const platform = pathSegments[0].toLowerCase()
            const body = await request.json()

            let result

            switch (platform) {
                case 'hotmart':
                    result = await processHotmartWebhook(supabase, body)
                    break

                case 'cartpanda':
                case 'yampi':
                    result = await processGenericWebhook(platform, body)
                    break

                default:
                    return new Response(JSON.stringify({
                        error: 'Platform not supported',
                        supportedPlatforms: ['hotmart', 'cartpanda', 'yampi']
                    }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
            }

            return new Response(JSON.stringify(result), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        return new Response(JSON.stringify({ error: 'Not Found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error: any) {
        console.error('Webhook error:', error)
        return new Response(JSON.stringify({
            error: error.message,
            timestamp: new Date().toISOString()
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
}

async function processHotmartWebhook(supabase: any, data: any) {
    try {
        const event = data.event
        const purchase = data.data?.purchase || data.data?.subscription || {}

        const buyerEmail = purchase.buyer?.email || data.data?.buyer?.email
        const buyerName = purchase.buyer?.name || data.data?.buyer?.name
        const productName = purchase.product?.name || data.data?.product?.name
        const productId = purchase.product?.id || data.data?.product?.id
        const transactionId = purchase.transaction || data.id
        const status = purchase.status?.toLowerCase() || 'approved'

        if (!buyerEmail) {
            return { error: 'Email not found' }
        }

        const approvedEvents = ['PURCHASE_APPROVED', 'PURCHASE_COMPLETE', 'SUBSCRIPTION_PAYMENT_APPROVED']

        if (approvedEvents.includes(event)) {
            const { data: apps } = await supabase
                .from('applications')
                .select('id')
                .limit(1)

            if (!apps || apps.length === 0) {
                return { error: 'No application found' }
            }

            const applicationId = apps[0].id

            const { data: existingUser } = await supabase
                .from('app_users')
                .select('*')
                .eq('application_id', applicationId)
                .eq('email', buyerEmail)
                .single()

            if (existingUser) {
                return { success: true, message: 'User already exists', user_id: existingUser.id }
            }

            const { data: newUser, error: userError } = await supabase
                .from('app_users')
                .insert({
                    application_id: applicationId,
                    email: buyerEmail,
                    full_name: buyerName || null,
                    user_id: `user_${Date.now()}_${buyerEmail.split('@')[0]}`
                })
                .select()
                .single()

            if (userError) {
                throw userError
            }

            await supabase
                .from('transactions')
                .insert({
                    application_id: applicationId,
                    user_id: newUser.id,
                    platform: 'hotmart',
                    transaction_id: transactionId,
                    product_name: productName,
                    product_id: productId,
                    buyer_email: buyerEmail,
                    buyer_name: buyerName,
                    status: status,
                    webhook_data: data
                })

            return {
                success: true,
                message: 'User created and access granted',
                user_id: newUser.id,
                email: buyerEmail
            }
        }

        const cancelEvents = ['PURCHASE_CANCELED', 'PURCHASE_REFUNDED', 'SUBSCRIPTION_CANCELED']

        if (cancelEvents.includes(event)) {
            return { success: true, message: 'Cancellation processed' }
        }

        return { success: true, message: 'Event not processed but received' }

    } catch (error) {
        console.error('Error processing Hotmart webhook:', error)
        throw error
    }
}

async function processGenericWebhook(platform: string, data: any) {
    return {
        success: true,
        message: `${platform} webhook received`,
        data: data
    }
}

// ═══════════════════════════════════════════════════════════
// STRIPE WEBHOOK
// ═══════════════════════════════════════════════════════════

export async function handleStripeWebhook(
    request: Request,
    env: any
): Promise<Response> {
    if (request.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405, headers: corsHeaders })
    }

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

    const rawBody = await request.text()
    const signature = request.headers.get('stripe-signature') || ''
    const webhookSecret = env.STRIPE_WEBHOOK_SECRET

    // Verificar assinatura se secret configurado
    if (webhookSecret) {
        const valid = await verifyStripeSignature(rawBody, signature, webhookSecret)
        if (!valid) {
            console.warn('❌ Stripe webhook: invalid signature')
            return new Response(JSON.stringify({ error: 'Invalid signature' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }
    }

    let event: any
    try {
        event = JSON.parse(rawBody)
    } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

    console.log(`Stripe webhook received: ${event.type}`)

    try {
        if (event.type === 'charge.refunded') {
            const charge = event.data.object
            const paymentIntentId = charge.payment_intent
            const amountRefunded = charge.amount_refunded // em centavos
            const currency = charge.currency || 'usd'
            const customerEmail = charge.billing_details?.email || charge.receipt_email || null
            const customerName = charge.billing_details?.name || null
            const customerPhone = charge.billing_details?.phone || null

            if (!paymentIntentId) {
                return new Response(JSON.stringify({ ok: true, skipped: 'no payment_intent' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            // Buscar acesso por payment_id para identificar produto e vendedor
            let sellerOwnerId: string | null = null
            let productId: string | null = null

            // Tentar em user_product_access (apps)
            const { data: appAccess } = await supabase
                .from('user_product_access')
                .select('product_id, application_id')
                .eq('payment_id', paymentIntentId)
                .limit(1)
                .maybeSingle()

            if (appAccess?.application_id) {
                productId = appAccess.product_id || appAccess.application_id
                const { data: app } = await supabase
                    .from('applications')
                    .select('owner_id')
                    .eq('id', appAccess.application_id)
                    .single()
                sellerOwnerId = app?.owner_id || null
            }

            // Tentar em user_member_area_access (marketplace)
            if (!sellerOwnerId) {
                const { data: maAccess } = await supabase
                    .from('user_member_area_access')
                    .select('member_area_id')
                    .eq('payment_id', paymentIntentId)
                    .limit(1)
                    .maybeSingle()

                if (maAccess?.member_area_id) {
                    productId = maAccess.member_area_id
                    const { data: area } = await supabase
                        .from('member_areas')
                        .select('owner_id')
                        .eq('id', maAccess.member_area_id)
                        .single()
                    sellerOwnerId = area?.owner_id || null
                }
            }

            if (!sellerOwnerId || !productId) {
                console.warn(`⚠️ Stripe refund: seller/product not found for PI ${paymentIntentId}`)
                return new Response(JSON.stringify({ ok: true, skipped: 'sale not found' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            // Buscar integrações UTMify do vendedor com evento 'refunded'
            const { data: allIntegrations } = await supabase
                .from('utmify_integrations')
                .select('*')
                .eq('user_id', sellerOwnerId)
                .eq('is_active', true)

            if (!allIntegrations || allIntegrations.length === 0) {
                return new Response(JSON.stringify({ ok: true, skipped: 'no integrations' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            const matchingIntegrations = allIntegrations.filter((integration: any) => {
                const events: string[] = integration.events || []
                if (!events.includes('refunded')) return false
                const products: { id: string }[] = integration.products || []
                if (products.length === 0) return true
                return products.some((p: any) => p.id === productId)
            })

            if (matchingIntegrations.length === 0) {
                return new Response(JSON.stringify({ ok: true, skipped: 'no matching integrations' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            const now = new Date().toISOString().replace('T', ' ').substring(0, 19)
            const gatewayFee = Math.round(amountRefunded * 0.029) + 30
            const userCommission = Math.max(0, amountRefunded - gatewayFee)

            const utmifyBody = {
                orderId: paymentIntentId,
                platform: 'Clicknich',
                paymentMethod: 'credit_card',
                status: 'refunded',
                createdAt: now,
                approvedDate: now,
                refundedAt: now,
                customer: {
                    name: customerName,
                    email: customerEmail,
                    phone: customerPhone,
                    document: null,
                },
                products: [{
                    id: productId,
                    name: null,
                    planId: null,
                    planName: null,
                    quantity: 1,
                    priceInCents: amountRefunded,
                }],
                trackingParameters: null,
                commission: {
                    totalPriceInCents: amountRefunded,
                    gatewayFeeInCents: gatewayFee,
                    userCommissionInCents: userCommission,
                    currency: currency.toUpperCase(),
                },
                isTest: false,
            }

            await Promise.all(matchingIntegrations.map(async (integration: any) => {
                try {
                    const res = await fetch('https://api.utmify.com.br/api-credentials/orders', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-api-token': integration.api_token,
                        },
                        body: JSON.stringify(utmifyBody),
                    })
                    if (!res.ok) {
                        const err = await res.text().catch(() => '')
                        console.warn(`❌ UTMify refunded error [${integration.name}]:`, err)
                    } else {
                        console.log(`✅ UTMify refunded fired [${integration.name}]`)
                    }
                } catch (e: any) {
                    console.warn(`UTMify refunded failed [${integration.name}]:`, e.message)
                }
            }))

            return new Response(JSON.stringify({ ok: true, fired: matchingIntegrations.length }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Outros eventos ignorados silenciosamente
        return new Response(JSON.stringify({ ok: true, skipped: `unhandled event: ${event.type}` }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error: any) {
        console.error('❌ Stripe webhook error:', error.message)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
}

/**
 * Verifica assinatura HMAC-SHA256 do Stripe usando Web Crypto API
 */
async function verifyStripeSignature(
    payload: string,
    signature: string,
    secret: string
): Promise<boolean> {
    try {
        const parts = Object.fromEntries(signature.split(',').map(p => p.split('=') as [string, string]))
        const timestamp = parts['t']
        const v1 = parts['v1']
        if (!timestamp || !v1) return false

        const signedPayload = `${timestamp}.${payload}`
        const encoder = new TextEncoder()
        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(secret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        )
        const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload))
        const expectedHex = Array.from(new Uint8Array(signatureBytes))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')

        return expectedHex === v1
    } catch {
        return false
    }
}
