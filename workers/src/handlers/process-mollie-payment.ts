/**
 * Handler: Process Mollie Payment
 * 
 * Ações:
 * - (sem action)      → Cria pagamento Mollie, retorna checkoutUrl (redirect flow)
 * - action: 'verify'  → Verifica pagamento retornado da Mollie e libera acesso
 */

import { createClient } from '../lib/supabase'
import { createMollieClient, toMollieAmount, currencyToLocale, MOLLIE_RECURRING_METHODS } from '../lib/mollie'
import { createCustomerUser } from './customer-auth'
import type { Env } from '../index'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(data: any, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
}

/**
 * Busca enabled_methods do provedor Mollie global
 */
async function resolveMollieEnabledMethods(supabase: any): Promise<string[]> {
    try {
        const { data } = await supabase
            .from('payment_providers')
            .select('enabled_methods')
            .eq('type', 'mollie')
            .eq('is_active', true)
            .order('is_global_default', { ascending: false })
            .limit(1)
            .maybeSingle()
        return data?.enabled_methods || []
    } catch {
        return []
    }
}

export async function handleProcessMolliePayment(
    request: Request,
    env: Env,
    ctx: ExecutionContext
): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    const body = await request.json().catch(() => ({})) as any
    const {
        action,
        paymentId: incomingPaymentId,
        productId,
        productType = 'marketplace',
        applicationId,
        checkoutId,
        customerEmail,
        customerName,
        customerPhone,
        mollieMethod,          // ex: 'ideal', 'bancontact'
        totalAmount,           // valor total calculado pelo frontend
        selectedOrderBumps = [],
        sessionId,
        trackingParameters,
    } = body

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
    const frontendUrl = env.FRONTEND_URL || 'https://app.clicknich.com'

    try {
        // ══════════════════════════════════════════════════════════════════
        // ACTION: VERIFY — verificar pagamento após redirect do Mollie
        // ══════════════════════════════════════════════════════════════════
        if (action === 'verify' && incomingPaymentId) {
            return await verifyMolliePayment(incomingPaymentId, body, env, ctx, supabase, frontendUrl)
        }

        // ══════════════════════════════════════════════════════════════════
        // ACTION: CREATE — criar pagamento Mollie, redirecionar cliente
        // ══════════════════════════════════════════════════════════════════
        if (!customerEmail) return json({ error: 'customerEmail é obrigatório' }, 400)
        if (!mollieMethod) return json({ error: 'mollieMethod é obrigatório' }, 400)

        // Resolver preço
        let finalPrice = 0
        let productName = ''
        let currency = 'EUR'
        let sellerOwnerId: string | null = null
        let productSlug = productId

        // Tentar KV session primeiro
        let kvSession: any = null
        if (sessionId && env.CACHE) {
            try { kvSession = await env.CACHE.get(`session:${sessionId}`, 'json') } catch { }
        }

        if (kvSession) {
            finalPrice = kvSession.finalPrice
            productName = kvSession.productName
            currency = kvSession.currency
            sellerOwnerId = kvSession.sellerOwnerId
        } else {
            // Fallback: buscar do DB
            if (productType === 'app') {
                const [appRes, ckRes] = await Promise.all([
                    supabase.from('applications').select('name, slug, owner_id').eq('id', applicationId || productId).single(),
                    checkoutId ? supabase.from('checkouts').select('custom_price, currency').eq('id', checkoutId).single() : Promise.resolve({ data: null }),
                ])
                if (appRes.error) return json({ error: 'App não encontrado' }, 404)
                const app = appRes.data as any
                const ck = (ckRes as any).data as any
                productName = app.name
                sellerOwnerId = app.owner_id
                productSlug = app.slug || productId
                finalPrice = ck?.custom_price || 0
                currency = ck?.currency || 'EUR'
            } else {
                const [prodRes, ckRes] = await Promise.all([
                    supabase.from('marketplace_products').select('name, price, currency, slug, owner_id').eq('id', productId).single(),
                    checkoutId ? supabase.from('checkouts').select('custom_price, currency').eq('id', checkoutId).single() : Promise.resolve({ data: null }),
                ])
                if (prodRes.error) return json({ error: 'Produto não encontrado' }, 404)
                const prod = prodRes.data as any
                const ck = (ckRes as any).data as any
                productName = prod.name
                sellerOwnerId = prod.owner_id
                productSlug = prod.slug || productId
                currency = ck?.currency || prod.currency || 'EUR'
                finalPrice = ck?.custom_price || prod.price
            }
        }

        // Adicionar order bumps selecionados
        const selectedBumpIds: string[] = Array.isArray(selectedOrderBumps)
            ? selectedOrderBumps.map((b: any) => b.id).filter(Boolean)
            : []
        if (selectedBumpIds.length > 0 && kvSession?.bumpOffers) {
            for (const offer of kvSession.bumpOffers) {
                if (selectedBumpIds.includes(offer.id) && offer.price > 0) {
                    finalPrice += offer.price
                }
            }
        }

        // Fallback: usar totalAmount enviado pelo frontend
        if (finalPrice <= 0 && totalAmount > 0) finalPrice = totalAmount

        if (finalPrice <= 0) return json({ error: 'Valor inválido' }, 400)

        // Resolver chave Mollie
        const mollieKey = await resolveMollieKey(supabase, sellerOwnerId)
        if (!mollieKey) return json({ error: 'Provedor Mollie não configurado' }, 503)

        const mollie = createMollieClient(mollieKey)

        // Gerar IDs internos
        const internalPaymentId = crypto.randomUUID()

        // URLs de redirect e webhook
        const webhookUrl = `https://api.clicknich.com/api/webhooks/mollie`
        const returnUrl = `${frontendUrl}/checkout/${checkoutId || productId}?mollie_return=1&paymentId=${internalPaymentId}`

        // Para métodos que suportam recorrência, criar/obter cliente Mollie
        // Isso habilita sequenceType: 'first' e gera um mandato após pagamento
        const supportsRecurring = MOLLIE_RECURRING_METHODS.has(mollieMethod)
        let mollieCustomerId: string | null = null
        if (supportsRecurring) {
            try {
                const customer = await mollie.getOrCreateCustomer(customerEmail, customerName || undefined)
                mollieCustomerId = customer.id
            } catch (e: any) {
                console.warn('[process-mollie-payment] Não foi possível criar Customer Mollie:', e.message)
            }
        }

        // Criar pagamento Mollie
        const paymentParams: any = {
            amount: toMollieAmount(finalPrice, currency),
            description: `${productName} — ${customerEmail}`,
            redirectUrl: returnUrl,
            webhookUrl,
            method: mollieMethod,
            locale: currencyToLocale(currency),
            metadata: {
                internal_payment_id: internalPaymentId,
                product_id: productId || '',
                product_type: productType,
                application_id: applicationId || '',
                checkout_id: checkoutId || '',
                customer_email: customerEmail,
                customer_name: customerName || '',
                customer_phone: customerPhone || '',
                session_id: sessionId || '',
                seller_id: sellerOwnerId || '',
                order_bumps: selectedBumpIds.join(','),
            },
        }
        if (supportsRecurring && mollieCustomerId) {
            paymentParams.sequenceType = 'first'
            paymentParams.customerId = mollieCustomerId
        }
        const molliePayment = await mollie.createPayment(paymentParams)

        // Salvar registro pendente no DB
        await supabase.from('mollie_payments').insert({
            id: internalPaymentId,
            mollie_payment_id: molliePayment.id,
            product_id: productId || null,
            product_type: productType,
            application_id: applicationId || null,
            checkout_id: checkoutId || null,
            customer_email: customerEmail,
            customer_name: customerName || null,
            customer_phone: customerPhone || null,
            amount: finalPrice,
            currency,
            method: mollieMethod,
            status: 'open',
            seller_id: sellerOwnerId || null,
            session_id: sessionId || null,
            tracking_parameters: trackingParameters || null,
            selected_order_bumps: selectedBumpIds,
            metadata: molliePayment.metadata || {},
            mollie_customer_id: mollieCustomerId || null,
            sequence_type: supportsRecurring ? 'first' : 'oneoff',
        })

        const checkoutUrl = molliePayment._links.checkout?.href
        if (!checkoutUrl) throw new Error('Mollie não retornou checkoutUrl')

        return json({
            success: true,
            paymentId: internalPaymentId,
            molliePaymentId: molliePayment.id,
            checkoutUrl,
        })

    } catch (err: any) {
        console.error('[process-mollie-payment] Error:', err)
        return json({ error: err.message || 'Erro ao processar pagamento Mollie' }, 500)
    }
}

