/**
 * Handler: Process PayPal Payment
 * Processa pagamentos via PayPal
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
    requestData: any,
    env: Env,
    ctx: ExecutionContext
): Promise<Response> {
    try {
        const {
            productId,
            productType = 'marketplace',
            applicationId,
            checkoutId,
            customerEmail,
            customerName,
            customerPhone,
            trackingParameters,
            selectedOrderBumps = [],
            sessionId,
            totalAmount,
            currency = 'USD',
            action = 'create' // 'create' ou 'capture'
        } = requestData

        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
        const paypal = createPayPalClient(
            env.PAYPAL_CLIENT_ID,
            env.PAYPAL_CLIENT_SECRET,
            env.PAYPAL_ENVIRONMENT || 'sandbox'
        )

        if (action === 'create') {
            // ═══════════════════════════════════════════════════════════════════
            // CRIAR ORDEM PAYPAL
            // ═══════════════════════════════════════════════════════════════════

            // Buscar dados do produto para montar a descrição
            let productName = 'Product Purchase'
            if (productType === 'app' && applicationId) {
                const { data: appData } = await supabase
                    .from('applications')
                    .select('name')
                    .eq('id', applicationId)
                    .single()
                if (appData) productName = appData.name
            } else {
                const { data: productData } = await supabase
                    .from('products')
                    .select('name')
                    .eq('id', productId)
                    .single()
                if (productData) productName = productData.name
            }

            // Criar ordem no PayPal
            const order = await paypal.createOrder({
                amount: totalAmount,
                currency: currency,
                description: `Purchase: ${productName}`,
                customId: `${productId}-${Date.now()}`,
                invoiceId: `INV-${productId}-${Date.now()}`,
                metadata: {
                    product_id: productId,
                    product_type: productType,
                    application_id: applicationId || '',
                    checkout_id: checkoutId || '',
                    customer_email: customerEmail,
                }
            })

            return new Response(JSON.stringify({
                success: true,
                orderId: order.id,
                approvalUrl: order.links.find(link => link.rel === 'approve')?.href
            }), {
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            })

        } else if (action === 'capture') {
            // ═══════════════════════════════════════════════════════════════════
            // CAPTURAR PAGAMENTO APÓS APROVAÇÃO DO USUÁRIO
            // ═══════════════════════════════════════════════════════════════════

            const { orderId } = await request.json()

            if (!orderId) {
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Order ID is required for capture'
                }), {
                    status: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders
                    }
                })
            }

            // Verificar se a ordem foi aprovada
            const isApproved = await paypal.isOrderApproved(orderId)
            if (!isApproved) {
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Order not approved by customer'
                }), {
                    status: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders
                    }
                })
            }

            // Capturar o pagamento
            const captureResult = await paypal.captureOrder(orderId)

            if (captureResult.status === 'COMPLETED') {
                // Gerar IDs para compra
                const purchaseId = crypto.randomUUID()
                const thankyouToken = crypto.randomUUID()

                // TODO: Processar acesso ao produto, enviar emails, etc.
                // (Similar ao que é feito no process-payment.ts para Stripe)

                return new Response(JSON.stringify({
                    success: true,
                    purchaseId: purchaseId,
                    thankyouToken: thankyouToken,
                    paypalOrderId: orderId,
                    captureId: captureResult.id
                }), {
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders
                    }
                })
            } else {
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Payment capture failed'
                }), {
                    status: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders
                    }
                })
            }
        }

        return new Response(JSON.stringify({
            success: false,
            error: 'Invalid action'
        }), {
            status: 400,
            headers: {
                'Content-Type': 'application/json',
                ...corsHeaders
            }
        })

    } catch (error: any) {
        console.error('PayPal payment error:', error)

        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'PayPal payment processing failed'
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                ...corsHeaders
            }
        })
    }
}