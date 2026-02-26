import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Building2, Edit3, AlertCircle, Building } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/services/supabase'
import { useI18n } from '@/i18n'

interface BankAccount {
    id: string
    type: 'USD'
    currency: string
    method: string
    isDefault: boolean
}

function PaymentSettings() {
    const navigate = useNavigate()
    const { user } = useAuthStore()
    const { t } = useI18n()
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [ownerData, setOwnerData] = useState<{ full_name?: string } | null>(null)
    const [bankAccounts, setBankAccounts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (user) {
            loadOwnerData()
            loadBankAccounts()
        }
    }, [user])

    const loadOwnerData = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('payment_settings')
                .select('full_name, email, phone')
                .eq('user_id', user?.id)
                .single()

            if (error && error.code !== 'PGRST116') {
                console.error('Error loading owner data:', error)
            }

            if (data) {
                setOwnerData(data)
            }
        } catch (error) {
            console.error('Error loading owner data:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadBankAccounts = async () => {
        try {
            const { data, error } = await supabase
                .from('payment_settings')
                .select('id, bank_name, bank_code, account_number, account_type, is_verified, iban')
                .eq('user_id', user?.id)

            if (error && error.code !== 'PGRST116') {
                console.error('Error loading bank accounts:', error)
                return
            }

            if (data && data.length > 0) {
                setBankAccounts(data.filter(account => account.bank_name))
            }
        } catch (error) {
            console.error('Error loading bank accounts:', error)
        }
    }


    const handleAddAccount = () => {
        navigate('/settings/admin-payments')
    }

    const handleEditAccount = (accountId: string) => {
        navigate('/settings/admin-payments', { state: { editAccountId: accountId } })
    }



    const handleSave = () => {

    }

    return (
        <div className="min-h-screen bg-[#0f1117] flex">
            {/* Sidebar */}
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Top Header */}
                <Header onMenuClick={() => setSidebarOpen(true)} />

                {/* Navbar com Back Button */}
                <div className="sticky top-12 bg-gradient-to-r from-[#151825] via-[#1a2035] to-[#1a3050] border-b border-[#2a4060] z-[60] mt-12">
                    <div className="px-6">
                        <div className="flex items-center gap-4 py-2">
                            <button
                                onClick={() => navigate('/admin')}
                                className="flex items-center gap-2 text-gray-400 hover:text-gray-100 transition-colors text-xs font-medium"
                            >
                                <ArrowLeft size={16} />
                                <span>{t('settings.payment.back_to_settings')}</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto">
                    <div className="max-w-6xl mx-auto px-4 lg:px-6 py-6">
                        {/* Page Title */}
                        <div className="mb-6">
                            <h1 className="text-xl font-bold text-gray-100 mb-1">{t('settings.payment.title')}</h1>
                            <p className="text-xs text-gray-600">{t('settings.payment.configure_payment')}</p>
                        </div>

                        {/* Bank Accounts Section */}
                        <div className="bg-gradient-to-br from-[#151825] via-[#1a2035] via-50% to-[#1a3050] rounded-lg border border-[#2a4060] shadow-2xl shadow-black/20 p-6 mb-8">
                            {/* Header */}
                            <div className="flex items-start justify-between mb-6">
                                <div>
                                    <h2 className="text-xl font-semibold text-gray-100 mb-2">{t('settings.payment.manage_accounts')}</h2>
                                    <p className="text-gray-600 text-sm leading-relaxed max-w-md">
                                        {t('settings.payment.manage_accounts_desc')}
                                    </p>
                                </div>
                                <button
                                    onClick={handleAddAccount}
                                    className="flex items-center gap-2 px-4 py-2 bg-[#252941] hover:bg-gray-200 border border-[#252941] rounded-lg transition-colors text-sm font-medium"
                                >
                                    {t('settings.payment.add_account')}
                                </button>
                            </div>

                            {/* Company and Owner Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                <div>
                                    <h3 className="text-sm font-medium text-gray-300 mb-2">{t('settings.payment.owner_data')}</h3>
                                    {loading ? (
                                        <p className="text-gray-400">{t('common.loading')}</p>
                                    ) : ownerData?.full_name ? (
                                        <p className="text-gray-100 font-medium">{ownerData.full_name}</p>
                                    ) : (
                                        <p className="text-gray-400 italic">{t('settings.payment.not_configured')}</p>
                                    )}
                                </div>
                            </div>

                            {/* Bank Accounts List */}
                            {bankAccounts.length > 0 ? (
                                <div className="space-y-3">
                                    {bankAccounts.map((account, index) => (
                                        <div key={account.id || index} className="border border-[#1e2139] rounded-lg p-4 hover:border-[#252941] transition-colors">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-[#252941] rounded-lg flex items-center justify-center">
                                                        <Building className="w-5 h-5 text-gray-600" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-100">
                                                            {account.bank_name} - {account.bank_code || account.iban?.substring(0, 8)}
                                                        </p>
                                                        <p className="text-sm text-gray-600">
                                                            {account.account_number || account.iban}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {!account.is_verified && (
                                                        <div className="flex items-center gap-1 px-2 py-1 bg-yellow-50 rounded-md">
                                                            <AlertCircle className="w-4 h-4 text-yellow-600" />
                                                            <span className="text-xs text-yellow-700">{t('common.status')}</span>
                                                        </div>
                                                    )}
                                                    <button
                                                        onClick={() => handleEditAccount(account.id)}
                                                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-[#252941] rounded-lg transition-colors"
                                                        title={t('settings.payment.edit_account')}
                                                    >
                                                        <Edit3 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="border border-dashed border-[#252941] rounded-lg p-8 text-center">
                                    <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                    <p className="text-gray-500 text-sm mb-4">
                                        {t('settings.payment.no_accounts_click')}
                                    </p>
                                </div>
                            )}


                        </div>

                        {/* Save Button */}
                        <div className="flex justify-end">
                            <button
                                onClick={handleSave}
                                className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
                            >
                                {t('common.save')}
                            </button>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}

export default PaymentSettings
