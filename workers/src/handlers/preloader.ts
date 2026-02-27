/**
 * Handler: Cache Preloader (Warming System)
 * 
 * SISTEMA DE PRÉ-AQUECIMENTO INTELIGENTE:
 * • Monitora checkouts populares e carrega dados no cache preventivamente
 * • Executa a cada 2 minutos via cron trigger
 * • Garante que checkouts quentes nunca sofram cache miss
 * • Analytics de hit rate para otimização contínua
 */

import { createClient } from '../lib/supabase'
import type { Env } from '../index'

export async function handleCachePreloader(
    request: Request,
    env: Env,
): Promise<Response> {

    try {
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

        // ═══════════════════════════════════════════════════════════════════
        // BUSCAR CHECKOUTS MAIS ACESSADOS NAS ÚLTIMAS 2 HORAS
        // ═══════════════════════════════════════════════════════════════════
        const { data: hotCheckouts } = await supabase.rpc('get_hot_checkouts', {
            hours_back: 2,
            limit_count: 50  // Top 50 checkouts mais acessados
        })

        if (!hotCheckouts || !Array.isArray(hotCheckouts)) {
            return new Response('No hot checkouts found', { status: 200 })
        }

        const results: Array<{ shortId: string, status: string, duration: number }> = []

        // ═══════════════════════════════════════════════════════════════════
        // PRÉ-CARREGAR DADOS DE CHECKOUTS QUENTES
        // ═══════════════════════════════════════════════════════════════════
        for (const checkout of hotCheckouts.slice(0, 20)) {  // Máximo 20 simultâneos
            const shortId = checkout.short_id
            if (!shortId) continue

            const startTime = Date.now()

            try {
                // Verificar se já está no cache
                const cacheKey = `checkout-data:${shortId}`
                const cached = await env.CACHE?.get(cacheKey, 'json')

                if (cached) {
                    results.push({
                        shortId,
                        status: 'already-warm',
                        duration: Date.now() - startTime
                    })
                    continue
                }

                // Cache miss - carregar dados e aquecer cache
                const { data: rpcResult, error } = await supabase.rpc('get_checkout_data_v2', {
                    p_short_id: shortId
                })

                if (error || !rpcResult) {
                    results.push({
                        shortId,
                        status: 'error',
                        duration: Date.now() - startTime
                    })
                    continue
                }

                // Armazenar no cache com TTL longo para checkouts quentes
                if (env.CACHE) {
                    await Promise.all([
                        env.CACHE.put(cacheKey, JSON.stringify(rpcResult), {
                            expirationTtl: 600  // 10 minutos para checkouts quentes
                        }),
                        env.CACHE.put(`micro:${shortId}`, JSON.stringify(rpcResult), {
                            expirationTtl: 60   // 1 minuto micro cache
                        })
                    ])
                }

                results.push({
                    shortId,
                    status: 'warmed',
                    duration: Date.now() - startTime
                })

            } catch (error) {
                results.push({
                    shortId,
                    status: 'failed',
                    duration: Date.now() - startTime
                })
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // ANALYTICS: Registrar performance do preloader
        // ═══════════════════════════════════════════════════════════════════
        const stats = {
            total_processed: results.length,
            already_warm: results.filter(r => r.status === 'already-warm').length,
            newly_warmed: results.filter(r => r.status === 'warmed').length,
            errors: results.filter(r => r.status === 'error' || r.status === 'failed').length,
            avg_duration: results.length > 0
                ? Math.round(results.reduce((sum, r) => sum + r.duration, 0) / results.length)
                : 0,
            run_timestamp: new Date().toISOString()
        }

        // Salvar analytics em background
        supabase.from('cache_preloader_stats').insert(stats)
            .then(() => console.log('Preloader stats saved'))
            .catch((err: unknown) => console.warn('Stats save failed:', err))

        console.log(`🔥 Cache preloader: ${stats.newly_warmed} warmed, ${stats.already_warm} already warm, ${stats.errors} errors`)

        return new Response(JSON.stringify({
            success: true,
            stats,
            details: results.slice(0, 10)  // Primeiros 10 para debug
        }), {
            headers: { 'Content-Type': 'application/json' }
        })

    } catch (error: any) {
        console.error('Cache preloader failed:', error)
        return new Response(`Preloader error: ${error.message}`, {
            status: 500
        })
    }
}