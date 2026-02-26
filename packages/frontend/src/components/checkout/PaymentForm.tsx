import React, { useState, useEffect } from 'react'
import { CardNumberElement, CardExpiryElement, CardCvcElement } from '@stripe/react-stripe-js'
import { ChevronDown, CreditCard, Loader2, CheckCircle } from 'lucide-react'
import { FormData } from './types'
import { stripeElementStyle, isValidEmail } from './utils'
import { useI18n } from '@/i18n'

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
  t
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
    <form onSubmit={handleSubmit} className="space-y-0">
      {/* Identificação */}
      <div className="bg-white lg:rounded-xl px-4 py-5 sm:p-5 lg:p-7 lg:shadow-sm lg:border border-gray-100">
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
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all text-sm bg-white text-gray-900 placeholder-gray-300"
              placeholder={t.emailPlaceholder}
              autoComplete="email"
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
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all text-sm bg-white text-gray-900 placeholder-gray-300"
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
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all text-sm bg-white text-gray-900 placeholder-gray-300"
              placeholder={t.phonePlaceholder}
              autoComplete="tel"
            />
          </div>
        </div>
      </div>

      {/* Método de pagamento */}
      <div className="bg-white lg:rounded-xl px-4 py-5 sm:p-5 lg:p-7 lg:shadow-sm lg:border border-gray-100 lg:mt-4">
        <h2 className="text-[13px] sm:text-sm font-semibold text-gray-900 mb-1">
          {t.paymentMethod}
        </h2>
        <p className="text-[11px] text-gray-400 mb-4">{t.paymentMethodHelper}</p>

        {/* Payment methods as expandable cards */}
        <div className="space-y-3">
          {/* Cartão de Crédito Card */}
          {selectedPaymentMethods.includes('credit_card') && (
            <div className={`border rounded-xl transition-all bg-white ${expandedPaymentMethod === 'credit_card'
              ? 'border-blue-200 ring-1 ring-blue-100'
              : 'border-gray-200 hover:border-gray-300'
              }`}>
              <button
                type="button"
                onClick={() => setExpandedPaymentMethod(
                  expandedPaymentMethod === 'credit_card' ? null : 'credit_card'
                )}
                className="w-full flex items-center gap-3 p-3.5"
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${expandedPaymentMethod === 'credit_card' ? 'border-blue-500' : 'border-gray-300'
                  }`}>
                  {expandedPaymentMethod === 'credit_card' && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  )}
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <CreditCard className="text-gray-400" size={18} />
                  <span className="text-[13px] font-medium text-gray-800">{t.creditCard}</span>
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
                    <div className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg bg-white">
                      <CardNumberElement options={{ style: stripeElementStyle }} />
                    </div>
                  </div>

                  {/* Data de validade e CVV - Stripe Elements */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 mb-1 uppercase tracking-wider">
                        {t.expiryDate}
                      </label>
                      <div className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg bg-white">
                        <CardExpiryElement options={{ style: stripeElementStyle }} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 mb-1 uppercase tracking-wider">
                        {t.cvv}
                      </label>
                      <div className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg bg-white">
                        <CardCvcElement options={{ style: stripeElementStyle }} />
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
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all text-sm bg-white text-gray-900 appearance-none"
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