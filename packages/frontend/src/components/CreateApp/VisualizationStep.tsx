import { useCreateAppStore } from '../../stores/createAppStore'
import { Mail, MessageCircle, Home, LogIn } from 'lucide-react'
import { useI18n } from '@/i18n'

export function VisualizationStep() {
  const { formData } = useCreateAppStore()
  const { t } = useI18n()

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-100 mb-2">{t('apps.create.preview_of_app')}</h2>
        <p className="text-gray-600">{t('apps.create.see_how_looks')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Login Screen */}
        <div className="bg-[#0f1117] p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
            <LogIn className="w-5 h-5" />
            {t('apps.login_screen')}
          </h3>
          <div className="bg-[#1a1d2e] border border-[#1e2139] rounded-lg p-6 text-center">
            {formData.logoPreview ? (
              <img
                src={formData.logoPreview}
                alt="App Logo"
                className="w-20 h-20 mx-auto mb-4 rounded"
              />
            ) : (
              <div className="w-20 h-20 mx-auto mb-4 bg-[#252941] rounded flex items-center justify-center text-3xl font-bold text-gray-400">
                {(formData.name || 'A')[0].toUpperCase()}
              </div>
            )}
            <h2 className="text-2xl font-bold text-gray-100 mb-1">{formData.name || t('apps.create.app_name_default')}</h2>
            <p className="text-sm text-gray-500 mb-6">{t('apps.create.access_account')}</p>

            <div className="space-y-3">
              <input
                type="email"
                placeholder={t('apps.create.your_email')}
                disabled
                className="w-full px-3 py-2 border border-[#252941] rounded text-sm bg-[#0f1117]"
              />
              <input
                type="password"
                placeholder={t('apps.create.your_password')}
                disabled
                className="w-full px-3 py-2 border border-[#252941] rounded text-sm bg-[#0f1117]"
              />
              <button
                disabled
                style={{ backgroundColor: formData.primaryColor }}
                className="w-full py-2 text-white rounded font-medium hover:opacity-90"
              >
                {t('apps.create.enter_btn')}
              </button>
            </div>

            {(formData.supportEmail || formData.whatsappNumber) && (
              <div className="mt-6 pt-6 border-t border-[#1e2139] space-y-2">
                <p className="text-xs text-gray-500 font-medium">{t('apps.create.support_channels_label')}</p>
                <div className="flex gap-2 justify-center flex-wrap">
                  {formData.supportEmail && (
                    <a
                      href={`mailto:${formData.supportEmail}`}
                      className="text-sm px-3 py-1 bg-[#252941] rounded hover:bg-[#252941] flex items-center gap-1 transition"
                    >
                      <Mail className="w-4 h-4" />
                      Email
                    </a>
                  )}
                  {formData.whatsappNumber && (
                    <a
                      href={`https://wa.me/${formData.whatsappNumber.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 flex items-center gap-1 transition"
                    >
                      <MessageCircle className="w-4 h-4" />
                      WhatsApp
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tela Home */}
        <div className="bg-[#0f1117] p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
            <Home className="w-5 h-5" />
            {t('apps.home_screen')}
          </h3>
          <div className="bg-[#1a1d2e] border border-[#1e2139] rounded-lg overflow-hidden">
            <div
              style={{ backgroundColor: formData.primaryColor }}
              className="h-40 flex items-center justify-center text-white font-semibold text-lg"
            >
              {t('apps.create.app_banner')}
            </div>

            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-100 mb-4">{formData.name || t('apps.create.app_name_default')}</h2>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-[#0f1117] p-4 rounded text-center">
                  <div className="text-2xl font-bold mb-1" style={{ color: formData.primaryColor }}>
                    12
                  </div>
                  <div className="text-xs text-gray-600">{t('apps.create.products')}</div>
                </div>
                <div className="bg-[#0f1117] p-4 rounded text-center">
                  <div className="text-2xl font-bold mb-1" style={{ color: formData.secondaryColor }}>
                    48
                  </div>
                  <div className="text-xs text-gray-600">{t('apps.create.students')}</div>
                </div>
              </div>

              {formData.displayNames && (
                <div className="space-y-2">
                  <div className="h-4 bg-[#252941] rounded w-3/4"></div>
                  <div className="h-4 bg-[#252941] rounded w-1/2"></div>
                </div>
              )}

              {!formData.disableCommunity && (
                <div className="mt-6 pt-6 border-t border-[#1e2139]">
                  <p className="text-sm font-medium text-gray-300 mb-3">{t('apps.create.active_community')}</p>
                  <div className="flex gap-2">
                    <div
                      style={{ backgroundColor: formData.primaryColor }}
                      className="flex-1 py-2 text-white rounded text-xs font-medium text-center"
                    >
                      {t('apps.create.community')}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-[#1e2139] p-4 bg-[#0f1117] flex gap-2">
              <button
                disabled
                style={{ backgroundColor: formData.primaryColor }}
                className="flex-1 py-2 text-white rounded text-xs font-medium"
              >
                {t('apps.create.products')}
              </button>
              <button
                disabled
                style={{ backgroundColor: formData.secondaryColor }}
                className="flex-1 py-2 text-white rounded text-xs font-medium"
              >
                {t('apps.create.profile')}
              </button>
              {!formData.disableCommunity && (
                <button
                  disabled
                  style={{ backgroundColor: formData.primaryColor }}
                  className="flex-1 py-2 text-white rounded text-xs font-medium"
                >
                  {t('apps.create.community')}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Configuration Summary */}
      <div className="bg-[#1a1d2e] border border-[#1e2139] rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">{t('apps.create.config_summary')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-3">{t('apps.create.general_data')}</h4>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-gray-500">{t('apps.create.name_colon')}</dt>
                <dd className="text-gray-100 font-medium">{formData.name || '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">{t('apps.create.app_type_colon')}</dt>
                <dd className="text-gray-100 font-medium">{formData.appType}</dd>
              </div>
              <div>
                <dt className="text-gray-500">{t('apps.create.language_colon')}</dt>
                <dd className="text-gray-100 font-medium">
                  {formData.language === 'pt-BR' ? t('apps.create.portuguese_brazil') : formData.language}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">{t('apps.create.display_names_colon')}</dt>
                <dd className="text-gray-100 font-medium">{formData.displayNames ? t('apps.create.yes') : t('apps.create.no')}</dd>
              </div>
              <div>
                <dt className="text-gray-500">{t('apps.create.community_colon')}</dt>
                <dd className="text-gray-100 font-medium">{!formData.disableCommunity ? t('apps.create.enabled') : t('apps.create.disabled')}</dd>
              </div>
              <div>
                <dt className="text-gray-500">{t('apps.create.free_registration_colon')}</dt>
                <dd className="text-gray-100 font-medium">{formData.enableFreeRegistration ? t('apps.create.yes') : t('apps.create.no')}</dd>
              </div>
            </dl>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-3">{t('apps.create.style_support')}</h4>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-gray-500">{t('apps.create.primary_color_colon')}</dt>
                <dd className="text-gray-100 font-medium flex items-center gap-2">
                  <div
                    style={{ backgroundColor: formData.primaryColor }}
                    className="w-5 h-5 rounded border border-[#252941]"
                  />
                  {formData.primaryColor}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">{t('apps.create.secondary_color_colon')}</dt>
                <dd className="text-gray-100 font-medium flex items-center gap-2">
                  <div
                    style={{ backgroundColor: formData.secondaryColor }}
                    className="w-5 h-5 rounded border border-[#252941]"
                  />
                  {formData.secondaryColor}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">{t('apps.create.support_email_colon')}</dt>
                <dd className="text-gray-100 font-medium">{formData.supportEmail || '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">{t('apps.create.whatsapp_colon')}</dt>
                <dd className="text-gray-100 font-medium">{formData.whatsappNumber || '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">{t('apps.create.logo_colon')}</dt>
                <dd className="text-gray-100 font-medium">{formData.logoPreview ? `✓ ${t('apps.create.upload_completed')}` : '—'}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}
