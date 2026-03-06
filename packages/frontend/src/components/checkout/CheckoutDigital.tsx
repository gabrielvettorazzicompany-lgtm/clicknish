import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'

// ✅ Singleton extraído para stripe-singleton.ts — permite preload independente
// do lazy load deste componente (CheckoutPublic importa direto o singleton)
import { getStripePromise } from '@/lib/stripe-singleton'
export { getStripePromise } from '@/lib/stripe-singleton'

import { Elements, CardNumberElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { useNavigate } from 'react-router-dom'
import { getTranslations, CheckoutLanguage } from './translations'
import { useI18n } from '@/i18n'

// Import optimized components and hooks
import { useOrderBumpsOptimized } from './hooks/useOrderBumpsOptimized'
import { useCheckoutState } from './hooks/useCheckoutState'
// Componentes críticos (above the fold) — import estático
import CheckoutHeader from './components/CheckoutHeader'
import CheckoutTimer from './components/CheckoutTimer'
import CheckoutBanner from './components/CheckoutBanner'
import ProductInfoHeader from './components/ProductInfoHeader'
import OrderBumpsList from './components/OrderBumpsList'
import { PaymentForm } from './PaymentForm'
import { OrderSummary } from './OrderSummary'
import type { CheckoutDigitalProps, PaymentData, CustomBanner } from './types'

// Componentes não-críticos (below the fold) — lazy load
const TestimonialsSection = React.lazy(() => import('./components/TestimonialsSection'))
const CheckoutImageDisplay = React.lazy(() => import('./components/CheckoutImageDisplay'))
const ImageDropZone = React.lazy(() => import('./components/ImageDropZone'))
const CheckoutFooter = React.lazy(() => import('./components/CheckoutFooter'))
const Modal = React.lazy(() => import('./components/Modal'))
const PrivacyPolicyContent = React.lazy(() => import('./components/PrivacyPolicyContent'))

function CheckoutDigital({
    productId,
    productName,
    productPrice,
    productCurrency = 'USD',
    productImage,
    productDescription,
    customBanner,
    onBack,
    bannerSelected = false,
    onBannerClick,
    onBannerAdjust,
    onBannerRemove,
    onBannerResize,
    onUpdateBannerWidth,
    onBannerUpload,
    onBannerFile,
    onBannerImageScaleChange,
    onBannerImagePositionChange,
    isPreview = false,
    viewDevice = 'desktop',
    isDragging = false,
    timerConfig,
    onTimerClick,
    draggedComponentType,
    selectedPaymentMethods = ['credit_card'],
    defaultPaymentMethod = 'credit_card',
    productType = 'marketplace',
    applicationId,
    checkoutId,
    language = 'en',
    onPaymentSuccess,
    onProcessPayment,
    onLeadCapture,
    buttonColor = '#111827',
    buttonText = 'Complete Purchase',
    initialOrderBumps,
    initialAppProducts,
    sessionId,
    trackingParameters,
    securitySealsEnabled = false,
    onSecuritySealsClick,
    testimonials = [],
    testimonialsCarouselMode = false,
    testimonialsHorizontalMode = false,
    onTestimonialsClick,
    imageBlocks = [],
    onImageBlockClick,
    onUpdateImageBlock,
    onDeleteImageBlock,
    mollieEnabledMethods,
}: CheckoutDigitalProps) {
    const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false)
    const [activePaymentMethod, setActivePaymentMethod] = useState<'credit_card' | 'paypal'>(defaultPaymentMethod as 'credit_card' | 'paypal')

    const t = getTranslations(language)
    const { t: i18nT } = useI18n()

    // Use optimized hooks
    const {
        formData,
        setFormData,
        paymentState,
        setProcessing,
        setPaymentSuccess,
        setPaymentError,
        setPaymentMessage,
        installments,
        setInstallments
    } = useCheckoutState()

    // Use custom hook for order bumps
    // ✅ OTIMIZAÇÃO: Carregar order bumps tanto em preview quanto em produção
    // shouldLoadData=false apenas bloqueia o processamento de pagamento, não a busca de dados
    const shouldLoadOrderBumps = !!(checkoutId || productId)

    // ✅ OTIMIZAÇÃO: Hook otimizado com cache e RPC
    const {
        orderBumps,
        selectedBumps,
        toggleBump,
        calculateBumpsTotal,
        loading: orderBumpsLoading
    } = useOrderBumpsOptimized(
        shouldLoadOrderBumps ? checkoutId : undefined,
        shouldLoadOrderBumps ? productId : undefined,
        initialOrderBumps
    )

    // Calcular total incluindo order bumps - memoized
    const totalWithBumps = useMemo(() => {
        return productPrice + calculateBumpsTotal()
    }, [productPrice, calculateBumpsTotal])

    // Memoized submit handler
    const handleSubmit = useCallback(async (e?: React.FormEvent, customFormData?: any) => {
        if (e) e.preventDefault()

        console.log('📝 CheckoutDigital handleSubmit called')
        console.log('📝 customFormData:', customFormData)
        console.log('📝 formData from state:', formData)

        if (isPreview || !onProcessPayment) return

        try {
            setProcessing(true)
            setPaymentError(null)
            setPaymentMessage(language === 'pt' ? 'Processando pagamento...' : 'Processing payment...')

            // Preparar informações dos order bumps selecionados
            const selectedOrderBumps = orderBumps.filter(bump => selectedBumps.has(bump.id))

            // Calcular total com juros caso parcelamento > 6x
            const totalWithInterest = installments > 6
                ? totalWithBumps * (1 + 0.025 * installments)
                : totalWithBumps

            // Usar customFormData se fornecido, caso contrário usar formData do estado
            const finalFormData = customFormData || formData

            console.log('📝 Final formData to be used:', finalFormData)

            const paymentData = {
                formData: finalFormData,
                selectedOrderBumps,
                totalAmount: parseFloat(totalWithInterest.toFixed(2)),
                installments,
            }

            const result = await onProcessPayment(paymentData)

            setPaymentSuccess(true)

            // Handle redirect/callback
            if (onPaymentSuccess) {
                setTimeout(async () => {
                    try {
                        const callbackResult = (result?.purchaseId && result?.thankyouToken)
                            ? result as { purchaseId: string; thankyouToken: string; redirectUrl?: string }
                            : null
                        await onPaymentSuccess(callbackResult)
                    } catch (e) {
                        console.error('Callback error:', e)
                        if (result.success) {
                            window.location.href = '/members-login'
                        }
                    }
                }, 150)
            } else if (result?.success) {
                setTimeout(() => {
                    window.location.href = '/members-login'
                }, 150)
            }
        } catch (error: any) {
            setPaymentError(error.message || t.paymentFailed)
            setPaymentMessage('')
        } finally {
            setProcessing(false)
        }
    }, [
        isPreview, onProcessPayment, orderBumps, selectedBumps, installments,
        totalWithBumps, formData, language, setProcessing, setPaymentSuccess,
        setPaymentError, setPaymentMessage, onPaymentSuccess, t.paymentFailed
    ])

    // Memoized privacy policy handlers
    const handlePrivacyClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        setShowPrivacyPolicy(true)
    }, [])

    const handlePrivacyClose = useCallback(() => {
        setShowPrivacyPolicy(false)
    }, [])

    // ═══════════════════════════════════════════════════════════════════
    // EAGER LOADING: Pré-aquecer Stripe Elements
    // ═══════════════════════════════════════════════════════════════════
    useEffect(() => {
        const promise = getStripePromise()
        if (promise) {
            promise.then(() => {
                console.log('Stripe Elements pré-carregado com sucesso')
            }).catch((err: unknown) => {
                console.warn('Falha no pré-carregamento do Stripe:', err)
            })
        }
    }, [])

    return (
        <div className="min-h-screen bg-gray-50 overflow-x-hidden" style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>
            <CheckoutHeader onBack={onBack} t={t} />

            {/* Timer Component */}
            <CheckoutTimer
                timerConfig={timerConfig}
                onTimerClick={onTimerClick}
                isPreview={isPreview}
                viewDevice={viewDevice}
                isDragging={isDragging}
                draggedComponentType={draggedComponentType || undefined}
                t={i18nT}
            />

            {/* Banner Component */}
            <CheckoutBanner
                customBanner={customBanner}
                bannerSelected={bannerSelected}
                isDragging={isDragging}
                draggedComponentType={draggedComponentType || undefined}
                onBannerClick={onBannerClick}
                onBannerAdjust={onBannerAdjust}
                onBannerRemove={onBannerRemove}
                onBannerResize={onBannerResize}
                onUpdateBannerWidth={onUpdateBannerWidth}
                onBannerUpload={onBannerUpload}
                onBannerFile={onBannerFile}
                onBannerImagePositionChange={onBannerImagePositionChange}
                onBannerImageScaleChange={onBannerImageScaleChange}
                isPreview={isPreview}
                t={i18nT}
            />

            {/* Main Content */}
            <div className={`w-full lg:max-w-7xl lg:mx-auto ${(timerConfig?.enabled || (customBanner && (customBanner.image || customBanner.title || customBanner.subtitle || customBanner.description)))
                ? 'mt-3 lg:mt-4'
                : 'mt-3 lg:mt-4'
                }`}>

                <ProductInfoHeader
                    customBanner={customBanner}
                    productName={productName}
                    productImage={productImage}
                    t={t}
                />

                <div className={`${isPreview && viewDevice === 'mobile' ? '' : 'lg:grid lg:grid-cols-5 lg:gap-8 lg:px-4'}`}>
                    {/* Form Section - 3 columns */}
                    <div className={`w-full ${isPreview && viewDevice === 'mobile' ? '' : 'lg:col-span-3'} ${isPreview && viewDevice === 'mobile' ? 'space-y-0' : 'space-y-0 lg:space-y-6'}`}>
                        <PaymentForm
                            formData={formData}
                            onFormDataChange={setFormData}
                            selectedPaymentMethods={selectedPaymentMethods}
                            defaultPaymentMethod={defaultPaymentMethod}
                            onSubmit={handleSubmit}
                            processing={paymentState.processing}
                            paymentSuccess={paymentState.success}
                            paymentError={paymentState.error}
                            totalAmount={totalWithBumps}
                            currency={productCurrency}
                            onInstallmentsChange={setInstallments}
                            isPreview={isPreview}
                            viewDevice={viewDevice}
                            onLeadCapture={onLeadCapture}
                            onPaymentMethodChange={setActivePaymentMethod}
                            t={t}
                            imageBlocks={imageBlocks}
                            isDragging={isDragging}
                            draggedComponentType={draggedComponentType || undefined}
                            onUpdateImageBlock={onUpdateImageBlock}
                            onDeleteImageBlock={onDeleteImageBlock}
                        />

                        <OrderBumpsList
                            orderBumps={orderBumps}
                            selectedBumps={selectedBumps}
                            toggleBump={toggleBump}
                            isPreview={isPreview}
                            viewDevice={viewDevice}
                            t={t}
                        />
                    </div>

                    {/* Order Summary Desktop - Right sidebar */}
                    <div className={`${isPreview && viewDevice === 'mobile' ? 'hidden' : 'hidden lg:block'} lg:col-span-2`}>
                        <OrderSummary
                            productName={productName}
                            productPrice={productPrice}
                            productCurrency={productCurrency}
                            productImage={productImage}
                            productDescription={productDescription}
                            orderBumps={orderBumps}
                            selectedBumps={selectedBumps}
                            totalWithBumps={totalWithBumps}
                            installments={installments}
                            paymentMethod={activePaymentMethod}
                            onSubmit={handleSubmit}
                            processing={paymentState.processing}
                            paymentSuccess={paymentState.success}
                            paymentError={paymentState.error}
                            isPreview={isPreview}
                            isMobile={false}
                            t={t}
                            buttonColor={buttonColor}
                            buttonText={buttonText}
                            imageBlocks={imageBlocks}
                            testimonials={testimonials}
                            testimonialsCarouselMode={testimonialsCarouselMode}
                            testimonialsHorizontalMode={testimonialsHorizontalMode}
                            isDragging={isDragging}
                            draggedComponentType={draggedComponentType || undefined}
                            onUpdateImageBlock={onUpdateImageBlock}
                            onDeleteImageBlock={onDeleteImageBlock}
                            onTestimonialsClick={onTestimonialsClick}
                        />
                    </div>
                </div>

                {/* Order Summary Mobile - After form */}
                <div className={`${isPreview && viewDevice === 'mobile' ? 'block' : 'lg:hidden'}`}>
                    <OrderSummary
                        productName={productName}
                        productPrice={productPrice}
                        productCurrency={productCurrency}
                        productImage={productImage}
                        productDescription={productDescription}
                        orderBumps={orderBumps}
                        selectedBumps={selectedBumps}
                        totalWithBumps={totalWithBumps}
                        installments={installments}
                        paymentMethod={activePaymentMethod}
                        onSubmit={handleSubmit}
                        processing={paymentState.processing}
                        paymentSuccess={paymentState.success}
                        paymentError={paymentState.error}
                        isPreview={isPreview}
                        isMobile={true}
                        t={t}
                        buttonColor={buttonColor}
                        buttonText={buttonText}
                        imageBlocks={imageBlocks}
                        testimonials={testimonials}
                        testimonialsCarouselMode={testimonialsCarouselMode}
                        testimonialsHorizontalMode={testimonialsHorizontalMode}
                        isDragging={isDragging}
                        draggedComponentType={draggedComponentType || undefined}
                        onUpdateImageBlock={onUpdateImageBlock}
                        onDeleteImageBlock={onDeleteImageBlock}
                        onTestimonialsClick={onTestimonialsClick}
                    />
                </div>

                {/* Mollie Alternative Payment Methods */}
                {!isPreview && mollieEnabledMethods && mollieEnabledMethods.length > 0 && (
                    <div className="w-full mt-4 px-4 lg:px-0">
                        <div className="relative flex items-center gap-3 my-4">
                            <div className="flex-1 h-px bg-gray-200 dark:bg-white/[0.07]" />
                            <span className="text-xs text-gray-400 px-2 whitespace-nowrap">{language === 'pt' ? 'Ou pague com' : language === 'es' ? 'O paga con' : language === 'fr' ? 'Ou payez avec' : language === 'de' ? 'Oder zahlen mit' : 'Or pay with'}</span>
                            <div className="flex-1 h-px bg-gray-200 dark:bg-white/[0.07]" />
                        </div>
                        <div className="flex flex-wrap gap-2 justify-center">
                            {mollieEnabledMethods.map(method => (
                                <button
                                    key={method.id}
                                    disabled={paymentState.processing || paymentState.success}
                                    onClick={() => {
                                        if (!formData.email || !formData.name) {
                                            setPaymentError(language === 'pt' ? 'Preencha seu nome e e-mail antes de continuar.' : 'Please fill in your name and email first.')
                                            return
                                        }
                                        handleSubmit(undefined, { ...formData, paymentMethod: `mollie_${method.id}` })
                                    }}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/[0.08] border border-gray-200 dark:border-white/[0.1] rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 transition-all disabled:opacity-50 shadow-sm"
                                >
                                    {method.icon_url
                                        ? <img src={method.icon_url} alt={method.label} className="h-5 w-auto object-contain" />
                                        : <span className="text-base">💳</span>
                                    }
                                    <span>{method.label || method.description}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Testimonials + Seals + Footer — lazy loaded (below the fold) */}
            <React.Suspense fallback={null}>
                {/* Testimonials */}
                <div className="w-full lg:max-w-7xl lg:mx-auto">
                    {/* Image block: above testimonials */}
                    <ImageDropZone slot="above_testimonials" isPreview={isPreview} isDragging={isDragging} draggedComponentType={draggedComponentType || undefined} />
                    <CheckoutImageDisplay imageBlocks={imageBlocks} slot="above_testimonials" isPreview={isPreview} onPreviewClick={isPreview ? onImageBlockClick : undefined} onUpdateImageBlock={onUpdateImageBlock} onDeleteImageBlock={isPreview ? onDeleteImageBlock : undefined} />
                    <TestimonialsSection
                        testimonials={testimonials}
                        isPreview={isPreview}
                        onClick={isPreview && onTestimonialsClick ? (id) => onTestimonialsClick(id) : undefined}
                        imageBlocks={imageBlocks}
                        onPreviewAdd={isPreview && onTestimonialsClick ? () => onTestimonialsClick(undefined) : undefined}
                        isDragging={isDragging}
                        draggedComponentType={draggedComponentType || undefined}
                        onUpdateImageBlock={onUpdateImageBlock}
                        onDeleteImageBlock={isPreview ? onDeleteImageBlock : undefined}
                    />
                    {/* Image block: below testimonials */}
                    <ImageDropZone slot="below_testimonials" isPreview={isPreview} isDragging={isDragging} draggedComponentType={draggedComponentType || undefined} />
                    <CheckoutImageDisplay imageBlocks={imageBlocks} slot="below_testimonials" isPreview={isPreview} onPreviewClick={isPreview ? onImageBlockClick : undefined} onUpdateImageBlock={onUpdateImageBlock} onDeleteImageBlock={isPreview ? onDeleteImageBlock : undefined} />
                </div>

                {/* Image block: below seals */}
                <ImageDropZone slot="below_seals" isPreview={isPreview} isDragging={isDragging} draggedComponentType={draggedComponentType || undefined} />
                <CheckoutImageDisplay imageBlocks={imageBlocks} slot="below_seals" className="w-full lg:max-w-7xl lg:mx-auto" isPreview={isPreview} onPreviewClick={isPreview ? onImageBlockClick : undefined} onUpdateImageBlock={onUpdateImageBlock} onDeleteImageBlock={isPreview ? onDeleteImageBlock : undefined} />

                <CheckoutFooter t={t} onPrivacyClick={handlePrivacyClick} />

                {/* Privacy Policy Modal */}
                <Modal
                    isOpen={showPrivacyPolicy}
                    onClose={handlePrivacyClose}
                    title={t.privacyPolicy}
                >
                    <PrivacyPolicyContent t={t} onClose={handlePrivacyClose} />
                </Modal>
            </React.Suspense>
        </div>
    )
}

// ✅ OTIMIZAÇÃO: Só carregar Stripe Elements quando necessário
function CheckoutDigitalWithStripe(props: CheckoutDigitalProps) {
    // Se for preview, tenta envolver com Elements para que os campos de cartão funcionem no builder
    if (props.isPreview) {
        const stripe = getStripePromise()
        if (stripe) {
            return (
                <Elements stripe={stripe}>
                    <CheckoutDigital {...props} />
                </Elements>
            )
        }
        return <CheckoutDigital {...props} />
    }

    const stripe = getStripePromise()
    if (!stripe) {
        // Stripe não configurado: renderiza o checkout sem suporte a cartão de crédito
        // Isso evita tela em branco — o usuário pode pelo menos ver o erro no console
        console.error('❌ Stripe não inicializado. Verifique a variável VITE_STRIPE_PUBLIC_KEY.')
        const t = getTranslations(props.language || 'en')
        const onlyPaypal = props.selectedPaymentMethods?.includes('paypal') &&
            !props.selectedPaymentMethods?.includes('credit_card')
        if (onlyPaypal) {
            // Se só PayPal, renderiza sem Stripe
            return <CheckoutDigital {...props} />
        }
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-sm border border-red-100 p-8 max-w-md w-full text-center">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                    </div>
                    <h2 className="text-lg font-semibold text-gray-800 mb-2">{t.paymentSystemNotAvailable}</h2>
                    <p className="text-sm text-gray-500">Por favor, tente novamente mais tarde ou entre em contato com o suporte.</p>
                </div>
            </div>
        )
    }

    return (
        <Elements stripe={stripe}>
            <CheckoutDigitalForm {...props} />
        </Elements>
    )
}

// Form interno com acesso ao Stripe
function CheckoutDigitalForm(props: CheckoutDigitalProps) {
    const stripe = useStripe()
    const elements = useElements()
    const navigate = useNavigate()
    const paymentResultRef = useRef<{ purchaseId: string; thankyouToken: string } | null>(null)

    const handlePayment = useCallback(async (paymentData: PaymentData) => {
        const { formData } = paymentData

        console.log('🔍 handlePayment called with formData:', formData)
        console.log('🔍 Payment method:', formData.paymentMethod)

        if (props.isPreview) {
            return { success: false }
        }

        try {
            let paymentMethodId: string | undefined
            let paymentMethod: string = formData.paymentMethod || 'credit_card'

            console.log('🔍 Final payment method:', paymentMethod)

            // Processar apenas se for cartão de crédito
            if (paymentMethod === 'credit_card') {
                console.log('🔍 Processing credit card payment...')
                if (!stripe || !elements) {
                    throw new Error('Stripe not initialized')
                }

                const cardElement = elements.getElement(CardNumberElement)
                if (!cardElement) {
                    console.error('❌ Card element not found')
                    throw new Error('Card element not found')
                }

                const { error: pmError, paymentMethod: stripePaymentMethod } = await stripe.createPaymentMethod({
                    type: 'card',
                    card: cardElement,
                    billing_details: {
                        name: formData.name,
                        email: formData.email,
                        phone: formData.phone,
                    },
                })

                if (pmError) {
                    console.error('❌ Payment method error:', pmError.message)
                    throw new Error(pmError.message)
                }

                paymentMethodId = stripePaymentMethod.id
            } else {
                console.log('🔍 Processing PayPal payment...')
            }

            // Mapear paymentMethod para paymentProvider que o backend espera
            const paymentProvider = paymentMethod === 'credit_card' ? 'stripe' : 'paypal'

            const requestBody = {
                productId: props.productId,
                productType: props.productType,
                applicationId: props.applicationId,
                checkoutId: props.checkoutId,
                customerEmail: formData.email,
                customerName: formData.name,
                customerPhone: formData.phone,
                paymentMethodId: paymentMethodId,
                paymentProvider: paymentProvider, // 'stripe' ou 'paypal'
                selectedOrderBumps: paymentData.selectedOrderBumps,
                totalAmount: paymentData.totalAmount,
                installments: paymentData.installments ?? 1,
                sessionId: props.sessionId || undefined,
                trackingParameters: props.trackingParameters || undefined,
            }

            const response = await fetch('https://api.clicknich.com/api/process-payment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            })

            const result = await response.json()

            // Checar redirecionamento PayPal ANTES do check de success
            // (backend retorna success:false + requiresApproval:true para o redirect flow)
            if (result.requiresApproval && result.approvalUrl) {
                console.log('🔵 PayPal redirect required:', result.approvalUrl)
                window.location.href = result.approvalUrl
                // Retornar pending para não mostrar erro enquanto redireciona
                return { success: false }
            }

            if (!result.success) {
                console.error('❌ Payment failed:', result.error)
                throw new Error(result.error || 'Payment failed')
            }

            paymentResultRef.current = {
                purchaseId: result.purchaseId,
                thankyouToken: result.thankyouToken
            }

            return {
                success: true,
                purchaseId: result.purchaseId,
                thankyouToken: result.thankyouToken
            }
        } catch (error: any) {
            console.error('💥 Payment error:', error)
            throw error
        }
    }, [stripe, elements, props.isPreview, props.productId, props.productType, props.applicationId, props.checkoutId, props.sessionId, props.trackingParameters])

    const handlePaymentSuccess = useCallback(async (result?: { purchaseId: string; thankyouToken: string } | null) => {
        const finalResult = result || paymentResultRef.current
        if (props.onPaymentSuccess && finalResult) {
            await props.onPaymentSuccess(finalResult)
        }
    }, [props.onPaymentSuccess])

    return <CheckoutDigital {...props} onProcessPayment={handlePayment} onPaymentSuccess={handlePaymentSuccess} />
}

export default CheckoutDigitalWithStripe