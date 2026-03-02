import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/services/supabase'
import { useI18n } from '@/i18n'
import { Mail, Lock, AlertCircle, Loader, Shield } from 'lucide-react'

export default function SuperAdminLogin() {
    const { t } = useI18n()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const navigate = useNavigate()
    const { setUser, setLoading: setAuthLoading } = useAuthStore()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            })

            if (error) throw error

            if (data.user) {
                setUser(data.user)
                setAuthLoading(false)
                navigate('/superadmin')
            }
        } catch (error: any) {
            setError(error.message || t('superadmin.login_error'))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#050608] via-[#0a0d14] via-30% via-[#0f1520] via-60% to-[#1a4a6c] flex items-center justify-center p-4">
            <div className="w-full max-w-xs flex flex-col items-center">
                {/* Header */}
                <div className="text-center mb-4 w-full flex flex-col items-center">
                    <h1 className="text-lg font-bold text-white">{t('superadmin.admin_panel')}</h1>
                    <p className="text-gray-500 text-[10px]">{t('superadmin.platform_administration')}</p>
                </div>

                {/* Form Card */}
                <div className="w-full bg-gradient-to-br from-[#151825] via-[#1a2035] via-50% to-[#1a3050] rounded-lg shadow-2xl p-4 border border-[#2a4060]">
                    {error && (
                        <div className="mb-4 p-2.5 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-blue-400" />
                            <p className="text-blue-400 text-xs">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-3">
                        {/* Email */}
                        <div>
                            <label className="block text-[11px] font-medium text-gray-300 mb-1">
                                {t('superadmin.email')}
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-500 w-3.5 h-3.5" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="w-full pl-8 pr-2.5 py-2 text-xs border border-[#252941] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all bg-[#0f1117] text-white placeholder-gray-500"
                                    placeholder="admin@example.com"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-[11px] font-medium text-gray-300 mb-1">
                                {t('superadmin.password')}
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-500 w-3.5 h-3.5" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="w-full pl-8 pr-2.5 py-2 text-xs border border-[#252941] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all bg-[#0f1117] text-white placeholder-gray-500"
                                    placeholder="••••••••"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => navigate('/super-login/forgot-password')}
                                className="mt-1 text-gray-400 hover:text-blue-400 text-xs transition-colors"
                            >
                                {t('superadmin.forgot_password')}
                            </button>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-2 text-xs bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-semibold rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40"
                        >
                            {loading ? (
                                <div className="flex items-center justify-center gap-1.5">
                                    <Loader className="w-3.5 h-3.5 animate-spin" />
                                    {t('superadmin.logging_in')}
                                </div>
                            ) : (
                                t('superadmin.login_button')
                            )}
                        </button>
                    </form>

                    {/* Back Link */}
                    <div className="mt-4 text-center">
                        <button
                            onClick={() => navigate('/')}
                            className="text-gray-400 hover:text-blue-400 text-xs font-medium transition-colors"
                        >
                            ← {t('superadmin.back_to_home')}
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center mt-5">
                    <p className="text-gray-500 text-[10px]">
                        {t('superadmin.protected_area')}
                    </p>
                </div>
            </div>
        </div>
    )
}