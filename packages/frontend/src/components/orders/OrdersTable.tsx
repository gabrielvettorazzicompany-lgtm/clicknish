import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CreditCard, Check, Minus } from 'lucide-react'
import { memo, useCallback, useMemo } from 'react'
import {
    Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
    Chip, User
} from '@heroui/react'
import { Order } from '@/hooks/useOrders'
import { useI18n } from '@/i18n'

// Memoizar componentes de status para evitar re-criações
const StatusChip = memo(function StatusChip({ status }: { status: string }) {
    const { t } = useI18n()
    const config = useMemo(() => ({
        completed: { color: 'success' as const, label: t('orders.status.paid') },
        pending: { color: 'warning' as const, label: t('orders.status.pending') },
        failed: { color: 'danger' as const, label: t('orders.status.failed') },
    }), [t])

    const { color, label } = config[status as keyof typeof config] ?? { color: 'default' as const, label: status }

    return (
        <Chip size="sm" variant="flat" color={color} radius="sm">
            {label}
        </Chip>
    )
})

const PaymentMethodBadge = memo(function PaymentMethodBadge({ method }: { method: string }) {
    const { t } = useI18n()
    const normalized = method.toLowerCase()

    if (normalized.includes('pix')) {
        return <Chip size="sm" variant="flat" color="success" radius="sm">{t('orders.payment_method.pix')}</Chip>
    }
    if (normalized.includes('boleto')) {
        return <Chip size="sm" variant="flat" color="warning" radius="sm">{t('orders.payment_method.boleto')}</Chip>
    }
    if (normalized.includes('paypal')) {
        return <Chip size="sm" variant="flat" color="primary" radius="sm">PayPal</Chip>
    }
    if (normalized.includes('ideal')) {
        return <Chip size="sm" variant="flat" color="secondary" radius="sm">iDEAL</Chip>
    }
    if (normalized.includes('bancontact')) {
        return <Chip size="sm" variant="flat" color="secondary" radius="sm">Bancontact</Chip>
    }
    if (normalized.includes('klarna')) {
        return <Chip size="sm" variant="flat" color="secondary" radius="sm">Klarna</Chip>
    }
    if (normalized.includes('sofort')) {
        return <Chip size="sm" variant="flat" color="secondary" radius="sm">SOFORT</Chip>
    }
    if (normalized.includes('giropay')) {
        return <Chip size="sm" variant="flat" color="secondary" radius="sm">Giropay</Chip>
    }
    if (normalized.includes('applepay') || normalized.includes('apple_pay')) {
        return <Chip size="sm" variant="flat" color="default" radius="sm">Apple Pay</Chip>
    }
    if (normalized.includes('googlepay') || normalized.includes('google_pay')) {
        return <Chip size="sm" variant="flat" color="default" radius="sm">Google Pay</Chip>
    }
    if (normalized.includes('eps')) {
        return <Chip size="sm" variant="flat" color="secondary" radius="sm">EPS</Chip>
    }
    if (normalized.includes('przelewy') || normalized.includes('p24')) {
        return <Chip size="sm" variant="flat" color="secondary" radius="sm">Przelewy24</Chip>
    }
    if (normalized.includes('sepa') || normalized.includes('direct_debit')) {
        return <Chip size="sm" variant="flat" color="secondary" radius="sm">SEPA</Chip>
    }
    if (normalized.includes('bank_transfer') || normalized.includes('banktransfer')) {
        return <Chip size="sm" variant="flat" color="default" radius="sm">Transferência</Chip>
    }
    return (
        <Chip
            size="sm"
            variant="flat"
            color="secondary"
            radius="sm"
            startContent={<CreditCard size={11} />}
        >
            {t('orders.payment_method.credit_card')}
        </Chip>
    )
})
interface OrdersTableProps {
    orders: Order[]
    selectedOrders: Set<string>
    onSelectAll: (checked: boolean) => void
    onSelectOrder: (orderId: string, checked: boolean) => void
}

