import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Edit2, Trash2, FileText, Video, Link, Headphones, Users, BookOpen, ExternalLink } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { supabase } from '../../services/supabase'
import { useI18n } from '@/i18n'
import ContentModal from '../../components/ContentModal'

interface Content {
  id: number
  name: string
  type: string
  url: string
  description: string
  cover_url: string
  order_index: number
  created_at: string
}

interface Product {
  id: number
  name: string
  description: string
  application_id: number
}

const contentTypeIcons: { [key: string]: { icon: any; label: string; color: string } } = {
  audio: { icon: Headphones, label: 'Audio', color: 'text-yellow-600 bg-yellow-50' },
  html: { icon: FileText, label: 'HTML', color: 'text-blue-400 bg-blue-500/10' },
  link: { icon: Link, label: 'External Link', color: 'text-blue-400 bg-blue-500/10' },
  webpage: { icon: ExternalLink, label: 'Web Page', color: 'text-blue-600 bg-cyan-50' },
  'pdf-drive': { icon: FileText, label: 'PDF Google Drive', color: 'text-orange-600 bg-orange-50' },
  vimeo: { icon: Video, label: 'Vimeo', color: 'text-blue-400 bg-indigo-50' },
  youtube: { icon: Video, label: 'Youtube', color: 'text-red-600 bg-red-50' },
  download: { icon: FileText, label: 'Download', color: 'text-gray-600 bg-[#0f1117]' },
  embedded: { icon: FileText, label: 'Embedded', color: 'text-slate-600 bg-slate-50' },
  vtub: { icon: Video, label: 'Vtub/PandaWétria', color: 'text-blue-600 bg-violet-50' },
  video: { icon: Video, label: 'Video', color: 'text-red-600 bg-red-50' },
  pdf: { icon: FileText, label: 'PDF', color: 'text-orange-600 bg-orange-50' },
  text: { icon: BookOpen, label: 'Text', color: 'text-green-600 bg-green-50' },
  exercise: { icon: Edit2, label: 'Exercise', color: 'text-blue-600 bg-purple-50' },
  live: { icon: Users, label: 'Live', color: 'text-pink-600 bg-pink-50' }
}

