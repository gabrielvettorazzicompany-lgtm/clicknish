export type CheckoutLanguage = 'en' | 'es' | 'pt' | 'nl' | 'fr' | 'de'

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

const nl: CheckoutTranslations = {
    back: 'Terug',
    youArePurchasing: 'JE KOOPT:',
    personalInformation: 'Persoonlijke Informatie',
    email: 'E-mail',
    emailPlaceholder: 'jouw@email.com',
    emailHelper: 'Je ontvangt toegang tot het product op dit e-mailadres',
    fullName: 'Volledige naam',
    fullNamePlaceholder: 'Je volledige naam',
    phone: 'Telefoon',
    phonePlaceholder: '(00) 00000-0000',
    paymentMethod: 'Betaalmethode',
    paymentMethodHelper: 'Kies hieronder je betaalmethode',
    creditCard: 'Creditcard',
    cardNumber: 'Kaartnummer',
    expiryDate: 'Vervaldatum',
    cvv: 'CVV',
    installments: 'Termijnen',
    installmentLabel: (count, amount) => `${count}x van ${amount}`,
    fullPayment: ' volledige betaling',
    interestFree: ' rentevrij',
    withInterest: ' met rente',
    interestWarning: 'Termijnen boven 6x hebben 2,5% maandelijkse rente',
    noInterest: 'Rentevrij!',
    limitedOffers: 'Beperkte aanbiedingen',
    addToOrder: 'Toevoegen aan bestelling',
    added: 'Toegevoegd',
    defaultOrderBumpAccept: 'JA, IK WIL DIT SPECIALE AANBOD!',
    defaultOrderBumpButton: 'Toevoegen aan aankoop',
    orderSummary: 'Besteloverzicht',
    subtotal: 'Subtotaal',
    total: 'Totaal',
    installmentsSummary: (count, amount) => `of ${count}x van ${amount} rentevrij`,
    processing: 'Verwerken...',
    paymentSuccessful: 'Betaling succesvol!',
    completePurchase: 'AANKOOP VOLTOOIEN',
    accessGranted: 'Toegang verleend! Controleer je e-mail.',
    securePurchase: '100% Veilige Aankoop',
    dataProtected: 'Je gegevens zijn beschermd',
    paymentProcessedBy: 'BETALING VERWERKT DOOR:',
    footerCopyright: 'Deze aankoop wordt verwerkt door: ClickNich © 2026 - Alle rechten voorbehouden.',
    footerConsent: 'Door verder te gaan met deze aankoop, ga je akkoord met de',
    termsOfPurchase: 'Aankoopvoorwaarden',
    and: 'en',
    privacyTerms: 'Privacyvoorwaarden',
    privacyPolicy: 'Privacybeleid',
    privacyLastUpdated: 'Laatst bijgewerkt: 19/01/2024',
    privacySection1Title: '1. Verzamelde Persoonlijke Informatie:',
    privacySection1Text: 'We verzamelen persoonlijke informatie die je vrijwillig verstrekt bij het doen van een aankoop, waaronder naam, e-mailadres en betalingsinformatie. We kunnen ook informatie verzamelen over je apparaat en hoe je met onze diensten omgaat.',
    privacySection2Title: '2. Gebruik van Persoonlijke Informatie:',
    privacySection2Text: 'We gebruiken je persoonlijke informatie om transacties te verwerken, notificaties te verzenden die verband houden met je aankoop, klantenondersteuning te bieden en onze diensten te verbeteren. We verkopen je persoonlijke informatie niet aan derden.',
    privacySection3Title: '3. Cookies en Soortgelijke Technologieën:',
    privacySection3Text: 'We gebruiken cookies en soortgelijke technologieën om de gebruikerservaring te verbeteren, verkeer te analyseren en inhoud te personaliseren. Je kunt cookievoorkeuren beheren via je browserinstellingen.',
    privacySection4Title: '4. Gegevensbeveiliging:',
    privacySection4Text: 'We implementeren passende beveiligingsmaatregelen om je persoonlijke informatie te beschermen tegen ongeautoriseerde toegang, wijziging, openbaarmaking of vernietiging. Betalingsverwerking wordt afgehandeld door gecertificeerde externe providers.',
    privacySection5Title: '5. Gebruikersrechten:',
    privacySection5Text: 'Je hebt het recht om toegang te krijgen tot, te corrigeren of te verwijderen je persoonlijke informatie. Om deze rechten uit te oefenen, neem contact op met ons ondersteuningsteam. We zullen binnen een redelijke termijn op je verzoek reageren.',
    close: 'Sluiten',
    limitedTimeOffer: 'Tijdelijk aanbod',
    offerEnded: 'Aanbod beëindigd',
    loadingCheckout: 'Checkout laden...',
    checkoutNotFound: 'Checkout niet gevonden',
    checkoutNotFoundDescription: 'De link die je hebt geopend is mogelijk onjuist of verlopen.',
    paymentSystemNotAvailable: 'Betalingssysteem niet beschikbaar',
    off: 'KORTING',
    fillRequiredFields: 'Vul alstublieft alle verplichte velden in',
    invalidEmail: 'Voer alstublieft een geldig e-mailadres in',
    paymentFailed: 'Betalingsverwerking mislukt',
}

