import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Edit, Trash2, GripVertical, Video, FileText, Users, Package, X, ChevronRight, ChevronDown } from 'lucide-react'
import { supabase } from '@/services/supabase'
import { useI18n } from '@/i18n'
import Sidebar from '@/components/Sidebar'
import UserProfileDropdown from '@/components/UserProfileDropdown'

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

interface Product {
    id: string
    name: string
    description?: string
    delivery_type: string
}

export default function ProductContent() {
    const { t } = useI18n()
    const { productId } = useParams<{ productId: string }>()
    const navigate = useNavigate()
    const [product, setProduct] = useState<Product | null>(null)
    const [modules, setModules] = useState<Module[]>([])
    const [loading, setLoading] = useState(true)
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [showModuleModal, setShowModuleModal] = useState(false)
    const [showLessonModal, setShowLessonModal] = useState(false)
    const [editingModule, setEditingModule] = useState<Module | null>(null)
    const [editingLesson, setEditingLesson] = useState<Lesson | null>(null)
    const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null)
    const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())

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
        pdf_url: '',
        content: '',
        is_locked: false
    })

    useEffect(() => {
        if (productId) {
            fetchProduct()
            fetchModules()
        }
    }, [productId])

    const fetchProduct = async () => {
        try {
            const { data, error } = await supabase
                .from('marketplace_products')
                .select('*')
                .eq('id', productId)
                .single()

            if (error) throw error
            setProduct(data)
        } catch (error) {
            console.error('Error fetching product:', error)
            alert('Error loading product')
        }
    }

    const fetchModules = async () => {
        try {
            setLoading(true)
            const { data: modulesData, error: modulesError } = await supabase
                .from('community_modules')
                .select('*')
                .eq('member_area_id', productId)
                .order('order_position', { ascending: true })

            if (modulesError) throw modulesError

            if (!modulesData || modulesData.length === 0) {
                setModules([])
                return
            }

            // Fetch ALL lessons in a single query (avoids N+1 problem)
            const moduleIds = modulesData.map(m => m.id)
            const { data: allLessons } = await supabase
                .from('community_lessons')
                .select('*')
                .in('module_id', moduleIds)
                .order('order_position', { ascending: true })

            // Group lessons by module_id in memory
            const lessonsByModule = (allLessons || []).reduce((acc, lesson) => {
                if (!acc[lesson.module_id]) acc[lesson.module_id] = []
                acc[lesson.module_id].push(lesson)
                return acc
            }, {} as Record<string, Lesson[]>)

            const modulesWithLessons = modulesData.map(module => ({
                ...module,
                lessons: lessonsByModule[module.id] || []
            }))

            setModules(modulesWithLessons)
        } catch (error) {
            console.error('Error fetching modules:', error)
        } finally {
            setLoading(false)
        }
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
        setShowModuleModal(true)
    }

    const handleEditModule = (module: Module) => {
        setEditingModule(module)
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
        setShowModuleModal(true)
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

            setShowModuleModal(false)
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
            pdf_url: '',
            content: '',
            is_locked: false
        })
        setShowLessonModal(true)
    }

    const handleEditLesson = (lesson: Lesson) => {
        setEditingLesson(lesson)
        setSelectedModuleId(lesson.module_id)
        setLessonForm({
            title: lesson.title,
            description: lesson.description || '',
            duration: lesson.duration || '',
            type: lesson.type,
            video_url: lesson.video_url || '',
            pdf_url: lesson.pdf_url || '',
            content: lesson.content || '',
            is_locked: lesson.is_locked
        })
        setShowLessonModal(true)
    }

    const handleSaveLesson = async (e: React.FormEvent) => {
        e.preventDefault()

        try {
            const module = modules.find(m => m.id === selectedModuleId)
            if (!module) throw new Error('Module not found')

            if (editingLesson) {
                const { error } = await supabase
                    .from('community_lessons')
                    .update({
                        ...lessonForm,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', editingLesson.id)

                if (error) throw error
                alert('Lesson updated successfully!')
            } else {
                const { error } = await supabase
                    .from('community_lessons')
                    .insert({
                        ...lessonForm,
                        module_id: selectedModuleId,
                        order_position: module.lessons?.length || 0
                    })

                if (error) throw error
                alert('Lesson created successfully!')
            }

            setShowLessonModal(false)
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

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0f1117] flex transition-colors duration-200">
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <header className="h-14 bg-white dark:bg-[#1a1d2e] border-b border-gray-200 dark:border-[#1e2139] flex items-center justify-between px-4 transition-colors duration-200">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/products')}
                            className="flex items-center gap-2 text-gray-600 dark:text-gray-600 hover:text-gray-900 dark:hover:text-gray-100"
                        >
                            <ArrowLeft size={20} />
                            <span className="hidden sm:inline">{t('common.back')}</span>
                        </button>
                        <div>
                            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{product?.name}</h1>
                            <p className="text-xs text-gray-500 dark:text-gray-500">{t('product_pages.content_title')}</p>
                        </div>
                    </div>
                    <UserProfileDropdown />
                </header>

                {/* Main Content */}
                <main className="flex-1 overflow-y-auto p-6">
                    <div className="max-w-5xl mx-auto">
                        {/* Header Section */}
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">{t('product_pages.modules')}</h2>
                                <p className="text-gray-600 dark:text-gray-500">
                                    {modules.length} modules • {modules.reduce((acc, m) => acc + (m.lessons?.length || 0), 0)} lessons
                                </p>
                            </div>
                            <button
                                onClick={handleCreateModule}
                                className="border border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 bg-transparent transition-colors"
                            >
                                <Plus size={20} />
                                {t('product_pages.add_module')}
                            </button>
                        </div>

                        {/* Modules List */}
                        {loading ? (
                            <div className="text-center py-20">
                                <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 dark:border-[#252941] border-t-blue-600 mx-auto"></div>
                                <p className="mt-4 text-gray-600 dark:text-gray-600">{t('common.loading')}</p>
                            </div>
                        ) : modules.length === 0 ? (
                            <div className="text-center py-20 bg-white dark:bg-[#1a1d2e] rounded-xl border border-gray-200 dark:border-[#1e2139]">
                                <Package className="w-16 h-16 text-gray-400 dark:text-gray-400 mx-auto mb-4" />
                                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">{t('product_pages.no_modules')}</h3>
                                <p className="text-gray-600 dark:text-gray-600 mb-6">{t('product_pages.add_module')}</p>
                                <button
                                    onClick={handleCreateModule}
                                    className="border border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-6 py-2 rounded-lg font-medium inline-flex items-center gap-2 bg-transparent transition-colors"
                                >
                                    <Plus size={20} />
                                    {t('product_pages.add_module')}
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {modules.map((module) => {
                                    const isExpanded = expandedModules.has(module.id)
                                    return (
                                        <div key={module.id} className="bg-white dark:bg-[#1a1d2e] rounded-xl border border-gray-200 dark:border-[#1e2139] overflow-hidden">
                                            {/* Module Header */}
                                            <div className="p-4 flex items-center justify-between">
                                                <div className="flex items-center gap-3 flex-1">
                                                    <GripVertical size={20} className="text-gray-500 dark:text-gray-600 cursor-move" />
                                                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                                                        {getModuleIcon(module.type)}
                                                    </div>
                                                    <div className="flex-1">
                                                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Module {module.module_number}</h3>
                                                        <p className="text-xs text-gray-600 dark:text-gray-500">{module.title}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {!isExpanded && (
                                                        <button
                                                            onClick={() => setExpandedModules(prev => new Set(prev).add(module.id))}
                                                            className="text-sm text-blue-400 hover:text-blue-300"
                                                        >
                                                            {t('common.content')}
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleEditModule(module)}
                                                        className="p-2 text-gray-400 hover:text-white rounded-lg"
                                                    >
                                                        <Edit size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteModule(module.id)}
                                                        className="p-2 text-gray-400 hover:text-red-400 rounded-lg"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            const newExpanded = new Set(expandedModules)
                                                            if (isExpanded) {
                                                                newExpanded.delete(module.id)
                                                            } else {
                                                                newExpanded.add(module.id)
                                                            }
                                                            setExpandedModules(newExpanded)
                                                        }}
                                                        className="p-2 text-gray-400 hover:text-white rounded-lg"
                                                    >
                                                        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Lessons List */}
                                            {isExpanded && (
                                                <div className="border-t border-[#1e2139]">
                                                    <div className="p-4 flex items-center justify-between bg-[#0f1117]">
                                                        <h4 className="text-sm font-medium text-gray-300">{t('common.lesson')}</h4>
                                                        <button
                                                            onClick={() => handleCreateLesson(module.id)}
                                                            className="text-sm px-3 py-1.5 border border-gray-600 hover:border-gray-500 text-gray-400 hover:text-white rounded-lg bg-transparent transition-colors"
                                                        >
                                                            + {t('common.lesson')}
                                                        </button>
                                                    </div>
                                                    {module.lessons && module.lessons.length > 0 && (
                                                        <div className="divide-y divide-[#1e2139]">
                                                            {module.lessons.map((lesson) => (
                                                                <div key={lesson.id} className="p-4 flex items-center justify-between hover:bg-[#0f1117]">
                                                                    <div className="flex items-center gap-3 flex-1">
                                                                        <GripVertical size={16} className="text-gray-400" />
                                                                        <div className="flex-1">
                                                                            <div className="flex items-center gap-2">
                                                                                <h4 className="font-medium text-gray-100">{lesson.title}</h4>
                                                                                {lesson.duration && (
                                                                                    <span className="text-xs text-gray-500">• {lesson.duration}</span>
                                                                                )}
                                                                                {lesson.is_locked && (
                                                                                    <span className="text-xs px-2 py-0.5 bg-red-500/10 text-red-400 rounded-full">Locked</span>
                                                                                )}
                                                                            </div>
                                                                            {lesson.description && (
                                                                                <div
                                                                                    className="text-sm text-gray-600 [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:list-decimal [&>ol]:pl-4 [&>a]:text-blue-400 [&>a]:underline"
                                                                                    dangerouslySetInnerHTML={{ __html: lesson.description }}
                                                                                />
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs px-2 py-1 bg-[#252941] text-gray-400 rounded">{lesson.type}</span>
                                                                        <button
                                                                            onClick={() => handleEditLesson(lesson)}
                                                                            className="p-2 text-gray-400 hover:text-white rounded-lg"
                                                                        >
                                                                            <Edit size={16} />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleDeleteLesson(lesson.id)}
                                                                            className="p-2 text-gray-400 hover:text-red-400 rounded-lg"
                                                                        >
                                                                            <Trash2 size={16} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </main>
            </div>

            {/* Module Modal */}
            {showModuleModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-[#1a1d2e] rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-[#1e2139]">
                        <div className="flex justify-between items-center p-6 border-b">
                            <h2 className="text-xl font-semibold">
                                {editingModule ? `${t('common.edit')} ${t('common.module')}` : `${t('product_pages.add_module')}`}
                            </h2>
                            <button onClick={() => setShowModuleModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveModule} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">{t('product_pages.module_name')}</label>
                                    <input
                                        type="text"
                                        value={moduleForm.module_number}
                                        onChange={(e) => setModuleForm({ ...moduleForm, module_number: e.target.value })}
                                        className="w-full p-3 bg-[#1a1d2e] text-gray-200 border border-[#252941] rounded-lg"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">{t('common.type')}</label>
                                    <select
                                        value={moduleForm.type}
                                        onChange={(e) => setModuleForm({ ...moduleForm, type: e.target.value as any })}
                                        className="w-full p-3 bg-[#1a1d2e] text-gray-200 border border-[#252941] rounded-lg"
                                    >
                                        <option value="video">Video</option>
                                        <option value="article">Article</option>
                                        <option value="group">Group</option>
                                        <option value="resource">Resource</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">{t('common.title')}</label>
                                <input
                                    type="text"
                                    value={moduleForm.title}
                                    onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
                                    className="w-full p-3 bg-[#1a1d2e] text-gray-200 border border-[#252941] rounded-lg"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">{t('common.description')}</label>
                                <textarea
                                    value={moduleForm.description}
                                    onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })}
                                    rows={3}
                                    className="w-full p-3 bg-[#1a1d2e] text-gray-200 border border-[#252941] rounded-lg"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">{t('common.image')}</label>
                                <input
                                    type="url"
                                    value={moduleForm.image_url}
                                    onChange={(e) => setModuleForm({ ...moduleForm, image_url: e.target.value })}
                                    className="w-full p-3 bg-[#1a1d2e] text-gray-200 border border-[#252941] rounded-lg"
                                    placeholder="https://..."
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="is_locked"
                                    checked={moduleForm.is_locked}
                                    onChange={(e) => setModuleForm({ ...moduleForm, is_locked: e.target.checked })}
                                    className="w-4 h-4"
                                />
                                <label htmlFor="is_locked" className="text-sm font-medium text-gray-300">{t('common.module')}</label>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModuleModal(false)}
                                    className="flex-1 px-4 py-2 border border-[#252941] text-gray-300 rounded-lg hover:bg-[#0f1117]"
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 border border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white rounded-lg bg-transparent transition-colors"
                                >
                                    {editingModule ? t('common.save') : t('product_pages.add_module')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Lesson Modal */}
            {showLessonModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-[#1a1d2e] rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-[#1e2139]">
                        <div className="flex justify-between items-center p-6 border-b">
                            <h2 className="text-xl font-semibold">
                                {editingLesson ? `${t('common.edit')} ${t('common.lesson')}` : `${t('product_pages.add_lesson')}`}
                            </h2>
                            <button onClick={() => setShowLessonModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveLesson} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">{t('common.type')}</label>
                                    <select
                                        value={lessonForm.type}
                                        onChange={(e) => setLessonForm({ ...lessonForm, type: e.target.value as any })}
                                        className="w-full p-3 bg-[#1a1d2e] text-gray-200 border border-[#252941] rounded-lg"
                                    >
                                        <option value="video">Video</option>
                                        <option value="pdf">PDF</option>
                                        <option value="article">Article</option>
                                        <option value="quiz">Quiz</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">{t('common.title')}</label>
                                    <input
                                        type="text"
                                        value={lessonForm.duration}
                                        onChange={(e) => setLessonForm({ ...lessonForm, duration: e.target.value })}
                                        className="w-full p-3 bg-[#1a1d2e] text-gray-200 border border-[#252941] rounded-lg"
                                        placeholder="e.g.: 10:30"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Title</label>
                                <input
                                    type="text"
                                    value={lessonForm.title}
                                    onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
                                    className="w-full p-3 bg-[#1a1d2e] text-gray-200 border border-[#252941] rounded-lg"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">{t('common.description')}</label>
                                <textarea
                                    value={lessonForm.description}
                                    onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })}
                                    rows={3}
                                    className="w-full p-3 bg-[#1a1d2e] text-gray-200 border border-[#252941] rounded-lg"
                                />
                            </div>

                            {lessonForm.type === 'video' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">{t('product_pages.video_url')}</label>
                                    <input
                                        type="url"
                                        value={lessonForm.video_url}
                                        onChange={(e) => setLessonForm({ ...lessonForm, video_url: e.target.value })}
                                        className="w-full p-3 bg-[#1a1d2e] text-gray-200 border border-[#252941] rounded-lg"
                                        placeholder="https://youtube.com/..."
                                    />
                                </div>
                            )}

                            {lessonForm.type === 'pdf' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">PDF URL</label>
                                    <input
                                        type="url"
                                        value={lessonForm.pdf_url}
                                        onChange={(e) => setLessonForm({ ...lessonForm, pdf_url: e.target.value })}
                                        className="w-full p-3 bg-[#1a1d2e] text-gray-200 border border-[#252941] rounded-lg"
                                        placeholder="https://..."
                                    />
                                </div>
                            )}

                            {lessonForm.type === 'article' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">{t('common.content')}</label>
                                    <textarea
                                        value={lessonForm.content}
                                        onChange={(e) => setLessonForm({ ...lessonForm, content: e.target.value })}
                                        rows={6}
                                        className="w-full p-3 bg-[#1a1d2e] text-gray-200 border border-[#252941] rounded-lg"
                                    />
                                </div>
                            )}

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="lesson_locked"
                                    checked={lessonForm.is_locked}
                                    onChange={(e) => setLessonForm({ ...lessonForm, is_locked: e.target.checked })}
                                    className="w-4 h-4"
                                />
                                <label htmlFor="lesson_locked" className="text-sm font-medium text-gray-300">{t('common.lesson')}</label>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowLessonModal(false)}
                                    className="flex-1 px-4 py-2 border border-[#252941] text-gray-300 rounded-lg hover:bg-[#0f1117]"
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 border border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white rounded-lg bg-transparent transition-colors"
                                >
                                    {editingLesson ? t('common.save') : t('product_pages.add_lesson')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
