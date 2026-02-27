import React, { useState } from 'react'
import { Loader2, CheckCircle } from 'lucide-react'
import { OrderBump, CheckoutImageBlock } from './types'
import { formatPrice, calculateInstallmentValue } from './utils'
import CheckoutImageDisplay from './components/CheckoutImageDisplay'

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
  onSubmit: () => void
  processing: boolean
  paymentSuccess: boolean
  paymentError: string | null
  isPreview?: boolean
  isMobile?: boolean
  t: any // translations object
  buttonColor?: string
  imageBlocks?: CheckoutImageBlock[]
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
  imageBlocks
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

    onSubmit()
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
    ? "bg-white rounded-xl mx-4 my-4 px-4 py-5 shadow-sm border border-gray-100"
    : "bg-white rounded-xl p-5 lg:p-6 shadow-sm border border-gray-100 sticky top-24"

  return (
    <div className={containerClass}>
      <h3 className="text-[13px] font-semibold text-gray-900 mb-4">{t.orderSummary}</h3>

      {/* Produto */}
      {isMobile && productImage ? (
        <div className="flex gap-3 pb-3 mb-3 border-b border-gray-100">
          <img
            src={productImage}
            alt={productName}
            className="w-14 h-14 object-cover rounded-lg flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <h4 className="text-[13px] font-medium text-gray-900 truncate">{productName}</h4>
            {productDescription && (
              <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{productDescription}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="pb-3 mb-3 border-b border-gray-100">
          <h3 className="font-medium text-gray-900 text-[13px]">{productName}</h3>
        </div>
      )}

      <div className="space-y-2 mb-3">
        <div className="flex justify-between text-[13px]">
          <span className="text-gray-400">{t.subtotal}</span>
          <span className="text-gray-700">{formatPrice(productPrice, productCurrency)}</span>
        </div>

        {/* Order Bumps Selecionados */}
        {selectedBumps.size > 0 && (
          <>
            {Array.from(selectedBumps).map(bumpId => {
              const bump = orderBumps.find(b => b.id === bumpId)
              if (!bump) return null
              const price = bump.custom_price || bump.offer_product_price
              return (
                <div key={bumpId} className="flex justify-between text-[13px]">
                  <span className="text-gray-400">{bump.offer_product_name}</span>
                  <span className="text-gray-700">{formatPrice(price, bump.offer_product_currency)}</span>
                </div>
              )
            })}
          </>
        )}
      </div>

      <div className="pt-3 border-t border-gray-100 mb-4">
        <div className="flex justify-between items-baseline">
          <span className="text-[13px] font-medium text-gray-900">{t.total}</span>
          <span className={`font-semibold text-gray-900 ${isMobile ? 'text-xl' : 'text-lg'}`}>
            {formatPrice(totalWithBumps, productCurrency)}
          </span>
        </div>
        {paymentMethod === 'credit' && installments > 1 && (
          <div className="text-[11px] text-gray-400 text-right mt-0.5">
            {t.installmentLabel(installments, formatPrice(calculateInstallmentValue(totalWithBumps, installments), productCurrency))}{installments <= 6 ? t.interestFree : t.withInterest}
          </div>
        )}
      </div>

      {/* Image block: above buy button */}
      <CheckoutImageDisplay imageBlocks={imageBlocks} slot="above_button" className="px-0" isPreview={isPreview} />

      <button
        onClick={handleOptimisticClick}
        disabled={processing || isPreview}
        className={`w-full disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all duration-200 text-[13px] flex items-center justify-center gap-2 ${isMobile ? 'py-3 mb-4' : 'py-3'} ${optimisticClick ? 'scale-[0.96] bg-opacity-90' : 'hover:scale-[1.02] active:scale-[0.98]'
          }`}
        style={{ backgroundColor: buttonColor, touchAction: 'manipulation', minHeight: '44px' }}
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
            <span>{t.completePurchase}</span>
          </>
        )}
      </button>

      {/* Image block: below buy button */}
      <CheckoutImageDisplay imageBlocks={imageBlocks} slot="below_button" className="px-0" isPreview={isPreview} />

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