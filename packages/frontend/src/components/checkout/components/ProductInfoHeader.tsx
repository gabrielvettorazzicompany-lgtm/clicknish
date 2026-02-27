import React, { memo } from 'react'

interface ProductInfoHeaderProps {
    customBanner?: any
    productName: string
    t: any
}

const ProductInfoHeader = memo(({ customBanner, productName, t }: ProductInfoHeaderProps) => {
    if (!customBanner || (!customBanner.image && !customBanner.title && !customBanner.subtitle && !customBanner.description)) {
        return null
    }

    return (
        <div className="bg-white lg:rounded-xl shadow-sm lg:border border-gray-100 px-4 py-3 lg:mx-4 mb-0 lg:mb-4">
            <div className="flex items-center gap-3">
                <div className="bg-gray-100 p-2 rounded-lg flex-shrink-0">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-gray-400">{t.youArePurchasing}</p>
                    <h3 className="text-[13px] font-medium text-gray-900 truncate">{productName}</h3>
                </div>
            </div>
        </div>
    )
})

ProductInfoHeader.displayName = 'ProductInfoHeader'

export default ProductInfoHeader