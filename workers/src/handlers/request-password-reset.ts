// @ts-nocheck
import { createClient } from '../lib/supabase'

type Lang = 'pt' | 'en' | 'es' | 'fr' | 'de'

const resetI18n: Record<Lang, {
    subject: string
    greeting: string
    body: string
    button: string
    ignore: string
    expire: string
}> = {
    pt: {
        subject: 'Redefinição de senha',
        greeting: 'Olá,',
        body: 'Recebemos uma solicitação para redefinir sua senha. Clique no link abaixo para criar uma nova senha. Este link expira em 1 hora.',
        button: 'Redefinir Senha',
        ignore: 'Se você não solicitou isso, pode ignorar este email com segurança.',
        expire: 'Este link é válido por 1 hora.',
    },
    en: {
        subject: 'Reset your password',
        greeting: 'Hi,',
        body: 'We received a request to reset your password. Click the link below to create a new password. This link expires in 1 hour.',
        button: 'Reset Password',
        ignore: 'If you did not request this, you can ignore this email.',
        expire: 'This link is valid for 1 hour.',
    },
    es: {
        subject: 'Restablece tu contraseña',
        greeting: 'Hola,',
        body: 'Recibimos una solicitud para restablecer tu contraseña. Haz clic en el enlace de abajo para crear una nueva contraseña. Este enlace expira en 1 hora.',
        button: 'Restablecer Contraseña',
        ignore: 'Si no solicitaste esto, puedes ignorar este correo electrónico de forma segura.',
        expire: 'Este enlace es válido por 1 hora.',
    },
    fr: {
        subject: 'Réinitialiser votre mot de passe',
        greeting: 'Bonjour,',
        body: "Nous avons reçu une demande de réinitialisation de votre mot de passe. Cliquez sur le lien ci-dessous pour créer un nouveau mot de passe. Ce lien expire dans 1 heure.",
        button: 'Réinitialiser le mot de passe',
        ignore: "Si vous n'avez pas demandé cela, vous pouvez ignorer cet e-mail en toute sécurité.",
        expire: 'Ce lien est valable pendant 1 heure.',
    },
    de: {
        subject: 'Passwort zurücksetzen',
        greeting: 'Hallo,',
        body: 'Wir haben eine Anfrage erhalten, Ihr Passwort zurückzusetzen. Klicken Sie auf den Link unten, um ein neues Passwort zu erstellen. Dieser Link läuft in 1 Stunde ab.',
        button: 'Passwort zurücksetzen',
        ignore: 'Wenn Sie dies nicht angefordert haben, können Sie diese E-Mail ignorieren.',
        expire: 'Dieser Link ist 1 Stunde lang gültig.',
    },
}

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
        const { email, language } = await request.json()
        const lang: Lang = (['pt', 'en', 'es', 'fr', 'de'].includes(language) ? language : 'en')

        if (!email) {
            return new Response(JSON.stringify({ error: 'Missing email' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
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

        // Find user by email (busca otimizada)
        let userId: string | null = null
        try {
            const { data: userData } = await supabase.auth.admin.getUserByEmail(email.toLowerCase())
            if (userData?.user) {
                userId = userData.user.id
            }
        } catch (err) {
            console.warn('Failed to find user by email', err)
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

        const i18n = resetI18n[lang]
        const subject = i18n.subject
        const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${i18n.subject}</title>
  </head>
  <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f3f4f6;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:40px 20px;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
            <tr>
              <td style="padding:40px 40px 20px;text-align:center;">
                <h1 style="margin:0;color:#111827;font-size:24px;font-weight:600;">ClickNich</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 40px;">
                <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:24px;">${i18n.greeting}</p>
                <p style="margin:0 0 24px;color:#374151;font-size:16px;line-height:24px;">${i18n.body}</p>
                <table width="100%" cellpadding="0" cellspacing="0" style="margin:30px 0;">
                  <tr>
                    <td align="center">
                      <a href="${resetUrl}" style="display:inline-block;padding:14px 32px;background:#111827;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:16px;">${i18n.button}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0;color:#6b7280;font-size:13px;line-height:20px;">${i18n.expire}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 40px;border-top:1px solid #e5e7eb;">
                <p style="margin:0;color:#6b7280;font-size:12px;line-height:18px;text-align:center;">${i18n.ignore}</p>
                <p style="margin:12px 0 0;color:#9ca3af;font-size:12px;line-height:18px;text-align:center;">© ${new Date().getFullYear()} ClickNich.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

        const fromAddress = env.RESEND_FROM || 'ClickNich <noreply@clicknich.com>'

        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ from: fromAddress, to: email, subject, html, text: `${i18n.greeting}\n\n${i18n.body}\n\n${i18n.button}: ${resetUrl}\n\n${i18n.expire}\n\n${i18n.ignore}` }),
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
