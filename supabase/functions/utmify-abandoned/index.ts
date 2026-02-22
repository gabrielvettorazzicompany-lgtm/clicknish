// Edge Function: utmify-abandoned
// Fires UTMify "waiting_payment" (abandoned checkout) event
// Deploy: supabase functions deploy utmify-abandoned

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
            checkoutId,
            productId,
            productType,
            customerEmail,
            customerName,
            customerPhone,
            trackingParameters,
        } = body

        if (!checkoutId || !customerEmail) {
            return new Response(JSON.stringify({ error: 'checkoutId and customerEmail are required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

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
            return new Response(JSON.stringify({ ok: true, skipped: 'no seller found' }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // Fetch active UTMify integrations with 'abandoned' event
        const { data: allIntegrations } = await supabase
            .from('utmify_integrations')
            .select('*')
            .eq('user_id', sellerOwnerId)
            .eq('is_active', true)

        if (!allIntegrations || allIntegrations.length === 0) {
            return new Response(JSON.stringify({ ok: true, skipped: 'no integrations' }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const matchingIntegrations = allIntegrations.filter((integration: any) => {
            const events: string[] = integration.events || []
            if (!events.includes('abandoned')) return false

            const products: { id: string }[] = integration.products || []
            if (products.length === 0) return true
            return products.some((p) => p.id === resolvedProductId)
        })

        if (matchingIntegrations.length === 0) {
            return new Response(JSON.stringify({ ok: true, skipped: 'no matching integrations' }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
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

        await Promise.all(
            matchingIntegrations.map(async (integration: any) => {
                try {
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
                        console.warn(`⚠️ UTMify abandoned error [${integration.name}]:`, err)
                    } else {
                        console.log(`✅ UTMify abandoned fired [${integration.name}]`)
                    }
                } catch (e: any) {
                    console.warn(`⚠️ UTMify abandoned failed [${integration.name}]:`, e.message)
                }
            })
        )

        return new Response(JSON.stringify({ ok: true, fired: matchingIntegrations.length }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    } catch (e: any) {
        console.error('❌ utmify-abandoned error:', e.message)
        return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
