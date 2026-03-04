import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useI18n } from '@/i18n'

export interface WithdrawalRequest {
    id: string
    amount: number
    currency: string
    payoutSchedule: 'D+2' | 'D+5' | 'D+12'
    feePercentage: number
    feeFixed: number
    feeAmount: number
    netAmount: number
    status: 'processing' | 'completed' | 'failed' | 'cancelled'
    createdAt: string
    completedAt: string | null
}

interface WithdrawalTableProps {
    withdrawals: WithdrawalRequest[]
}

export default function WithdrawalTable({ withdrawals }: WithdrawalTableProps) {
    const { t } = useI18n()

    const formatCurrency = (value: number, currency = 'USD') => {
        const locale = currency === 'BRL' ? 'pt-BR' : 'en-US'
        return value.toLocaleString(locale, { style: 'currency', currency })
    }

    const formatDate = (date: string) => {
        return format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    }

    const getStatusText = (status: string) => {
        const configs: Record<string, { label: string; class: string }> = {
            completed: { label: 'Concluído', class: 'text-green-600 dark:text-green-400' },
            processing: { label: 'Em processamento', class: 'text-amber-500 dark:text-amber-400' },
            failed: { label: 'Falhou', class: 'text-red-600 dark:text-red-400' },
            cancelled: { label: 'Cancelado', class: 'text-gray-500 dark:text-gray-400' },
        }
        const config = configs[status] || configs.processing
        return <span className={config.class}>{config.label}</span>
    }

    const getScheduleBadge = (schedule: string) => {
        const colors: Record<string, string> = {
            'D+2': 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
            'D+5': 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400',
            'D+12': 'bg-gray-100 dark:bg-gray-500/20 text-gray-700 dark:text-gray-400',
        }
        return (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${colors[schedule] || colors['D+5']}`}>
                {schedule}
            </span>
        )
    }

    if (withdrawals.length === 0) {
        return (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400 text-sm">
                Nenhum pedido de saque encontrado.
            </div>
        )
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead className="border-b border-gray-200 dark:border-white/10">
                    <tr>
                        <th className="px-6 py-3 text-left text-[10px] font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wider">
                            Descrição
                        </th>
                        <th className="px-6 py-3 text-left text-[10px] font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wider">
                            Status
                        </th>
                        <th className="px-6 py-3 text-left text-[10px] font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wider">
                            Entrada
                        </th>
                        <th className="px-6 py-3 text-left text-[10px] font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wider">
                            Taxa
                        </th>
                        <th className="px-6 py-3 text-left text-[10px] font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wider">
                            Data
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                    {withdrawals.map((w) => (
                        <tr key={w.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors">
                            <td className="px-6 py-4">
                                <div className="flex flex-col gap-1">
                                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                        Pedido de Saque — {formatCurrency(w.amount, w.currency)}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        {getStatusText(w.status)}
                                        {getScheduleBadge(w.payoutSchedule)}
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {getStatusText(w.status)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm font-semibold text-green-500">
                                    {formatCurrency(w.amount, w.currency)}
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex flex-col">
                                    <span className="text-xs text-red-400">
                                        -{formatCurrency(w.feeAmount, w.currency)}
                                    </span>
                                    <span className="text-[10px] text-gray-400">
                                        {w.feePercentage}% + {formatCurrency(w.feeFixed, w.currency)}
                                    </span>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                {formatDate(w.createdAt)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
