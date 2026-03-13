import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Store, Smartphone, Users, Check, ArrowRight, Plus, X, FileText, Video, Image, Link } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { useI18n } from '@/i18n'
import { useOnboarding } from '@/contexts/OnboardingContext'

type Step = 'marketplace' | 'type' | 'form' | 'modules' | 'checkout'
type ProductType = 'app' | 'community'
type ContentType = 'text' | 'video' | 'image' | 'link'

interface ModuleContent {
    id: string
    type: ContentType
    title: string
    content: string
    order: number
}

interface ProductModule {
    id: string
    name: string
    description: string
    contents: ModuleContent[]
    order: number
}

interface CheckoutSettings {
    theme: 'yampi' | 'cygnuss' | 'custom'
    primaryColor: string
    logo: File | null
    backgroundColor: string
    showCompanyInfo: boolean
    requirePhone: boolean
    requireAddress: boolean
    paymentMethods: {
        creditCard: boolean
        pix: boolean
        boleto: boolean
    }
    customCss: string
}

function CreateProduct() {
    const { t } = useI18n()
    const navigate = useNavigate()
    const { completeStep, currentStep } = useOnboarding()
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [step, setStep] = useState<Step>('marketplace')
    const [isMarketplace, setIsMarketplace] = useState<boolean | null>(null)
    const [productType, setProductType] = useState<ProductType | null>(null)
    const [modules, setModules] = useState<ProductModule[]>([])
    const [activeModuleId, setActiveModuleId] = useState<string | null>(null)
    const [checkoutSettings, setCheckoutSettings] = useState<CheckoutSettings>({
        theme: 'yampi',
        primaryColor: '#3B82F6',
        logo: null,
        backgroundColor: '#F8F6F3',
        showCompanyInfo: true,
        requirePhone: true,
        requireAddress: false,
        paymentMethods: {
            creditCard: true,
            pix: true,
            boleto: false
        },
        customCss: ''
    })

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: '',
        currency: 'USD' as 'USD' | 'EUR' | 'CHF',
        commission: '',
        image: null as File | null
    })

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFormData(prev => ({ ...prev, image: e.target.files![0] }))
        }
    }

    const handleMarketplaceChoice = (choice: boolean) => {
        setIsMarketplace(choice)
        setStep('type')
    }

    const handleTypeChoice = (type: ProductType) => {
        setProductType(type)

        if (type === 'app') {
            // Redirecionar para o app builder quando escolher App Personalizado
            navigate('/app-builder/new')
        } else if (type === 'community' && !isMarketplace) {
            setStep('modules')
        } else {
            setStep('form')
        }
    }

    const addModule = () => {
        const newModule: ProductModule = {
            id: Date.now().toString(),
            name: `Module ${modules.length + 1}`,
            description: '',
            contents: [],
            order: modules.length
        }
        setModules([...modules, newModule])
        setActiveModuleId(newModule.id)
    }

    const updateModule = (moduleId: string, updates: Partial<ProductModule>) => {
        setModules(modules.map(mod =>
            mod.id === moduleId ? { ...mod, ...updates } : mod
        ))
    }

    const deleteModule = (moduleId: string) => {
        setModules(modules.filter(mod => mod.id !== moduleId))
        if (activeModuleId === moduleId) {
            setActiveModuleId(modules[0]?.id || null)
        }
    }

    const addContentToModule = (moduleId: string, contentType: ContentType) => {
        const newContent: ModuleContent = {
            id: Date.now().toString(),
            type: contentType,
            title: `${contentType === 'text' ? 'Text' : contentType === 'video' ? 'Video' : contentType === 'image' ? 'Image' : 'Link'} ${modules.find(m => m.id === moduleId)?.contents.length + 1 || 1}`,
            content: '',
            order: modules.find(m => m.id === moduleId)?.contents.length || 0
        }

        setModules(modules.map(mod =>
            mod.id === moduleId
                ? { ...mod, contents: [...mod.contents, newContent] }
                : mod
        ))
    }

    const updateModuleContent = (moduleId: string, contentId: string, updates: Partial<ModuleContent>) => {
        setModules(modules.map(mod =>
            mod.id === moduleId
                ? {
                    ...mod,
                    contents: mod.contents.map(content =>
                        content.id === contentId ? { ...content, ...updates } : content
                    )
                }
                : mod
        ))
    }

    const deleteModuleContent = (moduleId: string, contentId: string) => {
        setModules(modules.map(mod =>
            mod.id === moduleId
                ? {
                    ...mod,
                    contents: mod.contents.filter(content => content.id !== contentId)
                }
                : mod
        ))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        const productData = {
            ...formData,
            isMarketplace,
            productType,
            modules: !isMarketplace ? modules : [],
            checkoutSettings
        }

        if (productType === 'app') {

        } else {
            // If marketplace, go directly to creation
            // If not marketplace, go to checkout customization
            if (isMarketplace) {


                // Complete step 2 of onboarding if not yet completed
                if (currentStep === 'create-product') {
                    try {
                        await completeStep('create-product')
                    } catch (error) {
                        console.error('Error completing onboarding step:', error)
                    }
                }

                navigate('/products')
            } else {
                setStep('checkout')
            }
        }
    }

    const handleCheckoutSubmit = async () => {
        const finalProductData = {
            ...formData,
            isMarketplace,
            productType,
            modules,
            checkoutSettings
        }



        // Complete step 2 of onboarding if not yet completed
        if (currentStep === 'create-product') {
            try {
                await completeStep('create-product')
            } catch (error) {
                console.error('Error completing onboarding step:', error)
            }
        }

        navigate('/products')
    }

    const updateCheckoutSettings = (updates: Partial<CheckoutSettings>) => {
        setCheckoutSettings(prev => ({ ...prev, ...updates }))
    }

    const handleCheckoutLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            updateCheckoutSettings({ logo: e.target.files[0] })
        }
    }

    const getContentIcon = (type: ContentType) => {
        switch (type) {
            case 'text': return <FileText size={16} />
            case 'video': return <Video size={16} />
            case 'image': return <Image size={16} />
            case 'link': return <Link size={16} />
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0f1117] flex transition-colors duration-200">
            {/* Sidebar */}
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">
                <Header onMenuClick={() => setSidebarOpen(true)} />

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto pt-8">
                    {/* Back Button */}
                    <div className="px-3 lg:px-4 pt-4">
                        <button
                            onClick={() => {
                                if (step === 'marketplace') {
                                    navigate('/products')
                                } else if (step === 'modules') {
                                    setStep('type')
                                } else if (step === 'form') {
                                    setStep(!isMarketplace && productType === 'community' ? 'modules' : 'type')
                                } else {
                                    setStep('marketplace')
                                }
                            }}
                            className="flex items-center gap-2 text-gray-600 dark:text-gray-600 hover:text-gray-900 dark:hover:text-gray-100 transition-colors mb-4"
                        >
                            <ArrowLeft size={20} />
                            <span className="hidden sm:inline">{t('common.back')}</span>
                        </button>
                    </div>

                    {/* Progress Steps */}
                    {step !== 'modules' && step !== 'checkout' && (
                        <div className="flex items-center justify-center py-8">
                            <div className="flex items-center gap-4">
                                {/* Step 1 */}
                                <div className={`flex items-center gap-2 ${step === 'marketplace' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${step !== 'marketplace' ? 'bg-green-600 text-white' : 'bg-blue-100 dark:bg-blue-100 text-blue-600 dark:text-blue-400'}`}>
                                        {step !== 'marketplace' ? <Check size={16} /> : '1'}
                                    </div>
                                    <span className="text-sm font-medium hidden sm:inline">Marketplace</span>
                                </div>

                                <div className="w-12 h-0.5 bg-gray-300 dark:bg-gray-300"></div>

                                {/* Step 2 */}
                                <div className={`flex items-center gap-2 ${step === 'type' ? 'text-blue-600 dark:text-blue-400' : step === 'form' ? 'text-gray-500 dark:text-gray-400' : 'text-gray-400 dark:text-gray-300'}`}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${step === 'form' ? 'bg-green-600 text-white' : step === 'type' ? 'bg-blue-100 dark:bg-blue-100 text-blue-600 dark:text-blue-400' : 'bg-gray-200 dark:bg-[#252941] text-gray-500 dark:text-gray-400'}`}>
                                        {step === 'form' ? <Check size={16} /> : '2'}
                                    </div>
                                    <span className="text-sm font-medium hidden sm:inline">{t('common.type')}</span>
                                </div>

                                <div className="w-12 h-0.5 bg-gray-300"></div>

                                {/* Step 3 */}
                                <div className={`flex items-center gap-2 ${step === 'form' ? 'text-blue-400' : 'text-gray-300'}`}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${step === 'form' ? 'bg-blue-100 text-blue-400' : 'bg-[#252941] text-gray-400'}`}>
                                        3
                                    </div>
                                    <span className="text-sm font-medium hidden sm:inline">Data</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="max-w-6xl mx-auto px-4 py-8">
                        {/* Step 1: Marketplace Choice */}
                        {step === 'marketplace' && (
                            <div className="max-w-2xl mx-auto">
                                <div className="text-center mb-8">
                                    <h1 className="text-3xl font-bold text-gray-100 mb-3">
                                        {t('create_product.title')}
                                    </h1>
                                    <p className="text-gray-600">
                                        Choose if you want your product to be publicly visible in the marketplace
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Sim - Marketplace */}
                                    <button
                                        onClick={() => handleMarketplaceChoice(true)}
                                        className="bg-[#1a1d2e] rounded-2xl p-8 border-2 border-[#1e2139] hover:border-blue-500 hover:shadow-2xl hover:shadow-blue-500/10 shadow-black/10 transition-all text-left group"
                                    >

                                        <h3 className="text-xl font-bold text-gray-100 mb-2">
                                            Yes, show in marketplace
                                        </h3>
                                        <p className="text-gray-600 text-sm mb-4">
                                            Your product will be publicly visible in the marketplace for customers to find
                                        </p>
                                        <div className="flex items-center text-blue-400 font-medium text-sm group-hover:gap-2 transition-all">
                                            <span>Choose this option</span>
                                            <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    </button>

                                    {/* Não - Privado */}
                                    <button
                                        onClick={() => handleMarketplaceChoice(false)}
                                        className="bg-[#1a1d2e] rounded-2xl p-8 border-2 border-[#1e2139] hover:border-blue-500 hover:shadow-2xl hover:shadow-blue-500/10 shadow-black/10 transition-all text-left group"
                                    >

                                        <h3 className="text-xl font-bold text-gray-100 mb-2">
                                            No, just me
                                        </h3>
                                        <p className="text-gray-600 text-sm mb-4">
                                            Your product will be private and only you can sell it directly to your customers
                                        </p>
                                        <div className="flex items-center text-blue-600 font-medium text-sm group-hover:gap-2 transition-all">
                                            <span>Choose this option</span>
                                            <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Product Type */}
                        {step === 'type' && (
                            <div className="max-w-2xl mx-auto">
                                <div className="text-center mb-8">
                                    <h1 className="text-3xl font-bold text-gray-100 mb-3">
                                        {t('create_product.product_type')}
                                    </h1>
                                    <p className="text-gray-600">
                                        How do you want to deliver your content?
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* App */}
                                    <button
                                        onClick={() => handleTypeChoice('app')}
                                        className="bg-[#1a1d2e] rounded-2xl p-8 border-2 border-[#1e2139] hover:border-blue-500 hover:shadow-2xl hover:shadow-blue-500/10 shadow-black/10 transition-all text-left group"
                                    >

                                        <h3 className="text-xl font-bold text-gray-100 mb-2">
                                            Custom App
                                        </h3>
                                        <p className="text-gray-600 text-sm mb-4">
                                            Create a complete application with your brand, exclusive features and members area
                                        </p>
                                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 mb-4">
                                            <p className="text-xs text-yellow-800 font-medium">
                                                ⚡ Requires monthly subscription
                                            </p>
                                        </div>
                                        <div className="flex items-center text-blue-400 font-medium text-sm group-hover:gap-2 transition-all">
                                            <span>Choose App</span>
                                            <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    </button>

                                    {/* Comunidade */}
                                    <button
                                        onClick={() => handleTypeChoice('community')}
                                        className="bg-[#1a1d2e] rounded-2xl p-8 border-2 border-[#1e2139] hover:border-green-500 hover:shadow-2xl hover:shadow-blue-500/10 shadow-black/10 transition-all text-left group"
                                    >

                                        <h3 className="text-xl font-bold text-gray-100 mb-2">
                                            Members Area
                                        </h3>
                                        <p className="text-gray-600 text-sm mb-4">
                                            Area to add your content in one place!
                                        </p>
                                        <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-4">
                                            <p className="text-xs text-green-800 font-medium">
                                                ✓ No monthly fee
                                            </p>
                                        </div>
                                        <div className="flex items-center text-green-600 font-medium text-sm group-hover:gap-2 transition-all">
                                            <span>Choose Members Area</span>
                                            <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Modules Builder (only for non-marketplace community) */}
                        {step === 'modules' && (
                            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                                {/* Sidebar de Módulos */}
                                <div className="lg:col-span-1">
                                    <div className="bg-[#1a1d2e] rounded-xl p-4 shadow-xl shadow-black/10 shadow-black/5">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="font-semibold text-gray-100">{t('product_pages.modules')}</h3>
                                            <button
                                                onClick={addModule}
                                                className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                                            >
                                                <Plus size={16} />
                                            </button>
                                        </div>

                                        <div className="space-y-2">
                                            {modules.map((module, index) => (
                                                <div
                                                    key={module.id}
                                                    onClick={() => setActiveModuleId(module.id)}
                                                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${activeModuleId === module.id
                                                        ? 'border-blue-500 bg-blue-500/10'
                                                        : 'border-[#1e2139] hover:border-[#252941]'
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm font-medium truncate">
                                                            {module.name || `Module ${index + 1}`}
                                                        </span>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                deleteModule(module.id)
                                                            }}
                                                            className="text-gray-400 hover:text-red-500 transition-colors"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                    <div className="text-xs text-gray-500 mt-1">
                                                        {module.contents.length} contents
                                                    </div>
                                                </div>
                                            ))}

                                            {modules.length === 0 && (
                                                <div className="text-center py-8 text-gray-500 text-sm">
                                                    {t('product_pages.no_modules')}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Editor de Módulo */}
                                <div className="lg:col-span-3">
                                    {activeModuleId ? (
                                        <div className="bg-[#1a1d2e] rounded-xl p-6 shadow-xl shadow-black/10 shadow-black/5">
                                            {(() => {
                                                const activeModule = modules.find(m => m.id === activeModuleId)
                                                if (!activeModule) return null

                                                return (
                                                    <>
                                                        {/* Cabeçalho do Módulo */}
                                                        <div className="mb-6">
                                                            <input
                                                                type="text"
                                                                value={activeModule.name}
                                                                onChange={(e) => updateModule(activeModuleId, { name: e.target.value })}
                                                                className="text-2xl font-bold border-none outline-none bg-transparent w-full mb-2"
                                                                placeholder="Module name"
                                                            />
                                                            <textarea
                                                                value={activeModule.description}
                                                                onChange={(e) => updateModule(activeModuleId, { description: e.target.value })}
                                                                className="w-full p-3 bg-[#1a1d2e] text-gray-200 border border-[#252941] rounded-lg resize-none"
                                                                rows={2}
                                                                placeholder="Module description..."
                                                            />
                                                        </div>

                                                        {/* Botões de Adicionar Conteúdo */}
                                                        <div className="mb-6">
                                                            <h4 className="text-sm font-medium text-gray-300 mb-3">Add content:</h4>
                                                            <div className="flex gap-2 flex-wrap">
                                                                <button
                                                                    onClick={() => addContentToModule(activeModuleId, 'text')}
                                                                    className="flex items-center gap-2 px-3 py-2 bg-[#252941] hover:bg-gray-200 rounded-lg transition-colors text-sm"
                                                                >
                                                                    <FileText size={16} />
                                                                    Text
                                                                </button>
                                                                <button
                                                                    onClick={() => addContentToModule(activeModuleId, 'video')}
                                                                    className="flex items-center gap-2 px-3 py-2 bg-[#252941] hover:bg-gray-200 rounded-lg transition-colors text-sm"
                                                                >
                                                                    <Video size={16} />
                                                                    Video
                                                                </button>
                                                                <button
                                                                    onClick={() => addContentToModule(activeModuleId, 'image')}
                                                                    className="flex items-center gap-2 px-3 py-2 bg-[#252941] hover:bg-gray-200 rounded-lg transition-colors text-sm"
                                                                >
                                                                    <Image size={16} />
                                                                    Image
                                                                </button>
                                                                <button
                                                                    onClick={() => addContentToModule(activeModuleId, 'link')}
                                                                    className="flex items-center gap-2 px-3 py-2 bg-[#252941] hover:bg-gray-200 rounded-lg transition-colors text-sm"
                                                                >
                                                                    <Link size={16} />
                                                                    Link
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Lista de Conteúdos */}
                                                        <div className="space-y-4">
                                                            {activeModule.contents.map((content) => (
                                                                <div key={content.id} className="border border-[#1e2139] rounded-lg p-4">
                                                                    <div className="flex items-center justify-between mb-3">
                                                                        <div className="flex items-center gap-2">
                                                                            {getContentIcon(content.type)}
                                                                            <input
                                                                                type="text"
                                                                                value={content.title}
                                                                                onChange={(e) => updateModuleContent(activeModuleId, content.id, { title: e.target.value })}
                                                                                className="font-medium border-none outline-none bg-transparent"
                                                                                placeholder="Content title"
                                                                            />
                                                                        </div>
                                                                        <button
                                                                            onClick={() => deleteModuleContent(activeModuleId, content.id)}
                                                                            className="text-gray-400 hover:text-red-500 transition-colors"
                                                                        >
                                                                            <X size={16} />
                                                                        </button>
                                                                    </div>

                                                                    {content.type === 'text' && (
                                                                        <textarea
                                                                            value={content.content}
                                                                            onChange={(e) => updateModuleContent(activeModuleId, content.id, { content: e.target.value })}
                                                                            className="w-full p-3 bg-[#1a1d2e] text-gray-200 border border-[#252941] rounded-lg resize-none"
                                                                            rows={4}
                                                                            placeholder="Text content..."
                                                                        />
                                                                    )}

                                                                    {(content.type === 'video' || content.type === 'image' || content.type === 'link') && (
                                                                        <input
                                                                            type="url"
                                                                            value={content.content}
                                                                            onChange={(e) => updateModuleContent(activeModuleId, content.id, { content: e.target.value })}
                                                                            className="w-full p-3 bg-[#1a1d2e] text-gray-200 border border-[#252941] rounded-lg"
                                                                            placeholder={`URL of ${content.type === 'video' ? 'video' : content.type === 'image' ? 'image' : 'link'}...`}
                                                                        />
                                                                    )}
                                                                </div>
                                                            ))}

                                                            {activeModule.contents.length === 0 && (
                                                                <div className="text-center py-8 text-gray-500 text-sm">
                                                                    No content added yet
                                                                </div>
                                                            )}
                                                        </div>
                                                    </>
                                                )
                                            })()}
                                        </div>
                                    ) : (
                                        <div className="bg-[#1a1d2e] rounded-xl p-6 shadow-xl shadow-black/10 shadow-black/5 text-center">
                                            <div className="text-gray-500 mb-4">
                                                <Users size={48} className="mx-auto mb-3" />
                                                <h3 className="text-lg font-medium text-gray-100 mb-2">
                                                    {t('product_pages.modules')}
                                                </h3>
                                                <p className="text-sm">
                                                    Add modules on the left to organize your community content
                                                </p>
                                            </div>
                                            <button
                                                onClick={addModule}
                                                className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors"
                                            >
                                                {t('product_pages.add_module')}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Step 4: Form (mantém o existente) */}
                        {step === 'form' && (
                            <div className="max-w-2xl mx-auto">
                                <div className="text-center mb-8">
                                    <h1 className="text-3xl font-bold text-gray-100 mb-3">
                                        {t('create_product.step_info')}
                                    </h1>
                                    <p className="text-gray-600">
                                        Fill in the basic information about your {productType === 'app' ? 'app' : 'community'}
                                    </p>
                                </div>

                                <form onSubmit={handleSubmit} className="bg-[#1a1d2e] rounded-2xl p-8 shadow-xl shadow-black/10 shadow-black/5">
                                    <div className="space-y-6">
                                        {/* Nome */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                {t('create_product.product_name')}*
                                            </label>
                                            <input
                                                type="text"
                                                name="name"
                                                value={formData.name}
                                                onChange={handleInputChange}
                                                className="w-full px-4 py-3 bg-[#1a1d2e] text-gray-200 border border-[#252941] rounded-xl focus:ring-2 focus:ring-blue-400/50 focus:border-transparent"
                                                placeholder={productType === 'app' ? 'E.g.: My Course App' : 'E.g.: Members Community'}
                                                required
                                            />
                                        </div>

                                        {/* Descrição */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                {t('common.description')}*
                                            </label>
                                            <textarea
                                                name="description"
                                                value={formData.description}
                                                onChange={handleInputChange}
                                                rows={4}
                                                className="w-full px-4 py-3 bg-[#1a1d2e] text-gray-200 border border-[#252941] rounded-xl focus:ring-2 focus:ring-blue-400/50 focus:border-transparent resize-none"
                                                placeholder="Describe what your product offers..."
                                                required
                                            />
                                        </div>

                                        {/* Imagem */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                {t('create_product.cover_image')}
                                            </label>
                                            <div className="border-2 border-dashed border-[#252941] rounded-xl p-8 text-center hover:border-blue-500 transition-colors">
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleImageChange}
                                                    className="hidden"
                                                    id="image-upload"
                                                />
                                                <label htmlFor="image-upload" className="cursor-pointer">
                                                    {formData.image ? (
                                                        <div className="flex items-center gap-2 text-green-600">
                                                            <Check size={20} />
                                                            <span className="font-medium">{formData.image.name}</span>
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <div className="w-12 h-12 bg-[#252941] rounded-full flex items-center justify-center mx-auto mb-3">
                                                                <span className="text-2xl">📸</span>
                                                            </div>
                                                            <p className="text-sm text-gray-600 mb-1">
                                                                Click to select an image
                                                            </p>
                                                            <p className="text-xs text-gray-400">
                                                                PNG, JPG up to 5MB
                                                            </p>
                                                        </div>
                                                    )}
                                                </label>
                                            </div>
                                        </div>

                                        {/* Preço */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                {t('create_product.price')}*
                                            </label>
                                            <div className="flex gap-2">
                                                <select
                                                    value={formData.currency}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value as 'USD' | 'EUR' | 'CHF' }))}
                                                    className="w-28 py-3 px-3 bg-[#1a1d2e] text-gray-200 border border-[#252941] rounded-xl focus:ring-2 focus:ring-blue-400/50 focus:border-transparent"
                                                >
                                                    <option value="USD">🇺🇸 USD</option>
                                                    <option value="EUR">🇪🇺 EUR</option>
                                                    <option value="CHF">🇨🇭 CHF</option>
                                                </select>
                                                <input
                                                    type="text"
                                                    name="price"
                                                    value={formData.price}
                                                    onChange={handleInputChange}
                                                    className="flex-1 px-4 py-3 bg-[#1a1d2e] text-gray-200 border border-[#252941] rounded-xl focus:ring-2 focus:ring-blue-400/50 focus:border-transparent"
                                                    placeholder="0,00"
                                                    required
                                                />
                                            </div>
                                        </div>



                                        {/* Resumo da escolha */}
                                        <div className="bg-[#0f1117] rounded-xl p-4 space-y-2">
                                            <p className="text-sm text-gray-600">
                                                <span className="font-medium text-gray-100">Type:</span> {productType === 'app' ? 'Custom App' : 'Community'}
                                            </p>
                                            <p className="text-sm text-gray-600">
                                                <span className="font-medium text-gray-100">Marketplace:</span> {isMarketplace ? 'Yes, public' : 'No, private'}
                                            </p>
                                            {productType === 'app' && (
                                                <p className="text-sm text-yellow-600 font-medium">
                                                    ⚡ Monthly subscription required after creation
                                                </p>
                                            )}
                                        </div>

                                        {/* Botões */}
                                        <div className="flex gap-4 pt-4">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (!isMarketplace && productType === 'community') {
                                                        setStep('modules')
                                                    } else {
                                                        setStep('type')
                                                    }
                                                }}
                                                className="flex-1 px-6 py-3 border border-[#252941] text-gray-300 rounded-xl hover:bg-[#0f1117] transition-colors font-medium"
                                            >
                                                {t('create_product.previous_step')}
                                            </button>
                                            <button
                                                type="submit"
                                                className="flex-1 px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors font-medium"
                                            >
                                                {productType === 'app' ? 'Continue to Subscription' : 'Create Community'}
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        )}

                        {/* Botão flutuante para finalizar módulos */}
                        {step === 'modules' && (
                            <div className="fixed bottom-6 right-6">
                                <button
                                    onClick={() => setStep('form')}
                                    className="bg-blue-500 text-white px-6 py-3 rounded-full shadow-xl shadow-black/10 hover:bg-blue-600 transition-colors font-medium flex items-center gap-2"
                                >
                                    Continue
                                    <ArrowRight size={20} />
                                </button>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    )
}

export default CreateProduct
