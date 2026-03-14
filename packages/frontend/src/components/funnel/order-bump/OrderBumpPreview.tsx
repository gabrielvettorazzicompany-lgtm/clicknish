import type { Product, Checkout } from './types'

const formatPrice = (value: number, currency?: string) => {
    const cur = currency || 'USD'
    const locale = cur === 'CHF' ? 'de-CH' : cur === 'BRL' ? 'pt-BR' : 'en-US'
    return new Intl.NumberFormat(locale, { style: 'currency', currency: cur }).format(value)
}

interface OrderBumpPreviewProps {
    selectedProduct: string
    callToAction: string
    productName: string
    productDescription: string
    showProductImage: boolean
    selectedProductImageUrl?: string
    applyDiscount: boolean
    discount: number
    selectedCheckout: string
    products: Product[]
    checkouts: Checkout[]
    borderType?: 'none' | 'solid' | 'dashed'
    borderColor?: string
    bgColor?: string
    bgGradient?: string
    showArrow?: boolean
    arrowColor?: string
    textColor?: string
    descriptionColor?: string
}

export default function OrderBumpPreview({
    selectedProduct,
    callToAction,
    productName,
    productDescription,
    showProductImage,
    selectedProductImageUrl,
    applyDiscount,
    discount,
    selectedCheckout,
    products,
    checkouts,
    borderType = 'none',
    borderColor = '#22c55e',
    bgColor = '#ffffff',
    bgGradient,
    showArrow = false,
    arrowColor = '#f97316',
    textColor = '#111827',
    descriptionColor = '#6b7280',
}: OrderBumpPreviewProps) {
    // Calculate price
    let basePrice = 0
    if (selectedCheckout) {
        const checkout = checkouts.find(c => c.id === selectedCheckout)
        basePrice = checkout?.final_price || 0
    } else {
        const product = products.find(p => p.id === selectedProduct)
        basePrice = product?.price || 0
    }

    const discountedPrice = applyDiscount && discount > 0
        ? basePrice * (1 - discount / 100)
        : basePrice

    const product = products.find(p => p.id === selectedProduct)
    const currency = product?.currency

    const borderStyle: React.CSSProperties =
        borderType === 'none'
            ? { border: '1px solid #e5e7eb' }
            : borderType === 'solid'
                ? { border: `3px solid ${borderColor}` }
                : { border: `3px dashed ${borderColor}` }

    return (
        <div className="w-full min-w-0">
            <label className="block text-sm text-gray-400 mb-2">Preview</label>

            {/* Inline keyframes for blink */}
            <style>{`@keyframes ob-blink{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>

            <div
                style={{ ...(bgGradient ? { background: bgGradient } : { backgroundColor: bgColor }), ...borderStyle, borderRadius: '10px', padding: '12px', overflow: 'hidden', boxSizing: 'border-box', width: '100%' }}
            >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', overflow: 'hidden', width: '100%', minWidth: 0 }}>
                    {/* Arrow */}
                    {showArrow && (
                        <svg
                            style={{
                                color: arrowColor,
                                flexShrink: 0,
                                marginTop: '2px',
                                animation: 'ob-blink 1.2s ease-in-out infinite',
                            }}
                            width="38" height="24" viewBox="0 0 40 20" fill="currentColor"
                        >
                            <path d="M0,6 L26,6 L26,0 L40,10 L26,20 L26,14 L0,14 Z" />
                        </svg>
                    )}

                    {/* Checkbox */}
                    <div style={{ flexShrink: 0, marginTop: '2px' }}>
                        <div className="w-[18px] h-[18px] rounded border-2 border-gray-400 bg-white" />
                    </div>

                    {/* Image */}
                    {showProductImage && selectedProduct && selectedProductImageUrl && (
                        <img
                            src={selectedProductImageUrl}
                            alt={productName}
                            className="w-14 h-14 object-cover rounded-lg"
                            style={{ flexShrink: 0 }}
                        />
                    )}

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
                        <div style={{ fontSize: '14px', fontWeight: 'bold', lineHeight: '1.2', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: textColor }}>
                            {callToAction}
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{productName}</div>
                        <div style={{ fontSize: '12px', color: descriptionColor, marginTop: '2px', lineHeight: '1.4', maxHeight: '9.8em', overflow: 'hidden', wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>{productDescription}</div>

                        {selectedProduct && (
                            <div className="mt-1.5 flex items-center gap-2">
                                {applyDiscount && discount > 0 ? (
                                    <>
                                        <span className="text-xs text-gray-400 line-through">
                                            {formatPrice(basePrice, currency)}
                                        </span>
                                        <span className="text-sm font-bold text-gray-900">
                                            {formatPrice(discountedPrice, currency)}
                                        </span>
                                    </>
                                ) : (
                                    <span className="text-sm font-bold text-gray-900">
                                        {formatPrice(basePrice, currency)}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <p className="text-xs text-zinc-500 mt-2">
                {selectedProduct ? 'Preview' : 'Selecione um produto para ver o preview'}
            </p>
        </div>
    )
}
