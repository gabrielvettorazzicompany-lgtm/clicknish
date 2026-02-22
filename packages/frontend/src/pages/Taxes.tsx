import { useState } from 'react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { useI18n } from '@/i18n'

interface FeeCardProps {
    period: string
    percentage: string
    fixed: string
    items: string[]
    highlight?: string
    t: (key: string) => string
}

function FeeCard({ period, percentage, fixed, items, highlight, t }: FeeCardProps) {
    return (
        <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-[#1f2937] rounded-2xl p-6 flex flex-col gap-4 flex-1">
            <div className="text-center">
                <span className="text-2xl font-semibold text-gray-900 dark:text-white">{period}</span>
            </div>

            <div className="text-center">
                <p className="text-gray-900 dark:text-white">
                    <span className="text-xl font-bold">{percentage}</span>
                    <span className="text-sm font-normal text-gray-500 dark:text-gray-400"> + {fixed}</span>
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('taxes.per_transaction')}</p>
            </div>

            <div className="border-t border-gray-100 dark:border-[#1f2937] pt-4 flex flex-col gap-2">
                {items.map((item, i) => (
                    <div
                        key={i}
                        className="bg-gray-50 dark:bg-[#1a2233] rounded-lg px-4 py-2.5 text-xs text-center text-gray-600 dark:text-gray-300"
                    >
                        {item}
                    </div>
                ))}

                {highlight && (
                    <p className="text-xs text-gray-900 dark:text-white mt-1 px-1">
                        <span className="font-bold">{t('taxes.special_conditions')}</span>{' '}
                        <span className="font-normal text-gray-500 dark:text-gray-400">{highlight}</span>
                    </p>
                )}
            </div>
        </div>
    )
}

export default function Taxes() {
    const { t } = useI18n()
    const [sidebarOpen, setSidebarOpen] = useState(false)

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

                <main className="flex-1 overflow-y-auto pt-14 relative z-10">
                    <div className="max-w-5xl mx-auto px-4 lg:px-6 py-8">

                        <div className="flex items-center gap-3 mb-8">
                            <div>
                                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{t('taxes.title')}</h1>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{t('taxes.subtitle')}</p>
                            </div>
                        </div>

                        {/* Cartão de Crédito */}
                        <div className="mb-10">
                            <div className="mb-5 pl-1 border-l-4 border-indigo-500">
                                <h2 className="text-base font-bold text-gray-900 dark:text-white">{t('taxes.credit_card')}</h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{t('taxes.credit_card_subtitle')}</p>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-4">
                                <FeeCard
                                    period="D+2 (Payout rápido)"
                                    percentage="7,99%"
                                    fixed="$0,49"
                                    items={[t('taxes.financial_reserve')]}
                                    t={t}
                                />
                                <FeeCard
                                    period="D+5"
                                    percentage="6,49%"
                                    fixed="$0,49"
                                    items={[]}
                                    t={t}
                                />
                                <FeeCard
                                    period="D+12"
                                    percentage="5,99%"
                                    fixed="$0,49"
                                    items={[]}
                                    t={t}
                                />
                            </div>
                        </div>

                    </div>
                </main>
            </div>
        </div>
    )
}
