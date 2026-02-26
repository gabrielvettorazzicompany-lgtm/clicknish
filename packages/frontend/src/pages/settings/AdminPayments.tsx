import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, AlertCircle, X, ChevronDown, CheckCircle, Clock, Upload, Trash2 } from 'lucide-react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/services/supabase'
import { useI18n } from '@/i18n'

interface BankAccount {
    id: string
    user_id: string
    bank_name: string
    bank_code: string
    account_number: string
    account_type: string
    account_holder_name: string
    iban: string
    bic_swift: string
    routing_number: string
    bank_country: string
    address_line1: string
    address_line2: string
    city: string
    state: string
    postal_code: string
    country: string
    currency: string
    phone_number: string
    date_of_birth: string
    tax_id_last4: string
    id_document_url: string
    address_proof_url: string
    bank_statement_url: string
    verification_status: 'pending' | 'under_review' | 'approved' | 'rejected'
    rejection_reason: string
    submitted_at: string
    approved_at: string
}

const COUNTRIES = [
    { code: 'US', name: 'United States' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'DE', name: 'Germany' },
    { code: 'FR', name: 'France' },
    { code: 'CH', name: 'Switzerland' },
    { code: 'CA', name: 'Canada' },
    { code: 'AU', name: 'Australia' },
    { code: 'BR', name: 'Brazil' },
    { code: 'PT', name: 'Portugal' },
    { code: 'ES', name: 'Spain' },
    { code: 'IT', name: 'Italy' },
    { code: 'NL', name: 'Netherlands' },
    { code: 'JP', name: 'Japan' },
    { code: 'SG', name: 'Singapore' },
    { code: 'AE', name: 'United Arab Emirates' },
]

