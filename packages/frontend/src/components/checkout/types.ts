export interface CustomBanner {
    image?: string
    title?: string
    subtitle?: string
    description?: string
    customHeight?: number
    imageScale?: number
    imagePosition?: { x: number; y: number }
}

export interface OrderBump {
    id: string
    offer_product_id: string
    offer_product_name: string
    offer_product_price: number
    offer_product_currency?: string
    offer_product_image?: string
    custom_price?: number
    button_text?: string
    offer_text?: string
    product_name?: string
    product_description?: string
    show_product_image?: boolean
    discount_type?: 'percentage' | 'fixed' | 'none'
    discount_value?: number
}

export interface TimerConfig {
    enabled: boolean
    minutes: number
    backgroundColor: string
    textColor: string
    activeText: string
    finishedText: string
}

export interface FormData {
    name: string
    email: string
    phone: string
}

export interface PaymentData {
    formData: FormData
    selectedOrderBumps: OrderBump[]
    totalAmount: number
    installments?: number
}

export interface CheckoutDigitalProps {
    productId: string
    productName: string
    productPrice: number
    productCurrency?: string
    productImage?: string
    productDescription?: string
    customBanner?: CustomBanner
    onBack?: () => void
    bannerSelected?: boolean
    onBannerClick?: () => void
    onBannerAdjust?: () => void
    onBannerRemove?: () => void
    onBannerResize?: (height: number) => void
    onBannerImageScaleChange?: (scale: number) => void
    onBannerImagePositionChange?: (position: { x: number, y: number }) => void
    isPreview?: boolean
    viewDevice?: 'desktop' | 'mobile'
    isDragging?: boolean
    timerConfig?: TimerConfig
    onTimerClick?: () => void
    draggedComponentType?: 'image' | 'timer' | null
    selectedPaymentMethods?: ('credit_card')[]
    defaultPaymentMethod?: 'credit_card'
    productType?: 'app' | 'marketplace'
    applicationId?: string
    checkoutId?: string
    sessionId?: string
    trackingParameters?: Record<string, string | null>
    language?: CheckoutLanguage
    buttonColor?: string
    initialOrderBumps?: OrderBump[]
    initialAppProducts?: any[]
    onPaymentSuccess?: (result?: { purchaseId: string; thankyouToken: string; redirectUrl?: string } | null) => void | Promise<void>
    onProcessPayment?: (paymentData: PaymentData) => Promise<{
        success: boolean
        purchaseId?: string
        thankyouToken?: string
        redirectUrl?: string
    }>
    onLeadCapture?: (data: { email: string; name: string; phone: string }) => void
}

export type PaymentMethod = 'credit'
export type CheckoutLanguage = 'en' | 'pt' | 'es'