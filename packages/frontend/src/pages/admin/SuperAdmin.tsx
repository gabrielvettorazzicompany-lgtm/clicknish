import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/i18n'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import { FinanceiroTab } from './FinanceiroTab'

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
    review_notes?: string
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
    review_notes?: string
    created_at: string
    owner_id?: string
    owner_email?: string
}

interface PaymentProvider {
    id: string
    name: string
    type: 'stripe' | 'stripe_connect' | 'mollie' | 'paypal' | 'custom'
    credentials?: Record<string, string>
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
    const [totalUsers, setTotalUsers] = useState(0)
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
    const [allProducts, setAllProducts] = useState<PendingProduct[]>([])
    const [loadingAllProducts, setLoadingAllProducts] = useState(false)
    const [productStatusFilter, setProductStatusFilter] = useState<'all' | 'pending_review' | 'approved' | 'rejected'>('all')

    // App Reviews states
    const [pendingApps, setPendingApps] = useState<PendingApp[]>([])
    const [loadingApps, setLoadingApps] = useState(false)
    const [selectedApp, setSelectedApp] = useState<PendingApp | null>(null)
    const [showAppRejectModal, setShowAppRejectModal] = useState(false)
    const [appRejectionReason, setAppRejectionReason] = useState('')
    const [showAppDetailsModal, setShowAppDetailsModal] = useState(false)
    const [appDetailsData, setAppDetailsData] = useState<any>(null)
    const [loadingAppDetails, setLoadingAppDetails] = useState(false)
    const [selectedAppForDetails, setSelectedAppForDetails] = useState<PendingApp | null>(null)
    const [allApps, setAllApps] = useState<PendingApp[]>([])
    const [loadingAllApps, setLoadingAllApps] = useState(false)
    const [appStatusFilter, setAppStatusFilter] = useState<'all' | 'pending_review' | 'approved' | 'rejected'>('all')

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
    // Mollie methods
    const [mollieAvailableMethods, setMollieAvailableMethods] = useState<Array<{ id: string; description: string; image?: { svg: string } }>>([])
    const [mollieEnabledMethods, setMollieEnabledMethods] = useState<string[]>([])
    const [loadingMollieMethods, setLoadingMollieMethods] = useState(false)
    const [mollieMethodsProviderId, setMollieMethodsProviderId] = useState<string | null>(null)
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

    // ...existing code...

    // ─── API Keys visibility ────────────────────────────────────────────────────
    const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({})

    // ─── Mobile sidebar ──────────────────────────────────────────────────────────
    const [sidebarOpen, setSidebarOpen] = useState(false)

