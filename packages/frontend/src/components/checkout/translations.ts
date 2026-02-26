export type CheckoutLanguage = 'en' | 'es' | 'pt'

interface CheckoutTranslations {
    // Header
    back: string
    // Product
    youArePurchasing: string
    // Personal info
    personalInformation: string
    email: string
    emailPlaceholder: string
    emailHelper: string
    fullName: string
    fullNamePlaceholder: string
    phone: string
    phonePlaceholder: string
    // Payment
    paymentMethod: string
    paymentMethodHelper: string
    creditCard: string
    cardNumber: string
    expiryDate: string
    cvv: string
    installments: string
    installmentLabel: (count: number, amount: string) => string
    fullPayment: string
    interestFree: string
    withInterest: string
    interestWarning: string
    noInterest: string
    // Order bumps
    limitedOffers: string
    addToOrder: string
    added: string
    defaultOrderBumpAccept: string
    defaultOrderBumpButton: string
    // Order summary
    orderSummary: string
    subtotal: string
    total: string
    installmentsSummary: (count: number, amount: string) => string
    processing: string
    paymentSuccessful: string
    completePurchase: string
    accessGranted: string
    // Footer
    securePurchase: string
    dataProtected: string
    paymentProcessedBy: string
    footerCopyright: string
    footerConsent: string
    termsOfPurchase: string
    and: string
    privacyTerms: string
    // Privacy modal
    privacyPolicy: string
    privacyLastUpdated: string
    privacySection1Title: string
    privacySection1Text: string
    privacySection2Title: string
    privacySection2Text: string
    privacySection3Title: string
    privacySection3Text: string
    privacySection4Title: string
    privacySection4Text: string
    privacySection5Title: string
    privacySection5Text: string
    close: string
    // Timer
    limitedTimeOffer: string
    offerEnded: string
    // Loading / Error states
    loadingCheckout: string
    checkoutNotFound: string
    checkoutNotFoundDescription: string
    paymentSystemNotAvailable: string
    off: string
    // Errors
    fillRequiredFields: string
    invalidEmail: string
    paymentFailed: string
}

