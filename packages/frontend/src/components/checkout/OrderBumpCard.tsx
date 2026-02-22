import React from 'react'
import { OrderBump } from './types'
import { formatPrice } from './utils'

interface OrderBumpCardProps {
    bump: OrderBump
    isSelected: boolean
    onToggle: (bumpId: string) => void
    t: any // translations object
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

    return (
        <div className="space-y-1.5">
            {bump.offer_text && (
                <div className="text-[11px] text-amber-700 font-medium bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5">
                    {bump.offer_text}
                </div>
            )}

            <div
                className={`border rounded-xl p-3 cursor-pointer transition-all duration-200 active:scale-[0.99] ${isSelected
                    ? 'border-blue-300 bg-blue-50/50 ring-1 ring-blue-100'
                    : 'border-gray-150 hover:border-gray-300 bg-white'
                    }`}
                onClick={() => onToggle(bump.id)}
            >
                <div className="flex items-start gap-2.5 sm:gap-3">
                    {/* Checkbox */}
                    <div className="flex-shrink-0 mt-0.5">
                        <div
                            className={`w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center transition-colors ${isSelected
                                ? 'bg-blue-500 border-blue-500'
                                : 'border-gray-300 bg-white'
                                }`}
                        >
                            {isSelected && (
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path
                                        fillRule="evenodd"
                                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                        clipRule="evenodd"
                                    />
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
                                <h4 className="text-[12px] sm:text-[13px] font-medium text-gray-900 leading-tight">
                                    {bump.product_name || bump.offer_product_name}
                                </h4>
                                {bump.product_description && (
                                    <p className="text-[10px] sm:text-[11px] text-gray-400 mt-0.5 line-clamp-2">
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

                        {/* Button Text */}
                        {bump.button_text && (
                            <div className="mt-2 py-1.5 px-3 bg-gray-900 text-white text-[11px] font-medium rounded-md text-center">
                                {bump.button_text}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}