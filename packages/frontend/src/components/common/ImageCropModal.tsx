import { useRef, useCallback, useEffect } from 'react'
import { X } from 'lucide-react'
import { useI18n } from '@/i18n'

interface ImageCropModalProps {
    isOpen: boolean
    onClose: () => void
    imagePreview: string
    cropScale: number
    setCropScale: (scale: number) => void
    cropPosition: { x: number; y: number }
    setCropPosition: (position: { x: number; y: number }) => void
    isDragging: boolean
    setIsDragging: (dragging: boolean) => void
    dragStart: { x: number; y: number }
    setDragStart: (start: { x: number; y: number }) => void
    onCropComplete: () => void
    canvasRef: React.RefObject<HTMLCanvasElement>
    imageRef: React.RefObject<HTMLImageElement>
    cropAreaRef: React.RefObject<HTMLDivElement>
    aspectRatio?: 'square' | '16:9'
    title?: string
}

export default function ImageCropModal({
    isOpen,
    onClose,
    imagePreview,
    cropScale,
    setCropScale,
    cropPosition,
    setCropPosition,
    isDragging,
    setIsDragging,
    dragStart,
    setDragStart,
    onCropComplete,
    canvasRef,
    imageRef,
    cropAreaRef,
    aspectRatio = 'square',
    title = 'Adjust Image'
}: ImageCropModalProps) {
    const { t } = useI18n()
    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault()
        setIsDragging(true)
        setDragStart({ x: e.clientX - cropPosition.x, y: e.clientY - cropPosition.y })
    }

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (isDragging && cropAreaRef.current && imageRef.current) {
            const cropRect = cropAreaRef.current.getBoundingClientRect()
            const imgRect = imageRef.current.getBoundingClientRect()

            const newX = e.clientX - dragStart.x
            const newY = e.clientY - dragStart.y

            const maxX = (imgRect.width * cropScale - cropRect.width) / 2
            const maxY = (imgRect.height * cropScale - cropRect.height) / 2

            setCropPosition({
                x: Math.max(-maxX, Math.min(maxX, newX)),
                y: Math.max(-maxY, Math.min(maxY, newY))
            })
        }
    }, [isDragging, dragStart, cropScale, cropAreaRef, imageRef, setCropPosition])

    const handleMouseUp = useCallback(() => {
        setIsDragging(false)
    }, [setIsDragging])

    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)
            return () => {
                document.removeEventListener('mousemove', handleMouseMove)
                document.removeEventListener('mouseup', handleMouseUp)
            }
        }
    }, [isDragging, handleMouseMove, handleMouseUp])

    const handleClose = () => {
        onClose()
        setCropScale(1)
        setCropPosition({ x: 0, y: 0 })
    }

    const cropDimensions = aspectRatio === 'square'
        ? { width: 440, height: 180 }
        : { width: 480, height: 270 }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[200]">
            <div className="bg-[#1a1d2e] rounded-lg shadow-2xl max-w-md w-full mx-4">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-100">{title}</h3>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="text-gray-400 hover:text-gray-200 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Conteúdo */}
                <div className="p-4">
                    {/* Área de Crop */}
                    <div className="flex justify-center mb-3">
                        <div
                            ref={cropAreaRef}
                            className="relative bg-black rounded-lg overflow-hidden border border-gray-700"
                            style={{
                                width: `${cropDimensions.width}px`,
                                height: `${cropDimensions.height}px`
                            }}
                        >
                            {/* Imagem arrastável */}
                            <div
                                className="absolute inset-0 cursor-grab active:cursor-grabbing"
                                onMouseDown={handleMouseDown}
                                style={{ userSelect: 'none' }}
                            >
                                <img
                                    ref={imageRef}
                                    src={imagePreview}
                                    alt="Crop preview"
                                    className="absolute top-1/2 left-1/2 max-w-none pointer-events-none"
                                    style={{
                                        transform: `translate(-50%, -50%) translate(${cropPosition.x}px, ${cropPosition.y}px) scale(${cropScale})`,
                                        transformOrigin: 'center',
                                        userSelect: 'none'
                                    }}
                                    draggable={false}
                                    onLoad={() => {
                                        if (imageRef.current) {
                                            const img = imageRef.current
                                            const scaleX = cropDimensions.width / img.naturalWidth
                                            const scaleY = cropDimensions.height / img.naturalHeight
                                            const initialScale = Math.max(scaleX, scaleY)
                                            setCropScale(initialScale)
                                        }
                                    }}
                                />
                            </div>

                            {/* Grid */}
                            <div className="absolute inset-0 pointer-events-none">
                                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                                    {[...Array(9)].map((_, i) => (
                                        <div key={i} className="border border-white border-opacity-20"></div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Controle de Zoom */}
                    <div className="mb-3">
                        <label className="block text-xs font-medium text-gray-300 mb-1.5">{t('common.zoom')}</label>
                        <input
                            type="range"
                            min="0.1"
                            max="3"
                            step="0.1"
                            value={cropScale}
                            onChange={(e) => setCropScale(Number(e.target.value))}
                            className="w-full h-2 bg-[#252941] rounded-lg appearance-none cursor-pointer"
                        />
                    </div>

                    <p className="text-xs text-gray-400 text-center mb-3">
                        {t('components.image_crop_modal.drag_to_adjust')}
                    </p>

                    {/* Hidden canvas to process the crop */}
                    <canvas ref={canvasRef} style={{ display: 'none' }} />

                    {/* Buttons */}
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="flex-1 px-4 py-2 text-sm text-gray-300 bg-[#252941] hover:bg-[#2f3350] rounded-lg font-medium transition-colors"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            type="button"
                            onClick={onCropComplete}
                            className="flex-1 px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium transition-colors"
                        >
                            {t('common.save')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}