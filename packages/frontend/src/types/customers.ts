export interface App {
    id: string
    name: string
    owner_id?: string
    slug?: string
    language?: string
    android_url?: string
    ios_url?: string
}

export interface MarketplaceProduct {
    id: string
    name: string
    owner_id: string
    price?: number
    slug?: string
}

export interface Product {
    id: string
    name: string
    price?: number
}

export interface Customer {
    id: string
    user_id: string
    email: string
    application_id: string
    full_name?: string
    phone?: string
    status?: string
    last_login?: string
    created_at?: string
    // Metadata para filtro "Todos" - informações de apps múltiplas
    _appCount?: number
    _allApps?: string[]
    _originalRecords?: Customer[]
}

export interface CombinedItem {
    id: string
    name: string
    type: 'app' | 'marketplace'
}

export interface CustomerFormData {
    name: string
    email: string
    phone: string
    selectedProducts: string[]
}
