// @ts-nocheck
/**
 * Handler: UTMify Abandoned
 * Dispara evento "waiting_payment" (checkout abandonado) para UTMify
 */

import { createClient } from '../lib/supabase'
import type { Env } from '../index'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(data: any, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
}

export async function handleUtmifyAbandoned(
    request: Request,
    env: Env,
    ctx: ExecutionContext
): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405, headers: corsHeaders })
    }

    try {
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

        const body = await request.json()
        const {
            checkoutId,
            productId,
            productType,
            customerEmail,
            customerName,
            customerPhone,
            trackingParameters,
        } = body

        if (!checkoutId || !customerEmail) {
            return jsonResponse({ error: 'checkoutId and customerEmail are required' }, 400)
        }

        // Resolve seller owner from checkout
        let sellerOwnerId: string | null = null
        let resolvedProductId = productId

        if (checkoutId) {
            const { data: checkoutData } = await supabase
                .from('checkouts')
                .select('user_id, product_id')
                .eq('id', checkoutId)
                .single()

            if (checkoutData) {
                sellerOwnerId = checkoutData.user_id
                resolvedProductId = resolvedProductId || checkoutData.product_id
            }
        }

        if (!sellerOwnerId) {
            return jsonResponse({ ok: true, skipped: 'no seller found' })
        }

        // Fetch active UTMify integrations with 'abandoned' event
        const { data: allIntegrations } = await supabase
            .from('utmify_integrations')
            .select('*')
            .eq('user_id', sellerOwnerId)
            .eq('is_active', true)

        if (!allIntegrations || allIntegrations.length === 0) {
            return jsonResponse({ ok: true, skipped: 'no integrations' })
        }

        const matchingIntegrations = allIntegrations.filter((integration: any) => {
            const events: string[] = integration.events || []
            if (!events.includes('abandoned')) return false

            const products: { id: string }[] = integration.products || []
            if (products.length === 0) return true
            return products.some((p) => p.id === resolvedProductId)
        })

        if (matchingIntegrations.length === 0) {
            return jsonResponse({ ok: true, skipped: 'no matching integrations' })
        }

        const utmifyBody = {
            orderId: `abandoned_${checkoutId}_${Date.now()}`,
            platform: 'Clicknich',
            paymentMethod: 'credit_card',
            status: 'waiting_payment',
            createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
            approvedDate: null,
            refundedAt: null,
            customer: {
                name: customerName || null,
                email: customerEmail,
                phone: customerPhone || null,
                document: null,
            },
            products: resolvedProductId
                ? [{ id: resolvedProductId, name: null, planId: null, planName: null, quantity: 1, priceInCents: 0 }]
                : [],
            trackingParameters: trackingParameters
                ? {
                    src: trackingParameters.src || null,
                    sck: trackingParameters.sck || null,
                    utm_source: trackingParameters.utm_source || null,
                    utm_campaign: trackingParameters.utm_campaign || null,
                    utm_medium: trackingParameters.utm_medium || null,
                    utm_content: trackingParameters.utm_content || null,
                    utm_term: trackingParameters.utm_term || null,
                }
                : null,
            commission: {
                totalPriceInCents: 0,
                gatewayFeeInCents: 0,
                userCommissionInCents: 0,
                currency: 'BRL',
            },
            isTest: false,
        }

        // Fire UTMify for each matching integration (usando waitUntil para não bloquear)
        ctx.waitUntil(
            Promise.all(
                matchingIntegrations.map(async (integration: any) => {
                    try {
                        const res = await fetch('https://api.utmify.com.br/api-credentials/orders', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'x-api-token': integration.api_token,
                            },
                            body: JSON.stringify(utmifyBody),
                        })
                        if (!res.ok) {
                            const err = await res.json().catch(() => null)
                            console.warn(`⚠️ UTMify abandoned error [${integration.name}]:`, err)
                        } else {
                            console.log(`✅ UTMify abandoned fired [${integration.name}]`)
                        }
                    } catch (e: any) {
                        console.warn(`⚠️ UTMify abandoned failed [${integration.name}]:`, e.message)
                    }
                })
            )
        )

        return jsonResponse({ ok: true, fired: matchingIntegrations.length })

    } catch (e: any) {
        console.error('❌ utmify-abandoned error:', e.message)
        return jsonResponse({ error: e.message }, 500)
    }
}
