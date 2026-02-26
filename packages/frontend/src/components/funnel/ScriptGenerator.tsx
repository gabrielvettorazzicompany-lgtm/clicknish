import { useState, useEffect } from 'react'
import { Copy, Check, AlertCircle } from 'lucide-react'
import { generateFunnelPageScript, type ScriptConfig } from '@/utils/scriptGenerator'
import { supabase } from '@/services/supabase'
import { useI18n } from '@/i18n'

interface ScriptGeneratorProps {
    funnelId: string
    pageId: string
    pageType: 'upsell' | 'downsell' | 'thankyou'
    pageName: string
    externalUrl?: string
    productId?: string
    oneClickPurchase?: boolean
    offerId?: string
    checkoutId?: string
    configuredAcceptUrl?: string
    configuredRejectUrl?: string
}

export default function ScriptGenerator({ funnelId, pageId, pageType, pageName, externalUrl, productId, oneClickPurchase, offerId, checkoutId, configuredAcceptUrl, configuredRejectUrl }: ScriptGeneratorProps) {
    const { t } = useI18n()
    const [copiedHead, setCopiedHead] = useState(false)
    const [copiedBody, setCopiedBody] = useState(false)
    const [nextPageUrl, setNextPageUrl] = useState<string | undefined>(undefined)
    const [acceptNextUrl, setAcceptNextUrl] = useState<string | undefined>(undefined)
    const [checkoutUrl, setCheckoutUrl] = useState<string | undefined>(undefined)
    const [loading, setLoading] = useState(true)

    // Fetch checkout URL for product + next page URLs
    useEffect(() => {
        async function fetchData() {
            try {
                setLoading(true)

                // 1. Find checkout URL — use checkoutId if provided, otherwise search by product
                if (checkoutId) {
                    // Direct: use the checkout selected by the user
                    const { data: existingUrl } = await supabase
                        .from('checkout_urls')
                        .select('id')
                        .eq('checkout_id', checkoutId)
                        .maybeSingle()

                    if (existingUrl) {
                        setCheckoutUrl(`/checkout/${existingUrl.id}`)
                    } else {
                        // Fetch checkout to get member_area_id or application_id
                        const { data: checkoutData } = await supabase
                            .from('checkouts')
                            .select('member_area_id, application_id')
                            .eq('id', checkoutId)
                            .single()

                        const urlInsert: any = { checkout_id: checkoutId }
                        if (checkoutData?.member_area_id) {
                            urlInsert.member_area_id = checkoutData.member_area_id
                        }
                        if (checkoutData?.application_id) {
                            urlInsert.application_id = checkoutData.application_id
                        }

                        // Create short URL for this checkout
                        const { data: newUrl, error: insertError } = await supabase
                            .from('checkout_urls')
                            .insert(urlInsert)
                            .select('id')
                            .single()



                        if (newUrl) {
                            setCheckoutUrl(`/checkout/${newUrl.id}`)
                        } else {
                            setCheckoutUrl(undefined)
                        }
                    }
                } else if (productId) {
                    // Detect product type
                    const { data: isMember } = await supabase
                        .from('member_areas')
                        .select('id')
                        .eq('id', productId)
                        .maybeSingle()

                    const isMemberArea = !!isMember
                    let foundCheckoutId: string | null = null

                    // Find checkout
                    if (isMemberArea) {
                        const { data } = await supabase
                            .from('checkouts')
                            .select('id')
                            .eq('member_area_id', productId)
                            .order('is_default', { ascending: false })
                            .limit(1)
                            .maybeSingle()
                        foundCheckoutId = data?.id || null
                    } else {
                        const { data } = await supabase
                            .from('checkouts')
                            .select('id')
                            .eq('application_id', productId)
                            .order('is_default', { ascending: false })
                            .limit(1)
                            .maybeSingle()
                        foundCheckoutId = data?.id || null
                    }



                    if (foundCheckoutId) {
                        // Find existing short URL
                        const { data: existingUrl } = await supabase
                            .from('checkout_urls')
                            .select('id')
                            .eq('checkout_id', foundCheckoutId)
                            .maybeSingle()

                        if (existingUrl) {
                            setCheckoutUrl(`/checkout/${existingUrl.id}`)
                        } else {
                            // Create short URL
                            const urlInsert: any = { checkout_id: foundCheckoutId }
                            if (isMemberArea) {
                                urlInsert.member_area_id = productId
                            } else {
                                urlInsert.application_id = productId
                            }

                            const { data: newUrl } = await supabase
                                .from('checkout_urls')
                                .insert(urlInsert)
                                .select('id')
                                .single()

                            if (newUrl) {
                                setCheckoutUrl(`/checkout/${newUrl.id}`)
                            }
                        }
                    } else {
                        console.warn('[ScriptGen] No checkout found for product:', productId)
                        setCheckoutUrl(undefined)
                    }
                } else {
                    setCheckoutUrl(undefined)
                }

                // 2. Fetch next page URLs (reject/accept flow)
                const { data: currentPage } = await supabase
                    .from('funnel_pages')
                    .select('position, settings')
                    .eq('id', pageId)
                    .single()

                if (!currentPage) {
                    setNextPageUrl(undefined)
                    setAcceptNextUrl(undefined)
                    return
                }

                // If settings have accept_page_id, resolve it
                const savedSettings = currentPage.settings as any
                if (savedSettings?.accept_page_id && !configuredAcceptUrl) {
                    // Find the target page and resolve its URL
                    const { data: targetPage } = await supabase
                        .from('funnel_pages')
                        .select('id, external_url, page_type')
                        .eq('id', savedSettings.accept_page_id)
                        .single()

                    if (targetPage?.external_url) {
                        setAcceptNextUrl(targetPage.external_url)
                    } else if (targetPage && ['upsell', 'downsell'].includes(targetPage.page_type)) {
                        // Find checkout URL for upsell/downsell pages without external URL
                        const { data: offer } = await supabase
                            .from('checkout_offers')
                            .select('checkout_id')
                            .eq('page_id', targetPage.id)
                            .eq('is_active', true)
                            .limit(1)
                            .maybeSingle()

                        if (offer?.checkout_id) {
                            const { data: checkoutUrlData } = await supabase
                                .from('checkout_urls')
                                .select('id')
                                .eq('checkout_id', offer.checkout_id)
                                .limit(1)
                                .maybeSingle()

                            if (checkoutUrlData) {
                                const frontendUrl = (import.meta.env as any).VITE_APP_URL || window.location.origin
                                setAcceptNextUrl(`${frontendUrl}/checkout/${checkoutUrlData.id}?nobumps=1`)
                            }
                        }
                    }
                }

                const { data: nextPages } = await supabase
                    .from('funnel_pages')
                    .select('external_url, page_type, position')
                    .eq('funnel_id', funnelId)
                    .gt('position', currentPage.position)
                    .order('position', { ascending: true })

                if (!nextPages?.length) {
                    if (!savedSettings?.accept_page_id) setAcceptNextUrl(undefined)
                    setNextPageUrl(undefined)
                } else {
                    setNextPageUrl(nextPages[0]?.external_url || undefined)

                    if (!savedSettings?.accept_page_id) {
                        if (pageType === 'upsell') {
                            const skipPage = nextPages.find(p => p.page_type !== 'downsell')
                            setAcceptNextUrl(skipPage?.external_url || nextPages[0]?.external_url || undefined)
                        } else {
                            setAcceptNextUrl(nextPages[0]?.external_url || undefined)
                        }
                    }
                }
            } catch (error) {
                console.error('Error fetching data:', error)
            } finally {
                setLoading(false)
            }
        }

        if (funnelId && pageId) {
            fetchData()
        }
    }, [funnelId, pageId, productId, checkoutId])

    const config: ScriptConfig = {
        funnelId,
        pageId,
        pageType,
        nextPageUrl: configuredRejectUrl || nextPageUrl,
        acceptNextUrl: configuredAcceptUrl || acceptNextUrl,
        productId,
        offerId,
        oneClickPurchase: oneClickPurchase ?? false,
        checkoutUrl,
    }

    const { headScript, bodyHtml } = generateFunnelPageScript(config)

    const handleCopyHead = () => {
        navigator.clipboard.writeText(headScript)
        setCopiedHead(true)
        setTimeout(() => setCopiedHead(false), 2000)
    }

    const handleCopyBody = () => {
        navigator.clipboard.writeText(bodyHtml)
        setCopiedBody(true)
        setTimeout(() => setCopiedBody(false), 2000)
    }

    if (loading) {
        return (
            <div className="py-6">
                <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-zinc-500"></div>
                    <span className="ml-2 text-gray-500 text-xs">{t('funnel_components.loading_script')}</span>
                </div>
            </div>
        )
    }

    return (
        <div>
            <h3 className="text-xs font-medium text-gray-900 dark:text-white mb-3">
                {t('funnel_components.integration_script')}
            </h3>

            {/* Warning if no product configured */}
            {!productId && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-2 mb-3">
                    <p className="text-xs text-yellow-400">
                        {t('funnel_components.configure_product_script')}
                    </p>
                </div>
            )}

            <div className="space-y-3">
                {/* Script Head */}
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-zinc-400">{t('funnel_components.head')}</span>
                        <button
                            onClick={handleCopyHead}
                            className={`flex items-center gap-1 px-2 py-0.5 text-[11px] rounded transition-colors ${copiedHead ? 'text-green-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            {copiedHead ? <><Check size={10} /> {t('funnel_components.copied')}</> : <><Copy size={10} /> {t('funnel_components.copy')}</>}
                        </button>
                    </div>
                    <pre className="bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 rounded p-3 text-[11px] leading-relaxed text-gray-700 dark:text-zinc-400 overflow-x-auto font-mono">
                        <code>{headScript}</code>
                    </pre>
                </div>

                {/* HTML Body */}
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-zinc-400">{t('funnel_components.body')}</span>
                        <button
                            onClick={handleCopyBody}
                            className={`flex items-center gap-1 px-2 py-0.5 text-[11px] rounded transition-colors ${copiedBody ? 'text-green-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            {copiedBody ? <><Check size={10} /> {t('funnel_components.copied')}</> : <><Copy size={10} /> {t('funnel_components.copy')}</>}
                        </button>
                    </div>
                    <pre className="bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 rounded p-3 text-[11px] leading-relaxed text-gray-700 dark:text-zinc-400 overflow-x-auto whitespace-pre-wrap font-mono">
                        <code>{bodyHtml}</code>
                    </pre>
                </div>
            </div>
        </div>
    )
}
