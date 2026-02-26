/**
 * TypeScript types for funnel-related components
 */

import { CurrencyType } from '@/utils/funnelUtils'

export interface Funnel {
    id: string
    owner_id: string
    name: string
    slug: string
    objective: 'audience' | 'sales' | 'webinar' | 'custom'
    status: 'active' | 'draft' | 'paused'
    domain: string
    currency: 'BRL' | 'USD' | 'EUR'
    description?: string
    settings?: any
    checkout_id?: string
    product_id?: string
    created_at: string
    updated_at: string
}

export interface CreateFunnelData {
    name: string
    currency: CurrencyType
    product_id?: string
    product_type?: 'marketplace' | 'application' | 'community'
    checkout_id?: string
}

export type StatusFilter = 'all' | 'active' | 'draft' | 'paused'

export type TabType = 'funnels' | 'scripts' | 'offers'

export interface FunnelFilters {
    searchTerm: string
    statusFilter: StatusFilter
}

export interface FunnelActions {
    onEdit?: (funnel: Funnel) => void
    onDelete?: (funnel: Funnel) => void
    onDuplicate?: (funnel: Funnel) => void
    onToggleStatus?: (funnel: Funnel) => void
}