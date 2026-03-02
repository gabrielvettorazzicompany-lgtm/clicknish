/**
 * Handler: Cache Purge
 *
 * Invalida o cache KV de um checkout específico quando ele é salvo/atualizado
 * no dashboard. Garante que o usuário veja sempre os dados mais recentes,
 * mesmo com TTL de 24h no KV.
 *
 * POST /api/cache/purge
 * Body: { checkoutId: string } ou { shortId: string }
 *
 * Chaves deletadas:
 *   html:<shortId>          — HTML pré-renderizado pelo edge worker
 *   checkout-data:<shortId> — Dados do checkout (produtos, order bumps, etc.)
 *   micro:<shortId>         — Micro-cache anti-burst
 */

import { createClient } from '../lib/supabase'
import type { Env } from '../index'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
}

export async function handleCachePurge(
    request: Request,
    env: Env,
    ctx?: ExecutionContext
): Promise<Response> {
    if (request.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    if (request.method !== 'POST') {
        return json({ error: 'Method not allowed' }, 405)
    }

    if (!env.CACHE) {
        return json({ success: true, message: 'KV not configured — nothing to purge' })
    }

    let body: { checkoutId?: string; shortId?: string }
    try {
        body = await request.json()
    } catch {
        return json({ error: 'Invalid JSON body' }, 400)
    }

    let shortId = body.shortId

    // Se só tiver checkoutId, busca o shortId na tabela checkout_urls
    if (!shortId && body.checkoutId) {
        try {
            const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
            const { data } = await supabase
                .from('checkout_urls')
                .select('id')
                .eq('checkout_id', body.checkoutId)
                .maybeSingle()
            shortId = (data as any)?.id ?? undefined
        } catch (err) {
            console.warn('[purge] Failed to lookup shortId:', err)
        }
    }

    if (!shortId) {
        // Nada a purgar (checkout sem URL curta ainda, ou ID inválido)
        return json({ success: true, message: 'No shortId found — nothing to purge' })
    }

    // Deleta as 3 chaves KV em paralelo, via ctx.waitUntil para não bloquear
    const purgeAll = Promise.allSettled([
        env.CACHE.delete(`html:${shortId}`),
        env.CACHE.delete(`checkout-data:${shortId}`),
        env.CACHE.delete(`micro:${shortId}`),
    ])

    if (ctx) {
        ctx.waitUntil(purgeAll)
    } else {
        await purgeAll
    }

    console.log(`[purge] ✅ Cache purged for shortId: ${shortId}`)
    return json({ success: true, shortId })
}
