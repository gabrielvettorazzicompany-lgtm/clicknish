import { Select, SelectItem } from '@heroui/react'
import SingleDatePicker from '@/components/dashboard/SingleDatePicker'
import type { CombinedItem } from '@/types/customers'
import { useI18n } from '@/i18n'

interface CustomerFiltersProps {
    combinedItems: CombinedItem[]
    selectedApp: string
    selectedMarketplace: string
    selectedDate: Date | null
    onCombinedChange: (value: string) => void
    onDateChange: (date: Date | null) => void
}

export default function CustomerFilters({
    combinedItems,
    selectedApp,
    selectedMarketplace,
    selectedDate,
    onCombinedChange,
    onDateChange
}: CustomerFiltersProps) {
    const { t } = useI18n()
    const hasSelection = !!(selectedApp || selectedMarketplace)

    return (
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-6">
            {/* App / Membership */}
            <div className="md:w-72">
                <Select
                    aria-label={t('customers.filters.app_members')}
                    selectedKeys={selectedApp || selectedMarketplace ? [selectedApp || selectedMarketplace] : []}
                    onChange={(e) => onCombinedChange(e.target.value)}
                    variant="bordered"
                    radius="md"
                    size="sm"
                    placeholder={t('customers.filters.app_members')}
                    classNames={{
                        trigger: 'bg-white dark:bg-white/5 dark:backdrop-blur-xl border-gray-200 dark:border-white/10 hover:border-primary data-[focus=true]:border-primary h-10',
                        value: 'text-sm text-gray-700 dark:text-gray-300',
                        popoverContent: 'bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10',
                        selectorIcon: 'hidden',
                    }}
                >
                    {combinedItems.map(item => (
                        <SelectItem key={item.id}>{item.name}</SelectItem>
                    ))}
                </Select>
            </div>

            {/* Date */}
            <SingleDatePicker
                value={selectedDate}
                onChange={onDateChange}
                disabled={!hasSelection}
                placeholder={t('customers.filters.registration_date')}
            />
        </div>
    )
}
