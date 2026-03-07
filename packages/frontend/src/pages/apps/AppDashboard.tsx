import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, Play, FileText, Download, Users, Lock, ArrowRight, Home, MessageSquare, User, Heart, Send, Plus, Camera, Bell, X, RotateCcw, CheckCircle } from 'lucide-react'
import { useI18n, tForLang } from '@/i18n'
import { useAuthStore } from '@/stores/authStore'
import { supabase, supabaseFetch, supabaseRestFetch } from '@/services/supabase'

interface App {
  id: string
  name: string
  slug: string
  language?: string
  primary_color: string
  secondary_color: string
  logo_url?: string
  show_names?: boolean
  highlight_community?: boolean
  theme?: 'light' | 'dark'
  support_enabled?: boolean
  support_email?: string
  whatsapp_number?: string
}

interface Product {
  id: string
  name: string
  description?: string
  cover_url?: string
  logo_url?: string
  price: string
  access_type: string
  has_access?: boolean
}

interface Banner {
  id: string
  image_url: string
  link_url?: string
  order: number
}

interface Post {
  id: string
  application_id: string
  author_name: string
  author_avatar?: string
  content: string
  image_url?: string
  created_at: string
  is_pinned: boolean
  likes_count: number
  comments_count: number
}

interface Comment {
  id: string
  post_id: string
  author_name: string
  author_avatar?: string
  content: string
  created_at: string
}

