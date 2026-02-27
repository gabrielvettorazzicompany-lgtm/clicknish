/**
 * 🚀 CHECKOUT PROGRESSIVE RENDERER
 * 
 * Sistema de renderização progressiva para checkout
 * - Componentes críticos primeiro
 * - Loading progressivo e não-blocante
 * - Skeletons otimizados
 * - Performance monitoring
 */

import React, { useCallback } from 'react'
import { ProgressiveContainer, StreamedComponent } from '@/lib/component-streaming'
import { CheckoutDigitalProps } from './types'

// ✅ SKELETONS: Skeletons otimizados para cada componente
const CheckoutHeaderSkeleton = () => (
    <div className="bg-white border-b border-gray-100 h-16 flex items-center px-4">
        <div className="w-20 h-4 bg-gray-200 rounded animate-pulse"></div>
    </div>
)

const CheckoutFormSkeleton = () => (
    <div className="bg-white rounded-xl p-6 space-y-4 mx-3 lg:mx-0">
        <div className="h-6 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
        <div className="space-y-3">
            <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
        </div>
        <div className="h-12 bg-blue-200 rounded animate-pulse"></div>
    </div>
)

const OrderSummarySkeleton = () => (
    <div className="bg-white rounded-xl p-6 space-y-4">
        <div className="h-6 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2"></div>
        <div className="border-t pt-4">
            <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
        </div>
    </div>
)

const OrderBumpsSkeleton = () => (
    <div className="space-y-4 mx-3 lg:mx-0">
        {[1, 2].map(i => (
            <div key={i} className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="flex items-center space-x-3">
                    <div className="w-4 h-4 bg-gray-200 rounded animate-pulse"></div>
                    <div className="flex-1">
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2"></div>
                    </div>
                    <div className="h-6 bg-gray-200 rounded animate-pulse w-16"></div>
                </div>
            </div>
        ))}
    </div>
)

// ✅ IMPORT FUNCTIONS: Dynamic imports para lazy loading
const importCheckoutHeader = () => import('./components/CheckoutHeader')
const importCheckoutTimer = () => import('./components/CheckoutTimer')
const importCheckoutBanner = () => import('./components/CheckoutBanner')
const importPaymentForm = () => import('./PaymentForm')
const importOrderSummary = () => import('./OrderSummary')
const importOrderBumpsList = () => import('./components/OrderBumpsList')
const importCheckoutFooter = () => import('./components/CheckoutFooter')

// ✅ MAIN COMPONENT: Checkout progressivo
interface ProgressiveCheckoutProps extends CheckoutDigitalProps {
    onLoadingComplete?: () => void
}

