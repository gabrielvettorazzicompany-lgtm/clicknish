/**
 * Handler: Process Stripe Payment (Redirect Flow)
 *
 * Suporta métodos Stripe que requerem redirect do cliente:
 * iDEAL, Bancontact, Sofort, EPS, Giropay, Alipay, P24, etc.
 *
 * Ações:
 * - (sem action)      → Cria PaymentIntent + confirma → retorna redirectUrl
 * - action: 'verify'  → Verifica PaymentIntent após retorno do redirect
 */

import { createClient } from '../lib/supabase'
import { createStripeClient } from '../lib/stripe'
import { applyFxConversion } from '../lib/fx'
import { createCustomerUser } from './customer-auth'
import { appLangToEmailLang, buildAccessEmailHtml } from '../utils/email-i18n'
import { grantUpsellAccessForStripeRedirect } from './process-upsell'
import type { Env } from '../index'

// Métodos Stripe que só aceitam EUR
const STRIPE_EUR_ONLY_METHODS = new Set([
    'ideal',
    'bancontact',
    'sofort',
    'eps',
    'giropay',
    'p24',
])

// Constrói o payment_method_data para cada tipo de método
function buildPaymentMethodData(
    stripeMethod: string,
    billingName: string,
    billingEmail: string,
    country?: string | null,
): Record<string, any> {
    const base: Record<string, any> = {
        type: stripeMethod,
        billing_details: {
            name: billingName,
            email: billingEmail,
        },
    }

    if (stripeMethod === 'sofort') {
        // Sofort precisa de country (AT, BE, DE, IT, NL, ES)
        const sofortCountry = (['AT', 'BE', 'DE', 'IT', 'NL', 'ES'].includes(country || ''))
            ? country!.toLowerCase()
            : 'de'
        base.sofort = { country: sofortCountry }
    }

    if (stripeMethod === 'p24') {
        base.p24 = { bank: 'ing' } // banco padrão — usuário pode escolher na página da P24
    }

    return base
}

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

export async function resolveStripeKeyForRedirect(supabase: any, ownerId: string | null): Promise<string | null> {
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
                .in('type', ['stripe', 'stripe_connect'])
                .eq('is_active', true)
                .maybeSingle()
            const key = prov?.credentials?.secret_key || prov?.credentials?.api_key
            if (key) return key
        }
    }

    const { data: globalProv } = await supabase
        .from('payment_providers')
        .select('credentials')
        .in('type', ['stripe', 'stripe_connect'])
        .eq('is_global_default', true)
        .eq('is_active', true)
        .maybeSingle()

    return globalProv?.credentials?.secret_key || globalProv?.credentials?.api_key || null
}

