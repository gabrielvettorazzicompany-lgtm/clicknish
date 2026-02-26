/**
 * Tab navigation component for the funnel pages
 */

import { TabType } from '@/types/funnel'
import { useI18n } from '@/i18n'

interface TabNavProps {
    activeTab: TabType
    onTabChange: (tab: TabType) => void
}

export default function TabNav({ activeTab, onTabChange }: TabNavProps) {
    const { t } = useI18n()

    const tabs = [
        { id: 'funnels' as TabType, label: t('funnels.title') }
    ]
    return (
        <div className="flex space-x-6 border-b border-gray-200 dark:border-zinc-800 mb-4">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`pb-2.5 px-1 text-xs font-medium transition-colors ${activeTab === tab.id
                        ? 'text-gray-900 dark:text-white border-b-2 border-gray-900 dark:border-white'
                        : 'text-gray-600 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200'
                        }`}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    )
}