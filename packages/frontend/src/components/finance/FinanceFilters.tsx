import { DateRange } from 'react-day-picker'
import DateRangePicker from '@/components/dashboard/DateRangePicker'
import { useI18n } from '@/i18n'

interface FinanceFiltersProps {
    dateRange: DateRange | undefined
    onDateRangeChange: (range: DateRange | undefined) => void
    selectedCurrency: string
    onCurrencyChange: (currency: string) => void
}

export default function FinanceFilters({
    dateRange,
    onDateRangeChange,
    selectedCurrency,
    onCurrencyChange,
}: FinanceFiltersProps) {
    const { t } = useI18n()

    const CURRENCIES = [
        { value: 'all', label: t('finance.filters.all_currencies') },
        { value: 'USD', label: t('finance.filters.usd') },
        { value: 'BRL', label: t('finance.filters.brl') },
        { value: 'EUR', label: t('finance.filters.eur') },
        { value: 'CHF', label: t('finance.filters.chf') },
    ]

    return (
        <>
            <select
                value={selectedCurrency}
                onChange={e => onCurrencyChange(e.target.value)}
                className="h-8 px-2.5 bg-white dark:bg-white/5 dark:backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-md text-xs text-gray-600 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer"
            >
                {CURRENCIES.map(c => (
                    <option key={c.value} value={c.value}>
                        {c.label}
                    </option>
                ))}
            </select>
            <DateRangePicker
                value={dateRange}
                onChange={onDateRangeChange}
            />
        </>
    )
}
