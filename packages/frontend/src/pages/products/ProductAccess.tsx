import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Mail, Key, AlertCircle, Loader, Lock, Download, X, Smartphone, CheckCircle, Chrome, Globe } from 'lucide-react'
import InstallAppModal from '@/components/InstallAppModal'
import { getTranslation, type Language } from '@/locales/translations'
import { useI18n } from '@/i18n'
import { supabase, supabaseFetch } from '@/services/supabase'

// Interface para o evento beforeinstallprompt
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// Tipos de navegadores
type BrowserType = 'chrome' | 'edge' | 'samsung' | 'firefox' | 'safari' | 'opera' | 'brave' | 'unknown'

// Detectar navegador específico
const getBrowserInfo = (): BrowserType => {
  const ua = navigator.userAgent

  if (/SamsungBrowser/i.test(ua)) return 'samsung'
  if (/Edg/i.test(ua)) return 'edge'
  if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) return 'chrome'
  if (/Firefox/i.test(ua)) return 'firefox'
  if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return 'safari'
  if (/OPR|Opera/i.test(ua)) return 'opera'
  if (/Brave/i.test(ua)) return 'brave'

  return 'unknown'
}

// Verificar se navegador suporta instalação PWA no Android
const browserSupportsInstall = (browser: BrowserType): boolean => {
  return ['chrome', 'edge', 'samsung', 'opera', 'brave'].includes(browser)
}

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
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [showInstallSuccess, setShowInstallSuccess] = useState(false)
  const [showBrowserWarning, setShowBrowserWarning] = useState(false)
  const [warningMessage, setWarningMessage] = useState<'incompatible' | 'waiting' | 'generic'>('incompatible')
  const [canInstallPWA, setCanInstallPWA] = useState(false)
  const [isAppInstalled, setIsAppInstalled] = useState(false)
  const [browserInfo, setBrowserInfo] = useState<BrowserType>('unknown')
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null)

  // Detectar se é mobile
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const isAndroid = /Android/.test(navigator.userAgent)

  // Atualizar manifest dinamicamente com dados do app/produto
  useEffect(() => {
    if (!productAccess) return

    try {
      // Criar manifest JSON dinâmico específico para este app/produto
      const manifest = {
        name: productAccess.app_name,
        short_name: productAccess.app_name,
        description: productAccess.welcome_message || `Acesso ao ${productAccess.app_name}`,
        start_url: `/app/${appSlug}${productSlug ? `/${productSlug}` : ''}`,
        scope: `/app/${appSlug}/`,
        display: 'standalone',
        background_color: productAccess.theme.primary_color || '#080b14',
        theme_color: productAccess.theme.primary_color || '#080b14',
        orientation: 'portrait-primary',
        icons: [
          {
            src: productAccess.logo_url || '/pw.jpg',
            sizes: '192x192',
            type: productAccess.logo_url ? 'image/png' : 'image/jpeg',
            purpose: 'any maskable'
          },
          {
            src: productAccess.logo_url || '/pw.jpg',
            sizes: '512x512',
            type: productAccess.logo_url ? 'image/png' : 'image/jpeg',
            purpose: 'any maskable'
          }
        ],
        categories: ['education', 'productivity'],
        lang: productAccess.language || 'pt-BR'
      }

      // Converter para JSON e criar Blob
      const manifestBlob = new Blob([JSON.stringify(manifest)], { type: 'application/json' })
      const manifestURL = URL.createObjectURL(manifestBlob)

      // Atualizar ou criar link do manifest
      let manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement
      if (!manifestLink) {
        manifestLink = document.createElement('link')
        manifestLink.rel = 'manifest'
        document.head.appendChild(manifestLink)
      }

      // Guardar URL antigo para revogar depois
      const oldHref = manifestLink.href

      // Atualizar href do manifest
      manifestLink.href = manifestURL

      // Atualizar meta theme-color também
      let themeColorMeta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement
      if (!themeColorMeta) {
        themeColorMeta = document.createElement('meta')
        themeColorMeta.name = 'theme-color'
        document.head.appendChild(themeColorMeta)
      }
      themeColorMeta.content = productAccess.theme.primary_color || '#080b14'

      // Atualizar apple-touch-icon para iOS
      let appleTouchIcon = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement
      if (!appleTouchIcon) {
        appleTouchIcon = document.createElement('link')
        appleTouchIcon.rel = 'apple-touch-icon'
        document.head.appendChild(appleTouchIcon)
      }
      appleTouchIcon.href = productAccess.logo_url || '/pw.jpg'

      // Atualizar título da página
      document.title = `${productAccess.app_name} - ${productAccess.product_name}`

      console.log('[PWA Debug] Manifest dinâmico criado:', manifest)
      console.log('[PWA Debug] Manifest URL:', manifestURL)

      // Cleanup: revogar URL antigo quando componente desmontar
      return () => {
        if (oldHref && oldHref.startsWith('blob:')) {
          URL.revokeObjectURL(oldHref)
        }
        URL.revokeObjectURL(manifestURL)
      }
    } catch (err) {
      console.error('[PWA Debug] Erro ao criar manifest dinâmico:', err)
    }
  }, [productAccess, appSlug, productSlug])

  // Detectar navegador e se app já está instalado
  useEffect(() => {
    const browser = getBrowserInfo()
    setBrowserInfo(browser)
    console.log('[PWA Debug] Navegador detectado:', browser)
    console.log('[PWA Debug] User Agent:', navigator.userAgent)

    // Verificar se app já está instalado
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      console.log('[PWA Debug] App já está instalado (rodando em standalone)')
      setIsAppInstalled(true)
      localStorage.setItem(`install_dismissed_${appSlug}`, 'installed')
    }

    // Para navegadores compatíveis, assumir que pode instalar após 3s se evento não disparar
    // Isso resolve problema onde beforeinstallprompt às vezes não dispara
    if (isAndroid && browserSupportsInstall(browser)) {
      const fallbackTimer = setTimeout(() => {
        if (!deferredPrompt.current && !isAppInstalled) {
          console.log('[PWA Debug] Fallback: Assumindo que PWA está disponível (navegador compatível)')
          setCanInstallPWA(true)
        }
      }, 4000)

      return () => clearTimeout(fallbackTimer)
    }
  }, [appSlug, isAndroid])

  // Capturar evento beforeinstallprompt para Android
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      deferredPrompt.current = e as BeforeInstallPromptEvent
      setCanInstallPWA(true)
      console.log('[PWA Debug] beforeinstallprompt disparado - PWA disponível!')
    }

    // Detectar quando app é instalado
    const handleAppInstalled = () => {
      console.log('[PWA Debug] App foi instalado com sucesso!')
      setIsAppInstalled(true)
      localStorage.setItem(`install_dismissed_${appSlug}`, 'installed')
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    // Timeout mais longo (3s) para detectar navegadores que não suportam PWA
    // Só marca como incompatível se for navegador conhecido como incompatível
    const timeout = setTimeout(() => {
      if (!deferredPrompt.current && isAndroid) {
        const isIncompatibleBrowser = !browserSupportsInstall(browserInfo)
        if (isIncompatibleBrowser) {
          setCanInstallPWA(false)
          console.log(`[PWA Debug] Navegador ${browserInfo} não suporta instalação`)
        } else {
          console.log(`[PWA Debug] ${browserInfo} deveria suportar, mas evento não disparou ainda`)
        }
      }
    }, 3000)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
      clearTimeout(timeout)
    }
  }, [isAndroid, browserInfo, appSlug])

  // Mostrar popup de instalação automaticamente em mobile
  useEffect(() => {
    if (isMobile && productAccess && !pageLoading && !isAppInstalled) {
      const installDismissedKey = `install_dismissed_${appSlug}`
      const wasInstallDismissed = localStorage.getItem(installDismissedKey)

      // No Android, só mostrar se navegador suporta OU se ainda não detectamos
      // No iOS, sempre mostrar (instalação manual)
      const shouldShow = isIOS || (isAndroid && (canInstallPWA || browserSupportsInstall(browserInfo)))

      // Mostrar popup após 2 segundos (dar tempo para beforeinstallprompt disparar)
      if (!wasInstallDismissed && shouldShow) {
        const timer = setTimeout(() => {
          console.log('[PWA Debug] Mostrando popup de instalação')
          setShowInstallPrompt(true)
        }, 2000)

        return () => clearTimeout(timer)
      }
    }
  }, [isMobile, productAccess, pageLoading, appSlug, canInstallPWA, browserInfo, isIOS, isAndroid, isAppInstalled])

  const handleInstallClick = async () => {


    // No Android, usar o prompt nativo diretamente
    if (isAndroid) {
      // Se o prompt já está disponível, usar diretamente
      if (deferredPrompt.current) {
        try {
          console.log('[PWA Debug] Iniciando instalação...')
          await deferredPrompt.current.prompt()
          const { outcome } = await deferredPrompt.current.userChoice
          console.log('[PWA Debug] Resultado:', outcome)

          if (outcome === 'accepted') {
            localStorage.setItem(`install_dismissed_${appSlug}`, 'installed')
            setShowInstallPrompt(false)
            // Mostrar mensagem de sucesso
            setShowInstallSuccess(true)
            setTimeout(() => setShowInstallSuccess(false), 3000)
          } else {
            // Se recusou, apenas fechar o popup (vai aparecer de novo na próxima visita)
            setShowInstallPrompt(false)
          }
          deferredPrompt.current = null
        } catch (err) {
          // Se falhar, mostrar erro informativo
          console.error('[PWA Debug] Erro ao instalar:', err)
          setShowInstallPrompt(false)
        }
        return
      }

      // Prompt ainda não disponível - verificar se é navegador incompatível
      const isKnownIncompatible = !browserSupportsInstall(browserInfo)

      if (isKnownIncompatible) {
        // Navegador definitivamente não suporta (ex: Firefox)
        console.log('[PWA Debug] Navegador incompatível detectado:', browserInfo)
        setShowInstallPrompt(false)
        setWarningMessage('incompatible')
        setShowBrowserWarning(true)
        setTimeout(() => setShowBrowserWarning(false), 5000)
      } else {
        // Navegador compatível mas evento ainda não disparou
        // Verificar se app já está instalado
        if (isAppInstalled) {
          console.log('[PWA Debug] App já está instalado')
          setShowInstallPrompt(false)
          setShowInstallSuccess(true)
          setTimeout(() => setShowInstallSuccess(false), 3000)
          return
        }

        // Tentar abrir instruções manuais como fallback
        console.log('[PWA Debug] Navegador compatível mas prompt não disponível. Mostrando modal com instruções.')
        setShowInstallPrompt(false)
        setShowInstallModal(true)
      }
    } else {
      // No iOS, mostrar modal com instruções passo a passo
      setShowInstallPrompt(false)
      setShowInstallModal(true)
    }
  }

  const dismissInstallPrompt = () => {
    // Fecha o popup mas vai aparecer na próxima visita
    setShowInstallPrompt(false)
  }

  const closeInstallPrompt = () => {
    // Fecha sem marcar como dismissed (vai aparecer na próxima visita)
    setShowInstallPrompt(false)
  }

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
      const response = await supabaseFetch('auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: `anonymous_${Date.now()}@app.local`,
          appId: appId,
          access_type: 'no-login'
        }),
      })

      if (response.ok) {
        const data = await response.json()

        // Configurar sessão real do Supabase se tokens válidos
        if (data.access_token && data.refresh_token && !data.access_token.startsWith('member_')) {
          await supabase.auth.setSession({
            access_token: data.access_token,
            refresh_token: data.refresh_token
          })
        }

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

      // Fazer login via novo sistema de autenticação de clientes
      let loginResponse
      let isCustomerLogin = false

      // Para email-only e email-password, usar nosso sistema customizado
      if (productAccess?.access_type === 'email-only' || productAccess?.access_type === 'email-password') {
        isCustomerLogin = true

        // Gerar senha derivada para email-only (mesma lógica do backend)
        const derivedPassword = password || `derived_${(email || '').toLowerCase()}_${window.location.origin.includes('localhost') ? 'dev_key' : 'prod_key'}`

        loginResponse = await fetch('https://api.clicknich.com/api/customer-auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email.toLowerCase(),
            password: derivedPassword
          })
        })
      } else {
        // Para outros tipos (purchase-code), usar sistema antigo
        loginResponse = await supabaseFetch('auth/login', {
          method: 'POST',
          body: JSON.stringify({
            email: email || purchaseCode,
            password: password || undefined,
            appId: appId,
            access_type: productAccess?.access_type
          }),
        })
      }

      if (!loginResponse.ok) {
        const errorData = await loginResponse.json()
        setError(errorData.message || errorData.error || getTranslation(lang, 'errorAccess'))
        setLoading(false)
        return
      }

      const data = await loginResponse.json()

      if (isCustomerLogin) {
        // Sistema customizado: data.access_token é nosso JWT
        if (!data.success || !data.access_token) {
          setError(data.message || getTranslation(lang, 'errorAccess'))
          setLoading(false)
          return
        }

        // Salvar tokens customizados
        localStorage.setItem('customer_access_token', data.access_token)
        localStorage.setItem('customer_id', data.customer_id)
        localStorage.setItem('customer_email', data.email)
        localStorage.setItem('session_expires', new Date(Date.now() + (data.expires_in * 1000)).toISOString())
      } else {
        // Sistema antigo: data.access_token é do Supabase
        if (data.access_token && data.refresh_token && !data.access_token.startsWith('member_')) {
          await supabase.auth.setSession({
            access_token: data.access_token,
            refresh_token: data.refresh_token
          })
        }

        // Salvar tokens antigos
        localStorage.setItem('access_token', data.access_token)
        localStorage.setItem('refresh_token', data.refresh_token)
        localStorage.setItem('user_data', JSON.stringify(data.user))
        localStorage.setItem('session_expires', data.expires_at)
      }

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

      // Criar conta gratuita via novo sistema de autenticação
      const derivedPassword = `derived_${email.toLowerCase()}_${window.location.origin.includes('localhost') ? 'dev_key' : 'prod_key'}`

      const response = await fetch('https://api.clicknich.com/api/customer-auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.toLowerCase(),
          password: derivedPassword
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        setError(errorData.message || t('common.error_free_account'))
        setLoading(false)
        return
      }

      const data = await response.json()

      if (!data.success || !data.access_token) {
        setError(data.message || t('common.error_free_account'))
        setLoading(false)
        return
      }

      // Salvar tokens customizados
      localStorage.setItem('customer_access_token', data.access_token)
      localStorage.setItem('customer_id', data.customer_id)
      localStorage.setItem('customer_email', data.email)
      localStorage.setItem('session_expires', new Date(Date.now() + (data.expires_in * 1000)).toISOString())

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

        {/* Install App Button - only on iOS (Android uses auto popup) */}
        {(/iPad|iPhone|iPod/.test(navigator.userAgent)) && (
          <button
            onClick={() => setShowInstallModal(true)}
            className={`w-full mb-3 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-xs font-medium transition-all border ${isDark ? 'bg-[#151825]/80 border-[#2a4060] text-blue-400 hover:bg-[#1a2035] hover:border-blue-500/50' : 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100 hover:border-blue-300'}`}
          >
            <Download className="w-3.5 h-3.5" />
            {getTranslation(lang, 'installApp')}
          </button>
        )}

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

      {/* Install Success Message */}
      {showInstallSuccess && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-fadeIn">
          <div className={`flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl ${isDark ? 'bg-green-500/20 border border-green-500/30 text-green-400' : 'bg-green-50 border border-green-200 text-green-700'}`}>
            <CheckCircle className="w-5 h-5" />
            <span className="text-sm font-medium">{getTranslation(lang, 'installSuccess')}</span>
          </div>
        </div>
      )}

      {/* Browser Warning - Navegador incompatível */}
      {showBrowserWarning && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-fadeIn max-w-md w-full mx-4">
          <div className={`flex flex-col gap-2 px-5 py-4 rounded-xl shadow-2xl ${warningMessage === 'waiting'
            ? (isDark ? 'bg-blue-500/20 border border-blue-500/30' : 'bg-blue-50 border border-blue-200')
            : (isDark ? 'bg-orange-500/20 border border-orange-500/30' : 'bg-orange-50 border border-orange-200')
            }`}>
            <div className="flex items-center gap-3">
              {warningMessage === 'waiting' ? (
                <Loader className={`w-5 h-5 flex-shrink-0 animate-spin ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
              ) : (
                <Globe className={`w-5 h-5 flex-shrink-0 ${isDark ? 'text-orange-400' : 'text-orange-600'}`} />
              )}
              <div className="flex-1">
                <p className={`text-sm font-semibold ${warningMessage === 'waiting'
                  ? (isDark ? 'text-blue-400' : 'text-blue-700')
                  : (isDark ? 'text-orange-400' : 'text-orange-700')
                  }`}>
                  {warningMessage === 'waiting' ? 'Preparando instalação...' :
                    warningMessage === 'incompatible' ?
                      (browserInfo === 'firefox' ? 'Firefox não suporta instalação' : 'Navegador incompatível') :
                      'Aguarde um momento'}
                </p>
                <p className={`text-xs mt-1 ${warningMessage === 'waiting'
                  ? (isDark ? 'text-blue-300/80' : 'text-blue-600/80')
                  : (isDark ? 'text-orange-300/80' : 'text-orange-600/80')
                  }`}>
                  {warningMessage === 'waiting' ? 'Carregando recursos do app. Tentaremos novamente em instantes...' :
                    warningMessage === 'incompatible' ?
                      (browserInfo === 'firefox'
                        ? 'Abra este link no Chrome, Edge ou Samsung Internet para instalar o app'
                        : 'Use Chrome, Edge ou Samsung Internet para instalar este app') :
                      'O app ainda está carregando. Tente novamente em alguns segundos ou atualize a página.'}
                </p>
              </div>
              <button
                onClick={() => setShowBrowserWarning(false)}
                className={`p-1 rounded-full transition-colors ${warningMessage === 'waiting'
                  ? (isDark ? 'hover:bg-blue-500/20' : 'hover:bg-blue-100')
                  : (isDark ? 'hover:bg-orange-500/20' : 'hover:bg-orange-100')
                  }`}
              >
                <X className={`w-4 h-4 ${warningMessage === 'waiting'
                  ? (isDark ? 'text-blue-400' : 'text-blue-600')
                  : (isDark ? 'text-orange-400' : 'text-orange-600')
                  }`} />
              </button>
            </div>
            {warningMessage === 'incompatible' && browserInfo === 'firefox' && (
              <div className="flex items-center gap-2 mt-1 pl-8">
                <Chrome className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Recomendado: Google Chrome
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Install Prompt Popup - Aparece automaticamente em mobile */}
      {showInstallPrompt && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div
            className={`relative w-full max-w-sm rounded-2xl shadow-2xl p-5 animate-slideUp ${isDark
              ? 'bg-gradient-to-br from-[#1a1d2e] to-[#0f1117] border border-[#2a3050]'
              : 'bg-white border border-gray-200'
              }`}
          >
            {/* Close button */}
            <button
              onClick={closeInstallPrompt}
              className={`absolute -top-2 -right-2 p-1.5 rounded-full transition-colors shadow-lg ${isDark ? 'bg-[#1a1d2e] hover:bg-[#252941] text-gray-400 border border-[#2a3050]' : 'bg-white hover:bg-gray-100 text-gray-500 border border-gray-200'
                }`}
            >
              <X className="w-4 h-4" />
            </button>

            {/* Content */}
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className={`flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'
                }`}>
                {productAccess.logo_url ? (
                  <img
                    src={productAccess.logo_url}
                    alt={productAccess.app_name}
                    className="w-10 h-10 rounded-xl object-contain"
                  />
                ) : (
                  <Smartphone className={`w-7 h-7 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                )}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className={`font-semibold text-base ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {getTranslation(lang, 'installAppTitle')}
                  </h3>
                  {/* Badge de status do navegador (apenas Android) */}
                  {isAndroid && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${canInstallPWA || browserSupportsInstall(browserInfo)
                      ? (isDark ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-green-100 text-green-700 border border-green-200')
                      : (isDark ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-orange-100 text-orange-700 border border-orange-200')
                      }`}>
                      {canInstallPWA || browserSupportsInstall(browserInfo) ? '✓ Compatível' : '⚠ Incompatível'}
                    </span>
                  )}
                </div>
                <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {getTranslation(lang, 'installAppDescription')}
                </p>
                {/* Mensagem adicional para navegadores incompatíveis */}
                {isAndroid && !canInstallPWA && !browserSupportsInstall(browserInfo) && (
                  <p className={`text-[10px] mt-2 leading-relaxed ${isDark ? 'text-orange-400/80' : 'text-orange-600/80'}`}>
                    💡 Use Chrome, Edge ou Samsung Internet para instalar
                  </p>
                )}
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 mt-5">
              <button
                onClick={dismissInstallPrompt}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-medium transition-all ${isDark
                  ? 'bg-white/10 text-gray-300 hover:bg-white/20'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                {getTranslation(lang, 'notNow')}
              </button>
              <button
                onClick={handleInstallClick}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold text-white transition-all shadow-lg flex items-center justify-center gap-2 ${isAndroid && !canInstallPWA && !browserSupportsInstall(browserInfo)
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-orange-500/30'
                  : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-blue-500/30'
                  }`}
              >
                {isAndroid && !canInstallPWA && !browserSupportsInstall(browserInfo) ? (
                  <>
                    <Chrome className="w-3.5 h-3.5" />
                    Ver instruções
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    {getTranslation(lang, 'installNow')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )
      }

      {/* Installation Modal */}
      <InstallAppModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
        appName={productAccess.app_name}
        language={productAccess.language}
      />
    </div >
  )
}