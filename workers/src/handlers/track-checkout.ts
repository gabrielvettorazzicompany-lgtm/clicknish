// @ts-nocheck
/**
 * Handler: Track Checkout
 * Tracking de eventos de checkout (page_view, conversion, bounce)
 */

import { createClient } from '../lib/supabase'
import type { Env } from '../index'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface TrackingPayload {
    checkoutId: string
    eventType: 'page_view' | 'conversion' | 'bounce'
    userAgent?: string
    referrer?: string
    sessionId?: string
    metadata?: Record<string, any>
}

function jsonResponse(data: any, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
}

export async function handleTrackCheckout(
    request: Request,
    env: Env,
    ctx: ExecutionContext
): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405, headers: corsHeaders })
    }

    try {
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

        // Capturar IP de múltiplas fontes (Cloudflare, proxy, etc)
        const clientIP =
            request.headers.get('cf-connecting-ip') ||
            request.headers.get('x-real-ip') ||
            request.headers.get('x-forwarded-for')?.split(',')[0] ||
            request.headers.get('x-client-ip') ||
            'unknown'

        // Parse do body da requisição
        const payload: TrackingPayload = await request.json()

        // Geolocalização via headers Cloudflare (0ms)
        const geoData = {
            country: request.headers.get('cf-ipcountry') || request.headers.get('x-country') || null,
            region: request.headers.get('cf-region') || null,
            city: request.headers.get('cf-ipcity') || request.headers.get('x-city') || null,
            timezone: request.headers.get('cf-timezone') || null
        }

        // Preparar dados para inserção
        const analyticsData = {
            checkout_id: payload.checkoutId,
            event_type: payload.eventType,
            user_ip: clientIP,
            user_agent: payload.userAgent || request.headers.get('user-agent') || '',
            referrer: payload.referrer || request.headers.get('referer') || '',
            session_id: payload.sessionId || crypto.randomUUID(),
            country: geoData.country,
            region: geoData.region,
            city: geoData.city,
            timezone: geoData.timezone,
            metadata: {
                ...payload.metadata,
                user_agent: payload.userAgent || request.headers.get('user-agent'),
                accept_language: request.headers.get('accept-language'),
                cf_country: request.headers.get('cf-ipcountry'),
                cf_ray: request.headers.get('cf-ray'),
                timestamp: new Date().toISOString()
            },
            created_at: new Date().toISOString()
        }

        // Inserir no banco de dados
        const { data, error } = await supabase
            .from('checkout_analytics')
            .insert(analyticsData)
            .select()

        if (error) {
            console.error('❌ [Worker] Database error:', error)
            throw error
        }

        return jsonResponse({
            success: true,
            id: data[0]?.id,
            ip: clientIP,
            location: geoData.city ? `${geoData.city}, ${geoData.country}` : null
        })

    } catch (error: any) {
        console.error('🚨 [Worker] track-checkout error:', error)
        return jsonResponse({ error: error.message, success: false }, 500)
    }
}