export const ProgressiveCheckout: React.FC<ProgressiveCheckoutProps> = (props) => {
    const { onLoadingComplete, ...checkoutProps } = props

    const handleLoadingComplete = useCallback(() => {
        console.log('[Progressive Checkout] ✅ All components loaded')
        onLoadingComplete?.()

        // Log performance metrics
        const metrics = {
            fcp: getFirstContentfulPaintTime(),
            lcp: getLargestContentfulPaintTime(),
            totalTime: performance.now()
        }

        console.log('[Progressive Checkout] 📊 Performance metrics:', metrics)
    }, [onLoadingComplete])

    return (
        <div className="min-h-screen bg-gray-50">
            <ProgressiveContainer
                autoStart={true}
                onLoadingComplete={handleLoadingComplete}
            >

                {/* ✅ CRITICAL: Header (priority: critical) */}
                <StreamedComponent
                    id="checkout-header"
                    component={React.lazy(importCheckoutHeader)}
                    props={{
                        onBack: checkoutProps.onBack,
                        t: { back: 'Voltar' }
                    }}
                    config={{
                        priority: 'critical',
                        delay: 0,
                        skeleton: <CheckoutHeaderSkeleton />
                    }}
                />

                {/* ✅ HIGH: Timer (priority: high, depends on header) */}
                <StreamedComponent
                    id="checkout-timer"
                    component={React.lazy(importCheckoutTimer)}
                    props={{
                        timerConfig: checkoutProps.timerConfig,
                        onTimerClick: checkoutProps.onTimerClick,
                        isPreview: checkoutProps.isPreview,
                        viewDevice: checkoutProps.viewDevice,
                        isDragging: checkoutProps.isDragging,
                        t: { minutes: 'minutos', seconds: 'segundos' }
                    }}
                    config={{
                        priority: 'high',
                        delay: 50,
                        dependencies: ['checkout-header'],
                        skeleton: (
                            <div className="h-12 bg-red-500 text-white text-center py-2 animate-pulse">
                                <div className="w-32 h-4 bg-red-400 rounded mx-auto"></div>
                            </div>
                        )
                    }}
                />

                {/* ✅ HIGH: Banner (priority: high) */}
                <StreamedComponent
                    id="checkout-banner"
                    component={React.lazy(importCheckoutBanner)}
                    props={{
                        customBanner: checkoutProps.customBanner,
                        bannerSelected: checkoutProps.bannerSelected,
                        isDragging: checkoutProps.isDragging,
                        onBannerClick: checkoutProps.onBannerClick,
                        onBannerRemove: checkoutProps.onBannerRemove,
                        isPreview: checkoutProps.isPreview
                    }}
                    config={{
                        priority: 'high',
                        delay: 100
                    }}
                />

                {/* ✅ LAYOUT CONTAINER */}
                <div className="w-full lg:max-w-7xl lg:mx-auto mt-6 lg:mt-8">
                    <div className="lg:grid lg:grid-cols-5 lg:gap-8 lg:px-4">

                        {/* ✅ CRITICAL: Payment Form (priority: critical) */}
                        <div className="lg:col-span-3 space-y-6">
                            <StreamedComponent
                                id="payment-form"
                                component={React.lazy(importPaymentForm)}
                                props={{
                                    formData: checkoutProps.formData || {},
                                    onFormDataChange: checkoutProps.onFormDataChange,
                                    selectedPaymentMethods: checkoutProps.selectedPaymentMethods,
                                    defaultPaymentMethod: checkoutProps.defaultPaymentMethod,
                                    onSubmit: checkoutProps.onSubmit,
                                    processing: false,
                                    paymentSuccess: false,
                                    paymentError: null,
                                    totalAmount: checkoutProps.productPrice,
                                    currency: checkoutProps.productCurrency,
                                    isPreview: checkoutProps.isPreview
                                }}
                                config={{
                                    priority: 'critical',
                                    delay: 0,
                                    skeleton: <CheckoutFormSkeleton />
                                }}
                            />

                            {/* ✅ MEDIUM: Order Bumps (priority: medium) */}
                            <StreamedComponent
                                id="order-bumps"
                                component={React.lazy(importOrderBumpsList)}
                                props={{
                                    orderBumps: checkoutProps.initialOrderBumps || [],
                                    selectedBumps: new Set(),
                                    toggleBump: () => { },
                                    isPreview: checkoutProps.isPreview,
                                    viewDevice: checkoutProps.viewDevice
                                }}
                                config={{
                                    priority: 'medium',
                                    delay: 200,
                                    dependencies: ['payment-form'],
                                    skeleton: <OrderBumpsSkeleton />
                                }}
                            />
                        </div>

                        {/* ✅ HIGH: Order Summary Desktop (priority: high) */}
                        <div className="hidden lg:block lg:col-span-2">
                            <StreamedComponent
                                id="order-summary-desktop"
                                component={React.lazy(importOrderSummary)}
                                props={{
                                    productName: checkoutProps.productName,
                                    productPrice: checkoutProps.productPrice,
                                    productCurrency: checkoutProps.productCurrency,
                                    productImage: checkoutProps.productImage,
                                    productDescription: checkoutProps.productDescription,
                                    orderBumps: checkoutProps.initialOrderBumps || [],
                                    selectedBumps: new Set(),
                                    totalWithBumps: checkoutProps.productPrice,
                                    installments: 1,
                                    onSubmit: checkoutProps.onSubmit,
                                    processing: false,
                                    paymentSuccess: false,
                                    paymentError: null,
                                    isPreview: checkoutProps.isPreview,
                                    isMobile: false,
                                    buttonColor: checkoutProps.buttonColor
                                }}
                                config={{
                                    priority: 'high',
                                    delay: 150,
                                    dependencies: ['payment-form'],
                                    skeleton: <OrderSummarySkeleton />
                                }}
                            />
                        </div>

                    </div>

                    {/* ✅ MEDIUM: Order Summary Mobile (priority: medium) */}
                    <div className="lg:hidden">
                        <StreamedComponent
                            id="order-summary-mobile"
                            component={React.lazy(importOrderSummary)}
                            props={{
                                productName: checkoutProps.productName,
                                productPrice: checkoutProps.productPrice,
                                productCurrency: checkoutProps.productCurrency,
                                productImage: checkoutProps.productImage,
                                productDescription: checkoutProps.productDescription,
                                orderBumps: checkoutProps.initialOrderBumps || [],
                                selectedBumps: new Set(),
                                totalWithBumps: checkoutProps.productPrice,
                                installments: 1,
                                onSubmit: checkoutProps.onSubmit,
                                processing: false,
                                paymentSuccess: false,
                                paymentError: null,
                                isPreview: checkoutProps.isPreview,
                                isMobile: true,
                                buttonColor: checkoutProps.buttonColor
                            }}
                            config={{
                                priority: 'medium',
                                delay: 300,
                                dependencies: ['payment-form'],
                                skeleton: <OrderSummarySkeleton />
                            }}
                        />
                    </div>
                </div>

                {/* ✅ LOW: Footer (priority: low) */}
                <StreamedComponent
                    id="checkout-footer"
                    component={React.lazy(importCheckoutFooter)}
                    props={{
                        t: { privacyPolicy: 'Política de Privacidade' },
                        onPrivacyClick: () => { }
                    }}
                    config={{
                        priority: 'low',
                        delay: 500,
                        skeleton: (
                            <div className="mt-8 py-4 text-center">
                                <div className="w-32 h-3 bg-gray-200 rounded mx-auto animate-pulse"></div>
                            </div>
                        )
                    }}
                />

            </ProgressiveContainer>
        </div>
    )
}

// ✅ UTILITIES: Performance helpers
function getFirstContentfulPaintTime(): number | null {
    const paintEntries = performance.getEntriesByType('paint')
    const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint')
    return fcp ? Math.round(fcp.startTime) : null
}

function getLargestContentfulPaintTime(): number | null {
    return new Promise((resolve) => {
        new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries()
            const lastEntry = entries[entries.length - 1]
            resolve(Math.round(lastEntry.startTime))
        }).observe({ type: 'largest-contentful-paint', buffered: true })
    }).catch(() => null) as any
}

export default ProgressiveCheckout