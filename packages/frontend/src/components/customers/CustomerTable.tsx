import { Mail, Edit, Trash2 } from 'lucide-react'
import type { Customer } from '@/types/customers'
import { useI18n } from '@/i18n'

interface CustomerTableProps {
    customers: Customer[]
    filteredCustomers: Customer[]
    selectedCustomers: string[]
    loading: boolean
    saving: boolean
    onSelectAll: (checked: boolean) => void
    onSelectCustomer: (id: string, checked: boolean) => void
    onSendEmail: (customer: Customer) => void
    onManageAccess: (customer: Customer) => void
    onEditCustomer: (customer: Customer) => void
    onDeleteCustomer: (customer: Customer) => void
    formatDate: (date: string) => string
    formatTime: (date: string) => string
}

export default function CustomerTable({
    customers,
    filteredCustomers,
    selectedCustomers,
    loading,
    saving,
    onSelectAll,
    onSelectCustomer,
    onSendEmail,
    onManageAccess,
    onEditCustomer,
    onDeleteCustomer,
    formatDate,
    formatTime
}: CustomerTableProps) {
    const { t } = useI18n()
    return (
        <div className="rounded-lg border border-gray-300 dark:border-[#2a2f45] overflow-hidden bg-white dark:bg-transparent">
            <table className="w-full">
                <thead className="bg-gray-50 dark:bg-[#1a1d2e] border-b border-gray-200 dark:border-[#2a2f45]">
                    <tr>
                        <th className="px-6 py-4 text-left">
                            <input
                                type="checkbox"
                                checked={selectedCustomers.length === filteredCustomers.length && filteredCustomers.length > 0}
                                onChange={(e) => onSelectAll(e.target.checked)}
                                className="w-4 h-4 rounded border-gray-300 dark:border-[#2a2f45] accent-indigo-600 cursor-pointer"
                            />
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">{t('customers.table.name_email')}</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">{t('customers.table.phone')}</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">{t('customers.table.registration_date')}</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">{t('customers.table.actions')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-[#2a2f45] bg-white dark:bg-transparent">
                    {loading ? (
                        <tr>
                            <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                <div className="flex items-center justify-center gap-2">
                                    <div className="w-4 h-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
                                    {t('common.loading')}
                                </div>
                            </td>
                        </tr>
                    ) : filteredCustomers.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                {t('customers.empty')}
                            </td>
                        </tr>
                    ) : (
                        filteredCustomers.map((customer) => (
                            <tr key={customer.id} className="hover:bg-gray-50 dark:hover:bg-[#1a1d2e] transition-colors">
                                <td className="px-6 py-4">
                                    <input
                                        type="checkbox"
                                        checked={selectedCustomers.includes(customer.id)}
                                        onChange={(e) => onSelectCustomer(customer.id, e.target.checked)}
                                        className="w-4 h-4 rounded border-gray-300 dark:border-[#2a2f45] accent-indigo-600 cursor-pointer"
                                    />
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                                            <span className="text-white font-semibold text-sm">
                                                {customer.full_name?.charAt(0).toUpperCase() || customer.email.charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                        <div>
                                            <div className="font-medium text-gray-900 dark:text-gray-100 text-sm">{customer.full_name || customer.email}</div>
                                            <div className="text-xs text-gray-600 dark:text-gray-500">{customer.email}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-sm text-gray-700 dark:text-gray-300">{customer.phone}</span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-sm text-gray-700 dark:text-gray-300">{customer.created_at ? formatDate(customer.created_at) : '-'}</div>
                                    {customer.created_at && <div className="text-xs text-gray-500">{formatTime(customer.created_at)}</div>}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => onSendEmail(customer)}
                                            disabled={saving}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 text-white text-xs font-medium rounded-lg transition-colors"
                                        >
                                            <Mail className="w-3.5 h-3.5" />
                                            {t('customers.table.send_email_btn')}
                                        </button>
                                        <button
                                            onClick={() => onManageAccess(customer)}
                                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                            title={t('customers.table.manage_access')}
                                        >
                                            <Mail className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => onEditCustomer(customer)}
                                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-yellow-50 dark:hover:bg-[#252941] text-gray-600 dark:text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-400 transition-colors"
                                            title={t('customers.table.edit')}
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => onDeleteCustomer(customer)}
                                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                            title={t('customers.table.delete')}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    )
}
