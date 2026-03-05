export interface CustomBanner {
    image?: string
    title?: string
    subtitle?: string
    description?: string
    customHeight?: number
    customWidth?: number
    imageScale?: number
    imagePosition?: { x: number; y: number }
}

export type TestimonialSlot = 'below_button'

export interface Testimonial {
    id: string
    photo?: string
    text: string
    stars: number
    name: string
    backgroundColor: string
    textColor: string
    horizontalMode: boolean
    slot: TestimonialSlot
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

export type ImageBlockSlot =
    | 'below_payment_methods'
    | 'above_button'
    | 'below_button'
    | 'above_testimonials'
    | 'between_testimonials'
    | 'below_testimonials'
    | 'below_seals'

export interface CheckoutImageBlock {
    id: string
    url: string
    slot: ImageBlockSlot
    width?: 'full' | 'xlarge' | 'large' | 'medium' | 'small'
    customWidth?: number
    customHeight?: number
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
    paymentMethod?: 'credit_card' | 'paypal'
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
    onBannerUpload?: (url: string) => void
    onBannerFile?: (file: File) => void
    onBannerResize?: (height: number) => void
    onUpdateBannerWidth?: (width: number) => void
    onBannerImageScaleChange?: (scale: number) => void
    onBannerImagePositionChange?: (position: { x: number, y: number }) => void
    isPreview?: boolean
    viewDevice?: 'desktop' | 'mobile'
    isDragging?: boolean
    timerConfig?: TimerConfig
    onTimerClick?: () => void
    draggedComponentType?: 'image' | 'timer' | 'seals' | 'testimonials' | null
    selectedPaymentMethods?: ('credit_card' | 'paypal')[]
    defaultPaymentMethod?: 'credit_card' | 'paypal'
    productType?: 'app' | 'marketplace'
    applicationId?: string
    checkoutId?: string
    sessionId?: string
    trackingParameters?: Record<string, string | null>
    language?: CheckoutLanguage
    buttonColor?: string
    buttonText?: string
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
    securitySealsEnabled?: boolean
    onSecuritySealsClick?: () => void
    testimonials?: Testimonial[]
    testimonialsCarouselMode?: boolean
    testimonialsHorizontalMode?: boolean
    onTestimonialsClick?: (id?: string) => void
    imageBlocks?: CheckoutImageBlock[]
    onImageBlockClick?: () => void
    onUpdateImageBlock?: (id: string, updates: Partial<CheckoutImageBlock>) => void
    onDeleteImageBlock?: (id: string) => void
    mollieEnabledMethods?: Array<{ id: string; label: string; description?: string; icon_url?: string }>
}

export type PaymentMethod = 'credit'
export type CheckoutLanguage = 'en' | 'pt' | 'es'