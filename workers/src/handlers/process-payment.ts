/**
 * Handler: Process Payment
 * Processa pagamentos de checkout (apps e marketplace)
 */

import { createClient } from '../lib/supabase'
import { createStripeClient } from '../lib/stripe'
import { createCustomerUser } from './customer-auth'
import { appLangToEmailLang, buildAccessEmailHtml } from '../utils/email-i18n'
import { applyFxConversion } from '../lib/fx'
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

    // 2. Provedor padrão global da plataforma
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

export async function handleProcessPayment(
    request: Request,
    env: Env,
    ctx: ExecutionContext
): Promise<Response> {
    // Parse body ANTES do try para ficar acessível no catch (UTMify refused tracking)
    const rawBody = await request.json().catch(() => ({})) as any
    const {
        productId,
        productType = 'marketplace',
        applicationId,
        checkoutId,
        customerEmail,
        customerName,
        customerPhone,
        paymentMethodId,
        paymentProvider = 'stripe', // 'stripe' ou 'paypal'
        trackingParameters,
        selectedOrderBumps = [],
        installments = 1,
        sessionId,
    } = rawBody

    // Hoist para ficar acessível no catch (UTMify refused)
    let sellerOwnerId: string | null = null

    try {

        console.log('Process payment request:', {
            productId,
            productType,
            applicationId,
            checkoutId,
            customerEmail,
            customerName,
            customerPhone,
            paymentProvider,
            paymentMethodId: paymentMethodId ? 'present' : 'missing'
        })

        // Verificar se é PayPal e redirecionar para handler específico
        if (paymentProvider === 'paypal') {
            // Importar dinamicamente para não carregar quando não necessário
            const { handlePayPalPayment } = await import('./process-paypal-payment')
            // Passar dados geo do request para o handler PayPal
            const bodyWithGeo = {
                ...rawBody,
                _clientIP: request.headers.get('cf-connecting-ip') || 'unknown',
                _geoData: {
                    country: request.headers.get('cf-ipcountry') || null,
                    region: request.headers.get('cf-region') || null,
                    city: request.headers.get('cf-ipcity') || null,
                },
            }
            return handlePayPalPayment(bodyWithGeo, env, ctx)
        }

        // Continuar com Stripe (método padrão)
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
        // stripe é inicializado após resolveStripeKey identificar o provedor correto
        let stripe: ReturnType<typeof createStripeClient>

        // ═══════════════════════════════════════════════════════════════════
        // BUSCAR DADOS EM PARALELO
        // ═══════════════════════════════════════════════════════════════════

        // IDs dos order bumps selecionados pelo cliente
        const selectedBumpIds: string[] = Array.isArray(selectedOrderBumps)
            ? selectedOrderBumps.map((b: any) => b.id).filter(Boolean)
            : []

        // ═══════════════════════════════════════════════════════════════════
        // FAST PATH: ler sessão pré-carregada do KV (criada quando o checkout abriu).
        // Elimina todas as queries de produto/checkout/offers — apenas KV + 2 externas.
        // FALLBACK: queries completas ao Supabase se KV miss ou sessionId ausente.
        // ═══════════════════════════════════════════════════════════════════
        let kvSession: any = null
        if (sessionId && env.CACHE) {
            try {
                kvSession = await env.CACHE.get(`session:${sessionId}`, 'json') as typeof kvSession
                console.log(kvSession ? `KV session hit: ${sessionId}` : `KV session miss: ${sessionId}`)
            } catch (e) {
                console.warn('KV read failed, fallback to DB:', e)
            }
        }

        let finalPrice: number
        let productName: string
        let currency: string
        let stripeCustomersResult: any
        let productSlug: string = productId  // slug para URL de login, fallback = ID
        const verifiedBumps: Array<{ id: string; price: number }> = []

        // Variáveis unificadas para os fluxos app/marketplace downstream
        let existingAppUserData: { user_id: string } | null = null
        let orderBumpProductIdsData: string[] = []   // offer_product_id de todos os bumps do checkout
        let purchasedBumpModulesData: Array<{ productId: string; price: number }> = []  // bumps comprados pelo cliente que pertencem ao mesmo app
        let appProductsData: Array<{ id: string }> = []
        let existingMemberData: { id: string } | null = null
        let funnelSelectedModulesData: string[] | null = null  // null = liberar todos os módulos

        if (kvSession) {
            // ══ FAST PATH: KV hit ══
            finalPrice = kvSession.finalPrice
            productName = kvSession.productName
            currency = kvSession.currency
            sellerOwnerId = kvSession.sellerOwnerId
            // Resolve o stripe correto para este vendedor (individual > global > fallback)
            stripe = createStripeClient(await resolveStripeKey(supabase, sellerOwnerId))

            // Preços verificados: filtrar apenas os bumps que o cliente selecionou
            for (const offer of kvSession.bumpOffers) {
                if (selectedBumpIds.includes(offer.id) && offer.price > 0) {
                    verifiedBumps.push({ id: offer.id, price: offer.price })
                }
            }

            // Dados de acesso
            orderBumpProductIdsData = kvSession.bumpOffers
                .map((o: any) => o.offerProductId)
                .filter((id: any): id is string => !!id)
            // Módulos de bump que o cliente COMPROU (filtragem por selectedBumpIds)
            purchasedBumpModulesData = (kvSession.bumpOffers as Array<{ id: string; price: number; offerProductId: string | null }>)
                .filter(o => selectedBumpIds.includes(o.id) && !!o.offerProductId)
                .map(o => ({ productId: o.offerProductId as string, price: o.price }))
            appProductsData = kvSession.appProductIds.map((id: any) => ({ id }))
            funnelSelectedModulesData = kvSession.selectedModules ?? null
            console.log('KV selected_modules:', funnelSelectedModulesData?.length ?? 'all')
            console.log('KV purchased bump modules:', purchasedBumpModulesData.length)

            // Só precisa de 2 chamadas externas agora
            const [stripeResult, userResult] = await Promise.all([
                stripe.customers.list({ email: customerEmail, limit: 1 }),
                productType === 'app'
                    ? supabase.from('app_users')
                        .select('user_id')
                        .eq('email', customerEmail)
                        .eq('application_id', applicationId)
                        .maybeSingle()
                    : supabase.from('member_profiles')
                        .select('id')
                        .eq('email', customerEmail)
                        .eq('product_id', productId)
                        .maybeSingle(),
            ])

            stripeCustomersResult = stripeResult
            existingAppUserData = (userResult as any).data
            existingMemberData = (userResult as any).data

        } else {
            // ══ FALLBACK: queries completas ao Supabase ══
            // Fase 1: buscar produto (necessário para saber o vendedor e resolver o Stripe correto)
            // + demais queries Supabase em paralelo (não dependem do Stripe)
            const [
                productResult,
                checkoutResult,
                bumpPricesResult,
                appUserResult,
                orderBumpsResult,
                appProductsResult,
                memberProfileResult,
                funnelPageResult,
            ] = await Promise.all([
                productType === 'app'
                    ? supabase.from('applications').select('*').eq('id', applicationId || productId).single()
                    : supabase.from('marketplace_products').select('*').eq('id', productId).single(),
                checkoutId
                    ? supabase.from('checkouts').select('custom_price').eq('id', checkoutId).single()
                    : Promise.resolve({ data: null, error: null }),
                selectedBumpIds.length > 0
                    ? supabase.from('checkout_offers')
                        .select('id, offer_price, original_price, offer_product_id')
                        .in('id', selectedBumpIds)
                        .eq('is_active', true)
                        .eq('offer_type', 'order_bump')
                    : Promise.resolve({ data: [], error: null }),
                productType === 'app'
                    ? supabase.from('app_users').select('user_id').eq('email', customerEmail).eq('application_id', applicationId).maybeSingle()
                    : Promise.resolve({ data: null, error: null }),
                productType === 'app' && checkoutId
                    ? supabase.from('checkout_offers').select('offer_product_id').eq('checkout_id', checkoutId).eq('offer_type', 'order_bump').eq('is_active', true)
                    : Promise.resolve({ data: null, error: null }),
                productType === 'app'
                    ? supabase.from('products').select('id').eq('application_id', applicationId)
                    : Promise.resolve({ data: null, error: null }),
                productType === 'marketplace'
                    ? supabase.from('member_profiles').select('id').eq('email', customerEmail).eq('product_id', productId).maybeSingle()
                    : Promise.resolve({ data: null, error: null }),
                // 9. Módulos selecionados na funnel page do checkout
                productType === 'app' && checkoutId
                    ? supabase.from('funnel_pages')
                        .select('settings')
                        .eq('checkout_id', checkoutId)
                        .eq('page_type', 'checkout')
                        .maybeSingle()
                    : Promise.resolve({ data: null, error: null }),
            ])

            const productData = productResult.data as any
            if (productResult.error || !productData) {
                throw new Error(productType === 'app' ? 'App not found' : 'Marketplace product not found')
            }

            if (productType === 'app') {
                sellerOwnerId = productData.owner_id || null
                finalPrice = (checkoutResult as any).data?.custom_price || 0
                productName = productData.name
                currency = 'usd'
            } else {
                sellerOwnerId = productData.owner_id || null
                finalPrice = (checkoutResult as any).data?.custom_price || productData.price
                productName = productData.name
                currency = productData.currency || 'brl'
            }

            // Fase 2: agora que sabemos o vendedor, resolver o Stripe correto e buscar o customer
            stripe = createStripeClient(await resolveStripeKey(supabase, sellerOwnerId))
            const stripeResult = await stripe.customers.list({ email: customerEmail, limit: 1 })

            stripeCustomersResult = stripeResult
            existingAppUserData = (appUserResult as any).data
            existingMemberData = (memberProfileResult as any).data
            orderBumpProductIdsData = ((orderBumpsResult as any).data || []).map((o: any) => o.offer_product_id).filter(Boolean)
            appProductsData = ((appProductsResult as any).data || []).map((p: any) => ({ id: p.id }))
            productSlug = (productResult.data as any)?.slug || productId

            // Extrair módulos selecionados da funnel page
            const funnelPageSettings = (funnelPageResult as any).data?.settings
            funnelSelectedModulesData = Array.isArray(funnelPageSettings?.selected_modules) && funnelPageSettings.selected_modules.length > 0
                ? funnelPageSettings.selected_modules
                : null
            console.log('Fallback selected_modules:', funnelSelectedModulesData?.length ?? 'all')

            if ((bumpPricesResult as any).data && Array.isArray((bumpPricesResult as any).data)) {
                for (const bump of (bumpPricesResult as any).data) {
                    const bumpPrice = bump.offer_price ?? bump.original_price ?? 0
                    if (bumpPrice > 0) {
                        verifiedBumps.push({ id: bump.id, price: bumpPrice })
                        // Se o bump está vinculado a um produto, registrar para liberar acesso
                        if (bump.offer_product_id) {
                            purchasedBumpModulesData.push({ productId: bump.offer_product_id, price: bumpPrice })
                        }
                    }
                }
            }
            console.log('Fallback purchased bump modules:', purchasedBumpModulesData.length)
        }

        // ═══════════════════════════════════════════════════════════════════
        // CALCULAR TOTAL COM ORDER BUMPS (verificado server-side)
        // ═══════════════════════════════════════════════════════════════════
        const bumpsTotal = verifiedBumps.reduce((sum, b) => sum + b.price, 0)
        const baseTotal = finalPrice + bumpsTotal

        // ═══════════════════════════════════════════════════════════════════
        // CONVERSÃO FX: converter total para moeda do cliente (+1.7% spread)
        // Usa cf-ipcountry do Cloudflare — sem depender do frontend
        // ═══════════════════════════════════════════════════════════════════
        const clientCountryForFx = request.headers.get('cf-ipcountry')
        const fxResult = await applyFxConversion(baseTotal, currency, clientCountryForFx, env)
        const chargeAmount = fxResult.displayPrice
        const chargeCurrency = fxResult.displayCurrency.toLowerCase()
        if (fxResult.displayCurrency !== fxResult.baseCurrency) {
            console.log(`[fx] ${baseTotal} ${currency} → ${chargeAmount} ${chargeCurrency} (country: ${clientCountryForFx})`)
        }

        // Calcular juros server-side (mesmo cálculo do frontend): até 6x sem juros, >6x = 2.5%/mês simples
        const installmentCount = Math.min(Math.max(1, Math.floor(installments)), 12)
        const totalChargeAmount = installmentCount > 6
            ? parseFloat((chargeAmount * (1 + 0.025 * installmentCount)).toFixed(2))
            : chargeAmount

        console.log('Order bumps:', { selected: selectedBumpIds.length, verified: verifiedBumps.length, bumpsTotal, totalChargeAmount })
        console.log('Installments:', { installmentCount, baseTotal, totalChargeAmount })

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

        // Idempotency key: hash determinístico por tentativa de compra.
        // Mesma combinação de email + produto + checkout + cartão = mesmo PaymentIntent.
        // Previne cobranças duplicadas em double-click ou retentativas de rede.
        const idempotencyRaw = `${customerEmail}:${productId}:${checkoutId || ''}:${paymentMethodId}`
        const idempotencyHashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(idempotencyRaw))
        const idempotencyKey = Array.from(new Uint8Array(idempotencyHashBuf))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')

        // Attach PaymentMethod ao customer ANTES de criar o PaymentIntent
        // Isso permite reusar o pm_ em retentativas sem o erro "previously used without being attached"
        try {
            await stripe.paymentMethods.attach(paymentMethodId, { customer: stripeCustomer.id })
        } catch (attachErr: any) {
            if (attachErr?.code !== 'resource_already_exists') {
                console.warn('Could not attach payment method:', attachErr.message)
            }
        }

        const paymentIntent = await stripe.paymentIntents.create(
            {
                amount: Math.round(totalChargeAmount * 100),
                currency: chargeCurrency,
                customer: stripeCustomer.id,
                payment_method: paymentMethodId,
                confirm: true,
                automatic_payment_methods: {
                    enabled: true,
                    allow_redirects: 'never',
                },
                // Parcelamento real via Stripe (funciona para cartões que suportam installments)
                ...(installmentCount > 1 ? {
                    payment_method_options: {
                        card: {
                            installments: {
                                enabled: true,
                                plan: {
                                    count: installmentCount,
                                    interval: 'month',
                                    type: 'fixed_count',
                                },
                            },
                        },
                    },
                } : {}),
                metadata: {
                    product_id: productId,
                    product_type: productType,
                    product_name: productName,
                    application_id: applicationId || '',
                    checkout_id: checkoutId || '',
                    customer_email: customerEmail,
                    installments: String(installmentCount),
                },
                description: `Purchase: ${productName}${installmentCount > 1 ? ` (${installmentCount}x)` : ''}`,
            },
            { idempotencyKey }
        )

        // Capturar IP e geolocalização (Cloudflare headers)
        const clientIP = request.headers.get('cf-connecting-ip') || 'unknown'
        const geoData = {
            country: request.headers.get('cf-ipcountry') || null,
            region: request.headers.get('cf-region') || null,
            city: request.headers.get('cf-ipcity') || null,
            timezone: request.headers.get('cf-timezone') || null
        }

        // ═══════════════════════════════════════════════════════════════════
        // Registrar plano de saque vigente na venda (fee calculado apenas no saque)
        // ═══════════════════════════════════════════════════════════════════
        let producerPayoutSchedule = 'D+5'
        if (sellerOwnerId) {
            const { data: producerConfig } = await supabase
                .from('user_payment_config')
                .select('payout_schedule')
                .eq('user_id', sellerOwnerId)
                .maybeSingle()
            if (producerConfig?.payout_schedule) {
                producerPayoutSchedule = producerConfig.payout_schedule
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // ⚡ OTIMIZAÇÃO: Gerar IDs + criar usuário ANTES do ctx.waitUntil
        // user_id precisa estar disponível para ser salvo no KV junto com
        // stripe_customer_id, garantindo que process-upsell não precise
        // esperar o DB ser escrito (ctx.waitUntil) para processar o upsell.
        // ═══════════════════════════════════════════════════════════════════
        const purchaseId = crypto.randomUUID()
        const thankyouToken = crypto.randomUUID()

        // Resolver user_id sincronamente (antes do ctx.waitUntil)
        // Para usuários existentes: já temos. Para novos: criar agora.
        let resolvedUserId: string = existingAppUserData?.user_id || ''
        let newUserCreated = false
        if (!resolvedUserId && paymentIntent.status === 'succeeded') {
            try {
                const authData = await createCustomerUser(supabase, env, {
                    email: customerEmail,
                    name: customerName,
                    phone: customerPhone,
                    created_via: 'purchase'
                })
                resolvedUserId = authData.user.id
                newUserCreated = true
            } catch (userErr: any) {
                console.error('createCustomerUser failed (sync):', userErr)
                // resolvedUserId continua '' — o ctx.waitUntil tentará novamente
            }
        }

        // Calcular quais módulos serão liberados AGORA para usar no email
        // (feito aqui fora do waitUntil para evitar race condition com o upsert)
        const emailGrantedProductIds: string[] = productType === 'app'
            ? (() => {
                let filtered = appProductsData.map(p => p.id)
                if (funnelSelectedModulesData && funnelSelectedModulesData.length > 0) {
                    filtered = filtered.filter(id => funnelSelectedModulesData!.includes(id))
                }
                if (orderBumpProductIdsData.length > 0) {
                    filtered = filtered.filter(id => !orderBumpProductIdsData.includes(id))
                }
                // Incluir também os módulos de order bump comprados
                const bumpIds = purchasedBumpModulesData
                    .filter(b => appProductsData.some(p => p.id === b.productId))
                    .map(b => b.productId)
                return [...filtered, ...bumpIds]
            })()
            : []

        // ═══════════════════════════════════════════════════════════════════
        // PROCESSAR ACESSO EM BACKGROUND (ctx.waitUntil)
        // ═══════════════════════════════════════════════════════════════════
        // Liberar acesso, registrar venda, enviar email - tudo em background
        // Cliente recebe resposta IMEDIATAMENTE após PaymentIntent confirmado

        ctx.waitUntil((async () => {
            try {
                // Só libera acesso se o pagamento foi aprovado!
                if (paymentIntent.status !== 'succeeded') {
                    console.warn('Pagamento não aprovado, acesso não liberado:', paymentIntent.status)
                    return
                }
                let userId: string = resolvedUserId

                if (productType === 'app') {
                    // FLUXO PARA APPS
                    const orderBumpProductIds = orderBumpProductIdsData
                    const appProducts = appProductsData

                    // Se resolvedUserId falhou no sync (raro), tentar novamente aqui
                    if (!userId) {
                        const authData = await createCustomerUser(supabase, env, {
                            email: customerEmail,
                            name: customerName,
                            phone: customerPhone,
                            created_via: 'purchase'
                        })
                        userId = authData.user.id
                    }

                    // upsert app_users para novos usuários criados sincronamente
                    if (newUserCreated) {
                        const { error: appUserUpsertError } = await supabase.from('app_users').upsert({
                            user_id: userId,
                            email: customerEmail,
                            full_name: customerName,
                            phone: customerPhone,
                            application_id: applicationId,
                            status: 'active',
                            created_at: new Date().toISOString(),
                        }, {
                            onConflict: 'application_id,email',
                            ignoreDuplicates: false
                        })
                        if (appUserUpsertError) {
                            console.error('app_users upsert failed:', appUserUpsertError.message, appUserUpsertError.code)
                        }
                    }

                    // Liberar acesso aos produtos
                    if (appProducts && Array.isArray(appProducts) && appProducts.length > 0) {
                        const productsToGrant = (() => {
                            let filtered = appProducts as Array<{ id: string }>
                            // Filtrar pelos módulos configurados na funnel page (se houver)
                            if (funnelSelectedModulesData && funnelSelectedModulesData.length > 0) {
                                filtered = filtered.filter((p: any) => funnelSelectedModulesData!.includes(p.id))
                                console.log(`🔒 selected_modules: liberando ${filtered.length}/${appProducts.length} módulos`)
                            }
                            // Excluir produtos de order bump (têm acesso separado)
                            if (orderBumpProductIds.length > 0) {
                                filtered = filtered.filter((p: any) => !orderBumpProductIds.includes(p.id))
                            }
                            return filtered
                        })()

                        const accessRecords = productsToGrant.map((product: any, index: number) => ({
                            user_id: userId,
                            product_id: product.id,
                            application_id: applicationId,
                            access_type: 'purchase',
                            is_active: true,
                            payment_id: paymentIntent.id,
                            payment_method: 'card',
                            payment_status: 'completed',
                            purchase_price: totalChargeAmount,
                            stripe_customer_id: stripeCustomer.id,
                            stripe_payment_method_id: paymentMethodId,
                            payout_schedule: producerPayoutSchedule,
                            created_at: new Date().toISOString(),
                            // Salvar thankyou_token no primeiro registro atomicamente
                            // para que process-upsell encontre stripe_customer_id + token juntos
                            ...(index === 0 ? {
                                thankyou_token: thankyouToken,
                                thankyou_token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                                thankyou_max_views: 5,
                            } : {}),
                        }))

                        const { data: batchAccess } = await supabase
                            .from('user_product_access')
                            .upsert(accessRecords, {
                                onConflict: 'user_id,product_id',
                                ignoreDuplicates: false
                            })
                            .select('id')

                        // sale_location + analytics: sempre gravar quando pagamento aprovado,
                        // independente de quantos módulos foram liberados
                        const bgTasks = [
                            supabase.from('sale_locations').insert({
                                user_id: sellerOwnerId,
                                customer_email: customerEmail,
                                amount: totalChargeAmount,
                                currency: currency,
                                payment_method: 'card',
                                customer_ip: clientIP,
                                checkout_id: checkoutId || null,
                                product_id: productId || null,
                                user_product_access_id: (Array.isArray(batchAccess) && batchAccess.length > 0 ? (batchAccess as any[])[0]?.id : null) || null,
                                sale_date: new Date().toISOString(),
                                country: geoData.country,
                                region: geoData.region,
                                city: geoData.city,
                            }),
                        ]

                        // Registrar conversão em checkout_analytics se houver checkoutId
                        if (checkoutId) {
                            bgTasks.push(
                                supabase.from('checkout_analytics').insert({
                                    checkout_id: checkoutId,
                                    event_type: 'conversion',
                                    session_id: sessionId || null,
                                    created_at: new Date().toISOString(),
                                })
                            )
                        }

                        await Promise.allSettled(bgTasks)
                    }

                    // ─── Liberar acesso aos módulos de order bump comprados ───────────
                    // Se o bump é um produto dentro do mesmo app, libera acesso normalmente.
                    const bumpModulesToGrant = purchasedBumpModulesData.filter(
                        b => appProductsData.some(p => p.id === b.productId)
                    )
                    if (bumpModulesToGrant.length > 0) {
                        console.log(`🛒 order bump modules: liberando ${bumpModulesToGrant.length} módulo(s) comprado(s)`)
                        const bumpAccessRecords = bumpModulesToGrant.map(b => ({
                            user_id: userId,
                            product_id: b.productId,
                            application_id: applicationId,
                            access_type: 'purchase',
                            is_active: true,
                            payment_id: paymentIntent.id,
                            payment_method: 'card',
                            payment_status: 'completed',
                            purchase_price: b.price,
                            stripe_customer_id: stripeCustomer.id,
                            stripe_payment_method_id: paymentMethodId,
                            payout_schedule: producerPayoutSchedule,
                            created_at: new Date().toISOString(),
                        }))
                        const { error: bumpAccessError } = await supabase
                            .from('user_product_access')
                            .upsert(bumpAccessRecords, {
                                onConflict: 'user_id,product_id',
                                ignoreDuplicates: false
                            })
                        if (bumpAccessError) {
                            console.error('❌ bump module access upsert failed:', bumpAccessError)
                        } else {
                            console.log('✅ bump module access granted:', bumpModulesToGrant.map(b => b.productId))
                        }
                    }

                } else {
                    // FLUXO PARA MARKETPLACE

                    // user_id já resolvido sincronamente antes do ctx.waitUntil
                    // Se falhou (raro), tentar novamente aqui
                    if (!userId) {
                        const authData = await createCustomerUser(supabase, env, {
                            email: customerEmail,
                            name: customerName,
                            phone: customerPhone,
                            created_via: 'purchase'
                        })
                        userId = authData.user.id
                    }

                    // Step 2: Criar/atualizar member profile (sempre, independente do auth)
                    const { data: memberProfileData, error: memberProfileError } = await supabase
                        .from('member_profiles')
                        .upsert({
                            email: customerEmail,
                            name: customerName,
                            phone: customerPhone,
                            product_id: productId,
                        }, {
                            onConflict: 'email,product_id',
                            ignoreDuplicates: false
                        })
                        .select('id, email')
                        .single()

                    if (memberProfileError) {
                        console.error('❌ member_profiles upsert failed:', memberProfileError)
                    } else {
                        console.log('✅ member_profile created/updated:', memberProfileData)
                    }

                    // Step 3: Registrar acesso na tabela correta (user_member_area_access)
                    // Só se temos um userId válido (auth user criado ou já existente com ID conhecido)
                    if (userId) {
                        const { data: memberAreaAccess, error: memberAreaAccessError } = await supabase
                            .from('user_member_area_access')
                            .upsert({
                                user_id: userId,
                                member_area_id: productId,
                                access_type: 'purchase',
                                is_active: true,
                                payment_id: paymentIntent.id,
                                payment_method: 'card',
                                payment_status: 'completed',
                                purchase_price: totalChargeAmount,
                                stripe_customer_id: stripeCustomer.id,
                                stripe_payment_method_id: paymentMethodId,
                                thankyou_token: thankyouToken,
                                thankyou_token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                                thankyou_max_views: 5,
                                payout_schedule: producerPayoutSchedule,
                                created_at: new Date().toISOString(),
                            }, {
                                onConflict: 'user_id,member_area_id',
                                ignoreDuplicates: false
                            })
                            .select('id')
                            .single()

                        if (memberAreaAccessError) {
                            console.error('❌ user_member_area_access upsert failed:', memberAreaAccessError)
                        } else {
                            console.log('✅ user_member_area_access created:', memberAreaAccess?.id)
                        }
                    }

                    // Step 4: Registrar venda em sale_locations (sempre que temos sellerOwnerId)
                    // Independente do acesso — se o pagamento foi aprovado, a venda deve ser registrada
                    if (sellerOwnerId) {
                        const saleLocationInsert = supabase.from('sale_locations').insert({
                            user_id: sellerOwnerId,
                            customer_email: customerEmail,
                            amount: totalChargeAmount,
                            currency: currency,
                            payment_method: 'card',
                            customer_ip: clientIP,
                            checkout_id: checkoutId || null,
                            product_id: productId || null,
                            sale_date: new Date().toISOString(),
                            country: geoData.country,
                            region: geoData.region,
                            city: geoData.city,
                        })

                        // Registrar conversion tracking se houver checkoutId
                        if (checkoutId) {
                            await Promise.allSettled([
                                saleLocationInsert,
                                supabase.from('checkout_analytics').insert({
                                    checkout_id: checkoutId,
                                    event_type: 'conversion',
                                    session_id: sessionId || null,
                                    created_at: new Date().toISOString(),
                                })
                            ])
                        } else {
                            const { error: saleLocationError } = await saleLocationInsert
                            if (saleLocationError) {
                                console.error('❌ sale_locations insert failed:', saleLocationError)
                            } else {
                                console.log('✅ sale_location inserted for checkout:', checkoutId)
                            }
                        }
                    } else {
                        console.warn('⚠️ sellerOwnerId is null — sale_locations not inserted')
                    }
                }
            } catch (bgError: any) {
                console.error('Background access grant failed:', bgError)
                // Não afeta o cliente - PaymentIntent já foi confirmado
            }
        })())

        // ═══════════════════════════════════════════════════════════════════
        // DETERMINAR REDIRECT URL (upsell ou login)
        // ═══════════════════════════════════════════════════════════════════

        let redirectUrl: string | null = null

        if (checkoutId) {
            // 1. Verificar se há configuração de redirect na funnel page vinculada diretamente ao checkout
            const { data: checkoutFunnelPage } = await supabase
                .from('funnel_pages')
                .select('id, settings')
                .eq('checkout_id', checkoutId)
                .eq('page_type', 'checkout')
                .maybeSingle() as any

            let pageSettings = (checkoutFunnelPage as any)?.settings

            // 2. Fallback via produto -> funil -> funnel_pages (se não encontrou ou não tem redirect)
            if (!pageSettings?.post_purchase_page_id && !pageSettings?.post_purchase_redirect_url) {
                const productOwnerId = applicationId || productId
                if (productOwnerId) {
                    const { data: funnels } = await supabase
                        .from('funnels')
                        .select('id')
                        .eq('product_id', productOwnerId)
                        .limit(1)
                        .maybeSingle() as any

                    if ((funnels as any)?.id) {
                        const { data: allFunnelPages } = await supabase
                            .from('funnel_pages')
                            .select('id, settings, page_type, checkout_id')
                            .eq('funnel_id', (funnels as any).id) as any

                        const funnelCheckoutPage = (allFunnelPages as any[])?.find((p: any) =>
                            p.page_type === 'checkout' ||
                            p.checkout_id === checkoutId ||
                            p.settings?.post_purchase_page_id ||
                            p.settings?.post_purchase_redirect_url
                        )

                        if (funnelCheckoutPage?.settings) {
                            pageSettings = funnelCheckoutPage.settings
                        }
                    }
                }
            }

            if (pageSettings) {
                const s = pageSettings

                if (s.post_purchase_page_id) {
                    // Redirecionar para uma página específica do funil
                    const { data: targetPage } = await supabase
                        .from('funnel_pages')
                        .select('external_url, page_type')
                        .eq('id', s.post_purchase_page_id)
                        .maybeSingle() as any

                    if ((targetPage as any)?.external_url) {
                        const sep = (targetPage as any).external_url.includes('?') ? '&' : '?'
                        redirectUrl = `${(targetPage as any).external_url}${sep}purchase_id=${purchaseId}&token=${thankyouToken}`
                    } else if ((targetPage as any)?.page_type === 'thankyou') {
                        // Página de obrigado interna (sem external_url)
                        redirectUrl = `https://app.clicknich.com/thankyou/${s.post_purchase_page_id}?purchase_id=${purchaseId}&token=${thankyouToken}`
                    }
                } else if (s.post_purchase_redirect_url) {
                    // URL direta (login page ou URL personalizada)
                    const url = s.post_purchase_redirect_url as string
                    const sep = url.includes('?') ? '&' : '?'
                    redirectUrl = `${url}${sep}purchase_id=${purchaseId}&token=${thankyouToken}`
                }
            }

        }

        // Fallback para login do produto se nada configurado
        if (!redirectUrl) {
            if (productType === 'app') {
                redirectUrl = `/access/${productSlug}`
            } else {
                redirectUrl = `/members-login/${productSlug}`
            }
        }

        // ═══...
        // UTMify TRACKING (background)
        // ═══...

        if (sellerOwnerId) {
            ctx.waitUntil(trackUtmify(
                supabase, sellerOwnerId, productId, applicationId,
                paymentIntent.id, productName, customerName, customerEmail,
                customerPhone, clientIP, totalChargeAmount, currency, trackingParameters,
                checkoutId
            ))
        }

        // ═══════════════════════════════════════════════════════════════════
        // ENVIAR EMAIL DE ACESSO (background)
        // ═══════════════════════════════════════════════════════════════════

        if (purchaseId && customerEmail) {
            ctx.waitUntil(sendCompleteAccessEmail(
                env, supabase, customerEmail, customerName, productType,
                applicationId, productId, productSlug, emailGrantedProductIds
            ))
        }

        // ═══════════════════════════════════════════════════════════════════
        // SALVAR CREDENCIAIS NO KV SINCRONAMENTE (antes de retornar)
        // Garante que process-upsell encontre stripe_customer_id + token
        // mesmo que o ctx.waitUntil ainda não tenha terminado de escrever no DB
        // ═══════════════════════════════════════════════════════════════════
        if (env.CACHE && thankyouToken && stripeCustomer?.id) {
            try {
                await env.CACHE.put(
                    `upsell_token:${thankyouToken}`,
                    JSON.stringify({
                        stripe_customer_id: stripeCustomer.id,
                        stripe_payment_method_id: paymentMethodId,
                        purchase_id: purchaseId,
                        // user_id resolvido sincronamente — process-upsell usa direto sem esperar DB
                        user_id: resolvedUserId || null,
                    }),
                    { expirationTtl: 7 * 24 * 60 * 60 } // 7 dias
                )
            } catch (kvErr) {
                console.warn('KV write failed (non-fatal):', kvErr)
            }
        }

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

        // ═══ UTMify REFUSED TRACKING ═══════════════════════════════════════
        // Disparar evento 'refused' para integrações que o habilitaram
        if (sellerOwnerId) {
            const supabaseForRefused = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
            const clientIPForRefused = request.headers.get('cf-connecting-ip') || 'unknown'
            const { data: allIntegrations } = await supabaseForRefused
                .from('utmify_integrations')
                .select('*')
                .eq('user_id', sellerOwnerId)
                .eq('is_active', true)

            const matchingIntegrations = (allIntegrations || []).filter((integration: any) => {
                const events: string[] = integration.events || []
                if (!events.includes('refused')) return false
                const products: { id: string }[] = integration.products || []
                if (products.length === 0) return true
                return products.some((p: any) => p.id === productId || p.id === applicationId)
            })

            if (matchingIntegrations.length > 0) {
                const refusedBody = {
                    orderId: checkoutId ? `${checkoutId}_${customerEmail}` : `refused_${customerEmail}_${Date.now()}`,
                    platform: 'Clicknich',
                    paymentMethod: 'credit_card',
                    status: 'refused',
                    createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
                    approvedDate: null,
                    refundedAt: null,
                    customer: {
                        name: customerName || null,
                        email: customerEmail,
                        phone: customerPhone || null,
                        document: null,
                        ip: clientIPForRefused !== 'unknown' ? clientIPForRefused : undefined,
                    },
                    products: productId ? [{ id: productId, name: null, planId: null, planName: null, quantity: 1, priceInCents: 0 }] : [],
                    trackingParameters: trackingParameters ? {
                        src: trackingParameters.src || null,
                        sck: trackingParameters.sck || null,
                        utm_source: trackingParameters.utm_source || null,
                        utm_campaign: trackingParameters.utm_campaign || null,
                        utm_medium: trackingParameters.utm_medium || null,
                        utm_content: trackingParameters.utm_content || null,
                        utm_term: trackingParameters.utm_term || null,
                    } : null,
                    commission: { totalPriceInCents: 0, gatewayFeeInCents: 0, userCommissionInCents: 0, currency: 'BRL' },
                    isTest: false,
                }

                await Promise.allSettled(matchingIntegrations.map(async (integration: any) => {
                    try {
                        const res = await fetch('https://api.utmify.com.br/api-credentials/orders', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'x-api-token': integration.api_token },
                            body: JSON.stringify(refusedBody),
                        })
                        console.log(res.ok ? `✅ UTMify refused fired [${integration.name}]` : `❌ UTMify refused failed [${integration.name}]`)
                    } catch (e: any) {
                        console.warn(`UTMify refused error [${integration.name}]:`, e.message)
                    }
                }))
            }
        }
        // ══════════════════════════════════════════════════════════════════

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
    trackingParameters: any,
    checkoutId?: string
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
        console.log(`UTMify DEBUG: finalPrice=${finalPrice}, priceInCents=${priceInCents}`)

        // Taxa real do Stripe: 2.9% + taxa fixa por moeda
        const stripePercentFee = Math.round(priceInCents * 0.029)
        // Taxa fixa ajustada por moeda (USD: 30¢, BRL: aproximadamente 120¢)
        const stripeFixedFee = currency.toUpperCase() === 'USD' ? 30 : 120
        const gatewayFeeInCents = stripePercentFee + stripeFixedFee
        const userCommissionInCents = Math.max(0, priceInCents - gatewayFeeInCents)


        const stableOrderId = checkoutId ? `${checkoutId}_${customerEmail}` : paymentIntentId
        const utmifyBody = {
            orderId: stableOrderId,
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
                console.log(`UTMify PAYLOAD [${integration.name}]:`, JSON.stringify(utmifyBody, null, 2))

                const res = await fetch('https://api.utmify.com.br/api-credentials/orders', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-token': integration.api_token,
                    },
                    body: JSON.stringify(utmifyBody),
                })
                if (!res.ok) {
                    const errBody = await res.text().catch(() => '(no body)')
                    console.warn(`❌ UTMify error [${integration.name}] status=${res.status}:`, errBody)
                } else {
                    console.log(`✅ UTMify paid fired [${integration.name}]`)
                }
            } catch (e: any) {
                console.warn(`UTMify failed [${integration.name}]:`, e.message)
            }
        }))
    } catch (e: any) {
        console.warn('UTMify tracking failed:', e.message)
    }
}