export default function AppDashboard() {
  const { appId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialTab = searchParams.get('tab') || 'inicio'
  const [app, setApp] = useState<App | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(initialTab)
  const [error, setError] = useState('')
  const { t } = useI18n()

  // Community states
  const [posts, setPosts] = useState<Post[]>([])
  const [loadingPosts, setLoadingPosts] = useState(false)
  const [selectedPost, setSelectedPost] = useState<string | null>(null)
  const [comments, setComments] = useState<{ [key: string]: Comment[] }>({})
  const [newComment, setNewComment] = useState<{ [key: string]: string }>({})
  const [showCreatePost, setShowCreatePost] = useState(false)
  const [newPostContent, setNewPostContent] = useState('')

  // Feed states
  const [feedPosts, setFeedPosts] = useState<any[]>([])
  const [loadingFeed, setLoadingFeed] = useState(false)

  // Notification states
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  // Refund request states
  const [showRefundModal, setShowRefundModal] = useState(false)
  const [refundReason, setRefundReason] = useState('')
  const [refundSubmitting, setRefundSubmitting] = useState(false)
  const [refundDone, setRefundDone] = useState(false)

  // Profile states
  const [userProfile, setUserProfile] = useState<any>(null)
  const [userName, setUserName] = useState('')
  const [userAvatar, setUserAvatar] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const { user: authUser } = useAuthStore()

  const [currentUser] = useState(() => {
    // Tentar obter os dados do usuário do localStorage
    const userDataStr = localStorage.getItem('user_data')
    let userData = null

    if (userDataStr) {
      try {
        userData = JSON.parse(userDataStr)
      } catch (e) {
        console.error('Error parsing user_data:', e)
      }
    }

    // Usar o email do userData, authStore ou localStorage
    const email = userData?.email || authUser?.email || localStorage.getItem('userEmail') || ''
    const name = userData?.name || authUser?.user_metadata?.name || 'Usuário'
    const id = userData?.id || authUser?.id || 'anonymous'

    return {
      name,
      email,
      id
    }
  })

  useEffect(() => {
    if (appId) {
      fetchAppData()
      fetchUserProfile() // Carregar perfil ao iniciar
      fetchNotifications() // Carregar notificações ao iniciar
    }
  }, [appId])

  useEffect(() => {
    if (activeTab === 'comunidade' && appId) {
      fetchPosts()
    }
    if (activeTab === 'feed' && appId) {
      fetchFeedPosts()
    }
  }, [activeTab, appId])

  useEffect(() => {
    if (selectedPost) {
      fetchComments(selectedPost)
    }
  }, [selectedPost])

  const fetchAppData = async () => {
    try {
      setLoading(true)

      // Buscar dados do app
      const appResponse = await supabaseFetch(`applications/${appId}`)
      if (appResponse.ok) {
        const appData = await appResponse.json()
        setApp(appData)
      }

      // Buscar produtos do app com controle de acesso
      // Primeiro, tentar obter o usuário autenticado via Supabase Auth
      const { data: { user: authUserData } } = await supabase.auth.getUser()

      // Fallback para localStorage se não estiver autenticado
      let userId = authUserData?.id
      let userEmail = authUserData?.email || ''

      if (!userId) {
        const userData = localStorage.getItem('user_data')
        if (userData) {
          try {
            const parsedData = JSON.parse(userData)
            userEmail = parsedData.email || ''
            userId = parsedData.id || ''
          } catch (e) {
            console.error('Error parsing user_data:', e)
          }
        }
      }

      // Buscar todos os produtos primeiro
      const productsResponse = await supabaseFetch(`applications/${appId}/products`)

      if (productsResponse.ok) {
        const allProducts = await productsResponse.json()

        if (userId) {
          // Usuário autenticado - buscar acessos diretamente pelo user_id (auth.uid)
          // RLS vai verificar automaticamente que user_id = auth.uid()
          const accessResponse = await supabaseRestFetch(`user_product_access?user_id=eq.${userId}&application_id=eq.${appId}&select=product_id`)

          if (accessResponse.ok) {
            const accessData = await accessResponse.json()
            const allowedProductIds = accessData.map((a: any) => a.product_id)

            // Marcar produtos com has_access
            const productsWithAccess = allProducts.map((p: Product) => ({
              ...p,
              has_access: allowedProductIds.includes(p.id)
            }))
            setProducts(productsWithAccess)
          } else {
            // Se falhou ao buscar acesso, tentar fallback via email
            if (userEmail) {
              const userResponse = await supabaseRestFetch(`app_users?email=eq.${userEmail}&application_id=eq.${appId}&select=user_id`)
              if (userResponse.ok) {
                const userDataResponse = await userResponse.json()
                if (userDataResponse && userDataResponse.length > 0) {
                  const appUserId = userDataResponse[0].user_id
                  if (appUserId) {
                    const accessResponse2 = await supabaseRestFetch(`user_product_access?user_id=eq.${appUserId}&application_id=eq.${appId}&select=product_id`)
                    if (accessResponse2.ok) {
                      const accessData2 = await accessResponse2.json()
                      const allowedProductIds2 = accessData2.map((a: any) => a.product_id)
                      setProducts(allProducts.map((p: Product) => ({
                        ...p,
                        has_access: allowedProductIds2.includes(p.id)
                      })))
                    } else {
                      setProducts(allProducts.map((p: Product) => ({ ...p, has_access: false })))
                    }
                  } else {
                    setProducts(allProducts.map((p: Product) => ({ ...p, has_access: false })))
                  }
                } else {
                  setProducts(allProducts.map((p: Product) => ({ ...p, has_access: false })))
                }
              } else {
                setProducts(allProducts.map((p: Product) => ({ ...p, has_access: false })))
              }
            } else {
              setProducts(allProducts.map((p: Product) => ({ ...p, has_access: false })))
            }
          }
        } else {
          // Sem usuário autenticado, marcar todos como bloqueados
          setProducts(allProducts.map((p: Product) => ({ ...p, has_access: false })))
        }
      }

      // Buscar banners do app
      const bannersResponse = await supabaseFetch(`applications/${appId}/banners`)
      if (bannersResponse.ok) {
        const bannersData = await bannersResponse.json()
        setBanners(bannersData.sort((a: Banner, b: Banner) => a.order - b.order))
      }
    } catch (error) {
      console.error('Error fetching app data:', error)
      setError(t('apps.error_loading'))
    } finally {
      setLoading(false)
    }
  }

  const getAccessTypeLabel = (type: string) => {
    switch (type) {
      case 'email-only': return t('apps.free_access')
      case 'email-password': return t('apps.login_required')
      case 'purchase-code': return t('apps.purchase_code_required')
      default: return t('apps.access_available')
    }
  }

  const getProductIcon = (index: number) => {
    const icons = [Play, FileText, Download, Eye]
    const IconComponent = icons[index % icons.length]
    return IconComponent
  }

  // Notification functions
  const fetchNotifications = async () => {
    try {
      const userData = localStorage.getItem('user_data')
      if (!userData) return

      const user = JSON.parse(userData)
      const response = await supabaseFetch(`applications/${appId}/notifications`, {
        headers: {
          'x-user-email': user.email
        }
      })

      if (response.ok) {
        const data = await response.json()
        setNotifications(data)
        const unread = data.filter((n: any) => !n.read).length
        setUnreadCount(unread)
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    }
  }

  const markNotificationsAsRead = async () => {
    try {
      const userData = localStorage.getItem('user_data')
      if (!userData) return

      const user = JSON.parse(userData)
      const response = await supabaseFetch(`applications/${appId}/notifications/mark-read`, {
        method: 'PUT'
      })

      if (response.ok) {
        setUnreadCount(0)
        // Atualizar as notificações localmente
        setNotifications(notifications.map(n => ({ ...n, read: true })))
      }
    } catch (error) {
      console.error('Error marking notifications as read:', error)
    }
  }
  const fetchPosts = async () => {
    try {
      setLoadingPosts(true)

      const response = await supabaseFetch(`applications/${appId}/community/posts`)


      if (response.ok) {
        const data = await response.json()

        setPosts(data)
      }
    } catch (error) {
      console.error('Error fetching posts:', error)
    } finally {
      setLoadingPosts(false)
    }
  }

  // Feed functions
  const fetchFeedPosts = async () => {
    try {
      setLoadingFeed(true)
      const response = await supabaseFetch(`applications/${appId}/feed/posts?status=published`)

      if (response.ok) {
        const data = await response.json()
        setFeedPosts(data)
      }
    } catch (error) {
      console.error('Error fetching feed posts:', error)
    } finally {
      setLoadingFeed(false)
    }
  }

  // Profile functions
  const fetchUserProfile = async () => {
    try {
      const response = await supabaseFetch(`applications/${appId}/user/profile`, {
        headers: {
          'x-user-email': currentUser.email
        }
      })

      if (response.ok) {
        const data = await response.json()
        setUserProfile(data)
        setUserName(data.full_name || currentUser.name)
        setUserAvatar(data.avatar_url || '')
      }
    } catch (error) {
      console.error('Error fetching user profile:', error)
      setUserName(currentUser.name)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      alert(t('apps.image_invalid'))
      return
    }

    // Validar tamanho (2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert(t('apps.image_too_large'))
      return
    }

    try {
      setUploadingAvatar(true)

      // Redimensionar e comprimir a imagem
      const reader = new FileReader()
      reader.onload = (event) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const maxSize = 200 // tamanho máximo
          let width = img.width
          let height = img.height

          if (width > height) {
            if (width > maxSize) {
              height *= maxSize / width
              width = maxSize
            }
          } else {
            if (height > maxSize) {
              width *= maxSize / height
              height = maxSize
            }
          }

          canvas.width = width
          canvas.height = height

          const ctx = canvas.getContext('2d')
          ctx?.drawImage(img, 0, 0, width, height)

          // Comprimir para JPEG com qualidade 0.7
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7)
          setUserAvatar(compressedBase64)
          setUploadingAvatar(false)
        }
        img.src = event.target?.result as string
      }
      reader.readAsDataURL(file)
    } catch (error) {
      console.error('Error uploading avatar:', error)
      alert(t('apps.error_uploading_photo'))
      setUploadingAvatar(false)
    }
  }

  const saveUserProfile = async () => {
    try {
      setSavingProfile(true)

      const bodyData = {
        full_name: userName,
        avatar_url: userAvatar
      }



      const response = await supabaseFetch(`applications/${appId}/user/profile`, {
        method: 'PUT',
        body: JSON.stringify(bodyData),
        headers: {
          'x-user-email': currentUser.email
        }
      })



      if (response.ok) {
        const data = await response.json()

        setUserProfile(data)
        alert(t('apps.profile_saved'))
      } else {
        let errorMessage = 'Unknown error'
        try {
          const errorData = await response.json()
          console.error('Error response:', errorData)
          errorMessage = errorData.error || errorMessage
        } catch (e) {
          const textResponse = await response.text()
          console.error('Error response (text):', textResponse)
          errorMessage = textResponse || errorMessage
        }
        alert(`${t('apps.error_saving_profile')}: ${errorMessage}`)
      }
    } catch (error) {
      console.error('Error saving profile:', error)
      if (error instanceof Error) {
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        })
      }
      alert(t('apps.error_saving_profile'))
    } finally {
      setSavingProfile(false)
    }
  }

  const fetchComments = async (postId: string) => {
    try {
      const response = await supabaseFetch(`applications/community/posts/${postId}/comments`)
      if (response.ok) {
        const data = await response.json()
        setComments(prev => ({ ...prev, [postId]: data }))
      }
    } catch (error) {
      console.error('Error fetching comments:', error)
    }
  }

  const handleCreatePost = async () => {
    if (!newPostContent.trim()) return

    try {
      const response = await supabaseFetch(`applications/${appId}/community/posts`, {
        method: 'POST',
        body: JSON.stringify({
          author_name: userName || currentUser.name,
          author_avatar: userAvatar || undefined,
          content: newPostContent
        })
      })

      if (response.ok) {
        setNewPostContent('')
        setShowCreatePost(false)
        fetchPosts()
      }
    } catch (error) {
      console.error('Error creating post:', error)
    }
  }

  const toggleLike = async (postId: string) => {
    try {
      setPosts(prev => prev.map(post =>
        post.id === postId
          ? { ...post, likes_count: post.likes_count + 1 }
          : post
      ))

      await supabaseFetch(`applications/community/posts/${postId}/like`, {
        method: 'POST'
      })
    } catch (error) {
      console.error('Error liking post:', error)
      fetchPosts()
    }
  }

  const handleAddComment = async (postId: string) => {
    const content = newComment[postId]?.trim()
    if (!content) return

    try {
      const response = await supabaseFetch(`applications/community/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          author_name: userName || currentUser.name,
          author_avatar: userAvatar || undefined,
          content
        })
      })

      if (response.ok) {
        setNewComment(prev => ({ ...prev, [postId]: '' }))
        fetchComments(postId)
        fetchPosts()
      }
    } catch (error) {
      console.error('Error adding comment:', error)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)

    if (diffDays === 0) {
      if (diffHours === 0) return 'Agora'
      return `${diffHours}h`
    } else if (diffDays === 1) {
      return '1d'
    } else if (diffDays < 7) {
      return `${diffDays}d`
    } else {
      return date.toLocaleDateString('pt-BR', {
        day: 'numeric',
        month: 'short'
      })
    }
  }

  const renderContent = (content: string) => {
    const lines = content.split('\n')
    return lines.map((line, index) => (
      <span key={index}>
        {line}
        {index < lines.length - 1 && <br />}
      </span>
    ))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>{t('apps.loading_app')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-[#1a1d2e] rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-100 mb-2">{t('apps.error_loading')}</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${app?.theme === 'dark' ? 'bg-gradient-to-br from-[#050608] via-[#0a0d14] via-30% via-[#0f1520] via-60% to-[#1a4a6c]' : 'bg-gradient-to-br from-[#0a0d14] via-[#0f1520] to-[#1a3050]'}`}>
      {/* Header com Logo e Notificações */}
      <div className={`${app?.theme === 'dark' ? 'bg-gray-900/80 border-gray-700/50' : 'bg-[#0f1520]/80 border-[#1e2139]/50'} backdrop-blur-md shadow-lg sticky top-0 z-40 border-b`}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {app?.logo_url && (
              <img src={app.logo_url} alt={app.name} className="w-10 h-10 rounded-lg object-cover" />
            )}
            <h1 className={`text-xl font-bold ${app?.theme === 'dark' ? 'text-white' : 'text-gray-100'}`}>{app?.name}</h1>
          </div>

          <div className="flex items-center gap-1">
            {/* Botão de Reembolso */}
            <button
              onClick={() => { setRefundDone(false); setRefundReason(''); setShowRefundModal(true) }}
              className={`p-2 ${app?.theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-[#252941]'} rounded-lg transition-colors`}
              title="Solicitar reembolso"
            >
              <RotateCcw className="w-5 h-5 text-gray-400" />
            </button>

            {/* Botão de Notificações */}
            <button
              onClick={() => {
                setShowNotifications(true)
                markNotificationsAsRead()
              }}
              className={`relative p-2 ${app?.theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-[#252941]'} rounded-lg transition-colors`}
            >
              <Bell className={`w-6 h-6 ${app?.theme === 'dark' ? 'text-gray-300' : 'text-gray-300'}`} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Banner de Imagem no Topo */}
      {banners.length > 0 && (
        <div className="w-full h-32 sm:h-40 md:h-48 lg:h-64 overflow-hidden relative">
          <img
            src={banners[0].image_url}
            alt="Banner"
            className="w-full h-full object-cover"
            onClick={() => {
              if (banners[0].link_url) {
                window.open(banners[0].link_url, '_blank')
              }
            }}
            style={{ cursor: banners[0].link_url ? 'pointer' : 'default' }}
          />
          {/* Gradient overlay para melhor legibilidade */}
          <div className="absolute inset-0 bg-gradient-to-t from-blue-600/20 to-transparent"></div>
        </div>
      )}

      {/* Conteúdo dos Produtos/Módulos */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 md:py-12 pb-20 sm:pb-24">
        {activeTab === 'inicio' && (
          products.length === 0 ? (
            <div className={`text-center ${app?.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <h2 className="text-xl font-semibold mb-2">{t('apps.no_products_available')}</h2>
              <p className={`${app?.theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>{t('apps.contact_for_info')}</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((product, index) => {
                const isLocked = product.has_access === false
                return (
                  <Link
                    key={product.id}
                    to={isLocked ? '#' : `/app/${appId}/product/${product.id}`}
                    onClick={(e) => {
                      if (isLocked) {
                        e.preventDefault()
                        alert(t('apps.product_not_available'))
                      }
                    }}
                    className={`group relative ${app?.theme === 'dark' ? 'bg-gray-800/90 border-gray-700/50' : 'bg-[#1a1d2e]/90 border-[#1e2139]/50'} rounded-xl overflow-hidden ${isLocked ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-xl hover:shadow-blue-500/20'} transition-all duration-300 border backdrop-blur-sm`}
                  >
                    {/* Card Header com Imagem ou Gradiente */}
                    <div className="relative h-24 sm:h-28 overflow-hidden">
                      {product.cover_url || product.logo_url ? (
                        <>
                          <img
                            src={product.cover_url || product.logo_url}
                            alt={product.name}
                            className={`w-full h-full object-cover ${!isLocked && 'group-hover:scale-110'} transition-transform duration-300 ${isLocked && 'filter grayscale'}`}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-blue-600/60 to-transparent"></div>
                        </>
                      ) : (
                        <div className={`w-full h-full bg-gradient-to-br from-[#1a1d2e]0 via-blue-500 to-pink-500 ${!isLocked && 'group-hover:scale-110'} transition-transform duration-300 ${isLocked && 'filter grayscale'}`}></div>
                      )}

                      {/* Cadeado para produtos bloqueados */}
                      {isLocked && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <Lock className="w-10 h-10 text-white" />
                        </div>
                      )}
                    </div>

                    {/* Card Body */}
                    <div className="p-3">
                      {/* Nome do produto */}
                      {app?.show_names !== false && (
                        <h3 className={`text-sm font-semibold ${app?.theme === 'dark' ? 'text-white group-hover:text-blue-400' : 'text-gray-100 group-hover:text-blue-400'} mb-1 transition-colors line-clamp-1 ${isLocked && 'group-hover:text-white'}`}>
                          {product.name}
                        </h3>
                      )}

                      {/* Descrição */}
                      {product.description && (
                        <p className={`${app?.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} text-xs line-clamp-2`}>
                          {product.description}
                        </p>
                      )}

                      {/* Badge de bloqueado */}
                      {isLocked && (
                        <div className="mt-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">
                            <Lock className="w-3 h-3" />
                            {t('common.locked')}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Efeito de brilho no hover */}
                    {!isLocked && (
                      <div className={`absolute inset-0 bg-gradient-to-r from-transparent ${app?.theme === 'dark' ? 'via-white/5' : 'via-white/10'} to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000`}></div>
                    )}
                  </Link>
                )
              })}
            </div>
          )
        )}

        {activeTab === 'feed' && (
          <div className="max-w-2xl mx-auto">
            {loadingFeed ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">{t('common.loading')}</p>
              </div>
            ) : feedPosts.length === 0 ? (
              <div className={`text-center ${app?.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} py-12`}>
                <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h2 className="text-xl font-semibold mb-2">{t('common.feed')}</h2>
                <p className={`${app?.theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>{t('apps.news_and_updates')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {feedPosts.map((post, index) => (
                  <div key={post.id} className={`${app?.theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-[#1a1d2e] border-[#1e2139]'} rounded-lg shadow-xl shadow-black/10 shadow-black/5 border`}>
                    {/* Post Content */}
                    <div className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-[#1a1d2e]0 to-blue-600 rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold text-sm">
                            {app?.name?.charAt(0) || 'A'}
                          </span>
                        </div>
                        <div>
                          <h4 className={`font-semibold ${app?.theme === 'dark' ? 'text-white' : 'text-gray-100'} text-sm`}>{app?.name}</h4>
                          <p className={`text-xs ${app?.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{formatDate(post.created_at)}</p>
                        </div>
                      </div>

                      <div
                        className={`prose prose-sm max-w-none ${app?.theme === 'dark' ? 'text-gray-200' : 'text-gray-100'} mb-3`}
                        dangerouslySetInnerHTML={{ __html: post.content }}
                      />

                      {post.image_url && (() => {
                        try {
                          const imageUrls = JSON.parse(post.image_url)
                          if (Array.isArray(imageUrls) && imageUrls.length > 0) {
                            return (
                              <div className="grid gap-2" style={{
                                gridTemplateColumns: imageUrls.length === 1 ? '1fr' : 'repeat(2, 1fr)'
                              }}>
                                {imageUrls.map((url: string, idx: number) => (
                                  <img
                                    key={idx}
                                    src={url}
                                    alt={`Post image ${idx + 1}`}
                                    className="w-full rounded-lg object-cover"
                                    style={{ maxHeight: '300px' }}
                                  />
                                ))}
                              </div>
                            )
                          }
                        } catch (e) {
                          return (
                            <img
                              src={post.image_url}
                              alt="Post image"
                              className="w-full rounded-lg object-cover"
                              style={{ maxHeight: '300px' }}
                            />
                          )
                        }
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'comunidade' && (
          <div className="max-w-2xl mx-auto">
            {/* Community Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">{t('common.community')}</h2>
                <p className="text-gray-600 dark:text-gray-400 mt-1">{t('apps.connect_share')}</p>
              </div>
              <button
                onClick={() => setShowCreatePost(true)}
                className="w-14 h-14 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-full flex items-center justify-center transition-all shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-105"
              >
                <Plus className="w-6 h-6 text-white" />
              </button>
            </div>

            {/* Create Post Modal */}
            {showCreatePost && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-lg shadow-2xl border border-gray-200 dark:border-gray-700">
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="font-semibold text-xl text-gray-900 dark:text-white">{t('apps.create_post')}</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{t('apps.share_community')}</p>
                  </div>
                  <div className="p-6">
                    <textarea
                      value={newPostContent}
                      onChange={(e) => setNewPostContent(e.target.value)}
                      placeholder={t('apps.what_share')}
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl p-4 min-h-[120px] text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>
                  <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3 justify-end">
                    <button
                      onClick={() => {
                        setShowCreatePost(false)
                        setNewPostContent('')
                      }}
                      className="px-6 py-2.5 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      onClick={handleCreatePost}
                      disabled={!newPostContent.trim()}
                      className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-blue-600 disabled:hover:to-blue-700 shadow-lg shadow-blue-500/25"
                    >
                      {t('apps.post_action')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Posts Feed */}
            {loadingPosts ? (
              <div className="text-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-3 border-blue-600 border-t-transparent mx-auto mb-6"></div>
                <p className="text-gray-600 dark:text-gray-400 font-medium">{t('apps.loading_posts')}</p>
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-16 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/50 dark:to-purple-900/50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Users className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('apps.no_posts')}</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">{t('apps.be_first_post')}</p>
                <button
                  onClick={() => setShowCreatePost(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-medium transition-all shadow-lg shadow-blue-500/25"
                >
                  <Plus className="w-4 h-4" />
                  {t('apps.create_first_post')}
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {posts.map(post => (
                  <div key={post.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-shadow overflow-hidden">
                    {/* Post Header */}
                    <div className="flex items-center gap-3 p-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                        <span className="text-white font-semibold text-base">
                          {post.author_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
                            {post.author_name}
                          </h4>
                          {post.is_pinned && (
                            <span className="bg-gradient-to-r from-blue-100 to-blue-200 dark:from-blue-800 dark:to-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full text-xs font-medium">
                              {t('apps.pinned')}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{formatDate(post.created_at)}</p>
                      </div>
                    </div>

                    {/* Post Content */}
                    <div className="px-6 pb-4">
                      <div className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                        {renderContent(post.content)}
                      </div>
                      {post.image_url && (
                        <div className="mt-3">
                          <img
                            src={post.image_url}
                            alt="Post content"
                            className="w-full rounded-lg object-cover max-h-80"
                            loading="lazy"
                          />
                        </div>
                      )}
                    </div>

                    {/* Post Actions */}
                    <div className={`px-4 py-3 border-t ${app?.theme === 'dark' ? 'border-gray-700' : 'border-gray-50'}`}>
                      <div className="flex items-center gap-6">
                        <button
                          onClick={() => toggleLike(post.id)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-full transition-colors ${app?.theme === 'dark' ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-[#0f1117] text-gray-600 hover:bg-[#252941]'}`}
                        >
                          <Heart className="w-4 h-4" />
                          <span className="text-sm font-medium">{post.likes_count}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'perfil' && (
          <div className="max-w-md mx-auto">
            <div className={`${app?.theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-[#1a1d2e] border-[#1e2139]'} rounded-2xl shadow-xl shadow-black/10 shadow-black/5 border overflow-hidden`}>
              {/* Header do Perfil */}
              <div className="bg-gradient-to-br from-blue-500 to-blue-700 p-8 text-center">
                <div className="relative w-24 h-24 mx-auto mb-4">
                  {userAvatar ? (
                    <img
                      src={userAvatar}
                      alt="Avatar"
                      className="w-24 h-24 rounded-full object-cover shadow-xl shadow-black/10 border-4 border-white"
                    />
                  ) : (
                    <div className="w-24 h-24 bg-[#1a1d2e] rounded-full flex items-center justify-center shadow-xl shadow-black/10">
                      <User className="w-12 h-12 text-blue-400" />
                    </div>
                  )}
                  <label
                    htmlFor="avatar-upload"
                    className="absolute bottom-0 right-0 w-8 h-8 bg-[#1a1d2e] rounded-full flex items-center justify-center shadow-xl shadow-black/10 cursor-pointer hover:bg-[#252941] transition-colors border-2 border-white"
                  >
                    {uploadingAvatar ? (
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Camera className="w-4 h-4 text-gray-600" />
                    )}
                  </label>
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                    disabled={uploadingAvatar}
                  />
                </div>
                <h2 className="text-white text-xl font-bold">{userName || currentUser.name}</h2>
                <p className="text-blue-100 text-sm mt-1">{currentUser.email}</p>
              </div>

              {/* Formulário de Perfil */}
              <div className="p-6 space-y-6">
                <div>
                  <label className={`block text-sm font-semibold ${app?.theme === 'dark' ? 'text-gray-300' : 'text-gray-300'} mb-2`}>
                    {t('common.email')}
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={currentUser.email}
                      disabled
                      className={`w-full px-4 py-3 ${app?.theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-400' : 'bg-[#0f1117] border-[#1e2139] text-gray-600'} border rounded-xl cursor-not-allowed`}
                    />
                  </div>
                  <p className={`text-xs ${app?.theme === 'dark' ? 'text-gray-500' : 'text-gray-500'} mt-1`}>{t('apps.email_cannot_change')}</p>
                </div>

                <div>
                  <label className={`block text-sm font-semibold ${app?.theme === 'dark' ? 'text-gray-300' : 'text-gray-300'} mb-2`}>
                    {t('common.name')}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      placeholder={t('apps.enter_name')}
                      className={`w-full px-4 py-3 ${app?.theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-blue-400 focus:border-blue-400' : 'bg-[#1a1d2e] border-[#1e2139] focus:ring-blue-400/50 focus:border-blue-500'} border rounded-xl focus:outline-none focus:ring-2`}
                    />
                  </div>
                </div>

                <button
                  onClick={saveUserProfile}
                  disabled={savingProfile}
                  className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 text-white font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <User className="w-5 h-5" />
                  {savingProfile ? t('apps.saving') : t('apps.save_changes')}
                </button>
              </div>
            </div>

            {/* Informações Adicionais */}

          </div>
        )}
      </div>

      {/* Navegação Inferior */}
      <div className={`fixed bottom-0 left-0 right-0 ${app?.theme === 'dark' ? 'bg-gray-900/90 border-gray-700/50' : 'bg-[#0f1520]/90 border-[#1e2139]/50'} backdrop-blur-md border-t px-4 py-2 z-50`}>
        <div className="flex justify-around items-center max-w-md mx-auto">
          <button
            onClick={() => setActiveTab('inicio')}
            className={`flex flex-col items-center py-2 px-3 rounded-lg transition-colors ${activeTab === 'inicio'
              ? 'text-blue-400 bg-blue-500/10'
              : `${app?.theme === 'dark' ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-200'}`
              }`}
          >
            <Home className="w-5 h-5 mb-1" />
            <span className="text-xs font-medium">{t('common.home')}</span>
          </button>

          <button
            onClick={() => setActiveTab('feed')}
            className={`flex flex-col items-center py-2 px-3 rounded-lg transition-colors ${activeTab === 'feed'
              ? 'text-blue-400 bg-blue-500/10'
              : `${app?.theme === 'dark' ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-200'}`
              }`}
          >
            <MessageSquare className="w-5 h-5 mb-1" />
            <span className="text-xs font-medium">{t('common.feed')}</span>
          </button>

          {app?.highlight_community !== false && (
            <button
              onClick={() => setActiveTab('comunidade')}
              className={`flex flex-col items-center py-2 px-3 rounded-lg transition-colors ${activeTab === 'comunidade'
                ? 'text-blue-400 bg-blue-500/10'
                : `${app?.theme === 'dark' ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-200'}`
                }`}
            >
              <Users className="w-5 h-5 mb-1" />
              <span className="text-xs font-medium">{t('common.community')}</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('perfil')}
            className={`flex flex-col items-center py-2 px-3 rounded-lg transition-colors ${activeTab === 'perfil'
              ? 'text-blue-400 bg-blue-500/10'
              : `${app?.theme === 'dark' ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-200'}`
              }`}
          >
            <User className="w-5 h-5 mb-1" />
            <span className="text-xs font-medium">{t('common.profile')}</span>
          </button>
        </div>
      </div>

      {/* Floating Support Button - aparece quando suporte está ativo */}
      {app?.support_enabled && (app?.support_email || app?.whatsapp_number) && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="relative group">
            <button className="w-14 h-14 bg-gradient-to-r from-[#1a1d2e]0 to-indigo-600 rounded-full shadow-xl shadow-black/10 flex items-center justify-center hover:shadow-2xl hover:shadow-blue-500/10 transition-all transform hover:scale-105">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              {/* Online indicator */}
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 border-2 border-white rounded-full"></div>
            </button>

            {/* Dropdown de opções de contato */}
            <div className="absolute bottom-16 right-0 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
              <div className="bg-[#1a1d2e] rounded-lg shadow-xl border border-[#1e2139] overflow-hidden min-w-48 z-50">
                {/* Seta indicativa */}
                <div className="absolute -bottom-2 right-6 w-4 h-4 bg-[#1a1d2e] border-r border-b border-[#1e2139] transform rotate-45"></div>

                {/* Opções de contato */}
                {app.support_email && (
                  <a
                    href={`mailto:${app.support_email}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-blue-500/10 transition-colors border-b border-[#1e2139] last:border-b-0"
                  >
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-100 text-sm">E-mail</div>
                      <div className="text-gray-500 text-xs truncate">{app.support_email}</div>
                    </div>
                  </a>
                )}

                {app.whatsapp_number && (
                  <a
                    href={`https://wa.me/${app.whatsapp_number.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-3 hover:bg-green-50 transition-colors border-b border-[#1e2139] last:border-b-0"
                  >
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.593z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-100 text-sm">WhatsApp</div>
                      <div className="text-gray-500 text-xs truncate">{app.whatsapp_number}</div>
                    </div>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Debug: Mostrar informações do suporte no console */}
      {(() => {
        return null
      })()}

      {/* Modal de Solicitação de Reembolso */}
      {showRefundModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowRefundModal(false)}>
          <div
            className={`${app?.theme === 'dark' ? 'bg-gray-800' : 'bg-[#0d1117]'} w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden border ${app?.theme === 'dark' ? 'border-gray-700' : 'border-white/[0.08]'}`}
            onClick={e => e.stopPropagation()}
          >
            {/* Header do Modal */}
            <div className={`px-5 py-4 border-b ${app?.theme === 'dark' ? 'border-gray-700' : 'border-white/[0.06]'} flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-orange-400" />
                <h2 className="text-base font-semibold text-white">{tForLang(app?.language || 'pt', 'apps.refund_request')}</h2>
              </div>
              <button onClick={() => setShowRefundModal(false)} className="text-gray-500 hover:text-gray-300 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {refundDone ? (
              /* Tela de sucesso */
              <div className="px-5 py-10 flex flex-col items-center gap-3 text-center">
                <CheckCircle className="w-12 h-12 text-green-400" />
                <p className="text-white font-semibold text-base">{tForLang(app?.language || 'pt', 'apps.refund_success_title')}</p>
                <p className="text-gray-500 text-sm">{tForLang(app?.language || 'pt', 'apps.refund_success_desc')}</p>
                <button
                  onClick={() => setShowRefundModal(false)}
                  className="mt-2 px-6 py-2 bg-white/[0.06] border border-white/[0.1] text-gray-300 rounded-lg text-sm hover:bg-white/[0.1] transition-colors"
                >
                  {tForLang(app?.language || 'pt', 'apps.refund_close')}
                </button>
              </div>
            ) : (
              /* Formulário */
              <div className="px-5 py-5 space-y-4">
                <p className="text-gray-500 text-xs leading-relaxed">
                  {tForLang(app?.language || 'pt', 'apps.refund_description')} <span className="text-gray-300">{tForLang(app?.language || 'pt', 'apps.refund_business_days')}</span>.
                </p>

                {/* Motivo */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">{tForLang(app?.language || 'pt', 'apps.refund_reason_label')}</label>
                  <textarea
                    value={refundReason}
                    onChange={e => setRefundReason(e.target.value)}
                    rows={4}
                    placeholder={tForLang(app?.language || 'pt', 'apps.refund_reason_placeholder')}
                    className={`w-full px-3 py-2.5 text-sm rounded-lg border ${app?.theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'bg-white/[0.04] border-white/[0.08] text-white placeholder-gray-600'} focus:outline-none focus:border-orange-500/50 resize-none`}
                  />
                </div>

                {/* Botões */}
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => setShowRefundModal(false)}
                    className="flex-1 py-2.5 text-sm border border-white/[0.08] text-gray-400 rounded-lg hover:bg-white/[0.04] transition-colors"
                  >
                    {tForLang(app?.language || 'pt', 'apps.refund_cancel')}
                  </button>
                  <button
                    disabled={!refundReason.trim() || refundSubmitting}
                    onClick={async () => {
                      setRefundSubmitting(true)
                      try {
                        const { data: { user: authUserData } } = await supabase.auth.getUser()
                        const userData = localStorage.getItem('user_data')
                        let buyerEmail = authUserData?.email || ''
                        let buyerName = authUserData?.user_metadata?.name || 'Cliente'
                        if (!buyerEmail && userData) {
                          try { const p = JSON.parse(userData); buyerEmail = p.email || ''; buyerName = p.name || 'Cliente' } catch { }
                        }
                        await fetch(`https://api.clicknich.com/api/apps/refund-request`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            appId,
                            buyerEmail,
                            buyerName,
                            reason: refundReason.trim(),
                          }),
                        })
                        setRefundDone(true)
                      } catch {
                        setRefundDone(true) // Mostrar sucesso mesmo assim (não penalizar o usuário por erro de rede)
                      } finally {
                        setRefundSubmitting(false)
                      }
                    }}
                    className="flex-1 py-2.5 text-sm bg-orange-500 hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {refundSubmitting ? (
                      <><RotateCcw className="w-3.5 h-3.5 animate-spin" /> {tForLang(app?.language || 'pt', 'apps.refund_sending')}</>
                    ) : (
                      tForLang(app?.language || 'pt', 'apps.refund_submit')
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Notificações */}
      {showNotifications && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className={`${app?.theme === 'dark' ? 'bg-gray-800' : 'bg-[#1a1d2e]'} rounded-xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col`}>
            {/* Header do Modal */}
            <div className={`p-4 border-b ${app?.theme === 'dark' ? 'border-gray-700' : 'border-[#1e2139]'} flex items-center justify-between`}>
              <h2 className={`text-xl font-bold ${app?.theme === 'dark' ? 'text-white' : 'text-gray-100'}`}>{t('apps.notifications')}</h2>
              <button
                onClick={() => setShowNotifications(false)}
                className={`p-2 ${app?.theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-[#252941]'} rounded-lg transition-colors`}
              >
                <X className={`w-5 h-5 ${app?.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`} />
              </button>
            </div>

            {/* Lista de Notificações */}
            <div className="flex-1 overflow-y-auto p-4">
              {notifications.length === 0 ? (
                <div className="text-center py-12">
                  <Bell className={`w-16 h-16 mx-auto mb-4 ${app?.theme === 'dark' ? 'text-gray-500' : 'text-gray-300'}`} />
                  <p className={`${app?.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{t('apps.no_notifications')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 ${app?.theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-[#0f1117] hover:bg-[#252941]'} rounded-lg transition-colors cursor-pointer`}
                      onClick={() => {
                        if (notification.redirect_url) {
                          window.open(notification.redirect_url, '_blank')
                        }
                      }}
                    >
                      <h3 className={`font-semibold ${app?.theme === 'dark' ? 'text-white' : 'text-gray-100'} mb-1`}>{notification.title}</h3>
                      <p className={`text-sm ${app?.theme === 'dark' ? 'text-gray-300' : 'text-gray-600'} mb-2`}>{notification.message}</p>
                      <span className="text-xs text-gray-400">
                        {new Date(notification.created_at).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}