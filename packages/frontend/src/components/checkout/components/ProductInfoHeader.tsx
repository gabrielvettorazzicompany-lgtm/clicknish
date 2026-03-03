import React, { memo } from 'react'

interface ProductInfoHeaderProps {
    customBanner?: any
    productName: string
    t: any
}

const ProductInfoHeader = memo(({ customBanner, productName, t }: ProductInfoHeaderProps) => {
    return null
})

ProductInfoHeader.displayName = 'ProductInfoHeader'

export default ProductInfoHeader