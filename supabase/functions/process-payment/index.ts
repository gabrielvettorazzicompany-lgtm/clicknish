import Stripe from 'https://esm.sh/stripe@14.11.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
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

        // ═══════════════════════════════════════════════════════════════════
        // OTIMIZAÇÃO: Buscar produto, checkout e Stripe customer EM PARALELO
        // Economia: ~100ms (300ms → 200ms)
        // ═══════════════════════════════════════════════════════════════════

        const [productResult, checkoutResult, stripeCustomersResult] = await Promise.all([
            // 1. Buscar produto (app ou marketplace)
            productType === 'app'
                ? supabase.from('applications').select('*').eq('id', applicationId || productId).single()
                : supabase.from('marketplace_products').select('*').eq('id', productId).single(),

            // 2. Buscar checkout (se tiver checkoutId)
            checkoutId
                ? supabase.from('checkouts').select('custom_price').eq('id', checkoutId).single()
                : Promise.resolve({ data: null, error: null }),

            // 3. Buscar Stripe customer existente
            stripe.customers.list({ email: customerEmail, limit: 1 })
        ])

        // Processar resultado do produto
        const productData = productResult.data
        if (productResult.error || !productData) {
            throw new Error(productType === 'app' ? 'App not found' : 'Marketplace product not found')
        }

        // Extrair dados do produto
        let product: any = productData
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

        // Processar Stripe customer (criar se não existir)
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



        // 4.2. Capturar IP do cliente
        const clientIP =
            req.headers.get('cf-connecting-ip') ||
            req.headers.get('x-real-ip') ||
            req.headers.get('x-forwarded-for')?.split(',')[0] ||
            req.headers.get('x-client-ip') ||
            'unknown'

        // 4.3. Geolocalização via headers (0ms)
        // Cloudflare (cf-*) ou Deno Deploy (x-*) como fallback
        const geoData = {
            country: req.headers.get('cf-ipcountry') || req.headers.get('x-country') || null,
            region: req.headers.get('cf-region') || null,
            city: req.headers.get('cf-ipcity') || req.headers.get('x-city') || null,
            timezone: req.headers.get('cf-timezone') || null
        }

        // 4.5. Attach PaymentMethod to Customer (fire-and-forget - não bloqueia)
        stripe.paymentMethods.attach(paymentMethodId, { customer: stripeCustomer.id })
            .catch((err: any) => {
                if (err?.code !== 'resource_already_exists') {
                    console.warn('⚠️ Could not attach payment method:', err.message)
                }
            })

        // 5. Create/update user and grant access based on product type
        let userId: string
        let purchaseId: string | null = null
        let thankyouToken: string | null = null

        if (productType === 'app') {
            // FLUXO PARA APPS
            // ═══════════════════════════════════════════════════════════════════
            // OTIMIZAÇÃO: Paralelizar queries - app_users + order_bumps + products
            // Economia: ~100ms (150ms → 50ms)
            // ═══════════════════════════════════════════════════════════════════

            const [appUserResult, orderBumpsResult, appProductsResult] = await Promise.all([
                // 1. Verificar se já existe em app_users
                supabase
                    .from('app_users')
                    .select('user_id')
                    .eq('email', customerEmail)
                    .eq('application_id', applicationId)
                    .maybeSingle(),

                // 2. Buscar order bumps (se tiver checkoutId)
                checkoutId
                    ? supabase
                        .from('checkout_offers')
                        .select('offer_product_id')
                        .eq('checkout_id', checkoutId)
                        .eq('offer_type', 'order_bump')
                        .eq('is_active', true)
                    : Promise.resolve({ data: null, error: null }),

                // 3. Buscar todos os produtos do app
                supabase
                    .from('products')
                    .select('id')
                    .eq('application_id', applicationId)
            ])

            const existingAppUser = appUserResult.data
            const orderBumps = orderBumpsResult.data
            const appProducts = appProductsResult.data

            // Processar order bumps
            let orderBumpProductIds: string[] = []
            if (orderBumpsResult.error) {
                console.error('⚠️ Error fetching order bumps:', orderBumpsResult.error)
            } else if (orderBumps && orderBumps.length > 0) {
                orderBumpProductIds = orderBumps.map((o: any) => o.offer_product_id).filter(Boolean)
            }

            // Processar usuário
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

            const productsError = appProductsResult.error

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
                // OTIMIZAÇÃO: Token gerado localmente (0ms vs ~50ms RPC)
                if (firstProductAccessId) {
                    thankyouToken = crypto.randomUUID()
                    purchaseId = firstProductAccessId

                    const expiresAt = new Date()
                    expiresAt.setDate(expiresAt.getDate() + 7) // 7 days from now

                    // Salvar token em background (não bloqueia)
                    supabase
                        .from('user_product_access')
                        .update({
                            thankyou_token: thankyouToken,
                            thankyou_token_expires_at: expiresAt.toISOString(),
                            thankyou_max_views: 5
                        })
                        .eq('id', firstProductAccessId)
                        .then(({ error }) => {
                            if (error) console.error('❌ Error updating token:', error)
                        })
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
            // OTIMIZAÇÃO: Token gerado localmente (0ms vs ~50ms RPC)
            if (marketplaceAccess) {
                thankyouToken = crypto.randomUUID()
                purchaseId = marketplaceAccess.id

                const expiresAt = new Date()
                expiresAt.setDate(expiresAt.getDate() + 7) // 7 days from now

                // Salvar token em background (não bloqueia)
                supabase
                    .from('user_product_access')
                    .update({
                        thankyou_token: thankyouToken,
                        thankyou_token_expires_at: expiresAt.toISOString(),
                        thankyou_max_views: 5
                    })
                    .eq('id', marketplaceAccess.id)
                    .then(({ error }) => {
                        if (error) console.error('❌ Error updating marketplace token:', error)
                    })
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
