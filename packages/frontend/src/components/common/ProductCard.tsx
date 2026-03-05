import { Edit, Trash2, ExternalLink, Copy, Check, Clock, CheckCircle, XCircle, Send } from 'lucide-react'
import { useI18n } from '@/i18n'

interface Product {
    id: string
    name: string
    slug: string
    description?: string
    price: number
    currency?: string
    category: string
    status: 'active' | 'inactive' | 'draft'
    created_at: string
    image_url?: string
    sales_count: number
    delivery_type?: string
    review_status?: 'draft' | 'pending_review' | 'approved' | 'rejected'
    review_notes?: string
}

interface ProductCardProps {
    product: Product
    onEdit: (product: Product) => void
    onDelete: (id: string) => void
    onCopyLink: (slug: string) => void
    onOpenAccess: (slug: string) => void
    generateAccessUrl: (slug: string) => string
    copiedLinks: Set<string>
    formatCurrency: (value: number, currency?: string) => string
    getStatusColor: (status: string) => string
    getStatusText: (status: string) => string
    onSubmitReview?: (id: string) => void
}

export default function ProductCard({
    product,
    onEdit,
    onDelete,
    onCopyLink,
    onOpenAccess,
    generateAccessUrl,
    copiedLinks,
    formatCurrency,
    getStatusColor,
    getStatusText,
    onSubmitReview, }: ProductCardProps) {
    const { t } = useI18n()

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('pt-BR')
    }

    const getCurrencySymbol = (currency?: string) => {
        switch (currency) {
            case 'USD':
                return '$'
            case 'EUR':
                return '€'
            case 'CHF':
                return 'CHF'
            default:
                return '$'
        }
    }

    return (
        <div className="bg-white dark:bg-white/5 dark:backdrop-blur-xl rounded-2xl shadow-xl shadow-black/5 dark:shadow-black/10 border border-gray-200 dark:border-white/10 overflow-hidden hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-300">
            {/* Product Image */}
            <div className="h-32 bg-gray-100 dark:bg-white/5 relative overflow-hidden">
                {product.image_url ? (
                    <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full bg-gray-50 dark:bg-white/5"></div>
                )}

                {/* Review Status Badge */}
                {product.review_status && product.review_status !== 'approved' && (
                    <div className="absolute top-2 left-2">
                        {product.review_status === 'draft' && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-gray-700/90 text-gray-300 rounded-md text-xs font-medium backdrop-blur-sm">
                                {t('components.app_card.draft')}
                            </div>
                        )}
                        {product.review_status === 'pending_review' && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-orange-500/90 text-white rounded-md text-xs font-medium backdrop-blur-sm">
                                <Clock size={12} />
                                {t('components.app_card.in_review')}
                            </div>
                        )}
                        {product.review_status === 'rejected' && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-red-500/90 text-white rounded-md text-xs font-medium backdrop-blur-sm" title={product.review_notes || 'Rejected'}>
                                <XCircle size={12} />
                                {t('components.app_card.rejected')}
                            </div>
                        )}
                    </div>
                )}

                {/* Action Buttons */}
                <div className="absolute top-2 right-2 flex gap-1">
                    <button
                        onClick={() => onOpenAccess(product.slug)}
                        className="p-1.5 bg-white/90 dark:bg-white/10 backdrop-blur-sm text-blue-500 hover:bg-gray-100 dark:hover:bg-white/20 rounded-md transition-colors"
                        title="Open Members Area"
                    >
                        <ExternalLink size={12} />
                    </button>
                    <button
                        onClick={() => onEdit(product)}
                        className="p-1.5 bg-white/90 dark:bg-white/10 backdrop-blur-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/20 rounded-md transition-colors"
                        title="Edit Product"
                    >
                        <Edit size={12} />
                    </button>
                    <button
                        onClick={() => onDelete(product.id)}
                        className="p-1.5 bg-white/90 dark:bg-white/10 backdrop-blur-sm text-red-600 hover:bg-gray-100 dark:hover:bg-white/20 rounded-md transition-colors"
                        title="Delete Product"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>

            {/* Product Info */}
            <div className="p-4">
                <div className="mb-3">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1 line-clamp-2">
                        {product.name}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Created on {formatDate(product.created_at)}
                    </p>
                    {product.category && (
                        <span className="inline-block mt-1.5 px-2 py-0.5 bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 rounded text-xs">
                            {product.category}
                        </span>
                    )}
                </div>
                {(product.review_status === 'draft' || product.review_status === 'rejected') && onSubmitReview && (
                    <button
                        onClick={() => onSubmitReview(product.id)}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/25 text-blue-400 rounded-lg text-xs font-medium transition-colors mt-1"
                    >
                        <Send size={11} />
                        {t('components.app_card.submit_verification')}
                    </button>
                )}
            </div>
        </div>
    )
}