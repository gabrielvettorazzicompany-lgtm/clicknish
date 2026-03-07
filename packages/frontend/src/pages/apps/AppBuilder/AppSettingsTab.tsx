import React, { useState, useEffect } from 'react'
import { useI18n } from '@/i18n'

// CDN oficial da Mollie para ícones de métodos de pagamento
const MOLLIE_ICON_BASE = 'https://www.mollie.com/external/icons/payment-methods'
export const getMollieIcon = (methodId: string): string =>
    `${MOLLIE_ICON_BASE}/${methodId}.svg`

interface MethodOption {
    id: string
    label: string
    iconUrl?: string
    isMollie?: boolean
}

const CreditCardIcon = () => (
    <svg className="w-5 h-4 flex-shrink-0" viewBox="0 0 20 13" fill="none">
        <rect width="20" height="13" rx="2" fill="#ffffff" stroke="#d1d5db" strokeWidth="0.5" />
        <rect x="1" y="2" width="18" height="2" fill="#1434CB" />
        <rect x="1" y="6" width="5" height="1.5" fill="#cccccc" rx="0.3" />
        <rect x="1" y="8.5" width="7" height="1" fill="#cccccc" rx="0.3" />
        <rect x="14" y="8.5" width="5" height="1.5" fill="#1434CB" rx="0.3" />
    </svg>
)

const PaypalIcon = () => (
    <svg className="w-5 h-4 flex-shrink-0" viewBox="0 0 124 33" fill="#179bd7">
        <path d="M46.211 6.749h-6.839a.95.95 0 0 0-.939.802l-2.766 17.537a.57.57 0 0 0 .564.658h3.265a.95.95 0 0 0 .939-.803l.746-4.73a.95.95 0 0 1 .938-.803h2.165c4.505 0 7.105-2.18 7.784-6.5.306-1.89.013-3.375-.872-4.415-.972-1.142-2.696-1.746-4.985-1.746zM47.117 13.154c-.374 2.454-2.249 2.454-4.062 2.454h-1.032l.724-4.583a.57.57 0 0 1 .563-.481h.473c1.235 0 2.4 0 3.002.704.359.42.469 1.044.332 1.906z" />
        <path d="M7.266 29.154l.523-3.322-1.165-.027H1.061L4.927 1.292a.316.316 0 0 1 .314-.268h9.38c1.586 0 2.784.312 3.567.928.289.228.543.486.756.769a4.584 4.584 0 0 1 .428.694c.12.25.215.534.285.85.068.307.108.658.12 1.054.011.378.006.814-.016 1.311v.14l.498.108a3.573 3.573 0 0 1 1.319.915c.394.398.678.899.842 1.485.158.567.188 1.244.089 2.01v.301l-.024.162-.03.309c-.263 1.663-.795 2.817-1.619 3.518-.759.644-1.846.975-3.221.975H16.54c-.445 0-.869.214-1.134.574a1.405 1.405 0 0 0-.259 1.019l-.013.11-.674 4.27-.018.097a.317.317 0 0 1-.200.254.327.327 0 0 1-.11.018H7.266z" />
    </svg>
)

const BASE_METHODS: MethodOption[] = [
    { id: 'credit_card', label: 'Cartão de Crédito' },
    { id: 'paypal', label: 'PayPal' },
]

interface Props {
    selectedPaymentMethods: string[]
    defaultPaymentMethod: string
    dynamicCheckout?: boolean
    onTogglePaymentMethod: (method: string) => void
    onSetDefaultPaymentMethod: (method: string) => void
    onToggleDynamicCheckout?: (value: boolean) => void
    onSave?: () => Promise<void>
    onSaveWithValues?: (methods: string[], defaultMethod: string, isDynamic: boolean) => Promise<void>
}

