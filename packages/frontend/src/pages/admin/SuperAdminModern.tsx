import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/i18n'
import Header from '@/components/Header'
import {
    Users,
    Smartphone,
    Globe,
    TrendingUp,
    Search,
    Filter,
    MoreVertical,
    Crown,
    Activity,
    Calendar,
    Mail,
    Eye,
    Zap,
    Star,
    ChevronRight,
    Building,
    CreditCard,
    Shield,
    CheckCircle,
    XCircle,
    Clock,
    FileText,
    AlertCircle,
    ExternalLink
} from 'lucide-react'

interface User {
    id: string
    email: string
    created_at: string
    app_count: number
    last_activity: string
    plan?: 'free' | 'pro' | 'premium'
}

interface PlatformStats {
    overview: {
        totalUsers: number
        totalApplications: number
        totalDomains: number
        totalProducts: number
        totalClients: number
    }
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

export default function SuperAdminModern() {
    const { t } = useI18n()
    const { user } = useAuthStore()
    const [stats, setStats] = useState<PlatformStats | null>(null)
    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedPlan, setSelectedPlan] = useState('all')
    const [activeTab, setActiveTab] = useState<'users' | 'verifications'>('users')
    const [bankVerifications, setBankVerifications] = useState<BankVerification[]>([])
    const [loadingVerifications, setLoadingVerifications] = useState(false)
    const [processingId, setProcessingId] = useState<string | null>(null)
    const [showRejectModal, setShowRejectModal] = useState(false)
    const [selectedVerification, setSelectedVerification] = useState<BankVerification | null>(null)
    const [rejectionReason, setRejectionReason] = useState('')
    const [showDetailsModal, setShowDetailsModal] = useState(false)

    useEffect(() => {
        if (user) {

            fetchStats()
            fetchUsers()
            fetchBankVerifications()
        }
    }, [user])

    const fetchStats = async () => {
        try {
            const response = await fetch('https://cgeqtodbisgwvhkaahiy.supabase.co/functions/v1/superadmin/stats', {
                headers: {
                    'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`,
                    'Content-Type': 'application/json',
                    'x-user-id': user?.id || ''
                }
            })

            if (response.ok) {
                const data = await response.json()
                setStats(data)
            } else {
                console.error('Error in stats response:', response.status, await response.text())
            }
        } catch (error) {
            console.error('Error loading statistics:', error)
        }
    }

