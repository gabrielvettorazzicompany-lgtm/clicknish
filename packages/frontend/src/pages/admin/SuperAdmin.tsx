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

export default function SuperAdmin() {
    const { t } = useI18n()
    const { user } = useAuthStore()
    const [activeTab, setActiveTab] = useState('overview')
    const [reviewSubTab, setReviewSubTab] = useState<'apps' | 'products'>('apps')
    const [stats, setStats] = useState<PlatformStats | null>(null)
    const [users, setUsers] = useState<User[]>([])
    const [applications, setApplications] = useState<Application[]>([])
    const [domains, setDomains] = useState<any[]>([])
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

    useEffect(() => {
        if (user) {
            fetchStats()
            fetchBankVerifications()
            fetchPendingProducts()
            fetchPendingApps()
        }
    }, [user])

    useEffect(() => {
        if (activeTab === 'users' && users.length === 0) {
            fetchUsers()
        } else if (activeTab === 'applications' && applications.length === 0) {
            fetchApplications()
        } else if (activeTab === 'domains' && domains.length === 0) {
            fetchDomains()
        } else if (activeTab === 'plans' && plans.length === 0) {
            fetchPlans()
        } else if (activeTab === 'verifications') {
            fetchBankVerifications()
        } else if (activeTab === 'reviews') {
            fetchPendingProducts()
            fetchPendingApps()
        }
    }, [activeTab])

    const fetchStats = async () => {
        try {
            setLoading(true)
            const response = await fetch('https://cgeqtodbisgwvhkaahiy.supabase.co/functions/v1/superadmin/stats', {
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

            const url = `https://cgeqtodbisgwvhkaahiy.supabase.co/functions/v1/superadmin/users${params.toString() ? '?' + params.toString() : ''}`
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

            const response = await fetch('https://cgeqtodbisgwvhkaahiy.supabase.co/functions/v1/superadmin/applications', {
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

    const fetchDomains = async () => {
        try {
            const response = await fetch('https://cgeqtodbisgwvhkaahiy.supabase.co/functions/v1/superadmin/domains', {
                headers: {
                    'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`,
                    'Content-Type': 'application/json',
                    'x-user-id': user?.id || ''
                }
            })

            if (response.ok) {
                const data = await response.json()
                setDomains(data)
            }
        } catch (error) {
            console.error('Error loading domains:', error)
        }
    }

    const fetchPlans = async () => {
        try {

            const response = await fetch('https://cgeqtodbisgwvhkaahiy.supabase.co/functions/v1/superadmin/users', {
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
            const response = await fetch('https://cgeqtodbisgwvhkaahiy.supabase.co/functions/v1/superadmin/bank-verifications', {
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
            const response = await fetch('https://cgeqtodbisgwvhkaahiy.supabase.co/functions/v1/superadmin/pending-products', {
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
            const response = await fetch(`https://cgeqtodbisgwvhkaahiy.supabase.co/functions/v1/superadmin/product-details/${productId}`, {
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
            const response = await fetch(`https://cgeqtodbisgwvhkaahiy.supabase.co/functions/v1/superadmin/products/${productId}/approve`, {
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
                const error = await response.json()
                alert(`Error: ${error.error}`)
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
            const response = await fetch(`https://cgeqtodbisgwvhkaahiy.supabase.co/functions/v1/superadmin/products/${selectedProduct.id}/reject`, {
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
                const error = await response.json()
                alert(`Error: ${error.error}`)
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
            const response = await fetch('https://cgeqtodbisgwvhkaahiy.supabase.co/functions/v1/superadmin/pending-apps', {
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
            const response = await fetch(`https://cgeqtodbisgwvhkaahiy.supabase.co/functions/v1/superadmin/apps/${appId}/approve`, {
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
                const error = await response.json()
                alert(`Error: ${error.error}`)
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
            const response = await fetch(`https://cgeqtodbisgwvhkaahiy.supabase.co/functions/v1/superadmin/apps/${selectedApp.id}/reject`, {
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
                const error = await response.json()
                alert(`Error: ${error.error}`)
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
            const response = await fetch(`https://cgeqtodbisgwvhkaahiy.supabase.co/functions/v1/superadmin/bank-verifications/${verificationId}/approve`, {
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
            const response = await fetch(`https://cgeqtodbisgwvhkaahiy.supabase.co/functions/v1/superadmin/bank-verifications/${selectedVerification.id}/reject`, {
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
            const response = await fetch(`https://cgeqtodbisgwvhkaahiy.supabase.co/functions/v1/superadmin/user-details/${userId}`, {
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
            const response = await fetch(`https://cgeqtodbisgwvhkaahiy.supabase.co/functions/v1/superadmin/user/${userId}`, {
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
            const response = await fetch(`https://cgeqtodbisgwvhkaahiy.supabase.co/functions/v1/superadmin/user/${userId}/ban`, {
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
                    <div className="backdrop-blur-xl bg-blue-500/5 border border-blue-500/20 rounded-2xl p-6">
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

    return (
        <div className="min-h-screen bg-[#030712] relative overflow-hidden">
            {/* Background gradient effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-[30%] -left-[15%] w-[50%] h-[50%] rounded-full bg-gradient-to-br from-blue-600/8 via-blue-500/4 to-transparent blur-3xl" />
                <div className="absolute -bottom-[30%] -right-[15%] w-[50%] h-[50%] rounded-full bg-gradient-to-br from-blue-600/8 via-blue-500/4 to-transparent blur-3xl" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40%] h-[40%] rounded-full bg-gradient-to-br from-cyan-500/3 to-transparent blur-3xl" />
            </div>

            {/* Grid pattern */}
            <div
                className="absolute inset-0 opacity-[0.015] pointer-events-none"
                style={{
                    backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
                    backgroundSize: '60px 60px'
                }}
            />

            {/* Header */}
            <div className="relative z-10 border-b border-white/[0.05]">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div>
                        <span className="text-white font-bold text-lg tracking-tight">{t('superadmin.admin_panel')}</span>
                        <p className="text-gray-500 text-xs">{t('superadmin.platform_management')}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-gray-300 text-sm font-medium">{user?.email}</p>
                            <p className="text-gray-500 text-xs">{t('superadmin.administrator')}</p>
                        </div>
                        <button
                            onClick={async () => {
                                const { useAuthStore } = await import('@/stores/authStore')
                                const { supabase } = await import('@/services/supabase')
                                await supabase.auth.signOut()
                                useAuthStore.getState().setUser(null)
                                window.location.href = '/super-login'
                            }}
                            className="px-4 py-2 bg-white/[0.05] hover:bg-white/[0.1] text-gray-300 rounded-xl text-sm transition-all duration-200 border border-white/[0.08] backdrop-blur-sm"
                        >
                            {t('superadmin.sign_out')}
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-8 relative z-10">
                {/* Modern Tabs */}
                <div className="mb-8">
                    <div className="backdrop-blur-xl bg-white/[0.02] rounded-2xl p-1.5 inline-flex gap-1 border border-white/[0.05]">
                        {[
                            { id: 'overview', name: t('superadmin.overview') },
                            { id: 'users', name: t('superadmin.users') },
                            { id: 'applications', name: t('superadmin.apps_tab') },
                            { id: 'verifications', name: t('superadmin.bank_verifications'), badge: bankVerifications.length },
                            { id: 'reviews', name: t('superadmin.products_tab'), badge: (pendingApps.length + pendingProducts.length) }
                        ].map((tab) => {
                            const badge = (tab as any).badge
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-xs transition-all duration-300 ${activeTab === tab.id
                                        ? 'bg-white/[0.08] text-white border border-white/[0.1]'
                                        : 'text-gray-400 hover:text-white hover:bg-white/[0.03]'
                                        }`}
                                >
                                    {tab.name}
                                    {badge > 0 && (
                                        <span className="bg-blue-500/20 text-blue-300 text-xs px-2 py-0.5 rounded-full font-medium">
                                            {badge}
                                        </span>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Overview Tab */}
                {activeTab === 'overview' && stats && (
                    <div className="space-y-6">
                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="backdrop-blur-xl bg-white/[0.02] p-5 rounded-2xl border border-white/[0.05] hover:border-blue-500/40 transition-all duration-300 group relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <p className="text-2xl font-bold text-blue-400 mb-1">{stats.overview.totalUsers}</p>
                                <p className="text-xs text-gray-400 font-medium">{t('superadmin.total_users')}</p>
                            </div>

                            <div className="backdrop-blur-xl bg-white/[0.02] p-5 rounded-2xl border border-white/[0.05] hover:border-blue-500/40 transition-all duration-300 group relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <p className="text-2xl font-bold text-blue-400 mb-1">{stats.overview.totalApplications}</p>
                                <p className="text-xs text-gray-400 font-medium">{t('superadmin.applications')}</p>
                            </div>
                        </div>

                        {/* Growth Chart */}
                        <div className="backdrop-blur-xl bg-white/[0.02] rounded-2xl p-6 border border-white/[0.05]">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="text-lg font-semibold text-white">{t('superadmin.app_growth')}</h3>
                                    <p className="text-sm text-gray-500">{t('superadmin.last_6_months')}</p>
                                </div>
                            </div>
                            <div className="h-48 flex items-end justify-between gap-3">
                                {Object.entries(stats.charts.monthlyApps).slice(-6).map(([month, count]: [string, any], index) => {
                                    const maxValue = Math.max(...Object.values(stats.charts.monthlyApps).map(v => Number(v)))
                                    const heightPercent = maxValue > 0 ? (count / maxValue) * 100 : 0
                                    const monthName = new Date(month + '-01').toLocaleDateString('en-US', { month: 'short' })

                                    return (
                                        <div key={month} className="flex-1 flex flex-col items-center gap-2 group">
                                            <div className="relative w-full bg-white/[0.03] rounded-t-xl overflow-hidden" style={{ height: '160px' }}>
                                                <div
                                                    className="absolute bottom-0 w-full bg-gradient-to-t from-blue-600 via-blue-500 to-indigo-400 rounded-t-xl transition-all duration-700"
                                                    style={{
                                                        height: `${heightPercent}%`,
                                                        animationDelay: `${index * 100}ms`
                                                    }}
                                                />
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <span className="text-white font-bold text-sm drop-shadow-lg">{count}</span>
                                                </div>
                                            </div>
                                            <span className="text-xs text-gray-500 font-medium">{monthName}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* Users Tab */}
                {activeTab === 'users' && (
                    <>
                        <div className="backdrop-blur-xl bg-white/[0.02] rounded-2xl border border-white/[0.05]">
                            <div className="p-6">
                                <h3 className="text-lg font-semibold text-white mb-6">{t('superadmin.platform_users')}</h3>

                                {/* Search Filters */}
                                <div className="mb-6 flex gap-3">
                                    <div className="relative flex-1">
                                        <input
                                            type="text"
                                            placeholder={t('superadmin.search_by_name_email')}
                                            value={searchQuery}
                                            onChange={(e) => {
                                                setSearchQuery(e.target.value)
                                                fetchUsers()
                                            }}
                                            className="w-full px-4 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 text-sm"
                                        />
                                    </div>

                                    <select
                                        value={planFilter}
                                        onChange={(e) => {
                                            setPlanFilter(e.target.value)
                                            fetchUsers()
                                        }}
                                        className="px-4 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 text-sm"
                                    >
                                        <option value="all">{t('superadmin.all_plans')}</option>
                                        <option value="free">{t('superadmin.free')}</option>
                                        <option value="pro">{t('superadmin.pro')}</option>
                                        <option value="advanced">{t('superadmin.advanced')}</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    {users.map((userItem) => (
                                        <button
                                            key={userItem.id}
                                            onClick={() => {
                                                setSelectedUser(userItem)
                                                fetchUserDetails(userItem.id)
                                            }}
                                            className="w-full flex items-center justify-between p-4 bg-[#252941] hover:bg-[#2d3352] rounded-lg border border-[#1e2139] hover:border-blue-500/30 transition-all text-left group"
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
                                <div className="backdrop-blur-xl bg-[#0d1117]/95 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-white/[0.05]" onClick={(e) => e.stopPropagation()}>
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
                                                            <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 rounded-2xl p-6 hover:border-emerald-500/40 transition-all duration-300 group">
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
                                                            <div className="bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-500/20 rounded-2xl p-6 hover:border-red-500/40 transition-all duration-300 group">
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
                                                            <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20 rounded-2xl p-6 hover:border-amber-500/40 transition-all duration-300 group">
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
                                                            <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-500/20 rounded-2xl p-6 hover:border-indigo-500/40 transition-all duration-300">
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
                                                            onClick={() => handleDeleteUser(selectedUser.id)}
                                                            className="px-4 py-2.5 bg-blue-800 hover:bg-blue-900 text-white rounded-lg font-medium text-sm transition-all"
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

                {/* Applications Tab */}
                {activeTab === 'applications' && (
                    <div className="backdrop-blur-xl bg-white/[0.02] rounded-2xl border border-white/[0.05]">
                        <div className="p-6">
                            <h3 className="text-lg font-semibold text-white mb-4">
                                {t('superadmin.created_applications')}
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="min-w-full">
                                    <thead>
                                        <tr className="border-b border-white/[0.05]">
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                App
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Owner
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Type
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Created
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/[0.05]">
                                        {applications.map((app) => (
                                            <tr key={app.id} className="hover:bg-white/[0.02] transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-medium text-white">{app.name}</div>
                                                    <div className="text-xs text-gray-500">{app.slug}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                                                    {app.owner_email}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                                        {app.app_type || 'app'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {new Date(app.created_at).toLocaleDateString('en-US')}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* Domains Tab */}
                {activeTab === 'domains' && (
                    <div className="backdrop-blur-xl bg-white/[0.02] rounded-2xl border border-white/[0.05]">
                        <div className="p-6">
                            <h3 className="text-lg font-semibold text-white mb-4">
                                {t('superadmin.custom_domains')}
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="min-w-full">
                                    <thead>
                                        <tr className="border-b border-white/[0.05]">
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Domain
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                App
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Status
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Created
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/[0.05]">
                                        {domains.map((domain) => (
                                            <tr key={domain.id} className="hover:bg-white/[0.02] transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-medium text-white">{domain.domain}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                                                    {domain.applications?.name || 'N/A'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        {getStatusBadge(domain.status)}
                                                        <span className="text-sm text-gray-400 capitalize">{domain.status}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {new Date(domain.created_at).toLocaleDateString('en-US')}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* Plans Tab */}
                {activeTab === 'plans' && (
                    <div className="backdrop-blur-xl bg-white/[0.02] rounded-2xl border border-white/[0.05]">
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
                    <div className="space-y-6">
                        <div className="backdrop-blur-xl bg-white/[0.02] rounded-2xl border border-white/[0.05] p-6">
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
                        {/* Sub-tabs for Apps and Products */}
                        <div className="backdrop-blur-xl bg-white/[0.02] rounded-xl p-1 inline-flex gap-1 border border-white/[0.05]">
                            <button
                                onClick={() => setReviewSubTab('apps')}
                                className={`px-4 py-2 rounded-lg font-medium text-xs transition-all ${reviewSubTab === 'apps'
                                    ? 'bg-white/[0.08] text-white border border-white/[0.1]'
                                    : 'text-gray-400 hover:text-white hover:bg-white/[0.03]'
                                    }`}
                            >
                                Apps {pendingApps.length > 0 && (
                                    <span className="ml-2 px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded-full text-xs">
                                        {pendingApps.length}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => setReviewSubTab('products')}
                                className={`px-4 py-2 rounded-lg font-medium text-xs transition-all ${reviewSubTab === 'products'
                                    ? 'bg-white/[0.08] text-white border border-white/[0.1]'
                                    : 'text-gray-400 hover:text-white hover:bg-white/[0.03]'
                                    }`}
                            >
                                Products {pendingProducts.length > 0 && (
                                    <span className="ml-2 px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded-full text-xs">
                                        {pendingProducts.length}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Apps Review Section */}
                        {reviewSubTab === 'apps' && (
                            <div className="space-y-6">
                                {loadingApps ? (
                                    <div className="backdrop-blur-xl bg-white/[0.02] rounded-2xl border border-white/[0.05] p-16 flex flex-col items-center justify-center">
                                        <div className="w-12 h-12 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                                        <p className="text-gray-400">{t('superadmin.loading_apps')}</p>
                                    </div>
                                ) : pendingApps.length === 0 ? (
                                    <div className="backdrop-blur-xl bg-gradient-to-br from-blue-500/5 via-transparent to-transparent rounded-2xl border border-blue-500/20 p-12 text-center">
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
                                                className="backdrop-blur-xl bg-white/[0.02] rounded-2xl border border-white/[0.05] overflow-hidden hover:border-blue-500/30 transition-all duration-300 group"
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
                        {reviewSubTab === 'products' && (
                            <div className="space-y-6">
                                {loadingProducts ? (
                                    <div className="backdrop-blur-xl bg-white/[0.02] rounded-2xl border border-white/[0.05] p-16 flex flex-col items-center justify-center">
                                        <div className="w-12 h-12 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                                        <p className="text-gray-400">{t('superadmin.loading_products')}</p>
                                    </div>
                                ) : pendingProducts.length === 0 ? (
                                    <div className="backdrop-blur-xl bg-gradient-to-br from-blue-500/5 via-transparent to-transparent rounded-2xl border border-blue-500/20 p-12 text-center">
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
                                                className="backdrop-blur-xl bg-white/[0.02] rounded-2xl border border-white/[0.05] overflow-hidden hover:border-blue-500/30 transition-all duration-300 group"
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
                        <div className="backdrop-blur-xl bg-[#0d1117]/95 rounded-2xl shadow-2xl w-full max-w-md border border-white/[0.05]">
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
                        <div className="backdrop-blur-xl bg-[#0d1117]/95 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-white/[0.05]">
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
                        <div className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col rounded-3xl shadow-2xl">
                            {/* Background gradient effect */}
                            <div className="absolute inset-0 bg-[#0a0f1a] rounded-3xl" />
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
                                        <div className="bg-gradient-to-br from-white/[0.05] to-white/[0.02] rounded-2xl p-6 border border-white/[0.08] mb-6">
                                            <div className="flex gap-6">
                                                <div className="relative flex-shrink-0">
                                                    <div className="w-36 h-36 rounded-2xl overflow-hidden ring-4 ring-white/[0.08] shadow-2xl">
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
                                                <div className="relative overflow-hidden p-5 bg-gradient-to-br from-blue-600/10 via-blue-500/5 to-transparent rounded-2xl border border-blue-500/20 group hover:border-blue-500/40 transition-all">
                                                    <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full blur-2xl" />
                                                    <p className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-blue-500 bg-clip-text text-transparent">{productDetails.stats.totalModules}</p>
                                                    <p className="text-sm text-gray-400 font-medium mt-1">Modules</p>
                                                </div>
                                                <div className="relative overflow-hidden p-5 bg-gradient-to-br from-blue-600/10 via-blue-500/5 to-transparent rounded-2xl border border-blue-500/20 group hover:border-blue-500/40 transition-all">
                                                    <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full blur-2xl" />
                                                    <p className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-blue-500 bg-clip-text text-transparent">{productDetails.stats.totalLessons}</p>
                                                    <p className="text-sm text-gray-400 font-medium mt-1">Lessons</p>
                                                </div>
                                                <div className="relative overflow-hidden p-5 bg-gradient-to-br from-blue-600/10 via-blue-500/5 to-transparent rounded-2xl border border-blue-500/20 group hover:border-blue-500/40 transition-all">
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
                                            <div className="mb-6 p-10 bg-gradient-to-br from-white/[0.02] to-transparent rounded-2xl border border-white/[0.05] text-center">
                                                <div className="w-16 h-16 mx-auto mb-4 bg-white/[0.03] rounded-2xl flex items-center justify-center">
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

                {/* App Reject Modal */}
                {showAppRejectModal && selectedApp && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
                        <div className="relative w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden">
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
                        <div className="relative w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden">
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