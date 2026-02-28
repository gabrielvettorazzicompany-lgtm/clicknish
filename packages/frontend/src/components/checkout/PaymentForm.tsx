import React, { useState, useEffect } from 'react'
import { CardNumberElement, CardExpiryElement, CardCvcElement } from '@stripe/react-stripe-js'
import { ChevronDown, Loader2, CheckCircle } from 'lucide-react'
import { FormData, CheckoutImageBlock } from './types'
import { stripeElementStyle, isValidEmail } from './utils'
import { useI18n } from '@/i18n'
import CheckoutImageDisplay from './components/CheckoutImageDisplay'
import ImageDropZone from './components/ImageDropZone'

interface PaymentFormProps {
  formData: FormData
  onFormDataChange: (data: FormData) => void
  selectedPaymentMethods: ('credit_card')[]
  defaultPaymentMethod: 'credit_card'
  onSubmit: (e?: React.FormEvent) => Promise<void>
  processing: boolean
  paymentSuccess: boolean
  paymentError: string | null
  totalAmount: number
  currency?: string
  onInstallmentsChange?: (installments: number) => void
  isPreview?: boolean
  onLeadCapture?: (data: { email: string; name: string; phone: string }) => void
  t: any // translations object
  imageBlocks?: CheckoutImageBlock[]
  isDragging?: boolean
  draggedComponentType?: string
  onUpdateImageBlock?: (id: string, updates: Partial<CheckoutImageBlock>) => void
}

