import { useState, useEffect, useRef } from 'react'
import Header from '@/components/Header'
import Sidebar from '@/components/Sidebar'
import { X, Save, Edit2, Trash2, Eye, EyeOff, ChevronDown, Check } from 'lucide-react'
import { useI18n } from '@/i18n'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/stores/authStore'

interface AvailableProduct {
  id: string
  name: string
  type: 'app' | 'marketplace'
}

interface UtmifyIntegration {
  id: string
  name: string
  products: AvailableProduct[]
  events: string[]
  api_token: string
  is_active: boolean
}

const ALL_EVENTS = [
  { key: 'paid', label: 'integrations.event_paid' },
  { key: 'refused', label: 'integrations.event_refused' },
  { key: 'abandoned', label: 'integrations.event_abandoned' },
  { key: 'refunded', label: 'integrations.event_refunded' },
]

export default function Integrations() {
  const { t } = useI18n()
  const { user } = useAuthStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // UTMify integrations state
  const [utmifyIntegrations, setUtmifyIntegrations] = useState<UtmifyIntegration[]>([])
  const [availableProducts, setAvailableProducts] = useState<AvailableProduct[]>([])
  const [utmifyModal, setUtmifyModal] = useState<{ open: boolean; editing: UtmifyIntegration | null }>({ open: false, editing: null })
  const [utmifyForm, setUtmifyForm] = useState({ name: 'UTMify', products: [] as AvailableProduct[], events: ['paid'] as string[], api_token: '', tokenVisible: false })
  const [utmifySaving, setUtmifySaving] = useState(false)
  const [productsOpen, setProductsOpen] = useState(false)
  const [eventsOpen, setEventsOpen] = useState(false)
  const productsRef = useRef<HTMLDivElement>(null)
  const eventsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (productsRef.current && !productsRef.current.contains(e.target as Node)) setProductsOpen(false)
      if (eventsRef.current && !eventsRef.current.contains(e.target as Node)) setEventsOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (user?.id) {
      fetchUtmifyIntegrations()
      fetchAvailableProducts()
    }
  }, [user?.id])

  const fetchUtmifyIntegrations = async () => {
    if (!user?.id) return
    const { data } = await supabase
      .from('utmify_integrations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (data) setUtmifyIntegrations(data as UtmifyIntegration[])
  }

  const fetchAvailableProducts = async () => {
    if (!user?.id) return
    const [appsRes, mktRes] = await Promise.all([
      supabase.from('applications').select('id, name').eq('owner_id', user.id),
      supabase.from('marketplace_products').select('id, name').eq('owner_id', user.id),
    ])
    const apps: AvailableProduct[] = (appsRes.data || []).map(a => ({ id: a.id, name: a.name, type: 'app' as const }))
    const mkt: AvailableProduct[] = (mktRes.data || []).map(m => ({ id: m.id, name: m.name, type: 'marketplace' as const }))
    setAvailableProducts([...apps, ...mkt])
  }

  const openCreateModal = () => {
    setUtmifyForm({ name: 'UTMify', products: [], events: ['paid'], api_token: '', tokenVisible: false })
    setUtmifyModal({ open: true, editing: null })
  }

  const openEditModal = (integration: UtmifyIntegration) => {
    setUtmifyForm({ name: integration.name, products: integration.products, events: integration.events, api_token: integration.api_token, tokenVisible: false })
    setUtmifyModal({ open: true, editing: integration })
  }

  const saveUtmifyIntegration = async () => {
    if (!user?.id || !utmifyForm.api_token.trim() || !utmifyForm.name.trim()) return
    setUtmifySaving(true)
    const payload = {
      user_id: user.id,
      name: utmifyForm.name.trim(),
      products: utmifyForm.products,
      events: utmifyForm.events,
      api_token: utmifyForm.api_token.trim(),
      is_active: true,
    }
    if (utmifyModal.editing) {
      await supabase.from('utmify_integrations').update(payload).eq('id', utmifyModal.editing.id)
    } else {
      await supabase.from('utmify_integrations').insert(payload)
    }
    setUtmifySaving(false)
    setUtmifyModal({ open: false, editing: null })
    fetchUtmifyIntegrations()
  }

  const deleteUtmifyIntegration = async (id: string) => {
    if (!confirm(t('integrations.confirm_delete'))) return
    await supabase.from('utmify_integrations').delete().eq('id', id)
    fetchUtmifyIntegrations()
  }

  const toggleEvent = (key: string) => {
    setUtmifyForm(f => ({
      ...f,
      events: f.events.includes(key) ? f.events.filter(e => e !== key) : [...f.events, key],
    }))
  }

  const toggleProduct = (product: AvailableProduct) => {
    setUtmifyForm(f => ({
      ...f,
      products: f.products.some(p => p.id === product.id)
        ? f.products.filter(p => p.id !== product.id)
        : [...f.products, product],
    }))
  }


  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#080b14] flex transition-colors duration-200 relative">
      {/* Background glow orbs para efeito blur (dark mode) */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden dark:block hidden">
        <div className="absolute top-[-80px] left-[15%] w-[500px] h-[500px] rounded-full bg-blue-600/20 blur-[120px]" />
        <div className="absolute top-[30%] right-[-60px] w-[400px] h-[400px] rounded-full bg-indigo-500/15 blur-[100px]" />
        <div className="absolute bottom-[10%] left-[5%] w-[350px] h-[350px] rounded-full bg-violet-600/10 blur-[100px]" />
      </div>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto pt-14 relative z-10">
          <div className="max-w-7xl mx-auto px-4 lg:px-6 py-8">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-1">{t('integrations.title')}</h1>
              <p className="text-gray-500 dark:text-gray-500">
                {t('integrations.subtitle')}
              </p>
            </div>

            {/* UTMify Integration */}
            <div className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={openCreateModal}
                    className="cursor-pointer hover:opacity-80 transition-opacity border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 bg-gray-100 dark:bg-white/5"
                  >
                    <img
                      src="https://utmify.com.br/logo/logo-dark.png"
                      alt="UTMify"
                      className="h-6 object-contain brightness-0 dark:brightness-100"
                    />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {utmifyIntegrations.map(integration => (
                  <div key={integration.id} className="bg-white dark:bg-[#1a1d2e] border border-gray-200 dark:border-[#1e2139] rounded-xl p-4 flex items-center justify-between gap-4 shadow-sm dark:shadow-none">
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 dark:text-gray-100 font-medium text-sm">{integration.name}</p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {(integration.products as AvailableProduct[]).slice(0, 4).map(p => (
                          <span key={p.id} className="text-xs bg-gray-100 dark:bg-[#252941] text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-md border border-gray-200 dark:border-transparent">
                            {p.name}
                          </span>
                        ))}
                        {(integration.products as AvailableProduct[]).length > 4 && (
                          <span className="text-xs text-gray-400 dark:text-gray-500">{t('integrations.more', { count: (integration.products as AvailableProduct[]).length - 4 })}</span>
                        )}
                        {(integration.products as AvailableProduct[]).length === 0 && (
                          <span className="text-xs text-gray-400 dark:text-gray-600 italic">{t('integrations.all_products')}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {(integration.events as string[]).map(ev => {
                          const evDef = ALL_EVENTS.find(e => e.key === ev)
                          return evDef ? (
                            <span key={ev} className="text-xs bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-500/20">
                              {t(evDef.label)}
                            </span>
                          ) : null
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => openEditModal(integration)}
                        className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#252941] rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteUtmifyIntegration(integration.id)}
                        className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* UTMify Modal */}
            {utmifyModal.open && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-[#1a1d2e] border border-gray-200 dark:border-[#1e2139] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl shadow-black/20">
                  {/* Modal Header */}
                  <div className="sticky top-0 bg-white dark:bg-[#1a1d2e] border-b border-gray-200 dark:border-[#1e2139] px-6 py-4 flex items-center justify-between rounded-t-2xl">
                    <div className="flex items-center gap-3">
                      <img src="https://utmify.com.br/logo/logo-dark.png" alt="UTMify" className="h-5 object-contain brightness-0 dark:brightness-100" />
                      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        {utmifyModal.editing ? t('integrations.edit_title') : t('integrations.new_integration')}
                      </h2>
                    </div>
                    <button onClick={() => setUtmifyModal({ open: false, editing: null })} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors">
                      <X className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>

                  <div className="p-6 space-y-5">
                    {/* Name */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">{t('integrations.name_label')}</label>
                      <input
                        type="text"
                        value={utmifyForm.name}
                        onChange={e => setUtmifyForm(f => ({ ...f, name: e.target.value }))}
                        placeholder={t('integrations.name_placeholder')}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0f1117] border border-gray-200 dark:border-[#252941] rounded-lg text-gray-900 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors"
                      />
                    </div>

                    {/* Products Dropdown */}
                    <div ref={productsRef}>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                        {t('integrations.products_label')} <span className="text-gray-400 dark:text-gray-600 font-normal">{t('integrations.products_empty_hint')}</span>
                      </label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => { setProductsOpen(o => !o); setEventsOpen(false) }}
                          className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-[#0f1117] border border-gray-200 dark:border-[#252941] rounded-lg text-sm text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors"
                        >
                          <span className="truncate text-left">
                            {utmifyForm.products.length === 0
                              ? <span className="text-gray-400 dark:text-gray-500">{t('integrations.all_products')}</span>
                              : utmifyForm.products.map(p => p.name).join(', ')}
                          </span>
                          <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 ml-2 transition-transform ${productsOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {productsOpen && (
                          <div className="absolute z-10 mt-1 w-full bg-white dark:bg-[#1a1d2e] border border-gray-200 dark:border-[#252941] rounded-lg shadow-lg overflow-hidden">
                            {availableProducts.length === 0 ? (
                              <p className="px-3 py-2 text-xs text-gray-500 italic">{t('integrations.no_products')}</p>
                            ) : (
                              <div className="max-h-48 overflow-y-auto">
                                {availableProducts.map(product => {
                                  const selected = utmifyForm.products.some(p => p.id === product.id)
                                  return (
                                    <button
                                      key={product.id}
                                      type="button"
                                      onClick={() => toggleProduct(product)}
                                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left"
                                    >
                                      <div className={`w-4 h-4 rounded flex-shrink-0 border flex items-center justify-center transition-colors ${selected ? 'bg-blue-600 border-blue-600' : 'border-gray-300 dark:border-[#252941]'
                                        }`}>
                                        {selected && <Check className="w-2.5 h-2.5 text-white" />}
                                      </div>
                                      <span className="text-sm text-gray-900 dark:text-gray-200 flex-1">{product.name}</span>
                                      <span className="text-xs text-gray-400 dark:text-gray-600">{product.type === 'app' ? t('integrations.product_type_app') : t('integrations.product_type_area')}</span>
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {utmifyForm.products.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {utmifyForm.products.map(p => (
                            <span key={p.id} className="inline-flex items-center gap-1 text-xs bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-500/20 px-2 py-0.5 rounded-full">
                              {p.name}
                              <button type="button" onClick={() => toggleProduct(p)} className="hover:text-blue-900 dark:hover:text-white"><X className="w-3 h-3" /></button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Events Dropdown */}
                    <div ref={eventsRef}>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">{t('integrations.events_label')}</label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => { setEventsOpen(o => !o); setProductsOpen(false) }}
                          className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-[#0f1117] border border-gray-200 dark:border-[#252941] rounded-lg text-sm text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors"
                        >
                          <span className="truncate text-left">
                            {utmifyForm.events.length === 0
                              ? <span className="text-gray-400 dark:text-gray-500">—</span>
                              : ALL_EVENTS.filter(e => utmifyForm.events.includes(e.key)).map(e => t(e.label)).join(', ')}
                          </span>
                          <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 ml-2 transition-transform ${eventsOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {eventsOpen && (
                          <div className="absolute z-10 mt-1 w-full bg-white dark:bg-[#1a1d2e] border border-gray-200 dark:border-[#252941] rounded-lg shadow-lg overflow-hidden">
                            {ALL_EVENTS.map(ev => {
                              const selected = utmifyForm.events.includes(ev.key)
                              return (
                                <button
                                  key={ev.key}
                                  type="button"
                                  onClick={() => toggleEvent(ev.key)}
                                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left"
                                >
                                  <div className={`w-4 h-4 rounded flex-shrink-0 border flex items-center justify-center transition-colors ${selected ? 'bg-blue-600 border-blue-600' : 'border-gray-300 dark:border-[#252941]'
                                    }`}>
                                    {selected && <Check className="w-2.5 h-2.5 text-white" />}
                                  </div>
                                  <span className="text-sm text-gray-900 dark:text-gray-200">{t(ev.label)}</span>
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* API Token */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">{t('integrations.api_token_label')}</label>
                      <div className="relative">
                        <input
                          type={utmifyForm.tokenVisible ? 'text' : 'password'}
                          value={utmifyForm.api_token}
                          onChange={e => setUtmifyForm(f => ({ ...f, api_token: e.target.value }))}
                          placeholder={t('integrations.api_token_placeholder')}
                          className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0f1117] border border-gray-200 dark:border-[#252941] rounded-lg text-gray-900 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setUtmifyForm(f => ({ ...f, tokenVisible: !f.tokenVisible }))}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        >
                          {utmifyForm.tokenVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
                        {t('integrations.api_token_hint').split('app.utmify.com.br')[0]}<a href="https://app.utmify.com.br" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">app.utmify.com.br</a>{t('integrations.api_token_hint').split('app.utmify.com.br')[1]}
                      </p>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="border-t border-gray-200 dark:border-[#1e2139] px-6 py-4 flex gap-3">
                    <button
                      onClick={() => setUtmifyModal({ open: false, editing: null })}
                      className="flex-1 px-4 py-2 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors"
                    >
                      {t('integrations.cancel')}
                    </button>
                    <button
                      onClick={saveUtmifyIntegration}
                      disabled={utmifySaving || !utmifyForm.api_token.trim() || !utmifyForm.name.trim()}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      {utmifySaving ? (
                        <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {t('integrations.saving')}</>
                      ) : (
                        <><Save className="w-4 h-4" /> {t('integrations.save_integration')}</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