    // ─── Reviews search ──────────────────────────────────────────────────────────
    const [appSearchQuery, setAppSearchQuery] = useState('')
    const [productSearchQuery, setProductSearchQuery] = useState('')

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
            fetchAllApps()
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
            fetchAllProducts()
            fetchAllApps()
        } else if (activeTab === 'financial' && !financialData) {
            fetchFinancial()
        } else if ((activeTab === 'payments' || activeTab === 'providers') && paymentConfigs.length === 0) {
            fetchPaymentConfigs()
        } else if (activeTab === 'config' && Object.keys(platformConfig).length === 0) {
            fetchPlatformConfig()
            fetchPaymentConfigs()
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
                setTotalUsers(data.total || data.users.length)
            } else {
                const errorData = await response.json()
                console.error('Error loading users:', errorData)
            }
        } catch (error) {
            console.error('Error loading users:', error)
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
            console.error('Error loading plans:', error)
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
                fetchAllProducts()
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
                fetchAllProducts()
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

    const fetchAllProducts = async () => {
        setLoadingAllProducts(true)
        try {
            const response = await fetch('https://api.clicknich.com/api/superadmin/all-products', {
                headers: {
                    'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`,
                    'Content-Type': 'application/json',
                    'x-user-id': user?.id || ''
                }
            })
            if (response.ok) {
                const data = await response.json()
                setAllProducts(data.products || [])
            } else {
                console.error('Error fetching all products:', response.status)
            }
        } catch (error) {
            console.error('Error fetching all products:', error)
        } finally {
            setLoadingAllProducts(false)
        }
    }

    // App Review functions
    const fetchAllApps = async () => {
        setLoadingAllApps(true)
        try {
            const response = await fetch('https://api.clicknich.com/api/superadmin/all-apps', {
                headers: {
                    'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`,
                    'Content-Type': 'application/json',
                    'x-user-id': user?.id || ''
                }
            })
            if (response.ok) {
                const data = await response.json()
                setAllApps(data.apps || [])
            } else {
                console.error('Error fetching all apps:', response.status)
            }
        } catch (error) {
            console.error('Error fetching all apps:', error)
        } finally {
            setLoadingAllApps(false)
        }
    }

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
                fetchAllApps()
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
                fetchAllApps()
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

    const fetchAppDetails = async (appId: string) => {
        setLoadingAppDetails(true)
        setAppDetailsData(null)
        try {
            const response = await fetch(`https://api.clicknich.com/api/superadmin/app-details/${appId}`, {
                headers: {
                    'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`,
                    'Content-Type': 'application/json',
                    'x-user-id': user?.id || ''
                }
            })
            if (response.ok) { const data = await response.json(); setAppDetailsData(data) }
        } catch (error) { console.error('Error fetching app details:', error) } finally { setLoadingAppDetails(false) }
    }

    const openAppDetailsModal = (app: PendingApp) => {
        setSelectedAppForDetails(app)
        setShowAppDetailsModal(true)
        fetchAppDetails(app.id)
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
        stripe: '',
        stripe_connect: '',
        mollie: '',
        paypal: '',
        custom: '',
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
            const payload: any = { name: editingProviderName }
            // Só envia credentials se alguma chave foi preenchida (evita sobrescrever com vazio)
            if (Object.keys(editingProviderCreds).length > 0) {
                payload.credentials = editingProviderCreds
            }
            // Incluir enabled_methods se estivermos editando um provedor Mollie
            if (mollieMethodsProviderId === providerId) {
                payload.enabled_methods = mollieEnabledMethods
            }
            const res = await fetch(`https://api.clicknich.com/api/superadmin/providers/${providerId}`, {
                method: 'PUT',
                headers: ADMIN_HEADERS,
                body: JSON.stringify(payload)
            })
            if (res.ok) {
                const newCreds = Object.keys(editingProviderCreds).length > 0 ? editingProviderCreds : undefined
                setProviders(prev => prev.map(p => p.id === providerId ? { ...p, name: editingProviderName, ...(newCreds ? { credentials: newCreds } : {}) } : p))
                setEditingProviderId(null)
                setMollieMethodsProviderId(null)
                setMollieAvailableMethods([])
                setMollieEnabledMethods([])
            } else {
                const err = await res.json().catch(() => ({}))
                alert(err.error || `Erro ao salvar provedor (${res.status})`)
            }
        } catch (e) { console.error(e) } finally { setSavingProvider(false) }
    }

    const handleLoadMollieMethods = async (providerId: string) => {
        setLoadingMollieMethods(true)
        setMollieMethodsProviderId(providerId)
        try {
            const res = await fetch(`https://api.clicknich.com/api/superadmin/providers/${providerId}/mollie-methods`, { headers: ADMIN_HEADERS })
            if (res.ok) {
                const d = await res.json()
                setMollieAvailableMethods(d.available || [])
                setMollieEnabledMethods(d.enabled || [])
            } else {
                const err = await res.json().catch(() => ({}))
                alert(err.error || 'Erro ao carregar métodos Mollie')
            }
        } catch (e) { console.error(e) } finally { setLoadingMollieMethods(false) }
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

    // ...existing code...

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
                    <div className="backdrop-blur-xl bg-blue-500/5 border border-blue-500/20 rounded-none p-4">
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
        {
            id: 'dashboard', label: 'Dashboard', badge: 0,
            icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10-3a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z" /></svg>,
        },
        {
            id: 'reviews', label: t('superadmin.products_tab'), badge: pendingApps.length + pendingProducts.length,
            icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
        },
        {
            id: 'users', label: t('superadmin.users'), badge: 0,
            icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
        },
        {
            id: 'verifications', label: t('superadmin.bank_verifications'), badge: bankVerifications.length,
            icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
        },
        {
            id: 'config', label: 'Config', badge: 0,
            icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
        },
        {
            id: 'financial', label: 'Financeiro', badge: 0,
            icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
        },
        // ...existing code...
        {
            id: 'providers', label: 'Provedores', badge: 0,
            icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
        },
        {
            id: 'audit', label: 'Audit Log', badge: 0,
            icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
        },
    ]

    return (
        <div className="min-h-screen bg-[#030712] flex">
            {/* ─── OVERLAY MOBILE ─────────────────────────────────────────────── */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* ─── SIDEBAR ───────────────────────────────────────────────────────── */}
            <aside className={`fixed inset-y-0 left-0 w-60 bg-[#040810] border-r border-white/[0.06] flex flex-col z-40 transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
                {/* Brand */}
                <div className="px-5 pt-5 pb-4 border-b border-white/[0.06]">
                    <div className="flex items-center gap-3">
                        <div>
                            <p className="text-white font-bold text-sm leading-none">Clicknich</p>
                            <p className="text-gray-600 text-[11px] mt-0.5">Super Admin</p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
                    {NAV_TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => { setActiveTab(tab.id); setSidebarOpen(false) }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all text-left group ${activeTab === tab.id
                                ? 'bg-gray-700/70 text-white shadow-lg'
                                : 'text-gray-500 hover:text-gray-200 hover:bg-white/[0.04]'
                                }`}
                        >
                            <span className={activeTab === tab.id ? 'text-white' : 'text-gray-600 group-hover:text-gray-400 transition-colors'}>{tab.icon}</span>
                            <span className="truncate">{tab.label}</span>
                            {tab.badge > 0 && (
                                <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded font-bold leading-none flex-shrink-0 ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-gray-700/50 text-gray-300 border border-gray-600/40'}`}>
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </nav>

                {/* System status */}
                <div className="px-4 pt-3 pb-2 border-t border-white/[0.05]">
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
                        <span className="text-xs text-gray-400 font-medium">Sistemas OK</span>
                    </div>
                    {(pendingApps.length + pendingProducts.length) > 0 && (
                        <button
                            onClick={() => setActiveTab('reviews')}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gray-800/50 border border-gray-600/30 text-xs text-gray-300 hover:bg-gray-700/50 transition-colors font-medium mt-1"
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                            {pendingApps.length + pendingProducts.length} pendentes
                        </button>
                    )}
                </div>

                {/* User + Logout */}
                <div className="px-3 pb-4 pt-2 border-t border-white/[0.05]">
                    <div className="flex items-center gap-2.5 px-2 py-2 mb-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500/40 to-violet-500/40 border border-white/[0.12] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {user?.email?.charAt(0)?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-300 truncate leading-none">{user?.email}</p>
                            <p className="text-[10px] text-gray-600 mt-0.5">Super Admin</p>
                        </div>
                    </div>
                    <button
                        onClick={async () => {
                            const { useAuthStore } = await import('@/stores/authStore')
                            const { supabase } = await import('@/services/supabase')
                            await supabase.auth.signOut()
                            useAuthStore.getState().setUser(null)
                            window.location.href = '/super-login'
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-500 hover:text-gray-300 bg-white/[0.03] hover:bg-gray-800/50 border border-white/[0.06] hover:border-gray-600/30 rounded-lg transition-all"
                    >
                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        Sair
                    </button>
                </div>
            </aside>

            {/* ─── MAIN ──────────────────────────────────────────────────────── */}
            <div className="flex-1 lg:ml-60 min-h-screen">

                {/* ─── CONTENT ──────────────────────────────────────────────────────── */}
                <div className="max-w-screen-2xl mx-auto px-6 py-6">

                    {/* ════════════════ DASHBOARD TAB ════════════════ */}
                    {activeTab === 'dashboard' && (
                        <div className="space-y-4">

                            {/* ── Row 1: 3 KPI cards ─────────────────────────────── */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                                {[
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
                                ].map(kpi => (
                                    <div key={kpi.label} className="relative bg-[#0d1829] border border-white/[0.06] p-4 overflow-hidden group hover:border-white/[0.14] transition-all duration-300">
                                        {/* Hover glow */}
                                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: `radial-gradient(ellipse at top left, ${kpi.accent}18 0%, transparent 60%)` }} />
                                        {/* left accent bar */}
                                        <div className="absolute left-0 top-0 bottom-0 w-0.5 group-hover:w-1 transition-all duration-300" style={{ background: kpi.accent }} />
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 flex items-center justify-center" style={{ color: kpi.accent }}>
                                                    {kpi.icon}
                                                </div>
                                                <span className="text-xs text-gray-500 font-medium">•••</span>
                                            </div>
                                            {kpi.pct != null && (
                                                <span className={`text-xs px-2 py-0.5 font-semibold ${kpi.up ? 'bg-gray-700/50 text-gray-300 border border-gray-600/40' : 'bg-gray-800/50 text-gray-400 border border-gray-700/40'}`}>
                                                    {kpi.pct} ↑
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xl font-bold text-white leading-none mb-0.5">{kpi.value}</p>
                                        <p className="text-[11px] text-gray-500">{kpi.label}</p>
                                        <p className="text-[10px] text-gray-700 mt-0.5">{kpi.sub}</p>
                                        {(kpi as any).link && (
                                            <button onClick={() => setActiveTab((kpi as any).link.tab)} className="text-[10px] text-blue-500 hover:text-blue-400 transition-colors mt-1">{(kpi as any).link.label}</button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* ── Row 2: Area chart + right column ───────────────── */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                                {/* Area chart — 2/3 width */}
                                <div className="lg:col-span-2 bg-[#0d1829] border border-white/[0.06] p-4">
                                    <div className="flex items-start justify-between mb-1">
                                        <div>
                                            <p className="text-xs text-gray-500 font-medium">Receita total</p>
                                            <p className="text-lg font-bold text-white mt-0.5">
                                                {financialData
                                                    ? Number((Object.values(financialData.monthly_gmv) as any[]).reduce((a, b) => a + Number(b), 0) * financialData.fee_percent / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'USD' })
                                                    : '—'}
                                                {dashRevTrend != null && (
                                                    <span className={`ml-2 text-xs font-semibold px-2 py-0.5 align-middle ${dashRevTrendUp ? 'bg-gray-700/50 text-gray-300 border border-gray-600/40' : 'bg-gray-800/50 text-gray-400 border border-gray-700/40'}`}>
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

                                    {/* Revenue Area Chart — Highcharts */}
                                    {loadingFinancial ? (
                                        <div className="h-48 flex items-center justify-center"><div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>
                                    ) : financialData && Object.keys(financialData.monthly_gmv).length > 0 ? (() => {
                                        const entries = Object.entries(financialData.monthly_gmv).slice(-12) as [string, any][]
                                        const categories = entries.map(([m]) => new Date(m + '-01').toLocaleDateString('pt-BR', { month: 'short' }))
                                        const gmvData = entries.map(([, v]) => Number(v))
                                        const revData = gmvData.map(v => v * financialData.fee_percent / 100)
                                        const hcOpts: Highcharts.Options = {
                                            chart: { type: 'area', backgroundColor: 'transparent', height: 195, margin: [5, 5, 28, 58], style: { fontFamily: 'inherit' } },
                                            title: { text: undefined }, credits: { enabled: false }, legend: { enabled: false },
                                            xAxis: { categories, labels: { style: { color: '#4b5563', fontSize: '10px' } }, lineColor: 'rgba(255,255,255,0.06)', tickColor: 'transparent' },
                                            yAxis: { title: { text: undefined }, labels: { style: { color: '#4b5563', fontSize: '10px' }, formatter() { const v = this.value as number; return '$' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v) } }, gridLineColor: 'rgba(255,255,255,0.05)' },
                                            tooltip: { backgroundColor: '#0a1628', borderColor: 'rgba(255,255,255,0.08)', borderRadius: 8, style: { color: '#e5e7eb', fontSize: '11px' }, shared: true, formatter() { let s = `<span style='font-size:11px;font-weight:600'>${this.x}</span><br/>`; this.points?.forEach(p => { s += `<span style='color:${p.color}'>● </span>${p.series.name}: <b>$${Number(p.y).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</b><br/>` }); return s } },
                                            plotOptions: { area: { fillOpacity: 1, marker: { enabled: false, states: { hover: { enabled: true, radius: 3 } } }, lineWidth: 2 } },
                                            series: [
                                                { name: 'GMV', type: 'area', data: gmvData, color: '#3b82f6', fillColor: { linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 }, stops: [[0, 'rgba(59,130,246,0.28)'], [1, 'rgba(59,130,246,0.01)']] } },
                                                { name: 'Receita', type: 'area', data: revData, color: '#22c55e', dashStyle: 'Dash', lineWidth: 1.5, fillColor: { linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 }, stops: [[0, 'rgba(34,197,94,0.12)'], [1, 'rgba(34,197,94,0.01)']] } }
                                            ]
                                        }
                                        return <div className="mt-3"><HighchartsReact highcharts={Highcharts} options={hcOpts} /></div>
                                    })() : (
                                        <div className="h-44 flex items-center justify-center">
                                            <button onClick={fetchFinancial} className="text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 px-4 py-2 border border-blue-500/20 transition-colors">Carregar dados financeiros</button>
                                        </div>
                                    )}
                                </div>

                                {/* Right column — Profit + Sessions stacked */}
                                <div className="flex flex-col gap-3">
                                    {/* Total profit (bar chart) */}
                                    <div className="flex-1 bg-[#0d1829] border border-white/[0.06] p-4">
                                        <p className="text-xs text-gray-500 font-medium">Lucro total</p>
                                        <p className="text-lg font-bold text-white mt-0.5">
                                            {financialData ? financialData.platform_revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'USD' }) : '—'}
                                            {dashRevTrend != null && (
                                                <span className={`ml-2 text-xs align-middle px-1.5 py-0.5 font-semibold ${dashRevTrendUp ? 'bg-gray-700/50 text-gray-300' : 'bg-gray-800/50 text-gray-400'}`}>
                                                    {dashRevTrendUp ? '+' : ''}{dashRevTrend}%
                                                </span>
                                            )}
                                        </p>
                                        {/* Mini bar chart — Highcharts */}
                                        <div className="mt-3">
                                            {financialData ? (() => {
                                                const entries = Object.entries(financialData.monthly_gmv).slice(-10) as [string, any][]
                                                const data = entries.map(([, v]) => Number(v))
                                                const colors = entries.map((_, i) => i === entries.length - 1 ? '#22c55e' : 'rgba(34,197,94,0.28)')
                                                return <HighchartsReact highcharts={Highcharts} options={{ chart: { type: 'column', backgroundColor: 'transparent', height: 70, margin: [0, 0, 0, 0], spacing: [0, 0, 0, 0], style: { fontFamily: 'inherit' } }, title: { text: undefined }, credits: { enabled: false }, legend: { enabled: false }, xAxis: { visible: false }, yAxis: { visible: false }, tooltip: { backgroundColor: '#0d1829', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 6, style: { color: '#fff', fontSize: '10px' }, formatter() { return `<b>$${Number(this.y).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</b>` } }, plotOptions: { column: { borderWidth: 0, borderRadius: 2, colorByPoint: true, colors, states: { hover: { brightness: 0.2 } } } }, series: [{ type: 'column', data }] } as Highcharts.Options} />
                                            })() : <div className="h-16 bg-white/[0.02] rounded" />}
                                        </div>
                                        <p className="text-[10px] text-gray-700 mt-2">Últimos 12 meses Últimos 12 meses <button onClick={() => setActiveTab('financial')} className="text-blue-500 hover:text-blue-400 transition-colors ml-1">Ver relatório →</button></p>
                                    </div>


                                </div>
                            </div>

                            {/* ── Row 3: Reports overview ─────────────────────────── */}
                            <div className="bg-[#0d1829] border border-white/[0.06]">
                                <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-semibold text-white">Visão geral da plataforma</p>
                                        <p className="text-xs text-gray-500 mt-0.5">Resumo de todas as métricas operacionais</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setActiveTab('financial')} className="text-xs px-2 py-1 bg-gray-800/50 hover:bg-gray-700/50 border border-gray-600/30 text-gray-400 hover:text-gray-300 rounded transition-colors">
                                            Exportar
                                        </button>
                                        <button onClick={fetchFinancial} className="text-xs px-2 py-1 bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 hover:text-white transition-colors rounded">
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
                                    <div className="px-4 py-3 border-b border-white/[0.05] flex items-center justify-between">
                                        <p className="text-xs font-semibold text-white">Provedores de pagamento</p>
                                        <button onClick={() => setActiveTab('providers')} className="text-[10px] text-blue-500 hover:text-blue-400 transition-colors">Gerenciar →</button>
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
                                    <div className="px-4 py-3 border-b border-white/[0.05] flex items-center justify-between">
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
                                        <div className="px-4 py-3 border-b border-white/[0.05]">
                                            <p className="text-xs font-semibold text-white">Top Sellers</p>
                                        </div>
                                        {financialData?.top_sellers?.length > 0 ? (
                                            <div className="divide-y divide-white/[0.04]">
                                                {financialData.top_sellers.slice(0, 4).map((s: any, idx: number) => (
                                                    <div key={s.user_id} className="px-5 py-2.5 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
                                                        <span className="text-sm w-4 text-center flex-shrink-0">{idx + 1}</span>
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
                                    <div className="bg-[#0d1829] border border-white/[0.06] px-4 py-3">
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
                                                    <span className={`text-[10px] px-2 py-0.5 font-semibold ${svc.ok ? 'bg-gray-700/50 text-gray-300 border border-gray-600/40' : 'bg-gray-800/50 text-gray-400 border border-gray-700/40'}`}>
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
                                <div className="px-4 py-3 border-b border-white/[0.05] flex items-center justify-between">
                                    <div>
                                        <h3 className="text-sm font-semibold text-white">{t('superadmin.platform_users')}</h3>
                                        <p className="text-xs text-gray-500 mt-0.5">{users.length} de {totalUsers} proprietários da plataforma</p>
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
                                                className="w-full flex items-center justify-between px-3 py-2 bg-white/[0.02] hover:bg-white/[0.04] rounded-lg border border-white/[0.04] hover:border-blue-500/20 transition-all text-left group"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-xs">
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
                                        <div className="sticky top-0 backdrop-blur-xl bg-white/[0.02] p-4 flex items-center justify-between border-b border-white/[0.05]">
                                            <div className="flex items-center gap-4">
                                                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                                    {selectedUser.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <h3 className="text-sm font-semibold text-white">{selectedUser.name}</h3>
                                                    <p className="text-xs text-gray-500">{selectedUser.email}</p>
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

                                        <div className="p-4 space-y-4">
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
                                                        <div className="space-y-4">
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
                                                            <span className="ml-auto text-xs bg-gray-700/50 text-gray-300 px-2 py-0.5 rounded font-medium border border-gray-600/40">
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
                                                                            ? 'bg-gray-700/50 text-gray-300 border-gray-600/40'
                                                                            : app.review_status === 'rejected'
                                                                                ? 'bg-gray-800/50 text-gray-400 border-gray-700/40'
                                                                                : 'bg-gray-700/50 text-gray-300 border-gray-600/40'
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
                            <div className="p-4">
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
                                            <div className="text-xl font-bold text-white">
                                                {plans.filter(u => u.plan === 'free').length}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="backdrop-blur-xl bg-white/[0.02] p-4 rounded-xl border border-white/[0.05]">
                                        <div>
                                            <div className="text-sm text-blue-400">Pro</div>
                                            <div className="text-xl font-bold text-white">
                                                {plans.filter(u => u.plan === 'pro').length}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="backdrop-blur-xl bg-white/[0.02] p-4 rounded-xl border border-white/[0.05]">
                                        <div>
                                            <div className="text-sm text-blue-400">Advanced</div>
                                            <div className="text-xl font-bold text-white">
                                                {plans.filter(u => u.plan === 'advanced').length}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Plan Distribution Chart — Highcharts */}
                                {plans.length > 0 && (
                                    <div className="mb-5">
                                        <HighchartsReact highcharts={Highcharts} options={{
                                            chart: { type: 'bar', backgroundColor: 'transparent', height: 80, margin: [5, 10, 5, 10], style: { fontFamily: 'inherit' } },
                                            title: { text: undefined }, credits: { enabled: false }, legend: { enabled: false },
                                            xAxis: { categories: ['Free', 'Pro', 'Advanced'], labels: { style: { color: '#6b7280', fontSize: '11px' } }, lineColor: 'transparent', tickColor: 'transparent' },
                                            yAxis: { visible: false, max: Math.max(plans.length, 1) },
                                            tooltip: { backgroundColor: '#0d1829', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 6, style: { color: '#fff', fontSize: '10px' }, formatter() { return `<b>${this.x}:</b> ${this.y} usuários` } },
                                            plotOptions: { bar: { borderWidth: 0, borderRadius: 4, dataLabels: { enabled: true, style: { color: '#9ca3af', fontSize: '10px', fontWeight: '600', textOutline: 'none' } } } },
                                            series: [{
                                                type: 'bar', data: [
                                                    { y: plans.filter(u => u.plan === 'free' || !u.plan).length, color: 'rgba(107,114,128,0.6)' },
                                                    { y: plans.filter(u => u.plan === 'pro').length, color: 'rgba(59,130,246,0.7)' },
                                                    { y: plans.filter(u => u.plan === 'advanced').length, color: '#3b82f6' }
                                                ]
                                            }]
                                        } as Highcharts.Options} />
                                    </div>
                                )}

                                {/* Users and Plans Table */}
                                <div className="overflow-x-auto">
                                    <table className="min-w-full">
                                        <thead>
                                            <tr className="border-b border-white/[0.05]">
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                                    User
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                                    Plano
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                                    Apps
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                                    Cadastro
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                                    Ações
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/[0.04]">
                                            {plans.map((planUser) => (
                                                <tr key={planUser.id} className="hover:bg-white/[0.03] transition-colors">
                                                    <td className="px-4 py-3 whitespace-nowrap">
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
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${planUser.plan === 'advanced' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                                            planUser.plan === 'pro' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                                                'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                                                            }`}>
                                                            {planUser.plan === 'advanced' ? 'Advanced' : planUser.plan === 'pro' ? 'Pro' : 'Free'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-white">
                                                        {planUser.app_count} apps
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                        {planUser.created_at ? new Date(planUser.created_at).toLocaleDateString('en-US') : 'N/A'}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm">
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
                        <div className="space-y-6">
                            {/* Quick stats banner minimal */}
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { label: 'Pendentes', value: bankVerifications.filter(v => v.verification_status === 'pending').length, color: 'text-amber-400', dot: 'bg-amber-400' },
                                    { label: 'Aprovadas', value: bankVerifications.filter(v => v.verification_status === 'approved').length, color: 'text-emerald-400', dot: 'bg-emerald-400' },
                                    { label: 'Rejeitadas', value: bankVerifications.filter(v => v.verification_status === 'rejected').length, color: 'text-red-400', dot: 'bg-red-400' },
                                ].map(s => (
                                    <div key={s.label} className="flex flex-col items-center justify-center bg-[#101624] rounded-lg py-3 border border-white/[0.04]">
                                        <span className={`w-2 h-2 rounded-full mb-1 ${s.dot}`} />
                                        <span className={`text-lg font-bold ${s.color}`}>{s.value}</span>
                                        <span className="text-xs text-gray-500 mt-0.5">{s.label}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-[#101624] rounded-lg border border-white/[0.04] p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h2 className="text-lg font-semibold text-white">{t('superadmin.pending_verifications')}</h2>
                                        <p className="text-xs text-gray-500 mt-0.5">{t('superadmin.review_accounts_desc')}</p>
                                    </div>
                                    <button
                                        onClick={fetchBankVerifications}
                                        className="px-3 py-1 bg-gray-900 hover:bg-gray-800 text-gray-300 hover:text-white rounded text-xs border border-white/[0.06] transition-colors"
                                    >
                                        {t('superadmin.refresh')}
                                    </button>
                                </div>

                                {loadingVerifications ? (
                                    <div className="text-center py-12">
                                        <div className="w-10 h-10 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto"></div>
                                        <p className="text-gray-500 text-sm mt-4">{t('superadmin.loading_verifications')}</p>
                                    </div>
                                ) : bankVerifications.length === 0 ? (
                                    <div className="text-center py-12">
                                        <p className="text-xl font-bold text-blue-400 mb-2">{t('superadmin.all_caught_up')}</p>
                                        <p className="text-sm text-gray-500">{t('superadmin.no_pending_verifications')}</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {bankVerifications.map((verification) => (
                                            <div key={verification.id} className="bg-[#0d1422] border border-white/[0.04] rounded-lg p-4 flex flex-col gap-3">
                                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-blue-600/80 flex items-center justify-center text-white font-bold text-base">
                                                            {verification.account_holder_name?.charAt(0) || 'U'}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <h3 className="font-semibold text-white text-base">{verification.account_holder_name || 'Unknown'}</h3>
                                                                <span className={`text-xs px-2 py-0.5 rounded-full border border-white/[0.08] ${verification.verification_status === 'pending' ? 'text-amber-400 bg-amber-400/10' : verification.verification_status === 'approved' ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'}`}>{verification.verification_status}</span>
                                                            </div>
                                                            <p className="text-xs text-gray-400">{verification.user_email}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2 mt-2 md:mt-0">
                                                        <button
                                                            onClick={() => handleApproveVerification(verification.id)}
                                                            disabled={processingId === verification.id}
                                                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded text-xs font-medium transition-colors"
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
                                                            className="px-3 py-1 bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white rounded text-xs font-medium transition-colors"
                                                        >
                                                            {t('superadmin.reject')}
                                                        </button>
                                                        <button
                                                            onClick={() => openDetailsModal(verification)}
                                                            className="px-3 py-1 bg-gray-900 hover:bg-gray-800 text-gray-300 hover:text-white rounded text-xs font-medium border border-white/[0.06] transition-colors"
                                                        >
                                                            {t('superadmin.view_details')}
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mt-1">
                                                    <div>
                                                        <span className="text-gray-500">Banco</span>
                                                        <div className="text-white font-medium">{verification.bank_name || 'N/A'}</div>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">País</span>
                                                        <div className="text-white font-medium">{verification.bank_country || 'N/A'}</div>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">Tipo</span>
                                                        <div className="text-white font-medium capitalize">{verification.account_type || 'N/A'}</div>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">Moeda</span>
                                                        <div className="text-white font-medium">{verification.currency || 'N/A'}</div>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">Conta</span>
                                                        <div className="text-white font-medium">****{verification.account_number?.slice(-4) || verification.iban?.slice(-4) || 'XXXX'}</div>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">Enviado em</span>
                                                        <div className="text-white font-medium">{new Date(verification.submitted_at).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                                                    </div>
                                                </div>
                                                {/* Documentos */}
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {verification.id_document_url && (
                                                        <a
                                                            href={verification.id_document_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-1 px-2 py-1 bg-gray-900 text-gray-300 rounded text-xs hover:bg-gray-800 hover:text-white border border-white/[0.06] transition-colors"
                                                        >
                                                            Doc ID ↗
                                                        </a>
                                                    )}
                                                    {verification.address_proof_url && (
                                                        <a
                                                            href={verification.address_proof_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-1 px-2 py-1 bg-gray-900 text-gray-300 rounded text-xs hover:bg-gray-800 hover:text-white border border-white/[0.06] transition-colors"
                                                        >
                                                            Comprovante Endereço ↗
                                                        </a>
                                                    )}
                                                    {verification.bank_statement_url && (
                                                        <a
                                                            href={verification.bank_statement_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-1 px-2 py-1 bg-gray-900 text-gray-300 rounded text-xs hover:bg-gray-800 hover:text-white border border-white/[0.06] transition-colors"
                                                        >
                                                            Extrato Bancário ↗
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Reviews Tab (Apps + Products) */}
                    {activeTab === 'reviews' && (
                        <div className="space-y-4">
                            {/* Sub-tab selector */}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setReviewSubTab('apps')}
                                    className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium transition-all duration-200 ${reviewSubTab === 'apps' ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                                    Apps
                                    {allApps.length > 0 && <span className="text-xs text-gray-500">{allApps.length}</span>}
                                </button>
                                <button
                                    onClick={() => setReviewSubTab('products')}
                                    className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium transition-all duration-200 ${reviewSubTab === 'products' ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                                    Áreas de Membros
                                    {allProducts.length > 0 && <span className="text-xs text-gray-500">{allProducts.length}</span>}
                                </button>
                            </div>

                            {/* Apps sub-tab */}
                            {reviewSubTab === 'apps' && (
                                <div className="space-y-4">
                                    {/* Status filter bar */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {([
                                            { key: 'all', label: 'Todos', color: 'gray' },
                                            { key: 'pending_review', label: 'Pendentes', color: 'amber' },
                                            { key: 'approved', label: 'Aprovados', color: 'green' },
                                            { key: 'rejected', label: 'Rejeitados', color: 'red' },
                                        ] as { key: 'all' | 'pending_review' | 'approved' | 'rejected'; label: string; color: string }[]).map(({ key, label, color }) => {
                                            const count = key === 'all' ? allApps.length : allApps.filter(a => a.review_status === key).length
                                            const isActive = appStatusFilter === key
                                            const colorMap: Record<string, string> = {
                                                gray: isActive ? 'text-white' : 'text-gray-500 hover:text-gray-300',
                                                amber: isActive ? 'text-amber-400' : 'text-gray-500 hover:text-amber-400',
                                                green: isActive ? 'text-green-400' : 'text-gray-500 hover:text-green-400',
                                                red: isActive ? 'text-red-400' : 'text-gray-500 hover:text-red-400',
                                            }
                                            return (
                                                <button
                                                    key={key}
                                                    onClick={() => setAppStatusFilter(key)}
                                                    className={`flex items-center gap-1.5 px-2 py-1 text-sm font-medium transition-all duration-200 ${colorMap[color]}`}
                                                >
                                                    {label}
                                                    <span className="text-xs text-gray-600">{count}</span>
                                                </button>
                                            )
                                        })}
                                        <button onClick={fetchAllApps} className="ml-auto px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-all flex items-center gap-1.5">
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                            Atualizar
                                        </button>
                                    </div>
                                    {/* Busca por nome / produtor */}
                                    <div className="relative">
                                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                        <input
                                            type="text"
                                            placeholder="Buscar por nome do app ou e-mail do produtor..."
                                            value={appSearchQuery}
                                            onChange={e => setAppSearchQuery(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2 bg-white/[0.02] border-b border-white/[0.06] text-white placeholder-gray-600 text-xs focus:outline-none focus:border-blue-500/30"
                                        />
                                        {appSearchQuery && (
                                            <button onClick={() => setAppSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-sm leading-none">×</button>
                                        )}
                                    </div>

                                    {/* Apps list */}
                                    {loadingAllApps ? (
                                        <div className="p-16 flex flex-col items-center justify-center">
                                            <div className="w-12 h-12 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                                            <p className="text-gray-400">{t('superadmin.loading_apps')}</p>
                                        </div>
                                    ) : (() => {
                                        const filtered = allApps.filter(a => {
                                            const matchStatus = appStatusFilter === 'all' || a.review_status === appStatusFilter
                                            const q = appSearchQuery.toLowerCase()
                                            const matchSearch = !q || a.name?.toLowerCase().includes(q) || a.owner_email?.toLowerCase().includes(q) || a.slug?.toLowerCase().includes(q)
                                            return matchStatus && matchSearch
                                        })
                                        return filtered.length === 0 ? (
                                            <div className="p-12 text-center">
                                                <div className="w-16 h-16 mx-auto mb-5 bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-full flex items-center justify-center border border-blue-500/30">
                                                    <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                </div>
                                                <h4 className="text-xl font-semibold text-blue-400 mb-2">{t('superadmin.all_caught_up')}</h4>
                                                <p className="text-gray-500 text-sm max-w-sm mx-auto">{t('superadmin.no_apps_review')}</p>
                                            </div>
                                        ) : (
                                            <div className="grid gap-4">
                                                {filtered.map((app, index) => {
                                                    const statusConfig = {
                                                        pending_review: { label: 'Pendente', cls: 'text-amber-400' },
                                                        approved: { label: 'Aprovado', cls: 'text-green-400' },
                                                        rejected: { label: 'Rejeitado', cls: 'text-red-400' },
                                                        draft: { label: 'Rascunho', cls: 'text-gray-400' },
                                                    }
                                                    const sc = statusConfig[app.review_status as keyof typeof statusConfig] || statusConfig.draft
                                                    return (
                                                        <div
                                                            key={app.id}
                                                            className="overflow-hidden border-b border-white/[0.05] last:border-b-0 transition-all duration-300 group"
                                                            style={{ animationDelay: `${index * 50}ms` }}
                                                        >
                                                            <div className="p-4">
                                                                <div className="flex items-start gap-5">
                                                                    <div className="relative">
                                                                        <div className="w-20 h-20 rounded-xl overflow-hidden bg-gradient-to-br from-white/[0.05] to-white/[0.02] flex-shrink-0">
                                                                            {app.logo_url ? (
                                                                                <img src={app.logo_url} alt={app.name} className="w-full h-full object-cover" />
                                                                            ) : (
                                                                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-600/20 to-indigo-600/20">
                                                                                    <span className="text-2xl font-bold text-blue-400">{app.name?.charAt(0) || 'A'}</span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-start justify-between gap-4">
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                                                    <h4 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">{app.name}</h4>
                                                                                    <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded text-xs font-medium">App</span>
                                                                                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${sc.cls}`}>{sc.label}</span>
                                                                                </div>
                                                                                <p className="text-sm text-gray-500">/{app.slug}</p>
                                                                                {app.review_status === 'rejected' && app.review_notes && (
                                                                                    <p className="mt-1.5 text-xs text-red-400/80 bg-red-500/5 border border-red-500/15 rounded px-2 py-1 line-clamp-2">
                                                                                        Motivo: {app.review_notes}
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center flex-wrap gap-4 mt-3 text-sm">
                                                                            <span className="text-gray-500">Owner: <span className="text-gray-300">{app.owner_email || 'Unknown'}</span></span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-3 mt-4">
                                                                    <button onClick={() => openAppDetailsModal(app)} className="text-gray-400 hover:text-white text-xs transition-colors flex items-center gap-1">
                                                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                                        <span>Ver</span>
                                                                    </button>
                                                                    {app.review_status !== 'approved' && (
                                                                        <button onClick={() => handleApproveApp(app.id)} disabled={processingId === app.id} className="flex items-center gap-1 text-gray-400 hover:text-green-400 text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                                                            {processingId === app.id ? (
                                                                                <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                                            ) : (
                                                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                                                            )}
                                                                            <span>Aprovar</span>
                                                                        </button>
                                                                    )}
                                                                    {app.review_status !== 'rejected' && (
                                                                        <button onClick={() => openAppRejectModal(app)} disabled={processingId === app.id} className="flex items-center gap-1 text-gray-400 hover:text-red-400 text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                                            <span>Rejeitar</span>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )
                                    })()}
                                </div>
                            )}

                            {/* Products sub-tab */}
                            {reviewSubTab === 'products' && (
                                <div className="space-y-4">
                                    {/* Status filter bar */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {([
                                            { key: 'all', label: 'Todos', color: 'gray' },
                                            { key: 'pending_review', label: 'Pendentes', color: 'amber' },
                                            { key: 'approved', label: 'Aprovados', color: 'green' },
                                            { key: 'rejected', label: 'Rejeitados', color: 'red' },
                                        ] as { key: 'all' | 'pending_review' | 'approved' | 'rejected'; label: string; color: string }[]).map(({ key, label, color }) => {
                                            const count = key === 'all' ? allProducts.length : allProducts.filter(p => p.review_status === key).length
                                            const isActive = productStatusFilter === key
                                            return (
                                                <button
                                                    key={key}
                                                    onClick={() => setProductStatusFilter(key)}
                                                    className={`flex items-center gap-1 px-2 py-1 text-xs transition-colors ${isActive
                                                        ? 'text-white'
                                                        : 'text-gray-500 hover:text-gray-300'
                                                        }`}
                                                >
                                                    {label}
                                                    <span className="text-xs text-gray-600">{count}</span>
                                                </button>
                                            )
                                        })}
                                        <button onClick={fetchAllProducts} className="ml-auto px-2 py-1 text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1">
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                            Atualizar
                                        </button>
                                    </div>
                                    {/* Busca por nome / produtor */}
                                    <div className="relative">
                                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                        <input
                                            type="text"
                                            placeholder="Buscar por nome do produto ou e-mail do produtor..."
                                            value={productSearchQuery}
                                            onChange={e => setProductSearchQuery(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2 bg-white/[0.02] border-b border-white/[0.06] text-white placeholder-gray-600 text-xs focus:outline-none focus:border-blue-500/30"
                                        />
                                        {productSearchQuery && (
                                            <button onClick={() => setProductSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-sm leading-none">×</button>
                                        )}
                                    </div>

                                    {/* Products list */}
                                    {loadingAllProducts ? (
                                        <div className="p-16 flex flex-col items-center justify-center">
                                            <div className="w-12 h-12 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                                            <p className="text-gray-400">Carregando produtos...</p>
                                        </div>
                                    ) : (() => {
                                        const filtered = allProducts.filter(p => {
                                            const matchStatus = productStatusFilter === 'all' || p.review_status === productStatusFilter
                                            const q = productSearchQuery.toLowerCase()
                                            const matchSearch = !q || p.name?.toLowerCase().includes(q) || p.owner_email?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)
                                            return matchStatus && matchSearch
                                        })
                                        return filtered.length === 0 ? (
                                            <div className="p-12 text-center">
                                                <div className="w-16 h-16 mx-auto mb-5 bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-full flex items-center justify-center border border-blue-500/30">
                                                    <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                                                </div>
                                                <h4 className="text-xl font-semibold text-blue-400 mb-2">Nenhum produto encontrado</h4>
                                                <p className="text-gray-500 text-sm max-w-sm mx-auto">Não há produtos com o status selecionado.</p>
                                            </div>
                                        ) : (
                                            <div className="grid gap-4">
                                                {filtered.map((product, index) => {
                                                    const statusConfig = {
                                                        pending_review: { label: 'Pendente', cls: 'text-amber-400' },
                                                        approved: { label: 'Aprovado', cls: 'text-green-400' },
                                                        rejected: { label: 'Rejeitado', cls: 'text-red-400' },
                                                        draft: { label: 'Rascunho', cls: 'text-gray-400' },
                                                    }
                                                    const sc = statusConfig[product.review_status as keyof typeof statusConfig] || statusConfig.draft
                                                    return (
                                                        <div
                                                            key={product.id}
                                                            className="overflow-hidden border-b border-white/[0.05] last:border-b-0 transition-all duration-300 group"
                                                            style={{ animationDelay: `${index * 40}ms` }}
                                                        >
                                                            <div className="p-4">
                                                                <div className="flex items-start gap-5">
                                                                    <div className="w-24 h-24 rounded-xl overflow-hidden bg-gradient-to-br from-white/[0.05] to-white/[0.02] flex-shrink-0">
                                                                        {product.image_url ? (
                                                                            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                                                                        ) : (
                                                                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-600/20 to-indigo-600/20">
                                                                                <span className="text-2xl font-bold text-blue-400">{product.name?.charAt(0) || 'P'}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-start justify-between gap-4">
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                                                    <h4 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">{product.name}</h4>
                                                                                    <span className="text-violet-400 text-xs font-medium">Área</span>
                                                                                    <span className={`text-xs font-medium ${sc.cls}`}>{sc.label}</span>
                                                                                </div>
                                                                                <p className="text-sm text-gray-500 line-clamp-2">{product.description || 'Sem descrição'}</p>
                                                                                {product.review_status === 'rejected' && product.review_notes && (
                                                                                    <p className="mt-1.5 text-xs text-red-400/80 bg-red-500/5 border border-red-500/15 rounded px-2 py-1 line-clamp-2">
                                                                                        Motivo: {product.review_notes}
                                                                                    </p>
                                                                                )}
                                                                            </div>

                                                                        </div>
                                                                        <div className="flex items-center flex-wrap gap-4 mt-3 text-sm">
                                                                            <span className="text-gray-500">Owner: <span className="text-gray-300">{product.owner_email || 'Unknown'}</span></span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-3 mt-4">
                                                                    <button onClick={() => openProductDetailsModal(product)} className="text-gray-400 hover:text-white text-xs transition-colors flex items-center gap-1">
                                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                                        <span>Detalhes</span>
                                                                    </button>
                                                                    {product.review_status !== 'approved' && (
                                                                        <button onClick={() => handleApproveProduct(product.id)} disabled={processingId === product.id} className="flex items-center gap-1 text-gray-400 hover:text-green-400 text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                                                            {processingId === product.id ? (
                                                                                <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                                            ) : (
                                                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                                                            )}
                                                                            Aprovar
                                                                        </button>
                                                                    )}
                                                                    {product.review_status !== 'rejected' && (
                                                                        <button onClick={() => openProductRejectModal(product)} disabled={processingId === product.id} className="flex items-center gap-1 text-gray-400 hover:text-red-400 text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                                            Rejeitar
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )
                                    })()}
                                </div>
                            )}
                        </div>
                    )}
                    {/* Reject Modal */}
                    {showRejectModal && selectedVerification && (
                        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                            <div className="backdrop-blur-xl bg-[#0d1117]/95 rounded-none shadow-2xl w-full max-w-md border border-white/[0.05]">
                                <div className="p-4 border-b border-white/[0.05]">
                                    <h3 className="text-lg font-semibold text-white">Reject Bank Account</h3>
                                    <p className="text-sm text-gray-500 mt-1">
                                        Rejecting: {selectedVerification.account_holder_name}'s account
                                    </p>
                                </div>
                                <div className="p-4">
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
                                <div className="p-4 border-t border-white/[0.05] flex gap-3 justify-end">
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
                                <div className="p-4 border-b border-white/[0.05] sticky top-0 backdrop-blur-xl bg-white/[0.02] z-10">
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
                                <div className="p-4 space-y-4">
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

                                <div className="p-4 border-t border-white/[0.05] flex gap-3 justify-end sticky bottom-0 backdrop-blur-xl bg-white/[0.02]">
                                    <button
                                        onClick={() => {
                                            setShowDetailsModal(false)
                                            openRejectModal(selectedVerification)
                                        }}
                                        className="px-3 py-1 bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 hover:text-white rounded text-sm transition-colors border border-gray-600/30"
                                    >
                                        Rejeitar
                                    </button>
                                    <button
                                        onClick={() => {
                                            handleApproveVerification(selectedVerification.id)
                                            setShowDetailsModal(false)
                                        }}
                                        className="px-3 py-1 bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 hover:text-white rounded text-sm transition-colors border border-gray-600/30"
                                    >
                                        Aprovar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* App Details Modal */}
                    {showAppDetailsModal && selectedAppForDetails && (
                        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                            <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col bg-[#0d1117] border border-white/[0.07]">
                                {/* Header */}
                                <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between flex-shrink-0">
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase tracking-wider">App Review</p>
                                        <h3 className="text-sm font-semibold text-white mt-0.5">{appDetailsData?.app?.name || selectedAppForDetails.name}</h3>
                                    </div>
                                    <button
                                        onClick={() => { setShowAppDetailsModal(false); setSelectedAppForDetails(null); setAppDetailsData(null) }}
                                        className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-white transition-colors"
                                    >×</button>
                                </div>

                                {/* Content */}
                                <div className="p-5 overflow-y-auto flex-1 space-y-5">
                                    {loadingAppDetails ? (
                                        <div className="flex items-center justify-center py-12">
                                            <div className="w-6 h-6 border-2 border-gray-600 border-t-white rounded-full animate-spin"></div>
                                        </div>
                                    ) : (
                                        <>
                                            {/* App info row */}
                                            <div className="flex items-start gap-4">
                                                <div className="w-16 h-16 flex-shrink-0 overflow-hidden border border-white/[0.07]">
                                                    {selectedAppForDetails.logo_url ? (
                                                        <img src={selectedAppForDetails.logo_url} alt={selectedAppForDetails.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center bg-gray-800">
                                                            <span className="text-lg font-bold text-gray-400">{selectedAppForDetails.name?.charAt(0) || 'A'}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-white">{appDetailsData?.app?.name || selectedAppForDetails.name}</p>
                                                    <p className="text-xs text-gray-500 mt-0.5">/{selectedAppForDetails.slug}</p>
                                                    {appDetailsData?.app?.description && (
                                                        <p className="text-xs text-gray-400 mt-1">{appDetailsData.app.description}</p>
                                                    )}
                                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                                        {selectedAppForDetails.app_type && (
                                                            <span className="text-[11px] px-2 py-0.5 bg-white/[0.04] border border-white/[0.07] text-gray-400">{selectedAppForDetails.app_type}</span>
                                                        )}
                                                        {selectedAppForDetails.language && (
                                                            <span className="text-[11px] px-2 py-0.5 bg-white/[0.04] border border-white/[0.07] text-gray-400">{selectedAppForDetails.language}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Stats inline */}
                                            {appDetailsData?.stats && (
                                                <div className="flex gap-6 border-t border-b border-white/[0.05] py-3">
                                                    <div>
                                                        <p className="text-xs text-gray-500">Produtos</p>
                                                        <p className="text-sm font-semibold text-white mt-0.5">{appDetailsData.stats.totalMemberAreas}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Módulos</p>
                                                        <p className="text-sm font-semibold text-white mt-0.5">{appDetailsData.stats.totalModules}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Aulas</p>
                                                        <p className="text-sm font-semibold text-white mt-0.5">{appDetailsData.stats.totalLessons}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Owner</p>
                                                        <p className="text-xs text-white mt-0.5">{appDetailsData?.app?.owner_email || selectedAppForDetails.owner_email || 'Unknown'}</p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Member Areas */}
                                            {appDetailsData?.memberAreas && appDetailsData.memberAreas.length > 0 && (
                                                <div>
                                                    <p className="text-xs text-gray-500 mb-2">Produtos do App</p>
                                                    <div className="space-y-2">
                                                        {appDetailsData.memberAreas.map((area: any, idx: number) => (
                                                            <div key={area.id} className="border border-white/[0.06]">
                                                                <div className="px-3 py-2.5 border-b border-white/[0.05] flex items-center justify-between">
                                                                    <div className="flex items-center gap-2">
                                                                        {(area.image_url || area.cover_url) ? (
                                                                            <img src={area.image_url || area.cover_url} alt={area.name} className="w-6 h-6 object-cover" />
                                                                        ) : (
                                                                            <span className="text-xs text-gray-600 w-4">{idx + 1}.</span>
                                                                        )}
                                                                        <span className="text-xs font-medium text-white">{area.name || 'Sem nome'}</span>
                                                                        {area.review_status && <span className={`text-[11px] px-1.5 py-0.5 border ${area.review_status === 'approved' ? 'border-green-500/30 text-green-500' : area.review_status === 'rejected' ? 'border-red-500/30 text-red-500' : 'border-white/[0.07] text-gray-500'}`}>{area.review_status}</span>}
                                                                        {area.type && <span className="text-[11px] px-1.5 py-0.5 border border-white/[0.07] text-gray-500">{area.type}</span>}
                                                                    </div>
                                                                    <div className="flex items-center gap-3">
                                                                        {area.price != null && <span className="text-xs text-gray-400">{area.currency || 'BRL'} {area.price?.toFixed(2)}</span>}
                                                                        <span className="text-[11px] text-gray-600">{area.modules?.length || 0} módulos</span>
                                                                    </div>
                                                                </div>
                                                                {area.modules && area.modules.length > 0 && (
                                                                    <div className="divide-y divide-white/[0.03]">
                                                                        {area.modules.map((mod: any, mIdx: number) => (
                                                                            <div key={mod.id}>
                                                                                <div className="px-4 py-2 flex items-center justify-between bg-white/[0.01]">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="text-[11px] text-gray-600 w-4">{mIdx + 1}.</span>
                                                                                        <span className="text-xs text-gray-300 font-medium">{mod.title}</span>
                                                                                    </div>
                                                                                    <span className="text-[11px] text-gray-600">{mod.lessons?.length || 0} aulas</span>
                                                                                </div>
                                                                                {mod.lessons && mod.lessons.length > 0 && (
                                                                                    <div className="divide-y divide-white/[0.02]">
                                                                                        {mod.lessons.map((lesson: any, lIdx: number) => (
                                                                                            <div key={lesson.id} className="px-4 py-1.5 pl-10 flex items-center gap-3">
                                                                                                <span className="text-[10px] text-gray-700 w-4">{lIdx + 1}.</span>
                                                                                                <p className="text-[11px] text-gray-400 flex-1">{lesson.title || 'Sem título'}</p>
                                                                                                <span className="text-[10px] text-gray-600 capitalize">{lesson.content_type || 'video'}</span>
                                                                                                {lesson.video_url && (
                                                                                                    <a href={lesson.video_url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-500 hover:text-blue-400">↗</a>
                                                                                                )}
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {appDetailsData?.memberAreas && appDetailsData.memberAreas.length === 0 && (
                                                <p className="text-xs text-gray-600 py-4 text-center border border-white/[0.04]">Nenhuma área de membro cadastrada</p>
                                            )}
                                        </>
                                    )}
                                </div>

                                {/* Footer */}
                                <div className="px-5 py-4 border-t border-white/[0.06] flex items-center justify-between flex-shrink-0">
                                    <button
                                        onClick={() => { setShowAppDetailsModal(false); setSelectedAppForDetails(null); setAppDetailsData(null) }}
                                        className="text-xs text-gray-500 hover:text-white transition-colors"
                                    >Fechar</button>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => { setShowAppDetailsModal(false); openAppRejectModal(selectedAppForDetails) }}
                                            className="px-4 py-2 text-xs text-gray-300 border border-white/[0.1] hover:border-white/[0.2] hover:text-white transition-colors"
                                        >Rejeitar App</button>
                                        <button
                                            onClick={() => { handleApproveApp(selectedAppForDetails.id); setShowAppDetailsModal(false) }}
                                            className="px-4 py-2 text-xs text-white bg-blue-600 hover:bg-blue-500 transition-colors"
                                        >Aprovar App</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Product Details Modal */}
                    {showProductDetailsModal && selectedProduct && (
                        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                            <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col bg-[#0d1117] border border-white/[0.07]">
                                {/* Header */}
                                <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between flex-shrink-0">
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase tracking-wider">Product Review</p>
                                        <h3 className="text-sm font-semibold text-white mt-0.5">{selectedProduct.name}</h3>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setShowProductDetailsModal(false)
                                            setSelectedProduct(null)
                                            setProductDetails(null)
                                        }}
                                        className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-white transition-colors"
                                    >
                                        ×
                                    </button>
                                </div>

                                {/* Content */}
                                <div className="p-5 overflow-y-auto flex-1 space-y-5">
                                    {loadingProductDetails ? (
                                        <div className="flex items-center justify-center py-12">
                                            <div className="w-6 h-6 border-2 border-gray-600 border-t-white rounded-full animate-spin"></div>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Product info row */}
                                            <div className="flex items-start gap-4">
                                                <div className="w-16 h-16 flex-shrink-0 overflow-hidden border border-white/[0.07]">
                                                    {selectedProduct.image_url ? (
                                                        <img src={selectedProduct.image_url} alt={selectedProduct.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center bg-gray-800">
                                                            <span className="text-lg font-bold text-gray-400">{selectedProduct.name?.charAt(0) || 'P'}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-white">{selectedProduct.name}</p>
                                                    <p className="text-sm text-gray-400 mt-0.5">{selectedProduct.currency || 'USD'} {selectedProduct.price?.toFixed(2) || '0.00'}</p>
                                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                                        <span className="text-[11px] px-2 py-0.5 bg-white/[0.04] border border-white/[0.07] text-gray-400">PENDING</span>
                                                        {selectedProduct.category && (
                                                            <span className="text-[11px] px-2 py-0.5 bg-white/[0.04] border border-white/[0.07] text-gray-400">{selectedProduct.category}</span>
                                                        )}
                                                        {selectedProduct.delivery_type && (
                                                            <span className="text-[11px] px-2 py-0.5 bg-white/[0.04] border border-white/[0.07] text-gray-400">{selectedProduct.delivery_type}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Stats inline */}
                                            {productDetails?.stats && (
                                                <div className="flex gap-6 border-t border-b border-white/[0.05] py-3">
                                                    <div>
                                                        <p className="text-xs text-gray-500">Modules</p>
                                                        <p className="text-sm font-semibold text-white mt-0.5">{productDetails.stats.totalModules}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Lessons</p>
                                                        <p className="text-sm font-semibold text-white mt-0.5">{productDetails.stats.totalLessons}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Members</p>
                                                        <p className="text-sm font-semibold text-white mt-0.5">{productDetails.stats.totalMembers}</p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Owner / Submitted */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-xs text-gray-500 mb-1">Owner</p>
                                                    <p className="text-xs text-white">{productDetails?.product?.owner_email || selectedProduct.owner_email || 'Unknown'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500 mb-1">Submitted</p>
                                                    <p className="text-xs text-white">
                                                        {new Date(selectedProduct.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Description */}
                                            {selectedProduct.description && (
                                                <div>
                                                    <p className="text-xs text-gray-500 mb-1.5">Description</p>
                                                    <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">{selectedProduct.description}</p>
                                                </div>
                                            )}

                                            {/* Course Content */}
                                            {productDetails?.modules && productDetails.modules.length > 0 && (
                                                <div>
                                                    <p className="text-xs text-gray-500 mb-2">Course Content</p>
                                                    <div className="space-y-2">
                                                        {productDetails.modules.map((module: any, moduleIndex: number) => (
                                                            <div key={module.id} className="border border-white/[0.06]">
                                                                <div className="px-3 py-2.5 border-b border-white/[0.05] flex items-center justify-between">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs text-gray-600 w-4">{moduleIndex + 1}.</span>
                                                                        <span className="text-xs font-medium text-white">{module.title}</span>
                                                                    </div>
                                                                    <span className="text-[11px] text-gray-600">{module.lessons?.length || 0} lessons</span>
                                                                </div>
                                                                {module.lessons && module.lessons.length > 0 && (
                                                                    <div className="divide-y divide-white/[0.03]">
                                                                        {module.lessons.map((lesson: any, lessonIndex: number) => (
                                                                            <div key={lesson.id} className="px-3 py-2 pl-8 flex items-center gap-3">
                                                                                <span className="text-[11px] text-gray-700 w-4">{lessonIndex + 1}.</span>
                                                                                <p className="text-xs text-gray-300 flex-1">{lesson.title}</p>
                                                                                <span className="text-[11px] text-gray-600 capitalize">{lesson.type || 'video'}</span>
                                                                                {lesson.video_url && (
                                                                                    <a href={lesson.video_url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-500 hover:text-blue-400">Video ↗</a>
                                                                                )}
                                                                                {lesson.pdf_url && (
                                                                                    <a href={lesson.pdf_url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-500 hover:text-blue-400">PDF ↗</a>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {productDetails?.modules && productDetails.modules.length === 0 && (
                                                <p className="text-xs text-gray-600 py-4 text-center border border-white/[0.04]">No course content yet</p>
                                            )}
                                        </>
                                    )}
                                </div>

                                {/* Footer */}
                                <div className="px-5 py-4 border-t border-white/[0.06] flex items-center justify-between flex-shrink-0">
                                    <button
                                        onClick={() => {
                                            setShowProductDetailsModal(false)
                                            setSelectedProduct(null)
                                            setProductDetails(null)
                                        }}
                                        className="text-xs text-gray-500 hover:text-white transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                setShowProductDetailsModal(false)
                                                openProductRejectModal(selectedProduct)
                                            }}
                                            className="px-4 py-2 text-xs text-gray-300 border border-white/[0.1] hover:border-white/[0.2] hover:text-white transition-colors"
                                        >
                                            Reject Product
                                        </button>
                                        <button
                                            onClick={() => {
                                                handleApproveProduct(selectedProduct.id)
                                                setShowProductDetailsModal(false)
                                            }}
                                            className="px-4 py-2 text-xs text-white bg-blue-600 hover:bg-blue-500 transition-colors"
                                        >
                                            Approve Product
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ════════════════ FINANCIAL TAB ════════════════ */}
                    {activeTab === 'financial' && <FinanceiroTab />}

                    {/* ════════════════ PROVIDERS TAB ════════════════ */}
                    {activeTab === 'providers' && (
                        <div className="space-y-3">

                            {/* ── 1. PROVEDOR GLOBAL PADRÃO ── */}
                            <div className="bg-[#0d1829] border border-white/[0.06] overflow-hidden">
                                <div className="px-4 py-3 border-b border-white/[0.05] flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-semibold text-white">Provedor Global Padrão</p>
                                        <p className="text-xs text-gray-500 mt-0.5">Usado por todos os usuários sem override individual</p>
                                    </div>
                                </div>
                                {loadingProviders ? (
                                    <div className="px-4 py-3 flex gap-3">{[1, 2].map(i => <div key={i} className="w-24 h-7 bg-white/[0.03] animate-pulse" />)}</div>
                                ) : providers.filter(p => p.is_active).length === 0 ? (
                                    <p className="px-4 py-3 text-xs text-gray-600">Cadastre provedores abaixo para selecionar o padrão global.</p>
                                ) : (
                                    <div className="divide-y divide-white/[0.04]">
                                        {providers.filter(p => p.is_active).map(p => {
                                            const isDefault = p.is_global_default
                                            return (
                                                <div key={p.id} className="px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
                                                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isDefault ? 'bg-blue-400' : 'bg-gray-600'}`} />
                                                    <span className="flex-1 text-xs font-semibold text-white">{p.name}</span>
                                                    <span className="text-[10px] text-gray-500">{p.type}</span>
                                                    {isDefault
                                                        ? <span className="text-[10px] px-2 py-0.5 font-semibold border bg-blue-500/10 text-blue-400 border-blue-500/30 flex-shrink-0">Padrão</span>
                                                        : <button onClick={() => handleSetGlobalDefault(p.id)} className="text-[10px] px-2 py-0.5 font-semibold border bg-white/[0.02] text-gray-500 border-white/[0.07] hover:text-gray-300 hover:border-white/[0.15] transition-colors flex-shrink-0">Definir padrão</button>
                                                    }
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* ── 2. PROVEDORES CADASTRADOS ── */}
                            <div className="bg-[#0d1829] border border-white/[0.06] overflow-hidden">
                                <div className="px-4 py-3 border-b border-white/[0.05] flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-semibold text-white">Provedores Cadastrados</p>
                                        <p className="text-xs text-gray-500 mt-0.5">{providers.length} provedor(es) no banco</p>
                                    </div>
                                    <button
                                        onClick={() => { setShowAddProviderForm(v => !v); setEditingProviderId(null) }}
                                        className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors"
                                    >
                                        {showAddProviderForm ? 'Cancelar' : '+ Novo'}
                                    </button>
                                </div>

                                {/* Formulário: Novo Provedor */}
                                {showAddProviderForm && (
                                    <div className="px-4 py-4 border-b border-white/[0.05] space-y-3 bg-white/[0.01]">
                                        <p className="text-xs font-semibold text-gray-400">Novo provedor</p>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs text-gray-600 mb-1">Nome</label>
                                                <input type="text" value={newProviderForm.name} onChange={e => setNewProviderForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-1.5 bg-white/[0.03] border border-white/[0.07] text-white text-xs focus:outline-none focus:border-blue-500/40" />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-600 mb-1">Tipo</label>
                                                <select value={newProviderForm.type} onChange={e => setNewProviderForm(f => ({ ...f, type: e.target.value, credentials: {} }))} className="w-full px-3 py-1.5 bg-white/[0.03] border border-white/[0.07] text-white text-xs focus:outline-none focus:border-blue-500/40">
                                                    <option value="stripe">Stripe</option>
                                                    <option value="mollie">Mollie</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            {(CREDENTIAL_FIELDS[newProviderForm.type] || []).map(field => (
                                                <div key={field.key}>
                                                    <label className="block text-xs text-gray-600 mb-1">{field.label}</label>
                                                    <input type="password" placeholder={field.placeholder} value={(newProviderForm.credentials as any)[field.key] || ''} onChange={e => setNewProviderForm(f => ({ ...f, credentials: { ...f.credentials, [field.key]: e.target.value } }))} className="w-full px-3 py-1.5 bg-white/[0.03] border border-white/[0.07] text-white text-xs font-mono placeholder-gray-700 focus:outline-none focus:border-blue-500/40" />
                                                </div>
                                            ))}
                                        </div>
                                        <button onClick={handleCreateProvider} disabled={savingProvider || !newProviderForm.name} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors">
                                            {savingProvider ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" /> : 'Cadastrar'}
                                        </button>
                                    </div>
                                )}

                                {/* Lista de provedores */}
                                {loadingProviders ? (
                                    <div className="px-4 py-6 flex justify-center"><div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>
                                ) : providers.length === 0 ? (
                                    <div className="px-4 py-6 text-center"><p className="text-xs text-gray-600">Nenhum provedor. Use "+ Novo" para adicionar.</p></div>
                                ) : (
                                    <div className="divide-y divide-white/[0.04]">
                                        {providers.map(provider => {
                                            const c = PROVIDER_COLORS[provider.type]
                                            const isEditing = editingProviderId === provider.id
                                            return (
                                                <div key={provider.id}>
                                                    <div className="px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
                                                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${provider.is_active ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-semibold text-white">{provider.name}</p>
                                                            <p className="text-[10px] text-gray-600 mt-0.5">{provider.type}{provider.is_global_default ? ' - padrao global' : ''}</p>
                                                        </div>
                                                        <span className={`text-[10px] px-2 py-0.5 font-semibold border flex-shrink-0 ${provider.is_active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-white/[0.02] text-gray-500 border-white/[0.07]'}`}>
                                                            {provider.is_active ? 'Ativo' : 'Inativo'}
                                                        </span>
                                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                                            <button onClick={() => handleToggleProviderActive(provider.id, provider.is_active)} className="text-[10px] px-2 py-0.5 text-gray-500 hover:text-gray-300 border border-white/[0.07] hover:border-white/[0.15] transition-colors">
                                                                {provider.is_active ? 'Desativar' : 'Ativar'}
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    if (isEditing) { setEditingProviderId(null); return }
                                                                    setEditingProviderId(provider.id)
                                                                    setEditingProviderName(provider.name)
                                                                    setEditingProviderCreds(provider.credentials || {})
                                                                    setShowAddProviderForm(false)
                                                                }}
                                                                className={`text-[10px] px-2 py-0.5 border transition-colors ${isEditing ? `${c.text} ${c.border} ${c.bg}` : 'text-gray-500 hover:text-gray-300 border-white/[0.07] hover:border-white/[0.15]'}`}
                                                            >
                                                                {isEditing ? 'Editando' : 'Editar'}
                                                            </button>
                                                            {!provider.is_global_default && (
                                                                <button onClick={() => handleDeleteProvider(provider.id)} className="text-[10px] px-2 py-0.5 text-red-500 hover:text-red-400 border border-red-500/20 hover:border-red-500/40 transition-colors">
                                                                    Remover
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Formulário inline de edição */}
                                                    {isEditing && (
                                                        <div className="px-4 pb-4 pt-3 border-t border-white/[0.05] space-y-3 bg-white/[0.01]">
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <div>
                                                                    <label className="block text-xs text-gray-600 mb-1">Nome</label>
                                                                    <input type="text" value={editingProviderName} onChange={e => setEditingProviderName(e.target.value)} className="w-full px-3 py-1.5 bg-white/[0.03] border border-white/[0.07] text-white text-xs focus:outline-none focus:border-blue-500/40" />
                                                                </div>
                                                                {(CREDENTIAL_FIELDS[provider.type] || []).map(field => (
                                                                    <div key={field.key}>
                                                                        <label className="block text-xs text-gray-600 mb-1">{field.label} <span className="text-gray-700">(em branco = manter)</span></label>
                                                                        <div className="flex gap-1.5">
                                                                            <input type={showApiKey[`edit-${provider.id}-${field.key}`] ? 'text' : 'password'} placeholder={field.placeholder} value={editingProviderCreds[field.key] || ''} onChange={e => setEditingProviderCreds(prev => ({ ...prev, [field.key]: e.target.value }))} className="flex-1 px-3 py-1.5 bg-white/[0.03] border border-white/[0.07] text-white text-xs font-mono placeholder-gray-700 focus:outline-none focus:border-blue-500/40" />
                                                                            <button onClick={() => setShowApiKey(prev => ({ ...prev, [`edit-${provider.id}-${field.key}`]: !prev[`edit-${provider.id}-${field.key}`] }))} className="px-2 py-1 bg-white/[0.03] hover:bg-white/[0.06] text-gray-500 text-[10px] border border-white/[0.07]">
                                                                                {showApiKey[`edit-${provider.id}-${field.key}`] ? 'Ocultar' : 'Ver'}
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>

                                                            {provider.type === 'mollie' && (
                                                                <div className="border border-white/[0.06] p-3 space-y-3 bg-white/[0.01]">
                                                                    <div className="flex items-center justify-between">
                                                                        <div>
                                                                            <p className="text-xs font-semibold text-white">Métodos Mollie</p>
                                                                            <p className="text-[10px] text-gray-600 mt-0.5">Métodos disponíveis no checkout</p>
                                                                        </div>
                                                                        <button onClick={() => handleLoadMollieMethods(provider.id)} disabled={loadingMollieMethods} className="text-[10px] px-2 py-0.5 text-gray-400 hover:text-gray-300 border border-white/[0.07] hover:border-white/[0.15] transition-colors disabled:opacity-50">
                                                                            {loadingMollieMethods && mollieMethodsProviderId === provider.id ? 'Carregando...' : 'Carregar da API'}
                                                                        </button>
                                                                    </div>
                                                                    {mollieMethodsProviderId === provider.id && mollieAvailableMethods.length > 0 && (
                                                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                                            {mollieAvailableMethods.map(method => {
                                                                                const isEnabled = mollieEnabledMethods.includes(method.id)
                                                                                return (
                                                                                    <label key={method.id} className={`flex items-center gap-2 px-2.5 py-2 border cursor-pointer transition-all ${isEnabled ? 'bg-white/[0.04] border-white/[0.12] text-white' : 'bg-white/[0.01] border-white/[0.05] text-gray-500 hover:border-white/[0.1]'}`}>
                                                                                        <input type="checkbox" checked={isEnabled} onChange={() => setMollieEnabledMethods(prev => isEnabled ? prev.filter(m => m !== method.id) : [...prev, method.id])} className="w-3 h-3 flex-shrink-0" />
                                                                                        {method.image?.svg ? <img src={method.image.svg} alt={method.description} className="w-4 h-3 object-contain flex-shrink-0" /> : null}
                                                                                        <span className="text-[10px] font-medium truncate">{method.description}</span>
                                                                                    </label>
                                                                                )
                                                                            })}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}

                                                            <div className="flex gap-2 pt-1">
                                                                <button onClick={() => { setEditingProviderId(null); setMollieMethodsProviderId(null); setMollieAvailableMethods([]); setMollieEnabledMethods([]) }} className="px-3 py-1.5 text-gray-500 hover:text-gray-300 border border-white/[0.07] text-xs transition-colors">Cancelar</button>
                                                                <button onClick={() => handleSaveProviderEdit(provider.id)} disabled={savingProvider} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors">
                                                                    {savingProvider ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" /> : 'Salvar'}
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
                            <div className="bg-[#0d1829] border border-white/[0.06] overflow-hidden">
                                <div className="px-4 py-3 border-b border-white/[0.05] flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-semibold text-white">Overrides por Usuário</p>
                                        <p className="text-xs text-gray-500 mt-0.5">Atribua um provedor específico a qualquer owner</p>
                                    </div>
                                    <button onClick={fetchPaymentConfigs} className="text-xs px-3 py-1.5 text-gray-500 hover:text-gray-300 border border-white/[0.07] hover:border-white/[0.15] transition-colors">Atualizar</button>
                                </div>

                                {/* Busca */}
                                <div className="px-4 py-3 border-b border-white/[0.04] flex items-center gap-2">
                                    <input type="text" placeholder="Buscar owner por email..." value={providerUserSearch} onChange={e => setProviderUserSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearchProviderUser()} className="flex-1 px-3 py-1.5 bg-white/[0.03] border border-white/[0.07] text-white text-xs placeholder-gray-600 focus:outline-none focus:border-blue-500/40" />
                                    <button onClick={handleSearchProviderUser} disabled={searchingProviderUser} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors disabled:opacity-50">
                                        {searchingProviderUser ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Buscar'}
                                    </button>
                                </div>

                                {/* Resultado da busca */}
                                {providerSearchResults !== null && (
                                    <div className="border-b border-white/[0.04]">
                                        {providerSearchResults!.length === 0 ? (
                                            <p className="px-4 py-3 text-xs text-red-400">Nenhum usuário encontrado para "{providerUserSearch}"</p>
                                        ) : (
                                            <>
                                                {providerSearchResults!.length > 1 && !providerUserResult && (
                                                    <div className="divide-y divide-white/[0.04]">
                                                        {providerSearchResults!.map(u => (
                                                            <button key={u.id} onClick={() => handleSelectProviderUser(u)} className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-white/[0.02] text-left transition-colors">
                                                                <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">{u.email?.charAt(0)?.toUpperCase()}</div>
                                                                <span className="flex-1 text-xs text-white">{u.email}</span>
                                                                {u.config?.provider_id && <span className="text-[10px] text-blue-400 border border-blue-500/30 px-1.5 py-0.5">{providers.find(p => p.id === u.config.provider_id)?.name || 'override'}</span>}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                                {providerUserResult?.user && (
                                                    <div className="px-4 py-3 flex items-center gap-3 bg-white/[0.01]">
                                                        {providerSearchResults!.length > 1 && <button onClick={() => setProviderUserResult(null)} className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors">← voltar</button>}
                                                        <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">{providerUserResult!.user.email?.charAt(0)?.toUpperCase()}</div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-semibold text-white truncate">{providerUserResult!.user.email}</p>
                                                            <p className="text-[10px] text-gray-600">{providerUserResult!.config?.provider_id ? `Override → ${providers.find(p => p.id === providerUserResult!.config.provider_id)?.name || '?'}` : 'Sem override'}</p>
                                                        </div>
                                                        <select value={selectedProviderForUser} onChange={e => setSelectedProviderForUser(e.target.value)} className="px-2 py-1.5 bg-white/[0.03] border border-white/[0.07] text-white text-xs focus:outline-none focus:border-blue-500/40">
                                                            <option value="">Padrão global</option>
                                                            {providers.filter(p => p.is_active).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                        </select>
                                                        <button onClick={handleAssignProviderToUser} disabled={assigningProvider} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors">
                                                            {assigningProvider ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Atribuir'}
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* Lista de overrides */}
                                {loadingPaymentConfigs ? (
                                    <div className="px-4 py-6 flex justify-center"><div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>
                                ) : paymentConfigs.length === 0 ? (
                                    <div className="px-4 py-6 text-center"><p className="text-xs text-gray-600">Nenhum override. Busque um usuário para atribuir um provedor.</p></div>
                                ) : (
                                    <div className="divide-y divide-white/[0.04]">
                                        {paymentConfigs.map((cfg) => {
                                            const assignedProvider = providers.find(p => p.id === cfg.provider_id)
                                            const c = assignedProvider ? PROVIDER_COLORS[assignedProvider.type] : PROVIDER_COLORS.stripe
                                            const isEditing = editingPaymentUser === cfg.user_id
                                            return (
                                                <div key={cfg.id}>
                                                    <div className={`px-4 py-3 flex items-center gap-3 transition-colors ${isEditing ? 'bg-white/[0.02]' : 'hover:bg-white/[0.02]'}`}>
                                                        <div className="w-6 h-6 bg-gradient-to-br from-blue-500/40 to-violet-500/40 border border-white/[0.1] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                                                            {cfg.user_email?.charAt(0)?.toUpperCase() || '?'}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-medium text-white truncate">{cfg.user_email}</p>
                                                            <p className="text-[10px] text-gray-600 truncate">{cfg.user_id}</p>
                                                        </div>
                                                        {assignedProvider
                                                            ? <span className={`text-[10px] px-2 py-0.5 font-semibold border flex-shrink-0 ${c.bg} ${c.text} ${c.border}`}>{assignedProvider.name}</span>
                                                            : <span className="text-[10px] px-2 py-0.5 font-semibold border flex-shrink-0 bg-white/[0.02] text-gray-500 border-white/[0.07]">{cfg.payment_provider || 'Padrão global'}</span>
                                                        }
                                                        <span className="text-[10px] px-2 py-0.5 font-semibold border bg-emerald-500/10 text-emerald-400 border-emerald-500/30 flex-shrink-0">ativo</span>
                                                        <button
                                                            onClick={() => {
                                                                if (isEditing) { setEditingPaymentUser(null); return }
                                                                setEditingPaymentUser(cfg.user_id)
                                                                setSelectedProviderForUser(cfg.provider_id || '')
                                                            }}
                                                            className={`text-[10px] px-2 py-0.5 border flex-shrink-0 transition-colors ${isEditing ? 'text-blue-400 border-blue-500/30 bg-blue-500/10' : 'text-gray-500 hover:text-gray-300 border-white/[0.07] hover:border-white/[0.15]'}`}
                                                        >
                                                            {isEditing ? 'Editando' : 'Trocar'}
                                                        </button>
                                                    </div>

                                                    {isEditing && (
                                                        <div className="px-4 pb-3 pt-2 border-t border-white/[0.05] flex items-center gap-2 bg-white/[0.01]">
                                                            <select
                                                                value={selectedProviderForUser}
                                                                onChange={e => setSelectedProviderForUser(e.target.value)}
                                                                className="flex-1 px-2 py-1.5 bg-white/[0.03] border border-white/[0.07] text-white text-xs focus:outline-none focus:border-blue-500/40"
                                                            >
                                                                <option value="">Padrão global</option>
                                                                {providers.filter(p => p.is_active).map(p => (
                                                                    <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                                                                ))}
                                                            </select>
                                                            <button onClick={() => setEditingPaymentUser(null)} className="px-2 py-1.5 text-gray-500 hover:text-gray-300 border border-white/[0.07] text-xs transition-colors">Cancelar</button>
                                                            <button
                                                                onClick={async () => {
                                                                    setAssigningProvider(true)
                                                                    try {
                                                                        const res = await fetch(`https://api.clicknich.com/api/superadmin/payment-config/${cfg.user_id}`, {
                                                                            method: 'PUT',
                                                                            headers: ADMIN_HEADERS,
                                                                            body: JSON.stringify({ provider_id: selectedProviderForUser || null, override_platform_default: !!selectedProviderForUser })
                                                                        })
                                                                        if (res.ok) { setEditingPaymentUser(null); fetchPaymentConfigs() }
                                                                        else { const body = await res.json().catch(() => ({})); alert(`Erro ao salvar (${res.status}): ${(body as any)?.error || JSON.stringify(body)}`) }
                                                                    } catch (e) { console.error(e) } finally { setAssigningProvider(false) }
                                                                }}
                                                                disabled={assigningProvider}
                                                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
                                                            >
                                                                {assigningProvider ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Salvar'}
                                                            </button>
                                                        </div>
                                                    )}
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
                        <div className="space-y-4">
                            {loadingPlatformConfig ? (
                                <div className="flex justify-center py-24"><div className="w-10 h-10 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>
                            ) : (
                                <>
                                    {/* Configurações numéricas */}
                                    <div className="bg-[#0d1829] border border-white/[0.06] overflow-hidden">
                                        <div className="px-4 py-3 border-b border-white/[0.05] flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-semibold text-white">Configurações da Plataforma</p>
                                                <p className="text-xs text-gray-500 mt-0.5">Valores aplicados globalmente para todos os usuários</p>
                                            </div>
                                        </div>
                                        <div className="divide-y divide-white/[0.04]">
                                            {[
                                                { key: 'platform_fee_percentage', label: 'Taxa da plataforma (%)', desc: 'Percentual cobrado sobre cada transação', suffix: '%' },
                                                { key: 'max_free_apps', label: 'Máx. apps no plano Free', desc: 'Limite de apps para usuários gratuitos', suffix: 'apps' },
                                                { key: 'min_withdrawal_amount', label: 'Saque mínimo', desc: 'Valor mínimo em USD para solicitar saque', suffix: 'USD' },
                                                { key: 'withdrawal_hold_days', label: 'Prazo de retenção (D+N)', desc: 'Dias antes de liberar saldo para saque', suffix: 'dias' },
                                            ].map(({ key, label, desc, suffix }) => (
                                                <div key={key} className="px-4 py-3 flex items-center gap-4 hover:bg-white/[0.02] transition-colors group">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-semibold text-white">{label}</p>
                                                        <p className="text-[11px] text-gray-600 mt-0.5">{desc}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="relative">
                                                            <input
                                                                type="number"
                                                                value={platformConfigEdits[key] ?? ''}
                                                                onChange={e => setPlatformConfigEdits(ed => ({ ...ed, [key]: e.target.value }))}
                                                                className="w-32 pr-10 pl-3 py-1.5 bg-white/[0.03] border border-white/[0.07] text-white text-sm focus:outline-none focus:border-blue-500/40 text-right"
                                                            />
                                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-600 pointer-events-none">{suffix}</span>
                                                        </div>
                                                        <button
                                                            onClick={() => saveSinglePlatformConfig(key)}
                                                            disabled={savingPlatformConfig === key}
                                                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
                                                        >
                                                            {savingPlatformConfig === key ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Salvar'}
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Feature flags */}
                                    {platformConfigEdits['feature_flags'] && typeof platformConfigEdits['feature_flags'] === 'object' && (
                                        <div className="bg-[#0d1829] border border-white/[0.06] overflow-hidden">
                                            <div className="px-4 py-3 border-b border-white/[0.05]">
                                                <p className="text-sm font-semibold text-white">Feature Flags</p>
                                                <p className="text-xs text-gray-500 mt-0.5">Ligue e desligue funcionalidades sem deploy</p>
                                            </div>
                                            <div className="divide-y divide-white/[0.04]">
                                                {Object.entries(platformConfigEdits['feature_flags'] as Record<string, boolean>).map(([flag]) => (
                                                    <div
                                                        key={flag}
                                                        className="px-4 py-3 flex items-center gap-3"
                                                    >
                                                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-gray-600" />
                                                        <span className="flex-1 text-xs font-semibold text-white capitalize">{flag.replace(/_/g, ' ')}</span>
                                                        <span className="text-[10px] px-2 py-0.5 font-semibold border flex-shrink-0 bg-white/[0.02] text-gray-500 border-white/[0.07]">
                                                            Inativo
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                </>
                            )}

                        </div>
                    )}

                    {/* ════════════════ AUDIT LOG TAB ════════════════ */}
                    {activeTab === 'audit' && (
                        <div className="space-y-3">
                            <div className="bg-[#0d1829] border border-white/[0.06] overflow-hidden">
                                <div className="px-4 py-3 border-b border-white/[0.05] flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <p className="text-sm font-semibold text-white">Audit Log</p>
                                        <p className="text-xs text-gray-500 mt-0.5">{auditTotal} ações registradas</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={auditActionFilter}
                                            onChange={e => { setAuditActionFilter(e.target.value); setTimeout(() => fetchAuditLog(1), 0) }}
                                            className="px-2 py-1.5 bg-[#0d1829] border border-white/[0.07] text-white text-xs focus:outline-none"
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
                                        <button onClick={() => fetchAuditLog(1)} className="px-3 py-1.5 bg-white/[0.03] hover:bg-white/[0.06] text-gray-400 hover:text-gray-200 text-xs border border-white/[0.07] transition-colors">
                                            Atualizar
                                        </button>
                                    </div>
                                </div>

                                {loadingAuditLog ? (
                                    <div className="px-4 py-6 flex justify-center"><div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>
                                ) : auditLog.length === 0 ? (
                                    <div className="px-4 py-6 text-center">
                                        <p className="text-xs text-gray-600">Nenhuma ação registrada ainda.</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-white/[0.04]">
                                        {auditLog.map((log) => {
                                            const ACTION_META: Record<string, { label: string; color: string; dot: string }> = {
                                                ban_user: { label: 'Banir usuário', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30', dot: 'bg-amber-400' },
                                                unban_user: { label: 'Desbanir usuário', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400' },
                                                delete_user: { label: 'Deletar usuário', color: 'bg-red-500/10 text-red-400 border-red-500/30', dot: 'bg-red-400' },
                                                change_payment_provider: { label: 'Provedor (legado)', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30', dot: 'bg-purple-400' },
                                                create_payment_provider: { label: 'Criar provedor', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30', dot: 'bg-blue-400' },
                                                update_payment_provider: { label: 'Atualizar provedor', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30', dot: 'bg-indigo-400' },
                                                delete_payment_provider: { label: 'Deletar provedor', color: 'bg-red-500/10 text-red-400 border-red-500/30', dot: 'bg-red-400' },
                                                update_platform_config: { label: 'Config. plataforma', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30', dot: 'bg-cyan-400' },
                                                create_announcement: { label: 'Criar comunicado', color: 'bg-violet-500/10 text-violet-400 border-violet-500/30', dot: 'bg-violet-400' },
                                                delete_announcement: { label: 'Deletar comunicado', color: 'bg-white/[0.04] text-gray-400 border-white/[0.1]', dot: 'bg-gray-500' },
                                                approve_bank_verification: { label: 'Aprovar verificação', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400' },
                                                reject_bank_verification: { label: 'Rejeitar verificação', color: 'bg-orange-500/10 text-orange-400 border-orange-500/30', dot: 'bg-orange-400' },
                                            }
                                            const meta = ACTION_META[log.action] || { label: log.action, color: 'bg-white/[0.03] text-gray-500 border-white/[0.07]', dot: 'bg-gray-600' }
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
                                                <div key={log.id} className="px-4 py-3 flex items-start gap-3 hover:bg-white/[0.02] transition-colors">
                                                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${meta.dot}`} />
                                                    <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-violet-600 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                                                        {log.admin_email?.charAt(0)?.toUpperCase() || 'A'}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                            <span className="text-xs font-semibold text-white">{log.admin_email?.split('@')[0] || '—'}</span>
                                                            <span className={`text-[10px] px-2 py-0.5 font-semibold border ${meta.color}`}>{meta.label}</span>
                                                            {log.target_type && (
                                                                <span className="text-[10px] text-gray-600 font-mono">{log.target_type} · {log.target_id?.slice(0, 8)}…</span>
                                                            )}
                                                        </div>
                                                        {detailStr !== '{}' && (
                                                            <p className="text-[10px] text-gray-600 font-mono truncate max-w-sm mt-0.5">
                                                                {detailStr.slice(0, 80)}{detailStr.length > 80 ? '…' : ''}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <p className="text-[10px] text-gray-500">{timeAgo}</p>
                                                        <p className="text-[10px] text-gray-700">{new Date(log.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}

                                {auditTotal > 50 && (
                                    <div className="px-4 py-3 border-t border-white/[0.05] flex items-center justify-between">
                                        <p className="text-xs text-gray-600">Página {auditPage} de {Math.ceil(auditTotal / 50)} · {auditTotal} registros</p>
                                        <div className="flex gap-2">
                                            <button disabled={auditPage === 1} onClick={() => fetchAuditLog(auditPage - 1)} className="px-3 py-1.5 bg-white/[0.03] hover:bg-white/[0.06] disabled:opacity-30 text-gray-400 text-xs border border-white/[0.07] transition-colors">← Anterior</button>
                                            <button disabled={auditPage * 50 >= auditTotal} onClick={() => fetchAuditLog(auditPage + 1)} className="px-3 py-1.5 bg-white/[0.03] hover:bg-white/[0.06] disabled:opacity-30 text-gray-400 text-xs border border-white/[0.07] transition-colors">Próxima →</button>
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
                                <div className="relative p-4 border-b border-white/[0.05]">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                                            ×
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-white">Reject App</h3>
                                            <p className="text-sm text-gray-400">{selectedApp.name}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="relative p-4">
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
                                <div className="relative p-4 border-t border-white/[0.05] flex gap-3 justify-end">
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
                        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                            <div className="backdrop-blur-xl bg-[#0d1117]/95 rounded-none shadow-2xl w-full max-w-md border border-white/[0.05]">
                                {/* Header */}
                                <div className="p-4 border-b border-white/[0.05]">
                                    <h3 className="text-base font-semibold text-white">Reject Product</h3>
                                    <p className="text-sm text-gray-500 mt-0.5">{selectedProduct.name}</p>
                                </div>

                                {/* Content */}
                                <div className="p-4">
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Rejection Reason
                                    </label>
                                    <textarea
                                        value={productRejectionReason}
                                        onChange={(e) => setProductRejectionReason(e.target.value)}
                                        placeholder="Explain why this product is being rejected..."
                                        rows={4}
                                        className="w-full p-3 bg-white/[0.03] border border-white/[0.08] rounded-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-500 text-white placeholder-gray-500 transition-all resize-none"
                                    />
                                    <p className="text-xs text-gray-500 mt-2">This message will be sent to the product owner</p>
                                </div>

                                {/* Footer */}
                                <div className="p-4 border-t border-white/[0.05] flex gap-3 justify-end">
                                    <button
                                        onClick={() => {
                                            setShowProductRejectModal(false)
                                            setSelectedProduct(null)
                                            setProductRejectionReason('')
                                        }}
                                        className="px-4 py-2 text-gray-300 bg-white/[0.05] hover:bg-white/[0.1] font-medium transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => handleRejectProduct()}
                                        disabled={!productRejectionReason.trim() || processingId === selectedProduct.id}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors"
                                    >
                                        {processingId === selectedProduct.id ? (
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
        </div>
    )
}
