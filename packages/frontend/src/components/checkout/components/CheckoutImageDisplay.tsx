import React, { memo, useState, useRef, useEffect } from 'react'
import { X } from 'lucide-react'
import type { CheckoutImageBlock, ImageBlockSlot } from '../types'

interface CheckoutImageDisplayProps {
    imageBlocks?: CheckoutImageBlock[]
    slot: ImageBlockSlot
    className?: string
    isPreview?: boolean
    onPreviewClick?: () => void
    onUpdateImageBlock?: (id: string, updates: Partial<CheckoutImageBlock>) => void
    onDeleteImageBlock?: (id: string) => void
}

const widthClassMap: Record<NonNullable<CheckoutImageBlock['width']>, string> = {
    full: 'w-full',
    xlarge: 'max-w-6xl mx-auto w-full',
    large: 'max-w-2xl mx-auto w-full',
    medium: 'max-w-md mx-auto w-full',
    small: 'max-w-xs mx-auto w-full',
}

const CheckoutImageDisplay = memo(({ imageBlocks, slot, className = '', isPreview = false, onUpdateImageBlock, onDeleteImageBlock }: CheckoutImageDisplayProps) => {
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
                        onDeleteImageBlock={onDeleteImageBlock}
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
    onDeleteImageBlock?: (id: string) => void
}

const ImageBlock = ({ block, className, isPreview, onUpdateImageBlock, onDeleteImageBlock }: ImageBlockProps) => {
    const [isResizingW, setIsResizingW] = useState(false)
    const [isResizingHBottom, setIsResizingHBottom] = useState(false)
    const [isResizingHTop, setIsResizingHTop] = useState(false)
    const [currentWidth, setCurrentWidth] = useState(block.customWidth || 400)
    const [currentHeight, setCurrentHeight] = useState(block.customHeight || 0)
    const containerRef = useRef<HTMLDivElement>(null)
    const startX = useRef(0)
    const startY = useRef(0)
    const startWidth = useRef(0)
    const startHeight = useRef(0)

    // Sync when props change externally
    useEffect(() => { setCurrentWidth(block.customWidth || 400) }, [block.customWidth])
    useEffect(() => { setCurrentHeight(block.customHeight || 0) }, [block.customHeight])

    // Width resize — same pattern as banner
    useEffect(() => {
        if (!isResizingW || !onUpdateImageBlock) return

        const handleMouseMove = (e: MouseEvent) => {
            const deltaX = e.clientX - startX.current
            const newWidth = Math.max(100, Math.min(800, startWidth.current + deltaX * 2))
            setCurrentWidth(newWidth)
        }

        const handleMouseUp = (e: MouseEvent) => {
            const deltaX = e.clientX - startX.current
            const finalWidth = Math.max(100, Math.min(800, startWidth.current + deltaX * 2))
            setIsResizingW(false)
            onUpdateImageBlock(block.id, { customWidth: finalWidth })
        }

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = 'ew-resize'
        document.body.style.userSelect = 'none'

        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
        }
    }, [isResizingW, block.id, onUpdateImageBlock])

    // Height resize bottom — same pattern as banner
    useEffect(() => {
        if (!isResizingHBottom || !onUpdateImageBlock) return

        const handleMouseMove = (e: MouseEvent) => {
            const deltaY = e.clientY - startY.current
            const newHeight = Math.max(40, Math.min(800, startHeight.current + deltaY))
            setCurrentHeight(newHeight)
        }

        const handleMouseUp = (e: MouseEvent) => {
            const deltaY = e.clientY - startY.current
            const finalHeight = Math.max(40, Math.min(800, startHeight.current + deltaY))
            setIsResizingHBottom(false)
            onUpdateImageBlock(block.id, { customHeight: finalHeight })
        }

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = 'ns-resize'
        document.body.style.userSelect = 'none'

        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
        }
    }, [isResizingHBottom, block.id, onUpdateImageBlock])

    // Height resize top (inverted)
    useEffect(() => {
        if (!isResizingHTop || !onUpdateImageBlock) return

        const handleMouseMove = (e: MouseEvent) => {
            const deltaY = e.clientY - startY.current
            const newHeight = Math.max(40, Math.min(800, startHeight.current - deltaY))
            setCurrentHeight(newHeight)
        }

        const handleMouseUp = (e: MouseEvent) => {
            const deltaY = e.clientY - startY.current
            const finalHeight = Math.max(40, Math.min(800, startHeight.current - deltaY))
            setIsResizingHTop(false)
            onUpdateImageBlock(block.id, { customHeight: finalHeight })
        }

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = 'ns-resize'
        document.body.style.userSelect = 'none'

        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
        }
    }, [isResizingHTop, block.id, onUpdateImageBlock])

    const handleWidthMouseDown = (e: React.MouseEvent) => {
        if (!isPreview || !onUpdateImageBlock) return
        e.preventDefault()
        e.stopPropagation()
        startX.current = e.clientX
        startWidth.current = currentWidth
        setIsResizingW(true)
    }

    const handleHeightBottomMouseDown = (e: React.MouseEvent) => {
        if (!isPreview || !onUpdateImageBlock) return
        e.preventDefault()
        e.stopPropagation()
        startY.current = e.clientY
        startHeight.current = currentHeight || (containerRef.current?.offsetHeight || 200)
        setIsResizingHBottom(true)
    }

    const handleHeightTopMouseDown = (e: React.MouseEvent) => {
        if (!isPreview || !onUpdateImageBlock) return
        e.preventDefault()
        e.stopPropagation()
        startY.current = e.clientY
        startHeight.current = currentHeight || (containerRef.current?.offsetHeight || 200)
        setIsResizingHTop(true)
    }

    const isResizingH = isResizingHBottom || isResizingHTop
    const widthClass = widthClassMap[block.width ?? 'full']
    // Durante resize usa o state local; caso contrário usa o valor salvo no block
    const effectiveWidth = isResizingW ? currentWidth : (block.customWidth || (isPreview ? currentWidth : undefined))
    const effectiveHeight = isResizingH ? currentHeight : (block.customHeight || (isPreview && currentHeight > 0 ? currentHeight : undefined))
    const imgStyle: React.CSSProperties = {
        ...(effectiveWidth ? { width: `${effectiveWidth}px`, maxWidth: '100%' } : {}),
        ...(effectiveHeight ? { height: `${effectiveHeight}px` } : {}),
    }

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
                    className={`w-full rounded-lg ${effectiveHeight ? 'h-full object-cover' : 'object-contain'}`}
                    loading="lazy"
                />
                {isPreview && onDeleteImageBlock && (
                    <button
                        className="absolute top-1 right-1 z-10 p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 shadow-md transition-colors opacity-0 group-hover:opacity-100"
                        onClick={(e) => { e.stopPropagation(); onDeleteImageBlock(block.id) }}
                        title="Remover imagem"
                    >
                        <X size={14} />
                    </button>
                )}
                {isPreview && onUpdateImageBlock && (
                    <>
                        {/* Horizontal resize handles (left/right) */}
                        <div
                            onMouseDown={handleWidthMouseDown}
                            className={`absolute -right-1 top-1/2 -translate-y-1/2 w-1.5 h-10 bg-blue-500 rounded-full cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity ${isResizingW ? 'opacity-100' : ''}`}
                            title="Arrastar para redimensionar largura"
                        />
                        <div
                            onMouseDown={handleWidthMouseDown}
                            className={`absolute -left-1 top-1/2 -translate-y-1/2 w-1.5 h-10 bg-blue-500 rounded-full cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity ${isResizingW ? 'opacity-100' : ''}`}
                            title="Arrastar para redimensionar largura"
                        />
                        {/* Vertical resize handle (bottom) */}
                        <div
                            onMouseDown={handleHeightBottomMouseDown}
                            className={`absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1 h-1.5 w-10 bg-blue-500 rounded-full cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity ${isResizingH ? 'opacity-100' : ''}`}
                            title="Arrastar para redimensionar altura"
                        />
                        {/* Vertical resize handle (top) */}
                        <div
                            onMouseDown={handleHeightTopMouseDown}
                            className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 h-1.5 w-10 bg-blue-500 rounded-full cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity ${isResizingH ? 'opacity-100' : ''}`}
                            title="Arrastar para redimensionar altura"
                        />
                    </>
                )}
            </div>
        </div>
    )
}

CheckoutImageDisplay.displayName = 'CheckoutImageDisplay'

export default CheckoutImageDisplay
