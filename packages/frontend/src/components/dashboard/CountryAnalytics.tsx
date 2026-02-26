import { useMemo } from 'react'
import { useI18n } from '@/i18n'

interface CountryData {
    country: string
    count: number
    percentage: number
}

interface CountryAnalyticsProps {
    data: CountryData[]
    loading?: boolean
    hideValues?: boolean
    totalVisits: number
}

export default function CountryAnalytics({
    data,
    loading,
    hideValues,
    totalVisits
}: CountryAnalyticsProps) {
    const { t } = useI18n()

    const metrics = useMemo(() => {
        if (!Array.isArray(data) || !data.length) return []
        const topCountries = data.slice(0, 3)
        const conversionRate = totalVisits > 0 ? (data.length / totalVisits) * 100 : 0
        const uniqueCountries = data.length
        const topCountryPercentage = data[0]?.percentage || 0

        return [
            {
                label: t('dashboard_components.unique_countries'),
                value: hideValues ? '••' : uniqueCountries.toString(),
                color: 'text-emerald-600',
                bgColor: 'bg-emerald-50 dark:bg-emerald-900/20'
            },
            {
                label: t('dashboard_components.top_country'),
                value: hideValues ? '••%' : `${topCountryPercentage.toFixed(0)}%`,
                color: 'text-blue-600',
                bgColor: 'bg-blue-50 dark:bg-blue-900/20'
            },
            {
                label: t('dashboard_components.diversity'),
                value: hideValues ? '••%' : `${Math.min(conversionRate, 100).toFixed(0)}%`,
                color: 'text-purple-600',
                bgColor: 'bg-purple-50 dark:bg-purple-900/20'
            },
            {
                label: t('dashboard_components.total_visits'),
                value: hideValues ? '••' : totalVisits.toLocaleString('pt-BR'),
                color: 'text-orange-600',
                bgColor: 'bg-orange-50 dark:bg-orange-900/20'
            }
        ]
    }, [data, hideValues, totalVisits, t])

    const topCountries = useMemo(() => {
        if (!Array.isArray(data)) return []
        return data.slice(0, 5)
    }, [data])

    if (loading) {
        return (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border h-96">
                <h3 className="text-lg font-semibold mb-4">{t('dashboard_components.metrics')}</h3>
                <div className="space-y-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="animate-pulse">
                            <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border h-96 flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">{t('dashboard_components.metrics')}</h3>
                {data.length > 0 && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                        {t('dashboard_components.realtime')}
                    </span>
                )}
            </div>

            {/* Métricas principais */}
            <div className="space-y-3 mb-6">
                {metrics.map((metric, index) => (
                    <div
                        key={index}
                        className={`${metric.bgColor} p-3 rounded-lg transition-all duration-200 hover:shadow-md`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                {metric.label}
                            </span>
                            <div className="text-right">
                                <div className={`text-2xl font-bold ${metric.color}`}>
                                    {metric.value}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Lista de países */}
            <div className="flex-1 overflow-hidden">
                <h4 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300">
                    {t('dashboard_components.top_countries')}
                </h4>

                {topCountries.length > 0 ? (
                    <div className="space-y-2 overflow-y-auto max-h-36">
                        {topCountries.map((country, index) => {
                            const isTop = index === 0

                            return (
                                <div
                                    key={country.country}
                                    className={`flex items-center justify-between p-2 rounded transition-colors duration-150 ${isTop
                                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
                                        : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${isTop
                                            ? 'bg-emerald-500 text-white'
                                            : 'bg-gray-400 dark:bg-gray-500 text-white'
                                            }`}>
                                            {index + 1}
                                        </span>
                                        <span className="text-sm font-medium truncate max-w-20">
                                            {country.country || t('dashboard_components.unknown')}
                                        </span>
                                    </div>

                                    <div className="text-right flex-shrink-0">
                                        <div className={`text-sm font-bold ${isTop ? 'text-emerald-600' : 'text-gray-700 dark:text-gray-300'}`}>
                                            {hideValues ? '••' : country.count}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                            {hideValues ? '••%' : `${country.percentage.toFixed(1)}%`}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-center">
                        <div>
                            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-2">
                                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V9a5 5 0 015-5h1m0 0V3a2 2 0 012-2h2a2 2 0 012 2v1m4 0V3a2 2 0 012-2h2a2 2 0 012 2v1m0 0h1a5 5 0 015 5v8m0 0V9a5 5 0 00-5-5">
                                    </path>
                                </svg>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {t('dashboard_components.no_data_yet')}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer com indicador de atualização */}
            <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{t('dashboard_components.realtime_data')}</span>
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                        <span>{t('dashboard_components.online')}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}