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
import { applyFxConversion, roundForCurrency } from '../lib/fx'
import type { Env } from '../index'

function json(data: any, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
}

/**
 * Aplica conversão FX ao resultado, adicionando displayPrice/displayCurrency ao produto e ofertas.
 * O resultado original (base) NÃO é mutado — o cache KV sempre armazena a versão sem FX.
 */
async function withFxConversion(result: any, clientCountry: string | null | undefined, env: Env): Promise<any> {
    if (!result?.product) return result
    const basePrice = result.checkout?.custom_price || result.product?.price || 0
    const baseCurrency = (result.product?.currency || 'USD').toUpperCase()
    if (basePrice <= 0) return result

    const fxResult = await applyFxConversion(basePrice, baseCurrency, clientCountry, env)

    // Aplicar mesma taxa nas ofertas (order bumps) se houve conversão
    let convertedOffers = result.offers
    if (result.offers?.length > 0 && fxResult.rateApplied !== 1) {
        convertedOffers = result.offers.map((offer: any) => ({
            ...offer,
            display_price: roundForCurrency((offer.offer_price || 0) * fxResult.rateApplied, fxResult.displayCurrency),
            display_currency: fxResult.displayCurrency,
        }))
    }

    return {
        ...result,
        product: {
            ...result.product,
            currency: fxResult.baseCurrency,
            displayPrice: fxResult.displayPrice,
            displayCurrency: fxResult.displayCurrency,
        },
        offers: convertedOffers,
    }
}

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

