import React, { memo } from 'react'
import { PaymentForm } from '../PaymentForm'
import { OrderSummary } from '../OrderSummary'
import OrderBumpsList from './OrderBumpsList'
import ProductInfoHeader from './ProductInfoHeader'

interface CheckoutMainContentProps {
    // Product info
    productName: string
    productPrice: number
    productCurrency: string
    productImage?: string
    productDescription?: string
    customBanner?: any

    // Form data
    formData: any
    setFormData: (data: any) => void
    handleSubmit: () => void
    paymentState: any
    installments: number
    setInstallments: (value: number) => void

    // Order bumps
    orderBumps: any[]
    selectedBumps: Set<string>
    toggleBump: (id: string) => void
    totalWithBumps: number

    // UI state
    isPreview?: boolean
    viewDevice?: 'desktop' | 'mobile'
    buttonColor?: string

    // Config
    selectedPaymentMethods: string[]
    defaultPaymentMethod: string
    onLeadCapture?: (data: any) => void
    timerConfig?: any

    // Translations
    t: any
}

const CheckoutMainContent = memo(({
    productName,
    productPrice,
    productCurrency,
    productImage,
    productDescription,
    customBanner,
    formData,
    setFormData,
    handleSubmit,
    paymentState,
    installments,
    setInstallments,
    orderBumps,
    selectedBumps,
    toggleBump,
    totalWithBumps,
    isPreview = false,
    viewDevice = 'desktop',
    buttonColor = '#111827',
    selectedPaymentMethods,
    defaultPaymentMethod,
    onLeadCapture,
    timerConfig,
    t
}: CheckoutMainContentProps) => {
    const hasCustomBanner = customBanner && (customBanner.image || customBanner.title || customBanner.subtitle || customBanner.description)

    return (
        <div className={`w-full lg:max-w-7xl lg:mx-auto ${(timerConfig?.enabled || hasCustomBanner) ? 'mt-6 lg:mt-8' : 'mt-6 lg:mt-8'}`}>

            <ProductInfoHeader
                customBanner={customBanner}
                productName={productName}
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
                        onLeadCapture={onLeadCapture}
                        t={t}
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
                        onSubmit={handleSubmit}
                        processing={paymentState.processing}
                        paymentSuccess={paymentState.success}
                        paymentError={paymentState.error}
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
                    processing={paymentState.processing}
                    paymentSuccess={paymentState.success}
                    paymentError={paymentState.error}
                    isPreview={isPreview}
                    isMobile={true}
                    t={t}
                    buttonColor={buttonColor}
                />
            </div>
        </div>
    )
})

CheckoutMainContent.displayName = 'CheckoutMainContent'

export default CheckoutMainContent