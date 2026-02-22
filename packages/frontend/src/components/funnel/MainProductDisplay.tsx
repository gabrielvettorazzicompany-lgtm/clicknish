import { Package } from 'lucide-react'
import { useI18n } from '@/i18n'

interface FunnelProduct {
    id: string
    name: string
    price?: string
    app_type?: string
    source: string
}

interface MainProductDisplayProps {
    product: FunnelProduct | null
    loading: boolean
}

export default function MainProductDisplay({ product, loading }: MainProductDisplayProps) {
    const { t } = useI18n()

    return (
        <div className="bg-white dark:bg-[#0f1117] rounded-lg border border-gray-200 dark:border-zinc-800 p-4">
            <div className="flex items-center gap-2 mb-3">
                <Package className="text-zinc-400" size={16} />
                <h3 className="text-xs font-medium text-gray-900 dark:text-white">
                    {t('funnel_components.main_product.title')}
                </h3>
            </div>

            {loading ? (
                <p className="text-xs text-gray-500 dark:text-zinc-400">{t('common.loading')}</p>
            ) : product ? (
                <div className="bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded p-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="text-gray-900 dark:text-white text-sm font-medium">{product.name}</h4>
                            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                                {product.source === 'marketplace'
                                    ? `${product.price ? Number(product.price).toFixed(2) : '0.00'}`
                                    : product.app_type === 'community'
                                        ? t('common.community')
                                        : t('funnel_components.main_product.application')
                                }
                            </p>
                        </div>
                        <span className="px-2.5 py-1 bg-zinc-800 text-zinc-300 rounded-full text-xs font-medium">
                            {t('funnel_components.main_product.main_badge')}
                        </span>
                    </div>
                </div>
            ) : (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3">
                    <p className="text-xs text-yellow-400">
                        {t('funnel_components.main_product.no_product')}
                    </p>
                    <p className="text-xs text-zinc-400 mt-1.5">
                        {t('funnel_components.main_product.configure_hint')}
                    </p>
                </div>
            )}
        </div>
    )
}
