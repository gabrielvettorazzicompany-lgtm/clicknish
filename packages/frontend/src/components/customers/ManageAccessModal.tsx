import { X, CheckCircle } from 'lucide-react'
import type { Customer, Product } from '@/types/customers'
import { useI18n } from '@/i18n'

interface ManageAccessModalProps {
    customer: Customer
    products: Product[]
    saving: boolean
    customerProducts: Record<string, boolean>
    onToggleAccess: (id: string) => void
    onSave: () => void
    onClose: () => void
}

export default function ManageAccessModal({
    customer, products, saving,
    customerProducts,
    onToggleAccess, onSave, onClose
}: ManageAccessModalProps) {
    const { t } = useI18n()

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-[#1a1d2e] rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white dark:bg-[#1a1d2e] border-b border-gray-200 dark:border-[#2a2f45] px-6 py-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('customers.modal.manage_access_title')}</h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {t('customers.modal.manage_access_subtitle')}{customer.full_name || customer.email}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6">
                    {products.length === 0 ? (
                        <p className="text-center text-gray-500 dark:text-gray-400">{t('customers.modal.no_products')}</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            {products.map((product) => (
                                <div
                                    key={product.id}
                                    onClick={() => onToggleAccess(product.id)}
                                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${customerProducts[product.id]
                                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 dark:border-indigo-400'
                                        : 'border-gray-200 dark:border-[#2a2f45] bg-white dark:bg-[#0f1117] hover:border-gray-300 dark:hover:border-gray-500'
                                        }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-medium text-gray-900 dark:text-white truncate">{product.name}</h3>
                                            <p className={`text-sm mt-1 ${customerProducts[product.id] ? 'text-green-600 dark:text-green-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                                                {customerProducts[product.id] ? t('customers.modal.access_granted') : t('customers.modal.no_access')}
                                            </p>
                                        </div>
                                        {customerProducts[product.id] && (
                                            <CheckCircle className="w-5 h-5 text-indigo-600 ml-2 flex-shrink-0" />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex gap-3 justify-end pt-4 border-t border-gray-200 dark:border-[#2a2f45] mt-8">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 border border-gray-300 dark:border-[#2a2f45] rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#252941] transition-colors"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            onClick={onSave}
                            disabled={saving}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                        >
                            {saving ? (
                                <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />{t('common.saving')}</>
                            ) : t('common.confirm')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
