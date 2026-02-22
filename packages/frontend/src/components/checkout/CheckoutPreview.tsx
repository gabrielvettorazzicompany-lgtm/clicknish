import { Lock, CreditCard, Smartphone, CheckCircle, ShieldCheck } from 'lucide-react'
import { useI18n } from '@/i18n'

interface Product {
    name: string
    price: number
    image_url?: string
    description?: string
}

interface CustomBanner {
    image?: string
    title?: string
    subtitle?: string
    description?: string
}

interface CheckoutPreviewProps {
    product: Product
    customBanner?: CustomBanner
}

export default function CheckoutPreview({ product, customBanner }: CheckoutPreviewProps) {
    const { t } = useI18n()
    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(price)
    }

    return (
        <div className="min-h-screen bg-[#0f1117]">
            {/* Header com Banner Customizável */}
            <header className="bg-gradient-to-r from-teal-500 to-teal-600 text-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="py-8 lg:py-16 text-center">
                        {customBanner?.image && (
                            <div className="mb-6 flex justify-center">
                                <img
                                    src={customBanner.image}
                                    alt="Banner"
                                    className="h-24 w-24 lg:h-32 lg:w-32 object-cover rounded-full border-4 border-white/20"
                                />
                            </div>
                        )}

                        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4" style={{ letterSpacing: '-0.02em' }}>
                            {customBanner?.title || t('checkout_pages.get_product', { name: product.name })}
                        </h1>

                        {customBanner?.subtitle && (
                            <p className="text-lg sm:text-xl text-teal-100 mb-4">
                                {customBanner.subtitle}
                            </p>
                        )}

                        {customBanner?.description && (
                            <p className="text-base text-teal-50 max-w-2xl mx-auto px-4">
                                {customBanner.description}
                            </p>
                        )}

                        <div className="flex items-center justify-center gap-2 text-green-200 mt-6">
                            <Lock size={14} />
                            <span className="text-xs font-normal tracking-wide uppercase">{t('checkout_pages.secure_purchase_label')}</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Conteúdo Principal */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
                    {/* Formulário - 3 colunas */}
                    <div className="lg:col-span-3 space-y-6">
                        {/* Dados Pessoais */}
                        <div className="bg-[#1a1d2e] rounded-lg p-4 sm:p-6 lg:p-8 shadow-xl shadow-black/10 shadow-black/5 border border-[#1e2139]">
                            <h2 className="text-lg font-semibold text-gray-100 mb-6">{t('checkout_pages.personal_information')}</h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        {t('checkout_pages.email')}*
                                    </label>
                                    <input
                                        type="email"
                                        className="w-full px-4 py-3 border border-[#252941] rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-blue-500 transition-all text-sm"
                                        placeholder={t('checkout_pages.email_placeholder')}
                                        disabled
                                    />
                                    <p className="text-xs text-gray-500 mt-1">{t('checkout_pages.email_access_info')}</p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            {t('checkout_pages.full_name')}*
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full px-4 py-3 border border-[#252941] rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-blue-500 transition-all text-sm"
                                            placeholder={t('checkout_pages.name_placeholder')}
                                            disabled
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            {t('checkout_pages.whatsapp')}
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full px-4 py-3 border border-[#252941] rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-blue-500 transition-all text-sm"
                                            placeholder={t('checkout_pages.whatsapp_placeholder')}
                                            disabled
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Pagamento */}
                        <div className="bg-[#1a1d2e] rounded-lg p-4 sm:p-6 lg:p-8 shadow-xl shadow-black/10 shadow-black/5 border border-[#1e2139]">
                            <h2 className="text-lg font-semibold text-gray-100 mb-6">{t('checkout_pages.payment_method')}</h2>

                            {/* PIX */}
                            <div className="mb-6 p-4 border-2 border-green-200 bg-green-50 rounded-lg">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                                        <CheckCircle className="w-4 h-4 text-white" />
                                    </div>
                                    <span className="font-medium text-green-800">{t('checkout_pages.pix_cash_payment')}</span>
                                    <span className="ml-auto text-sm bg-green-600 text-white px-2 py-1 rounded-full">
                                        {t('checkout_pages.recommended')}
                                    </span>
                                </div>
                                <p className="text-lg font-bold text-green-800 mb-1">{formatPrice(product.price)}</p>
                                <p className="text-sm text-green-700">• {t('checkout_pages.immediate_approval')}</p>
                            </div>

                            {/* Cartão */}
                            <div className="p-4 border border-[#1e2139] rounded-lg">
                                <div className="flex items-center gap-3 mb-3">
                                    <CreditCard className="w-6 h-6 text-gray-600" />
                                    <span className="font-medium text-gray-300">{t('checkout_pages.credit_card')}</span>
                                </div>
                                <p className="text-lg font-semibold text-gray-100 mb-2">{formatPrice(product.price)}</p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    <div className="bg-[#252941] p-3 rounded text-center">
                                        <div className="text-sm font-medium">1x</div>
                                        <div className="text-xs text-gray-600">{formatPrice(product.price)}</div>
                                    </div>
                                    <div className="bg-[#252941] p-3 rounded text-center">
                                        <div className="text-sm font-medium">2x</div>
                                        <div className="text-xs text-gray-600">{formatPrice(product.price / 2)}</div>
                                    </div>
                                    <div className="bg-[#252941] p-3 rounded text-center">
                                        <div className="text-sm font-medium">3x</div>
                                        <div className="text-xs text-gray-600">{formatPrice(product.price / 3)}</div>
                                    </div>
                                    <div className="bg-[#252941] p-3 rounded text-center">
                                        <div className="text-sm font-medium">6x</div>
                                        <div className="text-xs text-gray-600">{formatPrice(product.price / 6)}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Resumo - 2 colunas */}
                    <div className="lg:col-span-2">
                        <div className="bg-[#1a1d2e] rounded-lg p-4 sm:p-6 lg:p-8 shadow-xl shadow-black/10 shadow-black/5 border border-[#1e2139] sticky top-6">
                            <h2 className="text-lg font-semibold text-gray-100 mb-6">{t('checkout_pages.order_summary')}</h2>

                            {/* Produto */}
                            <div className="flex gap-4 mb-6 p-4 bg-[#0f1117] rounded-lg">
                                {product.image_url ? (
                                    <img
                                        src={product.image_url}
                                        alt={product.name}
                                        className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg flex-shrink-0"
                                    />
                                ) : (
                                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[#252941] rounded-lg flex items-center justify-center flex-shrink-0">
                                        <Smartphone className="w-8 h-8 text-gray-400" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-medium text-gray-100 text-sm sm:text-base break-words">{product.name}</h3>
                                    <p className="text-sm text-gray-600">{t('checkout_pages.digital_product')}</p>
                                    <p className="text-lg font-bold text-gray-100 mt-1">{formatPrice(product.price)}</p>
                                </div>
                            </div>

                            {/* Garantia */}
                            <div className="mb-6 p-4 bg-blue-500/10 border border-blue-200 rounded-lg">
                                <div className="flex items-center gap-2 text-blue-800 mb-2">
                                    <ShieldCheck className="w-5 h-5" />
                                    <span className="font-medium text-sm">{t('checkout_pages.guarantee_7_day')}</span>
                                </div>
                                <p className="text-xs text-blue-700">
                                    {t('checkout_pages.guarantee_refund_text')}
                                </p>
                            </div>

                            {/* Total */}
                            <div className="border-t border-[#1e2139] pt-4 mb-6">
                                <div className="flex justify-between items-center text-lg font-bold text-gray-100">
                                    <span>{t('checkout_pages.total')}</span>
                                    <span>{formatPrice(product.price)}</span>
                                </div>
                            </div>

                            {/* Botão de Finalizar */}
                            <button
                                className="w-full bg-blue-500 text-white py-4 px-6 rounded-lg font-medium text-base hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled
                            >
                                {t('checkout_pages.complete_purchase')}
                            </button>

                            <div className="text-center mt-4">
                                <div className="flex items-center justify-center gap-2 text-gray-500 text-xs">
                                    <Lock size={12} />
                                    <span>{t('checkout_pages.ssl_protected')}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}