import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Eye, Upload, X, Monitor, Smartphone, Edit3, Clock, Link as LinkIcon, Check, RotateCw, Menu, ShoppingCart, Tag, Key, Code, Target, Tags, ShieldCheck, MessageSquare, Plus, Trash2, Star, Image as ImageIcon } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import CheckoutDigital from '@/components/checkout/CheckoutDigital'
import type { CheckoutLanguage } from '@/components/checkout/translations'
import type { Testimonial, CheckoutImageBlock, ImageBlockSlot } from '@/components/checkout/types'
import { supabase } from '@/services/supabase'
import { useI18n } from '@/i18n'
import { getMollieIcon } from '@/pages/apps/AppBuilder/AppSettingsTab'

type EditingElement = 'banner' | 'timer' | 'seals' | 'testimonials' | 'imageblock' | null

interface ComponentItem {
    id: string
    name: string
    icon: any
    type: 'image' | 'timer' | 'seals' | 'testimonials'
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
        { id: 'timer', name: 'Timer', icon: Clock, type: 'timer' },
        { id: 'image', name: 'Imagem', icon: ImageIcon, type: 'image' },
        { id: 'testimonials', name: 'Depoimentos', icon: MessageSquare, type: 'testimonials' }
    ]

    const [product, setProduct] = useState<Product | null>(null)
    const [checkout, setCheckout] = useState<Checkout | null>(null)
    const [productOwnerId, setProductOwnerId] = useState<string>('')

    const [bannerForm, setBannerForm] = useState({
        banner_image: '',
        banner_title: '',
        customHeight: undefined as number | undefined,
        customWidth: undefined as number | undefined
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
    const [securitySealsEnabled, setSecuritySealsEnabled] = useState(false)

    // Testimonials state
    const [testimonials, setTestimonials] = useState<Testimonial[]>([])
    const [editingTestimonialId, setEditingTestimonialId] = useState<string | null>(null)
    const [testimonialPhotoInput, setTestimonialPhotoInput] = useState<string>('')
    const [testimonialsCarouselMode, setTestimonialsCarouselMode] = useState(false)
    const [testimonialsHorizontalMode, setTestimonialsHorizontalMode] = useState(false)

    // Image blocks state
    const [imageBlocks, setImageBlocks] = useState<CheckoutImageBlock[]>([])
    const [editingImageBlockId, setEditingImageBlockId] = useState<string | null>(null)

    const [checkoutLanguage, setCheckoutLanguage] = useState<CheckoutLanguage>('en')

    const [buttonColor, setButtonColor] = useState('#111827')
    const [buttonText, setButtonText] = useState('Complete Purchase')
    const [paymentMethodsOverride, setPaymentMethodsOverride] = useState<string[] | null>(null)
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
                    currency: appData.currency || 'USD',
                    payment_methods: appData.payment_methods || ['credit_card'],
                    default_payment_method: appData.default_payment_method || 'credit_card',
                    image_url: appData.logo_url,
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
                customHeight: (checkoutData as any).custom_height,
                customWidth: (checkoutData as any).custom_width
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

            // Load button text
            if (customFields.buttonText) {
                setButtonText(customFields.buttonText)
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

            // Load security seals
            if (customFields.securitySealsEnabled !== undefined) {
                setSecuritySealsEnabled(customFields.securitySealsEnabled)
            }

            // Load testimonials
            if (customFields.testimonials) {
                // Garantir que testimonials antigos tenham slot padrão
                const testimonialsWithSlot = customFields.testimonials.map((t: any) => ({
                    ...t,
                    slot: t.slot || 'below_button'
                }))
                setTestimonials(testimonialsWithSlot)
            }

            // Load testimonials carousel mode
            if (customFields.testimonialsCarouselMode !== undefined) {
                setTestimonialsCarouselMode(customFields.testimonialsCarouselMode)
            }

            // Load testimonials horizontal mode
            if (customFields.testimonialsHorizontalMode !== undefined) {
                setTestimonialsHorizontalMode(customFields.testimonialsHorizontalMode)
            }

            // Load image blocks
            if (customFields.imageBlocks) {
                setImageBlocks(customFields.imageBlocks)
            }

            // Load payment methods override
            if (customFields.paymentMethods) {
                setPaymentMethodsOverride(customFields.paymentMethods)
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
                buttonText: buttonText.trim() || undefined,
                utmifyToken: utmifyToken.trim() || undefined,
                customPixels: customPixels.trim() || undefined,
                customUtms: customUtms.trim() || undefined,
                bannerImageScale: bannerImageScale,
                bannerImagePosition: bannerImagePosition,
                securitySealsEnabled: securitySealsEnabled,
                testimonials: testimonials.length > 0 ? testimonials : undefined,
                testimonialsCarouselMode: testimonialsCarouselMode,
                testimonialsHorizontalMode: testimonialsHorizontalMode,
                imageBlocks: imageBlocks.length > 0 ? imageBlocks : undefined,
                paymentMethods: paymentMethodsOverride ?? undefined
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
                    custom_width: bannerForm.customWidth,
                    custom_fields: updatedFields,
                    language: checkoutLanguage
                })
                .eq('id', checkout.id)

            if (error) throw error

            // ⚡ Purge + re-warm do KV cache: garante que o próximo visitante
            // veja os dados atualizados E não sofra cache miss (~300ms Supabase RPC).
            // Fire-and-forget — não bloqueia o alert de sucesso.
            fetch('https://api.clicknich.com/api/cache/purge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ checkoutId: checkout.id }),
            }).catch(() => { /* silencioso — purge é best-effort */ })

            alert(t('checkout_pages.saved_success'))
        } catch (error) {
            console.error('Error saving:', error)
            alert(t('checkout_pages.error_saving'))
        } finally {
            setSaving(false)
        }
    }

    // ── Upload de imagem para o Supabase Storage ──────────────────────────────
    const uploadCheckoutImage = async (file: File, folder: string): Promise<string> => {
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
        const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { data, error } = await supabase.storage
            .from('checkout-banners')
            .upload(path, file, { cacheControl: '31536000', upsert: false })
        if (error) throw error
        return supabase.storage.from('checkout-banners').getPublicUrl(data.path).data.publicUrl
    }

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Preview local imediato enquanto faz upload
        const previewUrl = URL.createObjectURL(file)
        setBannerForm(prev => ({ ...prev, banner_image: previewUrl }))
        setBannerImageScale(1)
        setBannerImagePosition({ x: 50, y: 50 })

        try {
            const url = await uploadCheckoutImage(file, 'banners')
            setBannerForm(prev => ({ ...prev, banner_image: url }))
            URL.revokeObjectURL(previewUrl)
        } catch (err) {
            console.error('Erro ao fazer upload do banner:', err)
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

    const handleBannerWidthUpdate = (width: number) => {
        setBannerForm(prev => ({ ...prev, customWidth: width }))
    }

    const handleBannerUploadFromPreview = (url: string) => {
        setBannerForm(prev => ({ ...prev, banner_image: url }))
        setBannerImageScale(1)
        setBannerImagePosition({ x: 50, y: 50 })
        setEditingElement('banner')
    }

    // Chamado pelo CheckoutBanner quando o usuário escolhe um arquivo via drag-drop/clique
    const handleBannerFileUpload = async (file: File) => {
        // Preview local imediato
        const previewUrl = URL.createObjectURL(file)
        setBannerForm(prev => ({ ...prev, banner_image: previewUrl }))
        setBannerImageScale(1)
        setBannerImagePosition({ x: 50, y: 50 })
        setEditingElement('banner')

        try {
            const url = await uploadCheckoutImage(file, 'banners')
            setBannerForm(prev => ({ ...prev, banner_image: url }))
            URL.revokeObjectURL(previewUrl)
        } catch (err) {
            console.error('Erro ao fazer upload do banner:', err)
        }
    }

    const handleCloseEditPanel = () => {
        setEditPanelOpen(false)
        setTimeout(() => setEditingElement(null), 300) // Aguarda animação
    }

    const handleAddImageBlock = (slot: ImageBlockSlot = 'below_button') => {
        const newBlock: CheckoutImageBlock = {
            id: `img-${Date.now()}`,
            url: '',
            slot: slot,
            width: 'full'
        }
        setImageBlocks(prev => [...prev, newBlock])
        setEditingImageBlockId(newBlock.id)
        setEditingElement('imageblock')
        setEditPanelOpen(true)
    }

    const handleUpdateImageBlock = (id: string, updates: Partial<CheckoutImageBlock>) => {
        setImageBlocks(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b))
    }

    const handleDeleteImageBlock = (id: string) => {
        setImageBlocks(prev => prev.filter(b => b.id !== id))
        if (editingImageBlockId === id) {
            handleCloseEditPanel()
        }
    }

    const handleImageBlockUpload = async (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (file.size > 10 * 1024 * 1024) {
            alert('Imagem muito grande. Máximo: 10MB')
            return
        }

        // Preview local imediato
        const previewUrl = URL.createObjectURL(file)
        handleUpdateImageBlock(id, { url: previewUrl })

        try {
            const url = await uploadCheckoutImage(file, 'image-blocks')
            handleUpdateImageBlock(id, { url })
            URL.revokeObjectURL(previewUrl)
        } catch (err) {
            console.error('Erro ao fazer upload da imagem do bloco:', err)
        }
    }

    const handleAddTestimonial = (slot: 'below_button' = 'below_button') => {
        const newTestimonial: Testimonial = {
            id: `t-${Date.now()}`,
            photo: '',
            text: 'Digite seu depoimento aqui',
            stars: 5,
            name: 'John Doe',
            backgroundColor: '#ffffff',
            textColor: '#111827',
            horizontalMode: false,
            slot: slot
        }
        setTestimonials(prev => [...prev, newTestimonial])
        setEditingTestimonialId(newTestimonial.id)
        setTestimonialPhotoInput('')
        setEditingElement('testimonials')
        setEditPanelOpen(true)
    }

    const handleEditTestimonial = (id: string) => {
        setEditingTestimonialId(id)
        setTestimonialPhotoInput('')
        setEditingElement('testimonials')
        setEditPanelOpen(true)
    }

    const handleUpdateTestimonial = (id: string, updates: Partial<Testimonial>) => {
        setTestimonials(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
    }

    const handleDeleteTestimonial = (id: string) => {
        setTestimonials(prev => prev.filter(t => t.id !== id))
        if (editingTestimonialId === id) {
            handleCloseEditPanel()
        }
    }

    const handleTestimonialPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (file.size > 10 * 1024 * 1024) {
            alert('Imagem muito grande. Máximo: 10MB')
            return
        }

        // Preview local imediato
        const previewUrl = URL.createObjectURL(file)
        handleUpdateTestimonial(id, { photo: previewUrl })

        try {
            const url = await uploadCheckoutImage(file, 'testimonials')
            handleUpdateTestimonial(id, { photo: url })
            URL.revokeObjectURL(previewUrl)
        } catch (err) {
            console.error('Erro ao fazer upload da foto do depoimento:', err)
        }
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
            if (draggedComponent.type === 'timer') {
                if (dropZone === 'timer') {
                    // Ativar timer na área específica
                    setTimerConfig(prev => ({ ...prev, enabled: true }))
                    handleEditElement('timer')
                } else {
                    alert(t('checkout_pages.timer_area_only'))
                }
            } else if (draggedComponent.type === 'seals') {
                setSecuritySealsEnabled(true)
                handleEditElement('seals')
            } else if (draggedComponent.type === 'testimonials') {
                handleAddTestimonial('below_button')
            } else if (draggedComponent.type === 'image') {
                // Mapear drop zones para slots de imagem
                const validImageSlots: ImageBlockSlot[] = [
                    'below_payment_methods',
                    'above_button',
                    'below_button',
                    'above_testimonials',
                    'between_testimonials',
                    'below_testimonials',
                    'below_seals'
                ]

                if (dropZone && validImageSlots.includes(dropZone as ImageBlockSlot)) {
                    handleAddImageBlock(dropZone as ImageBlockSlot)
                } else {
                    handleAddImageBlock('below_button') // slot padrão
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
            <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex transition-colors duration-200">
                <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-700 border-t-blue-600 mx-auto"></div>
                            <p className="mt-3 text-sm text-gray-600">{t('common.loading')}</p>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (!product || !checkout) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-600">{t('checkout_pages.error_loading')}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#080b14] flex">

            <div className="flex-1 flex flex-col min-w-0">
                {/* Navbar - Fixed at top */}
                <div className="bg-gray-900 border-b border-gray-800 sticky top-0 z-[60]">
                    <div className="flex items-center justify-between px-4 lg:px-6">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate(-1)}
                                className="p-2 hover:bg-gray-800/50 rounded-lg transition-colors duration-200 flex-shrink-0"
                            >
                                <ArrowLeft size={14} className="text-blue-400" />
                            </button>
                            <span className="text-xs font-medium text-gray-400">{t('checkout_pages.builder_title')}</span>

                            {/* Tabs */}
                            {/* Tabs removidas - agora usamos o sistema de Funis para ofertas */}
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Device Controls */}
                            <div className="flex items-center gap-0.5 rounded-lg p-0.5">
                                <button
                                    onClick={() => setViewDevice('desktop')}
                                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${viewDevice === 'desktop'
                                        ? 'text-gray-100 shadow-sm'
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
                                        ? 'text-gray-100 shadow-sm'
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
                                className="bg-transparent text-gray-100 text-[11px] font-medium rounded-lg px-2 py-1 border-none focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                title="Checkout Language"
                            >
                                <option value="en">🇺🇸 EN</option>
                                <option value="es">🇪🇸 ES</option>
                                <option value="pt">🇧🇷 PT</option>
                                <option value="nl">🇳🇱 NL</option>
                                <option value="fr">🇫🇷 FR</option>
                                <option value="de">🇩🇪 DE</option>
                            </select>

                            {/* Preview Button */}
                            <button
                                onClick={() => window.open(`/checkout/${productId}/${checkoutId}`, '_blank')}
                                className="flex items-center gap-1 px-3 py-1 text-gray-300 rounded-lg hover:text-white transition-colors text-[11px] font-medium"
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

                <div className="flex-1 flex overflow-hidden">
                    <main className="flex-1 overflow-y-auto px-3 lg:px-6 py-4">
                        {/* Preview Area */}
                        <div className="max-w-4xl mx-auto">
                            {/* Device Frame */}
                            <div className={`transition-all duration-300 ${viewDevice === 'mobile'
                                ? 'max-w-sm mx-auto'
                                : 'w-full'
                                }`}>
                                <div
                                    className={`rounded-xl border border-gray-700/50 shadow-lg shadow-black/20 ${viewDevice === 'mobile'
                                        ? 'overflow-y-auto'
                                        : 'overflow-hidden'
                                        }`}
                                    style={viewDevice === 'mobile' ? { maxHeight: '85vh' } : {}}
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
                                            selectedPaymentMethods={paymentMethodsOverride ?? product.payment_methods}
                                            defaultPaymentMethod={product.default_payment_method}
                                            productImage={product.image_url}
                                            productDescription={product.description}
                                            language={checkoutLanguage}
                                            customBanner={
                                                {
                                                    image: bannerForm.banner_image || '',
                                                    title: bannerForm.banner_title,
                                                    customHeight: bannerForm.customHeight,
                                                    customWidth: bannerForm.customWidth,
                                                    imageScale: bannerImageScale,
                                                    imagePosition: bannerImagePosition
                                                }
                                            }
                                            bannerSelected={editingElement === 'banner'}
                                            onBannerClick={() => {
                                                if (editingElement === 'banner') {
                                                    setEditingElement(null)
                                                } else {
                                                    setEditingElement('banner')
                                                }
                                            }}
                                            onBannerAdjust={() => {
                                                handleEditElement('banner')
                                            }}
                                            onBannerRemove={() => {
                                                handleRemoveImage()
                                                setEditingElement(null)
                                            }}
                                            onBannerResize={handleBannerResize}
                                            onUpdateBannerWidth={handleBannerWidthUpdate}
                                            onBannerUpload={handleBannerUploadFromPreview}
                                            onBannerFile={handleBannerFileUpload}
                                            onBannerImageScaleChange={(scale) => setBannerImageScale(scale)}
                                            onBannerImagePositionChange={(position) => setBannerImagePosition(position)}
                                            isPreview={true}
                                            viewDevice={viewDevice}
                                            isDragging={!!draggedComponent}
                                            timerConfig={timerConfig}
                                            onTimerClick={() => handleEditElement('timer')}
                                            draggedComponentType={draggedComponent?.type || null}
                                            buttonColor={buttonColor}
                                            buttonText={buttonText}
                                            securitySealsEnabled={securitySealsEnabled}
                                            onSecuritySealsClick={() => handleEditElement('seals')}
                                            testimonials={testimonials}
                                            testimonialsCarouselMode={testimonialsCarouselMode}
                                            testimonialsHorizontalMode={testimonialsHorizontalMode}
                                            onTestimonialsClick={(id) => {
                                                setEditingElement('testimonials')
                                                setEditPanelOpen(true)
                                                setEditingTestimonialId(id ?? testimonials[0]?.id ?? null)
                                            }}
                                            imageBlocks={imageBlocks}
                                            onUpdateImageBlock={handleUpdateImageBlock}
                                            onDeleteImageBlock={handleDeleteImageBlock}
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
                    {/* Components Panel - Right Side */}
                    <aside className="hidden lg:block w-56 flex-shrink-0 border-l border-gray-800">
                        <div className="fixed top-[41px] right-0 w-56 h-[calc(100vh-41px)] overflow-y-auto bg-gray-900 border-l border-gray-800 p-4">

                            {/* Nome e Preço */}
                            <div className="mb-4 pb-4 border-b border-gray-800 space-y-2">
                                <div>
                                    <div className="text-[10px] font-semibold text-gray-500 tracking-widest mb-1">NOME</div>
                                    <input
                                        type="text"
                                        value={checkoutName}
                                        onChange={(e) => setCheckoutName(e.target.value)}
                                        placeholder="Nome do checkout"
                                        className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700/50 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/50 text-gray-100 text-xs"
                                    />
                                </div>
                                <div>
                                    <div className="text-[10px] font-semibold text-gray-500 tracking-widest mb-1">PREÇO</div>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={checkoutPrice}
                                        onChange={(e) => setCheckoutPrice(e.target.value)}
                                        placeholder={product ? String(product.price) : '0.00'}
                                        className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700/50 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/50 text-gray-100 text-xs"
                                    />
                                </div>
                            </div>

                            <h3 className="text-sm font-bold text-gray-100 mb-3">{t('checkout_pages.components')}</h3>

                            <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-3 font-semibold">
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
                                            className="bg-gray-800 rounded-lg p-3 flex flex-col items-center justify-center gap-2 cursor-move hover:bg-gray-700/60 transition-all border border-gray-700/50 hover:border-gray-600"
                                        >
                                            <div className="w-9 h-9 bg-gray-700/60 rounded-lg flex items-center justify-center">
                                                <Icon size={18} className="text-gray-400" />
                                            </div>
                                            <span className="text-[11px] text-gray-300 text-center font-medium">
                                                {component.name}
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Button Color */}
                            <div className="mt-4 pt-4 border-t border-gray-800">
                                <div className="text-[10px] font-semibold text-gray-400 tracking-widest mb-2">
                                    {t('checkout_pages.button_color')}
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="relative flex-shrink-0">
                                        <input
                                            type="color"
                                            value={buttonColor}
                                            onChange={(e) => setButtonColor(e.target.value)}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        />
                                        <div
                                            className="w-14 h-10 rounded-lg border-2 border-gray-600 shadow-inner cursor-pointer"
                                            style={{ backgroundColor: buttonColor }}
                                        />
                                    </div>
                                    <input
                                        type="text"
                                        value={buttonColor}
                                        onChange={(e) => setButtonColor(e.target.value)}
                                        className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-700/50 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/50 text-gray-100 text-xs"
                                    />
                                </div>
                            </div>

                            {/* Button Text */}
                            <div className="mt-4">
                                <div className="text-[10px] font-semibold text-gray-400 tracking-widest mb-2">
                                    TEXTO DO BOTÃO
                                </div>
                                <input
                                    type="text"
                                    value={buttonText}
                                    onChange={(e) => setButtonText(e.target.value)}
                                    placeholder="Complete Purchase"
                                    className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700/50 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/50 text-gray-100 text-xs"
                                />
                            </div>

                            {/* Pixels Personalizados */}
                            <div className="mt-4 pt-4 border-t border-gray-800">
                                <div className="flex items-center gap-1.5 mb-2">
                                    <div className="text-[10px] font-semibold text-gray-400 tracking-widest">
                                        PIXELS DE TRACKING
                                    </div>
                                </div>
                                <p className="text-[10px] text-gray-500 mb-2">
                                    Facebook Pixel, Google Analytics, TikTok Pixel, etc.
                                </p>
                                <textarea
                                    value={customPixels}
                                    onChange={(e) => setCustomPixels(e.target.value)}
                                    placeholder=""
                                    rows={4}
                                    className="w-full px-2 py-2 bg-gray-800 border border-gray-700/50 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/50 text-gray-300 text-[11px] font-mono resize-y"
                                />
                            </div>

                            {/* UTMs Personalizados */}
                            <div className="mt-4 pt-4 border-t border-gray-800">
                                <div className="flex items-center gap-1.5 mb-2">
                                    <div className="text-[10px] font-semibold text-gray-400 tracking-widest">
                                        UTMs CUSTOMIZADOS
                                    </div>
                                </div>
                                <p className="text-[10px] text-gray-500 mb-2">
                                    UTMs específicos para este checkout (sobrescreve URL).
                                </p>
                                <textarea
                                    value={customUtms}
                                    onChange={(e) => setCustomUtms(e.target.value)}
                                    placeholder=""
                                    rows={4}
                                    className="w-full px-2 py-2 bg-gray-800 border border-gray-700/50 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/50 text-gray-300 text-[11px] font-mono resize-y"
                                />
                            </div>

                            {/* MÉTODOS DE PAGAMENTO */}
                            {product && product.payment_methods && product.payment_methods.length > 1 && (
                                <div className="mt-4 pt-4 border-t border-gray-800">
                                    <div className="text-[10px] font-semibold text-gray-400 tracking-widest mb-2">
                                        MÉTODOS DE PAGAMENTO
                                    </div>
                                    <div className="space-y-1.5">
                                        {product.payment_methods.map((method) => {
                                            const active = (paymentMethodsOverride ?? product.payment_methods!).includes(method)
                                            const label = method === 'credit_card' ? 'Cartão de Crédito' : method === 'paypal' ? 'PayPal' : method.replace('mollie_', '').replace(/(^|\s)\w/g, c => c.toUpperCase())
                                            return (
                                                <label key={method} className="flex items-center gap-2 cursor-pointer group">
                                                    <div
                                                        onClick={() => {
                                                            const current = paymentMethodsOverride ?? product.payment_methods!
                                                            const updated = current.includes(method)
                                                                ? current.filter(m => m !== method)
                                                                : [...current, method]
                                                            if (updated.length === 0) return // mínimo 1
                                                            setPaymentMethodsOverride(updated)
                                                        }}
                                                        className={`w-8 h-4 rounded-full transition-colors cursor-pointer flex-shrink-0 ${active ? 'bg-blue-500' : 'bg-gray-700'}`}
                                                    >
                                                        <div className={`w-3.5 h-3.5 rounded-full bg-white shadow transition-transform m-[1px] ${active ? 'translate-x-4' : 'translate-x-0'}`} />
                                                    </div>
                                                    <span className={`text-[11px] transition-colors ${active ? 'text-gray-200' : 'text-gray-500'}`}>{label}</span>
                                                </label>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* IMAGENS */}
                            <div className="mt-4 pt-4 border-t border-gray-800">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="text-[10px] font-semibold text-gray-400 tracking-widest">IMAGENS</div>
                                    <button
                                        onClick={handleAddImageBlock}
                                        className="flex items-center gap-0.5 px-1.5 py-0.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-[10px] transition-colors"
                                        title="Adicionar bloco de imagem"
                                    >
                                        <Plus size={10} />
                                    </button>
                                </div>
                                {imageBlocks.length === 0 ? (
                                    <p className="text-[10px] text-gray-600 italic">Nenhuma imagem adicionada.</p>
                                ) : (
                                    <div className="space-y-1.5">
                                        {imageBlocks.map((block, idx) => (
                                            <div key={block.id} className="flex items-center gap-1.5 bg-gray-800 border border-gray-700/50 rounded-lg px-2 py-1.5">
                                                {block.url ? (
                                                    <img src={block.url} alt="" className="w-7 h-7 rounded object-cover flex-shrink-0 border border-gray-700/50" />
                                                ) : (
                                                    <div className="w-7 h-7 rounded bg-gray-700 flex items-center justify-center flex-shrink-0">
                                                        <ImageIcon size={12} className="text-gray-500" />
                                                    </div>
                                                )}
                                                <span className="flex-1 text-[10px] text-gray-400 truncate">Imagem {idx + 1}</span>
                                                <button
                                                    onClick={() => {
                                                        setEditingImageBlockId(block.id)
                                                        setEditingElement('imageblock')
                                                        setEditPanelOpen(true)
                                                    }}
                                                    className="p-1 hover:bg-gray-700 rounded transition-colors text-gray-400 hover:text-gray-100"
                                                    title="Editar"
                                                >
                                                    <Edit3 size={10} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteImageBlock(block.id)}
                                                    className="p-1 hover:bg-red-500/10 rounded transition-colors text-gray-500 hover:text-red-400"
                                                    title="Remover"
                                                >
                                                    <X size={10} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </aside>
                </div>
            </div>

            {/* Side Edit Panel */}
            <div
                className={`fixed top-0 right-0 h-full w-full sm:w-72 bg-gray-900 shadow-2xl transform transition-transform duration-300 ease-in-out z-[100] ${editPanelOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
            >
                <div className="flex flex-col h-full">
                    {/* Panel Header */}
                    <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-800 bg-gray-950">
                        <h3 className="text-xs font-semibold text-gray-100 uppercase tracking-wider">
                            {editingElement === 'banner' && 'Banner'}
                            {editingElement === 'timer' && t('checkout_pages.timer')}
                            {editingElement === 'seals' && 'Trust Seals'}
                            {editingElement === 'testimonials' && 'Depoimento'}
                            {editingElement === 'imageblock' && 'Bloco de Imagem'}
                        </h3>
                        <button
                            onClick={handleCloseEditPanel}
                            className="p-1 hover:bg-gray-800 rounded transition-colors text-gray-400 hover:text-gray-100"
                        >
                            <X size={14} />
                        </button>
                    </div>

                    {/* Panel Content */}
                    <div className="flex-1 overflow-y-auto p-3">
                        {editingElement === 'banner' && (
                            <div className="space-y-3">
                                {/* Image */}
                                <div>
                                    <div className="space-y-2">
                                        {bannerForm.banner_image ? (
                                            <>
                                                <div className="relative">
                                                    <img
                                                        src={bannerForm.banner_image}
                                                        alt="Banner preview"
                                                        className="w-full h-24 object-cover rounded border border-gray-800"
                                                    />
                                                    <div className="absolute top-1 right-1 flex gap-1">
                                                        <label
                                                            htmlFor="banner-upload-panel-replace"
                                                            className="flex items-center gap-1 px-1.5 py-1 bg-blue-600 text-white text-[10px] font-medium rounded cursor-pointer hover:bg-blue-700 transition-colors"
                                                            title="Trocar imagem"
                                                        >
                                                            <Upload size={10} />
                                                            Trocar
                                                        </label>
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            onChange={handleImageUpload}
                                                            className="hidden"
                                                            id="banner-upload-panel-replace"
                                                        />
                                                        <button
                                                            onClick={handleRemoveImage}
                                                            className="p-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                                                            title={t('checkout_pages.remove')}
                                                        >
                                                            <X size={10} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="border-2 border-dashed border-gray-700 rounded p-4 text-center hover:border-blue-500 transition-colors cursor-pointer">
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleImageUpload}
                                                    className="hidden"
                                                    id="banner-upload-panel"
                                                />
                                                <label
                                                    htmlFor="banner-upload-panel"
                                                    className="cursor-pointer flex flex-col items-center gap-1"
                                                >
                                                    <Upload className="w-5 h-5 text-gray-400" />
                                                    <span className="text-[11px] text-gray-400 font-medium">
                                                        {t('checkout_pages.click_to_upload')}
                                                    </span>
                                                    <span className="text-[10px] text-gray-500">
                                                        {t('checkout_pages.accepted_formats')}
                                                    </span>
                                                </label>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Security Seals Configuration */}
                        {editingElement === 'seals' && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider">Trust Seals</span>
                                    <button
                                        onClick={() => {
                                            setSecuritySealsEnabled(false)
                                            handleCloseEditPanel()
                                        }}
                                        className="p-1 text-red-500 hover:bg-red-500/10 rounded transition-colors"
                                        title="Remover selos"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>

                                <p className="text-[11px] text-gray-400">
                                    Exibe 3 selos de segurança abaixo do checkout.
                                </p>

                                {/* Preview dos selos */}
                                <div className="bg-white rounded-xl border border-gray-700 overflow-hidden">
                                    <div className="grid grid-cols-3 divide-x divide-gray-200 py-4">
                                        {/* SSL */}
                                        <div className="flex flex-col items-center gap-1.5 px-3 text-center">
                                            <svg viewBox="0 0 52 52" fill="none" className="w-10 h-10">
                                                <path d="M26 2L6 10V26C6 37.05 14.74 47.35 26 50C37.26 47.35 46 37.05 46 26V10L26 2Z" fill="#22c55e" />
                                                <path d="M26 4L8 11.6V26C8 36.2 16.06 45.68 26 48.2C35.94 45.68 44 36.2 44 26V11.6L26 4Z" fill="#16a34a" />
                                                <rect x="19" y="21" width="14" height="13" rx="1.5" fill="white" />
                                                <path d="M21 21V18C21 14.686 24.134 12 26 12C27.866 12 31 14.686 31 18V21" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                                                <circle cx="26" cy="27.5" r="2" fill="#16a34a" />
                                                <rect x="25.2" y="27.5" width="1.6" height="3" rx="0.8" fill="#16a34a" />
                                            </svg>
                                            <div className="font-bold text-[9px] text-gray-700 uppercase">SSL Secured</div>
                                            <div className="text-[8px] text-gray-500">Encrypted checkout</div>
                                        </div>
                                        {/* Secure Payments */}
                                        <div className="flex flex-col items-center gap-1.5 px-3 text-center">
                                            <svg viewBox="0 0 52 52" fill="none" className="w-10 h-10">
                                                <circle cx="26" cy="26" r="24" fill="#b45309" />
                                                <circle cx="26" cy="26" r="22" fill="#d97706" />
                                                <circle cx="26" cy="26" r="20" fill="#f59e0b" />
                                                <circle cx="26" cy="26" r="17" fill="#fde68a" />
                                                <circle cx="26" cy="26" r="14" fill="#d97706" />
                                                <text x="26" y="23.5" textAnchor="middle" fill="white" fontSize="8.5" fontWeight="bold" fontFamily="Arial, sans-serif">100%</text>
                                                <text x="26" y="32" textAnchor="middle" fill="white" fontSize="5.5" fontWeight="600" fontFamily="Arial, sans-serif">SAFE</text>
                                                <text x="13" y="27" textAnchor="middle" fill="#fde68a" fontSize="6">★</text>
                                                <text x="39" y="27" textAnchor="middle" fill="#fde68a" fontSize="6">★</text>
                                            </svg>
                                            <div className="font-bold text-[9px] text-gray-700 uppercase">Secure Payments</div>
                                            <div className="text-[8px] text-gray-500">Verified providers</div>
                                        </div>
                                        {/* 100% Garantia */}
                                        <div className="flex flex-col items-center gap-1.5 px-3 text-center">
                                            <svg viewBox="0 0 52 52" fill="none" className="w-10 h-10">
                                                <path d="M26 2L6 10V26C6 37.05 14.74 47.35 26 50C37.26 47.35 46 37.05 46 26V10L26 2Z" fill="#7c3aed" />
                                                <path d="M26 4L8 11.6V26C8 36.2 16.06 45.68 26 48.2C35.94 45.68 44 36.2 44 26V11.6L26 4Z" fill="#8b5cf6" />
                                                <circle cx="26" cy="22" r="8" fill="white" opacity="0.2" />
                                                <circle cx="26" cy="22" r="6" fill="white" opacity="0.9" />
                                                <text x="26" y="26" textAnchor="middle" fill="#8b5cf6" fontSize="9" fontWeight="bold" fontFamily="Arial, sans-serif">★</text>
                                                <path d="M20 30L26 34L32 30L30 42L26 39L22 42Z" fill="white" opacity="0.85" />
                                            </svg>
                                            <div className="font-bold text-[9px] text-gray-700 uppercase">100% Garantia</div>
                                            <div className="text-[8px] text-gray-500">Compra protegida</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 p-2 bg-green-500/10 border border-green-500/20 rounded">
                                    <ShieldCheck size={12} className="text-green-400 flex-shrink-0" />
                                    <p className="text-[10px] text-green-400">Selos ativos e visíveis no checkout</p>
                                </div>
                            </div>
                        )}

                        {/* Testimonials Configuration */}
                        {editingElement === 'testimonials' && (() => {
                            const testimonial = testimonials.find(t => t.id === editingTestimonialId)
                            return (
                                <div className="space-y-3">
                                    {/* Header with list of all testimonials */}
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Depoimentos</span>
                                            <button
                                                onClick={() => handleAddTestimonial('below_button')}
                                                className="flex items-center gap-0.5 text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
                                            >
                                                <Plus size={11} />
                                                Novo
                                            </button>
                                        </div>

                                        {/* Carousel mode toggle */}
                                        <div className="mb-2 flex items-center justify-between p-2 bg-gray-950 border border-gray-700 rounded-lg">
                                            <label className="text-xs font-medium text-gray-300">Modo Carrossel</label>
                                            <button
                                                onClick={() => setTestimonialsCarouselMode(!testimonialsCarouselMode)}
                                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${testimonialsCarouselMode ? 'bg-blue-500' : 'bg-gray-800'}`}
                                            >
                                                <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${testimonialsCarouselMode ? 'translate-x-5' : 'translate-x-1'}`} />
                                            </button>
                                        </div>

                                        {/* Horizontal mode toggle */}
                                        <div className="mb-2 flex items-center justify-between p-2 bg-gray-950 border border-gray-700 rounded-lg">
                                            <label className="text-xs font-medium text-gray-300">Modo Horizontal</label>
                                            <button
                                                onClick={() => setTestimonialsHorizontalMode(!testimonialsHorizontalMode)}
                                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${testimonialsHorizontalMode ? 'bg-blue-500' : 'bg-gray-800'}`}
                                            >
                                                <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${testimonialsHorizontalMode ? 'translate-x-5' : 'translate-x-1'}`} />
                                            </button>
                                        </div>

                                        {testimonials.length === 0 ? (
                                            <p className="text-[10px] text-gray-600 italic text-center py-2">Nenhum depoimento. Clique em "+ Novo" para adicionar.</p>
                                        ) : (
                                            <div className="flex flex-col gap-1">
                                                {testimonials.map(t => (
                                                    <div
                                                        key={t.id}
                                                        className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition-colors ${t.id === editingTestimonialId ? 'bg-blue-500/20 border border-blue-500/40' : 'bg-gray-950 border border-gray-700 hover:border-blue-500/40'}`}
                                                        onClick={() => { setEditingTestimonialId(t.id) }}
                                                    >
                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                            {t.photo ? (
                                                                <img src={t.photo} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                                                            ) : (
                                                                <div className="w-5 h-5 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0">
                                                                    <MessageSquare size={9} className="text-gray-400" />
                                                                </div>
                                                            )}
                                                            <span className="text-[11px] text-gray-300 truncate">{t.name}</span>
                                                        </div>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteTestimonial(t.id) }}
                                                            className="p-1 text-red-500 hover:bg-red-500/10 rounded transition-colors flex-shrink-0"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {testimonial && (
                                        <div className="border-t border-gray-700 pt-4 space-y-4">
                                            {/* Photo upload */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">Foto</label>
                                                <div className="flex flex-col items-center gap-3">
                                                    {testimonial.photo ? (
                                                        <div className="relative">
                                                            <img src={testimonial.photo} alt="preview" className="w-20 h-20 rounded-full object-cover border-2 border-gray-700" />
                                                            <button
                                                                onClick={() => handleUpdateTestimonial(testimonial.id, { photo: '' })}
                                                                className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center hover:bg-red-700 transition-colors"
                                                            >
                                                                <X size={10} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <label htmlFor={`testimonial-photo-${testimonial.id}`} className="w-20 h-20 rounded-full bg-gray-800 border-2 border-dashed border-gray-600 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-blue-500 transition-colors">
                                                            <Upload size={16} className="text-gray-400" />
                                                            <span className="text-[9px] text-gray-500 text-center leading-tight">Upload<br />photo</span>
                                                        </label>
                                                    )}
                                                    <input
                                                        id={`testimonial-photo-${testimonial.id}`}
                                                        type="file"
                                                        accept="image/jpeg,image/png"
                                                        className="hidden"
                                                        onChange={(e) => handleTestimonialPhotoUpload(e, testimonial.id)}
                                                    />
                                                    <span className="text-[10px] text-gray-500">Formatos aceitos: JPG ou PNG. Tamanho máximo: 10MB.</span>
                                                </div>
                                            </div>

                                            {/* Testimonial text */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">Depoimento</label>
                                                <textarea
                                                    value={testimonial.text}
                                                    onChange={(e) => handleUpdateTestimonial(testimonial.id, { text: e.target.value })}
                                                    rows={4}
                                                    placeholder="Digite seu depoimento aqui"
                                                    className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100 text-sm resize-none"
                                                />
                                            </div>

                                            {/* Stars */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">Estrelas</label>
                                                <div className="flex gap-1">
                                                    {[1, 2, 3, 4, 5].map((star) => (
                                                        <button
                                                            key={star}
                                                            onClick={() => handleUpdateTestimonial(testimonial.id, { stars: star })}
                                                            className="transition-transform hover:scale-110"
                                                        >
                                                            <svg viewBox="0 0 20 20" fill={star <= testimonial.stars ? '#f59e0b' : '#374151'} className="w-7 h-7">
                                                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                            </svg>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Name */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">Nome</label>
                                                <input
                                                    type="text"
                                                    value={testimonial.name}
                                                    onChange={(e) => handleUpdateTestimonial(testimonial.id, { name: e.target.value })}
                                                    placeholder="John Doe"
                                                    className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100 text-sm"
                                                />
                                            </div>

                                            {/* Background color */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">Cor de fundo</label>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="color"
                                                        value={testimonial.backgroundColor}
                                                        onChange={(e) => handleUpdateTestimonial(testimonial.id, { backgroundColor: e.target.value })}
                                                        className="w-10 h-10 border border-gray-700 rounded-lg cursor-pointer bg-transparent"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={testimonial.backgroundColor}
                                                        onChange={(e) => handleUpdateTestimonial(testimonial.id, { backgroundColor: e.target.value })}
                                                        className="flex-1 px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100 text-sm"
                                                    />
                                                </div>
                                            </div>

                                            {/* Text color */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">Cor do texto</label>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="color"
                                                        value={testimonial.textColor}
                                                        onChange={(e) => handleUpdateTestimonial(testimonial.id, { textColor: e.target.value })}
                                                        className="w-10 h-10 border border-gray-700 rounded-lg cursor-pointer bg-transparent"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={testimonial.textColor}
                                                        onChange={(e) => handleUpdateTestimonial(testimonial.id, { textColor: e.target.value })}
                                                        className="flex-1 px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100 text-sm"
                                                    />
                                                </div>
                                            </div>

                                        </div>
                                    )}
                                </div>
                            )
                        })()}

                        {/* Image Block Configuration */}
                        {editingElement === 'imageblock' && (() => {
                            const block = imageBlocks.find(b => b.id === editingImageBlockId)
                            if (!block) return null
                            return (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-end">
                                        <button
                                            onClick={() => {
                                                handleDeleteImageBlock(block.id)
                                                handleCloseEditPanel()
                                            }}
                                            className="p-1 text-red-500 hover:bg-red-500/10 rounded transition-colors"
                                            title="Remover imagem"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>

                                    {/* Upload */}
                                    <div>
                                        <label className="block text-[10px] font-medium text-gray-400 mb-1">Imagem</label>
                                        {block.url ? (
                                            <div className="relative">
                                                <img src={block.url} alt="" className="w-full rounded border border-gray-800 object-contain max-h-32" />
                                                <div className="absolute top-1 right-1 flex gap-1">
                                                    <label htmlFor={`img-block-upload-${block.id}`} className="flex items-center gap-1 px-1.5 py-1 bg-blue-600 text-white text-[10px] font-medium rounded cursor-pointer hover:bg-blue-700 transition-colors">
                                                        <Upload size={10} />
                                                        Trocar
                                                    </label>
                                                    <input type="file" accept="image/*" id={`img-block-upload-${block.id}`} className="hidden" onChange={(e) => handleImageBlockUpload(e, block.id)} />
                                                    <button onClick={() => handleUpdateImageBlock(block.id, { url: '' })} className="p-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors">
                                                        <X size={10} />
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="border-2 border-dashed border-gray-700 rounded p-4 text-center hover:border-blue-500 transition-colors cursor-pointer">
                                                <input type="file" accept="image/*" id={`img-block-upload-${block.id}`} className="hidden" onChange={(e) => handleImageBlockUpload(e, block.id)} />
                                                <label htmlFor={`img-block-upload-${block.id}`} className="cursor-pointer flex flex-col items-center gap-1">
                                                    <Upload className="w-5 h-5 text-gray-400" />
                                                    <span className="text-[11px] text-gray-400 font-medium">Clique para enviar</span>
                                                    <span className="text-[10px] text-gray-500">PNG, JPG, WEBP</span>
                                                </label>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })()}

                        {/* Timer Configuration */}
                        {editingElement === 'timer' && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider">{t('checkout_pages.countdown')}</span>
                                    <button
                                        onClick={() => setTimerConfig(prev => ({ ...prev, enabled: false }))}
                                        className="p-1 text-red-500 hover:bg-red-500/10 rounded transition-colors"
                                        title={t('checkout_pages.remove_timer')}
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>

                                <div className="space-y-2.5">
                                    {/* Time in minutes */}
                                    <div>
                                        <label className="block text-[11px] font-medium text-gray-400 mb-1">
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
                                            className="w-full px-2 py-1.5 bg-gray-950 border border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-100 text-xs"
                                            maxLength={5}
                                        />
                                        <p className="text-[10px] text-gray-500 mt-0.5">Formato: MM:SS (ex: 14:30)</p>
                                    </div>

                                    {/* Colors row */}
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <label className="block text-[10px] text-gray-400 mb-1">{t('checkout_pages.background_color')}</label>
                                            <div className="flex items-center gap-1">
                                                <input type="color" value={timerConfig.backgroundColor} onChange={(e) => setTimerConfig(prev => ({ ...prev, backgroundColor: e.target.value }))} className="w-7 h-7 border border-gray-700 rounded cursor-pointer flex-shrink-0" />
                                                <input type="text" value={timerConfig.backgroundColor} onChange={(e) => setTimerConfig(prev => ({ ...prev, backgroundColor: e.target.value }))} className="flex-1 px-1.5 py-1 bg-gray-950 border border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-100 text-[10px]" />
                                            </div>
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-[10px] text-gray-400 mb-1">{t('checkout_pages.text_color')}</label>
                                            <div className="flex items-center gap-1">
                                                <input type="color" value={timerConfig.textColor} onChange={(e) => setTimerConfig(prev => ({ ...prev, textColor: e.target.value }))} className="w-7 h-7 border border-gray-700 rounded cursor-pointer flex-shrink-0" />
                                                <input type="text" value={timerConfig.textColor} onChange={(e) => setTimerConfig(prev => ({ ...prev, textColor: e.target.value }))} className="flex-1 px-1.5 py-1 bg-gray-950 border border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-100 text-[10px]" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Active text */}
                                    <div>
                                        <label className="block text-[10px] text-gray-400 mb-1">{t('checkout_pages.active_countdown_text')}</label>
                                        <input type="text" value={timerConfig.activeText} onChange={(e) => setTimerConfig(prev => ({ ...prev, activeText: e.target.value }))} className="w-full px-2 py-1.5 bg-gray-950 border border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-100 text-xs" />
                                    </div>

                                    {/* Finished text */}
                                    <div>
                                        <label className="block text-[10px] text-gray-400 mb-1">{t('checkout_pages.finished_countdown_text')}</label>
                                        <input type="text" value={timerConfig.finishedText} onChange={(e) => setTimerConfig(prev => ({ ...prev, finishedText: e.target.value }))} className="w-full px-2 py-1.5 bg-gray-950 border border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-100 text-xs" />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Panel Footer */}
                    <div className="px-3 py-2.5 border-t border-gray-800 bg-gray-950 flex gap-2">
                        <button
                            onClick={handleCloseEditPanel}
                            className="flex-1 px-3 py-1.5 border border-gray-700 text-gray-300 rounded text-xs hover:bg-gray-700 transition-colors"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            onClick={() => { handleCloseEditPanel() }}
                            className="flex-1 px-3 py-1.5 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors font-medium"
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