const en: CheckoutTranslations = {
    back: 'Back',
    youArePurchasing: 'YOU ARE PURCHASING:',
    personalInformation: 'Personal Information',
    email: 'Email',
    emailPlaceholder: 'your@email.com',
    emailHelper: 'You will receive access to the product at this email',
    fullName: 'Full name',
    fullNamePlaceholder: 'Your full name',
    phone: 'Phone',
    phonePlaceholder: '(00) 00000-0000',
    paymentMethod: 'Payment method',
    paymentMethodHelper: 'Choose your payment method below',
    creditCard: 'Credit Card',
    cardNumber: 'Card number',
    expiryDate: 'Expiry Date',
    cvv: 'CVV',
    installments: 'Installments',
    installmentLabel: (count, amount) => `${count}x of ${amount}`,
    fullPayment: ' full payment',
    interestFree: ' interest-free',
    withInterest: ' with interest',
    interestWarning: 'Installments above 6x have 2.5% monthly interest',
    noInterest: 'Interest-free!',
    limitedOffers: 'Limited offers',
    addToOrder: 'Add to order',
    added: 'Added',
    defaultOrderBumpAccept: 'YES, I WANT THIS SPECIAL OFFER!',
    defaultOrderBumpButton: 'Add to purchase',
    orderSummary: 'Order summary',
    subtotal: 'Subtotal',
    total: 'Total',
    installmentsSummary: (count, amount) => `or ${count}x of ${amount} interest-free`,
    processing: 'Processing...',
    paymentSuccessful: 'Payment Successful!',
    completePurchase: 'COMPLETE PURCHASE',
    accessGranted: 'Access granted! Check your email.',
    securePurchase: '100% Secure Purchase',
    dataProtected: 'Your data protected',
    paymentProcessedBy: 'PAYMENT PROCESSED BY:',
    footerCopyright: 'This purchase will be processed by: ClickNich © 2026 - All rights reserved.',
    footerConsent: 'By continuing with this purchase, you agree to the',
    termsOfPurchase: 'Terms of Purchase',
    and: 'and',
    privacyTerms: 'Privacy Terms',
    privacyPolicy: 'Privacy Policy',
    privacyLastUpdated: 'Last updated: 01/19/2024',
    privacySection1Title: '1. Personal Information Collected:',
    privacySection1Text: 'We collect personal information that you voluntarily provide when making a purchase, including name, email address, and payment information. We may also collect information about your device and how you interact with our services.',
    privacySection2Title: '2. Use of Personal Information:',
    privacySection2Text: 'We use your personal information to process transactions, send notifications related to your purchase, provide customer support, and improve our services. We do not sell your personal information to third parties.',
    privacySection3Title: '3. Cookies and Similar Technologies:',
    privacySection3Text: 'We use cookies and similar technologies to improve user experience, analyze traffic, and personalize content. You can control cookie preferences through your browser settings.',
    privacySection4Title: '4. Data Security:',
    privacySection4Text: 'We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. Payment processing is handled by certified third-party providers.',
    privacySection5Title: '5. User Rights:',
    privacySection5Text: 'You have the right to access, correct, or delete your personal information. To exercise these rights, please contact our support team. We will respond to your request within a reasonable timeframe.',
    close: 'Close',
    limitedTimeOffer: 'Limited time offer',
    offerEnded: 'Offer ended',
    loadingCheckout: 'Loading checkout...',
    checkoutNotFound: 'Checkout not found',
    checkoutNotFoundDescription: 'The link you accessed may be incorrect or expired.',
    paymentSystemNotAvailable: 'Payment system not available',
    off: 'OFF',
    fillRequiredFields: 'Please fill in all required fields',
    invalidEmail: 'Please enter a valid email address',
    paymentFailed: 'Payment processing failed',
}

