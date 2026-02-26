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
import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/services/supabase'
import { Save, Check } from 'lucide-react'
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

    // Refs para estado unificado de settings do checkout
    const latestModules = useRef<string[]>([])
    const latestRedirectSettings = useRef<Record<string, any>>({})
    const latestExternalUrl = useRef<string>(page.external_url || '')
    const latestOfferRedirectSettings = useRef<Record<string, any>>({})

    // Reset refs ao mudar de página
    useEffect(() => {
        latestExternalUrl.current = page.external_url || ''
        latestOfferRedirectSettings.current = {}
    }, [page.id])
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [savingOffer, setSavingOffer] = useState(false)
    const [savedOffer, setSavedOffer] = useState(false)

    const handleSaveCheckoutSettings = async () => {
        try {
            setSaving(true)
            const { data: existing } = await supabase
                .from('funnel_pages')
                .select('settings')
                .eq('id', page.id)
                .single()
            const merged = {
                ...(existing?.settings as any || {}),
                ...latestRedirectSettings.current,
                selected_modules: latestModules.current
            }
            const { error } = await supabase
                .from('funnel_pages')
                .update({ settings: merged, updated_at: new Date().toISOString() })
                .eq('id', page.id)
            if (error) throw error
            onUpdate()
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
        } catch (e) {
            console.error('Error saving:', e)
        } finally {
            setSaving(false)
        }
    }

    const handleSaveOfferSettings = async () => {
        try {
            setSavingOffer(true)
            const { data: existing } = await supabase
                .from('funnel_pages')
                .select('settings')
                .eq('id', page.id)
                .single()
            const merged = {
                ...(existing?.settings as any || {}),
                ...latestOfferRedirectSettings.current,
            }
            const { error } = await supabase
                .from('funnel_pages')
                .update({
                    external_url: latestExternalUrl.current || null,
                    settings: merged,
                    updated_at: new Date().toISOString()
                })
                .eq('id', page.id)
            if (error) throw error
            onUpdate()
            setSavedOffer(true)
            setTimeout(() => setSavedOffer(false), 2000)
        } catch (e) {
            console.error('Error saving:', e)
        } finally {
            setSavingOffer(false)
        }
    }

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
            {/* External URL + Offer + Redirect + Script — Único card para upsell/downsell */}
            {needsScript && (
                <div className="rounded-lg border border-gray-200 dark:border-zinc-800 divide-y divide-gray-200 dark:divide-zinc-800">
                    {/* URL Externa */}
                    <div className="p-4">
                        <ExternalUrlConfig
                            pageId={page.id}
                            initialUrl={page.external_url || ''}
                            onUpdate={onUpdate}
                            onUrlChange={(url) => { latestExternalUrl.current = url }}
                        />
                    </div>

                    {/* Produto da oferta */}
                    <div className="p-4">
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
                    </div>

                    {/* Redirecionamentos */}
                    <div className="p-4">
                        <RedirectConfig
                            funnelId={funnelId}
                            pageId={page.id}
                            pageType={page.page_type as 'upsell' | 'downsell'}
                            onUpdate={() => { onUpdate(); setScriptKey(k => k + 1) }}
                            onRedirectsChanged={(acceptUrl, rejectUrl) => {
                                setConfiguredAcceptUrl(acceptUrl)
                                setConfiguredRejectUrl(rejectUrl)
                            }}
                            onSettingsChange={(s) => { latestOfferRedirectSettings.current = s }}
                        />
                    </div>

                    {/* Script Generator */}
                    <div className="p-4">
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

                    {/* Botão salvar unificado */}
                    <div className="p-4 flex justify-end">
                        <button
                            onClick={handleSaveOfferSettings}
                            disabled={savingOffer}
                            className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-medium transition-all ${savedOffer
                                ? 'bg-green-500/10 text-green-400'
                                : 'bg-white hover:bg-zinc-100 text-black disabled:opacity-30 disabled:cursor-not-allowed'
                                }`}
                        >
                            {savedOffer
                                ? <><Check size={12} /> {t('common.saved')}</>
                                : <><Save size={12} /> {savingOffer ? t('common.saving') : t('common.save')}</>
                            }
                        </button>
                    </div>
                </div>
            )}

            {/* Product & Checkout + Redirect + Order Bumps — Único card para checkout pages */}
            {isCheckoutPage && (
                <div className="rounded-lg border border-gray-200 dark:border-zinc-800 divide-y divide-gray-200 dark:divide-zinc-800">
                    {/* Produto e Checkout */}
                    <div className="p-4">
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
                            onModulesChange={(ids) => { latestModules.current = ids }}
                        />
                    </div>

                    {/* Redirecionar após compra */}
                    <div className="p-4">
                        <CheckoutRedirectConfig
                            funnelId={funnelId}
                            pageId={page.id}
                            onUpdate={onUpdate}
                            onSettingsChange={(s) => { latestRedirectSettings.current = s }}
                        />
                    </div>

                    {/* Order Bumps */}
                    <div className="p-4 pb-6">
                        <OrderBumpSection funnelId={funnelId} onUpdate={onUpdate} />
                    </div>

                    {/* Botão salvar unificado */}
                    <div className="p-4 flex justify-end">
                        <button
                            onClick={handleSaveCheckoutSettings}
                            disabled={saving}
                            className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-medium transition-all ${saved
                                ? 'bg-green-500/10 text-green-400'
                                : 'bg-white hover:bg-zinc-100 text-black disabled:opacity-30 disabled:cursor-not-allowed'
                                }`}
                        >
                            {saved
                                ? <><Check size={12} /> {t('common.saved')}</>
                                : <><Save size={12} /> {saving ? t('common.saving') : t('common.save')}</>
                            }
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
