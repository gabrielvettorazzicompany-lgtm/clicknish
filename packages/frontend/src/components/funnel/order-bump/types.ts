/**
 * Types for Order Bump functionality
 */

export interface Product {
    id: string
    name: string
    price?: number
    currency?: string
    product_type: string
    app_type?: string
    source: 'marketplace' | 'application' | 'app_product'
    image_url?: string
    application_id?: string
    app_name?: string
}

export interface Checkout {
    id: string
    name: string
    custom_price?: number
    product_price?: number
    final_price: number
}

export interface OrderBump {
    id: string
    product_id: string
    button_text: string
    discount_percentage: number | null
    original_price: number
    offer_price: number
    currency?: string
    offer_text?: string
    product_name?: string
    product_description?: string
    show_product_image?: boolean
    offer_product_image?: string
    offer_position?: number
    checkout_offer_id?: string
    product?: Product
}

export interface OrderBumpFormData {
    selectedProduct: string
    selectedCheckout: string
    applyDiscount: boolean
    discount: number
    callToAction: string
    productName: string
    productDescription: string
    showProductImage: boolean
    selectedProductImageUrl?: string
}
