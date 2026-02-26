import { useState, useEffect } from 'react'
import { Globe, Save, Check, ExternalLink } from 'lucide-react'
import { supabase } from '@/services/supabase'
import { useI18n } from '@/i18n'

interface ExternalUrlConfigProps {
    pageId: string
    initialUrl: string
    onUpdate: () => void
    onUrlChange?: (url: string) => void
}

export default function ExternalUrlConfig({ pageId, initialUrl, onUpdate, onUrlChange }: ExternalUrlConfigProps) {
    const { t } = useI18n()
    const [url, setUrl] = useState(initialUrl)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    // Reset URL when switching pages
    useEffect(() => {
        setUrl(initialUrl)
    }, [pageId, initialUrl])

    const handleSave = async () => {
        try {
            setSaving(true)

            const { error } = await supabase
                .from('funnel_pages')
                .update({ external_url: url || null })
                .eq('id', pageId)

            if (error) throw error

            onUpdate()
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
        } catch (error) {
            console.error('Error saving URL:', error)
            alert(t('funnel_components.external_url.error_saving'))
        } finally {
            setSaving(false)
        }
    }

    return (
        <div>
            <h3 className="text-xs font-medium text-white mb-3">
                {t('funnel_components.external_url.title')}
            </h3>
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500" />
                    <input
                        type="url"
                        placeholder="https://yoursite.com/offer-page"
                        value={url}
                        onChange={(e) => { setUrl(e.target.value); onUrlChange?.(e.target.value) }}
                        className="w-full pl-9 pr-3 py-2 bg-white dark:bg-transparent border border-gray-300 dark:border-zinc-800 rounded text-gray-900 dark:text-white text-xs placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:border-blue-500 dark:focus:border-zinc-600 transition-colors"
                    />
                </div>
                {url && (
                    <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center w-9 h-9 bg-gray-100 dark:bg-transparent border border-gray-300 dark:border-zinc-800 rounded text-gray-600 dark:text-zinc-500 hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-zinc-600 transition-colors"
                    >
                        <ExternalLink size={14} />
                    </a>
                )}
                {!onUrlChange && (
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded text-xs font-medium transition-all ${saved
                            ? 'bg-green-500/10 text-green-400'
                            : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40'
                            }`}
                    >
                        {saved ? <><Check size={12} /> {t('common.saved')}</> : <><Save size={12} /> {saving ? '...' : t('common.save')}</>}
                    </button>
                )}
            </div>
        </div>
    )
}
