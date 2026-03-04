import { Smartphone, BookOpen, Check } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '@/i18n'

interface FormData {
    name: string
    description: string
    price: number
    currency: 'USD' | 'CHF' | 'BRL'
    category: string
    status: 'active' | 'inactive' | 'draft'
    image_url: string
    marketplace_enabled: boolean
    delivery_type: string
    payment_type: 'unique' | 'recurrent'
    sales_page_url: string
    recurrence_period: 'monthly' | 'quarterly' | 'semiannual' | 'annual'
    support_email: string
    support_whatsapp: string
}

interface ProductWizardProps {
    isOpen: boolean
    onClose: () => void
    currentStep: number
    setCurrentStep: (step: number) => void
    maxSteps: number
    formData: FormData
    setFormData: (data: FormData) => void
    showPaymentConfig: boolean
    setShowPaymentConfig: (show: boolean) => void
    onSave: (e: React.FormEvent, customFormData?: FormData) => void
    editingProduct: any
    formatCurrency: (value: number) => string
    handleCurrencyInput: (value: string) => string
    parseCurrency: (value: string) => number
}

function StepIndicator({ currentStep, maxSteps, stepLabels }: { currentStep: number; maxSteps: number; stepLabels: string[] }) {
    const steps = stepLabels.slice(0, maxSteps - 1)
    return (
        <div className="flex items-center justify-center w-full mb-6">
            {steps.map((label, idx) => {
                const stepNum = idx + 1
                const isCompleted = currentStep > stepNum
                const isActive = currentStep === stepNum
                return (
                    <div key={stepNum} className="flex items-center">
                        <div className="flex flex-col items-center gap-1">
                            <div
                                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all border ${isCompleted
                                    ? 'bg-blue-500 border-blue-500 text-white'
                                    : isActive
                                        ? 'bg-blue-500/15 border-blue-500 text-blue-400'
                                        : 'bg-transparent border-[#2a2f45] text-gray-600'
                                    }`}
                            >
                                {isCompleted ? <Check size={13} /> : stepNum}
                            </div>
                            <span className={`text-[9px] font-medium whitespace-nowrap ${isActive ? 'text-blue-400' : isCompleted ? 'text-gray-400' : 'text-gray-600'}`}>
                                {label}
                            </span>
                        </div>
                        {idx < steps.length - 1 && (
                            <div className={`h-px w-8 mb-3.5 mx-1 transition-all ${isCompleted ? 'bg-blue-500' : 'bg-[#2a2f45]'}`} />
                        )}
                    </div>
                )
            })}
        </div>
    )
}

export default function ProductWizard({
    isOpen,
    onClose,
    currentStep,
    setCurrentStep,
    maxSteps,
    formData,
    setFormData,
    showPaymentConfig,
    setShowPaymentConfig,
    onSave,
    editingProduct,
    formatCurrency,
    handleCurrencyInput,
    parseCurrency
}: ProductWizardProps) {
    const { t } = useI18n()
    const [priceDisplay, setPriceDisplay] = useState<string>('')
    const [triedToAdvance, setTriedToAdvance] = useState(false)
    const [showCountryDropdown, setShowCountryDropdown] = useState(false)
    const [selectedCountry, setSelectedCountry] = useState({ flag: '🇧🇷', code: '+55', name: 'Brasil' })

    const stepLabels = [
        t('components.product_wizard.step_type'),
        t('components.product_wizard.step_info'),
        t('components.product_wizard.step_support'),
        t('components.product_wizard.step_payment')
    ]

    const countries = [
        // Países lusófonos
        { flag: '🇧🇷', code: '+55', name: 'Brasil' },
        { flag: '🇵🇹', code: '+351', name: 'Portugal' },
        { flag: '🇦🇴', code: '+244', name: 'Angola' },
        { flag: '🇲🇿', code: '+258', name: 'Moçambique' },
        { flag: '🇨🇻', code: '+238', name: 'Cabo Verde' },
        { flag: '🇬🇼', code: '+245', name: 'Guiné-Bissau' },
        { flag: '🇸🇹', code: '+239', name: 'São Tomé e Príncipe' },
        { flag: '🇹🇱', code: '+670', name: 'Timor-Leste' },

        // América Latina (espanhol)
        { flag: '🇦🇷', code: '+54', name: 'Argentina' },
        { flag: '🇧🇴', code: '+591', name: 'Bolívia' },
        { flag: '🇨🇱', code: '+56', name: 'Chile' },
        { flag: '🇨🇴', code: '+57', name: 'Colômbia' },
        { flag: '🇨🇷', code: '+506', name: 'Costa Rica' },
        { flag: '🇨🇺', code: '+53', name: 'Cuba' },
        { flag: '🇩🇴', code: '+1-809', name: 'República Dominicana' },
        { flag: '🇪🇨', code: '+593', name: 'Equador' },
        { flag: '🇸🇻', code: '+503', name: 'El Salvador' },
        { flag: '🇬🇹', code: '+502', name: 'Guatemala' },
        { flag: '🇭🇳', code: '+504', name: 'Honduras' },
        { flag: '🇲🇽', code: '+52', name: 'México' },
        { flag: '🇳🇮', code: '+505', name: 'Nicarágua' },
        { flag: '🇵🇦', code: '+507', name: 'Panamá' },
        { flag: '🇵🇾', code: '+595', name: 'Paraguai' },
        { flag: '🇵🇪', code: '+51', name: 'Peru' },
        { flag: '🇵🇷', code: '+1-787', name: 'Porto Rico' },
        { flag: '🇺🇾', code: '+598', name: 'Uruguai' },
        { flag: '🇻🇪', code: '+58', name: 'Venezuela' },

        // América do Norte
        { flag: '🇺🇸', code: '+1', name: 'Estados Unidos' },
        { flag: '🇨🇦', code: '+1', name: 'Canadá' },

        // Europa Ocidental
        { flag: '🇪🇸', code: '+34', name: 'Espanha' },
        { flag: '🇫🇷', code: '+33', name: 'França' },
        { flag: '🇩🇪', code: '+49', name: 'Alemanha' },
        { flag: '🇮🇹', code: '+39', name: 'Itália' },
        { flag: '🇬🇧', code: '+44', name: 'Reino Unido' },
        { flag: '🇨🇭', code: '+41', name: 'Suíça' },
        { flag: '🇧🇪', code: '+32', name: 'Bélgica' },
        { flag: '🇳🇱', code: '+31', name: 'Holanda' },
        { flag: '🇦🇹', code: '+43', name: 'Áustria' },
        { flag: '🇮🇪', code: '+353', name: 'Irlanda' },
        { flag: '🇱🇺', code: '+352', name: 'Luxemburgo' },

        // Europa do Norte
        { flag: '🇸🇪', code: '+46', name: 'Suécia' },
        { flag: '🇳🇴', code: '+47', name: 'Noruega' },
        { flag: '🇩🇰', code: '+45', name: 'Dinamarca' },
        { flag: '🇫🇮', code: '+358', name: 'Finlândia' },
        { flag: '🇮🇸', code: '+354', name: 'Islândia' },

        // Europa do Sul
        { flag: '🇬🇷', code: '+30', name: 'Grécia' },
        { flag: '🇹🇷', code: '+90', name: 'Turquia' },

        // Europa do Leste
        { flag: '🇵🇱', code: '+48', name: 'Polônia' },
        { flag: '🇨🇿', code: '+420', name: 'República Tcheca' },
        { flag: '🇭🇺', code: '+36', name: 'Hungria' },
        { flag: '🇷🇴', code: '+40', name: 'Romênia' },
        { flag: '🇧🇬', code: '+359', name: 'Bulgária' },
        { flag: '🇷🇺', code: '+7', name: 'Rússia' },
        { flag: '🇺🇦', code: '+380', name: 'Ucrânia' },

        // Ásia
        { flag: '🇯🇵', code: '+81', name: 'Japão' },
        { flag: '🇨🇳', code: '+86', name: 'China' },
        { flag: '🇰🇷', code: '+82', name: 'Coreia do Sul' },
        { flag: '🇮🇳', code: '+91', name: 'Índia' },
        { flag: '🇮🇩', code: '+62', name: 'Indonésia' },
        { flag: '🇹🇭', code: '+66', name: 'Tailândia' },
        { flag: '🇻🇳', code: '+84', name: 'Vietnã' },
        { flag: '🇵🇭', code: '+63', name: 'Filipinas' },
        { flag: '🇲🇾', code: '+60', name: 'Malásia' },
        { flag: '🇸🇬', code: '+65', name: 'Singapura' },
        { flag: '🇦🇪', code: '+971', name: 'Emirados Árabes' },
        { flag: '🇸🇦', code: '+966', name: 'Arábia Saudita' },
        { flag: '🇮🇱', code: '+972', name: 'Israel' },
        { flag: '🇵🇰', code: '+92', name: 'Paquistão' },
        { flag: '🇧🇩', code: '+880', name: 'Bangladesh' },

        // Oceania
        { flag: '🇦🇺', code: '+61', name: 'Austrália' },
        { flag: '🇳🇿', code: '+64', name: 'Nova Zelândia' },

        // África
        { flag: '🇿🇦', code: '+27', name: 'África do Sul' },
        { flag: '🇪🇬', code: '+20', name: 'Egito' },
        { flag: '🇳🇬', code: '+234', name: 'Nigéria' },
        { flag: '🇰🇪', code: '+254', name: 'Quênia' },
        { flag: '🇬🇭', code: '+233', name: 'Gana' },
        { flag: '🇪🇹', code: '+251', name: 'Etiópia' },
        { flag: '🇹🇿', code: '+255', name: 'Tanzânia' },
        { flag: '🇺🇬', code: '+256', name: 'Uganda' },
        { flag: '🇲🇦', code: '+212', name: 'Marrocos' },
        { flag: '🇩🇿', code: '+213', name: 'Argélia' },
        { flag: '🇹🇳', code: '+216', name: 'Tunísia' },

        // Caribe
        { flag: '🇯🇲', code: '+1-876', name: 'Jamaica' },
        { flag: '🇹🇹', code: '+1-868', name: 'Trinidad e Tobago' },
        { flag: '🇧🇸', code: '+1-242', name: 'Bahamas' },
        { flag: '🇧🇧', code: '+1-246', name: 'Barbados' },
    ]

    if (!isOpen) return null

    const handlePriceInput = (value: string) => {
        let cleaned = value.replace(/[^\d,]/g, '')
        const parts = cleaned.split(',')
        if (parts.length > 2) {
            cleaned = parts[0] + ',' + parts.slice(1).join('')
        }
        if (parts.length === 2 && parts[1].length > 2) {
            cleaned = parts[0] + ',' + parts[1].substring(0, 2)
        }
        const [intPart, decPart] = cleaned.split(',')
        let formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
        if (cleaned.includes(',')) {
            formatted += ',' + (decPart || '')
        }
        setPriceDisplay(formatted)
        const numValue = parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) || 0
        setFormData({ ...formData, price: numValue })
    }

    const nextStep = () => {
        if (currentStep === 2 && (formData.description || '').length < 40) {
            setTriedToAdvance(true)
            return
        }
        setTriedToAdvance(false)
        if (currentStep < maxSteps) {
            setCurrentStep(currentStep + 1)
        }
    }

    const prevStep = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1)
        }
    }

    const handleClose = () => {
        onClose()
        setCurrentStep(1)
        setShowPaymentConfig(false)
    }

    const namePlaceholder =
        formData.delivery_type === 'app'
            ? t('components.product_wizard.app_name_placeholder')
            : formData.delivery_type === 'community'
                ? t('components.product_wizard.members_area_name_placeholder')
                : t('components.product_wizard.product_name_placeholder')

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-sm mx-4 bg-[#0d1117] border border-[#1e2433] rounded-2xl shadow-2xl overflow-hidden">

                {/* Step indicator — oculto na tela de sucesso */}
                {currentStep < maxSteps && (
                    <div className="px-6 pt-6 pb-0">
                        <StepIndicator currentStep={currentStep} maxSteps={maxSteps} stepLabels={stepLabels} />
                    </div>
                )}

                <div className="px-6 pb-6">

                    {/* ── Step 1: Tipo de produto ── */}
                    {currentStep === 1 && (
                        <div>
                            <div className="text-center mb-5">
                                <h2 className="text-base font-semibold text-white leading-snug">
                                    {t('components.product_wizard.question_title')} <span className="text-blue-400">{t('components.product_wizard.product_type')}</span> {t('components.product_wizard.question_subtitle')}
                                </h2>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-5">
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, delivery_type: 'app' })}
                                    className={`text-left p-3.5 rounded-xl border transition-all ${formData.delivery_type === 'app'
                                        ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/20'
                                        : 'border-[#1e2433] bg-[#111522] hover:border-[#2a3045]'
                                        }`}
                                >
                                    <Smartphone className={`w-5 h-5 mb-2 ${formData.delivery_type === 'app' ? 'text-blue-400' : 'text-gray-500'}`} />
                                    <h3 className={`font-semibold text-xs mb-1 ${formData.delivery_type === 'app' ? 'text-blue-400' : 'text-white'}`}>
                                        {t('components.product_wizard.app_title')}
                                    </h3>
                                    <p className={`text-[11px] leading-relaxed ${formData.delivery_type === 'app' ? 'text-blue-400/60' : 'text-gray-600'}`}>
                                        {t('components.product_wizard.app_description')}
                                    </p>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, delivery_type: 'community' })}
                                    className={`text-left p-3.5 rounded-xl border transition-all ${formData.delivery_type === 'community'
                                        ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/20'
                                        : 'border-[#1e2433] bg-[#111522] hover:border-[#2a3045]'
                                        }`}
                                >
                                    <BookOpen className={`w-5 h-5 mb-2 ${formData.delivery_type === 'community' ? 'text-blue-400' : 'text-gray-500'}`} />
                                    <h3 className={`font-semibold text-xs mb-1 ${formData.delivery_type === 'community' ? 'text-blue-400' : 'text-white'}`}>
                                        {t('components.product_wizard.members_area_title')}
                                    </h3>
                                    <p className={`text-[11px] leading-relaxed ${formData.delivery_type === 'community' ? 'text-blue-400/60' : 'text-gray-600'}`}>
                                        {t('components.product_wizard.members_area_description')}
                                    </p>
                                </button>
                            </div>

                            <div className="flex gap-2">
                                <button type="button" onClick={handleClose} className="flex-1 py-2 text-xs text-gray-500 border border-[#1e2433] rounded-xl hover:bg-[#111522] transition-colors">
                                    {t('components.product_wizard.cancel')}
                                </button>
                                <button
                                    type="button"
                                    onClick={nextStep}
                                    disabled={!formData.delivery_type}
                                    className="flex-1 py-2 text-xs bg-blue-500 text-white font-semibold rounded-xl hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                    {t('components.product_wizard.continue')}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Step 2: Informações ── */}
                    {currentStep === 2 && (
                        <div>
                            <div className="text-center mb-5">
                                <h2 className="text-base font-semibold text-white leading-snug">
                                    {t('components.product_wizard.info_title')}{' '}
                                    <span className="text-blue-400">
                                        {formData.delivery_type === 'app' ? t('components.product_wizard.info_app') : t('components.product_wizard.info_product')}
                                    </span>
                                </h2>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-[11px] font-medium text-gray-500 mb-1.5">{namePlaceholder}</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-3 py-2.5 text-xs bg-[#111522] text-white border border-[#1e2433] rounded-xl focus:outline-none focus:border-blue-500/60 placeholder-gray-700 transition-colors"
                                        placeholder={namePlaceholder}
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-medium text-gray-500 mb-1.5">{t('components.product_wizard.category')}</label>
                                    <select
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full px-3 py-2.5 text-xs bg-[#111522] text-white border border-[#1e2433] rounded-xl focus:outline-none focus:border-blue-500/60 appearance-none transition-colors"
                                    >
                                        <option value="">{t('components.product_wizard.select_category')}</option>
                                        <option value="education">{t('components.product_wizard.education')}</option>
                                        <option value="health">{t('components.product_wizard.health')}</option>
                                        <option value="finance">{t('components.product_wizard.finance')}</option>
                                        <option value="technology">{t('components.product_wizard.technology')}</option>
                                        <option value="fitness">{t('components.product_wizard.fitness')}</option>
                                        <option value="business">{t('components.product_wizard.business')}</option>
                                        <option value="other">{t('components.product_wizard.others')}</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-medium text-gray-500 mb-1.5">{t('components.product_wizard.description')}</label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => {
                                            if (e.target.value.length <= 500) {
                                                setFormData({ ...formData, description: e.target.value })
                                            }
                                        }}
                                        rows={3}
                                        className={`w-full px-3 py-2.5 text-xs bg-[#111522] text-white border rounded-xl focus:outline-none placeholder-gray-700 resize-none transition-colors ${triedToAdvance && (formData.description || '').length < 40
                                            ? 'border-red-500/60 focus:border-red-500'
                                            : 'border-[#1e2433] focus:border-blue-500/60'
                                            }`}
                                        placeholder={t('components.product_wizard.describe_product')}
                                    />
                                    <div className="flex items-center justify-between mt-1">
                                        {triedToAdvance && (formData.description || '').length < 40 ? (
                                            <p className="text-[10px] text-red-400">{t('components.product_wizard.characters_missing', { count: 40 - (formData.description || '').length })}</p>
                                        ) : (
                                            <span />
                                        )}
                                        <p className="text-[10px] text-gray-700 ml-auto">{(formData.description || '').length}/500</p>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-medium text-gray-500 mb-1.5">{t('components.product_wizard.sales_page')}</label>
                                    <input
                                        type="text"
                                        value={formData.sales_page_url}
                                        onChange={(e) => setFormData({ ...formData, sales_page_url: e.target.value })}
                                        className="w-full px-3 py-2.5 text-xs bg-[#111522] text-white border border-[#1e2433] rounded-xl focus:outline-none focus:border-blue-500/60 placeholder-gray-700 transition-colors"
                                        placeholder={t('components.product_wizard.sales_page_placeholder')}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-2 mt-5">
                                <button type="button" onClick={prevStep} className="flex-1 py-2 text-xs text-gray-500 border border-[#1e2433] rounded-xl hover:bg-[#111522] transition-colors">
                                    {t('components.product_wizard.back')}
                                </button>
                                <button
                                    type="button"
                                    onClick={nextStep}
                                    disabled={!formData.name}
                                    className="flex-1 py-2 text-xs bg-blue-500 text-white font-semibold rounded-xl hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                    {t('components.product_wizard.advance')}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Step 3: Suporte ── */}
                    {currentStep === 3 && (
                        <div>
                            <div className="text-center mb-5">
                                <h2 className="text-base font-semibold text-white leading-snug">
                                    {t('components.product_wizard.support_title')}{' '}
                                    <span className="text-blue-400">{t('components.product_wizard.contact')}</span>
                                </h2>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-[11px] font-medium text-gray-500 mb-1.5">{t('components.product_wizard.support_email')}</label>
                                    <input
                                        type="email"
                                        value={formData.support_email || ''}
                                        onChange={(e) => setFormData({ ...formData, support_email: e.target.value })}
                                        className="w-full px-3 py-2.5 text-xs bg-[#111522] text-white border border-[#1e2433] rounded-xl focus:outline-none focus:border-blue-500/60 placeholder-gray-700 transition-colors"
                                        placeholder={t('components.product_wizard.email_placeholder')}
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-medium text-gray-500 mb-1.5">{t('components.product_wizard.support_whatsapp')}</label>
                                    <div className="flex relative">
                                        <button
                                            type="button"
                                            onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                                            className="flex items-center gap-1.5 px-2.5 bg-[#111522] border border-r-0 border-[#1e2433] rounded-l-xl hover:bg-[#1a1f2e] transition-colors"
                                        >
                                            <span className="text-sm">{selectedCountry.flag}</span>
                                            <span className="text-xs text-gray-300">{selectedCountry.code}</span>
                                            <svg className="w-2.5 h-2.5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                        </button>
                                        {showCountryDropdown && (
                                            <div className="absolute top-full left-0 mt-1 w-52 bg-[#111522] border border-[#1e2433] rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto">
                                                {countries.map((c) => (
                                                    <button
                                                        key={c.name}
                                                        type="button"
                                                        onClick={() => { setSelectedCountry(c); setShowCountryDropdown(false) }}
                                                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-white hover:bg-[#1a1f2e] transition-colors text-left"
                                                    >
                                                        <span className="text-sm">{c.flag}</span>
                                                        <span className="text-gray-500">{c.code}</span>
                                                        <span className="text-gray-300">{c.name}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        <input
                                            type="tel"
                                            value={formData.support_whatsapp || ''}
                                            onChange={(e) => setFormData({ ...formData, support_whatsapp: e.target.value })}
                                            className="flex-1 px-3 py-2.5 text-xs bg-[#111522] text-white border border-[#1e2433] rounded-r-xl focus:outline-none focus:border-blue-500/60 placeholder-gray-700 transition-colors"
                                            placeholder={t('components.product_wizard.whatsapp_placeholder')}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2 mt-5">
                                <button type="button" onClick={prevStep} className="flex-1 py-2 text-xs text-gray-500 border border-[#1e2433] rounded-xl hover:bg-[#111522] transition-colors">
                                    {t('components.product_wizard.back')}
                                </button>
                                <button
                                    type="button"
                                    onClick={nextStep}
                                    className="flex-1 py-2 text-xs bg-blue-500 text-white font-semibold rounded-xl hover:bg-blue-600 transition-colors"
                                >
                                    {t('components.product_wizard.advance')}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Step 4: Pagamento ── */}
                    {currentStep === 4 && (
                        <form onSubmit={(e) => {
                            const data: FormData = { ...formData, payment_type: 'unique' }
                            onSave(e, data)
                        }}>
                            <div className="text-center mb-5">
                                <h2 className="text-base font-semibold text-white leading-snug">
                                    {t('components.product_wizard.price_title')} <span className="text-blue-400">{t('components.product_wizard.price_section')}</span> {t('components.product_wizard.price_subtitle')}
                                </h2>
                            </div>

                            {/* Badge de tipo de pagamento */}
                            <div className="flex items-center gap-2 px-3 py-2.5 bg-blue-500/8 border border-blue-500/20 rounded-xl mb-4">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                                <span className="text-xs text-blue-300 font-medium">{t('components.product_wizard.single_payment')}</span>
                            </div>

                            <div>
                                <label className="block text-[11px] font-medium text-gray-500 mb-1.5">{t('components.product_wizard.main_offer_value')}</label>
                                <div className="flex">
                                    <input
                                        type="text"
                                        value={priceDisplay || (formData.price > 0 ? `${formData.price.toFixed(2).replace('.', ',')}` : '')}
                                        onChange={(e) => handlePriceInput(e.target.value)}
                                        className="flex-1 px-3 py-2.5 text-xs bg-[#111522] text-white border border-r-0 border-[#1e2433] rounded-l-xl focus:outline-none focus:border-blue-500/60 placeholder-gray-700 tabular-nums transition-colors"
                                        placeholder={
                                            formData.currency === 'BRL' ? 'R$ 0,00' :
                                                formData.currency === 'USD' ? '$ 0.00' :
                                                    'CHF 0.00'
                                        }
                                    />
                                    <select
                                        value={formData.currency}
                                        onChange={(e) => setFormData({ ...formData, currency: e.target.value as 'USD' | 'CHF' | 'BRL' })}
                                        className="px-3 py-2.5 text-xs bg-[#111522] text-white border border-[#1e2433] rounded-r-xl focus:outline-none focus:border-blue-500/60 appearance-none transition-colors"
                                    >
                                        <option value="BRL">BRL</option>
                                        <option value="USD">USD</option>
                                        <option value="CHF">CHF</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex gap-2 mt-5">
                                <button type="button" onClick={prevStep} className="flex-1 py-2 text-xs text-gray-500 border border-[#1e2433] rounded-xl hover:bg-[#111522] transition-colors">
                                    {t('components.product_wizard.back')}
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2 text-xs bg-blue-500 text-white font-semibold rounded-xl hover:bg-blue-600 transition-colors"
                                >
                                    {formData.delivery_type === 'app' ? t('components.product_wizard.create_app') : t('components.product_wizard.create_product')}
                                </button>
                            </div>
                        </form>
                    )}

                </div>
            </div>
        </div>
    )
}
