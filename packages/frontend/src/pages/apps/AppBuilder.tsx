import { useState } from 'react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import CheckoutManager from '@/components/common/CheckoutManager'
import { useI18n } from '@/i18n'
import { useAppBuilder } from './AppBuilder/useAppBuilder'
import AppBuilderNavbar from './AppBuilder/AppBuilderNavbar'
import AppGeneralTab from './AppBuilder/AppGeneralTab'
import AppSettingsTab from './AppBuilder/AppSettingsTab'
import AppPreviewPanel from './AppBuilder/AppPreviewPanel'
import Products from '@/pages/Products'
import FeedManagement from '@/pages/community/FeedManagement'
import CommunityFeed from '@/pages/community/CommunityFeed'
import NotificationsManagement from '@/pages/NotificationsManagement'

export default function AppBuilder() {
  const { t, language } = useI18n()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const {
    appId,
    appData,
    setAppData,
    loading,
    activeTab,
    setActiveTab,
    selectedPaymentMethods,
    setSelectedPaymentMethods,
    defaultPaymentMethod,
    setDefaultPaymentMethod,
    dynamicCheckout,
    setDynamicCheckout,
    removeBanner,
    updateBanner,
    togglePaymentMethod,
    handleSaveApp,
  } = useAppBuilder()

  if (loading && appId) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#080b14] flex transition-colors duration-200 relative">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 flex flex-col min-w-0">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 flex items-center justify-center pt-20">
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
              <p className="mt-4 text-gray-600 text-sm">{t('apps.loading_app')}</p>
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#080b14] flex transition-colors duration-200 relative">
      <div className="pointer-events-none fixed inset-0 overflow-hidden dark:block hidden">
        <div className="absolute top-[-80px] left-[15%] w-[500px] h-[500px] rounded-full bg-blue-600/20 blur-[120px]" />
        <div className="absolute top-[30%] right-[-60px] w-[400px] h-[400px] rounded-full bg-indigo-500/15 blur-[100px]" />
        <div className="absolute bottom-[10%] left-[5%] w-[350px] h-[350px] rounded-full bg-violet-600/10 blur-[100px]" />
      </div>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <AppBuilderNavbar
          appId={appId}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        <main className="flex-1 overflow-y-auto relative z-10">
          {/* Embedded pages — full width, no padding wrapper */}
          {activeTab === 'products' && <Products embedded />}
          {activeTab === 'feed' && <FeedManagement embedded />}
          {activeTab === 'community' && <CommunityFeed embedded />}
          {activeTab === 'notifications' && <NotificationsManagement embedded />}

          {/* Builder tabs — 2-column layout */}
          {(activeTab === 'general' || activeTab === 'checkout') && (
            <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6">
              {/* Page Title */}
              <div className="mb-4">
                <h1 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-0.5">
                  {appId ? t('apps.edit_app') : t('apps.create_new_app')}
                </h1>
                <p className="text-xs text-gray-600 dark:text-gray-600">
                  {appId ? t('apps.update_app_settings') : t('apps.configure_app_steps')}
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Left Column — Form */}
                <div className="lg:col-span-2 bg-white dark:bg-[#1a1d2e]/95 backdrop-blur-sm rounded-xl shadow-xl shadow-black/5 dark:shadow-blue-500/10 border border-gray-200 dark:border-blue-500/20 p-4">
                  {activeTab === 'general' && (
                    <AppGeneralTab
                      appData={appData}
                      setAppData={setAppData}
                      loading={loading}
                      onSave={handleSaveApp}
                      onRemoveBanner={removeBanner}
                      onUpdateBanner={updateBanner}
                    />
                  )}

                  {activeTab === 'checkout' && (
                    <CheckoutManager
                      product={{
                        id: appId || '',
                        name: appData.name,
                        price: appData.price,
                        currency: appData.currency,
                        image_url: appData.logo || undefined,
                        review_status: appData.review_status,
                      }}
                      selectedPaymentMethods={selectedPaymentMethods}
                      defaultPaymentMethod={defaultPaymentMethod}
                      isApplication={true}
                    />
                  )}
                </div>

                {/* Right Column — Preview or Payment Settings */}
                <div className="lg:col-span-1">
                  {activeTab === 'checkout' ? (
                    <AppSettingsTab
                      selectedPaymentMethods={selectedPaymentMethods}
                      defaultPaymentMethod={defaultPaymentMethod}
                      dynamicCheckout={dynamicCheckout}
                      onTogglePaymentMethod={togglePaymentMethod}
                      onSetDefaultPaymentMethod={setDefaultPaymentMethod}
                      onToggleDynamicCheckout={setDynamicCheckout}
                      onSaveWithValues={async (methods, defaultMethod, isDynamic) => {
                        setSelectedPaymentMethods(methods)
                        setDefaultPaymentMethod(defaultMethod)
                        setDynamicCheckout(isDynamic)
                        await handleSaveApp({ payment_methods: methods, default_payment_method: defaultMethod, dynamic_checkout: isDynamic })
                      }}
                    />
                  ) : (
                    <AppPreviewPanel appData={appData} />
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
