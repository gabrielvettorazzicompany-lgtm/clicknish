import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Upload, Bold, Italic, Underline, Strikethrough, List, ListOrdered, Link as LinkIcon, Hash, Calendar, Clock, Send, X } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { useI18n } from '@/i18n'

const EDGE_FUNCTION_URL = 'https://api.clicknich.com/api'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY'

interface ScheduledPost {
  id: string
  app_id: string
  content: string
  image_url?: string
  scheduled_for: string
  status: 'pending' | 'published' | 'failed' | 'cancelled'
  created_at: string
  published_at?: string
  error_message?: string
}

interface App {
  id: string
  name: string
}

interface PostImage {
  id: string
  file: File
  preview: string
  croppedData?: string
}

export default function FeedManagement({ embedded = false }: { embedded?: boolean }) {
  const { appId } = useParams()
  const navigate = useNavigate()
  const { t } = useI18n()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [app, setApp] = useState<App | null>(null)
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([])
  const [activeTab, setActiveTab] = useState<'create' | 'scheduled'>('create')
  const [activeFilter, setActiveFilter] = useState<'published' | 'failed'>('published')
  const [loading, setLoading] = useState(false)

  // Image crop state
  const [editingImageId, setEditingImageId] = useState<string | null>(null)
  const [cropScale, setCropScale] = useState(1)
  const [cropPosition, setCropPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const cropAreaRef = useRef<HTMLDivElement>(null)

  // Form state for creating posts
  const [postForm, setPostForm] = useState({
    content: '',
    images: [] as PostImage[],
    scheduleForFuture: false,
    scheduledDate: '',
    scheduledTime: ''
  })

  useEffect(() => {
    if (appId) {
      fetchApp()
      fetchScheduledPosts()
    }
  }, [appId])

  const fetchApp = async () => {
    try {
      const response = await fetch(`${EDGE_FUNCTION_URL}/applications/${appId}`, {
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setApp(data)
      }
    } catch (error) {
      console.error('Error fetching app:', error)
    }
  }

  const fetchScheduledPosts = async () => {
    try {
      const response = await fetch(`${EDGE_FUNCTION_URL}/applications/${appId}/feed/posts`, {
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setScheduledPosts(data)
      } else {
        setScheduledPosts([])
      }
    } catch (error) {
      console.error('Error fetching scheduled posts:', error)
      setScheduledPosts([])
    }
  }

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Pegar o conteúdo do editor HTML
      const contentDiv = document.getElementById('post-content-editor')
      const content = contentDiv?.innerHTML || postForm.content



      if (!content || content.trim() === '' || content === '<br>') {
        alert(t('community.fill_content'))
        setLoading(false)
        return
      }

      const postData: any = {
        content: content
      }

      // Adicionar imagens processadas (se houver)
      if (postForm.images.length > 0) {
        const imageUrls = postForm.images.map(img => img.croppedData || img.preview)
        postData.image_url = JSON.stringify(imageUrls)
      }

      if (postForm.scheduleForFuture && postForm.scheduledDate && postForm.scheduledTime) {
        const scheduledDateTime = `${postForm.scheduledDate}T${postForm.scheduledTime}:00Z`
        postData.scheduled_for = scheduledDateTime
      }



      const response = await fetch(`${EDGE_FUNCTION_URL}/applications/${appId}/feed/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify(postData)
      })



      if (response.ok) {
        const newPost = await response.json()


        if (postForm.scheduleForFuture) {
          setScheduledPosts(prev => [newPost, ...prev])
        }

        // Limpar o editor
        if (contentDiv) {
          contentDiv.innerHTML = ''
        }

        setPostForm({
          content: '',
          images: [],
          scheduleForFuture: false,
          scheduledDate: '',
          scheduledTime: ''
        })

        alert(t('common.success'))
        if (postForm.scheduleForFuture) {
          setActiveTab('scheduled')
        }
      } else {
        const errorText = await response.text()
        console.error('Error response:', errorText)
        let errorData
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { error: errorText }
        }
        alert(`${t('common.error')}: ${errorData.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error creating post:', error)
      alert(`${t('common.error')}: ${error instanceof Error ? error.message : t('common.error')}`)
    } finally {
      setLoading(false)
    }
  }

  const formatTextEditor = (command: string) => {
    const contentDiv = document.getElementById('post-content-editor')
    if (contentDiv) {
      contentDiv.focus()
      document.execCommand(command, false)
    }
  }

  const insertList = (ordered: boolean = false) => {
    const command = ordered ? 'insertOrderedList' : 'insertUnorderedList'
    const contentDiv = document.getElementById('post-content-editor')
    if (contentDiv) {
      contentDiv.focus()
      document.execCommand(command, false)
    }
  }

  const handleAddImages = (files: FileList | null) => {
    if (!files || files.length === 0) return

    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (e) => {
          const newImage: PostImage = {
            id: `img_${Date.now()}_${Math.random()}`,
            file,
            preview: e.target?.result as string
          }

          setPostForm(prev => ({
            ...prev,
            images: [...prev.images, newImage]
          }))

          // Abrir o modal de crop automaticamente
          setEditingImageId(newImage.id)
        }
        reader.readAsDataURL(file)
      }
    })
  }

  const handleRemoveImage = (id: string) => {
    setPostForm(prev => ({
      ...prev,
      images: prev.images.filter(img => img.id !== id)
    }))
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    setDragStart({ x: e.clientX - cropPosition.x, y: e.clientY - cropPosition.y })
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging && cropAreaRef.current && imageRef.current) {
      const cropRect = cropAreaRef.current.getBoundingClientRect()
      const imgRect = imageRef.current.getBoundingClientRect()

      const newX = e.clientX - dragStart.x
      const newY = e.clientY - dragStart.y

      const maxX = (imgRect.width * cropScale - cropRect.width) / 2
      const maxY = (imgRect.height * cropScale - cropRect.height) / 2

      setCropPosition({
        x: Math.max(-maxX, Math.min(maxX, newX)),
        y: Math.max(-maxY, Math.min(maxY, newY))
      })
    }
  }, [isDragging, dragStart, cropScale])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  const processCroppedImage = () => {
    const editingImage = postForm.images.find(img => img.id === editingImageId)
    if (!editingImage || !canvasRef.current || !imageRef.current || !cropAreaRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Define tamanho do canvas (16:9)
    canvas.width = 800
    canvas.height = 450

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const tempImg = new Image()
    tempImg.onload = () => {
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

      const croppedData = canvas.toDataURL('image/jpeg', 0.8)

      setPostForm(prev => ({
        ...prev,
        images: prev.images.map(img =>
          img.id === editingImageId ? { ...img, croppedData } : img
        )
      }))

      setEditingImageId(null)
      setCropScale(1)
      setCropPosition({ x: 0, y: 0 })
    }

    tempImg.src = editingImage.preview
  }

  const updatePostStatus = async (postId: string, newStatus: 'cancelled' | 'republish') => {
    try {
      const response = await fetch(`https://app.clicknich.com/api/feed/posts/${postId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      if (response.ok) {
        setScheduledPosts(prev => prev.map(post =>
          post.id === postId
            ? { ...post, status: newStatus === 'republish' ? 'pending' : 'cancelled' }
            : post
        ))
      }
    } catch (error) {
      console.error('Error updating post status:', error)
    }
  }

  const deletePost = async (postId: string) => {
    if (!confirm(t('community.confirm_delete_post'))) {
      return
    }

    try {
      const response = await fetch(`${EDGE_FUNCTION_URL}/applications/${appId}/feed/posts/${postId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      })

      if (response.ok) {
        setScheduledPosts(prev => prev.filter(post => post.id !== postId))
        alert(t('common.success'))
      } else {
        alert(t('common.error'))
      }
    } catch (error) {
      console.error('Error deleting post:', error)
      alert(t('common.error'))
    }
  }

  const filteredPosts = scheduledPosts.filter(post => post.status === activeFilter)

  const getStatusBadge = (status: string) => {
    const badges = {
      'pending': { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
      'published': { label: 'Published', color: 'bg-green-100 text-green-800' },
      'failed': { label: 'Failed', color: 'bg-red-100 text-red-800' },
      'cancelled': { label: 'Cancelado', color: 'bg-[#252941] text-gray-200' }
    }
    const badge = badges[status as keyof typeof badges] || { label: status, color: 'bg-[#252941] text-gray-200' }
    return (
      <span className={`px-2 py-1 text-xs rounded-full font-medium ${badge.color}`}>
        {badge.label}
      </span>
    )
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className={embedded ? "flex-1 flex flex-col" : "min-h-screen bg-[#0f1117] flex"}>
      {!embedded && <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />}

      <div className="flex-1 flex flex-col min-w-0">
        {!embedded && <Header onMenuClick={() => setSidebarOpen(true)} />}

        {/* Navbar Tabs - Fixo abaixo do header */}
        {!embedded && (
          <div className="bg-[#0f1117] border-b border-[#1e2139] mt-12 sticky top-12 z-[60]">
            <div className="flex items-center gap-6 px-6">
              <button
                onClick={() => navigate(-1)}
                className="py-2 text-xs font-medium border-b-2 border-blue-400 text-blue-400 flex items-center gap-2"
              >
                <ArrowLeft size={14} />
                {t('community.feed_management')}
              </button>
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 lg:px-6 py-6">

            {/* Tabs */}
            <div className="bg-[#1a1d2e] rounded-lg shadow-lg shadow-black/10 border border-[#1e2139] overflow-hidden">
              <div className="border-b border-[#1e2139]">
                <div className="flex">
                  <button
                    onClick={() => setActiveTab('create')}
                    className={`flex-1 px-4 py-2.5 text-center text-sm font-medium transition-colors ${activeTab === 'create'
                      ? 'text-blue-400 bg-blue-500/10 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:text-gray-100 hover:bg-[#0f1117]'
                      }`}
                  >
                    {t('community.create_post')}
                  </button>
                  <button
                    onClick={() => setActiveTab('scheduled')}
                    className={`flex-1 px-4 py-2.5 text-center text-sm font-medium transition-colors ${activeTab === 'scheduled'
                      ? 'text-blue-400 bg-blue-500/10 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:text-gray-100 hover:bg-[#0f1117]'
                      }`}
                  >
                    {t('community.scheduled_posts')}
                  </button>
                </div>
              </div>

              <div className="p-4">
                {activeTab === 'create' ? (
                  /* Create Post Form */
                  <div>
                    <p className="text-gray-600 text-xs mb-4">
                      Create official posts to keep your students informed about news, updates and important content. These posts will appear in the app's main feed.
                    </p>

                    <form onSubmit={handleCreatePost} className="space-y-4">
                      {/* Content */}
                      <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1">
                          {t('common.content')}
                        </label>

                        {/* Text Editor Toolbar */}
                        <div className="border border-[#252941] rounded-t-lg p-1.5 bg-[#0f1117]/50 flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => formatTextEditor('bold')}
                            className="p-1.5 hover:bg-[#252941] rounded transition-colors text-white"
                            title="Bold"
                          >
                            <Bold className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => formatTextEditor('italic')}
                            className="p-1.5 hover:bg-[#252941] rounded transition-colors text-white"
                            title="Italic"
                          >
                            <Italic className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => formatTextEditor('underline')}
                            className="p-1.5 hover:bg-[#252941] rounded transition-colors text-white"
                            title="Underline"
                          >
                            <Underline className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => formatTextEditor('strikeThrough')}
                            className="p-1.5 hover:bg-[#252941] rounded transition-colors text-white"
                            title="Strikethrough"
                          >
                            <Strikethrough className="w-4 h-4" />
                          </button>
                          <div className="w-px h-4 bg-[#3a3f5c] mx-1" />
                          <button
                            type="button"
                            onClick={() => insertList(false)}
                            className="p-1.5 hover:bg-[#252941] rounded transition-colors text-white"
                            title="List"
                          >
                            <List className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => insertList(true)}
                            className="p-1.5 hover:bg-[#252941] rounded transition-colors text-white"
                            title="Numbered List"
                          >
                            <ListOrdered className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => formatTextEditor('createLink')}
                            className="p-1.5 hover:bg-[#252941] rounded transition-colors text-white"
                            title="Link"
                          >
                            <LinkIcon className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => formatTextEditor('formatBlock')}
                            className="p-1.5 hover:bg-[#252941] rounded transition-colors text-white"
                            title="Code"
                          >
                            <Hash className="w-4 h-4" />
                          </button>
                        </div>

                        <style>
                          {`
                            #post-content-editor ul {
                              list-style-type: disc;
                              padding-left: 1.5rem;
                              margin: 0.5rem 0;
                            }
                            #post-content-editor ol {
                              list-style-type: decimal;
                              padding-left: 1.5rem;
                              margin: 0.5rem 0;
                            }
                            #post-content-editor li {
                              margin: 0.25rem 0;
                            }
                          `}
                        </style>

                        <div
                          id="post-content-editor"
                          contentEditable
                          onInput={(e) => setPostForm(prev => ({
                            ...prev,
                            content: (e.target as HTMLElement).innerHTML
                          }))}
                          className="min-h-24 p-3 text-sm border border-t-0 border-[#252941] rounded-b-lg focus:outline-none focus:ring-1 focus:ring-blue-400/50 focus:border-blue-500 bg-[#1a1d2e] text-white"
                          style={{ minHeight: '80px' }}
                          suppressContentEditableWarning={true}
                          data-placeholder="Type the content of your post..."
                        />
                      </div>

                      {/* Post Images */}
                      <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1">
                          {t('community.post_image')}
                        </label>

                        {/* Upload Area */}
                        <div className="border-2 border-dashed border-[#252941] rounded-lg p-4 text-center mb-3">
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(e) => handleAddImages(e.target.files)}
                            className="hidden"
                            id="post-image-upload"
                          />
                          <label
                            htmlFor="post-image-upload"
                            className="cursor-pointer flex flex-col items-center gap-1"
                          >
                            <Upload className="w-6 h-6 text-gray-400" />
                            <span className="text-gray-600 text-sm">{t('community.click_add_images')}</span>
                            <span className="text-[10px] text-gray-400">You can add multiple images</span>
                          </label>
                        </div>

                        {/* Images Preview */}
                        {postForm.images.length > 0 && (
                          <div className="grid grid-cols-2 gap-4">
                            {postForm.images.map((image) => (
                              <div key={image.id} className="border border-[#1e2139] rounded-lg overflow-hidden">
                                <div className="aspect-video bg-[#252941] relative">
                                  <img
                                    src={image.croppedData || image.preview}
                                    alt="Preview"
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <div className="p-3 flex items-center justify-between bg-[#1a1d2e]">
                                  <span className="text-xs text-gray-600 truncate flex-1 mr-2">
                                    {image.file.name}
                                  </span>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingImageId(image.id)
                                        setCropScale(1)
                                        setCropPosition({ x: 0, y: 0 })
                                      }}
                                      className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                                    >
                                      Adjust
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveImage(image.id)}
                                      className="p-1 text-red-600 hover:text-red-700"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Canvas oculto para processamento */}
                      <canvas ref={canvasRef} className="hidden" />

                      {/* Submit Button */}
                      <div className="pt-4 border-t border-[#252941]">
                        <button
                          type="submit"
                          disabled={loading || !postForm.content}
                          className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Send className="w-3.5 h-3.5" />
                          {loading ? t('community.publishing') : t('community.publish')}
                        </button>
                      </div>
                    </form>
                  </div>
                ) : (
                  /* Scheduled Posts List */
                  <div>
                    <div className="mb-4">
                      <p className="text-gray-600 text-xs mb-3">
                        Manage scheduled posts for future publication. Here you can view, edit, cancel and retry publishing scheduled posts.
                      </p>

                      {/* Filters */}
                      <div className="flex gap-1.5">
                        {[
                          { key: 'published', label: 'Published', count: scheduledPosts.filter(p => p.status === 'published').length },
                          { key: 'failed', label: 'Failed', count: scheduledPosts.filter(p => p.status === 'failed').length }
                        ].map(filter => (
                          <button
                            key={filter.key}
                            onClick={() => setActiveFilter(filter.key as any)}
                            className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${activeFilter === filter.key
                              ? 'bg-blue-500 text-white'
                              : 'bg-[#252941] text-gray-300 hover:bg-gray-200'
                              }`}
                          >
                            {filter.label} ({filter.count})
                          </button>
                        ))}
                      </div>
                    </div>

                    {filteredPosts.length === 0 ? (
                      <div className="text-center py-12">
                        <p className="text-gray-500">
                          No {activeFilter === 'pending' ? 'pending' : activeFilter === 'published' ? 'published' : activeFilter === 'failed' ? 'failed' : 'cancelled'} posts found with the selected status.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {filteredPosts.map(post => (
                          <div key={post.id} className="bg-[#0f1117]/50 border border-[#1e2139] rounded-lg p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  {getStatusBadge(post.status)}
                                </div>

                                <div className="text-sm text-gray-300 mb-2" dangerouslySetInnerHTML={{ __html: post.content }} />

                                {post.image_url && (() => {
                                  try {
                                    const imageUrls = JSON.parse(post.image_url)
                                    if (Array.isArray(imageUrls) && imageUrls.length > 0) {
                                      return (
                                        <div className="mt-3 grid gap-2" style={{
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
                                    // Se não for JSON, trata como URL única
                                    return (
                                      <img
                                        src={post.image_url}
                                        alt="Post image"
                                        className="w-full max-w-md rounded-lg object-cover mt-3"
                                      />
                                    )
                                  }
                                })()}

                                {post.error_message && (
                                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                                    <strong>Error:</strong> {post.error_message}
                                  </div>
                                )}
                              </div>

                              <div className="flex flex-col gap-2 ml-4">
                                {post.status === 'pending' && (
                                  <button
                                    onClick={() => updatePostStatus(post.id, 'cancelled')}
                                    className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm font-medium hover:bg-red-200 transition-colors"
                                  >
                                    {t('common.cancel')}
                                  </button>
                                )}
                                {post.status === 'failed' && (
                                  <button
                                    onClick={() => updatePostStatus(post.id, 'republish')}
                                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm font-medium hover:bg-blue-200 transition-colors"
                                  >
                                    {t('community.retry')}
                                  </button>
                                )}
                                <button
                                  onClick={() => deletePost(post.id)}
                                  className="px-3 py-1 bg-[#252941] text-gray-300 rounded text-sm font-medium hover:bg-gray-200 transition-colors"
                                >
                                  {t('common.delete')}
                                </button>
                              </div>
                            </div>

                            <div className="text-xs text-gray-500 border-t border-[#1e2139] pt-2">
                              Created at: {formatDateTime(post.created_at)}
                              {post.published_at && (
                                <> • Published at: {formatDateTime(post.published_at)}</>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Modal de Crop */}
          {editingImageId && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[70]">
              <div className="bg-gradient-to-b from-[#1a2035] to-[#151825] border border-[#2a4060] rounded-lg shadow-2xl max-w-2xl w-full mx-4">
                {/* Header */}
                <div className="flex items-center justify-between p-3 border-b border-[#2a4060]">
                  <h3 className="text-sm font-semibold text-gray-100">{t('community.adjust_image')}</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingImageId(null)
                      setCropScale(1)
                      setCropPosition({ x: 0, y: 0 })
                    }}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Conteúdo */}
                <div className="p-4">
                  {/* Área de Crop - 16:9 */}
                  <div className="flex justify-center mb-4">
                    <div
                      ref={cropAreaRef}
                      className="relative bg-black rounded-lg overflow-hidden border border-[#3a3f5c]"
                      style={{ width: '560px', height: '315px' }}
                    >
                      {/* Imagem arrastável */}
                      <div
                        className="absolute inset-0 cursor-grab active:cursor-grabbing overflow-hidden"
                        onMouseDown={handleMouseDown}
                      >
                        <img
                          ref={imageRef}
                          src={postForm.images.find(img => img.id === editingImageId)?.preview}
                          alt="Crop preview"
                          className="absolute top-1/2 left-1/2 max-w-none select-none"
                          style={{
                            transform: `translate(-50%, -50%) translate(${cropPosition.x}px, ${cropPosition.y}px) scale(${cropScale})`,
                            transformOrigin: 'center'
                          }}
                          draggable={false}
                          onLoad={() => {
                            if (imageRef.current) {
                              const img = imageRef.current
                              const scaleX = 560 / img.naturalWidth
                              const scaleY = 315 / img.naturalHeight
                              const initialScale = Math.max(scaleX, scaleY)
                              setCropScale(initialScale)
                            }
                          }}
                        />
                      </div>

                      {/* Grid */}
                      <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                          {[...Array(9)].map((_, i) => (
                            <div key={i} className="border border-white/30"></div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Controle de Zoom */}
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-300 mb-2">Zoom</label>
                    <input
                      type="range"
                      min="0.1"
                      max="3"
                      step="0.1"
                      value={cropScale}
                      onChange={(e) => setCropScale(Number(e.target.value))}
                      className="w-full h-1.5 bg-[#252941] rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  <p className="text-xs text-gray-500 text-center mb-4">
                    Drag the image to adjust position
                  </p>

                  {/* Buttons */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingImageId(null)
                        setCropScale(1)
                        setCropPosition({ x: 0, y: 0 })
                      }}
                      className="flex-1 px-3 py-1.5 text-xs text-gray-300 bg-[#252941] hover:bg-[#3a3f5c] border border-[#3a3f5c] rounded-lg font-medium transition-colors"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={processCroppedImage}
                      className="flex-1 px-3 py-1.5 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium transition-colors"
                    >
                      {t('common.save')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

    </div >
  )
}