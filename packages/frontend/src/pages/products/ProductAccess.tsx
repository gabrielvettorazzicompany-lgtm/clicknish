import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Mail, Key, AlertCircle, Loader, Lock } from 'lucide-react'
import InstallAppModal from '@/components/InstallAppModal'
import { getTranslation, type Language } from '@/locales/translations'
import { useI18n } from '@/i18n'

interface ProductAccess {
  product_id: string
  product_name: string
  app_name: string
  logo_url?: string
  access_type: 'email-only' | 'email-password' | 'purchase-code' | 'no-login'
  welcome_message?: string
  language: string
  free_registration?: boolean
  app_theme?: 'light' | 'dark'
  theme: {
    primary_color: string
    secondary_color: string
    background_gradient: string
  }
}

export default function ProductAccess() {
  const { appSlug, productSlug } = useParams()
  const navigate = useNavigate()
  const { t } = useI18n()

  const [productAccess, setProductAccess] = useState<ProductAccess | null>(null)
  const [appId, setAppId] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [purchaseCode, setPurchaseCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [showInstallModal, setShowInstallModal] = useState(false)

  useEffect(() => {
    fetchProductAccess()
  }, [appSlug, productSlug])

  // Redirect automatically if login is not required
  useEffect(() => {
    if (productAccess?.access_type === 'no-login' && appId) {
      // Perform anonymous login via API
      handleAnonymousLogin()
    }
  }, [productAccess, appId, navigate])

  const handleAnonymousLogin = async () => {
    try {
      const response = await fetch('https://app.clicknich.com/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: `anonymous_${Date.now()}@app.local`,
          appId: appId,
          access_type: 'no-login'
        }),
      })

      if (response.ok) {
        const data = await response.json()
        localStorage.setItem('access_token', data.access_token)
        localStorage.setItem('refresh_token', data.refresh_token)
        localStorage.setItem('user_data', JSON.stringify(data.user))
        localStorage.setItem('app_language', data.preferences?.language || productAccess?.language || 'pt-br')
        localStorage.setItem('session_expires', data.expires_at)
        navigate(`/app/${appId}`)
      }
    } catch {
      // Silent fail for anonymous login
    }
  }

  const fetchProductAccess = async () => {
    try {
      setPageLoading(true)

      // If there is no specific productSlug, show general app access page
      // which will then redirect to dashboard with all products

      // Fetch real app information
      try {
        const appResponse = await supabaseFetch(`apps/slug/${appSlug}`)
        let appData = null

        if (appResponse.ok) {
          appData = await appResponse.json()

          setAppId(appData.id)
        }

        // Buscar informações do produto se existe um slug específico
        let productData = null
        if (productSlug) {
          try {
            const productResponse = await fetch(`https://app.clicknich.com/api/apps/${appSlug}/products/${productSlug}`)
            if (productResponse.ok) {
              productData = await productResponse.json()
            }
          } catch {
            // Use app data if product fetch fails
          }
        }

        // Mapear app_type do banco para access_type do frontend
        const mapAccessType = (appType: string) => {

          switch (appType) {
            case 'login-simple': return 'email-only'
            case 'login-complete': return 'email-password'
            case 'no-login': return 'no-login'
            case 'login-code': return 'purchase-code'
            default: return 'email-password'
          }
        }

        // Usar dados reais do app ou fallback para mock
        const lang = (appData?.language || 'pt-br') as Language
        const productAccess: ProductAccess = {
          product_id: productData?.id || '1',
          product_name: productData?.name || appData?.name || (productSlug ? 'Produto' : 'Todos os Produtos'),
          app_name: appData?.name || 'Aplicativo',
          logo_url: appData?.logo_url,
          access_type: mapAccessType(appData?.app_type || 'login-complete'),
          language: appData?.language || 'pt-br',
          free_registration: appData?.free_registration ?? false,
          app_theme: appData?.theme || 'light',
          welcome_message: productSlug ?
            getTranslation(lang, 'welcomeMessage', { productName: productData?.name || 'o produto' }) :
            getTranslation(lang, 'welcomeMessageAll', { appName: appData?.name || 'a plataforma' }),
          theme: {
            primary_color: appData?.primary_color || '#2563eb',
            secondary_color: appData?.secondary_color || '#7c3aed',
            background_gradient: appData?.theme === 'dark' ? 'from-gray-900 to-gray-700' : 'from-blue-500 to-blue-700'
          }
        }

        setProductAccess(productAccess)
      } catch {
        setError(t('common.app_not_found'))
      }
    } catch {
      setError(t('common.app_not_found'))
    } finally {
      setPageLoading(false)
    }
  }

  const handleAccess = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const lang = (productAccess?.language || 'pt-br') as Language

    try {
      // Validações básicas
      if (productAccess?.access_type === 'email-password' && (!email || !password)) {
        setError(getTranslation(lang, 'errorPasswordRequired'))
        setLoading(false)
        return
      }

      if (productAccess?.access_type === 'purchase-code' && !purchaseCode) {
        setError(getTranslation(lang, 'errorCodeRequired'))
        setLoading(false)
        return
      }

      // Fazer login real via API
      const response = await supabaseFetch('apps/verify-access', {
        method: 'POST',
        body: JSON.stringify({
          email: email || purchaseCode,
          password: password || undefined,
          appId: appId,
          access_type: productAccess?.access_type
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        setError(errorData.error || getTranslation(lang, 'errorAccess'))
        setLoading(false)
        return
      }

      const data = await response.json()

      // Salvar tokens e dados no localStorage
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)
      localStorage.setItem('user_data', JSON.stringify(data.user))
      localStorage.setItem('app_language', data.preferences?.language || productAccess?.language || 'pt-br')
      localStorage.setItem('session_expires', data.expires_at)

      // Redirecionar para o dashboard do app
      if (appId) {
        navigate(`/app/${appId}`)
      } else {
        console.error('AppId not found')
        setError(t('common.error_accessing_app'))
      }
    } catch (err: unknown) {
      setError(getTranslation(lang, 'errorAccess'))
    } finally {
      setLoading(false)
    }
  }

  const handleFreeSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const lang = (productAccess?.language || 'pt-br') as Language

    try {
      if (!email) {
        setError(t('common.enter_email_free'))
        setLoading(false)
        return
      }

      // Create free account via API
      const response = await supabaseFetch('apps/free-signup', {
        method: 'POST',
        body: JSON.stringify({
          email,
          appId: appId
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        setError(errorData.error || t('common.error_free_account'))
        setLoading(false)
        return
      }

      const data = await response.json()

      // Salvar tokens e dados no localStorage
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)
      localStorage.setItem('user_data', JSON.stringify(data.user))
      localStorage.setItem('app_language', data.preferences?.language || productAccess?.language || 'pt-br')
      localStorage.setItem('session_expires', data.expires_at)

      // Redirect to app dashboard
      if (appId) {
        navigate(`/app/${appId}`)
      } else {
        setError(t('common.error_accessing_app'))
      }
    } catch {
      setError(t('common.error_free_account'))
    } finally {
      setLoading(false)
    }
  }

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center p-6">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>{getTranslation('pt-br', 'errorLoading')}</p>
        </div>
      </div>
    )
  }

  if (!productAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-[#1a1d2e] rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-100 mb-2">{getTranslation('pt-br', 'errorNotFound')}</h1>
          <p className="text-gray-600">{getTranslation('pt-br', 'errorNotFoundDescription')}</p>
        </div>
      </div>
    )
  }

  // Layout com suporte a tema Dark/Light
  const lang = (productAccess.language || 'pt-br') as Language
  const isDark = productAccess.app_theme === 'dark'

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${isDark ? 'bg-gradient-to-br from-[#050608] via-[#0a0d14] via-30% via-[#0f1520] via-60% to-[#1a4a6c]' : 'bg-gradient-to-br from-blue-50 via-blue-50 to-blue-100'}`}>
      <div className="w-full max-w-xs flex flex-col items-center">
        {/* Logo e Header */}
        <div className="text-center mb-4 w-full flex flex-col items-center">
          {productAccess.logo_url ? (
            <img
              src={productAccess.logo_url}
              alt={productAccess.app_name}
              className="h-20 w-20 -mb-2 object-contain rounded-2xl"
            />
          ) : (
            <div className="h-20 w-20 -mb-2 rounded-2xl flex items-center justify-center text-white text-3xl font-bold bg-gradient-to-r from-blue-500 to-blue-600">
              {productAccess.app_name.charAt(0)}
            </div>
          )}
          <h1 className={`text-xl font-bold mt-4 ${isDark ? 'text-white' : 'text-gray-800'}`}>{productAccess.app_name}</h1>
          <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{productAccess.welcome_message}</p>
        </div>

        {/* Form Card */}
        <div className={`w-full rounded-lg shadow-2xl p-4 border ${isDark ? 'bg-gradient-to-br from-[#151825] via-[#1a2035] via-50% to-[#1a3050] border-[#2a4060]' : 'bg-white border-gray-200 shadow-lg'}`}>
          {error && (
            <div className="mb-4 p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <p className="text-red-400 text-xs">{error}</p>
            </div>
          )}

          <form onSubmit={handleAccess} className="space-y-3">
            {/* Email Field */}
            {(productAccess.access_type === 'email-password' || productAccess.access_type === 'email-only') && (
              <div>
                <label className={`block text-[11px] font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  {getTranslation(lang, 'yourEmail')}
                </label>
                <div className="relative">
                  <Mail className={`absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={`w-full pl-8 pr-2.5 py-2 text-xs border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all ${isDark ? 'border-[#252941] bg-[#0f1117] text-white placeholder-gray-500' : 'border-gray-200 bg-gray-50 text-gray-800 placeholder-gray-400'}`}
                    placeholder={getTranslation(lang, 'enterEmail')}
                  />
                </div>
              </div>
            )}

            {/* Password Field */}
            {productAccess.access_type === 'email-password' && (
              <div>
                <label className={`block text-[11px] font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  {getTranslation(lang, 'yourPassword')}
                </label>
                <div className="relative">
                  <Lock className={`absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className={`w-full pl-8 pr-2.5 py-2 text-xs border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all ${isDark ? 'border-[#252941] bg-[#0f1117] text-white placeholder-gray-500' : 'border-gray-200 bg-gray-50 text-gray-800 placeholder-gray-400'}`}
                    placeholder="••••••••"
                  />
                </div>
              </div>
            )}

            {/* Purchase Code Field */}
            {productAccess.access_type === 'purchase-code' && (
              <div>
                <label className={`block text-[11px] font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  {getTranslation(lang, 'purchaseCode')}
                </label>
                <div className="relative">
                  <Key className={`absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                  <input
                    type="text"
                    value={purchaseCode}
                    onChange={(e) => setPurchaseCode(e.target.value)}
                    required
                    className={`w-full pl-8 pr-2.5 py-2 text-xs border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all ${isDark ? 'border-[#252941] bg-[#0f1117] text-white placeholder-gray-500' : 'border-gray-200 bg-gray-50 text-gray-800 placeholder-gray-400'}`}
                    placeholder={getTranslation(lang, 'enterCode')}
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 text-xs text-white font-semibold rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 shadow-blue-500/30 hover:shadow-blue-500/40"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-1.5">
                  <Loader className="w-3.5 h-3.5 animate-spin" />
                  {getTranslation(lang, 'accessing')}
                </div>
              ) : (
                getTranslation(lang, 'access')
              )}
            </button>
          </form>

          {/* Free Registration Link */}
          {productAccess.free_registration && (
            <div className="mt-4 text-center">
              <button
                onClick={handleFreeSignup}
                disabled={loading || !email}
                className={`text-xs font-medium transition-colors disabled:opacity-50 ${isDark ? 'text-gray-400 hover:text-blue-400' : 'text-gray-500 hover:text-blue-500'}`}
              >
                {getTranslation(lang, 'noAccount')} {getTranslation(lang, 'createFreeAccount')}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-5">
          <p className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            © 2026 {productAccess.app_name}. {getTranslation(lang, 'allRightsReserved')}
          </p>
        </div>
      </div>

      {/* Installation Modal */}
      <InstallAppModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
        appName={productAccess.app_name}
      />
    </div>
  )
}