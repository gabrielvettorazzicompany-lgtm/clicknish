import { useState, useEffect, useCallback } from 'react'
import { Search, Plus, Star, X, ChevronRight, ChevronLeft, ShoppingCart, Package, Smartphone, Check, Trash2 } from 'lucide-react'
import { useI18n } from '@/i18n'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { supabase } from '@/services/supabase'
import { useDebounce } from '@/hooks/useDebounce'
import { useAuthStore } from '@/stores/authStore'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MarketplaceItem {
    id: string
    title: string
    description?: string
    brand: string
    price: number
    currency: string
    image_url: string
    product_type: 'member_area' | 'application'
    owner_id: string
    default_checkout_id?: string
    is_featured?: boolean
}

interface MyProduct {
    id: string
    name: string
    image_url?: string
    price: number
    currency: string
    product_type: 'member_area' | 'application'
    show_in_marketplace: boolean
}

interface Checkout {
    id: string
    name: string
    custom_price?: number
    is_default: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatPrice = (price: number, currency = 'USD') => {
    if (!price || price === 0) return null
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(price)
}

// ─── Modal: Add Product to Marketplace ────────────────────────────────────────

interface AddModalProps {
    onClose: () => void
    onSuccess: () => void
}

function AddMarketplaceModal({ onClose, onSuccess }: AddModalProps) {
    const { t } = useI18n()
    const { user } = useAuthStore()
    const [step, setStep] = useState<1 | 2>(1)
    const [myProducts, setMyProducts] = useState<MyProduct[]>([])
    const [selectedProduct, setSelectedProduct] = useState<MyProduct | null>(null)
    const [checkouts, setCheckouts] = useState<Checkout[]>([])
    const [selectedCheckout, setSelectedCheckout] = useState<Checkout | null>(null)
    const [loadingProducts, setLoadingProducts] = useState(true)
    const [loadingCheckouts, setLoadingCheckouts] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [success, setSuccess] = useState(false)

    useEffect(() => {
        if (!user?.id) return
        const fetchMyProducts = async () => {
            setLoadingProducts(true)
            const [memberAreasRes, appsRes] = await Promise.all([
                supabase
                    .from('member_areas')
                    .select('id, name, image_url, price, currency, show_in_marketplace')
                    .eq('owner_id', user.id)
                    .order('created_at', { ascending: false }),
                supabase
                    .from('applications')
                    .select('id, name, logo_url, marketplace_price, show_in_marketplace')
                    .eq('owner_id', user.id)
                    .order('created_at', { ascending: false }),
            ])

            const areas: MyProduct[] = (memberAreasRes.data || []).map(p => ({
                id: p.id,
                name: p.name,
                image_url: p.image_url,
                price: p.price || 0,
                currency: p.currency || 'USD',
                product_type: 'member_area',
                show_in_marketplace: p.show_in_marketplace || false,
            }))

            const apps: MyProduct[] = (appsRes.data || []).map(p => ({
                id: p.id,
                name: p.name,
                image_url: p.logo_url,
                price: p.marketplace_price || 0,
                currency: 'USD',
                product_type: 'application',
                show_in_marketplace: p.show_in_marketplace || false,
            }))

            setMyProducts([...areas, ...apps])
            setLoadingProducts(false)
        }
        fetchMyProducts()
    }, [user?.id])

    const fetchCheckouts = async (product: MyProduct) => {
        setLoadingCheckouts(true)
        setCheckouts([])
        setSelectedCheckout(null)
        const { data } = product.product_type === 'member_area'
            ? await supabase.from('checkouts').select('id, name, custom_price, is_default').eq('member_area_id', product.id).order('is_default', { ascending: false })
            : await supabase.from('checkouts').select('id, name, custom_price, is_default').eq('application_id', product.id).order('is_default', { ascending: false })
        setCheckouts(data || [])
        if (data && data.length > 0) setSelectedCheckout(data[0])
        setLoadingCheckouts(false)
    }

    const handleSelectProduct = (product: MyProduct) => {
        setSelectedProduct(product)
        fetchCheckouts(product)
        setStep(2)
    }

    const handleRemove = async (product: MyProduct) => {
        const table = product.product_type === 'member_area' ? 'member_areas' : 'applications'
        setMyProducts(prev => prev.map(p => p.id === product.id ? { ...p, show_in_marketplace: false } : p))
        try {
            await supabase.from(table).update({ show_in_marketplace: false }).eq('id', product.id)
            onSuccess()
        } catch (err) {
            console.error('Erro ao remover do marketplace:', err)
            setMyProducts(prev => prev.map(p => p.id === product.id ? { ...p, show_in_marketplace: true } : p))
        }
    }

    const handleSubmit = async () => {
        if (!selectedProduct || !selectedCheckout) return
        setSubmitting(true)
        try {
            const table = selectedProduct.product_type === 'member_area' ? 'member_areas' : 'applications'
            await supabase.from('checkouts').update({ is_default: true }).eq('id', selectedCheckout.id)
            await supabase.from(table).update({ show_in_marketplace: true }).eq('id', selectedProduct.id)
            setSuccess(true)
            setTimeout(() => { onSuccess(); onClose() }, 1800)
        } catch (err) {
            console.error('Erro ao publicar no marketplace:', err)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-lg bg-[#0e1120] border border-[#1e2139] rounded-2xl shadow-2xl overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2139]">
                    <div className="flex items-center gap-3">
                        {step === 2 && (
                            <button onClick={() => setStep(1)} className="text-gray-400 hover:text-gray-200 transition-colors p-1 rounded-lg hover:bg-white/5">
                                <ChevronLeft size={18} />
                            </button>
                        )}
                        <div>
                            <h2 className="text-sm font-semibold text-gray-100">{t('marketplace.add_modal_title')}</h2>
                            <p className="text-xs text-gray-500 mt-0.5">
                                {step === 1 ? t('marketplace.step_select_product') : t('marketplace.step_select_checkout')}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-200 transition-colors p-1 rounded-lg hover:bg-white/5">
                        <X size={18} />
                    </button>
                </div>

                {/* Step indicators */}
                <div className="flex items-center gap-2 px-5 pt-4">
                    {[1, 2].map(s => (
                        <div key={s} className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step > s ? 'bg-green-500 text-white' : step === s ? 'bg-blue-600 text-white' : 'bg-[#1e2139] text-gray-500'
                                }`}>
                                {step > s ? <Check size={12} /> : s}
                            </div>
                            {s < 2 && <div className={`h-0.5 w-8 rounded transition-colors ${step > 1 ? 'bg-blue-600' : 'bg-[#1e2139]'}`} />}
                        </div>
                    ))}
                </div>

                {/* Content */}
                <div className="p-5">
                    {/* Step 1: Select Product */}
                    {step === 1 && (
                        <div>
                            <p className="text-xs text-gray-400 mb-4">{t('marketplace.select_product_desc')}</p>
                            {loadingProducts ? (
                                <div className="flex justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#1e2139] border-t-blue-600" />
                                </div>
                            ) : myProducts.length === 0 ? (
                                <p className="text-center text-xs text-gray-500 py-8">{t('marketplace.no_my_products')}</p>
                            ) : (
                                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                                    {myProducts.map(product => (
                                        <div
                                            key={product.id}
                                            onClick={() => !product.show_in_marketplace && handleSelectProduct(product)}
                                            className={`w-full flex items-center gap-3 p-3 rounded-xl border border-[#1e2139] transition-all ${
                                                !product.show_in_marketplace
                                                    ? 'cursor-pointer hover:border-blue-500/50 hover:bg-blue-500/5'
                                                    : ''
                                            }`}
                                        >
                                            <div className="w-10 h-10 rounded-lg bg-[#1a1d2e] flex-shrink-0 overflow-hidden">
                                                {product.image_url ? (
                                                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        {product.product_type === 'application'
                                                            ? <Smartphone size={16} className="text-gray-500" />
                                                            : <Package size={16} className="text-gray-500" />}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-medium text-gray-200 truncate">{product.name}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[10px] text-gray-500 bg-[#1e2139] px-1.5 py-0.5 rounded-full">
                                                        {product.product_type === 'application' ? t('marketplace.application') : t('marketplace.member_area')}
                                                    </span>
                                                    {product.show_in_marketplace && (
                                                        <span className="text-[10px] text-green-400 flex items-center gap-1">
                                                            <Check size={10} /> {t('marketplace.in_marketplace')}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {product.show_in_marketplace ? (
                                                <button
                                                    onClick={() => handleRemove(product)}
                                                    className="flex-shrink-0 p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                                                    title={t('marketplace.remove_from_marketplace')}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleSelectProduct(product)}
                                                    className="flex-shrink-0 p-1.5 rounded-lg text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                                                >
                                                    <ChevronRight size={14} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 2: Select Checkout */}
                    {step === 2 && selectedProduct && (
                        <div>
                            <div className="flex items-center gap-2 mb-3 p-2 bg-[#1a1d2e] rounded-lg border border-[#1e2139]">
                                <div className="w-8 h-8 rounded-lg bg-[#252941] flex-shrink-0 overflow-hidden">
                                    {selectedProduct.image_url
                                        ? <img src={selectedProduct.image_url} alt={selectedProduct.name} className="w-full h-full object-cover" />
                                        : <div className="w-full h-full flex items-center justify-center"><Package size={12} className="text-gray-500" /></div>}
                                </div>
                                <p className="text-xs font-medium text-gray-200">{selectedProduct.name}</p>
                            </div>
                            <p className="text-xs text-gray-400 mb-3">{t('marketplace.select_checkout_desc')}</p>
                            {loadingCheckouts ? (
                                <div className="flex justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#1e2139] border-t-blue-600" />
                                </div>
                            ) : checkouts.length === 0 ? (
                                <p className="text-center text-xs text-gray-500 py-8">{t('marketplace.no_checkouts')}</p>
                            ) : (
                                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                                    {checkouts.map(checkout => (
                                        <button
                                            key={checkout.id}
                                            onClick={() => setSelectedCheckout(checkout)}
                                            className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left ${selectedCheckout?.id === checkout.id
                                                    ? 'border-blue-500 bg-blue-500/10'
                                                    : 'border-[#1e2139] hover:border-blue-500/50 hover:bg-blue-500/5'
                                                }`}
                                        >
                                            <div>
                                                <p className="text-xs font-medium text-gray-200">{checkout.name}</p>
                                                {checkout.is_default && <span className="text-[10px] text-blue-400">Padrão</span>}
                                            </div>
                                            <span className="text-sm font-bold text-green-400">
                                                {formatPrice(checkout.custom_price ?? selectedProduct.price, selectedProduct.currency) || t('marketplace.free')}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {step === 2 && (
                    <div className="px-5 pb-5">
                        {success ? (
                            <div className="flex items-center justify-center gap-2 py-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-xs font-medium">
                                <Check size={14} /> {t('marketplace.publish_success')}
                            </div>
                        ) : (
                            <button
                                onClick={handleSubmit}
                                disabled={!selectedCheckout || submitting || checkouts.length === 0}
                                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl transition-colors"
                            >
                                {submitting ? t('marketplace.publishing') : t('marketplace.publish')}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

// ─── Modal: Buy Product ────────────────────────────────────────────────────────

interface BuyModalProps {
    item: MarketplaceItem
    onClose: () => void
}

function BuyModal({ item, onClose }: BuyModalProps) {
    const { t } = useI18n()
    const [loadingCheckout, setLoadingCheckout] = useState(false)

    const handleBuy = async () => {
        if (!item.default_checkout_id) return
        setLoadingCheckout(true)
        try {
            const field = item.product_type === 'member_area' ? 'member_area_id' : 'application_id'
            const { data: existing } = await supabase
                .from('checkout_urls')
                .select('id')
                .eq('checkout_id', item.default_checkout_id)
                .eq(field, item.id)
                .maybeSingle()

            let checkoutUrlId = existing?.id
            if (!checkoutUrlId) {
                const { data: created } = await supabase
                    .from('checkout_urls')
                    .insert({ checkout_id: item.default_checkout_id, [field]: item.id })
                    .select('id')
                    .single()
                checkoutUrlId = created?.id
            }

            if (checkoutUrlId) {
                window.open(`${window.location.origin}/checkout/${checkoutUrlId}`, '_blank')
            }
        } catch (err) {
            console.error('Erro ao abrir checkout:', err)
        } finally {
            setLoadingCheckout(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-sm bg-[#0e1120] border border-[#1e2139] rounded-2xl shadow-2xl overflow-hidden">
                <div className="relative h-40 bg-[#1a1d2e] overflow-hidden">
                    <img
                        src={item.image_url}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x200/1a1d2e/666?text=Product' }}
                    />
                    <button onClick={onClose} className="absolute top-3 right-3 bg-black/50 text-white p-1.5 rounded-lg hover:bg-black/70 transition-colors">
                        <X size={14} />
                    </button>
                </div>
                <div className="p-5">
                    <h3 className="text-sm font-bold text-gray-100 mb-1">{item.title}</h3>
                    <p className="text-xs text-gray-500 mb-3">{t('marketplace.by')} {item.brand}</p>
                    {item.description && (
                        <p className="text-xs text-gray-400 mb-4 line-clamp-2">{item.description}</p>
                    )}
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-xs text-gray-500">{t('marketplace.price')}</span>
                        <span className="text-lg font-bold text-green-400">
                            {formatPrice(item.price, item.currency) || t('marketplace.free')}
                        </span>
                    </div>
                    <button
                        onClick={handleBuy}
                        disabled={loadingCheckout || !item.default_checkout_id}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl transition-colors"
                    >
                        <ShoppingCart size={14} />
                        {loadingCheckout ? '...' : t('marketplace.open_checkout')}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Main Component ────────────────────────────────────────────────────────────

function Marketplace() {
    const { t } = useI18n()
    const { user } = useAuthStore()
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const debouncedSearchQuery = useDebounce(searchQuery, 300)
    const [products, setProducts] = useState<MarketplaceItem[]>([])
    const [loading, setLoading] = useState(true)
    const [showAddModal, setShowAddModal] = useState(false)
    const [buyItem, setBuyItem] = useState<MarketplaceItem | null>(null)

    const handleRemoveItem = async (item: MarketplaceItem, e: React.MouseEvent) => {
        e.stopPropagation()
        const table = item.product_type === 'member_area' ? 'member_areas' : 'applications'
        setProducts(prev => prev.filter(p => p.id !== item.id))
        try {
            await supabase.from(table).update({ show_in_marketplace: false }).eq('id', item.id)
        } catch (err) {
            console.error('Erro ao remover do marketplace:', err)
            fetchMarketplaceProducts()
        }
    }

    const fetchMarketplaceProducts = useCallback(async () => {
        setLoading(true)
        try {
            const [areasRes, appsRes] = await Promise.all([
                supabase
                    .from('member_areas')
                    .select('id, name, description, image_url, price, currency, category, owner_id')
                    .eq('show_in_marketplace', true)
                    .order('created_at', { ascending: false }),
                supabase
                    .from('applications')
                    .select('id, name, description, logo_url, marketplace_price, owner_id')
                    .eq('show_in_marketplace', true)
                    .order('created_at', { ascending: false }),
            ])

            const areaIds = (areasRes.data || []).map(p => p.id)
            const appIds = (appsRes.data || []).map(p => p.id)

            const [areaCheckouts, appCheckouts] = await Promise.all([
                areaIds.length > 0
                    ? supabase.from('checkouts').select('id, member_area_id, custom_price').eq('is_default', true).in('member_area_id', areaIds)
                    : { data: [] },
                appIds.length > 0
                    ? supabase.from('checkouts').select('id, application_id, custom_price').eq('is_default', true).in('application_id', appIds)
                    : { data: [] },
            ])

            const areaCheckoutMap = new Map((areaCheckouts.data || []).map((c: any) => [c.member_area_id, c]))
            const appCheckoutMap = new Map((appCheckouts.data || []).map((c: any) => [c.application_id, c]))

            const areas: MarketplaceItem[] = (areasRes.data || []).map(p => {
                const checkout: any = areaCheckoutMap.get(p.id)
                return {
                    id: p.id,
                    title: p.name,
                    description: p.description,
                    brand: p.category || 'Área de Membros',
                    price: checkout?.custom_price ?? p.price ?? 0,
                    currency: p.currency || 'USD',
                    image_url: p.image_url || 'https://via.placeholder.com/400x300/1a1d2e/666?text=Product',
                    product_type: 'member_area',
                    owner_id: p.owner_id,
                    default_checkout_id: checkout?.id,
                }
            })

            const apps: MarketplaceItem[] = (appsRes.data || []).map(p => {
                const checkout: any = appCheckoutMap.get(p.id)
                return {
                    id: p.id,
                    title: p.name,
                    description: p.description,
                    brand: 'Aplicativo',
                    price: checkout?.custom_price ?? p.marketplace_price ?? 0,
                    currency: 'USD',
                    image_url: p.logo_url || 'https://via.placeholder.com/400x300/1a1d2e/666?text=App',
                    product_type: 'application',
                    owner_id: p.owner_id,
                    default_checkout_id: checkout?.id,
                }
            })

            setProducts([...areas, ...apps])
        } catch (err) {
            console.error('Erro ao carregar marketplace:', err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchMarketplaceProducts()
    }, [fetchMarketplaceProducts])

    const filtered = debouncedSearchQuery
        ? products.filter(p =>
            p.title.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
            p.brand.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
        )
        : products

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#080b14] flex transition-colors duration-200 relative">
            <div className="pointer-events-none fixed inset-0 overflow-hidden dark:block hidden">
                <div className="absolute top-[-80px] left-[15%] w-[500px] h-[500px] rounded-full bg-blue-600/20 blur-[120px]" />
                <div className="absolute top-[30%] right-[-60px] w-[400px] h-[400px] rounded-full bg-indigo-500/15 blur-[100px]" />
                <div className="absolute bottom-[10%] left-[5%] w-[350px] h-[350px] rounded-full bg-violet-600/10 blur-[100px]" />
            </div>

            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex-1 flex flex-col min-w-0">
                <Header onMenuClick={() => setSidebarOpen(true)} />

                <main className="flex-1 overflow-y-auto pt-10 relative z-10">
                    <div className="max-w-7xl mx-auto px-3 lg:px-4 py-4">

                        {/* Title + Add button */}
                        <div className="flex items-center justify-between mb-4">
                            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 transition-colors duration-200">
                                {t('marketplace.title')}
                            </h1>
                            {user && (
                                <button
                                    onClick={() => setShowAddModal(true)}
                                    className="flex items-center gap-1 px-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-medium rounded-md transition-colors shadow-md shadow-blue-600/20"
                                >
                                    <Plus size={14} />
                                    {t('marketplace.add_product')}
                                </button>
                            )}
                        </div>

                        {/* Search */}
                        <div className="flex flex-col sm:flex-row gap-3 mb-6">
                            <div className="flex-1 flex items-center gap-2 bg-white dark:bg-[#1a1d2e] border border-gray-300 dark:border-[#1e2139] rounded-lg px-3 py-2 transition-colors duration-200">
                                <Search size={16} className="text-gray-400" />
                                <input
                                    type="text"
                                    placeholder={t('marketplace.search')}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="bg-transparent border-none outline-none text-xs flex-1 text-gray-700 dark:text-gray-200 placeholder:text-gray-500 dark:placeholder:text-gray-400 transition-colors duration-200"
                                />
                            </div>
                        </div>

                        {/* Products Grid */}
                        {loading ? (
                            <div className="text-center py-20">
                                <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-300 dark:border-[#1e2139] border-t-blue-600 mx-auto" />
                                <p className="text-gray-600 dark:text-gray-400 mt-4 text-sm">{t('common.loading')}</p>
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="text-center py-12">
                                <ShoppingCart size={40} className="mx-auto text-gray-600 mb-3 opacity-40" />
                                <h3 className="text-base font-semibold text-gray-100 mb-1">{t('marketplace.no_products')}</h3>
                                <p className="text-xs text-gray-600">{t('marketplace.no_products_desc')}</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                                {filtered.map((product) => (
                                    <div
                                        key={product.id}
                                        onClick={() => setBuyItem(product)}
                                        className="bg-[#1a1d2e] rounded-xl overflow-hidden border border-[#1e2139] hover:shadow-2xl hover:shadow-blue-500/10 hover:border-blue-500/30 shadow-black/10 transition-all cursor-pointer group"
                                    >
                                        <div className="relative h-32 bg-[#252941] overflow-hidden">
                                            {product.is_featured && (
                                                <div className="absolute top-2 left-2 z-10 bg-yellow-400 rounded-full p-1">
                                                    <Star size={10} className="text-white fill-white" />
                                                </div>
                                            )}
                                            <span className="absolute top-2 right-2 z-10 text-[9px] bg-black/50 text-gray-300 px-1.5 py-0.5 rounded-full">
                                                {product.product_type === 'application' ? t('marketplace.application') : t('marketplace.member_area')}
                                            </span>
                                            {/* Remove button — only visible to owner */}
                                            {user?.id === product.owner_id && (
                                                <button
                                                    onClick={(e) => handleRemoveItem(product, e)}
                                                    title={t('marketplace.remove_from_marketplace')}
                                                    className="absolute bottom-2 right-2 z-10 p-1.5 bg-black/60 hover:bg-red-500/80 text-gray-300 hover:text-white rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            )}
                                            <img
                                                src={product.image_url}
                                                alt={product.title}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300/1a1d2e/666?text=Product' }}
                                            />
                                        </div>
                                        <div className="p-2">
                                            <h3 className="font-semibold text-gray-100 mb-1 line-clamp-2 min-h-[2rem] text-xs">
                                                {product.title}
                                            </h3>
                                            <p className="text-xs text-gray-500 mb-2">{t('marketplace.by')} {product.brand}</p>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-bold text-green-400">
                                                    {formatPrice(product.price, product.currency) || t('marketplace.free')}
                                                </span>
                                                <span className="text-[10px] text-blue-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {t('marketplace.buy')} →
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </main>
            </div>

            {showAddModal && (
                <AddMarketplaceModal
                    onClose={() => setShowAddModal(false)}
                    onSuccess={fetchMarketplaceProducts}
                />
            )}
            {buyItem && (
                <BuyModal
                    item={buyItem}
                    onClose={() => setBuyItem(null)}
                />
            )}
        </div>
    )
}

export default Marketplace
