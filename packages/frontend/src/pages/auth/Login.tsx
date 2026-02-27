import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Mail, Lock, AlertCircle, Loader, Download, Eye, EyeOff } from 'lucide-react'
import InstallAppModal from '@/components/InstallAppModal'
import { useI18n } from '@/i18n'
import { prefetchPriorityRoutes } from '@/hooks/usePrefetch'

export default function Login() {
  const navigate = useNavigate()
  const { setUser } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [showInstallModal, setShowInstallModal] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const { t, language } = useI18n()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isSignUp) {
        // Process de signup
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              is_admin: true // Marcar como admin no metadata
            }
          }
        })

        if (authError) throw authError

        if (data.user) {
          // Aguadar um pouco para garantir que a sessão está estabelecida
          await new Promise(resolve => setTimeout(resolve, 1000))

          // Criar admin_profile básico para novos usuários do painel administrativo
          try {
            const { error: profileError } = await supabase
              .from('admin_profiles')
              .upsert({ // Usar upsert para evitar conflitos
                user_id: data.user.id,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'user_id' // Ignorar se já existe
              })

            if (profileError) {
              console.error('Erro ao criar admin_profile:', profileError)
              setError(`Conta criada, mas houve um problema ao configurar o perfil. Entre em contato com o suporte. Erro: ${profileError.message}`)
              setLoading(false)
              return
            }
          } catch (profileErr: any) {
            console.error('Fetch error ao criar admin_profile:', profileErr)
            setError('Conta criada, mas houve um problema ao configurar o perfil. Tente fazer login.')
            setLoading(false)
            return
          }

          setUser(data.user)

          // Salvar email no localStorage para uso no perfil
          if (data.user.email) {
            localStorage.setItem('userEmail', data.user.email)
          }

          // Verificar se precisa confirmar email
          if (!data.session) {
            setError('Conta criada com sucesso! Por favor, verifique seu email para confirmar a conta antes de fazer login.')
            setLoading(false)
            return
          }

          // Prefetch rotas prioritárias em background
          prefetchPriorityRoutes()
          navigate('/dashboard')
        }
      } else {
        // Processo de login
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

        if (authError) throw authError

        if (data.user) {
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
          {error && (
            <div className="mb-4 p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <p className="text-red-400 text-xs">{error}</p>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-3">
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
              <button
                type="button"
                onClick={() => navigate('/auth/reset-password')}
                className="mt-1 text-gray-400 hover:text-blue-400 text-xs transition-colors"
              >
                {t('auth.forgot_password')}
              </button>
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
                  {t('auth.processing')}
                </div>
              ) : (
                isSignUp ? t('auth.create_account') : t('auth.sign_in')
              )}
            </button>
          </form>

          {/* Toggle between Login/SignUp */}
          <div className="mt-4 text-center">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp)
                setError('')
              }}
              className="text-gray-400 hover:text-blue-400 text-xs font-medium transition-colors"
            >
              {isSignUp
                ? t('auth.already_have_account')
                : t('auth.dont_have_account')
              }
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
