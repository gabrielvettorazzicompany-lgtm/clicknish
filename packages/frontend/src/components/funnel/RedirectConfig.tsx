import { useState, useEffect } from 'react'
import { ArrowRight, Save, Check, Link2 } from 'lucide-react'
import { supabase } from '@/services/supabase'
import { useI18n } from '@/i18n'

interface FunnelPage {
    id: string
    name: string
    page_type: string
    position: number
    external_url?: string | null
    checkout_id?: string | null
}

interface RedirectSettings {
    accept_redirect_url?: string
    reject_redirect_url?: string
    accept_page_id?: string
    reject_page_id?: string
}

interface RedirectConfigProps {
    funnelId: string
    pageId: string
    pageType: 'upsell' | 'downsell'
    onUpdate: () => void
    onRedirectsChanged?: (acceptUrl: string | undefined, rejectUrl: string | undefined) => void
    onSettingsChange?: (s: RedirectSettings) => void
}

export default function RedirectConfig({ funnelId, pageId, pageType, onUpdate, onRedirectsChanged, onSettingsChange }: RedirectConfigProps) {
    const { t } = useI18n()
    const [pages, setPages] = useState<FunnelPage[]>([])
    const [settings, setSettings] = useState<RedirectSettings>({})
    const [loginUrl, setLoginUrl] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchData()
    }, [funnelId, pageId])

    const fetchData = async () => {
        try {
            setLoading(true)

            // Fetch all funnel pages
            const { data: allPages } = await supabase
                .from('funnel_pages')
                .select('id, name, page_type, position, external_url, checkout_id')
                .eq('funnel_id', funnelId)
                .order('position', { ascending: true })

            // Fetch current page settings
            const { data: currentPage } = await supabase
                .from('funnel_pages')
                .select('settings, position')
                .eq('id', pageId)
                .single()

            if (allPages) {
                // Filter out current page, pages before it, inactive, custom and thank you pages
                const currentPosition = currentPage?.position ?? 0
                const availablePages = allPages.filter(p =>
                    p.id !== pageId &&
                    p.position > currentPosition &&
                    p.page_type !== 'thankyou' &&
                    p.page_type !== 'custom' &&
                    p.page_type !== 'inactive'
                )
                setPages(availablePages)
            }

            // Fetch the funnel's product to resolve login URL
            const { data: funnel } = await supabase
                .from('funnels')
                .select('product_id')
                .eq('id', funnelId)
                .single()

            if (funnel?.product_id) {
                // Check if it's an application
                const { data: app } = await supabase
                    .from('applications')
                    .select('slug')
                    .eq('id', funnel.product_id)
                    .maybeSingle()

                if (app?.slug) {
                    const frontendUrl = (import.meta.env as any).VITE_APP_URL || window.location.origin
                    setLoginUrl(`${frontendUrl}/access/${app.slug}`)
                } else {
                    // Check member_areas
                    const { data: member } = await supabase
                        .from('member_areas')
                        .select('slug')
                        .eq('id', funnel.product_id)
                        .maybeSingle()

                    if (member?.slug) {
                        const frontendUrl = (import.meta.env as any).VITE_APP_URL || window.location.origin
                        setLoginUrl(`${frontendUrl}/members-login/${member.slug}`)
                    }
                }
            }

            if (currentPage?.settings) {
                const s = currentPage.settings as RedirectSettings
                setSettings(s)
                // Notify parent of current redirect URLs
                const acceptUrl = await resolveUrl(s.accept_page_id, s.accept_redirect_url, allPages || [])
                const rejectUrl = await resolveUrl(s.reject_page_id, s.reject_redirect_url, allPages || [])
                onRedirectsChanged?.(acceptUrl, rejectUrl)
            }
        } catch (error) {
            console.error('Error fetching redirect config:', error)
        } finally {
            setLoading(false)
        }
    }

    const resolveUrl = async (targetPageId: string | undefined, customUrl: string | undefined, allPages: FunnelPage[]): Promise<string | undefined> => {
        if (customUrl) return customUrl
        if (targetPageId) {
            const page = allPages.find(p => p.id === targetPageId)
            if (page?.external_url) return page.external_url

            // For upsell/downsell pages without external_url, find their checkout URL
            if (page && ['upsell', 'downsell'].includes(page.page_type)) {
                // Find the checkout_offer linked to this page
                const { data: offer } = await supabase
                    .from('checkout_offers')
                    .select('checkout_id')
                    .eq('page_id', page.id)
                    .eq('is_active', true)
                    .limit(1)
                    .maybeSingle()

                if (offer?.checkout_id) {
                    // Find checkout_url for this checkout
                    const { data: checkoutUrl } = await supabase
                        .from('checkout_urls')
                        .select('id')
                        .eq('checkout_id', offer.checkout_id)
                        .limit(1)
                        .maybeSingle()

                    if (checkoutUrl) {
                        const frontendUrl = (import.meta.env as any).VITE_APP_URL || window.location.origin
                        return `${frontendUrl}/checkout/${checkoutUrl.id}?nobumps=1`
                    }
                }
            }

            return undefined
        }
        return undefined
    }

    const handleSave = async () => {
        try {
            setSaving(true)

            const { error } = await supabase
                .from('funnel_pages')
                .update({
                    settings: settings,
                    updated_at: new Date().toISOString()
                })
                .eq('id', pageId)

            if (error) throw error

            // Resolve URLs and notify parent
            const acceptUrl = await resolveUrl(settings.accept_page_id, settings.accept_redirect_url, pages)
            const rejectUrl = await resolveUrl(settings.reject_page_id, settings.reject_redirect_url, pages)
            onRedirectsChanged?.(acceptUrl, rejectUrl)

            onUpdate()
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
        } catch (error) {
            console.error('Error saving redirect config:', error)
            alert(t('funnel_components.error_saving_redirect'))
        } finally {
            setSaving(false)
        }
    }

    const getPageLabel = (type: string) => {
        switch (type) {
            case 'thankyou': return t('funnel_components.page_type_thankyou')
            case 'upsell': return t('funnel_components.page_type_upsell')
            case 'downsell': return t('funnel_components.page_type_downsell')
            case 'checkout': return t('funnel_components.page_type_checkout')
            default: return type
        }
    }

    if (loading) {
        return (
            <div className="py-2">
                <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-zinc-500"></div>
                    <span className="ml-2 text-gray-500 text-[10px]">{t('funnel_components.loading_redirects')}</span>
                </div>
            </div>
        )
    }

    return (
        <div>
            <h3 className="text-xs font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <ArrowRight size={12} />
                {t('funnel_components.redirect_title')}
            </h3>

            <div className="space-y-3">
                {/* Accept Redirect - Where to go after buying */}
                <div>
                    <label className="block text-xs text-gray-500 dark:text-zinc-400 mb-1.5">
                        {t('funnel_components.after_accepting')}
                    </label>
                    <select
                        value={loginUrl && settings.accept_redirect_url === loginUrl ? '_login' : (settings.accept_page_id || (settings.accept_redirect_url ? '_custom' : '_none'))}
                        onChange={(e) => {
                            const value = e.target.value
                            let next: RedirectSettings
                            if (value === '_custom') {
                                next = { ...settings, accept_page_id: undefined, accept_redirect_url: '' }
                            } else if (value === '_login') {
                                next = { ...settings, accept_page_id: undefined, accept_redirect_url: loginUrl || '' }
                            } else if (value === '_none') {
                                next = { ...settings, accept_page_id: undefined, accept_redirect_url: undefined }
                            } else {
                                next = { ...settings, accept_page_id: value, accept_redirect_url: undefined }
                            }
                            setSettings(next)
                            onSettingsChange?.(next)
                        }}
                        className="w-full px-3 py-2 bg-white dark:bg-transparent border border-gray-300 dark:border-zinc-800 rounded text-gray-900 dark:text-white text-xs focus:outline-none focus:border-blue-500 dark:focus:border-zinc-600 appearance-none cursor-pointer transition-colors"
                    >
                        <option value="_none">{t('funnel_components.auto_next_page')}</option>
                        {pages.map(p => (
                            <option key={p.id} value={p.id}>
                                {p.name} ({getPageLabel(p.page_type)})
                            </option>
                        ))}
                        {loginUrl && <option value="_login">{t('funnel_components.login_page')}</option>}
                        <option value="_custom">{t('funnel_components.custom_url_option')}</option>
                    </select>

                    {/* Custom URL input - hide when login URL is selected */}
                    {!settings.accept_page_id && settings.accept_redirect_url !== undefined && settings.accept_redirect_url !== null && !(loginUrl && settings.accept_redirect_url === loginUrl) && (
                        <div className="mt-1.5 relative">
                            <Link2 size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500" />
                            <input
                                type="url"
                                value={settings.accept_redirect_url || ''}
                                onChange={(e) => {
                                    const next = { ...settings, accept_redirect_url: e.target.value || undefined }
                                    setSettings(next)
                                    onSettingsChange?.(next)
                                }}
                                placeholder="https://yoursite.com/thank-you"
                                className="w-full pl-8 pr-3 py-2 bg-white dark:bg-transparent border border-gray-300 dark:border-zinc-800 rounded text-gray-900 dark:text-white text-xs placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-blue-500 dark:focus:border-zinc-600 transition-colors"
                            />
                        </div>
                    )}

                    {/* Show selected page URL if available */}
                    {settings.accept_page_id && (() => {
                        const selectedPage = pages.find(p => p.id === settings.accept_page_id)
                        return selectedPage?.external_url ? (
                            <p className="text-[10px] text-zinc-600 mt-1 truncate">→ {selectedPage.external_url}</p>
                        ) : selectedPage ? (
                            <p className="text-[10px] text-yellow-500 mt-1">⚠ {t('funnel_components.no_external_url_warning')}</p>
                        ) : null
                    })()}
                </div>

                {/* Reject Redirect - Where to go after declining */}
                <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">
                        {t('funnel_components.after_rejecting')}
                    </label>
                    <select
                        value={settings.reject_page_id || (settings.reject_redirect_url ? '_custom' : '_none')}
                        onChange={(e) => {
                            const value = e.target.value
                            let next: RedirectSettings
                            if (value === '_custom') {
                                next = { ...settings, reject_page_id: undefined, reject_redirect_url: '' }
                            } else if (value === '_none') {
                                next = { ...settings, reject_page_id: undefined, reject_redirect_url: undefined }
                            } else {
                                next = { ...settings, reject_page_id: value, reject_redirect_url: undefined }
                            }
                            setSettings(next)
                            onSettingsChange?.(next)
                        }}
                        className="w-full px-3 py-2 bg-white dark:bg-transparent border border-gray-300 dark:border-zinc-800 rounded text-gray-900 dark:text-white text-xs focus:outline-none focus:border-blue-500 dark:focus:border-zinc-600 appearance-none cursor-pointer transition-colors"
                    >
                        <option value="_none">{t('funnel_components.auto_next_page')}</option>
                        {pages.map(p => (
                            <option key={p.id} value={p.id}>
                                {p.name} ({getPageLabel(p.page_type)})
                            </option>
                        ))}
                        <option value="_custom">{t('funnel_components.custom_url_option')}</option>
                    </select>

                    {/* Custom URL input for reject */}
                    {!settings.reject_page_id && settings.reject_redirect_url !== undefined && settings.reject_redirect_url !== null && (
                        <div className="mt-1.5 relative">
                            <Link2 size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500" />
                            <input
                                type="url"
                                value={settings.reject_redirect_url || ''}
                                onChange={(e) => {
                                    const next = { ...settings, reject_redirect_url: e.target.value || undefined }
                                    setSettings(next)
                                    onSettingsChange?.(next)
                                }}
                                placeholder="https://yoursite.com/no-thanks"
                                className="w-full pl-8 pr-3 py-2 bg-white dark:bg-transparent border border-gray-300 dark:border-zinc-800 rounded text-gray-900 dark:text-white text-xs placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-blue-500 dark:focus:border-zinc-600 transition-colors"
                            />
                        </div>
                    )}

                    {/* Show selected page URL if available */}
                    {settings.reject_page_id && (() => {
                        const selectedPage = pages.find(p => p.id === settings.reject_page_id)
                        return selectedPage?.external_url ? (
                            <p className="text-[10px] text-zinc-600 mt-1 truncate">→ {selectedPage.external_url}</p>
                        ) : selectedPage ? (
                            <p className="text-[10px] text-yellow-500 mt-1">⚠ {t('funnel_components.no_external_url_warning')}</p>
                        ) : null
                    })()}
                </div>

                {/* Save Button */}
                {!onSettingsChange && (
                    <div className="flex justify-end pt-1">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-medium transition-all ${saved
                                ? 'bg-green-500/10 text-green-400'
                                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed'
                                }`}
                        >
                            {saved ? <><Check size={12} /> {t('funnel_components.saved')}</> : <><Save size={12} /> {saving ? t('common.saving') : t('common.save')}</>}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
