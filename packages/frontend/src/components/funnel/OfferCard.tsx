import { Edit, Trash2, Eye, EyeOff } from 'lucide-react'

interface Offer {
    id: string
    type: 'upsell' | 'downsell' | 'order_bump'
    title: string
    description: string
    product_name: string
    original_price: number
    offer_price: number
    discount_percentage?: number
    currency: string
    button_text: string
    is_active: boolean
}

interface OfferCardProps {
    offer: Offer
    onEdit: (offer: Offer) => void
    onDelete: (offerId: string) => void
    onToggleActive: (offerId: string) => void
}

export default function OfferCard({ offer, onEdit, onDelete, onToggleActive }: OfferCardProps) {
    const getTypeColor = (type: string) => {
        switch (type) {
            case 'order_bump':
                return 'border-blue-500/30 bg-blue-500/10'
            case 'upsell':
                return 'border-green-500/30 bg-green-500/10'
            case 'downsell':
                return 'border-orange-500/30 bg-orange-500/10'
            default:
                return 'border-gray-500/30 bg-gray-500/10'
        }
    }

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'order_bump':
                return 'Order Bump'
            case 'upsell':
                return 'Upsell'
            case 'downsell':
                return 'Downsell'
            default:
                return type
        }
    }

    const formatCurrency = (value: number, currency: string) => {
        const currencySymbols: { [key: string]: string } = {
            BRL: 'R$',
            USD: '$',
            EUR: '€',
            CNY: '¥',
            COP: '$',
            CZK: 'Kč',
            DKK: 'kr',
            EGP: '£',
            BGN: 'лв',
            CAD: 'C$',
            XAF: 'FCFA',
            CLP: '$'
        }
        const symbol = currencySymbols[currency] || currency
        return `${symbol} ${value.toFixed(2)}`
    }

    return (
        <div className={`bg-white dark:bg-[#1a1d2e] rounded-lg border p-4 transition-colors ${offer.is_active ? getTypeColor(offer.type) : 'border-gray-500/30 bg-gray-500/10 opacity-60'
            }`}>
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${offer.type === 'order_bump' ? 'bg-blue-500/20 text-blue-400' :
                            offer.type === 'upsell' ? 'bg-green-500/20 text-green-400' :
                                'bg-orange-500/20 text-orange-400'
                            }`}>
                            {getTypeLabel(offer.type)}
                        </span>
                        {!offer.is_active && (
                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-500/20 text-gray-400">
                                Inativo
                            </span>
                        )}
                    </div>
                    <h4 className="text-gray-900 dark:text-white font-medium text-sm">{offer.title}</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{offer.product_name}</p>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={() => onToggleActive(offer.id)}
                        className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                        title={offer.is_active ? 'Desativar' : 'Ativar'}
                    >
                        {offer.is_active ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                    <button
                        onClick={() => onEdit(offer)}
                        className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                        title="Edit"
                    >
                        <Edit size={14} />
                    </button>
                    <button
                        onClick={() => onDelete(offer.id)}
                        className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                        title="Delete"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            {/* Description */}
            <p className="text-xs text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">
                {offer.description}
            </p>

            {/* Pricing */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    {offer.original_price > offer.offer_price && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 line-through">
                            {formatCurrency(offer.original_price, offer.currency)}
                        </span>
                    )}
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(offer.offer_price, offer.currency)}
                    </span>
                </div>
                {offer.discount_percentage && (
                    <span className="text-xs font-medium px-2 py-1 rounded bg-green-500/20 text-green-400">
                        -{offer.discount_percentage}%
                    </span>
                )}
            </div>

            {/* Button Text Preview */}
            <div className="bg-gray-50 dark:bg-[#0f1117] rounded border border-gray-200 dark:border-[#252941] p-2">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Texto do botão:</p>
                <p className="text-xs text-gray-900 dark:text-white font-medium">"{offer.button_text}"</p>
            </div>
        </div>
    )
}