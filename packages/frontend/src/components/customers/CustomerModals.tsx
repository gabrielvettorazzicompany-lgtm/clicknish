import { X, CheckCircle } from 'lucide-react'
import type { Customer, Product, CustomerFormData } from '@/types/customers'
import { useI18n } from '@/i18n'

// ─── Shared Modal Shell ────────────────────────────────────────────────────────

function ModalShell({ title, subtitle, onClose, children }: {
    title: string
    subtitle?: string
    onClose: () => void
    children: React.ReactNode
}) {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-[#1a1d2e] rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white dark:bg-[#1a1d2e] border-b border-gray-200 dark:border-[#2a2f45] px-6 py-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
                        {subtitle && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{subtitle}</p>}
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                {children}
            </div>
        </div>
    )
}

function SaveButton({ saving, label, loadingLabel }: { saving: boolean; label?: string; loadingLabel?: string }) {
    const { t } = useI18n()
    return (
        <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
            {saving ? (
                <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />{loadingLabel || t('common.saving')}</>
            ) : label || t('common.save')}
        </button>
    )
}

function CancelButton({ onClick, label }: { onClick: () => void; label?: string }) {
    const { t } = useI18n()
    return (
        <button
            type="button"
            onClick={onClick}
            className="px-4 py-2 border border-gray-300 dark:border-[#2a2f45] rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#252941] transition-colors"
        >
            {label || t('common.cancel')}
        </button>
    )
}

// ─── Modal New Customer ────────────────────────────────────────────────────────

interface NewCustomerModalProps {
    products: Product[]
    formData: CustomerFormData
    saving: boolean
    onFormChange: (data: CustomerFormData) => void
    onToggleProduct: (id: string) => void
    onSubmit: (e: React.FormEvent) => void
    onClose: () => void
}

