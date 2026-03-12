import { useAuthStore } from '@/stores/authStore'
import { useFunnelProduct } from '@/hooks/useFunnelProduct'
import { useFunnelCheckout } from '@/hooks/useFunnelCheckout'
import OrderBumpSection from './OrderBumpSection'
import ScriptGenerator from './ScriptGenerator'
import ExternalUrlConfig from './ExternalUrlConfig'
import ProductCheckoutCard from './ProductCheckoutCard'
import OfferPageConfig, { OfferPageConfigHandle } from './OfferPageConfig'
import RedirectConfig from './RedirectConfig'
import CheckoutRedirectConfig from './CheckoutRedirectConfig'
import ImageUploader from '@/components/ImageUploader'
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
    const [scriptVisible, setScriptVisible] = useState(false)
    const [offerProductId, setOfferProductId] = useState<string | undefined>(undefined)
    const [offerOneClick, setOfferOneClick] = useState(false)
    const [offerOfferId, setOfferOfferId] = useState<string | undefined>(undefined)
    const [offerCheckoutId, setOfferCheckoutId] = useState<string | undefined>(undefined)
    const [configuredAcceptUrl, setConfiguredAcceptUrl] = useState<string | undefined>(undefined)
    const [configuredRejectUrl, setConfiguredRejectUrl] = useState<string | undefined>(undefined)

    const isThankyouPage = page.page_type === 'thankyou'

    // Estado para configurações da thankyou page
    const [thankyouSettings, setThankyouSettings] = useState<Record<string, any>>({})
    const [loadingThankyou, setLoadingThankyou] = useState(false)
    const [savingThankyou, setSavingThankyou] = useState(false)
    const [savedThankyou, setSavedThankyou] = useState(false)

    useEffect(() => {
        if (!isThankyouPage) return
        setLoadingThankyou(true)
        supabase.from('funnel_pages').select('settings').eq('id', page.id).single()
            .then(({ data }) => {
                if (data?.settings) setThankyouSettings(data.settings as any)
            })
            .finally(() => setLoadingThankyou(false))
    }, [page.id, isThankyouPage])

    const handleSaveThankyouSettings = async () => {
        try {
            setSavingThankyou(true)
            const { error } = await supabase.from('funnel_pages')
                .update({ settings: thankyouSettings, updated_at: new Date().toISOString() })
                .eq('id', page.id)
            if (error) throw error
            onUpdate()
            setSavedThankyou(true)
            setTimeout(() => setSavedThankyou(false), 2000)
        } catch (e) {
            console.error('Error saving thankyou settings:', e)
        } finally {
            setSavingThankyou(false)
        }
    }

    const isCheckoutPage = page.page_type === 'checkout'
    const needsScript = ['upsell', 'downsell'].includes(page.page_type)

    // Refs para estado unificado de settings do checkout
    const latestModules = useRef<string[]>([])
    const modulesInitialized = useRef(false)
    const latestRedirectSettings = useRef<Record<string, any>>({})
    const latestExternalUrl = useRef<string>(page.external_url || '')
    const latestOfferRedirectSettings = useRef<Record<string, any>>({})
    const offerConfigRef = useRef<OfferPageConfigHandle>(null)

    // Reset refs ao mudar de página
    useEffect(() => {
        latestExternalUrl.current = page.external_url || ''
        latestOfferRedirectSettings.current = {}
        setScriptVisible(false)
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
                .select('settings, checkout_id')
                .eq('id', page.id)
                .single()
            const existingSettings = (existing?.settings as any) || {}
            const merged = {
                ...existingSettings,
                ...latestRedirectSettings.current,
                // só sobrescreve selected_modules se foi inicializado pelo ProductCheckoutCard
                ...(modulesInitialized.current
                    ? { selected_modules: latestModules.current }
                    : existingSettings.selected_modules !== undefined
                        ? { selected_modules: existingSettings.selected_modules }
                        : {}),
            }
            const { error } = await supabase
                .from('funnel_pages')
                .update({ settings: merged, updated_at: new Date().toISOString() })
                .eq('id', page.id)
            if (error) throw error

            // Purgar cache KV para que o worker use os novos settings imediatamente
            const checkoutId = existing?.checkout_id
            if (checkoutId) {
                fetch('https://api.clicknich.com/api/cache/purge', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ checkoutId }),
                }).catch(() => { })
            }

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
            await offerConfigRef.current?.save()
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
            // Reset stale URLs — ScriptGenerator vai rebuscar do DB (que já tem os valores salvos)
            setConfiguredAcceptUrl(undefined)
            setConfiguredRejectUrl(undefined)
            setScriptVisible(true)
            setScriptKey(k => k + 1)
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
                            ref={offerConfigRef}
                            funnelId={funnelId}
                            pageId={page.id}
                            pageType={page.page_type as 'upsell' | 'downsell'}
                            onUpdate={() => { onUpdate(); setScriptKey(k => k + 1) }}
                            onOfferLoaded={(productId, oneClick, offerId, checkoutId) => {
                                setOfferProductId(productId)
                                setOfferOneClick(oneClick)
                                setOfferOfferId(offerId)
                                setOfferCheckoutId(checkoutId)
                                // Se já tem oferta salva no DB, mostra script imediatamente
                                if (offerId) setScriptVisible(true)
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
                        {scriptVisible ? (
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
                        ) : (
                            <div className="py-4 text-center">
                                <p className="text-xs text-zinc-500">{t('funnel_components.save_to_generate_script') || 'Salve as configurações para gerar o script'}</p>
                            </div>
                        )}
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
                            onModulesChange={(ids) => { latestModules.current = ids; modulesInitialized.current = true }}
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

            {/* Config da Página de Obrigado */}
            {isThankyouPage && (
                <div className="rounded-lg border border-gray-200 dark:border-zinc-800 divide-y divide-gray-200 dark:divide-zinc-800">
                    <div className="p-4 space-y-4">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white">{t('funnel_components.thankyou_page') || 'Página de Obrigado'}</h3>

                        {loadingThankyou ? (
                            <p className="text-xs text-gray-400">{t('funnel_components.loading')}</p>
                        ) : (
                            <>
                                {/* Título */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                        {t('funnel_components.thankyou_title')}
                                    </label>
                                    <input
                                        type="text"
                                        value={thankyouSettings.title || ''}
                                        placeholder={t('funnel_components.thankyou_title_placeholder') || 'Obrigado pela sua compra!'}
                                        onChange={e => setThankyouSettings(s => ({ ...s, title: e.target.value }))}
                                        className="w-full px-3 py-2 text-sm bg-white dark:bg-transparent border border-gray-300 dark:border-zinc-700 rounded text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                                    />
                                </div>

                                {/* Descrição */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                        {t('funnel_components.thankyou_description')}
                                    </label>
                                    <textarea
                                        value={thankyouSettings.description || ''}
                                        placeholder={t('funnel_components.thankyou_description_placeholder') || 'Seu pedido foi processado com sucesso...'}
                                        rows={3}
                                        onChange={e => setThankyouSettings(s => ({ ...s, description: e.target.value }))}
                                        className="w-full px-3 py-2 text-sm bg-white dark:bg-transparent border border-gray-300 dark:border-zinc-700 rounded text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none"
                                    />
                                </div>

                                {/* Imagem */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                        {t('funnel_components.thankyou_image_optional')}
                                    </label>
                                    <ImageUploader
                                        onImageSelect={(imageData) => setThankyouSettings(s => ({ ...s, image_data: imageData }))}
                                        currentImage={thankyouSettings.image_data || ''}
                                        placeholder={t('funnel_components.thankyou_image_placeholder')}
                                        aspectRatio="square"
                                    />
                                    <p className="text-xs text-gray-400 mt-1">
                                        {t('funnel_components.thankyou_image_description')}
                                    </p>
                                </div>

                                {/* CTA Button */}
                                <div className="flex items-center gap-2">
                                    <input
                                        id="show-cta"
                                        type="checkbox"
                                        checked={thankyouSettings.show_cta_button !== false}
                                        onChange={e => setThankyouSettings(s => ({ ...s, show_cta_button: e.target.checked }))}
                                        className="w-4 h-4 accent-blue-500"
                                    />
                                    <label htmlFor="show-cta" className="text-xs text-gray-600 dark:text-gray-400">
                                        {t('funnel_components.show_cta_button') || 'Mostrar botão de ação'}
                                    </label>
                                </div>

                                {thankyouSettings.show_cta_button !== false && (
                                    <div className="space-y-3 pl-2 border-l-2 border-zinc-700">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                                {t('funnel_components.button_text')}
                                            </label>
                                            <input
                                                type="text"
                                                value={thankyouSettings.cta_text || ''}
                                                placeholder={t('funnel_components.cta_text_placeholder') || 'Acessar meu produto'}
                                                onChange={e => setThankyouSettings(s => ({ ...s, cta_text: e.target.value }))}
                                                className="w-full px-3 py-2 text-sm bg-white dark:bg-transparent border border-gray-300 dark:border-zinc-700 rounded text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                                {t('funnel_components.button_url') || 'URL do botão'}
                                            </label>
                                            <input
                                                type="url"
                                                value={thankyouSettings.cta_url || ''}
                                                placeholder="https://..."
                                                onChange={e => setThankyouSettings(s => ({ ...s, cta_url: e.target.value }))}
                                                className="w-full px-3 py-2 text-sm bg-white dark:bg-transparent border border-gray-300 dark:border-zinc-700 rounded text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                                            />
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div className="p-4 flex justify-end">
                        <button
                            onClick={handleSaveThankyouSettings}
                            disabled={savingThankyou || loadingThankyou}
                            className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-medium transition-all ${savedThankyou
                                ? 'bg-green-500/10 text-green-400'
                                : 'bg-white hover:bg-zinc-100 text-black disabled:opacity-30 disabled:cursor-not-allowed'
                                }`}
                        >
                            {savedThankyou
                                ? <><Check size={12} /> {t('common.saved')}</>
                                : <><Save size={12} /> {savingThankyou ? t('common.saving') : t('common.save')}</>
                            }
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
