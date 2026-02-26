import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
    ChevronLeft,
    ChevronRight,
    Play,
    CheckCircle2,
    Circle,
    Lock,
    Home,
    LogOut,
    Clock,
    BookOpen,
    AlertTriangle,
    FileText,
    Video,
    MessageCircle,
    RotateCcw,
    User,
    X,
    Camera
} from 'lucide-react'
import { supabase } from '@/services/supabase'
import { useI18n } from '@/i18n'

// Converte URLs de vídeo para formato embed (iframe-compatível)
const toEmbedUrl = (url: string): string => {
    if (!url) return url

    // YouTube: watch?v=ID → embed/ID
    const ytWatch = url.match(/(?:youtube\.com\/watch\?v=|youtube\.com\/watch\?.+&v=)([a-zA-Z0-9_-]+)/)
    if (ytWatch) return `https://www.youtube.com/embed/${ytWatch[1]}`

    // YouTube: youtu.be/ID → embed/ID
    const ytShort = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/)
    if (ytShort) return `https://www.youtube.com/embed/${ytShort[1]}`

    // YouTube: já é embed → manter
    if (url.includes('youtube.com/embed/')) return url

    // Vimeo: vimeo.com/ID → player.vimeo.com/video/ID
    const vimeo = url.match(/vimeo\.com\/(\d+)/)
    if (vimeo && !url.includes('player.vimeo.com')) return `https://player.vimeo.com/video/${vimeo[1]}`

    return url
}

interface Lesson {
    id: string
    title: string
    description?: string
    duration: string
    completed: boolean
    locked: boolean
    video_url?: string
    video_script?: string
    pdf_url?: string
    content?: string
    type: 'video' | 'pdf' | 'article' | 'quiz'
}

interface Module {
    id: string
    title: string
    number: string
    image_url?: string
    lessons: Lesson[]
}

interface CommunityUser {
    id: string
    name: string
    email: string
    lastName?: string
    phone?: string
    occupation?: string
    timezone?: string
    bio?: string
    avatar_url?: string
    cover_url?: string
}

