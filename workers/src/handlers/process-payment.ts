/**
 * Handler: Process Payment
 * Processa pagamentos de checkout (apps e marketplace)
 */

import { createClient } from '../lib/supabase'
import { createStripeClient } from '../lib/stripe'
import type { Env } from '../index'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export async function handleProcessPayment(
    request: Request,
    env: Env,
    ctx: ExecutionContext
): Promise<Response> {
    try {
        const {
            productId,
            productType = 'marketplace', // 'app' or 'marketplace'
            applicationId,
            checkoutId,
            customerEmail,
            customerName,
            customerPhone,
            paymentMethodId,
            trackingParameters,
        } = await request.json()

        console.log('Process payment request:', { productId, productType, applicationId, checkoutId, customerEmail, paymentMethodId: paymentMethodId ? 'present' : 'missing' })

        // Inicializar clientes
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
        const stripe = createStripeClient(env.STRIPE_SECRET_KEY)

        // ═══════════════════════════════════════════════════════════════════
        // BUSCAR DADOS EM PARALELO
        // ═══════════════════════════════════════════════════════════════════

        const [productResult, checkoutResult, stripeCustomersResult] = await Promise.all([
            // 1. Buscar produto
            productType === 'app'
                ? supabase.from('applications').select('*').eq('id', applicationId || productId).single()
                : supabase.from('marketplace_products').select('*').eq('id', productId).single(),

            // 2. Buscar checkout
            checkoutId
                ? supabase.from('checkouts').select('custom_price').eq('id', checkoutId).single()
                : Promise.resolve({ data: null, error: null }),

            // 3. Buscar Stripe customer
            stripe.customers.list({ email: customerEmail, limit: 1 })
        ])

        // Processar resultado do produto
        const productData = productResult.data
        if (productResult.error || !productData) {
            throw new Error(productType === 'app' ? 'App not found' : 'Marketplace product not found')
        }

        // Extrair dados do produto
        let finalPrice: number
        let productName: string
        let currency: string
        let sellerOwnerId: string | null = null

        if (productType === 'app') {
            sellerOwnerId = productData.user_id || null
            finalPrice = checkoutResult.data?.custom_price || 0
            productName = productData.name
            currency = 'usd'
        } else {
            sellerOwnerId = productData.owner_id || null
            finalPrice = checkoutResult.data?.custom_price || productData.price
            productName = productData.name
            currency = productData.currency || 'brl'
        }

        // Processar Stripe customer
        let stripeCustomer
        if (stripeCustomersResult?.data?.length > 0) {
            stripeCustomer = stripeCustomersResult.data[0]
        } else {
            stripeCustomer = await stripe.customers.create({
                email: customerEmail,
                name: customerName,
                phone: customerPhone,
                metadata: {
                    product_id: productId,
                    product_type: productType,
                    application_id: applicationId || '',
                    checkout_id: checkoutId || '',
                },
            })
        }

        // ═══════════════════════════════════════════════════════════════════
        // CRIAR PAYMENT INTENT
        // ═══════════════════════════════════════════════════════════════════

        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(finalPrice * 100),
            currency: currency,
            customer: stripeCustomer.id,
            payment_method: paymentMethodId,
            confirm: true,
            automatic_payment_methods: {
                enabled: true,
                allow_redirects: 'never',
            },
            metadata: {
                product_id: productId,
                product_type: productType,
                product_name: productName,
                application_id: applicationId || '',
                checkout_id: checkoutId || '',
                customer_email: customerEmail,
            },
            description: `Purchase: ${productName}`,
        })

        // Capturar IP e geolocalização (Cloudflare headers)
        const clientIP = request.headers.get('cf-connecting-ip') || 'unknown'
        const geoData = {
            country: request.headers.get('cf-ipcountry') || null,
            region: request.headers.get('cf-region') || null,
            city: request.headers.get('cf-ipcity') || null,
            timezone: request.headers.get('cf-timezone') || null
        }

        // Attach PaymentMethod em background
        ctx.waitUntil(
            stripe.paymentMethods.attach(paymentMethodId, { customer: stripeCustomer.id })
                .catch((err: any) => {
                    if (err?.code !== 'resource_already_exists') {
                        console.warn('Could not attach payment method:', err.message)
                    }
                })
        )

        // ═══════════════════════════════════════════════════════════════════
        // PROCESSAR ACESSO
        // ═══════════════════════════════════════════════════════════════════

        let userId: string = ''
        let purchaseId: string | null = null
        let thankyouToken: string | null = null

        if (productType === 'app') {
            // FLUXO PARA APPS
            const [appUserResult, orderBumpsResult, appProductsResult] = await Promise.all([
                supabase.from('app_users')
                    .select('user_id')
                    .eq('email', customerEmail)
                    .eq('application_id', applicationId)
                    .maybeSingle(),

                checkoutId
                    ? supabase.from('checkout_offers')
                        .select('offer_product_id')
                        .eq('checkout_id', checkoutId)
                        .eq('offer_type', 'order_bump')
                        .eq('is_active', true)
                    : Promise.resolve({ data: null, error: null }),

                supabase.from('products')
                    .select('id')
                    .eq('application_id', applicationId)
            ])

            const existingAppUser = appUserResult.data
            const orderBumps = orderBumpsResult.data
            const appProducts = appProductsResult.data

            // Processar order bumps
            let orderBumpProductIds: string[] = []
            if (orderBumps && Array.isArray(orderBumps) && orderBumps.length > 0) {
                orderBumpProductIds = orderBumps.map((o: any) => o.offer_product_id).filter(Boolean)
            }

            // Processar usuário
            if (existingAppUser) {
                userId = existingAppUser.user_id
            } else {
                const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                    email: customerEmail,
                    email_confirm: true,
                    user_metadata: {
                        created_via: 'purchase',
                        name: customerName,
                        phone: customerPhone,
                    },
                })

                if (authError) throw authError
                userId = authData.user.id

                await supabase.from('app_users').upsert({
                    user_id: userId,
                    email: customerEmail,
                    full_name: customerName,
                    phone: customerPhone,
                    application_id: applicationId,
                    status: 'active',
                    created_at: new Date().toISOString(),
                }, {
                    onConflict: 'user_id,application_id',
                    ignoreDuplicates: false
                })
            }

            // Liberar acesso aos produtos
            if (appProducts && Array.isArray(appProducts) && appProducts.length > 0) {
                const productsToGrant = orderBumpProductIds.length > 0
                    ? appProducts.filter((p: any) => !orderBumpProductIds.includes(p.id))
                    : appProducts

                const accessRecords = productsToGrant.map((product: any) => ({
                    user_id: userId,
                    product_id: product.id,
                    application_id: applicationId,
                    access_type: 'purchase',
                    is_active: true,
                    payment_id: paymentIntent.id,
                    payment_method: 'card',
                    payment_status: 'completed',
                    purchase_price: finalPrice,
                    stripe_customer_id: stripeCustomer.id,
                    stripe_payment_method_id: paymentMethodId,
                    created_at: new Date().toISOString(),
                }))

                const { data: batchAccess } = await supabase
                    .from('user_product_access')
                    .upsert(accessRecords, {
                        onConflict: 'user_id,product_id',
                        ignoreDuplicates: false
                    })
                    .select('id')

                if (batchAccess && Array.isArray(batchAccess) && batchAccess.length > 0) {
                    const firstProductAccessId = batchAccess[0].id
                    thankyouToken = crypto.randomUUID()
                    purchaseId = firstProductAccessId

                    // Salvar sale_location e token em background
                    ctx.waitUntil(Promise.all([
                        supabase.from('sale_locations').insert({
                            user_id: sellerOwnerId,
                            customer_email: customerEmail,
                            amount: finalPrice,
                            currency: currency,
                            payment_method: 'card',
                            customer_ip: clientIP,
                            checkout_id: checkoutId || null,
                            product_id: productId || null,
                            user_product_access_id: firstProductAccessId,
                            sale_date: new Date().toISOString(),
                            country: geoData.country,
                            region: geoData.region,
                            city: geoData.city,
                        }),
                        supabase.from('user_product_access').update({
                            thankyou_token: thankyouToken,
                            thankyou_token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                            thankyou_max_views: 5
                        }).eq('id', firstProductAccessId)
                    ]))
                }
            }

        } else {
            // FLUXO PARA MARKETPLACE
            const { data: existingMember } = await supabase
                .from('member_profiles')
                .select('id')
                .eq('email', customerEmail)
                .eq('product_id', productId)
                .maybeSingle()

            if (existingMember) {
                userId = existingMember.id
            } else {
                const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                    email: customerEmail,
                    email_confirm: true,
                    user_metadata: {
                        created_via: 'purchase',
                        name: customerName,
                        phone: customerPhone,
                    },
                })

                if (authError) throw authError
                userId = authData.user.id
            }

            // Criar member profile
            await supabase.from('member_profiles').upsert({
                email: customerEmail,
                name: customerName,
                phone: customerPhone,
                product_id: productId,
                created_at: new Date().toISOString(),
            }, {
                onConflict: 'email,product_id',
                ignoreDuplicates: false
            })

            // Liberar acesso
            const { data: marketplaceAccess } = await supabase
                .from('user_product_access')
                .upsert({
                    user_id: userId,
                    member_area_id: productId,
                    access_type: 'purchase',
                    is_active: true,
                    payment_id: paymentIntent.id,
                    payment_method: 'card',
                    payment_status: 'completed',
                    purchase_price: finalPrice,
                    stripe_customer_id: stripeCustomer.id,
                    stripe_payment_method_id: paymentMethodId,
                    created_at: new Date().toISOString(),
                }, {
                    onConflict: 'user_id,member_area_id',
                    ignoreDuplicates: false
                })
                .select('id')
                .single()

            if (marketplaceAccess) {
                thankyouToken = crypto.randomUUID()
                purchaseId = marketplaceAccess.id

                // Salvar em background
                ctx.waitUntil(Promise.all([
                    supabase.from('sale_locations').insert({
                        user_id: sellerOwnerId,
                        customer_email: customerEmail,
                        amount: finalPrice,
                        currency: currency,
                        payment_method: 'card',
                        customer_ip: clientIP,
                        checkout_id: checkoutId || null,
                        product_id: productId || null,
                        user_product_access_id: marketplaceAccess.id,
                        sale_date: new Date().toISOString(),
                        country: geoData.country,
                        region: geoData.region,
                        city: geoData.city,
                    }),
                    supabase.from('user_product_access').update({
                        thankyou_token: thankyouToken,
                        thankyou_token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                        thankyou_max_views: 5
                    }).eq('id', marketplaceAccess.id)
                ]))
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // DETERMINAR REDIRECT URL (upsell ou login)
        // ═══════════════════════════════════════════════════════════════════

        let redirectUrl: string | null = null

        if (checkoutId) {
            // Buscar primeiro upsell/downsell ativo
            const { data: upsellOffer } = await supabase
                .from('checkout_offers')
                .select('id, page_id, offer_type')
                .eq('checkout_id', checkoutId)
                .eq('is_active', true)
                .in('offer_type', ['upsell', 'downsell'])
                .order('offer_position', { ascending: true })
                .limit(1)
                .maybeSingle()

            if (upsellOffer?.page_id) {
                // Buscar external_url da página de upsell
                const { data: funnelPage } = await supabase
                    .from('funnel_pages')
                    .select('external_url')
                    .eq('id', upsellOffer.page_id)
                    .maybeSingle()

                if (funnelPage?.external_url) {
                    // Adicionar purchaseId e token na URL de upsell
                    const upsellUrl = funnelPage.external_url
                    const separator = upsellUrl.includes('?') ? '&' : '?'
                    redirectUrl = `${upsellUrl}${separator}purchase_id=${purchaseId}&token=${thankyouToken}`
                }
            }
        }

        // Se não tem upsell, redirecionar para login do produto
        if (!redirectUrl) {
            const productSlug = productData.slug || productId
            // Apps usam /access/{slug}, Marketplace usa /members-login/{slug}
            if (productType === 'app') {
                redirectUrl = `/access/${productSlug}`
            } else {
                redirectUrl = `/members-login/${productSlug}`
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // UTMify TRACKING (background)
        // ═══════════════════════════════════════════════════════════════════

        if (sellerOwnerId) {
            ctx.waitUntil(trackUtmify(
                supabase, sellerOwnerId, productId, applicationId,
                paymentIntent.id, productName, customerName, customerEmail,
                customerPhone, clientIP, finalPrice, currency, trackingParameters
            ))
        }

        // ═══════════════════════════════════════════════════════════════════
        // ENVIAR EMAIL (background)
        // ═══════════════════════════════════════════════════════════════════

        // TODO: Adicionar envio de email via Resend
        // ctx.waitUntil(sendAccessEmail(...))

        return new Response(
            JSON.stringify({
                success: true,
                purchaseId: purchaseId,
                thankyouToken: thankyouToken,
                productType: productType,
                redirectUrl: redirectUrl
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )

    } catch (error: any) {
        console.error('Payment error:', error)

        return new Response(
            JSON.stringify({
                success: false,
                error: error.message || 'Payment processing failed',
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        )
    }
}

/**
 * UTMify tracking em background
 */
async function trackUtmify(
    supabase: any,
    sellerOwnerId: string,
    productId: string,
    applicationId: string | undefined,
    paymentIntentId: string,
    productName: string,
    customerName: string,
    customerEmail: string,
    customerPhone: string | undefined,
    clientIP: string,
    finalPrice: number,
    currency: string,
    trackingParameters: any
) {
    try {
        const { data: allIntegrations } = await supabase
            .from('utmify_integrations')
            .select('*')
            .eq('user_id', sellerOwnerId)
            .eq('is_active', true)

        if (!allIntegrations || allIntegrations.length === 0) return

        const matchingIntegrations = allIntegrations.filter((integration: any) => {
            const events: string[] = integration.events || []
            if (!events.includes('paid')) return false

            const products: { id: string }[] = integration.products || []
            if (products.length === 0) return true
            return products.some(p => p.id === productId || p.id === applicationId)
        })

        if (matchingIntegrations.length === 0) return

        const priceInCents = Math.round(finalPrice * 100)
        const gatewayFeeInCents = Math.round(priceInCents * 0.05)
        const userCommissionInCents = priceInCents - gatewayFeeInCents

        const utmifyBody = {
            orderId: paymentIntentId,
            platform: 'Clicknich',
            paymentMethod: 'credit_card',
            status: 'paid',
            createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
            approvedDate: new Date().toISOString().replace('T', ' ').substring(0, 19),
            refundedAt: null,
            customer: {
                name: customerName,
                email: customerEmail,
                phone: customerPhone || null,
                document: null,
                ip: clientIP !== 'unknown' ? clientIP : undefined,
            },
            products: [{
                id: productId,
                name: productName,
                planId: null,
                planName: null,
                quantity: 1,
                priceInCents,
            }],
            trackingParameters: trackingParameters ? {
                src: trackingParameters.src || null,
                sck: trackingParameters.sck || null,
                utm_source: trackingParameters.utm_source || null,
                utm_campaign: trackingParameters.utm_campaign || null,
                utm_medium: trackingParameters.utm_medium || null,
                utm_content: trackingParameters.utm_content || null,
                utm_term: trackingParameters.utm_term || null,
            } : null,
            commission: {
                totalPriceInCents: priceInCents,
                gatewayFeeInCents,
                userCommissionInCents,
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
                    console.warn(`UTMify error [${integration.name}]`)
                }
            } catch (e: any) {
                console.warn(`UTMify failed [${integration.name}]:`, e.message)
            }
        }))
    } catch (e: any) {
        console.warn('UTMify tracking failed:', e.message)
    }
}
