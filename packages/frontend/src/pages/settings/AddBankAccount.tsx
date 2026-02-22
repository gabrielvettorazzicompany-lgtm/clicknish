import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Menu, Search } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import UserProfileDropdown from '@/components/UserProfileDropdown'
import { useI18n } from '@/i18n'

function AddBankAccount() {
    const navigate = useNavigate()
    const { t } = useI18n()
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    const [formData, setFormData] = useState({
        // Conta
        bankName: '',
        accountType: 'checking', // checking | savings
        routingNumber: '',
        accountNumber: '',

        // Dados do titular
        firstName: '',
        lastName: '',
        birthDate: '',
        ssn: '',

        // Endereço
        addressLine1: '',
        addressLine2: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'US',

        // Outros
        currency: 'USD'
    })

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            // Aqui você faria a chamada para a API


            // Simular delay
            await new Promise(resolve => setTimeout(resolve, 2000))

            // Voltar para payments settings
            navigate('/admin/payments')
        } catch (error) {
            console.error('Erro ao adicionar conta:', error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-[#0f1117] flex">
            {/* Sidebar */}
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Top Header */}
                <header className="h-14 bg-[#1a1d2e] border-b border-[#1e2139] flex items-center justify-between px-3 lg:px-4">
                    <div className="flex items-center gap-4 flex-1">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="lg:hidden p-2 hover:bg-[#252941] rounded-lg"
                        >
                            <Menu size={18} />
                        </button>

                        <button
                            onClick={() => navigate('/admin/payments')}
                            className="flex items-center gap-2 text-gray-600 hover:text-gray-100 transition-colors"
                        >
                            <ArrowLeft size={20} />
                            <span className="hidden sm:inline">{t('settings.payment.back_to_payment')}</span>
                        </button>

                        <div className="hidden sm:flex items-center gap-2 bg-[#252941] rounded-lg px-4 py-2 max-w-md w-full">
                            <Search size={16} className="text-gray-400" />
                            <input
                                type="text"
                                placeholder={t('settings.payment.search')}
                                className="bg-transparent border-none outline-none text-sm flex-1"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <UserProfileDropdown />
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto">
                    <div className="max-w-4xl mx-auto px-4 lg:px-6 py-8">
                        {/* Page Title */}
                        <div className="mb-8">
                            <h1 className="text-3xl font-bold text-gray-100 mb-2">{t('settings.payment.add_bank_account')}</h1>
                            <p className="text-gray-600">{t('settings.payment.enter_banking_details')}</p>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="bg-[#1a1d2e] rounded-xl border border-[#1e2139] p-8">
                            <div className="space-y-8">
                                {/* Bank Account Information */}
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-100 mb-4">{t('settings.payment.bank_info')}</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                {t('settings.payment.bank_name')} *
                                            </label>
                                            <input
                                                type="text"
                                                name="bankName"
                                                value={formData.bankName}
                                                onChange={handleInputChange}
                                                className="w-full px-3 py-2 border border-[#252941] rounded-md focus:ring-2 focus:ring-blue-400/50 focus:border-transparent"
                                                placeholder={t('settings.payment.enter_bank_name')}
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                {t('settings.payment.account_type')} *
                                            </label>
                                            <select
                                                name="accountType"
                                                value={formData.accountType}
                                                onChange={handleInputChange}
                                                className="w-full px-3 py-2 border border-[#252941] rounded-md focus:ring-2 focus:ring-blue-400/50 focus:border-transparent"
                                                required
                                            >
                                                <option value="checking">{t('settings.payment.checking')}</option>
                                                <option value="savings">{t('settings.payment.savings')}</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                {t('common.currency')} *
                                            </label>
                                            <select
                                                name="currency"
                                                value={formData.currency}
                                                onChange={handleInputChange}
                                                className="w-full px-3 py-2 border border-[#252941] rounded-md focus:ring-2 focus:ring-blue-400/50 focus:border-transparent"
                                                required
                                            >
                                                <option value="USD">USD - US Dollar</option>
                                                <option value="EUR">EUR - Euro</option>
                                                <option value="GBP">GBP - British Pound</option>
                                                <option value="BRL">BRL - Brazilian Real</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                {t('settings.payment.routing_number')} *
                                            </label>
                                            <input
                                                type="text"
                                                name="routingNumber"
                                                value={formData.routingNumber}
                                                onChange={handleInputChange}
                                                className="w-full px-3 py-2 border border-[#252941] rounded-md focus:ring-2 focus:ring-blue-400/50 focus:border-transparent"
                                                placeholder={t('settings.payment.routing_digits')}
                                                maxLength={9}
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                {t('settings.payment.account_number')} *
                                            </label>
                                            <input
                                                type="text"
                                                name="accountNumber"
                                                value={formData.accountNumber}
                                                onChange={handleInputChange}
                                                className="w-full px-3 py-2 border border-[#252941] rounded-md focus:ring-2 focus:ring-blue-400/50 focus:border-transparent"
                                                placeholder={t('settings.payment.account_number')}
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Account Holder Information */}
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-100 mb-4">{t('settings.payment.account_holder_info')}</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                {t('settings.payment.first_name')}
                                            </label>
                                            <input
                                                type="text"
                                                name="firstName"
                                                value={formData.firstName}
                                                onChange={handleInputChange}
                                                className="w-full px-3 py-2 border border-[#252941] rounded-md focus:ring-2 focus:ring-blue-400/50 focus:border-transparent"
                                                placeholder={t('settings.payment.first_name_placeholder')}
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                {t('settings.payment.last_name')}
                                            </label>
                                            <input
                                                type="text"
                                                name="lastName"
                                                value={formData.lastName}
                                                onChange={handleInputChange}
                                                className="w-full px-3 py-2 border border-[#252941] rounded-md focus:ring-2 focus:ring-blue-400/50 focus:border-transparent"
                                                placeholder={t('settings.payment.last_name_placeholder')}
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                {t('settings.payment.date_of_birth')} *
                                            </label>
                                            <input
                                                type="date"
                                                lang="en-US"
                                                name="birthDate"
                                                value={formData.birthDate}
                                                onChange={handleInputChange}
                                                className="w-full px-3 py-2 border border-[#252941] rounded-md focus:ring-2 focus:ring-blue-400/50 focus:border-transparent"
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                {t('settings.payment.ssn_tax_id')} *
                                            </label>
                                            <input
                                                type="text"
                                                name="ssn"
                                                value={formData.ssn}
                                                onChange={handleInputChange}
                                                className="w-full px-3 py-2 border border-[#252941] rounded-md focus:ring-2 focus:ring-blue-400/50 focus:border-transparent"
                                                placeholder="0000"
                                                maxLength={4}
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Address Information */}
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-100 mb-4">{t('settings.payment.residential_address')}</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                {t('settings.payment.address_line_1')} *
                                            </label>
                                            <input
                                                type="text"
                                                name="addressLine1"
                                                value={formData.addressLine1}
                                                onChange={handleInputChange}
                                                className="w-full px-3 py-2 border border-[#252941] rounded-md focus:ring-2 focus:ring-blue-400/50 focus:border-transparent"
                                                placeholder={t('settings.payment.street_address')}
                                                required
                                            />
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                {t('settings.payment.address_line_2')}
                                            </label>
                                            <input
                                                type="text"
                                                name="addressLine2"
                                                value={formData.addressLine2}
                                                onChange={handleInputChange}
                                                className="w-full px-3 py-2 border border-[#252941] rounded-md focus:ring-2 focus:ring-blue-400/50 focus:border-transparent"
                                                placeholder={t('settings.payment.address_optional')}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                {t('settings.payment.city')} *
                                            </label>
                                            <input
                                                type="text"
                                                name="city"
                                                value={formData.city}
                                                onChange={handleInputChange}
                                                className="w-full px-3 py-2 border border-[#252941] rounded-md focus:ring-2 focus:ring-blue-400/50 focus:border-transparent"
                                                placeholder={t('settings.payment.city')}
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                {t('settings.payment.state')} *
                                            </label>
                                            <input
                                                type="text"
                                                name="state"
                                                value={formData.state}
                                                onChange={handleInputChange}
                                                className="w-full px-3 py-2 border border-[#252941] rounded-md focus:ring-2 focus:ring-blue-400/50 focus:border-transparent"
                                                placeholder={t('settings.payment.state_placeholder')}
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                {t('settings.payment.postal_code')} *
                                            </label>
                                            <input
                                                type="text"
                                                name="postalCode"
                                                value={formData.postalCode}
                                                onChange={handleInputChange}
                                                className="w-full px-3 py-2 border border-[#252941] rounded-md focus:ring-2 focus:ring-blue-400/50 focus:border-transparent"
                                                placeholder={t('settings.payment.zip_code')}
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                {t('settings.payment.country')} *
                                            </label>
                                            <select
                                                name="country"
                                                value={formData.country}
                                                onChange={handleInputChange}
                                                className="w-full px-3 py-2 border border-[#252941] rounded-md focus:ring-2 focus:ring-blue-400/50 focus:border-transparent"
                                                required
                                            >
                                                <option value="US">United States</option>
                                                <option value="CA">Canada</option>
                                                <option value="GB">United Kingdom</option>
                                                <option value="BR">Brazil</option>
                                                <option value="DE">Germany</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-4 pt-6 border-t border-[#1e2139]">
                                    <button
                                        type="button"
                                        onClick={() => navigate('/admin/payments')}
                                        className="px-6 py-2 border border-[#252941] text-gray-300 rounded-md hover:bg-[#0f1117] transition-colors"
                                    >
                                        {t('common.cancel')}
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {loading ? t('settings.payment.adding_account') : t('settings.payment.add_account')}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </main>
            </div>
        </div>
    )
}

export default AddBankAccount
