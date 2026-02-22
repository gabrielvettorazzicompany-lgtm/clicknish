// Edge Function: utmify-refunded
// Fires UTMify "refunded" event when a purchase is refunded
// Deploy: supabase functions deploy utmify-refunded

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405, headers: corsHeaders })
    }

    try {
        const body = await req.json()
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
            return new Response(JSON.stringify({ error: 'orderId and sellerUserId are required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Fetch active UTMify integrations for this seller
        const { data: allIntegrations } = await supabase
            .from('utmify_integrations')
            .select('*')
            .eq('user_id', sellerUserId)
            .eq('is_active', true)

        if (!allIntegrations || allIntegrations.length === 0) {
            return new Response(JSON.stringify({ ok: true, skipped: 'no integrations' }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
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
            return new Response(JSON.stringify({ ok: true, skipped: 'no matching integrations' }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
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
                currency: resolvedCurrency as any,
            },
            isTest: false,
        }

        // Fire UTMify for each matching integration
        const results = await Promise.allSettled(
            matchingIntegrations.map(async (integration: any) => {
                const res = await fetch('https://api.utmify.com.br/api-credentials/orders', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-token': integration.api_token,
                    },
                    body: JSON.stringify(utmifyBody),
                    signal: AbortSignal.timeout(8000),
                })
                if (!res.ok) {
                    const err = await res.json().catch(() => null)
                    console.warn(`⚠️ UTMify error [${integration.name}]:`, err)
                    return { name: integration.name, ok: false }
                }
                return { name: integration.name, ok: true }
            })
        )

        return new Response(
            JSON.stringify({ ok: true, integrations: results.length, results }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (err: any) {
        console.error('❌ utmify-refunded error:', err)
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
