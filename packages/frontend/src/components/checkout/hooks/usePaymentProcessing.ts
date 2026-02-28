import { useCallback, useRef } from 'react'
import { CardNumberElement } from '@stripe/react-stripe-js'
import type { Stripe, StripeElements } from '@stripe/stripe-js'
import { isValidEmail } from '../utils'

interface FormData {
    name: string
    email: string
    phone: string
}

interface PaymentData {
    formData: FormData
    selectedOrderBumps: any[]
    totalAmount: number
    installments?: number
}

interface PaymentResult {
    success: boolean
    purchaseId?: string
    thankyouToken?: string
    redirectUrl?: string
    error?: string
}

interface UsePaymentProcessingProps {
    productId: string
    productType?: string
    applicationId?: string
    checkoutId?: string
    sessionId?: string
    trackingParameters?: any
    isPreview?: boolean
    language?: string
    onProcessingChange: (processing: boolean) => void
    onMessageChange: (message: string) => void
    onErrorChange: (error: string | null) => void
    stripe?: Stripe | null
    elements?: StripeElements | null
}

export const usePaymentProcessing = ({
    productId,
    productType,
    applicationId,
    checkoutId,
    sessionId,
    trackingParameters,
    isPreview,
    language = 'en',
    onProcessingChange,
    onMessageChange,
    onErrorChange,
    stripe = null,
    elements = null,
}: UsePaymentProcessingProps) => {
    const paymentResultRef = useRef<{ purchaseId: string; thankyouToken: string } | null>(null)

    const processPayment = useCallback(async (paymentData: PaymentData): Promise<PaymentResult> => {
        const { formData } = paymentData

        // Validation
        if (!formData.name || !formData.email) {
            const error = language === 'pt' ? 'Preencha todos os campos obrigatórios' : 'Fill all required fields'
            throw new Error(error)
        }

        if (!isValidEmail(formData.email)) {
            const error = language === 'pt' ? 'Email inválido' : 'Invalid email'
            throw new Error(error)
        }

        if (isPreview) {
            return { success: false }
        }

        try {
            onProcessingChange(true)
            onErrorChange(null)

            let paymentMethodId: string | undefined
            let paymentMethod: string = formData.paymentMethod || 'credit_card'

            // Processar apenas se for cartão de crédito
            if (paymentMethod === 'credit_card') {
                if (!stripe || !elements) {
                    throw new Error('Stripe not initialized')
                }

                onMessageChange('Validando cartão...')

                const cardElement = elements.getElement(CardNumberElement)
                if (!cardElement) {
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
                    throw new Error(pmError.message)
                }

                paymentMethodId = stripePaymentMethod.id
            }

            onMessageChange('Processando pagamento...')

            // Mapear paymentMethod para paymentProvider que o backend espera
            const paymentProvider = paymentMethod === 'credit_card' ? 'stripe' : 'paypal'

            const requestBody = {
                productId,
                productType,
                applicationId,
                checkoutId,
                customerEmail: formData.email,
                customerName: formData.name,
                customerPhone: formData.phone,
                paymentMethodId: paymentMethodId,
                paymentProvider: paymentProvider, // 'stripe' ou 'paypal'
                selectedOrderBumps: paymentData.selectedOrderBumps,
                totalAmount: paymentData.totalAmount,
                installments: paymentData.installments ?? 1,
                sessionId: sessionId || undefined,
                trackingParameters: trackingParameters || undefined,
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
                throw new Error(result.error || 'Payment failed')
            }

            onMessageChange('Pagamento aprovado! 🎉')

            // Store result for callback
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
            throw error
        } finally {
            onProcessingChange(false)
        }
    }, [
        stripe, elements, isPreview, productId, productType, applicationId,
        checkoutId, sessionId, trackingParameters, language,
        onProcessingChange, onMessageChange, onErrorChange
    ])

    return {
        processPayment,
        paymentResult: paymentResultRef.current
    }
}