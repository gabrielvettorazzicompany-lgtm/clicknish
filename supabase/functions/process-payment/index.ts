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
const baseUrl = Deno.env.get('FRONTEND_URL') || 'https://app.clicknich.com'

const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
})

const supabase = createClient(supabaseUrl, supabaseServiceKey)

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    // 🔒 SECURITY: Rate limiting & IP protection
    const securityCheck = await securityMiddleware(req, {
        rateLimit: {
            maxRequests: 30, // Máximo 30 pagamentos por minuto por IP
            windowMs: 60000, // 1 minuto
            blockDurationMs: 600000 // 10 minutos de bloqueio se exceder
        }
    })

    if (!securityCheck.allowed) {
        return securityCheck.response!
    }

    try {
        const {
            productId,
            productType = 'marketplace', // 'app' or 'marketplace'
            applicationId, // Required when productType === 'app'
            checkoutId,
            customerEmail,
            customerName,
            customerPhone,
            paymentMethodId, // Stripe Payment Method ID do frontend
            trackingParameters, // UTM params from checkout URL
        } = await req.json()

        // 1. Fetch product from the correct table
        let product: any
        let finalPrice: number
        let productName: string
        let currency: string
        let sellerOwnerId: string | null = null

        if (productType === 'app') {
            // Fetch app directly (when selling the whole app without a specific product)
            const { data: appData, error: appError } = await supabase
                .from('applications')
                .select('*')
                .eq('id', applicationId || productId)
                .single()

            if (appError || !appData) {
                throw new Error('App not found')
            }

            product = appData
            sellerOwnerId = appData.user_id || null

            // Fetch custom checkout price if it exists
            if (checkoutId) {
                const { data: checkout } = await supabase
                    .from('checkouts')
                    .select('custom_price')
                    .eq('id', checkoutId)
                    .single()

                finalPrice = checkout?.custom_price || 0
            } else {
                finalPrice = 0
            }

            productName = appData.name
            currency = 'usd' // Apps use USD by default
        } else {
            // Fetch marketplace product
            const { data: marketplaceProduct, error: marketplaceProductError } = await supabase
                .from('marketplace_products')
                .select('*')
                .eq('id', productId)
                .single()

            if (marketplaceProductError || !marketplaceProduct) {
                throw new Error('Marketplace product not found')
            }

            product = marketplaceProduct
            sellerOwnerId = marketplaceProduct.owner_id || null
            finalPrice = marketplaceProduct.price
            productName = marketplaceProduct.name
            currency = marketplaceProduct.currency || 'brl'

            // 2. Fetch checkout (may have custom price) - marketplace only
            if (checkoutId) {
                const { data: checkout } = await supabase
                    .from('checkouts')
                    .select('custom_price')
                    .eq('id', checkoutId)
                    .single()

                if (checkout?.custom_price) {
                    finalPrice = checkout.custom_price
                }
            }
        }

        // 3. Create or fetch Stripe customer
        let stripeCustomer
        const { data: existingCustomers } = await stripe.customers.list({
            email: customerEmail,
            limit: 1,
        })

        if (existingCustomers?.data?.length > 0) {
            stripeCustomer = existingCustomers.data[0]
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

        // 4. Create Payment Intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(finalPrice * 100), // Convert to cents
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



        // 4.2. Capturar IP do cliente para geolocalização
        const clientIP =
            req.headers.get('cf-connecting-ip') ||
            req.headers.get('x-real-ip') ||
            req.headers.get('x-forwarded-for')?.split(',')[0] ||
            req.headers.get('x-client-ip') ||
            'unknown'


        // 4.3. Buscar geolocalização em background
        let geoData: any = null
        if (clientIP !== 'unknown' && !clientIP.startsWith('127.') && !clientIP.startsWith('192.168.')) {
            try {
                const geoResponse = await fetch(
                    `http://ip-api.com/json/${clientIP}?fields=status,country,countryCode,regionName,city,timezone,lat,lon`,
                    {
                        method: 'GET',
                        headers: { 'User-Agent': 'HuskyApp-Checkout/1.0' },
                        signal: AbortSignal.timeout(3000) // 3s timeout
                    }
                )

                if (geoResponse.ok) {
                    const result = await geoResponse.json()
                    if (result.status === 'success') {
                        geoData = {
                            // Salvar código ISO (ex: "BR", "US", "KM") para uso direto no mapa
                            country: result.countryCode || result.country,
                            region: result.regionName,
                            city: result.city,
                            timezone: result.timezone,
                            latitude: result.lat,
                            longitude: result.lon
                        }
                    }
                }
            } catch (geoError) {
                console.warn('⚠️ Geo lookup failed:', geoError.message)
            }
        }

        // 4.5. Attach PaymentMethod to Customer for future one-click upsells
        try {
            await stripe.paymentMethods.attach(paymentMethodId, {
                customer: stripeCustomer.id,
            })
        } catch (attachError: any) {
            // Already attached is fine
            if (attachError?.code !== 'resource_already_exists') {
                console.warn('⚠️ Could not attach payment method:', attachError.message)
            }
        }

        // 5. Create/update user and grant access based on product type
        let userId: string
        let purchaseId: string | null = null
        let thankyouToken: string | null = null

        if (productType === 'app') {
            // FLUXO PARA APPS

            // Verificar se já existe em app_users
            const { data: existingAppUser } = await supabase
                .from('app_users')
                .select('user_id')
                .eq('email', customerEmail)
                .eq('application_id', applicationId)
                .maybeSingle()

            if (existingAppUser) {
                userId = existingAppUser.user_id
            } else {
                // Criar novo usuário no auth
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

                // Criar registro em app_users
                const { error: appUserError } = await supabase
                    .from('app_users')
                    .upsert({
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

                if (appUserError) {
                    console.error('Error creating app user:', appUserError)
                }
            }

            // NOTA: Quando vende o app inteiro, liberar acesso a TODOS os produtos do app
            // EXCETO os que são order bumps (esses só libera se o cliente selecionou e pagou)

            // Buscar order bumps deste checkout para excluir do auto-grant
            let orderBumpProductIds: string[] = []
            if (checkoutId) {
                const { data: orderBumps, error: orderBumpsError } = await supabase
                    .from('checkout_offers')
                    .select('offer_product_id')
                    .eq('checkout_id', checkoutId)
                    .eq('offer_type', 'order_bump')
                    .eq('is_active', true)

                if (orderBumpsError) {
                    console.error('⚠️ Error fetching order bumps:', orderBumpsError)
                } else if (orderBumps && orderBumps.length > 0) {
                    orderBumpProductIds = orderBumps.map(o => o.offer_product_id).filter(Boolean)
                }
            }

            // Buscar todos os produtos do app
            const { data: appProducts, error: productsError } = await supabase
                .from('products')
                .select('id')
                .eq('application_id', applicationId)

            if (productsError) {
                console.error('Error fetching app products:', productsError)
            } else if (appProducts && appProducts.length > 0) {
                // Filtrar produtos que são order bumps (só libera se foi selecionado e pago)
                const productsToGrant = orderBumpProductIds.length > 0
                    ? appProducts.filter(p => !orderBumpProductIds.includes(p.id))
                    : appProducts

                // Liberar acesso a todos os produtos em batch (1 única query ao invés de N)
                const accessRecords = productsToGrant.map(product => ({
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

                const { data: batchAccess, error: batchAccessError } = await supabase
                    .from('user_product_access')
                    .upsert(accessRecords, {
                        onConflict: 'user_id,product_id',
                        ignoreDuplicates: false
                    })
                    .select('id')

                let firstProductAccessId: string | null = null

                if (batchAccessError) {
                    console.error('❌ Error granting batch access:', batchAccessError)
                } else if (batchAccess && batchAccess.length > 0) {
                    firstProductAccessId = batchAccess[0].id

                    // Salvar dados de venda conectados ao primeiro acesso (em background)
                    if (firstProductAccessId) {
                        const saleLocationData: any = {
                            user_id: sellerOwnerId,  // ID do vendedor (dono do app)
                            customer_email: customerEmail,
                            amount: finalPrice,
                            currency: currency,
                            payment_method: 'card',
                            customer_ip: clientIP,
                            checkout_id: checkoutId || null,
                            product_id: productId || null,
                            user_product_access_id: firstProductAccessId,
                            sale_date: new Date().toISOString(),
                            // Geo fields — preenchidos se disponível
                            ...(geoData ? {
                                country: geoData.country,
                                region: geoData.region,
                                city: geoData.city,
                                latitude: geoData.latitude,
                                longitude: geoData.longitude,
                            } : {})
                        }

                        // Salvar em background (não bloquear)
                        supabase
                            .from('sale_locations')
                            .insert(saleLocationData)
                            .then(({ error }) => {
                                if (error) {
                                    console.error('❌ Error saving app sale location:', error)
                                }
                            })
                    }
                }

                // Gerar token para thank you page (usando o primeiro produto)
                if (firstProductAccessId) {

                    const { data: tokenData, error: tokenError } = await supabase.rpc('generate_thankyou_token')

                    if (tokenError) {
                        console.error('❌ Error generating token:', tokenError)
                    } else {
                        thankyouToken = tokenData
                        purchaseId = firstProductAccessId

                        const expiresAt = new Date()
                        expiresAt.setDate(expiresAt.getDate() + 7) // 7 days from now

                        const { error: updateError } = await supabase
                            .from('user_product_access')
                            .update({
                                thankyou_token: thankyouToken,
                                thankyou_token_expires_at: expiresAt.toISOString(),
                                thankyou_max_views: 5
                            })
                            .eq('id', firstProductAccessId)

                        if (updateError) {
                            console.error('❌ Error updating token:', updateError)
                        }
                    }
                } else {
                    console.warn('⚠️ No product access ID found to generate thank you token')
                }

            } else {
                console.warn('⚠️ No products found in this app')
            }

        } else {
            // FLUXO PARA MARKETPLACE

            // Buscar diretamente pela tabela member_profiles
            const { data: existingMember } = await supabase
                .from('member_profiles')
                .select('id')
                .eq('email', customerEmail)
                .eq('product_id', productId)
                .maybeSingle()

            if (existingMember) {
                userId = existingMember.id
            } else {
                // Criar novo usuário no auth
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

            // Criar ou atualizar registro em member_profiles
            const { error: memberError } = await supabase
                .from('member_profiles')
                .upsert({
                    email: customerEmail,
                    name: customerName,
                    phone: customerPhone,
                    product_id: productId,
                    created_at: new Date().toISOString(),
                }, {
                    onConflict: 'email,product_id',
                    ignoreDuplicates: false
                })

            if (memberError) {
                console.error('Error upserting member profile:', memberError)
            }

            // Liberar acesso ao produto do marketplace
            const { data: marketplaceAccess, error: accessError } = await supabase
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

            if (accessError) {
                console.error('Error granting marketplace access:', accessError)
            } else if (marketplaceAccess) {
                // Salvar dados de venda para marketplace (em background)
                const saleLocationData: any = {
                    user_id: sellerOwnerId,  // ID do vendedor (dono do produto marketplace)
                    customer_email: customerEmail,
                    amount: finalPrice,
                    currency: currency,
                    payment_method: 'card',
                    customer_ip: clientIP,
                    checkout_id: checkoutId || null,
                    product_id: productId || null,
                    user_product_access_id: marketplaceAccess.id,
                    sale_date: new Date().toISOString(),
                    // Geo fields — preenchidos se disponível
                    ...(geoData ? {
                        country: geoData.country,
                        region: geoData.region,
                        city: geoData.city,
                        latitude: geoData.latitude,
                        longitude: geoData.longitude,
                    } : {})
                }

                // Salvar em background (não bloquear)
                supabase
                    .from('sale_locations')
                    .insert(saleLocationData)
                    .then(({ error }) => {
                        if (error) {
                            console.error('❌ Error saving marketplace sale location:', error)
                        }
                    })
            }

            // Gerar token para thank you page
            if (marketplaceAccess) {

                const { data: tokenData, error: tokenError } = await supabase.rpc('generate_thankyou_token')

                if (tokenError) {
                    console.error('❌ Error generating token:', tokenError)
                } else {
                    thankyouToken = tokenData
                    purchaseId = marketplaceAccess.id

                    const expiresAt = new Date()
                    expiresAt.setDate(expiresAt.getDate() + 7) // 7 days from now

                    const { error: updateError } = await supabase
                        .from('user_product_access')
                        .update({
                            thankyou_token: thankyouToken,
                            thankyou_token_expires_at: expiresAt.toISOString(),
                            thankyou_max_views: 5
                        })
                        .eq('id', marketplaceAccess.id)

                    if (updateError) {
                        console.error('❌ Error updating marketplace token:', updateError)
                    }
                }
            } else {

            }
        }

        // 6. UTMify tracking (fire-and-forget — não bloqueia a resposta)
        if (sellerOwnerId) {
            const utmifyPromise = (async () => {
                try {
                    // Buscar integrações UTMify ativas do dono do produto
                    const { data: allIntegrations } = await supabase
                        .from('utmify_integrations')
                        .select('*')
                        .eq('user_id', sellerOwnerId)
                        .eq('is_active', true)

                    if (!allIntegrations || allIntegrations.length === 0) return

                    // Filtrar integrações que se aplicam a este produto e ao evento 'paid'
                    const matchingIntegrations = allIntegrations.filter((integration: any) => {
                        const events: string[] = integration.events || []
                        if (!events.includes('paid')) return false

                        const products: { id: string }[] = integration.products || []
                        // Se products está vazio, aplica a todos os produtos
                        if (products.length === 0) return true
                        return products.some(p => p.id === productId || p.id === applicationId)
                    })

                    if (matchingIntegrations.length === 0) return

                    const priceInCents = Math.round(finalPrice * 100)
                    const gatewayFeeInCents = Math.round(priceInCents * 0.05)
                    const userCommissionInCents = priceInCents - gatewayFeeInCents

                    const utmifyBody = {
                        orderId: paymentIntent.id,
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
                        products: [
                            {
                                id: productId,
                                name: productName,
                                planId: null,
                                planName: null,
                                quantity: 1,
                                priceInCents,
                            },
                        ],
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
                            currency: currency.toUpperCase() as any,
                        },
                        isTest: false,
                    }

                    // Disparar para cada integração correspondente
                    await Promise.all(matchingIntegrations.map(async (integration: any) => {
                        try {
                            const res = await fetch('https://api.utmify.com.br/api-credentials/orders', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'x-api-token': integration.api_token,
                                },
                                body: JSON.stringify(utmifyBody),
                                signal: AbortSignal.timeout(8000),
                            })
                            if (!res.ok) {
                                const err = await res.json().catch(() => null)
                                console.warn(`⚠️ UTMify error [${integration.name}]:`, err)
                            }
                        } catch (e: any) {
                            console.warn(`⚠️ UTMify failed [${integration.name}]:`, e.message)
                        }
                    }))
                } catch (e: any) {
                    console.warn('⚠️ UTMify tracking failed:', e.message)
                }
            })()

            try { (globalThis as any).EdgeRuntime?.waitUntil(utmifyPromise) } catch (_) { }
        }

        // 7. Disparar email em background sem bloquear a resposta (fire-and-forget)
        const emailPromise = (async () => {
            try {
                const resendApiKey = Deno.env.get('RESEND_API_KEY')

                if (!resendApiKey) {
                    console.warn('⚠️ RESEND_API_KEY not configured, skipping email')
                } else {
                    // Gerar URL de acesso e buscar produtos do cliente
                    let accessUrl: string
                    let appName = productName
                    let downloadLink = ''
                    const customerProducts: string[] = []

                    if (productType === 'app') {
                        // Para apps, buscar slug e produtos com acesso
                        const { data: appData } = await supabase
                            .from('applications')
                            .select('slug, android_url, ios_url, name')
                            .eq('id', applicationId)
                            .single()

                        // Usar slug se existir e não estiver vazio
                        let appSlug = appData?.slug?.trim()

                        // Se não tem slug válido, criar um a partir do nome
                        if (!appSlug && appData?.name) {
                            appSlug = appData.name
                                .toLowerCase()
                                .normalize('NFD')
                                .replace(/[\u0300-\u036f]/g, '') // Remove acentos
                                .replace(/[^a-z0-9]+/g, '-') // Substitui caracteres especiais por hífen
                                .replace(/^-+|-+$/g, '') // Remove hífens no início/fim
                                .trim()

                            // Atualizar o slug no banco
                            const { error: slugError } = await supabase
                                .from('applications')
                                .update({ slug: appSlug })
                                .eq('id', applicationId)

                            if (slugError) {
                                console.error('Error updating slug:', slugError)
                            }
                        }

                        // Se ainda não tem slug (erro ou nome vazio), usar ID
                        if (!appSlug) {
                            appSlug = applicationId
                            console.warn('⚠️ Using application ID as slug:', appSlug)
                        }

                        accessUrl = `${baseUrl}/access/${appSlug}`
                        downloadLink = appData?.android_url || appData?.ios_url || ''

                        // Buscar produtos que o usuário tem acesso
                        const { data: accessData } = await supabase
                            .from('user_product_access')
                            .select('product_id')
                            .eq('user_id', userId)
                            .eq('application_id', applicationId)

                        if (accessData && accessData.length > 0) {
                            const productIds = accessData.map((a: any) => a.product_id)
                            const { data: productsData } = await supabase
                                .from('products')
                                .select('name')
                                .in('id', productIds)

                            if (productsData) {
                                productsData.forEach((p: any) => {
                                    customerProducts.push(`• ${p.name}`)
                                })
                            }
                        }
                    } else {
                        // Para marketplace, buscar slug e usar URL de login
                        const { data: productData } = await supabase
                            .from('marketplace_products')
                            .select('slug, name')
                            .eq('id', productId)
                            .single()

                        // Usar slug se existir e não estiver vazio
                        let productSlug = productData?.slug?.trim()

                        // Se não tem slug válido, criar um a partir do nome
                        if (!productSlug && productData?.name) {
                            productSlug = productData.name
                                .toLowerCase()
                                .normalize('NFD')
                                .replace(/[\u0300-\u036f]/g, '') // Remove acentos
                                .replace(/[^a-z0-9]+/g, '-') // Substitui caracteres especiais por hífen
                                .replace(/^-+|-+$/g, '') // Remove hífens no início/fim
                                .trim()

                            // Atualizar o slug no banco
                            const { error: slugError } = await supabase
                                .from('marketplace_products')
                                .update({ slug: productSlug })
                                .eq('id', productId)

                            if (slugError) {
                                console.error('Error updating product slug:', slugError)
                            }
                        }

                        // Se ainda não tem slug (erro ou nome vazio), usar ID
                        if (!productSlug) {
                            productSlug = productId
                            console.warn('⚠️ Using product ID as slug:', productSlug)
                        }

                        accessUrl = `${baseUrl}/members-login/${productSlug}`
                    }

                    // Preparar HTML com produtos específicos
                    const productsListHtml = customerProducts.length > 0
                        ? `<div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
                        <p style="color: #333; font-size: 14px; margin-bottom: 10px;"><strong>${appName}</strong></p>
                        <ul style="list-style: none; padding: 0; margin: 0;">
                            ${customerProducts.map(p => `<li style="padding: 4px 0; color: #666;">${p}</li>`).join('')}
                        </ul>
                       </div>`
                        : `<div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
                        <p style="color: #333; font-size: 14px;"><strong>${appName}</strong></p>
                       </div>`

                    const emailHtml = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center; border-radius: 8px 8px 0 0;">
                            <h1 style="color: white; margin: 0; font-size: 28px;">Access Granted</h1>
                        </div>
                        <div style="background: #f9fafb; padding: 40px; border-radius: 0 0 8px 8px;">
                            <p style="color: #333; font-size: 16px;">
                                Hi <strong>${customerName}</strong>,
                            </p>
                            <p style="color: #666; font-size: 14px; line-height: 1.6;">
                                Great news! Your payment has been successfully processed and you now have access to:
                            </p>
                            ${productsListHtml}
                            <div style="margin: 30px 0; text-align: center;">
                                <a href="${accessUrl}" style="background: #667eea; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
                                    ${productType === 'app' ? 'Access App Login' : 'Access Members Area'}
                                </a>
                            </div>
                            ${downloadLink ? `
                                <div style="margin: 15px 0; text-align: center;">
                                    <a href="${downloadLink}" style="background: white; color: #667eea; border: 2px solid #667eea; padding: 12px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 14px;">
                                        Download App
                                    </a>
                                </div>
                            ` : ''}
                            <div style="background: #f3f4f6; padding: 15px; border-radius: 6px; margin-top: 20px;">
                                <p style="color: #666; font-size: 13px; margin: 0 0 8px 0; line-height: 1.5;">
                                    <strong>Access instructions:</strong>
                                </p>
                                <p style="color: #666; font-size: 13px; margin: 0; line-height: 1.5;">
                                    1. Click the button above to access the login page<br>
                                    2. Enter your email: <strong>${customerEmail}</strong><br>
                                    3. If it's your first access, you'll be able to create your password<br>
                                    ${customerPhone ? `4. Your registered phone: ${customerPhone}` : ''}
                                </p>
                            </div>
                            <p style="color: #999; font-size: 12px; border-top: 1px solid #ddd; padding-top: 20px; margin-top: 30px;">
                                If you have any questions, please contact our support team.<br>
                                This is an automated message, please do not reply.
                            </p>
                        </div>
                    </div>
                `

                    const fromAddress = Deno.env.get('RESEND_FROM') || 'noreply@clicknich.com'

                    // Enviar email diretamente via Resend API
                    const emailResponse = await fetch('https://api.resend.com/emails', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${resendApiKey}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            from: fromAddress,
                            to: customerEmail,
                            subject: `Your access to ${productName} is ready`,
                            html: emailHtml,
                        }),
                    })

                    const emailResult = await emailResponse.json()

                    if (!emailResponse.ok) {
                        console.error('❌ Error sending email:', emailResult)
                    }
                }
            } catch (emailError) {
                console.error('❌ Exception sending email:', emailError)
            }
        })() // fim fire-and-forget

        // Manter a edge function viva até o email terminar em background
        try { (globalThis as any).EdgeRuntime?.waitUntil(emailPromise) } catch (_) { }

        return new Response(
            JSON.stringify({
                success: true,
                purchaseId: purchaseId,
                thankyouToken: thankyouToken,
                productType: productType
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
})
