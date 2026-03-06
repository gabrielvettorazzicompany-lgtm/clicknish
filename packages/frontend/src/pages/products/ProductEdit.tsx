import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Plus, Edit, Trash2, GripVertical, Video, FileText, Users, Package } from 'lucide-react'
import { supabase } from '@/services/supabase'
import { useI18n } from '@/i18n'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import CheckoutDigital from '@/components/checkout/CheckoutDigital'
import CheckoutManager from '@/components/common/CheckoutManager'
import AppSettingsTab from '@/pages/apps/AppBuilder/AppSettingsTab'
import ImageCropModal from '@/components/common/ImageCropModal'

interface Product {
    id: string
    name: string
    description?: string
    price: number
    category: string
    status: 'active' | 'inactive' | 'draft'
    image_url?: string
    delivery_type: string
    payment_type: string
    sales_page_url?: string
    recurrence_period?: string
    review_status?: 'pending_review' | 'approved' | 'rejected'
}

interface Module {
    id: string
    title: string
    description: string
    module_number: string
    type: 'video' | 'article' | 'group' | 'resource'
    is_locked: boolean
    image_url?: string
    badge?: string
    badge_color?: string
    order_position: number
    lessons?: Lesson[]
}

interface Lesson {
    id: string
    module_id: string
    title: string
    description?: string
    duration?: string
    type: 'video' | 'pdf' | 'article' | 'quiz'
    video_url?: string
    pdf_url?: string
    content?: string
    is_locked: boolean
    order_position: number
}

type TabType = 'geral' | 'configuracoes' | 'checkout' | 'conteudo' | 'afiliados' | 'suporte'

