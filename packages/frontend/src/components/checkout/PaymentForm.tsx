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
  selectedPaymentMethods: ('credit_card' | 'paypal')[]
  defaultPaymentMethod: 'credit_card' | 'paypal'
  onSubmit: (e?: React.FormEvent, formData?: any) => Promise<void>
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
  const [expandedPaymentMethod, setExpandedPaymentMethod] = useState<'credit_card' | 'paypal' | null>(defaultPaymentMethod)
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

    // Adicionar informação do método de pagamento aos dados do formulário
    const formDataWithPaymentMethod = {
      ...formData,
      paymentMethod: expandedPaymentMethod
    }

    console.log('📝 PaymentForm handleSubmit:', formDataWithPaymentMethod)

    onSubmit(e, formDataWithPaymentMethod)
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
        <div>
          {/* Payment method selection cards */}
          <div className="flex gap-2 mb-4">
            {/* Cartão de Crédito */}
            {selectedPaymentMethods.includes('credit_card') && (
              <button
                type="button"
                onClick={() => setExpandedPaymentMethod(
                  expandedPaymentMethod === 'credit_card' ? null : 'credit_card'
                )}
                className={`flex-1 rounded-lg transition-all p-2.5 ${expandedPaymentMethod === 'credit_card'
                  ? 'bg-blue-50 shadow-sm'
                  : 'bg-gray-50 hover:bg-gray-100'
                  }`}
              >
                <div className="flex items-center justify-center gap-2">
                  {/* Visa oficial limpa */}
                  <svg width="38" height="12" viewBox="0 0 38 12">
                    <defs>
                      <linearGradient id="visaGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#1434cb" />
                        <stop offset="100%" stopColor="#1a1f71" />
                      </linearGradient>
                    </defs>
                    <text x="0" y="8.5" fontSize="9" fontFamily="Arial, sans-serif" fontWeight="bold" fill="url(#visaGrad)">VISA</text>
                  </svg>

                  {/* Mastercard oficial limpa */}
                  <svg width="28" height="17" viewBox="0 0 28 17">
                    <circle cx="10" cy="8.5" r="5.5" fill="#eb001b" />
                    <circle cx="18" cy="8.5" r="5.5" fill="#f79e1b" />
                    <path d="M14 4.2c1 .9 1.7 2.3 1.7 3.8s-.7 2.9-1.7 3.8c-1-.9-1.7-2.3-1.7-3.8s.7-2.9 1.7-3.8z" fill="#ff5f00" />
                  </svg>
                </div>
                <div className="text-xs text-gray-600 mt-2 text-center">
                  {t.creditCard || 'Tarjeta de crédito'}
                </div>
              </button>
            )}

            {/* PayPal */}
            {selectedPaymentMethods.includes('paypal') && (
              <button
                type="button"
                onClick={() => setExpandedPaymentMethod(
                  expandedPaymentMethod === 'paypal' ? null : 'paypal'
                )}
                className={`flex-1 rounded-lg transition-all p-2.5 ${expandedPaymentMethod === 'paypal'
                  ? 'bg-blue-50 shadow-sm'
                  : 'bg-gray-50 hover:bg-gray-100'
                  }`}
              >
                <div className="flex items-center justify-center">
                  {/* PayPal logo oficial */}
                  <svg width="60" height="20" viewBox="0 0 124 33" fill="none">
                    <g>
                      <path d="M46.211 6.749h-6.839a.95.95 0 0 0-.939.802l-2.766 17.537a.57.57 0 0 0 .564.658h3.265a.95.95 0 0 0 .939-.803l.746-4.73a.95.95 0 0 1 .938-.803h2.165c4.505 0 7.105-2.18 7.784-6.5.306-1.89.013-3.375-.872-4.415-.972-1.142-2.696-1.746-4.985-1.746zM47.117 13.154c-.374 2.454-2.249 2.454-4.062 2.454h-1.032l.724-4.583a.57.57 0 0 1 .563-.481h.473c1.235 0 2.4 0 3.002.704.359.42.469 1.044.332 1.906zM66.654 13.075h-3.275a.57.57 0 0 0-.563.481l-.145.916-.229-.332c-.709-1.029-2.29-1.373-3.868-1.373-3.619 0-6.71 2.741-7.312 6.586-.313 1.918.132 3.752 1.22 5.031.998 1.176 2.426 1.666 4.125 1.666 2.916 0 4.533-1.875 4.533-1.875l-.146.91a.57.57 0 0 0 .562.66h2.95a.95.95 0 0 0 .939-.803l1.77-11.209a.568.568 0 0 0-.561-.658zm-4.565 6.374c-.316 1.871-1.801 3.127-3.695 3.127-.951 0-1.711-.305-2.199-.883-.484-.574-.668-1.391-.514-2.301.295-1.855 1.805-3.152 3.67-3.152.93 0 1.686.309 2.184.892.499.589.697 1.411.554 2.317zM84.096 13.075h-3.291a.954.954 0 0 0-.787.417l-4.539 6.686-1.924-6.425a.953.953 0 0 0-.912-.678h-3.234a.57.57 0 0 0-.541.754l3.625 10.638-3.408 4.811a.57.57 0 0 0 .465.9h3.287a.949.949 0 0 0 .781-.408l10.946-15.8a.57.57 0 0 0-.468-.895z" fill="#253b80" />
                      <path d="M94.992 6.749h-6.84a.95.95 0 0 0-.938.802l-2.766 17.537a.569.569 0 0 0 .562.658h3.51a.665.665 0 0 0 .656-.562l.785-4.971a.95.95 0 0 1 .938-.803h2.164c4.506 0 7.105-2.18 7.785-6.5.307-1.89.012-3.375-.873-4.415-.971-1.142-2.694-1.746-4.983-1.746zm.789 6.405c-.373 2.454-2.248 2.454-4.062 2.454h-1.031l.725-4.583a.568.568 0 0 1 .562-.481h.473c1.234 0 2.4 0 3.002.704.359.42.468 1.044.331 1.906zM115.434 13.075h-3.273a.567.567 0 0 0-.562.481l-.145.916-.23-.332c-.709-1.029-2.289-1.373-3.867-1.373-3.619 0-6.709 2.741-7.311 6.586-.312 1.918.131 3.752 1.219 5.031 1 1.176 2.426 1.666 4.125 1.666 2.916 0 4.533-1.875 4.533-1.875l-.146.91a.57.57 0 0 0 .564.66h2.949a.95.95 0 0 0 .938-.803l1.771-11.209a.571.571 0 0 0-.565-.658zm-4.565 6.374c-.314 1.871-1.801 3.127-3.695 3.127-.949 0-1.711-.305-2.199-.883-.484-.574-.666-1.391-.514-2.301.297-1.855 1.805-3.152 3.67-3.152.93 0 1.686.309 2.184.892.501.589.699 1.411.554 2.317zM119.295 7.23l-2.807 17.858a.569.569 0 0 0 .562.658h2.822c.469 0 .867-.34.939-.803l2.768-17.536a.57.57 0 0 0-.562-.659h-3.16a.571.571 0 0 0-.562.482z" fill="#179bd7" />
                      <path d="M7.266 29.154l.523-3.322-1.165-.027H1.061L4.927 1.292a.316.316 0 0 1 .314-.268h9.38c1.586 0 2.784.312 3.567.928.289.228.543.486.756.769a4.584 4.584 0 0 1 .428.694c.12.25.215.534.285.85.068.307.108.658.12 1.054.011.378.006.814-.016 1.311v.14l.498.108a3.573 3.573 0 0 1 1.319.915c.394.398.678.899.842 1.485.158.567.188 1.244.089 2.01v.301l-.024.162-.03.309c-.263 1.663-.795 2.817-1.619 3.518-.759.644-1.846.975-3.221.975H16.54c-.445 0-.869.214-1.134.574a1.405 1.405 0 0 0-.259 1.019l-.013.11-.674 4.27-.018.097a.317.317 0 0 1-.200.254.327.327 0 0 1-.11.018H7.266z" fill="#253b80" />
                      <path d="M19.099 7.297c-.015.092-.034.186-.055.281-.735 3.718-3.24 5.007-6.446 5.007h-1.63c-.49 0-.912.356-.989.842l-1.598 10.126-.453 2.874c-.04.251.159.477.413.477h2.89c.429 0 .793-.31.862-.73l.035-.183.674-4.262.043-.232a.86.86 0 0 1 .862-.731h.542c2.804 0 4.997-1.134 5.634-4.422.266-1.371.128-2.514-.576-3.254a2.663 2.663 0 0 0-.623-.45z" fill="#179bd7" />
                      <path d="M18.154 6.921a5.315 5.315 0 0 0-.1-.017c-.296-.053-.616-.08-.957-.08H9.599c-.148 0-.29.041-.394.116a.877.877 0 0 0-.341.694l-1.225 7.769-.035.22c.077-.486.499-.842.989-.842h1.63c3.206 0 5.711-1.289 6.446-5.007.021-.095.04-.189.055-.281.162-.05.317-.108.465-.174.047-.021.094-.043.14-.066a3.576 3.576 0 0 0 .268-.16c.098-2.232-.317-3.748-1.383-4.832z" fill="#222d65" />
                      <path d="M7.78 6.979c0-.271.205-.499.473-.532.034-.004.069-.007.105-.007h7.498c.375 0 .73.025 1.061.075.331.05.635.125.906.224.271.1.511.223.719.368.208.146.383.314.525.504.142.191.251.405.326.641.075.237.117.497.126.782 0 .313-.042.649-.126 1.007-.735 3.718-3.24 5.007-6.446 5.007h-1.63c-.49 0-.912.356-.989.842l-1.598 10.126L7.78 6.979z" fill="#253b80" />
                    </g>
                  </svg>
                </div>
                <div className="text-xs text-gray-600 mt-2 text-center">
                  PayPal
                </div>
              </button>
            )}
          </div>

          {/* Expanded form area */}
          {expandedPaymentMethod === 'credit_card' && (
            <div className="mt-4">
              <div className="space-y-3">
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
                        <span className="text-gray-400 text-sm">123</span>
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
                </div>
              </div>
            </div>
          )}

          {expandedPaymentMethod === 'paypal' && (
            <div className="mt-4">
              {isPreview ? (
                <div className="bg-gray-50 rounded-lg p-8 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                    <svg width="32" height="20" viewBox="0 0 124 33" fill="#179bd7">
                      <path d="M46.211 6.749h-6.839a.95.95 0 0 0-.939.802l-2.766 17.537a.57.57 0 0 0 .564.658h3.265a.95.95 0 0 0 .939-.803l.746-4.73a.95.95 0 0 1 .938-.803h2.165c4.505 0 7.105-2.18 7.784-6.5.306-1.89.013-3.375-.872-4.415-.972-1.142-2.696-1.746-4.985-1.746zM47.117 13.154c-.374 2.454-2.249 2.454-4.062 2.454h-1.032l.724-4.583a.57.57 0 0 1 .563-.481h.473c1.235 0 2.4 0 3.002.704.359.42.469 1.044.332 1.906z" />
                      <path d="M7.266 29.154l.523-3.322-1.165-.027H1.061L4.927 1.292a.316.316 0 0 1 .314-.268h9.38c1.586 0 2.784.312 3.567.928.289.228.543.486.756.769a4.584 4.584 0 0 1 .428.694c.12.25.215.534.285.85.068.307.108.658.12 1.054.011.378.006.814-.016 1.311v.14l.498.108a3.573 3.573 0 0 1 1.319.915c.394.398.678.899.842 1.485.158.567.188 1.244.089 2.01v.301l-.024.162-.03.309c-.263 1.663-.795 2.817-1.619 3.518-.759.644-1.846.975-3.221.975H16.54c-.445 0-.869.214-1.134.574a1.405 1.405 0 0 0-.259 1.019l-.013.11-.674 4.27-.018.097a.317.317 0 0 1-.200.254.327.327 0 0 1-.11.018H7.266z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-600">{t.paypalPreview || 'PayPal payment will be available here'}</p>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-3">
                    {t.paypalDescription || 'Click continue to be redirected to PayPal to complete your payment securely.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const formDataWithPaymentMethod = {
                        ...formData,
                        paymentMethod: 'paypal'
                      }
                      console.log('💙 PayPal button clicked:', formDataWithPaymentMethod)
                      onSubmit(undefined, formDataWithPaymentMethod)
                    }}
                    className="w-full bg-blue-600 text-white text-center py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    {t.continueWithPaypal || 'Continue with PayPal'}
                  </button>
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