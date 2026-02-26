import { X } from 'lucide-react'
import type { Product, CustomerFormData } from '@/types/customers'
import { useI18n } from '@/i18n'

interface AddCustomerModalProps {
    products: Product[]
    saving: boolean
    formData: CustomerFormData
    onFormChange: (data: CustomerFormData) => void
    onToggleProduct: (id: string) => void
    onSubmit: (e: React.FormEvent) => void
    onClose: () => void
}

export default function AddCustomerModal({
    products, saving, formData, onFormChange, onToggleProduct, onSubmit, onClose
}: AddCustomerModalProps) {
    const { t } = useI18n()

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-white/10 flex-shrink-0">
                    <div>
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('customers.modal.new_title')}</h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('customers.modal.new_subtitle')}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={onSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
                        {/* Name */}
                        <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('customers.modal.name')}</label>
                            <input
                                type="text"
                                placeholder={t('customers.modal.name_placeholder')}
                                value={formData.name}
                                onChange={(e) => onFormChange({ ...formData, name: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-500 text-sm bg-white dark:bg-white/5 text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                            />
                        </div>
                        {/* Email */}
                        <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                {t('customers.modal.email')} <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="email"
                                placeholder={t('customers.modal.email_placeholder')}
                                value={formData.email}
                                onChange={(e) => onFormChange({ ...formData, email: e.target.value })}
                                required
                                className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-500 text-sm bg-white dark:bg-white/5 text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                            />
                        </div>
                        {/* Phone */}
                        <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('customers.modal.phone')}</label>
                            <input
                                type="tel"
                                placeholder={t('customers.modal.phone_placeholder')}
                                value={formData.phone}
                                onChange={(e) => onFormChange({ ...formData, phone: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-500 text-sm bg-white dark:bg-white/5 text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                            />
                        </div>

                        {/* Products */}
                        <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">{t('customers.modal.products')}</label>
                            {products.length === 0 ? (
                                <p className="text-xs text-gray-500 dark:text-gray-400">{t('customers.modal.no_products')}</p>
                            ) : (
                                <div className="grid grid-cols-1 gap-2">
                                    {products.map((product) => (
                                        <label
                                            key={product.id}
                                            className="flex items-center gap-3 px-3 py-2.5 border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer transition-colors"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={formData.selectedProducts.includes(product.id)}
                                                onChange={() => onToggleProduct(product.id)}
                                                className="w-4 h-4 rounded border-gray-300 dark:border-white/20 accent-indigo-600 flex-shrink-0"
                                            />
                                            <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{product.name}</p>
                                                {product.price && (
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                                                        USD {(product.price / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </p>
                                                )}
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex gap-2 justify-end px-5 py-3.5 border-t border-gray-100 dark:border-white/10 flex-shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-2"
                        >
                            {saving ? (
                                <><div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />{t('common.saving')}</>
                            ) : t('customers.modal.save_customer')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
