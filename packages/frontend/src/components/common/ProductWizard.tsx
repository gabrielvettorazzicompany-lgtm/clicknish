import { Smartphone, BookOpen, CheckCircle, Check } from 'lucide-react'
import { useState } from 'react'

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

const STEP_LABELS = ['Tipo', 'Informações', 'Suporte', 'Pagamento']

function StepIndicator({ currentStep, maxSteps }: { currentStep: number; maxSteps: number }) {
    const steps = STEP_LABELS.slice(0, maxSteps - 1)
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
    const [priceDisplay, setPriceDisplay] = useState<string>('')
    const [triedToAdvance, setTriedToAdvance] = useState(false)
    const [showCountryDropdown, setShowCountryDropdown] = useState(false)
    const [selectedCountry, setSelectedCountry] = useState({ flag: '🇧🇷', code: '+55', name: 'Brasil' })

    const countries = [
        { flag: '🇧🇷', code: '+55', name: 'Brasil' },
        { flag: '🇺🇸', code: '+1', name: 'Estados Unidos' },
        { flag: '🇵🇹', code: '+351', name: 'Portugal' },
        { flag: '🇦🇴', code: '+244', name: 'Angola' },
        { flag: '🇲🇿', code: '+258', name: 'Moçambique' },
        { flag: '🇦🇷', code: '+54', name: 'Argentina' },
        { flag: '🇨🇱', code: '+56', name: 'Chile' },
        { flag: '🇨🇴', code: '+57', name: 'Colômbia' },
        { flag: '🇲🇽', code: '+52', name: 'México' },
        { flag: '🇵🇪', code: '+51', name: 'Peru' },
        { flag: '🇺🇾', code: '+598', name: 'Uruguai' },
        { flag: '🇵🇾', code: '+595', name: 'Paraguai' },
        { flag: '🇧🇴', code: '+591', name: 'Bolívia' },
        { flag: '🇻🇪', code: '+58', name: 'Venezuela' },
        { flag: '🇪🇨', code: '+593', name: 'Equador' },
        { flag: '🇬🇧', code: '+44', name: 'Reino Unido' },
        { flag: '🇩🇪', code: '+49', name: 'Alemanha' },
        { flag: '🇫🇷', code: '+33', name: 'França' },
        { flag: '🇪🇸', code: '+34', name: 'Espanha' },
        { flag: '🇮🇹', code: '+39', name: 'Itália' },
        { flag: '🇨🇭', code: '+41', name: 'Suíça' },
        { flag: '🇨🇦', code: '+1', name: 'Canadá' },
        { flag: '🇦🇺', code: '+61', name: 'Austrália' },
        { flag: '🇯🇵', code: '+81', name: 'Japão' },
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
            ? 'Nome do seu app'
            : formData.delivery_type === 'community'
                ? 'Nome da área de membros'
                : 'Nome do produto'

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-sm mx-4 bg-[#0d1117] border border-[#1e2433] rounded-2xl shadow-2xl overflow-hidden">

                {/* Step indicator — oculto na tela de sucesso */}
                {currentStep < maxSteps && (
                    <div className="px-6 pt-6 pb-0">
                        <StepIndicator currentStep={currentStep} maxSteps={maxSteps} />
                    </div>
                )}

                <div className="px-6 pb-6">

                    {/* ── Step 1: Tipo de produto ── */}
                    {currentStep === 1 && (
                        <div>
                            <div className="text-center mb-5">
                                <h2 className="text-base font-semibold text-white leading-snug">
                                    Qual <span className="text-blue-400">tipo de produto</span> você vai criar?
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
                                        Aplicativo
                                    </h3>
                                    <p className={`text-[11px] leading-relaxed ${formData.delivery_type === 'app' ? 'text-blue-400/60' : 'text-gray-600'}`}>
                                        App com temas, cores e gestão de usuários.
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
                                        Área de Membros
                                    </h3>
                                    <p className={`text-[11px] leading-relaxed ${formData.delivery_type === 'community' ? 'text-blue-400/60' : 'text-gray-600'}`}>
                                        Módulos, aulas e conteúdo organizado.
                                    </p>
                                </button>
                            </div>

                            <div className="flex gap-2">
                                <button type="button" onClick={handleClose} className="flex-1 py-2 text-xs text-gray-500 border border-[#1e2433] rounded-xl hover:bg-[#111522] transition-colors">
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={nextStep}
                                    disabled={!formData.delivery_type}
                                    className="flex-1 py-2 text-xs bg-blue-500 text-white font-semibold rounded-xl hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                    Continuar
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Step 2: Informações ── */}
                    {currentStep === 2 && (
                        <div>
                            <div className="text-center mb-5">
                                <h2 className="text-base font-semibold text-white leading-snug">
                                    Informações do seu{' '}
                                    <span className="text-blue-400">
                                        {formData.delivery_type === 'app' ? 'app' : 'produto'}
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
                                    <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Categoria</label>
                                    <select
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full px-3 py-2.5 text-xs bg-[#111522] text-white border border-[#1e2433] rounded-xl focus:outline-none focus:border-blue-500/60 appearance-none transition-colors"
                                    >
                                        <option value="">Selecione a categoria</option>
                                        <option value="education">Educação</option>
                                        <option value="health">Saúde</option>
                                        <option value="finance">Finanças</option>
                                        <option value="technology">Tecnologia</option>
                                        <option value="fitness">Fitness</option>
                                        <option value="business">Negócios</option>
                                        <option value="other">Outros</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Descrição</label>
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
                                        placeholder="Descreva seu produto (mínimo 40 caracteres)"
                                    />
                                    <div className="flex items-center justify-between mt-1">
                                        {triedToAdvance && (formData.description || '').length < 40 ? (
                                            <p className="text-[10px] text-red-400">Faltam {40 - (formData.description || '').length} caracteres</p>
                                        ) : (
                                            <span />
                                        )}
                                        <p className="text-[10px] text-gray-700 ml-auto">{(formData.description || '').length}/500</p>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Página de vendas</label>
                                    <input
                                        type="text"
                                        value={formData.sales_page_url}
                                        onChange={(e) => setFormData({ ...formData, sales_page_url: e.target.value })}
                                        className="w-full px-3 py-2.5 text-xs bg-[#111522] text-white border border-[#1e2433] rounded-xl focus:outline-none focus:border-blue-500/60 placeholder-gray-700 transition-colors"
                                        placeholder="https://suapagina.com"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-2 mt-5">
                                <button type="button" onClick={prevStep} className="flex-1 py-2 text-xs text-gray-500 border border-[#1e2433] rounded-xl hover:bg-[#111522] transition-colors">
                                    Voltar
                                </button>
                                <button
                                    type="button"
                                    onClick={nextStep}
                                    disabled={!formData.name}
                                    className="flex-1 py-2 text-xs bg-blue-500 text-white font-semibold rounded-xl hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                    Avançar
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Step 3: Suporte ── */}
                    {currentStep === 3 && (
                        <div>
                            <div className="text-center mb-5">
                                <h2 className="text-base font-semibold text-white leading-snug">
                                    Como seus clientes entram em{' '}
                                    <span className="text-blue-400">contato?</span>
                                </h2>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-[11px] font-medium text-gray-500 mb-1.5">E-mail de suporte</label>
                                    <input
                                        type="email"
                                        value={formData.support_email || ''}
                                        onChange={(e) => setFormData({ ...formData, support_email: e.target.value })}
                                        className="w-full px-3 py-2.5 text-xs bg-[#111522] text-white border border-[#1e2433] rounded-xl focus:outline-none focus:border-blue-500/60 placeholder-gray-700 transition-colors"
                                        placeholder="suporte@seudominio.com"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-medium text-gray-500 mb-1.5">WhatsApp de suporte</label>
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
                                            placeholder="DDD + Número"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2 mt-5">
                                <button type="button" onClick={prevStep} className="flex-1 py-2 text-xs text-gray-500 border border-[#1e2433] rounded-xl hover:bg-[#111522] transition-colors">
                                    Voltar
                                </button>
                                <button
                                    type="button"
                                    onClick={nextStep}
                                    className="flex-1 py-2 text-xs bg-blue-500 text-white font-semibold rounded-xl hover:bg-blue-600 transition-colors"
                                >
                                    Avançar
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
                                    Defina o <span className="text-blue-400">preço</span> do seu produto
                                </h2>
                            </div>

                            {/* Badge de tipo de pagamento */}
                            <div className="flex items-center gap-2 px-3 py-2.5 bg-blue-500/8 border border-blue-500/20 rounded-xl mb-4">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                                <span className="text-xs text-blue-300 font-medium">Pagamento único</span>
                            </div>

                            <div>
                                <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Valor da oferta principal</label>
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
                                    Voltar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2 text-xs bg-blue-500 text-white font-semibold rounded-xl hover:bg-blue-600 transition-colors"
                                >
                                    {formData.delivery_type === 'app' ? 'Criar App' : 'Criar produto'}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* ── Step 5: Sucesso ── */}
                    {currentStep === 5 && (
                        <div className="text-center py-4">
                            <div className="flex justify-center mb-4">
                                <div className="w-14 h-14 rounded-full bg-blue-500/10 border border-blue-500/25 flex items-center justify-center">
                                    <CheckCircle className="w-7 h-7 text-blue-400" />
                                </div>
                            </div>

                            <h2 className="text-base font-semibold text-white mb-1">
                                Produto enviado para <span className="text-blue-400">análise!</span>
                            </h2>
                            <p className="text-xs text-gray-500 mb-6 leading-relaxed">
                                Seu produto foi criado com sucesso e está em processo de revisão.
                                Você será notificado quando ele for aprovado.
                            </p>

                            <button
                                type="button"
                                onClick={handleClose}
                                className="w-full py-2 text-xs bg-blue-500 text-white font-semibold rounded-xl hover:bg-blue-600 transition-colors"
                            >
                                Fechar
                            </button>
                        </div>
                    )}

                </div>
            </div>
        </div>
    )
}
