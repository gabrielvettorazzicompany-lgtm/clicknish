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
    checkouts
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

    return (
        <div>
            <label className="block text-sm text-gray-400 mb-2">
                Preview
            </label>
            <div
                className={`p-4 rounded-lg border transition-all ${selectedProduct
                    ? 'bg-zinc-900 border-zinc-700'
                    : 'bg-white border-zinc-300'
                    }`}
            >
                <div className="flex items-start gap-3">
                    <input
                        type="checkbox"
                        checked={!!selectedProduct}
                        readOnly
                        className="mt-1 w-4 h-4 rounded border-zinc-400 accent-black focus:ring-0"
                    />
                    {showProductImage && selectedProduct && selectedProductImageUrl && (
                        <img
                            src={selectedProductImageUrl}
                            alt={productName}
                            className="w-16 h-16 object-cover rounded-lg border border-zinc-700 flex-shrink-0"
                        />
                    )}
                    <div className="flex-1">
                        <div className={`text-sm font-bold mb-1 ${selectedProduct ? 'text-white' : 'text-black'
                            }`}>
                            {callToAction}
                        </div>
                        <div className={`text-sm font-medium ${selectedProduct ? 'text-zinc-300' : 'text-gray-900'}`}>
                            {productName}
                        </div>
                        <div className={`text-xs mt-1 ${selectedProduct ? 'text-zinc-400' : 'text-gray-600'}`}>
                            {productDescription}
                        </div>
                        {selectedProduct && (
                            <div className="mt-2 flex items-center gap-2">
                                {applyDiscount && discount > 0 ? (
                                    <>
                                        <span className="text-xs text-zinc-500 line-through">
                                            {formatPrice(basePrice, products.find(p => p.id === selectedProduct)?.currency)}
                                        </span>
                                        <span className="text-sm font-bold text-white">
                                            {formatPrice(discountedPrice, products.find(p => p.id === selectedProduct)?.currency)}
                                        </span>
                                    </>
                                ) : (
                                    <span className="text-sm font-bold text-white">
                                        {formatPrice(basePrice, products.find(p => p.id === selectedProduct)?.currency)}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                    {selectedProduct && (
                        <div className="flex items-center justify-center w-4 h-4 rounded-full bg-black flex-shrink-0">
                            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
                            </svg>
                        </div>
                    )}
                </div>
            </div>
            <p className="text-xs text-zinc-500 mt-2">
                {selectedProduct ? 'Selected' : 'Select a product to see the preview'}
            </p>
        </div>
    )
}