/**
 * Verifica pagamento Mollie após redirect e libera acesso ao produto
 */
async function verifyMolliePayment(
    internalPaymentId: string,
    body: any,
    env: Env,
    ctx: ExecutionContext,
    supabase: any,
    frontendUrl: string
): Promise<Response> {
    // Buscar registro salvo
    const { data: record, error } = await supabase
        .from('mollie_payments')
        .select('*')
        .eq('id', internalPaymentId)
        .maybeSingle()

    if (error || !record) {
        return json({ error: 'Pagamento não encontrado' }, 404)
    }

    // Já foi processado
    if (record.status === 'paid' && record.access_granted) {
        const redirectUrl = record.product_type === 'app'
            ? `${frontendUrl}/access/${record.application_id}`
            : `${frontendUrl}/members-login/${record.product_id}`
        return json({ success: true, alreadyProcessed: true, redirectUrl })
    }

    // Buscar chave Mollie
    const mollieKey = await resolveMollieKey(supabase, record.seller_id)
    if (!mollieKey) return json({ error: 'Provedor Mollie não disponível' }, 503)

    const mollie = createMollieClient(mollieKey)
    const molliePayment = await mollie.getPayment(record.mollie_payment_id)

    if (molliePayment.status !== 'paid') {
        return json({
            success: false,
            status: molliePayment.status,
            message: molliePayment.status === 'open' ? 'Pagamento pendente' : 'Pagamento não concluído',
        })
    }

    // Pago! Atualizar status
    await supabase
        .from('mollie_payments')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', internalPaymentId)

    const purchaseId = crypto.randomUUID()
    const thankyouToken = crypto.randomUUID()

    // Liberar acesso em background
    ctx.waitUntil(
        grantMollieAccess(supabase, env, record, purchaseId, thankyouToken, frontendUrl)
    )

    // Resolver redirect via funnel_pages (igual ao Stripe), com fallback hardcoded
    let redirectUrl: string
    if (record.checkout_id) {
        const { data: funnelPage } = await supabase
            .from('funnel_pages')
            .select('settings')
            .eq('checkout_id', record.checkout_id)
            .eq('page_type', 'checkout')
            .maybeSingle()

        const pageSettings = funnelPage?.settings as any
        if (pageSettings?.post_purchase_page_id) {
            const { data: targetPage } = await supabase
                .from('funnel_pages')
                .select('external_url, page_type')
                .eq('id', pageSettings.post_purchase_page_id)
                .maybeSingle()

            if (targetPage?.external_url) {
                const sep = targetPage.external_url.includes('?') ? '&' : '?'
                redirectUrl = `${targetPage.external_url}${sep}purchase_id=${purchaseId}&token=${thankyouToken}`
            } else if (targetPage?.page_type === 'thankyou') {
                redirectUrl = `${frontendUrl}/thankyou/${pageSettings.post_purchase_page_id}?purchase_id=${purchaseId}&token=${thankyouToken}`
            } else {
                redirectUrl = record.product_type === 'app'
                    ? `${frontendUrl}/access/${record.application_id}`
                    : `${frontendUrl}/members-login/${record.product_id}`
            }
        } else if (pageSettings?.post_purchase_redirect_url) {
            const url = pageSettings.post_purchase_redirect_url as string
            const sep = url.includes('?') ? '&' : '?'
            redirectUrl = `${url}${sep}purchase_id=${purchaseId}&token=${thankyouToken}`
        } else {
            // Fallback: primeiro upsell ativo
            const { data: upsellOffer } = await supabase
                .from('checkout_offers')
                .select('page_id')
                .eq('checkout_id', record.checkout_id)
                .eq('is_active', true)
                .in('offer_type', ['upsell', 'downsell'])
                .order('offer_position', { ascending: true })
                .limit(1)
                .maybeSingle()

            if (upsellOffer?.page_id) {
                const { data: upsellPage } = await supabase
                    .from('funnel_pages')
                    .select('external_url')
                    .eq('id', upsellOffer.page_id)
                    .maybeSingle()

                if (upsellPage?.external_url) {
                    const sep = upsellPage.external_url.includes('?') ? '&' : '?'
                    redirectUrl = `${upsellPage.external_url}${sep}purchase_id=${purchaseId}&token=${thankyouToken}`
                } else {
                    redirectUrl = record.product_type === 'app'
                        ? `${frontendUrl}/access/${record.application_id}`
                        : `${frontendUrl}/members-login/${record.product_id}`
                }
            } else {
                redirectUrl = record.product_type === 'app'
                    ? `${frontendUrl}/access/${record.application_id}`
                    : `${frontendUrl}/members-login/${record.product_id}`
            }
        }
    } else {
        redirectUrl = record.product_type === 'app'
            ? `${frontendUrl}/access/${record.application_id}`
            : `${frontendUrl}/members-login/${record.product_id}`
    }

    return json({ success: true, purchaseId, thankyouToken, redirectUrl })
}

