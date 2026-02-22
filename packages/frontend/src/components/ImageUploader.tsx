import React, { useState, useRef, useCallback } from 'react'
import { Upload, X } from 'lucide-react'
import { useI18n } from '@/i18n'

interface ImageUploaderProps {
  onImageSelect: (imageData: string) => void
  currentImage?: string
  placeholder?: string
  aspectRatio?: 'square' | 'banner' | 'logo' | 'free'

}

export default function ImageUploader({
  onImageSelect,
  currentImage,
  placeholder,
  aspectRatio = 'free'
}: ImageUploaderProps) {
  const { t } = useI18n()
  const displayPlaceholder = placeholder || t('components.image_uploader.click_to_select')
  const [selectedImage, setSelectedImage] = useState<string | null>(currentImage || null)
  const [isEditing, setIsEditing] = useState(false)
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const cropAreaRef = useRef<HTMLDivElement>(null)

  const getCropDimensions = () => {
    switch (aspectRatio) {
      case 'square':
      case 'logo':
        return { width: 200, height: 200 }
      case 'banner':
        return { width: 280, height: 158 } // 16:9
      case 'free':
      default:
        return { width: 200, height: 200 }
    }
  }

  const cropDimensions = getCropDimensions()

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        setSelectedImage(result)
        setIsEditing(true)
        setScale(1)
        setPosition({ x: 0, y: 0 })
      }
      reader.readAsDataURL(file)
    }
  }, [])

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging && cropAreaRef.current && imageRef.current) {
      const cropRect = cropAreaRef.current.getBoundingClientRect()
      const imgRect = imageRef.current.getBoundingClientRect()

      const newX = e.clientX - dragStart.x
      const newY = e.clientY - dragStart.y

      // Limites para não deixar a imagem sair completamente da área de crop
      const maxX = (imgRect.width * scale - cropRect.width) / 2
      const maxY = (imgRect.height * scale - cropRect.height) / 2

      setPosition({
        x: Math.max(-maxX, Math.min(maxX, newX)),
        y: Math.max(-maxY, Math.min(maxY, newY))
      })
    }
  }, [isDragging, dragStart, scale])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Event listeners para mouse global
  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  // Sync selectedImage with currentImage prop when it changes (e.g., when editing content)
  React.useEffect(() => {
    if (currentImage && !isEditing) {
      setSelectedImage(currentImage)
    }
  }, [currentImage])

  const processImage = () => {
    if (!selectedImage || !canvasRef.current || !imageRef.current || !cropAreaRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    if (!ctx) return

    // Define o tamanho do canvas com resolução 2x para qualidade
    const exportScale = 2
    canvas.width = cropDimensions.width * exportScale
    canvas.height = cropDimensions.height * exportScale

    // Limpa o canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Escala o contexto para manter a qualidade
    ctx.scale(exportScale, exportScale)

    // Cria uma imagem temporária
    const tempImg = new Image()
    tempImg.onload = () => {
      // Simula exatamente o que está sendo mostrado na área de crop
      ctx.save()

      // Move o contexto para o centro da área de crop
      ctx.translate(cropDimensions.width / 2, cropDimensions.height / 2)

      // Aplica a transformação da posição e escala
      ctx.translate(position.x, position.y)
      ctx.scale(scale, scale)

      // Desenha a imagem centralizada
      ctx.drawImage(
        tempImg,
        -tempImg.naturalWidth / 2,
        -tempImg.naturalHeight / 2,
        tempImg.naturalWidth,
        tempImg.naturalHeight
      )

      ctx.restore()

      // Converte para base64
      const imageData = canvas.toDataURL('image/jpeg', 0.8)
      onImageSelect(imageData)
      setIsEditing(false)
    }

    tempImg.src = selectedImage
  }

  const removeImage = () => {
    setSelectedImage(null)
    setIsEditing(false)
    onImageSelect('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const resetEditor = () => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }

  return (
    <>
      <div className="space-y-4">
        {/* Upload Area */}
        <div className="relative">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {!selectedImage ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-[#252941] rounded-lg p-8 text-center hover:border-gray-400 transition-colors"
            >
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-3" />
              <p className="text-sm text-gray-600">{displayPlaceholder}</p>
              <p className="text-xs text-gray-500 mt-1">
                {t('components.image_uploader.file_size_limit')}
              </p>
            </button>
          ) : (
            <div className="relative">
              <div className="relative bg-[#252941] rounded-lg overflow-hidden">
                {aspectRatio === 'logo' || aspectRatio === 'square' ? (
                  <div className="w-full h-32 flex items-center justify-center bg-[#0f1117]">
                    <img
                      src={selectedImage}
                      alt="Preview"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                ) : (
                  <img
                    src={selectedImage}
                    alt="Preview"
                    className="w-full h-32 object-cover"
                  />
                )}
              </div>

              {/* Botões de ação */}
              <div className="flex justify-between items-center mt-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-sm text-blue-400 hover:text-blue-700"
                >
                  {t('components.image_uploader.change_image')}
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  >
                    {t('components.image_uploader.adjust_image')}
                  </button>
                  <button
                    type="button"
                    onClick={removeImage}
                    className="p-1 text-red-600 hover:text-red-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Canvas oculto para processamento */}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Modal de Crop */}
      {isEditing && selectedImage && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-[#151825] via-[#1a2035] via-50% to-[#1a3050] border border-[#2a4060] rounded-lg shadow-2xl max-w-xs w-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#2a4060]">
              <div>
                <h3 className="text-sm font-semibold text-gray-100">{t('components.image_uploader.adjust_image')}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{t('components.image_uploader.drag_zoom')}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-gray-400 hover:text-gray-100 p-1 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4">
              {/* Crop Area */}
              <div className="flex justify-center mb-3">
                <div
                  ref={cropAreaRef}
                  className="relative bg-black rounded-lg overflow-hidden border-2 border-gray-600"
                  style={{
                    width: cropDimensions.width,
                    height: cropDimensions.height
                  }}
                >
                  {/* Draggable and resizable image */}
                  <div
                    className="absolute inset-0 cursor-grab active:cursor-grabbing overflow-hidden"
                    onMouseDown={handleMouseDown}
                  >
                    <img
                      ref={imageRef}
                      src={selectedImage}
                      alt="Crop preview"
                      className="absolute top-1/2 left-1/2 max-w-none select-none"
                      style={{
                        transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px) scale(${scale})`,
                        transformOrigin: 'center'
                      }}
                      draggable={false}
                      onLoad={() => {
                        // Auto-ajusta escala inicial para caber na área
                        if (imageRef.current) {
                          const img = imageRef.current
                          const scaleX = cropDimensions.width / img.naturalWidth
                          const scaleY = cropDimensions.height / img.naturalHeight
                          const initialScale = Math.max(scaleX, scaleY)
                          setScale(initialScale)
                        }
                      }}
                    />
                  </div>


                  {/* White grid */}
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                      {[...Array(9)].map((_, i) => (
                        <div key={i} className="border border-white border-opacity-50"></div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Zoom Control */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-300 mb-2">{t('common.zoom')}</label>
                <input
                  type="range"
                  min="0.1"
                  max="3"
                  step="0.1"
                  value={scale}
                  onChange={(e) => setScale(Number(e.target.value))}
                  className="w-full h-1.5 bg-[#252941] rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <p className="text-xs text-gray-500 text-center mb-4">
                {t('components.image_uploader.drag_to_adjust')}
              </p>

              {/* Buttons */}
              <div className="flex gap-3 pt-3 border-t border-[#2a4060]">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-sm text-gray-300 hover:text-gray-100 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={processImage}
                  className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                >
                  {t('common.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}