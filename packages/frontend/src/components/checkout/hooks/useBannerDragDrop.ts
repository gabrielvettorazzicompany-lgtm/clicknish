import { useState, useRef, useEffect, useCallback } from 'react'

interface BannerPosition {
    x: number
    y: number
}

interface UseBannerDragDropProps {
    customBanner?: any
    onBannerImagePositionChange?: (position: BannerPosition) => void
    onBannerImageScaleChange?: (scale: number) => void
    onBannerResize?: (height: number) => void
    bannerSelected?: boolean
}

export const useBannerDragDrop = ({
    customBanner,
    onBannerImagePositionChange,
    onBannerImageScaleChange,
    onBannerResize,
    bannerSelected
}: UseBannerDragDropProps) => {
    const [isDraggingImage, setIsDraggingImage] = useState(false)
    const [isResizingImage, setIsResizingImage] = useState(false)
    const [isResizingHeight, setIsResizingHeight] = useState(false)

    const bannerRef = useRef<HTMLDivElement>(null)
    const dragStartPosRef = useRef({ x: 0, y: 0 })
    const initialPositionRef = useRef({ x: 50, y: 50 })
    const initialScaleRef = useRef(1)
    const initialHeightRef = useRef(250)
    const resizeStartRef = useRef({ x: 0, y: 0 })

    const handleImageMouseDown = useCallback((e: React.MouseEvent) => {
        if (!bannerSelected || !onBannerImagePositionChange) return
        const target = e.target as HTMLElement
        if (target.tagName === 'BUTTON' || target.closest('button') || target.classList.contains('resize-handle')) return

        e.preventDefault()
        e.stopPropagation()
        setIsDraggingImage(true)
        dragStartPosRef.current = { x: e.clientX, y: e.clientY }
        initialPositionRef.current = {
            x: customBanner.imagePosition?.x || 50,
            y: customBanner.imagePosition?.y || 50
        }
    }, [bannerSelected, onBannerImagePositionChange, customBanner])

    const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsResizingImage(true)
        resizeStartRef.current = { x: e.clientX, y: e.clientY }
        initialScaleRef.current = customBanner.imageScale || 1
    }, [customBanner])

    const handleBottomHandleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsResizingHeight(true)
        resizeStartRef.current = { x: e.clientX, y: e.clientY }
        initialHeightRef.current = customBanner?.customHeight || 250
    }, [customBanner])

    // Mouse move and up handlers
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDraggingImage && onBannerImagePositionChange && customBanner) {
                const deltaX = e.clientX - dragStartPosRef.current.x
                const deltaY = e.clientY - dragStartPosRef.current.y

                const bannerWidth = bannerRef.current?.offsetWidth || 500
                const bannerHeight = bannerRef.current?.offsetHeight || 300

                const deltaXPercent = (deltaX / bannerWidth) * 100 * 0.5
                const deltaYPercent = (deltaY / bannerHeight) * 100 * 0.5

                const newX = Math.max(0, Math.min(100, initialPositionRef.current.x - deltaXPercent))
                const newY = Math.max(0, Math.min(100, initialPositionRef.current.y - deltaYPercent))

                onBannerImagePositionChange({ x: newX, y: newY })
            }

            if (isResizingImage && onBannerImageScaleChange) {
                const deltaY = e.clientY - resizeStartRef.current.y
                const bannerHeight = bannerRef.current?.offsetHeight || 300

                const scaleChange = -(deltaY / bannerHeight) * 2
                const newScale = Math.max(0.5, Math.min(2, initialScaleRef.current + scaleChange))

                onBannerImageScaleChange(newScale)
            }

            if (isResizingHeight && onBannerResize) {
                const deltaY = e.clientY - resizeStartRef.current.y
                const newHeight = Math.max(80, Math.min(600, initialHeightRef.current + deltaY))
                onBannerResize(newHeight)
            }
        }

        const handleMouseUp = () => {
            setIsDraggingImage(false)
            setIsResizingImage(false)
            setIsResizingHeight(false)
        }

        if (isDraggingImage || isResizingImage || isResizingHeight) {
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)
            document.body.style.cursor = isResizingHeight ? 'ns-resize' : isResizingImage ? 'nwse-resize' : 'grabbing'
            document.body.style.userSelect = 'none'
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
        }
    }, [isDraggingImage, isResizingImage, isResizingHeight, onBannerImagePositionChange, onBannerImageScaleChange, onBannerResize, customBanner])

    return {
        bannerRef,
        isDraggingImage,
        isResizingImage,
        isResizingHeight,
        handleImageMouseDown,
        handleResizeMouseDown,
        handleBottomHandleMouseDown
    }
}