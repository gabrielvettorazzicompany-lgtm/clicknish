import { useState, useEffect } from 'react'
import { supabase } from '@/services/supabase'
import type { Product, Checkout, OrderBump, OrderBumpFormData } from './types'
import OrderBumpPreview from './OrderBumpPreview'
import { useI18n } from '@/i18n'

interface OrderBumpFormProps {
    funnelId: string
    products: Product[]
    filteredProducts: Product[]
    checkouts: Checkout[]
    loadingCheckouts: boolean
    mainProductId: string | null
    mainProductType: string | null
    orderBumps: OrderBump[]
    editingBumpId: string | null
    onFetchCheckouts: (productId: string, source: 'marketplace' | 'application' | 'app_product') => Promise<void>
    onSuccess: () => void
    onCancel: () => void
}

export default function OrderBumpForm({
    funnelId,
    products,
    filteredProducts,
    checkouts,
    loadingCheckouts,
    mainProductId,
    mainProductType,
    orderBumps,
    editingBumpId,
    onFetchCheckouts,
    onSuccess,
    onCancel
}: OrderBumpFormProps) {
    const { t } = useI18n()
    const [formData, setFormData] = useState<OrderBumpFormData>({
        selectedProduct: '',
        selectedCheckout: '',
        applyDiscount: false,
        discount: 0,
        callToAction: 'YES, I ACCEPT THIS SPECIAL OFFER!',
        productName: 'Your product name',
        productDescription: 'Add to purchase',
        showProductImage: false,
        selectedProductImageUrl: undefined
    })
    const [saving, setSaving] = useState(false)
    const [selectedApp, setSelectedApp] = useState<string>('')

    // Auto-select checkout when only one is available
    useEffect(() => {
        if (checkouts.length === 1 && !formData.selectedCheckout) {
            setFormData(prev => ({ ...prev, selectedCheckout: checkouts[0].id }))
        }
    }, [checkouts])

    // Load editing bump data
    useEffect(() => {
        if (editingBumpId) {
            const bump = orderBumps.find(b => b.id === editingBumpId)
            if (bump) {
                setFormData({
                    selectedProduct: bump.product_id,
                    selectedCheckout: bump.checkout_offer_id || '',
                    applyDiscount: (bump.discount_percentage ?? 0) > 0,
                    discount: bump.discount_percentage || 0,
                    callToAction: bump.button_text,
                    productName: bump.product_name || 'Your product name',
                    productDescription: bump.product_description || 'Add to purchase',
                    showProductImage: bump.show_product_image || false,
                    selectedProductImageUrl: bump.offer_product_image
                })

                // Fetch product checkouts and set selectedApp
                const product = products.find(p => p.id === bump.product_id)
                if (product) {
                    if (product.source === 'app_product' && product.application_id) {
                        setSelectedApp(product.application_id)
                    } else if (product.source === 'marketplace') {
                        setSelectedApp(product.id)
                    } else {
                        setSelectedApp(product.id)
                    }
                    onFetchCheckouts(product.id, product.source).then(() => {
                        if (bump.checkout_offer_id) {
                            setTimeout(() => {
                                setFormData(prev => ({ ...prev, selectedCheckout: bump.checkout_offer_id || '' }))
                            }, 100)
                        }
                    })
                }
            }
        }
    }, [editingBumpId, orderBumps, products])

    const handleProductChange = async (productId: string) => {
        setFormData(prev => ({
            ...prev,
            selectedProduct: productId,
            selectedCheckout: ''
        }))

        if (productId) {
            const product = products.find(p => p.id === productId)
            if (product) {
                setFormData(prev => ({
                    ...prev,
                    productName: product.name,
                    selectedProductImageUrl: product.image_url
                }))
                await onFetchCheckouts(productId, product.source)
            }
        } else {
            setFormData(prev => ({
                ...prev,
                selectedProductImageUrl: undefined
            }))
        }
    }

    const handleSubmit = async () => {
        // Validate maximum limit of 3 order bumps (only for creation, not editing)
        if (!editingBumpId && orderBumps.length >= 3) {
            alert(t('funnel_components.max_bumps_error'))
            return
        }

        if (!formData.selectedProduct) {
            alert(t('funnel_components.select_a_product'))
            return
        }

        if (!formData.selectedCheckout && checkouts.length > 1) {
            alert(t('funnel_components.select_a_checkout'))
            return
        }

        // Auto-select first checkout if only one available and not yet selected
        if (!formData.selectedCheckout && checkouts.length === 1) {
            setFormData(prev => ({ ...prev, selectedCheckout: checkouts[0].id }))
        }

        if (formData.selectedProduct === mainProductId) {
            alert(t('funnel_components.cannot_add_main'))
            return
        }

        try {
            setSaving(true)

            // Fetch checkout_id from the funnel checkout page
            const { data: checkoutPage, error: pageError } = await supabase
                .from('funnel_pages')
                .select('checkout_id')
                .eq('funnel_id', funnelId)
                .eq('page_type', 'checkout')
                .single()

            if (pageError) throw pageError

            if (!checkoutPage?.checkout_id) {
                alert(t('funnel_components.configure_checkout_first'))
                return
            }

            const product = products.find(p => p.id === formData.selectedProduct)
            if (!product) return

            // Calculate prices
            let originalPrice = product.price || 0
            let checkoutPrice = originalPrice

            if (formData.selectedCheckout) {
                const checkout = checkouts.find(c => c.id === formData.selectedCheckout)
                if (checkout) {
                    checkoutPrice = checkout.final_price
                    originalPrice = checkout.final_price
                }
            }

            // For app_products that have no inherent price, use checkout price
            // If still 0, it's likely a free product or price needs to be set via discount
            if (product.source === 'app_product' && originalPrice === 0 && checkoutPrice === 0) {
                // Use checkout custom_price as the base - app products inherit from their app's checkout
                const checkout = checkouts.find(c => c.id === formData.selectedCheckout)
                if (checkout?.custom_price) {
                    originalPrice = checkout.custom_price
                    checkoutPrice = checkout.custom_price
                }
            }

            const offerPrice = formData.applyDiscount && formData.discount > 0
                ? checkoutPrice * (1 - formData.discount / 100)
                : checkoutPrice

            const orderBumpData: any = {
                funnel_id: funnelId,
                checkout_id: checkoutPage.checkout_id,
                product_id: formData.selectedProduct,
                product_type: product.source === 'marketplace' ? 'member_area' : product.source,
                application_id: product.application_id || null,
                offer_type: 'order_bump',
                button_text: formData.callToAction,
                checkout_offer_id: formData.selectedCheckout || null,
                product_name: formData.productName,
                product_description: formData.productDescription,
                show_product_image: formData.showProductImage,
                offer_product_image: formData.selectedProductImageUrl,
                discount_percentage: formData.applyDiscount && formData.discount > 0 ? formData.discount : null,
                original_price: originalPrice,
                offer_price: offerPrice,
                currency: product.currency || 'USD',
                is_active: true
            }

            if (!editingBumpId) {
                orderBumpData.offer_position = orderBumps.length + 1
            }

            if (mainProductType === 'marketplace' && mainProductId) {
                orderBumpData.main_product_id = mainProductId
            }

            if (editingBumpId) {
                const { error } = await supabase
                    .from('checkout_offers')
                    .update(orderBumpData)
                    .eq('id', editingBumpId)

                if (error) throw error
            } else {
                const { error } = await supabase
                    .from('checkout_offers')
                    .insert([orderBumpData])

                if (error) throw error
            }

            onSuccess()
        } catch (error: any) {
            console.error('Error saving order bump:', error)
            alert(t('funnel_components.error_saving_bump'))
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="mb-6 p-4 rounded-lg border border-gray-200 dark:border-zinc-800 space-y-4 bg-white dark:bg-transparent">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                {editingBumpId ? t('funnel_components.edit_order_bump') : t('funnel_components.new_order_bump')}
            </h4>

            {/* Product - Two step: App then Product */}
            <div className="space-y-3">
                <label className="block text-sm text-gray-700 dark:text-gray-400 mb-1">
                    {t('funnel_components.product_label')}
                </label>
                {filteredProducts.length === 0 ? (
                    <div className="w-full px-4 py-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                        {products.length === 0 ? (
                            <>
                                <p className="text-sm text-yellow-400">
                                    ⚠️ {t('funnel_components.no_products_found')}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                    {t('funnel_components.no_products_hint')}
                                </p>
                            </>
                        ) : (
                            <>
                                <p className="text-sm text-yellow-400">
                                    ⚠️ {t('funnel_components.no_available_bump')}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                    {t('funnel_components.no_available_hint')}
                                </p>
                            </>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Step 1: Select source (Member Area or App) */}
                        <select
                            value={selectedApp}
                            onChange={(e) => {
                                const val = e.target.value
                                setSelectedApp(val)
                                // If it's a member_area (direct product), select it immediately
                                const product = filteredProducts.find(p => p.id === val && p.source === 'marketplace')
                                if (product) {
                                    handleProductChange(val)
                                } else {
                                    // Deselect product when changing app
                                    if (formData.selectedProduct) {
                                        handleProductChange('')
                                    }
                                }
                            }}
                            className="w-full px-3 py-2 bg-transparent border border-zinc-700 rounded-lg text-white text-xs focus:outline-none focus:border-zinc-500"
                        >
                            <option value="">{t('funnel_components.select')}</option>
                            {/* Member Areas */}
                            {filteredProducts.filter(p => p.source === 'marketplace').length > 0 && (
                                <optgroup label={t('funnel_components.member_areas')}>
                                    {filteredProducts.filter(p => p.source === 'marketplace').map(product => (
                                        <option key={product.id} value={product.id}>
                                            {product.name}{product.price ? ` - $${product.price.toFixed(2)}` : ''}
                                        </option>
                                    ))}
                                </optgroup>
                            )}
                            {/* Applications (as group headers) */}
                            {filteredProducts.filter(p => p.source === 'application').length > 0 && (
                                <optgroup label={t('funnel_components.applications_label')}>
                                    {filteredProducts.filter(p => p.source === 'application').map(app => (
                                        <option key={app.id} value={app.id}>
                                            {app.name}{app.id === mainProductId ? ' (main product)' : ''}
                                        </option>
                                    ))}
                                </optgroup>
                            )}
                        </select>

                        {/* Step 2: If an app is selected, show its products */}
                        {selectedApp && filteredProducts.find(p => p.id === selectedApp && p.source === 'application') && (
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">{t('funnel_components.select_product_app')}</label>
                                <select
                                    value={formData.selectedProduct}
                                    onChange={(e) => handleProductChange(e.target.value)}
                                    className="w-full px-3 py-2 bg-transparent border border-zinc-700 rounded-lg text-white text-xs focus:outline-none focus:border-zinc-500"
                                >
                                    <option value="">{t('funnel_components.select_a_product')}</option>
                                    {/* Use full products list (not filtered) to find app_products */}
                                    {products
                                        .filter(p => p.source === 'app_product' && p.application_id === selectedApp)
                                        .map(product => (
                                            <option key={product.id} value={product.id}>
                                                {product.name.includes('›') ? product.name.split('›').pop()?.trim() : product.name}
                                            </option>
                                        ))}
                                </select>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Offer */}
            <div>
                <label className="block text-sm text-gray-700 dark:text-gray-400 mb-2">
                    {t('funnel_components.offer_label')}
                </label>
                {!formData.selectedProduct ? (
                    <div className="text-sm text-zinc-400 bg-transparent border border-zinc-700 rounded-lg px-3 py-2">
                        {t('funnel_components.select_product_first')}
                    </div>
                ) : loadingCheckouts ? (
                    <div className="text-sm text-zinc-400 bg-transparent border border-zinc-700 rounded-lg px-3 py-2">
                        {t('funnel_components.loading_checkouts')}
                    </div>
                ) : checkouts.length === 0 ? (
                    <div className="text-sm text-zinc-400 bg-transparent border border-zinc-700 rounded-lg px-3 py-2">
                        {t('funnel_components.no_checkout_available')}
                    </div>
                ) : (
                    <select
                        value={formData.selectedCheckout}
                        onChange={(e) => setFormData(prev => ({ ...prev, selectedCheckout: e.target.value }))}
                        className="w-full px-3 py-2 bg-transparent border border-zinc-700 rounded-lg text-white text-xs focus:outline-none focus:border-zinc-500"
                    >
                        <option value="">{t('funnel_components.select_a_checkout')}</option>
                        {checkouts.map(checkout => {
                            const product = products.find(p => p.id === formData.selectedProduct)
                            const cur = product?.currency || 'USD'
                            const formatted = new Intl.NumberFormat(cur === 'CHF' ? 'de-CH' : cur === 'BRL' ? 'pt-BR' : 'en-US', { style: 'currency', currency: cur }).format(checkout.final_price)
                            return (
                                <option key={checkout.id} value={checkout.id}>
                                    {checkout.name} - {formatted}
                                </option>
                            )
                        })}
                    </select>
                )}
            </div>

            {/* Apply Discount */}
            <div className="flex items-center gap-2">
                <input
                    type="checkbox"
                    id="apply-discount"
                    checked={formData.applyDiscount}
                    onChange={(e) => setFormData(prev => ({ ...prev, applyDiscount: e.target.checked }))}
                    className="w-4 h-4 rounded border-zinc-600 text-white focus:ring-zinc-500 focus:ring-offset-0 bg-transparent"
                />
                <label htmlFor="apply-discount" className="text-sm text-gray-700 dark:text-gray-400">
                    {t('funnel_components.apply_discount')}
                </label>
            </div>

            {/* Discount Field */}
            {formData.applyDiscount && (
                <div>
                    <label className="block text-sm text-gray-700 dark:text-gray-400 mb-2">
                        {t('funnel_components.discount_percent')}
                    </label>
                    <input
                        type="number"
                        min="0"
                        max="100"
                        value={formData.discount}
                        onChange={(e) => setFormData(prev => ({ ...prev, discount: Number(e.target.value) }))}
                        placeholder="0"
                        className="w-full px-3 py-2 bg-transparent border border-zinc-700 rounded-lg text-white text-xs placeholder-zinc-400 focus:outline-none focus:border-zinc-500"
                    />
                </div>
            )}

            {/* Call to Action */}
            <div>
                <label className="block text-sm text-gray-700 dark:text-gray-400 mb-2">
                    {t('funnel_components.call_to_action')}
                </label>
                <input
                    type="text"
                    value={formData.callToAction}
                    onChange={(e) => setFormData(prev => ({ ...prev, callToAction: e.target.value }))}
                    placeholder="YES, I ACCEPT THIS SPECIAL OFFER!"
                    className="w-full px-3 py-2 bg-transparent border border-zinc-700 rounded-lg text-white text-xs placeholder-zinc-400 focus:outline-none focus:border-zinc-500"
                />
            </div>

            {/* Name */}
            <div>
                <label className="block text-sm text-gray-700 dark:text-gray-400 mb-2">
                    {t('common.name')}
                </label>
                <input
                    type="text"
                    value={formData.productName}
                    onChange={(e) => setFormData(prev => ({ ...prev, productName: e.target.value }))}
                    placeholder="Your product name"
                    className="w-full px-3 py-2 bg-transparent border border-zinc-700 rounded-lg text-white text-xs placeholder-zinc-400 focus:outline-none focus:border-zinc-500"
                />
            </div>

            {/* Description */}
            <div>
                <label className="block text-sm text-gray-700 dark:text-gray-400 mb-2">
                    {t('common.description')}
                </label>
                <input
                    type="text"
                    value={formData.productDescription}
                    onChange={(e) => setFormData(prev => ({ ...prev, productDescription: e.target.value }))}
                    placeholder="Add to purchase"
                    className="w-full px-3 py-2 bg-transparent border border-zinc-700 rounded-lg text-white text-xs placeholder-zinc-400 focus:outline-none focus:border-zinc-500"
                />
            </div>

            {/* Show product image */}
            <div className="flex items-center gap-2">
                <input
                    type="checkbox"
                    id="show-product-image"
                    checked={formData.showProductImage}
                    onChange={(e) => setFormData(prev => ({ ...prev, showProductImage: e.target.checked }))}
                    className="w-4 h-4 rounded border-zinc-600 text-white focus:ring-zinc-500 focus:ring-offset-0 bg-transparent"
                />
                <label htmlFor="show-product-image" className="text-sm text-gray-700 dark:text-gray-400">
                    {t('funnel_components.show_product_image')}
                </label>
            </div>

            {/* Preview */}
            <OrderBumpPreview
                selectedProduct={formData.selectedProduct}
                callToAction={formData.callToAction}
                productName={formData.productName}
                productDescription={formData.productDescription}
                showProductImage={formData.showProductImage}
                selectedProductImageUrl={formData.selectedProductImageUrl}
                applyDiscount={formData.applyDiscount}
                discount={formData.discount}
                selectedCheckout={formData.selectedCheckout}
                products={products}
                checkouts={checkouts}
            />

            {/* Buttons */}
            <div className="flex gap-2">
                <button
                    onClick={handleSubmit}
                    disabled={saving || !formData.selectedProduct || filteredProducts.length === 0}
                    className="flex-1 px-4 py-2 bg-white hover:bg-zinc-100 text-black rounded-lg transition-all disabled:opacity-50 text-xs"
                >
                    {saving ? t('common.saving') : editingBumpId ? t('funnel_components.update') : t('common.save')}
                </button>
                <button
                    onClick={onCancel}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors text-xs"
                >
                    {t('common.cancel')}
                </button>
            </div>
        </div>
    )
}
