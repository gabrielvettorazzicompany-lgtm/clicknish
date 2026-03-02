import React, { memo, useRef, useState, useEffect } from 'react'
import { ImageIcon, X } from 'lucide-react'
import { CustomBanner } from '../types'

interface CheckoutBannerProps {
    customBanner?: CustomBanner
    bannerSelected?: boolean
    onBannerClick?: () => void
    onBannerRemove?: () => void
    onBannerResize?: (height: number) => void
    onBannerUpload?: (url: string) => void
    onBannerFile?: (file: File) => void
    isPreview?: boolean
    // kept for compat but unused in simple mode
    isDragging?: boolean
    draggedComponentType?: string
    onBannerAdjust?: () => void
    onBannerImagePositionChange?: (position: { x: number; y: number }) => void
    onBannerImageScaleChange?: (scale: number) => void
    onUpdateBannerWidth?: (width: number) => void
    t?: any
}

const CheckoutBanner = memo(({
    customBanner,
    bannerSelected = false,
    onBannerClick,
    onBannerRemove,
    onBannerAdjust,
    onBannerResize,
    onBannerUpload, onBannerFile, onUpdateBannerWidth,
    isPreview = false,
}: CheckoutBannerProps) => {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [height, setHeight] = useState(customBanner?.customHeight || 250)
    const [currentWidth, setCurrentWidth] = useState(customBanner?.customWidth || 800)
    const [isResizingWidth, setIsResizingWidth] = useState(false)
    const [isResizingHeight, setIsResizingHeight] = useState(false)
    const startX = useRef(0)
    const startY = useRef(0)
    const startWidth = useRef(0)
    const startHeight = useRef(0)

    // sync height and width when customBanner changes externally
    useEffect(() => {
        setHeight(customBanner?.customHeight || 250)
        setCurrentWidth(customBanner?.customWidth || 800)
    }, [customBanner?.customHeight, customBanner?.customWidth])

    const handleWidthResizeMouseDown = (e: React.MouseEvent) => {
        if (!isPreview || !onUpdateBannerWidth) return
        e.preventDefault()
        e.stopPropagation()
        setIsResizingWidth(true)
        startX.current = e.clientX
        startWidth.current = currentWidth

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const deltaX = moveEvent.clientX - startX.current
            const newWidth = Math.max(300, Math.min(1200, startWidth.current + deltaX * 2))
            setCurrentWidth(newWidth)
        }

        const handleMouseUp = () => {
            setIsResizingWidth(false)
            onUpdateBannerWidth(currentWidth)
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
    }

    const handleHeightResizeMouseDown = (e: React.MouseEvent) => {
        if (!isPreview || !onBannerResize) return
        e.preventDefault()
        e.stopPropagation()
        setIsResizingHeight(true)
        startY.current = e.clientY
        startHeight.current = height

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const deltaY = moveEvent.clientY - startY.current
            const newHeight = Math.max(100, Math.min(600, startHeight.current + deltaY))
            setHeight(newHeight)
        }

        const handleMouseUp = () => {
            setIsResizingHeight(false)
            onBannerResize(height)
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (onBannerFile) {
            // Pai faz upload para o Storage e armazena a URL real (não base64)
            onBannerFile(file)
        } else if (onBannerUpload) {
            const reader = new FileReader()
            reader.onload = (ev) => onBannerUpload(ev.target?.result as string)
            reader.readAsDataURL(file)
        }
        e.target.value = ''
    }

    // ── Sem imagem: placeholder clicável ──
    if (!customBanner?.image) {
        if (!isPreview) return null
        return (
            <div className="w-full lg:max-w-7xl lg:mx-auto px-4 mt-6">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                <div
                    className="relative border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 hover:border-blue-400 hover:bg-blue-50/40 transition-all cursor-pointer group"
                    style={{ height: '180px' }}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 select-none">
                        <div className="w-12 h-12 rounded-full bg-white border border-gray-200 group-hover:border-blue-300 group-hover:bg-blue-50 flex items-center justify-center transition-all shadow-sm">
                            <ImageIcon size={20} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                        </div>
                        <p className="text-sm font-medium text-gray-500 group-hover:text-blue-600 transition-colors">Clique para adicionar banner</p>
                        <p className="text-xs text-gray-400">PNG, JPG, WebP — Recomendado: 1200×400px</p>
                    </div>
                </div>
            </div>
        )
    }

    // ── Com imagem ──
    // Sempre usa customWidth/customHeight se existir
    const effectiveWidth = customBanner?.customWidth || (isPreview ? currentWidth : undefined)
    const effectiveHeight = customBanner?.customHeight || height

    const bannerStyle = effectiveWidth
        ? { width: `${effectiveWidth}px`, maxWidth: '100%', height: `${effectiveHeight}px` }
        : { height: `${effectiveHeight}px` }
    return (
        <div className="w-full px-4 mt-6 flex justify-center">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            <div
                ref={containerRef}
                className={`relative select-none rounded-xl overflow-visible group ${!effectiveWidth ? 'w-full lg:max-w-7xl' : ''}`}
                style={bannerStyle}
            >
                {/* Imagem */}
                <div
                    className="absolute inset-0 rounded-xl overflow-hidden"
                    onClick={isPreview ? onBannerClick : undefined}
                    style={{ cursor: isPreview ? 'pointer' : 'default' }}
                >
                    <img
                        src={customBanner.image}
                        alt="Banner"
                        className="w-full h-full"
                        style={{ objectFit: 'cover', pointerEvents: 'none', userSelect: 'none' }}
                        draggable={false}
                    />
                </div>

                {/* Borda pontilhada + controles quando selecionado */}
                {bannerSelected && isPreview && (
                    <>
                        {/* Borda */}
                        <div className="absolute inset-0 rounded-xl border-2 border-dashed border-blue-500 pointer-events-none z-10" />

                        {/* Botões topo-direito */}
                        <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5">
                            {onBannerAdjust && (
                                <button
                                    className="px-2.5 py-1.5 bg-white/90 backdrop-blur-sm text-gray-700 text-[11px] font-medium rounded-lg shadow-md hover:bg-white border border-gray-200 transition-colors"
                                    onClick={(e) => { e.stopPropagation(); onBannerAdjust() }}
                                >
                                    Editar
                                </button>
                            )}
                            {onBannerRemove && (
                                <button
                                    className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 shadow-md transition-colors"
                                    onClick={(e) => { e.stopPropagation(); onBannerRemove() }}
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </>
                )}

                {/* Resize handles laterais (horizontal) - aparecem no hover */}
                {isPreview && onUpdateBannerWidth && (
                    <>
                        <div
                            onMouseDown={handleWidthResizeMouseDown}
                            className={`absolute -right-1 top-1/2 -translate-y-1/2 w-1.5 h-10 bg-blue-500 rounded-full cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity z-20 ${isResizingWidth ? 'opacity-100' : ''
                                }`}
                            title="Arrastar para redimensionar largura"
                            onClick={(e) => e.stopPropagation()}
                        />
                        <div
                            onMouseDown={handleWidthResizeMouseDown}
                            className={`absolute -left-1 top-1/2 -translate-y-1/2 w-1.5 h-10 bg-blue-500 rounded-full cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity z-20 ${isResizingWidth ? 'opacity-100' : ''
                                }`}
                            title="Arrastar para redimensionar largura"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </>
                )}

                {/* Resize handles verticais (altura) - aparecem no hover */}
                {isPreview && onBannerResize && (
                    <>
                        <div
                            onMouseDown={handleHeightResizeMouseDown}
                            className={`absolute -top-1 left-1/2 -translate-x-1/2 h-1.5 w-10 bg-blue-500 rounded-full cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity z-20 ${isResizingHeight ? 'opacity-100' : ''
                                }`}
                            title="Arrastar para redimensionar altura"
                            onClick={(e) => e.stopPropagation()}
                        />
                        <div
                            onMouseDown={handleHeightResizeMouseDown}
                            className={`absolute -bottom-1 left-1/2 -translate-x-1/2 h-1.5 w-10 bg-blue-500 rounded-full cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity z-20 ${isResizingHeight ? 'opacity-100' : ''
                                }`}
                            title="Arrastar para redimensionar altura"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </>
                )}
            </div>
        </div>
    )
})

CheckoutBanner.displayName = 'CheckoutBanner'
export default CheckoutBanner



