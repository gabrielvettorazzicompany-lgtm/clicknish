import { Eye, EyeOff } from 'lucide-react'
import { DateRange } from 'react-day-picker'
import { Select, SelectItem } from '@heroui/react'
import DateRangePicker from './DateRangePicker'
import { useI18n } from '@/i18n'
import type { CombinedItem } from '@/types/customers'

interface DashboardFiltersProps {
    selectedCurrency: string
    dateRange: DateRange | undefined
    hideValues: boolean
    combinedItems?: CombinedItem[]
    selectedApp?: string
    selectedMarketplace?: string
    onCurrencyChange: (currency: string) => void
    onDateRangeChange: (range: DateRange | undefined) => void
    onToggleValues: () => void
    onAppChange?: (value: string) => void
}

export default function DashboardFilters({
    selectedCurrency,
    dateRange,
    hideValues,
    combinedItems = [],
    selectedApp = '',
    selectedMarketplace = '',
    onCurrencyChange,
    onDateRangeChange,
    onToggleValues,
    onAppChange
}: DashboardFiltersProps) {
    const { t } = useI18n()
    const hasAppSelection = !!(selectedApp || selectedMarketplace)

    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {/* App/Marketplace Filter */}
            {combinedItems.length > 0 && onAppChange && (
                <div className="w-full sm:w-48">
                    <Select
                        aria-label="Filtrar por loja/app"
                        selectedKeys={selectedApp || selectedMarketplace ? [selectedApp || selectedMarketplace] : []}
                        onChange={(e) => onAppChange(e.target.value)}
                        variant="bordered"
                        radius="md"
                        size="sm"
                        placeholder="Todas as lojas"
                        classNames={{
                            trigger: 'bg-white dark:bg-white/5 dark:backdrop-blur-xl border-gray-200 dark:border-white/10 hover:border-primary data-[focus=true]:border-primary h-8',
                            value: 'text-xs text-gray-700 dark:text-gray-300',
                            popoverContent: 'bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10',
                            selectorIcon: 'hidden',
                        }}
                    >
                        {combinedItems.map(item => (
                            <SelectItem key={item.id}>{item.name}</SelectItem>
                        ))}
                    </Select>
                </div>
            )}
            {/* Moeda */}
            <select
                value={selectedCurrency}
                onChange={(e) => onCurrencyChange(e.target.value)}
                className="h-8 px-2.5 bg-white dark:bg-white/5 dark:backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-md text-xs text-gray-600 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer"
            >
                <option value="BRL">BRL</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="CHF">CHF</option>
            </select>

            {/* Date Range Picker */}
            <DateRangePicker value={dateRange} onChange={onDateRangeChange} />

            {/* Ocultar valores */}
            <button
                onClick={onToggleValues}
                title={hideValues ? t('dashboard.show_values') : t('dashboard.hide_values')}
                className="h-8 w-8 flex items-center justify-center bg-white dark:bg-white/5 dark:backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-md text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
            >
                {hideValues ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
        </div>
    )
}
