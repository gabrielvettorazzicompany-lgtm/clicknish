import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { CheckCircle, ArrowRight } from 'lucide-react'

interface ThankYouSettings {
    title?: string
    description?: string
    show_cta_button?: boolean
    cta_text?: string
    cta_url?: string
    background_color?: string
}

export default function ThankYouPage() {
    const { pageId } = useParams<{ pageId: string }>()
    const [searchParams] = useSearchParams()
    const purchaseId = searchParams.get('purchase_id')
    const token = searchParams.get('token')
    const [settings, setSettings] = useState<ThankYouSettings | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!pageId) { setLoading(false); return }
        fetch(`https://api.clicknich.com/api/funnel-pages/${pageId}/public`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data?.settings) setSettings(data.settings)
            })
            .catch(() => { })
            .finally(() => setLoading(false))
    }, [pageId])

    const title = settings?.title || 'Obrigado pela sua compra!'
    const description = settings?.description || 'Seu pedido foi processado com sucesso. Em breve você receberá as instruções de acesso por e-mail.'
    const showCta = settings?.show_cta_button !== false
    const ctaText = settings?.cta_text || 'Acessar meu produto'
    const ctaUrl = settings?.cta_url || (purchaseId ? `/?purchase_id=${purchaseId}&token=${token}` : '/')

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
            <div className="max-w-md w-full text-center space-y-6">
                {/* Ícone de sucesso */}
                <div className="flex justify-center">
                    <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                        <CheckCircle size={40} className="text-green-400" />
                    </div>
                </div>

                {/* Título */}
                <div className="space-y-3">
                    <h1 className="text-2xl font-bold text-white leading-tight">{title}</h1>
                    <p className="text-gray-400 leading-relaxed">{description}</p>
                </div>

                {/* CTA */}
                {showCta && (
                    <a
                        href={ctaUrl}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        {ctaText}
                        <ArrowRight size={16} />
                    </a>
                )}

                {/* Purchase ID discreto */}
                {purchaseId && (
                    <p className="text-xs text-gray-600">
                        Pedido #{purchaseId.slice(0, 8).toUpperCase()}
                    </p>
                )}
            </div>
        </div>
    )
}