/**
 * Envio de email de acesso pós-compra via Resend
 */
async function sendAccessEmail(
    env: any,
    customerEmail: string,
    customerName: string,
    productName: string,
    loginUrl: string,
    appLanguage?: string | null
) {
    try {
        const resendApiKey = env.RESEND_API_KEY
        if (!resendApiKey) {
            console.warn('RESEND_API_KEY not configured; skipping access email')
            return
        }

        const lang = appLangToEmailLang(appLanguage)
        const { subject, html } = buildAccessEmailHtml({
            lang,
            customerName: customerName || customerEmail,
            customerEmail,
            productName,
            productsHtml: '',
            loginUrl,
        })

        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: env.RESEND_FROM || 'noreply@clicknich.com',
                to: customerEmail,
                subject,
                html,
            }),
        })

        if (!response.ok) {
            const body = await response.text()
            console.warn('Access email send failed:', body)
        } else {
            console.log('Access email sent to:', customerEmail)
        }
    } catch (e: any) {
        console.warn('sendAccessEmail error:', e.message)
    }
}

/**
 * Envio de email completo pós-compra (igual ao botão "Send Email" no frontend)
 */
async function sendCompleteAccessEmail(
    env: any,
    supabase: any,
    customerEmail: string,
    customerName: string,
    productType: string,
    applicationId: string | null,
    productId: string,
    productSlug: string,
    grantedProductIds: string[] = []
) {
    try {
        let appName = '', marketplaceName = '', loginUrl = ''
        const customerProductsList: string[] = []

        console.log('sendCompleteAccessEmail DEBUG:', {
            productType,
            applicationId,
            productId,
            productSlug,
            grantedProductIds: grantedProductIds.length
        })

        let appLanguage: string | null = null

        if (productType === 'app' && applicationId && applicationId.trim() !== '') {
            console.log('🔵 BRANCH: App product detected')
            // Buscar dados da aplicação e nomes dos módulos em paralelo
            const [appResult, productsResult] = await Promise.all([
                supabase
                    .from('applications')
                    .select('name, slug, language')
                    .eq('id', applicationId)
                    .single(),
                grantedProductIds.length > 0
                    ? supabase
                        .from('products')
                        .select('name')
                        .in('id', grantedProductIds)
                    : Promise.resolve({ data: [] }),
            ])

            const appData = appResult.data
            console.log('App data from DB:', appData)

            if (appData) {
                appName = appData.name
                appLanguage = appData.language || null
                loginUrl = `${env.FRONTEND_URL || 'https://app.clicknich.com'}/access/${appData.slug || productSlug}`
                console.log('✅ App data processed:', { appName, loginUrl })
            } else {
                console.log('❌ No app data found')
            }

            // Usar nomes dos módulos que foram AGORA liberados (clientes novos e existentes)
            const productsData = productsResult.data || []
            productsData.forEach((p: any) => {
                customerProductsList.push(`• ${p.name}`)
            })
            console.log('📦 Módulos no email:', customerProductsList.length)
        } else if (productType === 'marketplace') {
            console.log('🟡 BRANCH: Marketplace product detected')
            // Buscar dados do produto marketplace
            const { data: productData } = await supabase
                .from('marketplace_products')
                .select('name, slug')
                .eq('id', productId)
                .single()

            console.log('Marketplace data from DB:', productData)

            if (productData) {
                marketplaceName = productData.name
                loginUrl = `${env.FRONTEND_URL || 'https://app.clicknich.com'}/members-login/${productData.slug || productSlug}`
                console.log('✅ Marketplace data processed:', { marketplaceName, loginUrl })
            } else {
                console.log('❌ No marketplace data found')
            }
        } else {
            console.log('🔴 BRANCH: No matching condition', { productType, applicationId })
        }

        const productName = appName || marketplaceName || 'Platform'
        const productsHtml = customerProductsList.length > 0
            ? `<ul style="list-style:none;padding:0;margin:0">${customerProductsList.map(p => `<li style="padding:4px 0;color:#666">${p}</li>`).join('')}</ul>`
            : ''

        console.log('📧 EMAIL FINAL VALUES:', {
            productName,
            appName,
            marketplaceName,
            loginUrl,
            productType,
            buttonText: productType === 'app' ? 'Access App Login' : 'Access Members Area'
        })

        const lang = appLangToEmailLang(appLanguage)
        const { subject, html } = buildAccessEmailHtml({
            lang,
            customerName: customerName || customerEmail,
            customerEmail,
            productName,
            productsHtml,
            loginUrl,
        })

        const resendApiKey = env.RESEND_API_KEY
        if (!resendApiKey) {
            console.warn('⚠️ RESEND_API_KEY not set, skipping email')
            return
        }

        const fromAddress = env.RESEND_FROM || 'noreply@clicknich.com'

        const emailResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: fromAddress,
                to: customerEmail,
                subject: subject,
                html: html,
            }),
        })

        if (!emailResponse.ok) {
            const body = await emailResponse.text()
            console.warn('❌ Access email failed (Resend):', body)
        } else {
            const result = await emailResponse.json()
            console.log('✅ Access email sent to:', customerEmail, result)
        }
    } catch (e: any) {
        console.warn('sendCompleteAccessEmail error:', e.message)
    }
}
