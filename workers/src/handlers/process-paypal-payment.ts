/**
 * Handler: Process PayPal Payment
 * Processa pagamentos via PayPal Orders API v2
 *
 * Ações:
 * - action: 'create'  → Cria ordem PayPal (usado pelo PayPal SDK Buttons)
 * - action: 'capture' → Captura ordem aprovada e libera acesso
 * - sem action        → Cria ordem + retorna approvalUrl (redirect flow do checkout principal)
 */

import { createClient } from '../lib/supabase'
import { createPayPalClient } from '../lib/paypal'
import type { Env } from '../index'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export async function handlePayPalPayment(
    body: any,
    env: Env,
    ctx: ExecutionContext
): Promise<Response> {
    const {
        action,
        orderId: incomingOrderId,
        productId,
        productType = 'marketplace',
        applicationId,
        checkoutId,
        customerEmail,
        customerName,
        customerPhone,
        selectedOrderBumps = [],
        totalAmount,
        installments = 1,
        sessionId,
        trackingParameters,
    } = body

    try {
        if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
            throw new Error('PayPal not configured on this server')
        }

        const paypal = createPayPalClient(
            env.PAYPAL_CLIENT_ID,
            env.PAYPAL_CLIENT_SECRET,
            env.PAYPAL_ENVIRONMENT || 'live'
        )

        // ══════════════════════════════════════════════════════════════════
        // ACTION: CAPTURE — capturar ordem já aprovada pelo usuário no PayPal
        // ══════════════════════════════════════════════════════════════════
        if (action === 'capture' && incomingOrderId) {
            return await capturePayPalOrder(incomingOrderId, body, env, ctx, paypal)
        }

        // ══════════════════════════════════════════════════════════════════
        // ACTION: CREATE ou sem action — criar nova ordem PayPal
        // ══════════════════════════════════════════════════════════════════
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

        // Buscar preço real do produto/checkout no banco (nunca confiar no frontend)
        let finalPrice = 0
        let productName = ''
        let currency = 'USD'
        let sellerOwnerId: string | null = null

        if (productType === 'app') {
            const [appResult, checkoutResult] = await Promise.all([
                supabase.from('applications').select('name, owner_id').eq('id', applicationId || productId).single(),
                checkoutId
                    ? supabase.from('checkouts').select('custom_price').eq('id', checkoutId).single()
                    : Promise.resolve({ data: null }),
            ])
            if (appResult.error || !appResult.data) throw new Error('App not found')
            const appData = appResult.data as any
            const checkoutData = (checkoutResult as any).data as any
            productName = appData.name
            sellerOwnerId = appData.owner_id
            finalPrice = checkoutData?.custom_price || 0
            currency = 'USD'
        } else {
            const [productResult, checkoutResult] = await Promise.all([
                supabase.from('marketplace_products').select('name, price, currency, owner_id').eq('id', productId).single(),
                checkoutId
                    ? supabase.from('checkouts').select('custom_price').eq('id', checkoutId).single()
                    : Promise.resolve({ data: null }),
            ])
            if (productResult.error || !productResult.data) throw new Error('Product not found')
            const productData = productResult.data as any
            const checkoutData = (checkoutResult as any).data as any
            productName = productData.name
            sellerOwnerId = productData.owner_id
            currency = productData.currency || 'USD'
            finalPrice = checkoutData?.custom_price || productData.price
        }

        // Verificar preços dos order bumps no banco
        const selectedBumpIds: string[] = Array.isArray(selectedOrderBumps)
            ? selectedOrderBumps.map((b: any) => b.id).filter(Boolean)
            : []

        let bumpsTotal = 0
        if (selectedBumpIds.length > 0) {
            const { data: bumpData } = await supabase
                .from('checkout_offers')
                .select('id, offer_price, original_price')
                .in('id', selectedBumpIds)
                .eq('is_active', true)
                .eq('offer_type', 'order_bump')
            if (bumpData && Array.isArray(bumpData)) {
                bumpsTotal = (bumpData as any[]).reduce((sum: number, b: any) => sum + (b.offer_price ?? b.original_price ?? 0), 0)
            }
        }

        const totalChargeAmount = parseFloat((finalPrice + bumpsTotal).toFixed(2))

        // Construir URL de retorno com todos os parâmetros necessários para o capture
        const frontendUrl = env.FRONTEND_URL || 'https://app.clicknich.com'
        const returnParams = new URLSearchParams({
            productId: productId || '',
            productType,
            ...(applicationId ? { applicationId } : {}),
            ...(checkoutId ? { checkoutId } : {}),
            customerEmail: customerEmail || '',
            customerName: customerName || '',
            ...(customerPhone ? { customerPhone } : {}),
            totalAmount: String(totalChargeAmount),
            ...(sessionId ? { sessionId } : {}),
        })

        const returnUrl = `${frontendUrl}/paypal-return?${returnParams.toString()}`
        const cancelUrl = `${frontendUrl}/checkout/${productId}`

        // Criar ordem no PayPal
        const order = await paypal.createOrder({
            amount: totalChargeAmount,
            currency: currency.toUpperCase(),
            description: productName,
            customId: [productId, checkoutId, customerEmail].filter(Boolean).join('|'),
            invoiceId: `${checkoutId || productId}_${Date.now()}`,
        })

        // Para o redirect flow (sem action / action === undefined), retornar approvalUrl
        // Para o SDK flow (action === 'create'), retornar apenas orderId
        const approvalLink = order.links?.find((l: any) => l.rel === 'approve')
        const approvalUrl = approvalLink?.href || ''

        if (action === 'create') {
            // Usado pelo PayPal SDK Buttons — retorna apenas o orderId
            return new Response(
                JSON.stringify({ success: true, orderId: order.id }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            )
        }

        // Redirect flow: retornar URL de aprovação para o frontend redirecionar o usuário
        return new Response(
            JSON.stringify({
                success: false,
                requiresApproval: true,
                approvalUrl,
                orderId: order.id,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

    } catch (error: any) {
        console.error('PayPal payment error:', error)
        return new Response(
            JSON.stringify({ success: false, error: error.message || 'PayPal payment failed' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
}

/**
 * Captura uma ordem PayPal aprovada e libera o acesso ao produto
 */
async function capturePayPalOrder(
    orderId: string,
    body: any,
    env: Env,
    ctx: ExecutionContext,
    paypal: any
): Promise<Response> {
    const {
        productId,
        productType = 'marketplace',
        applicationId,
        checkoutId,
        customerEmail,
        customerName,
        customerPhone,
        totalAmount,
        sessionId,
        trackingParameters,
    } = body

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

    // Capturar o pagamento no PayPal
    const captureResult = await paypal.captureOrder(orderId)

    if (captureResult.status !== 'COMPLETED') {
        throw new Error(`PayPal capture failed: status=${captureResult.status}`)
    }

    const captureDetails = captureResult.purchase_units?.[0]?.payments?.captures?.[0]
    const paypalTransactionId = captureDetails?.id || orderId
    const capturedAmount = parseFloat(captureDetails?.amount?.value || totalAmount || '0')
    const currency = captureDetails?.amount?.currency_code || 'USD'

    // Gerar IDs de compra
    const purchaseId = crypto.randomUUID()
    const thankyouToken = crypto.randomUUID()

    // Capturar geo data se disponível no body
    const clientIP = body._clientIP || 'unknown'
    const geoData = body._geoData || {}

    // Processar acesso em background
    ctx.waitUntil((async () => {
        try {
            let userId = ''
            let redirectUrl = ''
            let productSlug = productId

            if (productType === 'app') {
                // ─── FLUXO APP ───────────────────────────────────────────────────
                const [appResult, appUserResult, appProductsResult] = await Promise.all([
                    supabase.from('applications').select('name, slug, owner_id').eq('id', applicationId || productId).single(),
                    supabase.from('app_users').select('user_id').eq('email', customerEmail).eq('application_id', applicationId).maybeSingle(),
                    supabase.from('products').select('id').eq('application_id', applicationId),
                ])

                const appData = appResult.data as any
                if (!appData) return

                productSlug = appData.slug || productId
                const sellerOwnerId = appData.owner_id
                const appUserData = (appUserResult as any).data as any

                if (appUserData?.user_id) {
                    userId = appUserData.user_id
                } else {
                    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                        email: customerEmail,
                        email_confirm: true,
                        user_metadata: { created_via: 'purchase', name: customerName, phone: customerPhone },
                    })
                    if (!authError && authData?.user) userId = (authData.user as any).id
                    else if (authError && !(((authError as any).message || '')).toLowerCase().includes('already')) throw authError

                    if (!userId) {
                        const { data: existingUser } = await supabase.auth.admin.listUsers()
                        const found = existingUser?.users?.find((u: any) => u.email === customerEmail)
                        if (found) userId = found.id
                    }

                    await supabase.from('app_users').upsert({
                        user_id: userId,
                        email: customerEmail,
                        full_name: customerName,
                        phone: customerPhone,
                        application_id: applicationId,
                        status: 'active',
                        created_at: new Date().toISOString(),
                    }, { onConflict: 'application_id,email', ignoreDuplicates: false })
                }

                // Liberar acesso aos produtos do app
                const appProducts = ((appProductsResult as any).data || []) as any[]
                if (appProducts.length > 0 && userId) {
                    const accessRecords = appProducts.map((p: any) => ({
                        user_id: userId,
                        product_id: p.id,
                        application_id: applicationId,
                        access_type: 'purchase',
                        is_active: true,
                        payment_id: paypalTransactionId,
                        payment_method: 'paypal',
                        payment_status: 'completed',
                        purchase_price: capturedAmount,
                        created_at: new Date().toISOString(),
                    }))
                    await supabase.from('user_product_access').upsert(accessRecords, {
                        onConflict: 'user_id,product_id', ignoreDuplicates: false
                    })
                }

                redirectUrl = `/access/${productSlug}`

                // Registrar venda
                if (sellerOwnerId) {
                    await supabase.from('sale_locations').insert({
                        user_id: sellerOwnerId,
                        customer_email: customerEmail,
                        amount: capturedAmount,
                        currency,
                        payment_method: 'paypal',
                        customer_ip: clientIP,
                        checkout_id: checkoutId || null,
                        product_id: productId || null,
                        sale_date: new Date().toISOString(),
                        country: geoData.country || null,
                        region: geoData.region || null,
                        city: geoData.city || null,
                    })
                }

            } else {
                // ─── FLUXO MARKETPLACE ──────────────────────────────────────────
                const { data: productData } = await supabase
                    .from('marketplace_products')
                    .select('name, slug, owner_id')
                    .eq('id', productId)
                    .single()

                const productDataAny = productData as any
                if (productDataAny) {
                    productSlug = productDataAny.slug || productId
                }

                // Criar/verificar usuário auth
                const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                    email: customerEmail,
                    email_confirm: true,
                    user_metadata: { created_via: 'purchase', name: customerName, phone: customerPhone },
                })

                if (authError) {
                    const authErr = authError as any
                    const isEmailExists = authErr.code === 'email_exists'
                        || (authErr.message || '').toLowerCase().includes('already')
                    if (!isEmailExists) throw authError
                } else if (authData?.user) {
                    userId = (authData.user as any).id
                }

                // Criar member profile
                await supabase.from('member_profiles').upsert({
                    email: customerEmail,
                    name: customerName,
                    phone: customerPhone,
                    product_id: productId,
                }, { onConflict: 'email,product_id', ignoreDuplicates: false })

                // Registrar acesso
                if (userId) {
                    await supabase.from('user_member_area_access').upsert({
                        user_id: userId,
                        member_area_id: productId,
                        access_type: 'purchase',
                        is_active: true,
                        payment_id: paypalTransactionId,
                        payment_method: 'paypal',
                        payment_status: 'completed',
                        purchase_price: capturedAmount,
                        created_at: new Date().toISOString(),
                    }, { onConflict: 'user_id,member_area_id', ignoreDuplicates: false })
                }

                redirectUrl = `/members-login/${productSlug}`

                // Registrar venda
                const sellerOwnerId = productDataAny?.owner_id
                if (sellerOwnerId) {
                    const tasks = [
                        supabase.from('sale_locations').insert({
                            user_id: sellerOwnerId,
                            customer_email: customerEmail,
                            amount: capturedAmount,
                            currency,
                            payment_method: 'paypal',
                            customer_ip: clientIP,
                            checkout_id: checkoutId || null,
                            product_id: productId || null,
                            sale_date: new Date().toISOString(),
                            country: geoData.country || null,
                            region: geoData.region || null,
                            city: geoData.city || null,
                        }),
                    ]
                    if (checkoutId) {
                        tasks.push(supabase.from('checkout_analytics').insert({
                            checkout_id: checkoutId,
                            event_type: 'conversion',
                            session_id: sessionId || null,
                            created_at: new Date().toISOString(),
                        }))
                    }
                    await Promise.allSettled(tasks)
                }
            }

            // Enviar email de acesso
            await sendPayPalAccessEmail(env, supabase, customerEmail, customerName, productType, applicationId, productId, productSlug)

        } catch (bgError: any) {
            console.error('PayPal background access grant failed:', bgError)
        }
    })())

    // Retornar sucesso imediato enquanto o acesso é liberado em background
    const frontendUrl = env.FRONTEND_URL || 'https://app.clicknich.com'
    let redirectUrl = productType === 'app'
        ? `/access/${productId}`
        : `/members-login/${productId}`

    return new Response(
        JSON.stringify({
            success: true,
            purchaseId,
            thankyouToken,
            productType,
            redirectUrl,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
}

/**
 * Email de acesso pós-pagamento PayPal
 */
async function sendPayPalAccessEmail(
    env: Env,
    supabase: any,
    customerEmail: string,
    customerName: string,
    productType: string,
    applicationId: string | undefined,
    productId: string,
    productSlug: string
) {
    try {
        if (!env.RESEND_API_KEY) return

        let productName = '', loginUrl = ''
        const frontendUrl = env.FRONTEND_URL || 'https://app.clicknich.com'

        if (productType === 'app' && applicationId) {
            const { data: appData } = await supabase
                .from('applications').select('name, slug').eq('id', applicationId).single()
            if (appData) {
                productName = appData.name
                loginUrl = `${frontendUrl}/access/${appData.slug || productSlug}`
            }
        } else {
            const { data: productData } = await supabase
                .from('marketplace_products').select('name, slug').eq('id', productId).single()
            if (productData) {
                productName = productData.name
                loginUrl = `${frontendUrl}/members-login/${productData.slug || productSlug}`
            }
        }

        if (!productName) return

        const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><div style="background:linear-gradient(135deg,#0070ba 0%,#003087 100%);padding:40px;text-align:center;border-radius:8px 8px 0 0"><h1 style="color:white;margin:0;font-size:28px">Payment Confirmed!</h1></div><div style="background:#f9fafb;padding:40px;border-radius:0 0 8px 8px"><p style="color:#333;font-size:16px">Hi <strong>${customerName || customerEmail}</strong>,</p><p style="color:#666;font-size:14px;line-height:1.6">Your PayPal payment was confirmed. You now have access to:</p><div style="background:white;padding:20px;border-radius:8px;margin:20px 0;border-left:4px solid #0070ba"><p style="color:#333;font-size:14px;margin:0"><strong>${productName}</strong></p></div>${loginUrl ? `<div style="margin:30px 0;text-align:center"><a href="${loginUrl}" style="background:#0070ba;color:white;padding:14px 32px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold;font-size:16px">Access Now</a></div>` : ''}<div style="background:#f3f4f6;padding:15px;border-radius:6px;margin-top:20px"><p style="color:#666;font-size:13px;margin:0"><strong>Instructions:</strong><br>1. Click the button above<br>2. Login with email: <strong>${customerEmail}</strong></p></div></div></div>`

        await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: env.RESEND_FROM || 'noreply@clicknich.com',
                to: customerEmail,
                subject: `Your access to ${productName} is ready`,
                html,
            }),
        })
    } catch (e: any) {
        console.warn('PayPal access email error:', e.message)
    }
}
