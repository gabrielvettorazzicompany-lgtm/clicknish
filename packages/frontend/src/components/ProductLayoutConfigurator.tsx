import { useState } from 'react'
import { X, Plus, Save, Eye } from 'lucide-react'
import { useI18n } from '@/i18n'

interface ModuleConfig {
  id: string
  title: string
  subtitle: string
  icon: string
  isActive: boolean
  order: number
}

interface ProductLayoutConfig {
  name: string
  welcome_message: string
  theme: {
    primary_color: string
    secondary_color: string
    background_gradient: string
  }
  modules: ModuleConfig[]
}

interface ProductLayoutConfiguratorProps {
  isOpen: boolean
  onClose: () => void
  onSave: (config: ProductLayoutConfig) => void
  initialConfig?: ProductLayoutConfig
}

const defaultConfig: ProductLayoutConfig = {
  name: 'My Product',
  welcome_message: 'Welcome! You\'re in.',
  theme: {
    primary_color: '#2563eb',
    secondary_color: '#7c3aed',
    background_gradient: 'from-blue-500 to-blue-700'
  },
  modules: [
    { id: '1', title: 'MODULE 1', subtitle: 'Introduction', icon: '📚', isActive: true, order: 1 },
    { id: '2', title: 'MODULE 2', subtitle: 'Development', icon: '🚀', isActive: true, order: 2 },
    { id: '3', title: 'MODULE 3', subtitle: 'Advanced', icon: '💎', isActive: false, order: 3 },
    { id: '4', title: 'MODULE 4', subtitle: 'Expert', icon: '🏆', isActive: false, order: 4 }
  ]
}

const iconOptions = ['📚', '🚀', '💎', '🏆', '🗺️', '💡', '🎯', '⚡', '🌟', '🔥', '💰', '🎓']

