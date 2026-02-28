/**
 * Página de retorno após aprovação PayPal
 * O usuário é redirecionado aqui pelo PayPal após aprovar o pagamento.
 * Esta página captura o orderId da URL e finaliza a compra no backend.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'

export default function PayPalReturn() {
    const navigate = useNavigate()
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
    const [errorMsg, setErrorMsg] = useState('')

    useEffect(() => {
        const processReturn = async () => {
            const params = new URLSearchParams(window.location.search)

            // PayPal envia "token" como o orderId na URL de retorno
            const orderId = params.get('token') || params.get('orderId')
            const productId = params.get('productId')
            const productType = params.get('productType') || 'marketplace'
            const applicationId = params.get('applicationId') || undefined
            const checkoutId = params.get('checkoutId') || undefined
            const customerEmail = params.get('customerEmail') || ''
            const customerName = params.get('customerName') || ''
            const customerPhone = params.get('customerPhone') || undefined
            const totalAmount = params.get('totalAmount') || '0'
            const sessionId = params.get('sessionId') || undefined

            if (!orderId || !productId || !customerEmail) {
                setErrorMsg('Missing required parameters. Please try again.')
                setStatus('error')
                return
            }

            try {
                const response = await fetch('https://api.clicknich.com/api/process-payment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'capture',
                        orderId,
                        productId,
                        productType,
                        applicationId,
                        checkoutId,
                        customerEmail,
                        customerName,
                        customerPhone,
                        totalAmount: parseFloat(totalAmount),
                        sessionId,
                        paymentProvider: 'paypal',
                    }),
                })

                const result = await response.json()

                if (!result.success) {
                    throw new Error(result.error || 'Payment capture failed')
                }

                setStatus('success')

                // Redirecionar para a URL de sucesso ou login
                setTimeout(() => {
                    const redirectUrl = result.redirectUrl
                    if (redirectUrl) {
                        if (redirectUrl.startsWith('http')) {
                            window.location.href = redirectUrl
                        } else {
                            navigate(redirectUrl)
                        }
                    } else if (productType === 'app') {
                        navigate(`/access/${productId}`)
                    } else {
                        navigate(`/members-login/${productId}`)
                    }
                }, 2000)

            } catch (err: any) {
                console.error('PayPal return error:', err)
                setErrorMsg(err.message || 'An error occurred while processing your payment.')
                setStatus('error')
            }
        }

        processReturn()
    }, [navigate])

    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                    <h2 className="text-lg font-semibold text-gray-800 mb-2">Confirming your payment...</h2>
                    <p className="text-sm text-gray-500">Please wait while we confirm your PayPal payment.</p>
                </div>
            </div>
        )
    }

    if (status === 'success') {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-sm border border-green-100 p-8 max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="w-8 h-8 text-green-500" />
                    </div>
                    <h2 className="text-lg font-semibold text-gray-800 mb-2">Payment Confirmed!</h2>
                    <p className="text-sm text-gray-500">Redirecting you to your content...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-sm border border-red-100 p-8 max-w-md w-full text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <h2 className="text-lg font-semibold text-gray-800 mb-2">Payment Error</h2>
                <p className="text-sm text-gray-500 mb-6">{errorMsg}</p>
                <button
                    onClick={() => navigate(-1)}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                    Go Back
                </button>
            </div>
        </div>
    )
}