const es: CheckoutTranslations = {
    back: 'Volver',
    youArePurchasing: 'ESTÁS COMPRANDO:',
    personalInformation: 'Información Personal',
    email: 'Correo electrónico',
    emailPlaceholder: 'tu@correo.com',
    emailHelper: 'Recibirás el acceso al producto en este correo',
    fullName: 'Nombre completo',
    fullNamePlaceholder: 'Tu nombre completo',
    phone: 'Teléfono',
    phonePlaceholder: '(00) 00000-0000',
    paymentMethod: 'Método de pago',
    paymentMethodHelper: 'Elige tu método de pago a continuación',
    creditCard: 'Tarjeta de crédito',
    cardNumber: 'Número de tarjeta',
    expiryDate: 'Fecha de vencimiento',
    cvv: 'CVV',
    installments: 'Cuotas',
    installmentLabel: (count, amount) => `${count}x de ${amount}`,
    fullPayment: ' pago único',
    interestFree: ' sin intereses',
    withInterest: ' con intereses',
    interestWarning: 'Las cuotas superiores a 6x tienen un interés del 2,5% mensual',
    noInterest: '¡Sin intereses!',
    limitedOffers: 'Ofertas limitadas',
    addToOrder: 'Agregar al pedido',
    added: 'Agregado',
    defaultOrderBumpAccept: '¡SÍ, QUIERO ESTA OFERTA ESPECIAL!',
    defaultOrderBumpButton: 'Agregar a la compra',
    orderSummary: 'Resumen del pedido',
    subtotal: 'Subtotal',
    total: 'Total',
    installmentsSummary: (count, amount) => `o ${count}x de ${amount} sin intereses`,
    processing: 'Procesando...',
    paymentSuccessful: '¡Pago exitoso!',
    completePurchase: 'COMPLETAR COMPRA',
    accessGranted: '¡Acceso otorgado! Revisa tu correo.',
    securePurchase: 'Compra 100% segura',
    dataProtected: 'Tus datos protegidos',
    paymentProcessedBy: 'PAGO PROCESADO POR:',
    footerCopyright: 'Esta compra será procesada por: ClickNich © 2026 - Todos los derechos reservados.',
    footerConsent: 'Al continuar con esta compra, aceptas los',
    termsOfPurchase: 'Términos de compra',
    and: 'y',
    privacyTerms: 'Términos de privacidad',
    privacyPolicy: 'Política de Privacidad',
    privacyLastUpdated: 'Última actualización: 19/01/2024',
    privacySection1Title: '1. Información Personal Recopilada:',
    privacySection1Text: 'Recopilamos información personal que proporcionas voluntariamente al realizar una compra, incluyendo nombre, dirección de correo electrónico e información de pago. También podemos recopilar información sobre tu dispositivo y cómo interactúas con nuestros servicios.',
    privacySection2Title: '2. Uso de la Información Personal:',
    privacySection2Text: 'Utilizamos tu información personal para procesar transacciones, enviar notificaciones relacionadas con tu compra, brindar soporte al cliente y mejorar nuestros servicios. No vendemos tu información personal a terceros.',
    privacySection3Title: '3. Cookies y Tecnologías Similares:',
    privacySection3Text: 'Utilizamos cookies y tecnologías similares para mejorar la experiencia del usuario, analizar el tráfico y personalizar el contenido. Puedes controlar las preferencias de cookies a través de la configuración de tu navegador.',
    privacySection4Title: '4. Seguridad de los Datos:',
    privacySection4Text: 'Implementamos medidas de seguridad apropiadas para proteger tu información personal contra acceso no autorizado, alteración, divulgación o destrucción. El procesamiento de pagos es manejado por proveedores externos certificados.',
    privacySection5Title: '5. Derechos del Usuario:',
    privacySection5Text: 'Tienes derecho a acceder, corregir o eliminar tu información personal. Para ejercer estos derechos, por favor contacta a nuestro equipo de soporte. Responderemos a tu solicitud en un plazo razonable.',
    close: 'Cerrar',
    limitedTimeOffer: 'Oferta por tiempo limitado',
    offerEnded: 'Oferta finalizada',
    loadingCheckout: 'Cargando checkout...',
    checkoutNotFound: 'Checkout no encontrado',
    checkoutNotFoundDescription: 'El enlace al que accediste puede ser incorrecto o haber expirado.',
    paymentSystemNotAvailable: 'Sistema de pago no disponible',
    off: 'OFF',
    fillRequiredFields: 'Por favor completa todos los campos requeridos',
    invalidEmail: 'Por favor ingresa un correo electrónico válido',
    paymentFailed: 'El procesamiento del pago falló',
}