export default function ProductEdit() {
    const { t } = useI18n()
    // Estado para recolher/expandir a seção Sidebar Links
    const [showSidebarLinks, setShowSidebarLinks] = useState(true)
    // Estado para recolher/expandir as seções de links
    const [showSupportSettings, setShowSupportSettings] = useState(true)
    const [showRefundSettings, setShowRefundSettings] = useState(true)
    const { productId } = useParams<{ productId: string }>()
    const navigate = useNavigate()
    const [product, setProduct] = useState<Product | null>(null)
    const [modules, setModules] = useState<Module[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [activeTab, setActiveTab] = useState<TabType>('geral')

    // Ler parâmetro tab da URL
    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search)
        const tabParam = searchParams.get('tab') as TabType
        if (tabParam && ['geral', 'configuracoes', 'checkout', 'conteudo', 'afiliados'].includes(tabParam)) {
            setActiveTab(tabParam)
        }
    }, [])

    const [showModuleModal, setShowModuleModal] = useState(false)
    const [showLessonModal, setShowLessonModal] = useState(false)
    const [editingModule, setEditingModule] = useState<Module | null>(null)
    const [editingLesson, setEditingLesson] = useState<Lesson | null>(null)
    const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null)

    // Inline form states
    const [creatingModule, setCreatingModule] = useState(false)
    const [editingModuleId, setEditingModuleId] = useState<string | null>(null)
    const [creatingLessonForModule, setCreatingLessonForModule] = useState<string | null>(null)
    const [editingLessonId, setEditingLessonId] = useState<string | null>(null)
    const [currentUploadTarget, setCurrentUploadTarget] = useState<'module' | 'product'>('module')

    // Drag and drop
    const dragModuleId = useRef<string | null>(null)
    const dragOverModuleId = useRef<string | null>(null)
    const dragLessonId = useRef<string | null>(null)
    const dragOverLessonId = useRef<string | null>(null)
    const dragLessonModuleId = useRef<string | null>(null)

    const handleModuleDragStart = (moduleId: string) => {
        dragModuleId.current = moduleId
    }

    const handleModuleDragOver = (e: React.DragEvent, moduleId: string) => {
        e.preventDefault()
        dragOverModuleId.current = moduleId
    }

    const handleModuleDrop = async () => {
        if (!dragModuleId.current || !dragOverModuleId.current || dragModuleId.current === dragOverModuleId.current) return
        const reordered = [...modules]
        const fromIdx = reordered.findIndex(m => m.id === dragModuleId.current)
        const toIdx = reordered.findIndex(m => m.id === dragOverModuleId.current)
        const [moved] = reordered.splice(fromIdx, 1)
        reordered.splice(toIdx, 0, moved)
        const updated = reordered.map((m, i) => ({ ...m, order_position: i }))
        setModules(updated)
        dragModuleId.current = null
        dragOverModuleId.current = null
        await Promise.all(updated.map(m => supabase.from('community_modules').update({ order_position: m.order_position }).eq('id', m.id)))
    }

    const handleLessonDragStart = (lessonId: string, moduleId: string) => {
        dragLessonId.current = lessonId
        dragLessonModuleId.current = moduleId
    }

    const handleLessonDragOver = (e: React.DragEvent, lessonId: string) => {
        e.preventDefault()
        dragOverLessonId.current = lessonId
    }

    const handleLessonDrop = async (moduleId: string) => {
        if (!dragLessonId.current || !dragOverLessonId.current || dragLessonId.current === dragOverLessonId.current) return
        if (dragLessonModuleId.current !== moduleId) return
        const module = modules.find(m => m.id === moduleId)
        if (!module?.lessons) return
        const reordered = [...module.lessons]
        const fromIdx = reordered.findIndex(l => l.id === dragLessonId.current)
        const toIdx = reordered.findIndex(l => l.id === dragOverLessonId.current)
        const [moved] = reordered.splice(fromIdx, 1)
        reordered.splice(toIdx, 0, moved)
        const updated = reordered.map((l, i) => ({ ...l, order_position: i }))
        setModules(prev => prev.map(m => m.id === moduleId ? { ...m, lessons: updated } : m))
        dragLessonId.current = null
        dragOverLessonId.current = null
        dragLessonModuleId.current = null
        await Promise.all(updated.map(l => supabase.from('community_lessons').update({ order_position: l.order_position }).eq('id', l.id)))
    }

    // Payment methods
    const togglePaymentMethod = async (method: 'credit_card' | 'paypal') => {
        const current = formData.payment_methods
        const updated = current.includes(method)
            ? current.filter(m => m !== method)
            : [...current, method]
        if (updated.length === 0) return // ao menos 1 método deve estar ativo
        setFormData(f => ({ ...f, payment_methods: updated }))
        if (productId) {
            await supabase.from('marketplace_products').update({ payment_methods: updated }).eq('id', productId)
        }
    }

    const handleSetDefaultPaymentMethod = async (method: 'credit_card' | 'paypal') => {
        if (!formData.payment_methods.includes(method)) return
        setFormData(f => ({ ...f, default_payment_method: method }))
        if (productId) {
            await supabase.from('marketplace_products').update({ default_payment_method: method }).eq('id', productId)
        }
    }

    // Função para formatar preço baseado na moeda
    const formatPrice = (value: number, currency: string) => {
        if (!value && value !== 0) return ''

        const formatters = {
            USD: new Intl.NumberFormat('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }),
            EUR: new Intl.NumberFormat('de-DE', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }),
            CHF: new Intl.NumberFormat('de-CH', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })
        }

        return formatters[currency as keyof typeof formatters]?.format(value) || value.toFixed(2)
    }

    // Função para parsear preço formatado de volta para número
    const parsePrice = (value: string, currency: string) => {
        if (!value) return 0

        // Remove todos os separadores de milhares e substitui vírgula por ponto se necessário
        let cleanValue = value.replace(/[\s']/g, '') // Remove espaços e apostrofes (CHF)

        if (currency === 'EUR' || currency === 'CHF') {
            // Para EUR e CHF, o último ponto/vírgula é o separador decimal
            const lastComma = cleanValue.lastIndexOf(',')
            const lastDot = cleanValue.lastIndexOf('.')

            if (lastComma > lastDot) {
                // Vírgula é o separador decimal
                cleanValue = cleanValue.replace(/\./g, '').replace(',', '.')
            } else {
                // Ponto é o separador decimal, remove vírgulas
                cleanValue = cleanValue.replace(/,/g, '')
            }
        } else {
            // USD: remove vírgulas (separadores de milhares)
            cleanValue = cleanValue.replace(/,/g, '')
        }

        return parseFloat(cleanValue) || 0
    }

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: 0,
        currency: 'USD' as 'USD' | 'EUR' | 'CHF',
        category: '',
        status: 'draft' as const,
        image_url: '',
        delivery_type: 'app',
        payment_type: 'unique',
        sales_page_url: '',
        recurrence_period: 'monthly',
        payment_methods: ['credit_card'] as ('credit_card' | 'paypal')[],
        default_payment_method: 'credit_card' as 'credit_card' | 'paypal',
        show_in_marketplace: false,
        // Member area settings
        support_enabled: true,
        support_label: 'Support',
        support_description: 'Mon to Fri',
        support_url: '',
        refund_enabled: true,
        refund_label: 'Refund',
        refund_url: ''
    })

    const [moduleForm, setModuleForm] = useState({
        title: '',
        description: '',
        module_number: '',
        type: 'video' as 'video' | 'article' | 'group' | 'resource',
        is_locked: false,
        image_url: '',
        badge: '',
        badge_color: 'pink'
    })

    const [lessonForm, setLessonForm] = useState({
        title: '',
        description: '',
        duration: '',
        type: 'video' as 'video' | 'pdf' | 'article' | 'quiz',
        video_url: '',
        video_script: '',
        video_file: null as File | null,
        pdf_url: '',
        pdf_file: null as File | null,
        content: '',
        is_locked: false
    })

    // Image crop state
    const [showCropModal, setShowCropModal] = useState(false)
    const [cropImagePreview, setCropImagePreview] = useState('')
    const [cropScale, setCropScale] = useState(1)
    const [cropPosition, setCropPosition] = useState({ x: 0, y: 0 })
    const [isDragging, setIsDragging] = useState(false)
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

    const canvasRef = useRef<HTMLCanvasElement>(null)
    const imageRef = useRef<HTMLImageElement>(null)
    const cropAreaRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (productId) {
            fetchProduct()
            fetchModules()
        }
    }, [productId])

    const fetchProduct = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('marketplace_products')
                .select('*')
                .eq('id', productId)
                .single()

            if (error) throw error

            setProduct(data)
            setFormData({
                name: data.name || '',
                description: data.description || '',
                price: data.price || 0,
                currency: data.currency || 'USD',
                category: data.category || '',
                status: data.status || 'draft',
                image_url: data.image_url || '',
                delivery_type: data.delivery_type || 'app',
                payment_type: data.payment_type || 'unique',
                sales_page_url: data.sales_page_url || '',
                recurrence_period: data.recurrence_period || 'monthly',
                payment_methods: data.payment_methods || ['credit_card'],
                default_payment_method: data.default_payment_method || 'credit_card',
                show_in_marketplace: data.show_in_marketplace || false,
                // Member area settings
                support_enabled: data.support_enabled || false,
                support_label: data.support_label || 'Support',
                support_description: data.support_description || 'Mon to Fri',
                support_url: data.support_url || '',
                refund_enabled: data.refund_enabled || false,
                refund_label: data.refund_label || 'Refund',
                refund_url: data.refund_url || ''
            })
        } catch (error) {
            console.error('Error fetching product:', error)
            alert('Error loading product')
            navigate('/products')
        } finally {
            setLoading(false)
        }
    }

    const fetchModules = async () => {
        try {
            const { data: modulesData, error: modulesError } = await supabase
                .from('community_modules')
                .select('*')
                .eq('member_area_id', productId)
                .order('order_position', { ascending: true })

            const modulesWithLessons = await Promise.all(
                (modulesData || []).map(async (module) => {
                    const { data: lessonsData } = await supabase
                        .from('community_lessons')
                        .select('*')
                        .eq('module_id', module.id)
                        .order('order_position', { ascending: true })

                    return { ...module, lessons: lessonsData || [] }
                })
            )

            setModules(modulesWithLessons)
        } catch (error) {
            console.error('Error fetching modules:', error)
        }
    }

    const handleSave = async () => {
        try {
            setSaving(true)

            // Campos explícitos para evitar enviar campos que não existem na tabela
            const updateData = {
                name: formData.name,
                description: formData.description,
                price: formData.price,
                currency: formData.currency,
                category: formData.category,
                status: formData.status,
                image_url: formData.image_url,
                delivery_type: formData.delivery_type,
                payment_type: formData.payment_type,
                sales_page_url: formData.sales_page_url,
                recurrence_period: formData.recurrence_period,
                payment_methods: formData.payment_methods,
                default_payment_method: formData.default_payment_method,
                show_in_marketplace: formData.show_in_marketplace,
                // Member area settings
                support_enabled: formData.support_enabled,
                support_label: formData.support_label,
                support_description: formData.support_description,
                support_url: formData.support_url,
                refund_enabled: formData.refund_enabled,
                refund_label: formData.refund_label,
                refund_url: formData.refund_url
            }

            const { error } = await supabase
                .from('marketplace_products')
                .update(updateData)
                .eq('id', productId)

            if (error) throw error

            alert('Product updated successfully!')
            fetchProduct()
        } catch (error) {
            console.error('Error saving product:', error)
            alert('Error saving product')
        } finally {
            setSaving(false)
        }
    }

    // Helper to add cache buster to image URLs
    const addCacheBuster = (url: string) => {
        if (!url) return url
        const separator = url.includes('?') ? '&' : '?'
        return `${url}${separator}t=${Date.now()}`
    }

    // Image crop handlers
    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            const reader = new FileReader()
            reader.onloadend = () => {
                setCropImagePreview(reader.result as string)
                setShowCropModal(true)
                setCurrentUploadTarget('module')
            }
            reader.readAsDataURL(file)
        }
    }

    const handleProductImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            const reader = new FileReader()
            reader.onloadend = () => {
                setCropImagePreview(reader.result as string)
                setShowCropModal(true)
                // Set that it's for product
                setCurrentUploadTarget('product')
            }
            reader.readAsDataURL(file)
        }
    }

    const processCroppedImage = async () => {
        if (!canvasRef.current || !imageRef.current || !cropAreaRef.current) return

        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Define canvas size (square for module image)
        canvas.width = 600
        canvas.height = 600

        ctx.clearRect(0, 0, canvas.width, canvas.height)

        const tempImg = new Image()
        tempImg.onload = async () => {
            ctx.save()
            ctx.translate(canvas.width / 2, canvas.height / 2)
            ctx.translate(cropPosition.x, cropPosition.y)
            ctx.scale(cropScale, cropScale)
            ctx.drawImage(
                tempImg,
                -tempImg.naturalWidth / 2,
                -tempImg.naturalHeight / 2,
                tempImg.naturalWidth,
                tempImg.naturalHeight
            )
            ctx.restore()

            // Convert canvas to blob
            canvas.toBlob(async (blob) => {
                if (!blob) return

                try {
                    const fileExt = 'jpg'
                    const fileName = `${Math.random()}.${fileExt}`
                    const filePath = `module-images/${fileName}`

                    const { error: uploadError } = await supabase.storage
                        .from('marketplace-content')
                        .upload(filePath, blob)

                    if (uploadError) throw uploadError

                    const { data } = supabase.storage
                        .from('marketplace-content')
                        .getPublicUrl(filePath)

                    // Add cache buster to force browser refresh
                    const imageUrlWithCacheBuster = `${data.publicUrl}?t=${Date.now()}`

                    if (currentUploadTarget === 'product') {
                        setFormData({ ...formData, image_url: imageUrlWithCacheBuster })
                    } else {
                        setModuleForm({ ...moduleForm, image_url: imageUrlWithCacheBuster })
                    }

                    setShowCropModal(false)
                    setCropScale(1)
                    setCropPosition({ x: 0, y: 0 })
                    setCurrentUploadTarget('module') // Reset to default
                } catch (error) {
                    console.error('Erro ao fazer upload:', error)
                    alert('Error uploading image')
                }
            }, 'image/jpeg', 0.8)
        }

        tempImg.src = cropImagePreview
    }

    const handleCreateModule = () => {
        setEditingModule(null)
        setModuleForm({
            title: '',
            description: '',
            module_number: `${modules.length + 1}`,
            type: 'video',
            is_locked: false,
            image_url: '',
            badge: '',
            badge_color: 'pink'
        })
        setCreatingModule(true)
    }

    const handleEditModule = (module: Module) => {
        setEditingModule(module)
        setEditingModuleId(module.id)
        setModuleForm({
            title: module.title,
            description: module.description,
            module_number: module.module_number,
            type: module.type,
            is_locked: module.is_locked,
            image_url: module.image_url || '',
            badge: module.badge || '',
            badge_color: module.badge_color || 'pink'
        })
    }

    const handleSaveModule = async (e: React.FormEvent) => {
        e.preventDefault()

        try {
            if (editingModule) {
                const { error } = await supabase
                    .from('community_modules')
                    .update({
                        ...moduleForm,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', editingModule.id)

                if (error) throw error
                alert('Module updated successfully!')
            } else {
                const { error } = await supabase
                    .from('community_modules')
                    .insert({
                        ...moduleForm,
                        member_area_id: productId,
                        order_position: modules.length
                    })

                if (error) throw error
                alert('Module created successfully!')
            }

            // Reset inline form states
            setCreatingModule(false)
            setEditingModuleId(null)
            setEditingModule(null)
            fetchModules()
        } catch (error: any) {
            console.error('Error saving module:', error)
            alert(`Error saving module: ${error.message}`)
        }
    }

    const handleDeleteModule = async (moduleId: string) => {
        if (!confirm('Are you sure you want to delete this module and all its lessons?')) return

        try {
            const { error } = await supabase
                .from('community_modules')
                .delete()
                .eq('id', moduleId)

            if (error) throw error
            alert('Module deleted successfully!')
            fetchModules()
        } catch (error: any) {
            console.error('Error deleting module:', error)
            alert(`Error deleting module: ${error.message}`)
        }
    }

    const handleCreateLesson = (moduleId: string) => {
        setEditingLesson(null)
        setSelectedModuleId(moduleId)
        setLessonForm({
            title: '',
            description: '',
            duration: '',
            type: 'video',
            video_url: '',
            video_script: '',
            video_file: null,
            pdf_url: '',
            pdf_file: null,
            content: '',
            is_locked: false
        })
        setCreatingLessonForModule(moduleId)
    }

    const handleEditLesson = (lesson: Lesson) => {
        setEditingLesson(lesson)
        setEditingLessonId(lesson.id)
        setSelectedModuleId(lesson.module_id)
        setLessonForm({
            title: lesson.title,
            description: lesson.description || '',
            duration: lesson.duration || '',
            type: lesson.type,
            video_url: lesson.video_url || '',
            video_script: '',
            video_file: null,
            pdf_url: lesson.pdf_url || '',
            pdf_file: null,
            content: lesson.content || '',
            is_locked: lesson.is_locked
        })
    }

    const handleSaveLesson = async (e: React.FormEvent) => {
        e.preventDefault()

        try {
            const moduleId = selectedModuleId || creatingLessonForModule
            const module = modules.find(m => m.id === moduleId)
            if (!module) throw new Error('Module not found')

            // Montar apenas os campos válidos do banco (sem video_file, pdf_file)
            const lessonData: Record<string, any> = {
                title: lessonForm.title,
                description: lessonForm.description,
                duration: lessonForm.duration,
                type: lessonForm.type,
                is_locked: lessonForm.is_locked,
                content: lessonForm.content || null,
            }

            // Campos condicionais por tipo
            if (lessonForm.type === 'video') {
                lessonData.video_url = lessonForm.video_url || null
                lessonData.video_script = lessonForm.video_script || null
                lessonData.pdf_url = null
            } else if (lessonForm.type === 'pdf') {
                lessonData.pdf_url = lessonForm.pdf_url || null
                lessonData.video_url = null
                lessonData.video_script = null
            }

            // TODO: Upload de arquivo (video_file / pdf_file) para storage se necessário

            if (editingLesson) {
                const { error } = await supabase
                    .from('community_lessons')
                    .update({
                        ...lessonData,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', editingLesson.id)

                if (error) throw error
                alert('Lesson updated successfully!')
            } else {
                const { error } = await supabase
                    .from('community_lessons')
                    .insert({
                        ...lessonData,
                        module_id: moduleId,
                        order_position: module.lessons?.length || 0
                    })

                if (error) throw error
                alert('Lesson created successfully!')
            }

            // Reset inline form states
            setCreatingLessonForModule(null)
            setEditingLessonId(null)
            setEditingLesson(null)
            setSelectedModuleId(null)
            fetchModules()
        } catch (error: any) {
            console.error('Error saving lesson:', error)
            alert(`Error saving lesson: ${error.message}`)
        }
    }

    const handleDeleteLesson = async (lessonId: string) => {
        if (!confirm('Are you sure you want to delete this lesson?')) return

        try {
            const { error } = await supabase
                .from('community_lessons')
                .delete()
                .eq('id', lessonId)

            if (error) throw error
            alert('Lesson deleted successfully!')
            fetchModules()
        } catch (error: any) {
            console.error('Error deleting lesson:', error)
            alert(`Error deleting lesson: ${error.message}`)
        }
    }

    const getModuleIcon = (type: string) => {
        switch (type) {
            case 'video': return <Video size={20} />
            case 'article': return <FileText size={20} />
            case 'group': return <Users size={20} />
            case 'resource': return <Package size={20} />
            default: return <Video size={20} />
        }
    }

    const tabs = [
        { id: 'geral' as TabType, label: t('product_pages.edit_title') },
        { id: 'configuracoes' as TabType, label: t('common.actions') },
        { id: 'conteudo' as TabType, label: t('common.content') },
        { id: 'suporte' as TabType, label: t('common.status') },
        { id: 'checkout' as TabType, label: 'Checkout' },
    ]

    if (loading) {
        return (
            <div className="flex h-screen bg-[#0f1117]">
                <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

                <div className="flex-1 flex flex-col min-w-0">
                    <Header onMenuClick={() => setSidebarOpen(true)} />

                    <main className="flex-1 flex items-center justify-center pt-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#1e2139] border-t-blue-600"></div>
                    </main>
                </div>
            </div>
        )
    }

    return (
        <div className="flex h-screen bg-gray-50 dark:bg-[#0f1117] transition-colors duration-200">
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex-1 flex flex-col min-w-0">
                <Header onMenuClick={() => setSidebarOpen(true)} />


                {/* Tabs Navigation */}
                <div className="bg-white dark:bg-[#1a1d2e] border-b border-gray-200 dark:border-[#1e2139] mt-12 sticky top-12 z-[60] transition-colors duration-200">
                    <div className="flex items-center justify-between px-6">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate('/products')}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-[#252941]/50 rounded-lg transition-colors duration-200 flex-shrink-0"
                            >
                                <ArrowLeft size={16} className="text-blue-600 dark:text-blue-400" />
                            </button>
                            <div className="flex gap-6">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`py-2 px-2 text-xs font-medium border-b whitespace-nowrap transition-colors cursor-pointer ${activeTab === tab.id
                                            ? 'border-blue-400 text-blue-400'
                                            : 'border-transparent text-gray-600 hover:text-gray-100'
                                            }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 bg-transparent"
                            >
                                {saving ? (
                                    <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Save size={14} />
                                )}
                                <span className="hidden sm:inline">{saving ? t('common.loading') : t('common.save')}</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-[#0f1117] transition-colors duration-200">
                    <div className="max-w-6xl mx-auto px-3 sm:px-3 py-3 sm:py-3">
                        {/* Tab: Geral */}
                        {activeTab === 'geral' && (
                            <div className="bg-white dark:bg-[#1a1d2e] rounded-xl shadow-xl shadow-black/10 border border-gray-200 dark:border-[#1e2139] overflow-hidden">
                                <div className="bg-gradient-to-r from-gray-50 dark:from-[#1a1d2e] to-gray-100 dark:to-[#252941] border-b border-gray-200 dark:border-[#1e2139] px-3 sm:px-3 py-3">
                                    <h2 className="text-xs font-semibold text-gray-900 dark:text-gray-100">General Information</h2>
                                    <p className="text-xs text-gray-600 dark:text-gray-600 mt-3">{t('create_product.product_description')}</p>
                                </div>
                                <div className="p-3 sm:p-3">

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-4">
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-4">{t('create_product.product_name')}</label>
                                                <input
                                                    type="text"
                                                    value={formData.name}
                                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                    className="w-full px-3 py-3 text-xs bg-white dark:bg-[#1a1d2e] text-gray-900 dark:text-gray-200 border border-gray-300 dark:border-[#252941]/50 rounded-xl focus:outline-none focus:border-blue-500/40 transition-all duration-200 hover:border-gray-400 dark:hover:border-gray-500/50"
                                                    placeholder="Enter product name"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-4">{t('common.description')}</label>
                                                <textarea
                                                    value={formData.description}
                                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                                    rows={4}
                                                    className="w-full px-3 py-3 bg-white dark:bg-[#1a1d2e] text-gray-900 dark:text-gray-200 border border-gray-300 dark:border-[#252941]/50 rounded-xl focus:outline-none focus:border-blue-500/40 transition-all duration-200 hover:border-gray-400 dark:hover:border-gray-500/50 resize-none"
                                                    placeholder="Describe your product clearly and attractively"
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-4">{t('create_product.price')}</label>
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            value={formatPrice(formData.price, formData.currency)}
                                                            onChange={(e) => {
                                                                const numericValue = parsePrice(e.target.value, formData.currency)
                                                                setFormData({ ...formData, price: numericValue })
                                                            }}
                                                            className="w-full px-3 py-3 text-xs bg-white dark:bg-[#1a1d2e] text-gray-900 dark:text-gray-200 border border-gray-300 dark:border-[#252941]/50 rounded-xl focus:outline-none focus:border-blue-500/40 transition-all duration-200 hover:border-gray-400 dark:hover:border-gray-500/50"
                                                            placeholder={formData.currency === 'EUR' ? '0,00' : formData.currency === 'CHF' ? '0.00' : '0.00'}
                                                        />
                                                        <div className="absolute right-3 top-3/2 transform -translate-y-1/2 text-xs text-gray-500 pointer-events-none">
                                                            {formData.currency}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-300 mb-4">{t('create_product.currency')}</label>
                                                    <select
                                                        value={formData.currency}
                                                        onChange={(e) => setFormData({ ...formData, currency: e.target.value as 'USD' | 'EUR' | 'CHF' })}
                                                        className="w-full px-3 py-3 text-xs bg-[#1a1d2e] text-gray-200 border border-[#252941]/50 rounded-xl focus:outline-none focus:border-blue-500/40 transition-all duration-200 hover:border-gray-500/50"
                                                    >
                                                        <option value="USD">🇺🇸 USD - US Dollar</option>
                                                        <option value="EUR">🇪🇺 EUR - Euro</option>
                                                        <option value="CHF">🇨🇭 CHF - Swiss Franc</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-xs sm:text-xs font-medium text-gray-300 mb-4 sm:mb-4">Status</label>
                                                <select
                                                    value={formData.status}
                                                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                                                    className="w-full px-3 py-3 bg-[#1a1d2e] text-gray-200 border border-[#252941]/50 rounded-lg focus:outline-none focus:border-blue-500/40"
                                                >
                                                    <option value="draft">Draft</option>
                                                    <option value="active">Active</option>
                                                    <option value="inactive">Inactive</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-medium text-gray-400 mb-2">{t('create_product.cover_image')}</label>
                                                <div className="flex items-center gap-3">
                                                    {formData.image_url ? (
                                                        <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-white/10 flex-shrink-0 group">
                                                            <img
                                                                src={formData.image_url}
                                                                alt="Preview"
                                                                className="w-full h-full object-cover"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => setFormData({ ...formData, image_url: '' })}
                                                                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs"
                                                            >
                                                                ✕
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="w-14 h-14 rounded-lg border border-dashed border-white/10 bg-white/[0.03] flex-shrink-0" />
                                                    )}
                                                    <label className="flex-1 px-3 py-2 text-xs bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 rounded-lg cursor-pointer transition-colors text-gray-400 hover:text-gray-300">
                                                        {formData.image_url ? 'Trocar imagem' : 'Selecionar imagem'}
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            onChange={handleProductImageSelect}
                                                            className="hidden"
                                                            key={formData.image_url}
                                                        />
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tab: Configurações - Métodos de Pagamento */}
                        {activeTab === 'configuracoes' && (
                            <div className="bg-[#1a1d2e] rounded-lg shadow-xl shadow-black/10 shadow-black/5 border border-[#1e2139] p-3">
                                <h2 className="text-xs sm:text-xs font-semibold text-gray-100 mb-4.5 sm:mb-4">Payment</h2>
                                <p className="text-xs text-gray-600 mb-4">
                                    Learn about checkout installment settings and click the button
                                </p>

                                <div className="space-y-4">
                                    {/* Métodos de pagamento */}
                                    <div>
                                        <h3 className="text-xs font-medium text-gray-100 mb-4">Payment Methods</h3>
                                        <p className="text-xs text-gray-600 mb-4">
                                            Adjust the elements below to define the order that will appear in checkout and click the "Default Method" button to set as default checkout payment if the payment method is selected
                                        </p>

                                        <div className="grid grid-cols-1 gap-4 mb-4">
                                            {/* Cartão de Crédito */}
                                            <div
                                                className="border-2 border-blue-500 bg-blue-500/10 rounded-lg p-3"
                                            >
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-8 h-8 bg-[#1a1d2e] rounded flex items-center justify-center">
                                                            <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <rect x="3" y="6" width="18" height="12" rx="2" strokeWidth="2" />
                                                                <line x1="3" y1="10" x2="21" y2="10" strokeWidth="2" />
                                                            </svg>
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-gray-100">Credit Card</div>
                                                            <div className="text-xs text-gray-600">Net value: $2.10</div>
                                                        </div>
                                                    </div>
                                                    <span className="font-medium text-xs text-blue-400">1</span>
                                                </div>
                                                <button
                                                    className="w-full py-3 rounded-lg text-xs font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                                                >
                                                    Default Method
                                                </button>
                                            </div>
                                        </div>

                                        {/* Default Checkout Payment Method */}
                                        <div className="mb-4">
                                            <label className="block text-xs font-medium text-gray-300 mb-4">
                                                Default Checkout Payment Method
                                            </label>
                                            <div className="w-full px-3 py-3 bg-[#1a1d2e] text-gray-200 border border-[#252941] rounded-lg">
                                                Credit Card
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tab: Checkout */}
                        {activeTab === 'checkout' && product && (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                <div className="lg:col-span-2">
                                    <CheckoutManager
                                        product={product}
                                        selectedPaymentMethods={formData.payment_methods}
                                        defaultPaymentMethod={formData.default_payment_method}
                                    />
                                </div>
                                <div className="lg:col-span-1">
                                    <AppSettingsTab
                                        selectedPaymentMethods={formData.payment_methods}
                                        defaultPaymentMethod={formData.default_payment_method}
                                        onTogglePaymentMethod={togglePaymentMethod}
                                        onSetDefaultPaymentMethod={handleSetDefaultPaymentMethod}
                                        onSave={async () => {
                                            // Não precisamos fazer nada aqui pois as mudanças já são salvas via callbacks
                                            console.log('Configurações de pagamento salvas!')
                                        }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Tab: Support/Refund */}
                        {activeTab === 'suporte' && (
                            <div className="bg-[#1a1d2e] rounded-lg border border-[#1e2139] p-4 space-y-4">
                                <div>
                                    <h2 className="text-xs font-semibold text-gray-200 mb-0.5">Suporte</h2>
                                    <p className="text-[11px] text-gray-500">Link de suporte exibido na sidebar da área de membros</p>
                                </div>

                                {/* Preview Sidebar */}
                                <div className="p-3 bg-[#0f1117] rounded-lg border border-white/[0.06]">
                                    <p className="text-[10px] text-gray-600 mb-2">Preview</p>
                                    <div className="space-y-1">
                                        <div className="px-3 py-1.5 rounded bg-white/5 border border-white/10">
                                            <span className="text-[11px] text-gray-400">Home</span>
                                        </div>
                                        {formData.support_enabled && (
                                            <div className="px-3 py-1.5 rounded bg-white/[0.03]">
                                                <span className="text-[11px] text-gray-500">{formData.support_label || 'Suporte'}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Fields */}
                                <div className="space-y-3">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] text-gray-500 mb-1">Label do botão</label>
                                            <input
                                                type="text"
                                                value={formData.support_label}
                                                onChange={(e) => setFormData({ ...formData, support_label: e.target.value })}
                                                placeholder="Suporte"
                                                className="w-full px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-white/20"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-gray-500 mb-1">Descrição</label>
                                            <input
                                                type="text"
                                                value={formData.support_description}
                                                onChange={(e) => setFormData({ ...formData, support_description: e.target.value })}
                                                placeholder="Seg a Sex"
                                                className="w-full px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-white/20"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-gray-500 mb-1">Link / URL <span className="text-red-400">*</span></label>
                                        <input
                                            type="text"
                                            value={formData.support_url}
                                            onChange={(e) => setFormData({ ...formData, support_url: e.target.value })}
                                            placeholder="https://wa.me/5511999999999"
                                            required
                                            className="w-full px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-white/20"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tab: Gerenciar Conteúdo */}
                        {activeTab === 'conteudo' && (
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-xs sm:text-xs font-semibold text-gray-100">{t('product_pages.modules')}</h2>
                                    <button
                                        onClick={handleCreateModule}
                                        className="px-2.5 py-1.5 border border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white rounded-md transition-colors flex items-center gap-2 text-xs bg-transparent"
                                        style={{ minHeight: 0, minWidth: 0 }}
                                    >
                                        <Plus size={14} />
                                        {t('product_pages.add_module')}
                                    </button>
                                </div>

                                {/* Inline Module Form */}
                                {creatingModule && (
                                    <div className="mb-3 p-2.5 bg-[#1a1d2e] rounded-lg border border-[#1e2139]">
                                        <h3 className="text-xs font-semibold text-gray-100 mb-2.5">{t('product_pages.add_module')}</h3>
                                        <form onSubmit={handleSaveModule} className="space-y-2.5" noValidate>
                                            <div>
                                                <label className="block text-[10px] font-medium text-gray-400 mb-1.5">Module Image</label>
                                                <div className="flex items-center gap-3">
                                                    {moduleForm.image_url ? (
                                                        <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-white/10 flex-shrink-0 group">
                                                            <img src={moduleForm.image_url} alt="Preview" className="w-full h-full object-cover" />
                                                            <button type="button" onClick={() => setModuleForm({ ...moduleForm, image_url: '' })} className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px]">✕</button>
                                                        </div>
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-lg border border-dashed border-white/10 bg-white/[0.03] flex-shrink-0" />
                                                    )}
                                                    <label className="flex-1 px-3 py-1.5 text-[10px] bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 rounded-lg cursor-pointer transition-colors text-gray-500 hover:text-gray-300">
                                                        {moduleForm.image_url ? 'Trocar imagem' : 'Selecionar imagem'}
                                                        <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" key={moduleForm.image_url} />
                                                    </label>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2.5">
                                                <div>
                                                    <label className="block text-[10px] font-medium text-gray-300 mb-1.5">{t('common.title')}</label>
                                                    <input
                                                        type="text"
                                                        value={moduleForm.title}
                                                        onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
                                                        className="w-full p-2 text-xs bg-[#1a1d2e] text-gray-200 border border-[#252941]/50 rounded-lg focus:outline-none focus:border-blue-500/40"
                                                        required
                                                        onInvalid={e => (e.currentTarget.setCustomValidity('Please fill out this field.'))}
                                                        onInput={e => (e.currentTarget.setCustomValidity(''))}
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-[10px] font-medium text-gray-300 mb-1.5">{t('common.description')}</label>
                                                <textarea
                                                    value={moduleForm.description}
                                                    onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })}
                                                    rows={2}
                                                    className="w-full p-2 text-xs bg-[#1a1d2e] text-gray-200 border border-[#252941]/50 rounded-lg focus:outline-none focus:border-blue-500/40"
                                                />
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    id="module-locked"
                                                    checked={moduleForm.is_locked}
                                                    onChange={(e) => setModuleForm({ ...moduleForm, is_locked: e.target.checked })}
                                                    className="rounded border-[#252941] w-3.5 h-3.5"
                                                />
                                                <label htmlFor="module-locked" className="text-[10px] text-gray-300">
                                                    Locked module
                                                </label>
                                            </div>

                                            <div className="flex gap-2.5 pt-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setCreatingModule(false)
                                                        setModuleForm({
                                                            title: '',
                                                            description: '',
                                                            module_number: '',
                                                            type: 'video',
                                                            is_locked: false,
                                                            image_url: '',
                                                            badge: '',
                                                            badge_color: 'pink'
                                                        })
                                                    }}
                                                    className="px-2.5 py-1.5 text-xs text-gray-600 border border-[#252941]/50 rounded-lg hover:bg-[#0f1117]"
                                                >
                                                    {t('common.cancel')}
                                                </button>
                                                <button
                                                    type="submit"
                                                    className="px-2.5 py-1.5 text-xs border border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white rounded-lg bg-transparent transition-colors"
                                                >
                                                    {t('product_pages.add_module')}
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    {modules.map((module) => (
                                        <div
                                            key={module.id}
                                            className="bg-[#1a1d2e] rounded-lg border border-[#1e2139] overflow-hidden"
                                            draggable
                                            onDragStart={() => handleModuleDragStart(module.id)}
                                            onDragOver={(e) => handleModuleDragOver(e, module.id)}
                                            onDrop={handleModuleDrop}
                                        >
                                            {/* Module Header */}
                                            {editingModuleId === module.id ? (
                                                // Inline Module Edit Form
                                                <div className="p-3">
                                                    <h3 className="text-xs font-semibold text-gray-100 mb-4">{t('common.edit')} {t('common.module')}</h3>
                                                    <form onSubmit={handleSaveModule} className="space-y-4">
                                                        {/* Same form fields as create module */}
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-300 mb-4">Module Image</label>
                                                            <div className="space-y-4">
                                                                {moduleForm.image_url && (
                                                                    <div className="relative w-full h-20 rounded-lg overflow-hidden border border-[#252941]">
                                                                        <img
                                                                            src={moduleForm.image_url}
                                                                            alt="Preview"
                                                                            className="w-full h-full object-cover"
                                                                        />
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setModuleForm({ ...moduleForm, image_url: '' })}
                                                                            className="absolute top-3 right-2 p-3 bg-red-500 text-white rounded-full hover:bg-red-600"
                                                                        >
                                                                            ✕
                                                                        </button>
                                                                    </div>
                                                                )}
                                                                <input
                                                                    type="file"
                                                                    accept="image/*"
                                                                    onChange={handleImageSelect}
                                                                    className="w-full px-3 py-3 bg-[#1a1d2e] text-gray-200 border border-[#252941] rounded-lg file:mr-4 file:py-3 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-teal-500/10 file:text-teal-400 hover:file:bg-teal-900"
                                                                    key={moduleForm.image_url}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div>
                                                                <label className="block text-xs font-medium text-gray-300 mb-4">{t('common.title')}</label>
                                                                <input
                                                                    type="text"
                                                                    value={moduleForm.title}
                                                                    onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
                                                                    className="w-full p-3 bg-[#1a1d2e] text-gray-200 border border-[#252941] rounded-lg"
                                                                    required
                                                                />
                                                            </div>

                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-300 mb-4">{t('common.description')}</label>
                                                            <textarea
                                                                className="w-full p-3 bg-[#1a1d2e] text-gray-200 border border-[#252941] rounded-lg"
                                                            />
                                                        </div>
                                                        <div className="flex gap-4 pt-4">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setEditingModuleId(null)
                                                                    setEditingModule(null)
                                                                }}
                                                                className="px-3 py-3 text-gray-600 border border-[#252941] rounded-lg hover:bg-[#0f1117]"
                                                            >
                                                                {t('common.cancel')}
                                                            </button>
                                                            <button
                                                                type="submit"
                                                                className="px-3 py-3 border border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white rounded-lg bg-transparent transition-colors"
                                                            >
                                                                Save Module
                                                            </button>
                                                        </div>
                                                    </form>
                                                </div>
                                            ) : (
                                                <div className="p-3 flex items-center justify-between border-b border-[#1e2139]">
                                                    <div className="flex items-center gap-4">
                                                        <GripVertical size={16} className="text-gray-400 cursor-grab active:cursor-grabbing" />

                                                        {/* Module Image */}
                                                        {module.image_url ? (
                                                            <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-[#1e2139]">
                                                                <img
                                                                    src={addCacheBuster(module.image_url)}
                                                                    alt={module.title}
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-blue-500/10 flex-shrink-0">
                                                                {getModuleIcon(module.type)}
                                                            </div>
                                                        )}

                                                        <div>
                                                            <h3 className="font-semibold text-gray-100">{module.title}</h3>
                                                            {module.description && (
                                                                <p className="text-xs text-gray-600">{module.description}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <button
                                                            onClick={() => setCreatingLessonForModule(module.id)}
                                                            className="text-xs px-3 py-3.5 border border-gray-600 hover:border-gray-500 text-gray-400 hover:text-white rounded-lg bg-transparent transition-colors"
                                                        >
                                                            + {t('common.lesson')}
                                                        </button>
                                                        <button
                                                            onClick={() => handleEditModule(module)}
                                                            className="p-3 text-gray-600 hover:bg-gray-200 rounded-lg"
                                                        >
                                                            <Edit size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteModule(module.id)}
                                                            className="p-3 text-red-600 hover:bg-red-50 rounded-lg"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Inline Lesson Creation Form */}
                                            {creatingLessonForModule === module.id && (
                                                <div className="ml-10 border-l border-[#252941] border-t border-t-[#1e2139] bg-[#0c0e1a]">
                                                    <div className="p-2.5">
                                                        <h4 className="text-xs font-semibold text-gray-100 mb-2.5">{t('product_pages.add_lesson')}</h4>
                                                        <form onSubmit={handleSaveLesson} className="space-y-2.5">
                                                            <div>
                                                                <label className="block text-[10px] font-medium text-gray-300 mb-1.5">{t('common.title')}</label>
                                                                <input
                                                                    type="text"
                                                                    value={lessonForm.title}
                                                                    onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
                                                                    className="w-full p-2 text-xs bg-[#1a1d2e] text-gray-200 border border-[#252941]/50 rounded-lg"
                                                                    required
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-[10px] font-medium text-gray-300 mb-1.5">Description</label>
                                                                <textarea
                                                                    value={lessonForm.description}
                                                                    onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })}
                                                                    rows={2}
                                                                    className="w-full p-2 text-xs bg-[#1a1d2e] text-gray-200 border border-[#252941]/50 rounded-lg"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-[10px] font-medium text-gray-300 mb-1.5">Type</label>
                                                                <select
                                                                    value={lessonForm.type}
                                                                    onChange={(e) => setLessonForm({ ...lessonForm, type: e.target.value as any })}
                                                                    className="w-full p-2 text-xs bg-[#1a1d2e] text-gray-200 border border-[#252941]/50 rounded-lg"
                                                                >
                                                                    <option value="video">Video</option>
                                                                    <option value="pdf">PDF</option>
                                                                </select>
                                                            </div>

                                                            {/* Conditional fields for Video */}
                                                            {lessonForm.type === 'video' && (
                                                                <div className="space-y-2.5">
                                                                    <div>
                                                                        <label className="block text-[10px] font-medium text-gray-300 mb-1.5">Video URL</label>
                                                                        <input
                                                                            type="url"
                                                                            value={lessonForm.video_url}
                                                                            onChange={(e) => setLessonForm({ ...lessonForm, video_url: e.target.value })}
                                                                            className="w-full p-2 text-xs bg-[#1a1d2e] text-gray-200 border border-[#252941]/50 rounded-lg"
                                                                            placeholder="https://..."
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-[10px] font-medium text-gray-300 mb-1.5">Video Script/Embed</label>
                                                                        <textarea
                                                                            value={lessonForm.video_script}
                                                                            onChange={(e) => setLessonForm({ ...lessonForm, video_script: e.target.value })}
                                                                            rows={3}
                                                                            className="w-full p-2 text-xs bg-[#1a1d2e] text-gray-200 border border-[#252941]/50 rounded-lg font-mono"
                                                                            placeholder="<iframe src=...></iframe>"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Conditional fields for PDF */}
                                                            {lessonForm.type === 'pdf' && (
                                                                <div>
                                                                    <label className="block text-[10px] font-medium text-gray-300 mb-1.5">Upload PDF</label>
                                                                    <label className="flex items-center gap-3 w-full px-2 py-1.5 text-xs bg-[#1a1d2e] text-gray-200 border border-[#252941]/50 rounded-lg cursor-pointer hover:bg-[#252941]/30">
                                                                        <span className="py-1.5 px-2.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-400">
                                                                            Browse...
                                                                        </span>
                                                                        <span className="text-gray-500 text-[10px]">
                                                                            {lessonForm.pdf_file ? lessonForm.pdf_file.name : 'No file selected'}
                                                                        </span>
                                                                        <input
                                                                            type="file"
                                                                            accept=".pdf"
                                                                            onChange={(e) => setLessonForm({ ...lessonForm, pdf_file: e.target.files?.[0] || null })}
                                                                            className="hidden"
                                                                        />
                                                                    </label>
                                                                </div>
                                                            )}
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="checkbox"
                                                                    id="lesson-locked"
                                                                    checked={lessonForm.is_locked}
                                                                    onChange={(e) => setLessonForm({ ...lessonForm, is_locked: e.target.checked })}
                                                                    className="rounded border-[#252941] w-3.5 h-3.5"
                                                                />
                                                                <label htmlFor="lesson-locked" className="text-[10px] text-gray-300">
                                                                    Locked lesson
                                                                </label>
                                                            </div>
                                                            <div className="flex gap-2.5 pt-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setCreatingLessonForModule(null)}
                                                                    className="px-2.5 py-1.5 text-xs text-gray-600 border border-[#252941]/50 rounded-lg hover:bg-[#0f1117]"
                                                                >
                                                                    {t('common.cancel')}
                                                                </button>
                                                                <button
                                                                    type="submit"
                                                                    className="px-2.5 py-1.5 text-xs border border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white rounded-lg bg-transparent transition-colors"
                                                                >
                                                                    {t('product_pages.add_lesson')}
                                                                </button>
                                                            </div>
                                                        </form>
                                                    </div>
                                                </div>
                                            )}

                                            {module.lessons && module.lessons.length > 0 && (
                                                <div className="border-t border-[#1e2139] bg-[#0c0e1a]">
                                                    {module.lessons.map((lesson) => (
                                                        <div
                                                            key={lesson.id}
                                                            className="ml-10 border-l border-[#252941]"
                                                            draggable
                                                            onDragStart={() => handleLessonDragStart(lesson.id, module.id)}
                                                            onDragOver={(e) => handleLessonDragOver(e, lesson.id)}
                                                            onDrop={() => handleLessonDrop(module.id)}
                                                        >
                                                            {editingLessonId === lesson.id ? (
                                                                // Inline Lesson Edit Form
                                                                <div className="p-2.5 bg-blue-500/10">
                                                                    <h4 className="text-xs font-semibold text-gray-100 mb-2.5">{t('common.edit')} {t('common.lesson')}</h4>
                                                                    <form onSubmit={handleSaveLesson} className="space-y-2.5">
                                                                        {/* Same form fields as create lesson */}
                                                                        <div>
                                                                            <label className="block text-[10px] font-medium text-gray-300 mb-1.5">{t('common.title')}</label>
                                                                            <input
                                                                                type="text"
                                                                                value={lessonForm.title}
                                                                                onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
                                                                                className="w-full p-2 text-xs border border-[#252941]/50 rounded-lg bg-[#1a1d2e] text-gray-200"
                                                                                required
                                                                            />
                                                                        </div>
                                                                        <div>
                                                                            <label className="block text-[10px] font-medium text-gray-300 mb-1.5">Description</label>
                                                                            <textarea
                                                                                value={lessonForm.description}
                                                                                onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })}
                                                                                rows={2}
                                                                                className="w-full p-2 text-xs border border-[#252941]/50 rounded-lg bg-[#1a1d2e] text-gray-200"
                                                                            />
                                                                        </div>
                                                                        <div>
                                                                            <label className="block text-[10px] font-medium text-gray-300 mb-1.5">Type</label>
                                                                            <select
                                                                                value={lessonForm.type}
                                                                                onChange={(e) => setLessonForm({ ...lessonForm, type: e.target.value as any })}
                                                                                className="w-full p-2 text-xs border border-[#252941]/50 rounded-lg bg-[#1a1d2e] text-gray-200"
                                                                            >
                                                                                <option value="video">Video</option>
                                                                                <option value="pdf">PDF</option>
                                                                            </select>
                                                                        </div>

                                                                        {/* Conditional fields for Video */}
                                                                        {lessonForm.type === 'video' && (
                                                                            <div className="space-y-2.5">
                                                                                <div>
                                                                                    <label className="block text-[10px] font-medium text-gray-300 mb-1.5">Video URL</label>
                                                                                    <input
                                                                                        type="url"
                                                                                        value={lessonForm.video_url}
                                                                                        onChange={(e) => setLessonForm({ ...lessonForm, video_url: e.target.value })}
                                                                                        className="w-full p-2 text-xs border border-[#252941]/50 rounded-lg bg-[#1a1d2e] text-gray-200"
                                                                                        placeholder="https://..."
                                                                                    />
                                                                                </div>
                                                                                <div>
                                                                                    <label className="block text-[10px] font-medium text-gray-300 mb-1.5">Video Script/Embed</label>
                                                                                    <textarea
                                                                                        value={lessonForm.video_script}
                                                                                        onChange={(e) => setLessonForm({ ...lessonForm, video_script: e.target.value })}
                                                                                        rows={3}
                                                                                        className="w-full p-2 text-xs border border-[#252941]/50 rounded-lg bg-[#1a1d2e] font-mono text-gray-200"
                                                                                        placeholder="<iframe src=...></iframe>"
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        {/* Conditional fields for PDF */}
                                                                        {lessonForm.type === 'pdf' && (
                                                                            <div>
                                                                                <label className="block text-[10px] font-medium text-gray-300 mb-1.5">Upload PDF</label>
                                                                                <label className="flex items-center gap-3 w-full px-2 py-1.5 text-xs bg-[#1a1d2e] text-gray-200 border border-[#252941]/50 rounded-lg cursor-pointer hover:bg-[#252941]/30">
                                                                                    <span className="py-1.5 px-2.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-400">
                                                                                        Browse...
                                                                                    </span>
                                                                                    <span className="text-gray-500 text-[10px]">
                                                                                        {lessonForm.pdf_file ? lessonForm.pdf_file.name : 'No file selected'}
                                                                                    </span>
                                                                                    <input
                                                                                        type="file"
                                                                                        accept=".pdf"
                                                                                        onChange={(e) => setLessonForm({ ...lessonForm, pdf_file: e.target.files?.[0] || null })}
                                                                                        className="hidden"
                                                                                    />
                                                                                </label>
                                                                            </div>
                                                                        )}

                                                                        <div className="flex items-center gap-2">
                                                                            <input
                                                                                type="checkbox"
                                                                                id="lesson-locked-edit"
                                                                                checked={lessonForm.is_locked}
                                                                                onChange={(e) => setLessonForm({ ...lessonForm, is_locked: e.target.checked })}
                                                                                className="rounded border-[#252941] w-3.5 h-3.5"
                                                                            />
                                                                            <label htmlFor="lesson-locked-edit" className="text-[10px] text-gray-300">
                                                                                Locked lesson
                                                                            </label>
                                                                        </div>
                                                                        <div className="flex gap-2.5 pt-2">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setEditingLessonId(null)
                                                                                    setEditingLesson(null)
                                                                                }}
                                                                                className="px-2.5 py-1.5 text-xs text-gray-600 border border-[#252941]/50 rounded-lg hover:bg-[#0f1117] bg-[#1a1d2e]"
                                                                            >
                                                                                Cancel
                                                                            </button>
                                                                            <button
                                                                                type="submit"
                                                                                className="px-2.5 py-1.5 text-xs border border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white rounded-lg bg-transparent transition-colors"
                                                                            >
                                                                                Save Lesson
                                                                            </button>
                                                                        </div>
                                                                    </form>
                                                                </div>
                                                            ) : (
                                                                <div className="pl-3 pr-3 py-2 flex items-center justify-between hover:bg-[#0f1117] border-b border-[#1e2139]/50">
                                                                    <div className="flex items-center gap-3 flex-1">
                                                                        <GripVertical size={14} className="text-gray-600 cursor-grab active:cursor-grabbing" />
                                                                        <div className="flex-1">
                                                                            <div className="flex items-center gap-3">
                                                                                <h4 className="text-sm text-gray-300">{lesson.title}</h4>
                                                                                {lesson.duration && (
                                                                                    <span className="text-xs text-gray-600">• {lesson.duration}</span>
                                                                                )}
                                                                                {lesson.is_locked && (
                                                                                    <span className="text-[10px] px-2 py-0.5 bg-yellow-500/10 text-yellow-500 rounded-full">Bloqueada</span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-1">
                                                                        <button
                                                                            onClick={() => handleEditLesson(lesson)}
                                                                            className="p-1.5 text-gray-600 hover:text-gray-300 rounded-lg transition-colors"
                                                                        >
                                                                            <Edit size={14} />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleDeleteLesson(lesson.id)}
                                                                            className="p-1.5 text-red-700 hover:text-red-400 rounded-lg transition-colors"
                                                                        >
                                                                            <Trash2 size={14} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>

            {/* Modals */}
            <ImageCropModal
                isOpen={showCropModal}
                onClose={() => setShowCropModal(false)}
                imagePreview={cropImagePreview}
                cropScale={cropScale}
                setCropScale={setCropScale}
                cropPosition={cropPosition}
                setCropPosition={setCropPosition}
                isDragging={isDragging}
                setIsDragging={setIsDragging}
                dragStart={dragStart}
                setDragStart={setDragStart}
                onCropComplete={processCroppedImage}
                canvasRef={canvasRef}
                imageRef={imageRef}
                cropAreaRef={cropAreaRef}
                aspectRatio="square"
                title="Adjust Module Image"
            />
        </div >
    )
}