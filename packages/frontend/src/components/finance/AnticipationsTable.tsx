import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Anticipation } from '@/hooks/useFinance'

interface AnticipationsTableProps {
    anticipations: Anticipation[]
}

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
    completed: { label: 'Concluída', class: 'text-green-400' },
    pending: { label: 'Pendente', class: 'text-yellow-400' },
    processing: { label: 'Processando', class: 'text-blue-400' },
    failed: { label: 'Falhou', class: 'text-red-400' },
    cancelled: { label: 'Cancelada', class: 'text-gray-400' },
}

export default function AnticipationsTable({ anticipations }: AnticipationsTableProps) {
    const fmt = (val: number, cur = 'USD') =>
        val.toLocaleString('en-US', { style: 'currency', currency: cur })

    const fmtDate = (date: string | null) => {
        if (!date) return '-'
        return format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    }

    if (anticipations.length === 0) {
        return (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400 text-sm">
                Nenhuma antecipação solicitada ainda.
            </div>
        )
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead className="border-b border-gray-200 dark:border-white/10">
                    <tr>
                        <th className="px-6 py-3 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Valor bruto</th>
                        <th className="px-6 py-3 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Taxa</th>
                        <th className="px-6 py-3 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Valor líquido</th>
                        <th className="px-6 py-3 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Solicitado em</th>
                        <th className="px-6 py-3 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Concluído em</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                    {anticipations.map((a) => {
                        const statusCfg = STATUS_CONFIG[a.status] || STATUS_CONFIG.pending
                        return (
                            <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{fmt(a.amount, a.currency)}</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="text-sm text-red-400">-{fmt(a.feeAmount, a.currency)}</span>
                                    <p className="text-[10px] text-gray-500 mt-0.5">{a.feePercentage}% + {fmt(a.feeFixed, a.currency)}</p>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="text-sm font-semibold text-green-400">{fmt(a.netAmount, a.currency)}</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`text-sm font-medium ${statusCfg.class}`}>{statusCfg.label}</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="text-sm text-gray-500 dark:text-gray-400">{fmtDate(a.createdAt)}</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="text-sm text-gray-500 dark:text-gray-400">{fmtDate(a.completedAt)}</span>
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

