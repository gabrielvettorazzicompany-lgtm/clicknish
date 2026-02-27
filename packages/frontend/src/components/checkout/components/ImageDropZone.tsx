import React, { memo } from 'react'
import { Image as ImageIcon } from 'lucide-react'
import type { ImageBlockSlot } from '../types'

interface ImageDropZoneProps {
    slot: ImageBlockSlot
    isPreview?: boolean
    isDragging?: boolean
    draggedComponentType?: string
    label?: string
}

const slotLabels: Record<ImageBlockSlot, string> = {
    'below_payment_methods': 'Abaixo dos métodos de pagamento',
    'above_button': 'Acima do botão de compra',
    'below_button': 'Abaixo do botão de compra',
    'above_testimonials': 'Acima dos depoimentos',
    'between_testimonials': 'Entre os depoimentos',
    'below_testimonials': 'Abaixo dos depoimentos',
    'below_seals': 'Abaixo dos selos'
}

const ImageDropZone = memo(({
    slot,
    isPreview = false,
    isDragging = false,
    draggedComponentType,
    label
}: ImageDropZoneProps) => {
    if (!isPreview || !isDragging || draggedComponentType !== 'image') {
        return null
    }

    return (
        <div
            className="w-full px-4 py-2"
            data-drop-zone={slot}
        >
            <div className="min-h-[60px] border-2 border-dashed border-blue-500 bg-blue-500/10 rounded-lg flex items-center justify-center transition-all hover:bg-blue-500/20">
                <div className="text-center text-gray-600">
                    <ImageIcon size={20} className="mx-auto mb-1 opacity-50" />
                    <p className="text-xs font-medium">{label || slotLabels[slot]}</p>
                </div>
            </div>
        </div>
    )
})

ImageDropZone.displayName = 'ImageDropZone'

export default ImageDropZone
