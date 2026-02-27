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
    isPreview?: boolean
    // kept for compat but unused in simple mode
    isDragging?: boolean
    draggedComponentType?: string
    onBannerAdjust?: () => void
    onBannerImagePositionChange?: (position: { x: number; y: number }) => void
    onBannerImageScaleChange?: (scale: number) => void
    t?: any
}

const CheckoutBanner = memo(({
    customBanner,
    bannerSelected = false,
    onBannerClick,
    onBannerRemove,
    onBannerAdjust,
    onBannerResize,
    onBannerUpload,
    isPreview = false,
}: CheckoutBannerProps) => {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [height, setHeight] = useState(customBanner?.customHeight || 250)
    const isResizing = useRef(false)
    const startY = useRef(0)
    const startHeight = useRef(0)

    // sync height when customBanner changes externally
    useEffect(() => {
        setHeight(customBanner?.customHeight || 250)
    }, [customBanner?.customHeight])

    const handleResizeMouseDown = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        isResizing.current = true
        startY.current = e.clientY
        startHeight.current = height
        document.body.style.cursor = 'ns-resize'
        document.body.style.userSelect = 'none'
    }

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (!isResizing.current) return
            const delta = e.clientY - startY.current
            const newHeight = Math.max(80, Math.min(600, startHeight.current + delta))
            setHeight(newHeight)
            onBannerResize?.(newHeight)
        }
        const onUp = () => {
            isResizing.current = false
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
        }
        document.addEventListener('mousemove', onMove)
        document.addEventListener('mouseup', onUp)
        return () => {
            document.removeEventListener('mousemove', onMove)
            document.removeEventListener('mouseup', onUp)
        }
    }, [onBannerResize])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !onBannerUpload) return
        const reader = new FileReader()
        reader.onload = (ev) => onBannerUpload(ev.target?.result as string)
        reader.readAsDataURL(file)
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
    return (
        <div className="w-full lg:max-w-7xl lg:mx-auto px-4 mt-6">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            <div
                ref={containerRef}
                className="relative select-none rounded-xl overflow-visible"
                style={{ height: `${height}px` }}
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

                        {/* Handle de resize no canto inferior-direito */}
                        <div
                            className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 z-20 w-5 h-5 bg-white border-2 border-blue-500 rounded cursor-ns-resize shadow-md hover:bg-blue-500 transition-colors"
                            onMouseDown={handleResizeMouseDown}
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



