import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Eye, Upload, X, Monitor, Smartphone, Edit3, Image as ImageIcon, Clock, Link as LinkIcon, Check, RotateCw, Menu, ShoppingCart, Tag, Key, Code, Target, Tags } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import CheckoutDigital from '@/components/checkout/CheckoutDigital'
import type { CheckoutLanguage } from '@/components/checkout/translations'
import { supabase } from '@/services/supabase'
import { useI18n } from '@/i18n'

type EditingElement = 'banner' | 'timer' | null

interface ComponentItem {
    id: string
    name: string
    icon: any
    type: 'image' | 'timer'
}

interface Product {
    id: string
    name: string
    price: number
    currency?: string
    payment_methods?: string[]
    default_payment_method?: string
    image_url?: string
    description?: string
}

interface Checkout {
    id: string
    name: string
    product_id: string
    is_default: boolean
    custom_price?: number
    banner_image?: string
    banner_title?: string
    banner_subtitle?: string
    banner_description?: string
    created_at: string
}

export default function CheckoutBuilder() {
    const { productId, checkoutId } = useParams<{ productId: string; checkoutId: string }>()
    const navigate = useNavigate()
    const { t } = useI18n()
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [showPreview, setShowPreview] = useState(true)
    const [viewDevice, setViewDevice] = useState<'desktop' | 'mobile'>('desktop')
    const [editingElement, setEditingElement] = useState<EditingElement>(null)
    const [editPanelOpen, setEditPanelOpen] = useState(false)
    const [draggedComponent, setDraggedComponent] = useState<ComponentItem | null>(null)
    const [linkCopied, setLinkCopied] = useState(false)

    const availableComponents: ComponentItem[] = [
        { id: 'image', name: 'Image', icon: ImageIcon, type: 'image' },
        { id: 'timer', name: 'Timer', icon: Clock, type: 'timer' }
    ]

    const [product, setProduct] = useState<Product | null>(null)
    const [checkout, setCheckout] = useState<Checkout | null>(null)
    const [productOwnerId, setProductOwnerId] = useState<string>('')

    const [bannerForm, setBannerForm] = useState({
        banner_image: '',
        banner_title: '',
        customHeight: undefined as number | undefined
    })

    const [bannerImageScale, setBannerImageScale] = useState(1)
    const [bannerImagePosition, setBannerImagePosition] = useState({ x: 50, y: 50 })

    const [timerConfig, setTimerConfig] = useState({
        enabled: false,
        minutes: 15,
        backgroundColor: '#ef4444',
        textColor: '#ffffff',
        activeText: 'Limited time offer',
        finishedText: 'Offer ended'
    })

    const [timerInputValue, setTimerInputValue] = useState('')

    const [checkoutLanguage, setCheckoutLanguage] = useState<CheckoutLanguage>('en')

    const [buttonColor, setButtonColor] = useState('#111827')
    const [utmifyToken, setUtmifyToken] = useState('')
    const [utmifyTokenVisible, setUtmifyTokenVisible] = useState(false)
    const [customPixels, setCustomPixels] = useState('')
    const [customUtms, setCustomUtms] = useState('')
    const [checkoutName, setCheckoutName] = useState('')
    const [checkoutPrice, setCheckoutPrice] = useState<string>('')

    const fetchData = useCallback(async () => {
        try {
            setLoading(true)

            // Primeiro buscar o checkout para saber se é produto ou aplicação
            const { data: checkoutData, error: checkoutError } = await supabase
                .from('checkouts')
                .select('*')
                .eq('id', checkoutId)
                .single()

            if (checkoutError) throw checkoutError
            if (!checkoutData) throw new Error('Checkout not found')

            let fetchedProduct: Product

            // Verificar se é aplicação ou produto do marketplace
            if (checkoutData.application_id) {
                // É uma aplicação
                const { data: appData, error: appError } = await supabase
                    .from('applications')
                    .select('*')
                    .eq('id', checkoutData.application_id)
                    .single()

                if (appError) throw appError
                if (!appData) throw new Error('Application not found')

                fetchedProduct = {
                    id: appData.id,
                    name: appData.name,
                    price: 0,
                    currency: 'USD',
                    payment_methods: ['credit_card'],
                    default_payment_method: 'credit_card',
                    image_url: appData.logo,
                    description: appData.description || ''
                }
            } else {
                // É um produto do marketplace
                const { data: productData, error: productError } = await supabase
                    .from('marketplace_products')
                    .select('*')
                    .eq('id', productId)
                    .single()

                if (productError) throw productError
                if (!productData) throw new Error('Product not found')



                fetchedProduct = {
                    id: productData.id,
                    name: productData.name,
                    price: productData.price,
                    currency: productData.currency || 'USD',
                    payment_methods: productData.payment_methods || ['credit_card'],
                    default_payment_method: productData.default_payment_method || 'credit_card',
                    image_url: productData.image_url,
                    description: productData.description
                }

                // Store product owner ID for offers
                setProductOwnerId(productData.owner_id)
            }

            const fetchedCheckout: Checkout = {
                id: checkoutData.id,
                name: checkoutData.name,
                product_id: checkoutData.member_area_id || checkoutData.application_id,
                is_default: checkoutData.is_default,
                custom_price: checkoutData.custom_price,
                banner_image: checkoutData.banner_image,
                banner_title: checkoutData.banner_title,
                banner_subtitle: checkoutData.banner_subtitle,
                banner_description: checkoutData.banner_description,
                created_at: checkoutData.created_at
            }

            setProduct(fetchedProduct)
            setCheckout(fetchedCheckout)
            setCheckoutName(fetchedCheckout.name || '')
            setCheckoutPrice(fetchedCheckout.custom_price != null ? String(fetchedCheckout.custom_price) : '')
            setBannerForm({
                banner_image: fetchedCheckout.banner_image || '',
                banner_title: fetchedCheckout.banner_title === fetchedProduct.name ? '' : fetchedCheckout.banner_title || '',
                customHeight: (checkoutData as any).custom_height
            })

            // Carregar configurações do timer se existirem
            const customFields = checkoutData.custom_fields || {}

            if (customFields.timer) {

                setTimerConfig(customFields.timer)
            } else {

            }

            // Load button color
            if (customFields.buttonColor) {
                setButtonColor(customFields.buttonColor)
            }

            // Load banner image adjustments
            if (customFields.bannerImageScale) {
                setBannerImageScale(customFields.bannerImageScale)
            }
            if (customFields.bannerImagePosition) {
                setBannerImagePosition(customFields.bannerImagePosition)
            }

            // Load UTMify token
            if (customFields.utmifyToken) {
                setUtmifyToken(customFields.utmifyToken)
            }

            // Load separate pixels and UTMs
            if (customFields.customPixels) {
                setCustomPixels(customFields.customPixels)
            }
            if (customFields.customUtms) {
                setCustomUtms(customFields.customUtms)
            }

            // Load language setting
            if (checkoutData.language) {
                setCheckoutLanguage(checkoutData.language as CheckoutLanguage)
            }
        } catch (error) {
            console.error('Error loading data:', error)
            alert(t('checkout_pages.error_loading'))
            navigate(-1)
        } finally {
            setLoading(false)
        }
    }, [productId, checkoutId, navigate])

    useEffect(() => {
        if (productId && checkoutId) {
            fetchData()
        }
    }, [productId, checkoutId, fetchData])

    const handleSave = async () => {
        if (!checkout || !product) return

        try {
            setSaving(true)

            // Primeiro buscar os custom_fields existentes
            const { data: currentCheckout, error: fetchError } = await supabase
                .from('checkouts')
                .select('custom_fields')
                .eq('id', checkout.id)
                .single()

            if (fetchError) throw fetchError

            // Fazer merge com os custom_fields existentes
            const existingFields = currentCheckout?.custom_fields || {}
            const updatedFields = {
                ...existingFields,
                timer: timerConfig,
                buttonColor: buttonColor,
                utmifyToken: utmifyToken.trim() || undefined,
                customPixels: customPixels.trim() || undefined,
                customUtms: customUtms.trim() || undefined,
                bannerImageScale: bannerImageScale,
                bannerImagePosition: bannerImagePosition
            }



            const priceValue = checkoutPrice.trim() !== '' ? parseFloat(checkoutPrice) : null

            const { error } = await supabase
                .from('checkouts')
                .update({
                    name: checkoutName.trim() || checkout.name,
                    custom_price: priceValue,
                    banner_image: bannerForm.banner_image,
                    banner_title: bannerForm.banner_title,
                    custom_height: bannerForm.customHeight,
                    custom_fields: updatedFields,
                    language: checkoutLanguage
                })
                .eq('id', checkout.id)

            if (error) throw error

            alert(t('checkout_pages.saved_success'))
        } catch (error) {
            console.error('Error saving:', error)
            alert(t('checkout_pages.error_saving'))
        } finally {
            setSaving(false)
        }
    }

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            const reader = new FileReader()
            reader.onload = (event) => {
                const imageUrl = event.target?.result as string
                setBannerForm(prev => ({ ...prev, banner_image: imageUrl }))
                // Resetar controles de imagem para valores padrão
                setBannerImageScale(1)
                setBannerImagePosition({ x: 50, y: 50 })
            }
            reader.readAsDataURL(file)
        }
    }

    const handleRemoveImage = () => {
        setBannerForm(prev => ({ ...prev, banner_image: '' }))
        // Resetar controles de imagem
        setBannerImageScale(1)
        setBannerImagePosition({ x: 50, y: 50 })
    }

    const handleEditElement = (element: EditingElement) => {
        setEditingElement(element)
        setEditPanelOpen(true)

        // Preencher o valor do timer quando abrir o painel
        if (element === 'timer') {
            const totalMinutes = timerConfig.minutes
            const minutes = Math.floor(totalMinutes)
            const seconds = Math.round((totalMinutes - minutes) * 60)
            setTimerInputValue(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`)
        }
    }

    const handleBannerResize = (height: number) => {
        setBannerForm(prev => ({ ...prev, customHeight: height }))
    }

    const handleCloseEditPanel = () => {
        setEditPanelOpen(false)
        setTimeout(() => setEditingElement(null), 300) // Aguarda animação
    }

    const handleDragStart = (component: ComponentItem) => {
        setDraggedComponent(component)
    }

    const handleDragEnd = () => {
        setDraggedComponent(null)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        const dropZone = (e.target as HTMLElement).closest('[data-drop-zone]')?.getAttribute('data-drop-zone')



        if (draggedComponent) {
            if (draggedComponent.type === 'image') {
                // Quando arrasta imagem para qualquer lugar, abre o painel de edição do banner
                handleEditElement('banner')
                // Trigger file upload quando imagem é arrastada para o banner
                const fileInput = document.getElementById('banner-upload-panel') as HTMLInputElement
                if (fileInput) {
                    fileInput.click()
                }
            } else if (draggedComponent.type === 'timer') {
                if (dropZone === 'timer') {
                    // Ativar timer na área específica
                    setTimerConfig(prev => ({ ...prev, enabled: true }))
                    handleEditElement('timer')
                } else {
                    alert(t('checkout_pages.timer_area_only'))
                }
            }
        }
        setDraggedComponent(null)
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
    }

    const handleCopyLink = async () => {
        try {
            // Detect if this checkout is for an application or member_area
            const { data: checkoutData } = await supabase
                .from('checkouts')
                .select('application_id, member_area_id')
                .eq('id', checkoutId)
                .single()

            const isApp = !!checkoutData?.application_id
            const refId = isApp ? checkoutData.application_id : (checkoutData?.member_area_id || productId)

            // Tentar encontrar URL encurtada existente
            let { data: existingUrl, error: searchError } = await supabase
                .from('checkout_urls')
                .select('id')
                .eq('checkout_id', checkoutId)
                .maybeSingle()

            let shortId = existingUrl?.id

            // Se não existir, criar nova URL encurtada
            if (!existingUrl) {
                const insertData: any = { checkout_id: checkoutId }
                if (isApp) {
                    insertData.application_id = refId
                } else {
                    insertData.member_area_id = refId
                }

                const { data: newUrl, error: insertError } = await supabase
                    .from('checkout_urls')
                    .insert(insertData)
                    .select('id')
                    .single()

                if (insertError) throw insertError
                shortId = newUrl.id
            }

            const checkoutUrl = `${window.location.origin}/checkout/${shortId}`
            navigator.clipboard.writeText(checkoutUrl)
            setLinkCopied(true)
            setTimeout(() => setLinkCopied(false), 2000)
        } catch (error) {
            console.error('Erro ao gerar link:', error)
            // Fallback para URL longa
            const checkoutUrl = `${window.location.origin}/checkout/${productId}/${checkoutId}`
            navigator.clipboard.writeText(checkoutUrl)
            setLinkCopied(true)
            setTimeout(() => setLinkCopied(false), 2000)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-[#0f1117] flex transition-colors duration-200">
                <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
                <div className="flex-1 flex flex-col min-w-0">
                    <Header onMenuClick={() => setSidebarOpen(true)} />
                    <div className="flex-1 flex items-center justify-center pt-20">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#252941] border-t-blue-600 mx-auto"></div>
                            <p className="mt-3 text-sm text-gray-600">{t('common.loading')}</p>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (!product || !checkout) {
        return (
            <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-600">{t('checkout_pages.error_loading')}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#0f1117] flex">
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <Header onMenuClick={() => setSidebarOpen(true)} />

                {/* Navbar - Fixed below header */}
                <div className="bg-[#1a1d2e] border-b border-[#1e2139] mt-12 sticky top-12 z-[60]">
                    <div className="flex items-center justify-between px-4 lg:px-6">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate(-1)}
                                className="p-2 hover:bg-[#252941]/50 rounded-lg transition-colors duration-200 flex-shrink-0"
                            >
                                <ArrowLeft size={14} className="text-blue-400" />
                            </button>
                            <span className="text-xs font-medium text-gray-400">{t('checkout_pages.builder_title')}</span>

                            {/* Tabs */}
                            {/* Tabs removidas - agora usamos o sistema de Funis para ofertas */}
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Device Controls */}
                            <div className="flex items-center gap-0.5 bg-[#252941] rounded-lg p-0.5">
                                <button
                                    onClick={() => setViewDevice('desktop')}
                                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${viewDevice === 'desktop'
                                        ? 'bg-[#1a1d2e] text-gray-100 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-300'
                                        }`}
                                    title="Desktop"
                                >
                                    <Monitor size={12} />
                                    <span className="hidden sm:inline">Desktop</span>
                                </button>
                                <button
                                    onClick={() => setViewDevice('mobile')}
                                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${viewDevice === 'mobile'
                                        ? 'bg-[#1a1d2e] text-gray-100 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-300'
                                        }`}
                                    title="Mobile"
                                >
                                    <Smartphone size={12} />
                                    <span className="hidden sm:inline">Mobile</span>
                                </button>
                            </div>

                            {/* Language Selector */}
                            <select
                                value={checkoutLanguage}
                                onChange={(e) => setCheckoutLanguage(e.target.value as CheckoutLanguage)}
                                className="bg-[#252941] text-gray-100 text-[11px] font-medium rounded-lg px-2 py-1 border-none focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                title="Checkout Language"
                            >
                                <option value="en">🇺🇸 EN</option>
                                <option value="es">🇪🇸 ES</option>
                            </select>

                            {/* Preview Button */}
                            <button
                                onClick={() => window.open(`/checkout/${productId}/${checkoutId}`, '_blank')}
                                className="flex items-center gap-1 px-3 py-1 bg-[#252941] text-gray-300 rounded-lg hover:bg-[#2e3354] hover:text-white transition-colors text-[11px] font-medium"
                                title="Preview"
                            >
                                <Eye size={12} />
                                <span className="hidden sm:inline">Preview</span>
                            </button>

                            {/* Save Button */}
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex items-center gap-1 px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors text-[11px] font-medium shadow-lg shadow-blue-500/20"
                            >
                                <Save size={12} />
                                <span>{saving ? t('common.saving') : t('common.save')}</span>
                            </button>
                        </div>
                    </div>
                </div>

                <main className="flex-1 overflow-y-auto px-3 lg:px-6 py-4">
                    <div className="flex gap-4">
                        {/* Preview Area */}
                        <div className="flex-1 bg-[#1a1d2e] rounded-lg shadow-xl shadow-black/10 border border-[#1e2139]">
                            {/* Device Frame */}
                            <div className={`transition-all duration-300 p-4 sm:p-6 ${viewDevice === 'mobile'
                                ? 'max-w-sm mx-auto'
                                : 'w-full'
                                }`}>
                                <div
                                    className={`border border-[#252941] rounded-lg ${viewDevice === 'mobile'
                                        ? 'bg-[#0f1117] overflow-auto shadow-xl shadow-black/20'
                                        : 'bg-[#0f1117]'
                                        }`}
                                    style={viewDevice === 'mobile' ? { maxHeight: '70vh' } : {}}
                                    onDrop={handleDrop}
                                    onDragOver={handleDragOver}
                                >
                                    {/* Preview com elementos clicáveis */}
                                    <div className="relative">

                                        {/* Botões de ação quando banner está selecionado */}
                                        {editingElement === 'banner' && editPanelOpen && (
                                            <div className="absolute -top-12 left-0 right-0 flex items-center justify-end gap-2 z-30 px-4">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        // Delete banner function
                                                    }}
                                                    className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-xl shadow-black/10"
                                                    title="Delete"
                                                >
                                                    <X size={16} />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        // Copy banner function
                                                    }}
                                                    className="p-2 bg-gray-700 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg transition-colors shadow-xl shadow-black/10"
                                                    title="Copy"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        // Add new element function
                                                    }}
                                                    className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors shadow-xl shadow-black/10"
                                                    title="Add"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <line x1="12" y1="5" x2="12" y2="19"></line>
                                                        <line x1="5" y1="12" x2="19" y2="12"></line>
                                                    </svg>
                                                </button>
                                            </div>
                                        )}

                                        <CheckoutDigital
                                            productId={product.id}
                                            productName={product.name}
                                            productPrice={checkoutPrice !== '' ? parseFloat(checkoutPrice) || product.price : (checkout.custom_price || product.price)}
                                            productCurrency={product.currency}
                                            selectedPaymentMethods={product.payment_methods as ('credit_card')[]}
                                            defaultPaymentMethod={product.default_payment_method as 'credit_card'}
                                            productImage={product.image_url}
                                            productDescription={product.description}
                                            language={checkoutLanguage}
                                            customBanner={
                                                (bannerForm.banner_image || bannerForm.banner_title) ? {
                                                    image: bannerForm.banner_image,
                                                    title: bannerForm.banner_title,
                                                    customHeight: bannerForm.customHeight,
                                                    imageScale: bannerImageScale,
                                                    imagePosition: bannerImagePosition
                                                } : undefined
                                            }
                                            bannerSelected={editingElement === 'banner'}
                                            onBannerClick={() => {
                                                if (editingElement === 'banner') {
                                                    setEditingElement(null)
                                                    setEditPanelOpen(false)
                                                } else {
                                                    setEditingElement('banner')
                                                }
                                            }}
                                            onBannerAdjust={() => {
                                                if (bannerForm.banner_image) {
                                                    setTempImageForCrop(bannerForm.banner_image)
                                                    setShowCropModal(true)
                                                }
                                            }}
                                            onBannerRemove={() => {
                                                handleRemoveImage()
                                                setEditingElement(null)
                                            }}
                                            onBannerResize={handleBannerResize}
                                            onBannerImageScaleChange={(scale) => setBannerImageScale(scale)}
                                            onBannerImagePositionChange={(position) => setBannerImagePosition(position)}
                                            isPreview={true}
                                            viewDevice={viewDevice}
                                            isDragging={!!draggedComponent}
                                            timerConfig={timerConfig}
                                            onTimerClick={() => handleEditElement('timer')}
                                            draggedComponentType={draggedComponent?.type || null}
                                            buttonColor={buttonColor}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Components Panel - Right Side */}
                        <div className="hidden lg:block w-56 flex-shrink-0">
                            {/* Components */}
                            <div className="bg-gradient-to-br from-[#1a1d2e] to-[#0f1117] rounded-xl shadow-xl shadow-blue-500/10 border-2 border-blue-500/30 p-4 sticky top-4">

                                {/* Nome e Preço */}
                                <div className="mb-4 pb-4 border-b border-[#252941] space-y-2">
                                    <div>
                                        <div className="text-[10px] font-semibold text-blue-400 tracking-widest mb-1">NOME</div>
                                        <input
                                            type="text"
                                            value={checkoutName}
                                            onChange={(e) => setCheckoutName(e.target.value)}
                                            placeholder="Nome do checkout"
                                            className="w-full px-2 py-1.5 bg-[#0f1117] border border-[#252941] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100 text-xs"
                                        />
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-semibold text-blue-400 tracking-widest mb-1">PREÇO</div>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={checkoutPrice}
                                            onChange={(e) => setCheckoutPrice(e.target.value)}
                                            placeholder={product ? String(product.price) : '0.00'}
                                            className="w-full px-2 py-1.5 bg-[#0f1117] border border-[#252941] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100 text-xs"
                                        />
                                    </div>
                                </div>

                                <h3 className="text-sm font-bold text-gray-100 mb-3">{t('checkout_pages.components')}</h3>

                                <div className="text-[10px] text-blue-400 uppercase tracking-wider mb-3 font-semibold">
                                    {t('checkout_pages.drag_to_add')}
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    {availableComponents.map((component) => {
                                        const Icon = component.icon
                                        return (
                                            <div
                                                key={component.id}
                                                draggable
                                                onDragStart={() => handleDragStart(component)}
                                                onDragEnd={handleDragEnd}
                                                className="bg-[#0f1117] rounded-lg p-3 flex flex-col items-center justify-center gap-2 cursor-move hover:bg-blue-500/10 transition-all border border-[#252941] hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/20"
                                            >
                                                <div className="w-9 h-9 bg-[#252941] rounded-lg flex items-center justify-center">
                                                    <Icon size={18} className="text-blue-400" />
                                                </div>
                                                <span className="text-[11px] text-gray-300 text-center font-medium">
                                                    {component.name}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* Button Color */}
                                <div className="mt-4 pt-4 border-t border-[#252941]">
                                    <div className="text-[10px] font-semibold text-blue-400 tracking-widest mb-2">
                                        {t('checkout_pages.button_color')}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={buttonColor}
                                            onChange={(e) => setButtonColor(e.target.value)}
                                            className="w-10 h-10 border border-[#252941] rounded-lg cursor-pointer bg-transparent"
                                        />
                                        <input
                                            type="text"
                                            value={buttonColor}
                                            onChange={(e) => setButtonColor(e.target.value)}
                                            className="flex-1 px-2 py-1.5 bg-[#0f1117] border border-[#252941] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100 text-xs"
                                        />
                                    </div>
                                </div>

                                {/* Pixels Personalizados */}
                                <div className="mt-4 pt-4 border-t border-[#252941]">
                                    <div className="flex items-center gap-1.5 mb-2">
                                        <div className="text-[10px] font-semibold text-blue-400 tracking-widest">
                                            PIXELS DE TRACKING
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-gray-500 mb-2">
                                        Facebook Pixel, Google Analytics, TikTok Pixel, etc.
                                    </p>
                                    <textarea
                                        value={customPixels}
                                        onChange={(e) => setCustomPixels(e.target.value)}
                                        placeholder={`<!-- Exemplo: Pixel do Facebook -->\n<script>\n  fbq('init', 'SEU_PIXEL_ID');\n  fbq('track', 'PageView');\n</script>\n\n<!-- Google Analytics -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=GA_ID"></script>\n<script>\n  window.dataLayer = window.dataLayer || [];\n  function gtag(){dataLayer.push(arguments);}\n  gtag('js', new Date());\n  gtag('config', 'GA_ID');\n</script>`}
                                        rows={8}
                                        className="w-full px-2 py-2 bg-[#0f1117] border border-[#252941] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-300 text-[11px] font-mono resize-y"
                                    />
                                </div>

                                {/* UTMs Personalizados */}
                                <div className="mt-4 pt-4 border-t border-[#252941]">
                                    <div className="flex items-center gap-1.5 mb-2">
                                        <div className="text-[10px] font-semibold text-blue-400 tracking-widest">
                                            UTMs CUSTOMIZADOS
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-gray-500 mb-2">
                                        UTMs específicos para este checkout (sobrescreve URL).
                                    </p>
                                    <textarea
                                        value={customUtms}
                                        onChange={(e) => setCustomUtms(e.target.value)}
                                        placeholder={`<!-- UTMs do Facebook -->\n<script>\n  window.customUTMs = {\n    utm_source: 'FB',\n    utm_campaign: '{{campaign.name}}|{{campaign.id}}',\n    utm_medium: '{{adset.name}}|{{adset.id}}',\n    utm_content: '{{ad.name}}|{{ad.id}}',\n    utm_term: '{{placement}}'\n  };\n</script>`}
                                        rows={6}
                                        className="w-full px-2 py-2 bg-[#0f1117] border border-[#252941] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-300 text-[11px] font-mono resize-y"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tab: Offers - REMOVED
                        Now using the Funnels system to manage order bumps, upsells and downsells
                        Go to: Funnels > Configure Order Bumps on the funnel checkout page
                    */}
                </main>
            </div>

            {/* Side Edit Panel */}
            <div
                className={`fixed top-0 right-0 h-full w-full sm:w-96 md:w-[420px] bg-[#1a1d2e] shadow-2xl transform transition-transform duration-300 ease-in-out z-[100] ${editPanelOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
            >
                <div className="flex flex-col h-full">
                    {/* Panel Header */}
                    <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[#1e2139] bg-[#0f1117]">
                        <h3 className="text-lg font-semibold text-gray-100">
                            {editingElement === 'banner' && t('checkout_pages.image')}
                            {editingElement === 'timer' && t('checkout_pages.timer')}
                        </h3>
                        <button
                            onClick={handleCloseEditPanel}
                            className="p-2 hover:bg-[#252941] rounded-lg transition-colors text-gray-400 hover:text-gray-100"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Panel Content */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                        {editingElement === 'banner' && (
                            <div className="space-y-6">
                                {/* Image */}
                                <div>
                                    <div className="space-y-3">
                                        {bannerForm.banner_image ? (
                                            <>
                                                <div className="relative">
                                                    <img
                                                        src={bannerForm.banner_image}
                                                        alt="Banner preview"
                                                        className="w-full h-40 object-cover rounded-lg border border-[#1e2139]"
                                                    />
                                                    <div className="absolute top-2 right-2 flex gap-1">
                                                        <button
                                                            onClick={handleRemoveImage}
                                                            className="p-1.5 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors shadow-xl shadow-black/10"
                                                            title={t('checkout_pages.remove')}
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Image Scale Control */}
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <label className="block text-sm font-medium text-gray-300">
                                                            Tamanho da Imagem
                                                        </label>
                                                        <span className="text-xs text-gray-500">ou arraste os cantos no banner</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="0.5"
                                                        max="2"
                                                        step="0.1"
                                                        value={bannerImageScale}
                                                        onChange={(e) => setBannerImageScale(parseFloat(e.target.value))}
                                                        className="w-full h-2 bg-[#252941] rounded-lg appearance-none cursor-pointer"
                                                    />
                                                    <div className="text-xs text-gray-400 text-center">
                                                        {Math.round(bannerImageScale * 100)}%
                                                    </div>
                                                </div>

                                                {/* Image Position Controls */}
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <label className="block text-sm font-medium text-gray-300">
                                                            Posição Horizontal
                                                        </label>
                                                        <span className="text-xs text-gray-500">ou arraste no banner</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="100"
                                                        step="1"
                                                        value={bannerImagePosition.x}
                                                        onChange={(e) => setBannerImagePosition(prev => ({ ...prev, x: parseInt(e.target.value) }))}
                                                        className="w-full h-2 bg-[#252941] rounded-lg appearance-none cursor-pointer"
                                                    />
                                                    <div className="text-xs text-gray-400 text-center">
                                                        {bannerImagePosition.x}%
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <label className="block text-sm font-medium text-gray-300">
                                                        Posição Vertical
                                                    </label>
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="100"
                                                        step="1"
                                                        value={bannerImagePosition.y}
                                                        onChange={(e) => setBannerImagePosition(prev => ({ ...prev, y: parseInt(e.target.value) }))}
                                                        className="w-full h-2 bg-[#252941] rounded-lg appearance-none cursor-pointer"
                                                    />
                                                    <div className="text-xs text-gray-400 text-center">
                                                        {bannerImagePosition.y}%
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="border-2 border-dashed border-[#252941] rounded-lg p-6 text-center hover:border-blue-500 transition-colors cursor-pointer">
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleImageUpload}
                                                    className="hidden"
                                                    id="banner-upload-panel"
                                                />
                                                <label
                                                    htmlFor="banner-upload-panel"
                                                    className="cursor-pointer flex flex-col items-center gap-2"
                                                >
                                                    <Upload className="w-8 h-8 text-gray-400" />
                                                    <span className="text-sm text-gray-400 font-medium">
                                                        {t('checkout_pages.click_to_upload')}
                                                    </span>
                                                    <span className="text-xs text-gray-500">
                                                        {t('checkout_pages.accepted_formats')}
                                                    </span>
                                                </label>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Timer Configuration */}
                        {editingElement === 'timer' && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold text-gray-100">{t('checkout_pages.countdown')}</h3>
                                    <button
                                        onClick={() => setTimerConfig(prev => ({ ...prev, enabled: false }))}
                                        className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                        title={t('checkout_pages.remove_timer')}
                                    >
                                        <X size={16} />
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {/* Time in minutes */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            {t('checkout_pages.time_in_minutes')}
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="MM:SS"
                                            value={timerInputValue}
                                            onChange={(e) => {
                                                let value = e.target.value.replace(/[^\d]/g, '') // Remove não-números

                                                if (value.length >= 2) {
                                                    // Formata como MM:SS
                                                    value = value.slice(0, 2) + ':' + value.slice(2, 4)
                                                }

                                                setTimerInputValue(value)

                                                // Converte para minutos
                                                const parts = value.split(':')
                                                if (parts.length === 2) {
                                                    const minutes = parseInt(parts[0]) || 0
                                                    const seconds = parseInt(parts[1]) || 0
                                                    const totalMinutes = minutes + (seconds / 60)
                                                    setTimerConfig(prev => ({
                                                        ...prev,
                                                        minutes: totalMinutes
                                                    }))
                                                } else if (value && !value.includes(':')) {
                                                    // Se só tem 1 dígito, considera como minutos
                                                    const minutes = parseInt(value) || 0
                                                    setTimerConfig(prev => ({
                                                        ...prev,
                                                        minutes: minutes
                                                    }))
                                                }
                                            }}
                                            className="w-full px-3 py-2 bg-[#0f1117] border border-[#252941] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100"
                                            maxLength={5}
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Formato: MM:SS (ex: 14:30)</p>
                                    </div>

                                    {/* Background color */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            {t('checkout_pages.background_color')}
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="color"
                                                value={timerConfig.backgroundColor}
                                                onChange={(e) => setTimerConfig(prev => ({
                                                    ...prev,
                                                    backgroundColor: e.target.value
                                                }))}
                                                className="w-12 h-10 border border-[#252941] rounded-lg cursor-pointer"
                                            />
                                            <input
                                                type="text"
                                                value={timerConfig.backgroundColor}
                                                onChange={(e) => setTimerConfig(prev => ({
                                                    ...prev,
                                                    backgroundColor: e.target.value
                                                }))}
                                                className="flex-1 px-3 py-2 bg-[#0f1117] border border-[#252941] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100"
                                            />
                                        </div>
                                    </div>

                                    {/* Text color */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            {t('checkout_pages.text_color')}
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="color"
                                                value={timerConfig.textColor}
                                                onChange={(e) => setTimerConfig(prev => ({
                                                    ...prev,
                                                    textColor: e.target.value
                                                }))}
                                                className="w-12 h-10 border border-[#252941] rounded-lg cursor-pointer"
                                            />
                                            <input
                                                type="text"
                                                value={timerConfig.textColor}
                                                onChange={(e) => setTimerConfig(prev => ({
                                                    ...prev,
                                                    textColor: e.target.value
                                                }))}
                                                className="flex-1 px-3 py-2 bg-[#0f1117] border border-[#252941] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100"
                                            />
                                        </div>
                                    </div>

                                    {/* Active text */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            {t('checkout_pages.active_countdown_text')}
                                        </label>
                                        <input
                                            type="text"
                                            value={timerConfig.activeText}
                                            onChange={(e) => setTimerConfig(prev => ({
                                                ...prev,
                                                activeText: e.target.value
                                            }))}
                                            className="w-full px-3 py-2 bg-[#0f1117] border border-[#252941] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100"
                                        />
                                    </div>

                                    {/* Finished text */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            {t('checkout_pages.finished_countdown_text')}
                                        </label>
                                        <input
                                            type="text"
                                            value={timerConfig.finishedText}
                                            onChange={(e) => setTimerConfig(prev => ({
                                                ...prev,
                                                finishedText: e.target.value
                                            }))}
                                            className="w-full px-3 py-2 bg-[#0f1117] border border-[#252941] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Panel Footer */}
                    <div className="px-4 sm:px-6 py-4 border-t border-[#1e2139] bg-[#0f1117] flex gap-3">
                        <button
                            onClick={handleCloseEditPanel}
                            className="flex-1 px-4 py-2.5 border border-[#252941] text-gray-300 rounded-lg hover:bg-[#252941] transition-colors font-medium"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            onClick={() => {
                                handleCloseEditPanel()
                            }}
                            className="flex-1 px-4 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
                        >
                            {t('checkout_pages.apply')}
                        </button>
                    </div>
                </div>
            </div>

            {/* Dark overlay when panel is open */}
            {editPanelOpen && (
                <div
                    onClick={handleCloseEditPanel}
                    className="fixed inset-0 bg-black bg-opacity-50 z-[50] transition-opacity duration-300"
                />
            )}
        </div>
    )
}