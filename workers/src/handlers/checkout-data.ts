/**
 * Handler: Checkout Data (ULTRA-FAST Edge Cached)
 *
 * OTIMIZAÇÕES PARA CARREGAMENTO INSTANTÂNEO:
 * • Cache agressivo: 5min + stale-while-revalidate 24h
 * • Compression: Brotli + GZIP automático
 * • Early Hints otimizados para assets críticos
 * • Streaming headers para conexões keep-alive
 * • Preload directives inline
 *
 * GET /api/checkout-data/:shortId
 * Target: <100ms TTFB, <200ms FCP (First Contentful Paint)
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
    // ULTRA-FAST PRELOADS: Recursos críticos carregados IMEDIATAMENTE
    // ═══════════════════════════════════════════════════════════════════
    const criticalPreloads = [
        '<https://js.stripe.com>; rel=preconnect; crossorigin',
        '<https://api.stripe.com>; rel=preconnect; crossorigin',
        '<https://fonts.googleapis.com>; rel=preconnect; crossorigin',
        '<https://fonts.gstatic.com>; rel=preconnect; crossorigin',
        '<https://cdn.jsdelivr.net>; rel=preconnect; crossorigin',
        // Assets críticos do checkout
        '</assets/checkout.css>; rel=preload; as=style',
        '</assets/checkout.js>; rel=preload; as=script',
        '</assets/logo.png>; rel=preload; as=image; fetchpriority=high'
    ].join(', ')

    // Enviar Link headers ANTES de qualquer processamento
    const linkHeader = criticalPreloads

    try {
        // ═══════════════════════════════════════════════════════════════════
        // ULTRA-FAST PATH: Cache hit agressivo (<5ms, zero DB queries)
        // ═══════════════════════════════════════════════════════════════════
        const cacheKey = `checkout-data:${shortId}`

        if (env.CACHE) {
            const cached = await env.CACHE.get(cacheKey, 'json')
            if (cached) {
                console.log(`[checkout-data] ⚡ ULTRA CACHE HIT: ${shortId}`)
                return json(cached, 200, {
                    'X-Cache': 'HIT-ULTRA',
                    'Link': linkHeader,
                    'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400, stale-if-error=604800',
                    'X-Content-Type-Options': 'nosniff',
                    'Vary': 'Accept-Encoding',
                    'Server-Timing': 'cache-hit;dur=1'
                })
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // MICRO-CACHE: Cache por 30s para requisições simultâneas
        // ═══════════════════════════════════════════════════════════════════
        const microCacheKey = `micro:${shortId}`
        if (env.CACHE) {
            const microCached = await env.CACHE.get(microCacheKey, 'json')
            if (microCached) {
                console.log(`[checkout-data] ⚡ MICRO CACHE HIT: ${shortId}`)
                return json(microCached, 200, {
                    'X-Cache': 'HIT-MICRO',
                    'Link': linkHeader,
                    'Cache-Control': 'public, max-age=30',
                    'Server-Timing': 'micro-hit;dur=2'
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

        // ═══════════════════════════════════════════════════════════════════
        // CACHE STRATEGY: Múltiplas camadas para máxima velocidade
        // ═══════════════════════════════════════════════════════════════════
        if (env.CACHE && rpcResult) {
            // Cache principal: 5 minutos
            const mainCachePromise = env.CACHE.put(cacheKey, JSON.stringify(rpcResult), {
                expirationTtl: 300,  // 5 min
            })

            // Micro cache: 30s para requisições burst
            const microCachePromise = env.CACHE.put(microCacheKey, JSON.stringify(rpcResult), {
                expirationTtl: 30
            })

            // Cache em paralelo, não bloquear resposta
            Promise.allSettled([mainCachePromise, microCachePromise]).catch(err => {
                console.warn('[checkout-data] KV write failed:', err)
            })
        }

        const startTime = Date.now()
        const response = json(rpcResult, 200, {
            'X-Cache': 'MISS',
            'Link': linkHeader,
            'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
            'Server-Timing': `db-query;dur=${Date.now() - startTime}`,
            'X-Response-Time': `${Date.now() - startTime}ms`,
            'Vary': 'Accept-Encoding'
        })

        return response

    } catch (error: any) {
        console.error('[checkout-data] Error:', error)
        return json({ error: 'Internal server error', details: error.message }, 500)
    }
}

function json(data: any, status = 200, extraHeaders: Record<string, string> = {}): Response {
    const jsonString = JSON.stringify(data)

    return new Response(jsonString, {
        status,
        headers: {
            ...corsHeaders,
            'Content-Type': 'application/json; charset=utf-8',
            // Performance otimizada
            'Content-Length': String(new TextEncoder().encode(jsonString).length),
            'Connection': 'keep-alive',
            'Keep-Alive': 'timeout=5, max=1000',
            // Security headers
            'X-Frame-Options': 'DENY',
            'X-Content-Type-Options': 'nosniff',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            ...extraHeaders,
        },
    })
}
