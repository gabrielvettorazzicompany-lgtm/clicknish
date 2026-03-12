/**
 * Handler: Process Upsell
 * Processa upsells/downsells com 1-click (usa cartão/mandato salvo)
 * Suporta Stripe (off_session) e Mollie (recurring)
 */

import { createClient } from '../lib/supabase'
import { createStripeClient } from '../lib/stripe'
import { createMollieClient, toMollieAmount } from '../lib/mollie'
import { resolveMollieKey } from './process-mollie-payment'
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

    // 2. Provedor padrão global
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

export async function handleProcessUpsell(
    request: Request,
    env: Env,
    ctx: ExecutionContext
): Promise<Response> {
    try {
        const {
            purchase_id,   // UUID from payment response (not user_product_access.id)
            token,         // thankyou_token — salvo em user_product_access
            offer_id,      // checkout_offers.id
        } = await request.json()

        if ((!purchase_id && !token) || !offer_id) {
            throw new Error('Missing required fields: purchase_id or token, offer_id')
        }

        // Inicializar clientes
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
        // stripe é resolvido mais tarde, apenas se necessário
        let stripe: ReturnType<typeof createStripeClient>

        // 1. Fetch the offer details
        const { data: offerRaw, error: offerError } = await supabase
            .from('checkout_offers')
            .select('id, product_id, product_type, application_id, offer_price, original_price, title, one_click_purchase, offer_type, currency, page_id, is_active')
            .eq('id', offer_id)
            .single()

        if (offerError || !offerRaw) {
            throw new Error('Offer not found')
        }

        if (!offerRaw.is_active) {
            throw new Error('Offer is inactive')
        }

        const offer = offerRaw

        if (!offer.one_click_purchase) {
            throw new Error('This offer does not support one-click purchase')
        }

        // 2. Fetch the offer product details
        let product: any = null
        let isApplication = false
        let isAppProduct = false
        let parentApplicationId: string | null = null

        if (offer.product_type === 'app_product') {
            const { data: appProduct } = await supabase
                .from('products')
                .select('id, name, application_id')
                .eq('id', offer.product_id)
                .maybeSingle()

            if (appProduct) {
                product = { ...appProduct, price: 0, currency: 'USD' }
                isAppProduct = true
                parentApplicationId = appProduct.application_id
            }
        } else {
            const { data: memberProduct } = await supabase
                .from('marketplace_products')
                .select('id, name, price, currency, owner_id')
                .eq('id', offer.product_id)
                .maybeSingle()

            if (memberProduct) {
                product = memberProduct
            } else {
                const { data: appProduct } = await supabase
                    .from('applications')
                    .select('id, name, owner_id')
                    .eq('id', offer.product_id)
                    .maybeSingle()

                if (appProduct) {
                    product = { ...appProduct, price: 0, currency: 'USD' }
                    isApplication = true
                }
            }
        }

        if (!product) {
            throw new Error('Product not found')
        }

        // Resolver Stripe correto para o vendedor deste produto
        const productOwnerId = product.owner_id ||
            (parentApplicationId
                ? (await supabase.from('applications').select('owner_id').eq('id', parentApplicationId).maybeSingle()).data?.owner_id
                : null)

        // 3. Find the original purchase to get payment method (Stripe or Mollie)
        // Busca por thankyou_token (confiável — salvo no upsert) ou fallback por id
        let stripeCustomerId: string | null = null
        let stripePaymentMethodId: string | null = null
        let mollieCustomerId: string | null = null
        let mollieMandateId: string | null = null
        let userId: string | null = null

        // Tenta até 6x com delay crescente — o DB write ocorre via ctx.waitUntil
        // no process-payment e pode ainda não ter finalizado quando o usuário clica no upsell
        // Busca nas duas tabelas: user_product_access (apps) e user_member_area_access (marketplace)
        let productAccess: any = null
        for (let attempt = 0; attempt < 6; attempt++) {
            if (attempt > 0) await new Promise(r => setTimeout(r, attempt * 2000))

            let q1 = supabase
                .from('user_product_access')
                .select('stripe_customer_id, stripe_payment_method_id, mollie_customer_id, mollie_mandate_id, user_id, thankyou_token')

            let q2 = supabase
                .from('user_member_area_access')
                .select('stripe_customer_id, stripe_payment_method_id, mollie_customer_id, mollie_mandate_id, user_id, thankyou_token')

            if (token) {
                q1 = q1.eq('thankyou_token', token)
                q2 = q2.eq('thankyou_token', token)
            } else {
                q1 = q1.eq('id', purchase_id)
                q2 = q2.eq('id', purchase_id)
            }

            const [r1, r2] = await Promise.all([q1.maybeSingle(), q2.maybeSingle()])
            const found = [r1.data, r2.data].find(d => d?.stripe_customer_id || d?.mollie_customer_id)
            if (found) { productAccess = found; break }
        }

        if (productAccess?.stripe_customer_id) {
            stripeCustomerId = productAccess.stripe_customer_id
            stripePaymentMethodId = productAccess.stripe_payment_method_id
            userId = productAccess.user_id
        } else if (productAccess?.mollie_customer_id) {
            mollieCustomerId = productAccess.mollie_customer_id
            mollieMandateId = productAccess.mollie_mandate_id
            userId = productAccess.user_id
        }

        // Fallback: buscar no KV se o DB ainda não foi escrito (race condition)
        if (!productAccess && token && env.CACHE) {
            try {
                const kvData = await env.CACHE.get(`upsell_token:${token}`, 'json') as any
                if (kvData?.stripe_customer_id) {
                    stripeCustomerId = kvData.stripe_customer_id
                    stripePaymentMethodId = kvData.stripe_payment_method_id
                    // userId ainda não disponível no KV — buscar por stripe_customer_id
                    const { data: accessByCustomer } = await supabase
                        .from('user_product_access')
                        .select('user_id')
                        .eq('stripe_customer_id', kvData.stripe_customer_id)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle()
                    userId = accessByCustomer?.user_id || null
                    // Se ainda não tem userId no DB, aguardar mais um pouco
                    if (!userId) {
                        await new Promise(r => setTimeout(r, 3000))
                        const { data: retryAccess } = await supabase
                            .from('user_product_access')
                            .select('user_id')
                            .eq('stripe_customer_id', kvData.stripe_customer_id)
                            .order('created_at', { ascending: false })
                            .limit(1)
                            .maybeSingle()
                        userId = retryAccess?.user_id || null
                    }
                }
            } catch (kvErr) {
                console.warn('KV read failed:', kvErr)
            }
        }

        if (!userId) {
            throw new Error('Payment method not found for this purchase. Cannot process one-click upsell.')
        }

        // 4. Determine the price
        const finalPrice = offer.offer_price || offer.original_price || product.price
        const currency = (offer.currency || product.currency || 'eur').toUpperCase()

        if (finalPrice <= 0) {
            throw new Error('Invalid price for upsell offer')
        }

        // ══════════════════════════════════════════════════════════════════
        // STRIPE PATH — cobrar usando cartão salvo
        // ══════════════════════════════════════════════════════════════════
        if (stripeCustomerId && stripePaymentMethodId) {
            stripe = createStripeClient(await resolveStripeKey(supabase, productOwnerId || null))

            const stripeCustomer = await stripe.customers.retrieve(stripeCustomerId)
            if (stripeCustomer.deleted) {
                throw new Error('Stripe customer was deleted')
            }

            const idempotencyKey = `upsell_${purchase_id || token}_${offer_id}`
            const paymentIntent = await stripe.paymentIntents.create({
                amount: Math.round(finalPrice * 100),
                currency: currency.toLowerCase(),
                customer: stripeCustomerId,
                payment_method: stripePaymentMethodId,
                confirm: true,
                off_session: true,
                automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
                metadata: {
                    product_id: product.id,
                    product_name: product.name,
                    offer_id: offer.id,
                    offer_type: offer.offer_type,
                    original_purchase_id: purchase_id || '',
                    is_upsell: 'true',
                },
                description: `${offer.offer_type === 'upsell' ? 'Upsell' : 'Downsell'}: ${product.name}`,
            }, { idempotencyKey })

            if (paymentIntent.status !== 'succeeded') {
                throw new Error(`Payment failed with status: ${paymentIntent.status}`)
            }

            const newAccess = await grantUpsellAccess(supabase, {
                userId, product, isAppProduct, isApplication, parentApplicationId,
                paymentId: paymentIntent.id, paymentMethod: 'card',
                stripeCustomerId, stripePaymentMethodId, finalPrice,
            })

            ctx.waitUntil(
                supabase.from('offer_analytics').insert({
                    checkout_offer_id: offer.id, user_id: userId, event_type: 'accepted',
                })
            )

            // Resolve redirect URL from offer page settings
            let redirectUrl: string | null = null
            if (offer.page_id) {
                const { data: page } = await supabase
                    .from('funnel_pages')
                    .select('settings')
                    .eq('id', offer.page_id)
                    .maybeSingle()

                const settings = page?.settings as any
                if (settings?.accept_redirect_url) {
                    const url = settings.accept_redirect_url
                    const sep = url.includes('?') ? '&' : '?'
                    redirectUrl = `${url}${sep}purchase_id=${newAccess?.id || purchase_id}&token=${productAccess?.thankyou_token || token}`
                } else if (settings?.accept_page_id) {
                    const { data: targetPage } = await supabase
                        .from('funnel_pages')
                        .select('external_url, page_type')
                        .eq('id', settings.accept_page_id)
                        .maybeSingle()

                    if (targetPage?.external_url) {
                        const sep = targetPage.external_url.includes('?') ? '&' : '?'
                        redirectUrl = `${targetPage.external_url}${sep}purchase_id=${newAccess?.id || purchase_id}&token=${productAccess?.thankyou_token || token}`
                    } else if (targetPage?.page_type === 'thankyou') {
                        // Thank you page interna
                        const frontendUrl = env.FRONTEND_URL || 'https://app.clicknich.com'
                        redirectUrl = `${frontendUrl}/thankyou/${settings.accept_page_id}?purchase_id=${newAccess?.id || purchase_id}&token=${productAccess?.thankyou_token || token}`
                    }
                }
            }

            return new Response(JSON.stringify({
                success: true,
                paymentIntentId: paymentIntent.id,
                status: paymentIntent.status,
                message: 'Upsell payment processed successfully',
                purchaseId: newAccess?.id || purchase_id,
                redirectUrl: redirectUrl
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
        }

        // ══════════════════════════════════════════════════════════════════
        // MOLLIE PATH — cobrar usando mandato recorrente
        // ══════════════════════════════════════════════════════════════════
        if (mollieCustomerId) {
            if (!mollieMandateId) {
                // Tentar buscar mandato em tempo real (pode ter sido criado após grantMollieAccess)
                const mollieKey = await resolveMollieKey(supabase, productOwnerId || null)
                if (mollieKey) {
                    const mollie = createMollieClient(mollieKey)
                    const mandates = await mollie.listMandates(mollieCustomerId)
                    const validMandate = mandates.find(m => m.status === 'valid') || mandates[0]
                    if (validMandate) mollieMandateId = validMandate.id
                }
            }

            if (!mollieMandateId) {
                throw new Error('Nenhum mandato Mollie válido encontrado para esta compra. Pagamento 1-click não disponível.')
            }

            const mollieKey = await resolveMollieKey(supabase, productOwnerId || null)
            if (!mollieKey) throw new Error('Provedor Mollie não configurado')

            const mollie = createMollieClient(mollieKey)
            const webhookUrl = `https://api.clicknich.com/api/webhooks/mollie`

            const molliePayment = await mollie.createRecurringPayment({
                amount: toMollieAmount(finalPrice, currency),
                description: `${offer.offer_type === 'upsell' ? 'Upsell' : 'Downsell'}: ${product.name}`,
                customerId: mollieCustomerId,
                mandateId: mollieMandateId,
                sequenceType: 'recurring',
                webhookUrl,
                metadata: {
                    product_id: product.id,
                    offer_id: offer.id,
                    offer_type: offer.offer_type,
                    original_purchase_id: purchase_id || '',
                    is_upsell: 'true',
                    user_id: userId,
                },
            })

            // Pagamentos recorrentes Mollie ficam 'pending' inicialmente
            // Concede acesso de forma otimista; webhook revoga se falhar
            const isPending = molliePayment.status === 'pending' || molliePayment.status === 'open'
            if (!isPending && molliePayment.status !== 'paid') {
                throw new Error(`Mollie recurring payment failed with status: ${molliePayment.status}`)
            }

            const newAccess = await grantUpsellAccess(supabase, {
                userId, product, isAppProduct, isApplication, parentApplicationId,
                paymentId: molliePayment.id, paymentMethod: 'mollie',
                mollieCustomerId, mollieMandateId, finalPrice,
            })

            ctx.waitUntil(
                supabase.from('offer_analytics').insert({
                    checkout_offer_id: offer.id, user_id: userId, event_type: 'accepted',
                })
            )

            // Resolve redirect URL from offer page settings
            let redirectUrl: string | null = null
            if (offer.page_id) {
                const { data: page } = await supabase
                    .from('funnel_pages')
                    .select('settings')
                    .eq('id', offer.page_id)
                    .maybeSingle()

                const settings = page?.settings as any
                if (settings?.accept_redirect_url) {
                    const url = settings.accept_redirect_url
                    const sep = url.includes('?') ? '&' : '?'
                    redirectUrl = `${url}${sep}purchase_id=${newAccess?.id || purchase_id}&token=${productAccess?.thankyou_token || token}`
                } else if (settings?.accept_page_id) {
                    const { data: targetPage } = await supabase
                        .from('funnel_pages')
                        .select('external_url, page_type')
                        .eq('id', settings.accept_page_id)
                        .maybeSingle()

                    if (targetPage?.external_url) {
                        const sep = targetPage.external_url.includes('?') ? '&' : '?'
                        redirectUrl = `${targetPage.external_url}${sep}purchase_id=${newAccess?.id || purchase_id}&token=${productAccess?.thankyou_token || token}`
                    } else if (targetPage?.page_type === 'thankyou') {
                        // Thank you page interna
                        const frontendUrl = env.FRONTEND_URL || 'https://app.clicknich.com'
                        redirectUrl = `${frontendUrl}/thankyou/${settings.accept_page_id}?purchase_id=${newAccess?.id || purchase_id}&token=${productAccess?.thankyou_token || token}`
                    }
                }
            }

            return new Response(JSON.stringify({
                success: true,
                molliePaymentId: molliePayment.id,
                status: molliePayment.status,
                message: 'Upsell payment processed successfully',
                purchaseId: newAccess?.id || purchase_id,
                redirectUrl: redirectUrl
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
        }

        throw new Error('Payment method not found for this purchase. Cannot process one-click upsell.')

    } catch (error: any) {
        console.error('Upsell payment error:', error)

        const isCardError = error?.type === 'StripeCardError'

        return new Response(
            JSON.stringify({
                success: false,
                error: isCardError
                    ? 'Your card was declined. Please try another payment method.'
                    : (error.message || 'Upsell payment processing failed'),
                requiresNewPayment: isCardError,
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        )
    }
}

/**
 * Helper: libera acesso ao produto upsell no user_product_access
 */
async function grantUpsellAccess(supabase: any, opts: {
    userId: string
    product: any
    isAppProduct: boolean
    isApplication: boolean
    parentApplicationId: string | null
    paymentId: string
    paymentMethod: string
    stripeCustomerId?: string | null
    stripePaymentMethodId?: string | null
    mollieCustomerId?: string | null
    mollieMandateId?: string | null
    finalPrice: number
}): Promise<{ id: string } | null> {
    const {
        userId, product, isAppProduct, isApplication, parentApplicationId,
        paymentId, paymentMethod, stripeCustomerId, stripePaymentMethodId,
        mollieCustomerId, mollieMandateId, finalPrice,
    } = opts

    const commonFields: Record<string, any> = {
        access_type: 'purchase',
        is_active: true,
        payment_id: paymentId,
        payment_method: paymentMethod,
        payment_status: 'completed',
        purchase_price: finalPrice,
        created_at: new Date().toISOString(),
    }
    if (stripeCustomerId) commonFields.stripe_customer_id = stripeCustomerId
    if (stripePaymentMethodId) commonFields.stripe_payment_method_id = stripePaymentMethodId
    if (mollieCustomerId) commonFields.mollie_customer_id = mollieCustomerId
    if (mollieMandateId) commonFields.mollie_mandate_id = mollieMandateId

    if (isAppProduct && parentApplicationId) {
        const { data } = await supabase
            .from('user_product_access')
            .upsert({ user_id: userId, product_id: product.id, application_id: parentApplicationId, ...commonFields },
                { onConflict: 'user_id,product_id', ignoreDuplicates: false })
            .select('id').single()
        return data
    } else if (isApplication) {
        const { data } = await supabase
            .from('user_product_access')
            .upsert({ user_id: userId, application_id: product.id, ...commonFields },
                { onConflict: 'user_id,application_id', ignoreDuplicates: false })
            .select('id').single()
        return data
    } else {
        const { data } = await supabase
            .from('user_product_access')
            .upsert({ user_id: userId, member_area_id: product.id, ...commonFields },
                { onConflict: 'user_id,member_area_id', ignoreDuplicates: false })
            .select('id').single()
        return data
    }
}