export async function handleProcessStripePayment(
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
        stripeMethod,          // ex: 'ideal', 'bancontact'
        totalAmount,
        selectedOrderBumps = [],
        sessionId,
        trackingParameters,
    } = body

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
    const frontendUrl = env.FRONTEND_URL || 'https://app.clicknich.com'

    try {
        // ══════════════════════════════════════════════════════════════════
        // ACTION: VERIFY — verificar PaymentIntent após redirect do Stripe
        // ══════════════════════════════════════════════════════════════════
        if (action === 'verify' && incomingPaymentId) {
            return await verifyStripeRedirectPayment(incomingPaymentId, env, supabase, frontendUrl)
        }

        // ══════════════════════════════════════════════════════════════════
        // ACTION: CREATE — criar pagamento Stripe redirect
        // ══════════════════════════════════════════════════════════════════
        if (!customerEmail) return json({ error: 'customerEmail é obrigatório' }, 400)
        if (!stripeMethod) return json({ error: 'stripeMethod é obrigatório' }, 400)

        // Resolver preço
        let finalPrice = 0
        let productName = ''
        let currency = 'EUR'
        let sellerOwnerId: string | null = null

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
                currency = ck?.currency || prod.currency || 'EUR'
                finalPrice = ck?.custom_price || prod.price
            }
        }

        // Adicionar order bumps
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

        if (finalPrice <= 0 && totalAmount > 0) finalPrice = totalAmount
        if (finalPrice <= 0) return json({ error: 'Valor inválido' }, 400)

        // Conversão FX
        const clientCountry = request.headers.get('cf-ipcountry')
        const fxResult = await applyFxConversion(finalPrice, currency, clientCountry, env)
        let chargeAmount = fxResult.displayPrice
        let chargeCurrency = fxResult.displayCurrency

        // Forçar EUR para métodos que só aceitam EUR
        if (STRIPE_EUR_ONLY_METHODS.has(stripeMethod) && chargeCurrency !== 'EUR') {
            const eurRates = await applyFxConversion(finalPrice, currency, 'NL', env)
            chargeAmount = eurRates.displayPrice
            chargeCurrency = 'EUR'
            console.log(`[fx] Stripe EUR-only (${stripeMethod}): ${finalPrice} ${currency} → ${chargeAmount} EUR`)
        }

        // Resolver chave Stripe
        const stripeKey = await resolveStripeKeyForRedirect(supabase, sellerOwnerId)
        if (!stripeKey) return json({ error: 'Provedor Stripe não configurado' }, 503)

        const stripe = createStripeClient(stripeKey)

        // ID interno para rastrear o pagamento
        const internalPaymentId = crypto.randomUUID()

        // URL de retorno após redirect — usa rota completa /checkout/:entityId/:checkoutId
        // para não confundir o frontend com UUID no lugar do shortId
        const entityId = applicationId || productId
        const returnUrl = checkoutId && entityId
            ? `${frontendUrl}/checkout/${entityId}/${checkoutId}?stripe_return=1&paymentId=${internalPaymentId}`
            : `${frontendUrl}/checkout/${checkoutId || productId}?stripe_return=1&paymentId=${internalPaymentId}`

        // Criar ou buscar customer Stripe
        const customersResult = await stripe.customers.list({ email: customerEmail, limit: 1 })
        let stripeCustomer = customersResult?.data?.[0]
        if (!stripeCustomer) {
            stripeCustomer = await stripe.customers.create({
                email: customerEmail,
                name: customerName,
                phone: customerPhone,
            })
        }

        // Criar PaymentIntent com método de redirect
        const paymentIntentParams: any = {
            amount: Math.round(chargeAmount * 100),
            currency: chargeCurrency.toLowerCase(),
            customer: stripeCustomer.id,
            payment_method_types: [stripeMethod],
            payment_method_data: buildPaymentMethodData(stripeMethod, customerName || customerEmail, customerEmail, clientCountry),
            confirm: true,
            return_url: returnUrl,
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

        // Fix para Revolut: forçar redirect mais agressivo
        if (stripeMethod === 'revolut_pay') {
            paymentIntentParams.automatic_payment_methods = { enabled: false }
            paymentIntentParams.payment_method_options = {
                revolut_pay: {
                    capture_method: 'automatic'
                }
            }
        }

        const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams)

        // Salvar registro pendente
        await supabase.from('stripe_redirect_payments').insert({
            id: internalPaymentId,
            payment_intent_id: paymentIntent.id,
            product_id: productId || null,
            product_type: productType,
            application_id: applicationId || null,
            checkout_id: checkoutId || null,
            customer_email: customerEmail,
            customer_name: customerName || null,
            customer_phone: customerPhone || null,
            amount: chargeAmount,
            currency: chargeCurrency.toLowerCase(),
            method: stripeMethod,
            status: paymentIntent.status ?? 'pending',
            seller_id: sellerOwnerId || null,
            session_id: sessionId || null,
            tracking_parameters: trackingParameters || null,
            selected_order_bumps: selectedBumpIds,
        })

        // Extrair URL de redirect
        const redirectUrl = paymentIntent.next_action?.redirect_to_url?.url
            || paymentIntent.next_action?.type === 'redirect_to_url'
            ? paymentIntent.next_action?.redirect_to_url?.url
            : null

        if (!redirectUrl && paymentIntent.status !== 'succeeded') {
            throw new Error(`Stripe não retornou URL de redirect para o método ${stripeMethod}`)
        }

        // Pagamento aprovado imediatamente (raro, mas pode acontecer)
        if (paymentIntent.status === 'succeeded') {
            const purchaseId = crypto.randomUUID()
            const thankyouToken = crypto.randomUUID()
            await grantStripeRedirectAccess(supabase, env, internalPaymentId, paymentIntent, purchaseId, thankyouToken, frontendUrl)
            const resolvedRedirect = await resolveRedirectUrl(supabase, internalPaymentId, purchaseId, thankyouToken, frontendUrl)
            return json({ success: true, paymentId: internalPaymentId, purchaseId, thankyouToken, redirectUrl: resolvedRedirect })
        }

        return json({
            success: true,
            paymentId: internalPaymentId,
            stripePaymentIntentId: paymentIntent.id,
            redirectUrl,
        })

    } catch (err: any) {
        console.error('[process-stripe-payment] Error:', err)
        return json({ error: err.message || 'Erro ao processar pagamento Stripe' }, 500)
    }
}

