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
}

interface RedirectSettings {
    post_purchase_redirect_url?: string
    post_purchase_page_id?: string
}

interface CheckoutRedirectConfigProps {
    funnelId: string
    pageId: string
    onUpdate: () => void
    onSettingsChange?: (s: RedirectSettings) => void
}

export default function CheckoutRedirectConfig({ funnelId, pageId, onUpdate, onSettingsChange }: CheckoutRedirectConfigProps) {
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
                .select('id, name, page_type, position, external_url')
                .eq('funnel_id', funnelId)
                .order('position', { ascending: true })

            // Fetch current page settings
            const { data: currentPage } = await supabase
                .from('funnel_pages')
                .select('settings, position')
                .eq('id', pageId)
                .single()

            if (allPages) {
                // Filter out current page and show only upsell/downsell pages after checkout
                const currentPosition = currentPage?.position ?? 0
                const availablePages = allPages.filter(p =>
                    p.id !== pageId &&
                    p.position > currentPosition &&
                    ['upsell', 'downsell'].includes(p.page_type) &&
                    p.page_type !== 'custom' &&
                    p.page_type !== 'inactive' &&
                    p.page_type !== 'thankyou'
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
                const frontendUrl = (import.meta.env as any).VITE_APP_URL || window.location.origin

                // Check if it's an application
                const { data: app } = await supabase
                    .from('applications')
                    .select('slug')
                    .eq('id', funnel.product_id)
                    .maybeSingle()

                if (app?.slug) {
                    setLoginUrl(`${frontendUrl}/access/${app.slug}`)
                } else {
                    // Check member_areas
                    const { data: member } = await supabase
                        .from('member_areas')
                        .select('slug')
                        .eq('id', funnel.product_id)
                        .maybeSingle()

                    if (member?.slug) {
                        setLoginUrl(`${frontendUrl}/members-login/${member.slug}`)
                    }
                }
            }

            if (currentPage?.settings) {
                const s = currentPage.settings as RedirectSettings
                setSettings(s)
                onSettingsChange?.(s)
            }
        } catch (error) {
            console.error('Error fetching checkout redirect config:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        try {
            setSaving(true)



            // Fetch existing settings first
            const { data: existingPage } = await supabase
                .from('funnel_pages')
                .select('settings, checkout_id')
                .eq('id', pageId)
                .single()



            const existingSettings = existingPage?.settings || {}

            const newSettings = {
                ...existingSettings,
                ...settings
            }

            console.log('🔍 Debug Save: Saving redirect settings:', newSettings)

            const { error } = await supabase
                .from('funnel_pages')
                .update({
                    settings: newSettings,
                    updated_at: new Date().toISOString()
                })
                .eq('id', pageId)

            if (error) {
                console.error('🔍 Save error:', error)
                throw error
            }

            console.log('🔍 Debug Save: Successfully saved redirect settings')

            // Purgar cache KV do checkout vinculado para que o novo redirect seja carregado imediatamente
            if (existingPage?.checkout_id) {
                fetch('https://api.clicknich.com/api/cache/purge', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ checkoutId: existingPage.checkout_id }),
                }).catch(() => { })
            }

            onUpdate()
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
        } catch (error) {
            console.error('Error saving checkout redirect config:', error)
            alert(t('funnel_components.checkout_redirect.error_saving'))
        } finally {
            setSaving(false)
        }
    }

    const getPageLabel = (type: string) => {
        switch (type) {
            case 'thankyou': return t('funnel_components.page_types.thankyou')
            case 'upsell': return t('funnel_components.page_types.upsell')
            case 'downsell': return t('funnel_components.page_types.downsell')
            default: return type
        }
    }

    if (loading) {
        return (
            <div className="py-2">
                <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-zinc-500"></div>
                    <span className="ml-2 text-gray-500 text-[10px]">{t('funnel_components.checkout_redirect.loading')}</span>
                </div>
            </div>
        )
    }

    return (
        <div>
            <h3 className="text-xs font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <ArrowRight size={12} />
                {t('funnel_components.checkout_redirect.title')}
            </h3>

            <div className="space-y-3">
                <div>
                    <label className="block text-xs text-gray-500 dark:text-zinc-400 mb-1.5">
                        {t('funnel_components.checkout_redirect.description')}
                    </label>
                    <select
                        value={loginUrl && settings.post_purchase_redirect_url === loginUrl ? '_login' : (settings.post_purchase_page_id || (settings.post_purchase_redirect_url ? '_custom' : ''))}
                        onChange={(e) => {
                            const value = e.target.value
                            let next: RedirectSettings
                            if (value === '_custom') {
                                next = { ...settings, post_purchase_page_id: undefined, post_purchase_redirect_url: '' }
                            } else if (value === '_login') {
                                next = { ...settings, post_purchase_page_id: undefined, post_purchase_redirect_url: loginUrl || '' }
                            } else if (value === '') {
                                next = { ...settings, post_purchase_page_id: undefined, post_purchase_redirect_url: undefined }
                            } else {
                                next = { ...settings, post_purchase_page_id: value, post_purchase_redirect_url: undefined }
                            }
                            setSettings(next)
                            onSettingsChange?.(next)
                        }}
                        className="w-full px-3 py-2 bg-white dark:bg-transparent border border-gray-300 dark:border-zinc-800 rounded text-gray-900 dark:text-white text-xs focus:outline-none focus:border-blue-500 dark:focus:border-zinc-600 appearance-none cursor-pointer transition-colors"
                    >
                        <option value="">— Selecione —</option>
                        {pages.map(p => (
                            <option key={p.id} value={p.id}>
                                {p.name} ({getPageLabel(p.page_type)})
                            </option>
                        ))}
                        {loginUrl && <option value="_login">{t('funnel_components.checkout_redirect.login_page')}</option>}
                        <option value="_custom">{t('funnel_components.checkout_redirect.custom_url')}</option>
                    </select>

                    {/* Custom URL input - hide when login URL is selected */}
                    {!settings.post_purchase_page_id && settings.post_purchase_redirect_url !== undefined && !(loginUrl && settings.post_purchase_redirect_url === loginUrl) && (
                        <div className="mt-1.5 relative">
                            <Link2 size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500" />
                            <input
                                type="url"
                                value={settings.post_purchase_redirect_url || ''}
                                onChange={(e) => {
                                    const next = { ...settings, post_purchase_redirect_url: e.target.value || undefined }
                                    setSettings(next)
                                    onSettingsChange?.(next)
                                }}
                                placeholder="https://yoursite.com/upsell-page"
                                className="w-full pl-8 pr-3 py-2 bg-white dark:bg-transparent border border-gray-300 dark:border-zinc-800 rounded text-gray-900 dark:text-white text-xs placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-blue-500 dark:focus:border-zinc-600 transition-colors"
                            />
                        </div>
                    )}

                    {/* Show selected page URL if available */}
                    {settings.post_purchase_page_id && (() => {
                        const selectedPage = pages.find(p => p.id === settings.post_purchase_page_id)
                        return selectedPage?.external_url ? (
                            <p className="text-[10px] text-zinc-600 mt-1 truncate">→ {selectedPage.external_url}</p>
                        ) : selectedPage ? (
                            <p className="text-[10px] text-yellow-500 mt-1">{t('funnel_components.checkout_redirect.configure_external_url')}</p>
                        ) : null
                    })()}

                </div>

                {/* Save Button - only when standalone */}
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
                            {saved ? <><Check size={12} /> {t('common.saved')}</> : <><Save size={12} /> {saving ? t('common.saving') : t('common.save')}</>}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
