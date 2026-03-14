import type { Env } from '../index'

type Lang = 'pt' | 'en' | 'es' | 'fr' | 'de' | 'nl'

const confirmationI18n: Record<Lang, {
  subject: string
  welcome: string
  greeting: string
  body: string
  button: string
  orCopy: string
  ignore: string
  rights: string
}> = {
  pt: {
    subject: 'Confirme sua conta ClickNich',
    welcome: 'Bem-vindo ao ClickNich!',
    greeting: 'Olá',
    body: 'Obrigado por se cadastrar! Por favor, confirme seu endereço de email para começar a usar o ClickNich.',
    button: 'Confirmar Email',
    orCopy: 'Ou copie e cole este link no seu navegador:',
    ignore: 'Se você não criou uma conta no ClickNich, pode ignorar este email com segurança.',
    rights: 'Todos os direitos reservados.',
  },
  en: {
    subject: 'Confirm your ClickNich account',
    welcome: 'Welcome to ClickNich!',
    greeting: 'Hi',
    body: 'Thanks for signing up! Please confirm your email address to get started with ClickNich.',
    button: 'Confirm Email Address',
    orCopy: 'Or copy and paste this link into your browser:',
    ignore: "If you didn't create an account with ClickNich, you can safely ignore this email.",
    rights: 'All rights reserved.',
  },
  es: {
    subject: 'Confirma tu cuenta ClickNich',
    welcome: '¡Bienvenido a ClickNich!',
    greeting: 'Hola',
    body: '¡Gracias por registrarte! Por favor, confirma tu dirección de correo electrónico para empezar a usar ClickNich.',
    button: 'Confirmar Correo Electrónico',
    orCopy: 'O copia y pega este enlace en tu navegador:',
    ignore: 'Si no creaste una cuenta en ClickNich, puedes ignorar este correo de forma segura.',
    rights: 'Todos los derechos reservados.',
  },
  fr: {
    subject: 'Confirmez votre compte ClickNich',
    welcome: 'Bienvenue sur ClickNich !',
    greeting: 'Bonjour',
    body: "Merci de vous être inscrit ! Veuillez confirmer votre adresse e-mail pour commencer à utiliser ClickNich.",
    button: "Confirmer l'adresse e-mail",
    orCopy: 'Ou copiez et collez ce lien dans votre navigateur :',
    ignore: "Si vous n'avez pas créé de compte sur ClickNich, vous pouvez ignorer cet e-mail en toute sécurité.",
    rights: 'Tous droits réservés.',
  },
  de: {
    subject: 'Bestätigen Sie Ihr ClickNich-Konto',
    welcome: 'Willkommen bei ClickNich!',
    greeting: 'Hallo',
    body: 'Vielen Dank für Ihre Registrierung! Bitte bestätigen Sie Ihre E-Mail-Adresse, um mit ClickNich loszulegen.',
    button: 'E-Mail-Adresse bestätigen',
    orCopy: 'Oder kopieren Sie diesen Link in Ihren Browser:',
    ignore: 'Wenn Sie kein ClickNich-Konto erstellt haben, können Sie diese E-Mail ignorieren.',
    rights: 'Alle Rechte vorbehalten.',
  },
  nl: {
    subject: 'Bevestig uw ClickNich-account',
    welcome: 'Welkom bij ClickNich!',
    greeting: 'Hallo',
    body: 'Bedankt voor uw registratie! Bevestig uw e-mailadres om aan de slag te gaan met ClickNich.',
    button: 'E-mailadres bevestigen',
    orCopy: 'Of kopieer en plak deze link in uw browser:',
    ignore: 'Als u geen ClickNich-account heeft aangemaakt, kunt u deze e-mail veilig negeren.',
    rights: 'Alle rechten voorbehouden.',
  },
}

interface SendConfirmationEmailRequest {
  email: string
  fullName: string
  token: string
  language?: string
}

export async function handleSendConfirmationEmail(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const body = await request.json() as SendConfirmationEmailRequest
    const { email, fullName, token, language } = body

    if (!email || !fullName || !token) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const lang: Lang = (['pt', 'en', 'es', 'fr', 'de', 'nl'].includes(language ?? '') ? language as Lang : 'en')
    const i18n = confirmationI18n[lang]

    // Enviar email usando Resend
    const confirmationUrl = `${env.FRONTEND_URL}/auth/confirm?token=${token}`

    const fromAddress = env.RESEND_FROM || 'ClickNich <noreply@clicknich.com>'

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: email,
        subject: i18n.subject,
        text: `${i18n.greeting} ${fullName},\n\n${i18n.body}\n\n${i18n.button}: ${confirmationUrl}\n\n${i18n.ignore}\n\n© ${new Date().getFullYear()} ClickNich.`,
        html: `<!DOCTYPE html>
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
                <h1 style="margin:0;color:#111827;font-size:24px;font-weight:600;">${i18n.welcome}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 40px;">
                <p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:24px;">${i18n.greeting} ${fullName},</p>
                <p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:24px;">${i18n.body}</p>
                <table width="100%" cellpadding="0" cellspacing="0" style="margin:30px 0;">
                  <tr>
                    <td align="center">
                      <a href="${confirmationUrl}" style="display:inline-block;padding:14px 32px;background:#111827;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:16px;">${i18n.button}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:20px 0 0;color:#6b7280;font-size:14px;line-height:20px;">${i18n.orCopy}</p>
                <p style="margin:8px 0 0;color:#2563eb;font-size:14px;line-height:20px;word-break:break-all;">${confirmationUrl}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 40px;border-top:1px solid #e5e7eb;">
                <p style="margin:0;color:#6b7280;font-size:12px;line-height:18px;text-align:center;">${i18n.ignore}</p>
                <p style="margin:12px 0 0;color:#9ca3af;font-size:12px;line-height:18px;text-align:center;">© ${new Date().getFullYear()} ClickNich. ${i18n.rights}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
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