/**
 * Verifica o PaymentIntent após o cliente retornar do redirect
 */
async function verifyStripeRedirectPayment(
    internalPaymentId: string,
    env: Env,
    supabase: any,
    frontendUrl: string,
): Promise<Response> {
    const { data: record, error } = await supabase
        .from('stripe_redirect_payments')
        .select('*')
        .eq('id', internalPaymentId)
        .maybeSingle()

    if (error || !record) {
        return json({ error: 'Pagamento não encontrado' }, 404)
    }

    // Já processado
    if (record.access_granted && record.purchase_id) {
        const redirectUrl = await resolveRedirectUrl(supabase, internalPaymentId, record.purchase_id, record.thankyou_token, frontendUrl)
        return json({ success: true, alreadyProcessed: true, redirectUrl, purchaseId: record.purchase_id, thankyouToken: record.thankyou_token })
    }

    // Buscar chave Stripe
    const stripeKey = await resolveStripeKeyForRedirect(supabase, record.seller_id)
    if (!stripeKey) return json({ error: 'Provedor Stripe não disponível' }, 503)

    const stripe = createStripeClient(stripeKey)
    const paymentIntent = await stripe.paymentIntents.retrieve(record.payment_intent_id)

    // Atualizar status no DB
    await supabase
        .from('stripe_redirect_payments')
        .update({ status: paymentIntent.status, updated_at: new Date().toISOString() })
        .eq('id', internalPaymentId)

    // Para métodos de redirect (iDEAL, Bancontact, etc.), 'processing' significa que o
    // banco autorizou o pagamento — o dinheiro é garantido. O webhook confirmará depois.
    // Tratar 'processing' como sucesso para não deixar o usuário na tela de erro.
    const isApproved = paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing'

    if (!isApproved) {
        return json({
            success: false,
            status: paymentIntent.status,
            message: paymentIntent.status === 'requires_action'
                ? 'Pagamento pendente de autenticação'
                : 'Pagamento não concluído',
        })
    }

    const purchaseId = crypto.randomUUID()
    const thankyouToken = crypto.randomUUID()

    // Upsell iDEAL: liberar acesso ao produto da oferta, não ao produto principal
    if (record.is_upsell && record.offer_id) {
        await grantUpsellAccessForStripeRedirect(supabase, env, record, paymentIntent.id, purchaseId)
        const redirectUrl = await resolveUpsellRedirectUrl(supabase, record.offer_id, purchaseId, record.original_purchase_id, frontendUrl)
        await supabase.from('stripe_redirect_payments')
            .update({ access_granted: true, purchase_id: purchaseId, thankyou_token: thankyouToken, updated_at: new Date().toISOString() })
            .eq('id', internalPaymentId)
        return json({ success: true, purchaseId, thankyouToken, redirectUrl })
    }

    await grantStripeRedirectAccess(supabase, env, internalPaymentId, paymentIntent, purchaseId, thankyouToken, frontendUrl)

    // Re-ler o record para pegar o purchase_id/thankyou_token que realmente foi gravado
    // (pode ter sido o webhook que ganhou o lock atômico, não este verify)
    const { data: finalRecord } = await supabase
        .from('stripe_redirect_payments')
        .select('purchase_id, thankyou_token')
        .eq('id', internalPaymentId)
        .maybeSingle()

    const finalPurchaseId = finalRecord?.purchase_id || purchaseId
    const finalThankyouToken = finalRecord?.thankyou_token || thankyouToken

    const redirectUrl = await resolveRedirectUrl(supabase, internalPaymentId, finalPurchaseId, finalThankyouToken, frontendUrl)

    return json({ success: true, purchaseId: finalPurchaseId, thankyouToken: finalThankyouToken, redirectUrl })
}

