import { useState } from 'react'
import { X, AlertCircle } from 'lucide-react'
import { useI18n } from '@/i18n'

// Taxa de antecipação fixa: 2.5% sobre o valor + $0.49
const ANTICIPATION_FEE = { percentage: 2.5, fixed: 0.49 }

interface AnticipationModalProps {
    isOpen: boolean
    onClose: () => void
    pendingBalance: number
    currency: string
    onConfirm: (amount: number) => Promise<void>
}

export default function AnticipationModal({ isOpen, onClose, pendingBalance, currency, onConfirm }: AnticipationModalProps) {
    const { t } = useI18n()
    const [amount, setAmount] = useState('')
    const [loading, setLoading] = useState(false)

    if (!isOpen) return null

    const fmt = (val: number) => val.toLocaleString('en-US', { style: 'currency', currency })
    const numAmount = parseFloat(amount) || 0
    const feeAmount = numAmount * (ANTICIPATION_FEE.percentage / 100) + ANTICIPATION_FEE.fixed
    const netAmount = Math.max(0, numAmount - feeAmount)

    const handleConfirm = async () => {
        if (numAmount <= 0 || numAmount > pendingBalance) return
        setLoading(true)
        try {
            await onConfirm(numAmount)
            setAmount('')
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
                        <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('finance.anticipation_modal.title')}</h2>
                        <p className="text-xs text-gray-500">{t('finance.anticipation_modal.pending_balance')} {fmt(pendingBalance)}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors">
                        <X className="w-4 h-4 text-gray-500" />
                    </button>
                </div>

                {/* Explicação */}
                <div className="mb-5 p-3 rounded-xl bg-purple-500/5 border border-purple-500/20">
                    <p className="text-xs text-purple-300 leading-relaxed">
                        {t('finance.anticipation_modal.explanation_p1')} <span className="font-semibold">{t('finance.anticipation_modal.explanation_keyword')}</span> {t('finance.anticipation_modal.explanation_p2')} <span className="font-semibold">{ANTICIPATION_FEE.percentage}% + {fmt(ANTICIPATION_FEE.fixed)}</span> {t('finance.anticipation_modal.explanation_p3')}
                    </p>
                </div>

                {/* Valor */}
                <div className="mb-5">
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">{t('finance.anticipation_modal.amount_label')}</label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">{currency}</span>
                        <input
                            type="number"
                            min="1"
                            max={pendingBalance}
                            step="0.01"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full pl-12 pr-4 py-2.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:border-purple-400"
                        />
                    </div>
                    {numAmount > pendingBalance && (
                        <p className="text-[11px] text-red-400 mt-1">{t('finance.anticipation_modal.amount_exceeds')}</p>
                    )}
                </div>

                {/* Resumo de taxas */}
                {numAmount > 0 && (
                    <div className="mb-5 p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 space-y-1.5">
                        <div className="flex justify-between text-xs">
                            <span className="text-gray-500">{t('finance.anticipation_modal.requested_amount')}</span>
                            <span className="text-gray-900 dark:text-gray-100">{fmt(numAmount)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-gray-500">{t('finance.anticipation_modal.fee_label')} ({ANTICIPATION_FEE.percentage}% + {fmt(ANTICIPATION_FEE.fixed)})</span>
                            <span className="text-red-400">-{fmt(feeAmount)}</span>
                        </div>
                        <div className="border-t border-gray-200 dark:border-white/10 pt-1.5 flex justify-between text-sm font-semibold">
                            <span className="text-gray-700 dark:text-gray-300">{t('finance.anticipation_modal.you_receive')}</span>
                            <span className="text-green-400">{fmt(netAmount)}</span>
                        </div>
                    </div>
                )}

                {/* Aviso */}
                <div className="flex items-start gap-2 mb-5 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                    <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-400">
                        {t('finance.anticipation_modal.risk_warning')}
                    </p>
                </div>

                {/* Botões */}
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                    >
                        {t('finance.anticipation_modal.cancel')}
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={loading || numAmount <= 0 || numAmount > pendingBalance}
                        className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-white transition-colors"
                    >
                        {loading ? t('finance.anticipation_modal.processing') : t('finance.anticipation_modal.confirm')}
                    </button>
                </div>
            </div>
        </div>
    )
}
