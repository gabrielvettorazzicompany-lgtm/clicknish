import React, { useState, useEffect } from 'react'
import { useI18n } from '@/i18n'

type PaymentMethod = 'credit_card' | 'paypal'

interface Props {
    selectedPaymentMethods: PaymentMethod[]
    defaultPaymentMethod: PaymentMethod
    onTogglePaymentMethod: (method: PaymentMethod) => void
    onSetDefaultPaymentMethod: (method: PaymentMethod) => void
    onSave?: () => Promise<void> // Nova prop para salvar
}

const METHODS: { id: PaymentMethod; icon: React.ReactNode }[] = [
    {
        id: 'credit_card',
        icon: (
            <svg className="w-4 h-4" viewBox="0 0 20 13" fill="none">
                <rect width="20" height="13" rx="2" fill="#ffffff" stroke="#d1d5db" strokeWidth="0.5" />
                <rect x="1" y="2" width="18" height="2" fill="#1434CB" />
                <rect x="1" y="6" width="5" height="1.5" fill="#cccccc" rx="0.3" />
                <rect x="1" y="8.5" width="7" height="1" fill="#cccccc" rx="0.3" />
                <rect x="14" y="8.5" width="5" height="1.5" fill="#1434CB" rx="0.3" />
            </svg>
        ),
    },
    {
        id: 'paypal',
        icon: (
            <svg className="w-4 h-4" viewBox="0 0 124 33" fill="#179bd7">
                <path d="M46.211 6.749h-6.839a.95.95 0 0 0-.939.802l-2.766 17.537a.57.57 0 0 0 .564.658h3.265a.95.95 0 0 0 .939-.803l.746-4.73a.95.95 0 0 1 .938-.803h2.165c4.505 0 7.105-2.18 7.784-6.5.306-1.89.013-3.375-.872-4.415-.972-1.142-2.696-1.746-4.985-1.746zM47.117 13.154c-.374 2.454-2.249 2.454-4.062 2.454h-1.032l.724-4.583a.57.57 0 0 1 .563-.481h.473c1.235 0 2.4 0 3.002.704.359.42.469 1.044.332 1.906z" />
                <path d="M7.266 29.154l.523-3.322-1.165-.027H1.061L4.927 1.292a.316.316 0 0 1 .314-.268h9.38c1.586 0 2.784.312 3.567.928.289.228.543.486.756.769a4.584 4.584 0 0 1 .428.694c.12.25.215.534.285.85.068.307.108.658.12 1.054.011.378.006.814-.016 1.311v.14l.498.108a3.573 3.573 0 0 1 1.319.915c.394.398.678.899.842 1.485.158.567.188 1.244.089 2.01v.301l-.024.162-.03.309c-.263 1.663-.795 2.817-1.619 3.518-.759.644-1.846.975-3.221.975H16.54c-.445 0-.869.214-1.134.574a1.405 1.405 0 0 0-.259 1.019l-.013.11-.674 4.27-.018.097a.317.317 0 0 1-.200.254.327.327 0 0 1-.11.018H7.266z" />
            </svg>
        ),
    },
]

