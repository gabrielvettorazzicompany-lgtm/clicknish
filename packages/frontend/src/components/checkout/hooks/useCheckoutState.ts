import { useState, useCallback } from 'react'

interface FormData {
    name: string
    email: string
    phone: string
}

interface PaymentState {
    processing: boolean
    success: boolean
    error: string | null
    message: string
}

export const useCheckoutState = () => {
    const [formData, setFormData] = useState<FormData>({
        name: '',
        email: '',
        phone: '',
    })

    const [paymentState, setPaymentState] = useState<PaymentState>({
        processing: false,
        success: false,
        error: null,
        message: ''
    })

    const [installments, setInstallments] = useState(1)

    // Memoized form data updater
    const updateFormData = useCallback((field: keyof FormData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }, [])

    const setFormDataComplete = useCallback((data: FormData) => {
        setFormData(data)
    }, [])

    // Payment state updaters
    const setProcessing = useCallback((processing: boolean) => {
        setPaymentState(prev => ({ ...prev, processing }))
    }, [])

    const setPaymentSuccess = useCallback((success: boolean) => {
        setPaymentState(prev => ({ ...prev, success, error: null }))
    }, [])

    const setPaymentError = useCallback((error: string | null) => {
        setPaymentState(prev => ({ ...prev, error, success: false }))
    }, [])

    const setPaymentMessage = useCallback((message: string) => {
        setPaymentState(prev => ({ ...prev, message }))
    }, [])

    return {
        formData,
        updateFormData,
        setFormData: setFormDataComplete,
        paymentState,
        setProcessing,
        setPaymentSuccess,
        setPaymentError,
        setPaymentMessage,
        installments,
        setInstallments
    }
}