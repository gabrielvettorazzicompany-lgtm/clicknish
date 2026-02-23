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

export interface Env {
    // Variáveis públicas
    SUPABASE_URL: string
    FRONTEND_URL: string

    // Secrets (configurar via wrangler secret put)
    SUPABASE_SERVICE_ROLE_KEY: string
    STRIPE_SECRET_KEY: string

    // KV Storage (opcional)
    CACHE?: KVNamespace
}

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

export default {
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

    // POST /api/process-payment
    if (pathname === '/api/process-payment' && request.method === 'POST') {
        return handleProcessPayment(request, env, ctx)
    }

    // POST /api/process-upsell
    if (pathname === '/api/process-upsell' && request.method === 'POST') {
        return handleProcessUpsell(request, env, ctx)
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
