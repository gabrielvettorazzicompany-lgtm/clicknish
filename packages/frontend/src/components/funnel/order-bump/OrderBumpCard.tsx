import { Package, Trash2, Pencil, GripVertical } from 'lucide-react'
import type { OrderBump } from './types'

const formatPrice = (value: number, currency?: string) => {
    const cur = currency || 'USD'
    const locale = cur === 'CHF' ? 'de-CH' : cur === 'BRL' ? 'pt-BR' : 'en-US'
    return new Intl.NumberFormat(locale, { style: 'currency', currency: cur }).format(value)
}

interface OrderBumpCardProps {
    bump: OrderBump
    index: number
    isBeingDragged: boolean
    isDraggedOver: boolean
    onDragStart: (e: React.DragEvent, bumpId: string) => void
    onDragOver: (e: React.DragEvent, bumpId: string) => void
    onDragLeave: () => void
    onDrop: (e: React.DragEvent, targetId: string) => void
    onDragEnd: () => void
    onEdit: (bump: OrderBump) => void
    onDelete: (id: string) => void
}

export default function OrderBumpCard({
    bump,
    index,
    isBeingDragged,
    isDraggedOver,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
    onDragEnd,
    onEdit,
    onDelete
}: OrderBumpCardProps) {
    return (
        <div
            draggable
            onDragStart={(e) => onDragStart(e, bump.id)}
            onDragOver={(e) => onDragOver(e, bump.id)}
            onDragLeave={onDragLeave}
            onDrop={(e) => onDrop(e, bump.id)}
            onDragEnd={onDragEnd}
            className={`p-3 bg-[#0f1117] rounded-lg border transition-all cursor-move relative ${isBeingDragged
                ? 'border-zinc-500 shadow-lg shadow-zinc-500/20 opacity-50 scale-95'
                : isDraggedOver
                    ? 'border-zinc-500 shadow-lg shadow-zinc-500/30 scale-105'
                    : 'border-zinc-800 hover:border-zinc-600'
                }`}
        >
            {isDraggedOver && (
                <div className="absolute inset-0 bg-zinc-800/50 rounded-lg pointer-events-none" />
            )}

            <div className="flex items-start justify-between relative z-10">
                <div className="flex items-start gap-2 flex-1">
                    {/* Drag handle */}
                    <div className="flex flex-col items-center gap-1 pt-1">
                        <span className="text-xs font-mono text-zinc-400 bg-zinc-900 px-1.5 py-0.5 rounded text-[10px] border border-zinc-700">
                            {index + 1}
                        </span>
                        <GripVertical className="text-zinc-600 hover:text-zinc-400 transition-colors cursor-grab active:cursor-grabbing" size={14} />
                    </div>

                    {/* Imagem do produto */}
                    {(bump.offer_product_image || bump.product?.image_url) ? (
                        <img
                            src={bump.offer_product_image || bump.product?.image_url}
                            alt={bump.product?.name || 'Product'}
                            className="w-8 h-8 rounded-lg object-cover flex-shrink-0 border border-zinc-700"
                        />
                    ) : (
                        <div className="w-8 h-8 bg-zinc-800 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Package className="text-zinc-400" size={16} />
                        </div>
                    )}

                    <div className="flex-1 min-w-0">
                        <h4 className="text-white font-medium text-sm">{bump.product?.name}</h4>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {bump.button_text}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5">
                            {bump.discount_percentage && bump.discount_percentage > 0 ? (
                                <>
                                    <span className="text-xs text-gray-400 line-through">
                                        {formatPrice(bump.original_price, bump.currency)}
                                    </span>
                                    <span className="text-white font-medium text-sm">
                                        {formatPrice(bump.offer_price, bump.currency)}
                                    </span>
                                    <span className="text-[10px] bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded">
                                        {bump.discount_percentage}% OFF
                                    </span>
                                </>
                            ) : (
                                <span className="text-white font-medium text-sm">
                                    {formatPrice(bump.offer_price, bump.currency)}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => onEdit(bump)}
                        className="p-1.5 text-zinc-400 hover:text-white transition-colors"
                        title="Editar"
                    >
                        <Pencil size={16} />
                    </button>
                    <button
                        onClick={() => onDelete(bump.id)}
                        className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
                        title="Remove"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>
        </div>
    )
}
