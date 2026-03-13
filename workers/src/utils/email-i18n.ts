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
}): { subject: string; html: string } {
    const { lang, customerName, customerEmail, productName, productsHtml, loginUrl, accentColor = '#667eea' } = opts
    const i18n = accessEmailI18n[lang]

    const subject = i18n.subject(productName)

    const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><div style="background:linear-gradient(135deg,${accentColor} 0%,#764ba2 100%);padding:40px;text-align:center;border-radius:8px 8px 0 0"><h1 style="color:white;margin:0;font-size:28px">${i18n.title}</h1></div><div style="background:#f9fafb;padding:40px;border-radius:0 0 8px 8px"><p style="color:#333;font-size:16px">${i18n.greeting} <strong>${customerName || customerEmail}</strong>,</p><p style="color:#666;font-size:14px;line-height:1.6">${i18n.body}</p><div style="background:white;padding:20px;border-radius:8px;margin:20px 0;border-left:4px solid ${accentColor}"><p style="color:#333;font-size:14px;margin-bottom:10px"><strong>${productName}</strong></p>${productsHtml}</div>${loginUrl ? `<div style="margin:30px 0;text-align:center"><a href="${loginUrl}" style="background:${accentColor};color:white;padding:14px 32px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold;font-size:16px">${i18n.buttonText}</a></div>` : ''}<div style="background:#f3f4f6;padding:15px;border-radius:6px;margin-top:20px"><p style="color:#666;font-size:13px;margin:0"><strong>${i18n.instructionsTitle}</strong><br>1. ${i18n.instructionStep1}<br>2. ${i18n.instructionStep2(customerEmail)}<br>3. ${i18n.instructionStep3}</p></div><div style="margin-top:32px;padding-top:20px;border-top:1px solid #e5e7eb;text-align:center"><a href="${loginUrl}" style="color:#9ca3af;font-size:11px;text-decoration:underline">${i18n.refundText}</a></div></div></div>`

    return { subject, html }
}
