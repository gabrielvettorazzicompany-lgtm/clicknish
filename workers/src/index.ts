/**
 * Cloudflare Workers - API de Pagamentos
 * 
 * Rotas:
 * - POST /api/process-payment  → Processar pagamento
 * - POST /api/process-upsell   → Processar upsell 1-click
 * - GET  /health               → Health check
 */

import { handleProcessPayment } from './handlers/process-payment'
import { handleProcessUpsell } from './handlers/process-upsell'
import { handleApplications } from './handlers/applications'
import { handleTrackCheckout } from './handlers/track-checkout'
import { handleUtmifyAbandoned } from './handlers/utmify-abandoned'
import { handleUtmifyRefunded } from './handlers/utmify-refunded'
import { handleUtmifyRefused } from './handlers/utmify-refused'
import { handleDashboardStats } from './handlers/dashboard-stats'
import { handleOrders } from './handlers/orders'
import { handleFinance, handleWithdraw, handleAnticipate, handleRequestPlan } from './handlers/finance'
import { handleFunnelPageWidget } from './handlers/funnel-page-widget'
import { handleOfferAnalytics } from './handlers/offer-analytics'
import { handleOfferWidget } from './handlers/offer-widget'
import { handleApps } from './handlers/apps'
import { handleAuth } from './handlers/auth'
import { handleClients } from './handlers/clients'
import { handleConfirmReset } from './handlers/confirm-reset'
import { handleMarketplaceProducts } from './handlers/marketplace-products'
import { handleMarketplaceProductsPublic } from './handlers/marketplace-products-public'
import { handleMembers } from './handlers/members'
import { handleProducts } from './handlers/products'
import { handleRequestPasswordReset } from './handlers/request-password-reset'
import { handleSendEmail } from './handlers/send-email'
import { handleSuperadmin } from './handlers/superadmin'
import { handleWebhooks, handleStripeWebhook } from './handlers/webhooks'
import { handleCheckoutSession } from './handlers/checkout-session'
import { handleCheckoutData } from './handlers/checkout-data'
import { handleCachePreloader } from './handlers/preloader'
import { handleCachePurge } from './handlers/purge'
import { handleSendConfirmationEmail } from './handlers/send-confirmation-email'
import { handleProcessMolliePayment } from './handlers/process-mollie-payment'
import { handleProcessStripePayment } from './handlers/process-stripe-payment'
import { handleCustomerAuth } from './handlers/customer-auth'

import { handleWeeklyReserve } from './handlers/weekly-reserve'

export interface Env {
    // Variáveis públicas
    SUPABASE_URL: string
    FRONTEND_URL: string

    // Secrets (configurar via wrangler secret put)
    SUPABASE_SERVICE_ROLE_KEY: string
    PAYPAL_CLIENT_ID: string
    PAYPAL_CLIENT_SECRET: string
    PAYPAL_ENVIRONMENT: 'sandbox' | 'live'

    // KV Storage — cache de sessões de checkout e dados gerais
    CACHE?: KVNamespace

    // Stripe Webhook secret (wrangler secret put STRIPE_WEBHOOK_SECRET)
    STRIPE_WEBHOOK_SECRET?: string

    // Mollie (opcional: chave global via env, ou via payment_providers no DB)
    MOLLIE_API_KEY?: string

    // Email (Resend)
    RESEND_API_KEY?: string
    RESEND_FROM?: string
}

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
}

