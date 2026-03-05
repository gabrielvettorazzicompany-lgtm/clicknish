import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShoppingBag, Search } from 'lucide-react'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/i18n'
import { useDebounce } from '@/hooks/useDebounce'
import Sidebar from '@/components/Sidebar'
import ProductWizard from '@/components/common/ProductWizard'
import AppCard from '@/components/common/AppCard'
import ProductCard from '@/components/common/ProductCard'
import Header from '@/components/Header'

interface Application {
    id?: string
    name: string
    slug: string
    created_at: string
    logo_url?: string
    show_names?: boolean
    highlight_community?: boolean
    free_registration?: boolean
    app_type?: string
    language?: string
    theme?: string
}

interface Product {
    id: string
    name: string
    slug: string
    description?: string
    price: number
    currency?: string
    category: string
    status: 'active' | 'inactive' | 'draft'
    created_at: string
    image_url?: string
    sales_count: number
    delivery_type?: string
    review_status?: 'draft' | 'pending_review' | 'approved' | 'rejected'
    review_notes?: string
}

export default function ProductsManagement({ embedded = false }: { embedded?: boolean }) {
    const { t } = useI18n()
    const navigate = useNavigate()
    const { user } = useAuthStore()
    const [apps, setApps] = useState<Application[]>([])
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const debouncedSearchTerm = useDebounce(searchTerm, 300)
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'draft'>('all')
    const [editingProduct, setEditingProduct] = useState<Product | null>(null)
    const [copiedLinks, setCopiedLinks] = useState<Set<string>>(new Set())
    const [showAppsGrid, setShowAppsGrid] = useState(true)
    const [showSearchDropdown, setShowSearchDropdown] = useState(false)
    const searchDropdownRef = useRef<HTMLDivElement>(null)

    // Wizard states
    const [currentStep, setCurrentStep] = useState(1)
    const [maxSteps] = useState(5)
    const [showWizard, setShowWizard] = useState(false)

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: 0,
        currency: 'BRL' as 'USD' | 'CHF' | 'BRL',
        category: '',
        status: 'draft' as 'active' | 'inactive' | 'draft',
        image_url: '',
        marketplace_enabled: false,
        delivery_type: '',
        payment_type: 'unique' as 'unique' | 'recurrent',
        sales_page_url: '',
        recurrence_period: 'monthly' as 'monthly' | 'quarterly' | 'semiannual' | 'annual',
        support_email: '',
        support_whatsapp: ''
    })

    const [showPaymentConfig, setShowPaymentConfig] = useState(false)

    // Currency formatting functions
    const formatCurrency = (value: number, currency?: string): string => {
        if (currency === 'CHF') {
            return new Intl.NumberFormat('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
        }
        // USD default
        return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
    }

    const parseCurrency = (value: string): number => {
        const cleaned = value.replace(/\\./g, '').replace(',', '.')
        return parseFloat(cleaned) || 0
    }

    const handleCurrencyInput = (value: string): string => {
        const digits = value.replace(/\\D/g, '')
        if (!digits) return '0,00'

        const number = parseInt(digits, 10)
        const formatted = (number / 100).toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })

        return formatted
    }

    const getValidSession = async () => {
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error || !session) {
            const { data: { session: newSession } } = await supabase.auth.refreshSession()
            if (!newSession) {
                throw new Error('Session expired. Please log in again.')
            }
            return newSession
        }

        return session
    }

    // Função para gerar slug a partir do nome
    const generateSlug = (name: string): string => {
        return name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove acentos
            .replace(/[^a-z0-9]+/g, '-') // Substitui caracteres especiais por hífen
            .replace(/^-+|-+$/g, '') // Remove hífens do início e fim
            .substring(0, 50) // Limita o tamanho
    }

    useEffect(() => {
        fetchApps()
        fetchProducts()
    }, [])

    // Close search dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchDropdownRef.current && !searchDropdownRef.current.contains(event.target as Node)) {
                setShowSearchDropdown(false)
            }
        }

        if (showSearchDropdown) {
            document.addEventListener('mousedown', handleClickOutside)
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [showSearchDropdown])

    const fetchApps = async () => {
        try {
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/applications`, {
                headers: {
                    'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`,
                    'x-user-id': user?.id || 'user-default'
                }
            })

            if (response.ok) {
                const data = await response.json()
                setApps(data)
            }
        } catch (error) {
            console.error('Error fetching apps:', error)
        }
    }

    const fetchProducts = async () => {
        try {
            setLoading(true)
            const session = await getValidSession()

            const apiUrl = 'https://api.clicknich.com/api'
            const response = await fetch(`${apiUrl}/marketplace-products`, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                    'x-user-id': user?.id || ''
                }
            })

            if (response.ok) {
                const data = await response.json()
                setProducts(data)
            } else {
                console.error('Failed to fetch products:', await response.text())
            }
        } catch (error) {
            console.error('Error fetching products:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleCreateProduct = () => {
        setEditingProduct(null)
        setFormData({
            name: '',
            description: '',
            price: 0,
            currency: 'BRL' as 'USD' | 'CHF' | 'BRL',
            category: '',
            status: 'draft' as 'active' | 'inactive' | 'draft',
            image_url: '',
            marketplace_enabled: false,
            delivery_type: '',
            payment_type: 'unique' as 'unique' | 'recurrent',
            sales_page_url: '',
            recurrence_period: 'monthly' as 'monthly' | 'quarterly' | 'semiannual' | 'annual',
            support_email: '',
            support_whatsapp: ''
        })
        setCurrentStep(1)
        setShowWizard(true)
    }

    const handleEditProduct = (product: Product) => {
        navigate(`/products/${product.id}/edit`)
    }

    const handleDeleteProduct = async (id: string) => {
        if (confirm('Are you sure you want to delete this product?')) {
            try {
                const { error } = await supabase
                    .from('marketplace_products')
                    .delete()
                    .eq('id', id)

                if (error) {
                    console.error('Error deleting product:', error)
                    throw new Error(error.message)
                }

                alert('Product deleted successfully!')
                await fetchProducts()
            } catch (error: any) {
                console.error('Error deleting product:', error)
                alert(`Error deleting product: ${error.message || 'Please try again'}`)
            }
        }
    }

    const handleSaveProduct = async (e: React.FormEvent, customFormData?: any) => {
        e.preventDefault()

        // Usar customFormData se fornecido, senão usar formData padrão
        const dataToSave = customFormData || formData

        // Se for app novo, salvar na tabela applications com review_status: pending_review
        if (dataToSave.delivery_type === 'app' && !editingProduct) {
            try {
                const apiUrl = 'https://api.clicknich.com/api'
                const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY'
                const response = await fetch(`${apiUrl}/applications`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${anonKey}`,
                        'Content-Type': 'application/json',
                        'x-user-id': user?.id || ''
                    },
                    body: JSON.stringify({
                        name: dataToSave.name,
                        description: dataToSave.description,
                        category: dataToSave.category,
                        sales_page_url: dataToSave.sales_page_url || null,
                        support_email: dataToSave.support_email || null,
                        whatsapp_number: dataToSave.support_whatsapp || null,
                        price: dataToSave.price,
                        currency: dataToSave.currency,
                        payment_type: dataToSave.payment_type,
                        recurrence_period: dataToSave.payment_type === 'recurrent' ? dataToSave.recurrence_period : null,
                        review_status: 'draft'
                    })
                })

                if (response.ok) {
                    const newApp = await response.json()

                    // Criar checkout padrão com o preço cadastrado no wizard
                    if (dataToSave.price > 0) {
                        try {
                            await supabase.from('checkouts').insert({
                                application_id: newApp.id,
                                name: 'Default',
                                is_default: true,
                                custom_price: dataToSave.price,
                                banner_title: dataToSave.name
                            })
                        } catch (checkoutErr) {
                            console.error('Error creating default checkout for app:', checkoutErr)
                        }
                    }

                    await fetchProducts()
                    setShowWizard(false)
                    setCurrentStep(1)
                } else {
                    const errorData = await response.json()
                    console.error('Error creating app:', errorData)
                    throw new Error(errorData.message || 'Erro ao criar app')
                }
            } catch (error: any) {
                console.error('Error saving app:', error)
                alert(`Erro ao salvar app: ${error.message || 'Tente novamente.'}`)
            }
            return
        }

        try {
            const session = await getValidSession()

            if (editingProduct) {
                const apiUrl = 'https://api.clicknich.com/api'
                const response = await fetch(`${apiUrl}/marketplace-products/${editingProduct.id}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json',
                        'x-user-id': user?.id || ''
                    },
                    body: JSON.stringify({
                        name: dataToSave.name,
                        description: dataToSave.description,
                        price: dataToSave.price,
                        currency: dataToSave.currency,
                        category: dataToSave.category,
                        image_url: dataToSave.image_url,
                        show_in_marketplace: dataToSave.marketplace_enabled,
                        delivery_type: dataToSave.delivery_type,
                        payment_type: dataToSave.payment_type,
                        sales_page_url: dataToSave.sales_page_url,
                        recurrence_period: dataToSave.recurrence_period
                    })
                })

                if (response.ok) {
                    alert('Product updated successfully!')
                    await fetchProducts()
                } else {
                    const errorData = await response.json()
                    console.error('Error:', errorData)
                    throw new Error('Error updating product')
                }
            } else {
                const apiUrl = 'https://api.clicknich.com/api'
                const response = await fetch(`${apiUrl}/marketplace-products`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json',
                        'x-user-id': user?.id || ''
                    },
                    body: JSON.stringify({
                        name: dataToSave.name,
                        slug: generateSlug(dataToSave.name),
                        description: dataToSave.description,
                        price: dataToSave.price,
                        currency: dataToSave.currency,
                        category: dataToSave.category,
                        image_url: dataToSave.image_url,
                        show_in_marketplace: dataToSave.marketplace_enabled,
                        delivery_type: dataToSave.delivery_type,
                        status: 'draft',
                        payment_type: dataToSave.payment_type,
                        sales_page_url: dataToSave.sales_page_url || null,
                        recurrence_period: dataToSave.payment_type === 'recurrent' ? dataToSave.recurrence_period : null,
                        support_email: dataToSave.support_email || null,
                        support_whatsapp: dataToSave.support_whatsapp || null
                    })
                })

                if (response.ok) {
                    const newProduct = await response.json()

                    // Criar checkout padrão automaticamente com o preço cadastrado
                    try {
                        await supabase.from('checkouts').insert({
                            member_area_id: newProduct.id,
                            name: 'Default',
                            is_default: true,
                            custom_price: dataToSave.price,
                            banner_title: dataToSave.name
                        })
                    } catch (checkoutErr) {
                        console.error('Error creating default checkout:', checkoutErr)
                    }

                    await fetchProducts()
                    setShowWizard(false)
                    setCurrentStep(1)
                } else {
                    const errorData = await response.json()
                    console.error('Error creating product:', errorData)
                    throw new Error(errorData.message || 'Error creating product')
                }
            }

            if (editingProduct) {
                setShowWizard(false)
                setCurrentStep(1)
                setShowPaymentConfig(false)
            }
        } catch (error: any) {
            console.error('Error saving product:', error)
            alert(`Error saving product: ${error.message || 'Please try again.'}`)
        }
    }

    const handleSubmitAppForReview = async (id: string) => {
        if (!confirm('Enviar este app para verificação? Após enviado, não será possível editar até ser revisado.')) return
        try {
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/applications/${id}/submit-review`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`,
                    'Content-Type': 'application/json',
                    'x-user-id': user?.id || ''
                }
            })
            if (response.ok) {
                alert('App enviado para verificação! Você será notificado quando for revisado.')
                await fetchApps()
            } else {
                const err = await response.json().catch(() => ({}))
                alert(`Erro: ${err.error || response.status}`)
            }
        } catch (error) {
            console.error('Error submitting app for review:', error)
            alert('Erro ao enviar para verificação')
        }
    }

    const handleSubmitProductForReview = async (id: string) => {
        if (!confirm('Enviar este produto para verificação?')) return
        try {
            const session = await getValidSession()
            const response = await fetch(`https://api.clicknich.com/api/marketplace-products/${id}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                    'x-user-id': user?.id || ''
                },
                body: JSON.stringify({ review_status: 'pending_review' })
            })
            if (response.ok) {
                alert('Produto enviado para verificação! Você será notificado quando for revisado.')
                await fetchProducts()
            } else {
                const err = await response.json().catch(() => ({}))
                alert(`Erro: ${err.error || response.status}`)
            }
        } catch (error) {
            console.error('Error submitting product for review:', error)
            alert('Erro ao enviar para verificação')
        }
    }

    const handleDeleteApp = async (id: string) => {
        if (confirm('Are you sure you want to delete this app?')) {
            try {
                const session = await getValidSession()
                const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/applications/${id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                        'x-user-id': session.user.id
                    }
                })

                if (response.ok) {
                    setApps(apps.filter(app => app.id !== id))
                    alert('App deleted successfully!')
                } else {
                    alert('Error deleting app')
                }
            } catch (error) {
                console.error('Error deleting app:', error)
                alert('Error deleting app')
            }
        }
    }

    const generateClientAccessUrl = (appSlug: string): string => {
        return `${window.location.origin}/access/${appSlug}`
    }

    const generateProductAccessUrl = (productSlug: string): string => {
        return `${window.location.origin}/product/${productSlug}`
    }

    const generateMemberLoginUrl = (productSlug: string): string => {
        return `${window.location.origin}/members-login/${productSlug}`
    }

    const copyClientLink = async (appSlug: string) => {
        try {
            const clientUrl = generateClientAccessUrl(appSlug)
            await navigator.clipboard.writeText(clientUrl)

            setCopiedLinks(prev => new Set([...prev, appSlug]))
            setTimeout(() => {
                setCopiedLinks(prev => {
                    const newSet = new Set(prev)
                    newSet.delete(appSlug)
                    return newSet
                })
            }, 2000)
        } catch (err) {
            console.error('Error copying link:', err)
            alert('Error copying link')
        }
    }

    const copyProductLink = async (productSlug: string) => {
        try {
            if (!productSlug || productSlug === 'undefined') {
                alert('This product does not have a valid link yet. Please edit and save the product to generate the link.')
                return
            }

            const product = products.find(p => p.slug === productSlug)
            const urlToCopy = product?.delivery_type === 'community'
                ? generateMemberLoginUrl(productSlug)
                : generateProductAccessUrl(productSlug)

            await navigator.clipboard.writeText(urlToCopy)

            setCopiedLinks(prev => new Set([...prev, productSlug]))
            setTimeout(() => {
                setCopiedLinks(prev => {
                    const newSet = new Set(prev)
                    newSet.delete(productSlug)
                    return newSet
                })
            }, 2000)
        } catch (err) {
            console.error('Error copying link:', err)
            alert('Error copying link')
        }
    }

    const openClientAccess = (appSlug: string) => {
        window.open(generateClientAccessUrl(appSlug), '_blank')
    }

    const openProductAccess = (productSlug: string) => {
        const product = products.find(p => p.slug === productSlug)

        // Validar se o produto e o slug existem
        if (!product) {
            alert('Product not found')
            return
        }

        if (!productSlug || productSlug === 'undefined') {
            alert('This product does not have a valid access link yet. Please edit the product and save it again to generate the link.')
            return
        }

        if (product?.delivery_type === 'community') {
            // Abrir página de login da área de membros
            window.open(`/community/${product.id}/login`, '_blank')
        } else {
            window.open(generateProductAccessUrl(productSlug), '_blank')
        }
    }

    // Memoizar filtros para melhor performance
    const filteredProducts = useMemo(() => {
        return products.filter(product => {
            const searchLower = debouncedSearchTerm.toLowerCase()
            const matchesSearch = !debouncedSearchTerm ||
                product.name.toLowerCase().includes(searchLower) ||
                (product.description?.toLowerCase().includes(searchLower) ?? false) ||
                product.category.toLowerCase().includes(searchLower) ||
                product.slug.toLowerCase().includes(searchLower)
            const matchesStatus = filterStatus === 'all' || product.status === filterStatus
            return matchesSearch && matchesStatus
        })
    }, [products, debouncedSearchTerm, filterStatus])

    const filteredApps = useMemo(() => {
        return apps.filter(app => {
            const matchesSearch = app.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
            return matchesSearch
        })
    }, [apps, debouncedSearchTerm])

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'bg-[#252941] text-gray-200'
            case 'inactive': return 'bg-[#252941] text-gray-500'
            case 'draft': return 'bg-[#0f1117] text-gray-600'
            default: return 'bg-[#252941] text-gray-200'
        }
    }

    const getStatusText = (status: string) => {
        switch (status) {
            case 'active': return 'Active'
            case 'inactive': return 'Inactive'
            case 'draft': return 'Draft'
            default: return status
        }
    }

    return (
        <div className={embedded ? 'flex-1 flex flex-col bg-gray-50 dark:bg-[#080b14]' : 'min-h-screen bg-gray-50 dark:bg-[#080b14] flex'}>
            {/* Orbs glassmorphism */}
            {!embedded && (
                <div className="fixed inset-0 overflow-hidden dark:block hidden pointer-events-none z-0">
                    <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-blue-600/20 blur-[120px]" />
                    <div className="absolute -top-20 right-0 w-[500px] h-[500px] rounded-full bg-indigo-500/15 blur-[100px]" />
                    <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] rounded-full bg-violet-600/10 blur-[100px]" />
                </div>
            )}

            {!embedded && <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />}

            <div className="flex-1 flex flex-col min-w-0">
                {!embedded && <Header onMenuClick={() => setSidebarOpen(true)} />}

                {/* Action Bar */}
                {!showWizard && (
                    <div className={`sticky ${embedded ? 'top-0' : 'top-12 mt-12'} bg-white dark:bg-[#080b14]/80 dark:backdrop-blur-sm border-b border-gray-200 dark:border-white/10 z-[60]`}>
                        <div className="px-6 py-2 flex items-center justify-end">
                            <button
                                onClick={handleCreateProduct}
                                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded-lg font-medium transition-all whitespace-nowrap text-xs"
                            >
                                <ShoppingBag className="w-3 h-3" />
                                {t('create_product.title')}
                            </button>
                        </div>
                    </div>
                )}

                {/* Main Content */}
                <main className="flex-1 overflow-y-auto relative z-10">
                    <div className="px-3 lg:px-4 py-4">
                        {/* Product Wizard */}
                        <ProductWizard
                            isOpen={showWizard}
                            onClose={() => setShowWizard(false)}
                            currentStep={currentStep}
                            setCurrentStep={setCurrentStep}
                            maxSteps={maxSteps}
                            formData={formData}
                            setFormData={setFormData}
                            showPaymentConfig={showPaymentConfig}
                            setShowPaymentConfig={setShowPaymentConfig}
                            onSave={handleSaveProduct}
                            editingProduct={editingProduct}
                            formatCurrency={formatCurrency}
                            handleCurrencyInput={handleCurrencyInput}
                            parseCurrency={parseCurrency}
                        />

                        {/* Content Grid */}
                        {loading ? (
                            <div className="text-center py-12">
                                <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-200 dark:border-[#252941] border-t-blue-600 mx-auto"></div>
                                <p className="mt-3 text-xs text-gray-600">{t('common.loading')}</p>
                            </div>
                        ) : (
                            <div className="space-y-8">
                                {/* Apps Section */}
                                {filteredApps.length > 0 && (
                                    <div>
                                        <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Apps</h2>
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                                            {filteredApps.map((app) => (
                                                <div key={app.id} className="max-w-xs">
                                                    <AppCard
                                                        app={app}
                                                        onEdit={(id) => navigate(`/app-builder/${id}`)}
                                                        onDelete={handleDeleteApp}
                                                        onOpenAccess={openClientAccess}
                                                        onSubmitReview={handleSubmitAppForReview}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Products Section */}
                                {filteredProducts.length > 0 && (
                                    <div>
                                        <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Products</h2>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                                            {filteredProducts.map((product) => (
                                                <ProductCard
                                                    key={product.id}
                                                    product={product}
                                                    onEdit={handleEditProduct}
                                                    onDelete={handleDeleteProduct}
                                                    onCopyLink={copyProductLink}
                                                    onOpenAccess={openProductAccess}
                                                    generateAccessUrl={generateProductAccessUrl}
                                                    copiedLinks={copiedLinks}
                                                    formatCurrency={formatCurrency}
                                                    getStatusColor={getStatusColor}
                                                    getStatusText={getStatusText}
                                                    onSubmitReview={handleSubmitProductForReview}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}


                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div >
    )
}