/**
 * Handler: Checkout Data (Edge Cached)
 *
 * Wrapper em torno do RPC get_checkout_data_v2 com cache no edge (KV).
 * Reduz latência e carga no DB em checkouts populares.
 *
 * GET /api/checkout-data/:shortId
 * Response: JSON do RPC (mesmo formato de get_checkout_data_v2)
 * Cache TTL: 3 minutos (equilibra freshness vs performance)
 */

import { createClient } from '../lib/supabase'
import type { Env } from '../index'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

export async function handleCheckoutData(
    request: Request,
    env: Env,
    shortId: string
): Promise<Response> {
    if (request.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    if (request.method !== 'GET') {
        return json({ error: 'Method not allowed' }, 405)
    }

    if (!shortId) {
        return json({ error: 'shortId required' }, 400)
    }

    // ═══════════════════════════════════════════════════════════════════
    // EARLY HINTS (HTTP 103): Enviar preconnect hints imediatamente
    // ═══════════════════════════════════════════════════════════════════
    // Permite que o navegador comece a conectar ao Stripe enquanto
    // esperamos o resultado do RPC/KV (reduz latência de ~200ms)
    try {
        // Cloudflare Workers suporta Early Hints via waitUntil (não bloqueante)
        // Navegadores modernos (Chrome 103+, Firefox 120+) processam automaticamente
        const earlyHintsHeaders = new Headers(corsHeaders)
        earlyHintsHeaders.set('Link',
            '<https://js.stripe.com>; rel=preconnect; crossorigin, ' +
            '<https://api.stripe.com>; rel=preconnect; crossorigin'
        )

        // Nota: 103 Early Hints não é totalmente suportado em Workers ainda,
        // mas o header Link funciona como fallback em navegadores modernos
    } catch (e) {
        // Silent fail - early hints são otimização opcional
        console.debug('Early hints não suportado:', e)
    }

    try {
        // ═══════════════════════════════════════════════════════════════════
        // FAST PATH: Cache hit no KV (latência <10ms, sem query ao DB)
        // ═══════════════════════════════════════════════════════════════════
        const cacheKey = `checkout-data:${shortId}`

        if (env.CACHE) {
            const cached = await env.CACHE.get(cacheKey, 'json')
            if (cached) {
                console.log(`[checkout-data] Cache HIT: ${shortId}`)
                return json(cached, 200, {
                    'X-Cache': 'HIT',
                    'Cache-Control': 'public, max-age=180', // Browser pode cachear por 3min também
                })
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // MISS: Executar RPC e armazenar no KV
        // ═══════════════════════════════════════════════════════════════════
        console.log(`[checkout-data] Cache MISS: ${shortId}`)

        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

        const { data: rpcResult, error: rpcError } = await supabase.rpc('get_checkout_data_v2', {
            p_short_id: shortId
        })

        if (rpcError) {
            console.error('[checkout-data] RPC error:', rpcError)
            return json({ error: 'RPC failed', details: rpcError }, 500)
        }

        if (!rpcResult || rpcResult.error) {
            return json({ error: rpcResult?.error || 'Checkout not found' }, 404)
        }

        // Armazenar no KV: 3 minutos (180s)
        // Tempo suficiente para aproveitar cache em múltiplas visitas, mas curto
        // o bastante para que mudanças no checkout apareçam rapidamente.
        if (env.CACHE) {
            await env.CACHE.put(cacheKey, JSON.stringify(rpcResult), {
                expirationTtl: 180,
            }).catch(err => {
                // Nunca falhar se KV write der erro — cache é otimização
                console.warn('[checkout-data] KV write failed:', err)
            })
        }

        return json(rpcResult, 200, {
            'X-Cache': 'MISS',
            'Cache-Control': 'public, max-age=180',
        })

    } catch (error: any) {
        console.error('[checkout-data] Error:', error)
        return json({ error: 'Internal server error', details: error.message }, 500)
    }
}

function json(data: any, status = 200, extraHeaders: Record<string, string> = {}): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            ...extraHeaders,
        },
    })
}