    const fetchUsers = async () => {
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
                // Simular planos para demonstração
                const usersWithPlans = (data.users || []).map((user: User, index: number) => ({
                    ...user,
                    plan: index % 3 === 0 ? 'premium' : index % 2 === 0 ? 'pro' : 'free'
                }))
                setUsers(usersWithPlans)
            } else {
                console.error('Error in users response:', response.status, await response.text())
            }
        } catch (error) {
            console.error('Error loading users:', error)
        } finally {
            setLoading(false)
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

    const filteredUsers = users.filter(u => {
        const matchesSearch = u.email.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesPlan = selectedPlan === 'all' || u.plan === selectedPlan
        return matchesSearch && matchesPlan
    })

    const getPlanBadge = (plan?: string) => {
        switch (plan) {
            case 'premium':
                return (
                    <div className="inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-full text-xs font-semibold">
                        <Crown className="w-3 h-3" />
                        Premium
                    </div>
                )
            case 'pro':
                return (
                    <div className="inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-full text-xs font-semibold">
                        <Zap className="w-3 h-3" />
                        Pro
                    </div>
                )
            default:
                return (
                    <div className="inline-flex items-center px-2 py-1 bg-[#252941] text-gray-300 rounded-full text-xs font-medium">
                        Free
                    </div>
                )
        }
    }

    const getRevenueByPlan = (plan?: string) => {
        switch (plan) {
            case 'premium': return '$49/mês'
            case 'pro': return '$19/mês'
            default: return '$0/mês'
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0f1117]">
                <Header />
                <div className="flex items-center justify-center h-96">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-[#252941]">
            <Header />

            {/* Modern Header */}
            <div className="bg-[#1a1d2e]/95 backdrop-blur-sm border-b border-[#1e2139]/50 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                                {t('superadmin.platform_analytics')}
                            </h1>
                            <p className="text-gray-500 mt-1">{t('superadmin.subtitle')}</p>
                            {/* Debug info */}
                            <p className="text-xs text-gray-400 mt-1">Logged in as: {user?.email}</p>
                        </div>
                        <div className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-blue-600 text-white px-4 py-2 rounded-xl shadow-xl shadow-black/10 shadow-black/5">
                            <Crown className="w-4 h-4" />
                            <span className="text-sm font-medium">{t('superadmin.title')}</span>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-4 mt-6">
                        <button
                            onClick={() => setActiveTab('users')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'users'
                                ? 'bg-white/10 text-white'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <Users className="w-4 h-4" />
                            {t('superadmin.users')}
                        </button>
                        <button
                            onClick={() => setActiveTab('verifications')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'verifications'
                                ? 'bg-white/10 text-white'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <Shield className="w-4 h-4" />
                            {t('superadmin.bank_verifications')}
                            {bankVerifications.length > 0 && (
                                <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
                                    {bankVerifications.length}
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Modern Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="group bg-[#1a1d2e]/90 backdrop-blur-sm rounded-2xl p-6 shadow-xl shadow-black/10 shadow-black/5 border border-[#1e2139] hover:shadow-2xl hover:shadow-blue-500/10 shadow-black/10 hover:bg-[#1a1d2e]/95 transition-all duration-300">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500">{t('superadmin.total_users')}</p>
                                <p className="text-3xl font-bold text-gray-100 mt-2">{stats?.overview.totalUsers || 0}</p>
                                <div className="flex items-center mt-3 text-sm text-emerald-600">
                                    <TrendingUp className="w-4 h-4 mr-1" />
                                    <span>+12% vs last month</span>
                                </div>
                            </div>
                            <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                <Users className="w-7 h-7 text-white" />
                            </div>
                        </div>
                    </div>

                    <div className="group bg-[#1a1d2e]/90 backdrop-blur-sm rounded-2xl p-6 shadow-xl shadow-black/10 shadow-black/5 border border-[#1e2139] hover:shadow-2xl hover:shadow-blue-500/10 shadow-black/10 hover:bg-[#1a1d2e]/95 transition-all duration-300">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500">{t('superadmin.total_apps')}</p>
                                <p className="text-3xl font-bold text-gray-100 mt-2">{stats?.overview.totalApplications || 0}</p>
                                <div className="flex items-center mt-3 text-sm text-emerald-600">
                                    <TrendingUp className="w-4 h-4 mr-1" />
                                    <span>+8% vs last month</span>
                                </div>
                            </div>
                            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-pink-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                <Smartphone className="w-7 h-7 text-white" />
                            </div>
                        </div>
                    </div>

                    <div className="group bg-[#1a1d2e]/90 backdrop-blur-sm rounded-2xl p-6 shadow-xl shadow-black/10 shadow-black/5 border border-[#1e2139] hover:shadow-2xl hover:shadow-blue-500/10 shadow-black/10 hover:bg-[#1a1d2e]/95 transition-all duration-300">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500">{t('superadmin.domains')}</p>
                                <p className="text-3xl font-bold text-gray-100 mt-2">{stats?.overview.totalDomains || 0}</p>
                                <div className="flex items-center mt-3 text-sm text-emerald-600">
                                    <TrendingUp className="w-4 h-4 mr-1" />
                                    <span>+15% vs last month</span>
                                </div>
                            </div>
                            <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-teal-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                <Globe className="w-7 h-7 text-white" />
                            </div>
                        </div>
                    </div>

                    <div className="group bg-[#1a1d2e]/90 backdrop-blur-sm rounded-2xl p-6 shadow-xl shadow-black/10 shadow-black/5 border border-[#1e2139] hover:shadow-2xl hover:shadow-blue-500/10 shadow-black/10 hover:bg-[#1a1d2e]/95 transition-all duration-300">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500">{t('superadmin.monthly_revenue')}</p>
                                <p className="text-3xl font-bold text-gray-100 mt-2">
                                    ${((users.filter(u => u.plan === 'premium').length * 49) + (users.filter(u => u.plan === 'pro').length * 19)).toLocaleString()}
                                </p>
                                <div className="flex items-center mt-3 text-sm text-emerald-600">
                                    <TrendingUp className="w-4 h-4 mr-1" />
                                    <span>+23% vs last month</span>
                                </div>
                            </div>
                            <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                <CreditCard className="w-7 h-7 text-white" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Search and Filter */}
                {activeTab === 'users' && (
                    <>
                        <div className="bg-[#1a1d2e]/90 backdrop-blur-sm rounded-2xl p-6 shadow-xl shadow-black/10 shadow-black/5 border border-[#1e2139] mb-8">
                            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                                <div className="relative flex-1 max-w-md">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <input
                                        type="text"
                                        placeholder="Search users by email..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 bg-[#1a1d2e]/95 border border-[#1e2139] rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                    />
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                        <select
                                            value={selectedPlan}
                                            onChange={(e) => setSelectedPlan(e.target.value)}
                                            className="pl-9 pr-8 py-3 bg-[#1a1d2e]/95 border border-[#1e2139] rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none cursor-pointer"
                                        >
                                            <option value="all">{t('superadmin.all_plans')}</option>
                                            <option value="free">{t('superadmin.free')}</option>
                                            <option value="pro">{t('superadmin.pro')}</option>
                                            <option value="premium">{t('superadmin.premium')}</option>
                                        </select>
                                    </div>
                                    <div className="text-sm text-gray-500 bg-[#1a1d2e]/95 px-3 py-3 rounded-xl border border-[#1e2139]">
                                        {filteredUsers.length} users
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Users Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {filteredUsers.map((user) => (
                                <div key={user.id} className="group bg-[#1a1d2e]/90 backdrop-blur-sm rounded-2xl p-6 shadow-xl shadow-black/10 shadow-black/5 border border-[#1e2139] hover:shadow-2xl hover:shadow-blue-500/10 shadow-black/10 hover:bg-[#1a1d2e]/95 transition-all duration-300">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-semibold text-lg">
                                                {user.email.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-100 truncate max-w-[160px]">{user.email}</p>
                                                <p className="text-sm text-gray-500">
                                                    {new Date(user.created_at).toLocaleDateString('pt-BR')}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button className="p-2 hover:bg-[#252941] rounded-lg transition-colors">
                                                <MoreVertical className="w-4 h-4 text-gray-400" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-600">{t('superadmin.plan')}</span>
                                            {getPlanBadge(user.plan)}
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-600">Apps</span>
                                            <div className="flex items-center gap-1 text-sm font-semibold text-gray-100">
                                                <Building className="w-4 h-4 text-gray-400" />
                                                {user.app_count}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-600">{t('superadmin.revenue')}</span>
                                            <div className="text-sm font-semibold text-emerald-600">
                                                {getRevenueByPlan(user.plan)}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-2 border-t border-[#1e2139]">
                                            <span className="text-xs text-gray-500">{t('superadmin.last_activity')}</span>
                                            <span className="text-xs text-gray-600">
                                                {new Date(user.last_activity).toLocaleDateString('pt-BR')}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-[#1e2139]">
                                        <button className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-gradient-to-r from-indigo-500 to-blue-600 text-white rounded-xl hover:shadow-md transition-all duration-300 opacity-0 group-hover:opacity-100">
                                            <Eye className="w-4 h-4" />
                                            <span className="text-sm font-medium">{t('superadmin.view_details')}</span>
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {filteredUsers.length === 0 && (
                            <div className="text-center py-12">
                                <div className="w-16 h-16 bg-[#252941] rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Users className="w-8 h-8 text-gray-400" />
                                </div>
                                <p className="text-gray-600">{t('superadmin.no_users')}</p>
                                <p className="text-sm text-gray-500 mt-1">{t('superadmin.try_adjusting_search')}</p>
                            </div>
                        )}
                    </>
                )}

                {/* Bank Verifications Tab */}
                {activeTab === 'verifications' && (
                    <div className="space-y-6">
                        <div className="bg-[#1a1d2e]/90 backdrop-blur-sm rounded-2xl p-6 shadow-xl shadow-black/10 border border-[#1e2139]">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-xl font-semibold text-gray-100">{t('superadmin.pending_verifications')}</h2>
                                    <p className="text-sm text-gray-500 mt-1">{t('superadmin.review_accounts_desc')}</p>
                                </div>
                                <button
                                    onClick={fetchBankVerifications}
                                    className="px-4 py-2 bg-[#252941] hover:bg-[#353a5a] text-gray-300 rounded-lg text-sm font-medium transition-colors"
                                >
                                    {t('superadmin.refresh')}
                                </button>
                            </div>

                            {loadingVerifications ? (
                                <div className="text-center py-12">
                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto"></div>
                                    <p className="text-gray-500 text-sm mt-4">{t('superadmin.loading_verifications')}</p>
                                </div>
                            ) : bankVerifications.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="w-16 h-16 bg-[#252941] rounded-full flex items-center justify-center mx-auto mb-4">
                                        <CheckCircle className="w-8 h-8 text-green-400" />
                                    </div>
                                    <p className="text-gray-100 font-medium">{t('superadmin.all_caught_up')}</p>
                                    <p className="text-sm text-gray-500 mt-1">{t('superadmin.no_pending_verifications')}</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {bankVerifications.map((verification) => (
                                        <div key={verification.id} className="bg-[#252941]/50 border border-[#353a5a] rounded-xl p-5">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-start gap-4">
                                                    <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                                                        {verification.account_holder_name?.charAt(0) || 'U'}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-semibold text-gray-100">{verification.account_holder_name || 'Unknown'}</h3>
                                                        <p className="text-sm text-gray-400">{verification.user_email}</p>
                                                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                                            <span className="flex items-center gap-1">
                                                                <Building className="w-3 h-3" />
                                                                {verification.bank_name}
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                <Clock className="w-3 h-3" />
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
                                                <div className="flex items-center gap-1 px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs font-medium">
                                                    <Clock className="w-3 h-3" />
                                                    {t('superadmin.pending_review')}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 p-4 bg-[#1a1d2e] rounded-lg">
                                                <div>
                                                    <p className="text-xs text-gray-500">{t('superadmin.bank_country')}</p>
                                                    <p className="text-sm text-gray-200">{verification.bank_country || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500">{t('superadmin.account_type')}</p>
                                                    <p className="text-sm text-gray-200 capitalize">{verification.account_type || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500">{t('superadmin.currency')}</p>
                                                    <p className="text-sm text-gray-200">{verification.currency || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500">{t('superadmin.account')}</p>
                                                    <p className="text-sm text-gray-200">
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
                                                        <FileText className="w-3 h-3" />
                                                        {t('superadmin.id_document')}
                                                        <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                )}
                                                {verification.address_proof_url && (
                                                    <a
                                                        href={verification.address_proof_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 text-purple-400 rounded-lg text-xs hover:bg-purple-500/20 transition-colors"
                                                    >
                                                        <FileText className="w-3 h-3" />
                                                        {t('superadmin.address_proof')}
                                                        <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                )}
                                                {verification.bank_statement_url && (
                                                    <a
                                                        href={verification.bank_statement_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 text-green-400 rounded-lg text-xs hover:bg-green-500/20 transition-colors"
                                                    >
                                                        <FileText className="w-3 h-3" />
                                                        {t('superadmin.bank_statement')}
                                                        <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                )}
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-[#353a5a]">
                                                <button
                                                    onClick={() => openDetailsModal(verification)}
                                                    className="flex items-center gap-2 px-4 py-2 bg-[#353a5a] hover:bg-[#454b6a] text-gray-200 rounded-lg text-sm font-medium transition-colors"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                    {t('superadmin.view_details')}
                                                </button>
                                                <button
                                                    onClick={() => handleApproveVerification(verification.id)}
                                                    disabled={processingId === verification.id}
                                                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                                                >
                                                    {processingId === verification.id ? (
                                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                    ) : (
                                                        <CheckCircle className="w-4 h-4" />
                                                    )}
                                                    {t('superadmin.approve')}
                                                </button>
                                                <button
                                                    onClick={() => openRejectModal(verification)}
                                                    disabled={processingId === verification.id}
                                                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                                                >
                                                    <XCircle className="w-4 h-4" />
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
            </div>

            {/* Reject Modal */}
            {showRejectModal && selectedVerification && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-[#1a1d2e] rounded-xl shadow-2xl w-full max-w-md">
                        <div className="p-6 border-b border-[#1e2139]">
                            <h3 className="text-lg font-semibold text-gray-100">{t('superadmin.reject_bank_account')}</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                Rejecting: {selectedVerification.account_holder_name}'s account
                            </p>
                        </div>
                        <div className="p-6">
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                {t('superadmin.rejection_reason')} *
                            </label>
                            <textarea
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder={t('superadmin.enter_rejection_reason')}
                                rows={4}
                                className="w-full p-3 bg-[#252941] border border-[#353a5a] rounded-lg focus:ring-2 focus:ring-red-400/50 focus:border-red-500 text-gray-100"
                            />
                        </div>
                        <div className="p-6 border-t border-[#1e2139] flex gap-3 justify-end">
                            <button
                                onClick={() => {
                                    setShowRejectModal(false)
                                    setSelectedVerification(null)
                                    setRejectionReason('')
                                }}
                                className="px-4 py-2 text-gray-300 bg-[#252941] hover:bg-[#353a5a] rounded-lg font-medium transition-colors"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={handleRejectVerification}
                                disabled={processingId === selectedVerification.id}
                                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
                            >
                                {processingId === selectedVerification.id ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                ) : (
                                    <XCircle className="w-4 h-4" />
                                )}
                                {t('superadmin.reject_account')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Details Modal */}
            {showDetailsModal && selectedVerification && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-[#1a1d2e] rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-[#1e2139] sticky top-0 bg-[#1a1d2e] z-10">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-100">{t('superadmin.verification_details')}</h3>
                                    <p className="text-sm text-gray-500 mt-1">{selectedVerification.user_email}</p>
                                </div>
                                <button
                                    onClick={() => {
                                        setShowDetailsModal(false)
                                        setSelectedVerification(null)
                                    }}
                                    className="text-gray-400 hover:text-gray-100"
                                >
                                    <XCircle className="w-6 h-6" />
                                </button>
                            </div>
                        </div>
                        <div className="p-6 space-y-6">
                            {/* Account Holder */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">{t('superadmin.account_holder')}</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-gray-500">{t('superadmin.full_name')}</p>
                                        <p className="text-sm text-gray-200">{selectedVerification.account_holder_name || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">{t('superadmin.date_of_birth')}</p>
                                        <p className="text-sm text-gray-200">{selectedVerification.date_of_birth || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">{t('superadmin.phone_number')}</p>
                                        <p className="text-sm text-gray-200">{selectedVerification.phone_number || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Address */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">{t('superadmin.address')}</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-gray-500">{t('superadmin.city')}</p>
                                        <p className="text-sm text-gray-200">{selectedVerification.city || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">{t('superadmin.state')}</p>
                                        <p className="text-sm text-gray-200">{selectedVerification.state || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">{t('superadmin.country')}</p>
                                        <p className="text-sm text-gray-200">{selectedVerification.country || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Bank Details */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">{t('superadmin.bank_account')}</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-gray-500">{t('superadmin.bank_name')}</p>
                                        <p className="text-sm text-gray-200">{selectedVerification.bank_name || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">{t('superadmin.bank_country')}</p>
                                        <p className="text-sm text-gray-200">{selectedVerification.bank_country || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">{t('superadmin.account_type')}</p>
                                        <p className="text-sm text-gray-200 capitalize">{selectedVerification.account_type || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">{t('superadmin.currency')}</p>
                                        <p className="text-sm text-gray-200">{selectedVerification.currency || 'N/A'}</p>
                                    </div>
                                    {selectedVerification.account_number && (
                                        <div>
                                            <p className="text-xs text-gray-500">{t('superadmin.account_number')}</p>
                                            <p className="text-sm text-gray-200 font-mono">{selectedVerification.account_number}</p>
                                        </div>
                                    )}
                                    {selectedVerification.iban && (
                                        <div>
                                            <p className="text-xs text-gray-500">IBAN</p>
                                            <p className="text-sm text-gray-200 font-mono">{selectedVerification.iban}</p>
                                        </div>
                                    )}
                                    {selectedVerification.bic_swift && (
                                        <div>
                                            <p className="text-xs text-gray-500">BIC/SWIFT</p>
                                            <p className="text-sm text-gray-200 font-mono">{selectedVerification.bic_swift}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Documents */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">{t('superadmin.uploaded_documents')}</h4>
                                <div className="flex flex-wrap gap-3">
                                    {selectedVerification.id_document_url ? (
                                        <a
                                            href={selectedVerification.id_document_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-lg text-sm hover:bg-blue-500/20 transition-colors"
                                        >
                                            <FileText className="w-4 h-4" />
                                            {t('superadmin.id_document')} ↗
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                    ) : (
                                        <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg text-sm">
                                            <AlertCircle className="w-4 h-4" />
                                            {t('superadmin.id_document_missing')}
                                        </div>
                                    )}
                                    {selectedVerification.address_proof_url ? (
                                        <a
                                            href={selectedVerification.address_proof_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded-lg text-sm hover:bg-purple-500/20 transition-colors"
                                        >
                                            <FileText className="w-4 h-4" />
                                            {t('superadmin.address_proof')} ↗
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                    ) : (
                                        <div className="flex items-center gap-2 px-4 py-2 bg-gray-500/10 text-gray-400 border border-gray-500/30 rounded-lg text-sm">
                                            <FileText className="w-4 h-4" />
                                            {t('superadmin.address_proof_not_provided')}
                                        </div>
                                    )}
                                    {selectedVerification.bank_statement_url ? (
                                        <a
                                            href={selectedVerification.bank_statement_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-400 border border-green-500/30 rounded-lg text-sm hover:bg-green-500/20 transition-colors"
                                        >
                                            <FileText className="w-4 h-4" />
                                            {t('superadmin.bank_statement')} ↗
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                    ) : (
                                        <div className="flex items-center gap-2 px-4 py-2 bg-gray-500/10 text-gray-400 border border-gray-500/30 rounded-lg text-sm">
                                            <FileText className="w-4 h-4" />
                                            {t('superadmin.bank_statement_not_provided')}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-[#1e2139] flex gap-3 justify-end sticky bottom-0 bg-[#1a1d2e]">
                            <button
                                onClick={() => {
                                    setShowDetailsModal(false)
                                    openRejectModal(selectedVerification)
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                            >
                                <XCircle className="w-4 h-4" />
                                {t('superadmin.reject')}
                            </button>
                            <button
                                onClick={() => {
                                    handleApproveVerification(selectedVerification.id)
                                    setShowDetailsModal(false)
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                            >
                                <CheckCircle className="w-4 h-4" />
                                {t('superadmin.approve_account')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}