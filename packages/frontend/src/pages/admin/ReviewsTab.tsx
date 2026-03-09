import { useState, useEffect } from 'react'
import { useI18n } from '@/i18n'
import { adminFetch } from './adminApi'

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

const STATUS_FILTERS = [
    { key: 'all' as const, label: 'Todos', color: 'gray' },
    { key: 'pending_review' as const, label: 'Pendentes', color: 'amber' },
    { key: 'approved' as const, label: 'Aprovados', color: 'green' },
    { key: 'rejected' as const, label: 'Rejeitados', color: 'red' },
]

const STATUS_COLOR_MAP: Record<string, (active: boolean) => string> = {
    gray: a => a ? 'text-white' : 'text-gray-500 hover:text-gray-300',
    amber: a => a ? 'text-amber-400' : 'text-gray-500 hover:text-amber-400',
    green: a => a ? 'text-green-400' : 'text-gray-500 hover:text-green-400',
    red: a => a ? 'text-red-400' : 'text-gray-500 hover:text-red-400',
}

export function ReviewsTab({ userId, onPendingCountChange }: { userId: string; onPendingCountChange?: (n: number) => void }) {
    const { t } = useI18n()
    const [subTab, setSubTab] = useState<'apps' | 'products'>('apps')

    // Apps
    const [allApps, setAllApps] = useState<PendingApp[]>([])
    const [loadingApps, setLoadingApps] = useState(false)
    const [appStatusFilter, setAppStatusFilter] = useState<'all' | 'pending_review' | 'approved' | 'rejected'>('all')
    const [appSearch, setAppSearch] = useState('')
    const [selectedApp, setSelectedApp] = useState<PendingApp | null>(null)
    const [showAppRejectModal, setShowAppRejectModal] = useState(false)
    const [appRejectionReason, setAppRejectionReason] = useState('')
    const [showAppDetailsModal, setShowAppDetailsModal] = useState(false)
    const [appDetailsData, setAppDetailsData] = useState<any>(null)
    const [loadingAppDetails, setLoadingAppDetails] = useState(false)

    // Products
    const [allProducts, setAllProducts] = useState<PendingProduct[]>([])
    const [loadingProducts, setLoadingProducts] = useState(false)
    const [productStatusFilter, setProductStatusFilter] = useState<'all' | 'pending_review' | 'approved' | 'rejected'>('all')
    const [productSearch, setProductSearch] = useState('')
    const [selectedProduct, setSelectedProduct] = useState<PendingProduct | null>(null)
    const [showProductRejectModal, setShowProductRejectModal] = useState(false)
    const [productRejectionReason, setProductRejectionReason] = useState('')
    const [showProductDetailsModal, setShowProductDetailsModal] = useState(false)
    const [productDetails, setProductDetails] = useState<any>(null)
    const [loadingProductDetails, setLoadingProductDetails] = useState(false)

    const [processingId, setProcessingId] = useState<string | null>(null)

    const fetchAllApps = async () => {
        setLoadingApps(true)
        try {
            const res = await adminFetch('/all-apps', userId)
            if (res.ok) { const d = await res.json(); setAllApps(d.apps || []) }
        } catch (e) { console.error(e) } finally { setLoadingApps(false) }
    }

    const fetchAllProducts = async () => {
        setLoadingProducts(true)
        try {
            const res = await adminFetch('/all-products', userId)
            if (res.ok) { const d = await res.json(); setAllProducts(d.products || []) }
        } catch (e) { console.error(e) } finally { setLoadingProducts(false) }
    }

    useEffect(() => {
        fetchAllApps()
        fetchAllProducts()
    }, [])

    useEffect(() => {
        const pending = allApps.filter(a => a.review_status === 'pending_review').length + allProducts.filter(p => p.review_status === 'pending_review').length
        onPendingCountChange?.(pending)
    }, [allApps, allProducts])

    // --- App actions ---
    const handleApproveApp = async (id: string) => {
        setProcessingId(id)
        try {
            const res = await adminFetch(`/apps/${id}/approve`, userId, { method: 'PUT' })
            if (res.ok) { fetchAllApps() }
            else { let msg = `HTTP ${res.status}`; try { const e = await res.json(); msg = e.error || msg } catch { } alert(`Error: ${msg}`) }
        } catch (e) { console.error(e) } finally { setProcessingId(null) }
    }

    const handleRejectApp = async () => {
        if (!selectedApp) return
        setProcessingId(selectedApp.id)
        try {
            const res = await adminFetch(`/apps/${selectedApp.id}/reject`, userId, {
                method: 'PUT',
                body: JSON.stringify({ reason: appRejectionReason || 'Your app was not approved. Please review the guidelines and resubmit.' }),
            })
            if (res.ok) { setShowAppRejectModal(false); setSelectedApp(null); setAppRejectionReason(''); fetchAllApps() }
            else { let msg = `HTTP ${res.status}`; try { const e = await res.json(); msg = e.error || msg } catch { } alert(`Error: ${msg}`) }
        } catch (e) { console.error(e) } finally { setProcessingId(null) }
    }

    const openAppDetails = async (app: PendingApp) => {
        setSelectedApp(app); setShowAppDetailsModal(true); setLoadingAppDetails(true); setAppDetailsData(null)
        try {
            const res = await adminFetch(`/app-details/${app.id}`, userId)
            if (res.ok) setAppDetailsData(await res.json())
        } catch (e) { console.error(e) } finally { setLoadingAppDetails(false) }
    }

    // --- Product actions ---
    const handleApproveProduct = async (id: string) => {
        setProcessingId(id)
        try {
            const res = await adminFetch(`/products/${id}/approve`, userId, { method: 'PUT' })
            if (res.ok) { fetchAllProducts() }
            else { let msg = `HTTP ${res.status}`; try { const e = await res.json(); msg = e.error || msg } catch { } alert(`Error: ${msg}`) }
        } catch (e) { console.error(e) } finally { setProcessingId(null) }
    }

    const handleRejectProduct = async () => {
        if (!selectedProduct) return
        setProcessingId(selectedProduct.id)
        try {
            const res = await adminFetch(`/products/${selectedProduct.id}/reject`, userId, {
                method: 'PUT',
                body: JSON.stringify({ reason: productRejectionReason || 'Your product was not approved. Please review the guidelines and resubmit.' }),
            })
            if (res.ok) { setShowProductRejectModal(false); setSelectedProduct(null); setProductRejectionReason(''); fetchAllProducts() }
            else { let msg = `HTTP ${res.status}`; try { const e = await res.json(); msg = e.error || msg } catch { } alert(`Error: ${msg}`) }
        } catch (e) { console.error(e) } finally { setProcessingId(null) }
    }

    const openProductDetails = async (p: PendingProduct) => {
        setSelectedProduct(p); setShowProductDetailsModal(true); setLoadingProductDetails(true); setProductDetails(null)
        try {
            const res = await adminFetch(`/product-details/${p.id}`, userId)
            if (res.ok) setProductDetails(await res.json())
        } catch (e) { console.error(e) } finally { setLoadingProductDetails(false) }
    }

    const filteredApps = allApps.filter(a => {
        const matchStatus = appStatusFilter === 'all' || a.review_status === appStatusFilter
        const q = appSearch.toLowerCase()
        return matchStatus && (!q || a.name?.toLowerCase().includes(q) || a.owner_email?.toLowerCase().includes(q) || a.slug?.toLowerCase().includes(q))
    })

    const filteredProducts = allProducts.filter(p => {
        const matchStatus = productStatusFilter === 'all' || p.review_status === productStatusFilter
        const q = productSearch.toLowerCase()
        return matchStatus && (!q || p.name?.toLowerCase().includes(q) || p.owner_email?.toLowerCase().includes(q))
    })

    const statusConfig = (status: string) => ({
        pending_review: { label: 'Pendente', cls: 'text-amber-400' },
        approved: { label: 'Aprovado', cls: 'text-green-400' },
        rejected: { label: 'Rejeitado', cls: 'text-red-400' },
        draft: { label: 'Rascunho', cls: 'text-gray-400' },
    })[status] || { label: 'Rascunho', cls: 'text-gray-400' }

    return (
        <div className="space-y-4">
            {/* Sub-tab selector */}
            <div className="flex gap-2">
                <button onClick={() => setSubTab('apps')} className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium transition-all duration-200 ${subTab === 'apps' ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                    Apps {allApps.length > 0 && <span className="text-xs text-gray-500">{allApps.length}</span>}
                </button>
                <button onClick={() => setSubTab('products')} className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium transition-all duration-200 ${subTab === 'products' ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                    Áreas de Membros {allProducts.length > 0 && <span className="text-xs text-gray-500">{allProducts.length}</span>}
                </button>
            </div>

            {/* Apps sub-tab */}
            {subTab === 'apps' && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 flex-wrap">
                        {STATUS_FILTERS.map(({ key, label, color }) => (
                            <button key={key} onClick={() => setAppStatusFilter(key)} className={`flex items-center gap-1.5 px-2 py-1 text-sm font-medium transition-all ${STATUS_COLOR_MAP[color](appStatusFilter === key)}`}>
                                {label} <span className="text-xs text-gray-600">{key === 'all' ? allApps.length : allApps.filter(a => a.review_status === key).length}</span>
                            </button>
                        ))}
                        <button onClick={fetchAllApps} className="ml-auto px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-all flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            Atualizar
                        </button>
                    </div>
                    <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        <input type="text" placeholder="Buscar por nome do app ou e-mail do produtor..." value={appSearch} onChange={e => setAppSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-white/[0.02] border-b border-white/[0.06] text-white placeholder-gray-600 text-xs focus:outline-none focus:border-blue-500/30" />
                        {appSearch && <button onClick={() => setAppSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-sm">×</button>}
                    </div>

                    {loadingApps ? (
                        <div className="p-16 flex flex-col items-center justify-center">
                            <div className="w-12 h-12 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4" />
                            <p className="text-gray-400">{t('superadmin.loading_apps')}</p>
                        </div>
                    ) : filteredApps.length === 0 ? (
                        <div className="p-12 text-center">
                            <h4 className="text-xl font-semibold text-blue-400 mb-2">{t('superadmin.all_caught_up')}</h4>
                            <p className="text-gray-500 text-sm">{t('superadmin.no_apps_review')}</p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {filteredApps.map((app, index) => {
                                const sc = statusConfig(app.review_status)
                                return (
                                    <div key={app.id} className="overflow-hidden border-b border-white/[0.05] last:border-b-0 group" style={{ animationDelay: `${index * 50}ms` }}>
                                        <div className="p-4">
                                            <div className="flex items-start gap-5">
                                                <div className="w-20 h-20 rounded-xl overflow-hidden bg-gradient-to-br from-white/[0.05] to-white/[0.02] flex-shrink-0">
                                                    {app.logo_url ? <img src={app.logo_url} alt={app.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-600/20 to-indigo-600/20"><span className="text-2xl font-bold text-blue-400">{app.name?.charAt(0) || 'A'}</span></div>}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                        <h4 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">{app.name}</h4>
                                                        <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded text-xs font-medium">App</span>
                                                        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${sc.cls}`}>{sc.label}</span>
                                                    </div>
                                                    <p className="text-sm text-gray-500">/{app.slug}</p>
                                                    {app.review_status === 'rejected' && app.review_notes && <p className="mt-1.5 text-xs text-red-400/80 bg-red-500/5 border border-red-500/15 rounded px-2 py-1 line-clamp-2">Motivo: {app.review_notes}</p>}
                                                    <p className="mt-3 text-sm text-gray-500">Owner: <span className="text-gray-300">{app.owner_email || 'Unknown'}</span></p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 mt-4">
                                                <button onClick={() => openAppDetails(app)} className="text-gray-400 hover:text-white text-xs transition-colors flex items-center gap-1">
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                    Ver
                                                </button>
                                                {app.review_status !== 'approved' && (
                                                    <button onClick={() => handleApproveApp(app.id)} disabled={processingId === app.id} className="flex items-center gap-1 text-gray-400 hover:text-green-400 text-xs transition-colors disabled:opacity-50">
                                                        {processingId === app.id ? <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg> : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>}
                                                        Aprovar
                                                    </button>
                                                )}
                                                {app.review_status !== 'rejected' && (
                                                    <button onClick={() => { setSelectedApp(app); setShowAppRejectModal(true) }} disabled={processingId === app.id} className="flex items-center gap-1 text-gray-400 hover:text-red-400 text-xs transition-colors disabled:opacity-50">
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
                    )}
                </div>
            )}

            {/* Products sub-tab */}
            {subTab === 'products' && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 flex-wrap">
                        {STATUS_FILTERS.map(({ key, label, color }) => (
                            <button key={key} onClick={() => setProductStatusFilter(key)} className={`flex items-center gap-1 px-2 py-1 text-xs transition-colors ${STATUS_COLOR_MAP[color](productStatusFilter === key)}`}>
                                {label} <span className="text-xs text-gray-600">{key === 'all' ? allProducts.length : allProducts.filter(p => p.review_status === key).length}</span>
                            </button>
                        ))}
                        <button onClick={fetchAllProducts} className="ml-auto px-2 py-1 text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            Atualizar
                        </button>
                    </div>
                    <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        <input type="text" placeholder="Buscar por nome ou e-mail do produtor..." value={productSearch} onChange={e => setProductSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-white/[0.02] border-b border-white/[0.06] text-white placeholder-gray-600 text-xs focus:outline-none focus:border-blue-500/30" />
                        {productSearch && <button onClick={() => setProductSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-sm">×</button>}
                    </div>

                    {loadingProducts ? (
                        <div className="p-16 flex flex-col items-center justify-center">
                            <div className="w-12 h-12 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4" />
                            <p className="text-gray-400">Carregando produtos...</p>
                        </div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="p-12 text-center">
                            <h4 className="text-xl font-semibold text-blue-400 mb-2">Nenhum produto encontrado</h4>
                            <p className="text-gray-500 text-sm">Não há produtos com o status selecionado.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {filteredProducts.map((product, index) => {
                                const sc = statusConfig(product.review_status)
                                return (
                                    <div key={product.id} className="overflow-hidden border-b border-white/[0.05] last:border-b-0 group" style={{ animationDelay: `${index * 40}ms` }}>
                                        <div className="p-4">
                                            <div className="flex items-start gap-5">
                                                <div className="w-24 h-24 rounded-xl overflow-hidden bg-gradient-to-br from-white/[0.05] to-white/[0.02] flex-shrink-0">
                                                    {product.image_url ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-600/20 to-indigo-600/20"><span className="text-2xl font-bold text-blue-400">{product.name?.charAt(0) || 'P'}</span></div>}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                        <h4 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">{product.name}</h4>
                                                        <span className="text-violet-400 text-xs font-medium">Área</span>
                                                        <span className={`text-xs font-medium ${sc.cls}`}>{sc.label}</span>
                                                    </div>
                                                    <p className="text-sm text-gray-500 line-clamp-2">{product.description || 'Sem descrição'}</p>
                                                    {product.review_status === 'rejected' && product.review_notes && <p className="mt-1.5 text-xs text-red-400/80 bg-red-500/5 border border-red-500/15 rounded px-2 py-1 line-clamp-2">Motivo: {product.review_notes}</p>}
                                                    <p className="mt-3 text-sm text-gray-500">Owner: <span className="text-gray-300">{product.owner_email || 'Unknown'}</span></p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 mt-4">
                                                <button onClick={() => openProductDetails(product)} className="text-gray-400 hover:text-white text-xs transition-colors flex items-center gap-1">
                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                    Detalhes
                                                </button>
                                                {product.review_status !== 'approved' && (
                                                    <button onClick={() => handleApproveProduct(product.id)} disabled={processingId === product.id} className="flex items-center gap-1 text-gray-400 hover:text-green-400 text-xs transition-colors disabled:opacity-50">
                                                        {processingId === product.id ? <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg> : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>}
                                                        Aprovar
                                                    </button>
                                                )}
                                                {product.review_status !== 'rejected' && (
                                                    <button onClick={() => { setSelectedProduct(product); setShowProductRejectModal(true) }} disabled={processingId === product.id} className="flex items-center gap-1 text-gray-400 hover:text-red-400 text-xs transition-colors disabled:opacity-50">
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
                    )}
                </div>
            )}

            {/* App Reject Modal */}
            {showAppRejectModal && selectedApp && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="relative w-full max-w-lg rounded-none shadow-2xl overflow-hidden">
                        <div className="absolute inset-0 bg-[#0a0f1a]" />
                        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-blue-600/20 via-blue-500/10 to-transparent" />
                        <div className="relative p-4 border-b border-white/[0.05]">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">×</div>
                                <div><h3 className="text-xl font-bold text-white">Reject App</h3><p className="text-sm text-gray-400">{selectedApp.name}</p></div>
                            </div>
                        </div>
                        <div className="relative p-4">
                            <label className="block text-sm font-semibold text-gray-300 mb-3">Rejection Reason</label>
                            <textarea value={appRejectionReason} onChange={e => setAppRejectionReason(e.target.value)} placeholder="Explain why this app is being rejected..." rows={4} className="w-full p-4 bg-white/[0.03] border border-white/[0.08] rounded-xl focus:ring-2 focus:ring-blue-400/50 focus:border-blue-500/50 text-white placeholder-gray-500 transition-all resize-none" />
                            <p className="text-xs text-gray-500 mt-2">This message will be sent to the app owner</p>
                        </div>
                        <div className="relative p-4 border-t border-white/[0.05] flex gap-3 justify-end">
                            <button onClick={() => { setShowAppRejectModal(false); setSelectedApp(null); setAppRejectionReason('') }} className="px-5 py-3 text-gray-400 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] rounded-xl font-medium transition-all">Cancel</button>
                            <button onClick={handleRejectApp} disabled={!appRejectionReason.trim() || processingId === selectedApp.id} className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-all">
                                {processingId === selectedApp.id ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Confirm Rejection'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Product Reject Modal */}
            {showProductRejectModal && selectedProduct && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="backdrop-blur-xl bg-[#0d1117]/95 rounded-none shadow-2xl w-full max-w-md border border-white/[0.05]">
                        <div className="p-4 border-b border-white/[0.05]">
                            <h3 className="text-base font-semibold text-white">Reject Product</h3>
                            <p className="text-sm text-gray-500 mt-0.5">{selectedProduct.name}</p>
                        </div>
                        <div className="p-4">
                            <label className="block text-sm font-medium text-gray-300 mb-2">Rejection Reason</label>
                            <textarea value={productRejectionReason} onChange={e => setProductRejectionReason(e.target.value)} placeholder="Explain why this product is being rejected..." rows={4} className="w-full p-3 bg-white/[0.03] border border-white/[0.08] rounded-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-500 text-white placeholder-gray-500 transition-all resize-none" />
                            <p className="text-xs text-gray-500 mt-2">This message will be sent to the product owner</p>
                        </div>
                        <div className="p-4 border-t border-white/[0.05] flex gap-3 justify-end">
                            <button onClick={() => { setShowProductRejectModal(false); setSelectedProduct(null); setProductRejectionReason('') }} className="px-4 py-2 text-gray-300 bg-white/[0.05] hover:bg-white/[0.1] font-medium transition-colors">Cancel</button>
                            <button onClick={handleRejectProduct} disabled={!productRejectionReason.trim() || processingId === selectedProduct.id} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors">
                                {processingId === selectedProduct.id ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Confirm Rejection'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* App Details Modal */}
            {showAppDetailsModal && selectedApp && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col bg-[#0d1117] border border-white/[0.07]">
                        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between flex-shrink-0">
                            <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wider">App Review</p>
                                <h3 className="text-sm font-semibold text-white mt-0.5">{appDetailsData?.app?.name || selectedApp.name}</h3>
                            </div>
                            <button onClick={() => { setShowAppDetailsModal(false); setSelectedApp(null); setAppDetailsData(null) }} className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-white transition-colors">×</button>
                        </div>
                        <div className="p-5 overflow-y-auto flex-1 space-y-5">
                            {loadingAppDetails ? (
                                <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-gray-600 border-t-white rounded-full animate-spin" /></div>
                            ) : (
                                <>
                                    <div className="flex items-start gap-4">
                                        <div className="w-16 h-16 flex-shrink-0 overflow-hidden border border-white/[0.07]">
                                            {selectedApp.logo_url ? <img src={selectedApp.logo_url} alt={selectedApp.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-gray-800"><span className="text-lg font-bold text-gray-400">{selectedApp.name?.charAt(0) || 'A'}</span></div>}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-white">{appDetailsData?.app?.name || selectedApp.name}</p>
                                            <p className="text-xs text-gray-500 mt-0.5">/{selectedApp.slug}</p>
                                            {appDetailsData?.app?.description && <p className="text-xs text-gray-400 mt-1">{appDetailsData.app.description}</p>}
                                            <div className="flex flex-wrap gap-1.5 mt-2">
                                                {selectedApp.app_type && <span className="text-[11px] px-2 py-0.5 bg-white/[0.04] border border-white/[0.07] text-gray-400">{selectedApp.app_type}</span>}
                                                {selectedApp.language && <span className="text-[11px] px-2 py-0.5 bg-white/[0.04] border border-white/[0.07] text-gray-400">{selectedApp.language}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    {appDetailsData?.stats && (
                                        <div className="flex gap-6 border-t border-b border-white/[0.05] py-3">
                                            {[['Produtos', appDetailsData.stats.totalMemberAreas], ['Módulos', appDetailsData.stats.totalModules], ['Aulas', appDetailsData.stats.totalLessons]].map(([l, v]) => (
                                                <div key={l}><p className="text-xs text-gray-500">{l}</p><p className="text-sm font-semibold text-white mt-0.5">{v}</p></div>
                                            ))}
                                            <div><p className="text-xs text-gray-500">Owner</p><p className="text-xs text-white mt-0.5">{appDetailsData?.app?.owner_email || selectedApp.owner_email || 'Unknown'}</p></div>
                                        </div>
                                    )}
                                    {appDetailsData?.memberAreas?.length > 0 && (
                                        <div>
                                            <p className="text-xs text-gray-500 mb-2">Produtos do App</p>
                                            <div className="space-y-2">
                                                {appDetailsData.memberAreas.map((area: any, idx: number) => (
                                                    <div key={area.id} className="border border-white/[0.06]">
                                                        <div className="px-3 py-2.5 border-b border-white/[0.05] flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                {(area.image_url || area.cover_url) ? <img src={area.image_url || area.cover_url} alt={area.name} className="w-6 h-6 object-cover" /> : <span className="text-xs text-gray-600 w-4">{idx + 1}.</span>}
                                                                <span className="text-xs font-medium text-white">{area.name || 'Sem nome'}</span>
                                                                {area.type && <span className="text-[11px] px-1.5 py-0.5 border border-white/[0.07] text-gray-500">{area.type}</span>}
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                {area.modules?.length > 0 && <span className="text-[11px] text-gray-600">{area.modules.length} módulos</span>}
                                                                {area.contents?.length > 0 && <span className="text-[11px] text-gray-600">{area.contents.length} itens</span>}
                                                            </div>
                                                        </div>
                                                        {area.modules?.length > 0 && (
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
                                                                        {mod.lessons?.length > 0 && (
                                                                            <div className="divide-y divide-white/[0.02]">
                                                                                {mod.lessons.map((lesson: any, lIdx: number) => (
                                                                                    <div key={lesson.id} className="px-4 py-1.5 pl-10 flex items-center gap-3">
                                                                                        <span className="text-[10px] text-gray-700 w-4">{lIdx + 1}.</span>
                                                                                        <p className="text-[11px] text-gray-400 flex-1">{lesson.title || 'Sem título'}</p>
                                                                                        <span className="text-[10px] text-gray-600 capitalize">{lesson.content_type || 'video'}</span>
                                                                                        {lesson.video_url && <a href={lesson.video_url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-500 hover:text-blue-400">↗</a>}
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
                                </>
                            )}
                        </div>
                        <div className="px-5 py-4 border-t border-white/[0.06] flex items-center justify-between flex-shrink-0">
                            <button onClick={() => { setShowAppDetailsModal(false); setSelectedApp(null); setAppDetailsData(null) }} className="text-xs text-gray-500 hover:text-white transition-colors">Fechar</button>
                            <div className="flex gap-2">
                                <button onClick={() => { setShowAppDetailsModal(false); setShowAppRejectModal(true) }} className="px-4 py-2 text-xs text-gray-300 border border-white/[0.1] hover:border-white/[0.2] hover:text-white transition-colors">Rejeitar App</button>
                                <button onClick={() => { handleApproveApp(selectedApp.id); setShowAppDetailsModal(false) }} className="px-4 py-2 text-xs text-white bg-blue-600 hover:bg-blue-500 transition-colors">Aprovar App</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Product Details Modal */}
            {showProductDetailsModal && selectedProduct && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col bg-[#0d1117] border border-white/[0.07]">
                        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between flex-shrink-0">
                            <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wider">Product Review</p>
                                <h3 className="text-sm font-semibold text-white mt-0.5">{selectedProduct.name}</h3>
                            </div>
                            <button onClick={() => { setShowProductDetailsModal(false); setSelectedProduct(null); setProductDetails(null) }} className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-white transition-colors">×</button>
                        </div>
                        <div className="p-5 overflow-y-auto flex-1 space-y-5">
                            {loadingProductDetails ? (
                                <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-gray-600 border-t-white rounded-full animate-spin" /></div>
                            ) : (
                                <>
                                    <div className="flex items-start gap-4">
                                        <div className="w-16 h-16 flex-shrink-0 overflow-hidden border border-white/[0.07]">
                                            {selectedProduct.image_url ? <img src={selectedProduct.image_url} alt={selectedProduct.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-gray-800"><span className="text-lg font-bold text-gray-400">{selectedProduct.name?.charAt(0) || 'P'}</span></div>}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-white">{selectedProduct.name}</p>
                                            <p className="text-sm text-gray-400 mt-0.5">{selectedProduct.currency || 'USD'} {selectedProduct.price?.toFixed(2) || '0.00'}</p>
                                            <div className="flex flex-wrap gap-1.5 mt-2">
                                                <span className="text-[11px] px-2 py-0.5 bg-white/[0.04] border border-white/[0.07] text-gray-400">PENDING</span>
                                                {selectedProduct.category && <span className="text-[11px] px-2 py-0.5 bg-white/[0.04] border border-white/[0.07] text-gray-400">{selectedProduct.category}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    {productDetails?.stats && (
                                        <div className="flex gap-6 border-t border-b border-white/[0.05] py-3">
                                            {[['Modules', productDetails.stats.totalModules], ['Lessons', productDetails.stats.totalLessons], ['Members', productDetails.stats.totalMembers]].map(([l, v]) => (
                                                <div key={l}><p className="text-xs text-gray-500">{l}</p><p className="text-sm font-semibold text-white mt-0.5">{v}</p></div>
                                            ))}
                                        </div>
                                    )}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><p className="text-xs text-gray-500 mb-1">Owner</p><p className="text-xs text-white">{productDetails?.product?.owner_email || selectedProduct.owner_email || 'Unknown'}</p></div>
                                        <div><p className="text-xs text-gray-500 mb-1">Submitted</p><p className="text-xs text-white">{new Date(selectedProduct.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p></div>
                                    </div>
                                    {selectedProduct.description && (
                                        <div><p className="text-xs text-gray-500 mb-1.5">Description</p><p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">{selectedProduct.description}</p></div>
                                    )}
                                    {productDetails?.modules?.length > 0 && (
                                        <div>
                                            <p className="text-xs text-gray-500 mb-2">Course Content</p>
                                            <div className="space-y-2">
                                                {productDetails.modules.map((module: any, mIdx: number) => (
                                                    <div key={module.id} className="border border-white/[0.06]">
                                                        <div className="px-3 py-2.5 border-b border-white/[0.05] flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs text-gray-600 w-4">{mIdx + 1}.</span>
                                                                <span className="text-xs font-medium text-white">{module.title}</span>
                                                            </div>
                                                            <span className="text-[11px] text-gray-600">{module.lessons?.length || 0} lessons</span>
                                                        </div>
                                                        {module.lessons?.length > 0 && (
                                                            <div className="divide-y divide-white/[0.03]">
                                                                {module.lessons.map((lesson: any, lIdx: number) => (
                                                                    <div key={lesson.id} className="px-3 py-2 pl-8 flex items-center gap-3">
                                                                        <span className="text-[11px] text-gray-700 w-4">{lIdx + 1}.</span>
                                                                        <p className="text-xs text-gray-300 flex-1">{lesson.title}</p>
                                                                        <span className="text-[11px] text-gray-600 capitalize">{lesson.type || 'video'}</span>
                                                                        {lesson.video_url && <a href={lesson.video_url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-500 hover:text-blue-400">Video ↗</a>}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="px-5 py-4 border-t border-white/[0.06] flex items-center justify-between flex-shrink-0">
                            <button onClick={() => { setShowProductDetailsModal(false); setSelectedProduct(null); setProductDetails(null) }} className="text-xs text-gray-500 hover:text-white transition-colors">Cancel</button>
                            <div className="flex gap-2">
                                <button onClick={() => { setShowProductDetailsModal(false); setShowProductRejectModal(true) }} className="px-4 py-2 text-xs text-gray-300 border border-white/[0.1] hover:border-white/[0.2] hover:text-white transition-colors">Reject Product</button>
                                <button onClick={() => { handleApproveProduct(selectedProduct.id); setShowProductDetailsModal(false) }} className="px-4 py-2 text-xs text-white bg-blue-600 hover:bg-blue-500 transition-colors">Approve Product</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
