import { useState, useEffect } from 'react'
import Header from '@/components/Header'
import { Plus, Globe, ExternalLink, Trash2, CheckCircle, AlertCircle, Clock, X, RefreshCw } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/i18n'

interface Domain {
  id: string
  domain: string
  app_id: string
  app_name: string
  status: 'pending' | 'active' | 'error'
  created_at: string
  verified_at?: string
  error_message?: string
}

interface App {
  id: string
  name: string
  slug: string
}

export default function Domains() {
  const { user } = useAuthStore()
  const { t } = useI18n()
  const [domains, setDomains] = useState<Domain[]>([])
  const [apps, setApps] = useState<App[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [newDomain, setNewDomain] = useState({
    domain: '',
    app_id: ''
  })

  useEffect(() => {
    if (user) {
      fetchDomains()
      fetchApps()
    }
  }, [user])

  const fetchDomains = async () => {
    try {
      const response = await fetch('https://api.clicknich.com/api/domains', {
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || ''
        }
      })

      if (response.ok) {
        const data = await response.json()

        setDomains(data)
      } else {
        console.error('Error in response:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Error fetching domains:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchApps = async () => {
    try {
      const response = await fetch('https://api.clicknich.com/api/applications', {
        headers: {
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`,
          'Content-Type': 'application/json',
          'x-user-id': user?.id || ''
        }
      })

      if (response.ok) {
        const data = await response.json()

        setApps(data)
      } else {
        console.error('Erro na resposta:', response.status, response.statusText)
        const errorText = await response.text()
        console.error('Detalhes do erro:', errorText)
      }
    } catch (error) {
      console.error('Erro ao buscar apps:', error)
    }
  }

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newDomain.domain || !newDomain.app_id) {
      alert(t('domains.alerts.fill_all'))
      return
    }

    try {
      const response = await fetch('https://api.clicknich.com/api/domains', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || ''
        },
        body: JSON.stringify({
          domain: newDomain.domain,
          app_id: newDomain.app_id
        })
      })

      if (response.ok) {
        const newDomainData = await response.json()
        setDomains([...domains, newDomainData])
        setNewDomain({ domain: '', app_id: '' })
        setShowAddModal(false)
        alert(t('domains.alerts.added'))

        // Reload domain list
        fetchDomains()
      } else {
        const errorData = await response.json()
        alert(errorData.error || t('domains.alerts.error_add'))
      }
    } catch (error) {
      console.error('Error adding domain:', error)
      alert(t('domains.alerts.error_add'))
    }
  }

  const verifyDomain = async (domainId: string) => {
    try {
      const response = await fetch(`https://api.clicknich.com/api/domains/verify/${domainId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || ''
        }
      })

      if (response.ok) {
        const result = await response.json()

        if (result.status === 'active') {
          alert(t('domains.alerts.verified'))
        } else if (result.status === 'pending') {
          alert(t('domains.alerts.dns_propagating'))
        } else {
          alert(t('domains.alerts.verify_error') + (result.error_message || t('domains.alerts.check_dns')))
        }

        // Reload domain list
        fetchDomains()
      } else {
        const errorData = await response.json()
        alert(errorData.error || t('domains.alerts.error_verify'))
      }
    } catch (error) {
      console.error('Error verifying domain:', error)
      alert(t('domains.alerts.error_verify'))
    }
  }

  const removeDomain = async (domainId: string) => {
    if (!confirm(t('domains.alerts.confirm_remove'))) {
      return
    }

    try {
      const response = await fetch(`https://api.clicknich.com/api/domains/${domainId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || ''
        }
      })

      if (response.ok) {
        // Remove from local list
        setDomains(domains.filter(d => d.id !== domainId))
        alert(t('domains.alerts.removed'))
      } else {
        const errorData = await response.json()
        alert(errorData.error || t('domains.alerts.error_remove'))
      }
    } catch (error) {
      console.error('Error removing domain:', error)
      alert(t('domains.alerts.error_remove'))
    }
  }

  const getStatusIcon = (status: Domain['status']) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-600" />
      default:
        return <Clock className="w-5 h-5 text-yellow-600" />
    }
  }

  const getStatusText = (status: Domain['status']) => {
    switch (status) {
      case 'active':
        return t('domains.status.active')
      case 'error':
        return t('domains.status.error')
      default:
        return t('domains.status.pending')
    }
  }
  return (
    <div className="min-h-screen bg-[#0f1117]">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-100">{t('domains.title')}</h1>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
          >
            <Plus size={18} />
            {t('domains.add_domain')}
          </button>
        </div>

        <div className="bg-[#1a1d2e] rounded-lg shadow p-6">
          <p className="text-gray-600 mb-6">
            {t('domains.subtitle')}
          </p>

          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <p className="mt-2 text-gray-600">{t('domains.loading')}</p>
            </div>
          ) : domains.length === 0 ? (
            <div className="border-2 border-dashed border-[#252941] rounded-lg p-8 text-center">
              <Globe className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 mb-2">{t('domains.empty')}</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="text-blue-400 hover:text-indigo-700 font-medium text-sm"
              >
                {t('domains.empty_hint')}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {domains.map((domain) => (
                <div key={domain.id} className="border border-[#1e2139] rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(domain.status)}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-100">{domain.domain}</span>
                          <span className="text-sm text-gray-500">→ {domain.app_name}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                          <span>{t('domains.labels.status')} {getStatusText(domain.status)}</span>
                          <span>{t('domains.labels.created')} {new Date(domain.created_at).toLocaleDateString('en-US')}</span>
                        </div>
                        {domain.error_message && (
                          <p className="text-sm text-red-600 mt-1">{domain.error_message}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {domain.status === 'pending' && (
                        <button
                          onClick={() => verifyDomain(domain.id)}
                          className="p-2 text-blue-400 hover:text-blue-800 hover:bg-blue-500/10 rounded"
                          title={t('domains.labels.verify_dns')}
                        >
                          <RefreshCw size={16} />
                        </button>
                      )}
                      {domain.status === 'active' && (
                        <a
                          href={`https://${domain.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-gray-400 hover:text-gray-600"
                          title={t('domains.labels.visit_site')}
                        >
                          <ExternalLink size={16} />
                        </a>
                      )}
                      <button
                        onClick={() => removeDomain(domain.id)}
                        className="p-2 text-gray-400 hover:text-red-600"
                        title={t('domains.labels.remove_domain')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-16">
            <h3 className="font-semibold text-gray-100 mb-4">{t('domains.setup.title')}</h3>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <h4 className="font-medium text-yellow-800 mb-2">{t('domains.setup.cloudflare_title')}</h4>
              <p className="text-sm text-yellow-700">
                {t('domains.setup.cloudflare_desc')}
              </p>
            </div>

            <ol className="space-y-3 text-gray-600 text-sm">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-indigo-100 text-blue-400 rounded-full flex items-center justify-center text-xs font-medium">1</span>
                <span>{t('domains.setup.step1')}</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-indigo-100 text-blue-400 rounded-full flex items-center justify-center text-xs font-medium">2</span>
                <div>
                  <span>{t('domains.setup.step2')}</span>
                  <code className="block bg-[#252941] px-3 py-2 rounded mt-2 font-mono text-xs">
                    clicknish.gabrielvettorazzii.workers.dev
                  </code>
                  <p className="text-xs text-gray-500 mt-1">
                    {t('domains.setup.step2_status')}
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-indigo-100 text-blue-400 rounded-full flex items-center justify-center text-xs font-medium">3</span>
                <span>{t('domains.setup.step3')}</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-indigo-100 text-blue-400 rounded-full flex items-center justify-center text-xs font-medium">4</span>
                <span>{t('domains.setup.step4')}</span>
              </li>
            </ol>

            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-medium text-green-900 mb-2">{t('domains.setup.advantages_title')}</h4>
              <ul className="text-sm text-green-800 space-y-1">
                <li>• <strong>{t('domains.setup.adv_ssl')}</strong></li>
                <li>• <strong>{t('domains.setup.adv_setup')}</strong></li>
                <li>• <strong>{t('domains.setup.adv_cdn')}</strong></li>
                <li>• <strong>{t('domains.setup.adv_requests')}</strong></li>
                <li>• <strong>{t('domains.setup.adv_unlimited')}</strong></li>
              </ul>
            </div>

            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">{t('domains.setup.dns_example')}</h4>
              <div className="text-sm text-blue-800">
                <p><strong>{t('domains.setup.dns_type')}</strong> CNAME</p>
                <p><strong>{t('domains.setup.dns_name')}</strong> {t('domains.setup.dns_name_hint')}</p>
                <p><strong>{t('domains.setup.dns_value')}</strong> clicknish.gabrielvettorazzii.workers.dev</p>
                <p><strong>{t('domains.setup.dns_ttl')}</strong> {t('domains.setup.dns_ttl_value')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Add Domain Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#1a1d2e] rounded-lg w-full max-w-md">
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="text-xl font-semibold text-gray-100">{t('domains.modal.title')}</h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddDomain} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {t('domains.modal.domain_label')}
                  </label>
                  <input
                    type="text"
                    value={newDomain.domain}
                    onChange={(e) => setNewDomain({ ...newDomain, domain: e.target.value })}
                    placeholder={t('domains.modal.domain_placeholder')}
                    className="w-full px-3 py-2 bg-[#1a1d2e] text-gray-200 border border-[#252941] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {t('domains.modal.domain_hint')}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {t('domains.modal.app_label')}
                  </label>
                  <select
                    value={newDomain.app_id}
                    onChange={(e) => setNewDomain({ ...newDomain, app_id: e.target.value })}
                    className="w-full px-3 py-2 bg-[#1a1d2e] text-gray-200 border border-[#252941] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    <option value="">{t('domains.modal.app_placeholder')}</option>
                    {apps.map((app) => (
                      <option key={app.id} value={app.id}>
                        {app.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 px-4 py-2 border border-[#252941] text-gray-300 rounded-lg hover:bg-[#0f1117]"
                  >
                    {t('domains.modal.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-indigo-700"
                  >
                    {t('domains.modal.add')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  )

}
