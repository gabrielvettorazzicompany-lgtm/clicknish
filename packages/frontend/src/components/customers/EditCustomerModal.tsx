import { X } from 'lucide-react'
import type { CustomerFormData } from '@/types/customers'
import { useI18n } from '@/i18n'

interface EditCustomerModalProps {
    saving: boolean
    formData: CustomerFormData
    onFormChange: (data: CustomerFormData) => void
    onSave: () => void
    onClose: () => void
}

export default function EditCustomerModal({ saving, formData, onFormChange, onSave, onClose }: EditCustomerModalProps) {
    const { t } = useI18n()

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-[#1a1d2e] rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white dark:bg-[#1a1d2e] border-b border-gray-200 dark:border-[#2a2f45] px-6 py-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('customers.modal.edit_title')}</h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('customers.modal.edit_subtitle')}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); onSave() }} className="p-6">
                    <div className="space-y-4 mb-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('customers.modal.name')}</label>
                            <input
                                type="text"
                                placeholder={t('customers.modal.name_placeholder')}
                                value={formData.name}
                                onChange={(e) => onFormChange({ ...formData, name: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-[#2a2f45] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-[#6366f1]/50 text-sm bg-white dark:bg-[#0f1117] text-gray-900 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                {t('customers.modal.email')} <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="email"
                                placeholder={t('customers.modal.email_placeholder')}
                                value={formData.email}
                                onChange={(e) => onFormChange({ ...formData, email: e.target.value })}
                                required
                                className="w-full px-3 py-2 border border-gray-300 dark:border-[#2a2f45] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-[#6366f1]/50 text-sm bg-white dark:bg-[#0f1117] text-gray-900 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('customers.modal.phone')}</label>
                            <input
                                type="tel"
                                placeholder={t('customers.modal.phone_placeholder')}
                                value={formData.phone}
                                onChange={(e) => onFormChange({ ...formData, phone: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-[#2a2f45] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-[#6366f1]/50 text-sm bg-white dark:bg-[#0f1117] text-gray-900 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400"
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-gray-300 dark:border-[#2a2f45] rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#252941] transition-colors"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                        >
                            {saving ? (
                                <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />{t('common.saving')}</>
                            ) : t('common.save')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
