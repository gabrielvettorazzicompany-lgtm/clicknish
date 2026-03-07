/**
 * Handler: Process Mollie Payment
 * 
 * Ações:
 * - (sem action)      → Cria pagamento Mollie, retorna checkoutUrl (redirect flow)
 * - action: 'verify'  → Verifica pagamento retornado da Mollie e libera acesso
 */

import { createClient } from '../lib/supabase'
import { createMollieClient, toMollieAmount, currencyToLocale } from '../lib/mollie'
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

        // Criar pagamento Mollie
        const molliePayment = await mollie.createPayment({
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
        })

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
            ? `/access/${record.application_id}`
            : `/members-login/${record.product_id}`
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

    const redirectUrl = record.product_type === 'app'
        ? `/access/${record.application_id}`
        : `/members-login/${record.product_id}`

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
 * Libera acesso ao produto após pagamento Mollie confirmado
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
            product_type: productType,
            product_id: productId,
            application_id: applicationId,
            checkout_id: checkoutId,
            amount,
            currency,
            method,
            session_id: sessionId,
            tracking_parameters: trackingParameters,
            seller_id: sellerId,
        } = record

        // ─── Calcular taxa de plataforma por venda ────────────────────────
        const PAYOUT_FEES_PP: Record<string, { percentage: number; fixed: number }> = {
            'D+2':  { percentage: 8.99, fixed: 0.49 },
            'D+5':  { percentage: 6.99, fixed: 0.49 },
            'D+12': { percentage: 4.99, fixed: 0.49 },
        }
        let producerPayoutSchedule = 'D+5'
        if (sellerId) {
            const { data: producerConfig } = await supabase
                .from('user_payment_config')
                .select('payout_schedule')
                .eq('user_id', sellerId)
                .maybeSingle()
            if (producerConfig?.payout_schedule) producerPayoutSchedule = producerConfig.payout_schedule
        }
        const producerFee = PAYOUT_FEES_PP[producerPayoutSchedule] || PAYOUT_FEES_PP['D+5']
        const saleAmount = Number(amount)
        const platformFeeAmt = parseFloat((saleAmount * (producerFee.percentage / 100) + producerFee.fixed).toFixed(2))
        const saleNetAmount  = parseFloat((saleAmount - platformFeeAmt).toFixed(2))
        // ─────────────────────────────────────────────────────────────────

        if (productType === 'app') {
            // ─── APP ────────────────────────────────────────────────────────
            const [appRes, appUserRes, appProdsRes] = await Promise.all([
                supabase.from('applications').select('name, slug, owner_id').eq('id', applicationId || productId).single(),
                supabase.from('app_users').select('user_id').eq('email', customerEmail).eq('application_id', applicationId).maybeSingle(),
                supabase.from('products').select('id').eq('application_id', applicationId),
            ])

            const app = appRes.data as any
            if (!app) return

            const appProductIds = ((appProdsRes.data || []) as any[]).map((p: any) => p.id)
            let userId = ''

            if ((appUserRes as any).data?.user_id) {
                userId = (appUserRes as any).data.user_id
            } else {
                // Criar novo usuário
                const tempPassword = crypto.randomUUID()
                const { data: newUser } = await supabase.auth.admin.createUser({
                    email: customerEmail,
                    password: tempPassword,
                    email_confirm: true,
                    user_metadata: { full_name: customerName || customerEmail.split('@')[0] },
                })
                if (!newUser.user) return
                userId = newUser.user.id

                await supabase.from('app_users').insert({
                    user_id: userId,
                    email: customerEmail,
                    full_name: customerName || customerEmail.split('@')[0],
                    application_id: applicationId,
                })

                // Enviar email com senha temporária
                if (env.RESEND_API_KEY) {
                    const loginUrl = `${frontendUrl}/access/${app.slug || applicationId}`
                    await sendMollieAccessEmail(env, customerEmail, customerName, app.name, loginUrl, tempPassword)
                }
            }

            // Liberar módulos
            const memberInserts = appProductIds.map((pid: string) => ({
                user_id: userId,
                product_id: pid,
                application_id: applicationId,
                email: customerEmail,
            }))
            if (memberInserts.length > 0) {
                await supabase.from('member_areas').upsert(memberInserts, { onConflict: 'user_id,product_id', ignoreDuplicates: true })
            }

            // Registrar venda
            await Promise.allSettled([
                supabase.from('checkout_sales').insert({
                    id: purchaseId,
                    checkout_id: checkoutId || null,
                    buyer_email: customerEmail,
                    buyer_name: customerName || null,
                    amount: amount,
                    currency: currency,
                    payment_provider: 'mollie',
                    payment_method: method,
                    status: 'paid',
                    application_id: applicationId,
                    seller_id: sellerId || null,
                    payout_schedule: producerPayoutSchedule,
                    platform_fee_pct: producerFee.percentage,
                    platform_fee_amt: platformFeeAmt,
                    net_amount: saleNetAmount,
                }),
                checkoutId ? supabase.from('checkout_analytics').insert({
                    checkout_id: checkoutId,
                    event_type: 'conversion',
                    session_id: sessionId || null,
                    created_at: new Date().toISOString(),
                }) : Promise.resolve(),
            ])

        } else {
            // ─── MARKETPLACE ────────────────────────────────────────────────
            const [prodRes, memberRes] = await Promise.all([
                supabase.from('marketplace_products').select('name, slug, owner_id').eq('id', productId).single(),
                supabase.from('member_profiles').select('id').eq('email', customerEmail).eq('product_id', productId).maybeSingle(),
            ])

            const product = prodRes.data as any
            if (!product) return

            let memberId = (memberRes as any).data?.id

            if (!memberId) {
                const tempPassword = crypto.randomUUID()
                const { data: newUser } = await supabase.auth.admin.createUser({
                    email: customerEmail,
                    password: tempPassword,
                    email_confirm: true,
                    user_metadata: { full_name: customerName || customerEmail.split('@')[0] },
                })

                if (newUser.user) {
                    const { data: profileData } = await supabase.from('member_profiles').insert({
                        user_id: newUser.user.id,
                        product_id: productId,
                        email: customerEmail,
                        full_name: customerName || customerEmail.split('@')[0],
                    }).select('id').single()
                    memberId = (profileData as any)?.id

                    if (env.RESEND_API_KEY) {
                        const loginUrl = `${frontendUrl}/members-login/${product.slug || productId}`
                        await sendMollieAccessEmail(env, customerEmail, customerName, product.name, loginUrl, tempPassword)
                    }
                }
            }

            await Promise.allSettled([
                supabase.from('checkout_sales').insert({
                    id: purchaseId,
                    checkout_id: checkoutId || null,
                    buyer_email: customerEmail,
                    buyer_name: customerName || null,
                    amount,
                    currency,
                    payment_provider: 'mollie',
                    payment_method: method,
                    status: 'paid',
                    product_id: productId,
                    seller_id: sellerId || null,
                    payout_schedule: producerPayoutSchedule,
                    platform_fee_pct: producerFee.percentage,
                    platform_fee_amt: platformFeeAmt,
                    net_amount: saleNetAmount,
                }),
                checkoutId ? supabase.from('checkout_analytics').insert({
                    checkout_id: checkoutId,
                    event_type: 'conversion',
                    session_id: sessionId || null,
                    created_at: new Date().toISOString(),
                }) : Promise.resolve(),
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
    tempPassword: string
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
  <div style="background:white;padding:20px;border-radius:8px;margin:20px 0;border-left:4px solid #ff6b35">
    <p style="margin:0 0 8px;color:#333;font-size:13px"><strong>Seus dados de acesso:</strong></p>
    <p style="margin:0;color:#666;font-size:13px">Email: <strong>${customerEmail}</strong></p>
    <p style="margin:4px 0 0;color:#666;font-size:13px">Senha temporária: <strong>${tempPassword}</strong></p>
  </div>
  <div style="text-align:center;margin:30px 0">
    <a href="${loginUrl}" style="background:#ff6b35;color:white;padding:14px 32px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold;font-size:16px">
      Acessar Agora
    </a>
  </div>
  <p style="color:#999;font-size:12px;text-align:center">Recomendamos alterar sua senha após o primeiro acesso.</p>
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
