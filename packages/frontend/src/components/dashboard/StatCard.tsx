import { Spinner } from '@heroui/react'

type CardColor = 'indigo' | 'violet' | 'emerald' | 'amber'

interface StatCardProps {
    title: string
    value: string
    subtitle: string
    loading?: boolean
    color?: CardColor
    actionText?: string
    onAction?: () => void
}

const colorMap: Record<CardColor, { bar: string; title: string; action: string }> = {
    indigo: { bar: 'bg-blue-500', title: 'text-gray-500 dark:text-gray-400', action: 'text-blue-400' },
    violet: { bar: 'bg-blue-500', title: 'text-gray-500 dark:text-gray-400', action: 'text-blue-400' },
    emerald: { bar: 'bg-blue-500', title: 'text-gray-500 dark:text-gray-400', action: 'text-blue-400' },
    amber: { bar: 'bg-blue-500', title: 'text-gray-500 dark:text-gray-400', action: 'text-blue-400' },
}

export default function StatCard({
    title,
    value,
    subtitle,
    loading = false,
    color = 'indigo',
    actionText,
    onAction
}: StatCardProps) {
    const c = colorMap[color]

    return (
        <div className="relative overflow-hidden rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 dark:backdrop-blur-xl shadow-sm px-4 py-3 flex flex-col gap-1">
            {/* Barra colorida lateral */}
            <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${c.bar}`} />

            {/* Título */}
            <span className={`text-[10px] font-medium uppercase tracking-wide ${c.title}`}>{title}</span>

            {/* Valor */}
            {loading ? (
                <div className="py-0.5">
                    <Spinner size="sm" color="default" />
                </div>
            ) : (
                <p className="text-lg font-bold tracking-tight text-gray-900 dark:text-white leading-none">
                    {value}
                </p>
            )}

            {/* Subtítulo / Ação */}
            {!loading && (
                actionText && onAction ? (
                    <p
                        onClick={onAction}
                        className={`text-[10px] font-medium cursor-pointer hover:underline ${c.action}`}
                    >
                        {actionText} →
                    </p>
                ) : (
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">{subtitle}</p>
                )
            )}
        </div>
    )
}
