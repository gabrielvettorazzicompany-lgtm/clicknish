import { useState, useRef, useEffect } from 'react'
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
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const CURRENCIES = [
        { value: 'all', label: t('finance.filters.all_currencies') },
        { value: 'USD', label: 'USD' },
        { value: 'BRL', label: 'BRL' },
        { value: 'EUR', label: 'EUR' },
        { value: 'CHF', label: 'CHF' },
    ]
    const currentLabel = CURRENCIES.find(c => c.value === selectedCurrency)?.label ?? selectedCurrency

    return (
        <>
            <div ref={ref} className="relative">
                <button
                    onClick={() => setOpen(o => !o)}
                    className="h-8 px-2.5 bg-white dark:bg-white/5 dark:backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-md text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/10 focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer transition-colors"
                >
                    {currentLabel}
                </button>
                {open && (
                    <div className="absolute top-full left-0 mt-1 bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-md shadow-lg z-50 py-1 min-w-[120px]">
                        {CURRENCIES.map(c => (
                            <button
                                key={c.value}
                                onClick={() => { onCurrencyChange(c.value); setOpen(false) }}
                                className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${c.value === selectedCurrency
                                        ? 'text-blue-500 dark:text-blue-400 font-semibold'
                                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'
                                    }`}
                            >
                                {c.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <DateRangePicker
                value={dateRange}
                onChange={onDateRangeChange}
            />
        </>
    )
}
