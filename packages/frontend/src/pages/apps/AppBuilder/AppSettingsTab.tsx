import React from 'react'
import { useI18n } from '@/i18n'

type PaymentMethod = 'credit_card' | 'paypal'

interface Props {
    selectedPaymentMethods: PaymentMethod[]
    defaultPaymentMethod: PaymentMethod
    onTogglePaymentMethod: (method: PaymentMethod) => void
    onSetDefaultPaymentMethod: (method: PaymentMethod) => void
}

const METHODS: { id: PaymentMethod; icon: React.ReactNode }[] = [
    {
        id: 'credit_card',
        icon: (
            <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="3" y="6" width="18" height="12" rx="2" strokeWidth="2" />
                <line x1="3" y1="10" x2="21" y2="10" strokeWidth="2" />
            </svg>
        ),
    },
    {
        id: 'paypal',
        icon: (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                <path d="M7.5 21H4L6.5 5h6c2.5 0 4.5 1.5 4 4.5-.5 3-3 4.5-5.5 4.5H9l-1 5-1 2z" fill="#009CDE" />
                <path d="M9 13.5h2c2 0 4-1 4.5-3.5S14 5 11.5 5H8.5L6.5 17.5H9" fill="#003087" />
            </svg>
        ),
    },
]

export default function AppSettingsTab({
    selectedPaymentMethods,
    defaultPaymentMethod,
    onTogglePaymentMethod,
    onSetDefaultPaymentMethod,
}: Props) {
    const { t } = useI18n()

    return (
        <div className="bg-white dark:bg-[#1a1d2e] rounded-lg shadow-xl shadow-black/5 dark:shadow-black/10 border border-gray-200 dark:border-[#1e2139] p-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">{t('apps.settings_tab.payment_methods')}</h2>

            <div className="flex flex-col gap-2 mb-3">
                {METHODS.map(method => (
                    <div
                        key={method.id}
                        className={`flex items-center justify-between gap-3 border-2 rounded-lg px-3 py-2.5 cursor-pointer transition-all ${
                            selectedPaymentMethods.includes(method.id)
                                ? 'border-blue-500 bg-blue-500/10'
                                : 'border-[#1e2139] hover:border-[#252941]'
                        }`}
                        onClick={() => onTogglePaymentMethod(method.id)}
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 bg-gray-100 dark:bg-[#252941] rounded flex items-center justify-center flex-shrink-0">
                                {method.icon}
                            </div>
                            <span className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
                                {t(`apps.settings_tab.${method.id}`)}
                            </span>
                        </div>
                        <button
                            onClick={e => {
                                e.stopPropagation()
                                onSetDefaultPaymentMethod(method.id)
                            }}
                            className={`flex-shrink-0 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                                defaultPaymentMethod === method.id
                                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                                    : 'border border-[#252941] text-gray-300 hover:bg-[#0f1117]'
                            }`}
                            disabled={!selectedPaymentMethods.includes(method.id)}
                        >
                            {t('apps.settings_tab.default_method')}
                        </button>
                    </div>
                ))}
            </div>

            <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    {t('apps.settings_tab.default_checkout_method')}
                </label>
                <select
                    value={defaultPaymentMethod}
                    onChange={e => onSetDefaultPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-[#0f1117] text-gray-900 dark:text-gray-200 border border-gray-300 dark:border-[#252941] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={selectedPaymentMethods.length === 0}
                >
                    {METHODS.filter(m => selectedPaymentMethods.includes(m.id)).map(m => (
                        <option key={m.id} value={m.id}>{t(`apps.settings_tab.${m.id}`)}</option>
                    ))}
                </select>
            </div>
        </div>
    )
}
