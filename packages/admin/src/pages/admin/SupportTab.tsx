// SupportTab.tsx — Painel de suporte e tickets
import { useState, useEffect } from 'react'
import { MessageSquare, RefreshCw, X, Send, Clock, CheckCircle, AlertTriangle, Search, ChevronDown } from 'lucide-react'
import { adminFetch } from './adminApi'

const STATUS_OPTIONS = [
    { id: '', label: 'Todos os status' },
    { id: 'open', label: 'Aberto' },
    { id: 'in_progress', label: 'Em andamento' },
    { id: 'waiting_user', label: 'Aguardando usuário' },
    { id: 'resolved', label: 'Resolvido' },
    { id: 'closed', label: 'Fechado' },
]
const PRIORITY_OPTIONS = [
    { id: '', label: 'Todas as prioridades' },
    { id: 'urgent', label: 'Urgente' },
    { id: 'high', label: 'Alto' },
    { id: 'normal', label: 'Normal' },
    { id: 'low', label: 'Baixo' },
]
const CATEGORY_LABELS: Record<string, string> = {
    general: 'Geral', billing: 'Financeiro', technical: 'Técnico',
    account: 'Conta', payout: 'Saque', other: 'Outro',
}

function StatusBadge({ status }: { status: string }) {
    const m: Record<string, string> = {
        open: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
        in_progress: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
        waiting_user: 'bg-violet-500/15 text-violet-400 border-violet-500/25',
        resolved: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
        closed: 'bg-gray-500/15 text-gray-400 border-gray-500/25',
    }
    const labels: Record<string, string> = { open: 'Aberto', in_progress: 'Em andamento', waiting_user: 'Aguard. usuário', resolved: 'Resolvido', closed: 'Fechado' }
    return <span className={`text-[10px] px-2 py-0.5 font-semibold border ${m[status] || m.open}`}>{labels[status] || status}</span>
}

function PriorityBadge({ priority }: { priority: string }) {
    const m: Record<string, string> = {
        urgent: 'text-red-400 bg-red-500/10 border-red-500/20',
        high: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
        normal: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
        low: 'text-gray-400 bg-gray-500/10 border-gray-500/20',
    }
    const labels: Record<string, string> = { urgent: 'Urgente', high: 'Alto', normal: 'Normal', low: 'Baixo' }
    return <span className={`text-[10px] px-2 py-0.5 font-semibold border ${m[priority] || m.normal}`}>{labels[priority] || priority}</span>
}

interface Ticket {
    id: string; user_id: string; user_email: string; subject: string; description: string
    category: string; priority: string; status: string; assigned_to: string | null
    internal_notes: string | null; created_at: string; updated_at: string
}
interface Reply {
    id: string; ticket_id: string; author_id: string; author_email: string
    message: string; is_admin: boolean; created_at: string
}