export function NewCustomerModal({ products, formData, saving, onFormChange, onToggleProduct, onSubmit, onClose }: NewCustomerModalProps) {
    const { t } = useI18n()
    return (
        <ModalShell title={t('customers.modal.new_title')} subtitle={t('customers.modal.new_subtitle')} onClose={onClose}>
            <form onSubmit={onSubmit} className="p-6">
                <div className="space-y-4 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('customers.modal.name')}</label>
                        <input type="text" placeholder={t('customers.modal.name_placeholder')} value={formData.name}
                            onChange={(e) => onFormChange({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-[#2a2f45] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white dark:bg-[#0f1117] text-gray-900 dark:text-gray-200 placeholder-gray-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('customers.modal.email')} <span className="text-red-500">*</span></label>
                        <input type="email" placeholder={t('customers.modal.email_placeholder')} value={formData.email} required
                            onChange={(e) => onFormChange({ ...formData, email: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-[#2a2f45] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white dark:bg-[#0f1117] text-gray-900 dark:text-gray-200 placeholder-gray-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('customers.modal.phone')}</label>
                        <input type="tel" placeholder={t('customers.modal.phone_placeholder')} value={formData.phone}
                            onChange={(e) => onFormChange({ ...formData, phone: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-[#2a2f45] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white dark:bg-[#0f1117] text-gray-900 dark:text-gray-200 placeholder-gray-500" />
                    </div>
                </div>

                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{t('customers.modal.products')}</label>
                    {products.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">{t('customers.modal.no_products')}</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {products.map((product) => (
                                <label key={product.id} className="flex items-center gap-3 p-3 border border-gray-200 dark:border-[#2a2f45] rounded-lg hover:bg-gray-50 dark:hover:bg-[#252941] cursor-pointer transition-colors">
                                    <input type="checkbox" checked={formData.selectedProducts.includes(product.id)}
                                        onChange={() => onToggleProduct(product.id)}
                                        className="w-4 h-4 rounded border-gray-300 accent-indigo-600" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{product.name}</p>
                                        {product.price && (
                                            <p className="text-xs text-gray-500">USD {(product.price / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                                        )}
                                    </div>
                                </label>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex gap-3 justify-end">
                    <CancelButton onClick={onClose} />
                    <SaveButton saving={saving} />
                </div>
            </form>
        </ModalShell>
    )
}

// ─── Modal Manage Access ───────────────────────────────────────────────────────

interface ManageAccessModalProps {
    customer: Customer
    products: Product[]
    customerProducts: { [key: string]: boolean }
    productMembers: { [key: string]: boolean }
    saving: boolean
    onToggleAccess: (id: string) => void
    onToggleMember: (id: string) => void
    onSave: () => void
    onClose: () => void
}

export function ManageAccessModal({ customer, products, customerProducts, productMembers, saving, onToggleAccess, onToggleMember, onSave, onClose }: ManageAccessModalProps) {
    const { t } = useI18n()
    return (
        <ModalShell title={t('customers.modal.manage_access_title')} subtitle={t('customers.modal.manage_access_subtitle') + (customer.full_name || customer.email)} onClose={onClose}>
            <div className="p-6">
                {products.length === 0 ? (
                    <p className="text-center text-gray-500 dark:text-gray-400">{t('customers.modal.no_products_available')}</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        {products.map((product) => (
                            <div key={product.id} onClick={() => onToggleAccess(product.id)}
                                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${customerProducts[product.id]
                                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 dark:border-indigo-400'
                                    : 'border-gray-200 dark:border-[#2a2f45] bg-white dark:bg-[#0f1117] hover:border-gray-300'}`}>
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-medium text-gray-900 dark:text-white truncate">{product.name}</h3>
                                        <p className={`text-sm mt-1 ${customerProducts[product.id] ? 'text-green-600 dark:text-green-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                                            {customerProducts[product.id] ? t('customers.modal.access_granted') : t('customers.modal.no_access')}
                                        </p>
                                    </div>
                                    {customerProducts[product.id] && <CheckCircle className="w-5 h-5 text-indigo-600 ml-2 flex-shrink-0" />}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="mt-8 pt-8 border-t border-gray-200 dark:border-[#2a2f45]">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{t('customers.modal.product_members')}</h3>
                    <p className="text-xs text-gray-500 mb-4">{t('customers.modal.product_members_subtitle')}</p>
                    {products.length === 0 ? (
                        <p className="text-center text-gray-500">{t('customers.modal.no_products_available')}</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {products.map((product) => (
                                <div key={product.id} onClick={() => onToggleMember(product.id)}
                                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${productMembers[product.id]
                                        ? 'border-green-500 bg-green-50 dark:bg-green-900/30 dark:border-green-400'
                                        : 'border-gray-200 dark:border-[#2a2f45] bg-white dark:bg-[#0f1117] hover:border-gray-300'}`}>
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-medium text-gray-900 dark:text-white truncate">{product.name}</h3>
                                            <p className={`text-sm mt-1 ${productMembers[product.id] ? 'text-green-600 dark:text-green-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                                                {productMembers[product.id] ? t('customers.modal.member') : t('customers.modal.not_member')}
                                            </p>
                                        </div>
                                        {productMembers[product.id] && <CheckCircle className="w-5 h-5 text-green-500 ml-2 flex-shrink-0" />}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex gap-3 justify-end pt-4 border-t border-gray-200 dark:border-[#2a2f45] mt-8">
                    <CancelButton onClick={onClose} />
                    <button
                        onClick={onSave}
                        disabled={saving}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                    >
                        {saving ? (
                            <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />{t('common.saving')}</>
                        ) : t('customers.modal.done')}
                    </button>
                </div>
            </div>
        </ModalShell>
    )
}

// ─── Modal Edit Customer ───────────────────────────────────────────────────────

interface EditCustomerModalProps {
    formData: CustomerFormData
    saving: boolean
    onFormChange: (data: CustomerFormData) => void
    onSave: () => void
    onClose: () => void
}

export function EditCustomerModal({ formData, saving, onFormChange, onSave, onClose }: EditCustomerModalProps) {
    const { t } = useI18n()
    return (
        <ModalShell title={t('customers.modal.edit_title')} subtitle={t('customers.modal.edit_subtitle')} onClose={onClose}>
            <form onSubmit={(e) => { e.preventDefault(); onSave() }} className="p-6">
                <div className="space-y-4 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('customers.modal.name')}</label>
                        <input type="text" placeholder={t('customers.modal.name_placeholder')} value={formData.name}
                            onChange={(e) => onFormChange({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-[#2a2f45] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white dark:bg-[#0f1117] text-gray-900 dark:text-gray-200 placeholder-gray-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('customers.modal.email')} <span className="text-red-500">*</span></label>
                        <input type="email" placeholder={t('customers.modal.email_placeholder')} value={formData.email} required
                            onChange={(e) => onFormChange({ ...formData, email: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-[#2a2f45] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white dark:bg-[#0f1117] text-gray-900 dark:text-gray-200 placeholder-gray-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('customers.modal.phone')}</label>
                        <input type="tel" placeholder={t('customers.modal.phone_placeholder')} value={formData.phone}
                            onChange={(e) => onFormChange({ ...formData, phone: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-[#2a2f45] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white dark:bg-[#0f1117] text-gray-900 dark:text-gray-200 placeholder-gray-500" />
                    </div>
                </div>
                <div className="flex gap-3 justify-end">
                    <CancelButton onClick={onClose} />
                    <SaveButton saving={saving} />
                </div>
            </form>
        </ModalShell>
    )
}

// ─── Modal Delete Confirm ──────────────────────────────────────────────────────

interface DeleteConfirmModalProps {
    customer: Customer
    saving: boolean
    onConfirm: () => void
    onClose: () => void
}

export function DeleteConfirmModal({ customer, saving, onConfirm, onClose }: DeleteConfirmModalProps) {
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
                    <p className="text-sm text-red-600 dark:text-red-400 font-medium">{t('customers.modal.delete_warning')}</p>
                </div>
                <div className="px-6 py-4 border-t border-gray-200 dark:border-[#2a2f45] flex gap-3 justify-end">
                    <CancelButton onClick={onClose} />
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
