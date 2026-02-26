import { useMemo, memo } from 'react'
import { Spinner } from '@heroui/react'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import { useI18n } from '@/i18n'

interface DailySale {
    date: string
    value: number
    formattedDate: string
}

interface DailySalesChartProps {
    data: DailySale[]
    loading: boolean
    formatCurrency: (value: number) => string
    selectedCurrency: string
}

const DailySalesChart = memo(function DailySalesChart({ data, loading, formatCurrency, selectedCurrency }: DailySalesChartProps) {
    const { t } = useI18n()
    const wrapClass = "bg-white dark:bg-white/5 dark:backdrop-blur-xl border border-gray-100 dark:border-white/10 rounded-2xl p-5 shadow-sm"

    const totalValue = data.reduce((sum, d) => sum + d.value, 0)
    const bestDay = data.length > 0 ? data.reduce((a, b) => (a.value > b.value ? a : b)) : null

    const options: Highcharts.Options = useMemo(() => ({
        chart: {
            type: 'areaspline',
            backgroundColor: 'transparent',
            height: 220,
            margin: [10, 10, 40, 58],
            animation: { duration: 800 },
            style: { fontFamily: 'inherit' },
        },
        title: { text: undefined },
        credits: { enabled: false },
        legend: { enabled: false },
        xAxis: {
            categories: data.map(d => d.formattedDate),
            lineColor: 'rgba(255,255,255,0.06)',
            tickColor: 'transparent',
            labels: {
                style: { color: '#6b7280', fontSize: '11px' },
                step: data.length > 14 ? Math.ceil(data.length / 10) : 1,
            },
        },
        yAxis: {
            title: { text: undefined },
            gridLineColor: 'rgba(255,255,255,0.05)',
            labels: {
                style: { color: '#6b7280', fontSize: '11px' },
                formatter: function (this: Highcharts.AxisLabelsFormatterContextObject) {
                    const v = Number(this.value)
                    const locale = selectedCurrency === 'BRL' ? 'pt-BR' : 'en-US'
                    if (v >= 1000) {
                        return new Intl.NumberFormat(locale, {
                            style: 'currency',
                            currency: selectedCurrency,
                            maximumFractionDigits: 0
                        }).format(v / 1000) + 'k'
                    }
                    return new Intl.NumberFormat(locale, {
                        style: 'currency',
                        currency: selectedCurrency,
                        maximumFractionDigits: 0
                    }).format(v)
                },
            },
            min: 0,
        },
        tooltip: {
            useHTML: true,
            backgroundColor: 'rgba(15,18,33,0.95)',
            borderColor: 'rgba(255,255,255,0.1)',
            borderRadius: 10,
            shadow: { color: 'rgba(0,0,0,0.4)', width: 8, opacity: 0.3 },
            style: { color: '#f3f4f6', fontSize: '13px' },
            formatter: function () {
                const value = this.y ?? 0
                return `
                    <div style="padding:4px 2px">
                        <div style="color:#9ca3af;font-size:11px;margin-bottom:4px">${this.x}</div>
                        <div style="font-size:15px;font-weight:700;color:#a5b4fc">
                            ${formatCurrency(value)}
                        </div>
                    </div>
                `
            },
        },
        plotOptions: {
            areaspline: {
                color: '#6366f1',
                lineWidth: 2.5,
                fillColor: {
                    linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
                    stops: [
                        [0, 'rgba(99,102,241,0.30)'],
                        [1, 'rgba(99,102,241,0.02)'],
                    ],
                },
                marker: {
                    enabled: data.length <= 20,
                    radius: 4,
                    fillColor: '#6366f1',
                    lineColor: '#fff',
                    lineWidth: 2,
                    states: {
                        hover: { radius: 6, lineWidth: 2 },
                    },
                },
                states: {
                    hover: { lineWidth: 3 },
                },
                shadow: {
                    color: 'rgba(99,102,241,0.4)',
                    width: 6,
                    opacity: 0.5,
                },
            },
        },
        series: [{
            type: 'areaspline',
            name: 'Vendas',
            data: data.map(d => d.value),
        }],
    }), [data, formatCurrency, selectedCurrency])


    if (loading) {
        return (
            <div className={wrapClass}>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-4">{t('dashboard.daily_sales')}</h3>
                <div className="h-52 flex items-center justify-center">
                    <Spinner size="sm" color="default" />
                </div>
            </div>
        )
    }

    if (data.length === 0) {
        return (
            <div className={wrapClass}>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-4">{t('dashboard.daily_sales')}</h3>
                <div className="h-52 flex items-center justify-center">
                    <p className="text-sm text-gray-400">{t('dashboard.no_sales_data')}</p>
                </div>
            </div>
        )
    }

    return (
        <div className={wrapClass}>
            {/* Header */}
            <div className="flex items-start justify-between mb-1">
                <div>
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-white">{t('dashboard.daily_sales')}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('dashboard.days_of_data', { count: data.length })}</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <p className="text-xs text-gray-400">{t('dashboard.total')}</p>
                        <p className="text-sm font-semibold text-indigo-400">
                            {formatCurrency(totalValue)}
                        </p>
                    </div>
                    {bestDay && (
                        <div className="text-right">
                            <p className="text-xs text-gray-400">{t('dashboard.best_day')}</p>
                            <p className="text-sm font-semibold text-emerald-400">
                                {formatCurrency(bestDay.value)}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Chart */}
            <HighchartsReact
                highcharts={Highcharts}
                options={options}
                containerProps={{ style: { width: '100%' } }}
            />
        </div>
    )
})

export default DailySalesChart
