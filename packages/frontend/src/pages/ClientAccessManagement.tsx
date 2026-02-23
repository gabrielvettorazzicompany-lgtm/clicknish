import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useI18n } from '@/i18n'
import { ExternalLink, Copy, CheckCircle, QrCode, Share2, Mail } from 'lucide-react'
import Header from '@/components/Header'

interface App {
  id: string
  name: string
  slug: string
}

interface Product {
  id: string
  name: string
  slug: string
  price: string
  access_type: 'email-only' | 'email-password' | 'purchase-code'
}

export default function ClientAccessManagement() {
  const { t } = useI18n()
  const { appId } = useParams()
  const [app, setApp] = useState<App | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [copiedLink, setCopiedLink] = useState<string | null>(null)

  useEffect(() => {
    if (appId) {
      fetchApp()
      fetchProducts()
    }
  }, [appId])

  const fetchApp = async () => {
    try {
      // TODO: Implement real API call to fetch app data
      // For now, set minimal app data
      setApp({
        id: appId || '',
        name: 'App',
        slug: 'app'
      })
    } catch (error) {
      console.error('Error fetching app:', error)
    }
  }

  const fetchProducts = async () => {
    try {
      // TODO: Implement real API call to fetch products
      // For now, show empty state
      setProducts([])
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  const getAccessUrl = (productSlug: string) => {
    const baseUrl = import.meta.env.MODE === 'production'
      ? 'https://app.clicknich.com'
      : window.location.origin
    return `${baseUrl}/access/${app?.slug}/${productSlug}`
  }

  const copyToClipboard = async (text: string, productId: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedLink(productId)
      setTimeout(() => setCopiedLink(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const shareProduct = async (product: Product) => {
    const url = getAccessUrl(product.slug)
    const title = `Access: ${product.name}`
    const text = `Click the link to access your product: ${product.name}`

    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text,
          url
        })
      } catch (err) {

      }
    } else {
      // Fallback - copiar para clipboard
      copyToClipboard(url, product.id)
    }
  }

  const sendByEmail = (product: Product) => {
    const url = getAccessUrl(product.slug)
    const subject = encodeURIComponent(`Product access: ${product.name}`)
    const body = encodeURIComponent(`
Hello!

Your access to "${product.name}" is now available.

🔗 Access link: ${url}

Instructions:
1. Click the link above
2. Log in with your credentials
3. Start enjoying the content

If you have any questions, please contact us.

Best regards,
${app?.name} Team
    `)

    window.open(`mailto:?subject=${subject}&body=${body}`)
  }

  const getAccessTypeLabel = (type: string) => {
    switch (type) {
      case 'email-only': return 'Email Only'
      case 'email-password': return 'Email and Password'
      case 'purchase-code': return 'Purchase Code'
      default: return type
    }
  }

  if (!app) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-[#252941]/30">
        <Header />
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="text-center py-12">
            <p>{t('common.loading')}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-[#252941]/30">
      <Header />

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link
              to="/dashboard"
              className="text-gray-600 hover:text-gray-100 font-medium"
            >
              ← Dashboard
            </Link>
            <span className="text-gray-400">•</span>
            <Link
              to={`/products/${appId}`}
              className="text-gray-600 hover:text-gray-100 font-medium"
            >
              Products
            </Link>
          </div>

          <h1 className="text-3xl font-bold text-gray-100 mb-3">
            {t('client_access.title')}
          </h1>
          <p className="text-gray-600">
            Manage and share product access links for <strong>{app.name}</strong> app
          </p>
        </div>

        {/* Info Card */}
        <div className="bg-blue-500/10 border border-blue-200 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-blue-900 mb-3">
            🔐 How client access works
          </h2>
          <div className="text-blue-800 space-y-2 text-sm">
            <p>• <strong>Email only:</strong> Client enters only their email to access</p>
            <p>• <strong>Email + Password:</strong> Client logs in with email and password</p>
            <p>• <strong>Purchase Code:</strong> Client enters the code received with purchase</p>
          </div>
        </div>

        {/* Products List */}
        <div className="grid gap-6">
          {products.map(product => (
            <div key={product.id} className="bg-[#1a1d2e] rounded-xl shadow-xl shadow-black/10 border border-[#1e2139] overflow-hidden">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-100 mb-2">{product.name}</h3>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full font-medium">
                        {product.price}
                      </span>
                      <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-medium">
                        {getAccessTypeLabel(product.access_type)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Access URL */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Client access link:
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-[#0f1117] border border-[#1e2139] rounded-lg px-4 py-3">
                      <code className="text-sm text-blue-400 break-all">
                        {getAccessUrl(product.slug)}
                      </code>
                    </div>
                    <button
                      onClick={() => copyToClipboard(getAccessUrl(product.slug), product.id)}
                      className="px-4 py-3 bg-[#252941] hover:bg-gray-200 border border-[#1e2139] rounded-lg transition-colors flex items-center gap-2"
                      title="Copy link"
                    >
                      {copiedLink === product.id ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-sm text-green-600 font-medium">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 text-gray-600" />
                          <span className="text-sm text-gray-600">Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => window.open(getAccessUrl(product.slug), '_blank')}
                    className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {t('funnel_editor.preview')}
                  </button>

                  <button
                    onClick={() => shareProduct(product)}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    <Share2 className="w-4 h-4" />
                    Share
                  </button>

                  <button
                    onClick={() => sendByEmail(product)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    <Mail className="w-4 h-4" />
                    Send by Email
                  </button>

                  <button
                    onClick={() => {
                      // Gerar QR Code (implementar futuramente)
                      alert('QR Code feature coming soon')
                    }}
                    className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    <QrCode className="w-4 h-4" />
                    QR Code
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Help Section */}
        <div className="mt-12 bg-[#0f1117] rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-100 mb-4">
            💡 Tips for sharing with clients
          </h3>
          <div className="grid md:grid-cols-2 gap-6 text-sm text-gray-300">
            <div>
              <h4 className="font-medium mb-2">📧 By Email</h4>
              <p>Send the link directly in the purchase confirmation email along with clear access instructions.</p>
            </div>
            <div>
              <h4 className="font-medium mb-2">💬 By WhatsApp</h4>
              <p>Share the link via WhatsApp for quick and direct access to the purchased product.</p>
            </div>
            <div>
              <h4 className="font-medium mb-2">📱 QR Code</h4>
              <p>Generate QR codes to facilitate access at events or in printed materials.</p>
            </div>
            <div>
              <h4 className="font-medium mb-2">🔗 Direct Link</h4>
              <p>Use the link on thank you pages, member areas or other strategic locations.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}