export default {
    // ⚡ CRON TRIGGER: Pré-aquecimento automático de cache a cada 2 minutos
    //                  + Reserva financeira semanal toda segunda-feira
    async scheduled(event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
        const cron = event.cron

        // Toda segunda-feira 06:00 UTC: calcular reserva semanal (15% das vendas)
        if (cron === '0 6 * * 1') {
            console.log('💰 Cron: weekly financial reserve starting')
            await handleWeeklyReserve(env)
            return
        }

        // A cada 2 minutos: pré-aquecimento de cache
        console.log('🔥 Cron: cache preloader starting')
        const fakeRequest = new Request('https://api.clicknich.com/api/cache-preloader')
        await handleCachePreloader(fakeRequest, env)
    },

    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url)
        const { pathname } = url

        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response('ok', { headers: corsHeaders })
        }

        try {
            // ═══════════════════════════════════════════════════════════════
            // ROTEAMENTO
            // ═══════════════════════════════════════════════════════════════

            // Health check
            if (pathname === '/health' || pathname === '/api/health') {
                return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() })
            }

            // API Routes
            if (pathname.startsWith('/api/')) {
                return handleApiRoute(request, env, ctx, pathname)
            }

            // 404 para rotas não reconhecidas
            return jsonResponse({
                success: false,
                error: 'Not found',
                path: pathname,
            }, 404)

        } catch (error: any) {
            console.error('Worker error:', error)

            return jsonResponse({
                success: false,
                error: error.message || 'Internal server error',
            }, 500)
        }
    },
}

/**
 * Roteia chamadas de API
 */