export default function ModuleView() {
  const navigate = useNavigate()
  const { productId } = useParams<{ productId: string }>()
  const { user } = useAuthStore()
  const { t } = useI18n()

  const [product, setProduct] = useState<Product | null>(null)
  const [contents, setContents] = useState<Content[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingContent, setEditingContent] = useState<Content | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    if (!user || !productId) return

    Promise.all([
      fetchProduct(),
      fetchContents()
    ]).finally(() => setLoading(false))
  }, [user, productId])

  const fetchProduct = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch(`https://members.clicknich.com/api/products/${productId}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`
        }
      })

      if (!response.ok) {
        throw new Error('Product not found')
      }

      const data = await response.json()
      setProduct(data)
    } catch (err) {
      console.error('Error fetching product:', err)
      setError(t('common.error'))
    }
  }

  const fetchContents = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch(`https://members.clicknich.com/api/products/${productId}/contents`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`
        }
      })

      if (!response.ok) {
        throw new Error(t('common.error'))
      }

      const data = await response.json()
      setContents(data.sort((a: Content, b: Content) => a.order_index - b.order_index))
    } catch (err) {
      console.error('Error fetching content:', err)
      setError(t('common.error'))
    }
  }

  const handleCreateContent = () => {
    setEditingContent(null)
    setIsEditing(false)
    setIsModalOpen(true)
  }

  const handleEditContent = (content: Content) => {
    setEditingContent(content)
    setIsEditing(true)
    setIsModalOpen(true)
  }

  const handleSaveContent = async (contentData: any) => {
    try {
      const url = isEditing
        ? `https://members.clicknich.com/api/contents/${editingContent?.id}`
        : `https://members.clicknich.com/api/products/${productId}/contents`

      const method = isEditing ? 'PUT' : 'POST'

      const payload = {
        ...contentData,
        order_index: isEditing ? editingContent?.order_index : contents.length
      }

      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Error saving content')
      }

      // Refresh contents list
      await fetchContents()
    } catch (err) {
      console.error('Error saving content:', err)
      alert(t('common.error'))
    }
  }

  const handleDeleteContent = async (content: Content) => {
    if (!confirm(`${t('common.confirm')} "${content.name}"?`)) {
      return
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch(`https://members.clicknich.com/api/contents/${content.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`
        }
      })

      if (!response.ok) {
        throw new Error('Error deleting content')
      }

      await fetchContents()
    } catch (err) {
      console.error('Error deleting content:', err)
      alert(t('common.error'))
    }
  }

  const openContent = (content: Content) => {
    if (content.url) {
      window.open(content.url, '_blank')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="text-blue-400 hover:underline"
          >
            {t('common.back')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f1117] transition-colors duration-200">
      {/* Header */}
      <div className="bg-white dark:bg-[#1a1d2e] shadow-xl shadow-black/5 dark:shadow-black/10 border-b border-gray-200 dark:border-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => navigate(-1)}
                className="mr-4 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-600"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {product?.name}
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-500">
                  {t('community.module_content')}
                </p>
              </div>
            </div>
            <button
              onClick={handleCreateContent}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={16} />
              {t('community.new_content')}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {product?.description && (
          <div className="bg-white dark:bg-[#1a1d2e] rounded-lg p-6 mb-6 shadow-xl shadow-black/5 dark:shadow-black/10">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              {t('community.about_module')}
            </h2>
            <p className="text-gray-600">
              {product.description}
            </p>
          </div>
        )}

        {/* Contents List */}
        <div className="bg-white dark:bg-[#1a1d2e] rounded-lg shadow-xl shadow-black/5 dark:shadow-black/10">
          <div className="p-6 border-b border-gray-200 dark:border-[#1e2139]">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                {t('common.content')} ({contents.length})
              </h2>
              {contents.length === 0 && (
                <button
                  onClick={handleCreateContent}
                  className="text-blue-400 hover:text-blue-700 text-sm font-medium"
                >
                  + {t('community.add_first_content')}
                </button>
              )}
            </div>
          </div>

          {contents.length === 0 ? (
            <div className="p-12 text-center">
              <BookOpen className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-100 mb-2">
                {t('community.no_content')}
              </h3>
              <p className="text-gray-600 mb-4">
                {t('community.start_adding_content')}
              </p>
              <button
                onClick={handleCreateContent}
                className="inline-flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
              >
                <Plus size={16} />
                {t('community.new_content')}
              </button>
            </div>
          ) : (
            <div className="divide-y">
              {contents.map((content, index) => {
                const typeInfo = contentTypeIcons[content.type] || contentTypeIcons.text
                const IconComponent = typeInfo.icon

                return (
                  <div key={content.id} className="p-6 hover:bg-[#0f1117] transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        {/* Cover Image */}
                        <div className="w-16 h-16 bg-[#252941] rounded-lg flex-shrink-0 overflow-hidden">
                          {content.cover_url ? (
                            <img
                              src={content.cover_url}
                              alt={content.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className={`w-full h-full flex items-center justify-center ${typeInfo.color} rounded-lg`}>
                              <IconComponent size={20} />
                            </div>
                          )}
                        </div>

                        {/* Content Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-gray-500">
                              {index + 1}.
                            </span>
                            <h3 className="text-lg font-medium text-gray-100 truncate">
                              {content.name}
                            </h3>
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${typeInfo.color}`}>
                              <IconComponent size={12} />
                              {typeInfo.label}
                            </span>
                          </div>

                          {content.description && (
                            <div
                              className="text-gray-600 text-sm mb-2 line-clamp-2 [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:list-decimal [&>ol]:pl-4 [&>a]:text-blue-400 [&>a]:underline"
                              dangerouslySetInnerHTML={{ __html: content.description }}
                            />
                          )}

                          {content.url && (
                            <button
                              onClick={() => openContent(content)}
                              className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-700 text-sm font-medium"
                            >
                              <ExternalLink size={12} />
                              {t('community.access_content')}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 ml-4">
                        <button
                          onClick={() => handleEditContent(content)}
                          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-[#252941] transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteContent(content)}
                          className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Content Modal */}
      <ContentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveContent}
        content={editingContent}
        isEditing={isEditing}
      />
    </div>
  )
}