export default function ProductLayoutConfigurator({
  isOpen,
  onClose,
  onSave,
  initialConfig = defaultConfig
}: ProductLayoutConfiguratorProps) {
  const [config, setConfig] = useState<ProductLayoutConfig>(initialConfig)
  const [previewMode, setPreviewMode] = useState(false)
  const { t } = useI18n()

  if (!isOpen) return null

  const updateModule = (moduleId: string, updates: Partial<ModuleConfig>) => {
    setConfig(prev => ({
      ...prev,
      modules: prev.modules.map(module =>
        module.id === moduleId ? { ...module, ...updates } : module
      )
    }))
  }

  const addModule = () => {
    const newId = (Math.max(...config.modules.map(m => parseInt(m.id))) + 1).toString()
    setConfig(prev => ({
      ...prev,
      modules: [...prev.modules, {
        id: newId,
        title: `MODULE ${newId}`,
        subtitle: t('components.product_layout.new_section'),
        icon: '📚',
        isActive: false,
        order: config.modules.length + 1
      }]
    }))
  }

  const removeModule = (moduleId: string) => {
    setConfig(prev => ({
      ...prev,
      modules: prev.modules.filter(module => module.id !== moduleId)
    }))
  }

  const handleSave = () => {
    onSave(config)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1d2e] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex">
        {/* Configuration Panel */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-100">
              {t('components.product_layout.configure_title')}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setPreviewMode(!previewMode)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
              >
                <Eye className="w-4 h-4" />
                {previewMode ? t('common.edit') : t('common.preview')}
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-[#252941] rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {!previewMode ? (
            <div className="space-y-8">
              {/* Basic Info */}
              <div>
                <h3 className="text-lg font-semibold text-gray-100 mb-4">{t('components.product_layout.basic_info')}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {t('components.product_layout.product_name')}
                    </label>
                    <input
                      type="text"
                      value={config.name}
                      onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-4 py-2 border border-[#252941] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {t('components.product_layout.welcome_message')}
                    </label>
                    <textarea
                      value={config.welcome_message}
                      onChange={(e) => setConfig(prev => ({ ...prev, welcome_message: e.target.value }))}
                      rows={3}
                      className="w-full px-4 py-2 border border-[#252941] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                    />
                  </div>
                </div>
              </div>

              {/* Theme */}
              <div>
                <h3 className="text-lg font-semibold text-gray-100 mb-4">{t('components.product_layout.theme_colors')}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {t('components.product_layout.primary_color')}
                    </label>
                    <input
                      type="color"
                      value={config.theme.primary_color}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        theme: { ...prev.theme, primary_color: e.target.value }
                      }))}
                      className="w-full h-10 border border-[#252941] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {t('components.product_layout.secondary_color')}
                    </label>
                    <input
                      type="color"
                      value={config.theme.secondary_color}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        theme: { ...prev.theme, secondary_color: e.target.value }
                      }))}
                      className="w-full h-10 border border-[#252941] rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Modules */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-100">{t('components.product_layout.modules')}</h3>
                  <button
                    onClick={addModule}
                    className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    {t('components.product_layout.add_module')}
                  </button>
                </div>

                <div className="space-y-4">
                  {config.modules.map((module) => (
                    <div key={module.id} className="bg-[#0f1117] rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-100">{t('common.module')} {module.id}</h4>
                        <div className="flex gap-2">
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={module.isActive}
                              onChange={(e) => updateModule(module.id, { isActive: e.target.checked })}
                              className="w-4 h-4 text-blue-400"
                            />
                            {t('components.product_layout.active')}
                          </label>
                          <button
                            onClick={() => removeModule(module.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">
                            {t('common.title')}
                          </label>
                          <input
                            type="text"
                            value={module.title}
                            onChange={(e) => updateModule(module.id, { title: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-[#252941] rounded focus:outline-none focus:ring-1 focus:ring-blue-400/50"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">
                            {t('components.product_layout.subtitle')}
                          </label>
                          <input
                            type="text"
                            value={module.subtitle}
                            onChange={(e) => updateModule(module.id, { subtitle: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-[#252941] rounded focus:outline-none focus:ring-1 focus:ring-blue-400/50"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">
                            {t('components.product_layout.icon')}
                          </label>
                          <select
                            value={module.icon}
                            onChange={(e) => updateModule(module.id, { icon: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-[#252941] rounded focus:outline-none focus:ring-1 focus:ring-blue-400/50"
                          >
                            {iconOptions.map(icon => (
                              <option key={icon} value={icon}>{icon}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-6 border-t">
                <button
                  onClick={handleSave}
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-700 text-white py-3 px-6 rounded-lg font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  {t('components.product_layout.save_settings')}
                </button>
              </div>
            </div>
          ) : (
            /* Preview Mode */
            <div className="bg-[#252941] rounded-lg p-4">
              <h3 className="text-center font-semibold mb-4">{t('components.product_layout.layout_preview')}</h3>

              {/* Mobile Preview */}
              <div className="max-w-sm mx-auto bg-[#1a1d2e] rounded-2xl overflow-hidden shadow-xl shadow-black/10">
                {/* Header */}
                <div className={`bg-gradient-to-r ${config.theme.background_gradient} px-4 py-3`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#1a1d2e] 20 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-sm">
                          {config.name.charAt(0)}
                        </span>
                      </div>
                      <span className="text-white font-bold text-sm">
                        {config.name.split(' ')[0]}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  {/* Welcome Banner */}
                  <div className="bg-[#252941] rounded-xl p-4 mb-4 text-center">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-700 rounded-xl mx-auto mb-2 flex items-center justify-center">
                      <span className="text-white font-bold">
                        {config.name.charAt(0)}
                      </span>
                    </div>
                    <h1 className="text-sm font-bold text-gray-100 mb-1">
                      {config.name}
                    </h1>
                    <p className="text-xs text-gray-600">
                      {config.welcome_message}
                    </p>
                  </div>

                  {/* Modules */}
                  <div className="grid grid-cols-2 gap-2">
                    {config.modules.slice(0, 4).map((module) => (
                      <div
                        key={module.id}
                        className={`rounded-lg p-3 text-center text-xs ${module.isActive
                          ? 'bg-gradient-to-br from-gray-900 to-gray-800 text-white'
                          : 'bg-[#252941] text-gray-500'
                          }`}
                      >
                        <div className="text-lg mb-1">{module.icon}</div>
                        <div className="font-bold">{module.title}</div>
                        <div className="opacity-80">{module.subtitle}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}