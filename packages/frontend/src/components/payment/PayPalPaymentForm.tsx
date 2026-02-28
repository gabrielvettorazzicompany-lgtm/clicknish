import React, { useState } from 'react'
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js'
import { CreditCard, Lock, CheckCircle, AlertCircle } from 'lucide-react'
import { useI18n } from '@/i18n'

interface PayPalPaymentFormProps {
    productId: string
    productType?: 'app' | 'marketplace'
    applicationId?: string
    checkoutId?: string
    productName: string
    productPrice: number
    productCurrency?: string
    onSuccess: () => void
}

interface PayPalFormProps extends PayPalPaymentFormProps {
    customerData: {
        name: string
        email: string
        phone: string
    }
    onCustomerDataChange: (data: { name: string; email: string; phone: string }) => void
}

const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID || ''

function PayPalForm({
    productId,
    productType = 'marketplace',
    applicationId,
    checkoutId,
    productName,
    productPrice,
    productCurrency = 'USD',
    customerData,
    onCustomerDataChange,
    onSuccess
}: PayPalFormProps) {
    const { t } = useI18n()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    const handleCustomerDataChange = (field: keyof typeof customerData, value: string) => {
        onCustomerDataChange({
            ...customerData,
            [field]: value
        })
    }

    const validateCustomerData = () => {
        if (!customerData.name.trim()) {
            throw new Error(t('checkout_pages.name_required') || 'Name is required')
        }
        if (!customerData.email.trim()) {
            throw new Error(t('checkout_pages.email_required') || 'Email is required')
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(customerData.email)) {
            throw new Error(t('checkout_pages.invalid_email') || 'Invalid email address')
        }
    }

    if (success) {
        return (
            <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 mb-4">
                    <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">{t('checkout_pages.payment_successful')}</h3>
                <p className="text-gray-400 mb-4">
                    {t('checkout_pages.access_granted_to', { name: productName })}
                </p>
                <p className="text-sm text-gray-500">
                    {t('checkout_pages.check_email_instructions')}
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Customer Info */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    {t('checkout_pages.customer_information')}
                </h3>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        {t('checkout_pages.full_name_required')}
                    </label>
                    <input
                        type="text"
                        value={customerData.name}
                        onChange={(e) => handleCustomerDataChange('name', e.target.value)}
                        className="w-full px-4 py-3 bg-[#1a1d2e] border border-[#2a2f45] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={t('checkout_pages.name_placeholder_generic')}
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        {t('checkout_pages.email_required')}
                    </label>
                    <input
                        type="email"
                        value={customerData.email}
                        onChange={(e) => handleCustomerDataChange('email', e.target.value)}
                        className="w-full px-4 py-3 bg-[#1a1d2e] border border-[#2a2f45] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={t('checkout_pages.email_placeholder_generic')}
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        {t('checkout_pages.phone_label')}
                    </label>
                    <input
                        type="tel"
                        value={customerData.phone}
                        onChange={(e) => handleCustomerDataChange('phone', e.target.value)}
                        className="w-full px-4 py-3 bg-[#1a1d2e] border border-[#2a2f45] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={t('checkout_pages.phone_placeholder_generic')}
                    />
                </div>
            </div>

            {/* PayPal Payment */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Lock className="w-5 h-5" />
                    {t('checkout_pages.payment_info')}
                </h3>

                {error && (
                    <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-400">{error}</p>
                    </div>
                )}

                {/* PayPal Buttons */}
                <div className="bg-[#1a1d2e] border border-[#2a2f45] rounded-lg p-4">
                    <PayPalButtons
                        disabled={loading}
                        style={{
                            layout: 'vertical',
                            color: 'gold',
                            shape: 'rect',
                            label: 'paypal'
                        }}
                        createOrder={async (data, actions) => {
                            try {
                                setLoading(true)
                                setError(null)

                                // Validar dados do cliente
                                validateCustomerData()

                                // Criar ordem no backend
                                const response = await fetch('https://api.clicknich.com/api/process-payment', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({
                                        productId,
                                        productType,
                                        applicationId,
                                        checkoutId,
                                        customerEmail: customerData.email,
                                        customerName: customerData.name,
                                        customerPhone: customerData.phone,
                                        paymentProvider: 'paypal',
                                        totalAmount: productPrice,
                                        currency: productCurrency,
                                        action: 'create'
                                    })
                                })

                                const result = await response.json()

                                if (!result.success) {
                                    throw new Error(result.error || 'Failed to create PayPal order')
                                }

                                return result.orderId
                            } catch (error: any) {
                                console.error('PayPal create order error:', error)
                                setError(error.message || 'Failed to create order')
                                throw error
                            } finally {
                                setLoading(false)
                            }
                        }}
                        onApprove={async (data, actions) => {
                            try {
                                setLoading(true)
                                setError(null)

                                // Capturar o pagamento no backend
                                const response = await fetch('https://api.clicknich.com/api/process-payment', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({
                                        orderId: data.orderID,
                                        paymentProvider: 'paypal',
                                        action: 'capture'
                                    })
                                })

                                const result = await response.json()

                                if (!result.success) {
                                    throw new Error(result.error || 'Payment capture failed')
                                }

                                // Pagamento aprovado!
                                setSuccess(true)
                                setTimeout(() => {
                                    onSuccess()
                                }, 2000)

                            } catch (error: any) {
                                console.error('PayPal capture error:', error)
                                setError(error.message || 'Payment processing failed')
                            } finally {
                                setLoading(false)
                            }
                        }}
                        onError={(error) => {
                            console.error('PayPal button error:', error)
                            setError('PayPal payment failed. Please try again.')
                            setLoading(false)
                        }}
                        onCancel={() => {
                            setError('Payment was cancelled')
                            setLoading(false)
                        }}
                    />
                </div>

                {/* Loading indicator */}
                {loading && (
                    <div className="text-center py-4">
                        <div className="inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-sm text-gray-400 mt-2">
                            {t('checkout_pages.processing_payment')}
                        </p>
                    </div>
                )}
            </div>

            {/* Security Badge */}
            <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                <Lock className="w-4 h-4" />
                <span>{t('checkout_pages.paypal_security') || 'Secured by PayPal'}</span>
            </div>
        </div>
    )
}

export default function PayPalPaymentForm(props: PayPalPaymentFormProps) {
    const [customerData, setCustomerData] = useState({
        name: '',
        email: '',
        phone: '',
    })

    if (!PAYPAL_CLIENT_ID) {
        return (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm">PayPal is not configured. Please contact support.</p>
            </div>
        )
    }

    return (
        <PayPalScriptProvider
            options={{
                'client-id': PAYPAL_CLIENT_ID,
                currency: props.productCurrency || 'USD',
                intent: 'capture'
            }}
        >
            <PayPalForm
                {...props}
                customerData={customerData}
                onCustomerDataChange={setCustomerData}
            />
        </PayPalScriptProvider>
    )
}