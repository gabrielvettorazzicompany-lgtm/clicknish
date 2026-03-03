import React, { memo } from 'react'

interface ProductInfoHeaderProps {
    customBanner?: any
    productName: string
    productImage?: string
    t: any
}

const ProductInfoHeader = memo(({ customBanner, productName, productImage, t }: ProductInfoHeaderProps) => {
    return (
        <div className="w-full lg:max-w-7xl lg:mx-auto px-4 mb-4">
            <div className="flex items-center gap-3">
                <div className="w-16 h-16 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden">
                    {productImage ? (
                        <img
                            src={productImage}
                            alt={productName}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    )}
                </div>
                <h2 className="text-sm font-semibold text-gray-900 flex-1">
                    {productName}
                </h2>
            </div>
        </div>
    )
})

ProductInfoHeader.displayName = 'ProductInfoHeader'

export default ProductInfoHeader