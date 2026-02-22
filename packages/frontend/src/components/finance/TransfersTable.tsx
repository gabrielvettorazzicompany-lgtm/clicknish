import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useI18n } from '@/i18n'

interface Transfer {
    id: string
    value: number
    destination: string
    status: 'completed' | 'pending' | 'processing' | 'failed'
    message: string
    requestDate: string
    paymentDate: string | null
}

interface TransfersTableProps {
    transfers: Transfer[]
}

export default function TransfersTable({ transfers }: TransfersTableProps) {
    const { t } = useI18n()
    const formatCurrency = (value: number) => {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    }

    const formatDate = (date: string | null) => {
        if (!date) return '-'
        return format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    }

    const getStatusText = (status: string) => {
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
            },
            failed: {
                label: t('finance.status.failed'),
                class: 'text-red-600 dark:text-red-400'
            }
        }

        const config = configs[status] || configs.pending

        return (
            <span className={config.class}>
                {config.label}
            </span>
        )
    }

    if (transfers.length === 0) {
        return (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                {t('finance.transfers.empty')}
            </div>
        )
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead className="border-b border-gray-200 dark:border-white/10">
                    <tr>
                        <th className="px-6 py-3 text-left text-[10px] font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wider">
                            {t('finance.transfers.amount')}
                        </th>
                        <th className="px-6 py-3 text-left text-[10px] font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wider">
                            {t('finance.transfers.destination')}
                        </th>
                        <th className="px-6 py-3 text-left text-[10px] font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wider">
                            {t('finance.transfers.status')}
                        </th>
                        <th className="px-6 py-3 text-left text-[10px] font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wider">
                            {t('finance.transfers.message')}
                        </th>
                        <th className="px-6 py-3 text-left text-[10px] font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wider">
                            {t('finance.transfers.request_date')}
                        </th>
                        <th className="px-6 py-3 text-left text-[10px] font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wider">
                            {t('finance.transfers.payment_date')}
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                    {transfers.map((transfer) => (
                        <tr key={transfer.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                    {formatCurrency(transfer.value)}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                    {transfer.destination}
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm">
                                    {getStatusText(transfer.status)}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                    {transfer.message}
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                    {formatDate(transfer.requestDate)}
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                    {formatDate(transfer.paymentDate)}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
