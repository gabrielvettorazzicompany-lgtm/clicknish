/**
 * Export index for funnel components
 * Provides clean imports for funnel-related components
 */

// Main components
export { default as FunnelRow } from './FunnelRow'
export { default as TabNav } from './TabNav'
export { default as OffersConfiguration } from './OffersConfiguration'
export { default as OfferCard } from './OfferCard'
export { default as OfferModal } from './OfferModal'

// Page configuration components
export { default as PageConfig } from './PageConfig'
export { default as ExternalUrlConfig } from './ExternalUrlConfig'
export { default as ScriptGenerator } from './ScriptGenerator'
export { default as ThankYouPageEditor } from './ThankYouPageEditor'

// Product & Checkout components
export { default as ProductCheckoutCard } from './ProductCheckoutCard'
export { default as MainProductDisplay } from './MainProductDisplay'
export { default as CheckoutSelector } from './CheckoutSelector'
export { default as OrderBumpSection } from './OrderBumpSection'

// Tab components
export { default as FunnelsTab } from './tabs/FunnelsTab'
export { default as ScriptsTab } from './tabs/ScriptsTab'

// Modal components
export { default as CreateFunnelModal } from './modals/CreateFunnelModal'
export { default as CreatePageModal } from './modals/CreatePageModal'

// Hooks
export { useFunnels } from '../../hooks/useFunnels'
export { useFunnelProduct } from '../../hooks/useFunnelProduct'
export { useFunnelCheckout } from '../../hooks/useFunnelCheckout'
export { useScriptManager } from '../../hooks/useScriptManager'

// Types
export type * from '../../types/funnel'

// Utils
export * from '../../utils/funnelUtils'
export * from '../../utils/scriptGenerator'