import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { loadStripe } from '@stripe/stripe-js'

// ✅ OTIMIZAÇÃO: Singleton exportado — permite preload antes do componente montar
let stripePromise: any = null
export const getStripePromise = () => {
    if (!stripePromise && import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
        stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY as string)
    }
    return stripePromise
}

import { Elements, CardNumberElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { useNavigate } from 'react-router-dom'
import { getTranslations, CheckoutLanguage } from './translations'
import { useI18n } from '@/i18n'

// Import optimized components and hooks
import { useOrderBumps } from './useOrderBumps'
import { useOrderBumpsOptimized } from './hooks/useOrderBumpsOptimized'
import { useCheckoutState } from './hooks/useCheckoutState'
import { usePaymentProcessing } from './hooks/usePaymentProcessing'
import CheckoutHeader from './components/CheckoutHeader'
import CheckoutTimer from './components/CheckoutTimer'
import CheckoutBanner from './components/CheckoutBanner'
import CheckoutMainContent from './components/CheckoutMainContent'
import CheckoutFooter from './components/CheckoutFooter'
import ProductInfoHeader from './components/ProductInfoHeader'
import OrderBumpsList from './components/OrderBumpsList'
import { PaymentForm } from './PaymentForm'
import { OrderSummary } from './OrderSummary'
import Modal from './components/Modal'
import PrivacyPolicyContent from './components/PrivacyPolicyContent'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { OrderBumpCard } from './OrderBumpCard'
import type { CheckoutDigitalProps, PaymentData, CustomBanner } from './types'

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
    initialOrderBumps,
    initialAppProducts,
    sessionId,
    trackingParameters
}: CheckoutDigitalProps) {
    const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false)

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

    const { processPayment } = usePaymentProcessing({
        productId,
        productType,
        applicationId,
        checkoutId,
        sessionId,
        trackingParameters,
        isPreview,
        language,
        onProcessingChange: setProcessing,
        onMessageChange: setPaymentMessage,
        onErrorChange: setPaymentError
    })

    // Use custom hook for order bumps
    // ✅ OTIMIZAÇÃO: Só usar hooks pesados quando necessário
    const shouldLoadData = !isPreview && (checkoutId || productId)

    // ✅ OTIMIZAÇÃO: Hook otimizado com cache e RPC
    const {
        orderBumps,
        selectedBumps,
        toggleBump,
        calculateBumpsTotal,
        loading: orderBumpsLoading
    } = useOrderBumpsOptimized(
        shouldLoadData ? checkoutId : undefined,
        shouldLoadData ? productId : undefined,
        initialOrderBumps
    )

    // Calcular total incluindo order bumps - memoized
    const totalWithBumps = useMemo(() => {
        return productPrice + calculateBumpsTotal()
    }, [productPrice, calculateBumpsTotal])

    // Memoized submit handler
    const handleSubmit = useCallback(async (e?: React.FormEvent) => {
        if (e) e.preventDefault()

        if (isPreview || !onProcessPayment) return

        try {
            // Preparar informações dos order bumps selecionados
            const selectedOrderBumps = orderBumps.filter(bump => selectedBumps.has(bump.id))

            // Calcular total com juros caso parcelamento > 6x
            const totalWithInterest = installments > 6
                ? totalWithBumps * (1 + 0.025 * installments)
                : totalWithBumps

            const paymentData = {
                formData,
                selectedOrderBumps,
                totalAmount: parseFloat(totalWithInterest.toFixed(2)),
                installments,
            }

            const result = await processPayment(paymentData)

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
                        // Fallback redirect if success callback fails
                        if (result.success) {
                            window.location.href = '/members-login'
                        }
                    }
                }, 150)
            } else if (result?.success) {
                const redirectUrl = '/members-login'
                setTimeout(() => {
                    window.location.href = redirectUrl
                }, 150)
            }
        } catch (error: any) {
            setPaymentError(error.message || t.paymentFailed)
            setPaymentMessage('')
        }
    }, [
        isPreview, onProcessPayment, orderBumps, selectedBumps, installments,
        totalWithBumps, formData, processPayment, setPaymentSuccess,
        onPaymentSuccess, setPaymentError, setPaymentMessage, t.paymentFailed
    ])

    // Memoized privacy policy handlers
    const handlePrivacyClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        setShowPrivacyPolicy(true)
    }, [])

    const handlePrivacyClose = useCallback(() => {
        setShowPrivacyPolicy(false)
    }, [])

    // ✅ OTIMIZAÇÃO: Memoizar componentes pesados
    const PaymentFormComponent = useMemo(() => {
        if (isPreview) return null
        return (
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
                onLeadCapture={onLeadCapture}
                t={t}
            />
        )
    }, [isPreview, formData, selectedPaymentMethods, defaultPaymentMethod, handleSubmit, paymentState, totalWithBumps, productCurrency, installments, onLeadCapture, t])

    const OrderSummaryComponent = useMemo(() => {
        if (isPreview) return null
        return (
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
                onSubmit={handleSubmit}
                processing={paymentState.processing}
                paymentSuccess={paymentState.success}
                paymentError={paymentState.error}
                isPreview={isPreview}
                isMobile={false}
                t={t}
                buttonColor={buttonColor}
            />
        )
    }, [isPreview, productName, productPrice, productCurrency, productImage, productDescription, orderBumps, selectedBumps, totalWithBumps, installments, handleSubmit, paymentState, buttonColor, t])

    // ═══════════════════════════════════════════════════════════════════
    // EAGER LOADING: Pré-aquecer Stripe Elements
    // ═══════════════════════════════════════════════════════════════════
    useEffect(() => {
        if (stripePromise) {
            stripePromise.then(() => {
                console.log('Stripe Elements pré-carregado com sucesso')
            }).catch(err => {
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
                onBannerRemove={onBannerRemove}
                onBannerImagePositionChange={onBannerImagePositionChange}
                onBannerImageScaleChange={onBannerImageScaleChange}
                isPreview={isPreview}
                t={i18nT}
            />

            {/* Main Content */}
            <div className={`w-full lg:max-w-7xl lg:mx-auto ${(timerConfig?.enabled || (customBanner && (customBanner.image || customBanner.title || customBanner.subtitle || customBanner.description)))
                ? 'mt-6 lg:mt-8'
                : 'mt-6 lg:mt-8'
                }`}>

                <ProductInfoHeader
                    customBanner={customBanner}
                    productName={productName}
                    t={t}
                />

                <div className={`${isPreview && viewDevice === 'mobile' ? '' : 'lg:grid lg:grid-cols-5 lg:gap-8 lg:px-4'}`}>
                    {/* Form Section - 3 columns */}
                    <div className={`w-full ${isPreview && viewDevice === 'mobile' ? '' : 'lg:col-span-3'} ${isPreview && viewDevice === 'mobile' ? 'space-y-0' : 'space-y-0 lg:space-y-6'}`}>
                        {/* ✅ PREVIEW: Mostrar placeholder */}
                        {isPreview ? (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mx-3 lg:mx-0">
                                <div className="text-center py-8 space-y-4">
                                    <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto flex items-center justify-center">
                                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-lg font-medium text-gray-900">Formulário de Pagamento</h3>
                                    <p className="text-sm text-gray-500">Preview do formulário de checkout</p>
                                </div>
                            </div>
                        ) : (
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
                                onLeadCapture={onLeadCapture}
                                t={t}
                            />
                        )}

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
                        {/* ✅ PREVIEW: Mostrar placeholder */}
                        {isPreview ? (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                                <div className="text-center py-8 space-y-4">
                                    <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto flex items-center justify-center">
                                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                        </svg>
                                    </div>
                                    <h3 className="text-lg font-medium text-gray-900">Resumo do Pedido</h3>
                                    <p className="text-sm text-gray-500">Preview do resumo de compra</p>
                                </div>
                            </div>
                        ) : (
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
                                onSubmit={handleSubmit}
                                processing={paymentState.processing}
                                paymentSuccess={paymentState.success}
                                paymentError={paymentState.error}
                                isPreview={isPreview}
                                isMobile={false}
                                t={t}
                                buttonColor={buttonColor}
                            />
                        )}
                    </div>
                </div>

                {/* Order Summary Mobile - After form */}
                <div className={`${isPreview && viewDevice === 'mobile' ? 'block' : 'lg:hidden'}`}>
                    {isPreview ? (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mx-3">
                            <div className="text-center py-8 space-y-4">
                                <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto flex items-center justify-center">
                                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-medium text-gray-900">Resumo do Pedido</h3>
                                <p className="text-sm text-gray-500">Preview mobile do resumo</p>
                            </div>
                        </div>
                    ) : (
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
                            onSubmit={handleSubmit}
                            processing={paymentState.processing}
                            paymentSuccess={paymentState.success}
                            paymentError={paymentState.error}
                            isPreview={isPreview}
                            isMobile={true}
                            t={t}
                            buttonColor={buttonColor}
                        />
                    )}
                </div>
            </div>

            <CheckoutFooter t={t} onPrivacyClick={handlePrivacyClick} />

            {/* Privacy Policy Modal */}
            <Modal
                isOpen={showPrivacyPolicy}
                onClose={handlePrivacyClose}
                title={t.privacyPolicy}
            >
                <PrivacyPolicyContent t={t} onClose={handlePrivacyClose} />
            </Modal>
        </div>
    )
}

// ✅ OTIMIZAÇÃO: Só carregar Stripe Elements quando necessário
function CheckoutDigitalWithStripe(props: CheckoutDigitalProps) {
    // Se for preview, renderizar direto sem Stripe
    if (props.isPreview) {
        return <CheckoutDigital {...props} />
    }

    const stripe = getStripePromise()
    if (!stripe) {
        const t = getTranslations(props.language || 'en')
        return <div>{t.paymentSystemNotAvailable}</div>
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

        if (!stripe || !elements || props.isPreview) {
            return { success: false }
        }

        try {
            const cardElement = elements.getElement(CardNumberElement)
            if (!cardElement) {
                console.error('❌ Card element not found')
                throw new Error('Card element not found')
            }

            const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
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

            const requestBody = {
                productId: props.productId,
                productType: props.productType,
                applicationId: props.applicationId,
                checkoutId: props.checkoutId,
                customerEmail: formData.email,
                customerName: formData.name,
                customerPhone: formData.phone,
                paymentMethodId: paymentMethod.id,
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