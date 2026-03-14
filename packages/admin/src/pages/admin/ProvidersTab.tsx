import { useState, useEffect } from 'react'
import { adminFetch, adminHeaders } from './adminApi'

interface PaymentProvider {
    id: string
    name: string
    type: 'stripe' | 'stripe_connect' | 'mollie' | 'paypal' | 'custom'
    credentials?: Record<string, string>
    is_active: boolean
    is_global_default: boolean
    created_at: string
    updated_at: string
}

const PROVIDER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    stripe: { bg: 'bg-indigo-500/20', text: 'text-indigo-300', border: 'border-indigo-500/30' },
    stripe_connect: { bg: 'bg-indigo-500/20', text: 'text-indigo-300', border: 'border-indigo-500/30' },
    mollie: { bg: 'bg-orange-500/20', text: 'text-orange-300', border: 'border-orange-500/30' },
    paypal: { bg: 'bg-yellow-500/20', text: 'text-yellow-300', border: 'border-yellow-500/30' },
    custom: { bg: 'bg-gray-500/20', text: 'text-gray-300', border: 'border-gray-500/30' },
}

const CREDENTIAL_FIELDS: Record<string, Array<{ key: string; label: string; placeholder: string }>> = {
    stripe: [
        { key: 'publishable_key', label: 'Publishable Key', placeholder: 'pk_live_...' },
        { key: 'secret_key', label: 'Secret Key', placeholder: 'sk_live_...' },
        { key: 'webhook_secret', label: 'Webhook Secret', placeholder: 'whsec_...' },
    ],
    stripe_connect: [
        { key: 'publishable_key', label: 'Publishable Key', placeholder: 'pk_live_...' },
        { key: 'secret_key', label: 'Secret Key', placeholder: 'sk_live_...' },
        { key: 'webhook_secret', label: 'Webhook Secret', placeholder: 'whsec_...' },
    ],
    mollie: [
        { key: 'live_api_key', label: 'Live API Key', placeholder: 'live_...' },
        { key: 'test_api_key', label: 'Test API Key', placeholder: 'test_...' },
    ],
    paypal: [
        { key: 'client_id', label: 'Client ID', placeholder: 'AYhVxxxxxx...' },
        { key: 'client_secret', label: 'Client Secret', placeholder: 'EJ3Nxxxxxx...' },
    ],
    custom: [
        { key: 'api_key', label: 'API Key', placeholder: 'key_...' },
    ],
}

