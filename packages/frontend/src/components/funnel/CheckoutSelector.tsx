import { ShoppingCart } from 'lucide-react'
import { useI18n } from '@/i18n'

interface Checkout {
    id: string
    name: string
}

interface CheckoutSelectorProps {
    checkouts: Checkout[]
    selectedCheckout: string
    loading: boolean
    saving: boolean
    onCheckoutChange: (checkoutId: string) => Promise<boolean>
    onUpdate: () => void
}

export default function CheckoutSelector({
    checkouts,
    selectedCheckout,
    loading,
    saving,
    onCheckoutChange,
    onUpdate
}: CheckoutSelectorProps) {
    const { t } = useI18n()
    const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const success = await onCheckoutChange(e.target.value)
        if (success) {
            onUpdate()
        } else {
            alert(t('funnel_components.checkout_selector.link_error'))
        }
    }

    const selectedCheckoutData = checkouts.find(c => c.id === selectedCheckout)
    const isCheckoutLinked = !!selectedCheckout && !!selectedCheckoutData

    return (
        <div className="bg-white dark:bg-[#0f1117] rounded-lg border border-gray-200 dark:border-zinc-800 p-4">
            <div className="flex items-center gap-2 mb-3">
                <ShoppingCart className="text-[#10b981]" size={16} />
                <label className="text-xs font-medium text-gray-900 dark:text-white">
                    Checkout
                </label>
            </div>

            {loading ? (
                <p className="text-xs text-gray-500 dark:text-zinc-400">{t('funnel_components.checkout_selector.loading')}</p>
            ) : isCheckoutLinked ? (
                <div>
                    <div className="px-3 py-2 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded text-xs text-gray-900 dark:text-white">
                        {selectedCheckoutData.name}
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-green-400">
                        <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                        <span>{t('funnel_components.checkout_selector.linked')}</span>
                    </div>
                </div>
            ) : (
                <select
                    value={selectedCheckout}
                    onChange={handleChange}
                    disabled={saving || checkouts.length === 0}
                    className="w-full px-3 py-2 bg-white dark:bg-transparent border border-gray-300 dark:border-zinc-700 rounded text-xs text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-zinc-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <option value="">{t('funnel_components.checkout_selector.select_placeholder')}</option>
                    {checkouts.map((checkout) => (
                        <option key={checkout.id} value={checkout.id}>
                            {checkout.name}
                        </option>
                    ))}
                </select>
            )}

            {checkouts.length === 0 && !loading && !isCheckoutLinked && (
                <div className="mt-2 bg-yellow-500/10 border border-yellow-500/30 rounded p-2">
                    <p className="text-xs text-yellow-400">
                        {t('funnel_components.checkout_selector.no_checkouts')}
                    </p>
                </div>
            )}

            {saving && (
                <div className="mt-2 text-xs text-zinc-400">
                    {t('common.saving')}
                </div>
            )}
        </div>
    )
}
