import React, { memo } from 'react'
import { ImageIcon, X } from 'lucide-react'
import { useBannerDragDrop } from '../hooks/useBannerDragDrop'
import { CustomBanner } from '../types'

interface CheckoutBannerProps {
    customBanner?: CustomBanner
    bannerSelected?: boolean
    isDragging?: boolean
    draggedComponentType?: string
    onBannerClick?: () => void
    onBannerRemove?: () => void
    onBannerImagePositionChange?: (position: { x: number; y: number }) => void
    onBannerImageScaleChange?: (scale: number) => void
    isPreview?: boolean
    t?: any
}

const CheckoutBanner = memo(({
    customBanner,
    bannerSelected = false,
    isDragging = false,
    draggedComponentType,
    onBannerClick,
    onBannerRemove,
    onBannerImagePositionChange,
    onBannerImageScaleChange,
    isPreview = false,
    t
}: CheckoutBannerProps) => {
    const {
        bannerRef,
        isDraggingImage,
        isResizingImage,
        handleImageMouseDown,
        handleResizeMouseDown
    } = useBannerDragDrop({
        customBanner,
        onBannerImagePositionChange,
        onBannerImageScaleChange,
        bannerSelected
    })

    // Banner Drop Zone
    if (isPreview && isDragging && draggedComponentType === 'image' &&
        (!customBanner || (!customBanner.image && !customBanner.title && !customBanner.subtitle && !customBanner.description))) {
        return (
            <div
                className="w-full lg:max-w-7xl lg:mx-auto px-4 lg:px-4 mt-6 lg:mt-8"
                data-drop-zone="banner"
            >
                <div className="min-h-[200px] border border-dashed border-blue-500 bg-blue-500/10 rounded-lg flex items-center justify-center transition-all">
                    <div className="text-center text-gray-500">
                        <ImageIcon size={32} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm font-medium">{t?.('checkout_pages.drop_here_banner') || 'Drop banner here'}</p>
                    </div>
                </div>
            </div>
        )
    }

    // Custom Banner
    if (!customBanner?.image) return null

    return (
        <div className="w-full lg:max-w-7xl lg:mx-auto px-4 lg:px-4 mt-6 lg:mt-8">
            <div
                ref={bannerRef}
                className="relative"
                style={{
                    height: `${customBanner.customHeight || 250}px`
                }}
            >
                <div
                    className={`absolute inset-0 rounded-lg overflow-hidden bg-white transition-all duration-200 ${isDragging ? 'ring-4 ring-teal-400 ring-opacity-75' : ''
                        }`}
                    onClick={onBannerClick}
                    style={{
                        backgroundColor: '#ffffff',
                        cursor: bannerSelected ? (isDraggingImage ? 'grabbing' : 'grab') : 'default'
                    }}
                    onMouseDown={handleImageMouseDown}
                >
                    <img
                        src={customBanner.image}
                        alt="Banner"
                        className="w-full h-full"
                        fetchPriority="high"
                        decoding="async"
                        style={{
                            objectFit: 'cover',
                            objectPosition: `${customBanner.imagePosition?.x || 50}% ${customBanner.imagePosition?.y || 50}%`,
                            transform: `scale(${customBanner.imageScale || 1})`,
                            pointerEvents: 'none',
                            userSelect: 'none'
                        }}
                        draggable={false}
                    />

                    {/* Contorno pontilhado */}
                    {bannerSelected && onBannerImageScaleChange && (
                        <div
                            className="absolute inset-0 border-2 border-dashed border-blue-500 rounded-lg pointer-events-none"
                            style={{ zIndex: 50 }}
                        />
                    )}

                    {/* Botão de remover */}
                    {bannerSelected && onBannerRemove && (
                        <div className="absolute top-3 right-3 flex items-center gap-2" style={{ zIndex: 70 }}>
                            <button
                                className="w-8 h-8 flex items-center justify-center bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-lg shadow-black/20"
                                onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    onBannerRemove()
                                }}
                            >
                                <X size={16} />
                            </button>
                        </div>
                    )}

                    {/* Drag Overlay */}
                    {isDragging && (
                        <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center z-50 pointer-events-none">
                            <div className="bg-blue-500 text-white px-6 py-3 rounded-lg shadow-xl shadow-black/10">
                                <p className="text-sm font-medium">{t?.('checkout_pages.drop_here_image') || 'Drop image here'}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Resize Handles */}
                {bannerSelected && onBannerImageScaleChange && (
                    <>
                        {Array.from({ length: 8 }, (_, i) => {
                            const positions = [
                                { top: 0, left: 0, transform: 'translate(-50%, -50%)', cursor: 'nwse-resize' },
                                { top: 0, right: 0, transform: 'translate(50%, -50%)', cursor: 'nesw-resize' },
                                { bottom: 0, left: 0, transform: 'translate(-50%, 50%)', cursor: 'nesw-resize' },
                                { bottom: 0, right: 0, transform: 'translate(50%, 50%)', cursor: 'nwse-resize' },
                                { top: 0, left: '50%', transform: 'translate(-50%, -50%)', cursor: 'ns-resize' },
                                { bottom: 0, left: '50%', transform: 'translate(-50%, 50%)', cursor: 'ns-resize' },
                                { left: 0, top: '50%', transform: 'translate(-50%, -50%)', cursor: 'ew-resize' },
                                { right: 0, top: '50%', transform: 'translate(50%, -50%)', cursor: 'ew-resize' },
                            ]

                            return (
                                <div
                                    key={i}
                                    className={`resize-handle absolute w-4 h-4 bg-white border-2 border-blue-500 rounded-sm cursor-${positions[i].cursor.replace('-resize', '-resize')} hover:scale-125 transition-transform shadow-lg`}
                                    style={{ zIndex: 60, ...positions[i] }}
                                    onMouseDown={handleResizeMouseDown}
                                />
                            )
                        })}
                    </>
                )}
            </div>
        </div>
    )
})

CheckoutBanner.displayName = 'CheckoutBanner'

export default CheckoutBanner