// Exportado para ser chamado também pelo webhook
export async function resolveMollieKey(supabase: any, ownerId: string | null): Promise<string | null> {
    try {
        if (ownerId) {
            const { data: userCfg } = await supabase
                .from('user_payment_config')
                .select('provider_id, override_platform_default')
                .eq('user_id', ownerId)
                .eq('override_platform_default', true)
                .maybeSingle()

            if (userCfg?.provider_id) {
                const { data: prov } = await supabase
                    .from('payment_providers')
                    .select('credentials')
                    .eq('id', userCfg.provider_id)
                    .eq('type', 'mollie')
                    .eq('is_active', true)
                    .maybeSingle()
                const key = prov?.credentials?.live_api_key || prov?.credentials?.api_key
                if (key) return key
            }
        }
        const { data: globalProv } = await supabase
            .from('payment_providers')
            .select('credentials')
            .eq('type', 'mollie')
            .eq('is_active', true)
            .order('is_global_default', { ascending: false })
            .limit(1)
            .maybeSingle()
        return globalProv?.credentials?.live_api_key || globalProv?.credentials?.api_key || null
    } catch {
        return null
    }
}

/**
 * Libera acesso ao produto após pagamento Mollie confirmado.
 * Comportamento idêntico ao Stripe: mesmas tabelas, selected_modules, order bumps.
 */
