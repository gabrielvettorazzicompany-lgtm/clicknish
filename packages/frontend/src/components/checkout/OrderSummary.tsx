import React, { useState } from 'react'
import { Loader2, CheckCircle } from 'lucide-react'
import { OrderBump, CheckoutImageBlock, Testimonial } from './types'
import { formatPrice, calculateInstallmentValue } from './utils'
import CheckoutImageDisplay from './components/CheckoutImageDisplay'
import ImageDropZone from './components/ImageDropZone'
import TestimonialDropZone from './components/TestimonialDropZone'
import TestimonialDisplay from './components/TestimonialDisplay'

interface OrderSummaryProps {
  productName: string
  productPrice: number
  productCurrency?: string
  productImage?: string
  productDescription?: string
  orderBumps: OrderBump[]
  selectedBumps: Set<string>
  totalWithBumps: number
  installments?: number
  paymentMethod?: string
  onSubmit: (e?: any, data?: any) => void
  processing: boolean
  paymentSuccess: boolean
  paymentError: string | null
  isPreview?: boolean
  isMobile?: boolean
  t: any // translations object
  buttonColor?: string
  buttonText?: string
  imageBlocks?: CheckoutImageBlock[]
  testimonials?: Testimonial[]
  testimonialsCarouselMode?: boolean
  testimonialsHorizontalMode?: boolean
  isDragging?: boolean
  draggedComponentType?: string
  onUpdateImageBlock?: (id: string, updates: Partial<CheckoutImageBlock>) => void
  onDeleteImageBlock?: (id: string) => void
  onTestimonialsClick?: (id?: string) => void
}

export const OrderSummary: React.FC<OrderSummaryProps> = ({
  productName,
  productPrice,
  productCurrency = 'USD',
  productImage,
  productDescription,
  orderBumps,
  selectedBumps,
  totalWithBumps,
  installments = 1,
  paymentMethod = 'credit',
  onSubmit,
  processing,
  paymentSuccess,
  paymentError,
  isPreview,
  isMobile,
  t,
  buttonColor = '#111827',
  buttonText = 'Complete Purchase',
  imageBlocks,
  testimonials,
  testimonialsCarouselMode = false,
  testimonialsHorizontalMode = false,
  isDragging,
  draggedComponentType,
  onUpdateImageBlock,
  onDeleteImageBlock,
  onTestimonialsClick
}) => {
  // ═══════════════════════════════════════════════════════════════════
  // OPTIMISTIC UI: Feedback visual instantâneo ao clicar
  // ═══════════════════════════════════════════════════════════════════
  const [optimisticClick, setOptimisticClick] = useState(false)

  const handleOptimisticClick = () => {
    if (processing || isPreview) return

    // Feedback instantâneo: botão "pulsa" antes mesmo da resposta do servidor
    setOptimisticClick(true)

    // Limpar o estado após 300ms (ou quando processing iniciar de verdade)
    setTimeout(() => setOptimisticClick(false), 300)

    if (paymentMethod === 'paypal') {
      onSubmit(undefined, { paymentMethod: 'paypal' })
    } else if (paymentMethod?.startsWith('mollie_')) {
      onSubmit(undefined, { paymentMethod })
    } else {
      onSubmit()
    }
  }

  // Calcular valor da parcela com juros se aplicavel
  const calculateInstallmentValue = (total: number, installmentCount: number) => {
    if (installmentCount === 1) return total

    // Juros simples: até 6x sem juros, acima disso 2.5% ao mês
    if (installmentCount <= 6) {
      return total / installmentCount
    } else {
      const interestRate = 0.025 // 2.5% ao mês
      const totalWithInterest = total * (1 + (interestRate * installmentCount))
      return totalWithInterest / installmentCount
    }
  }
  const containerClass = isMobile
    ? "mx-4 mt-0 mb-4"
    : "sticky top-24"

  return (
    <div className={containerClass}>
      <div className="mb-3">
        <div className="flex justify-between items-baseline">
          <span className="text-[12px] font-medium text-gray-900">{t.total}</span>
          <span className={`font-semibold text-gray-900 ${isMobile ? 'text-lg' : 'text-base'}`}>
            {formatPrice(totalWithBumps, productCurrency)}
          </span>
        </div>
        {paymentMethod === 'credit' && installments > 1 && (
          <div className="text-[11px] text-gray-600 text-right mt-0.5">
            {t.installmentLabel(installments, formatPrice(calculateInstallmentValue(totalWithBumps, installments), productCurrency))}
          </div>
        )}
      </div>

      {/* Image block: above buy button */}
      <ImageDropZone slot="above_button" isPreview={isPreview} isDragging={isDragging} draggedComponentType={draggedComponentType} />
      <CheckoutImageDisplay imageBlocks={imageBlocks} slot="above_button" className="px-0" isPreview={isPreview} onUpdateImageBlock={onUpdateImageBlock} onDeleteImageBlock={onDeleteImageBlock} />

      <button
        onClick={handleOptimisticClick}
        disabled={processing}
        className={`w-full disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all duration-200 text-[13px] flex items-center justify-center gap-2 ${isMobile ? 'py-2.5 mb-4' : 'py-2.5'} ${isPreview ? 'cursor-default pointer-events-none' : ''} ${optimisticClick ? 'scale-[0.96] bg-opacity-90' : 'hover:scale-[1.02] active:scale-[0.98]'
          }`}
        style={{ backgroundColor: buttonColor, touchAction: 'manipulation', minHeight: '42px' }}
      >
        {processing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{t.processing}</span>
          </>
        ) : paymentSuccess ? (
          <>
            <CheckCircle className="w-4 h-4" />
            <span>{t.paymentSuccessful}</span>
          </>
        ) : (
          <>
            {optimisticClick && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{buttonText}</span>
          </>
        )}
      </button>

      {/* Image block: below buy button */}
      <ImageDropZone slot="below_button" isPreview={isPreview} isDragging={isDragging} draggedComponentType={draggedComponentType} />
      <CheckoutImageDisplay imageBlocks={imageBlocks} slot="below_button" className="px-0" isPreview={isPreview} onUpdateImageBlock={onUpdateImageBlock} onDeleteImageBlock={onDeleteImageBlock} />

      {/* Testimonial: below buy button */}
      {!testimonialsCarouselMode && (
        <TestimonialDropZone slot="below_button" isPreview={isPreview} isDragging={isDragging} draggedComponentType={draggedComponentType} />
      )}
      <TestimonialDisplay testimonials={testimonials} slot="below_button" className="px-0" isPreview={isPreview} onClick={onTestimonialsClick} carouselMode={testimonialsCarouselMode} horizontalMode={testimonialsHorizontalMode} />

      {paymentError && (
        <div className={`p-3 bg-red-50 border border-red-100 rounded-lg ${isMobile ? 'mb-4' : 'mt-3'}`}>
          <p className="text-[13px] text-red-500">{paymentError}</p>
        </div>
      )}

      {paymentSuccess && (
        <div className={`p-3 bg-green-50 border border-green-100 rounded-lg ${isMobile ? 'mb-4' : 'mt-3'}`}>
          <p className="text-[13px] text-green-600">{t.accessGranted}</p>
        </div>
      )}
    </div>
  )
}