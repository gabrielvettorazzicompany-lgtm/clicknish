import React from 'react'
import { OrderBump } from './types'
import { formatPrice } from './utils'

interface OrderBumpCardProps {
    bump: OrderBump
    isSelected: boolean
    onToggle: (bumpId: string) => void
    t: any
}

export const OrderBumpCard: React.FC<OrderBumpCardProps> = ({
    bump,
    isSelected,
    onToggle,
    t
}) => {
    const price = bump.custom_price || bump.offer_product_price
    const originalPrice = bump.offer_product_price
    const hasDiscount = bump.custom_price && bump.custom_price < originalPrice
    const discountPercent = hasDiscount
        ? Math.round(((originalPrice - price) / originalPrice) * 100)
        : 0

    const borderType = bump.bump_border_type || 'none'
    const borderColor = bump.bump_border_color || '#22c55e'
    const bgColor = bump.bump_bg_color || '#ffffff'
    const bgGradient = bump.bump_bg_gradient || ''
    const showArrow = bump.bump_show_arrow || false
    const arrowColor = bump.bump_arrow_color || '#f97316'
    const textColor = bump.bump_text_color || '#111827'
    const descriptionColor = bump.bump_description_color || '#6b7280'

    const borderStyle: React.CSSProperties =
        borderType === 'none'
            ? { border: '1px solid #e5e7eb' }
            : borderType === 'solid'
                ? { border: `3px solid ${borderColor}` }
                : { border: `3px dashed ${borderColor}` }

    return (
        <div className="space-y-1.5">
            {bump.offer_text && (
                <div className="text-[11px] text-amber-700 font-medium bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5">
                    {bump.offer_text}
                </div>
            )}

            {/* Inline keyframes injected once per card (cheap) */}
            <style>{`@keyframes ob-blink{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>

            <div
                style={{ ...(bgGradient ? { background: bgGradient } : { backgroundColor: bgColor }), ...borderStyle, borderRadius: '12px', padding: '12px', cursor: 'pointer', transition: 'all 0.15s' }}
                onClick={() => onToggle(bump.id)}
            >
                <div className="flex items-start gap-2.5 sm:gap-3">
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
                    <div className="flex-shrink-0 mt-0.5">
                        <div
                            className="w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center transition-colors"
                            style={isSelected
                                ? { backgroundColor: arrowColor, borderColor: arrowColor }
                                : { backgroundColor: 'white', borderColor: '#d1d5db' }
                            }
                        >
                            {isSelected && (
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd"
                                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                        clipRule="evenodd" />
                                </svg>
                            )}
                        </div>
                    </div>

                    {/* Product Image */}
                    {bump.show_product_image !== false && bump.offer_product_image && (
                        <img
                            src={bump.offer_product_image}
                            alt={bump.offer_product_name}
                            className="w-11 h-11 sm:w-14 sm:h-14 object-cover rounded-lg flex-shrink-0"
                        />
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <h4 className="text-[12px] sm:text-[13px] font-bold leading-tight" style={{ color: textColor }}>
                                    {bump.button_text || bump.product_name || bump.offer_product_name}
                                </h4>
                                <p className="text-[11px] sm:text-[12px] font-medium text-gray-700 mt-0.5">
                                    {bump.product_name || bump.offer_product_name}
                                </p>
                                {bump.product_description && (
                                    <p className="text-[10px] sm:text-[11px] mt-0.5 line-clamp-2" style={{ color: descriptionColor }}>
                                        {bump.product_description}
                                    </p>
                                )}
                            </div>

                            {/* Price */}
                            <div className="text-right flex-shrink-0">
                                {hasDiscount && (
                                    <div className="text-[11px] text-gray-400 line-through">
                                        {formatPrice(originalPrice, bump.offer_product_currency)}
                                    </div>
                                )}
                                <div className="text-[13px] font-semibold text-gray-900">
                                    {formatPrice(price, bump.offer_product_currency)}
                                </div>
                                {hasDiscount && (
                                    <div className="text-[10px] text-emerald-600 font-medium">
                                        {discountPercent}% {t.off}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}