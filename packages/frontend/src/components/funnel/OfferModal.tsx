import { useState, useEffect } from 'react'
import { X, Percent, Eye, AlertCircle } from 'lucide-react'
import { useI18n } from '@/i18n'

interface Product {
    id: string
    name: string
    price: number
    currency: string
}

interface Offer {
    id?: string
    type: 'upsell' | 'downsell' | 'order_bump'
    title: string
    description: string
    product_id: string
    original_price: number
    offer_price: number
    discount_percentage?: number
    currency: string
    button_text: string
    is_active: boolean
}

interface OfferModalProps {
    isOpen: boolean
    onClose: () => void
    onSave: (offer: Offer) => void
    offer?: Offer | null
    products: Product[]
    funnelCurrency: string
}

export default function OfferModal({
    isOpen,
    onClose,
    onSave,
    offer,
    products,
    funnelCurrency
}: OfferModalProps) {
    const { t } = useI18n()
    const [formData, setFormData] = useState<Offer>({
        type: 'upsell',
        title: '',
        description: '',
        product_id: '',
        original_price: 0,
        offer_price: 0,
        discount_percentage: 0,
        currency: funnelCurrency,
        button_text: t('funnel_components.offer_modal.default_button_text'),
        is_active: true
    })

    const [errors, setErrors] = useState<{ [key: string]: string }>({})
    const [discountMode, setDiscountMode] = useState<'percentage' | 'fixed'>('percentage')

    useEffect(() => {
        if (offer) {
            setFormData({ ...offer })
        } else {
            setFormData({
                type: 'upsell',
                title: '',
                description: '',
                product_id: '',
                original_price: 0,
                offer_price: 0,
                discount_percentage: 0,
                currency: funnelCurrency,
                button_text: t('funnel_components.offer_modal.default_button_text'),
                is_active: true
            })
        }
        setErrors({})
    }, [offer, funnelCurrency, isOpen])

    const selectedProduct = products.find(p => p.id === formData.product_id)

    useEffect(() => {
        if (selectedProduct && !offer) {
            setFormData(prev => ({
                ...prev,
                original_price: selectedProduct.price,
                offer_price: selectedProduct.price * 0.8, // 20% discount by default
                discount_percentage: 20
            }))
        }
    }, [selectedProduct, offer])

    const calculateDiscount = () => {
        if (formData.original_price > 0 && formData.offer_price > 0) {
            const percentage = ((formData.original_price - formData.offer_price) / formData.original_price) * 100
            return Math.round(percentage)
        }
        return 0
    }

    const handleDiscountChange = (value: number) => {
        if (discountMode === 'percentage') {
            const newOfferPrice = formData.original_price * (1 - value / 100)
            setFormData(prev => ({
                ...prev,
                offer_price: newOfferPrice,
                discount_percentage: value
            }))
        } else {
            const newOfferPrice = formData.original_price - value
            setFormData(prev => ({
                ...prev,
                offer_price: Math.max(0, newOfferPrice),
                discount_percentage: calculateDiscount()
            }))
        }
    }

    const handleOfferPriceChange = (value: number) => {
        const discount = calculateDiscount()
        setFormData(prev => ({
            ...prev,
            offer_price: value,
            discount_percentage: discount
        }))
    }

    const validate = () => {
        const newErrors: { [key: string]: string } = {}

        if (!formData.title.trim()) {
            newErrors.title = t('funnel_components.offer_modal.validation.title_required')
        }

        if (!formData.description.trim()) {
            newErrors.description = t('funnel_components.offer_modal.validation.description_required')
        }

        if (!formData.product_id) {
            newErrors.product_id = t('funnel_components.offer_modal.validation.product_required')
        }

        if (formData.offer_price <= 0) {
            newErrors.offer_price = t('funnel_components.offer_modal.validation.price_greater_zero')
        }

        if (formData.offer_price >= formData.original_price) {
            newErrors.offer_price = t('funnel_components.offer_modal.validation.price_lower_original')
        }

        if (!formData.button_text.trim()) {
            newErrors.button_text = t('funnel_components.offer_modal.validation.button_text_required')
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()



        if (validate()) {

            onSave(formData)
            onClose()
        } else {

            alert(t('funnel_components.offer_modal.fill_required_fields'))
        }
    }

    const formatCurrency = (value: number) => {
        const currencySymbols: { [key: string]: string } = {
            BRL: 'R$',
            USD: '$',
            EUR: '€',
            CNY: '¥',
            COP: '$',
            CZK: 'Kč',
            DKK: 'kr',
            EGP: '£',
            BGN: 'лв',
            CAD: 'C$',
            XAF: 'FCFA',
            CLP: '$'
        }
        const symbol = currencySymbols[formData.currency] || formData.currency
        return `${symbol} ${value.toFixed(2)}`
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-[#1a1d2e] rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-[#252941]">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                        {offer ? t('funnel_components.offer_modal.edit_offer') : t('funnel_components.offer_modal.new_offer')}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Offer Type */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t('funnel_components.offer_modal.offer_type')}
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { value: 'order_bump', label: t('funnel_components.offer_modal.order_bump'), color: 'blue' },
                                { value: 'upsell', label: t('funnel_components.page_types.upsell'), color: 'green' },
                                { value: 'downsell', label: t('funnel_components.page_types.downsell'), color: 'orange' }
                            ].map((type) => (
                                <button
                                    key={type.value}
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, type: type.value as any }))}
                                    className={`p-3 rounded-lg border text-sm font-medium transition-colors ${formData.type === type.value
                                        ? `border-${type.color}-500 bg-${type.color}-500/10 text-${type.color}-400`
                                        : 'border-gray-600 bg-gray-700/50 text-gray-300 hover:border-gray-500'
                                        }`}
                                >
                                    {type.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Product Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t('funnel_components.offer_modal.product')}
                        </label>
                        <select
                            value={formData.product_id}
                            onChange={(e) => setFormData(prev => ({ ...prev, product_id: e.target.value }))}
                            className="w-full bg-white dark:bg-[#252941] border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
                        >
                            <option value="">{t('funnel_components.offer_modal.select_product')}</option>
                            {products.map((product) => (
                                <option key={product.id} value={product.id}>
                                    {product.name} - {formatCurrency(product.price)}
                                </option>
                            ))}
                        </select>
                        {errors.product_id && (
                            <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                                <AlertCircle size={12} />
                                {errors.product_id}
                            </p>
                        )}
                    </div>

                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t('funnel_components.offer_modal.offer_title')}
                        </label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                            className="w-full bg-white dark:bg-[#252941] border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
                            placeholder={t('funnel_components.offer_modal.title_placeholder')}
                        />
                        {errors.title && (
                            <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                                <AlertCircle size={12} />
                                {errors.title}
                            </p>
                        )}
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t('common.description')}
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            rows={3}
                            className="w-full bg-white dark:bg-[#252941] border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none resize-none"
                            placeholder={t('funnel_components.offer_modal.description_placeholder')}
                        />
                        {errors.description && (
                            <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                                <AlertCircle size={12} />
                                {errors.description}
                            </p>
                        )}
                    </div>

                    {/* Pricing */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                {t('funnel_components.offer_modal.original_price')}
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.original_price}
                                onChange={(e) => setFormData(prev => ({ ...prev, original_price: Number(e.target.value) }))}
                                className="w-full bg-white dark:bg-[#252941] border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
                                placeholder="0.00"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                {t('funnel_components.offer_modal.offer_price')}
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.offer_price}
                                onChange={(e) => handleOfferPriceChange(Number(e.target.value))}
                                className="w-full bg-white dark:bg-[#252941] border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
                                placeholder="0.00"
                            />
                            {errors.offer_price && (
                                <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                                    <AlertCircle size={12} />
                                    {errors.offer_price}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Discount Calculator */}
                    <div className="bg-gray-50 dark:bg-[#0f1117] rounded-lg p-4 border border-gray-200 dark:border-[#252941]">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('funnel_components.offer_modal.discount')}</span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setDiscountMode('percentage')}
                                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${discountMode === 'percentage'
                                        ? 'bg-blue-500/20 text-blue-400'
                                        : 'text-gray-400 hover:text-white'
                                        }`}
                                >
                                    <Percent size={12} className="inline mr-1" />
                                    %
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDiscountMode('fixed')}
                                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${discountMode === 'fixed'
                                        ? 'bg-blue-500/20 text-blue-400'
                                        : 'text-gray-400 hover:text-white'
                                        }`}
                                >
                                    {t('funnel_components.offer_modal.fixed')}
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <input
                                type="number"
                                step={discountMode === 'percentage' ? 1 : 0.01}
                                min="0"
                                max={discountMode === 'percentage' ? 100 : formData.original_price}
                                value={discountMode === 'percentage' ? calculateDiscount() : (formData.original_price - formData.offer_price)}
                                onChange={(e) => handleDiscountChange(Number(e.target.value))}
                                className="flex-1 bg-white dark:bg-[#252941] border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
                            />
                            <span className="text-green-400 font-semibold">
                                {discountMode === 'percentage' ? `${calculateDiscount()}%` : formatCurrency(formData.original_price - formData.offer_price)}
                            </span>
                        </div>
                    </div>

                    {/* Button Text */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t('funnel_components.offer_modal.button_text')}
                        </label>
                        <input
                            type="text"
                            value={formData.button_text}
                            onChange={(e) => setFormData(prev => ({ ...prev, button_text: e.target.value }))}
                            className="w-full bg-white dark:bg-[#252941] border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
                            placeholder={t('funnel_components.offer_modal.button_text_placeholder')}
                        />
                        {errors.button_text && (
                            <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                                <AlertCircle size={12} />
                                {errors.button_text}
                            </p>
                        )}
                    </div>

                    {/* Preview */}
                    <div className="bg-gray-50 dark:bg-[#0f1117] rounded-lg p-4 border border-gray-200 dark:border-[#252941]">
                        <div className="flex items-center gap-2 mb-3">
                            <Eye size={16} className="text-gray-500 dark:text-gray-400" />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('funnel_components.offer_modal.offer_preview')}</span>
                        </div>
                        <div className="bg-white dark:bg-[#1a1d2e] rounded-lg p-4 border border-gray-200 dark:border-[#252941]">
                            <h4 className="text-gray-900 dark:text-white font-medium mb-2">{formData.title || t('funnel_components.offer_modal.preview_title')}</h4>
                            <p className="text-gray-600 dark:text-gray-300 text-sm mb-3">{formData.description || t('funnel_components.offer_modal.preview_description')}</p>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    {formData.original_price > formData.offer_price && (
                                        <span className="text-gray-500 dark:text-gray-400 line-through text-sm">
                                            {formatCurrency(formData.original_price)}
                                        </span>
                                    )}
                                    <span className="text-gray-900 dark:text-white font-semibold">
                                        {formatCurrency(formData.offer_price)}
                                    </span>
                                </div>
                                {calculateDiscount() > 0 && (
                                    <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded text-xs font-medium">
                                        -{calculateDiscount()}%
                                    </span>
                                )}
                            </div>
                            <button
                                type="button"
                                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium text-sm"
                                disabled
                            >
                                {formData.button_text || t('funnel_components.offer_modal.preview_button')}
                            </button>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-[#252941]">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                        >
                            {offer ? t('funnel_components.offer_modal.save_changes') : t('funnel_components.offer_modal.create_offer')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}