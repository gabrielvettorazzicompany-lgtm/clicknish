import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ShoppingBag, Rss, Users, Bell } from 'lucide-react'
import { useI18n } from '@/i18n'

type AppTab = 'general' | 'checkout' | 'products' | 'feed' | 'community' | 'notifications'

interface Props {
    appId?: string
    activeTab: AppTab
    onTabChange: (tab: AppTab) => void
}

export default function AppBuilderNavbar({ appId, activeTab, onTabChange }: Props) {
    const navigate = useNavigate()
    const { t } = useI18n()

    const TABS = [
        { id: 'general' as const, label: t('apps.builder.general') },
        { id: 'checkout' as const, label: t('apps.builder.checkout') },
    ]

    const QUICK_TABS = [
        { id: 'products' as const, label: t('apps.builder.products'), icon: ShoppingBag },
        { id: 'feed' as const, label: t('apps.builder.feed'), icon: Rss },
        { id: 'community' as const, label: t('apps.builder.community'), icon: Users },
        { id: 'notifications' as const, label: t('apps.builder.notifications'), icon: Bell },
    ]

    return (
        <div className="bg-white dark:bg-[#1a1d2e] border-b border-gray-200 dark:border-[#1e2139] mt-12 sticky top-12 z-[60]">
            <div className="flex items-center gap-4 px-6">
                <button
                    onClick={() => navigate('/products')}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-[#252941]/50 rounded-lg transition-colors duration-200 flex-shrink-0"
                >
                    <ArrowLeft size={16} className="text-blue-600 dark:text-blue-400" />
                </button>

                <div className="flex items-center gap-0">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            className={`py-2 px-3 text-xs font-medium border-b-2 transition-colors cursor-pointer ${activeTab === tab.id
                                ? 'border-blue-500 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-gray-600 dark:text-gray-600 hover:text-gray-800 dark:hover:text-gray-100'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}

                    {appId && (
                        <>
                            <div className="w-px h-4 bg-gray-200 dark:bg-[#252941] mx-2" />
                            {QUICK_TABS.map(({ id, label, icon: Icon }) => (
                                <button
                                    key={id}
                                    onClick={() => onTabChange(id)}
                                    className={`flex items-center gap-1.5 py-2 px-3 text-xs font-medium border-b-2 transition-colors cursor-pointer ${activeTab === id
                                        ? 'border-blue-500 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                                        : 'border-transparent text-gray-600 dark:text-gray-600 hover:text-gray-800 dark:hover:text-gray-100'
                                        }`}
                                >
                                    <Icon size={13} />
                                    {label}
                                </button>
                            ))}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
