import React, { useState, useRef, useEffect } from 'react'
import { ArrowLeft, Clock, ImageIcon, X, ShieldCheck } from 'lucide-react'
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
import { isValidEmail } from './utils'
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
    initialAppProducts
}: CheckoutDigitalProps) {
    const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false)
    const [processing, setProcessing] = useState(false)
    const [paymentSuccess, setPaymentSuccess] = useState(false)
    const [paymentError, setPaymentError] = useState<string | null>(null)
    const [paymentMessage, setPaymentMessage] = useState<string>('')
    const [installments, setInstallments] = useState(1)
    const [formData, setFormData] = useState<FormData>({
        name: '',
        email: '',
        phone: '',
    })

    const bannerRef = useRef<HTMLDivElement>(null)
    const [isDraggingImage, setIsDraggingImage] = useState(false)
    const [isResizingImage, setIsResizingImage] = useState(false)
    const dragStartPosRef = useRef({ x: 0, y: 0 })
    const initialPositionRef = useRef({ x: 50, y: 50 })
    const initialScaleRef = useRef(1)
    const resizeStartRef = useRef({ x: 0, y: 0 })

    const t = getTranslations(language)
    const { t: i18nT } = useI18n()

    // Use custom hook for order bumps
    const {
        orderBumps,
        selectedBumps,
        toggleBump,
        calculateBumpsTotal
    } = useOrderBumps(checkoutId, productId, initialOrderBumps)

    // Calcular total incluindo order bumps
    const totalWithBumps = productPrice + calculateBumpsTotal()

    // ═══════════════════════════════════════════════════════════════════
    // EAGER LOADING: Pré-aquecer Stripe Elements
    // ═══════════════════════════════════════════════════════════════════
    // Garante que o Stripe esteja carregado antes do usuário interagir.
    // Reduz latência do primeiro render dos campos de cartão (~300-500ms).
    useEffect(() => {
        if (stripePromise) {
            // Trigger eager loading - resolve a promise em background
            stripePromise.then(() => {
                console.log('Stripe Elements pré-carregado com sucesso')
            }).catch(err => {
                console.warn('Falha no pré-carregamento do Stripe:', err)
            })
        }
    }, [])

    // Mouse drag para ajustar posição da imagem
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDraggingImage && onBannerImagePositionChange && customBanner) {
                const deltaX = e.clientX - dragStartPosRef.current.x
                const deltaY = e.clientY - dragStartPosRef.current.y

                // Converter movimento de pixels para porcentagem (sensibilidade ajustada)
                const bannerWidth = bannerRef.current?.offsetWidth || 500
                const bannerHeight = bannerRef.current?.offsetHeight || 300

                const deltaXPercent = (deltaX / bannerWidth) * 100 * 0.5
                const deltaYPercent = (deltaY / bannerHeight) * 100 * 0.5

                const newX = Math.max(0, Math.min(100, initialPositionRef.current.x - deltaXPercent))
                const newY = Math.max(0, Math.min(100, initialPositionRef.current.y - deltaYPercent))

                onBannerImagePositionChange({ x: newX, y: newY })
            }

            if (isResizingImage && onBannerImageScaleChange) {
                const deltaY = e.clientY - resizeStartRef.current.y
                const bannerHeight = bannerRef.current?.offsetHeight || 300

                // Calcular variação de scale baseado no movimento vertical
                const scaleChange = -(deltaY / bannerHeight) * 2 // Sensibilidade de redimensionamento
                const newScale = Math.max(0.5, Math.min(2, initialScaleRef.current + scaleChange))

                onBannerImageScaleChange(newScale)
            }
        }

        const handleMouseUp = () => {
            setIsDraggingImage(false)
            setIsResizingImage(false)
        }

        if (isDraggingImage || isResizingImage) {
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)
            document.body.style.cursor = isResizingImage ? 'nwse-resize' : 'grabbing'
            document.body.style.userSelect = 'none'
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
        }
    }, [isDraggingImage, isResizingImage, onBannerImagePositionChange, onBannerImageScaleChange, customBanner])

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
        setPaymentMessage('Validando cartão...')

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

            setPaymentMessage('Processando pagamento...')
            const result = await onProcessPayment(paymentData)

            setPaymentMessage('Pagamento aprovado! 🎉')
            setPaymentSuccess(true)

            // Se há callback onPaymentSuccess, usar ele (permite redirecionamento customizado)
            if (onPaymentSuccess) {

                setTimeout(async () => {
                    try {
                        const callbackResult = (result?.purchaseId && result?.thankyouToken)
                            ? result as { purchaseId: string; thankyouToken: string; redirectUrl?: string }
                            : null
                        await onPaymentSuccess(callbackResult)
                    } catch (e) {
                        console.error('Callback error:', e)
                        // Fallback: usar redirectUrl do backend ou login
                        if (result?.redirectUrl) {
                            window.location.href = result.redirectUrl.startsWith('/')
                                ? result.redirectUrl
                                : result.redirectUrl
                        }
                    }
                }, 150)
            } else if (result?.success) {
                // Usar redirectUrl do backend (upsell ou login)
                const redirectUrl = result.redirectUrl || '/members-login'

                setTimeout(() => {
                    window.location.href = redirectUrl.startsWith('/')
                        ? redirectUrl
                        : redirectUrl
                }, 150)
            }
        } catch (error: any) {
            setPaymentError(error.message || t.paymentFailed)
            setPaymentMessage('')
        } finally {
            setProcessing(false)
        }
    }

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
                            compact={viewDevice === 'mobile'}
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
                    {/* Wrapper externo: relativo, sem overflow-hidden, para os handles ficarem visíveis */}
                    <div
                        ref={bannerRef}
                        className="relative"
                        style={{
                            height: `${customBanner.customHeight || 250}px`
                        }}
                    >
                        {/* Inner: overflow-hidden para clipar a imagem */}
                        <div
                            className={`absolute inset-0 rounded-lg overflow-hidden bg-white transition-all duration-200 ${isDragging ? 'ring-4 ring-teal-400 ring-opacity-75' : ''}`}
                            onClick={onBannerClick}
                            style={{
                                backgroundColor: '#ffffff',
                                cursor: bannerSelected ? (isDraggingImage ? 'grabbing' : 'grab') : 'default'
                            }}
                            onMouseDown={(e) => {
                                if (!bannerSelected || !onBannerImagePositionChange) return
                                const target = e.target as HTMLElement
                                if (target.tagName === 'BUTTON' || target.closest('button') || target.classList.contains('resize-handle')) return
                                e.preventDefault()
                                e.stopPropagation()
                                setIsDraggingImage(true)
                                dragStartPosRef.current = { x: e.clientX, y: e.clientY }
                                initialPositionRef.current = {
                                    x: customBanner.imagePosition?.x || 50,
                                    y: customBanner.imagePosition?.y || 50
                                }
                            }}
                        >
                            <img
                                src={customBanner.image}
                                alt="Banner"
                                className="w-full h-full"
                                style={{
                                    objectFit: 'cover',
                                    objectPosition: `${customBanner.imagePosition?.x || 50}% ${customBanner.imagePosition?.y || 50}%`,
                                    transform: `scale(${customBanner.imageScale || 1})`,
                                    pointerEvents: 'none',
                                    userSelect: 'none'
                                }}
                                draggable={false}
                            />

                            {/* Contorno pontilhado sobre a imagem */}
                            {bannerSelected && onBannerImageScaleChange && (
                                <div
                                    className="absolute inset-0 border-2 border-dashed border-blue-500 rounded-lg pointer-events-none"
                                    style={{ zIndex: 50 }}
                                />
                            )}

                            {/* Botão de remover */}
                            {bannerSelected && onBannerRemove && (
                                <div className="absolute top-3 right-3 flex items-center gap-2" style={{ zIndex: 70 }}>
                                    <button
                                        className="w-8 h-8 flex items-center justify-center bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-lg shadow-black/20"
                                        onClick={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            onBannerRemove()
                                        }}
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            )}

                            {/* Drag Overlay */}
                            {isDragging && (
                                <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center z-50 pointer-events-none">
                                    <div className="bg-blue-500 text-white px-6 py-3 rounded-lg shadow-xl shadow-black/10">
                                        <p className="text-sm font-medium">{i18nT('checkout_pages.drop_here_image')}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Handles nos 4 cantos — fora do overflow-hidden para não serem cortados */}
                        {bannerSelected && onBannerImageScaleChange && (
                            <>
                                {/* Canto superior esquerdo */}
                                <div
                                    className="resize-handle absolute w-4 h-4 bg-white border-2 border-blue-500 rounded-sm cursor-nwse-resize hover:scale-125 transition-transform shadow-lg"
                                    style={{ zIndex: 60, top: 0, left: 0, transform: 'translate(-50%, -50%)' }}
                                    onMouseDown={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        setIsResizingImage(true)
                                        resizeStartRef.current = { x: e.clientX, y: e.clientY }
                                        initialScaleRef.current = customBanner.imageScale || 1
                                    }}
                                />
                                {/* Canto superior direito */}
                                <div
                                    className="resize-handle absolute w-4 h-4 bg-white border-2 border-blue-500 rounded-sm cursor-nesw-resize hover:scale-125 transition-transform shadow-lg"
                                    style={{ zIndex: 60, top: 0, right: 0, transform: 'translate(50%, -50%)' }}
                                    onMouseDown={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        setIsResizingImage(true)
                                        resizeStartRef.current = { x: e.clientX, y: e.clientY }
                                        initialScaleRef.current = customBanner.imageScale || 1
                                    }}
                                />
                                {/* Canto inferior esquerdo */}
                                <div
                                    className="resize-handle absolute w-4 h-4 bg-white border-2 border-blue-500 rounded-sm cursor-nesw-resize hover:scale-125 transition-transform shadow-lg"
                                    style={{ zIndex: 60, bottom: 0, left: 0, transform: 'translate(-50%, 50%)' }}
                                    onMouseDown={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        setIsResizingImage(true)
                                        resizeStartRef.current = { x: e.clientX, y: e.clientY }
                                        initialScaleRef.current = customBanner.imageScale || 1
                                    }}
                                />
                                {/* Canto inferior direito */}
                                <div
                                    className="resize-handle absolute w-4 h-4 bg-white border-2 border-blue-500 rounded-sm cursor-nwse-resize hover:scale-125 transition-transform shadow-lg"
                                    style={{ zIndex: 60, bottom: 0, right: 0, transform: 'translate(50%, 50%)' }}
                                    onMouseDown={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        setIsResizingImage(true)
                                        resizeStartRef.current = { x: e.clientX, y: e.clientY }
                                        initialScaleRef.current = customBanner.imageScale || 1
                                    }}
                                />

                                {/* Handle no meio da borda superior */}
                                <div
                                    className="resize-handle absolute w-4 h-4 bg-white border-2 border-blue-500 rounded-sm cursor-ns-resize hover:scale-125 transition-transform shadow-lg"
                                    style={{ zIndex: 60, top: 0, left: '50%', transform: 'translate(-50%, -50%)' }}
                                    onMouseDown={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        setIsResizingImage(true)
                                        resizeStartRef.current = { x: e.clientX, y: e.clientY }
                                        initialScaleRef.current = customBanner.imageScale || 1
                                    }}
                                />

                                {/* Handle no meio da borda inferior */}
                                <div
                                    className="resize-handle absolute w-4 h-4 bg-white border-2 border-blue-500 rounded-sm cursor-ns-resize hover:scale-125 transition-transform shadow-lg"
                                    style={{ zIndex: 60, bottom: 0, left: '50%', transform: 'translate(-50%, 50%)' }}
                                    onMouseDown={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        setIsResizingImage(true)
                                        resizeStartRef.current = { x: e.clientX, y: e.clientY }
                                        initialScaleRef.current = customBanner.imageScale || 1
                                    }}
                                />

                                {/* Handle no meio da borda esquerda */}
                                <div
                                    className="resize-handle absolute w-4 h-4 bg-white border-2 border-blue-500 rounded-sm cursor-ew-resize hover:scale-125 transition-transform shadow-lg"
                                    style={{ zIndex: 60, left: 0, top: '50%', transform: 'translate(-50%, -50%)' }}
                                    onMouseDown={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        setIsResizingImage(true)
                                        resizeStartRef.current = { x: e.clientX, y: e.clientY }
                                        initialScaleRef.current = customBanner.imageScale || 1
                                    }}
                                />

                                {/* Handle no meio da borda direita */}
                                <div
                                    className="resize-handle absolute w-4 h-4 bg-white border-2 border-blue-500 rounded-sm cursor-ew-resize hover:scale-125 transition-transform shadow-lg"
                                    style={{ zIndex: 60, right: 0, top: '50%', transform: 'translate(50%, -50%)' }}
                                    onMouseDown={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        setIsResizingImage(true)
                                        resizeStartRef.current = { x: e.clientX, y: e.clientY }
                                        initialScaleRef.current = customBanner.imageScale || 1
                                    }}
                                />
                            </>
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

            {/* Modal de Processamento */}

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