/**
 * Exportado para ser chamado pelo webhook Stripe
 */
export async function processStripeRedirectWebhook(
    paymentIntentId: string,
    paymentIntent: any,
    env: Env,
    supabase: any,
    frontendUrl: string,
): Promise<void> {
    const { data: record } = await supabase
        .from('stripe_redirect_payments')
        .select('*')
        .eq('payment_intent_id', paymentIntentId)
        .eq('access_granted', false)
        .maybeSingle()

    if (!record) return // Não é um pagamento de redirect ou já foi processado

    const purchaseId = crypto.randomUUID()
    const thankyouToken = crypto.randomUUID()

    await grantStripeRedirectAccess(supabase, env, record.id, paymentIntent, purchaseId, thankyouToken, frontendUrl)
    console.log(`[stripe-webhook] Stripe redirect access granted for PI ${paymentIntentId}`)
}

/**
 * Resolve a URL de redirect pós-compra (funnel_pages → thankyou → fallback)
 */
async function resolveRedirectUrl(
    supabase: any,
    internalPaymentId: string,
    purchaseId: string,
    thankyouToken: string,
    frontendUrl: string,
): Promise<string> {
    const { data: record } = await supabase
        .from('stripe_redirect_payments')
        .select('checkout_id, product_type, application_id, product_id')
        .eq('id', internalPaymentId)
        .maybeSingle()

    if (!record) {
        return `${frontendUrl}/`
    }

    let redirectUrl = record.product_type === 'app'
        ? `${frontendUrl}/access/${record.application_id}`
        : `${frontendUrl}/members-login/${record.product_id}`

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
                return `${targetPage.external_url}${sep}purchase_id=${purchaseId}&token=${thankyouToken}`
            } else if (targetPage?.page_type === 'thankyou') {
                return `${frontendUrl}/thankyou/${pageSettings.post_purchase_page_id}?purchase_id=${purchaseId}&token=${thankyouToken}`
            }
        } else if (pageSettings?.post_purchase_redirect_url) {
            const url = pageSettings.post_purchase_redirect_url as string
            const sep = url.includes('?') ? '&' : '?'
            return `${url}${sep}purchase_id=${purchaseId}&token=${thankyouToken}`
        }
    }

    const sep = redirectUrl.includes('?') ? '&' : '?'
    return `${redirectUrl}${sep}purchase_id=${purchaseId}&token=${thankyouToken}`
}

/**
 * Resolve redirect URL para upsell iDEAL: usa accept_redirect_url da offer page
 */
async function resolveUpsellRedirectUrl(
    supabase: any,
    offerId: string,
    purchaseId: string,
    originalPurchaseId: string | null,
    frontendUrl: string,
): Promise<string> {
    const { data: offer } = await supabase
        .from('checkout_offers')
        .select('page_id')
        .eq('id', offerId)
        .maybeSingle()

    if (offer?.page_id) {
        const { data: page } = await supabase
            .from('funnel_pages')
            .select('settings')
            .eq('id', offer.page_id)
            .maybeSingle()

        const settings = page?.settings as any
        const refId = purchaseId || originalPurchaseId || ''

        if (settings?.accept_redirect_url) {
            const url = settings.accept_redirect_url as string
            const sep = url.includes('?') ? '&' : '?'
            return `${url}${sep}purchase_id=${refId}`
        }
        if (settings?.accept_page_id) {
            const { data: targetPage } = await supabase
                .from('funnel_pages')
                .select('external_url, page_type')
                .eq('id', settings.accept_page_id)
                .maybeSingle()
            if (targetPage?.external_url) {
                const sep = targetPage.external_url.includes('?') ? '&' : '?'
                return `${targetPage.external_url}${sep}purchase_id=${refId}`
            }
            if (targetPage?.page_type === 'thankyou') {
                return `${frontendUrl}/thankyou/${settings.accept_page_id}?purchase_id=${refId}`
            }
        }
    }

    return `${frontendUrl}/`
}

/**
 * Libera acesso ao produto após pagamento Stripe redirect confirmado.
 */
