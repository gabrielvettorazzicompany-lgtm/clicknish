import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {

        const { email } = await req.json()

        if (!email) {
            return new Response(JSON.stringify({ error: 'Missing email' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://app.clicknich.com'

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Rate limit: max 5 requests per email per hour
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
        const { data: recentRequests, error: recentError } = await supabase
            .from('password_reset_tokens')
            .select('id', { count: 'exact' })
            .eq('email', email)
            .gte('created_at', oneHourAgo)

        if (recentError) console.warn('Error checking recent requests', recentError)
        if (recentRequests && (recentRequests as any).length >= 5) {
            return new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // Find user by email using admin.listUsers paginated to avoid schema/cache issues
        let userId: string | null = null
        try {
            const perPage = 100
            let page = 1
            let found = false

            while (!found) {

                const res = await supabase.auth.admin.listUsers({ page, perPage })

                // SDK returns users in res.data.users or res.data depending on shape
                const usersPage = (res as any).data?.users || (res as any).data || []

                if (!usersPage || usersPage.length === 0) break

                const match = usersPage.find((u: any) => u.email && u.email.toLowerCase() === email.toLowerCase())
                if (match) {
                    userId = match.id

                    found = true
                    break
                }

                if (usersPage.length < perPage) break
                page += 1
            }
        } catch (err) {
            console.warn('Failed to list users to find by email', err)
        }

        // Always succeed (don't reveal whether the user exists)
        if (!userId) {

            return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // Generate secure random token and hash it
        function toHex(buffer: ArrayBuffer) {
            return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('')
        }

        const randomBytes = crypto.getRandomValues(new Uint8Array(32))
        const token = toHex(randomBytes.buffer)
        const encoder = new TextEncoder()
        const tokenHashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(token))
        const tokenHash = toHex(tokenHashBuffer)

        // Expiration: 1 hour
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()

        const { data: insertData, error: insertError } = await supabase
            .from('password_reset_tokens')
            .insert({ user_id: userId, email, token_hash: tokenHash, expires_at: expiresAt })



        if (insertError) {
            console.error('Error inserting password reset token', insertError)
            // Still return success to avoid user enumeration
            return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // Send reset email using Resend (if configured)
        const resendApiKey = Deno.env.get('RESEND_API_KEY')
        if (!resendApiKey) {
            console.warn('RESEND_API_KEY not configured; skip sending reset email')
            return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const resetUrl = `${frontendUrl}/auth/reset-password?token=${token}&type=recovery`

        const subject = 'Reset your password'
        const html = `
            <p>Hi,</p>
            <p>We received a request to reset your password. Click the link below to create a new password. This link expires in 1 hour.</p>
            <p><a href="${resetUrl}">Reset your password</a></p>
            <p>If you did not request this, you can ignore this email.</p>
        `

        const fromAddress = Deno.env.get('RESEND_FROM') || 'noreply@clicknich.com'

        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ from: fromAddress, to: email, subject, html }),
        })

        if (!response.ok) {
            const bodyText = await response.text()
            console.error('Resend API error when sending reset email', bodyText)
            if (response.status === 403 && /Domain not verified/i.test(bodyText)) {
                console.error(`Resend 403: domain not verified for from address '${fromAddress}'. Verify the domain in Resend or set RESEND_FROM to a verified address (e.g. noreply@clicknich.com).`)
            }
        } else {

        }

        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    } catch (error) {
        console.error('request-password-reset error', error)
        return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
})
