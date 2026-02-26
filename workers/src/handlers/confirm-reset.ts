// @ts-nocheck
import { createClient } from '../lib/supabase'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function toHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function handleConfirmReset(request: Request, env: any): Promise<Response> {
    if (request.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { token, password } = await request.json()

        if (!token || !password) {
            return new Response(JSON.stringify({ error: 'Missing token or password' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        if (typeof password !== 'string' || password.length < 6) {
            return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

        // Hash token
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

        if (tokenError || !tokenRow) {
            return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        if (tokenRow.used) {
            return new Response(JSON.stringify({ error: 'Token already used' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const now = new Date()
        if (new Date(tokenRow.expires_at) < now) {
            return new Response(JSON.stringify({ error: 'Token expired' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Update user password using Supabase Admin SDK
        const { error: updateError } = await supabase.auth.admin.updateUserById(
            tokenRow.user_id,
            { password: password }
        )

        if (updateError) {
            return new Response(JSON.stringify({ error: 'Failed to update password', details: updateError.message }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Mark token as used
        await supabase
            .from('password_reset_tokens')
            .update({ used: true })
            .eq('id', tokenRow.id)

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    } catch (error: any) {
        console.error('confirm-reset error', error)
        return new Response(JSON.stringify({ error: 'Internal error' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
}