export default function AppSettingsTab({
    selectedPaymentMethods,
    defaultPaymentMethod,
    onTogglePaymentMethod,
    onSetDefaultPaymentMethod,
    onSave
}: Props) {
    const { t } = useI18n()

    // Estado local para mudanças não salvas
    const [localSelectedMethods, setLocalSelectedMethods] = useState<PaymentMethod[]>(selectedPaymentMethods)
    const [localDefaultMethod, setLocalDefaultMethod] = useState<PaymentMethod>(defaultPaymentMethod)
    const [saving, setSaving] = useState(false)
    const [hasChanges, setHasChanges] = useState(false)

    // Sincronizar com props quando mudarem externamente
    useEffect(() => {
        setLocalSelectedMethods(selectedPaymentMethods)
        setLocalDefaultMethod(defaultPaymentMethod)
        setHasChanges(false)
    }, [selectedPaymentMethods, defaultPaymentMethod])

    // Detectar mudanças
    useEffect(() => {
        const methodsChanged = JSON.stringify(localSelectedMethods.sort()) !== JSON.stringify(selectedPaymentMethods.sort())
        const defaultChanged = localDefaultMethod !== defaultPaymentMethod
        setHasChanges(methodsChanged || defaultChanged)
    }, [localSelectedMethods, localDefaultMethod, selectedPaymentMethods, defaultPaymentMethod])

    const handleToggleMethod = (method: PaymentMethod) => {
        const updated = localSelectedMethods.includes(method)
            ? localSelectedMethods.filter(m => m !== method)
            : [...localSelectedMethods, method]

        if (updated.length === 0) return // Pelo menos 1 método deve estar ativo

        setLocalSelectedMethods(updated)

        // Se removeu o método padrão, definir outro como padrão
        if (!updated.includes(localDefaultMethod) && updated.length > 0) {
            setLocalDefaultMethod(updated[0])
        }
    }

    const handleSetDefault = (method: PaymentMethod) => {
        if (!localSelectedMethods.includes(method)) return
        setLocalDefaultMethod(method)
    }

    const handleSave = async () => {
        if (!hasChanges) return

        setSaving(true)
        try {
            // Aplicar mudanças via callbacks existentes
            const methodsToAdd = localSelectedMethods.filter(m => !selectedPaymentMethods.includes(m))
            const methodsToRemove = selectedPaymentMethods.filter(m => !localSelectedMethods.includes(m))

            // Toggle métodos que mudaram
            for (const method of methodsToAdd) {
                onTogglePaymentMethod(method)
            }
            for (const method of methodsToRemove) {
                onTogglePaymentMethod(method)
            }

            // Definir padrão se mudou
            if (localDefaultMethod !== defaultPaymentMethod) {
                onSetDefaultPaymentMethod(localDefaultMethod)
            }

            // Chamar função de salvar customizada se existir
            if (onSave) {
                await onSave()
            }

        } catch (error) {
            console.error('Erro ao salvar:', error)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="bg-white dark:bg-[#1a1d2e] rounded-lg shadow-xl shadow-black/5 dark:shadow-black/10 border border-gray-200 dark:border-[#1e2139] p-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">{t('apps.settings_tab.payment_methods')}</h2>

            <div className="flex flex-col gap-2 mb-3">
                {METHODS.map(method => (
                    <div
                        key={method.id}
                        className={`flex items-center justify-between gap-3 border-2 rounded-lg px-3 py-2.5 cursor-pointer transition-all ${localSelectedMethods.includes(method.id)
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-[#1e2139] hover:border-[#252941]'
                            }`}
                        onClick={() => handleToggleMethod(method.id)}
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
                                handleSetDefault(method.id)
                            }}
                            className={`flex-shrink-0 px-3 py-1 rounded-md text-xs font-medium transition-colors ${localDefaultMethod === method.id
                                ? 'bg-blue-500 text-white hover:bg-blue-600'
                                : 'border border-[#252941] text-gray-300 hover:bg-[#0f1117]'
                                }`}
                            disabled={!localSelectedMethods.includes(method.id)}
                        >
                            {t('apps.settings_tab.default_method')}
                        </button>
                    </div>
                ))}
            </div>

            <div className="mb-4">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    {t('apps.settings_tab.default_checkout_method')}
                </label>
                <select
                    value={localDefaultMethod}
                    onChange={e => handleSetDefault(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-[#0f1117] text-gray-900 dark:text-gray-200 border border-gray-300 dark:border-[#252941] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={localSelectedMethods.length === 0}
                >
                    {METHODS.filter(m => localSelectedMethods.includes(m.id)).map(m => (
                        <option key={m.id} value={m.id}>{t(`apps.settings_tab.${m.id}`)}</option>
                    ))}
                </select>
            </div>

            {/* Indicador de mudanças */}
            {hasChanges && (
                <div className="mb-4 text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-2">
                    ⚠️ Você tem alterações não salvas
                </div>
            )}

            {/* Botão de Salvar */}
            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={!hasChanges || saving}
                    className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${hasChanges && !saving
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                        }`}
                >
                    {saving ? (
                        <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Salvando...</span>
                        </div>
                    ) : (
                        'Salvar Alterações'
                    )}
                </button>
            </div>
        </div>
    )
}
