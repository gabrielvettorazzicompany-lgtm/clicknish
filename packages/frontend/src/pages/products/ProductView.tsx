import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Play, FileText, Download, Eye, Clock, CheckCircle } from 'lucide-react'
import { useI18n } from '@/i18n'

interface ProductContent {
  id: string
  title: string
  type: 'audio' | 'html' | 'link' | 'webpage' | 'pdf-drive' | 'vimeo' | 'youtube' | 'download' | 'embedded' | 'vtub' | 'video' | 'text' | 'quiz'
  content?: string
  video_url?: string
  file_url?: string
  cover_url?: string
  duration?: string
  completed?: boolean
}

interface ProductData {
  id: string
  name: string
  description?: string
  cover_url?: string
  logo_url?: string
  contents: ProductContent[]
}

export default function ProductView() {
  const { appId, productId } = useParams()
  const navigate = useNavigate()
  const [productData, setProductData] = useState<ProductData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedContent, setSelectedContent] = useState<ProductContent | null>(null)

  const { t } = useI18n()

  useEffect(() => {
    fetchProductData()
  }, [appId, productId])

  const fetchProductData = async () => {
    try {
      setLoading(true)

      const userId = localStorage.getItem('user_id') || '1'

      // Buscar dados do produto da aplicação
      const productsResponse = await supabaseFetch(`applications/${appId}/products`, {
        headers: { 'x-user-id': userId }
      })

      if (!productsResponse.ok) {
        throw new Error('Error fetching products')
      }

      const products = await productsResponse.json()
      const currentProduct = products.find((p: any) => p.id === productId)

      if (!currentProduct) {
        throw new Error('Product not found')
      }

      // Fetch product contents
      const contentsResponse = await supabaseFetch(`applications/${appId}/products/${productId}/contents`, {
        headers: { 'x-user-id': userId }
      })

      let contents = []
      if (contentsResponse.ok) {
        const contentsData = await contentsResponse.json()
        contents = contentsData.map((content: any) => ({
          id: content.id,
          title: content.name || content.title,
          type: content.type || content.content_type || 'text',
          content: content.description || content.text_content,
          video_url: content.url || content.content_url,
          file_url: content.url || content.content_url,
          cover_url: content.cover_url,
          duration: content.duration,
          completed: false
        }))
      }

      const productData = {
        id: currentProduct.id,
        name: currentProduct.name,
        description: currentProduct.description,
        cover_url: currentProduct.cover_url,
        logo_url: currentProduct.logo_url,
        contents
      }

      setProductData(productData)
      if (contents.length > 0) {
        setSelectedContent(contents[0])
      }
    } catch (error) {
      console.error('Error fetching product data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getContentIcon = (type: string) => {
    switch (type) {
      case 'audio': return Play
      case 'html': return FileText
      case 'link': return Eye
      case 'webpage': return Eye
      case 'pdf-drive': return FileText
      case 'vimeo': return Play
      case 'youtube': return Play
      case 'download': return Download
      case 'embedded': return Eye
      case 'vtub': return Play
      case 'video': return Play
      case 'text': return FileText
      case 'quiz': return Eye
      default: return Eye
    }
  }

  const isExternalUrl = (url: string) => {
    try {
      const urlObj = new URL(url)
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
    } catch {
      return false
    }
  }

  const openExternalUrl = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const getVideoEmbedUrl = (url: string) => {
    // YouTube
    const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
    const youtubeMatch = url.match(youtubeRegex)
    if (youtubeMatch) {
      return `https://www.youtube.com/embed/${youtubeMatch[1]}`
    }

    // Vimeo
    const vimeoRegex = /vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^\/]*)\/videos\/|album\/(?:\d+)\/video\/|)(\d+)(?:$|\/|\?)/
    const vimeoMatch = url.match(vimeoRegex)
    if (vimeoMatch) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`
    }

    // Se for arquivo de vídeo direto (.mp4, .webm, etc), retornar null para usar tag <video>
    if (/\.(mp4|webm|ogg|mov)$/i.test(url)) {
      return null
    }

    // Para outros tipos, retornar a URL original (pode ser iframe de outra plataforma)
    return url
  }

  const renderContent = () => {
    if (!selectedContent) return null

    switch (selectedContent.type) {
      case 'youtube':
      case 'vimeo':
      case 'video':
        if (selectedContent.video_url && isExternalUrl(selectedContent.video_url)) {
          const embedUrl = getVideoEmbedUrl(selectedContent.video_url)

          // Se for arquivo de vídeo direto (.mp4, .webm, etc)
          if (embedUrl === null) {
            return (
              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  controls
                  className="w-full h-full"
                  src={selectedContent.video_url}
                >
                  Your browser does not support the video element.
                </video>
              </div>
            )
          }

          // Se for YouTube, Vimeo ou outra plataforma de embed
          return (
            <div className="aspect-video bg-black rounded-lg overflow-hidden">
              <iframe
                src={embedUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={selectedContent.title}
              />
            </div>
          )
        }

        // Fallback se não houver URL
        return (
          <div className="aspect-video bg-black rounded-lg overflow-hidden">
            <div className="w-full h-full flex items-center justify-center text-white">
              <div className="text-center">
                <Play className="w-16 h-16 mx-auto mb-4 text-blue-500" />
                <p>Video: {selectedContent.title}</p>
                {selectedContent.duration && (
                  <p className="text-sm text-gray-400 mt-2">Duration: {selectedContent.duration}</p>
                )}
              </div>
            </div>
          </div>
        )

      case 'audio':
        if (selectedContent.video_url && isExternalUrl(selectedContent.video_url)) {
          return (
            <div className="text-center py-12">
              <Play className="w-16 h-16 mx-auto mb-4 text-green-600" />
              <h3 className="text-xl font-semibold mb-4">Audio: {selectedContent.title}</h3>
              <audio controls className="mx-auto mb-4">
                <source src={selectedContent.video_url} type="audio/mpeg" />
                Your browser does not support the audio element.
              </audio>
              {selectedContent.content && (
                <p className="text-gray-600 max-w-md mx-auto">{selectedContent.content}</p>
              )}
            </div>
          )
        }
        return (
          <div className="text-center py-12">
            <Play className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600">Audio not available</p>
          </div>
        )

      case 'html':
        if (selectedContent.video_url) {
          return (
            <div className="border rounded-lg overflow-hidden">
              <div
                className="p-6"
                dangerouslySetInnerHTML={{ __html: selectedContent.video_url }}
              />
            </div>
          )
        }
        return (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600">HTML content not available</p>
          </div>
        )

      case 'vtub':
      case 'embedded':
        if (selectedContent.video_url) {
          // Se for código embed HTML
          if (selectedContent.video_url.includes('<iframe') || selectedContent.video_url.includes('<embed')) {
            return (
              <div className="border rounded-lg overflow-hidden">
                <div
                  className="aspect-video"
                  dangerouslySetInnerHTML={{ __html: selectedContent.video_url }}
                />
              </div>
            )
          }
          // Se for URL, criar iframe
          return (
            <div className="aspect-video bg-black rounded-lg overflow-hidden">
              <iframe
                src={selectedContent.video_url}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={selectedContent.title}
              />
            </div>
          )
        }
        return (
          <div className="text-center py-12">
            <Play className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600">Embedded content not available</p>
          </div>
        )

      case 'pdf-drive':
        if (selectedContent.video_url && isExternalUrl(selectedContent.video_url)) {
          return (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 mx-auto mb-4 text-red-600" />
              <h3 className="text-xl font-semibold mb-4">PDF: {selectedContent.title}</h3>
              <p className="text-gray-600 mb-6">
                {selectedContent.content || 'Click the button below to view the PDF.'}
              </p>
              <button
                onClick={() => openExternalUrl(selectedContent.video_url!)}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                View PDF
              </button>
            </div>
          )
        }
        return (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600">PDF not available</p>
          </div>
        )

      case 'webpage':
      case 'link':
        if (selectedContent.video_url && isExternalUrl(selectedContent.video_url)) {
          return (
            <div className="text-center py-12">
              <Eye className="w-16 h-16 mx-auto mb-4 text-blue-400" />
              <h3 className="text-xl font-semibold mb-4">{selectedContent.title}</h3>
              <p className="text-gray-600 mb-6">
                {selectedContent.content || 'Click the button below to access the link.'}
              </p>
              <button
                onClick={() => openExternalUrl(selectedContent.video_url!)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 mx-auto"
              >
                Access Link
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </button>
            </div>
          )
        }
        return (
          <div className="text-center py-12">
            <Eye className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600">Link not available</p>
          </div>
        )

      case 'download':
        return (
          <div className="text-center py-8 sm:py-12 px-4">
            <Download className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-blue-400" />
            <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Download Material</h3>
            <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">
              {selectedContent.file_url && isExternalUrl(selectedContent.file_url)
                ? 'Click the button below to access the material.'
                : 'Click the button below to download the material.'}
            </p>
            {selectedContent.file_url && isExternalUrl(selectedContent.file_url) ? (
              <button
                onClick={() => openExternalUrl(selectedContent.file_url!)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg text-sm sm:text-base font-medium transition-colors"
              >
                Access Material
              </button>
            ) : selectedContent.video_url && isExternalUrl(selectedContent.video_url) ? (
              <button
                onClick={() => openExternalUrl(selectedContent.video_url!)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg text-sm sm:text-base font-medium transition-colors"
              >
                Download
              </button>
            ) : (
              <div className="text-gray-500">Download not available</div>
            )}
          </div>
        )

      case 'text':
        return (
          <div className="space-y-4">
            <div
              className="prose prose-sm sm:prose-base lg:prose-lg max-w-none text-gray-300"
              dangerouslySetInnerHTML={{ __html: selectedContent.content || '' }}
            />
            {selectedContent.video_url && isExternalUrl(selectedContent.video_url) && (
              <div className="border-t pt-4 mt-6">
                <h4 className="font-medium mb-2">Related Link:</h4>
                <button
                  onClick={() => openExternalUrl(selectedContent.video_url!)}
                  className="text-blue-400 hover:text-blue-700 underline flex items-center gap-1"
                >
                  Open Link
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )

      case 'quiz':
        return (
          <div className="text-center py-12">
            <Eye className="w-16 h-16 mx-auto mb-4 text-green-600" />
            <h3 className="text-xl font-semibold mb-4">Interactive Quiz</h3>
            <p className="text-gray-600 mb-6">
              {selectedContent.content || 'Test your knowledge with interactive questions.'}
            </p>
            {selectedContent.video_url && isExternalUrl(selectedContent.video_url) ? (
              <button
                onClick={() => openExternalUrl(selectedContent.video_url!)}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 mx-auto"
              >
                <Eye className="w-4 h-4" />
                Open Quiz
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </button>
            ) : (
              <button className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors">
                Start Quiz
              </button>
            )}
          </div>
        )

      default:
        // Check if there is any external URL to show button
        const externalUrl = selectedContent.video_url || selectedContent.file_url

        if (externalUrl && isExternalUrl(externalUrl)) {
          return (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-4">{selectedContent.title}</h3>
              <p className="text-gray-600 mb-6">
                {selectedContent.content || 'Click the button below to access the content.'}
              </p>
              <button
                onClick={() => openExternalUrl(externalUrl)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 mx-auto"
              >
                Access Content
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </button>
            </div>
          )
        }

        return (
          <div className="text-center py-12">
            <Eye className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600">Content not available</p>
          </div>
        )
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#252941] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('loading')}</p>
        </div>
      </div>
    )
  }

  if (!productData) {
    return (
      <div className="min-h-screen bg-[#252941] flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">{t('errorNotFound')}</p>
          <button
            onClick={() => navigate(`/app/${appId}`)}
            className="mt-4 text-blue-400 hover:text-blue-700 font-medium"
          >
            {t('backToHome')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#252941] pb-20">
      <div className="bg-[#1a1d2e] shadow-xl shadow-black/10 shadow-black/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => navigate(`/app/${appId}`)}
              className="text-gray-600 hover:text-gray-200 transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg overflow-hidden flex-shrink-0">
                {productData.cover_url || productData.logo_url ? (
                  <img
                    src={productData.cover_url || productData.logo_url}
                    alt={productData.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-blue-500 flex items-center justify-center">
                    <span className="text-white font-bold text-lg">
                      {productData.name.charAt(0)}
                    </span>
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-gray-100 truncate">{productData.name}</h1>
                <p className="text-xs sm:text-sm text-gray-600 truncate">{productData.description}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="lg:col-span-1">
            <div className="bg-[#1a1d2e] rounded-lg shadow-xl shadow-black/10 shadow-black/5 p-4 sm:p-6">
              <h2 className="font-semibold text-gray-100 mb-4">{t('common.content')}</h2>
              <div className="space-y-2">
                {productData.contents.map((content) => {
                  const IconComponent = getContentIcon(content.type)
                  return (
                    <button
                      key={content.id}
                      onClick={() => setSelectedContent(content)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${selectedContent?.id === content.id
                        ? 'bg-blue-500/10 border-l-4 border-blue-600 text-blue-700'
                        : 'hover:bg-[#0f1117] text-gray-300'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        {content.cover_url && (
                          <img
                            src={content.cover_url}
                            alt={content.title}
                            className="w-12 h-12 sm:w-14 sm:h-14 object-cover rounded flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {content.title}
                          </p>
                          {content.duration && (
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                              <Clock className="w-3 h-3" />
                              {content.duration}
                            </p>
                          )}
                        </div>
                        {content.completed && (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="bg-[#1a1d2e] rounded-lg shadow-xl shadow-black/10 shadow-black/5 p-4 sm:p-6">
              {selectedContent && (
                <>
                  <div className="mb-4 sm:mb-6">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-100 mb-2">
                      {selectedContent.title}
                    </h2>
                    {selectedContent.duration && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Clock className="w-4 h-4" />
                        <span className="text-xs sm:text-sm">{selectedContent.duration}</span>
                      </div>
                    )}
                  </div>

                  {renderContent()}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}