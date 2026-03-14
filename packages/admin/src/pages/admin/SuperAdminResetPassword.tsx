import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/services/supabase'
import { useI18n } from '@/i18n'
import {
    Lock,
    Eye,
    EyeOff,
    AlertCircle,
    CheckCircle,
    KeyRound
} from 'lucide-react'

export default function SuperAdminResetPassword() {
    const { t } = useI18n()
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const navigate = useNavigate()

    useEffect(() => {
        // Check for password recovery token
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = hashParams.get('access_token')

        if (!accessToken) {
            setError(t('auth.invalid_token'))
        }
    }, [])

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')
        setSuccess(false)

        // Validation
        if (password.length < 6) {
            setError(t('auth.min_6_chars'))
            setLoading(false)
            return
        }

        if (password !== confirmPassword) {
            setError(t('superadmin.password_mismatch'))
            setLoading(false)
            return
        }

        try {
            const { error } = await supabase.auth.updateUser({
                password: password
            })

            if (error) throw error

            setSuccess(true)

            // Redirect to login after 2 seconds
            setTimeout(() => {
                navigate('/login')
            }, 2000)
        } catch (error: any) {
            setError(error.message || t('common.error'))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-[#1a1d2e] rounded-xl p-8 border border-[#1e2139]">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                            <KeyRound className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-2">{t('superadmin.new_password')}</h1>
                        <p className="text-gray-500 text-sm">{t('auth.enter_new_password')}</p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3 text-red-400">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <span className="text-sm">{error}</span>
                        </div>
                    )}

                    {/* Success Message */}
                    {success && (
                        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-3 text-green-400">
                            <CheckCircle className="w-5 h-5 flex-shrink-0" />
                            <div className="text-sm">
                                <p className="font-medium mb-1">{t('superadmin.reset_success')}</p>
                                <p className="text-green-400/80">{t('auth.redirect_to_login')}</p>
                            </div>
                        </div>
                    )}

                    {!success && (
                        <form onSubmit={handleResetPassword} className="space-y-4">
                            {/* New Password Input */}
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Lock className="h-4 w-4 text-gray-500" />
                                </div>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder={t('superadmin.new_password')}
                                    required
                                    className="w-full pl-11 pr-11 py-3 bg-[#252941] border border-[#1e2139] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-white transition-colors"
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-4 w-4" />
                                    ) : (
                                        <Eye className="h-4 w-4" />
                                    )}
                                </button>
                            </div>

                            {/* Confirm Password Input */}
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Lock className="h-4 w-4 text-gray-500" />
                                </div>
                                <input
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder={t('superadmin.confirm_password')}
                                    required
                                    className="w-full pl-11 pr-11 py-3 bg-[#252941] border border-[#1e2139] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-white transition-colors"
                                >
                                    {showConfirmPassword ? (
                                        <EyeOff className="h-4 w-4" />
                                    ) : (
                                        <Eye className="h-4 w-4" />
                                    )}
                                </button>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
                            >
                                {loading ? (
                                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                                ) : (
                                    <span>{t('superadmin.reset_button')}</span>
                                )}
                            </button>
                        </form>
                    )}

                    {/* Footer */}
                    <div className="mt-6 text-center">
                        <button
                            onClick={() => navigate('/login')}
                            className="text-sm text-gray-500 hover:text-white transition-colors"
                        >
                            ← {t('superadmin.back_to_login')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
