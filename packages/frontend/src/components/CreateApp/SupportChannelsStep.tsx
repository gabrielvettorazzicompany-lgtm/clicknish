import { useCreateAppStore } from '../../stores/createAppStore'
import { Mail, MessageCircle } from 'lucide-react'
import { useI18n } from '@/i18n'

export function SupportChannelsStep() {
  const { formData, setFormData } = useCreateAppStore()
  const { t } = useI18n()

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Coluna esquerda - Form */}
        <div className="space-y-6">
          <div className="bg-blue-500/10 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>{t('apps.create.note_label')}</strong> {t('apps.create.support_note')}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-100 mb-2">
              {t('apps.create.support_email')}
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="email"
                placeholder="support@example.com"
                value={formData.supportEmail || ''}
                onChange={(e) => setFormData({ supportEmail: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-[#252941] rounded-lg focus:ring-2 focus:ring-blue-400/50 focus:border-transparent outline-none"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {t('apps.create.support_email_hint')}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-100 mb-2">
              {t('apps.create.whatsapp_number')}
            </label>
            <div className="relative">
              <MessageCircle className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="tel"
                placeholder="+55 11 99999-9999"
                value={formData.whatsappNumber || ''}
                onChange={(e) => setFormData({ whatsappNumber: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-[#252941] rounded-lg focus:ring-2 focus:ring-blue-400/50 focus:border-transparent outline-none"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {t('apps.create.whatsapp_format')}
            </p>
          </div>

          <div className="bg-[#0f1117] border border-[#1e2139] rounded-lg p-4">
            <h4 className="font-medium text-gray-100 mb-3">{t('apps.create.support_summary')}</h4>
            <div className="space-y-2 text-sm">
              {formData.supportEmail ? (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-green-600" />
                  <span className="text-gray-300">{formData.supportEmail}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-300" />
                  <span className="text-gray-400">{t('apps.create.no_email_configured')}</span>
                </div>
              )}
              {formData.whatsappNumber ? (
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-green-600" />
                  <span className="text-gray-300">{formData.whatsappNumber}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-gray-300" />
                  <span className="text-gray-400">{t('apps.create.no_whatsapp_configured')}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Coluna direita - Preview */}
        <div className="space-y-6">
          <div className="bg-[#0f1117] p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-100 mb-4">{t('apps.login_screen')}</h3>
            <div className="bg-[#1a1d2e] border border-[#1e2139] rounded-lg p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-[#252941] rounded flex items-center justify-center text-2xl font-bold text-gray-400">
                A
              </div>
              <h2 className="text-xl font-bold text-gray-100 mb-1">{formData.name || t('apps.create.app_name_default')}</h2>
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
                  className="w-full py-2 text-white rounded font-medium"
                >
                  {t('apps.create.enter_btn')}
                </button>
              </div>

              {(formData.supportEmail || formData.whatsappNumber) && (
                <div className="mt-6 pt-6 border-t border-[#1e2139] space-y-2">
                  <p className="text-xs text-gray-500">{t('apps.create.support_channels_label')}</p>
                  <div className="flex gap-2 justify-center">
                    {formData.supportEmail && (
                      <a
                        href={`mailto:${formData.supportEmail}`}
                        className="text-sm px-3 py-1 bg-[#252941] rounded hover:bg-[#252941] flex items-center gap-1"
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
                        className="text-sm px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 flex items-center gap-1"
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
        </div>
      </div>
    </div>
  )
}
