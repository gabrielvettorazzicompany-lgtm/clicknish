import { Edit, Trash2, ExternalLink, Copy, Check, Clock, CheckCircle, XCircle } from 'lucide-react'

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
    review_status?: 'pending_review' | 'approved' | 'rejected'
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
    getStatusText
}: ProductCardProps) {
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
                        {product.review_status === 'pending_review' && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-orange-500/90 text-white rounded-md text-xs font-medium backdrop-blur-sm">
                                <Clock size={12} />
                                Under Review
                            </div>
                        )}
                        {product.review_status === 'rejected' && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-red-500/90 text-white rounded-md text-xs font-medium backdrop-blur-sm" title={product.review_notes || 'Rejected'}>
                                <XCircle size={12} />
                                Rejected
                            </div>
                        )}
                    </div>
                )}

                {/* Action Buttons */}
                <div className="absolute top-2 right-2 flex gap-1">
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

                {/* Action Buttons */}
                <div className="flex gap-1.5">
                    <button
                        onClick={() => onOpenAccess(product.slug)}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md transition-colors text-xs font-medium ${product.review_status === 'pending_review' || product.review_status === 'rejected'
                            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                            : 'bg-blue-500 text-white hover:bg-blue-600'
                            }`}
                        disabled={product.review_status === 'pending_review' || product.review_status === 'rejected'}
                        title={
                            product.review_status === 'pending_review'
                                ? 'Product pending approval'
                                : product.review_status === 'rejected'
                                    ? 'Product was rejected'
                                    : ''
                        }
                    >
                        <ExternalLink size={12} />
                        {product.delivery_type === 'community' ? 'Members Area' : 'View Page'}
                    </button>
                    <button
                        onClick={() => onCopyLink(product.slug)}
                        className="px-3 py-1.5 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-white/10 transition-colors text-xs font-medium flex items-center gap-1.5"
                        title={product.delivery_type === 'community' ? 'Copy member login link' : 'Copy link'}
                    >
                        {copiedLinks.has(product.slug) ? <Check size={12} /> : <Copy size={12} />}
                        {copiedLinks.has(product.slug) ? 'Copied!' : 'Link'}
                    </button>
                </div>
            </div>
        </div>
    )
}