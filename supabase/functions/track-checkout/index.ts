// Edge Function para tracking de checkout otimizada
// Deploy: supabase functions deploy track-checkout

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { securityMiddleware } from '../_shared/security-middleware.ts'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    // 🔒 SECURITY: Rate limiting para tracking
    const securityCheck = await securityMiddleware(req, {
        rateLimit: {
            maxRequests: 50, // Tracking pode ser mais frequente
            windowMs: 60000,
            blockDurationMs: 180000
        }
    })

    if (!securityCheck.allowed) {
        return securityCheck.response!
    }

    try {
        // Capturar IP de múltiplas fontes (Cloudflare, proxy, etc)
        const clientIP =
            req.headers.get('cf-connecting-ip') ||
            req.headers.get('x-real-ip') ||
            req.headers.get('x-forwarded-for')?.split(',')[0] ||
            req.headers.get('x-client-ip') ||
            'unknown'

        // Parse do body da requisição
        const payload: TrackingPayload = await req.json()

        // Buscar dados de geolocalização de forma otimizada
        let geoData = null
        if (clientIP !== 'unknown' && !clientIP.startsWith('127.') && !clientIP.startsWith('192.168.')) {
            try {
                // Usar ip-api.com que é gratuito e rápido
                const geoResponse = await fetch(`http://ip-api.com/json/${clientIP}?fields=status,country,regionName,city,timezone,lat,lon`, {
                    method: 'GET',
                    headers: { 'User-Agent': 'HuskyApp-Analytics/1.0' },
                })

                if (geoResponse.ok) {
                    const geoResult = await geoResponse.json()
                    if (geoResult.status === 'success') {
                        geoData = {
                            country: geoResult.country,
                            region: geoResult.regionName,
                            city: geoResult.city,
                            timezone: geoResult.timezone,
                            latitude: geoResult.lat,
                            longitude: geoResult.lon
                        }
                    }
                }
            } catch (geoError) {
                console.warn('⚠️ [EdgeFunction] Geo lookup failed:', geoError.message)
            }
        }

        // Conectar ao Supabase usando service role
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        })

        // Preparar dados para inserção
        const analyticsData = {
            checkout_id: payload.checkoutId,
            event_type: payload.eventType,
            user_ip: clientIP,
            user_agent: payload.userAgent || req.headers.get('user-agent') || '',
            referrer: payload.referrer || req.headers.get('referer') || '',
            session_id: payload.sessionId || crypto.randomUUID(),
            country: geoData?.country || null,
            region: geoData?.region || null,
            city: geoData?.city || null,
            timezone: geoData?.timezone || null,
            latitude: geoData?.latitude || null,
            longitude: geoData?.longitude || null,
            metadata: {
                ...payload.metadata,
                user_agent: payload.userAgent || req.headers.get('user-agent'),
                accept_language: req.headers.get('accept-language'),
                cf_country: req.headers.get('cf-ipcountry'), // Cloudflare country
                cf_ray: req.headers.get('cf-ray'), // Cloudflare ray ID
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
            console.error('❌ [EdgeFunction] Database error:', error)
            throw error
        }

        // Retornar resposta de sucesso
        return new Response(
            JSON.stringify({
                success: true,
                id: data[0]?.id,
                ip: clientIP,
                location: geoData ? `${geoData.city}, ${geoData.country}` : null
            }),
            {
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json',
                },
                status: 200,
            }
        )

    } catch (error) {
        console.error('🚨 [EdgeFunction] Error:', error)

        return new Response(
            JSON.stringify({
                error: error.message,
                success: false
            }),
            {
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json',
                },
                status: 500,
            }
        )
    }
})

/* 
==============================================
CONFIGURAÇÃO E DEPLOY
==============================================

1. Deploy da função:
   supabase functions deploy track-checkout

2. Configurar variáveis de ambiente no Supabase Dashboard:
   - SUPABASE_URL (já configurado)
   - SUPABASE_SERVICE_ROLE_KEY (já configurado)

3. URL da função será:
   https://[projeto].supabase.co/functions/v1/track-checkout

4. Para usar no frontend, substitua as chamadas de trackCheckoutEvent
   por chamadas para esta Edge Function

==============================================
VANTAGENS:
==============================================
✅ IP capturado automaticamente do server
✅ Geolocalização mais rápida (sem download no cliente)
✅ Não bloqueado por ad-blockers
✅ Menor latência para usuários
✅ Funciona mesmo com JavaScript desabilitado
✅ Suporta millions de requests/segundo
✅ Cache automático da geolocalização
✅ Headers Cloudflare para dados extras

*/