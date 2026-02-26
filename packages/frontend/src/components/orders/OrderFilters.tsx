import { DateRange } from 'react-day-picker'
import { Select, SelectItem } from '@heroui/react'
import DateRangePicker from '@/components/dashboard/DateRangePicker'
import ProductSelector from './ProductSelector'
import { useI18n } from '@/i18n'

interface OrderFiltersProps {
    paymentMethod: string
    onPaymentMethodChange: (method: string) => void
    dateRange: DateRange | undefined
    onDateRangeChange: (range: DateRange | undefined) => void
    selectedProduct: string
    onProductChange: (productId: string) => void
}

export default function OrderFilters({
    paymentMethod,
    onPaymentMethodChange,
    dateRange,
    onDateRangeChange,
    selectedProduct,
    onProductChange
}: OrderFiltersProps) {
    const { t } = useI18n()

    return (
        <div className="flex items-center gap-2 mb-6 flex-wrap">
            <ProductSelector
                selectedProduct={selectedProduct}
                onProductChange={onProductChange}
            />
            <Select
                size="sm"
                radius="lg"
                selectedKeys={[paymentMethod]}
                onChange={(e) => onPaymentMethodChange(e.target.value)}
                classNames={{
                    base: "w-52",
                    trigger: "h-8 min-h-8 bg-white dark:bg-white/5 dark:backdrop-blur-xl border-gray-200 dark:border-white/10 data-[hover=true]:bg-white dark:data-[hover=true]:bg-white/5",
                    value: "text-xs text-gray-600 dark:text-gray-300",
                    popoverContent: "bg-white dark:bg-[#0c0f1a] border border-gray-200 dark:border-white/10",
                    selectorIcon: "hidden",
                }}
                aria-label={t('orders.payment_method.label')}
            >
                <SelectItem key="all" className="text-gray-300">{t('orders.payment_method.label')}</SelectItem>
                <SelectItem key="credit_card" className="text-gray-300">{t('orders.payment_method.credit_card')}</SelectItem>
            </Select>

            <DateRangePicker
                value={dateRange}
                onChange={onDateRangeChange}
            />
        </div>
    )
}
