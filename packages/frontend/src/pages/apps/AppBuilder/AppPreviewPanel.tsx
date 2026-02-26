import { Eye, Smartphone } from 'lucide-react'
import { useI18n } from '@/i18n'
import type { AppData } from './types'

interface Props {
    appData: AppData
}

export default function AppPreviewPanel({ appData }: Props) {
    const { t } = useI18n()
    const isDark = appData.theme === 'dark'

    const bgGradient = isDark
        ? 'bg-gradient-to-br from-[#050608] via-[#0a0d14] via-30% via-[#0f1520] via-60% to-[#1a4a6c]'
        : 'bg-gradient-to-br from-blue-50 via-blue-50 to-blue-100'

    return (
        <div className="sticky top-24 bg-white dark:bg-[#1a1d2e]/95 backdrop-blur-sm rounded-2xl shadow-xl shadow-black/5 dark:shadow-black/10 border border-gray-200 dark:border-[#1e2139] p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">{t('apps.preview.title')}</h2>
                <div className="flex gap-1">
                    <button className="p-2 rounded-lg border border-gray-200 dark:border-[#1e2139] hover:bg-gray-100 dark:hover:bg-[#0f1117] transition-colors">
                        <Eye className="w-4 h-4 text-gray-600" />
                    </button>
                    <button className="p-2 rounded-lg border border-gray-200 dark:border-[#1e2139] hover:bg-gray-100 dark:hover:bg-[#0f1117] transition-colors">
                        <Smartphone className="w-4 h-4 text-gray-600" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {/* Login Screen */}
                <div className={`${bgGradient} rounded-xl p-4 shadow-inner`}>
                    <h3 className={`text-xs font-bold text-center mb-3 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        {t('apps.preview.login_screen')}
                    </h3>
                    <div
                        className={`${isDark
                            ? 'bg-gradient-to-br from-[#151825] via-[#1a2035] via-50% to-[#1a3050] border-[#2a4060]'
                            : 'bg-white border-gray-200'
                            } border rounded-xl p-4 space-y-3 shadow-xl shadow-black/10`}
                    >
                        <div className="text-center">
                            {appData.logo ? (
                                <img src={appData.logo} alt="App Logo" className="w-8 h-8 mx-auto mb-2 rounded object-cover" />
                            ) : (
                                <div className="w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center text-white text-xs font-bold bg-gradient-to-r from-blue-500 to-blue-600">
                                    {appData.name ? appData.name.charAt(0).toUpperCase() : 'A'}
                                </div>
                            )}
                            <h4 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>
                                {appData.name || t('apps.preview.app_name_default')}
                            </h4>
                            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {appData.appType === 'login-complete'
                                    ? t('apps.preview.login_email_password')
                                    : appData.appType === 'login-simple'
                                        ? t('apps.preview.quick_access_email')
                                        : t('apps.preview.access_account')}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <div
                                className={`flex items-center gap-2 p-2 border rounded text-xs ${isDark ? 'border-[#252941] bg-[#0f1117] text-gray-300' : 'border-gray-200 bg-gray-50 text-gray-500'
                                    }`}
                            >
                                {t('apps.preview.your_email')}
                            </div>
                            {appData.appType === 'login-complete' && (
                                <div
                                    className={`flex items-center gap-2 p-2 border rounded text-xs ${isDark
                                        ? 'border-[#252941] bg-[#0f1117] text-gray-300'
                                        : 'border-gray-200 bg-gray-50 text-gray-500'
                                        }`}
                                >
                                    {t('apps.preview.enter_password')}
                                </div>
                            )}
                            <button className="w-full py-2 rounded text-xs font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 shadow-lg shadow-blue-500/30">
                                {appData.appType === 'login-simple' ? t('apps.preview.access_with_email') : t('apps.preview.login')}
                            </button>
                            {appData.freeRegistration && (
                                <>
                                    <div className="relative py-2">
                                        <div className="absolute inset-0 flex items-center">
                                            <div className={`w-full border-t ${isDark ? 'border-[#252941]' : 'border-gray-200'}`} />
                                        </div>
                                        <div className="relative flex justify-center">
                                            <span
                                                className={`px-2 ${isDark ? 'bg-[#1a2035] text-gray-500' : 'bg-white text-gray-400'}`}
                                                style={{ fontSize: '9px' }}
                                            >
                                                {t('apps.preview.or')}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        className={`w-full border py-2 rounded text-xs font-medium transition-colors ${isDark
                                            ? 'border-[#252941] bg-[#0f1117] text-gray-300 hover:border-[#2a4060] hover:bg-[#151825]'
                                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        ✓ {t('apps.preview.create_free_account')}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Home Screen */}
                <div className={`${bgGradient} rounded-xl p-4 shadow-inner`}>
                    <h3 className={`text-xs font-bold text-center mb-3 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        {t('apps.preview.home_screen')}
                    </h3>
                    <div
                        className={`rounded-2xl shadow-xl shadow-black/10 overflow-hidden ${isDark ? 'bg-[#0f1117]' : 'bg-white'}`}
                        style={{ maxHeight: '500px' }}
                    >
                        {/* App Header */}
                        <div className="p-3 text-white flex items-center justify-between bg-gradient-to-r from-blue-500 to-blue-600">
                            <div className="flex items-center gap-2">
                                {appData.logo ? (
                                    <img src={appData.logo} alt="Logo" className="w-6 h-6 rounded object-cover" />
                                ) : (
                                    <div className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold bg-white/20">
                                        {appData.name ? appData.name.charAt(0).toUpperCase() : 'A'}
                                    </div>
                                )}
                                <span className="text-xs font-semibold">{appData.name || t('apps.preview.app_name_default')}</span>
                            </div>
                            <div className="w-5 h-5 rounded-full bg-white/20" />
                        </div>

                        {/* Content */}
                        <div
                            className={`p-3 space-y-3 overflow-y-auto relative ${isDark ? 'bg-[#0f1117]' : 'bg-gray-50'}`}
                            style={{ maxHeight: '400px' }}
                        >
                            {/* Banners */}
                            {appData.banners.length > 0 && appData.banners.some(b => b.image) && (
                                <div className="flex gap-2 overflow-x-auto justify-center">
                                    {appData.banners
                                        .filter(b => b.image)
                                        .slice(0, 3)
                                        .map((banner, index) => (
                                            <div key={banner.id} className="flex-shrink-0 rounded-lg overflow-hidden shadow-xl shadow-black/10">
                                                <img
                                                    src={banner.image!}
                                                    alt={`Banner ${index + 1}`}
                                                    className={`w-36 h-18 object-contain ${isDark ? 'bg-[#0f1117]' : 'bg-white'}`}
                                                />
                                            </div>
                                        ))}
                                </div>
                            )}

                            {/* Products Grid */}
                            <div>
                                <h4 className={`text-xs font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-800'}`}>
                                    {appData.showNames ? t('apps.preview.products_label') : ''}
                                </h4>
                                <div className="grid grid-cols-2 gap-2">
                                    {[1, 2].map(i => (
                                        <div
                                            key={i}
                                            className={`${isDark
                                                ? 'bg-gradient-to-br from-[#151825] to-[#1a2035] border-[#252941]'
                                                : 'bg-white border-gray-200'
                                                } border rounded-lg overflow-hidden shadow-xl shadow-black/10`}
                                        >
                                            <div className="h-16 bg-gradient-to-br from-blue-400 via-blue-500 to-pink-500" />
                                            {appData.showNames && (
                                                <div className="p-2">
                                                    <p className={`text-xs font-semibold truncate ${isDark ? 'text-white' : 'text-gray-800'}`}>
                                                        {t('apps.preview.product_n', { n: i })}
                                                    </p>
                                                    <p className={`text-xs truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('apps.preview.course')}</p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Floating Support Button */}
                            {appData.supportEnabled && (appData.supportEmail || appData.whatsappNumber) && (
                                <div className="absolute bottom-4 right-4">
                                    <div className="relative group">
                                        <button className="w-10 h-10 rounded-full shadow-xl flex items-center justify-center hover:shadow-2xl transition-all transform hover:scale-105 bg-gradient-to-r from-blue-500 to-blue-600 shadow-blue-500/30">
                                            {appData.supportIcon ? (
                                                <img src={appData.supportIcon} alt="Support" className="w-6 h-6 rounded object-cover" />
                                            ) : (
                                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                                                    />
                                                </svg>
                                            )}
                                            <div
                                                className={`absolute -top-1 -right-1 w-3 h-3 bg-green-400 border-2 rounded-full ${isDark ? 'border-[#0f1117]' : 'border-white'
                                                    }`}
                                            />
                                        </button>

                                        {/* Contact dropdown */}
                                        <div className="absolute bottom-12 right-0 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                                            <div className="bg-[#1a1d2e] rounded-lg shadow-xl border border-[#1e2139] overflow-hidden min-w-32">
                                                <div className="absolute -bottom-2 right-4 w-4 h-4 bg-[#1a1d2e] border-r border-b border-[#1e2139] transform rotate-45" />
                                                {appData.supportEmail && (
                                                    <div className="px-3 py-2 hover:bg-blue-500/10 cursor-pointer flex items-center gap-2 transition-colors border-b border-[#1e2139] last:border-b-0">
                                                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                                                            <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                    strokeWidth={2}
                                                                    d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                                                />
                                                            </svg>
                                                        </div>
                                                        <div className="text-xs">
                                                            <div className="font-medium text-gray-100">Email</div>
                                                            <div className="text-gray-500 truncate max-w-20">{appData.supportEmail}</div>
                                                        </div>
                                                    </div>
                                                )}
                                                {appData.whatsappNumber && (
                                                    <div className="px-3 py-2 hover:bg-green-50 cursor-pointer flex items-center gap-2 transition-colors last:border-b-0">
                                                        <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                                                            <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                                                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.593z" />
                                                            </svg>
                                                        </div>
                                                        <div className="text-xs">
                                                            <div className="font-medium text-gray-100">WhatsApp</div>
                                                            <div className="text-gray-500 truncate max-w-20">{appData.whatsappNumber}</div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Bottom Navigation */}
                        <div
                            className="border-t p-2"
                            style={{
                                borderColor: isDark ? '#252941' : '#e5e7eb',
                                background: isDark ? '#1a1d2e' : '#ffffff',
                            }}
                        >
                            <div className="flex justify-around items-center">
                                <div className="flex flex-col items-center gap-0.5" style={{ color: appData.primaryColor }}>
                                    <div className="w-4 h-4 rounded bg-blue-100 flex items-center justify-center">
                                        <div className="w-2 h-2 rounded" style={{ backgroundColor: appData.primaryColor }} />
                                    </div>
                                    <span className="text-xs font-medium">{t('apps.preview.home')}</span>
                                </div>

                                <div className={`flex flex-col items-center gap-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                    <div className="w-4 h-4 flex items-center justify-center">
                                        <div className="w-2 h-2 bg-gray-400 rounded" />
                                    </div>
                                    <span className="text-xs">Feed</span>
                                </div>

                                {!appData.highlightCommunity && (
                                    <div className={`flex flex-col items-center gap-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                        <div className="w-4 h-4 flex items-center justify-center">
                                            <div className="w-2 h-2 rounded" style={{ backgroundColor: appData.primaryColor }} />
                                        </div>
                                        <span className="text-xs">{t('apps.preview.community')}</span>
                                    </div>
                                )}

                                <div className={`flex flex-col items-center gap-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                    <div className="w-4 h-4 flex items-center justify-center">
                                        <div className="w-2 h-2 bg-gray-400 rounded" />
                                    </div>
                                    <span className="text-xs">{t('apps.preview.profile')}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
