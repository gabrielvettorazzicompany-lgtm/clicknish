import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
    Elements,
    CardNumberElement,
    CardExpiryElement,
    CardCvcElement,
    useStripe,
    useElements,
} from '@stripe/react-stripe-js'
import { CreditCard, Lock, CheckCircle, AlertCircle, ShieldCheck } from 'lucide-react'
import { useI18n } from '@/i18n'

// Inicializar Stripe com sua chave pública
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || '')

const SUPABASE_URL = 'https://cgeqtodbisgwvhkaahiy.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY'

interface PaymentFormProps {
    productId: string
    productType?: 'app' | 'marketplace' // Novo: tipo do produto
    applicationId?: string // Novo: necessário quando productType === 'app'
    checkoutId?: string
    productName: string
    productPrice: number
    productCurrency?: string
    onSuccess: () => void
}

const elementOptions = {
    style: {
        base: {
            fontSize: '16px',
            color: '#ffffff',
            '::placeholder': {
                color: '#9ca3af',
            },
        },
        invalid: {
            color: '#ef4444',
        },
    },
}

function CheckoutForm({ productId, productType = 'marketplace', applicationId, checkoutId, productName, productPrice, productCurrency = 'BRL', onSuccess }: PaymentFormProps) {
    const stripe = useStripe()
    const elements = useElements()
    const { t } = useI18n()

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    const [customerData, setCustomerData] = useState({
        name: '',
        email: '',
        phone: '',
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!stripe || !elements) {
            return
        }

        setLoading(true)
        setError(null)

        try {
            // Validar dados do cliente
            if (!customerData.name || !customerData.email) {
                throw new Error(t('checkout_pages.fill_required_fields'))
            }

            // Criar Payment Method com Stripe
            const cardElement = elements.getElement(CardNumberElement)
            if (!cardElement) throw new Error(t('checkout_pages.card_element_not_found'))

            const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
                type: 'card',
                card: cardElement,
                billing_details: {
                    name: customerData.name,
                    email: customerData.email,
                    phone: customerData.phone,
                },
            })

            if (pmError) {
                throw new Error(pmError.message)
            }

            // Enviar para nossa Edge Function processar o pagamento
            const response = await fetch(`${SUPABASE_URL}/functions/v1/process-payment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({
                    productId,
                    productType, // Novo
                    applicationId, // Novo
                    checkoutId,
                    customerEmail: customerData.email,
                    customerName: customerData.name,
                    customerPhone: customerData.phone,
                    paymentMethodId: paymentMethod.id,
                }),
            })

            const result = await response.json()

            if (!result.success) {
                throw new Error(result.error || t('checkout_pages.payment_processing_failed'))
            }

            // Pagamento aprovado!
            setSuccess(true)
            setTimeout(() => {
                onSuccess()
            }, 2000)

        } catch (err: any) {
            console.error('Payment error:', err)
            setError(err.message || t('checkout_pages.payment_processing_failed'))
        } finally {
            setLoading(false)
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
        <form onSubmit={handleSubmit} className="space-y-6">
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
                        onChange={(e) => setCustomerData({ ...customerData, name: e.target.value })}
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
                        onChange={(e) => setCustomerData({ ...customerData, email: e.target.value })}
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
                        onChange={(e) => setCustomerData({ ...customerData, phone: e.target.value })}
                        className="w-full px-4 py-3 bg-[#1a1d2e] border border-[#2a2f45] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={t('checkout_pages.phone_placeholder_generic')}
                    />
                </div>
            </div>

            {/* Card Info */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Lock className="w-5 h-5" />
                    {t('checkout_pages.payment_info')}
                </h3>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        {t('checkout_pages.card_number')}
                    </label>
                    <div className="px-4 py-3 bg-[#1a1d2e] border border-[#2a2f45] rounded-lg">
                        <CardNumberElement options={elementOptions} />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            {t('checkout_pages.expiry')}
                        </label>
                        <div className="px-4 py-3 bg-[#1a1d2e] border border-[#2a2f45] rounded-lg">
                            <CardExpiryElement options={elementOptions} />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            {t('checkout_pages.cvc')}
                        </label>
                        <div className="px-4 py-3 bg-[#1a1d2e] border border-[#2a2f45] rounded-lg">
                            <CardCvcElement options={elementOptions} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-400">{error}</p>
                </div>
            )}

            {/* Submit Button */}
            <button
                type="submit"
                disabled={!stripe || loading}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-600 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2"
            >
                {loading ? (
                    <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        {t('checkout_pages.processing_payment')}
                    </>
                ) : (
                    <>
                        <Lock className="w-5 h-5" />
                        {t('checkout_pages.pay_amount', { currency: productCurrency, amount: productPrice.toFixed(2) })}
                    </>
                )}
            </button>

            {/* Security Badge */}
            <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                <ShieldCheck className="w-4 h-4" />
                <span>{t('checkout_pages.stripe_security')}</span>
            </div>
        </form>
    )
}

export default function StripePaymentForm(props: PaymentFormProps) {
    return (
        <Elements stripe={stripePromise}>
            <CheckoutForm {...props} />
        </Elements>
    )
}
