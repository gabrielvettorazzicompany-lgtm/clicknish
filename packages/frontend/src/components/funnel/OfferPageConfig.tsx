import { useState, useEffect } from 'react'
import { Package, Save, Trash2, AlertCircle, Check, Zap, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/i18n'

interface Product {
    id: string
    name: string
    price: number
    currency: string
    source: 'member_area' | 'application' | 'app_product'
    application_id?: string
    app_name?: string
}

interface Module {
    id: string
    title: string
    order_position: number
}

interface Checkout {
    id: string
    name: string
    custom_price?: number
}

interface OfferData {
    id?: string
    product_id: string
    checkout_id: string
    title: string
    description: string
    original_price: number
    offer_price: number
    discount_percentage: number
    currency: string
    button_text: string
    is_active: boolean
    one_click_purchase: boolean
}

interface OfferPageConfigProps {
    funnelId: string
    pageId: string
    pageType: 'upsell' | 'downsell'
    onUpdate: () => void
    onOfferLoaded?: (productId: string | undefined, oneClick: boolean, offerId: string | undefined, checkoutId?: string) => void
}

export default function OfferPageConfig({ funnelId, pageId, pageType, onUpdate, onOfferLoaded }: OfferPageConfigProps) {
    const { t } = useI18n()
    const { user } = useAuthStore()
    const [products, setProducts] = useState<Product[]>([])
    const [checkouts, setCheckouts] = useState<Checkout[]>([])
    const [offer, setOffer] = useState<OfferData | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    // Module selection states
    const [modules, setModules] = useState<Module[]>([])
    const [selectedModules, setSelectedModules] = useState<string[]>([])
    const [loadingModules, setLoadingModules] = useState(false)
    const [savingModules, setSavingModules] = useState(false)
    const [showModules, setShowModules] = useState(false)

    const isOfferPage = pageType === 'upsell' || pageType === 'downsell'

    const [form, setForm] = useState<OfferData>({
        product_id: '',
        checkout_id: '',
        title: '',
        description: '',
        original_price: 0,
        offer_price: 0,
        discount_percentage: 0,
        currency: 'USD',
        button_text: 'Yes, I Want It!',
        is_active: true,
        one_click_purchase: isOfferPage ? true : false
    })

    useEffect(() => {
        if (user) {
            fetchProducts()
            fetchExistingOffer()
        }
    }, [user, funnelId, pageId])

    const fetchProducts = async () => {
        try {
            // Fetch member areas
            const { data: memberAreas } = await supabase
                .from('member_areas')
                .select('id, name, price, currency')
                .eq('owner_id', user?.id)

            // Fetch applications and their products
            const { data: apps } = await supabase
                .from('applications')
                .select('id, name')
                .eq('owner_id', user?.id)

            let appProducts: Product[] = []
            if (apps && apps.length > 0) {
                const appIds = apps.map(a => a.id)
                const { data: prods } = await supabase
                    .from('products')
                    .select('id, name, application_id')
                    .in('application_id', appIds)

                if (prods) {
                    appProducts = prods.map(p => {
                        const app = apps.find(a => a.id === p.application_id)
                        return {
                            id: p.id,
                            name: p.name,
                            price: 0,
                            currency: 'USD',
                            source: 'app_product' as const,
                            application_id: p.application_id,
                            app_name: app?.name
                        }
                    })
                }
            }

            const allProducts: Product[] = [
                ...(memberAreas || []).map(p => ({ ...p, source: 'member_area' as const })),
                ...(apps || []).map(a => ({ id: a.id, name: a.name, price: 0, currency: 'USD', source: 'application' as const })),
                ...appProducts
            ]

            setProducts(allProducts)
        } catch (error) {
            console.error('Error fetching products:', error)
        }
    }

    const fetchCheckouts = async (productId: string, productSource: string) => {
        try {
            let query = supabase.from('checkouts').select('id, name, custom_price')

            if (productSource === 'member_area') {
                query = query.eq('member_area_id', productId)
            } else if (productSource === 'app_product') {
                const product = products.find(p => p.id === productId)
                if (product?.application_id) {
                    query = query.eq('application_id', product.application_id)
                } else {
                    setCheckouts([])
                    return
                }
            } else {
                query = query.eq('application_id', productId)
            }

            const { data, error } = await query
            if (error) throw error

            setCheckouts(data || [])

            // Auto-select if only 1 checkout available and fill price
            if (data && data.length === 1 && !form.checkout_id) {
                const price = data[0].custom_price || 0
                setForm(prev => ({
                    ...prev,
                    checkout_id: data[0].id,
                    original_price: price,
                    offer_price: prev.offer_price || price,
                }))
            }
        } catch (error) {
            console.error('Error fetching checkouts:', error)
            setCheckouts([])
        }
    }

    const fetchModules = async (productId: string, productSource: string) => {
        try {
            setLoadingModules(true)
            let modulesData: Module[] = []

            if (productSource === 'member_area') {
                // For member areas, fetch from community_modules
                const { data, error } = await supabase
                    .from('community_modules')
                    .select('id, title, order_position')
                    .eq('member_area_id', productId)
                    .order('order_position', { ascending: true })

                if (error) throw error
                modulesData = data || []
            } else if (productSource === 'application') {
                // For applications, fetch products (modules) within the app
                const { data, error } = await supabase
                    .from('products')
                    .select('id, name')
                    .eq('application_id', productId)
                    .order('name', { ascending: true })

                if (error) throw error
                modulesData = (data || []).map(item => ({
                    id: item.id,
                    title: item.name,
                    order_position: 0
                }))
            } else if (productSource === 'app_product') {
                // For app products, fetch sibling products from the same app
                const product = products.find(p => p.id === productId)
                if (product?.application_id) {
                    const { data, error } = await supabase
                        .from('products')
                        .select('id, name')
                        .eq('application_id', product.application_id)
                        .order('name', { ascending: true })

                    if (error) throw error
                    modulesData = (data || []).map(item => ({
                        id: item.id,
                        title: item.name,
                        order_position: 0
                    }))
                }
            }

            setModules(modulesData)

            // Fetch saved selection from funnel_pages.settings
            const { data: pageData, error: pageError } = await supabase
                .from('funnel_pages')
                .select('settings')
                .eq('id', pageId)
                .single()

            if (!pageError && pageData?.settings) {
                const settings = pageData.settings as any
                if (Array.isArray(settings.selected_modules)) {
                    setSelectedModules(settings.selected_modules)
                }
            }
        } catch (err) {
            console.error('Error loading modules:', err)
        } finally {
            setLoadingModules(false)
        }
    }

    const toggleModule = (moduleId: string) => {
        setSelectedModules(prev =>
            prev.includes(moduleId)
                ? prev.filter(id => id !== moduleId)
                : [...prev, moduleId]
        )
    }

    const toggleAllModules = () => {
        if (selectedModules.length === modules.length) {
            setSelectedModules([])
        } else {
            setSelectedModules(modules.map(m => m.id))
        }
    }

    const handleSaveModules = async () => {
        try {
            setSavingModules(true)

            // Get current settings first
            const { data: pageData } = await supabase
                .from('funnel_pages')
                .select('settings')
                .eq('id', pageId)
                .single()

            const currentSettings = (pageData?.settings as any) || {}

            const { error } = await supabase
                .from('funnel_pages')
                .update({
                    settings: {
                        ...currentSettings,
                        selected_modules: selectedModules
                    },
                    updated_at: new Date().toISOString()
                })
                .eq('id', pageId)

            if (error) throw error
            onUpdate?.()
        } catch (err) {
            console.error('Error saving modules:', err)
            alert(t('funnel_components.error_saving_modules'))
        } finally {
            setSavingModules(false)
        }
    }

    const fetchExistingOffer = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('checkout_offers')
                .select('*')
                .eq('page_id', pageId)
                .maybeSingle()

            if (error) throw error

            if (data) {
                const offerData: OfferData = {
                    id: data.id,
                    product_id: data.product_id,
                    checkout_id: data.checkout_id || '',
                    title: data.title || '',
                    description: data.description || '',
                    original_price: data.original_price || 0,
                    offer_price: data.offer_price || 0,
                    discount_percentage: data.discount_percentage || 0,
                    currency: data.currency || 'USD',
                    button_text: data.button_text || '',
                    is_active: data.is_active ?? true,
                    one_click_purchase: isOfferPage ? true : (data.one_click_purchase ?? false)
                }
                setOffer(offerData)
                setForm(offerData)
                onOfferLoaded?.(data.product_id, data.one_click_purchase ?? false, data.id, data.checkout_id || undefined)
            } else {
                onOfferLoaded?.(undefined, false, undefined, undefined)
            }
        } catch (error) {
            console.error('Error fetching offer:', error)
        } finally {
            setLoading(false)
        }
    }

    const selectedProduct = products.find(p => p.id === form.product_id)

    useEffect(() => {
        if (selectedProduct && !offer) {
            setForm(prev => ({
                ...prev,
                original_price: selectedProduct.price,
                offer_price: selectedProduct.price,
                discount_percentage: 0,
                currency: selectedProduct.currency || 'USD'
            }))
        }
    }, [selectedProduct])

    // Fetch checkouts when product changes
    useEffect(() => {
        if (form.product_id && products.length > 0) {
            const prod = products.find(p => p.id === form.product_id)
            if (prod) {
                fetchCheckouts(form.product_id, prod.source)
            }
        } else {
            setCheckouts([])
        }
    }, [form.product_id, products])

    // Fetch modules when product changes
    useEffect(() => {
        if (form.product_id && products.length > 0) {
            const prod = products.find(p => p.id === form.product_id)
            if (prod) {
                fetchModules(form.product_id, prod.source)
            }
        } else {
            setModules([])
            setSelectedModules([])
        }
    }, [form.product_id, products])

    const formatCurrency = (value: number) => {
        const symbols: { [key: string]: string } = {
            BRL: 'R$', USD: '$', EUR: '€', CNY: '¥', COP: '$', CAD: 'C$'
        }
        const symbol = symbols[form.currency] || form.currency
        return `${symbol} ${value.toFixed(2)}`
    }

    const handleSave = async () => {
        if (!form.product_id) {
            alert(t('funnel_components.please_select_product'))
            return
        }
        if (!form.title.trim()) {
            alert(t('funnel_components.please_enter_title'))
            return
        }

        try {
            setSaving(true)

            const payload: any = {
                funnel_id: funnelId,
                page_id: pageId,
                product_id: form.product_id,
                product_type: selectedProduct?.source || 'member_area',
                application_id: selectedProduct?.application_id || null,
                checkout_id: form.checkout_id || null,
                offer_type: pageType,
                title: form.title,
                description: form.description,
                original_price: form.original_price,
                offer_price: form.offer_price,
                discount_percentage: form.original_price > 0 && form.offer_price < form.original_price
                    ? Math.round(((form.original_price - form.offer_price) / form.original_price) * 100)
                    : 0,
                currency: form.currency,
                button_text: form.button_text,
                is_active: form.is_active,
                one_click_purchase: form.one_click_purchase,
                product_name: selectedProduct?.name || null,
            }

            if (offer?.id) {
                const { error } = await supabase
                    .from('checkout_offers')
                    .update(payload)
                    .eq('id', offer.id)
                if (error) throw error
            } else {
                const { data, error } = await supabase
                    .from('checkout_offers')
                    .insert([payload])
                    .select()
                    .single()
                if (error) throw error
                setOffer({ ...form, id: data.id })
                setForm(prev => ({ ...prev, id: data.id }))
            }

            setSaved(true)
            setTimeout(() => setSaved(false), 2000)

            // Notify parent with offer data so ScriptGenerator gets it via props
            const savedId = offer?.id || form.id
            onOfferLoaded?.(form.product_id, form.one_click_purchase, savedId, form.checkout_id || undefined)

            onUpdate()
        } catch (error) {
            console.error('Error saving offer:', error)
            alert(t('funnel_components.error_saving_offer'))
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!offer?.id) return
        if (!confirm(t('funnel_components.confirm_remove_offer'))) return

        try {
            const { error } = await supabase
                .from('checkout_offers')
                .delete()
                .eq('id', offer.id)

            if (error) throw error

            setOffer(null)
            setForm({
                product_id: '',
                checkout_id: '',
                title: '',
                description: '',
                original_price: 0,
                offer_price: 0,
                discount_percentage: 0,
                currency: 'USD',
                button_text: 'Yes, I Want It!',
                is_active: true,
                one_click_purchase: isOfferPage ? true : false
            })
            setCheckouts([])
            onOfferLoaded?.(undefined, false, undefined, undefined)
            onUpdate()
        } catch (error) {
            console.error('Error deleting offer:', error)
        }
    }

    if (loading) {
        return (
            <div className="py-4">
                <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-zinc-500"></div>
                    <span className="ml-2 text-gray-500 text-xs">{t('funnel_components.loading_offer')}</span>
                </div>
            </div>
        )
    }

    const typeLabel = pageType === 'upsell' ? 'Upsell' : 'Downsell'
    const typeColor = pageType === 'upsell' ? 'green' : 'orange'

    return (
        <div>
            <h3 className="text-xs font-medium text-white mb-3">
                {t('funnel_components.offer_product')}
            </h3>

            {/* Product Selector */}
            <div className="relative mb-3">
                <select
                    value={form.product_id}
                    onChange={(e) => {
                        const pid = e.target.value
                        const prod = products.find(p => p.id === pid)
                        setForm(prev => ({
                            ...prev,
                            product_id: pid,
                            checkout_id: '',
                            title: prev.title || (prod ? `Special offer for ${prod.name}` : ''),
                        }))
                        setCheckouts([])
                    }}
                    className="w-full px-3 py-2 bg-white dark:bg-transparent border border-gray-300 dark:border-zinc-800 rounded text-gray-900 dark:text-white text-xs focus:outline-none focus:border-blue-500 dark:focus:border-zinc-600 appearance-none cursor-pointer transition-colors"
                >
                    <option value="">{t('funnel_components.select_product_dots')}</option>
                    {products.filter(p => p.source === 'member_area').length > 0 && (
                        <optgroup label={t('funnel_components.member_areas')}>
                            {products.filter(p => p.source === 'member_area').map((product) => (
                                <option key={product.id} value={product.id}>
                                    {product.name} — {product.currency} {product.price.toFixed(2)}
                                </option>
                            ))}
                        </optgroup>
                    )}
                    {products.filter(p => p.source === 'application').length > 0 && (
                        <optgroup label={t('funnel_components.apps')}>
                            {products.filter(p => p.source === 'application').map((product) => (
                                <option key={product.id} value={product.id}>
                                    {product.name}
                                </option>
                            ))}
                        </optgroup>
                    )}
                    {products.filter(p => p.source === 'app_product').length > 0 && (
                        <optgroup label={t('funnel_components.app_products')}>
                            {products.filter(p => p.source === 'app_product').map((product) => (
                                <option key={product.id} value={product.id}>
                                    {product.app_name} › {product.name}
                                </option>
                            ))}
                        </optgroup>
                    )}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
            </div>

            {products.length === 0 && (
                <div className="mt-2 bg-yellow-500/10 border border-yellow-500/30 rounded p-2 mb-3">
                    <p className="text-xs text-yellow-400">
                        {t('funnel_components.no_products_create')}
                    </p>
                </div>
            )}

            {/* Module Selection - only show when product has modules */}
            {form.product_id && modules.length > 0 && (
                <div className="bg-white dark:bg-transparent rounded-lg border border-gray-200 dark:border-zinc-800 p-3 mb-3">
                    <button
                        onClick={() => setShowModules(!showModules)}
                        className="w-full flex items-center justify-between"
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-white">{t('funnel_components.unlocked_modules')}</span>
                            {selectedModules.length > 0 && (
                                <span className="px-1.5 py-0.5 text-[10px] bg-blue-500/20 text-blue-400 rounded">
                                    {selectedModules.length}
                                </span>
                            )}
                        </div>
                        {showModules ? (
                            <ChevronUp className="w-4 h-4 text-zinc-400" />
                        ) : (
                            <ChevronDown className="w-4 h-4 text-zinc-400" />
                        )}
                    </button>

                    {!showModules && (
                        <p className="text-[10px] text-gray-500 dark:text-zinc-500 mt-2">
                            {selectedModules.length > 0
                                ? t('funnel_components.modules_selected', { count: selectedModules.length })
                                : t('funnel_components.click_to_select_modules')
                            }
                        </p>
                    )}

                    {showModules && (
                        <>
                            <div className="flex items-center justify-between mt-3 mb-2">
                                <p className="text-[10px] text-gray-500 dark:text-zinc-500">
                                    {t('funnel_components.select_modules_desc')}
                                </p>
                                <button
                                    onClick={toggleAllModules}
                                    className="text-[10px] text-gray-600 dark:text-zinc-500 hover:text-gray-900 dark:hover:text-zinc-300 transition-colors"
                                >
                                    {selectedModules.length === modules.length ? t('funnel_components.unselect_all') : t('funnel_components.select_all')}
                                </button>
                            </div>

                            {loadingModules ? (
                                <div className="flex items-center justify-center py-4">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" />
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                        {modules.map(mod => {
                                            const isSelected = selectedModules.includes(mod.id)
                                            return (
                                                <label
                                                    key={mod.id}
                                                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors ${isSelected
                                                        ? 'bg-blue-500/10 border border-blue-500/30'
                                                        : 'bg-gray-100 dark:bg-zinc-800/50 border border-transparent hover:bg-gray-200 dark:hover:bg-zinc-800'
                                                        }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleModule(mod.id)}
                                                        className="sr-only"
                                                    />
                                                    <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors ${isSelected
                                                        ? 'bg-blue-500 text-white'
                                                        : 'border border-gray-300 dark:border-zinc-600 bg-transparent'
                                                        }`}>
                                                        {isSelected && <Check className="w-3 h-3" />}
                                                    </div>
                                                    <span className="text-xs text-gray-700 dark:text-zinc-300 truncate">
                                                        {mod.title}
                                                    </span>
                                                </label>
                                            )
                                        })}
                                    </div>

                                    <button
                                        onClick={handleSaveModules}
                                        disabled={savingModules}
                                        className="mt-3 w-full py-1.5 text-[11px] font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors"
                                    >
                                        {savingModules ? t('common.saving') : t('funnel_components.save_selection', { fallback: 'Save selection' })}
                                    </button>
                                </>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Checkout Selector */}
            {form.product_id && checkouts.length > 0 && (
                <div className="mb-3">
                    <label className="block text-xs text-zinc-400 mb-1.5">{t('funnel_components.checkout_label')}</label>
                    <div className="relative">
                        <select
                            value={form.checkout_id}
                            onChange={(e) => {
                                const checkoutId = e.target.value
                                const checkout = checkouts.find(c => c.id === checkoutId)
                                const price = checkout?.custom_price || 0
                                setForm(prev => ({
                                    ...prev,
                                    checkout_id: checkoutId,
                                    original_price: price,
                                    offer_price: price,
                                    discount_percentage: 0,
                                }))
                            }}
                            className="w-full px-3 py-2 bg-white dark:bg-transparent border border-gray-300 dark:border-zinc-800 rounded text-gray-900 dark:text-white text-xs focus:outline-none focus:border-blue-500 dark:focus:border-zinc-600 appearance-none cursor-pointer transition-colors"
                        >
                            <option value="">{t('funnel_components.select_checkout')}</option>
                            {checkouts.map((checkout) => (
                                <option key={checkout.id} value={checkout.id}>
                                    {checkout.name}{checkout.custom_price ? ` — $${checkout.custom_price.toFixed(2)}` : ''}
                                </option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </div>
                    </div>
                </div>
            )}

            {form.product_id && checkouts.length === 0 && (
                <div className="mt-2 bg-yellow-500/10 border border-yellow-500/30 rounded p-2 mb-3">
                    <p className="text-xs text-yellow-400">
                        {t('funnel_components.no_checkouts_create')}
                    </p>
                </div>
            )}

            {/* Expanded form when product selected */}
            {form.product_id && (
                <div className="space-y-3">
                    {/* Title + Description */}
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs text-gray-500 dark:text-zinc-400 mb-1.5">{t('common.title')}</label>
                            <input
                                type="text"
                                value={form.title}
                                onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                                placeholder={`Special offer for ${selectedProduct?.name || 'this product'}`}
                                className="w-full px-3 py-2 bg-white dark:bg-transparent border border-gray-300 dark:border-zinc-800 rounded text-gray-900 dark:text-white text-xs placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:border-blue-500 dark:focus:border-zinc-600 transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 dark:text-zinc-400 mb-1.5">{t('common.description')}</label>
                            <textarea
                                value={form.description}
                                onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                                placeholder={t('funnel_components.description_placeholder')}
                                rows={2}
                                className="w-full px-3 py-2 bg-white dark:bg-transparent border border-gray-300 dark:border-zinc-800 rounded text-gray-900 dark:text-white text-xs placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:border-blue-500 dark:focus:border-zinc-600 resize-none transition-colors"
                            />
                        </div>
                    </div>

                    {/* Price */}
                    <div>
                        <label className="block text-xs text-gray-500 dark:text-zinc-400 mb-1.5">{t('common.price')}</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500 text-xs">
                                {({ BRL: 'R$', USD: '$', EUR: '€', CNY: '¥', COP: '$', CAD: 'C$' } as Record<string, string>)[form.currency] || form.currency}
                            </span>
                            <input
                                type="number"
                                step="0.01"
                                value={form.offer_price}
                                onChange={(e) => {
                                    const val = Number(e.target.value)
                                    setForm(prev => ({
                                        ...prev,
                                        offer_price: val,
                                        discount_percentage: prev.original_price > 0 && val < prev.original_price
                                            ? Math.round(((prev.original_price - val) / prev.original_price) * 100)
                                            : 0
                                    }))
                                }}
                                className="w-full pl-10 pr-3 py-2 bg-white dark:bg-transparent border border-gray-300 dark:border-zinc-800 rounded text-gray-900 dark:text-white text-xs focus:outline-none focus:border-blue-500 dark:focus:border-zinc-600 transition-colors"
                            />
                        </div>
                        {selectedProduct && form.offer_price < selectedProduct.price && form.offer_price > 0 && (
                            <p className="text-xs text-green-400 mt-1.5">
                                {Math.round(((selectedProduct.price - form.offer_price) / selectedProduct.price) * 100)}% off ({formatCurrency(selectedProduct.price)})
                            </p>
                        )}
                    </div>

                    {/* One-Click Toggle — apenas para páginas que não são upsell/downsell */}
                    {!isOfferPage && (
                        <div className="flex items-center justify-between py-2.5 border-t border-zinc-800">
                            <div className="flex items-center gap-2">
                                <Zap size={12} className={form.one_click_purchase ? 'text-yellow-400' : 'text-zinc-600'} />
                                <div>
                                    <p className="text-xs text-zinc-300">{t('funnel_components.one_click_purchase')}</p>
                                    <p className="text-[10px] text-zinc-600">
                                        {form.one_click_purchase ? t('funnel_components.auto_charges_card') : t('funnel_components.redirects_to_checkout')}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setForm(prev => ({ ...prev, one_click_purchase: !prev.one_click_purchase }))}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.one_click_purchase ? 'bg-yellow-500' : 'bg-zinc-700'}`}
                            >
                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${form.one_click_purchase ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                            </button>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-1">
                        {offer?.id ? (
                            <button
                                onClick={handleDelete}
                                className="text-xs text-zinc-600 hover:text-red-400 transition-colors"
                            >
                                <Trash2 size={12} className="inline mr-1" />
                                {t('funnel_components.remove')}
                            </button>
                        ) : <span />}
                        <button
                            onClick={handleSave}
                            disabled={saving || !form.product_id || !form.title.trim()}
                            className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-medium transition-all ${saved
                                ? 'bg-green-500/10 text-green-400'
                                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed'
                                }`}
                        >
                            {saved ? <><Check size={12} /> {t('funnel_components.saved')}</> : <><Save size={12} /> {saving ? t('common.saving') : t('common.save')}</>}
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
