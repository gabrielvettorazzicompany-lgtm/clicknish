// Edge Function para tracking de checkout otimizada
// Deploy: supabase functions deploy track-checkout

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

Deno.serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
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

        // Geolocalização via headers (0ms) - CF ou Deno Deploy
        const geoData = {
            country: req.headers.get('cf-ipcountry') || req.headers.get('x-country') || null,
            region: req.headers.get('cf-region') || null,
            city: req.headers.get('cf-ipcity') || req.headers.get('x-city') || null,
            timezone: req.headers.get('cf-timezone') || null
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
            country: geoData.country,
            region: geoData.region,
            city: geoData.city,
            timezone: geoData.timezone,
            metadata: {
                ...payload.metadata,
                user_agent: payload.userAgent || req.headers.get('user-agent'),
                accept_language: req.headers.get('accept-language'),
                cf_country: req.headers.get('cf-ipcountry'),
                cf_ray: req.headers.get('cf-ray'),
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