export async function handleCheckoutData(
    request: Request,
    env: Env,
    shortId: string,
    ctx?: ExecutionContext
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
        // ULTRA-FAST PATH: Lê main-cache e micro-cache em PARALELO (<5ms)
        // ═══════════════════════════════════════════════════════════════════
        const cacheKey = `checkout-data:${shortId}`
        const microCacheKey = `micro:${shortId}`

        if (env.CACHE) {
            const [cached, microCached] = await Promise.all([
                env.CACHE.get(cacheKey, 'json'),
                env.CACHE.get(microCacheKey, 'json'),
            ])

            if (cached) {
                console.log(`[checkout-data] ⚡ CACHE HIT: ${shortId}`)
                const clientCountry = (request as any).cf?.country || request.headers.get('cf-ipcountry')
                const withFx = await withFxConversion(cached, clientCountry, env)
                return checkoutNetworkOptimizer.createCheckoutResponse(
                    JSON.stringify(withFx),
                    { shortId, cacheHit: true, processingTime: 1 }
                )
            }
            if (microCached) {
                console.log(`[checkout-data] ⚡ MICRO CACHE HIT: ${shortId}`)
                const clientCountry = (request as any).cf?.country || request.headers.get('cf-ipcountry')
                const withFx = await withFxConversion(microCached, clientCountry, env)
                return checkoutNetworkOptimizer.createCheckoutResponse(
                    JSON.stringify(withFx),
                    { shortId, cacheHit: true, processingTime: 2 }
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

        // Se RPC falhou ou retornou erro, tenta fallback com queries diretas
        let finalResult = rpcResult && !rpcResult.error ? rpcResult : null

        if (!finalResult) {
            if (rpcError) console.error('[checkout-data] RPC error, trying fallback:', rpcError)
            else console.warn('[checkout-data] RPC returned no/error result, trying fallback:', rpcResult?.error)

            // ── FALLBACK: queries diretas (service role bypassa RLS) ────────────
            try {
                const { data: urlRow, error: urlErr } = await supabase
                    .from('checkout_urls')
                    .select('member_area_id, application_id, checkout_id')
                    .eq('id', shortId)
                    .single()

                if (!urlErr && urlRow) {
                    const checkoutId = urlRow.checkout_id
                    const isApp = !!urlRow.application_id
                    const productId = urlRow.application_id || urlRow.member_area_id

                    const [{ data: ck }, { data: prod }] = await Promise.all([
                        supabase.from('checkouts').select('*').eq('id', checkoutId).single(),
                        isApp
                            ? supabase.from('applications').select('*').eq('id', productId).single()
                            : supabase.from('marketplace_products').select('*').eq('id', productId).single(),
                    ])

                    if (ck && prod) {
                        finalResult = {
                            checkout: {
                                id: ck.id,
                                name: ck.name,
                                is_default: ck.is_default,
                                custom_price: ck.custom_price,
                                banner_image: ck.banner_image,
                                banner_title: ck.banner_title,
                                custom_height: ck.custom_height,
                                custom_width: ck.custom_width,
                                language: ck.language || 'en',
                                application_id: ck.application_id,
                                member_area_id: ck.member_area_id,
                                custom_fields: ck.custom_fields || {},
                                created_at: ck.created_at,
                            },
                            product: {
                                id: prod.id,
                                name: prod.name,
                                price: isApp ? 0 : (prod as any).price || 0,
                                currency: ((prod as any).currency || 'USD').toUpperCase(),
                                image_url: isApp ? (prod as any).logo_url : (prod as any).image_url,
                                description: prod.description || '',
                                payment_methods: (prod as any).payment_methods || ['credit_card'],
                                default_payment_method: (prod as any).default_payment_method || 'credit_card',
                                dynamic_checkout: (prod as any).dynamic_checkout || false,
                                applicationId: isApp ? prod.id : undefined,
                            },
                            productType: isApp ? 'app' : 'marketplace',
                            offers: [],
                            applicationProducts: [],
                            redirectConfig: { success_url: null },
                        }
                        console.log(`[checkout-data] Fallback OK for shortId: ${shortId}`)
                    }
                }
            } catch (fallbackErr) {
                console.error('[checkout-data] Fallback also failed:', fallbackErr)
            }
        }

        if (!finalResult) {
            return checkoutNetworkOptimizer.createOptimizedResponse(
                JSON.stringify({ error: 'Checkout not found' }),
                { status: 404 }
            )
        }

        // ── Resolva a publishable key correta para este vendedor ────────────────
        // (individual override > global default) — incluída no cache junto com o resultado
        try {
            const ck = finalResult.checkout
            const productId = ck.application_id || ck.member_area_id
            if (productId) {
                const isApp = !!ck.application_id
                const { data: prodRow } = await supabase
                    .from(isApp ? 'applications' : 'marketplace_products')
                    .select('owner_id')
                    .eq('id', productId)
                    .maybeSingle()

                const ownerId = prodRow?.owner_id
                if (ownerId) {
                    const { data: userCfg } = await supabase
                        .from('user_payment_config')
                        .select('provider_id')
                        .eq('user_id', ownerId)
                        .eq('override_platform_default', true)
                        .maybeSingle()

                    if (userCfg?.provider_id) {
                        const { data: prov } = await supabase
                            .from('payment_providers')
                            .select('credentials')
                            .eq('id', userCfg.provider_id)
                            .eq('is_active', true)
                            .maybeSingle()
                        const key = prov?.credentials?.publishable_key
                        if (key) finalResult.stripe_publishable_key = key
                    }
                }
            }

            // Fallback para provedor global se não resolveu individual
            if (!finalResult.stripe_publishable_key) {
                const { data: globalProv } = await supabase
                    .from('payment_providers')
                    .select('credentials')
                    .eq('is_global_default', true)
                    .eq('is_active', true)
                    .maybeSingle()
                const globalKey = globalProv?.credentials?.publishable_key
                if (globalKey) finalResult.stripe_publishable_key = globalKey
            }
        } catch (keyErr) {
            console.warn('[checkout-data] Could not resolve stripe publishable key:', keyErr)
        }

        // Sanitiza offers: PostgreSQL serializa NaN numeric como string "NaN" no JSON.
        // Substituímos pelo preço correto (original_price) ou 0, para evitar $NaN no checkout.
        if (finalResult?.offers?.length > 0) {
            finalResult.offers = finalResult.offers.map((offer: any) => {
                const safeNum = (v: any): number | null => {
                    if (v == null) return null
                    const n = Number(v)
                    return isNaN(n) ? null : n
                }
                const offerPrice = safeNum(offer.offer_price)
                const originalPrice = safeNum(offer.original_price)
                return {
                    ...offer,
                    offer_price: offerPrice ?? originalPrice ?? 0,
                    original_price: originalPrice ?? 0,
                }
            })
        }

        if (env.CACHE && finalResult) {
            // Salva versão BASE (sem FX) no KV — cache compartilhado entre todos os usuários
            const serialized = JSON.stringify(finalResult)
            const mainCachePromise = env.CACHE.put(cacheKey, serialized, { expirationTtl: 86400 })
            const microCachePromise = env.CACHE.put(microCacheKey, serialized, { expirationTtl: 120 })
            const writeAll = Promise.allSettled([mainCachePromise, microCachePromise])
                .catch(err => console.warn('[checkout-data] KV write failed:', err))
            if (ctx) ctx.waitUntil(writeAll)
            else await writeAll
        }

        // Aplicar FX DEPOIS de salvar no cache (resposta personalizada por IP)
        const clientCountry = (request as any).cf?.country || request.headers.get('cf-ipcountry')
        const resultWithFx = await withFxConversion(finalResult, clientCountry, env)

        return checkoutNetworkOptimizer.createCheckoutResponse(
            JSON.stringify(resultWithFx),
            { shortId, cacheHit: false, processingTime: 0 }
        )

    } catch (error: any) {
        console.error('[checkout-data] Error:', error)
        return checkoutNetworkOptimizer.createOptimizedResponse(
            JSON.stringify({ error: 'Internal server error', details: error.message }),
            { status: 500 }
        )
    }
}
