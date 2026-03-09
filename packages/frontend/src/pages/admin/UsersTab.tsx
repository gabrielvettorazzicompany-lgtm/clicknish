import { useState, useEffect } from 'react'
import { useI18n } from '@/i18n'
import { adminFetch } from './adminApi'

interface User {
    id: string
    name: string
    email: string
    created_at: string
    app_count: number
    last_activity: string
    plan?: string
}

interface Provider {
    id: string
    name: string
    type: string
    is_active: boolean
    is_global_default: boolean
}

export function UsersTab({ userId }: { userId: string }) {
    const { t } = useI18n()
    const [users, setUsers] = useState<User[]>([])
    const [totalUsers, setTotalUsers] = useState(0)
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedUser, setSelectedUser] = useState<User | null>(null)
    const [userDetails, setUserDetails] = useState<any>(null)
    const [loadingDetails, setLoadingDetails] = useState(false)
    const [providers, setProviders] = useState<Provider[]>([])
    const [userModalProviderId, setUserModalProviderId] = useState('')
    const [savingProvider, setSavingProvider] = useState(false)

    const fetchUsers = async (search = searchQuery) => {
        try {
            const params = new URLSearchParams()
            if (search) params.append('search', search)
            const res = await adminFetch(`/users${params.toString() ? '?' + params : ''}`, userId)
            if (res.ok) {
                const d = await res.json()
                setUsers(d.users)
                setTotalUsers(d.total || d.users.length)
            }
        } catch (e) { console.error(e) }
    }

    const fetchUserDetails = async (uid: string) => {
        setLoadingDetails(true)
        try {
            const res = await adminFetch(`/user-details/${uid}`, userId)
            if (res.ok) setUserDetails(await res.json())
        } catch (e) { console.error(e) } finally { setLoadingDetails(false) }
    }

    const fetchProviders = async () => {
        try {
            const res = await adminFetch('/providers', userId)
            if (res.ok) { const d = await res.json(); setProviders(d.providers || []) }
        } catch (e) { console.error(e) }
    }

    const fetchUserProvider = async (email: string) => {
        try {
            const res = await adminFetch('/payment-config/search', userId, { method: 'POST', body: JSON.stringify({ email }) })
            if (res.ok) { const d = await res.json(); setUserModalProviderId(d.config?.provider_id || '') }
        } catch (e) { console.error(e) }
    }

    useEffect(() => { fetchUsers(); fetchProviders() }, [])

    useEffect(() => {
        if (!selectedUser) { setUserModalProviderId(''); return }
        fetchUserProvider(selectedUser.email)
    }, [selectedUser])

    const handleBanUser = async (uid: string, ban: boolean) => {
        if (!confirm(`Are you sure you want to ${ban ? 'DISABLE' : 'REACTIVATE'} this user?`)) return
        try {
            const res = await adminFetch(`/user/${uid}/ban`, userId, { method: 'PUT', body: JSON.stringify({ ban }) })
            if (res.ok) { alert(`User ${ban ? 'disabled' : 'reactivated'} successfully!`); setSelectedUser(null); fetchUsers() }
            else alert(`Error ${ban ? 'disabling' : 'reactivating'} user`)
        } catch (e) { console.error(e) }
    }

    const handleDeleteUser = async (uid: string) => {
        if (!confirm('Are you sure you want to DELETE this user? This action is IRREVERSIBLE!')) return
        try {
            const res = await adminFetch(`/user/${uid}`, userId, { method: 'DELETE' })
            if (res.ok) { alert('User deleted successfully!'); setSelectedUser(null); fetchUsers() }
            else alert('Error deleting user')
        } catch (e) { console.error(e) }
    }

    const handleSaveProvider = async () => {
        if (!selectedUser) return
        setSavingProvider(true)
        try {
            const res = await adminFetch(`/payment-config/${selectedUser.id}`, userId, {
                method: 'PUT',
                body: JSON.stringify({ provider_id: userModalProviderId || null, override_platform_default: !!userModalProviderId }),
            })
            if (!res.ok) alert('Erro ao salvar provedor')
        } catch (e) { console.error(e) } finally { setSavingProvider(false) }
    }

    return (
        <>
            <div className="backdrop-blur-xl bg-white/[0.02] rounded-none border border-white/[0.05] overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.05] flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-semibold text-white">{t('superadmin.platform_users')}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{users.length} de {totalUsers} proprietários da plataforma</p>
                    </div>
                    <button onClick={() => fetchUsers()} className="text-xs text-gray-600 hover:text-gray-300 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] px-3 py-1.5 rounded-lg transition-colors">
                        Atualizar
                    </button>
                </div>

                <div className="p-5">
                    <div className="mb-5 flex gap-3">
                        <div className="relative flex-1">
                            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            <input
                                type="text"
                                placeholder={t('superadmin.search_by_name_email')}
                                value={searchQuery}
                                onChange={e => { setSearchQuery(e.target.value); fetchUsers(e.target.value) }}
                                className="w-full pl-9 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.07] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40 text-xs"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        {users.map(u => (
                            <button
                                key={u.id}
                                onClick={() => { setSelectedUser(u); fetchUserDetails(u.id) }}
                                className="w-full flex items-center justify-between px-3 py-2 bg-white/[0.02] hover:bg-white/[0.04] rounded-lg border border-white/[0.04] hover:border-blue-500/20 transition-all text-left group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-xs">
                                        {u.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <div className="text-sm font-medium text-white">{u.name}</div>
                                            {u.plan && (
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.plan === 'advanced' || u.plan === 'pro' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'}`}>
                                                    {u.plan === 'advanced' ? 'Advanced' : u.plan === 'pro' ? 'Pro' : 'Free'}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-500">{u.email}</div>
                                        <div className="text-xs text-gray-500">
                                            {t('superadmin.registration')}: {u.created_at ? new Date(u.created_at).toLocaleDateString('en-US') : 'N/A'} • {u.app_count} apps
                                        </div>
                                    </div>
                                </div>
                                <span className="text-xs text-gray-500 group-hover:text-blue-400 transition-colors">{t('superadmin.view')}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* User Details Modal */}
            {selectedUser && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedUser(null)}>
                    <div className="backdrop-blur-xl bg-[#0d1117]/95 rounded-none shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-white/[0.05]" onClick={e => e.stopPropagation()}>
                        <div className="sticky top-0 backdrop-blur-xl bg-white/[0.02] p-4 flex items-center justify-between border-b border-white/[0.05]">
                            <div className="flex items-center gap-4">
                                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                    {selectedUser.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-white">{selectedUser.name}</h3>
                                    <p className="text-xs text-gray-500">{selectedUser.email}</p>
                                    <p className="text-xs text-gray-600">ID: {selectedUser.id}</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedUser(null)} className="text-gray-500 hover:text-white transition-colors p-2 hover:bg-white/[0.05] rounded-lg text-xl font-light">×</button>
                        </div>

                        <div className="p-4 space-y-4">
                            {loadingDetails ? (
                                <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" /></div>
                            ) : userDetails ? (
                                <>
                                    <div className="grid grid-cols-3 gap-3">
                                        {[['Applications', userDetails.apps.length, 'blue'], ['Clients', userDetails.totalClients, 'blue'], ['Plan', userDetails.plan, 'blue']].map(([label, val]) => (
                                            <div key={label} className="backdrop-blur-xl bg-white/[0.02] p-4 rounded-xl border border-white/[0.05]">
                                                <div className="text-xs font-medium text-blue-400 mb-1">{t(`superadmin.${String(label).toLowerCase()}`)}</div>
                                                <div className="text-xl font-bold text-white">{val}</div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        {[['Registration', selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleDateString('en-US') : 'N/A'], ['Last Activity', new Date(selectedUser.last_activity).toLocaleDateString('en-US')]].map(([label, val]) => (
                                            <div key={label} className="backdrop-blur-xl bg-white/[0.02] p-4 rounded-xl border border-white/[0.05]">
                                                <div className="text-xs text-gray-500 mb-1">{t(`superadmin.${String(label).toLowerCase().replace(' ', '_')}`)}</div>
                                                <div className="text-sm font-semibold text-white">{val}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Applications List */}
                                    <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <h4 className="font-semibold text-white text-sm">{t('superadmin.applications')}</h4>
                                            <span className="ml-auto text-xs bg-gray-700/50 text-gray-300 px-2 py-0.5 rounded font-medium border border-gray-600/40">{userDetails.apps.length}</span>
                                        </div>
                                        {userDetails.apps.length > 0 ? (
                                            <div className="space-y-2">
                                                {userDetails.apps.map((app: any) => (
                                                    <div key={app.id} className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/[0.05]">
                                                        <div className="flex-1">
                                                            <div className="font-medium text-white text-sm">{app.name}</div>
                                                            <div className="text-xs text-gray-500">{app.slug}</div>
                                                        </div>
                                                        <span className={`text-xs px-2 py-0.5 rounded font-medium border ${app.review_status === 'approved' ? 'bg-gray-700/50 text-gray-300 border-gray-600/40' : app.review_status === 'rejected' ? 'bg-gray-800/50 text-gray-400 border-gray-700/40' : 'bg-gray-700/50 text-gray-300 border-gray-600/40'}`}>
                                                            {app.review_status === 'approved' ? 'Approved' : app.review_status === 'rejected' ? 'Rejected' : 'Pending'}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-gray-500 text-sm text-center py-4">{t('superadmin.no_apps_created')}</p>
                                        )}
                                    </div>

                                    {/* Payment Provider */}
                                    <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                                        <h4 className="font-semibold text-white text-sm mb-1">Provedor de Pagamento</h4>
                                        <p className="text-xs text-gray-500 mb-3">Atribui um provedor específico para este usuário. Deixe em "Padrão da plataforma" para usar o global.</p>
                                        <div className="flex gap-2">
                                            <select value={userModalProviderId} onChange={e => setUserModalProviderId(e.target.value)} className="flex-1 px-3 py-2 bg-[#0d1117] border border-white/[0.08] rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
                                                <option value="">Padrão da plataforma</option>
                                                {providers.filter(p => p.is_active).map(p => (
                                                    <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                                                ))}
                                            </select>
                                            <button onClick={handleSaveProvider} disabled={savingProvider} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-all">
                                                {savingProvider ? 'Salvando...' : 'Salvar'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                                        <h4 className="font-semibold text-white text-sm mb-3">{t('superadmin.admin_actions')}</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button onClick={() => handleBanUser(selectedUser.id, true)} className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-all">{t('superadmin.ban_user')}</button>
                                            <button onClick={() => handleBanUser(selectedUser.id, false)} className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg font-medium text-sm transition-all">{t('superadmin.unban_user')}</button>
                                            <button onClick={() => handleDeleteUser(selectedUser.id)} className="col-span-2 px-4 py-2.5 bg-blue-800 hover:bg-blue-900 text-white rounded-lg font-medium text-sm transition-all">{t('superadmin.delete_user')}</button>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-3 text-center">{t('superadmin.permanent_actions')}</p>
                                    </div>
                                </>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
