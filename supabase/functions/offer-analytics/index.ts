import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { offer_id, event, purchase_id } = await req.json()

        if (!offer_id || !event) {
            return new Response(
                JSON.stringify({ error: 'Missing offer_id or event' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL') as string
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
        const supabase = createClient(supabaseUrl, supabaseKey)

        // Registrar evento nas analytics
        if (event === 'view') {
            // Incrementar views
            const { error } = await supabase.rpc('increment_offer_views', {
                p_offer_id: offer_id
            })

            if (error) {
                console.error('Error incrementing views:', error)
            }
        } else if (event === 'accept') {
            // Incrementar accepts
            const { error } = await supabase.rpc('increment_offer_accepts', {
                p_offer_id: offer_id
            })

            if (error) {
                console.error('Error incrementing accepts:', error)
            }
        } else if (event === 'decline') {
            // Incrementar declines (opcional)
            const { error } = await supabase.rpc('increment_offer_declines', {
                p_offer_id: offer_id
            })

            if (error) {
                console.error('Error incrementing declines:', error)
            }
        }

        return new Response(
            JSON.stringify({ success: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Error:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
