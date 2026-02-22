import { useCreateAppStore } from '../../stores/createAppStore'
import { useI18n } from '@/i18n'

export function VisualStyleStep() {
  const { formData, setFormData } = useCreateAppStore()
  const { t } = useI18n()

  const colorPresets = [
    { primary: '#0052CC', secondary: '#FF4081', name: t('apps.create.color_blue_pink') },
    { primary: '#1B6E3D', secondary: '#FFB81C', name: t('apps.create.color_green_yellow') },
    { primary: '#8B008B', secondary: '#FF69B4', name: t('apps.create.color_purple_pink') },
    { primary: '#FF6B00', secondary: '#00D4FF', name: t('apps.create.color_orange_cyan') },
    { primary: '#2C3E50', secondary: '#E74C3C', name: t('apps.create.color_gray_red') },
    { primary: '#16A085', secondary: '#F39C12', name: t('apps.create.color_green_orange') },
  ]

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Coluna esquerda - Form */}
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-100 mb-4">{t('apps.create.choose_palette')}</h3>
            <div className="grid grid-cols-2 gap-4">
              {colorPresets.map((preset) => (
                <button
                  key={preset.primary}
                  onClick={() =>
                    setFormData({
                      primaryColor: preset.primary,
                      secondaryColor: preset.secondary,
                    })
                  }
                  className={`p-4 rounded-lg border-2 transition ${formData.primaryColor === preset.primary
                    ? 'border-blue-500 ring-2 ring-blue-200'
                    : 'border-[#1e2139] hover:border-[#252941]'
                    }`}
                >
                  <div className="flex gap-2 mb-2">
                    <div
                      style={{ backgroundColor: preset.primary }}
                      className="w-8 h-8 rounded"
                    />
                    <div
                      style={{ backgroundColor: preset.secondary }}
                      className="w-8 h-8 rounded"
                    />
                  </div>
                  <div className="text-xs font-medium text-gray-300">{preset.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Colors */}
          <div>
            <h3 className="text-lg font-semibold text-gray-100 mb-4">{t('apps.create.customize_colors')}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-100 mb-2">
                  {t('apps.create.primary_color')}
                </label>
                <div className="flex gap-2 items-center">
                  <div className="relative">
                    <input
                      type="color"
                      value={formData.primaryColor}
                      onChange={(e) => setFormData({ primaryColor: e.target.value })}
                      className="w-12 h-10 rounded cursor-pointer border border-[#252941]"
                    />
                  </div>
                  <input
                    type="text"
                    value={formData.primaryColor}
                    onChange={(e) => {
                      const value = e.target.value
                      if (/^#[0-9A-F]{6}$/i.test(value)) {
                        setFormData({ primaryColor: value })
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-[#252941] rounded-lg font-mono text-sm"
                    placeholder="#0052CC"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-100 mb-2">
                  {t('apps.create.secondary_color')}
                </label>
                <div className="flex gap-2 items-center">
                  <div className="relative">
                    <input
                      type="color"
                      value={formData.secondaryColor}
                      onChange={(e) => setFormData({ secondaryColor: e.target.value })}
                      className="w-12 h-10 rounded cursor-pointer border border-[#252941]"
                    />
                  </div>
                  <input
                    type="text"
                    value={formData.secondaryColor}
                    onChange={(e) => {
                      const value = e.target.value
                      if (/^#[0-9A-F]{6}$/i.test(value)) {
                        setFormData({ secondaryColor: value })
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-[#252941] rounded-lg font-mono text-sm"
                    placeholder="#FF4081"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-500/10 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>{t('apps.create.tip_label')}</strong> {t('apps.create.color_tip')}
            </p>
          </div>
        </div>

        {/* Right Column - Preview */}
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
            </div>
          </div>

          <div className="bg-[#0f1117] p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-100 mb-4">{t('apps.home_screen')}</h3>
            <div
              style={{ backgroundColor: formData.primaryColor }}
              className="h-32 rounded-lg flex items-center justify-center text-white font-semibold"
            >
              {t('apps.create.app_banner')}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                style={{ backgroundColor: formData.primaryColor }}
                className="flex-1 py-2 text-white rounded text-sm font-medium"
              >
                {t('apps.create.primary')}
              </button>
              <button
                style={{ backgroundColor: formData.secondaryColor }}
                className="flex-1 py-2 text-white rounded text-sm font-medium"
              >
                {t('apps.create.secondary')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
