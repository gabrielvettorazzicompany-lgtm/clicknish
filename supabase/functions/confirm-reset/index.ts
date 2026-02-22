import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

serve(async (req) => {


    if (req.method === 'OPTIONS') {

        return new Response('ok', { headers: corsHeaders })
    }

    try {

        const { token, password } = await req.json()

        if (!token || !password) {
            return new Response(JSON.stringify({ error: 'Missing token or password' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        if (typeof password !== 'string' || password.length < 6) {
            return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!



        if (!supabaseServiceKey) {
            console.error('❌ SUPABASE_SERVICE_ROLE_KEY is missing in environment')
            return new Response(JSON.stringify({ error: 'Service role key missing on server' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)


        // Hash token
        function toHex(buffer: ArrayBuffer) {
            return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('')
        }
        const encoder = new TextEncoder()
        const tokenHashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(token))
        const tokenHash = toHex(tokenHashBuffer)

        // Find token row

        const { data: tokenRow, error: tokenError } = await supabase
            .from('password_reset_tokens')
            .select('id, user_id, expires_at, used')
            .eq('token_hash', tokenHash)
            .limit(1)
            .single()



        if (tokenError) {
            console.error('❌ Error searching token:', tokenError)
        }

        if (tokenError || !tokenRow) {
            console.warn('confirm-reset: token not found or error', tokenError)
            return new Response(JSON.stringify({ error: 'Invalid or expired token' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }



        if (tokenRow.used) {
            console.warn('confirm-reset: token already used', tokenRow.id)
            return new Response(JSON.stringify({ error: 'Token already used' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const now = new Date()
        if (new Date(tokenRow.expires_at) < now) {
            console.warn('confirm-reset: token expired', { expires_at: tokenRow.expires_at, now: now.toISOString() })
            return new Response(JSON.stringify({ error: 'Token expired' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // Update user password using Supabase Admin SDK


        const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
            tokenRow.user_id,
            { password: password }
        )

        if (updateError) {
            console.error('❌ Error updating password:', updateError)
            return new Response(JSON.stringify({ error: 'Failed to update password', details: updateError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }




        // Mark token as used
        const { error: markUsedError } = await supabase
            .from('password_reset_tokens')
            .update({ used: true })
            .eq('id', tokenRow.id)

        if (markUsedError) console.warn('Failed to mark token used', markUsedError)

        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    } catch (error) {
        console.error('confirm-reset error', error)
        return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
})
