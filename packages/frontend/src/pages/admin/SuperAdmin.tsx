import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/i18n'

interface PlatformStats {
    overview: {
        totalUsers: number
        totalApplications: number
        totalDomains: number
        totalProducts: number
        totalClients: number
    }
    charts: {
        monthlyApps: Record<string, number>
        domainsByStatus: Array<{ status: string, count: number }>
        topUsers: Array<{ owner_id: string, count: number }>
    }
    recent: {
        applications: Array<any>
        domains: Array<any>
    }
}

interface User {
    id: string
    name: string
    email: string
    created_at: string
    app_count: number
    last_activity: string
    plan?: string
}

interface Application {
    id: string
    name: string
    slug: string
    created_at: string
    owner_email: string
    app_type: string
    language: string
}

interface BankVerification {
    id: string
    user_id: string
    user_email: string
    account_holder_name: string
    date_of_birth: string
    phone_number: string
    bank_name: string
    bank_country: string
    account_type: string
    account_number: string
    iban: string
    bic_swift: string
    currency: string
    city: string
    state: string
    country: string
    id_document_url: string
    address_proof_url: string
    bank_statement_url: string
    verification_status: string
    submitted_at: string
}

interface PendingProduct {
    id: string
    name: string
    slug?: string
    description?: string
    price?: number
    currency?: string
    category?: string
    delivery_type?: string
    status?: string
    review_status: string
    created_at: string
    owner_id?: string
    owner_email?: string
    image_url?: string
}

interface PendingApp {
    id: string
    name: string
    slug: string
    logo_url?: string
    app_type?: string
    language?: string
    review_status: string
    created_at: string
    owner_id?: string
    owner_email?: string
}

interface PaymentProvider {
    id: string
    name: string
    type: 'stripe' | 'stripe_connect' | 'mollie' | 'paypal' | 'custom'
    is_active: boolean
    is_global_default: boolean
    created_at: string
    updated_at: string
}

