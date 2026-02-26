import type { Customer } from '@/types/customers'
import { useI18n } from '@/i18n'

interface DeleteCustomerModalProps {
    customer: Customer
    saving: boolean
    onConfirm: () => void
    onClose: () => void
}

export default function DeleteCustomerModal({ customer, saving, onConfirm, onClose }: DeleteCustomerModalProps) {
    const { t } = useI18n()

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-[#1a1d2e] rounded-lg shadow-xl max-w-md w-full">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-[#2a2f45]">
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('customers.modal.delete_title')}</h2>
                </div>

                <div className="px-6 py-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {t('customers.modal.delete_confirm')}<strong>{customer.full_name || customer.email}</strong>?
                    </p>
                    <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                        {t('customers.modal.delete_warning')}
                    </p>
                </div>

                <div className="px-6 py-4 border-t border-gray-200 dark:border-[#2a2f45] flex gap-3 justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border border-gray-300 dark:border-[#2a2f45] rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#252941] transition-colors"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={saving}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                    >
                        {saving ? (
                            <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />{t('common.deleting')}</>
                        ) : t('common.delete')}
                    </button>
                </div>
            </div>
        </div>
    )
}
