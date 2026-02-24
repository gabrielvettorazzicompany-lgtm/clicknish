// @ts-nocheck
/**
 * Handler: UTMify Refunded
 * Dispara evento "refunded" para UTMify quando uma compra é reembolsada
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

export async function handleUtmifyRefunded(
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
            orderId,          // Stripe payment intent ID (pi_xxx)
            productId,        // UUID do produto
            sellerUserId,     // UUID do vendedor
            customerEmail,
            customerName,
            customerPhone,
            priceInCents,
            currency,
            trackingParameters,
        } = body

        if (!orderId || !sellerUserId) {
            return jsonResponse({ error: 'orderId and sellerUserId are required' }, 400)
        }

        // Fetch active UTMify integrations for this seller
        const { data: allIntegrations } = await supabase
            .from('utmify_integrations')
            .select('*')
            .eq('user_id', sellerUserId)
            .eq('is_active', true)

        if (!allIntegrations || allIntegrations.length === 0) {
            return jsonResponse({ ok: true, skipped: 'no integrations' })
        }

        // Filter integrations that match 'refunded' event and this product
        const matchingIntegrations = allIntegrations.filter((integration: any) => {
            const events: string[] = integration.events || []
            if (!events.includes('refunded')) return false

            const products: { id: string }[] = integration.products || []
            if (products.length === 0) return true // applies to all products
            return products.some(p => p.id === productId)
        })

        if (matchingIntegrations.length === 0) {
            return jsonResponse({ ok: true, skipped: 'no matching integrations' })
        }

        const now = new Date().toISOString().replace('T', ' ').substring(0, 19)
        const resolvedPrice = priceInCents || 0
        const gatewayFee = Math.round(resolvedPrice * 0.05)
        const userCommission = resolvedPrice - gatewayFee
        const resolvedCurrency = (currency || 'BRL').toUpperCase()

        const utmifyBody = {
            orderId,
            platform: 'Clicknich',
            paymentMethod: 'credit_card',
            status: 'refunded',
            createdAt: now,
            approvedDate: now,
            refundedAt: now,
            customer: {
                name: customerName || null,
                email: customerEmail || null,
                phone: customerPhone || null,
                document: null,
            },
            products: productId
                ? [
                    {
                        id: productId,
                        name: null,
                        planId: null,
                        planName: null,
                        quantity: 1,
                        priceInCents: resolvedPrice,
                    },
                ]
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
                totalPriceInCents: resolvedPrice,
                gatewayFeeInCents: gatewayFee,
                userCommissionInCents: userCommission,
                currency: resolvedCurrency,
            },
            isTest: false,
        }

        // Fire UTMify for each matching integration (usando waitUntil)
        const results: any[] = []
        ctx.waitUntil(
            Promise.allSettled(
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
                            console.warn(`⚠️ UTMify error [${integration.name}]:`, err)
                            results.push({ name: integration.name, ok: false })
                        } else {
                            console.log(`✅ UTMify refunded fired [${integration.name}]`)
                            results.push({ name: integration.name, ok: true })
                        }
                    } catch (e: any) {
                        console.warn(`⚠️ UTMify refunded failed [${integration.name}]:`, e.message)
                        results.push({ name: integration.name, ok: false })
                    }
                })
            )
        )

        return jsonResponse({ ok: true, integrations: matchingIntegrations.length })

    } catch (err: any) {
        console.error('❌ utmify-refunded error:', err)
        return jsonResponse({ error: err.message }, 500)
    }
}