export default function SuperAdmin() {
    const { t } = useI18n()
    const { user } = useAuthStore()
    const [activeTab, setActiveTab] = useState('dashboard')
    const [reviewSubTab, setReviewSubTab] = useState<'apps' | 'products'>('apps')
    const [stats, setStats] = useState<PlatformStats | null>(null)
    const [users, setUsers] = useState<User[]>([])
    const [applications, setApplications] = useState<Application[]>([])
    const [plans, setPlans] = useState<User[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [selectedUser, setSelectedUser] = useState<User | null>(null)
    const [userDetails, setUserDetails] = useState<any>(null)
    const [loadingDetails, setLoadingDetails] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [planFilter, setPlanFilter] = useState('all')
    const [bankVerifications, setBankVerifications] = useState<BankVerification[]>([])
    const [loadingVerifications, setLoadingVerifications] = useState(false)
    const [processingId, setProcessingId] = useState<string | null>(null)
    const [showRejectModal, setShowRejectModal] = useState(false)
    const [selectedVerification, setSelectedVerification] = useState<BankVerification | null>(null)
    const [rejectionReason, setRejectionReason] = useState('')
    const [showDetailsModal, setShowDetailsModal] = useState(false)

    // Product Reviews states
    const [pendingProducts, setPendingProducts] = useState<PendingProduct[]>([])
    const [loadingProducts, setLoadingProducts] = useState(false)
    const [selectedProduct, setSelectedProduct] = useState<PendingProduct | null>(null)
    const [showProductRejectModal, setShowProductRejectModal] = useState(false)
    const [productRejectionReason, setProductRejectionReason] = useState('')
    const [showProductDetailsModal, setShowProductDetailsModal] = useState(false)
    const [productDetails, setProductDetails] = useState<any>(null)
    const [loadingProductDetails, setLoadingProductDetails] = useState(false)

    // App Reviews states
    const [pendingApps, setPendingApps] = useState<PendingApp[]>([])
    const [loadingApps, setLoadingApps] = useState(false)
    const [selectedApp, setSelectedApp] = useState<PendingApp | null>(null)
    const [showAppRejectModal, setShowAppRejectModal] = useState(false)
    const [appRejectionReason, setAppRejectionReason] = useState('')

    // ─── Financial ─────────────────────────────────────────────────────────────────
    const [financialData, setFinancialData] = useState<any>(null)
    const [loadingFinancial, setLoadingFinancial] = useState(false)

    // ─── Payment config ────────────────────────────────────────────────────────
    const [paymentConfigs, setPaymentConfigs] = useState<any[]>([])
    const [loadingPaymentConfigs, setLoadingPaymentConfigs] = useState(false)
    const [globalProvider, setGlobalProvider] = useState<string>('stripe')
    const [editingPaymentUser, setEditingPaymentUser] = useState<string | null>(null)
    const [paymentConfigForm, setPaymentConfigForm] = useState({ payment_provider: 'stripe', mollie_api_key: '', stripe_connect_account: '', override_platform_default: true, notes: '' })
    const [savingPaymentConfig, setSavingPaymentConfig] = useState(false)

    // ─── Payment Providers (dinâmico) ──────────────────────────────────────────
    const [providers, setProviders] = useState<PaymentProvider[]>([])
    const [loadingProviders, setLoadingProviders] = useState(false)
    const [showAddProviderForm, setShowAddProviderForm] = useState(false)
    const [newProviderForm, setNewProviderForm] = useState({ name: '', type: 'stripe', credentials: {} as Record<string, string> })
    const [savingProvider, setSavingProvider] = useState(false)
    const [editingProviderId, setEditingProviderId] = useState<string | null>(null)
    const [editingProviderCreds, setEditingProviderCreds] = useState<Record<string, string>>({})
    const [editingProviderName, setEditingProviderName] = useState('')
    const [providerUserSearch, setProviderUserSearch] = useState('')
    const [providerUserResult, setProviderUserResult] = useState<{ user: { id: string; email: string }; config: any } | null>(null)
    const [providerSearchResults, setProviderSearchResults] = useState<Array<{ id: string; email: string; config: any }> | null>(null)
    const [searchingProviderUser, setSearchingProviderUser] = useState(false)
    const [assigningProvider, setAssigningProvider] = useState(false)
    const [selectedProviderForUser, setSelectedProviderForUser] = useState('')
    const [userModalProviderId, setUserModalProviderId] = useState<string>('')
    const [savingUserModalProvider, setSavingUserModalProvider] = useState(false)

    // ─── Platform config ────────────────────────────────────────────────────────
    const [platformConfig, setPlatformConfig] = useState<Record<string, any>>({})
    const [loadingPlatformConfig, setLoadingPlatformConfig] = useState(false)
    const [savingPlatformConfig, setSavingPlatformConfig] = useState<string | null>(null)
    const [platformConfigEdits, setPlatformConfigEdits] = useState<Record<string, any>>({})

    // ─── Announcements ────────────────────────────────────────────────────────
    const [announcements, setAnnouncements] = useState<any[]>([])
    const [loadingAnnouncements, setLoadingAnnouncements] = useState(false)
    const [savingAnnouncement, setSavingAnnouncement] = useState(false)
    const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '', type: 'info', target_plan: 'all', expires_at: '' })
    const [deletingAnnouncementId, setDeletingAnnouncementId] = useState<string | null>(null)

    // ─── API Keys visibility ────────────────────────────────────────────────────
    const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({})

    // ─── Audit log ──────────────────────────────────────────────────────────────────
    const [auditLog, setAuditLog] = useState<any[]>([])
    const [loadingAuditLog, setLoadingAuditLog] = useState(false)
    const [auditTotal, setAuditTotal] = useState(0)
    const [auditPage, setAuditPage] = useState(1)
    const [auditActionFilter, setAuditActionFilter] = useState('')

    useEffect(() => {
        if (user) {
            fetchStats()
            fetchBankVerifications()
            fetchPendingProducts()
            fetchPendingApps()
        }
    }, [user])

    // Quando o modal de usuário abre: carrega config de provedor atual + garante que providers estão carregados
    useEffect(() => {
        if (!selectedUser) {
            setUserModalProviderId('')
            return
        }
        // Garante que a lista de providers está disponível
        if (providers.length === 0) fetchPaymentConfigs()
            // Busca o provedor atual atribuído a este usuário
            ; (async () => {
                try {
                    const res = await fetch('https://api.clicknich.com/api/superadmin/payment-config/search', {
                        method: 'POST',
                        headers: ADMIN_HEADERS,
                        body: JSON.stringify({ email: selectedUser.email })
                    })
                    if (res.ok) {
                        const d = await res.json()
                        setUserModalProviderId(d.config?.provider_id || '')
                    }
                } catch (e) { console.error(e) }
            })()
    }, [selectedUser])

    useEffect(() => {
        if (activeTab === 'dashboard' && !financialData) {
            fetchFinancial()
            fetchPaymentConfigs()
            fetchAuditLog(1)
        } else if (activeTab === 'users' && users.length === 0) {
            fetchUsers()
        } else if (activeTab === 'applications' && applications.length === 0) {
            fetchApplications()
        } else if (activeTab === 'plans' && plans.length === 0) {
            fetchPlans()
        } else if (activeTab === 'verifications') {
            fetchBankVerifications()
        } else if (activeTab === 'reviews') {
            fetchPendingProducts()
            fetchPendingApps()
        } else if (activeTab === 'financial' && !financialData) {
            fetchFinancial()
        } else if (activeTab === 'payments' && paymentConfigs.length === 0) {
            fetchPaymentConfigs()
        } else if (activeTab === 'config' && Object.keys(platformConfig).length === 0) {
            fetchPlatformConfig()
            fetchPaymentConfigs()
        } else if (activeTab === 'announcements') {
            fetchAnnouncements()
        } else if (activeTab === 'audit') {
            fetchAuditLog(1)
        }
    }, [activeTab])

    const fetchStats = async () => {
        try {
            setLoading(true)
            const response = await fetch('https://api.clicknich.com/api/superadmin/stats', {
                headers: {
                    'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`,
                    'Content-Type': 'application/json',
                    'x-user-id': user?.id || ''
                }
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Error fetching stats')
            }

            const data = await response.json()
            setStats(data)
        } catch (error) {
            console.error('Error fetching stats:', error)
            setError(error instanceof Error ? error.message : 'Unknown error')
        } finally {
            setLoading(false)
        }
    }

    const fetchUsers = async () => {
        try {
            const params = new URLSearchParams()
            if (searchQuery) params.append('search', searchQuery)
            if (planFilter !== 'all') params.append('plan', planFilter)

            const url = `https://api.clicknich.com/api/superadmin/users${params.toString() ? '?' + params.toString() : ''}`
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`,
                    'Content-Type': 'application/json',
                    'x-user-id': user?.id || ''
                }
            })

            if (response.ok) {
                const data = await response.json()

                setUsers(data.users)
            } else {
                const errorData = await response.json()
                console.error('❌ Error loading users:', errorData)
            }
        } catch (error) {
            console.error('❌ Error loading users:', error)
        }
    }

    const fetchApplications = async () => {
        try {

            const response = await fetch('https://api.clicknich.com/api/superadmin/applications', {
                headers: {
                    'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`,
                    'Content-Type': 'application/json',
                    'x-user-id': user?.id || ''
                }
            })

            if (response.ok) {
                const data = await response.json()

                setApplications(data.applications)
            }
        } catch (error) {
            console.error('Error loading applications:', error)
        }
    }

    const fetchPlans = async () => {
        try {

            const response = await fetch('https://api.clicknich.com/api/superadmin/users', {
                headers: {
                    'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`,
                    'Content-Type': 'application/json',
                    'x-user-id': user?.id || ''
                }
            })

            if (response.ok) {
                const data = await response.json()
                setPlans(data.users)
            }
        } catch (error) {
            console.error('❌ Error loading plans:', error)
        }
    }

    const fetchBankVerifications = async () => {
        setLoadingVerifications(true)
        try {
            const response = await fetch('https://api.clicknich.com/api/superadmin/bank-verifications', {
                headers: {
                    'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`,
                    'Content-Type': 'application/json',
                    'x-user-id': user?.id || ''
                }
            })

            if (response.ok) {
                const data = await response.json()
                setBankVerifications(data.verifications || [])
            } else {
                console.error('Error fetching bank verifications:', response.status)
            }
        } catch (error) {
            console.error('Error fetching bank verifications:', error)
        } finally {
            setLoadingVerifications(false)
        }
    }

    const fetchPendingProducts = async () => {
        setLoadingProducts(true)
        try {
            const response = await fetch('https://api.clicknich.com/api/superadmin/pending-products', {
                headers: {
                    'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`,
                    'Content-Type': 'application/json',
                    'x-user-id': user?.id || ''
                }
            })

            if (response.ok) {
                const data = await response.json()
                setPendingProducts(data.products || [])
            } else {
                console.error('Error fetching pending products:', response.status)
            }
        } catch (error) {
            console.error('Error fetching pending products:', error)
        } finally {
            setLoadingProducts(false)
        }
    }

    const fetchProductDetails = async (productId: string) => {
        setLoadingProductDetails(true)
        setProductDetails(null)
        try {
            const response = await fetch(`https://api.clicknich.com/api/superadmin/product-details/${productId}`, {
                headers: {
                    'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`,
                    'Content-Type': 'application/json',
                    'x-user-id': user?.id || ''
                }
            })

            if (response.ok) {
                const data = await response.json()
                setProductDetails(data)
            } else {
                console.error('Error fetching product details:', response.status)
            }
        } catch (error) {
            console.error('Error fetching product details:', error)
        } finally {
            setLoadingProductDetails(false)
        }
    }

    const openProductDetailsModal = (product: PendingProduct) => {
        setSelectedProduct(product)
        setShowProductDetailsModal(true)
        fetchProductDetails(product.id)
    }

    const handleApproveProduct = async (productId: string) => {
        setProcessingId(productId)
        try {
            const response = await fetch(`https://api.clicknich.com/api/superadmin/products/${productId}/approve`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`,
                    'Content-Type': 'application/json',
                    'x-user-id': user?.id || ''
                }
            })

            if (response.ok) {
                alert('Product approved successfully!')
                fetchPendingProducts()
            } else {
                let msg = `HTTP ${response.status}`
                try { const e = await response.json(); msg = e.error || msg } catch { }
                alert(`Error: ${msg}`)
            }
        } catch (error) {
            console.error('Error approving product:', error)
            alert('Error approving product')
        } finally {
            setProcessingId(null)
        }
    }

    const handleRejectProduct = async () => {
        if (!selectedProduct) return

        setProcessingId(selectedProduct.id)
        try {
            const response = await fetch(`https://api.clicknich.com/api/superadmin/products/${selectedProduct.id}/reject`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`,
                    'Content-Type': 'application/json',
                    'x-user-id': user?.id || ''
                },
                body: JSON.stringify({ reason: productRejectionReason || 'Your product was not approved. Please review the guidelines and resubmit.' })
            })

            if (response.ok) {
                alert('Product rejected')
                setShowProductRejectModal(false)
                setSelectedProduct(null)
                setProductRejectionReason('')
                fetchPendingProducts()
            } else {
                let msg = `HTTP ${response.status}`
                try { const e = await response.json(); msg = e.error || msg } catch { }
                alert(`Error: ${msg}`)
            }
        } catch (error) {
            console.error('Error rejecting product:', error)
            alert('Error rejecting product')
        } finally {
            setProcessingId(null)
        }
    }

    const openProductRejectModal = (product: PendingProduct) => {
        setSelectedProduct(product)
        setShowProductRejectModal(true)
    }

    // App Review functions
    const fetchPendingApps = async () => {
        setLoadingApps(true)
        try {
            const response = await fetch('https://api.clicknich.com/api/superadmin/pending-apps', {
                headers: {
                    'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`,
                    'Content-Type': 'application/json',
                    'x-user-id': user?.id || ''
                }
            })

            if (response.ok) {
                const data = await response.json()
                setPendingApps(data.apps || [])
            } else {
                console.error('Error fetching pending apps:', response.status)
            }
        } catch (error) {
            console.error('Error fetching pending apps:', error)
        } finally {
            setLoadingApps(false)
        }
    }

    const handleApproveApp = async (appId: string) => {
        setProcessingId(appId)
        try {
            const response = await fetch(`https://api.clicknich.com/api/superadmin/apps/${appId}/approve`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`,
                    'Content-Type': 'application/json',
                    'x-user-id': user?.id || ''
                }
            })

            if (response.ok) {
                alert('App approved successfully!')
                fetchPendingApps()
            } else {
                let msg = `HTTP ${response.status}`
                try { const e = await response.json(); msg = e.error || msg } catch { }
                alert(`Error: ${msg}`)
            }
        } catch (error) {
            console.error('Error approving app:', error)
            alert('Error approving app')
        } finally {
            setProcessingId(null)
        }
    }

    const handleRejectApp = async () => {
        if (!selectedApp) return

        setProcessingId(selectedApp.id)
        try {
            const response = await fetch(`https://api.clicknich.com/api/superadmin/apps/${selectedApp.id}/reject`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`,
                    'Content-Type': 'application/json',
                    'x-user-id': user?.id || ''
                },
                body: JSON.stringify({ reason: appRejectionReason || 'Your app was not approved. Please review the guidelines and resubmit.' })
            })

            if (response.ok) {
                alert('App rejected')
                setShowAppRejectModal(false)
                setSelectedApp(null)
                setAppRejectionReason('')
                fetchPendingApps()
            } else {
                let msg = `HTTP ${response.status}`
                try { const e = await response.json(); msg = e.error || msg } catch { }
                alert(`Error: ${msg}`)
            }
        } catch (error) {
            console.error('Error rejecting app:', error)
            alert('Error rejecting app')
        } finally {
            setProcessingId(null)
        }
    }

    const openAppRejectModal = (app: PendingApp) => {
        setSelectedApp(app)
        setShowAppRejectModal(true)
    }

    const handleApproveVerification = async (verificationId: string) => {
        setProcessingId(verificationId)
        try {
            const response = await fetch(`https://api.clicknich.com/api/superadmin/bank-verifications/${verificationId}/approve`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`,
                    'Content-Type': 'application/json',
                    'x-user-id': user?.id || ''
                }
            })

            if (response.ok) {
                alert('Bank account approved successfully!')
                fetchBankVerifications()
            } else {
                const error = await response.json()
                alert(`Error: ${error.error}`)
            }
        } catch (error) {
            console.error('Error approving verification:', error)
            alert('Error approving verification')
        } finally {
            setProcessingId(null)
        }
    }

    const handleRejectVerification = async () => {
        if (!selectedVerification) return

        setProcessingId(selectedVerification.id)
        try {
            const response = await fetch(`https://api.clicknich.com/api/superadmin/bank-verifications/${selectedVerification.id}/reject`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`,
                    'Content-Type': 'application/json',
                    'x-user-id': user?.id || ''
                },
                body: JSON.stringify({ reason: rejectionReason || 'Your bank account verification was rejected. Please review the information and resubmit.' })
            })

            if (response.ok) {
                alert('Bank account rejected')
                setShowRejectModal(false)
                setSelectedVerification(null)
                setRejectionReason('')
                fetchBankVerifications()
            } else {
                const error = await response.json()
                alert(`Error: ${error.error}`)
            }
        } catch (error) {
            console.error('Error rejecting verification:', error)
            alert('Error rejecting verification')
        } finally {
            setProcessingId(null)
        }
    }

    const openRejectModal = (verification: BankVerification) => {
        setSelectedVerification(verification)
        setShowRejectModal(true)
    }

    const openDetailsModal = (verification: BankVerification) => {
        setSelectedVerification(verification)
        setShowDetailsModal(true)
    }

    const fetchUserDetails = async (userId: string) => {
        setLoadingDetails(true)
        try {
            const response = await fetch(`https://api.clicknich.com/api/superadmin/user-details/${userId}`, {
                headers: {
                    'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`,
                    'Content-Type': 'application/json',
                    'x-user-id': user?.id || ''
                }
            })

            if (response.ok) {
                const data = await response.json()
                setUserDetails(data)
            } else {
                console.error('Error loading user details')
            }
        } catch (error) {
            console.error('Error loading user details:', error)
        } finally {
            setLoadingDetails(false)
        }
    }

    const handleDeleteUser = async (userId: string) => {
        if (!confirm('Are you sure you want to DELETE this user? This action is IRREVERSIBLE!')) {
            return
        }

        try {
            const response = await fetch(`https://api.clicknich.com/api/superadmin/user/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`,
                    'Content-Type': 'application/json',
                    'x-user-id': user?.id || ''
                }
            })

            if (response.ok) {
                alert('User deleted successfully!')
                setSelectedUser(null)
                fetchUsers() // Reload list
            } else {
                alert('Error deleting user')
            }
        } catch (error) {
            console.error('Error deleting user:', error)
            alert('Error deleting user')
        }
    }

    const handleBanUser = async (userId: string, ban: boolean) => {
        if (!confirm(`Are you sure you want to ${ban ? 'DISABLE' : 'REACTIVATE'} this user?`)) {
            return
        }

        try {
            const response = await fetch(`https://api.clicknich.com/api/superadmin/user/${userId}/ban`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`,
                    'Content-Type': 'application/json',
                    'x-user-id': user?.id || ''
                },
                body: JSON.stringify({ ban })
            })

            if (response.ok) {
                alert(`User ${ban ? 'disabled' : 'reactivated'} successfully!`)
                setSelectedUser(null)
                fetchUsers() // Reload list
            } else {
                alert(`Error ${ban ? 'disabling' : 'reactivating'} user`)
            }
        } catch (error) {
            console.error('Error changing user status:', error)
            alert('Error changing user status')
        }
    }

    // ─── FINANCIAL ─────────────────────────────────────────────────────────────
    const fetchFinancial = async () => {
        setLoadingFinancial(true)
        try {
            const res = await fetch('https://api.clicknich.com/api/superadmin/financial', {
                headers: { 'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`, 'Content-Type': 'application/json', 'x-user-id': user?.id || '' }
            })
            if (res.ok) setFinancialData(await res.json())
        } catch (e) { console.error(e) } finally { setLoadingFinancial(false) }
    }

    // ─── PAYMENT CONFIG ─────────────────────────────────────────────────────────
    const ADMIN_HEADERS = {
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`,
        'Content-Type': 'application/json',
        'x-user-id': user?.id || ''
    }

    const PROVIDER_ICONS: Record<string, string> = {
        stripe: '🔵',
        stripe_connect: '🔵',
        mollie: '🟠',
        paypal: '🟡',
        custom: '⚙️',
    }

    const PROVIDER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
        stripe: { bg: 'bg-indigo-500/20', text: 'text-indigo-300', border: 'border-indigo-500/30' },
        stripe_connect: { bg: 'bg-indigo-500/20', text: 'text-indigo-300', border: 'border-indigo-500/30' },
        mollie: { bg: 'bg-orange-500/20', text: 'text-orange-300', border: 'border-orange-500/30' },
        paypal: { bg: 'bg-yellow-500/20', text: 'text-yellow-300', border: 'border-yellow-500/30' },
        custom: { bg: 'bg-gray-500/20', text: 'text-gray-300', border: 'border-gray-500/30' },
    }

    const CREDENTIAL_FIELDS: Record<string, Array<{ key: string; label: string; placeholder: string }>> = {
        stripe: [
            { key: 'secret_key', label: 'Secret Key', placeholder: 'sk_live_...' },
            { key: 'webhook_secret', label: 'Webhook Secret', placeholder: 'whsec_...' },
        ],
        stripe_connect: [
            { key: 'secret_key', label: 'Secret Key', placeholder: 'sk_live_...' },
            { key: 'webhook_secret', label: 'Webhook Secret', placeholder: 'whsec_...' },
        ],
        mollie: [
            { key: 'live_api_key', label: 'Live API Key', placeholder: 'live_...' },
            { key: 'test_api_key', label: 'Test API Key', placeholder: 'test_...' },
        ],
        paypal: [
            { key: 'client_id', label: 'Client ID', placeholder: 'AYhVxxxxxx...' },
            { key: 'client_secret', label: 'Client Secret', placeholder: 'EJ3Nxxxxxx...' },
        ],
        custom: [
            { key: 'api_key', label: 'API Key', placeholder: 'key_...' },
        ],
    }

    const fetchPaymentConfigs = async () => {
        setLoadingPaymentConfigs(true)
        setLoadingProviders(true)
        try {
            const [cfgRes, providersRes] = await Promise.all([
                fetch('https://api.clicknich.com/api/superadmin/payment-configs', { headers: ADMIN_HEADERS }),
                fetch('https://api.clicknich.com/api/superadmin/providers', { headers: ADMIN_HEADERS }),
            ])
            if (cfgRes.ok) { const d = await cfgRes.json(); setPaymentConfigs(d.configs || []) }
            if (providersRes.ok) {
                const d = await providersRes.json()
                setProviders(d.providers || [])
                const globalDefault = d.providers?.find((p: PaymentProvider) => p.is_global_default)
                if (globalDefault) setGlobalProvider(globalDefault.id)
            }
        } catch (e) { console.error(e) } finally {
            setLoadingPaymentConfigs(false)
            setLoadingProviders(false)
        }
    }

    const handleSavePaymentConfig = async (targetUserId: string) => {
        setSavingPaymentConfig(true)
        try {
            const res = await fetch(`https://api.clicknich.com/api/superadmin/payment-config/${targetUserId}`, {
                method: 'PUT',
                headers: ADMIN_HEADERS,
                body: JSON.stringify(paymentConfigForm)
            })
            if (res.ok) { setEditingPaymentUser(null); fetchPaymentConfigs() }
            else alert('Erro ao salvar configuração')
        } catch (e) { console.error(e) } finally { setSavingPaymentConfig(false) }
    }

    const handleSaveGlobalProvider = async (provider: string) => {
        try {
            const res = await fetch('https://api.clicknich.com/api/superadmin/platform-config', {
                method: 'PUT',
                headers: ADMIN_HEADERS,
                body: JSON.stringify({ key: 'default_payment_provider', value: `"${provider}"` })
            })
            if (res.ok) setGlobalProvider(provider)
            else alert('Erro ao salvar provedor global')
        } catch (e) { console.error(e) }
    }

    const handleSetGlobalDefault = async (providerId: string) => {
        try {
            const res = await fetch(`https://api.clicknich.com/api/superadmin/providers/${providerId}`, {
                method: 'PUT',
                headers: ADMIN_HEADERS,
                body: JSON.stringify({ is_global_default: true })
            })
            if (res.ok) {
                setGlobalProvider(providerId)
                setProviders(prev => prev.map(p => ({ ...p, is_global_default: p.id === providerId })))
            } else alert('Erro ao definir provedor padrão')
        } catch (e) { console.error(e) }
    }

    const handleToggleProviderActive = async (providerId: string, currentActive: boolean) => {
        try {
            const res = await fetch(`https://api.clicknich.com/api/superadmin/providers/${providerId}`, {
                method: 'PUT',
                headers: ADMIN_HEADERS,
                body: JSON.stringify({ is_active: !currentActive })
            })
            if (res.ok) {
                setProviders(prev => prev.map(p => p.id === providerId ? { ...p, is_active: !currentActive } : p))
            }
        } catch (e) { console.error(e) }
    }

    const handleCreateProvider = async () => {
        if (!newProviderForm.name || !newProviderForm.type) return
        setSavingProvider(true)
        try {
            const res = await fetch('https://api.clicknich.com/api/superadmin/providers', {
                method: 'POST',
                headers: ADMIN_HEADERS,
                body: JSON.stringify(newProviderForm)
            })
            if (res.ok) {
                const d = await res.json()
                setProviders(prev => [...prev, d.provider])
                setNewProviderForm({ name: '', type: 'stripe', credentials: {} })
                setShowAddProviderForm(false)
            } else alert('Erro ao cadastrar provedor')
        } catch (e) { console.error(e) } finally { setSavingProvider(false) }
    }

    const handleSaveProviderEdit = async (providerId: string) => {
        setSavingProvider(true)
        try {
            const res = await fetch(`https://api.clicknich.com/api/superadmin/providers/${providerId}`, {
                method: 'PUT',
                headers: ADMIN_HEADERS,
                body: JSON.stringify({ name: editingProviderName, credentials: editingProviderCreds })
            })
            if (res.ok) {
                setProviders(prev => prev.map(p => p.id === providerId ? { ...p, name: editingProviderName } : p))
                setEditingProviderId(null)
            } else alert('Erro ao salvar provedor')
        } catch (e) { console.error(e) } finally { setSavingProvider(false) }
    }

    const handleDeleteProvider = async (providerId: string) => {
        if (!window.confirm('Tem certeza? Esta ação não pode ser desfeita.')) return
        try {
            const res = await fetch(`https://api.clicknich.com/api/superadmin/providers/${providerId}`, {
                method: 'DELETE',
                headers: ADMIN_HEADERS
            })
            if (res.ok) setProviders(prev => prev.filter(p => p.id !== providerId))
            else alert('Erro ao remover provedor')
        } catch (e) { console.error(e) }
    }

    const handleSearchProviderUser = async () => {
        if (!providerUserSearch) return
        setSearchingProviderUser(true)
        setProviderUserResult(null)
        setProviderSearchResults(null)
        try {
            const res = await fetch('https://api.clicknich.com/api/superadmin/payment-config/search', {
                method: 'POST',
                headers: ADMIN_HEADERS,
                body: JSON.stringify({ email: providerUserSearch })
            })
            if (res.ok) {
                const d = await res.json()
                const list: Array<{ id: string; email: string; config: any }> = d.users ?? []
                setProviderSearchResults(list)
                if (list.length === 1) {
                    setProviderUserResult({ user: { id: list[0].id, email: list[0].email }, config: list[0].config })
                    setSelectedProviderForUser(list[0].config?.provider_id || '')
                }
            }
        } catch (e) { console.error(e) } finally { setSearchingProviderUser(false) }
    }

    const handleSelectProviderUser = (u: { id: string; email: string; config: any }) => {
        setProviderUserResult({ user: { id: u.id, email: u.email }, config: u.config })
        setSelectedProviderForUser(u.config?.provider_id || '')
    }

    const handleAssignProviderToUser = async () => {
        if (!providerUserResult?.user) return
        setAssigningProvider(true)
        try {
            const res = await fetch(`https://api.clicknich.com/api/superadmin/payment-config/${providerUserResult.user.id}`, {
                method: 'PUT',
                headers: ADMIN_HEADERS,
                body: JSON.stringify({
                    provider_id: selectedProviderForUser || null,
                    override_platform_default: !!selectedProviderForUser
                })
            })
            if (res.ok) {
                fetchPaymentConfigs()
                setProviderUserResult(null)
                setProviderSearchResults(null)
                setProviderUserSearch('')
                setSelectedProviderForUser('')
            } else alert('Erro ao atribuir provedor')
        } catch (e) { console.error(e) } finally { setAssigningProvider(false) }
    }

    // ─── PLATFORM CONFIG ────────────────────────────────────────────────────────
    const fetchPlatformConfig = async () => {
        setLoadingPlatformConfig(true)
        try {
            const res = await fetch('https://api.clicknich.com/api/superadmin/platform-config', {
                headers: { 'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`, 'Content-Type': 'application/json', 'x-user-id': user?.id || '' }
            })
            if (res.ok) {
                const d = await res.json()
                setPlatformConfig(d)
                const edits: Record<string, any> = {}
                Object.entries(d).forEach(([k, v]: [string, any]) => { edits[k] = v.value })
                setPlatformConfigEdits(edits)
            }
        } catch (e) { console.error(e) } finally { setLoadingPlatformConfig(false) }
    }

    const saveSinglePlatformConfig = async (key: string) => {
        setSavingPlatformConfig(key)
        try {
            const res = await fetch('https://api.clicknich.com/api/superadmin/platform-config', {
                method: 'PUT',
                headers: { 'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`, 'Content-Type': 'application/json', 'x-user-id': user?.id || '' },
                body: JSON.stringify({ key, value: platformConfigEdits[key] })
            })
            if (res.ok) fetchPlatformConfig()
        } catch (e) { console.error(e) } finally { setSavingPlatformConfig(null) }
    }

    // ─── ANNOUNCEMENTS ──────────────────────────────────────────────────────────
    const fetchAnnouncements = async () => {
        setLoadingAnnouncements(true)
        try {
            const res = await fetch('https://api.clicknich.com/api/superadmin/announcements', {
                headers: { 'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`, 'Content-Type': 'application/json', 'x-user-id': user?.id || '' }
            })
            if (res.ok) { const d = await res.json(); setAnnouncements(d.announcements || []) }
        } catch (e) { console.error(e) } finally { setLoadingAnnouncements(false) }
    }

    const handleCreateAnnouncement = async () => {
        if (!newAnnouncement.title.trim() || !newAnnouncement.content.trim()) return
        setSavingAnnouncement(true)
        try {
            const res = await fetch('https://api.clicknich.com/api/superadmin/announcements', {
                method: 'POST',
                headers: { 'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`, 'Content-Type': 'application/json', 'x-user-id': user?.id || '' },
                body: JSON.stringify(newAnnouncement)
            })
            if (res.ok) {
                setNewAnnouncement({ title: '', content: '', type: 'info', target_plan: 'all', expires_at: '' })
                fetchAnnouncements()
            }
        } catch (e) { console.error(e) } finally { setSavingAnnouncement(false) }
    }

    const handleDeleteAnnouncement = async (id: string) => {
        if (!confirm('Remover este comunicado?')) return
        setDeletingAnnouncementId(id)
        try {
            await fetch(`https://api.clicknich.com/api/superadmin/announcements/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`, 'Content-Type': 'application/json', 'x-user-id': user?.id || '' }
            })
            fetchAnnouncements()
        } catch (e) { console.error(e) } finally { setDeletingAnnouncementId(null) }
    }

    // ─── AUDIT LOG ──────────────────────────────────────────────────────────────
    const fetchAuditLog = async (page: number) => {
        setLoadingAuditLog(true)
        try {
            const params = new URLSearchParams({ page: String(page), limit: '50' })
            if (auditActionFilter) params.set('action', auditActionFilter)
            const res = await fetch(`https://api.clicknich.com/api/superadmin/audit-log?${params}`, {
                headers: { 'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`, 'Content-Type': 'application/json', 'x-user-id': user?.id || '' }
            })
            if (res.ok) { const d = await res.json(); setAuditLog(d.logs || []); setAuditTotal(d.total || 0); setAuditPage(page) }
        } catch (e) { console.error(e) } finally { setLoadingAuditLog(false) }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'active':
                return <span className="w-2 h-2 rounded-full bg-blue-400" />
            case 'pending':
                return <span className="w-2 h-2 rounded-full bg-blue-300/60" />
            case 'error':
                return <span className="w-2 h-2 rounded-full bg-blue-600" />
            default:
                return <span className="w-2 h-2 rounded-full bg-gray-500" />
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-[#030712] relative overflow-hidden">
                {/* Background effects */}
                <div className="absolute inset-0">
                    <div className="absolute -top-[40%] -left-[20%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-blue-600/10 via-blue-500/5 to-transparent blur-3xl" />
                    <div className="absolute -bottom-[40%] -right-[20%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-blue-600/10 via-blue-500/5 to-transparent blur-3xl" />
                </div>
                <div className="flex items-center justify-center h-screen relative z-10">
                    <div className="text-center">
                        <div className="w-12 h-12 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto"></div>
                        <p className="mt-4 text-gray-400 text-sm">{t('superadmin.loading_dashboard')}</p>
                    </div>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen bg-[#030712] relative overflow-hidden">
                {/* Background effects */}
                <div className="absolute inset-0">
                    <div className="absolute -top-[40%] -left-[20%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-blue-600/10 via-blue-500/5 to-transparent blur-3xl" />
                </div>
                <div className="max-w-7xl mx-auto px-4 py-8 relative z-10">
                    <div className="backdrop-blur-xl bg-blue-500/5 border border-blue-500/20 rounded-none p-6">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                                <span className="text-blue-400 font-bold text-lg">!</span>
                            </div>
                            <div>
                                <h3 className="font-semibold text-blue-400 text-lg">{t('superadmin.access_error')}</h3>
                                <p className="text-blue-300/70 text-sm mt-1">{error}</p>
                                {error.includes('Super Admin') && (
                                    <p className="text-blue-300/50 text-sm mt-2">
                                        {t('superadmin.only_super_admins')}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // ── Dashboard: tendências calculadas de dados reais ─────────────────────────
    const _dashMonths = financialData ? Object.entries(financialData.monthly_gmv) : []
    const _lastGmv = _dashMonths.length >= 1 ? Number(_dashMonths[_dashMonths.length - 1][1]) : 0
    const _prevGmv = _dashMonths.length >= 2 ? Number(_dashMonths[_dashMonths.length - 2][1]) : null
    const dashGmvTrend = _prevGmv != null && _prevGmv > 0 ? ((_lastGmv - _prevGmv) / _prevGmv * 100).toFixed(1) : null
    const dashGmvTrendUp = dashGmvTrend != null ? Number(dashGmvTrend) >= 0 : true
    const _lastRev = financialData ? _lastGmv * financialData.fee_percent / 100 : 0
    const _prevRev = _prevGmv != null && financialData ? _prevGmv * financialData.fee_percent / 100 : null
    const dashRevTrend = _prevRev != null && _prevRev > 0 ? ((_lastRev - _prevRev) / _prevRev * 100).toFixed(1) : null
    const dashRevTrendUp = dashRevTrend != null ? Number(dashRevTrend) >= 0 : true
    const dashNew30d = financialData?.new_users_30d ?? null
    const dashConvRate = financialData?.conversion_rate ?? null
    const dashConvGood = dashConvRate != null ? dashConvRate >= 3 : true

    const NAV_TABS = [
        { id: 'dashboard', label: 'Dashboard', badge: 0 },
        { id: 'users', label: t('superadmin.users'), badge: 0 },
        { id: 'verifications', label: t('superadmin.bank_verifications'), badge: bankVerifications.length },
        { id: 'reviews', label: t('superadmin.products_tab'), badge: pendingApps.length + pendingProducts.length },
        { id: 'financial', label: 'Financeiro', badge: 0 },

        { id: 'config', label: 'Config', badge: 0 },
        { id: 'announcements', label: 'Comunicados', badge: 0 },
        { id: 'audit', label: 'Audit Log', badge: 0 },
    ]

    return (
        <div className="min-h-screen bg-[#030712]">
            {/* ─── HEADER ───────────────────────────────────────────────────────── */}
            <div className="border-b border-white/[0.06] bg-[#040810]">
                <div className="max-w-screen-2xl mx-auto px-6 h-14 flex items-center justify-between">
                    {/* Brand */}
                    <div className="flex items-center gap-3">
                        <span className="text-white font-bold text-sm tracking-tight">Clicknich</span>
                    </div>

                    {/* Right side */}
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/8 border border-emerald-500/15">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.7)]" />
                            <span className="text-xs text-emerald-400 font-medium">Sistemas OK</span>
                        </div>
                        {(pendingApps.length + pendingProducts.length) > 0 && (
                            <button onClick={() => setActiveTab('reviews')} className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/25 text-xs text-amber-400 hover:bg-amber-500/15 transition-colors font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                {pendingApps.length + pendingProducts.length} reviews
                            </button>
                        )}
                        <div className="h-4 w-px bg-white/[0.08]" />
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500/30 to-violet-500/30 border border-white/[0.1] flex items-center justify-center text-white text-xs font-bold">
                                {user?.email?.charAt(0)?.toUpperCase()}
                            </div>
                            <span className="text-xs text-gray-400 max-w-[160px] truncate">{user?.email}</span>
                        </div>
                        <button
                            onClick={async () => {
                                const { useAuthStore } = await import('@/stores/authStore')
                                const { supabase } = await import('@/services/supabase')
                                await supabase.auth.signOut()
                                useAuthStore.getState().setUser(null)
                                window.location.href = '/super-login'
                            }}
                            className="px-3 py-1.5 text-xs text-gray-500 hover:text-red-400 bg-white/[0.03] hover:bg-red-500/10 border border-white/[0.06] hover:border-red-500/20 transition-all"
                        >
                            Sair
                        </button>
                    </div>
                </div>

                {/* Tabs bar */}
                <div className="max-w-screen-2xl mx-auto px-6 overflow-x-auto">
                    <div className="flex items-center gap-0 min-w-max">
                        {NAV_TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`relative flex items-center gap-2 px-4 py-3 text-xs font-medium transition-colors whitespace-nowrap border-b-2 ${activeTab === tab.id
                                    ? 'text-white border-blue-500'
                                    : 'text-gray-500 hover:text-gray-300 border-transparent hover:border-white/[0.1]'
                                    }`}
                            >
                                {tab.label}
                                {tab.badge > 0 && (
                                    <span className="bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] px-1.5 py-0.5 font-bold leading-none">
                                        {tab.badge}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ─── CONTENT ──────────────────────────────────────────────────────── */}
            <div className="max-w-screen-2xl mx-auto px-6 py-6">

                {/* ════════════════ DASHBOARD TAB ════════════════ */}
                {activeTab === 'dashboard' && (
                    <div className="space-y-4">

                        {/* ── Row 1: 3 KPI cards ─────────────────────────────── */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                            {[
                                {
                                    label: 'GMV Total',
                                    icon: (
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    ),
                                    value: financialData ? financialData.gmv.toLocaleString('pt-BR', { style: 'currency', currency: 'USD' }) : '—',
                                    pct: dashGmvTrend != null ? `${dashGmvTrendUp ? '+' : ''}${dashGmvTrend}%` : null,
                                    up: dashGmvTrendUp,
                                    sub: 'volume bruto de vendas',
                                    accent: '#3b82f6',
                                },
                                {
                                    label: 'Receita',
                                    icon: (
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                    ),
                                    value: financialData ? financialData.platform_revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'USD' }) : '—',
                                    pct: dashRevTrend != null ? `${dashRevTrendUp ? '+' : ''}${dashRevTrend}%` : null,
                                    up: dashRevTrendUp,
                                    sub: financialData ? `taxa ${financialData.fee_percent}% do GMV` : 'taxa sobre GMV',
                                    accent: '#22c55e',
                                },
                                {
                                    label: 'Owners',
                                    icon: (
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                    ),
                                    value: stats ? stats.overview.totalUsers.toLocaleString('pt-BR') : '—',
                                    pct: dashNew30d != null ? `+${dashNew30d}` : null,
                                    up: true,
                                    sub: 'owners cadastrados',
                                    accent: '#a855f7',
                                },
                            ].map(kpi => (
                                <div key={kpi.label} className="relative bg-[#0d1829] border border-white/[0.06] p-5 overflow-hidden group hover:border-white/[0.12] transition-all duration-200">
                                    {/* left accent bar */}
                                    <div className="absolute left-0 top-0 bottom-0 w-0.5" style={{ background: kpi.accent }} />
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 flex items-center justify-center" style={{ color: kpi.accent }}>
                                                {kpi.icon}
                                            </div>
                                            <span className="text-xs text-gray-500 font-medium">•••</span>
                                        </div>
                                        {kpi.pct != null && (
                                            <span className={`text-xs px-2 py-0.5 font-semibold ${kpi.up ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'bg-red-500/15 text-red-400 border border-red-500/25'}`}>
                                                {kpi.pct} ↑
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-2xl font-bold text-white leading-none mb-1">{kpi.value}</p>
                                    <p className="text-[11px] text-gray-500">{kpi.label}</p>
                                    <p className="text-[10px] text-gray-700 mt-0.5">{kpi.sub}</p>
                                </div>
                            ))}
                        </div>

                        {/* ── Row 2: Area chart + right column ───────────────── */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                            {/* Area chart — 2/3 width */}
                            <div className="lg:col-span-2 bg-[#0d1829] border border-white/[0.06] p-6">
                                <div className="flex items-start justify-between mb-1">
                                    <div>
                                        <p className="text-xs text-gray-500 font-medium">Receita total</p>
                                        <p className="text-2xl font-bold text-white mt-0.5">
                                            {financialData
                                                ? Number((Object.values(financialData.monthly_gmv) as any[]).reduce((a, b) => a + Number(b), 0) * financialData.fee_percent / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'USD' })
                                                : '—'}
                                            {dashRevTrend != null && (
                                                <span className={`ml-2 text-xs font-semibold px-2 py-0.5 align-middle ${dashRevTrendUp ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/15 text-red-400 border border-red-500/20'}`}>
                                                    {dashRevTrendUp ? '+' : ''}{dashRevTrend}%
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-gray-600">
                                        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-blue-400 inline-block rounded" />GMV</span>
                                        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-emerald-400 inline-block rounded" />Receita</span>
                                    </div>
                                </div>

                                {/* Y-axis labels */}
                                {loadingFinancial ? (
                                    <div className="h-44 flex items-center justify-center"><div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>
                                ) : financialData && Object.keys(financialData.monthly_gmv).length > 0 ? (() => {
                                    const entries = Object.entries(financialData.monthly_gmv).slice(-12) as [string, any][]
                                    const gmvVals = entries.map(([, v]) => Number(v))
                                    const revVals = gmvVals.map(v => v * financialData.fee_percent / 100)
                                    const maxVal = Math.max(...gmvVals, 1)
                                    const W = 100, H = 100
                                    const pts = (vals: number[]) =>
                                        vals.map((v, i) => `${(i / (vals.length - 1)) * W},${H - (v / maxVal) * (H - 10)}`)
                                    const gmvPts = pts(gmvVals)
                                    const revPts = pts(revVals)
                                    const linePath = (p: string[]) => `M ${p.join(' L ')}`
                                    const areaPath = (p: string[]) => `M ${p[0]} L ${p.join(' L ')} L ${W},${H} L 0,${H} Z`
                                    const yLabels = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(maxVal * f))
                                    return (
                                        <div className="mt-4 relative">
                                            <div className="flex gap-3">
                                                {/* Y axis */}
                                                <div className="flex flex-col-reverse justify-between pb-5 h-44 text-right">
                                                    {yLabels.map(v => (
                                                        <span key={v} className="text-[10px] text-gray-700 w-10 leading-none">${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}</span>
                                                    ))}
                                                </div>
                                                {/* SVG chart */}
                                                <div className="flex-1">
                                                    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-40">
                                                        <defs>
                                                            <linearGradient id="gmvGrad" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
                                                                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
                                                            </linearGradient>
                                                            <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="0%" stopColor="#22c55e" stopOpacity="0.25" />
                                                                <stop offset="100%" stopColor="#22c55e" stopOpacity="0.02" />
                                                            </linearGradient>
                                                        </defs>
                                                        {/* horizontal grid lines */}
                                                        {[0.25, 0.5, 0.75, 1].map(f => (
                                                            <line key={f} x1="0" y1={H - f * (H - 10)} x2={W} y2={H - f * (H - 10)} stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
                                                        ))}
                                                        {/* GMV area */}
                                                        <path d={areaPath(gmvPts)} fill="url(#gmvGrad)" />
                                                        {/* Revenue area */}
                                                        <path d={areaPath(revPts)} fill="url(#revGrad)" />
                                                        {/* GMV line */}
                                                        <path d={linePath(gmvPts)} fill="none" stroke="#3b82f6" strokeWidth="1.2" strokeLinejoin="round" />
                                                        {/* Revenue line */}
                                                        <path d={linePath(revPts)} fill="none" stroke="#22c55e" strokeWidth="1" strokeLinejoin="round" strokeDasharray="2 1" />
                                                        {/* last point dot */}
                                                        <circle cx={gmvPts[gmvPts.length - 1].split(',')[0]} cy={gmvPts[gmvPts.length - 1].split(',')[1]} r="1.5" fill="#3b82f6" />
                                                    </svg>
                                                    {/* X axis labels */}
                                                    <div className="flex justify-between mt-1">
                                                        {entries.map(([month]) => (
                                                            <span key={month} className="text-[10px] text-gray-700 capitalize">
                                                                {new Date(month + '-01').toLocaleDateString('pt-BR', { month: 'short' })}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })() : (
                                    <div className="h-44 flex items-center justify-center">
                                        <button onClick={fetchFinancial} className="text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 px-4 py-2 border border-blue-500/20 transition-colors">Carregar dados financeiros</button>
                                    </div>
                                )}
                            </div>

                            {/* Right column — Profit + Sessions stacked */}
                            <div className="flex flex-col gap-3">
                                {/* Total profit (bar chart) */}
                                <div className="flex-1 bg-[#0d1829] border border-white/[0.06] p-5">
                                    <p className="text-xs text-gray-500 font-medium">Lucro total</p>
                                    <p className="text-xl font-bold text-white mt-0.5">
                                        {financialData ? financialData.platform_revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'USD' }) : '—'}
                                        {dashRevTrend != null && (
                                            <span className={`ml-2 text-xs align-middle px-1.5 py-0.5 font-semibold ${dashRevTrendUp ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                                                {dashRevTrendUp ? '+' : ''}{dashRevTrend}%
                                            </span>
                                        )}
                                    </p>
                                    {/* Mini bar chart */}
                                    <div className="mt-4 h-16 flex items-end gap-1">
                                        {(financialData ? Object.entries(financialData.monthly_gmv).slice(-10) : Array(10).fill(['', 0])).map(([month, gmv]: any, i, arr) => {
                                            const vals = arr.map(([, v]: any) => Number(v))
                                            const max = Math.max(...vals, 1)
                                            const h = (Number(gmv) / max) * 100
                                            const isLast = i === arr.length - 1
                                            return (
                                                <div key={month || i} className="flex-1 flex flex-col justify-end h-full">
                                                    <div
                                                        className="w-full transition-all duration-500"
                                                        style={{
                                                            height: `${h}%`,
                                                            background: isLast ? '#22c55e' : 'rgba(34,197,94,0.25)',
                                                            minHeight: '2px',
                                                        }}
                                                    />
                                                </div>
                                            )
                                        })}
                                    </div>
                                    <p className="text-[10px] text-gray-700 mt-2">Últimos 12 meses <button onClick={() => setActiveTab('financial')} className="text-blue-500 hover:text-blue-400 transition-colors ml-1">Ver relatório →</button></p>
                                </div>

                                {/* Total sessions / owners sparkline */}
                                <div className="flex-1 bg-[#0d1829] border border-white/[0.06] p-5">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-blue-400" />
                                        <p className="text-xs text-gray-500 font-medium">Total de owners</p>
                                    </div>
                                    <p className="text-xl font-bold text-white mt-0.5">
                                        {stats ? stats.overview.totalUsers.toLocaleString('pt-BR') : '—'}
                                    </p>
                                    {/* Sparkline SVG */}
                                    {stats?.charts?.monthlyApps && (() => {
                                        const vals = Object.values(stats.charts.monthlyApps).slice(-12).map(Number)
                                        const max = Math.max(...vals, 1)
                                        const W2 = 100, H2 = 30
                                        const pts2 = vals.map((v, i) => `${(i / (vals.length - 1)) * W2},${H2 - (v / max) * (H2 - 4)}`)
                                        return (
                                            <svg viewBox={`0 0 ${W2} ${H2}`} preserveAspectRatio="none" className="w-full mt-3" style={{ height: '40px' }}>
                                                <defs>
                                                    <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                                                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                                                    </linearGradient>
                                                </defs>
                                                <path d={`M ${pts2.join(' L ')} L ${W2},${H2} L 0,${H2} Z`} fill="url(#sparkGrad)" />
                                                <path d={`M ${pts2.join(' L ')}`} fill="none" stroke="#3b82f6" strokeWidth="1.2" strokeLinejoin="round" />
                                            </svg>
                                        )
                                    })()}
                                    <p className="text-[10px] text-gray-700 mt-1">
                                        {dashNew30d != null && `+${dashNew30d} novos · `}
                                        <button onClick={() => setActiveTab('users')} className="text-blue-500 hover:text-blue-400 transition-colors">Ver usuários →</button>
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* ── Row 3: Reports overview ─────────────────────────── */}
                        <div className="bg-[#0d1829] border border-white/[0.06]">
                            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-white">Visão geral da plataforma</p>
                                    <p className="text-xs text-gray-500 mt-0.5">Resumo de todas as métricas operacionais</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setActiveTab('financial')} className="text-xs px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.07] text-gray-400 hover:text-white transition-colors">
                                        Exportar dados
                                    </button>
                                    <button onClick={fetchFinancial} className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white transition-colors font-medium">
                                        Atualizar
                                    </button>
                                </div>
                            </div>
                            <div className="divide-y divide-white/[0.04]">
                                {[
                                    {
                                        label: 'GMV acumulado',
                                        value: financialData ? financialData.gmv.toLocaleString('pt-BR', { style: 'currency', currency: 'USD' }) : '—',
                                        sub: 'Volume bruto total de vendas na plataforma',
                                        trend: dashGmvTrend, up: dashGmvTrendUp,
                                    },
                                    {
                                        label: 'Receita da plataforma',
                                        value: financialData ? financialData.platform_revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'USD' }) : '—',
                                        sub: financialData ? `Taxa de ${financialData.fee_percent}% aplicada ao GMV` : 'Taxa sobre GMV',
                                        trend: dashRevTrend, up: dashRevTrendUp,
                                    },
                                    {
                                        label: 'Total de owners',
                                        value: stats ? stats.overview.totalUsers.toLocaleString('pt-BR') : '—',
                                        sub: `${stats?.overview?.totalApplications ?? '—'} apps criados na plataforma`,
                                        trend: dashNew30d != null ? String(dashNew30d) : null, up: true,
                                    },
                                    {
                                        label: 'Produtos no marketplace',
                                        value: stats?.overview?.totalProducts?.toLocaleString('pt-BR') ?? '—',
                                        sub: 'Produtos publicados e disponíveis',
                                        trend: null, up: true,
                                    },
                                    {
                                        label: 'Saúde dos serviços',
                                        value: `${[true, true, providers.some(p => p.type === 'stripe' && p.is_active), providers.some(p => p.type === 'paypal' && p.is_active), true].filter(Boolean).length}/5 operacionais`,
                                        sub: 'Workers API · Supabase · Stripe · PayPal · SMTP',
                                        trend: null, up: true,
                                    },
                                ].map((row) => (
                                    <div key={row.label} className="px-6 py-3.5 flex items-center gap-4 hover:bg-white/[0.02] transition-colors group">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-white">{row.label}</p>
                                            <p className="text-[11px] text-gray-600 mt-0.5">{row.sub}</p>
                                        </div>
                                        <p className="text-sm font-bold text-white shrink-0">{row.value}</p>
                                        {row.trend != null && (
                                            <span className={`text-xs px-2 py-0.5 font-semibold shrink-0 ${row.up ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/15 text-red-400 border border-red-500/20'}`}>
                                                {row.up ? '+' : ''}{row.trend}{typeof row.trend === 'string' && row.trend.includes('%') ? '' : row.up ? ' novos' : ''}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* ── Row 4: Providers + Activity + Health ────────────── */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                            {/* Provedores */}
                            <div className="bg-[#0d1829] border border-white/[0.06] overflow-hidden">
                                <div className="px-5 py-4 border-b border-white/[0.05] flex items-center justify-between">
                                    <p className="text-xs font-semibold text-white">Provedores de pagamento</p>
                                    <button onClick={() => setActiveTab('payments')} className="text-[10px] text-blue-500 hover:text-blue-400 transition-colors">Gerenciar →</button>
                                </div>
                                <div className="divide-y divide-white/[0.04]">
                                    {providers.length === 0 ? (
                                        <div className="px-5 py-8 text-center"><p className="text-xs text-gray-600">Nenhum provedor cadastrado</p></div>
                                    ) : providers.map((p) => {
                                        const C: Record<string, string> = { stripe: '#3b82f6', stripe_connect: '#3b82f6', mollie: '#f97316', paypal: '#0ea5e9', custom: '#a855f7' }
                                        const c = C[p.type] || '#6b7280'
                                        return (
                                            <div key={p.id} className="px-5 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
                                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.is_active ? c : '#374151', boxShadow: p.is_active ? `0 0 6px ${c}80` : 'none' }} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-medium text-white truncate">{p.name}</p>
                                                    <p className="text-[10px] text-gray-600">{p.type}{p.is_global_default ? ' · default' : ''}</p>
                                                </div>
                                                <span className="text-[10px] px-1.5 py-0.5 border font-semibold flex-shrink-0" style={{ color: p.is_active ? c : '#6b7280', borderColor: p.is_active ? `${c}40` : '#374151', background: p.is_active ? `${c}15` : 'transparent' }}>
                                                    {p.is_active ? 'ativo' : 'inativo'}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Feed de atividade */}
                            <div className="bg-[#0d1829] border border-white/[0.06] overflow-hidden">
                                <div className="px-5 py-4 border-b border-white/[0.05] flex items-center justify-between">
                                    <p className="text-xs font-semibold text-white">Atividade recente</p>
                                    <button onClick={() => setActiveTab('audit')} className="text-[10px] text-blue-500 hover:text-blue-400 transition-colors">Audit log →</button>
                                </div>
                                {loadingAuditLog ? (
                                    <div className="p-8 flex justify-center"><div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>
                                ) : auditLog.length === 0 ? (
                                    <div className="px-5 py-8 text-center"><p className="text-xs text-gray-600">Sem registros</p></div>
                                ) : (
                                    <div className="divide-y divide-white/[0.04] max-h-64 overflow-y-auto">
                                        {auditLog.slice(0, 8).map((log) => {
                                            const META: Record<string, { label: string; color: string }> = {
                                                ban_user: { label: 'Banir usuário', color: '#f59e0b' },
                                                unban_user: { label: 'Desbanir', color: '#22c55e' },
                                                delete_user: { label: 'Deletar usuário', color: '#ef4444' },
                                                create_payment_provider: { label: 'Novo provedor', color: '#3b82f6' },
                                                update_payment_provider: { label: 'Provedor atualizado', color: '#6366f1' },
                                                delete_payment_provider: { label: 'Provedor removido', color: '#ef4444' },
                                                update_platform_config: { label: 'Config. alterada', color: '#06b6d4' },
                                                create_announcement: { label: 'Comunicado', color: '#a855f7' },
                                                approve_bank_verification: { label: 'Verificação aprovada', color: '#22c55e' },
                                                reject_bank_verification: { label: 'Verificação rejeitada', color: '#f97316' },
                                            }
                                            const m = META[log.action] || { label: log.action, color: '#6b7280' }
                                            const diff = Date.now() - new Date(log.created_at).getTime()
                                            const mins = Math.floor(diff / 60000)
                                            const timeAgo = mins < 1 ? 'agora' : mins < 60 ? `${mins}min` : mins < 1440 ? `${Math.floor(mins / 60)}h` : new Date(log.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
                                            return (
                                                <div key={log.id} className="px-5 py-3 flex items-start gap-2.5 hover:bg-white/[0.02] transition-colors">
                                                    <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: m.color }} />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[11px] font-medium text-white truncate">{m.label}</p>
                                                        <p className="text-[10px] text-gray-700">{log.admin_email?.split('@')[0] || 'admin'}</p>
                                                    </div>
                                                    <span className="text-[10px] text-gray-700 flex-shrink-0">{timeAgo}</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Top Sellers + Health */}
                            <div className="flex flex-col gap-3">
                                {/* Top sellers */}
                                <div className="flex-1 bg-[#0d1829] border border-white/[0.06] overflow-hidden">
                                    <div className="px-5 py-4 border-b border-white/[0.05]">
                                        <p className="text-xs font-semibold text-white">Top Sellers</p>
                                    </div>
                                    {financialData?.top_sellers?.length > 0 ? (
                                        <div className="divide-y divide-white/[0.04]">
                                            {financialData.top_sellers.slice(0, 4).map((s: any, idx: number) => (
                                                <div key={s.user_id} className="px-5 py-2.5 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
                                                    <span className="text-sm w-4 text-center flex-shrink-0">{['🥇', '🥈', '🥉'][idx] || `${idx + 1}`}</span>
                                                    <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-violet-600 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                                                        {s.email.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[11px] text-white truncate font-medium">{s.email.split('@')[0]}</p>
                                                        <div className="w-full h-0.5 bg-white/[0.04] mt-1">
                                                            <div className="h-full bg-blue-500" style={{ width: `${Math.round((s.app_count / (financialData.top_sellers[0]?.app_count || 1)) * 100)}%` }} />
                                                        </div>
                                                    </div>
                                                    <span className="text-[11px] font-bold text-blue-400 flex-shrink-0">{s.app_count}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="px-5 py-6 text-center"><p className="text-xs text-gray-600">Sem dados</p></div>
                                    )}
                                </div>
                                {/* Health */}
                                <div className="bg-[#0d1829] border border-white/[0.06] px-5 py-4">
                                    <p className="text-xs font-semibold text-white mb-3">Saúde dos serviços</p>
                                    <div className="space-y-2">
                                        {[
                                            { name: 'Workers API', ok: true },
                                            { name: 'Supabase DB', ok: true },
                                            { name: 'Stripe Hook', ok: providers.some(p => p.type === 'stripe' && p.is_active) },
                                            { name: 'PayPal Hook', ok: providers.some(p => p.type === 'paypal' && p.is_active) },
                                            { name: 'Email SMTP', ok: true },
                                        ].map(svc => (
                                            <div key={svc.name} className="flex items-center justify-between">
                                                <span className="text-[11px] text-gray-500">{svc.name}</span>
                                                <span className={`text-[10px] px-2 py-0.5 font-semibold ${svc.ok ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/15 text-red-400 border border-red-500/20'}`}>
                                                    {svc.ok ? 'online' : 'offline'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                )}


                {/* Users Tab */}
                {activeTab === 'users' && (
                    <>
                        <div className="backdrop-blur-xl bg-white/[0.02] rounded-none border border-white/[0.05] overflow-hidden">
                            {/* Section header */}
                            <div className="px-6 py-5 border-b border-white/[0.05] flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-semibold text-white">{t('superadmin.platform_users')}</h3>
                                    <p className="text-xs text-gray-500 mt-0.5">{users.length} usuários carregados</p>
                                </div>
                                <button onClick={fetchUsers} className="text-xs text-gray-600 hover:text-gray-300 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] px-3 py-1.5 rounded-lg transition-colors">
                                    Atualizar
                                </button>
                            </div>

                            <div className="p-5">
                                {/* Search Filters */}
                                <div className="mb-5 flex gap-3">
                                    <div className="relative flex-1">
                                        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                        <input
                                            type="text"
                                            placeholder={t('superadmin.search_by_name_email')}
                                            value={searchQuery}
                                            onChange={(e) => {
                                                setSearchQuery(e.target.value)
                                                fetchUsers()
                                            }}
                                            className="w-full pl-9 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.07] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40 text-xs"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    {users.map((userItem) => (
                                        <button
                                            key={userItem.id}
                                            onClick={() => {
                                                setSelectedUser(userItem)
                                                fetchUserDetails(userItem.id)
                                            }}
                                            className="w-full flex items-center justify-between px-4 py-3.5 bg-white/[0.02] hover:bg-white/[0.04] rounded-xl border border-white/[0.04] hover:border-blue-500/20 transition-all text-left group"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                                                    {userItem.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <div className="text-sm font-medium text-white">{userItem.name}</div>
                                                        {userItem.plan && (
                                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${userItem.plan === 'advanced' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                                                userItem.plan === 'pro' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                                                    'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                                                                }`}>
                                                                {userItem.plan === 'advanced' ? 'Advanced' : userItem.plan === 'pro' ? 'Pro' : 'Free'}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {userItem.email}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {t('superadmin.registration')}: {userItem.created_at ? new Date(userItem.created_at).toLocaleDateString('en-US') : 'N/A'} • {userItem.app_count} apps
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="text-xs text-gray-500 group-hover:text-blue-400 transition-colors">{t('superadmin.view')}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* User Details Modal */}
                        {selectedUser && (
                            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedUser(null)}>
                                <div className="backdrop-blur-xl bg-[#0d1117]/95 rounded-none shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-white/[0.05]" onClick={(e) => e.stopPropagation()}>
                                    {/* Modal Header */}
                                    <div className="sticky top-0 backdrop-blur-xl bg-white/[0.02] p-6 flex items-center justify-between border-b border-white/[0.05]">
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                                                {selectedUser.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-white">{selectedUser.name}</h3>
                                                <p className="text-sm text-gray-500">{selectedUser.email}</p>
                                                <p className="text-xs text-gray-600">ID: {selectedUser.id}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setSelectedUser(null)}
                                            className="text-gray-500 hover:text-white transition-colors p-2 hover:bg-white/[0.05] rounded-lg text-xl font-light"
                                        >
                                            ×
                                        </button>
                                    </div>

                                    <div className="p-6 space-y-4">
                                        {loadingDetails ? (
                                            <div className="flex items-center justify-center py-12">
                                                <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
                                            </div>
                                        ) : userDetails ? (
                                            <>
                                                {/* Stats Cards */}
                                                <div className="grid grid-cols-3 gap-3">
                                                    <div className="backdrop-blur-xl bg-white/[0.02] p-4 rounded-xl border border-white/[0.05]">
                                                        <div className="text-xs font-medium text-blue-400 mb-1">{t('superadmin.applications')}</div>
                                                        <div className="text-xl font-bold text-white">{userDetails.apps.length}</div>
                                                    </div>
                                                    <div className="backdrop-blur-xl bg-white/[0.02] p-4 rounded-xl border border-white/[0.05]">
                                                        <div className="text-xs font-medium text-blue-400 mb-1">{t('superadmin.clients')}</div>
                                                        <div className="text-xl font-bold text-white">{userDetails.totalClients}</div>
                                                    </div>
                                                    <div className="backdrop-blur-xl bg-white/[0.02] p-4 rounded-xl border border-white/[0.05]">
                                                        <div className="text-xs font-medium text-blue-400 mb-1">{t('superadmin.plan')}</div>
                                                        <div className="text-lg font-bold text-white">{userDetails.plan}</div>
                                                    </div>
                                                </div>

                                                {/* Dates */}
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="backdrop-blur-xl bg-white/[0.02] p-4 rounded-xl border border-white/[0.05]">
                                                        <div className="text-xs text-gray-500 mb-1">{t('superadmin.registration')}</div>
                                                        <div className="text-sm font-semibold text-white">
                                                            {selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleDateString('en-US') : 'N/A'}
                                                        </div>
                                                    </div>
                                                    <div className="backdrop-blur-xl bg-white/[0.02] p-4 rounded-xl border border-white/[0.05]">
                                                        <div className="text-xs text-gray-500 mb-1">{t('superadmin.last_activity')}</div>
                                                        <div className="text-sm font-semibold text-white">
                                                            {new Date(selectedUser.last_activity).toLocaleDateString('en-US')}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Products Stats */}
                                                {userDetails.products && (
                                                    <div className="space-y-6">
                                                        {/* Elegant Header */}
                                                        <div className="flex items-center justify-between pb-2 border-b border-white/5">
                                                            <div>
                                                                <h4 className="text-lg font-bold text-white">{t('superadmin.marketplace_products')}</h4>
                                                                <p className="text-sm text-gray-400">{t('superadmin.product_review_overview')}</p>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm text-gray-400">Total:</span>
                                                                <span className="text-xl font-bold text-white">{userDetails.products.total}</span>
                                                            </div>
                                                        </div>

                                                        {/* Status Cards Grid - Clean Design */}
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                            {/* Approved Card */}
                                                            <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 rounded-none p-6 hover:border-emerald-500/40 transition-all duration-300 group">
                                                                <div className="flex items-center justify-between mb-4">
                                                                    <div>
                                                                        <p className="text-sm font-medium text-emerald-400">{t('superadmin.approved')}</p>
                                                                        <p className="text-xs text-gray-500">{t('superadmin.live_marketplace')}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="space-y-3">
                                                                    <div className="text-xl font-bold text-white">{userDetails.products.approved}</div>
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                                                                            <div
                                                                                className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                                                                                style={{ width: `${userDetails.products.total > 0 ? (userDetails.products.approved / userDetails.products.total * 100) : 0}%` }}
                                                                            />
                                                                        </div>
                                                                        <span className="text-xs font-semibold text-emerald-400 min-w-[35px]">
                                                                            {userDetails.products.total > 0 ? Math.round(userDetails.products.approved / userDetails.products.total * 100) : 0}%
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Rejected Card */}
                                                            <div className="bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-500/20 rounded-none p-6 hover:border-red-500/40 transition-all duration-300 group">
                                                                <div className="flex items-center justify-between mb-4">
                                                                    <div>
                                                                        <p className="text-sm font-medium text-red-400">{t('superadmin.rejected')}</p>
                                                                        <p className="text-xs text-gray-500">{t('superadmin.needs_revision')}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="space-y-3">
                                                                    <div className="text-xl font-bold text-white">{userDetails.products.rejected}</div>
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                                                                            <div
                                                                                className="h-full bg-red-500 rounded-full transition-all duration-700"
                                                                                style={{ width: `${userDetails.products.total > 0 ? (userDetails.products.rejected / userDetails.products.total * 100) : 0}%` }}
                                                                            />
                                                                        </div>
                                                                        <span className="text-xs font-semibold text-red-400 min-w-[35px]">
                                                                            {userDetails.products.total > 0 ? Math.round(userDetails.products.rejected / userDetails.products.total * 100) : 0}%
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Pending Card */}
                                                            <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20 rounded-none p-6 hover:border-amber-500/40 transition-all duration-300 group">
                                                                <div className="flex items-center justify-between mb-4">
                                                                    <div>
                                                                        <p className="text-sm font-medium text-amber-400">{t('superadmin.pending')}</p>
                                                                        <p className="text-xs text-gray-500">{t('superadmin.under_review')}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="space-y-3">
                                                                    <div className="text-xl font-bold text-white">{userDetails.products.pending}</div>
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                                                                            <div
                                                                                className="h-full bg-amber-500 rounded-full transition-all duration-700"
                                                                                style={{ width: `${userDetails.products.total > 0 ? (userDetails.products.pending / userDetails.products.total * 100) : 0}%` }}
                                                                            />
                                                                        </div>
                                                                        <span className="text-xs font-semibold text-amber-400 min-w-[35px]">
                                                                            {userDetails.products.total > 0 ? Math.round(userDetails.products.pending / userDetails.products.total * 100) : 0}%
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Member Areas - Premium Card */}
                                                        {userDetails.products.memberAreaApps > 0 && (
                                                            <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-500/20 rounded-none p-6 hover:border-indigo-500/40 transition-all duration-300">
                                                                <div className="flex items-center justify-between">
                                                                    <div>
                                                                        <h4 className="text-base font-semibold text-white">{t('superadmin.member_area_products')}</h4>
                                                                        <p className="text-sm text-gray-400">{t('superadmin.advanced_content')}</p>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <div className="text-xl font-bold text-white">{userDetails.products.memberAreaApps}</div>
                                                                        <div className="text-xs text-indigo-400 font-medium">Premium</div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Applications List */}
                                                <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <h4 className="font-semibold text-white text-sm">{t('superadmin.applications')}</h4>
                                                        <span className="ml-auto text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-medium border border-blue-500/30">
                                                            {userDetails.apps.length}
                                                        </span>
                                                    </div>
                                                    {userDetails.apps.length > 0 ? (
                                                        <div className="space-y-2">
                                                            {userDetails.apps.map((app: any) => (
                                                                <div key={app.id} className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg hover:bg-white/[0.05] transition-colors border border-white/[0.05]">
                                                                    <div className="flex-1">
                                                                        <div className="font-medium text-white text-sm">{app.name}</div>
                                                                        <div className="text-xs text-gray-500">{app.slug}</div>
                                                                    </div>
                                                                    <span className={`text-xs px-2 py-0.5 rounded font-medium border ${app.review_status === 'approved'
                                                                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                                                        : app.review_status === 'rejected'
                                                                            ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                                                            : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                                                        }`}>
                                                                        {app.review_status === 'approved' ? 'Approved' :
                                                                            app.review_status === 'rejected' ? 'Rejected' : 'Pending'}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-gray-500 text-sm text-center py-4">{t('superadmin.no_apps_created')}</p>
                                                    )}
                                                </div>

                                                {/* Provedor de Pagamento Individual */}
                                                <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                                                    <h4 className="font-semibold text-white text-sm mb-1">Provedor de Pagamento</h4>
                                                    <p className="text-xs text-gray-500 mb-3">Atribui um provedor específico para este usuário. Deixe em "Padrão da plataforma" para usar o global.</p>
                                                    <div className="flex gap-2">
                                                        <select
                                                            value={userModalProviderId}
                                                            onChange={e => setUserModalProviderId(e.target.value)}
                                                            className="flex-1 px-3 py-2 bg-[#0d1117] border border-white/[0.08] rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                                        >
                                                            <option value="">Padrão da plataforma</option>
                                                            {providers.filter(p => p.is_active).map(p => (
                                                                <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                                                            ))}
                                                        </select>
                                                        <button
                                                            onClick={async () => {
                                                                setSavingUserModalProvider(true)
                                                                try {
                                                                    const res = await fetch(`https://api.clicknich.com/api/superadmin/payment-config/${selectedUser.id}`, {
                                                                        method: 'PUT',
                                                                        headers: ADMIN_HEADERS,
                                                                        body: JSON.stringify({
                                                                            provider_id: userModalProviderId || null,
                                                                            override_platform_default: !!userModalProviderId
                                                                        })
                                                                    })
                                                                    if (!res.ok) alert('Erro ao salvar provedor')
                                                                } catch (e) { console.error(e) } finally { setSavingUserModalProvider(false) }
                                                            }}
                                                            disabled={savingUserModalProvider}
                                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-all"
                                                        >
                                                            {savingUserModalProvider ? 'Salvando...' : 'Salvar'}
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Action Buttons */}
                                                <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                                                    <h4 className="font-semibold text-white text-sm mb-3">
                                                        {t('superadmin.admin_actions')}
                                                    </h4>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <button
                                                            onClick={() => handleBanUser(selectedUser.id, true)}
                                                            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-all"
                                                        >
                                                            {t('superadmin.ban_user')}
                                                        </button>
                                                        <button
                                                            onClick={() => handleBanUser(selectedUser.id, false)}
                                                            className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg font-medium text-sm transition-all"
                                                        >
                                                            {t('superadmin.unban_user')}
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteUser(selectedUser.id)}
                                                            className="col-span-2 px-4 py-2.5 bg-blue-800 hover:bg-blue-900 text-white rounded-lg font-medium text-sm transition-all"
                                                        >
                                                            {t('superadmin.delete_user')}
                                                        </button>
                                                    </div>
                                                    <p className="text-xs text-gray-500 mt-3 text-center">
                                                        {t('superadmin.permanent_actions')}
                                                    </p>
                                                </div>
                                            </>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Plans Tab */}
                {activeTab === 'plans' && (
                    <div className="backdrop-blur-xl bg-white/[0.02] rounded-none border border-white/[0.05]">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="text-lg font-semibold text-white">
                                        {t('superadmin.user_plans')}
                                    </h3>
                                    <p className="text-sm text-gray-500 mt-1">{t('superadmin.stripe_integration')}</p>
                                </div>
                            </div>

                            {/* Plan Statistics */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                <div className="backdrop-blur-xl bg-white/[0.02] p-4 rounded-xl border border-white/[0.05]">
                                    <div>
                                        <div className="text-sm text-gray-500">Free</div>
                                        <div className="text-2xl font-bold text-white">
                                            {plans.filter(u => u.plan === 'free').length}
                                        </div>
                                    </div>
                                </div>
                                <div className="backdrop-blur-xl bg-white/[0.02] p-4 rounded-xl border border-white/[0.05]">
                                    <div>
                                        <div className="text-sm text-blue-400">Pro</div>
                                        <div className="text-2xl font-bold text-white">
                                            {plans.filter(u => u.plan === 'pro').length}
                                        </div>
                                    </div>
                                </div>
                                <div className="backdrop-blur-xl bg-white/[0.02] p-4 rounded-xl border border-white/[0.05]">
                                    <div>
                                        <div className="text-sm text-blue-400">Advanced</div>
                                        <div className="text-2xl font-bold text-white">
                                            {plans.filter(u => u.plan === 'advanced').length}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Users and Plans Table */}
                            <div className="overflow-x-auto">
                                <table className="min-w-full">
                                    <thead>
                                        <tr className="border-b border-white/[0.05]">
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                User
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Current Plan
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Apps
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Registration
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/[0.05]">
                                        {plans.map((planUser) => (
                                            <tr key={planUser.id} className="hover:bg-[#252941] transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                                                            {planUser.email.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-medium text-white">{planUser.email}</div>
                                                            <div className="text-xs text-gray-500 truncate max-w-[150px]">{planUser.id}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${planUser.plan === 'advanced' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                                        planUser.plan === 'pro' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                                            'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                                                        }`}>
                                                        {planUser.plan === 'advanced' ? 'Advanced' : planUser.plan === 'pro' ? 'Pro' : 'Free'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                                                    {planUser.app_count} apps
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {planUser.created_at ? new Date(planUser.created_at).toLocaleDateString('en-US') : 'N/A'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedUser(planUser)
                                                            fetchUserDetails(planUser.id)
                                                        }}
                                                        className="text-blue-400 hover:text-blue-300 font-medium transition-colors text-sm"
                                                    >
                                                        {t('superadmin.change_plan')}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Stripe Integration Note */}
                            <div className="mt-6 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                                <div>
                                    <h4 className="text-sm font-medium text-blue-400 mb-1">{t('superadmin.stripe_in_dev')}</h4>
                                    <p className="text-xs text-gray-500">
                                        Current plans are based on the number of applications created. Soon, you'll be able to manage real subscriptions through Stripe, including webhooks for automatic payment synchronization and plan upgrades/downgrades.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Bank Verifications Tab */}
                {activeTab === 'verifications' && (
                    <div className="space-y-5">
                        {/* Quick stats banner */}
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { label: 'Pendentes', value: bankVerifications.filter(v => v.verification_status === 'pending').length, color: 'text-amber-400', bg: 'from-amber-500/8', dot: 'bg-amber-400' },
                                { label: 'Aprovadas', value: bankVerifications.filter(v => v.verification_status === 'approved').length, color: 'text-emerald-400', bg: 'from-emerald-500/8', dot: 'bg-emerald-400' },
                                { label: 'Rejeitadas', value: bankVerifications.filter(v => v.verification_status === 'rejected').length, color: 'text-red-400', bg: 'from-red-500/8', dot: 'bg-red-400' },
                            ].map(s => (
                                <div key={s.label} className={`backdrop-blur-xl bg-gradient-to-br ${s.bg} to-transparent bg-white/[0.02] rounded-xl p-4 border border-white/[0.05] flex items-center gap-3`}>
                                    <span className={`w-2 h-2 rounded-full ${s.dot} flex-shrink-0`} />
                                    <div>
                                        <p className={`text-xl font-bold ${s.color} leading-none`}>{s.value}</p>
                                        <p className="text-xs text-gray-600 mt-0.5">{s.label}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="backdrop-blur-xl bg-white/[0.02] rounded-none border border-white/[0.05] p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-xl font-semibold text-white">{t('superadmin.pending_verifications')}</h2>
                                    <p className="text-sm text-gray-500 mt-1">{t('superadmin.review_accounts_desc')}</p>
                                </div>
                                <button
                                    onClick={fetchBankVerifications}
                                    className="px-4 py-2 bg-white/[0.05] hover:bg-white/[0.1] text-gray-300 rounded-lg text-sm font-medium transition-colors border border-white/[0.05]"
                                >
                                    {t('superadmin.refresh')}
                                </button>
                            </div>

                            {loadingVerifications ? (
                                <div className="text-center py-12">
                                    <div className="w-12 h-12 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto"></div>
                                    <p className="text-gray-500 text-sm mt-4">{t('superadmin.loading_verifications')}</p>
                                </div>
                            ) : bankVerifications.length === 0 ? (
                                <div className="text-center py-12">
                                    <p className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-blue-500 bg-clip-text text-transparent mb-2">{t('superadmin.all_caught_up')}</p>
                                    <p className="text-sm text-gray-500">{t('superadmin.no_pending_verifications')}</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {bankVerifications.map((verification) => (
                                        <div key={verification.id} className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.05] rounded-xl p-5">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-start gap-4">
                                                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                                                        {verification.account_holder_name?.charAt(0) || 'U'}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-semibold text-white">{verification.account_holder_name || 'Unknown'}</h3>
                                                        <p className="text-sm text-gray-400">{verification.user_email}</p>
                                                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                                            <span>{verification.bank_name}</span>
                                                            <span>
                                                                {new Date(verification.submitted_at).toLocaleDateString('en-US', {
                                                                    month: 'short',
                                                                    day: 'numeric',
                                                                    hour: '2-digit',
                                                                    minute: '2-digit'
                                                                })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-medium">
                                                    {t('superadmin.pending_review')}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 p-4 bg-white/[0.02] rounded-lg">
                                                <div>
                                                    <p className="text-xs text-gray-500">Bank Country</p>
                                                    <p className="text-sm text-white">{verification.bank_country || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500">Account Type</p>
                                                    <p className="text-sm text-white capitalize">{verification.account_type || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500">Currency</p>
                                                    <p className="text-sm text-white">{verification.currency || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500">Account</p>
                                                    <p className="text-sm text-white">
                                                        ****{verification.account_number?.slice(-4) || verification.iban?.slice(-4) || 'XXXX'}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Documents */}
                                            <div className="flex flex-wrap gap-2 mt-4">
                                                {verification.id_document_url && (
                                                    <a
                                                        href={verification.id_document_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-400 rounded-lg text-xs hover:bg-blue-500/20 transition-colors"
                                                    >
                                                        ID Document ↗
                                                    </a>
                                                )}
                                                {verification.address_proof_url && (
                                                    <a
                                                        href={verification.address_proof_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-400 rounded-lg text-xs hover:bg-blue-500/20 transition-colors"
                                                    >
                                                        Address Proof ↗
                                                    </a>
                                                )}
                                                {verification.bank_statement_url && (
                                                    <a
                                                        href={verification.bank_statement_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-400 rounded-lg text-xs hover:bg-blue-500/20 transition-colors"
                                                    >
                                                        Bank Statement ↗
                                                    </a>
                                                )}
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/[0.05]">
                                                <button
                                                    onClick={() => openDetailsModal(verification)}
                                                    className="px-4 py-2 bg-white/[0.05] hover:bg-white/[0.1] text-white rounded-lg text-sm font-medium transition-colors"
                                                >
                                                    {t('superadmin.view_details')}
                                                </button>
                                                <button
                                                    onClick={() => handleApproveVerification(verification.id)}
                                                    disabled={processingId === verification.id}
                                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                                                >
                                                    {processingId === verification.id ? (
                                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                    ) : (
                                                        t('superadmin.approve')
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => openRejectModal(verification)}
                                                    disabled={processingId === verification.id}
                                                    className="px-4 py-2 bg-blue-800 hover:bg-blue-900 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                                                >
                                                    {t('superadmin.reject')}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Reviews Tab (Combined Apps and Products) */}
                {activeTab === 'reviews' && (
                    <div className="space-y-6">
                        {/* Apps Review Section */}
                        {true && (
                            <div className="space-y-6">
                                {loadingApps ? (
                                    <div className="backdrop-blur-xl bg-white/[0.02] rounded-none border border-white/[0.05] p-16 flex flex-col items-center justify-center">
                                        <div className="w-12 h-12 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                                        <p className="text-gray-400">{t('superadmin.loading_apps')}</p>
                                    </div>
                                ) : pendingApps.length === 0 ? (
                                    <div className="backdrop-blur-xl bg-gradient-to-br from-blue-500/5 via-transparent to-transparent rounded-none border border-blue-500/20 p-12 text-center">
                                        <div className="w-16 h-16 mx-auto mb-5 bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-full flex items-center justify-center border border-blue-500/30">
                                            <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                        <h4 className="text-xl font-semibold text-blue-400 mb-2">{t('superadmin.all_caught_up')}</h4>
                                        <p className="text-gray-500 text-sm max-w-sm mx-auto">{t('superadmin.no_apps_review')}</p>
                                    </div>
                                ) : (
                                    <div className="grid gap-4">
                                        {pendingApps.map((app, index) => (
                                            <div
                                                key={app.id}
                                                className="backdrop-blur-xl bg-white/[0.02] rounded-none border border-white/[0.05] overflow-hidden hover:border-blue-500/30 transition-all duration-300 group"
                                                style={{ animationDelay: `${index * 50}ms` }}
                                            >
                                                <div className="p-6">
                                                    <div className="flex items-start gap-5">
                                                        {/* App Logo */}
                                                        <div className="relative">
                                                            <div className="w-20 h-20 rounded-xl overflow-hidden bg-gradient-to-br from-white/[0.05] to-white/[0.02] flex-shrink-0 ring-2 ring-white/[0.05] group-hover:ring-blue-500/30 transition-all">
                                                                {app.logo_url ? (
                                                                    <img
                                                                        src={app.logo_url}
                                                                        alt={app.name}
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-600/20 to-indigo-600/20">
                                                                        <span className="text-2xl font-bold text-blue-400">{app.name?.charAt(0) || 'A'}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-blue-500 rounded-lg flex items-center justify-center">
                                                                <span className="text-xs font-bold text-white">!</span>
                                                            </div>
                                                        </div>

                                                        {/* App Info */}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-start justify-between gap-4">
                                                                <div>
                                                                    <h4 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">{app.name}</h4>
                                                                    <p className="text-sm text-gray-500 mt-1">/{app.slug}</p>
                                                                </div>
                                                            </div>

                                                            {/* Meta Info */}
                                                            <div className="flex items-center flex-wrap gap-3 mt-4">
                                                                <div className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.03] rounded-lg text-sm">
                                                                    <span className="text-gray-500">Owner:</span>
                                                                    <span className="text-gray-300">{app.owner_email || 'Unknown'}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.03] rounded-lg text-sm">
                                                                    <span className="text-gray-500">Created:</span>
                                                                    <span className="text-gray-300">
                                                                        {new Date(app.created_at).toLocaleDateString('en-US', {
                                                                            month: 'short',
                                                                            day: 'numeric',
                                                                            year: 'numeric'
                                                                        })}
                                                                    </span>
                                                                </div>
                                                                {app.app_type && (
                                                                    <span className="px-3 py-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg text-sm font-medium">
                                                                        {app.app_type}
                                                                    </span>
                                                                )}
                                                                {app.language && (
                                                                    <span className="px-3 py-1.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-lg text-sm font-medium">
                                                                        {app.language}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="flex items-center gap-2 mt-5 pt-4 border-t border-white/[0.05]">
                                                        <button
                                                            onClick={() => handleApproveApp(app.id)}
                                                            disabled={processingId === app.id}
                                                            className="relative flex-1 px-4 py-2 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] hover:border-blue-500/50 text-gray-300 hover:text-white rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            <span className="flex items-center justify-center gap-1.5">
                                                                {processingId === app.id ? (
                                                                    <>
                                                                        <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                        </svg>
                                                                        <span className="text-xs">Processing...</span>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                                        </svg>
                                                                        <span className="text-xs">Approve</span>
                                                                    </>
                                                                )}
                                                            </span>
                                                        </button>
                                                        <button
                                                            onClick={() => openAppRejectModal(app)}
                                                            disabled={processingId === app.id}
                                                            className="px-3 py-2 bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.06] hover:border-white/[0.12] text-gray-500 hover:text-gray-300 rounded-lg text-xs font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Products Review Section */}
                        {true && (
                            <div className="space-y-6">
                                {loadingProducts ? (
                                    <div className="backdrop-blur-xl bg-white/[0.02] rounded-none border border-white/[0.05] p-16 flex flex-col items-center justify-center">
                                        <div className="w-12 h-12 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                                        <p className="text-gray-400">{t('superadmin.loading_products')}</p>
                                    </div>
                                ) : pendingProducts.length === 0 ? (
                                    <div className="backdrop-blur-xl bg-gradient-to-br from-blue-500/5 via-transparent to-transparent rounded-none border border-blue-500/20 p-12 text-center">
                                        <div className="w-16 h-16 mx-auto mb-5 bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-full flex items-center justify-center border border-blue-500/30">
                                            <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                        <h4 className="text-xl font-semibold text-blue-400 mb-2">{t('superadmin.all_caught_up')}</h4>
                                        <p className="text-gray-500 text-sm max-w-sm mx-auto">{t('superadmin.no_products_review')}</p>
                                    </div>
                                ) : (
                                    <div className="grid gap-4">
                                        {pendingProducts.map((product, index) => (
                                            <div
                                                key={product.id}
                                                className="backdrop-blur-xl bg-white/[0.02] rounded-none border border-white/[0.05] overflow-hidden hover:border-blue-500/30 transition-all duration-300 group"
                                                style={{ animationDelay: `${index * 50}ms` }}
                                            >
                                                <div className="p-6">
                                                    <div className="flex items-start gap-5">
                                                        {/* Product Image */}
                                                        <div className="relative">
                                                            <div className="w-24 h-24 rounded-xl overflow-hidden bg-gradient-to-br from-white/[0.05] to-white/[0.02] flex-shrink-0 ring-2 ring-white/[0.05] group-hover:ring-blue-500/30 transition-all">
                                                                {product.image_url ? (
                                                                    <img
                                                                        src={product.image_url}
                                                                        alt={product.name}
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-600/20 to-indigo-600/20">
                                                                        <span className="text-2xl font-bold text-blue-400">{product.name?.charAt(0) || 'P'}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-blue-500 rounded-lg flex items-center justify-center">
                                                                <span className="text-xs font-bold text-white">!</span>
                                                            </div>
                                                        </div>

                                                        {/* Product Info */}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-start justify-between gap-4">
                                                                <div>
                                                                    <h4 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">{product.name}</h4>
                                                                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{product.description || 'No description provided'}</p>
                                                                </div>
                                                                <div className="text-right flex-shrink-0">
                                                                    <p className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-blue-500 bg-clip-text text-transparent">
                                                                        {product.currency || 'USD'} {product.price?.toFixed(2) || '0.00'}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            {/* Meta Info */}
                                                            <div className="flex items-center flex-wrap gap-3 mt-4">
                                                                <div className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.03] rounded-lg text-sm">
                                                                    <span className="text-gray-500">Owner:</span>
                                                                    <span className="text-gray-300">{product.owner_email || 'Unknown'}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.03] rounded-lg text-sm">
                                                                    <span className="text-gray-500">Created:</span>
                                                                    <span className="text-gray-300">
                                                                        {new Date(product.created_at).toLocaleDateString('en-US', {
                                                                            month: 'short',
                                                                            day: 'numeric',
                                                                            year: 'numeric'
                                                                        })}
                                                                    </span>
                                                                </div>
                                                                {product.category && (
                                                                    <span className="px-3 py-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg text-sm font-medium">
                                                                        {product.category}
                                                                    </span>
                                                                )}
                                                                {product.delivery_type && (
                                                                    <span className="px-3 py-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg text-sm font-medium">
                                                                        {product.delivery_type}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="flex items-center gap-2 mt-5 pt-4 border-t border-white/[0.05]">
                                                        <button
                                                            onClick={() => openProductDetailsModal(product)}
                                                            className="relative flex-1 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 hover:border-blue-500/50 text-blue-400 hover:text-blue-300 rounded-lg text-sm font-medium transition-all duration-200"
                                                        >
                                                            <span className="flex items-center justify-center gap-1.5">
                                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                                </svg>
                                                                <span className="text-xs">Review</span>
                                                            </span>
                                                        </button>
                                                        <button
                                                            onClick={() => handleApproveProduct(product.id)}
                                                            disabled={processingId === product.id}
                                                            className="px-3 py-2 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] hover:border-blue-500/50 text-gray-300 hover:text-white rounded-lg text-xs font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            {processingId === product.id ? (
                                                                <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                </svg>
                                                            ) : (
                                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                                </svg>
                                                            )}
                                                        </button>
                                                        <button
                                                            onClick={() => openProductRejectModal(product)}
                                                            disabled={processingId === product.id}
                                                            className="px-3 py-2 bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.06] hover:border-white/[0.12] text-gray-500 hover:text-gray-300 rounded-lg text-xs font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
                {/* Reject Modal */}
                {showRejectModal && selectedVerification && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="backdrop-blur-xl bg-[#0d1117]/95 rounded-none shadow-2xl w-full max-w-md border border-white/[0.05]">
                            <div className="p-6 border-b border-white/[0.05]">
                                <h3 className="text-lg font-semibold text-white">Reject Bank Account</h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    Rejecting: {selectedVerification.account_holder_name}'s account
                                </p>
                            </div>
                            <div className="p-6">
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Rejection Reason *
                                </label>
                                <textarea
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    placeholder="Enter the reason for rejection (will be shown to the user)"
                                    rows={4}
                                    className="w-full p-3 bg-white/[0.03] border border-white/[0.08] rounded-xl focus:ring-2 focus:ring-blue-400/50 focus:border-blue-500 text-white"
                                />
                            </div>
                            <div className="p-6 border-t border-white/[0.05] flex gap-3 justify-end">
                                <button
                                    onClick={() => {
                                        setShowRejectModal(false)
                                        setSelectedVerification(null)
                                        setRejectionReason('')
                                    }}
                                    className="px-4 py-2 text-gray-300 bg-white/[0.05] hover:bg-white/[0.1] rounded-lg font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleRejectVerification}
                                    disabled={processingId === selectedVerification.id}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
                                >
                                    {processingId === selectedVerification.id ? (
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    ) : (
                                        'Reject Account'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Details Modal */}
                {showDetailsModal && selectedVerification && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="backdrop-blur-xl bg-[#0d1117]/95 rounded-none shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-white/[0.05]">
                            <div className="p-6 border-b border-white/[0.05] sticky top-0 backdrop-blur-xl bg-white/[0.02] z-10">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-lg font-semibold text-white">Verification Details</h3>
                                        <p className="text-sm text-gray-500 mt-1">{selectedVerification.user_email}</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setShowDetailsModal(false)
                                            setSelectedVerification(null)
                                        }}
                                        className="text-gray-400 hover:text-white text-xl font-light"
                                    >
                                        ×
                                    </button>
                                </div>
                            </div>
                            <div className="p-6 space-y-6">
                                {/* Account Holder */}
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">Account Holder</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs text-gray-500">Full Name</p>
                                            <p className="text-sm text-white">{selectedVerification.account_holder_name || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500">Date of Birth</p>
                                            <p className="text-sm text-white">{selectedVerification.date_of_birth || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500">Phone Number</p>
                                            <p className="text-sm text-white">{selectedVerification.phone_number || 'N/A'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Address */}
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">Address</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs text-gray-500">City</p>
                                            <p className="text-sm text-white">{selectedVerification.city || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500">State</p>
                                            <p className="text-sm text-white">{selectedVerification.state || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500">Country</p>
                                            <p className="text-sm text-white">{selectedVerification.country || 'N/A'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Bank Details */}
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">Bank Account</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs text-gray-500">Bank Name</p>
                                            <p className="text-sm text-white">{selectedVerification.bank_name || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500">Bank Country</p>
                                            <p className="text-sm text-white">{selectedVerification.bank_country || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500">Account Type</p>
                                            <p className="text-sm text-white capitalize">{selectedVerification.account_type || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500">Currency</p>
                                            <p className="text-sm text-white">{selectedVerification.currency || 'N/A'}</p>
                                        </div>
                                        {selectedVerification.account_number && (
                                            <div>
                                                <p className="text-xs text-gray-500">Account Number</p>
                                                <p className="text-sm text-white font-mono">{selectedVerification.account_number}</p>
                                            </div>
                                        )}
                                        {selectedVerification.iban && (
                                            <div>
                                                <p className="text-xs text-gray-500">IBAN</p>
                                                <p className="text-sm text-white font-mono">{selectedVerification.iban}</p>
                                            </div>
                                        )}
                                        {selectedVerification.bic_swift && (
                                            <div>
                                                <p className="text-xs text-gray-500">BIC/SWIFT</p>
                                                <p className="text-sm text-white font-mono">{selectedVerification.bic_swift}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Documents */}
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">Uploaded Documents</h4>
                                    <div className="flex flex-wrap gap-3">
                                        {selectedVerification.id_document_url ? (
                                            <a
                                                href={selectedVerification.id_document_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-4 py-2 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-lg text-sm hover:bg-blue-500/20 transition-colors"
                                            >
                                                View ID Document ↗
                                            </a>
                                        ) : (
                                            <div className="px-4 py-2 bg-gray-500/10 text-gray-400 border border-gray-500/30 rounded-lg text-sm">
                                                ID Document Missing
                                            </div>
                                        )}
                                        {selectedVerification.address_proof_url ? (
                                            <a
                                                href={selectedVerification.address_proof_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-4 py-2 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-lg text-sm hover:bg-blue-500/20 transition-colors"
                                            >
                                                View Address Proof ↗
                                            </a>
                                        ) : (
                                            <div className="px-4 py-2 bg-gray-500/10 text-gray-400 border border-gray-500/30 rounded-lg text-sm">
                                                Address Proof Not Provided
                                            </div>
                                        )}
                                        {selectedVerification.bank_statement_url ? (
                                            <a
                                                href={selectedVerification.bank_statement_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-4 py-2 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-lg text-sm hover:bg-blue-500/20 transition-colors"
                                            >
                                                View Bank Statement ↗
                                            </a>
                                        ) : (
                                            <div className="px-4 py-2 bg-gray-500/10 text-gray-400 border border-gray-500/30 rounded-lg text-sm">
                                                Bank Statement Not Provided
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 border-t border-white/[0.05] flex gap-3 justify-end sticky bottom-0 backdrop-blur-xl bg-white/[0.02]">
                                <button
                                    onClick={() => {
                                        setShowDetailsModal(false)
                                        openRejectModal(selectedVerification)
                                    }}
                                    className="px-4 py-2 bg-blue-800 hover:bg-blue-900 text-white rounded-lg font-medium transition-colors"
                                >
                                    Reject
                                </button>
                                <button
                                    onClick={() => {
                                        handleApproveVerification(selectedVerification.id)
                                        setShowDetailsModal(false)
                                    }}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                                >
                                    Approve Account
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Product Details Modal */}
                {showProductDetailsModal && selectedProduct && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
                        <div className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col rounded-none shadow-2xl">
                            {/* Background gradient effect */}
                            <div className="absolute inset-0 bg-[#0a0f1a] rounded-none" />
                            <div className="absolute top-0 left-0 right-0 h-48 bg-gradient-to-br from-blue-600/20 via-indigo-600/10 to-transparent" />

                            {/* Header */}
                            <div className="relative p-6 border-b border-white/[0.05] flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                                        <div className="w-5 h-5 bg-white/20 rounded-lg"></div>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white">Product Review</h3>
                                        <p className="text-sm text-gray-400">Analyze content before approval</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setShowProductDetailsModal(false)
                                        setSelectedProduct(null)
                                        setProductDetails(null)
                                    }}
                                    className="w-10 h-10 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.05] flex items-center justify-center text-gray-400 hover:text-white transition-all duration-200"
                                >
                                    ×
                                </button>
                            </div>

                            {/* Content */}
                            <div className="relative p-6 overflow-y-auto flex-1">
                                {loadingProductDetails ? (
                                    <div className="flex flex-col items-center justify-center py-16">
                                        <div className="w-12 h-12 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                                        <p className="text-gray-400">Loading product details...</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Product Hero Card */}
                                        <div className="bg-gradient-to-br from-white/[0.05] to-white/[0.02] rounded-none p-6 border border-white/[0.08] mb-6">
                                            <div className="flex gap-6">
                                                <div className="relative flex-shrink-0">
                                                    <div className="w-36 h-36 rounded-none overflow-hidden ring-4 ring-white/[0.08] shadow-2xl">
                                                        {selectedProduct.image_url ? (
                                                            <img
                                                                src={selectedProduct.image_url}
                                                                alt={selectedProduct.name}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-600/30 to-indigo-600/30">
                                                                <span className="text-4xl font-bold text-blue-400">{selectedProduct.name?.charAt(0) || 'P'}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="absolute -bottom-2 -right-2 px-3 py-1.5 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg text-xs font-bold text-white shadow-lg">
                                                        PENDING
                                                    </div>
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="text-2xl font-bold text-white mb-2">{selectedProduct.name}</h4>
                                                    <div className="flex items-center gap-4 mb-4">
                                                        <span className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-blue-500 bg-clip-text text-transparent">
                                                            {selectedProduct.currency || 'USD'} {selectedProduct.price?.toFixed(2) || '0.00'}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {selectedProduct.category && (
                                                            <span className="px-3 py-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg text-sm font-medium">
                                                                {selectedProduct.category}
                                                            </span>
                                                        )}
                                                        {selectedProduct.delivery_type && (
                                                            <span className="px-3 py-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg text-sm font-medium">
                                                                {selectedProduct.delivery_type}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Stats Cards */}
                                        {productDetails?.stats && (
                                            <div className="grid grid-cols-3 gap-4 mb-6">
                                                <div className="relative overflow-hidden p-5 bg-gradient-to-br from-blue-600/10 via-blue-500/5 to-transparent rounded-none border border-blue-500/20 group hover:border-blue-500/40 transition-all">
                                                    <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full blur-2xl" />
                                                    <p className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-blue-500 bg-clip-text text-transparent">{productDetails.stats.totalModules}</p>
                                                    <p className="text-sm text-gray-400 font-medium mt-1">Modules</p>
                                                </div>
                                                <div className="relative overflow-hidden p-5 bg-gradient-to-br from-blue-600/10 via-blue-500/5 to-transparent rounded-none border border-blue-500/20 group hover:border-blue-500/40 transition-all">
                                                    <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full blur-2xl" />
                                                    <p className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-blue-500 bg-clip-text text-transparent">{productDetails.stats.totalLessons}</p>
                                                    <p className="text-sm text-gray-400 font-medium mt-1">Lessons</p>
                                                </div>
                                                <div className="relative overflow-hidden p-5 bg-gradient-to-br from-blue-600/10 via-blue-500/5 to-transparent rounded-none border border-blue-500/20 group hover:border-blue-500/40 transition-all">
                                                    <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full blur-2xl" />
                                                    <p className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-blue-500 bg-clip-text text-transparent">{productDetails.stats.totalMembers}</p>
                                                    <p className="text-sm text-gray-400 font-medium mt-1">Members</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Info Grid */}
                                        <div className="grid grid-cols-2 gap-4 mb-6">
                                            <div className="p-4 bg-white/[0.02] rounded-xl border border-white/[0.05]">
                                                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Owner</p>
                                                <p className="text-sm text-white font-medium">{productDetails?.product?.owner_email || selectedProduct.owner_email || 'Unknown'}</p>
                                            </div>
                                            <div className="p-4 bg-white/[0.02] rounded-xl border border-white/[0.05]">
                                                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Submitted</p>
                                                <p className="text-sm text-white font-medium">
                                                    {new Date(selectedProduct.created_at).toLocaleString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Description */}
                                        <div className="mb-6">
                                            <h5 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Description</h5>
                                            <div className="p-4 bg-white/[0.02] rounded-xl border border-white/[0.05]">
                                                <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">
                                                    {selectedProduct.description || 'No description provided'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Course Content */}
                                        {productDetails?.modules && productDetails.modules.length > 0 && (
                                            <div className="mb-6">
                                                <h5 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Course Content</h5>
                                                <div className="space-y-3">
                                                    {productDetails.modules.map((module: any, moduleIndex: number) => (
                                                        <div key={module.id} className="bg-gradient-to-br from-white/[0.03] to-transparent rounded-xl border border-white/[0.05] overflow-hidden">
                                                            {/* Module Header */}
                                                            <div className="p-4 bg-gradient-to-r from-blue-600/5 to-transparent border-b border-white/[0.05]">
                                                                <div className="flex items-center gap-3">
                                                                    <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-sm font-bold shadow-lg shadow-blue-500/20">
                                                                        {moduleIndex + 1}
                                                                    </span>
                                                                    <div className="flex-1">
                                                                        <h6 className="font-bold text-white">{module.title}</h6>
                                                                        {module.description && (
                                                                            <p className="text-xs text-gray-500 mt-0.5">{module.description}</p>
                                                                        )}
                                                                    </div>
                                                                    <span className="px-3 py-1 bg-white/[0.05] text-gray-400 rounded-lg text-xs font-medium">
                                                                        {module.lessons?.length || 0} lessons
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {/* Lessons */}
                                                            {module.lessons && module.lessons.length > 0 && (
                                                                <div className="divide-y divide-white/[0.03]">
                                                                    {module.lessons.map((lesson: any, lessonIndex: number) => (
                                                                        <div key={lesson.id} className="p-4 pl-16 hover:bg-white/[0.02] transition-colors">
                                                                            <div className="flex items-start gap-3">
                                                                                <span className="w-7 h-7 rounded-lg bg-white/[0.05] text-gray-500 flex items-center justify-center text-xs font-medium">
                                                                                    {lessonIndex + 1}
                                                                                </span>
                                                                                <div className="flex-1 min-w-0">
                                                                                    <p className="text-sm text-white font-medium">{lesson.title}</p>
                                                                                    <div className="flex items-center gap-2 mt-2">
                                                                                        <span className="text-xs px-2.5 py-1 rounded-lg bg-white/[0.05] text-gray-400 capitalize font-medium">
                                                                                            {lesson.type || 'video'}
                                                                                        </span>
                                                                                        {lesson.video_url && (
                                                                                            <a
                                                                                                href={lesson.video_url}
                                                                                                target="_blank"
                                                                                                rel="noopener noreferrer"
                                                                                                className="text-xs px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors font-medium"
                                                                                            >
                                                                                                Watch Video ↗
                                                                                            </a>
                                                                                        )}
                                                                                        {lesson.pdf_url && (
                                                                                            <a
                                                                                                href={lesson.pdf_url}
                                                                                                target="_blank"
                                                                                                rel="noopener noreferrer"
                                                                                                className="text-xs px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors font-medium"
                                                                                            >
                                                                                                View PDF ↗
                                                                                            </a>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {(!module.lessons || module.lessons.length === 0) && (
                                                                <div className="p-4 text-center text-gray-500 text-sm">
                                                                    No lessons in this module
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {productDetails?.modules && productDetails.modules.length === 0 && (
                                            <div className="mb-6 p-10 bg-gradient-to-br from-white/[0.02] to-transparent rounded-none border border-white/[0.05] text-center">
                                                <div className="w-16 h-16 mx-auto mb-4 bg-white/[0.03] rounded-none flex items-center justify-center">
                                                    <span className="text-3xl">📝</span>
                                                </div>
                                                <p className="text-gray-400 font-medium">No course content found</p>
                                                <p className="text-xs text-gray-500 mt-1">This product doesn't have any modules or lessons yet</p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Actions Footer */}
                            <div className="relative p-6 border-t border-white/[0.05] bg-gradient-to-t from-[#0a0f1a] to-transparent">
                                <div className="flex items-center justify-between">
                                    <button
                                        onClick={() => {
                                            setShowProductDetailsModal(false)
                                            setSelectedProduct(null)
                                            setProductDetails(null)
                                        }}
                                        className="px-5 py-3 text-gray-400 hover:text-white transition-colors font-medium"
                                    >
                                        Cancel
                                    </button>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => {
                                                setShowProductDetailsModal(false)
                                                openProductRejectModal(selectedProduct)
                                            }}
                                            className="px-6 py-3 bg-white/[0.05] hover:bg-blue-500/20 border border-white/[0.1] hover:border-blue-500/30 text-gray-300 hover:text-blue-400 rounded-xl font-semibold transition-all duration-300"
                                        >
                                            Reject Product
                                        </button>
                                        <button
                                            onClick={() => {
                                                handleApproveProduct(selectedProduct.id)
                                                setShowProductDetailsModal(false)
                                            }}
                                            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white rounded-xl font-semibold transition-all duration-300 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
                                        >
                                            Approve Product
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ════════════════ FINANCIAL TAB ════════════════ */}
                {activeTab === 'financial' && (
                    <div className="space-y-5">
                        {loadingFinancial ? (
                            <div className="flex items-center justify-center py-24">
                                <div className="w-10 h-10 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                            </div>
                        ) : !financialData ? (
                            <div className="backdrop-blur-xl bg-white/[0.02] rounded-none border border-white/[0.05] p-12 text-center">
                                <p className="text-gray-500 text-sm mb-4">Clique para carregar os dados financeiros da plataforma.</p>
                                <button onClick={fetchFinancial} className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white rounded-xl font-semibold text-sm transition-all">Carregar dados</button>
                            </div>
                        ) : (
                            <>
                                {/* KPI Row */}
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {[
                                        {
                                            label: 'GMV Total',
                                            sublabel: 'Volume bruto de vendas',
                                            value: financialData.gmv.toLocaleString('pt-BR', { style: 'currency', currency: 'USD' }),
                                            color: 'text-emerald-400',
                                            bg: 'from-emerald-500/10',
                                            border: 'border-emerald-500/20 hover:border-emerald-500/40',
                                            dot: 'bg-emerald-500',
                                        },
                                        {
                                            label: `Receita da plataforma`,
                                            sublabel: `Taxa de ${financialData.fee_percent}% sobre GMV`,
                                            value: financialData.platform_revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'USD' }),
                                            color: 'text-blue-400',
                                            bg: 'from-blue-500/10',
                                            border: 'border-blue-500/20 hover:border-blue-500/40',
                                            dot: 'bg-blue-500',
                                        },
                                        {
                                            label: 'Novos owners (30 dias)',
                                            sublabel: 'Cadastros recentes',
                                            value: financialData.new_users_30d.toLocaleString('pt-BR'),
                                            color: 'text-indigo-400',
                                            bg: 'from-indigo-500/10',
                                            border: 'border-indigo-500/20 hover:border-indigo-500/40',
                                            dot: 'bg-indigo-500',
                                        },
                                    ].map((kpi) => (
                                        <div key={kpi.label} className={`backdrop-blur-xl bg-gradient-to-br ${kpi.bg} to-transparent bg-white/[0.02] p-5 rounded-none border ${kpi.border} transition-all duration-200 group`}>
                                            <div className="flex items-start justify-between mb-1">
                                                <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                                                <span className={`w-2 h-2 rounded-full ${kpi.dot} mt-2 opacity-70`} />
                                            </div>
                                            <p className="text-xs text-white/80 font-medium">{kpi.label}</p>
                                            <p className="text-xs text-gray-600 mt-0.5">{kpi.sublabel}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* GMV Mensal */}
                                {Object.keys(financialData.monthly_gmv).length > 0 && (
                                    <div className="backdrop-blur-xl bg-white/[0.02] rounded-none p-6 border border-white/[0.05]">
                                        <div className="flex items-center justify-between mb-5">
                                            <div>
                                                <h3 className="text-base font-semibold text-white">GMV por mês</h3>
                                                <p className="text-xs text-gray-500 mt-0.5">Volume bruto de vendas — últimos meses</p>
                                            </div>
                                            <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
                                                {Number((Object.values(financialData.monthly_gmv) as any[]).reduce((a, b) => a + Number(b), 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'USD' })}
                                            </span>
                                        </div>
                                        <div className="h-44 flex items-end justify-between gap-2">
                                            {Object.entries(financialData.monthly_gmv).slice(-8).map(([month, gmv]: [string, any], i, arr) => {
                                                const max = Math.max(...arr.map(([, v]) => Number(v)), 1)
                                                const h = (Number(gmv) / max) * 100
                                                const isLast = i === arr.length - 1
                                                const monthName = new Date(month + '-01').toLocaleDateString('pt-BR', { month: 'short' })
                                                return (
                                                    <div key={month} className="flex-1 flex flex-col items-center gap-1.5 group/bar">
                                                        <span className="text-xs text-gray-600 group-hover/bar:text-white transition-colors">${Number(gmv).toFixed(0)}</span>
                                                        <div className="relative w-full rounded-t-lg overflow-hidden bg-white/[0.03]" style={{ height: '120px' }}>
                                                            <div
                                                                className={`absolute bottom-0 w-full rounded-t-lg transition-all duration-700 ${isLast ? 'bg-gradient-to-t from-emerald-600 to-emerald-400' : 'bg-gradient-to-t from-emerald-700/60 to-emerald-500/40 group-hover/bar:from-emerald-600 group-hover/bar:to-emerald-400'}`}
                                                                style={{ height: `${h}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-xs text-gray-600 capitalize">{monthName}</span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Top Sellers */}
                                {financialData.top_sellers?.length > 0 && (
                                    <div className="backdrop-blur-xl bg-white/[0.02] rounded-none border border-white/[0.05] overflow-hidden">
                                        <div className="px-6 py-4 border-b border-white/[0.05] flex items-center justify-between">
                                            <div>
                                                <h3 className="text-base font-semibold text-white">Top Sellers</h3>
                                                <p className="text-xs text-gray-500 mt-0.5">Owners que mais geram volume na plataforma</p>
                                            </div>
                                        </div>
                                        <div className="divide-y divide-white/[0.03]">
                                            {financialData.top_sellers.map((seller: any, idx: number) => {
                                                const medals = ['🥇', '🥈', '🥉']
                                                const maxApps = financialData.top_sellers[0]?.app_count || 1
                                                return (
                                                    <div key={seller.user_id} className="px-6 py-3.5 flex items-center gap-4 hover:bg-white/[0.02] transition-colors">
                                                        <span className="text-base w-6 text-center">{medals[idx] || `${idx + 1}`}</span>
                                                        <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-violet-600 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
                                                            {seller.email.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-white truncate">{seller.email}</p>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <div className="flex-1 h-1 bg-white/[0.05] rounded-full overflow-hidden">
                                                                    <div
                                                                        className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full"
                                                                        style={{ width: `${Math.round((seller.app_count / maxApps) * 100)}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                            <p className="text-sm font-bold text-blue-400">{seller.app_count}</p>
                                                            <p className="text-xs text-gray-600">apps</p>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* ════════════════ PAYMENTS TAB ════════════════ */}
                {false && (
                    <div className="space-y-6">

                        {/* ── 1. PROVEDOR GLOBAL PADRÃO ── */}
                        <div className="backdrop-blur-xl bg-white/[0.02] rounded-none border border-white/[0.05] p-6">
                            <div className="flex items-start justify-between mb-5">
                                <div>
                                    <h3 className="text-lg font-semibold text-white">Provedor Global Padrão</h3>
                                    <p className="text-sm text-gray-500 mt-1">Usado por todos os usuários sem override individual</p>
                                </div>
                                {providers.find(p => p.is_global_default) && (() => {
                                })()}
                            </div>
                            {loadingProviders ? (
                                <div className="flex gap-2">{[1, 2, 3].map(i => <div key={i} className="flex-1 h-12 bg-white/[0.03] rounded-xl animate-pulse" />)}</div>
                            ) : providers.filter(p => p.is_active).length === 0 ? (
                                <p className="text-sm text-gray-600 text-center py-4">Cadastre provedores na seção abaixo para selecionar o padrão global.</p>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {providers.filter(p => p.is_active).map(p => {
                                        const c = PROVIDER_COLORS[p.type]
                                        const isDefault = p.is_global_default
                                        return (
                                            <button
                                                key={p.id}
                                                onClick={() => handleSetGlobalDefault(p.id)}
                                                className={`px-5 py-3 rounded-xl font-semibold text-sm transition-all border ${isDefault ? `${c.bg} ${c.text} ${c.border}` : 'bg-white/[0.03] text-gray-400 border-white/[0.08] hover:bg-white/[0.06]'}`}
                                            >
                                                {PROVIDER_ICONS[p.type]} {p.name}
                                                {isDefault && <span className="ml-2 text-xs opacity-70">★ Padrão</span>}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* ── 2. PROVEDORES CADASTRADOS ── */}
                        <div className="backdrop-blur-xl bg-white/[0.02] rounded-none border border-white/[0.05] overflow-hidden">
                            <div className="px-6 py-4 border-b border-white/[0.05] flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-semibold text-white">Provedores Cadastrados</h3>
                                    <p className="text-sm text-gray-500 mt-0.5">Credenciais armazenadas no banco — {providers.length} provedor(es)</p>
                                </div>
                                <button
                                    onClick={() => { setShowAddProviderForm(v => !v); setEditingProviderId(null) }}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 rounded-xl text-sm font-semibold transition-all"
                                >
                                    {showAddProviderForm ? '✕ Cancelar' : '+ Novo Provedor'}
                                </button>
                            </div>

                            {/* Formulário: Novo Provedor */}
                            {showAddProviderForm && (
                                <div className="px-6 py-5 border-b border-blue-500/10 bg-blue-500/[0.02] space-y-4">
                                    <p className="text-xs font-semibold text-blue-400">+ Cadastrar novo provedor</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1.5 font-medium">Nome de exibição</label>
                                            <input
                                                type="text"
                                                placeholder=""
                                                value={newProviderForm.name}
                                                onChange={e => setNewProviderForm(f => ({ ...f, name: e.target.value }))}
                                                className="w-full px-3 py-2 bg-[#0d1117] border border-white/[0.08] rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1.5 font-medium">Tipo</label>
                                            <select
                                                value={newProviderForm.type}
                                                onChange={e => setNewProviderForm(f => ({ ...f, type: e.target.value, credentials: {} }))}
                                                className="w-full px-3 py-2 bg-[#0d1117] border border-white/[0.08] rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                            >
                                                <option value="stripe">Stripe</option>
                                                <option value="mollie">Mollie</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        {(CREDENTIAL_FIELDS[newProviderForm.type] || []).map(field => (
                                            <div key={field.key}>
                                                <label className="block text-xs text-gray-500 mb-1.5 font-medium">{field.label}</label>
                                                <input
                                                    type="password"
                                                    placeholder={field.placeholder}
                                                    value={(newProviderForm.credentials as any)[field.key] || ''}
                                                    onChange={e => setNewProviderForm(f => ({ ...f, credentials: { ...f.credentials, [field.key]: e.target.value } }))}
                                                    className="w-full px-3 py-2 bg-[#0d1117] border border-white/[0.08] rounded-lg text-white text-sm placeholder-gray-600 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        onClick={handleCreateProvider}
                                        disabled={savingProvider || !newProviderForm.name}
                                        className="px-5 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-all"
                                    >
                                        {savingProvider ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" /> : 'Cadastrar Provedor'}
                                    </button>
                                </div>
                            )}

                            {/* Lista de provedores */}
                            {loadingProviders ? (
                                <div className="p-12 flex justify-center">
                                    <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                                </div>
                            ) : providers.length === 0 ? (
                                <div className="p-12 text-center">
                                    <p className="text-gray-500 text-sm">Nenhum provedor cadastrado.</p>
                                    <p className="text-gray-600 text-xs mt-1">Use o botão "+ Novo Provedor" para adicionar.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-white/[0.03]">
                                    {providers.map(provider => {
                                        const c = PROVIDER_COLORS[provider.type]
                                        const isEditing = editingProviderId === provider.id
                                        return (
                                            <div key={provider.id} className={isEditing ? 'bg-white/[0.015]' : ''}>
                                                <div className="px-6 py-4 flex items-center gap-4">
                                                    <div className={`w-10 h-10 ${c.bg} rounded-xl flex items-center justify-center text-xl`}>
                                                        {PROVIDER_ICONS[provider.type]}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <p className="text-sm font-semibold text-white">{provider.name}</p>
                                                            <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${c.bg} ${c.text} ${c.border}`}>{provider.type}</span>
                                                            <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${provider.is_active ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-gray-500/15 text-gray-400 border-gray-500/20'}`}>
                                                                {provider.is_active ? '● Ativo' : '○ Inativo'}
                                                            </span>
                                                            {provider.is_global_default && (
                                                                <span className="px-2 py-0.5 rounded text-xs font-semibold border bg-blue-500/15 text-blue-300 border-blue-500/30">★ Padrão global</span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-gray-600 mt-0.5">Criado em {new Date(provider.created_at).toLocaleDateString('pt-BR')}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => handleToggleProviderActive(provider.id, provider.is_active)}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${provider.is_active ? 'bg-gray-500/10 text-gray-400 border-gray-500/20 hover:bg-gray-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'}`}
                                                        >
                                                            {provider.is_active ? 'Desativar' : 'Ativar'}
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                if (isEditing) { setEditingProviderId(null); return }
                                                                setEditingProviderId(provider.id)
                                                                setEditingProviderName(provider.name)
                                                                setEditingProviderCreds({})
                                                                setShowAddProviderForm(false)
                                                            }}
                                                            className={`px-3 py-1.5 rounded-lg text-xs transition-colors border ${isEditing ? `${c.bg} ${c.text} ${c.border}` : 'bg-white/[0.05] hover:bg-white/[0.1] text-gray-400 hover:text-white border-white/[0.08]'}`}
                                                        >
                                                            {isEditing ? '✎ Editando' : 'Editar chaves'}
                                                        </button>
                                                        {!provider.is_global_default && (
                                                            <button
                                                                onClick={() => handleDeleteProvider(provider.id)}
                                                                className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs transition-colors border border-red-500/20"
                                                            >
                                                                Remover
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Formulário inline de edição */}
                                                {isEditing && (
                                                    <div className="px-6 pb-5 space-y-4 border-t border-white/[0.05]">
                                                        <div className="pt-4 grid grid-cols-2 gap-3">
                                                            <div className="col-span-2 md:col-span-1">
                                                                <label className="block text-xs text-gray-500 mb-1.5 font-medium">Nome de exibição</label>
                                                                <input
                                                                    type="text"
                                                                    value={editingProviderName}
                                                                    onChange={e => setEditingProviderName(e.target.value)}
                                                                    className="w-full px-3 py-2 bg-[#0d1117] border border-white/[0.08] rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                                                />
                                                            </div>
                                                            {(CREDENTIAL_FIELDS[provider.type] || []).map(field => (
                                                                <div key={field.key}>
                                                                    <label className="block text-xs text-gray-500 mb-1.5 font-medium">{field.label} <span className="text-gray-700">(deixe em branco para manter)</span></label>
                                                                    <div className="flex gap-2">
                                                                        <input
                                                                            type={showApiKey[`edit-${provider.id}-${field.key}`] ? 'text' : 'password'}
                                                                            placeholder={field.placeholder}
                                                                            value={editingProviderCreds[field.key] || ''}
                                                                            onChange={e => setEditingProviderCreds(prev => ({ ...prev, [field.key]: e.target.value }))}
                                                                            className="flex-1 px-3 py-2 bg-[#0d1117] border border-white/[0.08] rounded-lg text-white text-sm font-mono placeholder-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                                                        />
                                                                        <button
                                                                            onClick={() => setShowApiKey(prev => ({ ...prev, [`edit-${provider.id}-${field.key}`]: !prev[`edit-${provider.id}-${field.key}`] }))}
                                                                            className="px-3 py-2 bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 rounded-lg text-xs border border-white/[0.08]"
                                                                        >
                                                                            {showApiKey[`edit-${provider.id}-${field.key}`] ? 'Ocultar' : 'Mostrar'}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button onClick={() => setEditingProviderId(null)} className="px-4 py-2 bg-white/[0.05] hover:bg-white/[0.1] text-gray-400 rounded-lg text-sm transition-colors border border-white/[0.08]">Cancelar</button>
                                                            <button
                                                                onClick={() => handleSaveProviderEdit(provider.id)}
                                                                disabled={savingProvider}
                                                                className="px-5 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-all"
                                                            >
                                                                {savingProvider ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" /> : 'Salvar'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* ── 3. OVERRIDES POR USUÁRIO ── */}
                        <div className="backdrop-blur-xl bg-white/[0.02] rounded-none border border-white/[0.05] overflow-hidden">
                            <div className="px-6 py-4 border-b border-white/[0.05] flex items-center justify-between gap-4">
                                <div>
                                    <h3 className="text-lg font-semibold text-white">Overrides por Usuário</h3>
                                    <p className="text-sm text-gray-500 mt-0.5">Atribua um provedor específico a qualquer owner</p>
                                </div>
                                <button onClick={fetchPaymentConfigs} className="px-4 py-2 bg-white/[0.05] hover:bg-white/[0.1] text-gray-300 rounded-xl text-sm border border-white/[0.08] transition-colors">
                                    Atualizar
                                </button>
                            </div>

                            {/* Busca por email */}
                            <div className="px-6 py-4 border-b border-white/[0.04] flex items-center gap-3">
                                <div className="relative flex-1 max-w-sm">
                                    <input
                                        type="text"
                                        placeholder="Buscar owner por email..."
                                        value={providerUserSearch}
                                        onChange={e => setProviderUserSearch(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleSearchProviderUser()}
                                        className="w-full pl-8 pr-3 py-2 bg-[#0d1117] border border-white/[0.08] rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                    />
                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600 text-sm">🔍</span>
                                </div>
                                <button
                                    onClick={handleSearchProviderUser}
                                    disabled={searchingProviderUser}
                                    className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                                >
                                    {searchingProviderUser ? <div className="w-4 h-4 border-2 border-blue-300/30 border-t-blue-300 rounded-full animate-spin" /> : 'Buscar'}
                                </button>
                            </div>

                            {/* Resultado da busca */}
                            {providerSearchResults !== null && (
                                <div className="border-b border-white/[0.04]">
                                    {providerSearchResults!.length === 0 ? (
                                        <div className="px-6 py-4 bg-red-500/[0.02]">
                                            <p className="text-sm text-red-400">Nenhum usuário encontrado para "{providerUserSearch}"</p>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Lista de usuários encontrados (quando > 1) */}
                                            {providerSearchResults!.length > 1 && !providerUserResult && (
                                                <div className="px-6 py-3 bg-white/[0.01]">
                                                    <p className="text-xs text-gray-500 mb-2">{providerSearchResults!.length} usuários encontrados — clique para selecionar:</p>
                                                    <div className="flex flex-col gap-1">
                                                        {providerSearchResults!.map(u => (
                                                            <button
                                                                key={u.id}
                                                                onClick={() => handleSelectProviderUser(u)}
                                                                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] text-left transition-colors"
                                                            >
                                                                <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-violet-600 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0">
                                                                    {u.email?.charAt(0)?.toUpperCase()}
                                                                </div>
                                                                <span className="text-sm text-white">{u.email}</span>
                                                                {u.config?.provider_id && (
                                                                    <span className="ml-auto text-xs text-blue-400 border border-blue-500/30 rounded px-1.5 py-0.5">
                                                                        {providers.find(p => p.id === u.config.provider_id)?.name || 'override'}
                                                                    </span>
                                                                )}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Usuário selecionado + atribuição de provedor */}
                                            {providerUserResult?.user && (
                                                <div className="px-6 py-4 bg-blue-500/[0.02]">
                                                    <div className="flex items-center gap-3">
                                                        {providerSearchResults!.length > 1 && (
                                                            <button onClick={() => setProviderUserResult(null)} className="text-gray-500 hover:text-white text-xs mr-1 transition-colors">← voltar</button>
                                                        )}
                                                        <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-violet-600 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0">
                                                            {providerUserResult!.user.email?.charAt(0)?.toUpperCase()}
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="text-sm font-semibold text-white">{providerUserResult!.user.email}</p>
                                                            <p className="text-xs text-gray-500">
                                                                {providerUserResult!.config?.provider_id
                                                                    ? `Override ativo → ${providers.find(p => p.id === providerUserResult!.config.provider_id)?.name || 'Provedor desconhecido'}`
                                                                    : 'Sem override · usa provedor padrão global'}
                                                            </p>
                                                        </div>
                                                        <select
                                                            value={selectedProviderForUser}
                                                            onChange={e => setSelectedProviderForUser(e.target.value)}
                                                            className="px-3 py-2 bg-[#0d1117] border border-white/[0.08] rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                                        >
                                                            <option value="">↔ Padrão global</option>
                                                            {providers.filter(p => p.is_active).map(p => (
                                                                <option key={p.id} value={p.id}>{PROVIDER_ICONS[p.type]} {p.name}</option>
                                                            ))}
                                                        </select>
                                                        <button
                                                            onClick={handleAssignProviderToUser}
                                                            disabled={assigningProvider}
                                                            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-all"
                                                        >
                                                            {assigningProvider ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" /> : 'Atribuir'}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Lista de overrides existentes */}
                            {loadingPaymentConfigs ? (
                                <div className="p-12 flex justify-center">
                                    <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                                </div>
                            ) : paymentConfigs.length === 0 ? (
                                <div className="p-10 text-center">
                                    <p className="text-gray-500 text-sm">Nenhum override configurado ainda.</p>
                                    <p className="text-gray-600 text-xs mt-1">Busque um usuário acima para atribuir um provedor específico.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-white/[0.03]">
                                    {paymentConfigs.map((cfg) => {
                                        const assignedProvider = providers.find(p => p.id === cfg.provider_id)
                                        const c = assignedProvider ? PROVIDER_COLORS[assignedProvider.type] : PROVIDER_COLORS.stripe
                                        return (
                                            <div key={cfg.id} className="px-6 py-4 flex items-center gap-4">
                                                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                                                    {cfg.user_email?.charAt(0)?.toUpperCase() || '?'}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium text-white">{cfg.user_email}</p>
                                                    <p className="text-xs text-gray-500">{cfg.user_id}</p>
                                                </div>
                                                {assignedProvider ? (
                                                    <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${c.bg} ${c.text} ${c.border}`}>
                                                        {PROVIDER_ICONS[assignedProvider.type]} {assignedProvider.name}
                                                    </span>
                                                ) : (
                                                    <span className="px-2.5 py-1 rounded-lg text-xs font-semibold border bg-gray-500/15 text-gray-400 border-gray-500/20">
                                                        {cfg.payment_provider || 'Padrão global'}
                                                    </span>
                                                )}
                                                <span className="px-2.5 py-1 rounded-lg text-xs font-semibold border bg-emerald-500/15 text-emerald-300 border-emerald-500/30">● ativo</span>
                                                <button
                                                    onClick={() => {
                                                        setEditingPaymentUser(cfg.user_id)
                                                        setPaymentConfigForm({
                                                            payment_provider: cfg.payment_provider || 'stripe',
                                                            mollie_api_key: cfg.mollie_api_key || '',
                                                            stripe_connect_account: cfg.stripe_connect_account || '',
                                                            override_platform_default: cfg.override_platform_default ?? true,
                                                            notes: cfg.notes || ''
                                                        })
                                                    }}
                                                    className="px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.1] text-gray-400 hover:text-white rounded-lg text-xs transition-colors border border-white/[0.08]"
                                                >
                                                    Editar
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ════════════════ CONFIG TAB ════════════════ */}
                {activeTab === 'config' && (
                    <div className="space-y-6">
                        {loadingPlatformConfig ? (
                            <div className="flex justify-center py-24"><div className="w-10 h-10 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>
                        ) : (
                            <>
                                {/* Configurações numéricas */}
                                <div className="backdrop-blur-xl bg-white/[0.02] rounded-none border border-white/[0.05]">
                                    <div className="p-6 border-b border-white/[0.05]">
                                        <h3 className="text-lg font-semibold text-white">Configurações da Plataforma</h3>
                                        <p className="text-sm text-gray-500 mt-1">Valores aplicados globalmente para todos os usuários</p>
                                    </div>
                                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {[
                                            { key: 'platform_fee_percentage', label: 'Taxa da plataforma (%)', desc: 'Percentual cobrado sobre cada transação', suffix: '%' },
                                            { key: 'max_free_apps', label: 'Máx. apps no plano Free', desc: 'Limite de apps para usuários gratuitos', suffix: 'apps' },
                                            { key: 'min_withdrawal_amount', label: 'Saque mínimo', desc: 'Valor mínimo em USD para solicitar saque', suffix: 'USD' },
                                            { key: 'withdrawal_hold_days', label: 'Prazo de retenção (D+N)', desc: 'Dias antes de liberar saldo para saque', suffix: 'dias' },
                                            { key: 'affiliate_max_commission', label: 'Comissão máx. afiliados (%)', desc: 'Percentual máximo permitido para afiliados', suffix: '%' },
                                        ].map(({ key, label, desc, suffix }) => (
                                            <div key={key} className="p-4 bg-white/[0.02] rounded-xl border border-white/[0.05]">
                                                <div className="flex items-start justify-between mb-3">
                                                    <div>
                                                        <p className="text-sm font-medium text-white">{label}</p>
                                                        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                                                    </div>
                                                    <span className="text-xs text-gray-600 bg-white/[0.03] px-2 py-0.5 rounded">{suffix}</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="number"
                                                        value={platformConfigEdits[key] ?? ''}
                                                        onChange={e => setPlatformConfigEdits(ed => ({ ...ed, [key]: e.target.value }))}
                                                        className="flex-1 px-3 py-2 bg-[#0d1117] border border-white/[0.08] rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                                    />
                                                    <button
                                                        onClick={() => saveSinglePlatformConfig(key)}
                                                        disabled={savingPlatformConfig === key}
                                                        className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-all"
                                                    >
                                                        {savingPlatformConfig === key ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Salvar'}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}

                                        {/* Modo manutenção */}
                                        <div className="p-4 bg-white/[0.02] rounded-xl border border-white/[0.05]">
                                            <div className="flex items-start justify-between mb-3">
                                                <div>
                                                    <p className="text-sm font-medium text-white">Modo Manutenção</p>
                                                    <p className="text-xs text-gray-500 mt-0.5">Exibe página de manutenção para usuários comuns</p>
                                                </div>
                                                <span className={`text-xs px-2 py-0.5 rounded font-semibold ${platformConfigEdits['maintenance_mode'] === 'true' || platformConfigEdits['maintenance_mode'] === true ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                                    {platformConfigEdits['maintenance_mode'] === 'true' || platformConfigEdits['maintenance_mode'] === true ? 'Ativo' : 'Desativado'}
                                                </span>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => { setPlatformConfigEdits(ed => ({ ...ed, maintenance_mode: 'false' })); setTimeout(() => saveSinglePlatformConfig('maintenance_mode'), 0) }}
                                                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${(platformConfigEdits['maintenance_mode'] === 'false' || platformConfigEdits['maintenance_mode'] === false) ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-white/[0.03] text-gray-500 border-white/[0.08] hover:bg-white/[0.06]'}`}
                                                >
                                                    ✓ Online
                                                </button>
                                                <button
                                                    onClick={() => { if (!confirm('Colocar plataforma em manutenção? Todos os usuários serão afetados.')) return; setPlatformConfigEdits(ed => ({ ...ed, maintenance_mode: 'true' })); setTimeout(() => saveSinglePlatformConfig('maintenance_mode'), 0) }}
                                                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${(platformConfigEdits['maintenance_mode'] === 'true' || platformConfigEdits['maintenance_mode'] === true) ? 'bg-red-500/20 text-red-300 border-red-500/30' : 'bg-white/[0.03] text-gray-500 border-white/[0.08] hover:bg-white/[0.06]'}`}
                                                >
                                                    ⚠ Manutenção
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Feature flags */}
                                {platformConfigEdits['feature_flags'] && typeof platformConfigEdits['feature_flags'] === 'object' && (
                                    <div className="backdrop-blur-xl bg-white/[0.02] rounded-none border border-white/[0.05]">
                                        <div className="p-6 border-b border-white/[0.05]">
                                            <h3 className="text-lg font-semibold text-white">Feature Flags</h3>
                                            <p className="text-sm text-gray-500 mt-1">Ligue e desligue funcionalidades sem deploy</p>
                                        </div>
                                        <div className="p-6 grid grid-cols-2 md:grid-cols-3 gap-3">
                                            {Object.entries(platformConfigEdits['feature_flags'] as Record<string, boolean>).map(([flag, enabled]) => (
                                                <button
                                                    key={flag}
                                                    onClick={() => {
                                                        const updated = { ...platformConfigEdits['feature_flags'] as Record<string, boolean>, [flag]: !enabled }
                                                        setPlatformConfigEdits(ed => ({ ...ed, feature_flags: updated }))
                                                        setTimeout(() => saveSinglePlatformConfig('feature_flags'), 0)
                                                    }}
                                                    className={`p-4 rounded-xl text-left border transition-all ${enabled ? 'bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/50' : 'bg-white/[0.02] border-white/[0.08] hover:bg-white/[0.04]'}`}
                                                >
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={`w-2 h-2 rounded-full ${enabled ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                                                        <span className={`text-xs font-semibold ${enabled ? 'text-emerald-300' : 'text-gray-500'}`}>
                                                            {enabled ? 'Ativo' : 'Inativo'}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm font-medium text-white capitalize">{flag.replace(/_/g, ' ')}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                            </>
                        )}

                        {/* ── PROVEDOR GLOBAL PADRÃO ── */}
                        <div className="backdrop-blur-xl bg-white/[0.02] rounded-none border border-white/[0.05] p-6">
                            <div className="flex items-start justify-between mb-5">
                                <div>
                                    <h3 className="text-lg font-semibold text-white">Provedor Global Padrão</h3>
                                    <p className="text-sm text-gray-500 mt-1">Usado por todos os usuários sem override individual</p>
                                </div>
                                {providers.find(p => p.is_global_default) && (() => {
                                    const p = providers.find(p => p.is_global_default)!
                                    const c = PROVIDER_COLORS[p.type]
                                    return (
                                        <span className={`px-3 py-1.5 rounded-xl text-xs font-semibold border ${c.bg} ${c.text} ${c.border}`}>
                                            {PROVIDER_ICONS[p.type]} {p.name}
                                        </span>
                                    )
                                })()}
                            </div>
                            {loadingProviders ? (
                                <div className="flex gap-2">{[1, 2, 3].map(i => <div key={i} className="flex-1 h-12 bg-white/[0.03] rounded-xl animate-pulse" />)}</div>
                            ) : providers.filter(p => p.is_active).length === 0 ? (
                                <p className="text-sm text-gray-600 text-center py-4">Cadastre provedores na seção abaixo para selecionar o padrão global.</p>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {providers.filter(p => p.is_active).map(p => {
                                        const c = PROVIDER_COLORS[p.type]
                                        const isDefault = p.is_global_default
                                        return (
                                            <button
                                                key={p.id}
                                                onClick={() => handleSetGlobalDefault(p.id)}
                                                className={`px-5 py-3 rounded-xl font-semibold text-sm transition-all border ${isDefault ? `${c.bg} ${c.text} ${c.border}` : 'bg-white/[0.03] text-gray-400 border-white/[0.08] hover:bg-white/[0.06]'}`}
                                            >
                                                {PROVIDER_ICONS[p.type]} {p.name}
                                                {isDefault && <span className="ml-2 text-xs opacity-70">★ Padrão</span>}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* ── PROVEDORES CADASTRADOS ── */}
                        <div className="backdrop-blur-xl bg-white/[0.02] rounded-none border border-white/[0.05] overflow-hidden">
                            <div className="px-6 py-4 border-b border-white/[0.05] flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-semibold text-white">Provedores Cadastrados</h3>
                                    <p className="text-sm text-gray-500 mt-0.5">Credenciais armazenadas no banco — {providers.length} provedor(es)</p>
                                </div>
                                <button
                                    onClick={() => { setShowAddProviderForm(v => !v); setEditingProviderId(null) }}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 rounded-xl text-sm font-semibold transition-all"
                                >
                                    {showAddProviderForm ? '✕ Cancelar' : '+ Novo Provedor'}
                                </button>
                            </div>
                            {showAddProviderForm && (
                                <div className="px-6 py-5 border-b border-blue-500/10 bg-blue-500/[0.02] space-y-4">
                                    <p className="text-xs font-semibold text-blue-400">+ Cadastrar novo provedor</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1.5 font-medium">Nome de exibição</label>
                                            <input type="text" placeholder="" value={newProviderForm.name} onChange={e => setNewProviderForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 bg-[#0d1117] border border-white/[0.08] rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1.5 font-medium">Tipo</label>
                                            <select value={newProviderForm.type} onChange={e => setNewProviderForm(f => ({ ...f, type: e.target.value, credentials: {} }))} className="w-full px-3 py-2 bg-[#0d1117] border border-white/[0.08] rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
                                                <option value="stripe">Stripe</option>
                                                <option value="mollie">Mollie</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        {(CREDENTIAL_FIELDS[newProviderForm.type] || []).map(field => (
                                            <div key={field.key}>
                                                <label className="block text-xs text-gray-500 mb-1.5 font-medium">{field.label}</label>
                                                <input type="password" placeholder={field.placeholder} value={(newProviderForm.credentials as any)[field.key] || ''} onChange={e => setNewProviderForm(f => ({ ...f, credentials: { ...f.credentials, [field.key]: e.target.value } }))} className="w-full px-3 py-2 bg-[#0d1117] border border-white/[0.08] rounded-lg text-white text-sm placeholder-gray-600 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
                                            </div>
                                        ))}
                                    </div>
                                    <button onClick={handleCreateProvider} disabled={savingProvider || !newProviderForm.name} className="px-5 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-all">
                                        {savingProvider ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" /> : 'Cadastrar Provedor'}
                                    </button>
                                </div>
                            )}
                            {loadingProviders ? (
                                <div className="p-12 flex justify-center"><div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>
                            ) : providers.length === 0 ? (
                                <div className="p-12 text-center">
                                    <p className="text-gray-500 text-sm">Nenhum provedor cadastrado.</p>
                                    <p className="text-gray-600 text-xs mt-1">Use o botão "+ Novo Provedor" para adicionar.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-white/[0.03]">
                                    {providers.map(provider => {
                                        const c = PROVIDER_COLORS[provider.type]
                                        const isEditing = editingProviderId === provider.id
                                        return (
                                            <div key={provider.id} className={isEditing ? 'bg-white/[0.015]' : ''}>
                                                <div className="px-6 py-4 flex items-center gap-4">
                                                    <div className={`w-10 h-10 ${c.bg} rounded-xl flex items-center justify-center text-xl`}>{PROVIDER_ICONS[provider.type]}</div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <p className="text-sm font-semibold text-white">{provider.name}</p>
                                                            <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${c.bg} ${c.text} ${c.border}`}>{provider.type}</span>
                                                            <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${provider.is_active ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-gray-500/15 text-gray-400 border-gray-500/20'}`}>{provider.is_active ? '● Ativo' : '○ Inativo'}</span>
                                                            {provider.is_global_default && (<span className="px-2 py-0.5 rounded text-xs font-semibold border bg-blue-500/15 text-blue-300 border-blue-500/30">★ Padrão global</span>)}
                                                        </div>
                                                        <p className="text-xs text-gray-600 mt-0.5">Criado em {new Date(provider.created_at).toLocaleDateString('pt-BR')}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button onClick={() => handleToggleProviderActive(provider.id, provider.is_active)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${provider.is_active ? 'bg-gray-500/10 text-gray-400 border-gray-500/20 hover:bg-gray-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'}`}>{provider.is_active ? 'Desativar' : 'Ativar'}</button>
                                                        <button onClick={() => { if (isEditing) { setEditingProviderId(null); return } setEditingProviderId(provider.id); setEditingProviderName(provider.name); setEditingProviderCreds({}); setShowAddProviderForm(false) }} className={`px-3 py-1.5 rounded-lg text-xs transition-colors border ${isEditing ? `${c.bg} ${c.text} ${c.border}` : 'bg-white/[0.05] hover:bg-white/[0.1] text-gray-400 hover:text-white border-white/[0.08]'}`}>{isEditing ? '✎ Editando' : 'Editar chaves'}</button>
                                                        {!provider.is_global_default && (<button onClick={() => handleDeleteProvider(provider.id)} className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs transition-colors border border-red-500/20">Remover</button>)}
                                                    </div>
                                                </div>
                                                {isEditing && (
                                                    <div className="px-6 pb-5 space-y-4 border-t border-white/[0.05]">
                                                        <div className="pt-4 grid grid-cols-2 gap-3">
                                                            <div className="col-span-2 md:col-span-1">
                                                                <label className="block text-xs text-gray-500 mb-1.5 font-medium">Nome de exibição</label>
                                                                <input type="text" value={editingProviderName} onChange={e => setEditingProviderName(e.target.value)} className="w-full px-3 py-2 bg-[#0d1117] border border-white/[0.08] rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
                                                            </div>
                                                            {(CREDENTIAL_FIELDS[provider.type] || []).map(field => (
                                                                <div key={field.key}>
                                                                    <label className="block text-xs text-gray-500 mb-1.5 font-medium">{field.label} <span className="text-gray-700">(deixe em branco para manter)</span></label>
                                                                    <div className="flex gap-2">
                                                                        <input type={showApiKey[`edit-${provider.id}-${field.key}`] ? 'text' : 'password'} placeholder={field.placeholder} value={editingProviderCreds[field.key] || ''} onChange={e => setEditingProviderCreds(prev => ({ ...prev, [field.key]: e.target.value }))} className="flex-1 px-3 py-2 bg-[#0d1117] border border-white/[0.08] rounded-lg text-white text-sm font-mono placeholder-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
                                                                        <button onClick={() => setShowApiKey(prev => ({ ...prev, [`edit-${provider.id}-${field.key}`]: !prev[`edit-${provider.id}-${field.key}`] }))} className="px-3 py-2 bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 rounded-lg text-xs border border-white/[0.08]">{showApiKey[`edit-${provider.id}-${field.key}`] ? 'Ocultar' : 'Mostrar'}</button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button onClick={() => setEditingProviderId(null)} className="px-4 py-2 bg-white/[0.05] hover:bg-white/[0.1] text-gray-400 rounded-lg text-sm transition-colors border border-white/[0.08]">Cancelar</button>
                                                            <button onClick={() => handleSaveProviderEdit(provider.id)} disabled={savingProvider} className="px-5 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-all">{savingProvider ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" /> : 'Salvar'}</button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* ── OVERRIDES POR USUÁRIO ── */}
                        <div className="backdrop-blur-xl bg-white/[0.02] rounded-none border border-white/[0.05] overflow-hidden">
                            <div className="px-6 py-4 border-b border-white/[0.05] flex items-center justify-between gap-4">
                                <div>
                                    <h3 className="text-lg font-semibold text-white">Overrides por Usuário</h3>
                                    <p className="text-sm text-gray-500 mt-0.5">Atribua um provedor específico a qualquer owner</p>
                                </div>
                                <button onClick={fetchPaymentConfigs} className="px-4 py-2 bg-white/[0.05] hover:bg-white/[0.1] text-gray-300 rounded-xl text-sm border border-white/[0.08] transition-colors">Atualizar</button>
                            </div>
                            <div className="px-6 py-4 border-b border-white/[0.04] flex items-center gap-3">
                                <div className="relative flex-1 max-w-sm">
                                    <input type="text" placeholder="Buscar owner por email..." value={providerUserSearch} onChange={e => setProviderUserSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearchProviderUser()} className="w-full pl-8 pr-3 py-2 bg-[#0d1117] border border-white/[0.08] rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600 text-sm">🔍</span>
                                </div>
                                <button onClick={handleSearchProviderUser} disabled={searchingProviderUser} className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 rounded-xl text-sm font-semibold transition-all disabled:opacity-50">
                                    {searchingProviderUser ? <div className="w-4 h-4 border-2 border-blue-300/30 border-t-blue-300 rounded-full animate-spin" /> : 'Buscar'}
                                </button>
                            </div>
                            {providerUserResult && (
                                <div className={`px-6 py-4 border-b ${providerUserResult!.user ? 'border-blue-500/10 bg-blue-500/[0.02]' : 'border-red-500/10 bg-red-500/[0.02]'}`}>
                                    {!providerUserResult!.user ? (
                                        <p className="text-sm text-red-400">Usuário não encontrado para "{providerUserSearch}"</p>
                                    ) : (
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-violet-600 rounded-full flex items-center justify-center text-xs font-bold text-white">{providerUserResult!.user.email?.charAt(0)?.toUpperCase()}</div>
                                            <div className="flex-1">
                                                <p className="text-sm font-semibold text-white">{providerUserResult!.user.email}</p>
                                                <p className="text-xs text-gray-500">{providerUserResult!.config?.provider_id ? `Override ativo → ${providers.find(p => p.id === providerUserResult!.config.provider_id)?.name || 'Provedor desconhecido'}` : 'Sem override · usa provedor padrão global'}</p>
                                            </div>
                                            <select value={selectedProviderForUser} onChange={e => setSelectedProviderForUser(e.target.value)} className="px-3 py-2 bg-[#0d1117] border border-white/[0.08] rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
                                                <option value="">↔ Padrão global</option>
                                                {providers.filter(p => p.is_active).map(p => (<option key={p.id} value={p.id}>{PROVIDER_ICONS[p.type]} {p.name}</option>))}
                                            </select>
                                            <button onClick={handleAssignProviderToUser} disabled={assigningProvider} className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-all">
                                                {assigningProvider ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" /> : 'Atribuir'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                            {loadingPaymentConfigs ? (
                                <div className="p-12 flex justify-center"><div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>
                            ) : paymentConfigs.length === 0 ? (
                                <div className="p-10 text-center">
                                    <p className="text-gray-500 text-sm">Nenhum override configurado ainda.</p>
                                    <p className="text-gray-600 text-xs mt-1">Busque um usuário acima para atribuir um provedor específico.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-white/[0.03]">
                                    {paymentConfigs.map((cfg) => {
                                        const assignedProvider = providers.find(p => p.id === cfg.provider_id)
                                        const c = assignedProvider ? PROVIDER_COLORS[assignedProvider.type] : PROVIDER_COLORS.stripe
                                        return (
                                            <div key={cfg.id} className="px-6 py-4 flex items-center gap-4">
                                                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">{cfg.user_email?.charAt(0)?.toUpperCase() || '?'}</div>
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium text-white">{cfg.user_email}</p>
                                                    <p className="text-xs text-gray-500">{cfg.user_id}</p>
                                                </div>
                                                {assignedProvider ? (
                                                    <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${c.bg} ${c.text} ${c.border}`}>{PROVIDER_ICONS[assignedProvider.type]} {assignedProvider.name}</span>
                                                ) : (
                                                    <span className="px-2.5 py-1 rounded-lg text-xs font-semibold border bg-gray-500/15 text-gray-400 border-gray-500/20">{cfg.payment_provider || 'Padrão global'}</span>
                                                )}
                                                <span className="px-2.5 py-1 rounded-lg text-xs font-semibold border bg-emerald-500/15 text-emerald-300 border-emerald-500/30">● ativo</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ════════════════ ANNOUNCEMENTS TAB ════════════════ */}
                {activeTab === 'announcements' && (
                    <div className="space-y-6">
                        {/* Criar comunicado */}
                        <div className="backdrop-blur-xl bg-white/[0.02] rounded-none border border-white/[0.05]">
                            <div className="p-6 border-b border-white/[0.05]">
                                <h3 className="text-lg font-semibold text-white">Novo Comunicado</h3>
                                <p className="text-sm text-gray-500 mt-1">Aparece no dashboard de todos os usuários selecionados</p>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1.5">Título</label>
                                    <input
                                        type="text"
                                        value={newAnnouncement.title}
                                        onChange={e => setNewAnnouncement(n => ({ ...n, title: e.target.value }))}
                                        placeholder="Ex: Nova funcionalidade disponível!"
                                        className="w-full px-4 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1.5">Conteúdo</label>
                                    <textarea
                                        value={newAnnouncement.content}
                                        onChange={e => setNewAnnouncement(n => ({ ...n, content: e.target.value }))}
                                        placeholder="Descreva o comunicado em detalhes..."
                                        rows={3}
                                        className="w-full px-4 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-sm resize-none"
                                    />
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1.5">Tipo</label>
                                        <select
                                            value={newAnnouncement.type}
                                            onChange={e => setNewAnnouncement(n => ({ ...n, type: e.target.value }))}
                                            className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                        >
                                            <option value="info">ℹ️ Info</option>
                                            <option value="success">✅ Sucesso</option>
                                            <option value="warning">⚠️ Aviso</option>
                                            <option value="error">🚨 Urgente</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1.5">Público</label>
                                        <select
                                            value={newAnnouncement.target_plan}
                                            onChange={e => setNewAnnouncement(n => ({ ...n, target_plan: e.target.value }))}
                                            className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                        >
                                            <option value="all">Todos</option>
                                            <option value="free">Free</option>
                                            <option value="pro">Pro</option>
                                            <option value="advanced">Advanced</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1.5">Expira em (opcional)</label>
                                        <input
                                            type="datetime-local"
                                            value={newAnnouncement.expires_at}
                                            onChange={e => setNewAnnouncement(n => ({ ...n, expires_at: e.target.value }))}
                                            className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                        />
                                    </div>
                                </div>
                                <button
                                    onClick={handleCreateAnnouncement}
                                    disabled={savingAnnouncement || !newAnnouncement.title.trim() || !newAnnouncement.content.trim()}
                                    className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-sm transition-all"
                                >
                                    {savingAnnouncement ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" /> : 'Publicar Comunicado'}
                                </button>
                            </div>
                        </div>

                        {/* Lista de comunicados */}
                        <div className="backdrop-blur-xl bg-white/[0.02] rounded-none border border-white/[0.05]">
                            <div className="p-6 border-b border-white/[0.05] flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-white">Comunicados Ativos</h3>
                                <button onClick={fetchAnnouncements} className="px-4 py-2 bg-white/[0.05] hover:bg-white/[0.1] text-gray-300 rounded-xl text-sm border border-white/[0.08] transition-colors">
                                    Atualizar
                                </button>
                            </div>
                            {loadingAnnouncements ? (
                                <div className="p-12 flex justify-center"><div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>
                            ) : announcements.length === 0 ? (
                                <div className="p-12 text-center"><p className="text-gray-500 text-sm">Nenhum comunicado ativo.</p></div>
                            ) : (
                                <div className="divide-y divide-white/[0.03]">
                                    {announcements.map((ann) => {
                                        const typeStyles: Record<string, string> = {
                                            info: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
                                            success: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
                                            warning: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
                                            error: 'bg-red-500/10 text-red-300 border-red-500/20'
                                        }
                                        const typeIcon: Record<string, string> = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '🚨' }
                                        return (
                                            <div key={ann.id} className="p-5 flex items-start gap-4">
                                                <div className={`flex-shrink-0 px-2.5 py-1 rounded-lg border text-xs font-semibold ${typeStyles[ann.type] || typeStyles.info}`}>
                                                    {typeIcon[ann.type] || 'ℹ️'} {ann.type}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-white">{ann.title}</p>
                                                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{ann.content}</p>
                                                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-600">
                                                        <span>Público: <span className="text-gray-400">{ann.target_plan}</span></span>
                                                        <span>{new Date(ann.created_at).toLocaleDateString('pt-BR')}</span>
                                                        {ann.expires_at && <span>Expira: <span className="text-amber-500">{new Date(ann.expires_at).toLocaleDateString('pt-BR')}</span></span>}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteAnnouncement(ann.id)}
                                                    disabled={deletingAnnouncementId === ann.id}
                                                    className="flex-shrink-0 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-medium transition-colors border border-red-500/20"
                                                >
                                                    {deletingAnnouncementId === ann.id ? '...' : 'Remover'}
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ════════════════ AUDIT LOG TAB ════════════════ */}
                {activeTab === 'audit' && (
                    <div className="space-y-4">
                        <div className="backdrop-blur-xl bg-white/[0.02] rounded-none border border-white/[0.05]">
                            <div className="px-6 py-4 border-b border-white/[0.05] flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <h3 className="text-base font-semibold text-white">Audit Log</h3>
                                    <p className="text-xs text-gray-500 mt-0.5">{auditTotal} ações registradas — todas as operações administrativas</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <select
                                        value={auditActionFilter}
                                        onChange={e => { setAuditActionFilter(e.target.value); setTimeout(() => fetchAuditLog(1), 0) }}
                                        className="px-3 py-2 bg-[#0d1117] border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                    >
                                        <option value="">Todas as ações</option>
                                        <option value="ban_user">Banir usuário</option>
                                        <option value="unban_user">Desbanir usuário</option>
                                        <option value="delete_user">Deletar usuário</option>
                                        <option value="change_payment_provider">Alterar provedor (legado)</option>
                                        <option value="create_payment_provider">Criar provedor</option>
                                        <option value="update_payment_provider">Atualizar provedor</option>
                                        <option value="delete_payment_provider">Deletar provedor</option>
                                        <option value="update_platform_config">Config. plataforma</option>
                                        <option value="create_announcement">Criar comunicado</option>
                                        <option value="delete_announcement">Deletar comunicado</option>
                                        <option value="approve_bank_verification">Aprovar verificação</option>
                                        <option value="reject_bank_verification">Rejeitar verificação</option>
                                    </select>
                                    <button onClick={() => fetchAuditLog(1)} className="px-4 py-2 bg-white/[0.05] hover:bg-white/[0.1] text-gray-300 rounded-xl text-sm border border-white/[0.08] transition-colors">
                                        Atualizar
                                    </button>
                                </div>
                            </div>

                            {loadingAuditLog ? (
                                <div className="p-12 flex justify-center"><div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>
                            ) : auditLog.length === 0 ? (
                                <div className="p-12 text-center">
                                    <p className="text-gray-500 text-sm">Nenhuma ação registrada ainda.</p>
                                    <p className="text-gray-600 text-xs mt-1">As ações administrativas aparecerão aqui.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-white/[0.03]">
                                    {auditLog.map((log) => {
                                        const ACTION_META: Record<string, { label: string; color: string; dot: string }> = {
                                            ban_user: { label: 'Banir usuário', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30', dot: 'bg-amber-400' },
                                            unban_user: { label: 'Desbanir usuário', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', dot: 'bg-emerald-400' },
                                            delete_user: { label: 'Deletar usuário', color: 'bg-red-500/20 text-red-300 border-red-500/30', dot: 'bg-red-400' },
                                            change_payment_provider: { label: 'Provedor (legado)', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30', dot: 'bg-purple-400' },
                                            create_payment_provider: { label: 'Criar provedor', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30', dot: 'bg-blue-400' },
                                            update_payment_provider: { label: 'Atualizar provedor', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30', dot: 'bg-indigo-400' },
                                            delete_payment_provider: { label: 'Deletar provedor', color: 'bg-red-500/20 text-red-300 border-red-500/30', dot: 'bg-red-400' },
                                            update_platform_config: { label: 'Config. plataforma', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30', dot: 'bg-cyan-400' },
                                            create_announcement: { label: 'Criar comunicado', color: 'bg-violet-500/20 text-violet-300 border-violet-500/30', dot: 'bg-violet-400' },
                                            delete_announcement: { label: 'Deletar comunicado', color: 'bg-gray-500/20 text-gray-300 border-gray-500/30', dot: 'bg-gray-400' },
                                            approve_bank_verification: { label: 'Aprovar verificação', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', dot: 'bg-emerald-400' },
                                            reject_bank_verification: { label: 'Rejeitar verificação', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30', dot: 'bg-orange-400' },
                                        }
                                        const meta = ACTION_META[log.action] || { label: log.action, color: 'bg-white/[0.05] text-gray-400 border-white/[0.1]', dot: 'bg-gray-500' }
                                        const detailStr = JSON.stringify(log.details || {})
                                        const timeAgo = (() => {
                                            const diff = Date.now() - new Date(log.created_at).getTime()
                                            const m = Math.floor(diff / 60000)
                                            if (m < 1) return 'agora'
                                            if (m < 60) return `${m}min atrás`
                                            const h = Math.floor(m / 60)
                                            if (h < 24) return `${h}h atrás`
                                            return new Date(log.created_at).toLocaleDateString('pt-BR')
                                        })()
                                        return (
                                            <div key={log.id} className="px-6 py-4 flex items-start gap-4 hover:bg-white/[0.02] transition-colors group">
                                                {/* Timeline dot */}
                                                <div className="flex flex-col items-center shrink-0 mt-1">
                                                    <div className={`w-2.5 h-2.5 rounded-full ${meta.dot}`} />
                                                </div>
                                                {/* Admin avatar */}
                                                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-violet-600 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
                                                    {log.admin_email?.charAt(0)?.toUpperCase() || 'A'}
                                                </div>
                                                {/* Content */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                                        <span className="text-sm font-medium text-white">{log.admin_email?.split('@')[0] || '—'}</span>
                                                        <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${meta.color}`}>{meta.label}</span>
                                                        {log.target_type && (
                                                            <span className="text-xs text-gray-600 bg-white/[0.03] px-2 py-0.5 rounded border border-white/[0.05]">
                                                                {log.target_type} · <span className="font-mono">{log.target_id?.slice(0, 8)}…</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                    {detailStr !== '{}' && (
                                                        <p className="text-xs text-gray-500 font-mono truncate max-w-md">
                                                            {detailStr.slice(0, 80)}{detailStr.length > 80 ? '…' : ''}
                                                        </p>
                                                    )}
                                                </div>
                                                {/* Time */}
                                                <div className="text-right shrink-0">
                                                    <p className="text-xs text-gray-500">{timeAgo}</p>
                                                    <p className="text-xs text-gray-700">{new Date(log.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}

                            {/* Pagination */}
                            {auditTotal > 50 && (
                                <div className="px-6 py-4 border-t border-white/[0.05] flex items-center justify-between">
                                    <p className="text-xs text-gray-500">Página {auditPage} de {Math.ceil(auditTotal / 50)} · {auditTotal} registros</p>
                                    <div className="flex gap-2">
                                        <button disabled={auditPage === 1} onClick={() => fetchAuditLog(auditPage - 1)} className="px-4 py-2 bg-white/[0.05] hover:bg-white/[0.1] disabled:opacity-40 text-gray-300 rounded-lg text-sm border border-white/[0.08] transition-colors">← Anterior</button>
                                        <button disabled={auditPage * 50 >= auditTotal} onClick={() => fetchAuditLog(auditPage + 1)} className="px-4 py-2 bg-white/[0.05] hover:bg-white/[0.1] disabled:opacity-40 text-gray-300 rounded-lg text-sm border border-white/[0.08] transition-colors">Próxima →</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* App Reject Modal */}
                {showAppRejectModal && selectedApp && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
                        <div className="relative w-full max-w-lg rounded-none shadow-2xl overflow-hidden">
                            {/* Background */}
                            <div className="absolute inset-0 bg-[#0a0f1a]" />
                            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-blue-600/20 via-blue-500/10 to-transparent" />

                            {/* Header */}
                            <div className="relative p-6 border-b border-white/[0.05]">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                                        <span className="text-white text-xl">✕</span>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white">Reject App</h3>
                                        <p className="text-sm text-gray-400">{selectedApp.name}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="relative p-6">
                                <label className="block text-sm font-semibold text-gray-300 mb-3">
                                    Rejection Reason
                                </label>
                                <textarea
                                    value={appRejectionReason}
                                    onChange={(e) => setAppRejectionReason(e.target.value)}
                                    placeholder="Explain why this app is being rejected..."
                                    rows={4}
                                    className="w-full p-4 bg-white/[0.03] border border-white/[0.08] rounded-xl focus:ring-2 focus:ring-blue-400/50 focus:border-blue-500/50 text-white placeholder-gray-500 transition-all resize-none"
                                />
                                <p className="text-xs text-gray-500 mt-2">This message will be sent to the app owner</p>
                            </div>

                            {/* Footer */}
                            <div className="relative p-6 border-t border-white/[0.05] flex gap-3 justify-end">
                                <button
                                    onClick={() => {
                                        setShowAppRejectModal(false)
                                        setSelectedApp(null)
                                        setAppRejectionReason('')
                                    }}
                                    className="px-5 py-3 text-gray-400 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] rounded-xl font-medium transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleRejectApp()}
                                    disabled={!appRejectionReason.trim() || processingId === selectedApp.id}
                                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-all duration-300 shadow-lg shadow-blue-500/25"
                                >
                                    {processingId === selectedApp.id ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        'Confirm Rejection'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Product Reject Modal */}
                {showProductRejectModal && selectedProduct && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
                        <div className="relative w-full max-w-lg rounded-none shadow-2xl overflow-hidden">
                            {/* Background */}
                            <div className="absolute inset-0 bg-[#0a0f1a]" />
                            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-blue-600/20 via-blue-500/10 to-transparent" />

                            {/* Header */}
                            <div className="relative p-6 border-b border-white/[0.05]">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                                        <span className="text-white text-xl">✕</span>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white">Reject Product</h3>
                                        <p className="text-sm text-gray-400">{selectedProduct.name}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="relative p-6">
                                <label className="block text-sm font-semibold text-gray-300 mb-3">
                                    Rejection Reason
                                </label>
                                <textarea
                                    value={productRejectionReason}
                                    onChange={(e) => setProductRejectionReason(e.target.value)}
                                    placeholder="Explain why this product is being rejected..."
                                    rows={4}
                                    className="w-full p-4 bg-white/[0.03] border border-white/[0.08] rounded-xl focus:ring-2 focus:ring-blue-400/50 focus:border-blue-500/50 text-white placeholder-gray-500 transition-all resize-none"
                                />
                                <p className="text-xs text-gray-500 mt-2">This message will be sent to the product owner</p>
                            </div>

                            {/* Footer */}
                            <div className="relative p-6 border-t border-white/[0.05] flex gap-3 justify-end">
                                <button
                                    onClick={() => {
                                        setShowProductRejectModal(false)
                                        setSelectedProduct(null)
                                        setProductRejectionReason('')
                                    }}
                                    className="px-5 py-3 text-gray-400 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] rounded-xl font-medium transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleRejectProduct()}
                                    disabled={!productRejectionReason.trim() || processingId === selectedProduct.id}
                                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-all duration-300 shadow-lg shadow-blue-500/25"
                                >
                                    {processingId === selectedProduct.id ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        'Confirm Rejection'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    )
}