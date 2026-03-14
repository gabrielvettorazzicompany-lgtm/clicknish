import { useState, useEffect } from 'react'
import { supabase } from '@/services/supabase'
import type { Product, Checkout, OrderBump, OrderBumpFormData } from './types'
import OrderBumpPreview from './OrderBumpPreview'
import { useI18n } from '@/i18n'

const GRADIENT_PRESETS = [
    // Quentes
    { from: '#f97316', to: '#ef4444', dir: '90deg' },
    { from: '#ef4444', to: '#f97316', dir: '90deg' },
    { from: '#f97316', to: '#eab308', dir: '90deg' },
    { from: '#ef4444', to: '#ec4899', dir: '90deg' },
    { from: '#f97316', to: '#fbbf24', dir: '135deg' },
    { from: '#ef4444', to: '#fca5a5', dir: '180deg' },
    // Frios
    { from: '#3b82f6', to: '#06b6d4', dir: '90deg' },
    { from: '#06b6d4', to: '#3b82f6', dir: '90deg' },
    { from: '#1e40af', to: '#3b82f6', dir: '90deg' },
    { from: '#0ea5e9', to: '#6366f1', dir: '90deg' },
    { from: '#3b82f6', to: '#8b5cf6', dir: '135deg' },
    { from: '#06b6d4', to: '#22c55e', dir: '90deg' },
    // Roxos / Rosa
    { from: '#ec4899', to: '#8b5cf6', dir: '90deg' },
    { from: '#8b5cf6', to: '#ec4899', dir: '90deg' },
    { from: '#7c3aed', to: '#4f46e5', dir: '90deg' },
    { from: '#a855f7', to: '#ec4899', dir: '135deg' },
    { from: '#ec4899', to: '#f97316', dir: '90deg' },
    { from: '#8b5cf6', to: '#06b6d4', dir: '135deg' },
    // Verdes / Teal
    { from: '#22c55e', to: '#14b8a6', dir: '90deg' },
    { from: '#14b8a6', to: '#22c55e', dir: '90deg' },
    { from: '#16a34a', to: '#15803d', dir: '180deg' },
    { from: '#22c55e', to: '#84cc16', dir: '90deg' },
    { from: '#059669', to: '#0d9488', dir: '90deg' },
    { from: '#14b8a6', to: '#3b82f6', dir: '135deg' },
    // Neutros / Escuros
    { from: '#111827', to: '#374151', dir: '180deg' },
    { from: '#1e293b', to: '#0f172a', dir: '135deg' },
    { from: '#18181b', to: '#3f3f46', dir: '180deg' },
    { from: '#374151', to: '#6b7280', dir: '90deg' },
    { from: '#0f172a', to: '#1e3a5f', dir: '135deg' },
    { from: '#1c1917', to: '#44403c', dir: '180deg' },
    // Claros / Pastel
    { from: '#f3f4f6', to: '#e5e7eb', dir: '90deg' },
    { from: '#fef9c3', to: '#fef08a', dir: '90deg' },
    { from: '#fce7f3', to: '#fbcfe8', dir: '90deg' },
    { from: '#ede9fe', to: '#ddd6fe', dir: '90deg' },
    { from: '#e0f2fe', to: '#bae6fd', dir: '90deg' },
    { from: '#dcfce7', to: '#bbf7d0', dir: '90deg' },
    // Branco → Cor
    { from: '#ffffff', to: '#f97316', dir: '90deg' },
    { from: '#ffffff', to: '#ef4444', dir: '90deg' },
    { from: '#ffffff', to: '#3b82f6', dir: '90deg' },
    { from: '#ffffff', to: '#22c55e', dir: '90deg' },
    { from: '#ffffff', to: '#8b5cf6', dir: '90deg' },
    { from: '#ffffff', to: '#ec4899', dir: '90deg' },
]

const GRADIENT_GROUP_RANGES = [
    { key: 'bump_gradient_warm',        range: [0, 5] },
    { key: 'bump_gradient_cool',        range: [6, 11] },
    { key: 'bump_gradient_purple_pink', range: [12, 17] },
    { key: 'bump_gradient_green',       range: [18, 23] },
    { key: 'bump_gradient_dark',        range: [24, 29] },
    { key: 'bump_gradient_light',       range: [30, 35] },
    { key: 'bump_gradient_white_to_color', range: [36, 41] },
]