const CURRENCIES = [
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'GBP', name: 'British Pound', symbol: '£' },
    { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
    { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
    { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
    { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
    { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
]

export default function AdminPayments() {
    const navigate = useNavigate()
    const { user } = useAuthStore()
    const { t } = useI18n()
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [showAddAccountModal, setShowAddAccountModal] = useState(false)
    const [showEditAccountModal, setShowEditAccountModal] = useState(false)
    const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null)
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
    const [uploadingDoc, setUploadingDoc] = useState<string | null>(null)

    const [formData, setFormData] = useState({
        // Account Holder Information
        accountHolderName: '',
        dateOfBirth: '',
        taxIdLast4: '',
        phoneNumber: '',

        // Address Information
        addressLine1: '',
        addressLine2: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'US',

        // Bank Information
        bankName: '',
        bankCountry: 'US',
        accountType: 'checking',
        accountNumber: '',
        routingNumber: '',
        iban: '',
        bicSwift: '',
        currency: 'USD',

        // Documents
        idDocumentUrl: '',
        idDocumentName: '',
        addressProofUrl: '',
        addressProofName: '',
        bankStatementUrl: '',
        bankStatementName: '',
    })

    useEffect(() => {
        if (user) {
            loadBankAccounts()
        }
    }, [user])

    const loadBankAccounts = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('payment_settings')
                .select('*')
                .eq('user_id', user?.id)

            if (error && error.code !== 'PGRST116') {
                console.error('Error loading bank accounts:', error)
                return
            }

            if (data && data.length > 0) {
                setBankAccounts(data.filter(account => account.bank_name || account.account_number))
            } else {
                setBankAccounts([])
            }
        } catch (error) {
            console.error('Error loading bank accounts:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleBack = () => {
        navigate('/admin')
    }

    const handleAddAccount = () => {
        setFormData({
            accountHolderName: '',
            dateOfBirth: '',
            taxIdLast4: '',
            phoneNumber: '',
            addressLine1: '',
            addressLine2: '',
            city: '',
            state: '',
            postalCode: '',
            country: 'US',
            bankName: '',
            bankCountry: 'US',
            accountType: 'checking',
            accountNumber: '',
            routingNumber: '',
            iban: '',
            bicSwift: '',
            currency: 'USD',
            idDocumentUrl: '',
            idDocumentName: '',
            addressProofUrl: '',
            addressProofName: '',
            bankStatementUrl: '',
            bankStatementName: '',
        })
        setShowAddAccountModal(true)
    }

    const handleCloseModal = () => {
        setShowAddAccountModal(false)
    }

    const handleEditAccount = (account: BankAccount) => {
        setEditingAccount(account)
        setFormData({
            accountHolderName: account.account_holder_name || '',
            dateOfBirth: account.date_of_birth || '',
            taxIdLast4: account.tax_id_last4 || '',
            phoneNumber: account.phone_number || '',
            addressLine1: account.address_line1 || '',
            addressLine2: account.address_line2 || '',
            city: account.city || '',
            state: account.state || '',
            postalCode: account.postal_code || '',
            country: account.country || 'US',
            bankName: account.bank_name || '',
            bankCountry: account.bank_country || 'US',
            accountType: account.account_type || 'checking',
            accountNumber: account.account_number || '',
            routingNumber: account.routing_number || '',
            iban: account.iban || '',
            bicSwift: account.bic_swift || '',
            currency: account.currency || 'USD',
            idDocumentUrl: account.id_document_url || '',
            idDocumentName: account.id_document_url ? 'ID Document' : '',
            addressProofUrl: account.address_proof_url || '',
            addressProofName: account.address_proof_url ? 'Address Proof' : '',
            bankStatementUrl: account.bank_statement_url || '',
            bankStatementName: account.bank_statement_url ? 'Bank Statement' : '',
        })
        setShowEditAccountModal(true)
    }

    const handleCloseEditModal = () => {
        setShowEditAccountModal(false)
        setEditingAccount(null)
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, documentType: 'id' | 'address' | 'bank') => {
        const file = e.target.files?.[0]
        if (!file) return

        // Validate file
        const maxSize = 5 * 1024 * 1024 // 5MB
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf']

        if (file.size > maxSize) {
            alert(t('settings.payment.file_size_error'))
            return
        }

        if (!allowedTypes.includes(file.type)) {
            alert(t('settings.payment.file_type_error'))
            return
        }

        setUploadingDoc(documentType)

        try {
            const fileExt = file.name.split('.').pop()
            const fileName = `${user?.id}/${documentType}_${Date.now()}.${fileExt}`

            const { data, error } = await supabase.storage
                .from('verification-documents')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: true
                })

            if (error) {
                console.error('Upload error:', error)
                // If bucket doesn't exist, use a placeholder URL
                const placeholderUrl = `https://storage.example.com/${fileName}`

                switch (documentType) {
                    case 'id':
                        setFormData(prev => ({ ...prev, idDocumentUrl: placeholderUrl, idDocumentName: file.name }))
                        break
                    case 'address':
                        setFormData(prev => ({ ...prev, addressProofUrl: placeholderUrl, addressProofName: file.name }))
                        break
                    case 'bank':
                        setFormData(prev => ({ ...prev, bankStatementUrl: placeholderUrl, bankStatementName: file.name }))
                        break
                }
                return
            }

            const { data: { publicUrl } } = supabase.storage
                .from('verification-documents')
                .getPublicUrl(data.path)

            switch (documentType) {
                case 'id':
                    setFormData(prev => ({ ...prev, idDocumentUrl: publicUrl, idDocumentName: file.name }))
                    break
                case 'address':
                    setFormData(prev => ({ ...prev, addressProofUrl: publicUrl, addressProofName: file.name }))
                    break
                case 'bank':
                    setFormData(prev => ({ ...prev, bankStatementUrl: publicUrl, bankStatementName: file.name }))
                    break
            }
        } catch (error) {
            console.error('Upload error:', error)
            alert(t('settings.payment.file_upload_error'))
        } finally {
            setUploadingDoc(null)
        }
    }

    const removeDocument = (documentType: 'id' | 'address' | 'bank') => {
        switch (documentType) {
            case 'id':
                setFormData(prev => ({ ...prev, idDocumentUrl: '', idDocumentName: '' }))
                break
            case 'address':
                setFormData(prev => ({ ...prev, addressProofUrl: '', addressProofName: '' }))
                break
            case 'bank':
                setFormData(prev => ({ ...prev, bankStatementUrl: '', bankStatementName: '' }))
                break
        }
    }

    const validateForm = () => {
        const required = [
            'accountHolderName',
            'dateOfBirth',
            'phoneNumber',
            'addressLine1',
            'city',
            'state',
            'postalCode',
            'country',
            'bankName',
            'bankCountry',
            'accountType',
            'currency',
        ]

        // For US accounts, require routing number and account number
        if (formData.bankCountry === 'US') {
            required.push('routingNumber', 'accountNumber')
        } else {
            // For international accounts, require IBAN and BIC/SWIFT
            required.push('iban', 'bicSwift')
        }

        for (const field of required) {
            if (!formData[field as keyof typeof formData]) {
                alert(`Please fill in all required fields. Missing: ${field}`)
                return false
            }
        }

        // Validate tax ID (last 4 digits)
        if (formData.taxIdLast4 && formData.taxIdLast4.length !== 4) {
            alert('Tax ID must be exactly 4 digits')
            return false
        }

        // Require at least ID document
        if (!formData.idDocumentUrl) {
            alert('Please upload a valid ID document (passport, driver license, or national ID)')
            return false
        }

        return true
    }

    const handleAddAccountSubmit = async () => {
        if (!validateForm()) return

        setSubmitting(true)
        try {
            // Check if record already exists
            const { data: existing } = await supabase
                .from('payment_settings')
                .select('id')
                .eq('user_id', user?.id)
                .single()

            const accountData = {
                user_id: user?.id,
                account_holder_name: formData.accountHolderName,
                date_of_birth: formData.dateOfBirth,
                tax_id_last4: formData.taxIdLast4,
                phone_number: formData.phoneNumber,
                address_line1: formData.addressLine1,
                address_line2: formData.addressLine2,
                city: formData.city,
                state: formData.state,
                postal_code: formData.postalCode,
                country: formData.country,
                bank_name: formData.bankName,
                bank_country: formData.bankCountry,
                account_type: formData.accountType,
                account_number: formData.accountNumber,
                routing_number: formData.routingNumber,
                iban: formData.iban,
                bic_swift: formData.bicSwift,
                currency: formData.currency,
                id_document_url: formData.idDocumentUrl,
                address_proof_url: formData.addressProofUrl,
                bank_statement_url: formData.bankStatementUrl,
                verification_status: 'pending',
                submitted_at: new Date().toISOString(),
            }

            if (existing) {
                const { error } = await supabase
                    .from('payment_settings')
                    .update(accountData)
                    .eq('user_id', user?.id)

                if (error) throw error
            } else {
                const { error } = await supabase
                    .from('payment_settings')
                    .insert(accountData)

                if (error) throw error
            }

            await loadBankAccounts()
            handleCloseModal()
            alert(t('settings.payment.submitted_success'))
        } catch (error) {
            console.error('Error adding account:', error)
            alert(t('settings.payment.error_adding'))
        } finally {
            setSubmitting(false)
        }
    }

    const handleEditAccountSubmit = async () => {
        if (!validateForm()) return

        setSubmitting(true)
        try {
            const accountData = {
                account_holder_name: formData.accountHolderName,
                date_of_birth: formData.dateOfBirth,
                tax_id_last4: formData.taxIdLast4,
                phone_number: formData.phoneNumber,
                address_line1: formData.addressLine1,
                address_line2: formData.addressLine2,
                city: formData.city,
                state: formData.state,
                postal_code: formData.postalCode,
                country: formData.country,
                bank_name: formData.bankName,
                bank_country: formData.bankCountry,
                account_type: formData.accountType,
                account_number: formData.accountNumber,
                routing_number: formData.routingNumber,
                iban: formData.iban,
                bic_swift: formData.bicSwift,
                currency: formData.currency,
                id_document_url: formData.idDocumentUrl,
                address_proof_url: formData.addressProofUrl,
                bank_statement_url: formData.bankStatementUrl,
                verification_status: 'pending', // Reset to pending when edited
                submitted_at: new Date().toISOString(),
                rejection_reason: null, // Clear any previous rejection
                updated_at: new Date().toISOString()
            }

            const { error } = await supabase
                .from('payment_settings')
                .update(accountData)
                .eq('user_id', user?.id)
                .eq('id', editingAccount?.id)

            if (error) throw error

            await loadBankAccounts()
            handleCloseEditModal()
            alert(t('settings.payment.updated_success'))
        } catch (error) {
            console.error('Error updating account:', error)
            alert(t('settings.payment.error_updating'))
        } finally {
            setSubmitting(false)
        }
    }

    const handleDeleteAccount = async (account: BankAccount) => {
        if (!confirm(`Are you sure you want to delete the bank account "${account.bank_name || 'Bank Account'}"? This action cannot be undone.`)) {
            return
        }

        try {
            const { error } = await supabase
                .from('payment_settings')
                .delete()
                .eq('id', account.id)
                .eq('user_id', user?.id)

            if (error) throw error

            await loadBankAccounts()
            alert(t('settings.payment.deleted_success'))
        } catch (error) {
            console.error('Error deleting account:', error)
            alert(t('settings.payment.error_deleting'))
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'approved':
                return (
                    <div className="flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-medium">
                        <CheckCircle className="w-3 h-3" />
                        Approved
                    </div>
                )
            case 'rejected':
                return (
                    <div className="flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 rounded-full text-xs font-medium">
                        <AlertCircle className="w-3 h-3" />
                        Rejected
                    </div>
                )
            case 'under_review':
                return (
                    <div className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-medium">
                        <Clock className="w-3 h-3" />
                        Under Review
                    </div>
                )
            default:
                return (
                    <div className="flex items-center gap-1 px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs font-medium">
                        <Clock className="w-3 h-3" />
                        Pending
                    </div>
                )
        }
    }

    const renderDocumentUpload = (
        type: 'id' | 'address' | 'bank',
        label: string,
        description: string,
        url: string,
        fileName: string,
        required: boolean = false
    ) => (
        <div className="border border-gray-200 dark:border-[#353a5a] rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
                <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {label} {required && <span className="text-red-400">*</span>}
                    </label>
                    <p className="text-xs text-gray-500 mt-0.5">{description}</p>
                </div>
            </div>

            {url ? (
                <div className="flex items-center justify-between bg-gray-100 dark:bg-[#252941] rounded-lg p-3 mt-2">
                    <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-400" />
                        <div>
                            <p className="text-sm text-gray-800 dark:text-gray-200 truncate max-w-[200px]">{fileName || t('settings.payment.uploaded')}</p>
                            <p className="text-xs text-green-400">{t('settings.payment.uploaded')}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => removeDocument(type)}
                        className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            ) : (
                <label className="flex flex-col items-center justify-center border border-dashed border-gray-300 dark:border-[#353a5a] rounded-lg p-4 mt-2 cursor-pointer hover:border-blue-500/50 hover:bg-blue-500/5 transition-colors">
                    <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.gif,.pdf"
                        onChange={(e) => handleFileUpload(e, type)}
                        className="hidden"
                        disabled={uploadingDoc === type}
                    />
                    {uploadingDoc === type ? (
                        <>
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mb-2"></div>
                            <span className="text-xs text-gray-400">{t('settings.payment.uploading')}</span>
                        </>
                    ) : (
                        <>
                            <Upload className="w-6 h-6 text-gray-400 mb-2" />
                            <span className="text-xs text-gray-400">{t('settings.payment.click_to_upload')}</span>
                            <span className="text-xs text-gray-500 mt-1">{t('settings.payment.photo_hint')}</span>
                        </>
                    )}
                </label>
            )}
        </div>
    )

    const renderBankAccountForm = () => (
        <div className="space-y-5">
            {/* Account Holder Information */}
            <div>
                <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-3 pb-1.5 border-b border-gray-200 dark:border-[#252941]">
                    {t('settings.payment.account_holder_info')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('settings.payment.full_legal_name')} <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.accountHolderName}
                            onChange={(e) => setFormData({ ...formData, accountHolderName: e.target.value })}
                            placeholder={t('settings.payment.name_as_appears')}
                            className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0f1117] border border-gray-300 dark:border-[#252941] rounded-lg focus:outline-none focus:border-blue-500/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 transition-colors"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('settings.payment.date_of_birth')} <span className="text-red-400">*</span>
                        </label>
                        <DatePicker
                            selected={formData.dateOfBirth ? new Date(formData.dateOfBirth) : null}
                            onChange={(date: Date | null) => setFormData({ ...formData, dateOfBirth: date ? date.toISOString().split('T')[0] : '' })}
                            dateFormat="MM/dd/yyyy"
                            placeholderText={t('settings.payment.select_date')}
                            showMonthDropdown
                            showYearDropdown
                            dropdownMode="select"
                            maxDate={new Date()}
                            className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0f1117] border border-gray-300 dark:border-[#252941] rounded-lg focus:outline-none focus:border-blue-500/50 text-gray-900 dark:text-gray-100 transition-colors"
                            calendarClassName="dark-datepicker"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('settings.payment.phone_number')} <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="tel"
                            value={formData.phoneNumber}
                            onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                            placeholder={t('settings.payment.phone_placeholder')}
                            className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0f1117] border border-gray-300 dark:border-[#252941] rounded-lg focus:outline-none focus:border-blue-500/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 transition-colors"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('settings.payment.ssn_tax_id')}
                        </label>
                        <input
                            type="text"
                            value={formData.taxIdLast4}
                            onChange={(e) => setFormData({ ...formData, taxIdLast4: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                            placeholder="0000"
                            maxLength={4}
                            className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0f1117] border border-gray-300 dark:border-[#252941] rounded-lg focus:outline-none focus:border-blue-500/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 transition-colors"
                        />
                        <p className="text-[10px] text-gray-500 mt-1">{t('settings.payment.ssn_required')}</p>
                    </div>
                </div>
            </div>

            {/* Address Information */}
            <div>
                <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-3 pb-1.5 border-b border-gray-200 dark:border-[#252941]">
                    {t('settings.payment.residential_address')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('settings.payment.address_line_1')} <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.addressLine1}
                            onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                            placeholder={t('settings.payment.street_address')}
                            className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0f1117] border border-gray-300 dark:border-[#252941] rounded-lg focus:outline-none focus:border-blue-500/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 transition-colors"
                            required
                        />
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('settings.payment.address_line_2')}
                        </label>
                        <input
                            type="text"
                            value={formData.addressLine2}
                            onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
                            placeholder={t('settings.payment.address_optional')}
                            className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0f1117] border border-gray-300 dark:border-[#252941] rounded-lg focus:outline-none focus:border-blue-500/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 transition-colors"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('settings.payment.city')} <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.city}
                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                            placeholder={t('settings.payment.city')}
                            className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0f1117] border border-gray-300 dark:border-[#252941] rounded-lg focus:outline-none focus:border-blue-500/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 transition-colors"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('settings.payment.state')} <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.state}
                            onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                            placeholder={t('settings.payment.state_placeholder')}
                            className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0f1117] border border-gray-300 dark:border-[#252941] rounded-lg focus:outline-none focus:border-blue-500/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 transition-colors"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('settings.payment.postal_code')} <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.postalCode}
                            onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                            placeholder={t('settings.payment.zip_code')}
                            className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0f1117] border border-gray-300 dark:border-[#252941] rounded-lg focus:outline-none focus:border-blue-500/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 transition-colors"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('settings.payment.country')} <span className="text-red-400">*</span>
                        </label>
                        <div className="relative">
                            <select
                                value={formData.country}
                                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                                className="w-full px-3 py-2 text-sm bg-[#0f1117] border border-[#252941] rounded-lg focus:outline-none focus:border-blue-500/50 appearance-none text-gray-100 transition-colors"
                                required
                            >
                                {COUNTRIES.map(c => (
                                    <option key={c.code} value={c.code}>{c.name}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-gray-500 pointer-events-none" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Bank Account Information */}
            <div>
                <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-3 pb-1.5 border-b border-gray-200 dark:border-[#252941]">
                    {t('settings.payment.bank_details')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Bank Name <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.bankName}
                            onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                            placeholder="e.g., Chase Bank, Bank of America"
                            className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0f1117] border border-gray-300 dark:border-[#252941] rounded-lg focus:outline-none focus:border-blue-500/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 transition-colors"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Bank Country <span className="text-red-400">*</span>
                        </label>
                        <div className="relative">
                            <select
                                value={formData.bankCountry}
                                onChange={(e) => setFormData({ ...formData, bankCountry: e.target.value })}
                                className="w-full px-3 py-2 text-sm bg-[#0f1117] border border-[#252941] rounded-lg focus:outline-none focus:border-blue-500/50 appearance-none text-gray-100 transition-colors"
                                required
                            >
                                {COUNTRIES.map(c => (
                                    <option key={c.code} value={c.code}>{c.name}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-gray-500 pointer-events-none" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Account Type <span className="text-red-400">*</span>
                        </label>
                        <div className="relative">
                            <select
                                value={formData.accountType}
                                onChange={(e) => setFormData({ ...formData, accountType: e.target.value })}
                                className="w-full px-3 py-2 text-sm bg-[#0f1117] border border-[#252941] rounded-lg focus:outline-none focus:border-blue-500/50 appearance-none text-gray-100 transition-colors"
                                required
                            >
                                <option value="checking">Checking</option>
                                <option value="savings">Savings</option>
                            </select>
                            <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-gray-500 pointer-events-none" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Currency <span className="text-red-400">*</span>
                        </label>
                        <div className="relative">
                            <select
                                value={formData.currency}
                                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                                className="w-full px-3 py-2 text-sm bg-[#0f1117] border border-[#252941] rounded-lg focus:outline-none focus:border-blue-500/50 appearance-none text-gray-100 transition-colors"
                                required
                            >
                                {CURRENCIES.map(c => (
                                    <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-gray-500 pointer-events-none" />
                        </div>
                    </div>

                    {/* US Bank Fields */}
                    {formData.bankCountry === 'US' && (
                        <>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Routing Number <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.routingNumber}
                                    onChange={(e) => setFormData({ ...formData, routingNumber: e.target.value.replace(/\D/g, '').slice(0, 9) })}
                                    placeholder="9 digits"
                                    maxLength={9}
                                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0f1117] border border-gray-300 dark:border-[#252941] rounded-lg focus:outline-none focus:border-blue-500/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 transition-colors"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Account Number <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.accountNumber}
                                    onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                                    placeholder="Account number"
                                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0f1117] border border-gray-300 dark:border-[#252941] rounded-lg focus:outline-none focus:border-blue-500/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 transition-colors"
                                    required
                                />
                            </div>
                        </>
                    )}

                    {/* International Bank Fields */}
                    {formData.bankCountry !== 'US' && (
                        <>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    IBAN <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.iban}
                                    onChange={(e) => setFormData({ ...formData, iban: e.target.value.toUpperCase() })}
                                    placeholder="e.g., DE89370400440532013000"
                                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0f1117] border border-gray-300 dark:border-[#252941] rounded-lg focus:outline-none focus:border-blue-500/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 transition-colors"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    BIC / SWIFT Code <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.bicSwift}
                                    onChange={(e) => setFormData({ ...formData, bicSwift: e.target.value.toUpperCase() })}
                                    placeholder="e.g., COBADEFFXXX"
                                    maxLength={11}
                                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0f1117] border border-gray-300 dark:border-[#252941] rounded-lg focus:outline-none focus:border-blue-500/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 transition-colors"
                                    required
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Document Upload Section */}
            <div>
                <h3 className="text-xs font-semibold text-gray-100 mb-1.5 pb-1.5 border-b border-[#252941]">
                    {t('settings.payment.verification_docs')}
                </h3>
                <p className="text-[10px] text-gray-500 mb-3">
                    {t('settings.payment.upload_docs_desc')}
                </p>

                <div className="space-y-4">
                    {renderDocumentUpload(
                        'id',
                        t('settings.payment.government_id'),
                        t('settings.payment.government_id_desc'),
                        formData.idDocumentUrl,
                        formData.idDocumentName,
                        true
                    )}
                    {renderDocumentUpload(
                        'bank',
                        t('settings.payment.bank_statement'),
                        t('settings.payment.bank_statement_desc'),
                        formData.bankStatementUrl,
                        formData.bankStatementName,
                        true
                    )}
                </div>
            </div>

            {/* Verification Notice */}
            <div className="bg-[#0f1117] border border-[#252941] rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('settings.payment.verification_required')}</p>
                <p className="text-xs text-gray-500 mt-1">
                    {t('settings.payment.verification_notice')}
                </p>
            </div>
        </div>
    )

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#080b14] flex relative">
            <div className="pointer-events-none fixed inset-0 overflow-hidden dark:block hidden">
                <div className="absolute top-[-80px] left-[15%] w-[500px] h-[500px] rounded-full bg-blue-600/20 blur-[120px]" />
                <div className="absolute top-[30%] right-[-60px] w-[400px] h-[400px] rounded-full bg-indigo-500/15 blur-[100px]" />
                <div className="absolute bottom-[10%] left-[5%] w-[350px] h-[350px] rounded-full bg-violet-600/10 blur-[100px]" />
            </div>
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex-1 flex flex-col min-w-0">
                <Header onMenuClick={() => setSidebarOpen(true)} />

                {/* Navbar com Back Button */}
                <div className="bg-white dark:bg-[#080b14]/80 dark:backdrop-blur-sm border-b border-gray-200 dark:border-white/10 mt-12 relative z-10">
                    <div className="px-6">
                        <div className="flex items-center gap-4 py-2">
                            <button
                                onClick={handleBack}
                                className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors text-xs font-medium"
                            >
                                <ArrowLeft size={16} />
                                <span>{t('settings.payment.back_to_settings')}</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <main className="flex-1 overflow-y-auto relative z-10">
                    <div className="max-w-4xl mx-auto px-3 lg:px-4 py-4">
                        {/* Page Title */}
                        <div className="mb-4">
                            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">{t('settings.payment.title')}</h1>
                            <p className="text-xs text-gray-600">{t('settings.payment.configure_payment')}</p>
                        </div>

                        {/* Manage Bank Accounts Card */}
                        <div className="bg-white dark:bg-gradient-to-br dark:from-[#151825] dark:via-[#1a2035] dark:via-50% dark:to-[#1a3050] rounded-lg border border-gray-200 dark:border-[#2a4060] shadow-lg dark:shadow-2xl dark:shadow-black/20">
                            <div className="p-4">
                                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">{t('settings.payment.manage_accounts')}</h2>
                                <p className="text-sm text-gray-600 mb-4">
                                    {t('settings.payment.manage_accounts_desc')}
                                </p>

                                {/* Bank Accounts List */}
                                {loading ? (
                                    <div className="text-center py-8">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                                        <p className="text-gray-500 text-sm mt-2">{t('settings.payment.loading_accounts')}</p>
                                    </div>
                                ) : bankAccounts.length > 0 ? (
                                    <div className="space-y-2 mb-3">
                                        {bankAccounts.map((account, index) => (
                                            <div key={index} className="border border-gray-200 dark:border-[#1e2139] rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-[#252941]/30 transition-colors">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 bg-gray-100 dark:bg-[#252941] rounded-lg flex items-center justify-center">
                                                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                                                            </svg>
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                                {account.bank_name || 'Bank Account'}
                                                            </p>
                                                            <p className="text-xs text-gray-500">
                                                                {account.account_holder_name && `${account.account_holder_name} • `}
                                                                ****{account.account_number?.slice(-4) || account.iban?.slice(-4) || 'XXXX'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        {getStatusBadge(account.verification_status)}
                                                        <button
                                                            onClick={() => handleEditAccount(account)}
                                                            className="text-gray-400 hover:text-gray-100 p-1"
                                                            title="Edit account"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteAccount(account)}
                                                            className="text-gray-400 hover:text-red-400 p-1"
                                                            title="Delete account"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                                {account.verification_status === 'rejected' && account.rejection_reason && (
                                                    <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
                                                        <strong>{t('settings.payment.rejection_reason')}</strong> {account.rejection_reason}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="border border-dashed border-gray-300 dark:border-[#252941] rounded-lg p-6 mb-3 text-center">
                                        <svg className="w-10 h-10 text-gray-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                                        </svg>
                                        <p className="text-gray-400 text-sm mb-1">{t('settings.payment.no_accounts')}</p>
                                        <p className="text-gray-500 text-xs">
                                            {t('settings.payment.no_accounts_hint')}
                                        </p>
                                    </div>
                                )}

                                {/* Add Account Button */}
                                <button
                                    onClick={handleAddAccount}
                                    className="bg-gray-100 dark:bg-[#252941] hover:bg-gray-200 dark:hover:bg-[#353a5a] text-gray-700 dark:text-gray-300 px-4 py-2 text-sm rounded-lg font-medium transition-colors flex items-center gap-2"
                                >
                                    <Plus size={16} />
                                    {t('settings.payment.add_bank_account')}
                                </button>
                            </div>
                        </div>
                    </div>
                </main>
            </div>

            {/* Add Account Modal */}
            {showAddAccountModal && (
                <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gradient-to-br dark:from-[#151825] dark:via-[#1a2035] dark:via-50% dark:to-[#1a3050] border border-gray-200 dark:border-[#2a4060] rounded-lg shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
                        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-[#2a4060]">
                            <div>
                                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('settings.payment.add_bank_account')}</h2>
                                <p className="text-xs text-gray-500 mt-0.5">{t('settings.payment.enter_banking_details')}</p>
                            </div>
                            <button
                                onClick={handleCloseModal}
                                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-100 p-1 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-4">
                            {renderBankAccountForm()}
                        </div>

                        <div className="border-t border-gray-200 dark:border-[#2a4060] p-4 flex gap-3 justify-end">
                            <button
                                onClick={handleCloseModal}
                                className="px-4 py-2.5 text-gray-500 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 transition-colors"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={handleAddAccountSubmit}
                                disabled={submitting}
                                className="px-5 py-2.5 text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center gap-2"
                            >
                                {submitting ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                                        {t('settings.payment.submitting')}
                                    </>
                                ) : (
                                    t('settings.payment.submit_verification')
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Account Modal */}
            {showEditAccountModal && (
                <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gradient-to-br dark:from-[#151825] dark:via-[#1a2035] dark:via-50% dark:to-[#1a3050] border border-gray-200 dark:border-[#2a4060] rounded-lg shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
                        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-[#2a4060]">
                            <div>
                                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('settings.payment.edit_bank_account')}</h2>
                                <p className="text-xs text-gray-500 mt-0.5">{t('settings.payment.update_banking_details')}</p>
                            </div>
                            <button
                                onClick={handleCloseEditModal}
                                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-100 p-1 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-4">
                            {renderBankAccountForm()}
                        </div>

                        <div className="border-t border-gray-200 dark:border-[#2a4060] p-4 flex gap-3 justify-end">
                            <button
                                onClick={handleCloseEditModal}
                                className="px-4 py-2.5 text-gray-500 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 transition-colors"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={handleEditAccountSubmit}
                                disabled={submitting}
                                className="px-5 py-2.5 text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center gap-2"
                            >
                                {submitting ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                                        {t('settings.updating')}
                                    </>
                                ) : (
                                    t('settings.payment.update_resubmit')
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
