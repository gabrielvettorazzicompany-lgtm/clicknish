/**
 * Internacionalização para emails de acesso pós-compra.
 * Suporta: português (pt/pt-br), inglês (en), espanhol (es), francês (fr), alemão (de).
 */

type EmailLang = 'pt' | 'en' | 'es' | 'fr' | 'de' | 'nl'

interface AccessEmailI18n {
    subject: (productName: string) => string
    title: string
    greeting: string
    body: string
    buttonText: string
    instructionsTitle: string
    instructionStep1: string
    instructionStep2: (email: string) => string
    instructionStep3: string
    refundText: string
    supportTitle: string
    supportBody: string
    supportLabel: string
    supportNote: string
    guaranteeTitle: string
    guaranteeBody: string
}

const accessEmailI18n: Record<EmailLang, AccessEmailI18n> = {
    pt: {
        subject: (p) => `Seu acesso a ${p} está pronto`,
        title: 'Acesso Liberado',
        greeting: 'Olá',
        body: 'Ótimo! Você agora tem acesso a:',
        buttonText: 'Acessar Agora',
        instructionsTitle: 'Instruções de acesso:',
        instructionStep1: 'Clique no botão acima',
        instructionStep2: (e) => `E-mail: <strong>${e}</strong>`,
        instructionStep3: 'Se for primeiro acesso, crie sua senha',
        refundText: 'Solicitar reembolso',
        supportTitle: 'Precisa de ajuda?',
        supportBody: 'Se tiver qualquer problema para acessar ou usar o produto, nossa equipe de suporte está disponível para ajudar.',
        supportLabel: 'Suporte:',
        supportNote: 'Antes de contatar o seu banco, por favor escreva para o nosso suporte para que possamos resolver qualquer problema rapidamente.',
        guaranteeTitle: 'Garantia de satisfação',
        guaranteeBody: 'Se o produto não cumprir com suas expectativas, você pode solicitar assistência ou um reembolso dentro do período de garantia. Nossa equipe estará encantada em ajudar.',
    },
    en: {
        subject: (p) => `Your access to ${p} is ready`,
        title: 'Access Granted',
        greeting: 'Hi',
        body: 'Great news! You now have access to:',
        buttonText: 'Access Now',
        instructionsTitle: 'Access instructions:',
        instructionStep1: 'Click the button above',
        instructionStep2: (e) => `Email: <strong>${e}</strong>`,
        instructionStep3: 'If first access, create your password',
        refundText: 'Request a refund',
        supportTitle: 'Need help?',
        supportBody: 'If you have any trouble accessing or using the product, our support team is available to help.',
        supportLabel: 'Support:',
        supportNote: 'Before contacting your bank, please write to our support team so we can resolve any issue quickly.',
        guaranteeTitle: 'Satisfaction guarantee',
        guaranteeBody: 'If the product does not meet your expectations, you can request assistance or a refund within the guarantee period. Our team will be happy to help.',
    },
    es: {
        subject: (p) => `Tu acceso a ${p} está listo`,
        title: 'Acceso Concedido',
        greeting: 'Hola',
        body: '¡Buenas noticias! Ahora tienes acceso a:',
        buttonText: 'Acceder Ahora',
        instructionsTitle: 'Instrucciones de acceso:',
        instructionStep1: 'Haz clic en el botón de arriba',
        instructionStep2: (e) => `Correo: <strong>${e}</strong>`,
        instructionStep3: 'Si es tu primer acceso, crea tu contraseña',
        refundText: 'Solicitar reembolso',
        supportTitle: '¿Necesitas ayuda?',
        supportBody: 'Si tienes algún problema para acceder o usar el producto, nuestro equipo de soporte está disponible para ayudarte.',
        supportLabel: 'Soporte:',
        supportNote: 'Antes de contactar a tu banco, por favor escríbenos para que podamos resolver cualquier problema rápidamente.',
        guaranteeTitle: 'Garantía de satisfacción',
        guaranteeBody: 'Si el producto no cumple tus expectativas, puedes solicitar asistencia o un reembolso dentro del período de garantía. Nuestro equipo estará encantado de ayudarte.',
    },
    fr: {
        subject: (p) => `Votre accès à ${p} est prêt`,
        title: 'Accès accordé',
        greeting: 'Bonjour',
        body: 'Bonne nouvelle ! Vous avez maintenant accès à :',
        buttonText: 'Accéder maintenant',
        instructionsTitle: "Instructions d'accès :",
        instructionStep1: 'Cliquez sur le bouton ci-dessus',
        instructionStep2: (e) => `E-mail : <strong>${e}</strong>`,
        instructionStep3: 'Si c\'est votre premier accès, créez votre mot de passe',
        refundText: 'Demander un remboursement',
        supportTitle: 'Besoin d\'aide ?',
        supportBody: 'Si vous avez des difficultés à accéder au produit ou à l\'utiliser, notre équipe d\'assistance est disponible.',
        supportLabel: 'Support :',
        supportNote: 'Avant de contacter votre banque, veuillez nous écrire afin que nous puissions résoudre tout problème rapidement.',
        guaranteeTitle: 'Garantie de satisfaction',
        guaranteeBody: 'Si le produit ne répond pas à vos attentes, vous pouvez demander une assistance ou un remboursement dans le délai de garantie.',
    },
    de: {
        subject: (p) => `Ihr Zugang zu ${p} ist bereit`,
        title: 'Zugang gewährt',
        greeting: 'Hallo',
        body: 'Gute Neuigkeiten! Sie haben jetzt Zugang zu:',
        buttonText: 'Jetzt zugreifen',
        instructionsTitle: 'Zugangsinstruktionen:',
        instructionStep1: 'Klicken Sie auf den Button oben',
        instructionStep2: (e) => `E-Mail: <strong>${e}</strong>`,
        instructionStep3: 'Wenn erster Zugang, erstellen Sie Ihr Passwort',
        refundText: 'Rückerstattung anfordern',
        supportTitle: 'Brauchen Sie Hilfe?',
        supportBody: 'Bei Problemen mit dem Zugang oder der Nutzung des Produkts steht Ihnen unser Support-Team zur Verfügung.',
        supportLabel: 'Support:',
        supportNote: 'Bitte schreiben Sie uns, bevor Sie Ihre Bank kontaktieren, damit wir das Problem schnell lösen können.',
        guaranteeTitle: 'Zufriedenheitsgarantie',
        guaranteeBody: 'Wenn das Produkt Ihre Erwartungen nicht erfüllt, können Sie innerhalb der Garantiezeit Unterstützung oder eine Rückerstattung beantragen.',
    },
    nl: {
        subject: (p) => `Uw toegang tot ${p} is klaar`,
        title: 'Toegang verleend',
        greeting: 'Hallo',
        body: 'Goed nieuws! U heeft nu toegang tot:',
        buttonText: 'Nu toegang',
        instructionsTitle: 'Toegangsinstructies:',
        instructionStep1: 'Klik op de knop hierboven',
        instructionStep2: (e) => `E-mail: <strong>${e}</strong>`,
        instructionStep3: 'Als dit uw eerste toegang is, maak dan uw wachtwoord aan',
        refundText: 'Terugbetaling aanvragen',
        supportTitle: 'Hulp nodig?',
        supportBody: 'Als u problemen heeft met het openen of gebruiken van het product, staat ons supportteam voor u klaar.',
        supportLabel: 'Support:',
        supportNote: 'Neem contact met ons op voordat u uw bank benadert, zodat we het probleem snel kunnen oplossen.',
        guaranteeTitle: 'Tevredenheidsgarantie',
        guaranteeBody: 'Als het product niet aan uw verwachtingen voldoet, kunt u binnen de garantietermijn om hulp of terugbetaling vragen.',
    },
}

