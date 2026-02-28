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
import { handleFinance } from './handlers/finance'
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

export interface Env {
    // Variáveis públicas
    SUPABASE_URL: string
    FRONTEND_URL: string

    // Secrets (configurar via wrangler secret put)
    SUPABASE_SERVICE_ROLE_KEY: string
    STRIPE_SECRET_KEY: string
    PAYPAL_CLIENT_ID: string
    PAYPAL_CLIENT_SECRET: string
    PAYPAL_ENVIRONMENT: 'sandbox' | 'live'

    // KV Storage — cache de sessões de checkout e dados gerais
    CACHE?: KVNamespace

    // Stripe Webhook secret (wrangler secret put STRIPE_WEBHOOK_SECRET)
    STRIPE_WEBHOOK_SECRET?: string

    // Email (Resend)
    RESEND_API_KEY?: string
    RESEND_FROM?: string
}

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

export default {
    // ⚡ CRON TRIGGER: Pré-aquecimento automático de cache a cada 2 minutos
    async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
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

    // GET /api/checkout-data/:shortId — RPC com cache edge ultra-rápido (5min TTL)
    if (pathname.startsWith('/api/checkout-data/') && request.method === 'GET') {
        const shortId = pathname.split('/api/checkout-data/')[1]
        return handleCheckoutData(request, env, shortId)
    }

    // GET /api/cache-preloader — Sistema de pré-aquecimento inteligente (cron trigger)
    if (pathname === '/api/cache-preloader' && request.method === 'GET') {
        return handleCachePreloader(request, env)
    }

    // POST /api/process-payment
    if (pathname === '/api/process-payment' && request.method === 'POST') {
        return handleProcessPayment(request, env, ctx)
    }

    // POST /api/process-upsell
    if (pathname === '/api/process-upsell' && request.method === 'POST') {
        return handleProcessUpsell(request, env, ctx)
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

    // POST /api/orders - Lista de pedidos
    if (pathname === '/api/orders' && request.method === 'POST') {
        return handleOrders(request, env, ctx)
    }

    // POST /api/finance - Transações financeiras
    if (pathname === '/api/finance' && request.method === 'POST') {
        return handleFinance(request, env, ctx)
    }

    // GET /api/funnel-page-widget - Widget de funil
    if (pathname === '/api/funnel-page-widget' && request.method === 'GET') {
        return handleFunnelPageWidget(request, env, ctx)
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
