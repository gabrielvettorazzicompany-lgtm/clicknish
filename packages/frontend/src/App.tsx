import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import { useEffect, useState, lazy, Suspense } from 'react'
import { supabase } from './services/supabase'
import { useTheme } from './contexts/ThemeContext'
import { useI18n } from './i18n'

// Componente de loading para Suspense
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#080b14]">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
      <p className="text-sm text-gray-600 dark:text-gray-400">Carregando...</p>
    </div>
  </div>
)

// Pages - Autenticação (sempre carregadas imediatamente)
import Login from './pages/auth/Login'
import ResetPassword from './pages/auth/ResetPassword'
import EmailConfirmation from './pages/auth/EmailConfirmation'

// Pages - Dashboard e Core (lazy loaded)
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Integrations = lazy(() => import('./pages/Integrations'))
const Clients = lazy(() => import('./pages/Clients'))
const Plans = lazy(() => import('./pages/Plans'))
const Orders = lazy(() => import('./pages/Orders'))
const Finance = lazy(() => import('./pages/Finance'))
const Taxes = lazy(() => import('./pages/Taxes'))
const Customers = lazy(() => import('./pages/Customers'))
const Analytics = lazy(() => import('./pages/Analytics'))
const Funnels = lazy(() => import('./pages/Funnels'))
const FunnelEditor = lazy(() => import('./pages/FunnelEditor'))
const NotificationsManagement = lazy(() => import('./pages/NotificationsManagement'))
const ClientAccessManagement = lazy(() => import('./pages/ClientAccessManagement'))

// Pages - Apps (lazy loaded)
const AppBuilder = lazy(() => import('./pages/apps/AppBuilder'))
const AppPreview = lazy(() => import('./pages/apps/AppPreview'))
const AppDashboard = lazy(() => import('./pages/apps/AppDashboard'))
const AppPreviewPage = lazy(() => import('./pages/apps/AppPreviewPage'))
const CreateAppPage = lazy(() => import('./pages/apps/CreateApp').then(module => ({ default: module.CreateAppPage })))

// Pages - Products (lazy loaded)
const Products = lazy(() => import('./pages/Products'))
const ProductsManagement = lazy(() => import('./pages/products/ProductsManagement'))
const ProductEdit = lazy(() => import('./pages/products/ProductEdit'))
const ProductContent = lazy(() => import('./pages/products/ProductContent'))
const ProductIdGuide = lazy(() => import('./pages/products/ProductIdGuide'))
const ProductView = lazy(() => import('./pages/products/ProductView'))
const ProductAccess = lazy(() => import('./pages/products/ProductAccess'))
const ThankYouPage = lazy(() => import('./pages/funnel/ThankYouPage'))

// Pages - Checkout (lazy loaded)
const CheckoutBuilder = lazy(() => import('./pages/checkout/CheckoutBuilder'))
const CheckoutPublic = lazy(() => import('./pages/checkout/CheckoutPublic'))
const Success = lazy(() => import('./pages/Success'))
const OfferPage = lazy(() => import('./pages/checkout/OfferPage'))
const PayPalReturn = lazy(() => import('./pages/checkout/PayPalReturn'))

// Pages - Community (lazy loaded)
const ModuleView = lazy(() => import('./pages/community/ModuleView'))
const CommunityManagement = lazy(() => import('./pages/community/CommunityManagement'))
const CommunityFeed = lazy(() => import('./pages/community/CommunityFeed'))
const FeedManagement = lazy(() => import('./pages/community/FeedManagement'))
const CommunityModuleViewer = lazy(() => import('./pages/community/CommunityModuleViewer'))
const CommunityLogin = lazy(() => import('./pages/community/CommunityLogin'))

// Pages - Marketplace (lazy loaded)
const Marketplace = lazy(() => import('./pages/marketplace/Marketplace'))

// Pages - Admin (lazy loaded)
const SuperAdmin = lazy(() => import('./pages/admin/SuperAdmin'))
const SuperAdminLogin = lazy(() => import('./pages/admin/SuperAdminLogin'))
const SuperAdminForgotPassword = lazy(() => import('./pages/admin/SuperAdminForgotPassword'))
const SuperAdminResetPassword = lazy(() => import('./pages/admin/SuperAdminResetPassword'))