const fr: CheckoutTranslations = {
    back: 'Retour',
    youArePurchasing: 'VOUS ACHETEZ :',
    personalInformation: 'Informations personnelles',
    email: 'E-mail',
    emailPlaceholder: 'votre@email.com',
    emailHelper: 'Vous recevrez l’accès au produit sur cet e-mail',
    fullName: 'Nom complet',
    fullNamePlaceholder: 'Votre nom complet',
    phone: 'Téléphone',
    phonePlaceholder: '(00) 00000-0000',
    paymentMethod: 'Mode de paiement',
    paymentMethodHelper: 'Choisissez votre mode de paiement ci-dessous',
    creditCard: 'Carte de crédit',
    cardNumber: 'Numéro de carte',
    expiryDate: 'Date d’expiration',
    cvv: 'CVV',
    installments: 'Versements',
    installmentLabel: (count, amount) => `${count}x de ${amount}`,
    fullPayment: ' paiement intégral',
    interestFree: ' sans intérêts',
    withInterest: ' avec intérêts',
    interestWarning: 'Les versements supérieurs à 6x ont 2,5 % d’intérêts mensuels',
    noInterest: 'Sans intérêts !',
    limitedOffers: 'Offres limitées',
    addToOrder: 'Ajouter à la commande',
    added: 'Ajouté',
    defaultOrderBumpAccept: 'OUI, JE VEUX CETTE OFFRE SPÉCIALE !',
    defaultOrderBumpButton: 'Ajouter à l’achat',
    orderSummary: 'Récapitulatif de commande',
    subtotal: 'Sous-total',
    total: 'Total',
    installmentsSummary: (count, amount) => `ou ${count}x de ${amount} sans intérêts`,
    processing: 'Traitement en cours...',
    paymentSuccessful: 'Paiement réussi !',
    completePurchase: 'FINALISER L’ACHAT',
    accessGranted: 'Accès accordé ! Vérifiez votre e-mail.',
    securePurchase: 'Achat 100 % sécurisé',
    dataProtected: 'Vos données sont protégées',
    paymentProcessedBy: 'PAIEMENT TRAITÉ PAR :',
    footerCopyright: 'Cet achat sera traité par : ClickNich © 2026 - Tous droits réservés.',
    footerConsent: 'En poursuivant cet achat, vous acceptez les',
    termsOfPurchase: 'Conditions d’achat',
    and: 'et',
    privacyTerms: 'Conditions de confidentialité',
    privacyPolicy: 'Politique de confidentialité',
    privacyLastUpdated: 'Dernière mise à jour : 19/01/2024',
    privacySection1Title: '1. Informations personnelles collectées :',
    privacySection1Text: 'Nous collectons les informations personnelles que vous fournissez volontairement lors d’un achat, notamment le nom, l’adresse e-mail et les informations de paiement. Nous pouvons également collecter des informations sur votre appareil et votre interaction avec nos services.',
    privacySection2Title: '2. Utilisation des informations personnelles :',
    privacySection2Text: 'Nous utilisons vos informations personnelles pour traiter les transactions, envoyer des notifications liées à votre achat, fournir une assistance client et améliorer nos services. Nous ne vendons pas vos informations personnelles à des tiers.',
    privacySection3Title: '3. Cookies et technologies similaires :',
    privacySection3Text: 'Nous utilisons des cookies et des technologies similaires pour améliorer l’expérience utilisateur, analyser le trafic et personnaliser le contenu. Vous pouvez gérer vos préférences de cookies via les paramètres de votre navigateur.',
    privacySection4Title: '4. Sécurité des données :',
    privacySection4Text: 'Nous mettons en œuvre des mesures de sécurité appropriées pour protéger vos informations personnelles contre tout accès non autorisé, toute modification, divulgation ou destruction. Le traitement des paiements est confié à des prestataires tiers certifiés.',
    privacySection5Title: '5. Droits des utilisateurs :',
    privacySection5Text: 'Vous avez le droit d’accéder à vos informations personnelles, de les corriger ou de les supprimer. Pour exercer ces droits, veuillez contacter notre équipe d’assistance. Nous répondrons à votre demande dans un délai raisonnable.',
    close: 'Fermer',
    limitedTimeOffer: 'Offre à durée limitée',
    offerEnded: 'Offre terminée',
    loadingCheckout: 'Chargement du checkout...',
    checkoutNotFound: 'Checkout introuvable',
    checkoutNotFoundDescription: 'Le lien auquel vous avez accédé est peut-être incorrect ou expiré.',
    paymentSystemNotAvailable: 'Système de paiement indisponible',
    off: 'REMISE',
    fillRequiredFields: 'Veuillez remplir tous les champs obligatoires',
    invalidEmail: 'Veuillez saisir une adresse e-mail valide',
    paymentFailed: 'Le traitement du paiement a échoué',
}