async function grantMollieAccess(
    supabase: any,
    env: Env,
    record: any,
    purchaseId: string,
    thankyouToken: string,
    frontendUrl: string
): Promise<void> {
    try {
        const {
            customer_email: customerEmail,
            customer_name: customerName,
            customer_phone: customerPhone,
            product_type: productType,
            product_id: productId,
            application_id: applicationId,
            checkout_id: checkoutId,
            amount,
            currency,
            method,
            session_id: sessionId,
            seller_id: sellerId,
            selected_order_bumps: selectedOrderBumps,
            mollie_payment_id: molliePaymentId,
            mollie_customer_id: mollieCustomerIdFromRecord,
        } = record

        // Resolver mandato Mollie para habilitar 1-click em upsells
        let mandateMollieCustomerId: string | null = mollieCustomerIdFromRecord || null
        let mandateMollieId: string | null = null
        if (mandateMollieCustomerId) {
            try {
                const mollieKey = await resolveMollieKey(supabase, sellerId || null)
                if (mollieKey) {
                    const mollie = createMollieClient(mollieKey)
                    const mandates = await mollie.listMandates(mandateMollieCustomerId)
                    const validMandate = mandates.find(m => m.status === 'valid') || mandates[0]
                    if (validMandate) {
                        mandateMollieId = validMandate.id
                        console.log(`[grantMollieAccess] Mandato Mollie encontrado: ${mandateMollieId}`)
                    }
                }
            } catch (e: any) {
                console.warn('[grantMollieAccess] Não foi possível buscar mandato:', e.message)
            }
        }

        // Plano de saque vigente
        let producerPayoutSchedule = 'D+5'
        if (sellerId) {
            const { data: pc } = await supabase
                .from('user_payment_config')
                .select('payout_schedule')
                .eq('user_id', sellerId)
                .maybeSingle()
            if (pc?.payout_schedule) producerPayoutSchedule = pc.payout_schedule
        }

        const totalAmount = Number(amount)

        // ═══════════════════════════════════════════════════════
        // FLUXO APP — idêntico ao Stripe
        // ═══════════════════════════════════════════════════════
        if (productType === 'app') {
            const selectedBumpIds: string[] = Array.isArray(selectedOrderBumps) ? selectedOrderBumps : []

            const [appRes, appUserRes, appProdsRes, orderBumpsRes, funnelPageRes] = await Promise.all([
                supabase.from('applications').select('name, slug, owner_id').eq('id', applicationId || productId).single(),
                supabase.from('app_users').select('user_id').eq('email', customerEmail).eq('application_id', applicationId).maybeSingle(),
                supabase.from('products').select('id').eq('application_id', applicationId),
                // Todos os order bumps do checkout (para saber quais excluir do acesso principal)
                checkoutId
                    ? supabase.from('checkout_offers')
                        .select('id, offer_product_id, offer_price, original_price')
                        .eq('checkout_id', checkoutId)
                        .eq('offer_type', 'order_bump')
                        .eq('is_active', true)
                    : Promise.resolve({ data: [] }),
                // selected_modules da funnel page
                checkoutId
                    ? supabase.from('funnel_pages')
                        .select('settings')
                        .eq('checkout_id', checkoutId)
                        .eq('page_type', 'checkout')
                        .maybeSingle()
                    : Promise.resolve({ data: null }),
            ])

            const app = appRes.data as any
            if (!app) return

            const appProducts: Array<{ id: string }> = (appProdsRes.data || []) as any[]
            const allBumps: any[] = (orderBumpsRes.data || []) as any[]
            const orderBumpProductIds: string[] = allBumps.map((b: any) => b.offer_product_id).filter(Boolean)

            // Módulos de order bump comprados pelo cliente nesta compra
            const purchasedBumpModules: Array<{ productId: string; price: number }> = allBumps
                .filter((b: any) => selectedBumpIds.includes(b.id) && b.offer_product_id)
                .map((b: any) => ({ productId: b.offer_product_id, price: b.offer_price ?? b.original_price ?? 0 }))

            // selected_modules da funnel page (null = liberar todos)
            const funnelSettings = (funnelPageRes as any)?.data?.settings
            const funnelSelectedModules: string[] | null =
                Array.isArray(funnelSettings?.selected_modules) && funnelSettings.selected_modules.length > 0
                    ? funnelSettings.selected_modules
                    : null

            // ── Criar/obter usuário ──────────────────────────────────────
            let userId = ''
            const existingAppUser = (appUserRes as any).data

            if (existingAppUser?.user_id) {
                userId = existingAppUser.user_id
            } else {
                const authData = await createCustomerUser(supabase, env, {
                    email: customerEmail,
                    name: customerName,
                    phone: customerPhone,
                    created_via: 'purchase'
                })

                userId = authData.user.id

                await supabase.from('app_users').upsert({
                    user_id: userId,
                    email: customerEmail,
                    full_name: customerName,
                    phone: customerPhone,
                    application_id: applicationId,
                    status: 'active',
                    created_at: new Date().toISOString(),
                }, { onConflict: 'application_id,email', ignoreDuplicates: false })

                // Enviar email com password reset link (para cliente criar sua própria senha)
                if (env.RESEND_API_KEY) {
                    const loginUrl = `${frontendUrl}/access/${app.slug || applicationId}`
                    await sendMollieAccessEmail(env, customerEmail, customerName, app.name, loginUrl)
                }
            }

            // ── Liberar módulos (com filtro selected_modules e exclusão de bumps) ──
            if (appProducts.length > 0) {
                let productsToGrant = [...appProducts]

                if (funnelSelectedModules && funnelSelectedModules.length > 0) {
                    productsToGrant = productsToGrant.filter(p => funnelSelectedModules.includes(p.id))
                    console.log(`🔒 Mollie selected_modules: liberando ${productsToGrant.length}/${appProducts.length} módulos`)
                }
                if (orderBumpProductIds.length > 0) {
                    productsToGrant = productsToGrant.filter(p => !orderBumpProductIds.includes(p.id))
                }

                const accessRecords = productsToGrant.map((p: any) => ({
                    user_id: userId,
                    product_id: p.id,
                    application_id: applicationId,
                    access_type: 'purchase',
                    is_active: true,
                    payment_id: molliePaymentId || record.id,
                    payment_method: method || 'mollie',
                    payment_status: 'completed',
                    purchase_price: totalAmount,
                    payout_schedule: producerPayoutSchedule,
                    created_at: new Date().toISOString(),
                }))

                const { data: batchAccess } = await supabase
                    .from('user_product_access')
                    .upsert(accessRecords, { onConflict: 'user_id,product_id', ignoreDuplicates: false })
                    .select('id')

                await Promise.allSettled([
                    supabase.from('sale_locations').insert({
                        user_id: sellerId || null,
                        customer_email: customerEmail,
                        amount: totalAmount,
                        currency,
                        payment_method: method || 'mollie',
                        customer_ip: null,
                        checkout_id: checkoutId || null,
                        product_id: productId || applicationId || null,
                        payout_schedule: producerPayoutSchedule,
                        user_product_access_id: Array.isArray(batchAccess) && batchAccess.length > 0 ? (batchAccess as any[])[0]?.id : null,
                        sale_date: new Date().toISOString(),
                        country: null,
                        region: null,
                        city: null,
                    }),
                    batchAccess && Array.isArray(batchAccess) && batchAccess.length > 0
                        ? supabase.from('user_product_access').update({
                            thankyou_token: thankyouToken,
                            thankyou_token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                            thankyou_max_views: 5,
                            ...(mandateMollieCustomerId ? { mollie_customer_id: mandateMollieCustomerId } : {}),
                            ...(mandateMollieId ? { mollie_mandate_id: mandateMollieId } : {}),
                        }).eq('id', (batchAccess as any[])[0].id)
                        : Promise.resolve(),
                    checkoutId
                        ? supabase.from('checkout_analytics').insert({
                            checkout_id: checkoutId,
                            event_type: 'conversion',
                            session_id: sessionId || null,
                            created_at: new Date().toISOString(),
                        })
                        : Promise.resolve(),
                ])
            }

            // ── Liberar módulos de order bumps comprados ──────────────────
            const bumpModulesToGrant = purchasedBumpModules.filter(
                b => appProducts.some(p => p.id === b.productId)
            )
            if (bumpModulesToGrant.length > 0) {
                console.log(`🛒 Mollie order bump modules: liberando ${bumpModulesToGrant.length}`)
                const bumpRecords = bumpModulesToGrant.map(b => ({
                    user_id: userId,
                    product_id: b.productId,
                    application_id: applicationId,
                    access_type: 'purchase',
                    is_active: true,
                    payment_id: molliePaymentId || record.id,
                    payment_method: method || 'mollie',
                    payment_status: 'completed',
                    purchase_price: b.price,
                    payout_schedule: producerPayoutSchedule,
                    created_at: new Date().toISOString(),
                }))
                await supabase.from('user_product_access')
                    .upsert(bumpRecords, { onConflict: 'user_id,product_id', ignoreDuplicates: false })
            }

            // ═══════════════════════════════════════════════════════
            // FLUXO MARKETPLACE — idêntico ao Stripe
            // ═══════════════════════════════════════════════════════
        } else {
            const [prodRes, memberRes] = await Promise.all([
                supabase.from('marketplace_products').select('name, slug, owner_id').eq('id', productId).single(),
                supabase.from('member_profiles').select('id').eq('email', customerEmail).eq('product_id', productId).maybeSingle(),
            ])

            const product = prodRes.data as any
            if (!product) return

            let userId = ''

            // Criar customer via novo sistema
            const authData = await createCustomerUser(supabase, env, {
                email: customerEmail,
                name: customerName,
                phone: customerPhone,
                created_via: 'purchase'
            })

            userId = authData.user.id

            // Upsert member_profile
            const { error: memberProfileError } = await supabase.from('member_profiles').upsert({
                email: customerEmail,
                name: customerName,
                phone: customerPhone,
                product_id: productId,
                ...(userId ? { user_id: userId } : {}),
            }, { onConflict: 'email,product_id', ignoreDuplicates: false })
            if (memberProfileError) console.error('❌ member_profiles upsert failed:', memberProfileError)

            // Liberar acesso em user_member_area_access (mesma tabela do Stripe)
            if (userId) {
                const { error: accessError } = await supabase.from('user_member_area_access').upsert({
                    user_id: userId,
                    member_area_id: productId,
                    access_type: 'purchase',
                    is_active: true,
                    payment_id: molliePaymentId || record.id,
                    payment_method: method || 'mollie',
                    payment_status: 'completed',
                    purchase_price: totalAmount,
                    payout_schedule: producerPayoutSchedule,
                    created_at: new Date().toISOString(),
                }, { onConflict: 'user_id,member_area_id', ignoreDuplicates: false })
                if (accessError) console.error('❌ user_member_area_access upsert failed:', accessError)

                // Email de boas-vindas para marketplace
                if (env.RESEND_API_KEY && !(memberRes as any).data?.id) {
                    const loginUrl = `${frontendUrl}/members-login/${product.slug || productId}`
                    await sendMollieAccessEmail(env, customerEmail, customerName, product.name, loginUrl)
                }
            }

            await Promise.allSettled([
                supabase.from('sale_locations').insert({
                    user_id: sellerId || null,
                    customer_email: customerEmail,
                    amount: totalAmount,
                    currency,
                    payment_method: method || 'mollie',
                    customer_ip: null,
                    checkout_id: checkoutId || null,
                    product_id: productId || null,
                    payout_schedule: producerPayoutSchedule,
                    sale_date: new Date().toISOString(),
                    country: null,
                    region: null,
                    city: null,
                }),
                checkoutId
                    ? supabase.from('checkout_analytics').insert({
                        checkout_id: checkoutId,
                        event_type: 'conversion',
                        session_id: sessionId || null,
                        created_at: new Date().toISOString(),
                    })
                    : Promise.resolve(),
            ])
        }

        // Marcar acesso como concedido
        await supabase
            .from('mollie_payments')
            .update({ access_granted: true, purchase_id: purchaseId })
            .eq('id', record.id)

    } catch (err: any) {
        console.error('[grantMollieAccess] Error:', err)
    }
}