// Pages - Settings (lazy loaded)
const AdminSettings = lazy(() => import('./pages/settings/AdminSettings'))
const AdminPayments = lazy(() => import('./pages/settings/AdminPayments'))
const AdminProfile = lazy(() => import('./pages/settings/AdminProfile'))
const Settings = lazy(() => import('./pages/settings/Settings'))

// Components (sempre carregados)
import ProductGuard from './components/ProductGuard'
import MemberGuard from './components/MemberGuard'
import SuperAdminRoute from './components/SuperAdminRoute'
import ProtectedRoute from './components/ProtectedRoute'

// Interface para o app de domínio personalizado
interface CustomDomainApp {
  id: string
  name?: string
  [key: string]: any
}

export default function App() {
  const { setUser, setLoading, user } = useAuthStore()
  const { theme } = useTheme()
  const { setLanguage } = useI18n()
  const [isCustomDomain, setIsCustomDomain] = useState(false)
  const [customDomainApp, setCustomDomainApp] = useState<CustomDomainApp | null>(null)

  // Carregar idioma salvo do usuário quando autenticado
  useEffect(() => {
    if (user?.id) {
      try {
        const userLang = localStorage.getItem(`huskyapp_language_${user.id}`)
        if (userLang && ['pt', 'en', 'es', 'fr', 'de'].includes(userLang)) {
          setLanguage(userLang as 'pt' | 'en' | 'es' | 'fr' | 'de')
        }
      } catch { /* ignore */ }
    }
  }, [user?.id])

  // Aplicar tema ao body
  useEffect(() => {
    if (theme === 'dark') {
      document.body.classList.add('dark')
      document.body.classList.remove('light')
    } else {
      document.body.classList.add('light')
      document.body.classList.remove('dark')
    }
  }, [theme])

  useEffect(() => {
    const checkCustomDomain = async () => {
      const currentDomain = window.location.hostname

      // Verificar se foi injetado pelo Cloudflare Worker
      const isCustomDomainFromWorker = window.__IS_CUSTOM_DOMAIN__ || window.__CUSTOM_DOMAIN__

      // Se não for localhost ou o domínio padrão, pode ser domínio personalizado
      if (isCustomDomainFromWorker || (
        currentDomain !== 'localhost' &&
        currentDomain !== '127.0.0.1' &&
        !currentDomain.includes('clicknich.com') &&
        !currentDomain.includes('workers.dev')
      )) {

        const targetDomain = window.__CUSTOM_DOMAIN__ || currentDomain


        try {
          // Buscar o app associado a este domínio via Worker
          const apiUrl = isCustomDomainFromWorker
            ? `/api/domains/by-domain/${targetDomain}`
            : `https://api.clicknich.com/api/domains/by-domain/${targetDomain}`

          const response = await fetch(apiUrl)

          if (response.ok) {
            const app = await response.json()

            setCustomDomainApp(app)
            setIsCustomDomain(true)
          } else {

          }
        } catch (error) {
          console.error('❌ Erro ao buscar app para domínio personalizado:', error)
        }
      }
    }

    checkCustomDomain()
  }, [])

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // ⚡ SKIP AUTH para rotas públicas de checkout — eliminam 1 roundtrip desnecessário
        // O checkout é uma página pública: nunca precisa de sessão do admin
        if (window.__IS_CHECKOUT_ROUTE__) {
          setLoading(false)
          return
        }

        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          setUser(session.user)
        }
      } catch (error) {
        console.error('Auth error:', error)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()

    // Também não assina onAuthStateChange para rotas de checkout
    if (window.__IS_CHECKOUT_ROUTE__) return

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user || null)
        setLoading(false)
      }
    )

    return () => subscription?.unsubscribe()
  }, [setUser, setLoading])

  return (
    <>
      {isCustomDomain && customDomainApp ? (
        // Redirecionar para a rota do app específico para domínio personalizado
        <Navigate to={`/app/${customDomainApp.id}`} replace />
      ) : (
        // Renderização normal para o painel administrativo
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/auth/reset-password" element={<ResetPassword />} />
          <Route path="/auth/login" element={<Login />} />
          <Route path="/auth/confirm" element={<EmailConfirmation />} />
          <Route path="/admin-login" element={<SuperAdminLogin />} />
          <Route path="/super-login" element={<SuperAdminLogin />} />
          <Route path="/super-login/forgot-password" element={<SuperAdminForgotPassword />} />
          <Route path="/super-login/reset-password" element={<SuperAdminResetPassword />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/perfil"
            element={
              <ProtectedRoute>
                <AdminProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/perfil"
            element={
              <ProtectedRoute>
                <AdminProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/criar-app"
            element={
              <ProtectedRoute>
                <CreateAppPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app-builder/new"
            element={
              <ProtectedRoute>
                <AppBuilder />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app-builder/:appId"
            element={
              <ProtectedRoute>
                <AppBuilder />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app-preview/:appId"
            element={
              <ProtectedRoute>
                <AppPreviewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/products/:appId"
            element={
              <ProtectedRoute>
                <Products />
              </ProtectedRoute>
            }
          />
          <Route
            path="/products"
            element={
              <ProtectedRoute>
                <ProductsManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/products/:productId/edit"
            element={
              <ProtectedRoute>
                <ProductEdit />
              </ProtectedRoute>
            }
          />
          <Route
            path="/products/:productId/content"
            element={
              <ProtectedRoute>
                <ProductContent />
              </ProtectedRoute>
            }
          />

          {/* Checkout Público - URL Encurtada */}
          <Route
            path="/checkout/:shortId"
            element={
              <Suspense fallback={<PageLoader />}>
                <CheckoutPublic />
              </Suspense>
            }
          />

          {/* Checkout Público - URL Completa (fallback) */}
          <Route
            path="/checkout/:productId/:checkoutId"
            element={
              <Suspense fallback={<PageLoader />}>
                <CheckoutPublic />
              </Suspense>
            }
          />

          {/* Offer Page (Upsells/Downsells) */}
          <Route path="/offer" element={
            <Suspense fallback={<PageLoader />}>
              <OfferPage />
            </Suspense>
          } />

          {/* PayPal Return Page */}
          <Route path="/paypal-return" element={
            <Suspense fallback={<PageLoader />}>
              <PayPalReturn />
            </Suspense>
          } />

          {/* Success Page */}
          <Route path="/success" element={
            <Suspense fallback={<PageLoader />}>
              <Success />
            </Suspense>
          } />

          {/* Checkout Builder (Admin) */}
          <Route
            path="/checkout-builder/:productId/:checkoutId"
            element={
              <ProtectedRoute>
                <CheckoutBuilder />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <ProtectedRoute>
                <Orders />
              </ProtectedRoute>
            }
          />
          <Route
            path="/finance"
            element={
              <ProtectedRoute>
                <Finance />
              </ProtectedRoute>
            }
          />
          <Route
            path="/taxes"
            element={
              <ProtectedRoute>
                <Taxes />
              </ProtectedRoute>
            }
          />
          <Route
            path="/customers"
            element={
              <ProtectedRoute>
                <Customers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute>
                <Analytics />
              </ProtectedRoute>
            }
          />
          <Route
            path="/funnels"
            element={
              <ProtectedRoute>
                <Funnels />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/funnels/:id"
            element={
              <ProtectedRoute>
                <FunnelEditor />
              </ProtectedRoute>
            }
          />
          <Route
            path="/marketplace"
            element={
              <ProtectedRoute>
                <Marketplace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminSettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/payments"
            element={
              <ProtectedRoute>
                <AdminPayments />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/profile"
            element={
              <ProtectedRoute>
                <AdminProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/client-access/:appId"
            element={
              <ProtectedRoute>
                <ClientAccessManagement />
              </ProtectedRoute>
            }
          />
          {/* Public App Access - Customer Login */}
          <Route path="/access/:appSlug" element={<ProductAccess />} />
          {/* Public Product Access - Customer Login */}
          <Route path="/access/:appSlug/:productSlug" element={
            <Suspense fallback={<PageLoader />}>
              <ProductAccess />
            </Suspense>
          } />
          {/* Funnel Thank You Page */}
          <Route path="/thankyou/:pageId" element={
            <Suspense fallback={<PageLoader />}>
              <ThankYouPage />
            </Suspense>
          } />
          {/* Members Area Login */}
          <Route path="/members-login/:productSlug" element={
            <Suspense fallback={<PageLoader />}>
              <CommunityLogin />
            </Suspense>
          } />
          {/* Community Login (legacy route) */}
          <Route path="/community/:communitySlug/login" element={
            <Suspense fallback={<PageLoader />}>
              <CommunityLogin />
            </Suspense>
          } />
          {/* Community Feed - Admin View */}
          <Route path="/community/:appId/feed" element={
            <Suspense fallback={<PageLoader />}>
              <CommunityFeed />
            </Suspense>
          } />
          {/* Members Area - Module Selection */}
          <Route path="/community/:communitySlug" element={
            <Suspense fallback={<PageLoader />}>
              <CommunityModuleViewer />
            </Suspense>
          } />
          {/* Members Area - Specific Module */}
          <Route path="/community/:communitySlug/module/:moduleId" element={
            <Suspense fallback={<PageLoader />}>
              <CommunityModuleViewer />
            </Suspense>
          } />

          {/* App Dashboard - Show all products */}
          <Route
            path="/app/:appId"
            element={
              <MemberGuard>
                <Suspense fallback={<PageLoader />}>
                  <AppDashboard />
                </Suspense>
              </MemberGuard>
            }
          />
          <Route
            path="/app/:appId/product/:productId"
            element={
              <ProductGuard>
                <ProductView />
              </ProductGuard>
            }
          />
          <Route
            path="/community/:appId"
            element={
              <ProtectedRoute>
                <CommunityFeed />
              </ProtectedRoute>
            }
          />
          <Route
            path="/community/:appId/manage"
            element={
              <ProtectedRoute>
                <CommunityManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/feed/:appId"
            element={
              <ProtectedRoute>
                <FeedManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications/:appId"
            element={
              <ProtectedRoute>
                <NotificationsManagement />
              </ProtectedRoute>
            }
          />
          {/* Feed, Community e Notifications são acessados via tabs no AppDashboard */}
          <Route
            path="/module/:productId"
            element={
              <ProtectedRoute>
                <ModuleView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/:appId/product/:productId/module/:moduleId"
            element={
              <ProductGuard>
                <ModuleView />
              </ProductGuard>
            }
          />
          <Route
            path="/product-id-guide"
            element={
              <ProtectedRoute>
                <ProductIdGuide />
              </ProtectedRoute>
            }
          />
          <Route
            path="/integrations"
            element={
              <ProtectedRoute>
                <Integrations />
              </ProtectedRoute>
            }
          />
          <Route
            path="/clients"
            element={
              <ProtectedRoute>
                <Clients />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/:appId/clients"
            element={
              <ProtectedRoute>
                <Clients />
              </ProtectedRoute>
            }
          />
          <Route
            path="/plans"
            element={
              <ProtectedRoute>
                <Plans />
              </ProtectedRoute>
            }
          />
          <Route
            path="/superadmin"
            element={
              <SuperAdminRoute>
                <SuperAdmin />
              </SuperAdminRoute>
            }
          />
          <Route
            path="/platform-admin"
            element={
              <SuperAdminRoute>
                <SuperAdmin />
              </SuperAdminRoute>
            }
          />
          <Route
            path="/admin-dashboard"
            element={
              <SuperAdminRoute>
                <SuperAdmin />
              </SuperAdminRoute>
            }
          />
          <Route path="/app/:appSlug/*" element={
            <Suspense fallback={<PageLoader />}>
              <AppPreview />
            </Suspense>
          } />
          <Route path="/" element={<Login />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      )}
    </>
  )
}