const de: CheckoutTranslations = {
    back: 'Zurück',
    youArePurchasing: 'SIE KAUFEN:',
    personalInformation: 'Persönliche Informationen',
    email: 'E-Mail',
    emailPlaceholder: 'ihre@email.com',
    emailHelper: 'Sie erhalten den Produktzugang an diese E-Mail-Adresse',
    fullName: 'Vollständiger Name',
    fullNamePlaceholder: 'Ihr vollständiger Name',
    phone: 'Telefon',
    phonePlaceholder: '(00) 00000-0000',
    paymentMethod: 'Zahlungsmethode',
    paymentMethodHelper: 'Wählen Sie unten Ihre Zahlungsmethode',
    creditCard: 'Kreditkarte',
    cardNumber: 'Kartennummer',
    expiryDate: 'Ablaufdatum',
    cvv: 'CVV',
    installments: 'Raten',
    installmentLabel: (count, amount) => `${count}x à ${amount}`,
    fullPayment: ' Einmalzahlung',
    interestFree: ' zinsfrei',
    withInterest: ' mit Zinsen',
    interestWarning: 'Raten über 6x haben 2,5 % monatliche Zinsen',
    noInterest: 'Zinsfrei!',
    limitedOffers: 'Begrenzte Angebote',
    addToOrder: 'Zur Bestellung hinzufügen',
    added: 'Hinzugefügt',
    defaultOrderBumpAccept: 'JA, ICH MÖCHTE DIESES SPEZIALANGEBOT!',
    defaultOrderBumpButton: 'Zum Kauf hinzufügen',
    orderSummary: 'Bestellzusammenfassung',
    subtotal: 'Zwischensumme',
    total: 'Gesamt',
    installmentsSummary: (count, amount) => `oder ${count}x à ${amount} zinsfrei`,
    processing: 'Wird verarbeitet...',
    paymentSuccessful: 'Zahlung erfolgreich!',
    completePurchase: 'KAUF ABSCHLIEßEN',
    accessGranted: 'Zugang gewährt! Überprüfen Sie Ihre E-Mail.',
    securePurchase: '100 % sicherer Kauf',
    dataProtected: 'Ihre Daten sind geschützt',
    paymentProcessedBy: 'ZAHLUNG VERARBEITET VON:',
    footerCopyright: 'Dieser Kauf wird verarbeitet von: ClickNich © 2026 - Alle Rechte vorbehalten.',
    footerConsent: 'Indem Sie diesen Kauf fortsetzen, stimmen Sie den',
    termsOfPurchase: 'Kaufbedingungen',
    and: 'und',
    privacyTerms: 'Datenschutzbestimmungen',
    privacyPolicy: 'Datenschutzrichtlinie',
    privacyLastUpdated: 'Zuletzt aktualisiert: 19.01.2024',
    privacySection1Title: '1. Erhobene persönliche Daten:',
    privacySection1Text: 'Wir erheben persönliche Daten, die Sie beim Kauf freiwillig angeben, einschließlich Name, E-Mail-Adresse und Zahlungsinformationen. Wir können auch Informationen über Ihr Gerät und Ihre Interaktion mit unseren Diensten erfassen.',
    privacySection2Title: '2. Verwendung persönlicher Daten:',
    privacySection2Text: 'Wir verwenden Ihre persönlichen Daten, um Transaktionen zu verarbeiten, kaufbezogene Benachrichtigungen zu senden, Kundensupport bereitzustellen und unsere Dienste zu verbessern. Wir verkaufen Ihre persönlichen Daten nicht an Dritte.',
    privacySection3Title: '3. Cookies und ähnliche Technologien:',
    privacySection3Text: 'Wir verwenden Cookies und ähnliche Technologien, um die Benutzererfahrung zu verbessern, den Datenverkehr zu analysieren und Inhalte zu personalisieren. Sie können Cookie-Einstellungen über Ihre Browsereinstellungen verwalten.',
    privacySection4Title: '4. Datensicherheit:',
    privacySection4Text: 'Wir implementieren geeignete Sicherheitsmaßnahmen zum Schutz Ihrer persönlichen Daten vor unbefugtem Zugriff, Änderung, Offenlegung oder Zerstörung. Die Zahlungsverarbeitung erfolgt durch zertifizierte Drittanbieter.',
    privacySection5Title: '5. Nutzerrechte:',
    privacySection5Text: 'Sie haben das Recht, auf Ihre persönlichen Daten zuzugreifen, diese zu korrigieren oder zu löschen. Um diese Rechte auszuüben, wenden Sie sich bitte an unser Support-Team. Wir werden Ihre Anfrage innerhalb einer angemessenen Frist beantworten.',
    close: 'Schließen',
    limitedTimeOffer: 'Zeitlich begrenztes Angebot',
    offerEnded: 'Angebot beendet',
    loadingCheckout: 'Checkout wird geladen...',
    checkoutNotFound: 'Checkout nicht gefunden',
    checkoutNotFoundDescription: 'Der Link, den Sie aufgerufen haben, ist möglicherweise falsch oder abgelaufen.',
    paymentSystemNotAvailable: 'Zahlungssystem nicht verfügbar',
    off: 'RABATT',
    fillRequiredFields: 'Bitte füllen Sie alle Pflichtfelder aus',
    invalidEmail: 'Bitte geben Sie eine gültige E-Mail-Adresse ein',
    paymentFailed: 'Zahlungsverarbeitung fehlgeschlagen',
}

const translations: Record<CheckoutLanguage, CheckoutTranslations> = { en, es, pt, nl, fr, de }

export function getTranslations(lang: CheckoutLanguage = 'en'): CheckoutTranslations {
    return translations[lang] || translations.en
}

export type { CheckoutTranslations }
