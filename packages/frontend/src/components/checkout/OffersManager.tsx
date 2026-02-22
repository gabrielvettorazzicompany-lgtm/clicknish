import { useState, useEffect } from 'react'
import { Plus, Trash2, Edit3, Tag, TrendingUp, TrendingDown, ShoppingCart, ChevronDown, ChevronUp, DollarSign, Percent } from 'lucide-react'
import { supabase } from '@/services/supabase'
import { useI18n } from '@/i18n'

interface CheckoutOffer {
    id?: string
    checkout_id: string
    main_product_id: string
    offer_product_id: string
    offer_type: 'order_bump' | 'upsell' | 'downsell'
    offer_position: number
    is_active: boolean
    discount_type?: 'percentage' | 'fixed' | 'none'
    discount_value?: number
    custom_price?: number
    title?: string
    description?: string
    image_url?: string
}

interface Product {
    id: string
    name: string
    price: number
    currency?: string
    image_url?: string
    description?: string
}

interface OffersManagerProps {
    checkoutId: string
    mainProductId: string
    userId: string
}

export default function OffersManager({ checkoutId, mainProductId, userId }: OffersManagerProps) {
    const { t } = useI18n()
    const [offers, setOffers] = useState<CheckoutOffer[]>([])
    const [availableProducts, setAvailableProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [showAddModal, setShowAddModal] = useState(false)
    const [editingOffer, setEditingOffer] = useState<CheckoutOffer | null>(null)
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['order_bump']))

    const [offerForm, setOfferForm] = useState<CheckoutOffer>({
        checkout_id: checkoutId,
        main_product_id: mainProductId,
        offer_product_id: '',
        offer_type: 'order_bump',
        offer_position: 1,
        is_active: true,
        discount_type: 'none',
        discount_value: 0,
        title: '',
        description: ''
    })

    useEffect(() => {
        fetchData()
    }, [checkoutId, userId])

    const fetchData = async () => {
        try {
            setLoading(true)

            // Fetch existing offers
            const { data: offersData, error: offersError } = await supabase
                .from('checkout_offers')
                .select('*')
                .eq('checkout_id', checkoutId)
                .order('offer_position')

            if (offersError) throw offersError
            setOffers(offersData || [])

            // Fetch all types of products from user
            const allProducts: Product[] = []

            // 1. Marketplace products
            const { data: marketplaceProducts, error: marketplaceError } = await supabase
                .from('marketplace_products')
                .select('id, name, price, currency, image_url, description')
                .eq('owner_id', userId)
                .neq('id', mainProductId)
                .in('status', ['active', 'draft'])

            if (!marketplaceError && marketplaceProducts) {
                allProducts.push(...marketplaceProducts.map(p => ({
                    ...p,
                    currency: p.currency || 'BRL'
                })))
            }

            // 2. Community modules (Member Area products)
            const { data: communityModules, error: communityError } = await supabase
                .from('community_modules')
                .select('id, name, price, image_url, description, application_id')
                .neq('id', mainProductId)

            if (!communityError && communityModules) {
                // Filter by user's applications
                const { data: userApps } = await supabase
                    .from('applications')
                    .select('id')
                    .eq('owner_id', userId)

                const userAppIds = userApps?.map(app => app.id) || []

                const userCommunityModules = communityModules.filter(module =>
                    module.application_id && userAppIds.includes(module.application_id)
                )

                allProducts.push(...userCommunityModules.map(p => ({
                    id: p.id,
                    name: `📚 ${p.name}`,
                    price: p.price || 0,
                    currency: 'BRL',
                    image_url: p.image_url,
                    description: p.description
                })))
            }

            // 3. Applications (Apps)
            const { data: apps, error: appsError } = await supabase
                .from('applications')
                .select('id, name, logo_url, description')
                .eq('owner_id', userId)
                .neq('id', mainProductId)

            if (!appsError && apps) {
                allProducts.push(...apps.map(app => ({
                    id: app.id,
                    name: `🚀 ${app.name}`,
                    price: 0, // Apps geralmente não tem preço fixo
                    currency: 'BRL',
                    image_url: app.logo_url,
                    description: app.description
                })))
            }

            setAvailableProducts(allProducts)
        } catch (error) {
            console.error('Error fetching offers data:', error)
        } finally {
            setLoading(false)
        }
    }

    const toggleSection = (section: string) => {
        setExpandedSections(prev => {
            const newSet = new Set(prev)
            if (newSet.has(section)) {
                newSet.delete(section)
            } else {
                newSet.add(section)
            }
            return newSet
        })
    }

    const handleAddOffer = () => {
        setEditingOffer(null)
        setOfferForm({
            checkout_id: checkoutId,
            main_product_id: mainProductId,
            offer_product_id: '',
            offer_type: 'order_bump',
            offer_position: 1,
            is_active: true,
            discount_type: 'none',
            discount_value: 0,
            title: '',
            description: ''
        })
        setShowAddModal(true)
    }

    const handleEditOffer = (offer: CheckoutOffer) => {
        setEditingOffer(offer)
        setOfferForm(offer)
        setShowAddModal(true)
    }

    const handleDeleteOffer = async (offerId: string) => {
        if (!confirm(t('checkout_pages.confirm_remove_offer'))) return

        try {
            const { error } = await supabase
                .from('checkout_offers')
                .delete()
                .eq('id', offerId)

            if (error) throw error

            await fetchData()
        } catch (error) {
            console.error('Error deleting offer:', error)
            alert(t('checkout_pages.error_removing_offer'))
        }
    }

    const handleSaveOffer = async () => {
        try {
            // Validate
            if (!offerForm.offer_product_id) {
                alert(t('checkout_pages.select_product_for_offer'))
                return
            }

            // Calculate final price
            let finalPrice
            const selectedProduct = availableProducts.find(p => p.id === offerForm.offer_product_id)
            if (!selectedProduct) return

            if (offerForm.custom_price) {
                finalPrice = offerForm.custom_price
            } else if (offerForm.discount_type === 'percentage' && offerForm.discount_value) {
                finalPrice = selectedProduct.price * (1 - offerForm.discount_value / 100)
            } else if (offerForm.discount_type === 'fixed' && offerForm.discount_value) {
                finalPrice = selectedProduct.price - offerForm.discount_value
            } else {
                finalPrice = selectedProduct.price
            }

            const offerData = {
                ...offerForm,
                custom_price: finalPrice !== selectedProduct.price ? finalPrice : null
            }

            if (editingOffer?.id) {
                // Update
                const { error } = await supabase
                    .from('checkout_offers')
                    .update(offerData)
                    .eq('id', editingOffer.id)

                if (error) throw error
            } else {
                // Insert
                const { error } = await supabase
                    .from('checkout_offers')
                    .insert([offerData])

                if (error) throw error
            }

            setShowAddModal(false)
            await fetchData()
        } catch (error) {
            console.error('Error saving offer:', error)
            alert(t('checkout_pages.error_saving_offer'))
        }
    }

    const getOfferIcon = (type: string) => {
        switch (type) {
            case 'order_bump':
                return <ShoppingCart size={14} />
            case 'upsell':
                return <TrendingUp size={14} />
            case 'downsell':
                return <TrendingDown size={14} />
            default:
                return <Tag size={14} />
        }
    }

    const getOfferLabel = (type: string) => {
        switch (type) {
            case 'order_bump':
                return 'Order Bump'
            case 'upsell':
                return 'Upsell'
            case 'downsell':
                return 'Downsell'
            default:
                return type
        }
    }

    const formatPrice = (price: number, currency?: string) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: currency || 'BRL'
        }).format(price)
    }

    const calculateFinalPrice = (productId: string) => {
        const product = availableProducts.find(p => p.id === productId)
        if (!product) return 0

        if (offerForm.custom_price) {
            return offerForm.custom_price
        }

        if (offerForm.discount_type === 'percentage' && offerForm.discount_value) {
            return product.price * (1 - offerForm.discount_value / 100)
        }

        if (offerForm.discount_type === 'fixed' && offerForm.discount_value) {
            return Math.max(0, product.price - offerForm.discount_value)
        }

        return product.price
    }

    const groupedOffers = {
        order_bump: offers.filter(o => o.offer_type === 'order_bump'),
        upsell: offers.filter(o => o.offer_type === 'upsell'),
        downsell: offers.filter(o => o.offer_type === 'downsell')
    }

    if (loading) {
        return (
            <div className="p-6 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#252941] border-t-blue-500 mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">{t('checkout_pages.loading_offers')}</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-gray-100">{t('checkout_pages.offers_sales_funnel')}</h3>
                    <p className="text-xs text-gray-500 mt-1">{t('checkout_pages.configure_offers_desc')}</p>
                </div>
                <button
                    onClick={handleAddOffer}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                >
                    <Plus size={14} />
                    {t('checkout_pages.add_offer')}
                </button>
            </div>

            {/* Offers by Type */}
            <div className="space-y-3">
                {/* Order Bumps */}
                <div className="bg-[#0f1117] rounded-lg border border-[#1e2139]">
                    <button
                        onClick={() => toggleSection('order_bump')}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#1a1d2e] transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <ShoppingCart size={16} className="text-blue-400" />
                            <span className="font-medium text-gray-100">{t('checkout_pages.order_bumps')}</span>
                            <span className="text-xs text-gray-500">({groupedOffers.order_bump.length})</span>
                        </div>
                        {expandedSections.has('order_bump') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    {expandedSections.has('order_bump') && (
                        <div className="p-4 pt-0 space-y-2">
                            {groupedOffers.order_bump.length === 0 ? (
                                <p className="text-sm text-gray-500 text-center py-4">{t('checkout_pages.no_order_bump')}</p>
                            ) : (
                                groupedOffers.order_bump.map((offer) => {
                                    const product = availableProducts.find(p => p.id === offer.offer_product_id)
                                    return (
                                        <div key={offer.id} className="flex items-center gap-3 p-3 bg-[#1a1d2e] rounded-lg border border-[#252941]">
                                            {product?.image_url && (
                                                <img src={product.image_url} alt={product.name} className="w-12 h-12 object-cover rounded" />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-sm font-medium text-gray-100 truncate">{product?.name}</h4>
                                                <p className="text-xs text-gray-500">
                                                    {offer.custom_price ? formatPrice(offer.custom_price, product?.currency) : formatPrice(product?.price || 0, product?.currency)}
                                                    {offer.discount_value && offer.discount_type !== 'none' && (
                                                        <span className="ml-2 text-green-400">
                                                            -{offer.discount_type === 'percentage' ? `${offer.discount_value}%` : formatPrice(offer.discount_value, product?.currency)}
                                                        </span>
                                                    )}
                                                </p>
                                            </div>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => handleEditOffer(offer)}
                                                    className="p-1.5 text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                                                >
                                                    <Edit3 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteOffer(offer.id!)}
                                                    className="p-1.5 text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    )}
                </div>

                {/* Upsells */}
                <div className="bg-[#0f1117] rounded-lg border border-[#1e2139]">
                    <button
                        onClick={() => toggleSection('upsell')}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#1a1d2e] transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <TrendingUp size={16} className="text-green-400" />
                            <span className="font-medium text-gray-100">{t('checkout_pages.upsells')}</span>
                            <span className="text-xs text-gray-500">({groupedOffers.upsell.length})</span>
                        </div>
                        {expandedSections.has('upsell') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    {expandedSections.has('upsell') && (
                        <div className="p-4 pt-0 space-y-2">
                            {groupedOffers.upsell.length === 0 ? (
                                <p className="text-sm text-gray-500 text-center py-4">{t('checkout_pages.no_upsell')}</p>
                            ) : (
                                groupedOffers.upsell.map((offer) => {
                                    const product = availableProducts.find(p => p.id === offer.offer_product_id)
                                    return (
                                        <div key={offer.id} className="flex items-center gap-3 p-3 bg-[#1a1d2e] rounded-lg border border-[#252941]">
                                            {product?.image_url && (
                                                <img src={product.image_url} alt={product.name} className="w-12 h-12 object-cover rounded" />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-sm font-medium text-gray-100 truncate">{product?.name}</h4>
                                                <p className="text-xs text-gray-500">
                                                    {offer.custom_price ? formatPrice(offer.custom_price, product?.currency) : formatPrice(product?.price || 0, product?.currency)}
                                                </p>
                                            </div>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => handleEditOffer(offer)}
                                                    className="p-1.5 text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                                                >
                                                    <Edit3 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteOffer(offer.id!)}
                                                    className="p-1.5 text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    )}
                </div>

                {/* Downsells */}
                <div className="bg-[#0f1117] rounded-lg border border-[#1e2139]">
                    <button
                        onClick={() => toggleSection('downsell')}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#1a1d2e] transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <TrendingDown size={16} className="text-orange-400" />
                            <span className="font-medium text-gray-100">{t('checkout_pages.downsells')}</span>
                            <span className="text-xs text-gray-500">({groupedOffers.downsell.length})</span>
                        </div>
                        {expandedSections.has('downsell') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    {expandedSections.has('downsell') && (
                        <div className="p-4 pt-0 space-y-2">
                            {groupedOffers.downsell.length === 0 ? (
                                <p className="text-sm text-gray-500 text-center py-4">{t('checkout_pages.no_downsell')}</p>
                            ) : (
                                groupedOffers.downsell.map((offer) => {
                                    const product = availableProducts.find(p => p.id === offer.offer_product_id)
                                    return (
                                        <div key={offer.id} className="flex items-center gap-3 p-3 bg-[#1a1d2e] rounded-lg border border-[#252941]">
                                            {product?.image_url && (
                                                <img src={product.image_url} alt={product.name} className="w-12 h-12 object-cover rounded" />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-sm font-medium text-gray-100 truncate">{product?.name}</h4>
                                                <p className="text-xs text-gray-500">
                                                    {offer.custom_price ? formatPrice(offer.custom_price, product?.currency) : formatPrice(product?.price || 0, product?.currency)}
                                                </p>
                                            </div>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => handleEditOffer(offer)}
                                                    className="p-1.5 text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                                                >
                                                    <Edit3 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteOffer(offer.id!)}
                                                    className="p-1.5 text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Add/Edit Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-4">
                    <div className="bg-[#1a1d2e] rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-[#1e2139]">
                            <h3 className="text-lg font-semibold text-gray-100">
                                {editingOffer ? t('checkout_pages.edit_offer') : t('checkout_pages.add_offer')}
                            </h3>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Offer Type */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">{t('checkout_pages.offer_type')}</label>
                                <select
                                    value={offerForm.offer_type}
                                    onChange={(e) => setOfferForm({ ...offerForm, offer_type: e.target.value as any })}
                                    className="w-full px-3 py-2 bg-[#0f1117] border border-[#252941] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100"
                                >
                                    <option value="order_bump">{t('checkout_pages.order_bump_option')}</option>
                                    <option value="upsell">{t('checkout_pages.upsell_option')}</option>
                                    <option value="downsell">{t('checkout_pages.downsell_option')}</option>
                                </select>
                            </div>

                            {/* Product */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">{t('checkout_pages.product_label')}</label>
                                <select
                                    value={offerForm.offer_product_id}
                                    onChange={(e) => setOfferForm({ ...offerForm, offer_product_id: e.target.value })}
                                    className="w-full px-3 py-2 bg-[#0f1117] border border-[#252941] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100"
                                >
                                    <option value="">{t('checkout_pages.select_product')}</option>
                                    {availableProducts.map(product => (
                                        <option key={product.id} value={product.id}>
                                            {product.name} - {formatPrice(product.price, product.currency)}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Discount Type */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">{t('checkout_pages.discount_type_label')}</label>
                                <select
                                    value={offerForm.discount_type}
                                    onChange={(e) => setOfferForm({ ...offerForm, discount_type: e.target.value as any })}
                                    className="w-full px-3 py-2 bg-[#0f1117] border border-[#252941] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100"
                                >
                                    <option value="none">{t('checkout_pages.no_discount')}</option>
                                    <option value="percentage">{t('checkout_pages.percentage_discount')}</option>
                                    <option value="fixed">{t('checkout_pages.fixed_value_discount')}</option>
                                </select>
                            </div>

                            {/* Discount Value */}
                            {offerForm.discount_type !== 'none' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        {t('checkout_pages.discount_value_label')} {offerForm.discount_type === 'percentage' ? '(%)' : '(R$)'}
                                    </label>
                                    <div className="flex items-center gap-2">
                                        {offerForm.discount_type === 'percentage' ? <Percent size={16} className="text-gray-500" /> : <DollarSign size={16} className="text-gray-500" />}
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            max={offerForm.discount_type === 'percentage' ? '100' : undefined}
                                            value={offerForm.discount_value || ''}
                                            onChange={(e) => setOfferForm({ ...offerForm, discount_value: parseFloat(e.target.value) || 0 })}
                                            className="flex-1 px-3 py-2 bg-[#0f1117] border border-[#252941] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Price Preview */}
                            {offerForm.offer_product_id && (
                                <div className="p-3 bg-[#0f1117] rounded-lg border border-[#252941]">
                                    <p className="text-xs text-gray-500 mb-1">{t('checkout_pages.final_offer_price')}</p>
                                    <p className="text-lg font-semibold text-green-400">
                                        {formatPrice(calculateFinalPrice(offerForm.offer_product_id), availableProducts.find(p => p.id === offerForm.offer_product_id)?.currency)}
                                    </p>
                                </div>
                            )}

                            {/* Title */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">{t('checkout_pages.title_optional')}</label>
                                <input
                                    type="text"
                                    value={offerForm.title || ''}
                                    onChange={(e) => setOfferForm({ ...offerForm, title: e.target.value })}
                                    placeholder={t('checkout_pages.title_placeholder')}
                                    className="w-full px-3 py-2 bg-[#0f1117] border border-[#252941] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">{t('checkout_pages.description_optional')}</label>
                                <textarea
                                    value={offerForm.description || ''}
                                    onChange={(e) => setOfferForm({ ...offerForm, description: e.target.value })}
                                    placeholder={t('checkout_pages.description_placeholder')}
                                    rows={3}
                                    className="w-full px-3 py-2 bg-[#0f1117] border border-[#252941] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100 resize-none"
                                />
                            </div>

                            {/* Position */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">{t('checkout_pages.display_position')}</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={offerForm.offer_position}
                                    onChange={(e) => setOfferForm({ ...offerForm, offer_position: parseInt(e.target.value) || 1 })}
                                    className="w-full px-3 py-2 bg-[#0f1117] border border-[#252941] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100"
                                />
                                <p className="text-xs text-gray-500 mt-1">{t('checkout_pages.display_order_hint')}</p>
                            </div>
                        </div>

                        <div className="p-6 border-t border-[#1e2139] flex gap-3">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="flex-1 px-4 py-2 border border-[#252941] text-gray-300 rounded-lg hover:bg-[#252941] transition-colors"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={handleSaveOffer}
                                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                            >
                                {editingOffer ? t('checkout_pages.update') : t('checkout_pages.add')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
