import type React from 'react'
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
    const borderType = bump.bump_border_type || 'none'
    const borderColor = bump.bump_border_color || '#22c55e'
    const bgColor = bump.bump_bg_color || '#ffffff'
    const bgGradient = bump.bump_bg_gradient || ''
    const showArrow = bump.bump_show_arrow || false
    const arrowColor = bump.bump_arrow_color || '#f97316'
    const textColor = bump.bump_text_color || '#111827'

    const borderStyle: React.CSSProperties =
        borderType === 'solid'
            ? { border: `3px solid ${borderColor}` }
            : borderType === 'dashed'
                ? { border: `3px dashed ${borderColor}` }
                : {}

    const dragBorderClass = isBeingDragged
        ? 'shadow-lg shadow-zinc-500/20 opacity-50 scale-95'
        : isDraggedOver
            ? 'shadow-lg shadow-zinc-500/30 scale-105'
            : ''

    const cardStyle: React.CSSProperties = {
        ...(bgGradient ? { background: bgGradient } : { backgroundColor: bgColor }),
        ...borderStyle,
        borderRadius: '12px',
        ...(borderType === 'none' ? { border: '1px solid #e5e7eb' } : {}),
    }

    return (
        <div
            draggable
            onDragStart={(e) => onDragStart(e, bump.id)}
            onDragOver={(e) => onDragOver(e, bump.id)}
            onDragLeave={onDragLeave}
            onDrop={(e) => onDrop(e, bump.id)}
            onDragEnd={onDragEnd}
            className={`p-3 transition-all cursor-move relative ${dragBorderClass}`}
            style={cardStyle}
        >
            {isDraggedOver && (
                <div className="absolute inset-0 bg-zinc-800/50 rounded-xl pointer-events-none" />
            )}

            <div className="flex items-start justify-between relative z-10">
                <div className="flex items-start gap-2 flex-1">
                    {/* Drag handle */}
                    <div className="flex flex-col items-center gap-1 pt-1">
                        <span className="text-xs font-mono px-1.5 py-0.5 rounded text-[10px] border"
                            style={{ color: textColor, borderColor: textColor + '44', backgroundColor: textColor + '18' }}>
                            {index + 1}
                        </span>
                        <GripVertical className="transition-colors cursor-grab active:cursor-grabbing" size={14}
                            style={{ color: textColor + '99' }} />
                    </div>

                    {/* Arrow */}
                    {showArrow && (
                        <div className="flex items-center self-center">
                            <svg width="28" height="18" viewBox="0 0 40 20" fill={arrowColor}>
                                <path d="M0,6 L26,6 L26,0 L40,10 L26,20 L26,14 L0,14 Z" />
                            </svg>
                        </div>
                    )}

                    {/* Imagem do produto */}
                    {(bump.offer_product_image || bump.product?.image_url) ? (
                        <img
                            src={bump.offer_product_image || bump.product?.image_url}
                            alt={bump.product?.name || 'Product'}
                            className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
                            style={{ border: `1px solid ${textColor}33` }}
                        />
                    ) : (
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: textColor + '18' }}>
                            <Package size={16} style={{ color: textColor + 'aa' }} />
                        </div>
                    )}

                    <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm" style={{ color: textColor }}>{bump.product?.name}</h4>
                        <p className="text-xs mt-0.5" style={{ color: textColor + 'bb' }}>
                            {bump.button_text}
                        </p>
                        {bump.product_description && (
                            <p className="text-xs mt-0.5 line-clamp-2" style={{ color: textColor + '99' }}>
                                {bump.product_description}
                            </p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5">
                            {bump.discount_percentage && bump.discount_percentage > 0 ? (
                                <>
                                    <span className="text-xs line-through" style={{ color: textColor + '88' }}>
                                        {formatPrice(bump.original_price, bump.currency)}
                                    </span>
                                    <span className="font-medium text-sm" style={{ color: textColor }}>
                                        {formatPrice(bump.offer_price, bump.currency)}
                                    </span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded"
                                        style={{ backgroundColor: textColor + '18', color: textColor }}>
                                        {bump.discount_percentage}% OFF
                                    </span>
                                </>
                            ) : (
                                <span className="font-medium text-sm" style={{ color: textColor }}>
                                    {formatPrice(bump.offer_price, bump.currency)}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => onEdit(bump)}
                        className="p-1.5 transition-colors hover:opacity-70"
                        style={{ color: textColor + 'cc' }}
                        title="Editar"
                    >
                        <Pencil size={16} />
                    </button>
                    <button
                        onClick={() => onDelete(bump.id)}
                        className="p-1.5 transition-colors hover:text-red-400"
                        style={{ color: textColor + 'cc' }}
                        title="Remove"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>
        </div>
    )
}
