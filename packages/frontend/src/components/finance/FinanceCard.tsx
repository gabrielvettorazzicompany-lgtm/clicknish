import { useI18n } from '@/i18n'

interface FinanceCardProps {
    type: 'available' | 'pending' | 'anticipation' | 'reserve'
    value: number
    currency?: string
    onAction?: () => void
}

export default function FinanceCard({ type, value, currency = 'BRL', onAction }: FinanceCardProps) {
    const { t } = useI18n()
    const formatCurrency = (val: number) => {
        const locale = currency === 'BRL' ? 'pt-BR' : 'en-US'
        return val.toLocaleString(locale, { style: 'currency', currency })
    }

    const configs = {
        available: {
            label: t('finance.card.available_balance'),
            bar: 'bg-blue-500',
            subtitle: t('finance.card.available_subtitle'),
            actions: (
                <div className="flex items-center gap-2 text-[10px]">
                    <button onClick={onAction} className="text-emerald-400 hover:underline font-medium">
                        {t('finance.card.request_withdrawal')}
                    </button>
                </div>
            )
        },
        pending: {
            label: t('finance.card.pending_balance'),
            bar: 'bg-blue-500',
            subtitle: t('finance.card.pending_subtitle'),
            actions: (
                <div className="flex items-center gap-2 text-[10px]">
                    <button onClick={onAction} className="text-amber-400 hover:underline font-medium">
                        {t('finance.card.request_anticipation')}
                    </button>
                </div>
            )
        },
        anticipation: {
            label: t('finance.card.awaiting_anticipation'),
            bar: 'bg-blue-500',
            subtitle: t('finance.card.processing'),
            actions: null
        },
        reserve: {
            label: t('finance.card.financial_reserve'),
            bar: 'bg-blue-500',
            subtitle: t('finance.card.retained_by_platform'),
            actions: null
        }
    }

    const config = configs[type]

    return (
        <div className="relative overflow-hidden rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 dark:backdrop-blur-xl shadow-sm px-4 py-3 flex flex-col gap-1">
            {/* Barra colorida lateral */}
            <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${config.bar}`} />

            {/* Título */}
            <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {config.label}
            </span>

            {/* Valor */}
            <p className="text-lg font-bold tracking-tight text-gray-900 dark:text-white leading-none">
                {formatCurrency(value)}
            </p>

            {/* Subtítulo / Ações */}
            {config.actions ?? (
                <p className="text-[10px] text-gray-400 dark:text-gray-500">{config.subtitle}</p>
            )}
        </div>
    )
}