async function grantStripeRedirectAccess(
    supabase: any,
    env: Env,
    internalPaymentId: string,
    paymentIntent: any,
    purchaseId: string,
    thankyouToken: string,
    frontendUrl: string,
): Promise<void> {
    try {
        // Lock atômico: só quem mudar access_granted de false → true continua.
        // Se dois processos (verify + webhook) chegarem ao mesmo tempo, apenas um ganha.
        const { data: claimedRows, error: claimError } = await supabase
            .from('stripe_redirect_payments')
            .update({
                access_granted: true,
                purchase_id: purchaseId,
                thankyou_token: thankyouToken,
                status: 'succeeded',
                updated_at: new Date().toISOString(),
            })
            .eq('id', internalPaymentId)
            .eq('access_granted', false)
            .select('id')

        if (claimError || !claimedRows || claimedRows.length === 0) {
            // Outro processo já processou este pagamento — não duplicar
            return
        }

        const { data: record } = await supabase
            .from('stripe_redirect_payments')
            .select('*')
            .eq('id', internalPaymentId)
            .maybeSingle()

        if (!record) return

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
        } = record

        const totalAmount = Number(amount)
        const selectedBumpIds: string[] = Array.isArray(selectedOrderBumps) ? selectedOrderBumps : []

        // Payout schedule do produtor
        let producerPayoutSchedule = 'D+5'
        if (sellerId) {
            const { data: pc } = await supabase
                .from('user_payment_config')
                .select('payout_schedule')
                .eq('user_id', sellerId)
                .maybeSingle()
            if (pc?.payout_schedule) producerPayoutSchedule = pc.payout_schedule
        }

        if (productType === 'app') {
            const [appRes, appUserRes, appProdsRes, orderBumpsRes, funnelPageRes] = await Promise.all([
                supabase.from('applications').select('name, slug, language, owner_id, support_email').eq('id', applicationId || productId).single(),
                supabase.from('app_users').select('user_id').eq('email', customerEmail).eq('application_id', applicationId).maybeSingle(),
                supabase.from('products').select('id').eq('application_id', applicationId),
                checkoutId
                    ? supabase.from('checkout_offers')
                        .select('id, offer_product_id, offer_price, original_price')
                        .eq('checkout_id', checkoutId)
                        .eq('offer_type', 'order_bump')
                        .eq('is_active', true)
                    : Promise.resolve({ data: [] }),
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
            const purchasedBumpModules = allBumps
                .filter((b: any) => selectedBumpIds.includes(b.id) && b.offer_product_id)
                .map((b: any) => ({ productId: b.offer_product_id, price: b.offer_price ?? b.original_price ?? 0 }))

            const funnelSettings = (funnelPageRes as any)?.data?.settings
            const funnelSelectedModules: string[] | null =
                Array.isArray(funnelSettings?.selected_modules) && funnelSettings.selected_modules.length > 0
                    ? funnelSettings.selected_modules
                    : null

            let userId = ''
            const existingAppUser = (appUserRes as any).data

            if (existingAppUser?.user_id) {
                userId = existingAppUser.user_id
            } else {
                const authData = await createCustomerUser(supabase, env, {
                    email: customerEmail,
                    name: customerName,
                    phone: customerPhone,
                    created_via: 'purchase',
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

                if (env.RESEND_API_KEY) {
                    const loginUrl = `${frontendUrl}/access/${app.slug || applicationId}`
                    await sendAccessEmail(env, customerEmail, customerName, app.name, loginUrl, app.language, app.support_email)
                }
            }

            if (appProducts.length > 0) {
                let productsToGrant = [...appProducts]
                if (funnelSelectedModules && funnelSelectedModules.length > 0) {
                    productsToGrant = productsToGrant.filter(p => funnelSelectedModules.includes(p.id))
                }
                if (orderBumpProductIds.length > 0) {
                    productsToGrant = productsToGrant.filter(p => !orderBumpProductIds.includes(p.id))
                }

                const accessRecords = productsToGrant.map((p: any, idx: number) => ({
                    user_id: userId,
                    product_id: p.id,
                    application_id: applicationId,
                    access_type: 'purchase',
                    is_active: true,
                    payment_id: paymentIntent.id,
                    payment_method: method || 'stripe_redirect',
                    payment_status: 'completed',
                    purchase_price: totalAmount,
                    payout_schedule: producerPayoutSchedule,
                    created_at: new Date().toISOString(),
                    ...(idx === 0 ? {
                        thankyou_token: thankyouToken,
                        thankyou_token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                        thankyou_max_views: 5,
                    } : {}),
                }))

                await supabase.from('user_product_access')
                    .upsert(accessRecords, { onConflict: 'user_id,product_id', ignoreDuplicates: false })
            }

            // Order bumps
            const bumpModulesToGrant = purchasedBumpModules.filter(b => appProducts.some(p => p.id === b.productId))
            if (bumpModulesToGrant.length > 0) {
                const bumpRecords = bumpModulesToGrant.map(b => ({
                    user_id: userId,
                    product_id: b.productId,
                    application_id: applicationId,
                    access_type: 'purchase',
                    is_active: true,
                    payment_id: paymentIntent.id,
                    payment_method: method || 'stripe_redirect',
                    payment_status: 'completed',
                    purchase_price: b.price,
                    payout_schedule: producerPayoutSchedule,
                    created_at: new Date().toISOString(),
                }))
                await supabase.from('user_product_access')
                    .upsert(bumpRecords, { onConflict: 'user_id,product_id', ignoreDuplicates: false })
            }

            await Promise.allSettled([
                supabase.from('sale_locations').insert({
                    user_id: sellerId || null,
                    customer_email: customerEmail,
                    amount: totalAmount,
                    currency,
                    payment_method: method || 'stripe_redirect',
                    customer_ip: null,
                    checkout_id: checkoutId || null,
                    product_id: productId || applicationId || null,
                    payout_schedule: producerPayoutSchedule,
                    sale_date: new Date().toISOString(),
                    payment_id: paymentIntent.id,
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

        } else {
            // MARKETPLACE
            const authData = await createCustomerUser(supabase, env, {
                email: customerEmail,
                name: customerName,
                phone: customerPhone,
                created_via: 'purchase',
            })
            const userId = authData.user.id

            await Promise.allSettled([
                supabase.from('member_profiles').upsert({
                    email: customerEmail,
                    name: customerName,
                    phone: customerPhone,
                    product_id: productId,
                    user_id: userId,
                }, { onConflict: 'email,product_id', ignoreDuplicates: false }),

                supabase.from('user_member_area_access').upsert({
                    user_id: userId,
                    member_area_id: productId,
                    access_type: 'purchase',
                    is_active: true,
                    payment_id: paymentIntent.id,
                    payment_method: method || 'stripe_redirect',
                    payment_status: 'completed',
                    purchase_price: totalAmount,
                    payout_schedule: producerPayoutSchedule,
                    created_at: new Date().toISOString(),
                }, { onConflict: 'user_id,member_area_id', ignoreDuplicates: false }),

                supabase.from('sale_locations').insert({
                    user_id: sellerId || null,
                    customer_email: customerEmail,
                    amount: totalAmount,
                    currency,
                    payment_method: method || 'stripe_redirect',
                    customer_ip: null,
                    checkout_id: checkoutId || null,
                    product_id: productId || null,
                    payout_schedule: producerPayoutSchedule,
                    sale_date: new Date().toISOString(),
                    payment_id: paymentIntent.id,
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

    } catch (err: any) {
        console.error('[grantStripeRedirectAccess] Error:', err)
    }
}

async function sendAccessEmail(
    env: Env,
    customerEmail: string,
    customerName: string,
    productName: string,
    loginUrl: string,
    appLanguage: string | null | undefined,
    supportEmail?: string,
) {
    try {
        const lang = appLangToEmailLang(appLanguage)
        const { subject, html, text } = buildAccessEmailHtml({
            lang,
            customerName: customerName || customerEmail,
            customerEmail,
            productName,
            productsHtml: '',
            loginUrl,
            accentColor: '#635bff',
            supportEmail,
        })

        await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from: env.RESEND_FROM || 'ClickNich <noreply@clicknich.com>',
                to: customerEmail,
                subject,
                html,
                text,
            }),
        })
    } catch (e: any) {
        console.warn('[sendAccessEmail] Error:', e.message)
    }
}