const OrdersTable = memo(function OrdersTable({
    orders,
    selectedOrders,
    onSelectAll,
    onSelectOrder
}: OrdersTableProps) {
    const { t } = useI18n()

    // Memoizar formatters
    const formatCurrency = useCallback((value: number, currency: string) => {
        const safeCurrency = currency || 'BRL'
        const currencyMap: { [key: string]: string } = {
            'USD': 'en-US',
            'EUR': 'de-DE',
            'CHF': 'de-CH',
            'BRL': 'pt-BR'
        }
        const locale = currencyMap[safeCurrency] || 'en-US'
        return value.toLocaleString(locale, { style: 'currency', currency: safeCurrency })
    }, [])

    const formatDate = useCallback((date: string) => {
        return format(new Date(date), "dd/MM/yyyy HH:mm", { locale: ptBR })
    }, [])

    // Memoizar handlers
    const handleSelectAll = useCallback((checked: boolean) => {
        onSelectAll(checked)
    }, [onSelectAll])

    const handleSelectOrder = useCallback((orderId: string, checked: boolean) => {
        onSelectOrder(orderId, checked)
    }, [onSelectOrder])

    return (
        <div className="overflow-x-auto -mx-2 px-2">
            <Table
                aria-label={t('orders.table.aria_label')}
                removeWrapper
                selectionMode="none"
                classNames={{
                    th: 'bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-400 text-xs uppercase border-b border-gray-200 dark:border-white/10',
                    td: 'py-3 border-b border-gray-100 dark:border-white/5',
                    tr: 'hover:bg-gray-50 dark:hover:bg-white/5 transition-colors',
                    base: 'min-w-[800px]',
                }}
            >
                <TableHeader>
                    <TableColumn width={40}>
                        <button
                            onClick={() => onSelectAll(!(selectedOrders.size === orders.length && orders.length > 0))}
                            className={`
                            w-[14px] h-[14px] rounded border transition-all
                            flex items-center justify-center
                            ${selectedOrders.size === orders.length && orders.length > 0
                                    ? 'bg-blue-500 border-blue-500'
                                    : selectedOrders.size > 0
                                        ? 'bg-blue-500 border-blue-500'
                                        : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
                                }
                        `}
                        >
                            {selectedOrders.size === orders.length && orders.length > 0 ? (
                                <Check size={10} className="text-white" strokeWidth={3} />
                            ) : selectedOrders.size > 0 ? (
                                <Minus size={10} className="text-white" strokeWidth={3} />
                            ) : null}
                        </button>
                    </TableColumn>
                    <TableColumn>{t('orders.table.order')}</TableColumn>
                    <TableColumn>{t('orders.table.date')}</TableColumn>
                    <TableColumn>{t('orders.table.customer')}</TableColumn>
                    <TableColumn>{t('orders.table.total')}</TableColumn>
                    <TableColumn>{t('orders.table.payment')}</TableColumn>
                    <TableColumn>{t('orders.table.status')}</TableColumn>
                    <TableColumn>{t('orders.table.product')}</TableColumn>
                </TableHeader>
                <TableBody>
                    {orders.map((order) => (
                        <TableRow key={order.id}>
                            <TableCell>
                                <button
                                    onClick={() => onSelectOrder(order.id, !selectedOrders.has(order.id))}
                                    className={`
                                    w-[14px] h-[14px] rounded border transition-all
                                    flex items-center justify-center
                                    ${selectedOrders.has(order.id)
                                            ? 'bg-blue-500 border-blue-500'
                                            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
                                        }
                                `}
                                >
                                    {selectedOrders.has(order.id) && (
                                        <Check size={10} className="text-white" strokeWidth={3} />
                                    )}
                                </button>
                            </TableCell>
                            <TableCell>
                                <span className="text-sm font-medium text-blue-500 dark:text-blue-400 cursor-pointer hover:underline">
                                    {order.orderNumber}
                                </span>
                            </TableCell>
                            <TableCell>
                                <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                    {formatDate(order.date)}
                                </span>
                            </TableCell>
                            <TableCell>
                                <User
                                    name={order.customer.name}
                                    description={order.customer.email}
                                    avatarProps={{
                                        size: 'sm',
                                        name: order.customer.name,
                                        color: 'secondary',
                                        isBordered: false,
                                        classNames: { base: 'bg-blue-500/10' },
                                    }}
                                    classNames={{
                                        name: 'text-sm font-medium text-gray-900 dark:text-gray-100',
                                        description: 'text-xs text-gray-500 dark:text-gray-400',
                                    }}
                                />
                            </TableCell>
                            <TableCell>
                                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                                    {formatCurrency(order.total, order.currency || 'BRL')}
                                </span>
                            </TableCell>
                            <TableCell>
                                <PaymentMethodBadge method={order.paymentMethod} />
                            </TableCell>
                            <TableCell>
                                <StatusChip status={order.paymentStatus} />
                            </TableCell>
                            <TableCell>
                                <span className="text-sm text-gray-700 dark:text-gray-300">{order.productName}</span>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
})

export default OrdersTable
