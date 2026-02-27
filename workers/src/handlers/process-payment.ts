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
            paymentMethodId: paymentMethodId ? 'present' : 'missing'
        })

        // Inicializar clientes
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
        const stripe = createStripeClient(env.STRIPE_SECRET_KEY)

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
            const [
                productResult,
                checkoutResult,
                stripeResult,
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
                stripe.customers.list({ email: customerEmail, limit: 1 }),
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

        // Calcular juros server-side (mesmo cálculo do frontend): até 6x sem juros, >6x = 2.5%/mês simples
        const installmentCount = Math.min(Math.max(1, Math.floor(installments)), 12)
        const totalChargeAmount = installmentCount > 6
            ? parseFloat((baseTotal * (1 + 0.025 * installmentCount)).toFixed(2))
            : baseTotal

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

        const paymentIntent = await stripe.paymentIntents.create(
            {
                amount: Math.round(totalChargeAmount * 100),
                currency: currency,
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
        // ⚡ OTIMIZAÇÃO: Gerar IDs ANTES de processar acesso (response streaming)
        // ═══════════════════════════════════════════════════════════════════
        const purchaseId = crypto.randomUUID()
        const thankyouToken = crypto.randomUUID()

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
                let userId: string = ''

                if (productType === 'app') {
                    // FLUXO PARA APPS
                    const existingAppUser = existingAppUserData
                    const orderBumpProductIds = orderBumpProductIdsData
                    const appProducts = appProductsData

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

                        if (authError) {
                            // Email já existe no auth (comprou outro produto antes) — buscar o user_id existente
                            const isEmailExists = authError.code === 'email_exists'
                                || (authError.message || '').toLowerCase().includes('already been registered')
                                || (authError.message || '').toLowerCase().includes('already registered')
                            if (!isEmailExists) throw authError

                            const { data: foundUser } = await supabase.auth.admin.getUserByEmail(customerEmail)
                            if (!foundUser?.user) throw new Error('Auth user exists but could not be found: ' + customerEmail)
                            userId = foundUser.user.id
                            console.log('ℹ️ Auth user already exists for app purchase:', customerEmail)
                        } else {
                            userId = authData.user.id
                        }

                        // upsert app_users — usa email como chave de conflito pois user_id pode ser null em registros antigos
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

                        const accessRecords = productsToGrant.map((product: any) => ({
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
                            created_at: new Date().toISOString(),
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

                        if (batchAccess && Array.isArray(batchAccess) && batchAccess.length > 0) {
                            bgTasks.push(
                                supabase.from('user_product_access').update({
                                    thankyou_token: thankyouToken,
                                    thankyou_token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                                    thankyou_max_views: 5
                                }).eq('id', batchAccess[0].id)
                            )
                        }

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

                    // Step 1: Criar/verificar usuário auth — nunca lançar erro se email já existe
                    // (ex: cliente que já comprou outro produto ou já tem conta)
                    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                        email: customerEmail,
                        email_confirm: true,
                        user_metadata: {
                            created_via: 'purchase',
                            name: customerName,
                            phone: customerPhone,
                        },
                    })

                    if (authError) {
                        const isEmailExists = authError.code === 'email_exists'
                            || (authError.message || '').toLowerCase().includes('already been registered')
                            || (authError.message || '').toLowerCase().includes('already registered')
                        if (!isEmailExists) throw authError
                        // Email já existe — continuamos sem userId (acesso já foi dado antes)
                        console.log('ℹ️ Auth user already exists for:', customerEmail)
                    } else {
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
            // Apps usam /access/{slug}, Marketplace usa /members-login/{slug}
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
    loginUrl: string
) {
    try {
        const resendApiKey = env.RESEND_API_KEY
        if (!resendApiKey) {
            console.warn('RESEND_API_KEY not configured; skipping access email')
            return
        }

        const fromAddress = env.RESEND_FROM || 'noreply@clicknich.com'

        const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:40px;text-align:center;border-radius:8px 8px 0 0"><h1 style="color:white;margin:0;font-size:28px">Access Granted</h1></div><div style="background:#f9fafb;padding:40px;border-radius:0 0 8px 8px"><p style="color:#333;font-size:16px">Hi <strong>${customerName}</strong>,</p><p style="color:#666;font-size:14px;line-height:1.6">Great news! You now have access to:</p><div style="background:white;padding:20px;border-radius:8px;margin:20px 0;border-left:4px solid #667eea"><p style="color:#333;font-size:14px;margin:0"><strong>${productName}</strong></p></div>${loginUrl ? `<div style="margin:30px 0;text-align:center"><a href="${loginUrl}" style="background:#667eea;color:white;padding:14px 32px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold;font-size:16px">Access Members Area</a></div>` : ''}<div style="background:#f3f4f6;padding:15px;border-radius:6px;margin-top:20px"><p style="color:#666;font-size:13px;margin:0"><strong>Access instructions:</strong><br>1. Click the button above<br>2. Email: <strong>${customerEmail}</strong><br>3. If first access, create your password</p></div></div></div>`

        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: fromAddress,
                to: customerEmail,
                subject: `Your access to ${productName} is ready`,
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

        if (productType === 'app' && applicationId && applicationId.trim() !== '') {
            console.log('🔵 BRANCH: App product detected')
            // Buscar dados da aplicação e nomes dos módulos em paralelo
            const [appResult, productsResult] = await Promise.all([
                supabase
                    .from('applications')
                    .select('name, slug')
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

        const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:40px;text-align:center;border-radius:8px 8px 0 0"><h1 style="color:white;margin:0;font-size:28px">Access Granted</h1></div><div style="background:#f9fafb;padding:40px;border-radius:0 0 8px 8px"><p style="color:#333;font-size:16px">Hi <strong>${customerName || customerEmail}</strong>,</p><p style="color:#666;font-size:14px;line-height:1.6">Great news! You now have access to:</p><div style="background:white;padding:20px;border-radius:8px;margin:20px 0;border-left:4px solid #667eea"><p style="color:#333;font-size:14px;margin-bottom:10px"><strong>${productName}</strong></p>${productsHtml}</div>${loginUrl ? `<div style="margin:30px 0;text-align:center"><a href="${loginUrl}" style="background:#667eea;color:white;padding:14px 32px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold;font-size:16px">Access Now</a></div>` : ''}<div style="background:#f3f4f6;padding:15px;border-radius:6px;margin-top:20px"><p style="color:#666;font-size:13px;margin:0"><strong>Access instructions:</strong><br>1. Click the button above<br>2. Email: <strong>${customerEmail}</strong><br>3. If first access, create your password</p></div></div></div>`

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
                subject: `Your access to ${productName} is ready`,
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
