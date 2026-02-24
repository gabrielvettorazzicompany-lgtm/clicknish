// @ts-nocheck
/**
 * Handler: Offer Analytics
 * Registra eventos de view, accept e decline de ofertas
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

export async function handleOfferAnalytics(
    request: Request,
    env: Env,
    ctx: ExecutionContext
): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405, headers: corsHeaders })
    }

    try {
        const { offer_id, event, purchase_id } = await request.json()

        if (!offer_id || !event) {
            return jsonResponse({ error: 'Missing offer_id or event' }, 400)
        }

        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

        // Registrar evento nas analytics usando waitUntil para não bloquear
        ctx.waitUntil((async () => {
            if (event === 'view') {
                const { error } = await supabase.rpc('increment_offer_views', {
                    p_offer_id: offer_id
                })
                if (error) console.error('Error incrementing views:', error)
            } else if (event === 'accept') {
                const { error } = await supabase.rpc('increment_offer_accepts', {
                    p_offer_id: offer_id
                })
                if (error) console.error('Error incrementing accepts:', error)
            } else if (event === 'decline') {
                const { error } = await supabase.rpc('increment_offer_declines', {
                    p_offer_id: offer_id
                })
                if (error) console.error('Error incrementing declines:', error)
            }
        })())

        return jsonResponse({ success: true })

    } catch (error: any) {
        console.error('Offer analytics error:', error)
        return jsonResponse({ error: error.message }, 500)
    }
}
