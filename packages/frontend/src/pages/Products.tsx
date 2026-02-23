import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Edit, Copy, Trash2, ChevronDown, ChevronUp, Upload, X, Palette, Eye, MessageSquare, Rss, Bell, Users, GripVertical } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import ProductLayoutConfigurator from '@/components/ProductLayoutConfigurator'
import ImageUploader from '@/components/ImageUploader'
import ContentModal from '@/components/ContentModal'
import { useAuthStore } from '@/stores/authStore'
import { useOnboarding } from '@/contexts/OnboardingContext'
import OnboardingTooltip from '@/components/OnboardingTooltip'
import { useI18n } from '@/i18n'


interface Product {
  id: string
  application_id: string
  name: string
  slug?: string
  description?: string
  price: number
  type: string
  cover_url?: string
  access_type?: 'email-only' | 'email-password' | 'purchase-code'
  offer_type?: 'main' | 'bonus' | 'order-bump' | 'upsell-downsell'
  release_type?: 'immediate' | 'days-after' | 'fixed-date'
  release_days?: number
  release_date?: string
  platform_ids?: string
  created_at: string
}

interface ProductContent {
  id: string
  product_id: string
  name: string
  type?: string
  url?: string
  description?: string
  cover_url?: string
  logo_url?: string
  attachments?: Array<{ name: string, url: string }>
  order: number
  order_index?: number
}

interface App {
  id: string
  name: string
  slug?: string
}

// Função auxiliar para gerar slug
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove caracteres especiais
    .replace(/[\s_-]+/g, '-') // Substitui espaços, underscores por hífen
    .replace(/^-+|-+$/g, '') // Remove hífens do início e fim
}

// Função para gerar URL de acesso
const generateAccessUrl = (appSlug: string = 'app', productSlug: string): string => {
  const baseUrl = window.location.hostname === 'localhost'
    ? window.location.origin
    : 'https://app.clicknich.com'
  return `${baseUrl}/access/${appSlug}/${productSlug}`
}

