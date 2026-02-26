// @ts-nocheck
/**
 * Handler: UTMify Refused
 * Dispara evento "refused" para UTMify quando um pagamento é recusado
 * (chamada externa, ex: via webhook ou front-end após erro de cartão)
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

export async function handleUtmifyRefused(
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
            sellerUserId,
            customerEmail,
            customerName,
            customerPhone,
            trackingParameters,
        } = body as any

        if (!customerEmail) {
            return jsonResponse({ error: 'customerEmail is required' }, 400)
        }

        // Resolver vendedor pelo checkoutId se sellerUserId não veio
        let resolvedOwnerId = sellerUserId
        let resolvedProductId = productId

        if (!resolvedOwnerId && checkoutId) {
            const { data: checkoutData } = await supabase
                .from('checkouts')
                .select('member_area_id, application_id')
                .eq('id', checkoutId)
                .single()

            if (checkoutData) {
                resolvedProductId = resolvedProductId || checkoutData.member_area_id || checkoutData.application_id

                if (checkoutData.application_id) {
                    const { data: app } = await supabase
                        .from('applications')
                        .select('owner_id')
                        .eq('id', checkoutData.application_id)
                        .single()
                    resolvedOwnerId = app?.owner_id || null
                } else if (checkoutData.member_area_id) {
                    const { data: area } = await supabase
                        .from('member_areas')
                        .select('owner_id')
                        .eq('id', checkoutData.member_area_id)
                        .single()
                    resolvedOwnerId = area?.owner_id || null
                }
            }
        }

        if (!resolvedOwnerId) {
            return jsonResponse({ ok: true, skipped: 'no seller found' })
        }

        // Buscar integrações ativas com evento 'refused'
        const { data: allIntegrations } = await supabase
            .from('utmify_integrations')
            .select('*')
            .eq('user_id', resolvedOwnerId)
            .eq('is_active', true)

        if (!allIntegrations || allIntegrations.length === 0) {
            return jsonResponse({ ok: true, skipped: 'no integrations' })
        }

        const matchingIntegrations = allIntegrations.filter((integration: any) => {
            const events: string[] = integration.events || []
            if (!events.includes('refused')) return false
            const products: { id: string }[] = integration.products || []
            if (products.length === 0) return true
            return products.some(p => p.id === resolvedProductId)
        })

        if (matchingIntegrations.length === 0) {
            return jsonResponse({ ok: true, skipped: 'no matching integrations' })
        }

        const utmifyBody = {
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
                            console.warn(`⚠️ UTMify refused error [${integration.name}]:`, err)
                        } else {
                            console.log(`✅ UTMify refused fired [${integration.name}]`)
                        }
                    } catch (e: any) {
                        console.warn(`⚠️ UTMify refused failed [${integration.name}]:`, e.message)
                    }
                })
            )
        )

        return jsonResponse({ ok: true, fired: matchingIntegrations.length })

    } catch (e: any) {
        console.error('❌ utmify-refused error:', e.message)
        return jsonResponse({ error: e.message }, 500)
    }
}