export const PaymentForm: React.FC<PaymentFormProps> = ({
  formData,
  onFormDataChange,
  selectedPaymentMethods,
  defaultPaymentMethod,
  onSubmit,
  processing,
  paymentSuccess,
  paymentError,
  totalAmount,
  currency = 'USD',
  onInstallmentsChange,
  isPreview,
  onLeadCapture,
  t,
  imageBlocks,
  isDragging,
  draggedComponentType,
  onUpdateImageBlock
}) => {
  const [expandedPaymentMethod, setExpandedPaymentMethod] = useState<'credit_card' | null>(defaultPaymentMethod)
  const [installments, setInstallments] = useState(1)

  // Calcular parcelas disponíveis baseado no valor
  const getAvailableInstallments = () => {
    // Valor mínimo por parcela (ex: $10 USD, R$50 BRL)
    const minInstallmentValue = currency === 'BRL' ? 50 : 10
    const maxInstallments = Math.floor(totalAmount / minInstallmentValue)
    const availableInstallments = Math.min(maxInstallments, 12) // Máximo 12x

    return Math.max(1, availableInstallments) // Mínimo 1x
  }

  // Calcular valor da parcela (com ou sem juros)
  const calculateInstallmentValue = (installmentCount: number) => {
    if (installmentCount === 1) return totalAmount

    // Juros simples: até 6x sem juros, acima disso 2.5% ao mês
    if (installmentCount <= 6) {
      return totalAmount / installmentCount
    } else {
      const interestRate = 0.025 // 2.5% ao mês
      const totalWithInterest = totalAmount * (1 + (interestRate * installmentCount))
      return totalWithInterest / installmentCount
    }
  }

  const formatInstallmentPrice = (value: number) => {
    const currencyMap: { [key: string]: string } = {
      'USD': 'en-US',
      'EUR': 'de-DE',
      'CHF': 'de-CH',
      'BRL': 'pt-BR'
    }

    const locale = currencyMap[currency] || 'en-US'

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency
    }).format(value)
  }

  // Atualizar método expandido quando defaultPaymentMethod mudar
  useEffect(() => {
    setExpandedPaymentMethod(defaultPaymentMethod)
  }, [defaultPaymentMethod])

  // Notificar mudança de parcelas
  useEffect(() => {
    if (onInstallmentsChange) {
      onInstallmentsChange(installments)
    }
  }, [installments, onInstallmentsChange])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    onFormDataChange({ ...formData, [name]: value })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (isPreview) return

    // Validação
    if (!formData.name || !formData.email) {
      console.error('Fill required fields')
      return
    }

    // Validar formato de email
    if (!isValidEmail(formData.email)) {
      console.error('Invalid email')
      return
    }

    onSubmit(e)
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Identificação */}
      <div className="bg-white rounded-xl mx-4 lg:mx-0 px-4 py-5 sm:p-5 lg:p-7 shadow-sm border border-gray-100">
        <h2 className="text-[13px] sm:text-sm font-semibold text-gray-900 mb-4">
          {t.personalInformation}
        </h2>

        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-gray-700 mb-1 uppercase tracking-wider">
              {t.email}
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              onBlur={() => {
                if (onLeadCapture && isValidEmail(formData.email)) {
                  onLeadCapture({ email: formData.email, name: formData.name, phone: formData.phone })
                }
              }}
              className="w-full px-3.5 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all text-base bg-white text-gray-900 placeholder-gray-300"
              placeholder={t.emailPlaceholder}
              autoComplete="email"
              autoCorrect="off"
              autoCapitalize="off"
              inputMode="email"
            />
            <p className="text-[10px] text-gray-400 mt-1">{t.emailHelper}</p>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-gray-700 mb-1 uppercase tracking-wider">
              {t.fullName}
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              onBlur={() => {
                if (onLeadCapture && isValidEmail(formData.email)) {
                  onLeadCapture({ email: formData.email, name: formData.name, phone: formData.phone })
                }
              }}
              className="w-full px-3.5 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all text-base bg-white text-gray-900 placeholder-gray-300"
              placeholder={t.fullNamePlaceholder}
              autoComplete="name"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-gray-700 mb-1 uppercase tracking-wider">
              {t.phone}
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              onBlur={() => {
                if (onLeadCapture && isValidEmail(formData.email)) {
                  onLeadCapture({ email: formData.email, name: formData.name, phone: formData.phone })
                }
              }}
              className="w-full px-3.5 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all text-base bg-white text-gray-900 placeholder-gray-300"
              placeholder={t.phonePlaceholder}
              autoComplete="tel"
              inputMode="tel"
            />
          </div>
        </div>
      </div>

      {/* Método de pagamento */}
      <div className="bg-white rounded-xl mx-4 lg:mx-0 px-4 py-5 sm:p-5 lg:p-7 shadow-sm border border-gray-100 mt-3 lg:mt-4">
        <h2 className="text-[13px] sm:text-sm font-semibold text-gray-900 mb-1">
          {t.paymentMethod}
        </h2>
        <p className="text-[11px] text-gray-400 mb-4">{t.paymentMethodHelper}</p>

        {/* Payment methods */}
        <div className="space-y-3">
          {/* Cartão de Crédito */}
          {selectedPaymentMethods.includes('credit_card') && (
            <div className={`border rounded-xl transition-all bg-white ${expandedPaymentMethod === 'credit_card' ? 'border-blue-200 ring-1 ring-blue-100' : 'border-gray-200 hover:border-gray-300'}`}>
              <button
                type="button"
                onClick={() => setExpandedPaymentMethod(
                  expandedPaymentMethod === 'credit_card' ? null : 'credit_card'
                )}
                className="w-full flex items-center gap-3 p-3.5 min-h-[44px]"
                style={{ touchAction: 'manipulation' }}
              >
                <div className="flex items-center gap-2 flex-1">
                  {/* Credit card icons */}
                  <div className="flex items-center gap-0.5 px-2 py-1 bg-gray-50 border border-gray-200 rounded">
                    {/* Visa */}
                    <svg width="24" height="16" viewBox="0 0 24 16" fill="none">
                      <rect width="24" height="16" rx="2" fill="white" />
                      <path d="M10.5 11.5l1.2-7h1.9l-1.2 7h-1.9zm6.8-6.8c-.4-.1-.9-.2-1.6-.2-1.8 0-3 .9-3 2.2 0 1 .9 1.5 1.6 1.8.7.3.9.5.9.8 0 .4-.5.6-1 .6-.7 0-1-.1-1.6-.3l-.2-.1-.2 1.3c.4.2 1.1.3 1.9.3 1.9 0 3.1-.9 3.2-2.3 0-.7-.4-1.3-1.4-1.7-.6-.3-.9-.5-.9-.8 0-.3.3-.5.9-.5.5 0 .9.1 1.2.2l.1.1.2-1.4zM21 4.5h-1.5c-.5 0-.8.1-1 .6l-2.9 6.4h1.9l.4-1h2.3l.2 1h1.7L21 4.5zm-2.2 4.6c.1-.4.7-1.8.7-1.8l.4 1.8h-1.1zM8.5 4.5L6.7 9.7l-.2-.9c-.3-1-.9-2.1-1.7-2.6L6.4 11.5h1.9l2.8-7h-1.9" fill="#1434CB" />
                    </svg>
                    {/* Mastercard */}
                    <svg width="24" height="16" viewBox="0 0 24 16" fill="none">
                      <rect width="24" height="16" rx="2" fill="white" />
                      <circle cx="9" cy="8" r="4" fill="#EB001B" />
                      <circle cx="15" cy="8" r="4" fill="#F79E1B" />
                      <path d="M12 4.8c.8.7 1.3 1.8 1.3 3s-.5 2.3-1.3 3c-.8-.7-1.3-1.8-1.3-3s.5-2.3 1.3-3z" fill="#FF5F00" />
                    </svg>
                  </div>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 transition-transform ${expandedPaymentMethod === 'credit_card' ? 'rotate-180' : ''
                    }`}
                />
              </button>

              {/* Formulário de Cartão com Stripe Elements */}
              {expandedPaymentMethod === 'credit_card' && (
                <div className="space-y-3 p-3.5 border-t border-gray-100">
                  {/* Número do cartão - Stripe Element */}
                  <div>
                    <label className="block text-[11px] font-medium text-gray-700 mb-1 uppercase tracking-wider">
                      {t.cardNumber}
                    </label>
                    <div className="w-full px-3.5 py-3 border border-gray-200 rounded-lg bg-white min-h-[44px] flex items-center">
                      {isPreview ? (
                        <span className="text-gray-400 text-sm">1234 5678 9012 3456</span>
                      ) : (
                        <CardNumberElement options={{ style: stripeElementStyle }} />
                      )}
                    </div>
                  </div>

                  {/* Data de validade e CVV - Stripe Elements */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 mb-1 uppercase tracking-wider">
                        {t.expiryDate}
                      </label>
                      <div className="w-full px-3.5 py-3 border border-gray-200 rounded-lg bg-white min-h-[44px] flex items-center">
                        {isPreview ? (
                          <span className="text-gray-400 text-sm">12 / 28</span>
                        ) : (
                          <CardExpiryElement options={{ style: stripeElementStyle }} />
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 mb-1 uppercase tracking-wider">
                        {t.cvv}
                      </label>
                      <div className="w-full px-3.5 py-3 border border-gray-200 rounded-lg bg-white min-h-[44px] flex items-center">
                        {isPreview ? (
                          <span className="text-gray-400 text-sm">•••</span>
                        ) : (
                          <CardCvcElement options={{ style: stripeElementStyle }} />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Parcelas */}
                  <div>
                    <label className="block text-[11px] font-medium text-gray-700 mb-1 uppercase tracking-wider">
                      {t.installments}
                    </label>
                    <select
                      value={installments}
                      onChange={(e) => setInstallments(Number(e.target.value))}
                      className="w-full px-3.5 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all text-base bg-white text-gray-900 appearance-none"
                    >
                      {Array.from({ length: getAvailableInstallments() }, (_, i) => i + 1).map(num => {
                        const installmentValue = calculateInstallmentValue(num)
                        const hasInterest = num > 6

                        return (
                          <option key={num} value={num}>
                            {num === 1
                              ? `${t.fullPayment} ${formatInstallmentPrice(installmentValue)}`
                              : `${num}x ${formatInstallmentPrice(installmentValue)}${hasInterest ? t.withInterest : t.interestFree}`
                            }
                          </option>
                        )
                      })}
                    </select>
                    {installments > 6 && (
                      <p className="text-xs text-amber-600 mt-1">
                        {t.interestWarning}
                      </p>
                    )}
                    {installments <= 6 && installments > 1 && (
                      <p className="text-xs text-green-600 mt-1">
                        {t.noInterest}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Image blocks: below payment methods */}
      <ImageDropZone slot="below_payment_methods" isPreview={isPreview} isDragging={isDragging} draggedComponentType={draggedComponentType} />
      <CheckoutImageDisplay imageBlocks={imageBlocks} slot="below_payment_methods" isPreview={isPreview} onUpdateImageBlock={onUpdateImageBlock} />

      {/* Error and Success Messages */}
      {paymentError && (
        <div className="mx-4 lg:mx-0 mt-3 p-3 bg-red-50 border border-red-100 rounded-lg">
          <p className="text-[13px] text-red-600">{paymentError}</p>
        </div>
      )}

      {paymentSuccess && (
        <div className="mx-4 lg:mx-0 mt-3 p-3 bg-green-50 border border-green-100 rounded-lg">
          <p className="text-[13px] text-green-600">{t.accessGranted}</p>
        </div>
      )}
    </form>
  )
}