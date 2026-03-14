import { useState } from 'react'
import { X, AlertCircle, Lock } from 'lucide-react'
import { useI18n } from '@/i18n'

export type PayoutSchedule = 'D+2' | 'D+5' | 'D+12'

const PAYOUT_FEES: Record<PayoutSchedule, { percentage: number }> = {
    'D+2': { percentage: 8.99 },
    'D+5': { percentage: 6.49 },
    'D+12': { percentage: 5.99 },
}

interface WithdrawModalProps {
    isOpen: boolean
    onClose: () => void
    availableBalance: number
    currency: string
    onConfirm: (amount: number, schedule: PayoutSchedule) => Promise<void>
}

export default function WithdrawModal({ isOpen, onClose, availableBalance, currency, onConfirm }: WithdrawModalProps) {
    const { t } = useI18n()
    const [amount, setAmount] = useState('')
    const [schedule, setSchedule] = useState<PayoutSchedule>('D+5')
    const [loading, setLoading] = useState(false)

    if (!isOpen) return null

    const fmt = (val: number) => val.toLocaleString('en-US', { style: 'currency', currency })
    const numAmount = parseFloat(amount) || 0
    const fee = PAYOUT_FEES[schedule]
    const feeAmount = numAmount * (fee.percentage / 100)
    const netAmount = Math.max(0, numAmount - feeAmount)

    const handleConfirm = async () => {
        if (numAmount <= 0 || numAmount > availableBalance) return
        setLoading(true)
        try {
            await onConfirm(numAmount, schedule)
            onClose()
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-[#0f1420] border border-gray-200 dark:border-white/10 rounded-2xl w-full max-w-md mx-4 p-6 shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('finance.withdraw_modal.title')}</h2>
                        <p className="text-xs text-gray-500">{t('finance.withdraw_modal.available')} {fmt(availableBalance)}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors">
                        <X className="w-4 h-4 text-gray-500" />
                    </button>
                </div>

                {/* Valor */}
                <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">{t('finance.withdraw_modal.amount_label')}</label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">{currency}</span>
                        <input
                            type="number"
                            min="1"
                            max={availableBalance}
                            step="0.01"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full pl-12 pr-4 py-2.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-400"
                        />
                    </div>
                </div>

                {/* Prazo de liberação */}
                <div className="mb-5">
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">{t('finance.withdraw_modal.release_period')}</label>
                    <div className="grid grid-cols-3 gap-2">
                        {/* D+2 — bloqueado, requer solicitação */}
                        <div className="relative flex flex-col items-center py-3 px-2 rounded-xl border border-gray-200 dark:border-white/10 text-center opacity-50 cursor-not-allowed select-none">
                            <Lock className="w-3.5 h-3.5 text-gray-400 mb-0.5" />
                            <span className="text-base font-bold text-gray-400">D+2</span>
                            <span className="text-[10px] mt-0.5 text-gray-400">{t('finance.withdraw_modal.payout_fast')}</span>
                            <span className="text-[10px] font-semibold mt-1 text-amber-400">{PAYOUT_FEES['D+2'].percentage}%</span>
                        </div>
                        {(['D+5', 'D+12'] as PayoutSchedule[]).map((key) => {
                            const info = PAYOUT_FEES[key]
                            const labelKey = key === 'D+5' ? 'payout_standard' : 'payout_economy'
                            return (
                                <button
                                    key={key}
                                    onClick={() => setSchedule(key)}
                                    className={`flex flex-col items-center py-3 px-2 rounded-xl border text-center transition-all ${schedule === key
                                            ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                                            : 'border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-white/20'
                                        }`}
                                >
                                    <span className="text-base font-bold">{key}</span>
                                    <span className="text-[10px] mt-0.5">{t(`finance.withdraw_modal.${labelKey}`)}</span>
                                    <span className="text-[10px] font-semibold mt-1 text-amber-400">{info.percentage}%</span>
                                </button>
                            )
                        })}
                    </div>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5">
                        D+2 requer solicitação — entre em contato com o suporte.
                    </p>
                </div>

                {/* Resumo de taxas */}
                {numAmount > 0 && (
                    <div className="mb-5 p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 space-y-1.5">
                        <div className="flex justify-between text-xs">
                            <span className="text-gray-500">{t('finance.withdraw_modal.gross_amount')}</span>
                            <span className="text-gray-900 dark:text-gray-100">{fmt(numAmount)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-gray-500">{t('finance.withdraw_modal.fee_label')} {schedule} ({fee.percentage}%)</span>
                            <span className="text-red-400">-{fmt(feeAmount)}</span>
                        </div>
                        <div className="border-t border-gray-200 dark:border-white/10 pt-1.5 flex justify-between text-sm font-semibold">
                            <span className="text-gray-700 dark:text-gray-300">{t('finance.withdraw_modal.you_receive')}</span>
                            <span className="text-green-400">{fmt(netAmount)}</span>
                        </div>
                    </div>
                )}

                {/* Aviso conta nova */}
                <div className="flex items-start gap-2 mb-5 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                    <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-400">
                        {t('finance.withdraw_modal.new_account_warning')}
                    </p>
                </div>

                {/* Botões */}
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                    >
                        {t('finance.withdraw_modal.cancel')}
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={loading || numAmount <= 0 || numAmount > availableBalance}
                        className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-white transition-colors"
                    >
                        {loading ? t('finance.withdraw_modal.processing') : t('finance.withdraw_modal.confirm')}
                    </button>
                </div>
            </div>
        </div>
    )
}