export default function AppSettingsTab({
    selectedPaymentMethods,
    defaultPaymentMethod,
    dynamicCheckout = false,
    onTogglePaymentMethod,
    onSetDefaultPaymentMethod,
    onToggleDynamicCheckout,
    onSave,
    onSaveWithValues,
}: Props) {
    const { t } = useI18n()
    const [localSelected, setLocalSelected] = useState<string[]>(selectedPaymentMethods)
    const [localDynamic, setLocalDynamic] = useState(dynamicCheckout)
    const [mollieMethods, setMollieMethods] = useState<MethodOption[]>([])
    const [saving, setSaving] = useState(false)
    const [hasChanges, setHasChanges] = useState(false)

    useEffect(() => {
        setLocalSelected(selectedPaymentMethods)
        setLocalDynamic(dynamicCheckout)
        setHasChanges(false)
    }, [selectedPaymentMethods, dynamicCheckout])

    // Buscar métodos Mollie habilitados pelo admin (sem filtro de país)
    useEffect(() => {
        fetch('https://api.clicknich.com/api/mollie/methods?all=1')
            .then(r => r.json())
            .then((d: any) => {
                const methods: MethodOption[] = (d.methods || []).map((m: any) => ({
                    id: `mollie_${m.id}`,
                    label: m.label || m.id,
                    iconUrl: m.icon_url || getMollieIcon(m.id),
                    isMollie: true,
                }))
                setMollieMethods(methods)
            })
            .catch(() => {})
    }, [])

    const allMethods = [...BASE_METHODS, ...mollieMethods]

    const handleToggle = (id: string) => {
        const isSelected = localSelected.includes(id)
        if (!isSelected && localSelected.length >= 3) return // máximo 3
        if (isSelected && localSelected.length === 1) return  // mínimo 1

        const updated = isSelected
            ? localSelected.filter(m => m !== id)
            : [...localSelected, id]

        setLocalSelected(updated)
        setHasChanges(true)
    }

    const handleDynamicToggle = () => {
        setLocalDynamic(v => !v)
        setHasChanges(true)
    }

    const handleSave = async () => {
        if (!hasChanges || saving) return
        setSaving(true)
        try {
            const newDefault = localSelected.includes(defaultPaymentMethod)
                ? defaultPaymentMethod
                : localSelected[0]

            if (onSaveWithValues) {
                await onSaveWithValues(localSelected, newDefault, localDynamic)
            } else {
                // fallback: toggle individual (pode ter race condition)
                const toAdd = localSelected.filter(m => !selectedPaymentMethods.includes(m))
                const toRemove = selectedPaymentMethods.filter(m => !localSelected.includes(m))
                for (const m of toAdd) onTogglePaymentMethod(m)
                for (const m of toRemove) onTogglePaymentMethod(m)
                if (newDefault !== defaultPaymentMethod) onSetDefaultPaymentMethod(newDefault)
                if (localDynamic !== dynamicCheckout && onToggleDynamicCheckout) onToggleDynamicCheckout(localDynamic)
                if (onSave) await onSave()
            }

            setHasChanges(false)
        } catch (e) {
            console.error(e)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="bg-white dark:bg-[#1a1d2e]/80 rounded-xl border border-gray-200 dark:border-white/5 p-4 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('apps.settings_tab.payment_methods')}
                </p>
                {!localDynamic && <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                    localSelected.length >= 3
                        ? 'bg-amber-500/10 text-amber-400'
                        : 'bg-white/5 text-gray-500'
                }`}>
                    {localSelected.length}/3
                </span>}
            </div>

            {/* Toggle: Checkout Dinâmico */}
            <div
                className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] cursor-pointer"
                onClick={handleDynamicToggle}
            >
                <div className="min-w-0 flex-1 mr-3">
                    <p className="text-xs font-medium text-gray-300">{t('apps.settings_tab.dynamic_checkout')}</p>
                    <p className="text-[10px] text-gray-600 mt-0.5 leading-tight">
                        {localDynamic
                            ? t('apps.settings_tab.dynamic_checkout_on')
                            : t('apps.settings_tab.dynamic_checkout_off')}
                    </p>
                </div>
                <div className={`w-9 h-5 rounded-full flex-shrink-0 transition-colors relative ${localDynamic ? 'bg-blue-500' : 'bg-gray-700'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${localDynamic ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
            </div>

            {/* Lista de métodos */}
            {!localDynamic && <div className="flex flex-col gap-1.5">
                {allMethods.map(method => {
                    const isSelected = localSelected.includes(method.id)
                    const isMaxed = !isSelected && localSelected.length >= 3
                    return (
                        <div
                            key={method.id}
                            onClick={() => !isMaxed && handleToggle(method.id)}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-all select-none ${
                                isMaxed ? 'opacity-30 cursor-not-allowed border-transparent' :
                                isSelected
                                    ? 'bg-blue-500/10 border-blue-500/25 cursor-pointer'
                                    : 'border-transparent hover:bg-white/5 cursor-pointer'
                            }`}
                        >
                            {/* Ícone */}
                            <div className="flex-shrink-0 w-6 flex items-center justify-center">
                                {method.id === 'credit_card' ? <CreditCardIcon /> :
                                 method.id === 'paypal' ? <PaypalIcon /> :
                                 method.iconUrl ? (
                                    <img src={method.iconUrl} alt={method.label} className="w-5 h-4 object-contain" />
                                 ) : (
                                    <span className="text-sm">💳</span>
                                 )}
                            </div>

                            {/* Label */}
                            <span className={`flex-1 text-xs transition-colors ${isSelected ? 'text-blue-300' : 'text-gray-400 dark:text-gray-500'}`}>
                                {method.id === 'credit_card' ? t('apps.settings_tab.credit_card') :
                                 method.id === 'paypal' ? t('apps.settings_tab.paypal') :
                                 method.label}
                            </span>

                            {/* Checkbox visual */}
                            <div className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border transition-colors ${
                                isSelected
                                    ? 'bg-blue-500 border-blue-500'
                                    : 'border-gray-600 bg-transparent'
                            }`}>
                                {isSelected && (
                                    <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none">
                                        <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>}

            {!localDynamic && localSelected.length >= 3 && (
                <p className="text-[10px] text-amber-500/80 text-center">
                    Máximo de 3 métodos atingido
                </p>
            )}

            {/* Salvar */}
            <div className="flex justify-end pt-1">
                <button
                    onClick={handleSave}
                    disabled={!hasChanges || saving}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        hasChanges && !saving
                            ? 'bg-blue-600/80 hover:bg-blue-600 text-white'
                            : 'text-gray-500 dark:text-gray-600 cursor-not-allowed'
                    }`}
                >
                    {saving ? (
                        <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                            <span>{t('apps.settings_tab.saving')}</span>
                        </div>
                    ) : t('apps.settings_tab.save')}
                </button>
            </div>
        </div>
    )
}