/**
 * Converte o campo `language` da tabela `applications` para o código de idioma do email.
 * Exemplos: 'pt-br' → 'pt', 'en' → 'en', 'es' → 'es', etc.
 */
export function appLangToEmailLang(appLang: string | null | undefined): EmailLang {
    if (!appLang) return 'en'
    const normalized = appLang.toLowerCase()
    if (normalized.startsWith('pt')) return 'pt'
    if (normalized.startsWith('es')) return 'es'
    if (normalized.startsWith('fr')) return 'fr'
    if (normalized.startsWith('de')) return 'de'
    if (normalized.startsWith('nl')) return 'nl'
    return 'en'
}

/**
 * Retorna o objeto de strings i18n para o idioma dado.
 */
export function getAccessEmailI18n(lang: EmailLang): AccessEmailI18n {
    return accessEmailI18n[lang]
}

/**
 * Gera o HTML completo do email de acesso pós-compra.
 */
export function buildAccessEmailHtml(opts: {
    lang: EmailLang
    customerName: string
    customerEmail: string
    productName: string
    productsHtml: string
    loginUrl: string
    accentColor?: string
    supportEmail?: string
}): { subject: string; html: string; text: string } {
    const { lang, customerName, customerEmail, productName, productsHtml, loginUrl, accentColor = '#667eea', supportEmail } = opts
    const i18n = accessEmailI18n[lang]

    const subject = i18n.subject(productName)

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="background:linear-gradient(135deg,${accentColor} 0%,#764ba2 100%);padding:40px;text-align:center;border-radius:8px 8px 0 0;">
              <h1 style="color:white;margin:0;font-size:28px;font-weight:bold;">${i18n.title}</h1>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;padding:40px;border-radius:0 0 8px 8px;">
              <p style="color:#333;font-size:16px;margin:0 0 16px;">${i18n.greeting} <strong>${customerName || customerEmail}</strong>,</p>
              <p style="color:#666;font-size:14px;line-height:1.6;margin:0 0 16px;">${i18n.body}</p>
              <div style="background:white;padding:20px;border-radius:8px;margin:20px 0;border-left:4px solid ${accentColor};">
                <p style="color:#333;font-size:14px;margin:0 0 10px;"><strong>${productName}</strong></p>
                ${productsHtml}
              </div>
              ${loginUrl ? `<div style="margin:30px 0;text-align:center;"><a href="${loginUrl}" style="background:${accentColor};color:white;padding:14px 32px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold;font-size:16px;">${i18n.buttonText}</a></div>` : ''}
              <div style="background:#f3f4f6;padding:15px;border-radius:6px;margin-top:20px;">
                <p style="color:#666;font-size:13px;margin:0;">
                  <strong>${i18n.instructionsTitle}</strong><br>
                  1. ${i18n.instructionStep1}<br>
                  2. ${i18n.instructionStep2(customerEmail)}<br>
                  3. ${i18n.instructionStep3}
                </p>
              </div>
              ${supportEmail ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
                <tr>
                  <td style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:20px;">
                    <p style="color:#111827;font-size:14px;font-weight:bold;margin:0 0 8px;">${i18n.supportTitle}</p>
                    <p style="color:#6b7280;font-size:13px;margin:0 0 12px;line-height:1.6;">${i18n.supportBody}</p>
                    <p style="color:#374151;font-size:13px;margin:0 0 12px;">${i18n.supportLabel} <a href="mailto:${supportEmail}" style="color:${accentColor};text-decoration:none;font-weight:500;">${supportEmail}</a></p>
                    <p style="color:#6b7280;font-size:12px;margin:0;line-height:1.6;">${i18n.supportNote}</p>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
                <tr>
                  <td style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:20px;">
                    <p style="color:#111827;font-size:14px;font-weight:bold;margin:0 0 8px;">${i18n.guaranteeTitle}</p>
                    <p style="color:#6b7280;font-size:13px;margin:0;line-height:1.6;">${i18n.guaranteeBody}</p>
                  </td>
                </tr>
              </table>` : ''}
              <div style="margin-top:32px;padding-top:20px;border-top:1px solid #e5e7eb;text-align:center;">
                <p style="color:#9ca3af;font-size:11px;margin:0;">© ${new Date().getFullYear()} ClickNich. All rights reserved.</p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

    const text = `${i18n.greeting} ${customerName || customerEmail},\n\n${i18n.body}\n\n${productName}\n\n${i18n.instructionsTitle}\n1. ${i18n.instructionStep1}\n2. ${customerEmail}\n3. ${i18n.instructionStep3}\n\n${loginUrl ? `${i18n.buttonText}: ${loginUrl}\n\n` : ''}${supportEmail ? `${i18n.supportTitle}\n${i18n.supportBody}\n${i18n.supportLabel} ${supportEmail}\n\n${i18n.guaranteeTitle}\n${i18n.guaranteeBody}\n\n` : ''}© ${new Date().getFullYear()} ClickNich.`

    return { subject, html, text }
}
