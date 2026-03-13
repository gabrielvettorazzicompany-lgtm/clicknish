import { useCreateAppStore } from '../../stores/createAppStore'
import { Upload } from 'lucide-react'
import { useI18n } from '@/i18n'

export function GeneralDataStep() {
  const { formData, setFormData } = useCreateAppStore()
  const { t } = useI18n()

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'logo') => {
    const file = e.target.files?.[0]
    if (file) {
      const preview = URL.createObjectURL(file)
      setFormData({
        [field]: file,
        logoPreview: field === 'logo' ? preview : formData.logoPreview,
      })
    }
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Coluna esquerda - Form */}
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-100 mb-2">
              {t('apps.create.name_label')} *
            </label>
            <input
              type="text"
              placeholder={t('apps.create.name_placeholder')}
              value={formData.name}
              onChange={(e) => setFormData({ name: e.target.value })}
              className="w-full px-4 py-2 border border-[#252941] rounded-lg focus:ring-2 focus:ring-blue-400/50 focus:border-transparent outline-none"
            />
          </div>

          {/* Toggles */}
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.displayNames}
                onChange={(e) => setFormData({ displayNames: e.target.checked })}
                className="w-5 h-5 rounded"
              />
              <div>
                <div className="text-sm font-medium text-gray-100">{t('apps.create.display_names')}</div>
                <div className="text-xs text-gray-500">
                  {t('apps.create.display_names_desc')}
                </div>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.disableCommunity}
                onChange={(e) => setFormData({ disableCommunity: e.target.checked })}
                className="w-5 h-5 rounded"
              />
              <div>
                <div className="text-sm font-medium text-gray-100">{t('apps.create.disable_community')}</div>
                <div className="text-xs text-gray-500">
                  {t('apps.create.disable_community_desc')}
                </div>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.enableFreeRegistration}
                onChange={(e) => setFormData({ enableFreeRegistration: e.target.checked })}
                className="w-5 h-5 rounded"
              />
              <div>
                <div className="text-sm font-medium text-gray-100">{t('apps.create.enable_free_registration')}</div>
                <div className="text-xs text-gray-500">
                  {t('apps.create.enable_free_registration_desc')}
                </div>
              </div>
            </label>
          </div>

          {/* Tipo de App */}
          <div>
            <label className="block text-sm font-medium text-gray-100 mb-2">
              {t('apps.create.app_type')}
            </label>
            <select
              value={formData.appType}
              onChange={(e) => setFormData({ appType: e.target.value })}
              className="w-full px-4 py-2 border border-[#252941] rounded-lg focus:ring-2 focus:ring-blue-400/50 focus:border-transparent outline-none bg-[#1a1d2e]"
            >
              <option>{t('apps.create.full_login')}</option>
              <option>{t('apps.create.social_login')}</option>

            </select>
            <div className="text-xs text-gray-500 mt-1">
              {t('apps.create.select_auth_method')}
            </div>
          </div>

          {/* Language   */}
          <div>
            <label className="block text-sm font-medium text-gray-100 mb-2">
              {t('apps.create.language')}
            </label>
            <select
              value={formData.language || 'pt'}
              onChange={(e) => setFormData({ language: e.target.value })}
              className="w-full px-4 py-2 border border-[#252941] rounded-lg focus:ring-2 focus:ring-blue-400/50 focus:border-transparent outline-none bg-[#1a1d2e]"
            >
              <option value="pt">Português</option>
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
              <option value="nl">Nederlands</option>
            </select>
            <div className="text-xs text-gray-500 mt-1">
              {t('apps.create.set_default_language')}
            </div>
          </div>

          {/* Language */}
          <div>
            <label className="block text-sm font-medium text-gray-100 mb-2">
              {t('apps.create.language')}
            </label>
            <select
              value={formData.language}
              onChange={(e) => setFormData({ language: e.target.value })}
              className="w-full px-4 py-2 border border-[#252941] rounded-lg focus:ring-2 focus:ring-blue-400/50 focus:border-transparent outline-none bg-[#1a1d2e]"
            >
              <option value="pt-BR">Português</option>
              <option value="en-US">English</option>
              <option value="es-ES">Español</option>
              <option value="fr-FR">Français</option>
              <option value="de-DE">Deutsch</option>
              <option value="nl-NL">Nederlands</option>
            </select>
          </div>

          {/* Logo */}
          <div>
            <label className="block text-sm font-medium text-gray-100 mb-2">
              {t('apps.create.app_logo')}
            </label>
            <div className="border-2 border-dashed border-[#252941] rounded-lg p-6 text-center hover:border-blue-500 transition">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, 'logo')}
                className="hidden"
                id="logo-upload"
              />
              <label htmlFor="logo-upload" className="cursor-pointer flex flex-col items-center gap-2">
                <Upload className="w-8 h-8 text-gray-400" />
                <span className="text-sm text-gray-600">{t('apps.create.click_upload_drag')}</span>
                <span className="text-xs text-gray-500">{t('apps.create.upload_size_limit')}</span>
              </label>
            </div>
            {formData.logoPreview && (
              <div className="mt-4">
                <img
                  src={formData.logoPreview}
                  alt={t('apps.create.logo_preview_alt')}
                  className="w-20 h-20 object-contain"
                />
              </div>
            )}
          </div>
        </div>

        {/* Coluna direita - Preview */}
        <div className="space-y-6">
          <div className="bg-[#0f1117] p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-100 mb-4">{t('apps.create.login_btn')}</h3>
            <div className="bg-[#1a1d2e] border border-[#1e2139] rounded-lg p-6 text-center">
              {formData.logoPreview ? (
                <img
                  src={formData.logoPreview}
                  alt="App Logo"
                  className="w-16 h-16 mx-auto mb-4 rounded"
                />
              ) : (
                <div className="w-16 h-16 mx-auto mb-4 bg-[#252941] rounded flex items-center justify-center text-2xl font-bold text-gray-400">
                  A
                </div>
              )}
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
                  {t('apps.create.login_btn')}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-[#0f1117] p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-100 mb-4">{t('apps.home_screen')}</h3>
            <div
              style={{ backgroundColor: formData.primaryColor }}
              className="bg-blue-500 h-32 rounded-lg flex items-center justify-center text-white font-semibold"
            >
              {t('apps.create.app_banner')}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
