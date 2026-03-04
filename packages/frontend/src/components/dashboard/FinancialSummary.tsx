import { Spinner } from '@heroui/react'

interface FinancialSummaryProps {
    conversionRate: number
    chargebackRate: number
    refundCount: number
    hideValues: boolean
    formatPercent: (value: number) => string
    loading?: boolean
}

import { useI18n } from '@/i18n'

export default function FinancialSummary({
    conversionRate,
    chargebackRate,
    refundCount,
    hideValues,
    formatPercent,
    loading
}: FinancialSummaryProps) {
    const { t } = useI18n()
    const metrics = [
        {
            value: formatPercent(conversionRate),
            label: t('dashboard.conversion_rate'),
            valueColor: 'text-blue-500 dark:text-blue-400',
            bar: 'bg-blue-500',
        },
        {
            value: formatPercent(chargebackRate),
            label: t('dashboard.chargeback'),
            valueColor: 'text-blue-500 dark:text-blue-400',
            bar: 'bg-blue-500',
        },
        {
            value: hideValues ? '••' : refundCount.toString(),
            label: t('dashboard.refunds'),
            valueColor: 'text-blue-500 dark:text-blue-400',
            bar: 'bg-blue-500',
        },
    ]

    return (
        <div className="bg-white dark:bg-white/5 dark:backdrop-blur-xl border border-gray-300 dark:border-white/10 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('dashboard.financial_summary')}</h2>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-8">
                    <Spinner size="sm" color="default" />
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {metrics.map((m, i) => (
                        <div
                            key={i}
                            className="relative overflow-hidden flex items-center justify-between px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-white/[0.03] border border-gray-300 dark:border-white/5"
                        >
                            <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${m.bar}`} />
                            <p className="text-[11px] text-gray-700 dark:text-gray-400">{m.label}</p>
                            <p className={`text-sm font-bold tabular-nums ${m.valueColor}`}>{m.value}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
