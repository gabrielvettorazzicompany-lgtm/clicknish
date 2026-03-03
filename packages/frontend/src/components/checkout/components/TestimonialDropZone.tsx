import React, { memo, useState, useCallback } from 'react'
import { MessageSquare } from 'lucide-react'
import type { TestimonialSlot } from '../types'

interface TestimonialDropZoneProps {
    slot: TestimonialSlot
    isPreview?: boolean
    isDragging?: boolean
    draggedComponentType?: string
}

const slotLabels: Record<TestimonialSlot, string> = {
    'below_button': 'Abaixo do botão de compra',
}

const TestimonialDropZone = memo(({
    slot,
    isPreview = false,
    isDragging = false,
    draggedComponentType
}: TestimonialDropZoneProps) => {
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

    if (!isPreview || !isDragging || draggedComponentType !== 'testimonials') {
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
            <div className={`min-h-[80px] border-2 border-dashed rounded-lg transition-all duration-150 flex items-center justify-center ${isHovered
                    ? 'border-blue-500 bg-blue-500/20'
                    : 'border-blue-400/40 bg-blue-400/5'
                }`}>
                {isHovered && (
                    <div className="flex items-center gap-2 text-blue-500">
                        <MessageSquare size={16} />
                        <span className="text-xs font-medium">{slotLabels[slot]}</span>
                    </div>
                )}
            </div>
        </div>
    )
})

TestimonialDropZone.displayName = 'TestimonialDropZone'

export default TestimonialDropZone