export function ProvidersTab({ userId }: { userId: string }) {
    const [providers, setProviders] = useState<PaymentProvider[]>([])
    const [paymentConfigs, setPaymentConfigs] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [loadingConfigs, setLoadingConfigs] = useState(false)

    // Create new provider
    const [showAddForm, setShowAddForm] = useState(false)
    const [newForm, setNewForm] = useState({ name: '', type: 'stripe', credentials: {} as Record<string, string> })
    const [saving, setSaving] = useState(false)

    // Edit existing provider
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editingName, setEditingName] = useState('')
    const [editingCreds, setEditingCreds] = useState<Record<string, string>>({})
    const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({})

    // Mollie methods
    const [mollieAvailable, setMollieAvailable] = useState<Array<{ id: string; description: string; image?: { svg: string } }>>([])
    const [mollieEnabled, setMollieEnabled] = useState<string[]>([])
    const [loadingMollie, setLoadingMollie] = useState(false)
    const [mollieProviderId, setMollieProviderId] = useState<string | null>(null)
    // Stripe methods
    const [stripeAvailable, setStripeAvailable] = useState<Array<{ id: string; label: string; active: boolean }>>([])
    const [stripeEnabled, setStripeEnabled] = useState<string[]>([])
    const [loadingStripe, setLoadingStripe] = useState(false)
    const [stripeProviderId, setStripeProviderId] = useState<string | null>(null)
    // User override
    const [userSearch, setUserSearch] = useState('')
    const [searchResults, setSearchResults] = useState<Array<{ id: string; email: string; config: any }> | null>(null)
    const [selectedUser, setSelectedUser] = useState<{ user: { id: string; email: string }; config: any } | null>(null)
    const [searching, setSearching] = useState(false)
    const [selectedProviderId, setSelectedProviderId] = useState('')
    const [assigning, setAssigning] = useState(false)
    const [editingConfigUser, setEditingConfigUser] = useState<string | null>(null)
    const [editingConfigProviderId, setEditingConfigProviderId] = useState('')

    const headers = adminHeaders(userId)

    const fetchAll = async () => {
        setLoading(true)
        setLoadingConfigs(true)
        try {
            const [providersRes, cfgRes] = await Promise.all([
                adminFetch('/providers', userId),
                adminFetch('/payment-configs', userId),
            ])
            if (providersRes.ok) { const d = await providersRes.json(); setProviders(d.providers || []) }
            if (cfgRes.ok) { const d = await cfgRes.json(); setPaymentConfigs(d.configs || []) }
        } catch (e) { console.error(e) } finally {
            setLoading(false)
            setLoadingConfigs(false)
        }
    }

    useEffect(() => { fetchAll() }, [])

    const handleSetGlobalDefault = async (id: string) => {
        const res = await adminFetch(`/providers/${id}`, userId, { method: 'PUT', body: JSON.stringify({ is_global_default: true }) })
        if (res.ok) setProviders(prev => prev.map(p => ({ ...p, is_global_default: p.id === id })))
        else alert('Erro ao definir provedor padrão')
    }

    const handleToggleActive = async (id: string, current: boolean) => {
        const res = await adminFetch(`/providers/${id}`, userId, { method: 'PUT', body: JSON.stringify({ is_active: !current }) })
        if (res.ok) setProviders(prev => prev.map(p => p.id === id ? { ...p, is_active: !current } : p))
    }

    const handleCreate = async () => {
        if (!newForm.name) return
        setSaving(true)
        try {
            const res = await adminFetch('/providers', userId, { method: 'POST', body: JSON.stringify(newForm) })
            if (res.ok) {
                const d = await res.json()
                setProviders(prev => [...prev, d.provider])
                setNewForm({ name: '', type: 'stripe', credentials: {} })
                setShowAddForm(false)
            } else alert('Erro ao cadastrar provedor')
        } catch (e) { console.error(e) } finally { setSaving(false) }
    }

    const handleSaveEdit = async (id: string) => {
        setSaving(true)
        try {
            const payload: any = { name: editingName }
            if (Object.keys(editingCreds).length > 0) payload.credentials = editingCreds
            if (mollieProviderId === id) { payload.enabled_methods = mollieEnabled; payload.available_methods = mollieAvailable }
            if (stripeProviderId === id) { payload.enabled_methods = stripeEnabled }
            const res = await adminFetch(`/providers/${id}`, userId, { method: 'PUT', body: JSON.stringify(payload) })
            if (res.ok) {
                setProviders(prev => prev.map(p => p.id === id ? { ...p, name: editingName, ...(Object.keys(editingCreds).length ? { credentials: editingCreds } : {}) } : p))
                setEditingId(null); setMollieProviderId(null); setMollieAvailable([]); setMollieEnabled([]); setStripeProviderId(null); setStripeAvailable([]); setStripeEnabled([])
            } else { const e = await res.json().catch(() => ({})); alert(e.error || `Erro (${res.status})`) }
        } catch (e) { console.error(e) } finally { setSaving(false) }
    }

    const handleDelete = async (id: string) => {
        if (!window.confirm('Tem certeza? Esta ação não pode ser desfeita.')) return
        const res = await adminFetch(`/providers/${id}`, userId, { method: 'DELETE' })
        if (res.ok) setProviders(prev => prev.filter(p => p.id !== id))
        else alert('Erro ao remover provedor')
    }

    const handleLoadMollie = async (id: string) => {
        setLoadingMollie(true); setMollieProviderId(id)
        const res = await adminFetch(`/providers/${id}/mollie-methods`, userId)
        if (res.ok) { const d = await res.json(); setMollieAvailable(d.available || []); setMollieEnabled(d.enabled || []) }
        else { const e = await res.json().catch(() => ({})); alert(e.error || 'Erro ao carregar métodos Mollie') }
        setLoadingMollie(false)
    }

    const handleLoadStripe = async (id: string) => {
        setLoadingStripe(true); setStripeProviderId(id)
        const res = await adminFetch(`/providers/${id}/stripe-methods`, userId)
        if (res.ok) { const d = await res.json(); setStripeAvailable(d.available || []); setStripeEnabled(d.enabled || []) }
        else { const e = await res.json().catch(() => ({})); alert(e.error || 'Erro ao carregar métodos Stripe') }
        setLoadingStripe(false)
    }

    const handleSearchUser = async () => {
        if (!userSearch) return
        setSearching(true); setSelectedUser(null); setSearchResults(null)
        try {
            const res = await fetch('https://api.clicknich.com/api/superadmin/payment-config/search', {
                method: 'POST', headers, body: JSON.stringify({ email: userSearch })
            })
            if (res.ok) {
                const d = await res.json()
                // API pode retornar { users: [...] } (lista) ou { user: {...}, config: {...} } (único)
                let list: Array<{ id: string; email: string; config: any }>
                if (Array.isArray(d.users)) {
                    list = d.users
                } else if (d.user) {
                    list = [{ id: d.user.id, email: d.user.email, config: d.config ?? null }]
                } else {
                    list = []
                }
                setSearchResults(list)
                if (list.length === 1) {
                    setSelectedUser({ user: { id: list[0].id, email: list[0].email }, config: list[0].config })
                    setSelectedProviderId(list[0].config?.provider_id || '')
                }
            }
        } catch (e) { console.error(e) } finally { setSearching(false) }
    }

    const handleAssign = async () => {
        if (!selectedUser) return
        setAssigning(true)
        try {
            const res = await adminFetch(`/payment-config/${selectedUser.user.id}`, userId, {
                method: 'PUT', body: JSON.stringify({ provider_id: selectedProviderId || null, override_platform_default: !!selectedProviderId })
            })
            if (res.ok) { fetchAll(); setSelectedUser(null); setSearchResults(null); setUserSearch(''); setSelectedProviderId('') }
            else alert('Erro ao atribuir provedor')
        } catch (e) { console.error(e) } finally { setAssigning(false) }
    }

    return (
        <div className="space-y-3">
            {/* 1. Global Default */}
            <div className="bg-[#0d1829] border border-white/[0.06] overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.05]">
                    <p className="text-sm font-semibold text-white">Provedor Global Padrão</p>
                    <p className="text-xs text-gray-500 mt-0.5">Usado por todos os usuários sem override individual</p>
                </div>
                {loading ? (
                    <div className="px-4 py-3 flex gap-3">{[1, 2].map(i => <div key={i} className="w-24 h-7 bg-white/[0.03] animate-pulse" />)}</div>
                ) : providers.filter(p => p.is_active).length === 0 ? (
                    <p className="px-4 py-3 text-xs text-gray-600">Cadastre provedores abaixo para selecionar o padrão global.</p>
                ) : (
                    <div className="divide-y divide-white/[0.04]">
                        {providers.filter(p => p.is_active).map(p => (
                            <div key={p.id} className="px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${p.is_global_default ? 'bg-blue-400' : 'bg-gray-600'}`} />
                                <span className="flex-1 text-xs font-semibold text-white">{p.name}</span>
                                <span className="text-[10px] text-gray-500">{p.type}</span>
                                {p.is_global_default
                                    ? <span className="text-[10px] px-2 py-0.5 font-semibold border bg-blue-500/10 text-blue-400 border-blue-500/30">Padrão</span>
                                    : <button onClick={() => handleSetGlobalDefault(p.id)} className="text-[10px] px-2 py-0.5 font-semibold border bg-white/[0.02] text-gray-500 border-white/[0.07] hover:text-gray-300 hover:border-white/[0.15] transition-colors">Definir padrão</button>
                                }
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 2. Provider list + CRUD */}
            <div className="bg-[#0d1829] border border-white/[0.06] overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.05] flex items-center justify-between">
                    <div>
                        <p className="text-sm font-semibold text-white">Provedores Cadastrados</p>
                        <p className="text-xs text-gray-500 mt-0.5">{providers.length} provedor(es)</p>
                    </div>
                    <button onClick={() => { setShowAddForm(v => !v); setEditingId(null) }} className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors">
                        {showAddForm ? 'Cancelar' : '+ Novo'}
                    </button>
                </div>

                {showAddForm && (
                    <div className="px-4 py-4 border-b border-white/[0.05] space-y-3 bg-white/[0.01]">
                        <p className="text-xs font-semibold text-gray-400">Novo provedor</p>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs text-gray-600 mb-1">Nome</label>
                                <input type="text" value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-1.5 bg-white/[0.03] border border-white/[0.07] text-white text-xs focus:outline-none focus:border-blue-500/40" />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-600 mb-1">Tipo</label>
                                <select value={newForm.type} onChange={e => setNewForm(f => ({ ...f, type: e.target.value, credentials: {} }))} className="w-full px-3 py-1.5 bg-white/[0.03] border border-white/[0.07] text-white text-xs focus:outline-none focus:border-blue-500/40">
                                    <option value="stripe">Stripe</option>
                                    <option value="mollie">Mollie</option>
                                    <option value="paypal">PayPal</option>
                                    <option value="stripe_connect">Stripe Connect</option>
                                    <option value="custom">Custom</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {(CREDENTIAL_FIELDS[newForm.type] || []).map(field => (
                                <div key={field.key}>
                                    <label className="block text-xs text-gray-600 mb-1">{field.label}</label>
                                    <input type="password" placeholder={field.placeholder} value={newForm.credentials[field.key] || ''} onChange={e => setNewForm(f => ({ ...f, credentials: { ...f.credentials, [field.key]: e.target.value } }))} className="w-full px-3 py-1.5 bg-white/[0.03] border border-white/[0.07] text-white text-xs font-mono placeholder-gray-700 focus:outline-none focus:border-blue-500/40" />
                                </div>
                            ))}
                        </div>
                        <button onClick={handleCreate} disabled={saving || !newForm.name} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors">
                            {saving ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" /> : 'Cadastrar'}
                        </button>
                    </div>
                )}

                {loading ? (
                    <div className="px-4 py-6 flex justify-center"><div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>
                ) : providers.length === 0 ? (
                    <div className="px-4 py-6 text-center"><p className="text-xs text-gray-600">Nenhum provedor. Use "+ Novo" para adicionar.</p></div>
                ) : (
                    <div className="divide-y divide-white/[0.04]">
                        {providers.map(provider => {
                            const c = PROVIDER_COLORS[provider.type] || PROVIDER_COLORS.custom
                            const isEditing = editingId === provider.id
                            return (
                                <div key={provider.id}>
                                    <div className="px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
                                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${provider.is_active ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-white">{provider.name}</p>
                                            <p className="text-[10px] text-gray-600 mt-0.5">{provider.type}{provider.is_global_default ? ' · padrão global' : ''}</p>
                                        </div>
                                        <span className={`text-[10px] px-2 py-0.5 font-semibold border flex-shrink-0 ${provider.is_active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-white/[0.02] text-gray-500 border-white/[0.07]'}`}>
                                            {provider.is_active ? 'Ativo' : 'Inativo'}
                                        </span>
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                            <button onClick={() => handleToggleActive(provider.id, provider.is_active)} className="text-[10px] px-2 py-0.5 text-gray-500 hover:text-gray-300 border border-white/[0.07] hover:border-white/[0.15] transition-colors">
                                                {provider.is_active ? 'Desativar' : 'Ativar'}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (isEditing) { setEditingId(null); return }
                                                    setEditingId(provider.id); setEditingName(provider.name); setEditingCreds(provider.credentials || {}); setShowAddForm(false)
                                                }}
                                                className={`text-[10px] px-2 py-0.5 border transition-colors ${isEditing ? `${c.text} ${c.border} ${c.bg}` : 'text-gray-500 hover:text-gray-300 border-white/[0.07] hover:border-white/[0.15]'}`}
                                            >
                                                {isEditing ? 'Editando' : 'Editar'}
                                            </button>
                                            {!provider.is_global_default && (
                                                <button onClick={() => handleDelete(provider.id)} className="text-[10px] px-2 py-0.5 text-red-500 hover:text-red-400 border border-red-500/20 hover:border-red-500/40 transition-colors">Remover</button>
                                            )}
                                        </div>
                                    </div>

                                    {isEditing && (
                                        <div className="px-4 pb-4 pt-3 border-t border-white/[0.05] space-y-3 bg-white/[0.01]">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-xs text-gray-600 mb-1">Nome</label>
                                                    <input type="text" value={editingName} onChange={e => setEditingName(e.target.value)} className="w-full px-3 py-1.5 bg-white/[0.03] border border-white/[0.07] text-white text-xs focus:outline-none focus:border-blue-500/40" />
                                                </div>
                                                {(CREDENTIAL_FIELDS[provider.type] || []).map(field => (
                                                    <div key={field.key}>
                                                        <label className="block text-xs text-gray-600 mb-1">{field.label} <span className="text-gray-700">(em branco = manter)</span></label>
                                                        <div className="flex gap-1.5">
                                                            <input type={showApiKey[`edit-${provider.id}-${field.key}`] ? 'text' : 'password'} placeholder={field.placeholder} value={editingCreds[field.key] || ''} onChange={e => setEditingCreds(prev => ({ ...prev, [field.key]: e.target.value }))} className="flex-1 px-3 py-1.5 bg-white/[0.03] border border-white/[0.07] text-white text-xs font-mono placeholder-gray-700 focus:outline-none focus:border-blue-500/40" />
                                                            <button onClick={() => setShowApiKey(prev => ({ ...prev, [`edit-${provider.id}-${field.key}`]: !prev[`edit-${provider.id}-${field.key}`] }))} className="px-2 py-1 bg-white/[0.03] hover:bg-white/[0.06] text-gray-500 text-[10px] border border-white/[0.07]">
                                                                {showApiKey[`edit-${provider.id}-${field.key}`] ? 'Ocultar' : 'Ver'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {provider.type === 'mollie' && (
                                                <div className="border border-white/[0.06] p-3 space-y-3 bg-white/[0.01]">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <p className="text-xs font-semibold text-white">Métodos Mollie</p>
                                                            <p className="text-[10px] text-gray-600 mt-0.5">Ative os métodos disponíveis no checkout</p>
                                                        </div>
                                                        <button onClick={() => handleLoadMollie(provider.id)} disabled={loadingMollie} className="text-[10px] px-2 py-0.5 text-gray-400 hover:text-gray-300 border border-white/[0.07] hover:border-white/[0.15] transition-colors disabled:opacity-50">
                                                            {loadingMollie && mollieProviderId === provider.id ? 'Carregando...' : 'Carregar da API'}
                                                        </button>
                                                    </div>
                                                    {mollieProviderId === provider.id && mollieAvailable.length > 0 && (
                                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                            {mollieAvailable.map(method => {
                                                                const enabled = mollieEnabled.includes(method.id)
                                                                return (
                                                                    <label key={method.id} className={`flex items-center gap-2 px-2.5 py-2 border cursor-pointer transition-all ${enabled ? 'bg-white/[0.04] border-white/[0.12] text-white' : 'bg-white/[0.01] border-white/[0.05] text-gray-500 hover:border-white/[0.1]'}`}>
                                                                        <input type="checkbox" checked={enabled} onChange={() => setMollieEnabled(prev => enabled ? prev.filter(m => m !== method.id) : [...prev, method.id])} className="w-3 h-3 flex-shrink-0" />
                                                                        {method.image?.svg ? <img src={method.image.svg} alt={method.description} className="w-4 h-3 object-contain flex-shrink-0" /> : null}
                                                                        <span className="text-[10px] font-medium truncate">{method.description}</span>
                                                                    </label>
                                                                )
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {(provider.type === 'stripe' || provider.type === 'stripe_connect') && (
                                                <div className="border border-white/[0.06] p-3 space-y-3 bg-white/[0.01]">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <p className="text-xs font-semibold text-white">Métodos Stripe</p>
                                                            <p className="text-[10px] text-gray-600 mt-0.5">Ative os métodos visíveis no checkout</p>
                                                        </div>
                                                        <button onClick={() => handleLoadStripe(provider.id)} disabled={loadingStripe} className="text-[10px] px-2 py-0.5 text-gray-400 hover:text-gray-300 border border-white/[0.07] hover:border-white/[0.15] transition-colors disabled:opacity-50">
                                                            {loadingStripe && stripeProviderId === provider.id ? 'Carregando...' : 'Carregar da API'}
                                                        </button>
                                                    </div>
                                                    {stripeProviderId === provider.id && stripeAvailable.length > 0 && (
                                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                            {stripeAvailable.map(method => {
                                                                const enabled = stripeEnabled.includes(method.id)
                                                                return (
                                                                    <label key={method.id} className={`flex items-center gap-2 px-2.5 py-2 border cursor-pointer transition-all ${enabled ? 'bg-white/[0.04] border-white/[0.12] text-white' : 'bg-white/[0.01] border-white/[0.05] text-gray-500 hover:border-white/[0.1]'}`}>
                                                                        <input type="checkbox" checked={enabled} onChange={() => setStripeEnabled(prev => enabled ? prev.filter(m => m !== method.id) : [...prev, method.id])} className="w-3 h-3 flex-shrink-0" />
                                                                        <span className="text-[10px] font-medium truncate flex-1">{method.label}</span>
                                                                        {method.active && <span className="text-[9px] text-emerald-400 border border-emerald-500/30 px-1 flex-shrink-0">on</span>}
                                                                    </label>
                                                                )
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div className="flex gap-2 pt-1">
                                                <button onClick={() => { setEditingId(null); setMollieProviderId(null); setMollieAvailable([]); setMollieEnabled([]); setStripeProviderId(null); setStripeAvailable([]); setStripeEnabled([]) }} className="px-3 py-1.5 text-gray-500 hover:text-gray-300 border border-white/[0.07] text-xs transition-colors">Cancelar</button>
                                                <button onClick={() => handleSaveEdit(provider.id)} disabled={saving} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors">
                                                    {saving ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" /> : 'Salvar'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* 3. User overrides */}
            <div className="bg-[#0d1829] border border-white/[0.06] overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.05] flex items-center justify-between">
                    <div>
                        <p className="text-sm font-semibold text-white">Overrides por Usuário</p>
                        <p className="text-xs text-gray-500 mt-0.5">Atribua um provedor específico a qualquer owner</p>
                    </div>
                    <button onClick={fetchAll} className="text-xs px-3 py-1.5 text-gray-500 hover:text-gray-300 border border-white/[0.07] hover:border-white/[0.15] transition-colors">Atualizar</button>
                </div>

                {/* Search */}
                <div className="px-4 py-3 border-b border-white/[0.04] flex items-center gap-2">
                    <input type="text" placeholder="Buscar owner por email..." value={userSearch} onChange={e => setUserSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearchUser()} className="flex-1 px-3 py-1.5 bg-white/[0.03] border border-white/[0.07] text-white text-xs placeholder-gray-600 focus:outline-none focus:border-blue-500/40" />
                    <button onClick={handleSearchUser} disabled={searching} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors disabled:opacity-50">
                        {searching ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Buscar'}
                    </button>
                </div>

                {searchResults !== null && (
                    <div className="border-b border-white/[0.04]">
                        {searchResults.length === 0 ? (
                            <p className="px-4 py-3 text-xs text-red-400">Nenhum usuário encontrado para "{userSearch}"</p>
                        ) : (
                            <>
                                {searchResults.length > 1 && !selectedUser && (
                                    <div className="divide-y divide-white/[0.04]">
                                        {searchResults.map(u => (
                                            <button key={u.id} onClick={() => { setSelectedUser({ user: { id: u.id, email: u.email }, config: u.config }); setSelectedProviderId(u.config?.provider_id || '') }} className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-white/[0.02] text-left transition-colors">
                                                <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">{u.email?.charAt(0)?.toUpperCase()}</div>
                                                <span className="flex-1 text-xs text-white">{u.email}</span>
                                                {u.config?.provider_id && <span className="text-[10px] text-blue-400 border border-blue-500/30 px-1.5 py-0.5">{providers.find(p => p.id === u.config.provider_id)?.name || 'override'}</span>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {selectedUser?.user && (
                                    <div className="px-4 py-3 flex items-center gap-3 bg-white/[0.01]">
                                        {searchResults.length > 1 && <button onClick={() => setSelectedUser(null)} className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors">← voltar</button>}
                                        <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">{selectedUser.user.email?.charAt(0)?.toUpperCase()}</div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-white truncate">{selectedUser.user.email}</p>
                                            <p className="text-[10px] text-gray-600">{selectedUser.config?.provider_id ? `Override → ${providers.find(p => p.id === selectedUser.config.provider_id)?.name || '?'}` : 'Sem override'}</p>
                                        </div>
                                        <select value={selectedProviderId} onChange={e => setSelectedProviderId(e.target.value)} className="px-2 py-1.5 bg-white/[0.03] border border-white/[0.07] text-white text-xs focus:outline-none focus:border-blue-500/40">
                                            <option value="">Padrão global</option>
                                            {providers.filter(p => p.is_active).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                        <button onClick={handleAssign} disabled={assigning} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors">
                                            {assigning ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Atribuir'}
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* Config list */}
                {loadingConfigs ? (
                    <div className="px-4 py-6 flex justify-center"><div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>
                ) : paymentConfigs.length === 0 ? (
                    <div className="px-4 py-6 text-center"><p className="text-xs text-gray-600">Nenhum override. Busque um usuário para atribuir um provedor.</p></div>
                ) : (
                    <div className="divide-y divide-white/[0.04]">
                        {paymentConfigs.map(cfg => {
                            const assigned = providers.find(p => p.id === cfg.provider_id)
                            const c = assigned ? PROVIDER_COLORS[assigned.type] : PROVIDER_COLORS.stripe
                            const isEditing = editingConfigUser === cfg.user_id
                            return (
                                <div key={cfg.id}>
                                    <div className={`px-4 py-3 flex items-center gap-3 transition-colors ${isEditing ? 'bg-white/[0.02]' : 'hover:bg-white/[0.02]'}`}>
                                        <div className="w-6 h-6 bg-gradient-to-br from-blue-500/40 to-violet-500/40 border border-white/[0.1] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                                            {cfg.user_email?.charAt(0)?.toUpperCase() || '?'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-white truncate">{cfg.user_email}</p>
                                            <p className="text-[10px] text-gray-600 truncate">{cfg.user_id}</p>
                                        </div>
                                        {assigned
                                            ? <span className={`text-[10px] px-2 py-0.5 font-semibold border flex-shrink-0 ${c.bg} ${c.text} ${c.border}`}>{assigned.name}</span>
                                            : <span className="text-[10px] px-2 py-0.5 font-semibold border flex-shrink-0 bg-white/[0.02] text-gray-500 border-white/[0.07]">{cfg.payment_provider || 'Padrão global'}</span>
                                        }
                                        <span className="text-[10px] px-2 py-0.5 font-semibold border bg-emerald-500/10 text-emerald-400 border-emerald-500/30 flex-shrink-0">ativo</span>
                                        <button
                                            onClick={() => {
                                                if (isEditing) { setEditingConfigUser(null); return }
                                                setEditingConfigUser(cfg.user_id); setEditingConfigProviderId(cfg.provider_id || '')
                                            }}
                                            className={`text-[10px] px-2 py-0.5 border flex-shrink-0 transition-colors ${isEditing ? 'text-blue-400 border-blue-500/30 bg-blue-500/10' : 'text-gray-500 hover:text-gray-300 border-white/[0.07] hover:border-white/[0.15]'}`}
                                        >
                                            {isEditing ? 'Editando' : 'Trocar'}
                                        </button>
                                    </div>
                                    {isEditing && (
                                        <div className="px-4 pb-3 pt-2 border-t border-white/[0.05] flex items-center gap-2 bg-white/[0.01]">
                                            <select value={editingConfigProviderId} onChange={e => setEditingConfigProviderId(e.target.value)} className="flex-1 px-2 py-1.5 bg-white/[0.03] border border-white/[0.07] text-white text-xs focus:outline-none focus:border-blue-500/40">
                                                <option value="">Padrão global</option>
                                                {providers.filter(p => p.is_active).map(p => <option key={p.id} value={p.id}>{p.name} ({p.type})</option>)}
                                            </select>
                                            <button onClick={() => setEditingConfigUser(null)} className="px-2 py-1.5 text-gray-500 hover:text-gray-300 border border-white/[0.07] text-xs transition-colors">Cancelar</button>
                                            <button
                                                onClick={async () => {
                                                    setAssigning(true)
                                                    try {
                                                        const res = await adminFetch(`/payment-config/${cfg.user_id}`, userId, {
                                                            method: 'PUT', body: JSON.stringify({ provider_id: editingConfigProviderId || null, override_platform_default: !!editingConfigProviderId })
                                                        })
                                                        if (res.ok) { setEditingConfigUser(null); fetchAll() }
                                                        else { const body = await res.json().catch(() => ({})); alert(`Erro (${res.status}): ${body.error || JSON.stringify(body)}`) }
                                                    } catch (e) { console.error(e) } finally { setAssigning(false) }
                                                }}
                                                disabled={assigning}
                                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
                                            >
                                                {assigning ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" /> : 'Salvar'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
