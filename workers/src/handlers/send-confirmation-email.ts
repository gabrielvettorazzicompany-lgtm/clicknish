import type { Env } from '../index'

interface SendConfirmationEmailRequest {
  email: string
  fullName: string
  token: string
}

export async function handleSendConfirmationEmail(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const body = await request.json() as SendConfirmationEmailRequest
    const { email, fullName, token } = body

    if (!email || !fullName || !token) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Enviar email usando Resend
    const confirmationUrl = `${env.FRONTEND_URL}/auth/confirm?token=${token}`

    const fromAddress = env.RESEND_FROM || 'noreply@clicknich.com'

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: email,
        subject: 'Confirm your ClickNich account',
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Confirm your account</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
                <tr>
                  <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                      <!-- Header -->
                      <tr>
                        <td style="padding: 40px 40px 20px; text-align: center;">
                          <h1 style="margin: 0; color: #111827; font-size: 24px; font-weight: 600;">
                            Welcome to ClickNich!
                          </h1>
                        </td>
                      </tr>
                      
                      <!-- Content -->
                      <tr>
                        <td style="padding: 0 40px 40px;">
                          <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 24px;">
                            Hi ${fullName},
                          </p>
                          
                          <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 24px;">
                            Thanks for signing up! Please confirm your email address to get started with ClickNich.
                          </p>
                          
                          <!-- Button -->
                          <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                            <tr>
                              <td align="center">
                                <a href="${confirmationUrl}" style="display: inline-block; padding: 14px 32px; background: #111827; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                                  Confirm Email Address
                                </a>
                              </td>
                            </tr>
                          </table>
                          
                          <p style="margin: 20px 0 0; color: #6b7280; font-size: 14px; line-height: 20px;">
                            Or copy and paste this link into your browser:
                          </p>
                          <p style="margin: 8px 0 0; color: #2563eb; font-size: 14px; line-height: 20px; word-break: break-all;">
                            ${confirmationUrl}
                          </p>
                        </td>
                      </tr>
                      
                      <!-- Footer -->
                      <tr>
                        <td style="padding: 20px 40px; border-top: 1px solid #e5e7eb;">
                          <p style="margin: 0; color: #6b7280; font-size: 12px; line-height: 18px; text-align: center;">
                            If you didn't create an account with ClickNich, you can safely ignore this email.
                          </p>
                          <p style="margin: 12px 0 0; color: #9ca3af; font-size: 12px; line-height: 18px; text-align: center;">
                            © ${new Date().getFullYear()} ClickNich. All rights reserved.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
          </html>
        `,
      }),
    })

    if (!resendResponse.ok) {
      const error = await resendResponse.text()
      console.error('Resend error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to send email' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const result = await resendResponse.json()

    return new Response(
      JSON.stringify({ success: true, messageId: result.id }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Error sending confirmation email:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