async function sendMollieAccessEmail(
    env: Env,
    customerEmail: string,
    customerName: string,
    productName: string,
    loginUrl: string,
) {
    try {
        const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
<div style="background:linear-gradient(135deg,#ff6b35 0%,#e55a2b 100%);padding:40px;text-align:center;border-radius:8px 8px 0 0">
  <h1 style="color:white;margin:0;font-size:28px">Pagamento Confirmado!</h1>
  <p style="color:rgba(255,255,255,0.9);margin:8px 0 0">Obrigado pela sua compra</p>
</div>
<div style="background:#f9fafb;padding:40px;border-radius:0 0 8px 8px">
  <p style="color:#333;font-size:16px">Olá, <strong>${customerName || customerEmail.split('@')[0]}</strong>!</p>
  <p style="color:#666;font-size:14px">Seu pagamento foi confirmado. Seu acesso a <strong>${productName}</strong> está pronto.</p>
  <div style="text-align:center;margin:30px 0">
    <a href="${loginUrl}" style="background:#ff6b35;color:white;padding:14px 32px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold;font-size:16px">
      Acessar Agora
    </a>
  </div>
  <p style="color:#999;font-size:12px;text-align:center">Use o e-mail <strong>${customerEmail}</strong> para fazer login.</p>
</div></div>`

        await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from: env.RESEND_FROM || 'noreply@clicknich.com',
                to: customerEmail,
                subject: `Seu acesso a ${productName} está pronto!`,
                html,
            }),
        })
    } catch (e: any) {
        console.warn('[sendMollieAccessEmail] Error:', e.message)
    }
}
