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

export async function handleRequestPasswordReset(request: Request, env: any): Promise<Response> {
    if (request.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { email } = await request.json()

        if (!email) {
            return new Response(JSON.stringify({ error: 'Missing email' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const supabase = createClient(env)
        const frontendUrl = env.FRONTEND_URL || 'https://app.clicknich.com'

        // Rate limit: max 5 requests per email per hour
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
        const { data: recentRequests } = await supabase
            .from('password_reset_tokens')
            .select('id', { count: 'exact' })
            .eq('email', email)
            .gte('created_at', oneHourAgo)

        if (recentRequests && (recentRequests as any).length >= 5) {
            return new Response(JSON.stringify({ error: 'Too many requests' }), {
                status: 429,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Find user by email
        let userId: string | null = null
        try {
            const perPage = 100
            let page = 1
            let found = false

            while (!found) {
                const res = await supabase.auth.admin.listUsers({ page, perPage })
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
            return new Response(JSON.stringify({ success: true }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Generate secure random token and hash it
        const randomBytes = crypto.getRandomValues(new Uint8Array(32))
        const token = toHex(randomBytes.buffer)
        const encoder = new TextEncoder()
        const tokenHashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(token))
        const tokenHash = toHex(tokenHashBuffer)

        // Expiration: 1 hour
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()

        const { error: insertError } = await supabase
            .from('password_reset_tokens')
            .insert({ user_id: userId, email, token_hash: tokenHash, expires_at: expiresAt })

        if (insertError) {
            console.error('Error inserting password reset token', insertError)
            return new Response(JSON.stringify({ success: true }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Send reset email using Resend (if configured)
        const resendApiKey = env.RESEND_API_KEY
        if (!resendApiKey) {
            console.warn('RESEND_API_KEY not configured; skip sending reset email')
            return new Response(JSON.stringify({ success: true }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const resetUrl = `${frontendUrl}/auth/reset-password?token=${token}&type=recovery`

        const subject = 'Reset your password'
        const html = `
            <p>Hi,</p>
            <p>We received a request to reset your password. Click the link below to create a new password. This link expires in 1 hour.</p>
            <p><a href="${resetUrl}">Reset your password</a></p>
            <p>If you did not request this, you can ignore this email.</p>
        `

        const fromAddress = env.RESEND_FROM || 'noreply@clicknich.com'

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
        }

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    } catch (error: any) {
        console.error('request-password-reset error', error)
        return new Response(JSON.stringify({ error: 'Internal error' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
}