function GradientPicker({ from, to, dir, onChange }: {
    from: string
    to: string
    dir: string
    onChange: (from: string, to: string, dir: string) => void
}) {
    const { t } = useI18n()
    const [open, setOpen] = useState(false)
    const current = `linear-gradient(${dir}, ${from}, ${to})`

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="flex items-center gap-2 group"
            >
                <span
                    className="w-8 h-8 rounded-md border border-zinc-600 group-hover:border-zinc-400 transition-colors flex-shrink-0"
                    style={{ background: current }}
                />
                <span className="text-xs text-gray-400 group-hover:text-gray-200 transition-colors">
                    {from} → {to}
                </span>
            </button>

            {open && (
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60"
                    onMouseDown={() => setOpen(false)}
                >
                    <div
                        className="bg-[#1a1d2e] border border-zinc-700 rounded-2xl shadow-2xl p-5 w-80"
                        onMouseDown={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-sm font-semibold text-white">{t('funnel_components.bump_choose_gradient')}</p>
                            <button type="button" onClick={() => setOpen(false)} className="text-zinc-500 hover:text-white text-lg leading-none">✕</button>
                        </div>

                        <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                            {GRADIENT_GROUP_RANGES.map(group => (
                                <div key={group.key}>
                                    <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">{t(`funnel_components.${group.key}`)}</p>
                                    <div className="grid grid-cols-6 gap-1.5">
                                        {GRADIENT_PRESETS.slice(group.range[0], group.range[1] + 1).map((preset, i) => {
                                            const isSelected = from === preset.from && to === preset.to && dir === preset.dir
                                            return (
                                                <button
                                                    key={i}
                                                    type="button"
                                                    onClick={() => { onChange(preset.from, preset.to, preset.dir); setOpen(false) }}
                                                    className={`aspect-square rounded-md transition-all relative border ${isSelected
                                                            ? 'ring-2 ring-white ring-offset-1 ring-offset-[#1a1d2e] border-transparent scale-110'
                                                            : 'border-white/10 hover:scale-105 hover:border-white/30'
                                                        }`}
                                                    style={{ background: `linear-gradient(${preset.dir}, ${preset.from}, ${preset.to})` }}
                                                >
                                                    {isSelected && (
                                                        <span className="absolute inset-0 flex items-center justify-center text-white text-xs drop-shadow-md">✓</span>
                                                    )}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-4 space-y-3">
                            <div className="h-7 rounded-lg border border-white/10" style={{ background: current }} />
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2 rounded-lg text-xs border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors">
                                    {t('common.cancel')}
                                </button>
                                <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 text-white transition-colors font-medium">
                                    {t('funnel_components.bump_select_btn')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

const COLOR_PALETTE = [
    // Row 1 — azuis claros / pastéis
    '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af',
    // Row 2 — ciano / teal
    '#cffafe', '#a5f3fc', '#67e8f9', '#22d3ee', '#06b6d4', '#0891b2', '#0e7490', '#155e75',
    // Row 3 — verdes
    '#dcfce7', '#bbf7d0', '#86efac', '#4ade80', '#22c55e', '#16a34a', '#15803d', '#166534',
    // Row 4 — amarelo / laranja
    '#fef9c3', '#fef08a', '#fde047', '#facc15', '#eab308', '#ca8a04', '#a16207', '#854d0e',
    '#ffedd5', '#fed7aa', '#fdba74', '#fb923c', '#f97316', '#ea580c', '#c2410c', '#9a3412',
    // Row 5 — vermelho / rosa
    '#fee2e2', '#fecaca', '#fca5a5', '#f87171', '#ef4444', '#dc2626', '#b91c1c', '#991b1b',
    '#fce7f3', '#fbcfe8', '#f9a8d4', '#f472b6', '#ec4899', '#db2777', '#be185d', '#9d174d',
    // Row 6 — roxo / violeta
    '#ede9fe', '#ddd6fe', '#c4b5fd', '#a78bfa', '#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6',
    '#e0e7ff', '#c7d2fe', '#a5b4fc', '#818cf8', '#6366f1', '#4f46e5', '#4338ca', '#3730a3',
    // Row 7 — neutros / pretos
    '#ffffff', '#f3f4f6', '#e5e7eb', '#d1d5db', '#9ca3af', '#6b7280', '#374151', '#111827',
    '#fafafa', '#f4f4f5', '#e4e4e7', '#a1a1aa', '#71717a', '#52525b', '#3f3f46', '#18181b',
]

function ColorPicker({ value, onChange, label }: {
    value: string
    onChange: (v: string) => void
    label?: string
}) {
    const { t } = useI18n()
    const [open, setOpen] = useState(false)
    const [custom, setCustom] = useState(value)

    useEffect(() => { setCustom(value) }, [value])

    const handleCustomChange = (v: string) => {
        setCustom(v)
        if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v)
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="flex items-center gap-2 group"
            >
                <span
                    className="w-8 h-8 rounded-md border border-zinc-600 group-hover:border-zinc-400 transition-colors flex-shrink-0"
                    style={{ backgroundColor: value }}
                />
                <span className="text-xs text-gray-400 group-hover:text-gray-200 transition-colors">
                    {label || value}
                </span>
            </button>

            {open && (
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60"
                    onMouseDown={() => setOpen(false)}
                >
                    <div
                        className="bg-[#1a1d2e] border border-zinc-700 rounded-2xl shadow-2xl p-5 w-[288px]"
                        onMouseDown={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-sm font-semibold text-white">{t('funnel_components.bump_choose_color')}</p>
                            <button type="button" onClick={() => setOpen(false)} className="text-zinc-500 hover:text-white text-lg leading-none">✕</button>
                        </div>

                        {/* Palette 8×n grid */}
                        <div className="grid grid-cols-8 gap-1 mb-4">
                            {COLOR_PALETTE.map((color, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => { onChange(color); setOpen(false) }}
                                    className={`aspect-square rounded-md transition-all border ${value === color
                                            ? 'ring-2 ring-white ring-offset-1 ring-offset-[#1a1d2e] border-transparent scale-110'
                                            : 'border-white/10 hover:scale-110 hover:border-white/30'
                                        }`}
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                        </div>

                        {/* Custom hex input */}
                        <div className="flex items-center gap-2 mb-4">
                            <span
                                className="w-7 h-7 rounded-md border border-zinc-600 flex-shrink-0"
                                style={{ backgroundColor: custom }}
                            />
                            <span className="text-xs text-zinc-400 whitespace-nowrap">{t('funnel_components.bump_custom_color')}</span>
                            <input
                                type="text"
                                value={custom}
                                onChange={e => handleCustomChange(e.target.value)}
                                maxLength={7}
                                placeholder="#ffffff"
                                className="flex-1 min-w-0 bg-zinc-800 border border-zinc-600 rounded-md px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-zinc-400"
                            />
                        </div>

                        <div className="flex gap-2">
                            <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2 rounded-lg text-xs border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors">
                                {t('common.cancel')}
                            </button>
                            <button
                                type="button"
                                onClick={() => { if (/^#[0-9a-fA-F]{6}$/.test(custom)) { onChange(custom); setOpen(false) } }}
                                className="flex-1 py-2 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 text-white transition-colors font-medium"
                            >
                                {t('funnel_components.bump_select_btn')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

function parseGradient(gradient?: string): Partial<OrderBumpFormData> {
    if (!gradient) return { bgType: 'solid', bgGradientFrom: '#f97316', bgGradientTo: '#ef4444', bgGradientDir: '90deg' }
    const m = gradient.match(/linear-gradient\(([^,]+),\s*(#[0-9a-fA-F]{3,6}),\s*(#[0-9a-fA-F]{3,6})\)/)
    if (!m) return { bgType: 'solid', bgGradientFrom: '#f97316', bgGradientTo: '#ef4444', bgGradientDir: '90deg' }
    return { bgType: 'gradient', bgGradientDir: m[1].trim(), bgGradientFrom: m[2], bgGradientTo: m[3] }
}

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
        selectedProductImageUrl: undefined,
        borderType: 'none',
        borderColor: '#22c55e',
        bgColor: '#ffffff',
        showArrow: false,
        arrowColor: '#f97316',
        textColor: '#111827',
        descriptionColor: '#6b7280',
        bgType: 'solid',
        bgGradientFrom: '#f97316',
        bgGradientTo: '#ef4444',
        bgGradientDir: '90deg',
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
                    selectedProductImageUrl: bump.offer_product_image,
                    borderType: bump.bump_border_type || 'none',
                    borderColor: bump.bump_border_color || '#22c55e',
                    bgColor: bump.bump_bg_color || '#ffffff',
                    showArrow: bump.bump_show_arrow || false,
                    arrowColor: bump.bump_arrow_color || '#f97316',
                    textColor: bump.bump_text_color || '#111827',
                    descriptionColor: bump.bump_description_color || '#6b7280',
                    ...parseGradient(bump.bump_bg_gradient),
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

            // Garantir que não salvamos NaN no banco (ex: checkoutPrice indefinido ou discount inválido)
            const safeOfferPrice = (offerPrice == null || isNaN(offerPrice)) ? 0 : offerPrice
            const safeOriginalPrice = (originalPrice == null || isNaN(originalPrice as number)) ? 0 : originalPrice

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
                original_price: safeOriginalPrice,
                offer_price: safeOfferPrice,
                currency: product.currency || 'USD',
                is_active: true,
                bump_border_type: formData.borderType,
                bump_border_color: formData.borderColor,
                bump_bg_color: formData.bgColor,
                bump_show_arrow: formData.showArrow,
                bump_arrow_color: formData.arrowColor,
                bump_text_color: formData.textColor,
                bump_description_color: formData.descriptionColor,
                bump_bg_gradient: formData.bgType === 'gradient'
                    ? `linear-gradient(${formData.bgGradientDir}, ${formData.bgGradientFrom}, ${formData.bgGradientTo})`
                    : '',
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
                <textarea
                    rows={3}
                    value={formData.productDescription}
                    onChange={(e) => setFormData(prev => ({ ...prev, productDescription: e.target.value }))}
                    placeholder="Add to purchase"
                    className="w-full px-3 py-2 bg-transparent border border-zinc-700 rounded-lg text-white text-xs placeholder-zinc-400 focus:outline-none focus:border-zinc-500 resize-none"
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
                borderType={formData.borderType}
                borderColor={formData.borderColor}
                bgColor={formData.bgColor}
                bgGradient={formData.bgType === 'gradient'
                    ? `linear-gradient(${formData.bgGradientDir}, ${formData.bgGradientFrom}, ${formData.bgGradientTo})`
                    : undefined}
                showArrow={formData.showArrow}
                arrowColor={formData.arrowColor}
                textColor={formData.textColor}
                descriptionColor={formData.descriptionColor}
            />

            {/* Visual Style */}
            <div className="space-y-3 pt-2 border-t border-zinc-800">
                <p className="text-xs font-semibold text-gray-300 uppercase tracking-wide">{t('funnel_components.bump_style')}</p>

                {/* Border */}
                <div>
                    <label className="block text-sm text-gray-400 mb-1.5">{t('funnel_components.bump_border')}</label>
                    <div className="flex gap-2 mb-2">
                        {(['none', 'solid', 'dashed'] as const).map(type => (
                            <button
                                key={type}
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, borderType: type }))}
                                className={`flex-1 py-1.5 rounded text-xs border transition-colors ${formData.borderType === type
                                    ? 'bg-white text-black border-white'
                                    : 'bg-transparent text-gray-400 border-zinc-700 hover:border-zinc-500'
                                    }`}
                            >
                                {type === 'none' ? t('funnel_components.bump_border_none')
                                    : type === 'solid' ? t('funnel_components.bump_border_solid')
                                        : t('funnel_components.bump_border_dashed')}
                            </button>
                        ))}
                    </div>
                    {formData.borderType !== 'none' && (
                        <ColorPicker
                            value={formData.borderColor}
                            onChange={v => setFormData(prev => ({ ...prev, borderColor: v }))}
                        />
                    )}
                </div>

                {/* Background color / gradient */}
                <div>
                    <label className="block text-sm text-gray-400 mb-1.5">{t('funnel_components.bump_bg_color')}</label>
                    {/* Solid / Gradient toggle */}
                    <div className="flex gap-2 mb-2">
                        {(['solid', 'gradient'] as const).map(type => (
                            <button
                                key={type}
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, bgType: type }))}
                                className={`flex-1 py-1.5 rounded text-xs border transition-colors ${formData.bgType === type
                                    ? 'bg-white text-black border-white'
                                    : 'bg-transparent text-gray-400 border-zinc-700 hover:border-zinc-500'
                                    }`}
                            >
                                {type === 'solid' ? t('funnel_components.bump_bg_solid') : t('funnel_components.bump_bg_gradient')}
                            </button>
                        ))}
                    </div>

                    {formData.bgType === 'solid' ? (
                        <ColorPicker
                            value={formData.bgColor}
                            onChange={v => setFormData(prev => ({ ...prev, bgColor: v }))}
                        />
                    ) : (
                        <GradientPicker
                            from={formData.bgGradientFrom}
                            to={formData.bgGradientTo}
                            dir={formData.bgGradientDir}
                            onChange={(from, to, dir) =>
                                setFormData(prev => ({ ...prev, bgGradientFrom: from, bgGradientTo: to, bgGradientDir: dir }))
                            }
                        />
                    )}
                </div>

                {/* Text color */}
                <div>
                    <label className="block text-sm text-gray-400 mb-1.5">{t('funnel_components.bump_text_color')}</label>
                    <ColorPicker
                        value={formData.textColor}
                        onChange={v => setFormData(prev => ({ ...prev, textColor: v }))}
                    />
                </div>

                {/* Description color */}
                <div>
                    <label className="block text-sm text-gray-400 mb-1.5">{t('funnel_components.bump_description_color')}</label>
                    <ColorPicker
                        value={formData.descriptionColor}
                        onChange={v => setFormData(prev => ({ ...prev, descriptionColor: v }))}
                    />
                </div>
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <label className="text-sm text-gray-400">{t('funnel_components.bump_arrow')}</label>
                        <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, showArrow: !prev.showArrow }))}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${formData.showArrow ? 'bg-orange-500' : 'bg-zinc-700'
                                }`}
                        >
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${formData.showArrow ? 'translate-x-4.5' : 'translate-x-0.5'
                                }`} />
                        </button>
                    </div>
                    {formData.showArrow && (
                        <ColorPicker
                            value={formData.arrowColor}
                            onChange={v => setFormData(prev => ({ ...prev, arrowColor: v }))}
                        />
                    )}
                </div>
            </div>

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