export function SupportTab({ userId }: { userId: string }) {
    const [tickets, setTickets] = useState<Ticket[]>([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState('')
    const [priorityFilter, setPriorityFilter] = useState('')
    const [search, setSearch] = useState('')
    const [selected, setSelected] = useState<Ticket | null>(null)
    const [replies, setReplies] = useState<Reply[]>([])
    const [loadingDetail, setLoadingDetail] = useState(false)
    const [replyText, setReplyText] = useState('')
    const [sendingReply, setSendingReply] = useState(false)
    const [updatingStatus, setUpdatingStatus] = useState(false)
    const [toasts, setToasts] = useState<{ id: number; msg: string; ok: boolean }[]>([])
    const toast = (msg: string, ok = true) => { const id = Date.now(); setToasts(p => [...p, { id, msg, ok }]); setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500) }

    const fetchTickets = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (statusFilter) params.append('status', statusFilter)
            if (priorityFilter) params.append('priority', priorityFilter)
            const res = await adminFetch(`/support-tickets?${params}`, userId)
            if (res.ok) { const d = await res.json(); setTickets(d.tickets || []); setTotal(d.total || 0) }
        } catch (e) { console.error(e) } finally { setLoading(false) }
    }

    const fetchDetail = async (ticket: Ticket) => {
        setSelected(ticket)
        setLoadingDetail(true)
        setReplies([])
        try {
            const res = await adminFetch(`/support-tickets/${ticket.id}`, userId)
            if (res.ok) { const d = await res.json(); setSelected(d.ticket); setReplies(d.replies || []) }
        } catch (e) { console.error(e) } finally { setLoadingDetail(false) }
    }

    const handleSendReply = async () => {
        if (!selected || !replyText.trim()) return
        setSendingReply(true)
        try {
            const res = await adminFetch(`/support-tickets/${selected.id}/reply`, userId, { method: 'POST', body: JSON.stringify({ message: replyText }) })
            if (res.ok) {
                const d = await res.json()
                setReplies(p => [...p, d.reply])
                setReplyText('')
                setSelected(p => p ? { ...p, status: 'waiting_user' } : p)
                setTickets(prev => prev.map(t => t.id === selected.id ? { ...t, status: 'waiting_user' } : t))
                toast('Resposta enviada!')
            } else toast('Erro ao enviar resposta.', false)
        } catch { toast('Erro ao enviar resposta.', false) } finally { setSendingReply(false) }
    }

    const handleStatusChange = async (status: string) => {
        if (!selected) return
        setUpdatingStatus(true)
        try {
            const res = await adminFetch(`/support-tickets/${selected.id}`, userId, { method: 'PATCH', body: JSON.stringify({ status }) })
            if (res.ok) {
                setSelected(p => p ? { ...p, status } : p)
                setTickets(prev => prev.map(t => t.id === selected.id ? { ...t, status } : t))
                toast('Status atualizado!')
            } else toast('Erro ao atualizar status.', false)
        } catch { toast('Erro ao atualizar.', false) } finally { setUpdatingStatus(false) }
    }

    const handlePriorityChange = async (priority: string) => {
        if (!selected) return
        try {
            const res = await adminFetch(`/support-tickets/${selected.id}`, userId, { method: 'PATCH', body: JSON.stringify({ priority }) })
            if (res.ok) { setSelected(p => p ? { ...p, priority } : p); setTickets(prev => prev.map(t => t.id === selected.id ? { ...t, priority } : t)) }
        } catch { console.error('update priority') }
    }

    useEffect(() => { fetchTickets() }, [statusFilter, priorityFilter])

    const filteredTickets = tickets.filter(t =>
        !search || t.subject.toLowerCase().includes(search.toLowerCase()) || t.user_email?.toLowerCase().includes(search.toLowerCase())
    )

    const urgentCount = tickets.filter(t => t.priority === 'urgent' && t.status !== 'resolved' && t.status !== 'closed').length
    const openCount = tickets.filter(t => t.status === 'open').length

    return (
        <div className="space-y-4">
            <div className="fixed top-4 right-4 z-[100] space-y-2 pointer-events-none">
                {toasts.map(t => (
                    <div key={t.id} className={`px-4 py-2.5 text-xs font-medium border pointer-events-auto shadow-lg ${t.ok ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' : 'bg-red-500/20 border-red-500/30 text-red-400'}`}>{t.msg}</div>
                ))}
            </div>

            {/* Alert bar */}
            {urgentCount > 0 && (
                <div className="flex items-center gap-3 px-4 py-2.5 bg-red-500/10 border border-red-500/20 text-red-400">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <p className="text-xs font-medium">{urgentCount} ticket(s) urgente(s) aguardando resposta.</p>
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {STATUS_OPTIONS.slice(1).map(s => {
                    const count = tickets.filter(t => t.status === s.id).length
                    return (
                        <button key={s.id} onClick={() => setStatusFilter(statusFilter === s.id ? '' : s.id)}
                            className={`bg-[#0d1829] border p-3 text-left transition-colors ${statusFilter === s.id ? 'border-blue-500/40' : 'border-white/[0.06] hover:border-white/[0.12]'}`}>
                            <p className="text-[10px] text-gray-600 mb-1">{s.label}</p>
                            <p className="text-xl font-bold text-white">{count}</p>
                        </button>
                    )
                })}
            </div>

            {/* Filters + search */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none" />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar por assunto ou email…"
                        className="w-full pl-9 pr-4 py-1.5 bg-white/[0.02] border border-white/[0.06] text-xs text-white placeholder-gray-700 focus:outline-none focus:border-blue-500/40" />
                </div>
                <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
                    className="px-3 py-1.5 bg-white/[0.02] border border-white/[0.06] text-xs text-white focus:outline-none focus:border-blue-500/40">
                    {PRIORITY_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
                <button onClick={fetchTickets} className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white/[0.02] border border-white/[0.06] text-gray-500 hover:text-white hover:bg-white/[0.05] transition-colors ml-auto">
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
                </button>
            </div>

            {/* Ticket table */}
            <div className="bg-[#0d1829] border border-white/[0.06] overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.05] flex items-center justify-between">
                    <p className="text-xs font-semibold text-white">Tickets de Suporte</p>
                    <span className="text-[11px] text-gray-600">{openCount} abertos · {total} total</span>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16 gap-2 text-gray-600"><RefreshCw className="w-4 h-4 animate-spin" /><span className="text-xs">Carregando…</span></div>
                ) : filteredTickets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-600">
                        <MessageSquare className="w-8 h-8 opacity-30" />
                        <p className="text-xs">Nenhum ticket encontrado</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-[11px]">
                            <thead>
                                <tr className="border-b border-white/[0.05]">
                                    {['Usuário', 'Assunto', 'Categoria', 'Prioridade', 'Status', 'Data', 'Ações'].map(h => (
                                        <th key={h} className="px-4 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.03]">
                                {filteredTickets.map(t => (
                                    <tr key={t.id} className="hover:bg-white/[0.02] transition-colors group cursor-pointer" onClick={() => fetchDetail(t)}>
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-[9px] text-white font-bold flex-shrink-0">
                                                    {(t.user_email || '?').charAt(0).toUpperCase()}
                                                </div>
                                                <p className="text-gray-300 truncate max-w-[120px]">{t.user_email}</p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2.5 text-white font-medium max-w-[200px]">
                                            <p className="truncate">{t.subject}</p>
                                        </td>
                                        <td className="px-4 py-2.5 text-gray-500">{CATEGORY_LABELS[t.category] || t.category}</td>
                                        <td className="px-4 py-2.5"><PriorityBadge priority={t.priority} /></td>
                                        <td className="px-4 py-2.5"><StatusBadge status={t.status} /></td>
                                        <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{new Date(t.created_at).toLocaleDateString('pt-BR')}</td>
                                        <td className="px-4 py-2.5">
                                            <span className="text-[10px] text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">Abrir →</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Ticket detail panel */}
            {selected && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
                    <div className="bg-[#0d1117] border border-white/[0.08] w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="flex items-start justify-between px-5 py-4 border-b border-white/[0.06] flex-shrink-0">
                            <div className="flex-1 min-w-0 pr-4">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <StatusBadge status={selected.status} />
                                    <PriorityBadge priority={selected.priority} />
                                    <span className="text-[10px] text-gray-600">{CATEGORY_LABELS[selected.category] || selected.category}</span>
                                </div>
                                <h3 className="text-sm font-semibold text-white truncate">{selected.subject}</h3>
                                <p className="text-[11px] text-gray-500 mt-0.5">{selected.user_email} · {new Date(selected.created_at).toLocaleString('pt-BR')}</p>
                            </div>
                            <button onClick={() => setSelected(null)} className="text-gray-600 hover:text-gray-300 flex-shrink-0"><X className="w-4 h-4" /></button>
                        </div>

                        {/* Actions */}
                        <div className="px-5 py-3 border-b border-white/[0.05] flex items-center gap-3 flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-600 font-medium">Status:</span>
                                <select value={selected.status} onChange={e => handleStatusChange(e.target.value)}
                                    disabled={updatingStatus}
                                    className="text-[11px] px-2 py-1 bg-white/[0.03] border border-white/[0.07] text-white focus:outline-none focus:border-blue-500/40">
                                    {STATUS_OPTIONS.slice(1).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-600 font-medium">Prioridade:</span>
                                <select value={selected.priority} onChange={e => handlePriorityChange(e.target.value)}
                                    className="text-[11px] px-2 py-1 bg-white/[0.03] border border-white/[0.07] text-white focus:outline-none focus:border-blue-500/40">
                                    {PRIORITY_OPTIONS.slice(1).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Conversation */}
                        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                            {loadingDetail ? (
                                <div className="flex items-center justify-center py-8 gap-2 text-gray-600"><RefreshCw className="w-4 h-4 animate-spin" /><span className="text-xs">Carregando…</span></div>
                            ) : (
                                <>
                                    {/* Original message */}
                                    <div className="p-3 bg-white/[0.03] border border-white/[0.06]">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-[9px] text-white font-bold flex-shrink-0">
                                                {(selected.user_email || '?').charAt(0).toUpperCase()}
                                            </div>
                                            <span className="text-[10px] text-gray-500">{selected.user_email}</span>
                                            <span className="text-[10px] text-gray-700 ml-auto">{new Date(selected.created_at).toLocaleString('pt-BR')}</span>
                                        </div>
                                        <p className="text-xs text-gray-300 whitespace-pre-wrap">{selected.description}</p>
                                    </div>

                                    {/* Replies */}
                                    {replies.map(r => (
                                        <div key={r.id} className={`p-3 border ${r.is_admin ? 'bg-blue-500/5 border-blue-500/15 ml-4' : 'bg-white/[0.02] border-white/[0.05]'}`}>
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] text-white font-bold flex-shrink-0 ${r.is_admin ? 'bg-blue-600' : 'bg-gradient-to-br from-gray-500 to-gray-600'}`}>
                                                    {r.is_admin ? 'A' : (r.author_email || '?').charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-[10px] text-gray-500">{r.is_admin ? `Admin (${r.author_email})` : r.author_email}</span>
                                                <span className="text-[10px] text-gray-700 ml-auto">{new Date(r.created_at).toLocaleString('pt-BR')}</span>
                                            </div>
                                            <p className="text-xs text-gray-300 whitespace-pre-wrap">{r.message}</p>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>

                        {/* Reply input */}
                        {selected.status !== 'resolved' && selected.status !== 'closed' && (
                            <div className="px-5 py-4 border-t border-white/[0.06] flex-shrink-0">
                                <div className="flex gap-3">
                                    <textarea value={replyText} onChange={e => setReplyText(e.target.value)} rows={3}
                                        placeholder="Escreva sua resposta…"
                                        className="flex-1 bg-white/[0.02] border border-white/[0.07] text-xs text-white placeholder-gray-700 p-3 focus:outline-none focus:border-blue-500/40 resize-none" />
                                    <button onClick={handleSendReply} disabled={sendingReply || !replyText.trim()}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors disabled:opacity-50 flex-shrink-0 flex flex-col items-center justify-center gap-1">
                                        {sendingReply ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                        <span>Enviar</span>
                                    </button>
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                    <button onClick={() => handleStatusChange('resolved')} className="text-[10px] px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors flex items-center gap-1">
                                        <CheckCircle className="w-3 h-3" /> Marcar como resolvido
                                    </button>
                                    <button onClick={() => handleStatusChange('in_progress')} className="text-[10px] px-2 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> Em andamento
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