const pt: CheckoutTranslations = {
    back: 'Voltar',
    youArePurchasing: 'VOCÊ ESTÁ COMPRANDO:',
    personalInformation: 'Informações Pessoais',
    email: 'E-mail',
    emailPlaceholder: 'seu@email.com',
    emailHelper: 'Você receberá o acesso ao produto neste e-mail',
    fullName: 'Nome completo',
    fullNamePlaceholder: 'Seu nome completo',
    phone: 'Telefone',
    phonePlaceholder: '(00) 00000-0000',
    paymentMethod: 'Método de pagamento',
    paymentMethodHelper: 'Escolha seu método de pagamento abaixo',
    creditCard: 'Cartão de crédito',
    cardNumber: 'Número do cartão',
    expiryDate: 'Data de validade',
    cvv: 'CVV',
    installments: 'Parcelas',
    installmentLabel: (count, amount) => `${count}x de ${amount}`,
    fullPayment: ' à vista',
    interestFree: ' sem juros',
    withInterest: ' com juros',
    interestWarning: 'Parcelas acima de 6x possuem juros de 2,5% ao mês',
    noInterest: 'Sem juros!',
    limitedOffers: 'Ofertas limitadas',
    addToOrder: 'Adicionar ao pedido',
    added: 'Adicionado',
    defaultOrderBumpAccept: 'SIM, EU QUERO ESTA OFERTA ESPECIAL!',
    defaultOrderBumpButton: 'Adicionar à compra',
    orderSummary: 'Resumo do pedido',
    subtotal: 'Subtotal',
    total: 'Total',
    installmentsSummary: (count, amount) => `ou ${count}x de ${amount} sem juros`,
    processing: 'Processando...',
    paymentSuccessful: 'Pagamento realizado!',
    completePurchase: 'FINALIZAR COMPRA',
    accessGranted: 'Acesso liberado! Confira seu e-mail.',
    securePurchase: 'Compra 100% segura',
    dataProtected: 'Seus dados protegidos',
    paymentProcessedBy: 'PAGAMENTO PROCESSADO POR:',
    footerCopyright: 'Esta compra será processada por: ClickNich © 2026 - Todos os direitos reservados.',
    footerConsent: 'Ao continuar com esta compra, você concorda com os',
    termsOfPurchase: 'Termos de Compra',
    and: 'e',
    privacyTerms: 'Termos de Privacidade',
    privacyPolicy: 'Política de Privacidade',
    privacyLastUpdated: 'Última atualização: 19/01/2024',
    privacySection1Title: '1. Informações Pessoais Coletadas:',
    privacySection1Text: 'Coletamos informações pessoais que você fornece voluntariamente ao fazer uma compra, incluindo nome, endereço de e-mail e informações de pagamento. Também podemos coletar informações sobre seu dispositivo e como você interage com nossos serviços.',
    privacySection2Title: '2. Uso das Informações Pessoais:',
    privacySection2Text: 'Utilizamos suas informações pessoais para processar transações, enviar notificações relacionadas à sua compra, fornecer suporte ao cliente e melhorar nossos serviços. Não vendemos suas informações pessoais para terceiros.',
    privacySection3Title: '3. Cookies e Tecnologias Similares:',
    privacySection3Text: 'Utilizamos cookies e tecnologias similares para melhorar a experiência do usuário, analisar o tráfego e personalizar o conteúdo. Você pode controlar as preferências de cookies através das configurações do seu navegador.',
    privacySection4Title: '4. Segurança dos Dados:',
    privacySection4Text: 'Implementamos medidas de segurança apropriadas para proteger suas informações pessoais contra acesso não autorizado, alteração, divulgação ou destruição. O processamento de pagamentos é tratado por provedores terceirizados certificados.',
    privacySection5Title: '5. Direitos do Usuário:',
    privacySection5Text: 'Você tem o direito de acessar, corrigir ou excluir suas informações pessoais. Para exercer esses direitos, entre em contato com nossa equipe de suporte. Responderemos à sua solicitação dentro de um prazo razoável.',
    close: 'Fechar',
    limitedTimeOffer: 'Oferta por tempo limitado',
    offerEnded: 'Oferta encerrada',
    loadingCheckout: 'Carregando checkout...',
    checkoutNotFound: 'Checkout não encontrado',
    checkoutNotFoundDescription: 'O link que você acessou pode estar incorreto ou expirado.',
    paymentSystemNotAvailable: 'Sistema de pagamento não disponível',
    off: 'OFF',
    fillRequiredFields: 'Por favor preencha todos os campos obrigatórios',
    invalidEmail: 'Por favor digite um endereço de e-mail válido',
    paymentFailed: 'Falha no processamento do pagamento',
}

const translations: Record<CheckoutLanguage, CheckoutTranslations> = { en, es, pt }

export function getTranslations(lang: CheckoutLanguage = 'en'): CheckoutTranslations {
    return translations[lang] || translations.en
}

export type { CheckoutTranslations }
