import React, { memo, useState, useCallback } from 'react'
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
    const [isHovered, setIsHovered] = useState(false)

    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsHovered(true)
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        // só limpa se saiu do elemento raiz (não de um filho)
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setIsHovered(false)
        }
    }, [])

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
    }, [])

    if (!isPreview || !isDragging || draggedComponentType !== 'image') {
        return null
    }

    return (
        <div
            className="w-full px-4 py-2"
            data-drop-zone={slot}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
        >
            <div className={`min-h-[60px] border-2 border-dashed rounded-lg transition-all duration-150 ${isHovered
                    ? 'border-blue-500 bg-blue-500/20'
                    : 'border-transparent bg-transparent'
                }`}>
            </div>
        </div>
    )
})

ImageDropZone.displayName = 'ImageDropZone'

export default ImageDropZone
