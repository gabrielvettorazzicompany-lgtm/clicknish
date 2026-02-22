import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, Mail, ArrowRight } from 'lucide-react'

export default function Success() {
    const navigate = useNavigate()

    useEffect(() => {
        // Auto redirect after 10 seconds
        const timer = setTimeout(() => {
            navigate('/')
        }, 10000)

        return () => clearTimeout(timer)
    }, [navigate])

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 flex items-center justify-center px-4">
            <div className="max-w-md w-full">
                {/* Success Card */}
                <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
                    {/* Success Icon */}
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-6">
                        <CheckCircle className="w-12 h-12 text-green-600" />
                    </div>

                    {/* Title */}
                    <h1 className="text-3xl font-bold text-gray-900 mb-3">
                        Payment Successful!
                    </h1>

                    {/* Subtitle */}
                    <p className="text-gray-600 mb-8">
                        Your purchase has been completed successfully. You will receive access instructions at your email shortly.
                    </p>

                    {/* Email Info */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                        <div className="flex items-start gap-3">
                            <Mail className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                            <div className="text-left">
                                <p className="text-sm font-medium text-blue-900 mb-1">
                                    Check your email
                                </p>
                                <p className="text-xs text-blue-700">
                                    We've sent you a confirmation email with login instructions and access details.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="space-y-3">
                        <button
                            onClick={() => navigate('/')}
                            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-3 px-6 rounded-lg transition-all flex items-center justify-center gap-2 group"
                        >
                            Go to Home
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </button>

                        <p className="text-xs text-gray-500">
                            Redirecting automatically in 10 seconds...
                        </p>
                    </div>
                </div>

                {/* Additional Info */}
                <div className="mt-6 text-center">
                    <p className="text-sm text-gray-600">
                        Need help? Contact us at{' '}
                        <a href="mailto:support@example.com" className="text-blue-600 hover:text-blue-700 font-medium">
                            support@example.com
                        </a>
                    </p>
                </div>
            </div>
        </div>
    )
}