async function handleApiRoute(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
    pathname: string
): Promise<Response> {

    // POST /api/checkout-session — pré-carrega dados no KV quando o checkout abre
    if (pathname === '/api/checkout-session' && request.method === 'POST') {
        return handleCheckoutSession(request, env)
    }

    // GET /api/checkout-data/:shortId — RPC com cache edge ultra-rápido (30min TTL)
    if (pathname.startsWith('/api/checkout-data/') && request.method === 'GET') {
        const shortId = pathname.split('/api/checkout-data/')[1]
        return handleCheckoutData(request, env, shortId, ctx)
    }

    // POST /api/cache/purge — invalida KV ao salvar checkout no dashboard
    if (pathname === '/api/cache/purge' && request.method === 'POST') {
        return handleCachePurge(request, env, ctx)
    }

    // GET /api/cache-preloader — Sistema de pré-aquecimento inteligente (cron trigger)
    if (pathname === '/api/cache-preloader' && request.method === 'GET') {
        return handleCachePreloader(request, env)
    }

    // GET /api/stripe-public-key — retorna publishable key do provider Stripe ativo (chave pública, sem auth)
    // Aceita ?shortId= para retornar a chave do provedor individual do vendedor desse checkout
    if (pathname === '/api/stripe-public-key' && request.method === 'GET') {
        const { createClient } = await import('./lib/supabase')
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
        const reqUrl = new URL(request.url)
        const shortId = reqUrl.searchParams.get('shortId')

        if (shortId) {
            // 1. Resolve owner_id via checkout_urls
            const { data: urlRow } = await supabase
                .from('checkout_urls')
                .select('application_id, member_area_id')
                .eq('id', shortId)
                .maybeSingle()

            if (urlRow) {
                const urlRowAny = urlRow as any
                const productId = urlRowAny.application_id || urlRowAny.member_area_id
                const table = urlRowAny.application_id ? 'applications' : 'marketplace_products'
                const { data: prod } = await supabase
                    .from(table)
                    .select('owner_id')
                    .eq('id', productId)
                    .maybeSingle()
                const ownerId = (prod as any)?.owner_id

                if (ownerId) {
                    // 2. Verifica se o vendedor tem provedor individual
                    const { data: userCfg } = await supabase
                        .from('user_payment_config')
                        .select('provider_id')
                        .eq('user_id', ownerId)
                        .eq('override_platform_default', true)
                        .maybeSingle()

                    if ((userCfg as any)?.provider_id) {
                        const { data: prov } = await supabase
                            .from('payment_providers')
                            .select('credentials')
                            .eq('id', (userCfg as any).provider_id)
                            .eq('is_active', true)
                            .maybeSingle()
                        const key = (prov as any)?.credentials?.publishable_key
                        if (key) return jsonResponse({ publishable_key: key })
                    }
                }
            }
        }

        // Fallback: provedor global padrão
        const { data: provider } = await supabase
            .from('payment_providers')
            .select('credentials')
            .in('type', ['stripe', 'stripe_connect'])
            .eq('is_active', true)
            .order('is_global_default', { ascending: false })
            .limit(1)
            .maybeSingle()
        const publishableKey = (provider as any)?.credentials?.publishable_key || null
        return jsonResponse({ publishable_key: publishableKey })
    }

    // POST /api/process-payment
    if (pathname === '/api/process-payment' && request.method === 'POST') {
        return handleProcessPayment(request, env, ctx)
    }

    // POST /api/process-mollie-payment
    if (pathname === '/api/process-mollie-payment' && request.method === 'POST') {
        return handleProcessMolliePayment(request, env, ctx)
    }

    // POST /api/process-stripe-payment (redirect flow: iDEAL, Bancontact, etc.)
    if (pathname === '/api/process-stripe-payment' && request.method === 'POST') {
        return handleProcessStripePayment(request, env, ctx)
    }

    // POST /api/process-upsell
    if (pathname === '/api/process-upsell' && request.method === 'POST') {
        return handleProcessUpsell(request, env, ctx)
    }

    // GET /api/stripe/methods — métodos Stripe habilitados no provedor ativo
    if (pathname === '/api/stripe/methods' && request.method === 'GET') {
        const { createClient } = await import('./lib/supabase')
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
        const { data: prov } = await supabase
            .from('payment_providers')
            .select('enabled_methods')
            .in('type', ['stripe', 'stripe_connect'])
            .eq('is_active', true)
            .order('is_global_default', { ascending: false })
            .limit(1)
            .maybeSingle()
        const enabledMethods: string[] = (prov?.enabled_methods || []).filter(
            (m: string) => !['card', 'apple_pay', 'google_pay'].includes(m)
        )

        // Mapa de labels para métodos Stripe
        const STRIPE_METHOD_LABELS: Record<string, string> = {
            ideal: 'iDEAL',
            bancontact: 'Bancontact',
            sofort: 'SOFORT',
            giropay: 'Giropay',
            eps: 'EPS',
            p24: 'Przelewy24',
            alipay: 'Alipay',
            wechat_pay: 'WeChat Pay',
            sepa_debit: 'SEPA Direct Debit',
            klarna: 'Klarna',
            afterpay_clearpay: 'Afterpay / Clearpay',
            affirm: 'Affirm',
            multibanco: 'Multibanco',
            link: 'Link',
            amazon_pay: 'Amazon Pay',
            revolut_pay: 'Revolut Pay',
            mobilepay: 'MobilePay',
            twint: 'TWINT',
        }

        const STRIPE_ICONS: Record<string, string> = {
            ideal: 'https://checkoutshopper-live.adyen.com/checkoutshopper/images/logos/ideal.svg',
            bancontact: 'https://checkoutshopper-live.adyen.com/checkoutshopper/images/logos/bcmc.svg',
            sofort: 'https://checkoutshopper-live.adyen.com/checkoutshopper/images/logos/directEbanking.svg',
            giropay: 'https://checkoutshopper-live.adyen.com/checkoutshopper/images/logos/giropay.svg',
            eps: 'https://checkoutshopper-live.adyen.com/checkoutshopper/images/logos/eps.svg',
            p24: 'https://checkoutshopper-live.adyen.com/checkoutshopper/images/logos/p24.svg',
            alipay: 'https://checkoutshopper-live.adyen.com/checkoutshopper/images/logos/alipay.svg',
            klarna: 'https://cdn.klarna.com/1.0/shared/image/generic/logo/en_us/basic/logo_black.png',
            sepa_debit: 'https://checkoutshopper-live.adyen.com/checkoutshopper/images/logos/sepadirectdebit.svg',
            link: 'https://b.stripecdn.com/docs-statics-srv/assets/link.svg',
            amazon_pay: 'https://checkoutshopper-live.adyen.com/checkoutshopper/images/logos/amazonpay.svg',
            wechat_pay: 'https://checkoutshopper-live.adyen.com/checkoutshopper/images/logos/wechatpay.svg',
            multibanco: 'https://checkoutshopper-live.adyen.com/checkoutshopper/images/logos/multibanco.svg',
            afterpay_clearpay: 'https://checkoutshopper-live.adyen.com/checkoutshopper/images/logos/afterpay.svg',
            revolut_pay: 'https://checkoutshopper-live.adyen.com/checkoutshopper/images/logos/revolut.svg',
            mobilepay: 'https://checkoutshopper-live.adyen.com/checkoutshopper/images/logos/mobilepay.svg',
            twint: 'https://checkoutshopper-live.adyen.com/checkoutshopper/images/logos/twint.svg',
            affirm: 'https://cdn.affirm.com/img/buttons/logo-white.svg',
        }

        const methods = enabledMethods.map(id => ({
            id,
            label: STRIPE_METHOD_LABELS[id] || id,
            icon_url: STRIPE_ICONS[id] || null,
        }))

        return jsonResponse({ methods })
    }

    // GET /api/mollie/methods — métodos Mollie habilitados, filtrados por país do visitante
    if (pathname === '/api/mollie/methods' && request.method === 'GET') {
        const { createClient } = await import('./lib/supabase')
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
        const { data: prov } = await supabase
            .from('payment_providers')
            .select('enabled_methods')
            .eq('type', 'mollie')
            .eq('is_active', true)
            .order('is_global_default', { ascending: false })
            .limit(1)
            .maybeSingle()
        // Se não há provedor Mollie ativo, retornar lista vazia imediatamente
        if (!prov) {
            return jsonResponse({ methods: [], country: null })
        }
        const enabledMethods: string[] = prov?.enabled_methods || []
        const reqUrl = new URL(request.url)
        // ?all=1  → modo admin (AppSettingsTab do owner): sem filtro de país, sem limite
        // ?dynamic=1 → checkout dinâmico: filtro por país + ordenar por popularidade + limitar a 2
        const skipGeoFilter = reqUrl.searchParams.get('all') === '1'
        const isDynamic = reqUrl.searchParams.get('dynamic') === '1'
        // Detectar país via Cloudflare (CF-IPCountry header injetado automaticamente)
        const visitorCountry = skipGeoFilter ? null
            : ((request as any).cf?.country || request.headers.get('CF-IPCountry') || null)

        // Buscar métodos da tabela de referência
        let query = supabase
            .from('mollie_payment_methods')
            .select('id, label, description, countries, currencies, icon_url, sort_order, country_popularity')
        if (enabledMethods.length > 0) {
            query = query.in('id', enabledMethods)
        }
        if (!skipGeoFilter && visitorCountry) {
            query = query.or(`countries.cs.{"*"},countries.cs.{"${visitorCountry}"}`)
        }
        const { data: methodDefs } = await query.order('sort_order')
        const knownIds = new Set((methodDefs || []).map((m: any) => m.id))

        let methods = [...(methodDefs || [])]

        // Modo dinâmico: ordenar por popularidade do país e limitar a 2
        if (isDynamic && visitorCountry && methods.length > 0) {
            methods = methods
                .map(m => ({
                    ...m,
                    _rank: m.country_popularity?.[visitorCountry] ?? 99,
                }))
                .filter(m => m._rank < 99) // só métodos com rank definido para o país
                .sort((a, b) => a._rank - b._rank)
                .slice(0, 2)
                .map(({ _rank, ...m }) => m)

            // Se não há métodos com rank para este país, retornar os 2 com menor sort_order
            if (methods.length === 0) {
                methods = (methodDefs || []).slice(0, 2)
            }
        }

        // Fallback: IDs que estão em enabled_methods mas não existem na tabela
        if (!isDynamic) {
            const fallbackMethods = enabledMethods
                .filter(id => !knownIds.has(id))
                .map(id => ({
                    id,
                    label: id.charAt(0).toUpperCase() + id.slice(1),
                    description: null,
                    countries: ['*'],
                    currencies: ['EUR'],
                    icon_url: `https://www.mollie.com/external/icons/payment-methods/${id}.svg`,
                    sort_order: 99,
                }))
            methods = [...methods, ...fallbackMethods]
        }

        return jsonResponse({ methods, country: visitorCountry })
    }

    // /api/applications/* - CRUD de aplicações
    if (pathname.startsWith('/api/applications')) {
        return handleApplications(request, env, ctx)
    }

    // POST /api/track-checkout - Tracking de checkout
    if (pathname === '/api/track-checkout' && request.method === 'POST') {
        return handleTrackCheckout(request, env, ctx)
    }

    // POST /api/utmify-abandoned - Webhook UTMify abandonado
    if (pathname === '/api/utmify-abandoned' && request.method === 'POST') {
        return handleUtmifyAbandoned(request, env, ctx)
    }

    // POST /api/utmify-refunded - Webhook UTMify reembolso
    if (pathname === '/api/utmify-refunded' && request.method === 'POST') {
        return handleUtmifyRefunded(request, env, ctx)
    }

    // POST /api/utmify-refused - Webhook UTMify compra recusada
    if (pathname === '/api/utmify-refused' && request.method === 'POST') {
        return handleUtmifyRefused(request, env, ctx)
    }

    // POST /api/dashboard-stats - Estatísticas do dashboard
    if (pathname === '/api/dashboard-stats' && request.method === 'POST') {
        return handleDashboardStats(request, env, ctx)
    }

    // GET /api/user-notifications?userId=xxx — notificações não lidas do produtor (service role, bypassa RLS)
    if (pathname === '/api/user-notifications' && request.method === 'GET') {
        const reqUrl = new URL(request.url)
        const userId = reqUrl.searchParams.get('userId')
        if (!userId) return jsonResponse({ error: 'userId required' }, 400)
        const { createClient } = await import('./lib/supabase')
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
        const { data } = await supabase
            .from('producer_notifications')
            .select('id, title, message, type')
            .eq('user_id', userId)
            .eq('read', false)
            .order('created_at', { ascending: false })
            .limit(5)
        return jsonResponse({ notifications: data || [] })
    }

    // PUT /api/user-notifications/:id/read — marcar como lida (service role)
    if (pathname.startsWith('/api/user-notifications/') && pathname.endsWith('/read') && request.method === 'PUT') {
        const notifId = pathname.split('/api/user-notifications/')[1].replace('/read', '')
        const { createClient } = await import('./lib/supabase')
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
        await supabase.from('producer_notifications').update({ read: true }).eq('id', notifId)
        return jsonResponse({ success: true })
    }

    // POST /api/orders - Lista de pedidos
    if (pathname === '/api/orders' && request.method === 'POST') {
        return handleOrders(request, env, ctx)
    }

    // POST /api/finance - Transações financeiras
    if (pathname === '/api/finance' && request.method === 'POST') {
        return handleFinance(request, env, ctx)
    }

    // POST /api/finance/withdraw - Solicitar saque
    if (pathname === '/api/finance/withdraw' && request.method === 'POST') {
        return handleWithdraw(request, env)
    }

    // POST /api/finance/anticipate - Solicitar antecipação
    if (pathname === '/api/finance/anticipate' && request.method === 'POST') {
        return handleAnticipate(request, env)
    }

    // POST /api/finance/request-plan - Produtor solicita upgrade para D+2
    if (pathname === '/api/finance/request-plan' && request.method === 'POST') {
        return handleRequestPlan(request, env)
    }

    // GET /api/funnel-page-widget - Widget de funil
    if (pathname === '/api/funnel-page-widget' && request.method === 'GET') {
        return handleFunnelPageWidget(request, env, ctx)
    }

    // GET /api/funnel-pages/:pageId/public - Settings públicos de uma funnel page (thankyou)
    const funnelPagePublicMatch = pathname.match(/^\/api\/funnel-pages\/([^/]+)\/public$/)
    if (funnelPagePublicMatch && request.method === 'GET') {
        const pageId = funnelPagePublicMatch[1]
        const { createClient } = await import('./lib/supabase')
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
        const { data, error } = await supabase
            .from('funnel_pages')
            .select('page_type, settings')
            .eq('id', pageId)
            .eq('page_type', 'thankyou')
            .maybeSingle()
        if (error || !data) {
            return new Response(JSON.stringify({ error: 'Page not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        return new Response(JSON.stringify({ page_type: data.page_type, settings: data.settings || {} }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

    // POST /api/offer-analytics - Analytics de ofertas
    if (pathname === '/api/offer-analytics' && request.method === 'POST') {
        return handleOfferAnalytics(request, env, ctx)
    }

    // GET /api/offer-widget - Widget de ofertas
    if (pathname === '/api/offer-widget' && request.method === 'GET') {
        return handleOfferWidget(request, env, ctx)
    }

    // /api/apps/* - Apps públicos (slug, verify-access, free-signup)
    if (pathname.startsWith('/api/apps')) {
        const pathSegments = pathname.replace('/api/apps/', '').split('/').filter(Boolean)
        return handleApps(request, env, pathSegments)
    }

    // /api/auth/* - Auth de membros
    if (pathname.startsWith('/api/auth')) {
        const pathSegments = pathname.replace('/api/auth/', '').split('/').filter(Boolean)
        return handleAuth(request, env, pathSegments)
    }

    // /api/customer-auth/* - Sistema de autenticação para clientes
    if (pathname.startsWith('/api/customer-auth')) {
        return handleCustomerAuth(request, env)
    }

    // POST/DELETE /api/clients - Criar ou deletar clientes manualmente
    if (pathname === '/api/clients' && (request.method === 'POST' || request.method === 'DELETE')) {
        return handleClients(request, env)
    }

    // POST /api/confirm-reset - Confirmar reset de senha
    if (pathname === '/api/confirm-reset' && request.method === 'POST') {
        return handleConfirmReset(request, env)
    }

    // /api/marketplace-products/* - CRUD marketplace (autenticado)
    if (pathname.startsWith('/api/marketplace-products') && !pathname.includes('public')) {
        const pathSegments = pathname.replace('/api/marketplace-products/', '').split('/').filter(Boolean)
        return handleMarketplaceProducts(request, env, pathSegments)
    }

    // GET /api/marketplace-products-public - Listagem pública
    if (pathname === '/api/marketplace-products-public' && request.method === 'GET') {
        return handleMarketplaceProductsPublic(request, env)
    }

    // POST /api/members - Criar membro manualmente
    if (pathname === '/api/members' && request.method === 'POST') {
        return handleMembers(request, env)
    }

    // /api/products/* - Atualizar produtos
    if (pathname.startsWith('/api/products')) {
        const pathSegments = pathname.replace('/api/products/', '').split('/').filter(Boolean)
        return handleProducts(request, env, pathSegments)
    }

    // POST /api/request-password-reset - Solicitar reset de senha
    if (pathname === '/api/request-password-reset' && request.method === 'POST') {
        return handleRequestPasswordReset(request, env)
    }

    // POST /api/send-email - Enviar email
    if (pathname === '/api/send-email' && request.method === 'POST') {
        return handleSendEmail(request, env)
    }

    // POST /api/send-confirmation-email - Enviar email de confirmação
    if (pathname === '/api/send-confirmation-email' && request.method === 'POST') {
        return handleSendConfirmationEmail(request, env)
    }

    // /api/superadmin/* - Painel de super admin
    if (pathname.startsWith('/api/superadmin')) {
        const pathSegments = pathname.replace('/api/superadmin/', '').split('/').filter(Boolean)
        return handleSuperadmin(request, env, pathSegments)
    }

    // POST /api/webhooks/stripe - Stripe webhook (charge.refunded, etc)
    if (pathname === '/api/webhooks/stripe') {
        return handleStripeWebhook(request, env)
    }

    // /api/webhooks/* - Webhooks de plataformas (Hotmart, etc)
    if (pathname.startsWith('/api/webhooks')) {
        const pathSegments = pathname.replace('/api/webhooks/', '').split('/').filter(Boolean)
        return handleWebhooks(request, env, pathSegments)
    }

    // 404 para rotas não encontradas
    return jsonResponse({
        success: false,
        error: 'Not found',
        path: pathname,
    }, 404)
}

/**
 * Helper para resposta JSON
 */
function jsonResponse(data: any, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
        },
    })
}