function Products({ embedded = false }: { embedded?: boolean }) {
  const { appId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { currentStep, completeStep } = useOnboarding()
  const { t } = useI18n()

  // Validar se appId é um UUID válido ou converter se necessário
  const isValidUUID = (str: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }

  // Se appId não for um UUID válido, use um UUID padrão ou gere um
  const validAppId = appId && isValidUUID(appId) ? appId : '550e8400-e29b-41d4-a716-446655440000'

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [app, setApp] = useState<App | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [contents, setContents] = useState<{ [key: string]: ProductContent[] }>({})
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())
  const [showModal, setShowModal] = useState(false)
  const [showLayoutConfigurator, setShowLayoutConfigurator] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showContentModal, setShowContentModal] = useState(false)
  const [editingContent, setEditingContent] = useState<ProductContent | null>(null)
  const [isEditingContent, setIsEditingContent] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [copiedLink, setCopiedLink] = useState<string | null>(null)
  const [draggedItem, setDraggedItem] = useState<string | null>(null)
  const [dragOverItem, setDragOverItem] = useState<string | null>(null)
  const [draggedProduct, setDraggedProduct] = useState<string | null>(null)
  const [dragOverProduct, setDragOverProduct] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    logo_url: '',
    access_type: 'email-only',
    release_type: 'immediate',
    release_days: '',
    release_date: '',
    offer_type: 'main',
    platform_ids: '',
    description: ''
  })

  useEffect(() => {
    if (validAppId) {
      fetchApp()
      fetchProducts()
    }
  }, [validAppId])

  // Preencher formulário quando produto é selecionado para edição
  useEffect(() => {
    if (selectedProduct) {
      setFormData({
        name: selectedProduct.name || '',
        logo_url: selectedProduct.cover_url || '',
        access_type: selectedProduct.type || 'email-only',
        release_type: selectedProduct.release_type || 'immediate',
        release_days: selectedProduct.release_days?.toString() || '',
        release_date: selectedProduct.release_date ? selectedProduct.release_date.split('T')[0] : '',
        offer_type: selectedProduct.offer_type || 'main',
        platform_ids: Array.isArray(selectedProduct.platform_ids)
          ? selectedProduct.platform_ids.join(', ')
          : (selectedProduct.platform_ids || ''),
        description: selectedProduct.description || ''
      })
    } else {
      // Limpar formulário quando não há produto selecionado
      setFormData({
        name: '',
        logo_url: '',
        access_type: 'email-only',
        release_type: 'immediate',
        release_days: '',
        release_date: '',
        offer_type: 'main',
        platform_ids: '',
        description: ''
      })
    }
  }, [selectedProduct])

  const fetchApp = async () => {
    try {
      const response = await fetch(`https://cgeqtodbisgwvhkaahiy.supabase.co/functions/v1/applications/${validAppId}`, {
        headers: {
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`,
          'x-user-id': user?.id || 'user-default'
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

  const fetchProducts = async () => {
    try {
      const response = await fetch(`https://cgeqtodbisgwvhkaahiy.supabase.co/functions/v1/applications/${validAppId}/products`, {
        headers: {
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`,
          'x-user-id': user?.id || 'user-default'
        }
      })
      if (response.ok) {
        const data = await response.json()

        setProducts(data)

        // Fetch contents for each product
        for (const product of data) {
          fetchProductContents(product.id)
        }
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchProductContents = async (productId: string) => {
    try {
      const url = `https://cgeqtodbisgwvhkaahiy.supabase.co/functions/v1/applications/${validAppId}/products/${productId}/contents`

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`,
          'x-user-id': user?.id || 'user-default'
        }
      })


      if (response.ok) {
        const data = await response.json()

        setContents(prev => ({ ...prev, [productId]: data }))
      } else {
        const errorText = await response.text()
        console.error('[Frontend] ❌ Erro ao buscar conteúdos:', response.status, response.statusText, errorText)
      }
    } catch (error) {
      console.error('[Frontend] Error fetching product contents:', error)
    }
  }

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    try {

      const requestData = {
        ...formData,
        platform_ids: Array.isArray(formData.platform_ids)
          ? formData.platform_ids
          : (formData.platform_ids || '').split(',').map((id: string) => id.trim()).filter(Boolean)
      }



      const url = selectedProduct
        ? `https://cgeqtodbisgwvhkaahiy.supabase.co/functions/v1/applications/${validAppId}/products/${selectedProduct.id}`
        : `https://cgeqtodbisgwvhkaahiy.supabase.co/functions/v1/applications/${validAppId}/products`

      const method = selectedProduct ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`,
          'x-user-id': user?.id || 'user-default'
        },
        body: JSON.stringify(requestData)
      })


      if (response.ok) {
        const result = await response.json()

        await fetchProducts()
        setShowModal(false)
        setSelectedProduct(null)
        resetForm()
        alert(t(selectedProduct ? 'products.alerts.updated' : 'products.alerts.created'))
      } else {
        const errorData = await response.text()
        console.error('[Frontend] Error response:', errorData)
        alert(`${t(selectedProduct ? 'products.alerts.error_update' : 'products.alerts.error_create')}: ${errorData}`)
      }
    } catch (error) {
      console.error('💥 [Frontend] Error creating product:', error)
      alert(t('products.alerts.error_create'))
    }
  }

  const handleDeleteProduct = async (productId: string) => {
    if (confirm(t('products.alerts.confirm_delete'))) {
      try {
        const response = await fetch(`https://cgeqtodbisgwvhkaahiy.supabase.co/functions/v1/applications/${validAppId}/products/${productId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`,
            'x-user-id': user?.id || 'user-default'
          }
        })

        if (response.ok) {
          setProducts(products.filter(p => p.id !== productId))
          alert(t('products.alerts.deleted'))
        } else {
          alert(t('products.alerts.error_delete'))
        }
      } catch (error) {
        console.error('Error deleting product:', error)
        alert(t('products.alerts.error_delete'))
      }
    }
  }

  const toggleProductExpansion = (productId: string) => {
    const newExpanded = new Set(expandedProducts)
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId)
    } else {
      newExpanded.add(productId)
    }
    setExpandedProducts(newExpanded)
  }

  const copyProduct = (product: Product) => {
    navigator.clipboard.writeText(JSON.stringify(product, null, 2))
    alert(t('products.alerts.data_copied'))
  }

  const resetForm = () => {
    setFormData({
      name: '',
      logo_url: '',
      access_type: 'email-only',
      release_type: 'immediate', // Valor padrão
      release_days: '',
      release_date: '',
      offer_type: 'main', // Valor padrão  
      platform_ids: '',
      description: ''
    })
  }

  // Função para atualizar slug automaticamente
  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      slug: generateSlug(name)
    }))
  }

  // Função para copiar link de acesso
  const copyAccessLink = async (product: Product) => {
    try {
      const accessUrl = generateAccessUrl(app?.slug || 'app', product.slug || generateSlug(product.name))
      await navigator.clipboard.writeText(accessUrl)
      setCopiedLink(product.id)
      setTimeout(() => setCopiedLink(null), 2000)
    } catch (err) {
      console.error('Error copying link:', err)
      alert(t('products.alerts.error_copy_link'))
    }
  }

  // Função para compartilhar produto
  const shareProduct = async (product: Product) => {
    const url = generateAccessUrl(app?.slug || 'app', product.slug || generateSlug(product.name))
    const title = `${t('products.access.product_access', { name: product.name })}`
    const text = `${t('products.access.click_link', { name: product.name })}`

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url })
      } catch (err) {

      }
    } else {
      // Fallback para copiar
      copyAccessLink(product)
    }
  }

  // Função para enviar por email
  const sendByEmail = (product: Product) => {
    const url = generateAccessUrl(app?.slug || 'app', product.slug || generateSlug(product.name))
    const subject = encodeURIComponent(`${t('products.access.product_access', { name: product.name })}`)
    const body = encodeURIComponent(`
${t('products.access.hello')}

${t('products.access.access_available', { name: product.name })}

🔗 ${t('products.access.access_link')}: ${url}

${t('products.access.instructions')}
1. ${t('products.access.step1')}
2. ${t('products.access.step2')}
3. ${t('products.access.step3')}

${t('products.access.questions')}

${t('products.access.regards')}
${t('products.access.team', { name: app?.name || '' })}
    `)

    window.open(`mailto:?subject=${subject}&body=${body}`)
  }

  const handleCreateContent = (productId: string) => {
    setSelectedProductId(productId)
    setEditingContent(null)
    setIsEditingContent(false)
    setShowContentModal(true)
  }

  const handleEditContent = (content: any) => {
    setSelectedProductId(content.product_id)
    setEditingContent(content)
    setIsEditingContent(true)
    setShowContentModal(true)
  }

  const handleSaveContent = async (contentData: any) => {
    try {


      if (!selectedProductId) {
        console.error('[Frontend] Product ID not found!')
        alert('Error: Product ID not found')
        return
      }

      const url = isEditingContent
        ? `https://cgeqtodbisgwvhkaahiy.supabase.co/functions/v1/applications/${validAppId}/products/${selectedProductId}/contents/${editingContent?.id}`
        : `https://cgeqtodbisgwvhkaahiy.supabase.co/functions/v1/applications/${validAppId}/products/${selectedProductId}/contents`

      const method = isEditingContent ? 'PUT' : 'POST'

      const payload = {
        ...contentData,
        order_index: isEditingContent ? editingContent?.order_index : ((contents[selectedProductId] as ProductContent[] | undefined)?.length || 0)
      }



      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`,
          'x-user-id': user?.id || 'user-default'
        },
        body: JSON.stringify(payload)
      })



      if (response.ok) {
        const responseData = await response.json()


        await fetchProductContents(selectedProductId)
        setShowContentModal(false)
        setEditingContent(null)
        setIsEditingContent(false)
        alert(isEditingContent ? t('products.alerts.content_updated') : t('products.alerts.content_created'))
      } else {
        const errorData = await response.text()
        console.error('❌ [Frontend] Error response:', errorData)
        alert(`${t(isEditingContent ? 'products.alerts.error_content_update' : 'products.alerts.error_content_create')}: ${errorData}`)
      }
    } catch (error) {
      console.error('💥 [Frontend] Error saving content:', error)
      alert(`${t(isEditingContent ? 'products.alerts.error_content_update' : 'products.alerts.error_content_create')}: ${error}`)
    }
  }

  const handleDeleteContent = async (content: any) => {
    if (confirm(t('products.alerts.confirm_delete_content'))) {
      try {
        const response = await fetch(`https://cgeqtodbisgwvhkaahiy.supabase.co/functions/v1/applications/${validAppId}/products/${content.product_id}/contents/${content.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`,
            'x-user-id': user?.id || 'user-default'
          }
        })

        if (response.ok) {
          await fetchProductContents(content.product_id)
          alert(t('products.alerts.content_deleted'))
        } else {
          alert(t('products.alerts.error_content_delete'))
        }
      } catch (error) {
        console.error('Error deleting content:', error)
        alert(t('products.alerts.error_content_delete'))
      }
    }
  }

  const handleRemoveAttachment = async (contentId: string, attachmentIndex: number) => {
    if (confirm(t('products.alerts.confirm_remove_attachment'))) {
      try {
        // Encontrar o conteúdo atual
        const currentContent = Object.values(contents).flat().find(c => c.id === contentId)
        if (!currentContent) return

        // Criar nova lista de anexos sem o item removido
        const updatedAttachments = currentContent.attachments?.filter((_, index) => index !== attachmentIndex) || []

        const response = await fetch(`https://cgeqtodbisgwvhkaahiy.supabase.co/functions/v1/applications/${validAppId}/products/${currentContent.product_id}/contents/${contentId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`,
            'x-user-id': user?.id || 'user-default'
          },
          body: JSON.stringify({
            name: currentContent.name,
            type: currentContent.type,
            url: currentContent.url,
            description: currentContent.description,
            cover_url: currentContent.cover_url,
            attachments: updatedAttachments,
            order_index: currentContent.order
          })
        })

        if (response.ok) {
          await fetchProductContents(currentContent.product_id)
          alert(t('products.alerts.attachment_removed'))
        } else {
          alert(t('products.alerts.error_remove_attachment'))
        }
      } catch (error) {
        console.error('Error removing attachment:', error)
        alert(t('products.alerts.error_remove_attachment'))
      }
    }
  }

  const getOfferTypeBadge = (type: string) => {
    const labels: Record<string, string> = {
      'main': t('products.offer_types.main'),
      'bonus': t('products.offer_types.bonus'),
      'order-bump': t('products.offer_types.order-bump'),
      'upsell-downsell': t('products.offer_types.upsell-downsell')
    }
    return (
      <span className="text-[10px] text-gray-400">
        {labels[type] || type}
      </span>
    )
  }

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, contentId: string) => {
    setDraggedItem(contentId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, contentId: string) => {
    e.preventDefault()
    setDragOverItem(contentId)
  }

  const handleDragEnd = async (productId: string) => {
    if (!draggedItem || !dragOverItem || draggedItem === dragOverItem) {
      setDraggedItem(null)
      setDragOverItem(null)
      return
    }

    const productContents = [...(contents[productId] || [])]
    const draggedIndex = productContents.findIndex(c => c.id === draggedItem)
    const targetIndex = productContents.findIndex(c => c.id === dragOverItem)

    if (draggedIndex === -1 || targetIndex === -1) return

    // Reordenar array
    const [removed] = productContents.splice(draggedIndex, 1)
    productContents.splice(targetIndex, 0, removed)

    // Atualizar ordem local imediatamente
    setContents(prev => ({ ...prev, [productId]: productContents }))

    // Atualizar ordem no backend
    try {
      const baseUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:5173'
        : 'https://app.clicknich.com'
      const updatePromises = productContents.map((content, index) =>
        fetch(`${baseUrl}/api/contents/${content.id}/order`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: index })
        })
      )
      await Promise.all(updatePromises)

    } catch (error) {
      console.error('[Products] Erro ao atualizar ordem:', error)
      // Recarregar conteúdos em caso de erro
      fetchProductContents(productId)
    }

    setDraggedItem(null)
    setDragOverItem(null)
  }

  // Drag and Drop handlers for Products
  const handleProductDragStart = (e: React.DragEvent, productId: string) => {
    setDraggedProduct(productId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleProductDragOver = (e: React.DragEvent, productId: string) => {
    e.preventDefault()
    setDragOverProduct(productId)
  }

  const handleProductDragEnd = async () => {
    if (!draggedProduct || !dragOverProduct || draggedProduct === dragOverProduct) {
      setDraggedProduct(null)
      setDragOverProduct(null)
      return
    }

    const reorderedProducts = [...products]
    const draggedIndex = reorderedProducts.findIndex(p => p.id === draggedProduct)
    const targetIndex = reorderedProducts.findIndex(p => p.id === dragOverProduct)

    if (draggedIndex === -1 || targetIndex === -1) return

    // Reordenar array
    const [removed] = reorderedProducts.splice(draggedIndex, 1)
    reorderedProducts.splice(targetIndex, 0, removed)

    // Atualizar ordem local imediatamente
    setProducts(reorderedProducts)

    // Atualizar ordem no backend
    try {
      const baseUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:5173'
        : 'https://app.clicknich.com'
      const updatePromises = reorderedProducts.map((product, index) =>
        fetch(`${baseUrl}/api/products/${product.id}/order`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: index })
        })
      )
      await Promise.all(updatePromises)

    } catch (error) {
      console.error('[Products] Erro ao atualizar ordem dos produtos:', error)
      // Recarregar produtos em caso de erro
      fetchProducts()
    }

    setDraggedProduct(null)
    setDragOverProduct(null)
  }

  return (
    <div className={embedded ? "flex-1 flex flex-col" : "min-h-screen bg-gray-50 dark:bg-[#080b14] flex transition-colors duration-200 relative"}>
      {/* Background glow orbs (dark mode) */}
      {!embedded && (
        <div className="pointer-events-none fixed inset-0 overflow-hidden dark:block hidden">
          <div className="absolute top-[-80px] left-[15%] w-[500px] h-[500px] rounded-full bg-blue-600/20 blur-[120px]" />
          <div className="absolute top-[30%] right-[-60px] w-[400px] h-[400px] rounded-full bg-indigo-500/15 blur-[100px]" />
          <div className="absolute bottom-[10%] left-[5%] w-[350px] h-[350px] rounded-full bg-violet-600/10 blur-[100px]" />
        </div>
      )}

      {!embedded && <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />}

      <div className="flex-1 flex flex-col min-w-0">
        {!embedded && <Header onMenuClick={() => setSidebarOpen(true)} />}

        {/* Navbar Tabs - Fixo abaixo do header */}
        {!embedded && (
          <div className="bg-white dark:bg-[#080b14]/80 dark:backdrop-blur-sm border-b border-gray-200 dark:border-white/10 mt-12 sticky top-12 z-[60] transition-colors duration-200">
            <div className="flex items-center gap-6 px-6">
              <button
                onClick={() => navigate(-1)}
                className="py-2 text-xs font-medium border-b-2 border-blue-400 text-blue-400 flex items-center gap-2"
              >
                <ArrowLeft size={14} />
                {t('products.back')}
              </button>
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto relative z-10">
          <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6">
            {/* Page Actions */}
            <div className="flex justify-end mb-6">
              {currentStep === 'create-product' ? (
                <OnboardingTooltip
                  title={t('products.onboarding.create_title')}
                  description={t('products.onboarding.create_description')}
                  position="left"
                  onComplete={() => completeStep('create-product')}
                  showPulse={true}
                >
                  <button
                    onClick={() => {
                      setSelectedProduct(null)
                      setShowModal(true)
                    }}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded-lg text-sm font-medium transition-colors bg-transparent"
                  >
                    <Plus className="w-4 h-4" />
                    {t('products.new_product')}
                  </button>
                </OnboardingTooltip>
              ) : (
                <button
                  onClick={() => {
                    setSelectedProduct(null)
                    setShowModal(true)
                  }}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded-lg text-sm font-medium transition-colors bg-transparent"
                >
                  <Plus className="w-4 h-4" />
                  {t('products.new_product')}
                </button>
              )}
            </div>

            {/* Products List */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent"></div>
                <p className="mt-4 text-gray-500 dark:text-gray-400 text-sm transition-colors duration-200">{t('products.loading')}</p>
              </div>
            ) : products.length === 0 ? null : (
              <div className="space-y-4">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className={`bg-white dark:bg-white/5 dark:backdrop-blur-xl rounded-lg shadow-lg shadow-black/5 dark:shadow-black/20 border transition-all duration-200 hover:shadow-xl hover:shadow-blue-500/5 ${dragOverProduct === product.id
                      ? 'border-2 border-blue-500 bg-blue-500/10'
                      : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
                      }`}
                    draggable
                    onDragStart={(e) => handleProductDragStart(e, product.id)}
                    onDragOver={(e) => handleProductDragOver(e, product.id)}
                    onDragEnd={handleProductDragEnd}
                  >
                    {/* Product Header */}
                    <div className="flex items-center p-2 gap-2">
                      {/* Ícone de arrastar */}
                      <div className="cursor-move text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                        <GripVertical size={14} />
                      </div>

                      <div className="w-8 h-8 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-[#252941] dark:to-[#1a1d2e] rounded-md flex items-center justify-center overflow-hidden border border-gray-300 dark:border-[#3a3f5c]">
                        {product.cover_url ? (
                          <img src={product.cover_url} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="text-blue-400 text-xs font-bold">
                            {product.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{product.name}</h3>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {product.platform_ids && (
                            <span className="text-blue-400 font-mono text-[10px] bg-blue-500/10 px-1.5 py-0.5 rounded">{product.platform_ids}</span>
                          )}
                          {getOfferTypeBadge(product.offer_type || 'main')}
                        </div>
                      </div>

                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => {
                            setSelectedProduct(product)
                            setShowModal(true)
                          }}
                          className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-all duration-200"
                          title={t('products.edit_product')}
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(product.id)}
                          className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 rounded transition-all duration-200"
                          title={t('products.delete_product')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Expandable Contents Section */}
                    <div className="border-t border-gray-200 dark:border-[#252941]">
                      <button
                        onClick={() => toggleProductExpansion(product.id)}
                        className="w-full flex items-center justify-between px-2 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-[#252941]/50 transition-all duration-200 group"
                      >
                        <span className="text-xs text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors">{t('products.view_contents')}</span>
                        <ChevronDown size={14} className={`text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-all duration-200 ${expandedProducts.has(product.id) ? 'rotate-0' : 'rotate-[-90deg]'
                          }`} />
                      </button>

                      {expandedProducts.has(product.id) && (
                        <div className="border-t border-gray-200 dark:border-[#252941] bg-gray-50 dark:bg-[#0f1117]/50 p-2">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-xs text-gray-800 dark:text-gray-200">{t('products.content')}</h4>
                            <button
                              onClick={() => handleCreateContent(product.id)}
                              className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 text-[10px] rounded transition-all duration-200 flex items-center gap-1 shadow-lg shadow-blue-500/20"
                            >
                              <Plus size={12} />
                              {t('products.new_content')}
                            </button>
                          </div>

                          {contents[product.id]?.length ? (
                            <div className="space-y-1">
                              {contents[product.id].map((content) => (
                                <div
                                  key={content.id}
                                  className={`flex items-center gap-2 p-1.5 bg-white dark:bg-white/5 dark:backdrop-blur-sm rounded transition-all duration-200 hover:bg-gray-50 dark:hover:bg-white/10 ${dragOverItem === content.id
                                    ? 'border-2 border-blue-500 bg-blue-500/10'
                                    : 'border border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
                                    }`}
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, content.id)}
                                  onDragOver={(e) => handleDragOver(e, content.id)}
                                  onDragEnd={() => handleDragEnd(product.id)}
                                >
                                  {/* Ícone de arrastar */}
                                  <div className="cursor-move text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                                    <GripVertical size={12} />
                                  </div>

                                  <div className="w-6 h-6 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-[#252941] dark:to-[#1a1d2e] rounded flex items-center justify-center overflow-hidden border border-gray-300 dark:border-[#3a3f5c]">
                                    {content.cover_url ? (
                                      <img src={content.cover_url} alt={content.name} className="w-full h-full object-cover rounded" />
                                    ) : content.logo_url ? (
                                      <img src={content.logo_url} alt={content.name} className="w-full h-full object-cover rounded" />
                                    ) : (
                                      <div className="text-blue-400 text-[10px] font-bold">
                                        {content.name.charAt(0).toUpperCase()}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <span className="font-medium text-xs text-gray-800 dark:text-gray-200">{content.name}</span>
                                    {content.description && (
                                      <div
                                        className="text-xs text-gray-500 mt-0.5 truncate [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:list-decimal [&>ol]:pl-4 [&>a]:text-blue-400 [&>a]:underline"
                                        dangerouslySetInnerHTML={{ __html: content.description }}
                                      />
                                    )}
                                    {content.attachments && content.attachments.length > 0 && (
                                      <div className="mt-1.5">
                                        <p className="text-[10px] text-gray-500 mb-1">{t('products.attachments')}:</p>
                                        <div className="flex flex-wrap gap-1">
                                          {content.attachments.map((attachment: any, index: number) => (
                                            <div key={index} className="flex items-center gap-1 bg-gray-100 dark:bg-[#0f1117] border border-gray-200 dark:border-[#252941] px-1.5 py-0.5 rounded text-[10px]">
                                              <span className="text-blue-400 truncate max-w-24" title={attachment.name}>
                                                {attachment.name}
                                              </span>
                                              <button
                                                onClick={() => handleRemoveAttachment(content.id, index)}
                                                className="text-gray-500 hover:text-red-400 transition-colors"
                                                title={t('products.remove_attachment')}
                                              >
                                                <X size={10} />
                                              </button>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-0.5">
                                    <button
                                      onClick={() => handleEditContent(content)}
                                      className="p-1 text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-all duration-200"
                                    >
                                      <Edit size={12} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteContent(content)}
                                      className="p-1 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 rounded transition-all duration-200"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-3 border border-dashed border-gray-300 dark:border-[#252941] rounded bg-gray-50 dark:bg-[#1a1d2e]/30">
                              <p className="text-gray-500 text-xs">
                                {t('products.no_content')}
                              </p>
                              <p className="text-gray-600 text-[10px] mt-0.5">
                                {t('products.no_content_hint')}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Create Product Modal */}
          {showModal && (
            <div className="fixed inset-0 bg-black/60 z-[70] flex items-end justify-center p-4 pb-6">
              <div className="bg-white dark:bg-gradient-to-br dark:from-[#151825] dark:via-[#1a2035] dark:via-50% dark:to-[#1a3050] border border-gray-200 dark:border-[#2a4060] rounded-lg shadow-2xl w-full max-w-sm max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200 dark:border-[#2a4060]">
                  <div>
                    <h2 className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                      {selectedProduct ? t('products.modal.edit_title') : t('products.modal.new_title')}
                    </h2>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {selectedProduct ? t('products.modal.edit_subtitle') : t('products.modal.new_subtitle')}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowModal(false)
                      setSelectedProduct(null)
                      resetForm()
                    }}
                    className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-100 p-1 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleCreateProduct} className="px-3 py-3 space-y-2.5">
                  {/* Logo Upload */}
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('products.modal.product_logo')}
                    </label>
                    <ImageUploader
                      onImageSelect={(imageData) => setFormData(prev => ({ ...prev, logo_url: imageData }))}
                      currentImage={formData.logo_url}
                      placeholder={t('products.modal.upload_placeholder')}
                      aspectRatio="logo"
                    />
                  </div>

                  {/* Product Name */}
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('products.modal.product_name')} <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder={t('products.modal.name_placeholder')}
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-[#0f1117] border border-gray-300 dark:border-[#252941] rounded-lg focus:outline-none focus:border-blue-500/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600"
                    />
                  </div>

                  {/* Release Type */}
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('products.modal.release_type')} <span className="text-red-400">*</span>
                    </label>
                    <select
                      required
                      value={formData.release_type}
                      onChange={(e) => setFormData(prev => ({ ...prev, release_type: e.target.value }))}
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-[#0f1117] border border-gray-300 dark:border-[#252941] rounded-lg focus:outline-none focus:border-blue-500/50 text-gray-900 dark:text-gray-100"
                    >
                      <option value="">{t('products.modal.release_type_placeholder')}</option>
                      <option value="immediate">{t('products.modal.release_immediate')}</option>
                      <option value="days-after">{t('products.modal.release_days_after')}</option>
                      <option value="fixed-date">{t('products.modal.release_fixed_date')}</option>
                    </select>
                  </div>

                  {/* Release Days - Conditional */}
                  {formData.release_type === 'days-after' && (
                    <div>
                      <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('products.modal.days_after_purchase')} <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="number"
                        required
                        min="1"
                        max="365"
                        value={formData.release_days}
                        onChange={(e) => setFormData(prev => ({ ...prev, release_days: e.target.value }))}
                        placeholder={t('products.modal.days_placeholder')}
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-[#0f1117] border border-gray-300 dark:border-[#252941] rounded-lg focus:outline-none focus:border-blue-500/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600"
                      />
                    </div>
                  )}

                  {/* Release Date - Conditional */}
                  {formData.release_type === 'fixed-date' && (
                    <div>
                      <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('products.modal.release_date')} <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="date"
                        lang="en-US"
                        required
                        value={formData.release_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, release_date: e.target.value }))}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-[#0f1117] border border-gray-300 dark:border-[#252941] rounded-lg focus:outline-none focus:border-blue-500/50 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                  )}

                  {/* Offer Type */}
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('products.modal.offer_type')} <span className="text-red-400">*</span>
                    </label>
                    <select
                      required
                      value={formData.offer_type}
                      onChange={(e) => setFormData(prev => ({ ...prev, offer_type: e.target.value }))}
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-[#0f1117] border border-gray-300 dark:border-[#252941] rounded-lg focus:outline-none focus:border-blue-500/50 text-gray-900 dark:text-gray-100"
                    >
                      <option value="">{t('products.modal.offer_type_placeholder')}</option>
                      <option value="main">{t('products.modal.offer_main')}</option>
                      <option value="bonus">{t('products.modal.offer_bonus')}</option>
                      <option value="order-bump">{t('products.modal.offer_order_bump')}</option>
                      <option value="upsell-downsell">{t('products.modal.offer_upsell')}</option>
                    </select>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-[#2a4060]">
                    <button
                      type="button"
                      onClick={() => {
                        setShowModal(false)
                        setSelectedProduct(null)
                        resetForm()
                      }}
                      className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 transition-colors"
                    >
                      {t('products.modal.cancel')}
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                    >
                      {selectedProduct ? t('products.modal.update') : t('products.modal.create')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Product Layout Configurator */}
          <ProductLayoutConfigurator
            isOpen={showLayoutConfigurator}
            onClose={() => setShowLayoutConfigurator(false)}
            onSave={(config) => {
              // Aqui você salvaria as configurações do layout padrão

              alert(t('products.alerts.layout_saved'))
            }}
          />

          {/* Content Modal */}
          <ContentModal
            isOpen={showContentModal}
            onClose={() => {
              setShowContentModal(false)
              setEditingContent(null)
              setIsEditingContent(false)
            }}
            onSave={handleSaveContent}
            content={editingContent}
            isEditing={isEditingContent}
          />
        </main>
      </div >
    </div >
  )
}

export default Products