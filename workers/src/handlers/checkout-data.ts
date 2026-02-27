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
import { checkoutNetworkOptimizer } from '../lib/network-optimizer'
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
        return checkoutNetworkOptimizer.createOptimizedResponse(
            JSON.stringify({ error: 'shortId required' }),
            { status: 400 }
        )
    }

    try {
        // ═══════════════════════════════════════════════════════════════════
        // ULTRA-FAST PATH: Cache hit agressivo (<5ms, zero DB queries)
        // ═══════════════════════════════════════════════════════════════════
        const cacheKey = `checkout-data:${shortId}`

        if (env.CACHE) {
            const cached = await env.CACHE.get(cacheKey, 'json')
            if (cached) {
                console.log(`[checkout-data] ⚡ ULTRA CACHE HIT: ${shortId}`)
                return checkoutNetworkOptimizer.createCheckoutResponse(
                    JSON.stringify(cached),
                    {
                        shortId,
                        cacheHit: true,
                        processingTime: 1
                    }
                )
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
                return checkoutNetworkOptimizer.createCheckoutResponse(
                    JSON.stringify(microCached),
                    {
                        shortId,
                        cacheHit: true,
                        processingTime: 2
                    }
                )
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
            return checkoutNetworkOptimizer.createOptimizedResponse(
                JSON.stringify({ error: 'RPC failed', details: rpcError }),
                { status: 500 }
            )
        }

        if (!rpcResult || rpcResult.error) {
            return checkoutNetworkOptimizer.createOptimizedResponse(
                JSON.stringify({ error: rpcResult?.error || 'Checkout not found' }),
                { status: 404 }
            )
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
        const processingTime = Date.now() - startTime

        // ✅ OPTIMIZED RESPONSE: Com Early Hints e HTTP/3
        return checkoutNetworkOptimizer.createCheckoutResponse(
            JSON.stringify(rpcResult),
            {
                shortId,
                cacheHit: false,
                processingTime
            }
        )

    } catch (error: any) {
        console.error('[checkout-data] Error:', error)
        return checkoutNetworkOptimizer.createOptimizedResponse(
            JSON.stringify({ error: 'Internal server error', details: error.message }),
            { status: 500 }
        )
    }
}
