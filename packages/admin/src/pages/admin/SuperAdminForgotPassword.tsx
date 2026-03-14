import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/services/supabase'
import { useI18n } from '@/i18n'

export default function SuperAdminForgotPassword() {
    const { t } = useI18n()
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const navigate = useNavigate()

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')
        setSuccess(false)

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/super-login/reset-password`
            })

            if (error) throw error

            setSuccess(true)
        } catch (error: any) {
            setError(error.message || 'Error sending reset email')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-[#030712] flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background gradient effects */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-[40%] -left-[20%] w-[80%] h-[80%] rounded-full bg-gradient-to-br from-blue-600/20 via-blue-500/10 to-transparent blur-3xl" />
                <div className="absolute -bottom-[40%] -right-[20%] w-[80%] h-[80%] rounded-full bg-gradient-to-br from-indigo-600/20 via-purple-500/10 to-transparent blur-3xl" />
            </div>

            {/* Grid pattern overlay */}
            <div
                className="absolute inset-0 opacity-[0.02]"
                style={{
                    backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
                    backgroundSize: '50px 50px'
                }}
            />

            <div className="w-full max-w-md relative z-10">
                {/* Main Card */}
                <div className="backdrop-blur-xl bg-white/[0.02] rounded-3xl p-8 border border-white/[0.05] shadow-2xl">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="w-20 h-20 mx-auto mb-6 relative">
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 rounded-2xl rotate-6 opacity-80" />
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-400 via-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center">
                                <span className="text-3xl text-white font-bold">🔑</span>
                            </div>
                        </div>
                        <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">{t('superadmin.reset_password_title')}</h1>
                        <p className="text-gray-400 text-sm">{t('superadmin.forgot_subtitle')}</p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl backdrop-blur-sm">
                            <p className="text-red-400 text-sm text-center">{error}</p>
                        </div>
                    )}

                    {/* Success Message */}
                    {success && (
                        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl backdrop-blur-sm">
                            <div className="text-center">
                                <p className="text-2xl mb-2">✅</p>
                                <p className="text-green-400 font-medium mb-1">{t('superadmin.email_sent')}</p>
                                <p className="text-green-400/70 text-sm">{t('superadmin.check_inbox')}</p>
                            </div>
                        </div>
                    )}

                    {!success ? (
                        <form onSubmit={handleResetPassword} className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-300 block">{t('superadmin.email')}</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="admin@example.com"
                                    required
                                    className="w-full px-4 py-3.5 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all text-sm backdrop-blur-sm"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-4 bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 hover:from-blue-400 hover:via-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98]"
                            >
                                {loading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <span>{t('superadmin.send_reset')}</span>
                                )}
                            </button>
                        </form>
                    ) : (
                        <button
                            onClick={() => navigate('/login')}
                            className="w-full py-4 bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 text-white font-semibold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25"
                        >
                            {t('superadmin.back_to_login')}
                        </button>
                    )}

                    {/* Footer */}
                    <div className="mt-8 pt-6 border-t border-white/[0.05]">
                        <button
                            onClick={() => navigate('/login')}
                            className="w-full text-center text-sm text-gray-500 hover:text-gray-300 transition-colors"
                        >
                            ← {t('superadmin.back_to_login')}
                        </button>
                    </div>
                </div>

                <p className="text-center text-gray-600 text-xs mt-6">
                    {t('superadmin.protected_area')}
                </p>
            </div>
        </div>
    )
}
