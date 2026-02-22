import { X, Smartphone, Share, Plus, Home, Chrome, MoreVertical, CheckCircle } from 'lucide-react'
import { useI18n } from '@/i18n'

interface InstallAppModalProps {
  isOpen: boolean
  onClose: () => void
  appName?: string
}

export default function InstallAppModal({ isOpen, onClose, appName = 'o app' }: InstallAppModalProps) {
  if (!isOpen) return null

  const { t } = useI18n()

  // Detectar sistema operacional
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const isAndroid = /Android/.test(navigator.userAgent)

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#1a1d2e] rounded-3xl w-full max-w-md max-h-[85vh] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 px-6 py-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-grid-white/10"></div>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2 hover:bg-[#1a1d2e] 10 rounded-full transition-all"
          >
            <X size={20} />
          </button>
          <div className="relative">
            <div className="w-14 h-14 bg-[#1a1d2e] 20 backdrop-blur-xl rounded-2xl flex items-center justify-center mb-4">
              <Smartphone className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">{t('components.install_app.install_home')}</h2>
            <p className="text-blue-100 text-sm">
              {t('components.install_app.add_native', { appName })}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[calc(85vh-200px)]">

          {/* iOS Instructions */}
          {isIOS && (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100">
                <div className="w-9 h-9 bg-gradient-to-br from-[#1a1d2e] to-[#0f1117] rounded-xl flex items-center justify-center shadow-xl shadow-black/10 shadow-black/5">
                  <span className="text-lg">🍎</span>
                </div>
                <h3 className="font-semibold text-gray-100 text-base">{t('components.install_app.iphone_ipad')}</h3>
              </div>

              <ol className="space-y-3.5">
                <li className="flex gap-3.5">
                  <div className="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-lg flex items-center justify-center text-xs font-bold shadow-xl shadow-black/10 shadow-black/5">
                    1
                  </div>
                  <div className="flex-1 pt-0.5">
                    <p className="font-medium text-gray-100 text-sm mb-1.5">{t('components.install_app.look_install_icon')}</p>
                    <p className="text-xs text-gray-600 leading-relaxed">{t('components.install_app.install_icon_address')} </p>
                  </div>
                </li>

                <li className="flex gap-3.5">
                  <div className="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-lg flex items-center justify-center text-xs font-bold shadow-xl shadow-black/10 shadow-black/5">
                    2
                  </div>
                  <div className="flex-1 pt-0.5">
                    <p className="font-medium text-gray-100 text-sm mb-2">{t('components.install_app.click_install')}</p>
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-3 inline-flex items-center gap-2 border border-[#1e2139]">
                      <Share className="w-4 h-4 text-blue-400" />
                      <span className="text-xs text-gray-300 font-medium">{t('components.install_app.share_button')}</span>
                    </div>
                  </div>
                </li>

                <li className="flex gap-3.5">
                  <div className="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-lg flex items-center justify-center text-xs font-bold shadow-xl shadow-black/10 shadow-black/5">
                    3
                  </div>
                  <div className="flex-1 pt-0.5">
                    <p className="font-medium text-gray-100 text-sm mb-1.5">{t('components.install_app.access_desktop')}</p>
                    <p className="text-xs text-gray-600 leading-relaxed">{t('components.install_app.app_shortcut')}</p>
                  </div>
                </li>
              </ol>
            </div>
          )}

          {/* Android Instructions */}
          {isAndroid && (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100">
                <div className="w-9 h-9 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-xl shadow-black/10 shadow-black/5">
                  <span className="text-lg">🤖</span>
                </div>
                <h3 className="font-semibold text-gray-100 text-base">{t('components.install_app.android')}</h3>
              </div>

              <ol className="space-y-3.5">
                <li className="flex gap-3.5">
                  <div className="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-green-600 to-green-700 text-white rounded-lg flex items-center justify-center text-xs font-bold shadow-xl shadow-black/10 shadow-black/5">
                    1
                  </div>
                  <div className="flex-1 pt-0.5">
                    <p className="font-medium text-gray-100 text-sm mb-1.5">{t('components.install_app.open_chrome')}</p>
                    <p className="text-xs text-gray-600 leading-relaxed">{t('components.install_app.ensure_chrome')}</p>
                  </div>
                </li>

                <li className="flex gap-3.5">
                  <div className="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-green-600 to-green-700 text-white rounded-lg flex items-center justify-center text-xs font-bold shadow-xl shadow-black/10 shadow-black/5">
                    2
                  </div>
                  <div className="flex-1 pt-0.5">
                    <p className="font-medium text-gray-100 text-sm mb-2">{t('components.install_app.tap_3_dots')}</p>
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-3 inline-flex items-center gap-2 border border-[#1e2139]">
                      <MoreVertical className="w-4 h-4 text-green-600" />
                      <span className="text-xs text-gray-300 font-medium">{t('components.install_app.top_right_menu')}</span>
                    </div>
                  </div>
                </li>

                <li className="flex gap-3.5">
                  <div className="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-green-600 to-green-700 text-white rounded-lg flex items-center justify-center text-xs font-bold shadow-xl shadow-black/10 shadow-black/5">
                    3
                  </div>
                  <div className="flex-1 pt-0.5">
                    <p className="font-medium text-gray-100 text-sm mb-1.5">{t('components.install_app.select_install')}</p>
                    <p className="text-xs text-gray-600 leading-relaxed">{t('components.install_app.confirm_install')}</p>
                  </div>
                </li>
              </ol>
            </div>
          )}

          {/* Desktop/Other Instructions */}
          {!isIOS && !isAndroid && (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-xl shadow-black/10 shadow-black/5">
                  <Chrome className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-semibold text-gray-100 text-base">{t('common.desktop')}</h3>
              </div>

              <ol className="space-y-3.5">
                <li className="flex gap-3.5">
                  <div className="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-lg flex items-center justify-center text-xs font-bold shadow-xl shadow-black/10 shadow-black/5">
                    1
                  </div>
                  <div className="flex-1 pt-0.5">
                    <p className="font-medium text-gray-100 text-sm mb-1.5">{t('components.install_app.look_install_icon')}</p>
                    <p className="text-xs text-gray-600 leading-relaxed">{t('components.install_app.install_icon_address_bar')}</p>
                  </div>
                </li>

                <li className="flex gap-3.5">
                  <div className="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-lg flex items-center justify-center text-xs font-bold shadow-xl shadow-black/10 shadow-black/5">
                    2
                  </div>
                  <div className="flex-1 pt-0.5">
                    <p className="font-medium text-gray-100 text-sm mb-1.5">{t('components.install_app.click_install')}</p>
                    <p className="text-xs text-gray-600 leading-relaxed">{t('components.install_app.popup_install')}</p>
                  </div>
                </li>

                <li className="flex gap-3.5">
                  <div className="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-lg flex items-center justify-center text-xs font-bold shadow-xl shadow-black/10 shadow-black/5">
                    3
                  </div>
                  <div className="flex-1 pt-0.5">
                    <p className="font-medium text-gray-100 text-sm mb-1.5">{t('components.install_app.access_desktop')}</p>
                    <p className="text-xs text-gray-600 leading-relaxed">{t('components.install_app.app_desktop_menu')}</p>
                  </div>
                </li>
              </ol>
            </div>
          )}

          {/* Benefits */}
          <div className="bg-gradient-to-br from-[#1a1d2e] via-indigo-50 to-purple-50 rounded-2xl p-4 border border-blue-100/50">
            <p className="font-semibold text-gray-100 mb-3 text-sm flex items-center gap-2">
              <span className="text-base">✨</span>
              {t('components.install_app.benefits_title')}
            </p>
            <ul className="space-y-2 text-xs text-gray-300">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
                <span>{t('components.install_app.instant_access')}</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
                <span>{t('components.install_app.works_offline')}</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
                <span>{t('components.install_app.clean_interface')}</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
                <span>{t('components.install_app.realtime_notifications')}</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#0f1117] px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-blue-600 transition-all shadow-xl shadow-black/10 hover:shadow-2xl hover:shadow-blue-500/10 active:scale-[0.98]"
          >
            {t('components.install_app.got_it')}
          </button>
        </div>
      </div>
    </div>
  )
}
