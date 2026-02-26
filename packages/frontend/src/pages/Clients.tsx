import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useI18n } from '@/i18n'
import Header from '@/components/Header'
import { User, Package, ShoppingCart, CheckCircle, XCircle, Plus, X, Mail, Lock, Eye, EyeOff, Edit, Search, Download, Upload, Trash2, Calendar } from 'lucide-react'

interface Product {
  id: string
  name: string
}

interface App {
  id: string
  name: string
}

interface ProductAccess {
  id: string
  product_id: string
  access_type: string
  purchase_code?: string
  purchase_platform?: string
  purchase_date?: string
  is_active: boolean
  products?: {
    id: string
    name: string
  }
}

interface Client {
  id: string
  email: string
  created_at: string
  user_product_access?: ProductAccess[]
}

export default function Clients() {
  const { t } = useI18n()
  const { appId } = useParams()
  const [clients, setClients] = useState<Client[]>([])
  const [apps, setApps] = useState<App[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    selectedApp: '',
    selectedProducts: [] as string[]
  })
  const [showPassword, setShowPassword] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  const [selectedClients, setSelectedClients] = useState<string[]>([])
  const [dateFilter, setDateFilter] = useState('')

  useEffect(() => {
    fetchApps()
  }, [])

  useEffect(() => {
    if (formData.selectedApp) {

      fetchProducts(formData.selectedApp)
      fetchClients(formData.selectedApp)
    }
  }, [formData.selectedApp])

  const fetchApps = async () => {
    try {
      setLoading(true)
      // Fetch apps directly from Supabase REST API
      const response = await supabaseRestFetch('applications?select=id,name,slug')
      const data = await response.json()

      // Ensure data is an array
      if (Array.isArray(data)) {
        setApps(data)
      } else {
        console.error('Apps data is not an array:', data)
        setApps([])
      }

      // If there's appId in the URL, auto-select (useEffect will fetch clients)
      if (appId) {
        setFormData(prev => ({ ...prev, selectedApp: appId }))
      }
    } catch (error) {
      console.error('Error fetching apps:', error)
      setApps([])
    } finally {
      setLoading(false)
    }
  }

  const fetchProducts = async (selectedAppId: string) => {
    try {

      // Fetch products directly from Supabase REST API
      const response = await supabaseRestFetch(`products?application_id=eq.${selectedAppId}&select=id,name,price`)
      const data = await response.json()


      // Ensure data is an array
      if (Array.isArray(data)) {
        setProducts(data)
      } else {
        console.error('Products data is not an array:', data)
        setProducts([])
      }
    } catch (error) {
      console.error('Error fetching products:', error)
      setProducts([])
    }
  }

  const fetchClients = async (selectedAppId: string) => {
    try {
      setLoading(true)

      // 1. Buscar todos os clientes da app (1 requisição)
      const response = await supabaseRestFetch(`app_users?application_id=eq.${selectedAppId}&select=*`)
      const clientsData = await response.json()

      if (!Array.isArray(clientsData) || clientsData.length === 0) {
        setClients([])
        return
      }

      // 2. Buscar TODOS os acessos de produto de uma vez (1 requisição)
      const userIds = clientsData.map((c: any) => c.user_id).filter(Boolean)
      const accessResponse = await supabaseRestFetch(`user_product_access?user_id=in.(${userIds.join(',')})&select=*`)
      const allAccessData = await accessResponse.json()

      // 3. Buscar TODOS os produtos únicos de uma vez (1 requisição)
      const productIds = [...new Set((allAccessData || []).map((a: any) => a.product_id).filter(Boolean))]
      let productsMap: Record<string, any> = {}

      if (productIds.length > 0) {
        const productsResponse = await supabaseRestFetch(`products?id=in.(${productIds.join(',')})&select=id,name`)
        const productsData = await productsResponse.json()
        productsMap = (productsData || []).reduce((acc: any, p: any) => ({ ...acc, [p.id]: p }), {})
      }

      // 4. Montar os dados no cliente (memória, sem requisições)
      const clientsWithProducts = clientsData.map((client: any) => {
        const clientAccess = (allAccessData || [])
          .filter((a: any) => a.user_id === client.user_id)
          .map((access: any) => ({
            ...access,
            products: productsMap[access.product_id] || null
          }))

        return {
          ...client,
          user_product_access: clientAccess
        }
      })

      setClients(clientsWithProducts)
    } catch (error) {
      console.error('Error fetching clients:', error)
      setClients([])
    } finally {
      setLoading(false)
    }
  }

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.email || !formData.selectedApp) {
      alert('Please fill in all required fields')
      return
    }

    setSaving(true)
    try {
      // Create user and access via edge function (uses service role - bypasses RLS)
      const response = await supabaseFetch('clients', {
        method: 'POST',
        body: JSON.stringify({
          email: formData.email,
          applicationId: formData.selectedApp,
          productIds: formData.selectedProducts
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Error creating client:', errorData)
        throw new Error(errorData.error || 'Error creating client')
      }

      const result = await response.json()


      alert('Client added successfully!')
      setShowModal(false)
      setFormData({ email: '', password: '', selectedApp: '', selectedProducts: [] })
      fetchClients(formData.selectedApp)
    } catch (error) {
      console.error('Error adding client:', error)
      alert(`Error adding client: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  const handleEditClient = (client: Client) => {
    setEditingClient(client)
    const productIds = client.user_product_access?.map(access => access.product_id) || []
    setFormData({
      email: client.email,
      password: '',
      selectedApp: formData.selectedApp,
      selectedProducts: productIds
    })
    setShowModal(true)
  }

  const handleUpdateClient = async () => {
    if (!editingClient) return

    setSaving(true)
    try {
      // 1. Update password if provided
      if (formData.password) {
        const response = await supabaseFetch(`clients/${editingClient.id}/password`, {
          method: 'PUT',
          body: JSON.stringify({ password: formData.password })
        })

        if (!response.ok) {
          throw new Error('Error updating password')
        }
      }

      // 2. Update products
      const currentProductIds = editingClient.user_product_access?.map(a => a.product_id) || []
      const newProductIds = formData.selectedProducts

      // Products to add
      const toAdd = newProductIds.filter(id => !currentProductIds.includes(id))
      // Products to remove
      const toRemove = currentProductIds.filter(id => !newProductIds.includes(id))

      // Remove access
      for (const productId of toRemove) {
        const access = editingClient.user_product_access?.find(a => a.product_id === productId)
        if (access) {
          await supabaseRestFetch(`user_product_access?id=eq.${access.id}`, {
            method: 'DELETE'
          })
        }
      }

      // Add new access
      if (toAdd.length > 0) {
        await supabaseRestFetch('user_product_access', {
          method: 'POST',
          body: JSON.stringify(toAdd.map(productId => ({
            user_id: editingClient.id,
            product_id: productId,
            application_id: formData.selectedApp,
            access_type: 'manual',
            is_active: true
          })))
        })
      }

      alert('Client updated successfully!')
      setShowModal(false)
      setEditingClient(null)
      setFormData({ email: '', password: '', selectedApp: '', selectedProducts: [] })
      fetchClients(formData.selectedApp)
    } catch (error) {
      console.error('Error updating client:', error)
      alert(`Error updating client: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteClient = async (clientId: string, clientEmail: string) => {
    if (!confirm(`Are you sure you want to delete client ${clientEmail}?\n\nThis action cannot be undone.`)) {
      return
    }

    try {
      // Deletar via Edge Function (também deleta do Supabase Auth)
      const response = await supabaseFetch('clients', {
        method: 'DELETE',
        body: JSON.stringify({
          clientId: clientId,
          table: 'app_users',
          deleteFromAuth: true
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error deleting client')
      }

      alert('Client deleted successfully!')
      setClients(prev => prev.filter(c => c.id !== clientId))
      setSelectedClients(prev => prev.filter(id => id !== clientId))
    } catch (error) {
      console.error('Error deleting client:', error)
      alert(`Error deleting client: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleDeleteSelectedClients = async () => {
    if (selectedClients.length === 0) return

    if (!confirm(`Are you sure you want to delete ${selectedClients.length} client(s)?\n\nThis action cannot be undone.`)) {
      return
    }

    try {
      const results = await Promise.all(
        selectedClients.map(clientId =>
          supabaseFetch('clients', {
            method: 'DELETE',
            body: JSON.stringify({
              clientId: clientId,
              table: 'app_users',
              deleteFromAuth: true
            })
          })
        )
      )

      const failed = results.filter(r => !r.ok).length

      if (failed > 0) {
        alert(`${selectedClients.length - failed} deleted, ${failed} failed.`)
      } else {
        alert(`${selectedClients.length} client(s) deleted successfully!`)
      }

      const succeededIds = selectedClients.filter((_, i) => results[i].ok)
      setClients(prev => prev.filter(c => !succeededIds.includes(c.id)))
      setSelectedClients([])
    } catch (error) {
      console.error('Error deleting clients:', error)
      alert(`Error deleting clients: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const toggleProductSelection = (productId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedProducts: prev.selectedProducts.includes(productId)
        ? prev.selectedProducts.filter(id => id !== productId)
        : [...prev.selectedProducts, productId]
    }))
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  // Filter clients based on search
  const filteredClients = clients.filter(client => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return client.email.toLowerCase().includes(search)
  })

  const selectedApp = apps.find(app => app.id === formData.selectedApp)

  return (
    <div className="min-h-screen bg-[#0f1117]">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-100">{t('clients.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {selectedApp ? `Manage clients for app ${selectedApp.name}` : 'Select an app to manage clients'}
          </p>
        </div>

        {/* Main action bar */}
        <div className="bg-[#1a1d2e] rounded-lg shadow p-4 mb-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-4 py-2 border border-[#252941] rounded-lg hover:bg-[#0f1117] text-sm text-gray-300">
                <Download className="w-4 h-4" />
                Import
              </button>
              <button className="flex items-center gap-2 px-4 py-2 border border-[#252941] rounded-lg hover:bg-[#0f1117] text-sm text-gray-300">
                <Upload className="w-4 h-4" />
                {t('clients.export')}
              </button>
            </div>

            <div className="flex items-center gap-2">
              {selectedClients.length > 0 && (
                <button
                  className="flex items-center gap-2 px-4 py-2 border border-red-300 bg-red-50 rounded-lg hover:bg-red-100 text-sm text-red-700"
                  onClick={handleDeleteSelectedClients}
                >
                  <Trash2 className="w-4 h-4" />
                  {t('common.delete')} ({selectedClients.length})
                </button>
              )}
              <button
                onClick={() => {
                  if (!formData.selectedApp) {
                    alert('Select an app first')
                    return
                  }
                  setShowModal(true)
                }}
                className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                {t('clients.add_client')}
              </button>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-[#1a1d2e] rounded-lg shadow p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Select de App */}
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">
                App
              </label>
              <select
                value={formData.selectedApp}
                onChange={(e) => {
                  const appId = e.target.value

                  setFormData(prev => ({ ...prev, selectedApp: appId, selectedProducts: [] }))
                  setSearchTerm('')
                  setSelectedClients([])
                  if (!appId) {
                    setClients([])
                    setProducts([])
                  }
                }}
                className="w-full px-3 py-2 bg-[#1a1d2e] text-gray-200 border border-[#252941] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400/50 text-sm"
              >
                <option value="">-- Select an app --</option>
                {apps.map(app => (
                  <option key={app.id} value={app.id}>{app.name}</option>
                ))}
              </select>
            </div>

            {/* Campo de Busca */}
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">
                {t('common.search')}
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder={t('clients.search')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 bg-[#1a1d2e] text-gray-200 border border-[#252941] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400/50 text-sm"
                  disabled={!formData.selectedApp}
                />
              </div>
            </div>

            {/* Filtro de Data */}
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">
                Registration Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  lang="en-US"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 bg-[#1a1d2e] text-gray-200 border border-[#252941] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400/50 text-sm"
                  disabled={!formData.selectedApp}
                />
              </div>
            </div>
          </div>
        </div>

        {!formData.selectedApp ? (
          <div className="bg-[#1a1d2e] rounded-lg shadow p-12 text-center">
            <User className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-100">Select an app</h3>
            <p className="mt-2 text-sm text-gray-500">
              Choose an app above to view and manage your clients.
            </p>
          </div>
        ) : (
          <>
            {/* Info and actions */}
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-gray-600">
                Showing {filteredClients.length} of {clients.length} clients
              </div>
              {(searchTerm || dateFilter) && (
                <button
                  onClick={() => {
                    setSearchTerm('')
                    setDateFilter('')
                  }}
                  className="text-sm text-blue-400 hover:text-blue-700"
                >
                  Clear filters
                </button>
              )}
            </div>

            {loading ? (
              <div className="bg-[#1a1d2e] rounded-lg shadow p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">{t('common.loading')}</p>
              </div>
            ) : clients.length === 0 ? (
              <div className="bg-[#1a1d2e] rounded-lg shadow p-12 text-center">
                <User className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-4 text-lg font-medium text-gray-100">{t('clients.no_clients')}</h3>
                <p className="mt-2 text-sm text-gray-500 mb-4">
                  Add clients manually or they will appear automatically when they purchase through integrations.
                </p>
                <button
                  onClick={() => setShowModal(true)}
                  className="inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  {t('clients.add_client')}
                </button>
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="bg-[#1a1d2e] rounded-lg shadow p-12 text-center">
                <Search className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-4 text-lg font-medium text-gray-100">{t('clients.no_clients')}</h3>
                <p className="mt-2 text-sm text-gray-500">
                  Try adjusting the search filters.
                </p>
              </div>
            ) : (
              <div className="bg-[#1a1d2e] rounded-lg shadow overflow-hidden">
                <table className="w-full">
                  <thead className="bg-[#0f1117] border-b border-[#1e2139]">
                    <tr>
                      <th className="py-3 px-4 text-left w-12">
                        <input
                          type="checkbox"
                          checked={selectedClients.length === filteredClients.length && filteredClients.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedClients(filteredClients.map(c => c.id))
                            } else {
                              setSelectedClients([])
                            }
                          }}
                          className="w-4 h-4 text-blue-400 rounded border-[#252941] focus:ring-blue-400/50"
                        />
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-300 uppercase tracking-wider">{t('common.name')}/{t('common.email')}</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-300 uppercase tracking-wider">Products</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-300 uppercase tracking-wider">Registration Date</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-300 uppercase tracking-wider">{t('clients.status')}</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-300 uppercase tracking-wider">{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredClients.map((client) => (
                      <tr key={client.id} className="hover:bg-[#0f1117] transition-colors">
                        <td className="py-4 px-4">
                          <input
                            type="checkbox"
                            checked={selectedClients.includes(client.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedClients([...selectedClients, client.id])
                              } else {
                                setSelectedClients(selectedClients.filter(id => id !== client.id))
                              }
                            }}
                            className="w-4 h-4 text-blue-400 rounded border-[#252941] focus:ring-blue-400/50"
                          />
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1a1d2e]0 to-blue-600 flex items-center justify-center flex-shrink-0">
                              <span className="text-white font-semibold text-sm">
                                {client.email.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-gray-100 truncate">{client.email}</div>
                              <div className="text-xs text-gray-500">ID: {client.id.slice(0, 8)}...</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          {client.user_product_access && client.user_product_access.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {client.user_product_access.map((access) => (
                                <span
                                  key={access.id}
                                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700"
                                >
                                  {access.products?.name || 'Product not found'}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">No products</span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <div className="text-sm text-gray-100">{formatDate(client.created_at)}</div>
                          <div className="text-xs text-gray-500">
                            {new Date(client.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          {client.user_product_access && client.user_product_access.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {client.user_product_access.slice(0, 1).map((access) => (
                                <div key={access.id}>
                                  {access.is_active ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                      <CheckCircle className="w-3 h-3" />
                                      {t('clients.active')}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                      <XCircle className="w-3 h-3" />
                                      {t('clients.inactive')}
                                    </span>
                                  )}
                                </div>
                              ))}
                              {client.user_product_access.length > 1 && (
                                <span className="text-xs text-gray-500">
                                  +{client.user_product_access.length - 1}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[#252941] text-gray-600">
                              {t('client_access.no_access')}
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEditClient(client)}
                              className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-700 bg-blue-500/10 hover:bg-blue-100 rounded-lg transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                              {t('client_access.manage_access')}
                            </button>
                            <button
                              onClick={() => handleDeleteClient(client.id, client.email)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete client"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>

      {/* Add Client Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d2e] rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-[#1a1d2e] border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-100">
                {editingClient ? t('common.edit') : t('clients.add_client')}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false)
                  setEditingClient(null)
                  setFormData({ email: '', password: '', selectedApp: formData.selectedApp, selectedProducts: [] })
                }}
                className="text-gray-400 hover:text-gray-600 p-2 hover:bg-[#252941] rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault()
              editingClient ? handleUpdateClient() : handleAddClient(e)
            }} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {t('clients.client_email')} *
                  </div>
                </label>
                <input
                  type="email"
                  required={!editingClient}
                  disabled={!!editingClient}
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#1a1d2e] text-gray-200 border border-[#252941] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400/50 disabled:bg-[#252941] disabled:cursor-not-allowed"
                  placeholder="client@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Password
                  </div>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-3 py-2 pr-10 bg-[#1a1d2e] text-gray-200 border border-[#252941] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                    placeholder="Enter a password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Leave blank for email-only access
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Produtos
                  </div>
                </label>
                {products.length === 0 ? (
                  <div className="text-sm text-gray-500 p-4 bg-[#0f1117] rounded-lg">
                    No products available in this app
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto border border-[#1e2139] rounded-lg p-3">
                    {products.map(product => (
                      <label
                        key={product.id}
                        className="flex items-center justify-between gap-3 p-3 hover:bg-[#0f1117] rounded-lg cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={formData.selectedProducts.includes(product.id)}
                            onChange={() => toggleProductSelection(product.id)}
                            className="w-4 h-4 text-blue-400 border-[#252941] rounded focus:ring-blue-400/50"
                          />
                          <span className="text-sm text-gray-100">{product.name}</span>
                        </div>
                        {formData.selectedProducts.includes(product.id) && (
                          <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                            Selected
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  {editingClient
                    ? `Selected products: ${formData.selectedProducts.length}. Uncheck to remove access.`
                    : 'Select the products the client will have access to'}
                </p>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setEditingClient(null)
                    setFormData({ email: '', password: '', selectedApp: formData.selectedApp, selectedProducts: [] })
                  }}
                  className="flex-1 px-4 py-2 border border-[#252941] text-gray-300 rounded-lg hover:bg-[#0f1117] transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving
                    ? t('common.loading')
                    : (editingClient ? t('common.save') : t('clients.add_client'))
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
