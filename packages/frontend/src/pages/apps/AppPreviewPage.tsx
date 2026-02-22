import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Smartphone, Monitor, Tablet, Eye, Settings, Users, Bell } from 'lucide-react'
import Header from '@/components/Header'
import { useI18n } from '@/i18n'

interface App {
  id: string
  name: string
  logo_url?: string
  theme: 'light' | 'dark'
  primary_color: string
  language: string
  login_type: string
}

interface Product {
  id: string
  name: string
  logo_url?: string
  price: string
}

interface Banner {
  id: string
  image_url: string
  link_url?: string
  order: number
}

export default function AppPreviewPage() {
  const { appId } = useParams()
  const { t } = useI18n()
  const [app, setApp] = useState<App | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [banners, setBanners] = useState<Banner[]>([])
  const [previewDevice, setPreviewDevice] = useState<'mobile' | 'tablet' | 'desktop'>('mobile')
  const [previewScreen, setPreviewScreen] = useState<'login' | 'home'>('login')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (appId) {
      fetchApp()
      fetchProducts()
    }
  }, [appId])

  const fetchApp = async () => {
    try {
      const response = await fetch(`https://members.clicknich.com/api/applications/${appId}`)
      if (response.ok) {
        const appData = await response.json()
        setApp({
          id: appData.id,
          name: appData.name,
          logo_url: appData.logo_url,
          theme: appData.theme || 'light',
          primary_color: appData.primary_color || '#3B82F6',
          language: appData.language || 'pt',
          login_type: appData.app_type || 'email-only'
        })
      } else {
        console.error('Failed to fetch app data')
        // Set minimal app data for preview
        setApp({
          id: appId || '',
          name: 'App',
          theme: 'light',
          primary_color: '#3B82F6',
          language: 'pt',
          login_type: 'email-only'
        })
      }
    } catch (error) {
      console.error('Error fetching app:', error)
      // Set minimal app data in case of error
      setApp({
        id: appId || '',
        name: 'App',
        theme: 'light',
        primary_color: '#3B82F6',
        language: 'pt',
        login_type: 'email-only'
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchProducts = async () => {
    try {
      const response = await fetch(`https://members.clicknich.com/api/applications/${appId}/products`)
      if (response.ok) {
        const productsData = await response.json()
        const formattedProducts = productsData.map((product: any) => ({
          id: product.id,
          name: product.name,
          logo_url: product.logo_url || product.cover_url,
          price: product.price || 'Free'
        }))
        setProducts(formattedProducts)
      } else {
        // Fallback para dados mock se a API falhar
        setProducts([])
      }

      // Buscar banners
      const bannersResponse = await fetch(`https://members.clicknich.com/api/applications/${appId}/banners`)
      if (bannersResponse.ok) {
        const bannersData = await bannersResponse.json()
        setBanners(bannersData.sort((a: Banner, b: Banner) => a.order - b.order))
      }
    } catch (error) {
      console.error('Error fetching products:', error)
      // In case of error, leave array empty
      setProducts([])
    }
  }

  const getDeviceFrame = () => {
    switch (previewDevice) {
      case 'mobile':
        return 'w-80 h-[600px]'
      case 'tablet':
        return 'w-96 h-[500px]'
      case 'desktop':
        return 'w-[800px] h-[500px]'
      default:
        return 'w-80 h-[600px]'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-[#252941]/30">
        <Header />
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">{t('apps.loading_preview')}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-[#252941]/30">
      <Header />

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-100 font-medium transition-colors p-2 hover:bg-[#252941]/50 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-100 mb-2">
              {t('apps.preview_title')} - {app?.name}
            </h1>
            <p className="text-gray-600">
              {t('apps.see_how_app_appears')}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              to={`/app-builder/${appId}`}
              className="inline-flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-xl font-medium transition-colors"
            >
              <Settings className="w-4 h-4" />
              {t('apps.edit_app')}
            </Link>
            <Link
              to={`/products/${appId}`}
              className="inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl font-medium transition-colors"
            >
              <Eye className="w-4 h-4" />
              {t('apps.view_products')}
            </Link>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-8">
          {/* Left Panel - Controls */}
          <div className="lg:col-span-4 space-y-6">
            {/* Device Selection */}
            <div className="bg-[#1a1d2e] rounded-xl shadow-xl shadow-black/10 shadow-black/5 border p-6">
              <h3 className="text-lg font-semibold text-gray-100 mb-4">{t('apps.device')}</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setPreviewDevice('mobile')}
                  className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-colors ${previewDevice === 'mobile'
                    ? 'border-blue-500 bg-blue-500/10 text-blue-700'
                    : 'border-[#1e2139] hover:border-[#252941]'
                    }`}
                >
                  <Smartphone className="w-5 h-5" />
                  <span className="text-sm font-medium">{t('common.mobile')}</span>
                </button>
                <button
                  onClick={() => setPreviewDevice('tablet')}
                  className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-colors ${previewDevice === 'tablet'
                    ? 'border-blue-500 bg-blue-500/10 text-blue-700'
                    : 'border-[#1e2139] hover:border-[#252941]'
                    }`}
                >
                  <Monitor className="w-5 h-5" />
                  <span className="text-sm font-medium">{t('common.desktop')}</span>
                </button>
              </div>
            </div>

            {/* Screen Selection */}
            <div className="bg-[#1a1d2e] rounded-xl shadow-xl shadow-black/10 shadow-black/5 border p-6">
              <h3 className="text-lg font-semibold text-gray-100 mb-4">{t('common.preview')}</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setPreviewScreen('login')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${previewScreen === 'login'
                    ? 'bg-blue-500 text-white'
                    : 'bg-[#252941] text-gray-300 hover:bg-gray-200'
                    }`}
                >
                  {t('apps.login_screen')}
                </button>
                <button
                  onClick={() => setPreviewScreen('home')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${previewScreen === 'home'
                    ? 'bg-blue-500 text-white'
                    : 'bg-[#252941] text-gray-300 hover:bg-gray-200'
                    }`}
                >
                  {t('apps.home_screen')}
                </button>
              </div>
            </div>

            {/* App Info */}
            <div className="bg-[#1a1d2e] rounded-xl shadow-xl shadow-black/10 shadow-black/5 border p-6">
              <h3 className="text-lg font-semibold text-gray-100 mb-4">{t('apps.app_info')}</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-600">{t('apps.name')}</label>
                  <p className="text-gray-100">{app?.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">{t('apps.theme')}</label>
                  <div className="flex items-center gap-2 mt-1">
                    <div
                      className={`w-4 h-4 rounded-full ${app?.theme === 'light' ? 'bg-[#1a1d2e] border-2 border-[#252941]' : 'bg-gradient-to-r from-blue-500 to-blue-600'}`}
                    />
                    <span className="text-gray-100 capitalize">{app?.theme}</span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">{t('apps.primary_color')}</label>
                  <div className="flex items-center gap-2 mt-1">
                    <div
                      className="w-4 h-4 rounded-full border border-[#252941]"
                      style={{ backgroundColor: app?.primary_color }}
                    />
                    <span className="text-gray-100">{app?.primary_color}</span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">{t('apps.login_type')}</label>
                  <p className="text-gray-100">
                    {app?.login_type === 'email-only' ? t('apps.email_only') :
                      app?.login_type === 'email-password' ? t('apps.email_password') :
                        app?.login_type}
                  </p>
                </div>
              </div>
            </div>

            {/* Products Summary */}
            <div className="bg-[#1a1d2e] rounded-xl shadow-xl shadow-black/10 shadow-black/5 border p-6">
              <h3 className="text-lg font-semibold text-gray-100 mb-4">{t('apps.configured_products')}</h3>
              <div className="space-y-3">
                {products.length > 0 ? (
                  products.map(product => (
                    <div key={product.id} className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#252941] rounded-lg overflow-hidden">
                        {product.logo_url ? (
                          <img src={product.logo_url} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm font-bold">
                            {product.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-100 text-sm">{product.name}</p>
                        <p className="text-xs text-gray-500">{product.price}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm">{t('apps.no_products_configured')}</p>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel - Preview */}
          <div className="lg:col-span-8">
            <div className="bg-[#1a1d2e] rounded-xl shadow-xl shadow-black/10 border p-8">
              <div className="flex items-center justify-center">
                <div className={`${getDeviceFrame()} bg-[#252941] rounded-2xl p-4 shadow-2xl border`}>
                  <div className="w-full h-full bg-[#1a1d2e] rounded-xl overflow-hidden shadow-inner">
                    {/* App Preview Content */}
                    <div className="h-full flex flex-col">
                      {/* Header */}
                      <div
                        className="px-4 py-3 text-white"
                        style={{ backgroundColor: app?.primary_color }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-[#252941]/30 rounded-lg overflow-hidden">
                              {app?.logo_url ? (
                                <img src={app?.logo_url} alt={app?.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-white font-bold text-sm">
                                  {app?.name?.charAt(0) || 'A'}
                                </div>
                              )}
                            </div>
                            <h1 className="font-semibold text-lg">{app?.name}</h1>
                          </div>
                          <Bell className="w-5 h-5" />
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 p-4 overflow-y-auto">
                        {previewScreen === 'login' ? (
                          /* Tela de Login */
                          <div className="flex items-center justify-center h-full">
                            <div className="w-full max-w-sm">
                              <div className="text-center mb-8">
                                <div className="w-16 h-16 mx-auto mb-4 bg-[#252941] rounded-lg overflow-hidden">
                                  {app?.logo_url ? (
                                    <img src={app?.logo_url} alt={app?.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold text-lg">
                                      {app?.name?.charAt(0) || 'A'}
                                    </div>
                                  )}
                                </div>
                                <h2 className="text-xl font-bold text-gray-100 mb-2">
                                  {app?.name}
                                </h2>
                                <p className="text-gray-600 text-sm">
                                  {app?.login_type === 'email-password' ? t('apps.enter_email_password') : t('apps.enter_email')}
                                </p>
                              </div>

                              <div className="space-y-4">
                                <div>
                                  <input
                                    type="email"
                                    placeholder={t('common.email')}
                                    className="w-full px-4 py-3 border border-[#252941] rounded-lg focus:ring-2 focus:ring-blue-400/50 focus:border-transparent"
                                    disabled
                                  />
                                </div>
                                {app?.login_type === 'email-password' && (
                                  <div>
                                    <input
                                      type="password"
                                      placeholder={t('apps.password')}
                                      className="w-full px-4 py-3 border border-[#252941] rounded-lg focus:ring-2 focus:ring-blue-400/50 focus:border-transparent"
                                      disabled
                                    />
                                  </div>
                                )}
                                <button
                                  className="w-full py-3 text-white rounded-lg font-medium transition-colors"
                                  style={{ backgroundColor: app?.primary_color }}
                                  disabled
                                >
                                  Login
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* Tela Home */
                          previewDevice === 'mobile' ? (
                            <>
                              {/* Welcome Message */}
                              <div className="text-center mb-6">
                                <h2 className="text-lg font-bold text-gray-100 mb-2">
                                  {app?.name ? t('apps.welcome_to', { name: app.name }) : t('apps.welcome_app')}
                                </h2>
                              </div>

                              {/* Products Grid */}
                              <div className="grid grid-cols-2 gap-3 mb-6">
                                {products.map(product => (
                                  <div key={product.id} className="bg-[#0f1117] rounded-lg p-3 text-center">
                                    <div className="w-12 h-12 bg-[#1a1d2e] rounded-lg mx-auto mb-2 shadow-xl shadow-black/10 shadow-black/5 overflow-hidden">
                                      {product.logo_url ? (
                                        <img src={product.logo_url} alt={product.name} className="w-full h-full object-cover" />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold">
                                          {product.name.charAt(0)}
                                        </div>
                                      )}
                                    </div>
                                    <p className="text-xs font-medium text-gray-100">{product.name}</p>
                                  </div>
                                ))}
                              </div>

                              {/* Bottom Tabs */}
                              <div className="mt-auto">
                                <div className="flex justify-around py-3 border-t border-[#1e2139]">
                                  <div className="text-center">
                                    <div className="w-6 h-6 mx-auto mb-1" style={{ color: app?.primary_color }}>
                                      <svg fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                                      </svg>
                                    </div>
                                    <span className="text-xs text-gray-600">{t('common.home')}</span>
                                  </div>
                                  <div className="text-center">
                                    <Users className="w-6 h-6 mx-auto mb-1 text-gray-400" />
                                    <span className="text-xs text-gray-600">{t('common.community')}</span>
                                  </div>
                                  <div className="text-center">
                                    <Bell className="w-6 h-6 mx-auto mb-1 text-gray-400" />
                                    <span className="text-xs text-gray-600">{t('common.feed')}</span>
                                  </div>
                                  <div className="text-center">
                                    <Settings className="w-6 h-6 mx-auto mb-1 text-gray-400" />
                                    <span className="text-xs text-gray-600">{t('common.profile')}</span>
                                  </div>
                                </div>
                              </div>
                            </>
                          ) : (
                            /* Tablet/Desktop Layout */
                            <div className="grid grid-cols-3 gap-4 h-full">
                              <div className="bg-[#0f1117] rounded-lg p-4">
                                <h3 className="font-semibold mb-3">{t('common.products')}</h3>
                                {products.map(product => (
                                  <div key={product.id} className="flex items-center gap-3 mb-3 p-2 bg-[#1a1d2e] rounded-lg">
                                    <div className="w-10 h-10 bg-[#252941] rounded-lg overflow-hidden">
                                      {product.logo_url ? (
                                        <img src={product.logo_url} alt={product.name} className="w-full h-full object-cover" />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold text-sm">
                                          {product.name.charAt(0)}
                                        </div>
                                      )}
                                    </div>
                                    <div>
                                      <p className="font-medium text-sm">{product.name}</p>
                                      <p className="text-xs text-gray-500">{product.price}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <div className="bg-[#0f1117] rounded-lg p-4">
                                <h3 className="font-semibold mb-3">{t('common.feed')}</h3>
                                <div className="space-y-3">
                                  <div className="p-3 bg-[#1a1d2e] rounded-lg">
                                    <p className="text-sm text-gray-600">{t('apps.new_update')}</p>
                                  </div>
                                  <div className="p-3 bg-[#1a1d2e] rounded-lg">
                                    <p className="text-sm text-gray-600">{t('apps.welcome_app')}</p>
                                  </div>
                                </div>
                              </div>
                              <div className="bg-[#0f1117] rounded-lg p-4">
                                <h3 className="font-semibold mb-3">{t('common.community')}</h3>
                                <div className="space-y-3">
                                  <div className="p-3 bg-[#1a1d2e] rounded-lg">
                                    <p className="text-sm text-gray-600">{t('apps.discussion')}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
