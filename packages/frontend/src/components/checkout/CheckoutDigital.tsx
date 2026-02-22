import React, { useState, useRef, useEffect } from 'react'
import { ArrowLeft, Clock, ImageIcon, GripHorizontal, X, ShieldCheck, Crop, Minus, Plus, Maximize2 } from 'lucide-react'
import { loadStripe } from '@stripe/stripe-js'

// Inicializar Stripe a nível de módulo (fora do componente) para evitar recarregamento
const stripePromise = import.meta.env.VITE_STRIPE_PUBLIC_KEY
    ? loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY as string)
    : null
import { Elements, CardNumberElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { useNavigate } from 'react-router-dom'
import { getTranslations, CheckoutLanguage } from './translations'
import { useI18n } from '@/i18n'

// Import new modular components
import { TimerComponent } from './Timer'
import { PaymentForm } from './PaymentForm'
import { OrderSummary } from './OrderSummary'
import { OrderBumpCard } from './OrderBumpCard'
import { useOrderBumps } from './useOrderBumps'
import { SUPABASE_URL, SUPABASE_ANON_KEY, formatPrice, isValidEmail } from './utils'
import type { CheckoutDigitalProps, FormData, PaymentData, CustomBanner } from './types'

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
    buttonColor = '#111827'
}: CheckoutDigitalProps) {
    const [isResizing, setIsResizing] = useState(false)
    const [showHeightToolbar, setShowHeightToolbar] = useState(false)
    const [heightInputValue, setHeightInputValue] = useState('')
    const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false)
    const [processing, setProcessing] = useState(false)
    const [paymentSuccess, setPaymentSuccess] = useState(false)
    const [paymentError, setPaymentError] = useState<string | null>(null)
    const [installments, setInstallments] = useState(1)
    const [formData, setFormData] = useState<FormData>({
        name: '',
        email: '',
        phone: '',
    })

    const bannerRef = useRef<HTMLDivElement>(null)
    const startYRef = useRef<number>(0)
    const startHeightRef = useRef<number>(0)

    const t = getTranslations(language)
    const { t: i18nT } = useI18n()

    // Use custom hook for order bumps
    const {
        orderBumps,
        selectedBumps,
        toggleBump,
        calculateBumpsTotal
    } = useOrderBumps(checkoutId, productId)

    // Calcular total incluindo order bumps
    const totalWithBumps = productPrice + calculateBumpsTotal()

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault()

        if (isPreview || !onProcessPayment) return

        // Validação
        if (!formData.name || !formData.email) {
            setPaymentError(t.fillRequiredFields)
            return
        }

        if (!isValidEmail(formData.email)) {
            setPaymentError(t.invalidEmail)
            return
        }

        setProcessing(true)
        setPaymentError(null)

        try {
            // Preparar informações dos order bumps selecionados
            const selectedOrderBumps = orderBumps.filter(bump => selectedBumps.has(bump.id))

            const paymentData = {
                formData,
                selectedOrderBumps,
                totalAmount: totalWithBumps
            }

            const result = await onProcessPayment(paymentData)

            setPaymentSuccess(true)

            // Se há callback onPaymentSuccess, usar ele (permite redirecionamento customizado)
            if (onPaymentSuccess) {

                setTimeout(async () => {
                    try {
                        await onPaymentSuccess(result)
                    } catch (e) {
                        console.error('Callback error:', e)
                        // Fallback to thankyou if callback fails
                        if (result?.purchaseId && result?.thankyouToken) {
                            window.location.href = `/thankyou/${result.purchaseId}?token=${result.thankyouToken}`
                        }
                    }
                }, 2000)
            } else if (result?.success && result?.purchaseId && result?.thankyouToken) {
                // Fallback: redirecionar para thank you page padrão
                const redirectUrl = `/thankyou/${result.purchaseId}?token=${result.thankyouToken}`


                setTimeout(() => {
                    window.location.href = redirectUrl
                }, 2000)
            }
        } catch (error: any) {
            setPaymentError(error.message || t.paymentFailed)
        } finally {
            setProcessing(false)
        }
    }

    // Handlers para redimensionamento do banner
    const handleResizeStart = (e: React.MouseEvent) => {
        if (!onBannerResize) return
        e.preventDefault()
        e.stopPropagation()
        setIsResizing(true)
        startYRef.current = e.clientY
        const currentHeight = bannerRef.current?.offsetHeight || 300
        startHeightRef.current = currentHeight

        document.body.style.userSelect = 'none'
        document.body.style.cursor = 'ns-resize'
    }

    useEffect(() => {
        if (!isResizing) return

        const handleMouseMove = (e: MouseEvent) => {
            if (!onBannerResize) return
            e.preventDefault()
            const deltaY = e.clientY - startYRef.current
            const newHeight = Math.max(100, Math.min(600, startHeightRef.current + deltaY))
            onBannerResize(newHeight)
        }

        const handleMouseUp = () => {
            setIsResizing(false)
            document.body.style.userSelect = ''
            document.body.style.cursor = ''
        }

        document.addEventListener('mousemove', handleMouseMove, { passive: false })
        document.addEventListener('mouseup', handleMouseUp)

        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }
    }, [isResizing, onBannerResize])

    return (
        <div className="min-h-screen bg-gray-50 overflow-x-hidden" style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>
            {/* Header */}
            <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 py-3">
                    <div className="flex items-center justify-between">
                        {onBack && (
                            <button
                                onClick={onBack}
                                className="flex items-center gap-2 text-gray-400 hover:text-gray-600 transition-colors text-sm"
                            >
                                <ArrowLeft size={16} />
                                <span className="hidden sm:inline">{t.back}</span>
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* Timer Section */}
            {timerConfig?.enabled ? (
                <div className="w-full lg:max-w-7xl lg:mx-auto lg:px-4 mt-3 lg:mt-4">
                    <div className="lg:rounded-lg overflow-hidden shadow-lg border border-slate-200">
                        <TimerComponent
                            config={timerConfig}
                            onClick={onTimerClick}
                            isPreview={isPreview}
                        />
                    </div>
                </div>
            ) : isPreview && isDragging && draggedComponentType === 'timer' ? (
                <div
                    className="w-full lg:max-w-7xl lg:mx-auto lg:px-4 mt-3 lg:mt-4"
                    data-drop-zone="timer"
                >
                    <div className="min-h-[60px] border border-dashed border-blue-500 bg-blue-500/10 rounded-lg flex items-center justify-center transition-all">
                        <div className="text-center text-gray-500">
                            <Clock size={24} className="mx-auto mb-2 opacity-50" />
                            <p className="text-sm">{i18nT('checkout_pages.drop_here_timer')}</p>
                        </div>
                    </div>
                </div>
            ) : null}

            {/* Banner Drop Zone */}
            {isPreview && isDragging && draggedComponentType === 'image' && (!customBanner || (!customBanner.image && !customBanner.title && !customBanner.subtitle && !customBanner.description)) && (
                <div
                    className="w-full lg:max-w-7xl lg:mx-auto px-4 lg:px-4 mt-6 lg:mt-8"
                    data-drop-zone="banner"
                >
                    <div className="min-h-[200px] border border-dashed border-blue-500 bg-blue-500/10 rounded-lg flex items-center justify-center transition-all">
                        <div className="text-center text-gray-500">
                            <ImageIcon size={32} className="mx-auto mb-2 opacity-50" />
                            <p className="text-sm font-medium">{i18nT('checkout_pages.drop_here_banner')}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Banner */}
            {customBanner && customBanner.image && (
                <div className="w-full lg:max-w-7xl lg:mx-auto px-4 lg:px-4 mt-6 lg:mt-8">
                    <div
                        ref={bannerRef}
                        className={`relative rounded-lg overflow-hidden bg-white ${isResizing ? '' : 'transition-all duration-200'} ${onBannerClick ? 'cursor-pointer' : ''
                            } ${bannerSelected ? 'ring-4 ring-teal-400 ring-offset-2' : ''} ${isDragging ? 'ring-4 ring-teal-400 ring-opacity-75 bg-blue-500/10' : ''
                            }`}
                        onClick={onBannerClick}
                        style={{
                            height: (viewDevice === 'mobile' || (!isPreview && window.innerWidth < 1024)) ? (window.innerWidth < 380 ? '140px' : '180px') : `${customBanner.customHeight || 250}px`,
                            backgroundColor: '#ffffff'
                        }}
                    >
                        <div className="relative w-full h-full" style={{ backgroundColor: '#ffffff' }}>
                            <img
                                src={customBanner.image}
                                alt="Banner"
                                className="w-full h-full object-contain"
                            />

                            {/* Banner Action Buttons */}
                            {bannerSelected && (
                                <div className="absolute top-3 right-3 flex items-center gap-2" style={{ zIndex: 50 }}>
                                    {onBannerAdjust && (
                                        <button
                                            className="px-3 py-1.5 bg-blue-500 text-white text-xs font-semibold rounded-lg hover:bg-blue-600 transition-colors shadow-lg shadow-black/20 flex items-center gap-1.5"
                                            onClick={(e) => {
                                                e.preventDefault()
                                                e.stopPropagation()
                                                onBannerAdjust()
                                            }}
                                        >
                                            <Crop size={14} />
                                            {i18nT('checkout_pages.adjust')}
                                        </button>
                                    )}
                                    {onBannerRemove && (
                                        <button
                                            className="w-7 h-7 flex items-center justify-center bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-lg shadow-black/20"
                                            onClick={(e) => {
                                                e.preventDefault()
                                                e.stopPropagation()
                                                onBannerRemove()
                                            }}
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Height Configuration Toolbar */}
                            {bannerSelected && onBannerResize && (
                                <div
                                    className="absolute bottom-0 left-0 right-0 flex flex-col"
                                    style={{ zIndex: 50 }}
                                    onClick={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                    }}
                                >
                                    {/* Height Controls Bar */}
                                    <div className="bg-gray-900/95 backdrop-blur-sm border-t border-white/10 px-3 py-2 flex items-center justify-between gap-2">
                                        {/* Preset Sizes */}
                                        <div className="flex items-center gap-1">
                                            {[
                                                { label: 'P', value: 150 },
                                                { label: 'M', value: 250 },
                                                { label: 'G', value: 350 },
                                                { label: 'GG', value: 500 },
                                            ].map((preset) => (
                                                <button
                                                    key={preset.label}
                                                    className={`px-2.5 py-1 text-xs font-bold rounded transition-all ${Math.abs((customBanner?.customHeight || 250) - preset.value) < 25
                                                        ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                                                        : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                                                        }`}
                                                    onClick={(e) => {
                                                        e.preventDefault()
                                                        e.stopPropagation()
                                                        onBannerResize(preset.value)
                                                    }}
                                                >
                                                    {preset.label}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Fine Controls: -/+ and Input */}
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                className="w-7 h-7 flex items-center justify-center rounded bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-colors"
                                                onClick={(e) => {
                                                    e.preventDefault()
                                                    e.stopPropagation()
                                                    const current = customBanner?.customHeight || 250
                                                    onBannerResize(Math.max(80, current - 10))
                                                }}
                                            >
                                                <Minus size={14} />
                                            </button>

                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    className="w-16 h-7 text-center text-xs font-mono font-bold bg-white/10 border border-white/20 rounded text-white focus:outline-none focus:border-blue-400 focus:bg-white/15"
                                                    value={heightInputValue || Math.round(customBanner?.customHeight || 250)}
                                                    onChange={(e) => {
                                                        const val = e.target.value.replace(/[^0-9]/g, '')
                                                        setHeightInputValue(val)
                                                    }}
                                                    onFocus={() => {
                                                        setHeightInputValue(String(Math.round(customBanner?.customHeight || 250)))
                                                    }}
                                                    onBlur={() => {
                                                        const num = parseInt(heightInputValue)
                                                        if (!isNaN(num) && num >= 80 && num <= 800) {
                                                            onBannerResize(num)
                                                        }
                                                        setHeightInputValue('')
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            const num = parseInt(heightInputValue)
                                                            if (!isNaN(num) && num >= 80 && num <= 800) {
                                                                onBannerResize(num)
                                                            }
                                                            setHeightInputValue('')
                                                                ; (e.target as HTMLInputElement).blur()
                                                        }
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-white/40 pointer-events-none">px</span>
                                            </div>

                                            <button
                                                className="w-7 h-7 flex items-center justify-center rounded bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-colors"
                                                onClick={(e) => {
                                                    e.preventDefault()
                                                    e.stopPropagation()
                                                    const current = customBanner?.customHeight || 250
                                                    onBannerResize(Math.min(800, current + 10))
                                                }}
                                            >
                                                <Plus size={14} />
                                            </button>
                                        </div>

                                        {/* Drag Resize Handle */}
                                        <div
                                            className="flex items-center gap-1 px-2 py-1 rounded bg-white/10 hover:bg-white/20 cursor-ns-resize transition-colors group"
                                            onMouseDown={handleResizeStart}
                                        >
                                            <GripHorizontal size={16} className="text-white/60 group-hover:text-white" />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Drag Overlay */}
                        {isDragging && (
                            <div className="absolute inset-0 bg-blue-500/100 bg-opacity-20 flex items-center justify-center z-50 pointer-events-none">
                                <div className="bg-blue-500 text-white px-6 py-3 rounded-lg shadow-xl shadow-black/10">
                                    <p className="text-sm font-medium">{i18nT('checkout_pages.drop_here_image')}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className={`w-full lg:max-w-7xl lg:mx-auto ${(timerConfig?.enabled || (customBanner && (customBanner.image || customBanner.title || customBanner.subtitle || customBanner.description)))
                ? 'mt-6 lg:mt-8'
                : 'mt-6 lg:mt-8'
                }`}>
                {/* Product Info Header */}
                {customBanner && (customBanner.image || customBanner.title || customBanner.subtitle || customBanner.description) && (
                    <div className="bg-white lg:rounded-xl shadow-sm lg:border border-gray-100 px-4 py-3 lg:mx-4 mb-0 lg:mb-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-gray-100 p-2 rounded-lg flex-shrink-0">
                                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] text-gray-400">{t.youArePurchasing}</p>
                                <h3 className="text-[13px] font-medium text-gray-900 truncate">{productName}</h3>
                            </div>
                        </div>
                    </div>
                )}

                <div className={`${isPreview && viewDevice === 'mobile' ? '' : 'lg:grid lg:grid-cols-5 lg:gap-8 lg:px-4'}`}>
                    {/* Form Section - 3 columns */}
                    <div className={`w-full ${isPreview && viewDevice === 'mobile' ? '' : 'lg:col-span-3'} ${isPreview && viewDevice === 'mobile' ? 'space-y-0' : 'space-y-0 lg:space-y-6'}`}>
                        <PaymentForm
                            formData={formData}
                            onFormDataChange={setFormData}
                            selectedPaymentMethods={selectedPaymentMethods}
                            defaultPaymentMethod={defaultPaymentMethod}
                            onSubmit={handleSubmit}
                            processing={processing}
                            paymentSuccess={paymentSuccess}
                            paymentError={paymentError}
                            totalAmount={totalWithBumps}
                            currency={productCurrency}
                            onInstallmentsChange={setInstallments}
                            isPreview={isPreview}
                            onLeadCapture={onLeadCapture}
                            t={t}
                        />

                        {/* Order Bumps */}
                        {orderBumps.length > 0 && (
                            <div className={`${isPreview && viewDevice === 'mobile' ? 'px-3 py-3' : 'px-3 py-3 sm:px-4 sm:py-4 lg:px-0 lg:py-0'}`}>
                                <div className="mb-2 sm:mb-3">
                                    <h3 className="text-xs sm:text-sm font-bold text-gray-900">
                                        {t.limitedOffers}
                                    </h3>
                                </div>
                                <div className="space-y-2 sm:space-y-3">
                                    {orderBumps.map((bump) => (
                                        <OrderBumpCard
                                            key={bump.id}
                                            bump={bump}
                                            isSelected={selectedBumps.has(bump.id)}
                                            onToggle={toggleBump}
                                            t={t}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
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
                            onSubmit={handleSubmit}
                            processing={processing}
                            paymentSuccess={paymentSuccess}
                            paymentError={paymentError}
                            isPreview={isPreview}
                            isMobile={false}
                            t={t}
                            buttonColor={buttonColor}
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
                        onSubmit={handleSubmit}
                        processing={processing}
                        paymentSuccess={paymentSuccess}
                        paymentError={paymentError}
                        isPreview={isPreview}
                        isMobile={true}
                        t={t}
                        buttonColor={buttonColor}
                    />
                </div>
            </div>

            {/* Footer */}
            <div className="py-6 px-4">
                <div className="max-w-4xl mx-auto">
                    {/* Secure Purchase */}
                    <div className="flex justify-center mb-4">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="text-green-500" size={14} />
                            <span className="text-[11px] text-gray-500">{t.securePurchase} &middot; {t.dataProtected}</span>
                        </div>
                    </div>

                    {/* ClickNich */}
                    <div className="text-center mb-3">
                        <p className="text-[10px] text-gray-500 mb-0.5">{t.paymentProcessedBy}</p>
                        <span className="font-semibold text-gray-600 text-[13px]">ClickNich</span>
                    </div>

                    {/* Footer Text */}
                    <div className="text-center space-y-1">
                        <p className="text-[10px] text-gray-500">{t.footerCopyright}</p>
                        <p className="text-[10px] text-gray-500">
                            {t.footerConsent}{' '}
                            <button
                                onClick={(e) => {
                                    e.preventDefault()
                                    setShowPrivacyPolicy(true)
                                }}
                                className="text-blue-500 hover:underline"
                            >
                                {t.termsOfPurchase}
                            </button>
                            {' '}{t.and}{' '}
                            <button
                                onClick={(e) => {
                                    e.preventDefault()
                                    setShowPrivacyPolicy(true)
                                }}
                                className="text-blue-500 hover:underline"
                            >
                                {t.privacyTerms}
                            </button>.
                        </p>
                    </div>
                </div>
            </div>

            {/* Privacy Policy Modal */}
            {showPrivacyPolicy && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-xl">
                        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
                            <h2 className="text-base font-semibold text-gray-900">{t.privacyPolicy}</h2>
                            <button
                                onClick={() => setShowPrivacyPolicy(false)}
                                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="px-6 py-6 space-y-4 text-sm text-gray-500">
                            <p className="text-[11px] text-gray-400">{t.privacyLastUpdated}</p>

                            <div>
                                <h3 className="font-medium text-gray-900 mb-1.5 text-[13px]">{t.privacySection1Title}</h3>
                                <p className="text-[13px] leading-relaxed">{t.privacySection1Text}</p>
                            </div>

                            <div>
                                <h3 className="font-medium text-gray-900 mb-1.5 text-[13px]">{t.privacySection2Title}</h3>
                                <p className="text-[13px] leading-relaxed">{t.privacySection2Text}</p>
                            </div>

                            <div>
                                <h3 className="font-medium text-gray-900 mb-1.5 text-[13px]">{t.privacySection3Title}</h3>
                                <p className="text-[13px] leading-relaxed">{t.privacySection3Text}</p>
                            </div>

                            <div>
                                <h3 className="font-medium text-gray-900 mb-1.5 text-[13px]">{t.privacySection4Title}</h3>
                                <p className="text-[13px] leading-relaxed">{t.privacySection4Text}</p>
                            </div>

                            <div>
                                <h3 className="font-medium text-gray-900 mb-1.5 text-[13px]">{t.privacySection5Title}</h3>
                                <p className="text-[13px] leading-relaxed">{t.privacySection5Text}</p>
                            </div>
                        </div>
                        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 rounded-b-2xl">
                            <button
                                onClick={() => setShowPrivacyPolicy(false)}
                                className="w-full px-4 py-2 bg-gray-900 text-white text-[13px] font-medium rounded-lg hover:bg-gray-800 transition-colors"
                            >
                                {t.close}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// Componente que envolve com Stripe Elements e lógica de pagamento
function CheckoutDigitalWithStripe(props: CheckoutDigitalProps) {
    if (!stripePromise) {
        const t = getTranslations(props.language || 'en')
        return <div>{t.paymentSystemNotAvailable}</div>
    }

    return (
        <Elements stripe={stripePromise}>
            <CheckoutDigitalForm {...props} />
        </Elements>
    )
}

// Form interno com acesso ao Stripe
function CheckoutDigitalForm(props: CheckoutDigitalProps) {
    const stripe = useStripe()
    const elements = useElements()
    const navigate = useNavigate()
    // Ref para armazenar resultado do pagamento para o callback
    const paymentResultRef = useRef<{ purchaseId: string; thankyouToken: string } | null>(null)

    const handlePayment = async (paymentData: PaymentData) => {
        // Extrair formData do paymentData
        const formData = paymentData.formData



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
            }



            const response = await fetch(`${SUPABASE_URL}/functions/v1/process-payment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify(requestBody),
            })

            const result = await response.json()


            if (!result.success) {
                console.error('❌ Payment failed:', result.error)
                throw new Error(result.error || 'Payment failed')
            }

            // Armazenar resultado para o callback
            paymentResultRef.current = {
                purchaseId: result.purchaseId,
                thankyouToken: result.thankyouToken
            }

            // Retornar dados completos para redirecionamento
            return {
                success: true,
                purchaseId: result.purchaseId,
                thankyouToken: result.thankyouToken
            }
        } catch (error: any) {
            console.error('💥 Payment error:', error)
            throw error
        }
    }

    // Callback de sucesso que passa o resultado
    const handlePaymentSuccess = async (result?: { purchaseId: string; thankyouToken: string } | null) => {

        const finalResult = result || paymentResultRef.current
        if (props.onPaymentSuccess && finalResult) {
            // Passar o resultado para o callback do componente pai
            await props.onPaymentSuccess(finalResult)
        }
    }

    return <CheckoutDigital {...props} onProcessPayment={handlePayment} onPaymentSuccess={handlePaymentSuccess} />
}

export default CheckoutDigitalWithStripe