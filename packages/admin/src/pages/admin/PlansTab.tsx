// PlansTab.tsx — Gestão de planos dos produtores
import { useState, useEffect, useMemo } from 'react'
import { CheckCircle, RefreshCw, Search, ChevronDown, X, Clock, TrendingUp } from 'lucide-react'
import { adminFetch } from './adminApi'

const PLANS = [
    { id: 'free', label: 'Free', color: 'text-gray-400 bg-gray-500/10 border-gray-500/20' },
    { id: 'pro', label: 'Pro', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
    { id: 'advanced', label: 'Advanced', color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
    { id: 'enterprise', label: 'Enterprise', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
]

function PlanBadge({ plan }: { plan: string }) {
    const p = PLANS.find(pl => pl.id === plan) || PLANS[0]
    return <span className={`text-[10px] px-2 py-0.5 font-semibold border ${p.color}`}>{p.label}</span>
}

interface PlanUser { id: string; email: string; name: string; plan: string; created_at: string; updated_at: string }
interface PlanHistoryEntry { id: string; changed_by: string; previous_plan: string; new_plan: string; notes: string; created_at: string }

export function PlansTab({ userId }: { userId: string }) {
    const [users, setUsers] = useState<PlanUser[]>([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [planFilter, setPlanFilter] = useState('')
    const [changePlanModal, setChangePlanModal] = useState<{ open: boolean; user: PlanUser | null }>({ open: false, user: null })
    const [historyModal, setHistoryModal] = useState<{ open: boolean; user: PlanUser | null; history: PlanHistoryEntry[] }>({ open: false, user: null, history: [] })
    const [newPlan, setNewPlan] = useState('')
    const [planNotes, setPlanNotes] = useState('')
    const [saving, setSaving] = useState(false)
    const [toasts, setToasts] = useState<{ id: number; msg: string; ok: boolean }[]>([])
    const toast = (msg: string, ok = true) => { const id = Date.now(); setToasts(p => [...p, { id, msg, ok }]); setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500) }

    const fetchUsers = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (search) params.append('search', search)
            if (planFilter) params.append('plan', planFilter)
            const res = await adminFetch(`/users-plans?${params}`, userId)
            if (res.ok) { const d = await res.json(); setUsers(d.users || []); setTotal(d.total || 0) }
        } catch (e) { console.error(e) } finally { setLoading(false) }
    }

    const fetchHistory = async (user: PlanUser) => {
        try {
            const res = await adminFetch(`/plan-history/${user.id}`, userId)
            if (res.ok) { const d = await res.json(); setHistoryModal({ open: true, user, history: d.history || [] }) }
        } catch (e) { console.error(e) }
    }

    const handleChangePlan = async () => {
        if (!changePlanModal.user || !newPlan) return
        setSaving(true)
        try {
            const res = await adminFetch(`/users-plans/${changePlanModal.user.id}`, userId, { method: 'PATCH', body: JSON.stringify({ plan: newPlan, notes: planNotes }) })
            if (res.ok) { toast(`Plano alterado para ${newPlan.toUpperCase()}!`); setChangePlanModal({ open: false, user: null }); setPlanNotes(''); fetchUsers() }
            else toast('Erro ao alterar plano.', false)
        } catch { toast('Erro ao alterar plano.', false) } finally { setSaving(false) }
    }

    useEffect(() => { fetchUsers() }, [planFilter])

    const planStats = useMemo(() => {
        const counts: Record<string, number> = { free: 0, pro: 0, advanced: 0, enterprise: 0 }
        users.forEach(u => { counts[u.plan] = (counts[u.plan] || 0) + 1 })
        return PLANS.map(p => ({ ...p, count: counts[p.id] || 0 }))
    }, [users])

    return (
        <div className="space-y-4">
            <div className="fixed top-4 right-4 z-[100] space-y-2 pointer-events-none">
                {toasts.map(t => (
                    <div key={t.id} className={`px-4 py-2.5 text-xs font-medium border pointer-events-auto shadow-lg ${t.ok ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' : 'bg-red-500/20 border-red-500/30 text-red-400'}`}>{t.msg}</div>
                ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {planStats.map(p => (
                    <div key={p.id} className="bg-[#0d1829] border border-white/[0.06] p-4">
                        <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${p.color.split(' ')[0]}`}>{p.label}</p>
                        <p className="text-2xl font-bold text-white">{p.count}</p>
                        <p className="text-[10px] text-gray-600 mt-0.5">usuários</p>
                    </div>
                ))}
            </div>

            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none" />
                    <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchUsers()}
                        placeholder="Buscar por email ou nome…"
                        className="w-full pl-9 pr-4 py-1.5 bg-white/[0.02] border border-white/[0.06] text-xs text-white placeholder-gray-700 focus:outline-none focus:border-blue-500/40" />
                </div>
                <select value={planFilter} onChange={e => setPlanFilter(e.target.value)}
                    className="px-3 py-1.5 bg-white/[0.02] border border-white/[0.06] text-xs text-white focus:outline-none focus:border-blue-500/40">
                    <option value="">Todos os planos</option>
                    {PLANS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
                <button onClick={fetchUsers} className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white/[0.02] border border-white/[0.06] text-gray-500 hover:text-white hover:bg-white/[0.05] transition-colors ml-auto">
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
                </button>
            </div>

            <div className="bg-[#0d1829] border border-white/[0.06] overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.05] flex items-center justify-between">
                    <p className="text-xs font-semibold text-white">Usuários da Plataforma</p>
                    <span className="text-[11px] text-gray-600">{total} usuários</span>
                </div>
                {loading ? (
                    <div className="flex items-center justify-center py-16 gap-2 text-gray-600"><RefreshCw className="w-4 h-4 animate-spin" /><span className="text-xs">Carregando…</span></div>
                ) : users.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-600"><TrendingUp className="w-8 h-8 opacity-30" /><p className="text-xs">Nenhum usuário encontrado</p></div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-[11px]">
                            <thead>
                                <tr className="border-b border-white/[0.05]">
                                    {['Usuário', 'Plano', 'Cadastro', 'Última Alteração', 'Ações'].map(h => (
                                        <th key={h} className="px-4 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.03]">
                                {users.map(u => (
                                    <tr key={u.id} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-[10px] text-white font-bold flex-shrink-0">
                                                    {(u.email || '?').charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-white font-medium">{u.name || u.email.split('@')[0]}</p>
                                                    <p className="text-gray-600">{u.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2.5"><PlanBadge plan={u.plan} /></td>
                                        <td className="px-4 py-2.5 text-gray-500">{u.created_at ? new Date(u.created_at).toLocaleDateString('pt-BR') : '—'}</td>
                                        <td className="px-4 py-2.5 text-gray-500">{u.updated_at ? new Date(u.updated_at).toLocaleDateString('pt-BR') : '—'}</td>
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => { setChangePlanModal({ open: true, user: u }); setNewPlan(u.plan) }}
                                                    className="flex items-center gap-1 text-[10px] px-2 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-colors">
                                                    <ChevronDown className="w-3 h-3" /> Alterar
                                                </button>
                                                <button onClick={() => fetchHistory(u)}
                                                    className="flex items-center gap-1 text-[10px] px-2 py-1 bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:text-white transition-colors">
                                                    <Clock className="w-3 h-3" /> Histórico
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Change Plan Modal */}
            {changePlanModal.open && changePlanModal.user && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setChangePlanModal({ open: false, user: null })}>
                    <div className="bg-[#0d1117] border border-white/[0.08] w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                            <div>
                                <h3 className="text-sm font-semibold text-white">Alterar Plano</h3>
                                <p className="text-[11px] text-gray-500 mt-0.5">{changePlanModal.user.email}</p>
                            </div>
                            <button onClick={() => setChangePlanModal({ open: false, user: null })} className="text-gray-600 hover:text-gray-300"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="px-5 py-4 space-y-4">
                            <div>
                                <p className="text-[11px] text-gray-600 mb-2 font-medium uppercase tracking-wider">Plano atual</p>
                                <PlanBadge plan={changePlanModal.user.plan} />
                            </div>
                            <div>
                                <p className="text-[11px] text-gray-600 mb-2 font-medium uppercase tracking-wider">Novo plano</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {PLANS.map(p => (
                                        <button key={p.id} onClick={() => setNewPlan(p.id)}
                                            className={`text-xs py-2.5 px-3 border transition-colors text-left font-medium ${newPlan === p.id ? `border-blue-500/40 bg-blue-500/10 ${p.color.split(' ')[0]}` : 'border-white/[0.07] text-gray-500 hover:text-gray-300 bg-white/[0.02]'}`}>
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <p className="text-[11px] text-gray-600 mb-2 font-medium uppercase tracking-wider">Observação (opcional)</p>
                                <textarea value={planNotes} onChange={e => setPlanNotes(e.target.value)} rows={2}
                                    placeholder="Ex: upgrade manual por solicitação / desconto parceiro"
                                    className="w-full bg-white/[0.02] border border-white/[0.07] text-xs text-white placeholder-gray-700 p-3 focus:outline-none focus:border-blue-500/40 resize-none" />
                            </div>
                        </div>
                        <div className="px-5 py-3 border-t border-white/[0.06] flex gap-3 justify-end">
                            <button onClick={() => setChangePlanModal({ open: false, user: null })} className="text-xs px-4 py-2 bg-white/[0.03] border border-white/[0.07] text-gray-400 hover:text-white transition-colors">Cancelar</button>
                            <button onClick={handleChangePlan} disabled={saving || !newPlan || newPlan === changePlanModal.user.plan}
                                className="text-xs px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-50 flex items-center gap-2">
                                {saving ? <><RefreshCw className="w-3 h-3 animate-spin" /> Salvando…</> : <><CheckCircle className="w-3 h-3" /> Confirmar</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* History Modal */}
            {historyModal.open && historyModal.user && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setHistoryModal({ open: false, user: null, history: [] })}>
                    <div className="bg-[#0d1117] border border-white/[0.08] w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                            <div>
                                <h3 className="text-sm font-semibold text-white">Histórico de Planos</h3>
                                <p className="text-[11px] text-gray-500 mt-0.5">{historyModal.user.email}</p>
                            </div>
                            <button onClick={() => setHistoryModal({ open: false, user: null, history: [] })} className="text-gray-600 hover:text-gray-300"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
                            {historyModal.history.length === 0 ? (
                                <div className="text-center py-8 text-gray-600"><Clock className="w-8 h-8 opacity-30 mx-auto mb-2" /><p className="text-xs">Nenhuma alteração registrada</p></div>
                            ) : (
                                <div className="space-y-2">
                                    {historyModal.history.map(h => (
                                        <div key={h.id} className="flex items-start gap-3 p-3 bg-white/[0.02] border border-white/[0.05]">
                                            <CheckCircle className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    {h.previous_plan && <PlanBadge plan={h.previous_plan} />}
                                                    {h.previous_plan && <span className="text-gray-600 text-[10px]">→</span>}
                                                    <PlanBadge plan={h.new_plan} />
                                                </div>
                                                {h.notes && <p className="text-[11px] text-gray-500 mt-1">{h.notes}</p>}
                                                <p className="text-[10px] text-gray-700 mt-1">{new Date(h.created_at).toLocaleString('pt-BR')}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
