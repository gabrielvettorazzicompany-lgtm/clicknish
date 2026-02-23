import { useAuthStore } from '@/stores/authStore'
import { useFunnelProduct } from '@/hooks/useFunnelProduct'
import { useFunnelCheckout } from '@/hooks/useFunnelCheckout'
import OrderBumpSection from './OrderBumpSection'
import ScriptGenerator from './ScriptGenerator'
import ExternalUrlConfig from './ExternalUrlConfig'
import ProductCheckoutCard from './ProductCheckoutCard'
import OfferPageConfig from './OfferPageConfig'
import RedirectConfig from './RedirectConfig'
import CheckoutRedirectConfig from './CheckoutRedirectConfig'
import { useState, useEffect } from 'react'
import { supabase } from '@/services/supabase'
import { useI18n } from '@/i18n'

interface PageConfigProps {
    page: {
        id: string
        name: string
        slug: string
        page_type: string
        external_url?: string | null
        is_published: boolean
        content?: any
    }
    funnelId: string
    onUpdate: () => void
}

export default function PageConfig({ page, funnelId, onUpdate }: PageConfigProps) {
    const { t } = useI18n()
    const { user } = useAuthStore()
    const [scriptKey, setScriptKey] = useState(0)
    const [offerProductId, setOfferProductId] = useState<string | undefined>(undefined)
    const [offerOneClick, setOfferOneClick] = useState(false)
    const [offerOfferId, setOfferOfferId] = useState<string | undefined>(undefined)
    const [offerCheckoutId, setOfferCheckoutId] = useState<string | undefined>(undefined)
    const [configuredAcceptUrl, setConfiguredAcceptUrl] = useState<string | undefined>(undefined)
    const [configuredRejectUrl, setConfiguredRejectUrl] = useState<string | undefined>(undefined)

    const isCheckoutPage = page.page_type === 'checkout'
    const needsScript = ['upsell', 'downsell'].includes(page.page_type)

    // Hooks customizados
    const { product, loading: loadingProduct } = useFunnelProduct(
        funnelId,
        isCheckoutPage && !!user
    )

    const {
        checkouts,
        selectedCheckout,
        loadingCheckouts,
        savingCheckout,
        updateCheckout
    } = useFunnelCheckout({
        funnelId,
        pageId: page.id,
        enabled: isCheckoutPage && !!user
    })

    return (
        <div className="p-6 space-y-6">
            {/* External URL Configuration - For pages with scripts */}
            {needsScript && (
                <div className="bg-white dark:bg-[#0f1117] rounded-lg border border-gray-200 dark:border-zinc-800 p-4 space-y-4">
                    <ExternalUrlConfig
                        pageId={page.id}
                        initialUrl={page.external_url || ''}
                        onUpdate={onUpdate}
                    />

                    {/* Divider */}
                    <div className="border-t border-zinc-800" />

                    {/* Offer Configuration - Product selection for upsell/downsell */}
                    <OfferPageConfig
                        funnelId={funnelId}
                        pageId={page.id}
                        pageType={page.page_type as 'upsell' | 'downsell'}
                        onUpdate={() => { onUpdate(); setScriptKey(k => k + 1) }}
                        onOfferLoaded={(productId, oneClick, offerId, checkoutId) => {
                            setOfferProductId(productId)
                            setOfferOneClick(oneClick)
                            setOfferOfferId(offerId)
                            setOfferCheckoutId(checkoutId)
                        }}
                    />

                    {/* Divider */}
                    <div className="border-t border-gray-200 dark:border-zinc-800" />

                    {/* Redirect Configuration */}
                    <RedirectConfig
                        funnelId={funnelId}
                        pageId={page.id}
                        pageType={page.page_type as 'upsell' | 'downsell'}
                        onUpdate={() => { onUpdate(); setScriptKey(k => k + 1) }}
                        onRedirectsChanged={(acceptUrl, rejectUrl) => {
                            setConfiguredAcceptUrl(acceptUrl)
                            setConfiguredRejectUrl(rejectUrl)
                        }}
                    />

                    {/* Divider */}
                    <div className="border-t border-gray-200 dark:border-zinc-800" />

                    {/* Script Generator */}
                    <ScriptGenerator
                        key={scriptKey}
                        funnelId={funnelId}
                        pageId={page.id}
                        pageType={page.page_type as 'upsell' | 'downsell' | 'thankyou'}
                        pageName={page.name}
                        externalUrl={page.external_url || undefined}
                        productId={offerProductId}
                        oneClickPurchase={offerOneClick}
                        offerId={offerOfferId}
                        checkoutId={offerCheckoutId}
                        configuredAcceptUrl={configuredAcceptUrl}
                        configuredRejectUrl={configuredRejectUrl}
                    />
                </div>
            )}

            {/* Product & Checkout Card - Only for checkout pages */}
            {isCheckoutPage && (
                <ProductCheckoutCard
                    product={product}
                    loadingProduct={loadingProduct}
                    checkouts={checkouts}
                    selectedCheckout={selectedCheckout}
                    loadingCheckouts={loadingCheckouts}
                    savingCheckout={savingCheckout}
                    onCheckoutChange={updateCheckout}
                    onUpdate={onUpdate}
                    pageId={page.id}
                />
            )}
            {/* Checkout Redirect Config - Only for checkout pages */}
            {isCheckoutPage && (
                <CheckoutRedirectConfig
                    funnelId={funnelId}
                    pageId={page.id}
                    onUpdate={onUpdate}
                />
            )}
            {/* Order Bump Section - Only for checkout pages */}
            {isCheckoutPage && (
                <OrderBumpSection funnelId={funnelId} onUpdate={onUpdate} />
            )}
        </div>
    )
}
