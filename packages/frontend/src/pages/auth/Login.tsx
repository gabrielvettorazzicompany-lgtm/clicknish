import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Mail, Lock, AlertCircle, Loader, Download, Eye, EyeOff, User, Globe, CheckCircle } from 'lucide-react'
import InstallAppModal from '@/components/InstallAppModal'
import { useI18n } from '@/i18n'
import { prefetchPriorityRoutes } from '@/hooks/usePrefetch'

export default function Login() {
  const navigate = useNavigate()
  const { setUser } = useAuthStore()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [country, setCountry] = useState('+351')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [showInstallModal, setShowInstallModal] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [signUpSuccess, setSignUpSuccess] = useState(false)
  const [emailConfirmed, setEmailConfirmed] = useState(false)
  const { t, language } = useI18n()

  useEffect(() => {
    // Verificar se vem da confirmação de email
    if (searchParams.get('confirmed') === 'true') {
      setEmailConfirmed(true)

      // Preencher email automaticamente se vier da confirmação
      const confirmedEmail = searchParams.get('email')
      if (confirmedEmail) {
        setEmail(decodeURIComponent(confirmedEmail))
      }
    }
  }, [searchParams])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isSignUp) {
        // Validar campos de signup
        if (!fullName.trim()) {
          setError('Please enter your full name')
          setLoading(false)
          return
        }

        if (password !== confirmPassword) {
          setError('Passwords do not match')
          setLoading(false)
          return
        }

        if (password.length < 6) {
          setError('Password must be at least 6 characters')
          setLoading(false)
          return
        }

        // Process de signup
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              is_admin: true, // Marcar como admin no metadata
              full_name: fullName,
              country: country
            },
            emailRedirectTo: `${window.location.origin}/auth/confirm`
          }
        })

        if (authError) throw authError

        if (data.user) {
          // Enviar email customizado via Resend
          try {
            await fetch('https://api.clicknich.com/api/send-confirmation-email', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                email,
                fullName,
                token: data.user.id // Usar user ID como identificador
              }),
            })
          } catch (emailError) {
            console.error('Error sending custom email:', emailError)
            // Não falhar o signup se o email customizado falhar
          }

          // Mostrar mensagem de sucesso e pedir para verificar email
          setSignUpSuccess(true)
          setLoading(false)

          // Limpar campos do formulário
          setEmail('')
          setPassword('')
          setConfirmPassword('')
          setFullName('')
          setCountry('+351')
          return
        }
      } else {
        // Processo de login
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

        if (authError) throw authError

        if (data.user) {
          // Criar admin_profile se não existir (usuário confirmou email mas ainda não tem perfil)
          try {
            const { data: existingProfile } = await supabase
              .from('admin_profiles')
              .select('user_id')
              .eq('user_id', data.user.id)
              .single()

            if (!existingProfile) {
              const { error: profileError } = await supabase
                .from('admin_profiles')
                .insert({
                  user_id: data.user.id,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                })

              if (profileError) {
                console.error('Error creating admin_profile:', profileError)
              }
            }
          } catch (err) {
            console.error('Error checking admin_profile:', err)
          }

          setUser(data.user)
          // Salvar email no localStorage para uso no perfil
          if (data.user.email) {
            localStorage.setItem('userEmail', data.user.email)
          }
          // Prefetch rotas prioritárias em background
          prefetchPriorityRoutes()
          navigate('/dashboard')
        }
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Authentication failed'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 dark:from-[#050608] dark:via-[#0a0d14] dark:via-[#0f1520] dark:to-[#1a4a6c] flex items-center justify-center p-4 transition-colors duration-300">
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
        <div className="w-full bg-white dark:bg-gradient-to-br dark:from-[#151825] dark:via-[#1a2035] dark:via-50% dark:to-[#1a3050] bg-gradient-to-br from-white to-gray-50 rounded-lg shadow-2xl p-4 border border-gray-200 dark:border-[#2a4060] transition-colors duration-300">
          {/* Title */}
          {isSignUp && (
            <h2 className="text-base font-semibold text-gray-800 dark:text-white mb-4 text-center">
              Create your ClickNich account
            </h2>
          )}

          {/* Success Message - Email Verification */}
          {signUpSuccess && (
            <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-sm font-semibold text-green-400 mb-1">
                    Check your email!
                  </h3>
                  <p className="text-xs text-gray-300 leading-relaxed mb-2">
                    We've sent a confirmation link to your email address. Please click the link to verify your account and complete the registration.
                  </p>
                  <p className="text-xs text-gray-400">
                    Didn't receive the email? Check your spam folder.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Success Message - Email Confirmed */}
          {emailConfirmed && !isSignUp && (
            <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-sm font-semibold text-green-400 mb-1">
                    Email confirmed! ✓
                  </h3>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    Your account is verified. Just enter your password to sign in.
                  </p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <p className="text-red-400 text-xs">{error}</p>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-3">
            {/* Full Name - Only in Sign Up */}
            {isSignUp && (
              <div>
                <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors duration-200">
                  Full name
                </label>
                <div className="relative">
                  <User className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-3.5 h-3.5 transition-colors duration-200" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required={isSignUp}
                    className="w-full pl-8 pr-2.5 py-2 text-xs border border-gray-300 dark:border-[#252941] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all bg-gray-50 dark:bg-[#0f1117] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                    placeholder="John Doe"
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-[11px] font-medium text-gray-300 mb-1">
                {t('auth.email_label')}
              </label>
              <div className="relative">
                <Mail className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-3.5 h-3.5 transition-colors duration-200" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-8 pr-2.5 py-2 text-xs border border-gray-300 dark:border-[#252941] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all bg-gray-50 dark:bg-[#0f1117] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                  placeholder="your@email.com"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors duration-200">
                {t('auth.password_label')}
              </label>
              <div className="relative">
                <Lock className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-3.5 h-3.5 transition-colors duration-200" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-8 pr-9 py-2 text-xs border border-gray-300 dark:border-[#252941] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all bg-gray-50 dark:bg-[#0f1117] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
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
              {!isSignUp && (
                <button
                  type="button"
                  onClick={() => navigate('/auth/reset-password')}
                  className="mt-1 text-gray-400 hover:text-blue-400 text-xs transition-colors"
                >
                  {t('auth.forgot_password')}
                </button>
              )}
            </div>

            {/* Confirm Password - Only in Sign Up */}
            {isSignUp && (
              <div>
                <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors duration-200">
                  Confirm password
                </label>
                <div className="relative">
                  <Lock className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-3.5 h-3.5 transition-colors duration-200" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required={isSignUp}
                    className="w-full pl-8 pr-9 py-2 text-xs border border-gray-300 dark:border-[#252941] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all bg-gray-50 dark:bg-[#0f1117] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
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
            )}

            {/* Country - Only in Sign Up */}
            {isSignUp && (
              <div>
                <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors duration-200">
                  Country
                </label>
                <div className="relative">
                  <Globe className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-3.5 h-3.5 transition-colors duration-200" />
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    required={isSignUp}
                    className="w-full pl-8 pr-2.5 py-2 text-xs border border-gray-300 dark:border-[#252941] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all bg-gray-50 dark:bg-[#0f1117] text-gray-900 dark:text-white appearance-none cursor-pointer"
                  >
                    <option value="+351">🇵🇹 +351 Portugal</option>
                    <option value="+55">🇧🇷 +55 Brazil</option>
                    <option value="+1">🇺🇸 +1 United States</option>
                    <option value="+44">🇬🇧 +44 United Kingdom</option>
                    <option value="+34">🇪🇸 +34 Spain</option>
                    <option value="+33">🇫🇷 +33 France</option>
                    <option value="+49">🇩🇪 +49 Germany</option>
                    <option value="+41">🇨🇭 +41 Switzerland</option>
                    <option value="+39">🇮🇹 +39 Italy</option>
                    <option value="+91">🇮🇳 +91 India</option>
                    <option value="+86">🇨🇳 +86 China</option>
                    <option value="+81">🇯🇵 +81 Japan</option>
                    <option value="+82">🇰🇷 +82 South Korea</option>
                    <option value="+61">🇦🇺 +61 Australia</option>
                    <option value="+64">🇳🇿 +64 New Zealand</option>
                    <option value="+27">🇿🇦 +27 South Africa</option>
                    <option value="+52">🇲🇽 +52 Mexico</option>
                    <option value="+54">🇦🇷 +54 Argentina</option>
                    <option value="+56">🇨🇱 +56 Chile</option>
                  </select>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 text-xs bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/30 hover:shadow-xl hover:shadow-cyan-500/40"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-1.5">
                  <Loader className="w-3.5 h-3.5 animate-spin" />
                  {t('auth.processing')}
                </div>
              ) : (
                isSignUp ? t('auth.create_account') : t('auth.sign_in')
              )}
            </button>

            {/* Terms and Privacy - Only in Sign Up */}
            {isSignUp && (
              <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center">
                By creating your account you agree to the ClickNich{' '}
                <a href="/terms" className="text-blue-400 hover:text-blue-300 transition-colors">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="/privacy" className="text-blue-400 hover:text-blue-300 transition-colors">
                  Privacy Policy
                </a>.
              </p>
            )}
          </form>

          {/* Toggle between Login/SignUp */}
          <div className="mt-4 text-center">
            {isSignUp ? (
              <p className="text-gray-400 text-xs">
                Already have an account?{' '}
                <button
                  onClick={() => {
                    setIsSignUp(false)
                    setError('')
                    setSignUpSuccess(false)
                  }}
                  className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
                >
                  Sign in
                </button>
              </p>
            ) : (
              <button
                onClick={() => {
                  setIsSignUp(true)
                  setError('')
                  setSignUpSuccess(false)
                }}
                className="text-gray-400 hover:text-blue-400 text-xs font-medium transition-colors"
              >
                {t('auth.dont_have_account')}
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-5">
          <p className="text-gray-500 text-[10px]">
            {t('auth.manage_apps')}
          </p>
        </div>
      </div>

      {/* Installation Modal */}
      <InstallAppModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
        appName="Clicknich"
        language={language}
      />
    </div>
  )
}
