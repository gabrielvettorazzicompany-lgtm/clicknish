import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import { Transaction } from '@/hooks/useFinance'
import { useI18n } from '@/i18n'

interface FinanceTableProps {
    transactions: Transaction[]
}

export default function FinanceTable({ transactions }: FinanceTableProps) {
    const { t } = useI18n()
    const formatCurrency = (value: number, currency = 'BRL') => {
        const locale = currency === 'BRL' ? 'pt-BR' : 'en-US'
        return value.toLocaleString(locale, { style: 'currency', currency })
    }

    const formatDate = (date: string) => {
        return format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    }

    const getTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            sale: t('finance.types.sale'),
            commission: t('finance.types.commission'),
            withdrawal: t('finance.types.withdrawal'),
            refund: t('finance.types.refund'),
            anticipation: t('finance.types.anticipation')
        }
        return labels[type] || type
    }

    const getStatusBadge = (status: string) => {
        const configs: Record<string, { label: string; class: string }> = {
            completed: {
                label: t('finance.status.completed'),
                class: 'text-green-600 dark:text-green-400'
            },
            pending: {
                label: t('finance.status.pending'),
                class: 'text-yellow-600 dark:text-yellow-400'
            },
            processing: {
                label: t('finance.status.processing'),
                class: 'text-blue-600 dark:text-blue-400'
            }
        }

        const config = configs[status] || configs.pending

        return (
            <span className={config.class}>
                {config.label}
            </span>
        )
    }

    if (transactions.length === 0) {
        return (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                {t('finance.table.empty')}
            </div>
        )
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead className="border-b border-gray-200 dark:border-white/10">
                    <tr>
                        <th className="px-6 py-3 text-left text-[10px] font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wider">
                            {t('finance.table.description')}
                        </th>
                        <th className="px-6 py-3 text-left text-[10px] font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wider">
                            {t('finance.table.movement_type')}
                        </th>
                        <th className="px-6 py-3 text-left text-[10px] font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wider">
                            {t('finance.table.income')}
                        </th>
                        <th className="px-6 py-3 text-left text-[10px] font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wider">
                            {t('finance.table.expense')}
                        </th>
                        <th className="px-6 py-3 text-left text-[10px] font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wider">
                            {t('finance.table.date')}
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                    {transactions.map((transaction) => (
                        <tr key={transaction.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors">
                            <td className="px-6 py-4">
                                <div className="flex items-start gap-2">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                            {transaction.description}
                                        </span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                            {getStatusBadge(transaction.status)}
                                        </span>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                    {getTypeLabel(transaction.type)}
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                {transaction.direction === 'in' ? (
                                    <span className="text-sm font-medium text-green-600 dark:text-green-400">
                                        {formatCurrency(transaction.amount, transaction.currency)}
                                    </span>
                                ) : (
                                    <span className="text-sm text-gray-400">-</span>
                                )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                {transaction.direction === 'out' ? (
                                    <span className="text-sm font-medium text-red-600 dark:text-red-400">
                                        {formatCurrency(transaction.amount, transaction.currency)}
                                    </span>
                                ) : (
                                    <span className="text-sm text-gray-400">-</span>
                                )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                    {formatDate(transaction.date)}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
