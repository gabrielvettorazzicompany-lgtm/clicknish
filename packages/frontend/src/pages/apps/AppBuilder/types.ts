export interface AppData {
    name: string
    slug: string
    showNames: boolean
    highlightCommunity: boolean
    freeRegistration: boolean
    supportEnabled: boolean
    appType: string
    language: string
    theme: 'light' | 'dark'
    logo: string | null
    banners: Array<{ id: number; link: string; image: string | null }>
    extraBannerLinks: Array<string>
    supportIcon: string | null
    supportEmail: string
    whatsappNumber: string
    pushNotifications?: boolean
    analyticsEnabled?: boolean
    acceptCreditCard?: boolean
    acceptPix?: boolean
    acceptBoleto?: boolean
    oneClickCheckout?: boolean
    primaryColor: string
    secondaryColor: string
    review_status?: 'pending_review' | 'approved' | 'rejected'
    price: number
    currency: 'BRL' | 'USD' | 'CHF' | 'EUR'
}
