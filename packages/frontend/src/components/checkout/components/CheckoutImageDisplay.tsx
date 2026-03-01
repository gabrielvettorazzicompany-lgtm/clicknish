import React, { memo, useState, useRef, useEffect } from 'react'
import type { CheckoutImageBlock, ImageBlockSlot } from '../types'

interface CheckoutImageDisplayProps {
    imageBlocks?: CheckoutImageBlock[]
    slot: ImageBlockSlot
    className?: string
    isPreview?: boolean
    onPreviewClick?: () => void
    onUpdateImageBlock?: (id: string, updates: Partial<CheckoutImageBlock>) => void
}

const widthClassMap: Record<NonNullable<CheckoutImageBlock['width']>, string> = {
    full: 'w-full',
    large: 'max-w-2xl mx-auto w-full',
    medium: 'max-w-md mx-auto w-full',
    small: 'max-w-xs mx-auto w-full',
}

const CheckoutImageDisplay = memo(({ imageBlocks, slot, className = '', isPreview = false, onUpdateImageBlock }: CheckoutImageDisplayProps) => {
    const blocks = imageBlocks?.filter(b => b.slot === slot && b.url)
    if (!blocks || blocks.length === 0) return null

    return (
        <>
            {blocks.map(block => {
                return (
                    <ImageBlock
                        key={block.id}
                        block={block}
                        className={className}
                        isPreview={isPreview}
                        onUpdateImageBlock={onUpdateImageBlock}
                    />
                )
            })}
        </>
    )
})

interface ImageBlockProps {
    block: CheckoutImageBlock
    className: string
    isPreview: boolean
    onUpdateImageBlock?: (id: string, updates: Partial<CheckoutImageBlock>) => void
}

const ImageBlock = ({ block, className, isPreview, onUpdateImageBlock }: ImageBlockProps) => {
    const [isResizing, setIsResizing] = useState(false)
    const [currentWidth, setCurrentWidth] = useState(block.customWidth || 400)
    const containerRef = useRef<HTMLDivElement>(null)
    const startX = useRef(0)
    const startWidth = useRef(0)

    // Sync width when customWidth changes externally
    useEffect(() => {
        setCurrentWidth(block.customWidth || 400)
    }, [block.customWidth])

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!isPreview || !onUpdateImageBlock) return
        e.preventDefault()
        e.stopPropagation()
        setIsResizing(true)
        startX.current = e.clientX
        startWidth.current = currentWidth

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const deltaX = moveEvent.clientX - startX.current
            const newWidth = Math.max(100, Math.min(800, startWidth.current + deltaX * 2))
            setCurrentWidth(newWidth)
        }

        const handleMouseUp = () => {
            setIsResizing(false)
            onUpdateImageBlock(block.id, { customWidth: currentWidth })
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
    }

    const widthClass = widthClassMap[block.width ?? 'full']
    // Sempre usa customWidth se existir
    const effectiveWidth = block.customWidth || (isPreview ? currentWidth : undefined)
    const imgStyle = effectiveWidth ? { width: `${effectiveWidth}px`, maxWidth: '100%' } : {}

    return (
        <div key={block.id} className={`py-3 px-4 ${className} flex justify-center`}>
            <div
                ref={containerRef}
                className={`relative ${!effectiveWidth ? widthClass : ''} group`}
                style={imgStyle}
            >
                <img
                    src={block.url}
                    alt=""
                    className="w-full rounded-lg object-contain"
                    loading="lazy"
                />
                {isPreview && onUpdateImageBlock && (
                    <>
                        {/* Resize handles */}
                        <div
                            onMouseDown={handleMouseDown}
                            className={`absolute -right-1 top-1/2 -translate-y-1/2 w-1.5 h-10 bg-blue-500 rounded-full cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity ${isResizing ? 'opacity-100' : ''
                                }`}
                            title="Arrastar para redimensionar"
                        />
                        <div
                            onMouseDown={handleMouseDown}
                            className={`absolute -left-1 top-1/2 -translate-y-1/2 w-1.5 h-10 bg-blue-500 rounded-full cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity ${isResizing ? 'opacity-100' : ''
                                }`}
                            title="Arrastar para redimensionar"
                        />
                    </>
                )}
            </div>
        </div>
    )
}

CheckoutImageDisplay.displayName = 'CheckoutImageDisplay'

export default CheckoutImageDisplay