export default function CommunityModuleViewer() {
    const navigate = useNavigate()
    const { communitySlug, moduleId } = useParams<{ communitySlug: string; moduleId: string }>()
    const { t } = useI18n()

    const [user, setUser] = useState<CommunityUser | null>(null)
    const [currentModule, setCurrentModule] = useState<Module | null>(null)
    const [currentLessonIndex, setCurrentLessonIndex] = useState(0)
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
    const [loading, setLoading] = useState(true)
    const [product, setProduct] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)
    const [noModules, setNoModules] = useState(false)
    const [viewMode, setViewMode] = useState<'modules' | 'lessons'>('modules') // Nova state para controlar a view
    const [showProfileModal, setShowProfileModal] = useState(false)
    const [profileForm, setProfileForm] = useState<CommunityUser | null>(null)
    const [savingProfile, setSavingProfile] = useState(false)
    const [uploadingAvatar, setUploadingAvatar] = useState(false)
    const [uploadingCover, setUploadingCover] = useState(false)
    const [accessibleModules, setAccessibleModules] = useState<string[]>([]) // New state for accessible modules

    // Refs for file inputs
    const avatarInputRef = useRef<HTMLInputElement>(null)
    const coverInputRef = useRef<HTMLInputElement>(null)

    // Verificar autenticação: checar token de produto OU de comunidade
    const hasProductToken = !!localStorage.getItem(`product_member_token_${communitySlug}`)
    const hasCommunityToken = !!localStorage.getItem(`community_token_${communitySlug}`)
    const isProductMembersArea = hasProductToken

    const [allModules, setAllModules] = useState<Module[]>([])

    // Function to select a module and go to lessons
    const selectModule = (module: Module) => {
        // Check if user has access to this module
        if (!accessibleModules.includes(module.id)) {
            alert(t('community.module_locked'))
            return
        }

        setCurrentModule(module)
        setCurrentLessonIndex(0)
        setViewMode('lessons')
        // Atualizar URL para incluir o moduleId
        navigate(`/community/${communitySlug}/module/${module.id}`, { replace: true })
    }

    // Function to go back to module selection
    const backToModules = () => {
        setViewMode('modules')
        setCurrentModule(null)
        navigate(`/community/${communitySlug}`, { replace: true })
    }

    // Fetch real product and module data
    const fetchModuleData = async () => {
        try {
            setLoading(true)
            setError(null)
            setNoModules(false)

            // Tentar buscar produto por slug primeiro, depois por ID
            let productData: any = null

            const { data: bySlug } = await supabase
                .from('marketplace_products')
                .select('*')
                .eq('slug', communitySlug)
                .maybeSingle()

            if (bySlug) {
                productData = bySlug
            } else {
                // Se não encontrou por slug, tentar por ID
                const { data: byId } = await supabase
                    .from('marketplace_products')
                    .select('*')
                    .eq('id', communitySlug)
                    .maybeSingle()

                if (byId) {
                    productData = byId
                }
            }

            if (!productData) {
                setError(t('community.product_not_found'))
                return
            }

            // Debug: verificar campos de member area

            setProduct(productData)

            // Fetch ALL product modules
            const { data: modulesData, error: modulesError } = await supabase
                .from('community_modules')
                .select('*')
                .eq('member_area_id', productData.id)
                .order('order_position', { ascending: true })

            if (modulesError) {
                console.error('Error fetching modules:', modulesError)
                setError(t('community.error_loading_modules'))
                return
            }

            if (!modulesData || modulesData.length === 0) {
                setNoModules(true)
                return
            }

            // Fetch lessons from ALL modules at once
            const moduleIds = modulesData.map(m => m.id)
            const { data: allLessonsData, error: lessonsError } = await supabase
                .from('community_lessons')
                .select('*')
                .in('module_id', moduleIds)
                .order('order_position', { ascending: true })

            if (lessonsError) {
                console.error('Error fetching lessons:', lessonsError)
                setError(t('community.error_loading_lessons'))
                return
            }

            // Build all modules with their lessons
            const modulesWithLessons: Module[] = modulesData.map(mod => ({
                id: mod.id,
                title: mod.title,
                number: mod.module_number,
                image_url: mod.image_url || '',
                lessons: (allLessonsData || [])
                    .filter(lesson => lesson.module_id === mod.id)
                    .map(lesson => ({
                        id: lesson.id,
                        title: lesson.title,
                        description: lesson.description || '',
                        duration: lesson.duration || '00:00',
                        completed: false,
                        locked: lesson.is_locked || false,
                        video_url: lesson.video_url || '',
                        video_script: lesson.video_script || '',
                        pdf_url: lesson.pdf_url || '',
                        content: lesson.content || '',
                        type: (lesson.type || 'video') as 'video' | 'pdf' | 'article' | 'quiz'
                    }))
            }))

            setAllModules(modulesWithLessons)

            // Check user's module access using user_module_access table
            if (user?.email) {


                // First, get the user_id from user_product_access table using email and product
                const { data: userAccessData, error: userAccessError } = await supabase
                    .from('user_product_access')
                    .select('user_id, id')
                    .eq('member_area_id', productData.id)
                    .is('is_active', true)

                if (!userAccessError && userAccessData && userAccessData.length > 0) {
                    const userIds = userAccessData.map(access => access.user_id)


                    // Check for granular module access
                    const { data: moduleAccessData, error: moduleAccessError } = await supabase
                        .from('user_module_access')
                        .select('module_id')
                        .in('user_id', userIds)

                    if (!moduleAccessError && moduleAccessData && moduleAccessData.length > 0) {
                        // User has granular module access
                        const accessibleModuleIds = moduleAccessData.map(access => access.module_id)
                        setAccessibleModules(accessibleModuleIds)

                    } else {
                        // No granular access found, give full product access (legacy mode)
                        setAccessibleModules(moduleIds)

                    }
                } else {

                    setAccessibleModules([])
                }
            } else {
                // If no user info, assume no access

                setAccessibleModules([])
            }

            // If moduleId in URL (and is valid UUID) and modules available, go directly to lessons
            const isValidModuleId = moduleId && modulesWithLessons.some(m => m.id === moduleId)
            if (isValidModuleId) {
                const targetModule = modulesWithLessons.find(m => m.id === moduleId)!
                setCurrentModule(targetModule)
                setViewMode('lessons')
            } else {
                // Otherwise, show module selection
                setViewMode('modules')
                setCurrentModule(null)
            }

        } catch (err: any) {
            console.error('Error fetching module data:', err)
            setError(err?.message || t('common.error'))
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        // Verificar autenticação com tokens específicos por slug
        const token = localStorage.getItem(`product_member_token_${communitySlug}`) ||
            localStorage.getItem(`community_token_${communitySlug}`)
        const userData = localStorage.getItem(`product_member_data_${communitySlug}`) ||
            localStorage.getItem(`community_user_${communitySlug}`)

        if (!token) {
            navigate(`/members-login/${communitySlug}`)
            return
        }

        if (userData) {
            try {
                setUser(JSON.parse(userData))
            } catch {
                console.error('Erro ao parsear dados do usuário')
            }
        }

        fetchModuleData()
    }, [communitySlug, moduleId, navigate])

    const handleLogout = () => {
        localStorage.removeItem(`product_member_token_${communitySlug}`)
        localStorage.removeItem(`product_member_data_${communitySlug}`)
        localStorage.removeItem(`community_token_${communitySlug}`)
        localStorage.removeItem(`community_user_${communitySlug}`)
        navigate(`/members-login/${communitySlug}`)
    }

    const openProfileModal = async () => {
        // Try to fetch profile from database first
        if (product?.id && user?.email) {
            const { data: dbProfile } = await supabase
                .from('member_profiles')
                .select('*')
                .eq('product_id', product.id)
                .eq('email', user.email)
                .maybeSingle()

            if (dbProfile) {
                setProfileForm({
                    id: dbProfile.id,
                    name: dbProfile.name || user.name,
                    email: dbProfile.email,
                    lastName: dbProfile.last_name,
                    phone: dbProfile.phone,
                    occupation: dbProfile.occupation,
                    timezone: dbProfile.timezone,
                    bio: dbProfile.bio,
                    avatar_url: dbProfile.avatar_url,
                    cover_url: dbProfile.cover_url
                })
            } else {
                setProfileForm(user ? { ...user } : null)
            }
        } else {
            setProfileForm(user ? { ...user } : null)
        }
        setShowProfileModal(true)
        setSidebarCollapsed(true)
    }

    const handleSaveProfile = async () => {
        if (!profileForm || !product?.id) return
        setSavingProfile(true)
        try {
            // Prepare data for database
            const profileData = {
                product_id: product.id,
                email: profileForm.email,
                name: profileForm.name,
                last_name: profileForm.lastName,
                phone: profileForm.phone,
                occupation: profileForm.occupation,
                timezone: profileForm.timezone,
                bio: profileForm.bio,
                avatar_url: profileForm.avatar_url,
                cover_url: profileForm.cover_url
            }

            // Upsert to database (insert or update)
            const { error } = await supabase
                .from('member_profiles')
                .upsert(profileData, {
                    onConflict: 'product_id,email',
                    ignoreDuplicates: false
                })

            if (error) {
                console.error('Error saving profile to database:', error)
            }

            // Also update localStorage for quick access
            const storageKey = hasProductToken
                ? `product_member_data_${communitySlug}`
                : `community_user_${communitySlug}`
            localStorage.setItem(storageKey, JSON.stringify(profileForm))
            setUser(profileForm)
            setShowProfileModal(false)
        } catch (err) {
            console.error('Error saving profile:', err)
        } finally {
            setSavingProfile(false)
        }
    }

    // Handle avatar upload
    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !product?.id || !user?.email) return

        setUploadingAvatar(true)
        try {
            // Create unique filename
            const fileExt = file.name.split('.').pop()
            const fileName = `${product.id}/${user.email.replace(/[^a-zA-Z0-9]/g, '_')}_avatar_${Date.now()}.${fileExt}`

            // Upload to Supabase Storage
            const { data, error } = await supabase.storage
                .from('member-avatars')
                .upload(fileName, file, { upsert: true })

            if (error) {
                console.error('Error uploading avatar:', error)
                // If bucket doesn't exist, try public bucket
                const { data: publicData, error: publicError } = await supabase.storage
                    .from('public')
                    .upload(`avatars/${fileName}`, file, { upsert: true })

                if (publicError) {
                    console.error('Error uploading to public bucket:', publicError)
                    alert('Error uploading image. Please try again.')
                    return
                }

                const { data: { publicUrl } } = supabase.storage
                    .from('public')
                    .getPublicUrl(`avatars/${fileName}`)

                setProfileForm(prev => prev ? { ...prev, avatar_url: publicUrl } : null)
            } else {
                // Get public URL
                const { data: { publicUrl } } = supabase.storage
                    .from('member-avatars')
                    .getPublicUrl(fileName)

                setProfileForm(prev => prev ? { ...prev, avatar_url: publicUrl } : null)
            }
        } catch (err) {
            console.error('Error uploading avatar:', err)
            alert('Error uploading image. Please try again.')
        } finally {
            setUploadingAvatar(false)
        }
    }

    // Handle cover upload
    const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !product?.id || !user?.email) return

        setUploadingCover(true)
        try {
            // Create unique filename
            const fileExt = file.name.split('.').pop()
            const fileName = `${product.id}/${user.email.replace(/[^a-zA-Z0-9]/g, '_')}_cover_${Date.now()}.${fileExt}`

            // Upload to Supabase Storage
            const { data, error } = await supabase.storage
                .from('member-avatars')
                .upload(fileName, file, { upsert: true })

            if (error) {
                console.error('Error uploading cover:', error)
                // If bucket doesn't exist, try public bucket
                const { data: publicData, error: publicError } = await supabase.storage
                    .from('public')
                    .upload(`covers/${fileName}`, file, { upsert: true })

                if (publicError) {
                    console.error('Error uploading to public bucket:', publicError)
                    alert('Error uploading image. Please try again.')
                    return
                }

                const { data: { publicUrl } } = supabase.storage
                    .from('public')
                    .getPublicUrl(`covers/${fileName}`)

                setProfileForm(prev => prev ? { ...prev, cover_url: publicUrl } : null)
            } else {
                // Get public URL
                const { data: { publicUrl } } = supabase.storage
                    .from('member-avatars')
                    .getPublicUrl(fileName)

                setProfileForm(prev => prev ? { ...prev, cover_url: publicUrl } : null)
            }
        } catch (err) {
            console.error('Error uploading cover:', err)
            alert('Error uploading image. Please try again.')
        } finally {
            setUploadingCover(false)
        }
    }

    const handleModuleChange = (mod: Module) => {
        setCurrentModule(mod)
        setCurrentLessonIndex(0)
    }

    const handleLessonClick = (index: number) => {
        const lesson = currentModule?.lessons[index]
        if (lesson && !lesson.locked) {
            setCurrentLessonIndex(index)
        }
    }

    const handleNextLesson = () => {
        if (currentModule && currentLessonIndex < currentModule.lessons.length - 1) {
            const nextLesson = currentModule.lessons[currentLessonIndex + 1]
            if (!nextLesson.locked) {
                setCurrentLessonIndex(currentLessonIndex + 1)
            }
        }
    }

    const handlePrevLesson = () => {
        if (currentLessonIndex > 0) {
            setCurrentLessonIndex(currentLessonIndex - 1)
        }
    }

    const markAsCompleted = () => {
        if (currentModule) {
            const updatedLessons = [...currentModule.lessons]
            updatedLessons[currentLessonIndex].completed = true
            setCurrentModule({
                ...currentModule,
                lessons: updatedLessons
            })
        }
    }

    // Estado de carregamento
    if (loading) {
        return (
            <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#1e2139] border-t-blue-500 mx-auto mb-4" />
                    <p className="text-gray-400">{t('common.loading')}</p>
                </div>
            </div>
        )
    }

    // Estado de erro
    if (error) {
        return (
            <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
                <div className="text-center max-w-md mx-auto p-8">
                    <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle size={32} className="text-red-400" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-100 mb-2">{t('community.loading_error')}</h2>
                    <p className="text-gray-400 mb-6">{error}</p>
                    <div className="flex gap-3 justify-center">
                        <button
                            onClick={() => fetchModuleData()}
                            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                        >
                            {t('community.try_again')}
                        </button>
                        <button
                            onClick={() => navigate(isProductMembersArea ? '/products' : `/community/${communitySlug}`)}
                            className="px-4 py-2 bg-[#252941] text-gray-300 rounded-lg hover:bg-[#1e2139] transition-colors text-sm"
                        >
                            {t('common.back')}
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // State: product found but no modules
    if (noModules) {
        return (
            <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
                <div className="text-center max-w-md mx-auto p-8">
                    <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <BookOpen size={32} className="text-blue-400" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-100 mb-2">
                        {product?.name || 'Members Area'}
                    </h2>
                    <p className="text-gray-400 mb-2">{t('community.no_modules')}</p>
                    <p className="text-gray-500 text-sm mb-6">
                        {t('community.content_preparing')}
                    </p>
                    <div className="flex gap-3 justify-center">
                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 bg-[#252941] text-gray-300 rounded-lg hover:bg-[#1e2139] transition-colors text-sm flex items-center gap-2"
                        >
                            <LogOut size={16} />
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // State: no user
    if (!user) {
        return (
            <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
                <div className="text-center max-w-md mx-auto p-8">
                    <div className="w-16 h-16 bg-[#252941] rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <BookOpen size={32} className="text-gray-400" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-100 mb-2">{t('community.access_denied')}</h2>
                    <p className="text-gray-400 mb-6">{t('community.login_required')}</p>
                    <button
                        onClick={() => navigate(`/members-login/${communitySlug}`)}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                    >
                        {t('community.login_button')}
                    </button>
                </div>
            </div>
        )
    }

    // State: lessons view but no module selected
    if (viewMode === 'lessons' && !currentModule) {
        return (
            <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
                <div className="text-center max-w-md mx-auto p-8">
                    <div className="w-16 h-16 bg-[#252941] rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <BookOpen size={32} className="text-gray-400" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-100 mb-2">{t('community.module_not_found')}</h2>
                    <p className="text-gray-400 mb-6">{t('community.could_not_load')}</p>
                    <button
                        onClick={backToModules}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                    >
                        {t('community.view_modules')}
                    </button>
                </div>
            </div>
        )
    }

    const currentLesson = currentModule && currentModule.lessons.length > 0 ? currentModule.lessons[currentLessonIndex] : null
    const hasLessons = currentModule ? currentModule.lessons.length > 0 : false

    // Function to get module icon based on type
    const getModuleIcon = (module: Module) => {
        // Use first character of title or module number
        return module.number || module.title.charAt(0).toUpperCase()
    }

    // Render module selection view
    if (viewMode === 'modules') {
        return (
            <div className="min-h-screen bg-[#0f1117]">
                {/* Mobile overlay */}
                {!sidebarCollapsed && (
                    <div
                        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                        onClick={() => setSidebarCollapsed(true)}
                    />
                )}

                {/* Mobile Sidebar - Slide in drawer */}
                <aside
                    className={`fixed left-0 top-0 h-screen w-56 bg-[#0f1117] border-r border-[#1e2139] z-50 lg:hidden transition-transform duration-300 ease-in-out pt-4 ${sidebarCollapsed ? '-translate-x-full' : 'translate-x-0'
                        }`}
                >
                    <div className="flex flex-col h-full">
                        {/* Mobile Header */}
                        <div className="flex items-center justify-between px-3 mb-2">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <BookOpen size={16} className="text-white" />
                                </div>
                                <h2 className="text-blue-400 font-medium text-sm truncate">{product?.name}</h2>
                            </div>
                            <button
                                onClick={() => setSidebarCollapsed(true)}
                                className="p-1.5 text-gray-400 hover:text-white"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>

                        {/* User Profile - below product name */}
                        <button
                            onClick={openProfileModal}
                            className="mx-3 mb-3 p-2 rounded-lg bg-[#1a1d2e] border border-[#1e2139] hover:border-blue-500/30 transition-colors flex items-center gap-2"
                        >
                            <div className="w-10 h-10 rounded-full bg-[#252941] flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-blue-500/30">
                                {user?.avatar_url ? (
                                    <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <User size={18} className="text-gray-400" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                                <p className="text-xs font-medium text-gray-200 truncate">{user?.name || t('community.members')}</p>
                                <p className="text-[10px] text-gray-500 truncate">{user?.email}</p>
                            </div>
                        </button>

                        {/* Navigation */}
                        <nav className="flex-1 py-2 px-1.5 space-y-0.5">
                            <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gradient-to-r from-blue-500/20 to-[#252941]/20 text-blue-400 font-medium border border-blue-500/30">
                                <Home size={16} className="flex-shrink-0 text-blue-400" />
                                <span className="text-xs">{t('common.home')}</span>
                            </button>

                            {product?.support_enabled && (
                                <a
                                    href={product.support_url || '#'}
                                    target={product.support_url ? "_blank" : undefined}
                                    rel="noopener noreferrer"
                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-gray-400 hover:bg-[#1a1d2e] hover:text-gray-200 transition-colors"
                                >
                                    <MessageCircle size={16} className="flex-shrink-0 text-gray-500" />
                                    <span className="text-xs">{product.support_label || t('community.support')}</span>
                                </a>
                            )}

                            {product?.refund_enabled && (
                                <a
                                    href={product.refund_url || '#'}
                                    target={product.refund_url ? "_blank" : undefined}
                                    rel="noopener noreferrer"
                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-gray-400 hover:bg-[#1a1d2e] hover:text-gray-200 transition-colors"
                                >
                                    <RotateCcw size={16} className="flex-shrink-0 text-gray-500" />
                                    <span className="text-xs">{product.refund_label || t('community.refund')}</span>
                                </a>
                            )}
                        </nav>

                        {/* User Section - at bottom */}
                        <div className="border-t border-[#1e2139] p-2">
                            {/* User Avatar and Info */}
                            <div className="flex items-center gap-2 px-2 py-2 mb-1">
                                <div className="w-8 h-8 rounded-full bg-[#252941] flex items-center justify-center overflow-hidden flex-shrink-0 border border-[#1e2139]">
                                    {user?.avatar_url ? (
                                        <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <User size={14} className="text-gray-500" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-gray-200 truncate">{user?.name || t('community.members')}</p>
                                    <p className="text-[10px] text-gray-500 truncate">{user?.email}</p>
                                </div>
                            </div>

                            {/* Profile & Logout Buttons */}
                            <div className="space-y-0.5">
                                <button
                                    onClick={openProfileModal}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-gray-400 hover:bg-[#1a1d2e] hover:text-gray-200 transition-colors"
                                >
                                    <User size={16} className="flex-shrink-0 text-gray-500" />
                                    <span className="text-xs font-medium">{t('common.profile')}</span>
                                </button>
                                <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-gray-400 hover:bg-[#1a1d2e] hover:text-gray-200 transition-colors cursor-pointer" onClick={handleLogout}>
                                    <LogOut size={16} className="flex-shrink-0 text-gray-500" />
                                    <span className="text-xs font-medium">{t('community.logout')}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Desktop Sidebar - Collapsible with hover - same design as project */}
                <aside className="fixed left-0 top-0 h-screen w-16 hover:w-56 bg-[#0f1117] border-r border-[#1e2139] z-50 hidden lg:block group transition-all duration-300 ease-in-out overflow-hidden pt-4">
                    <div className="flex flex-col h-full">
                        {/* Logo/Header */}
                        <div className="flex items-center gap-2 px-3 mb-2">
                            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                                <BookOpen size={16} className="text-white" />
                            </div>
                            <div className="flex-1 min-w-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <h2 className="text-blue-400 font-medium text-sm truncate whitespace-nowrap">{product?.name}</h2>
                            </div>
                        </div>

                        {/* User Profile - below product name */}
                        <button
                            onClick={openProfileModal}
                            className="mx-1.5 mb-3 p-1.5 rounded-lg bg-[#1a1d2e] border border-[#1e2139] hover:border-blue-500/30 transition-colors flex items-center gap-2"
                        >
                            <div className="w-8 h-8 rounded-full bg-[#252941] flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-blue-500/30">
                                {user?.avatar_url ? (
                                    <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <User size={14} className="text-gray-400" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0 text-left opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <p className="text-xs font-medium text-gray-200 truncate whitespace-nowrap">{user?.name || t('community.members')}</p>
                                <p className="text-[10px] text-gray-500 truncate whitespace-nowrap">{user?.email}</p>
                            </div>
                        </button>

                        {/* Navigation */}
                        <nav className="flex-1 py-2 px-1.5 space-y-0.5">
                            {/* Item Ativo - Início */}
                            <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gradient-to-r from-blue-500/20 to-[#252941]/20 text-blue-400 font-medium border border-blue-500/30">
                                <Home size={16} className="flex-shrink-0 text-blue-400" />
                                <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">{t('common.home')}</span>
                            </button>

                            {/* Support - configurable */}
                            {product?.support_enabled && (
                                <a
                                    href={product.support_url || '#'}
                                    target={product.support_url ? "_blank" : undefined}
                                    rel="noopener noreferrer"
                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-gray-400 hover:bg-[#1a1d2e] hover:text-gray-200 transition-colors"
                                >
                                    <MessageCircle size={16} className="flex-shrink-0 text-gray-500" />
                                    <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">{product.support_label || t('community.support')}</span>
                                </a>
                            )}

                            {/* Refund - configurable */}
                            {product?.refund_enabled && (
                                <a
                                    href={product.refund_url || '#'}
                                    target={product.refund_url ? "_blank" : undefined}
                                    rel="noopener noreferrer"
                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-gray-400 hover:bg-[#1a1d2e] hover:text-gray-200 transition-colors"
                                >
                                    <RotateCcw size={16} className="flex-shrink-0 text-gray-500" />
                                    <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">{product.refund_label || t('community.refund')}</span>
                                </a>
                            )}
                        </nav>

                        {/* User Section - at bottom */}
                        <div className="border-t border-[#1e2139] p-2">
                            {/* User Avatar and Info */}
                            <button
                                onClick={openProfileModal}
                                className="w-full flex items-center gap-2 px-1 py-1.5 rounded-lg hover:bg-[#1a1d2e] transition-colors mb-1"
                            >
                                <div className="w-8 h-8 rounded-full bg-[#252941] flex items-center justify-center overflow-hidden flex-shrink-0 border border-[#1e2139]">
                                    {user?.avatar_url ? (
                                        <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <User size={14} className="text-gray-500" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0 text-left opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                    <p className="text-xs font-medium text-gray-200 truncate whitespace-nowrap">{user?.name || t('community.members')}</p>
                                    <p className="text-[10px] text-gray-500 truncate whitespace-nowrap">{user?.email}</p>
                                </div>
                            </button>

                            {/* Logout */}
                            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-gray-400 hover:bg-[#1a1d2e] hover:text-gray-200 transition-colors cursor-pointer" onClick={handleLogout}>
                                <LogOut size={16} className="flex-shrink-0 text-gray-500" />
                                <span className="text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">{t('community.logout')}</span>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Main Content */}
                <div className="flex-1 min-h-screen lg:ml-16">
                    {/* Mobile Header Bar */}
                    <div className="lg:hidden bg-[#0f1117] border-b border-[#1e2139] p-3 flex items-center justify-between">
                        <button
                            onClick={() => setSidebarCollapsed(false)}
                            className="p-1.5 text-gray-400 hover:text-white"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                        <h1 className="text-blue-400 font-medium text-sm">{product?.name}</h1>
                        <button
                            onClick={handleLogout}
                            className="p-1.5 text-gray-400 hover:text-red-400"
                        >
                            <LogOut size={16} />
                        </button>
                    </div>

                    {/* Header */}
                    <header className="bg-[#0f1117] border-b border-[#1e2139] px-4 sm:px-6 py-3 sm:py-4">
                        <div className="max-w-6xl mx-auto">
                            <h1 className="text-base sm:text-lg font-semibold text-gray-100 mb-0.5">
                                {product?.name || 'Members Area'}
                            </h1>
                            <p className="text-gray-500 text-xs">
                                {t('community.choose_module')}
                            </p>
                        </div>
                    </header>

                    {/* Modules Grid */}
                    <div className="px-4 sm:px-6 py-3 sm:py-4">
                        <div className="max-w-6xl mx-auto">
                            <h2 className="text-xs font-medium text-gray-400 mb-3">
                                {t('community.available_modules')}
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                {allModules.map((module, index) => {
                                    const hasAccess = accessibleModules.includes(module.id)
                                    const isLocked = !hasAccess

                                    return (
                                        <div
                                            key={module.id}
                                            onClick={() => hasAccess ? selectModule(module) : null}
                                            className={`group relative rounded-lg overflow-hidden border transition-all duration-200 ${hasAccess
                                                ? 'cursor-pointer bg-[#1a1d2e] border-[#1e2139] hover:border-blue-500/50'
                                                : 'cursor-not-allowed bg-[#1a1d2e]/50 border-[#1e2139]/50'
                                                }`}
                                        >
                                            {/* Card Image/Icon */}
                                            <div className={`h-24 sm:h-28 relative overflow-hidden bg-[#252941] ${isLocked ? 'opacity-40' : ''}`}>
                                                {module.image_url ? (
                                                    /* Se tem imagem, exibe a imagem */
                                                    <>
                                                        <img
                                                            src={module.image_url}
                                                            alt={module.title}
                                                            className="w-full h-full object-cover"
                                                        />
                                                        <div className="absolute inset-0 bg-gradient-to-t from-[#1a1d2e]/80 via-transparent to-transparent"></div>
                                                    </>
                                                ) : (
                                                    /* Se não tem imagem, mostra ícone */
                                                    <>
                                                        <div className="absolute inset-0 bg-[#252941]"></div>
                                                        <div className="absolute inset-0 flex items-center justify-center">
                                                            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center border border-blue-500/20">
                                                                <Video size={18} className="text-blue-400" />
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                                <div className="absolute top-1.5 right-1.5">
                                                    <span className="bg-blue-500 text-white text-[9px] font-medium px-1.5 py-0.5 rounded">
                                                        {String(index + 1).padStart(2, '0')}
                                                    </span>
                                                </div>

                                                {/* Lock Icon Overlay */}
                                                {isLocked && (
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                                                        <div className="w-12 h-12 bg-gray-800/80 rounded-full flex items-center justify-center backdrop-blur-sm">
                                                            <Lock size={20} className="text-gray-300" />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Card Content */}
                                            <div className={`p-2.5 ${isLocked ? 'opacity-60' : ''}`}>
                                                <h3 className={`text-xs font-medium mb-0.5 transition-colors line-clamp-1 ${hasAccess
                                                    ? 'text-gray-200 group-hover:text-blue-400'
                                                    : 'text-gray-400'
                                                    }`}>
                                                    {module.title}
                                                </h3>
                                                <p className="text-gray-500 text-[10px] mb-1.5">
                                                    {module.lessons.length} {module.lessons.length === 1 ? t('community.lesson') : t('community.lessons')}
                                                </p>
                                                <div className="flex items-center justify-between">
                                                    <span className={`text-[10px] font-medium transition-colors ${hasAccess
                                                        ? 'text-blue-400 group-hover:text-blue-300'
                                                        : 'text-gray-500'
                                                        }`}>
                                                        {isLocked ? t('community.locked') : `${t('community.access')} →`}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Profile Modal */}
                {showProfileModal && profileForm && (
                    <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
                        <div className="bg-[#1a1d2e] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-[#1e2139] relative">
                            {/* Hidden file inputs */}
                            <input
                                type="file"
                                ref={avatarInputRef}
                                onChange={handleAvatarUpload}
                                accept="image/*"
                                className="hidden"
                            />

                            {/* Cover Image */}
                            <div className="h-28 relative bg-gradient-to-r from-blue-600/30 to-purple-600/30">
                                {profileForm.cover_url && (
                                    <img src={profileForm.cover_url} alt="Cover" className="w-full h-full object-cover" />
                                )}
                            </div>

                            {/* Avatar */}
                            <div className="px-6 relative">
                                <div className="-mt-12 relative inline-block">
                                    <div className="w-24 h-24 rounded-full bg-[#252941] border-4 border-[#1a1d2e] flex items-center justify-center overflow-hidden">
                                        {uploadingAvatar ? (
                                            <div className="animate-pulse text-blue-400">
                                                <Camera size={32} />
                                            </div>
                                        ) : profileForm.avatar_url ? (
                                            <img src={profileForm.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                        ) : (
                                            <User size={40} className="text-gray-500" />
                                        )}
                                    </div>
                                    <button
                                        onClick={() => avatarInputRef.current?.click()}
                                        disabled={uploadingAvatar}
                                        className="absolute bottom-0 right-0 w-7 h-7 bg-[#252941] hover:bg-[#2d3349] disabled:bg-[#252941]/50 rounded-full flex items-center justify-center border border-[#1e2139] transition-colors"
                                    >
                                        <Camera size={12} className="text-gray-400" />
                                    </button>
                                </div>
                                <p className="text-[10px] text-gray-500 mt-2">Profile Photo: 200x200 pixels | Cover Photo: 700x430 pixels</p>
                            </div>

                            {/* Form */}
                            <div className="p-6 overflow-y-auto max-h-[calc(90vh-220px)]">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-blue-400 mb-1 block">Name</label>
                                        <input
                                            type="text"
                                            value={profileForm.name || ''}
                                            onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                                            className="w-full bg-[#252941] border border-[#1e2139] rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
                                            placeholder="Your name"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-blue-400 mb-1 block">Last Name</label>
                                        <input
                                            type="text"
                                            value={profileForm.lastName || ''}
                                            onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                                            className="w-full bg-[#252941] border border-[#1e2139] rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
                                            placeholder="Last name"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-blue-400 mb-1 block">Username</label>
                                        <input
                                            type="text"
                                            value={profileForm.email || ''}
                                            onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                                            className="w-full bg-[#252941] border border-[#1e2139] rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
                                            placeholder="Email or username"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-blue-400 mb-1 block">Phone Number</label>
                                        <input
                                            type="text"
                                            value={profileForm.phone || ''}
                                            onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                                            className="w-full bg-[#252941] border border-[#1e2139] rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
                                            placeholder="Phone number"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-blue-400 mb-1 block">Skill/Occupation</label>
                                        <input
                                            type="text"
                                            value={profileForm.occupation || ''}
                                            onChange={(e) => setProfileForm({ ...profileForm, occupation: e.target.value })}
                                            className="w-full bg-[#252941] border border-[#1e2139] rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
                                            placeholder="e.g. UX Designer"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-blue-400 mb-1 block">Timezone</label>
                                        <select
                                            value={profileForm.timezone || ''}
                                            onChange={(e) => setProfileForm({ ...profileForm, timezone: e.target.value })}
                                            className="w-full bg-[#252941] border border-[#1e2139] rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
                                        >
                                            <option value="">Select timezone</option>
                                            <option value="America/New_York">New York (EST)</option>
                                            <option value="America/Los_Angeles">Los Angeles (PST)</option>
                                            <option value="America/Chicago">Chicago (CST)</option>
                                            <option value="America/Sao_Paulo">São Paulo (BRT)</option>
                                            <option value="Europe/London">London (GMT)</option>
                                            <option value="Europe/Paris">Paris (CET)</option>
                                            <option value="Asia/Tokyo">Tokyo (JST)</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="mt-4">
                                    <label className="text-xs text-blue-400 mb-1 block">Bio</label>
                                    <textarea
                                        value={profileForm.bio || ''}
                                        onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                                        rows={3}
                                        className="w-full bg-[#252941] border border-[#1e2139] rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none resize-none"
                                        placeholder="Tell us about yourself..."
                                    />
                                </div>

                                {/* Display Name Section */}
                                <div className="mt-4 pt-4 border-t border-[#1e2139]">
                                    <label className="text-xs text-blue-400 mb-1 block">Display Name Publicly As</label>
                                    <select
                                        className="w-full bg-[#252941] border border-[#1e2139] rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
                                    >
                                        <option>{profileForm.name} {profileForm.lastName}</option>
                                        <option>{profileForm.name}</option>
                                        <option>{profileForm.email}</option>
                                    </select>
                                    <p className="text-[10px] text-gray-500 mt-2">
                                        The displayed name is shown in all public fields, such as author name, instructor name, student name, and the name printed on the certificate.
                                    </p>
                                </div>

                                {/* Action Buttons */}
                                <div className="mt-6 flex items-center justify-between">
                                    <button
                                        onClick={() => setShowProfileModal(false)}
                                        className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSaveProfile}
                                        disabled={savingProfile}
                                        className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                    >
                                        {savingProfile ? 'Saving...' : 'Update Profile'}
                                    </button>
                                </div>
                            </div>

                            {/* Close Button */}
                            <button
                                onClick={() => setShowProfileModal(false)}
                                className="absolute top-4 left-4 p-1.5 text-gray-400 hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    // Render lessons view (improved layout)
    // If we got here, currentModule is not null (already checked above)
    if (!currentModule) return null

    return (
        <div className="min-h-screen bg-[#0f1117] flex flex-col">
            {/* Top Bar */}
            <header className="h-12 bg-[#1a1d2e] border-b border-[#1e2139] flex items-center justify-between px-3 sm:px-4">
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    <button
                        onClick={backToModules}
                        className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-xs flex-shrink-0"
                    >
                        <ChevronLeft size={16} />
                        <span className="hidden sm:inline">{t('community.back_to_modules')}</span>
                        <span className="sm:hidden">{t('common.back')}</span>
                    </button>
                    {product && currentModule && (
                        <span className="text-gray-500 text-xs truncate">
                            <span className="text-gray-300 hidden sm:inline">{product.name}</span>
                            <span className="mx-1.5 hidden sm:inline">/</span>
                            <span className="text-blue-400">{currentModule.title}</span>
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                    <div className="text-right hidden lg:block">
                        <p className="text-[10px] text-gray-500">Hello,</p>
                        <p className="text-gray-200 text-xs font-medium">{user?.name.split(' ')[0]}</p>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="p-1.5 text-gray-400 hover:text-red-400 transition-colors flex-shrink-0"
                        title="Logout"
                    >
                        <LogOut size={16} />
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Mobile overlay */}
                {!sidebarCollapsed && (
                    <div
                        className="fixed inset-0 bg-black/50 z-20 lg:hidden"
                        onClick={() => setSidebarCollapsed(true)}
                    />
                )}

                {/* Content Area */}
                <div className="flex-1 flex flex-col">
                    {/* Content Area - renders according to lesson type */}
                    <div className="flex-1 relative bg-black flex items-center justify-center overflow-auto">
                        {!currentLesson ? (
                            /* No lesson selected */
                            <div className="text-center text-gray-500">
                                <Play size={64} className="mx-auto mb-4 opacity-30" />
                                <p className="text-lg font-medium text-gray-400">
                                    {hasLessons ? t('community.select_lesson') : t('community.no_lessons')}
                                </p>
                                <p className="text-sm text-gray-600 mt-2">
                                    {hasLessons ? t('community.click_lesson') : t('community.content_preparing')}
                                </p>
                            </div>
                        ) : currentLesson.type === 'video' ? (
                            /* === TYPE: VIDEO === */
                            currentLesson.video_script ? (
                                /* Video via script/embed (embedded iframe) */
                                <div
                                    className="w-full h-full flex items-center justify-center [&>iframe]:w-full [&>iframe]:h-full"
                                    dangerouslySetInnerHTML={{ __html: currentLesson.video_script }}
                                />
                            ) : currentLesson.video_url ? (
                                /* Video via direct URL */
                                <iframe
                                    src={toEmbedUrl(currentLesson.video_url)}
                                    className="w-full h-full"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                />
                            ) : (
                                <div className="text-center text-gray-500">
                                    <Play size={64} className="mx-auto mb-4 opacity-30" />
                                    <p className="text-gray-400">No video configured for this lesson</p>
                                </div>
                            )
                        ) : currentLesson.type === 'pdf' ? (
                            /* === TYPE: PDF === */
                            currentLesson.pdf_url ? (
                                <iframe
                                    src={currentLesson.pdf_url}
                                    className="w-full h-full"
                                    title="PDF Viewer"
                                />
                            ) : (
                                <div className="text-center text-gray-500">
                                    <FileText size={64} className="mx-auto mb-4 opacity-30" />
                                    <p className="text-gray-400">No PDF configured for this lesson</p>
                                </div>
                            )
                        ) : currentLesson.type === 'article' ? (
                            /* === TYPE: ARTICLE/TEXT === */
                            currentLesson.content ? (
                                <div className="w-full h-full overflow-y-auto">
                                    <div className="max-w-3xl mx-auto p-8">
                                        <h1 className="text-2xl font-bold text-gray-100 mb-4">{currentLesson.title}</h1>
                                        {currentLesson.description && (
                                            <div
                                                className="text-gray-400 text-sm mb-6 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&>a]:text-blue-400 [&>a]:underline"
                                                dangerouslySetInnerHTML={{ __html: currentLesson.description }}
                                            />
                                        )}
                                        <div
                                            className="prose prose-invert prose-sm max-w-none text-gray-300 leading-relaxed
                                                [&>p]:mb-4 [&>h2]:text-xl [&>h2]:font-semibold [&>h2]:text-gray-100 [&>h2]:mt-8 [&>h2]:mb-4
                                                [&>h3]:text-lg [&>h3]:font-medium [&>h3]:text-gray-200 [&>h3]:mt-6 [&>h3]:mb-3
                                                [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:mb-4 [&>ol]:list-decimal [&>ol]:pl-6 [&>ol]:mb-4
                                                [&>blockquote]:border-l-4 [&>blockquote]:border-blue-500 [&>blockquote]:pl-4 [&>blockquote]:italic [&>blockquote]:text-gray-400
                                                [&>pre]:bg-[#252941] [&>pre]:p-4 [&>pre]:rounded-lg [&>pre]:overflow-x-auto
                                                [&>a]:text-blue-400 [&>a]:underline"
                                            dangerouslySetInnerHTML={{ __html: currentLesson.content }}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center text-gray-500">
                                    <BookOpen size={64} className="mx-auto mb-4 opacity-30" />
                                    <p className="text-gray-400">No text content for this lesson</p>
                                </div>
                            )
                        ) : (
                            /* Fallback - unknown type: try to display any available content */
                            <div className="text-center text-gray-500">
                                {currentLesson.video_url ? (
                                    <iframe
                                        src={toEmbedUrl(currentLesson.video_url)}
                                        className="w-full h-full absolute inset-0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    />
                                ) : currentLesson.pdf_url ? (
                                    <iframe
                                        src={currentLesson.pdf_url}
                                        className="w-full h-full absolute inset-0"
                                        title="PDF Viewer"
                                    />
                                ) : (
                                    <>
                                        <Play size={64} className="mx-auto mb-4 opacity-30" />
                                        <p className="text-gray-400">Content not available</p>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Lesson navigation */}
                    {hasLessons && currentModule && currentModule.lessons.length > 1 && (
                        <div className="bg-[#1a1d2e] border-t border-[#1e2139] px-3 sm:px-4 lg:px-6 py-2 sm:py-3">
                            <div className="flex flex-col sm:flex-row justify-between items-center max-w-4xl mx-auto gap-2 sm:gap-0">
                                <button
                                    onClick={handlePrevLesson}
                                    disabled={currentLessonIndex === 0}
                                    className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-[#252941] hover:bg-[#2d3147] disabled:opacity-40 disabled:cursor-not-allowed text-gray-200 rounded-lg border border-[#1e2139] hover:border-blue-500/50 transition-all duration-200 group w-full sm:w-auto justify-center sm:justify-start text-xs"
                                >
                                    <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-[-2px] transition-transform" />
                                    <span className="font-medium">{t('community.previous_lesson')}</span>
                                </button>

                                <div className="text-center order-first sm:order-none w-full sm:w-auto">
                                    <div className="text-[10px] text-gray-400 mb-0.5 hidden sm:block">{t('community.progress')}</div>
                                    <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                                        <span className="text-[10px] sm:text-xs text-gray-300 bg-[#0f1117] px-1.5 sm:px-2 py-0.5 rounded-full border border-[#1e2139]">
                                            {currentLessonIndex + 1} of {currentModule.lessons.length}
                                        </span>
                                        <div className="w-16 sm:w-24 h-1.5 bg-[#0f1117] rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-blue-500 transition-all duration-500"
                                                style={{
                                                    width: `${((currentLessonIndex + 1) / currentModule.lessons.length) * 100}%`
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={handleNextLesson}
                                    disabled={currentLessonIndex >= currentModule.lessons.length - 1}
                                    className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-200 group disabled:bg-gray-600 w-full sm:w-auto justify-center sm:justify-start text-xs"
                                >
                                    <span className="font-medium">{t('community.next_lesson')}</span>
                                    <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-[2px] transition-transform" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Controls Bar */}
                    {hasLessons && currentLesson && (
                        <div className="bg-[#1a1d2e] border-t border-[#1e2139] p-3">
                            <div className="max-w-5xl mx-auto">
                                <h2 className="text-gray-100 text-sm font-semibold mb-3">
                                    {currentLesson.title}
                                </h2>

                                <div className="flex items-center justify-between">
                                    <button
                                        onClick={handlePrevLesson}
                                        disabled={currentLessonIndex === 0}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#252941] text-gray-300 rounded-lg hover:bg-[#1e2139] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                                    >
                                        <ChevronLeft size={14} />
                                        <span className="hidden md:inline">{t('community.previous_lesson')}</span>
                                    </button>

                                    <button
                                        onClick={markAsCompleted}
                                        className={`px-4 py-1.5 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-colors ${currentLesson.completed
                                            ? 'bg-green-600/20 text-green-400 border border-green-500/30'
                                            : 'bg-green-600 text-white hover:bg-green-700'
                                            }`}
                                    >
                                        <CheckCircle2 size={14} />
                                        {currentLesson.completed ? t('community.completed') : t('community.mark_completed')}
                                    </button>

                                    <button
                                        onClick={handleNextLesson}
                                        disabled={
                                            currentLessonIndex === currentModule.lessons.length - 1 ||
                                            currentModule.lessons[currentLessonIndex + 1]?.locked
                                        }
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                                    >
                                        <span className="hidden md:inline">{t('community.next_lesson')}</span>
                                        <ChevronRight size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar - Modules & Lessons */}
                <aside
                    className={`bg-[#1a1d2e] border-l border-[#1e2139] transition-all duration-300 ${sidebarCollapsed ? '-translate-x-full lg:translate-x-0 lg:w-0' : 'translate-x-0 lg:w-80'
                        } w-72 overflow-hidden fixed lg:relative right-0 top-0 h-full z-30`}
                >
                    <div className="h-full flex flex-col">
                        {/* Mobile Header */}
                        <div className="lg:hidden p-2.5 border-b border-[#1e2139] flex justify-between items-center">
                            <h3 className="text-white font-medium text-xs">{t('community.lesson_list')}</h3>
                            <button
                                onClick={() => setSidebarCollapsed(true)}
                                className="p-1 text-gray-400 hover:text-white"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>

                        {/* Sidebar Header */}
                        <div className="p-3 border-b border-[#1e2139]">
                            <div className="flex items-center justify-between mb-0.5">
                                <h3 className="text-gray-100 font-medium text-xs">
                                    {currentModule.title}
                                </h3>
                                <button
                                    onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                                    className="p-1 text-gray-400 hover:text-white transition-colors lg:hidden"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                            {hasLessons && (
                                <p className="text-[10px] text-gray-500">
                                    {currentModule.lessons.filter(l => l.completed).length} {t('community.of')} {currentModule.lessons.length} {t('community.lessons_completed')}
                                </p>
                            )}
                        </div>

                        {/* Lessons List */}
                        <div className="flex-1 overflow-y-auto">
                            <div className="p-1.5">
                                {hasLessons ? (
                                    currentModule.lessons.map((lesson, index) => (
                                        <button
                                            key={lesson.id}
                                            onClick={() => handleLessonClick(index)}
                                            disabled={lesson.locked}
                                            className={`w-full text-left p-2 rounded-lg mb-1 transition-all ${currentLessonIndex === index
                                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                                : lesson.locked
                                                    ? 'bg-[#252941]/50 text-gray-600 cursor-not-allowed'
                                                    : 'bg-[#252941] text-gray-300 hover:bg-[#1e2139]'
                                                }`}
                                        >
                                            <div className="flex items-start gap-2">
                                                <div className="mt-0.5 flex-shrink-0">
                                                    {lesson.completed ? (
                                                        <CheckCircle2 size={14} className="text-green-400" />
                                                    ) : lesson.locked ? (
                                                        <Lock size={14} className="text-gray-600" />
                                                    ) : currentLessonIndex === index ? (
                                                        <Play size={14} fill="currentColor" />
                                                    ) : (
                                                        <Circle size={14} />
                                                    )}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <h4 className="text-xs font-medium mb-0.5">
                                                        {lesson.title}
                                                    </h4>
                                                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                                                        {lesson.type === 'video' && <Video size={10} />}
                                                        {lesson.type === 'pdf' && <FileText size={10} />}
                                                        {lesson.type === 'article' && <BookOpen size={10} />}
                                                        <span>{lesson.duration}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    ))
                                ) : (
                                    <div className="text-center py-6">
                                        <BookOpen size={20} className="mx-auto mb-1.5 text-gray-600" />
                                        <p className="text-xs text-gray-500">{t('community.no_lessons')}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Progress Bar */}
                        {hasLessons && (
                            <div className="p-3 border-t border-[#1e2139]">
                                <div className="mb-1.5 flex justify-between text-[10px] text-gray-500">
                                    <span>{t('community.progress')}</span>
                                    <span>
                                        {Math.round((currentModule.lessons.filter(l => l.completed).length / currentModule.lessons.length) * 100)}%
                                    </span>
                                </div>
                                <div className="h-1 bg-[#252941] rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500 transition-all duration-500 rounded-full"
                                        style={{
                                            width: `${(currentModule.lessons.filter(l => l.completed).length / currentModule.lessons.length) * 100}%`
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </aside>

                {/* Toggle Sidebar Button (Mobile/Collapsed) */}
                {sidebarCollapsed && (
                    <button
                        onClick={() => setSidebarCollapsed(false)}
                        className="fixed right-4 top-16 z-50 p-2 bg-blue-500 text-white rounded-lg shadow-xl hover:bg-blue-600 transition-all lg:hidden"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                )}
            </div>
        </div>
    )
}
