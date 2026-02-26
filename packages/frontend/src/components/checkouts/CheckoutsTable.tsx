import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ExternalLink, Copy, Trash2, Pencil } from 'lucide-react'
import { memo, useCallback, useMemo } from 'react'
import { useI18n } from '@/i18n'
import {
    Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
    Button, Tooltip
} from '@heroui/react'
import { Checkout } from '@/hooks/useCheckouts'

// Memoizar StatusBadge
const StatusBadge = memo(function StatusBadge({ status }: { status: string }) {
    const { t } = useI18n()
    return (
        <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${status === 'active'
                ? 'bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20'
                : 'bg-gray-500/10 text-gray-400 ring-1 ring-gray-500/20'
                }`}
        >
            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${status === 'active' ? 'bg-emerald-400' : 'bg-gray-500'}`} />
            {status === 'active' ? t('checkouts.status.active') : t('checkouts.status.inactive')}
        </span>
    )
})

interface CheckoutsTableProps {
    checkouts: Checkout[]
    onDelete: (checkout: Checkout) => void
    onCopyLink: (checkout: Checkout) => void
    onViewPage: (checkout: Checkout) => void
    onEdit: (checkout: Checkout) => void
}

const CheckoutsTable = memo(function CheckoutsTable({
    checkouts,
    onDelete,
    onCopyLink,
    onViewPage,
    onEdit
}: CheckoutsTableProps) {
    const { t } = useI18n()

    // Memoizar formatters
    const formatCurrency = useCallback((value: number, currency: string = 'BRL') => {
        return value.toLocaleString('pt-BR', { style: 'currency', currency })
    }, [])

    const formatDate = useCallback((date: string) => {
        return format(new Date(date), 'dd/MM/yyyy', { locale: ptBR })
    }, [])

    if (checkouts.length === 0) {
        return (
            <div className="text-center py-12 text-sm text-gray-500 dark:text-gray-400">
                {t('checkouts.table.empty')}
            </div>
        )
    }

    return (
        <div className="overflow-x-auto -mx-2 px-2">
            <Table
                aria-label={t('checkouts.table.aria_label')}
                removeWrapper
                classNames={{
                    th: 'bg-gray-50 dark:bg-white/[0.04] text-gray-400 dark:text-gray-500 text-[10px] font-semibold uppercase tracking-widest border-b border-gray-200 dark:border-white/10 py-3',
                    td: 'py-3.5 border-b border-gray-100 dark:border-white/[0.05] last:border-b-0',
                    tr: 'hover:bg-gray-50/80 dark:hover:bg-white/[0.03] transition-colors duration-150',
                    base: 'min-w-[700px]',
                }}
            >
                <TableHeader>
                    <TableColumn>{t('checkouts.table.name')}</TableColumn>
                    <TableColumn>{t('checkouts.table.product')}</TableColumn>
                    <TableColumn>{t('checkouts.table.status')}</TableColumn>
                    <TableColumn>{t('checkouts.table.conversion')}</TableColumn>
                    <TableColumn>{t('checkouts.table.total_sales')}</TableColumn>
                    <TableColumn>{t('checkouts.table.visits')}</TableColumn>
                    <TableColumn>{t('checkouts.table.actions')}</TableColumn>
                </TableHeader>
                <TableBody>
                    {checkouts.map((checkout) => (
                        <TableRow key={checkout.id}>
                            <TableCell>
                                <div>
                                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{checkout.name}</p>
                                    <p className="text-xs text-gray-400">/{checkout.slug}</p>
                                </div>
                            </TableCell>
                            <TableCell>
                                <div>
                                    <p className="text-sm text-gray-900 dark:text-gray-100">{checkout.product_name}</p>
                                    {checkout.price && (
                                        <p className="text-xs text-gray-400">{formatCurrency(checkout.price, checkout.currency)}</p>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell><StatusBadge status={checkout.status} /></TableCell>
                            <TableCell>
                                <div>
                                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{checkout.conversion_rate.toFixed(2)}%</p>
                                    <p className="text-xs text-gray-400">{checkout.conversions} {t('checkouts.table.sales')}</p>
                                </div>
                            </TableCell>
                            <TableCell>
                                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    {formatCurrency(checkout.total_sales, checkout.currency)}
                                </span>
                            </TableCell>
                            <TableCell>
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                    {checkout.visits.toLocaleString('pt-BR')}
                                </span>
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-0.5">
                                    <Tooltip content={t('checkouts.table.view_page')} size="sm">
                                        <Button
                                            isIconOnly size="sm" variant="light"
                                            onPress={() => onViewPage(checkout)}
                                            className="text-gray-400 hover:text-blue-500 hover:bg-blue-500/10"
                                        >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                        </Button>
                                    </Tooltip>
                                    <Tooltip content={t('common.edit')} size="sm">
                                        <Button
                                            isIconOnly size="sm" variant="light"
                                            onPress={() => onEdit(checkout)}
                                            className="text-gray-400 hover:text-indigo-500 hover:bg-indigo-500/10"
                                        >
                                            <Pencil className="w-3.5 h-3.5" />
                                        </Button>
                                    </Tooltip>
                                    <Tooltip content={t('checkouts.table.copy_link')} size="sm">
                                        <Button
                                            isIconOnly size="sm" variant="light"
                                            onPress={() => onCopyLink(checkout)}
                                            className="text-gray-400 hover:text-blue-500 hover:bg-blue-500/10"
                                        >
                                            <Copy className="w-3.5 h-3.5" />
                                        </Button>
                                    </Tooltip>
                                    <Tooltip content={t('checkouts.table.delete_btn')} color="danger" size="sm">
                                        <Button
                                            isIconOnly size="sm" variant="light" color="danger"
                                            onPress={() => onDelete(checkout)}
                                            className="text-gray-400 hover:text-red-500 hover:bg-red-500/10"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    </Tooltip>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
})

export default CheckoutsTable
