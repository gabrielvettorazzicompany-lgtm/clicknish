import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/services/supabase'
import { useI18n, Language } from '@/i18n'
import { Mail, Lock, AlertCircle, Loader, CheckCircle, ArrowLeft, Eye, EyeOff, Languages } from 'lucide-react'
import { useAutoLanguageDetection } from '@/hooks/useLanguageDetection'
import { SUPPORTED_LANGUAGES } from '@/services/languageDetection'

export default function ResetPassword() {
    const { t, language, setLanguage } = useI18n()
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const [stage, setStage] = useState<'request' | 'reset'>('request')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [loading, setLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [showLanguageSelector, setShowLanguageSelector] = useState(false)

    // Detecção automática de idioma por IP
    const { isDetecting: isDetectingLanguage } = useAutoLanguageDetection((detectedLanguage) => {
        // Só aplicar a detecção se o usuário ainda não interagiu com o seletor
        const hasUserSelectedLanguage = localStorage.getItem('huskyapp_user_selected_language')
        if (!hasUserSelectedLanguage && detectedLanguage !== language) {
            setLanguage(detectedLanguage)
            console.log(`Idioma detectado automaticamente: ${detectedLanguage}`)
        }
    })

    const handleLanguageChange = (newLanguage: Language) => {
        setLanguage(newLanguage)
        setShowLanguageSelector(false)
        // Marcar que o usuário selecionou um idioma manualmente
        localStorage.setItem('huskyapp_user_selected_language', 'true')
    }

    const handleRequestReset = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setSuccess('')
        setLoading(true)



        try {
            const apiBase = 'https://api.clicknich.com/api'

            const res = await fetch(`${apiBase}/request-password-reset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, language })
            })

            if (!res.ok) {
                const body = await res.json().catch(() => ({ error: 'Failed to send reset email' }))
                console.error('❌ Erro na requisição:', body)
                throw new Error(body.error || 'Failed to send reset email')
            }


            setSuccess(t('auth.email_sent_desc'))
            setEmail('')
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to send reset email'
            setError(errorMessage)
        } finally {
            setLoading(false)
        }
    }

    const [recoveryTokenValue, setRecoveryTokenValue] = useState<string | null>(null)

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setSuccess('')



        if (password !== confirmPassword) {
            setError(t('auth.password_mismatch'))
            return
        }

        if (password.length < 6) {
            setError(t('auth.min_6_chars'))
            return
        }

        if (!recoveryTokenValue) {
            setError(t('auth.invalid_missing_token'))
            return
        }

        setLoading(true)

        try {
            const apiBase = 'https://api.clicknich.com/api'

            const res = await fetch(`${apiBase}/confirm-reset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: recoveryTokenValue, password })
            })

            const body = await res.json().catch(() => ({}))
            if (!res.ok) {
                console.error('❌ Erro ao resetar senha:', body)
                throw new Error(body.error || 'Failed to reset password')
            }


            setSuccess(t('auth.password_updated'))
            setTimeout(() => navigate('/auth/login'), 2000)
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to reset password'
            setError(errorMessage)
        } finally {
            setLoading(false)
        }
    }

    // Check if we have a recovery token
    // Look for token query parameter (our flow uses `token` and `type=recovery`)
    const recoveryToken = searchParams.get('token')
    const type = searchParams.get('type')

    useEffect(() => {
        if (recoveryToken && type === 'recovery') {

            setStage('reset')
            setRecoveryTokenValue(recoveryToken)
        } else {

        }
    }, [recoveryToken, type])

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#050608] via-[#0a0d14] via-30% via-[#0f1520] via-60% to-[#1a4a6c] flex items-center justify-center p-4">
            <div className="w-full max-w-xs flex flex-col items-center">
                {/* Logo and Header */}
                <div className="text-center mb-4 w-full flex flex-col items-center">
                    <img
                        src="/logoo.png"
                        alt="Clicknich"
                        className="h-36 -mb-6 object-contain"
                    />
                </div>

                {/* Form Card */}
                <div className="w-full bg-gradient-to-br from-[#151825] via-[#1a2035] via-50% to-[#1a3050] rounded-lg shadow-2xl p-4 border border-[#2a4060]">
                    {error && (
                        <div className="mb-4 p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-red-400" />
                            <p className="text-red-400 text-xs">{error}</p>
                        </div>
                    )}

                    {success && (
                        <div className="mb-4 p-2.5 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-400" />
                            <p className="text-green-400 text-xs">{success}</p>
                        </div>
                    )}

                    {stage === 'request' ? (
                        <form onSubmit={handleRequestReset} className="space-y-3">
                            <div className="mb-4">
                                <h2 className="text-sm font-semibold text-gray-100 mb-1">{t('auth.reset_password')}</h2>
                                <p className="text-xs text-gray-500">{t('auth.enter_email_reset')}</p>
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block text-[11px] font-medium text-gray-300 mb-1">
                                    {t('common.email')}
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-500 w-3.5 h-3.5" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="w-full pl-8 pr-2.5 py-2 text-xs border border-[#252941] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all bg-[#0f1117] text-white placeholder-gray-500"
                                        placeholder={t('auth.email_placeholder')}
                                    />
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-2 text-xs bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/30 hover:shadow-xl hover:shadow-cyan-500/40"
                            >
                                {loading ? (
                                    <div className="flex items-center justify-center gap-1.5">
                                        <Loader className="w-3.5 h-3.5 animate-spin" />
                                        {t('auth.sending')}
                                    </div>
                                ) : (
                                    t('auth.send_reset_link')
                                )}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleResetPassword} className="space-y-3">
                            <div className="mb-4">
                                <h2 className="text-sm font-semibold text-gray-100 mb-1">{t('auth.create_new_password')}</h2>
                                <p className="text-xs text-gray-500">{t('auth.enter_new_password_below')}</p>
                            </div>

                            {/* New Password */}
                            <div>
                                <label className="block text-[11px] font-medium text-gray-300 mb-1">
                                    {t('auth.new_password')}
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-500 w-3.5 h-3.5" />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="w-full pl-8 pr-9 py-2 text-xs border border-[#252941] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all bg-[#0f1117] text-white placeholder-gray-500"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                    </button>
                                </div>
                            </div>

                            {/* Confirm Password */}
                            <div>
                                <label className="block text-[11px] font-medium text-gray-300 mb-1">
                                    {t('auth.confirm_password')}
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-500 w-3.5 h-3.5" />
                                    <input
                                        type={showConfirmPassword ? "text" : "password"}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        className="w-full pl-8 pr-9 py-2 text-xs border border-[#252941] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all bg-[#0f1117] text-white placeholder-gray-500"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                                    >
                                        {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                    </button>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-2 text-xs bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/30 hover:shadow-xl hover:shadow-cyan-500/40"
                            >
                                {loading ? (
                                    <div className="flex items-center justify-center gap-1.5">
                                        <Loader className="w-3.5 h-3.5 animate-spin" />
                                        {t('auth.updating')}
                                    </div>
                                ) : (
                                    t('auth.update_password')
                                )}
                            </button>
                        </form>
                    )}

                    {/* Back to Login */}
                    <div className="mt-4 text-center">
                        <button
                            onClick={() => navigate('/auth/login')}
                            className="text-gray-400 hover:text-blue-400 text-xs font-medium transition-colors flex items-center justify-center gap-1 mx-auto"
                        >
                            <ArrowLeft className="w-3 h-3" />
                            {t('auth.back_to_login')}
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center mt-5">
                    <p className="text-gray-500 text-[10px]">
                        {t('auth.manage_apps')}
                    </p>
                </div>
            </div>
        </div>
    )
}
