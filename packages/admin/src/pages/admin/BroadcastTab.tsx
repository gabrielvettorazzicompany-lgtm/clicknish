// BroadcastTab.tsx — Sistema de broadcasts / comunicados
import { useState, useEffect } from 'react'
import { Send, Trash2, RefreshCw, X, Megaphone, Info, AlertTriangle, CheckCircle, XCircle, Wrench } from 'lucide-react'
import { adminFetch } from './adminApi'

const BROADCAST_TYPES = [
    { id: 'info', label: 'Informativo', icon: <Info className="w-3.5 h-3.5" />, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
    { id: 'warning', label: 'Aviso', icon: <AlertTriangle className="w-3.5 h-3.5" />, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
    { id: 'success', label: 'Sucesso', icon: <CheckCircle className="w-3.5 h-3.5" />, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    { id: 'error', label: 'Erro / Alerta', icon: <XCircle className="w-3.5 h-3.5" />, color: 'text-red-400 bg-red-500/10 border-red-500/20' },
    { id: 'maintenance', label: 'Manutenção', icon: <Wrench className="w-3.5 h-3.5" />, color: 'text-gray-400 bg-gray-500/10 border-gray-500/20' },
]

const PLAN_OPTIONS = [
    { id: '', label: 'Todos os usuários' },
    { id: 'free', label: 'Somente Free' },
    { id: 'pro', label: 'Somente Pro' },
    { id: 'advanced', label: 'Somente Advanced' },
    { id: 'enterprise', label: 'Somente Enterprise' },
]

function TypeBadge({ type }: { type: string }) {
    const t = BROADCAST_TYPES.find(bt => bt.id === type) || BROADCAST_TYPES[0]
    return (
        <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 font-semibold border ${t.color}`}>
            {t.icon} {t.label}
        </span>
    )
}

interface Broadcast {
    id: string
    title: string
    message: string
    type: string
    target_all: boolean
    target_plan: string | null
    status: string
    sent_by_email: string
    sent_at: string
    created_at: string
}

export function BroadcastTab({ userId }: { userId: string }) {
    const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
    const [loading, setLoading] = useState(true)
    const [showCompose, setShowCompose] = useState(false)
    const [form, setForm] = useState({ title: '', message: '', type: 'info', target_plan: '' })
    const [sending, setSending] = useState(false)
    const [preview, setPreview] = useState<Broadcast | null>(null)
    const [toasts, setToasts] = useState<{ id: number; msg: string; ok: boolean }[]>([])
    const toast = (msg: string, ok = true) => { const id = Date.now(); setToasts(p => [...p, { id, msg, ok }]); setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500) }

    const fetchBroadcasts = async () => {
        setLoading(true)
        try {
            const res = await adminFetch('/broadcasts', userId)
            if (res.ok) { const d = await res.json(); setBroadcasts(d.broadcasts || []) }
        } catch (e) { console.error(e) } finally { setLoading(false) }
    }

    const handleSend = async () => {
        if (!form.title.trim() || !form.message.trim()) { toast('Título e mensagem obrigatórios.', false); return }
        setSending(true)
        try {
            const res = await adminFetch('/broadcasts', userId, {
                method: 'POST',
                body: JSON.stringify({
                    title: form.title, message: form.message, type: form.type,
                    target_plan: form.target_plan || null,
                    target_all: !form.target_plan,
                }),
            })
            if (res.ok) {
                toast('Broadcast enviado com sucesso!')
                setShowCompose(false)
                setForm({ title: '', message: '', type: 'info', target_plan: '' })
                fetchBroadcasts()
            } else {
                const err = await res.json()
                toast(err.error || 'Erro ao enviar broadcast.', false)
            }
        } catch { toast('Erro ao enviar broadcast.', false) } finally { setSending(false) }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Excluir este broadcast? Isso não remove as notificações já entregues.')) return
        try {
            const res = await adminFetch(`/broadcasts/${id}`, userId, { method: 'DELETE' })
            if (res.ok) { toast('Broadcast excluído.'); setBroadcasts(p => p.filter(b => b.id !== id)) }
            else toast('Erro ao excluir.', false)
        } catch { toast('Erro ao excluir.', false) }
    }

    useEffect(() => { fetchBroadcasts() }, [])

    return (
        <div className="space-y-4">
            <div className="fixed top-4 right-4 z-[100] space-y-2 pointer-events-none">
                {toasts.map(t => (
                    <div key={t.id} className={`px-4 py-2.5 text-xs font-medium border pointer-events-auto shadow-lg ${t.ok ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' : 'bg-red-500/20 border-red-500/30 text-red-400'}`}>{t.msg}</div>
                ))}
            </div>

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-sm font-semibold text-white">Broadcasts & Comunicados</h2>
                    <p className="text-[11px] text-gray-600 mt-0.5">Envie notificações para todos os produtores ou segmentadas por plano</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={fetchBroadcasts} className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white/[0.02] border border-white/[0.06] text-gray-500 hover:text-white hover:bg-white/[0.05] transition-colors">
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button onClick={() => setShowCompose(true)}
                        className="flex items-center gap-1.5 text-xs px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors">
                        <Send className="w-3.5 h-3.5" /> Novo Broadcast
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {BROADCAST_TYPES.map(t => {
                    const count = broadcasts.filter(b => b.type === t.id).length
                    return (
                        <div key={t.id} className="bg-[#0d1829] border border-white/[0.06] p-3">
                            <div className={`flex items-center gap-1.5 mb-1 ${t.color.split(' ')[0]}`}>{t.icon}<span className="text-[10px] font-semibold">{t.label}</span></div>
                            <p className="text-xl font-bold text-white">{count}</p>
                        </div>
                    )
                })}
            </div>

            {/* List */}
            <div className="bg-[#0d1829] border border-white/[0.06] overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.05] flex items-center justify-between">
                    <p className="text-xs font-semibold text-white">Broadcasts Enviados</p>
                    <span className="text-[11px] text-gray-600">{broadcasts.length} registros</span>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16 gap-2 text-gray-600"><RefreshCw className="w-4 h-4 animate-spin" /><span className="text-xs">Carregando…</span></div>
                ) : broadcasts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-600">
                        <Megaphone className="w-8 h-8 opacity-30" />
                        <p className="text-xs">Nenhum broadcast enviado ainda</p>
                        <button onClick={() => setShowCompose(true)} className="text-xs text-blue-400 hover:text-blue-300 mt-1">Enviar primeiro broadcast →</button>
                    </div>
                ) : (
                    <div className="divide-y divide-white/[0.03]">
                        {broadcasts.map(b => (
                            <div key={b.id} className="px-4 py-3 hover:bg-white/[0.02] transition-colors group">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <TypeBadge type={b.type} />
                                            {b.target_plan ? (
                                                <span className="text-[10px] px-2 py-0.5 bg-violet-500/10 border border-violet-500/20 text-violet-400 font-semibold">
                                                    Plano {b.target_plan}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] px-2 py-0.5 bg-white/[0.05] border border-white/[0.08] text-gray-400 font-semibold">Todos</span>
                                            )}
                                        </div>
                                        <p className="text-xs font-semibold text-white">{b.title}</p>
                                        <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{b.message}</p>
                                        <p className="text-[10px] text-gray-700 mt-1">
                                            por {b.sent_by_email} · {b.sent_at ? new Date(b.sent_at).toLocaleString('pt-BR') : new Date(b.created_at).toLocaleString('pt-BR')}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                        <button onClick={() => setPreview(b)} className="p-1.5 text-gray-600 hover:text-blue-400 transition-colors" title="Visualizar"><Info className="w-3.5 h-3.5" /></button>
                                        <button onClick={() => handleDelete(b.id)} className="p-1.5 text-gray-600 hover:text-red-400 transition-colors" title="Excluir"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Compose Modal */}
            {showCompose && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowCompose(false)}>
                    <div className="bg-[#0d1117] border border-white/[0.08] w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                            <div>
                                <h3 className="text-sm font-semibold text-white">Novo Broadcast</h3>
                                <p className="text-[11px] text-gray-500 mt-0.5">Notificação enviada dentro do painel dos produtores</p>
                            </div>
                            <button onClick={() => setShowCompose(false)} className="text-gray-600 hover:text-gray-300"><X className="w-4 h-4" /></button>
                        </div>

                        <div className="px-5 py-4 space-y-4">
                            <div>
                                <p className="text-[11px] text-gray-600 mb-2 font-medium uppercase tracking-wider">Título *</p>
                                <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                                    placeholder="Ex: Manutenção programada — 20 de março"
                                    className="w-full bg-white/[0.02] border border-white/[0.07] text-xs text-white placeholder-gray-700 px-3 py-2 focus:outline-none focus:border-blue-500/40" />
                            </div>

                            <div>
                                <p className="text-[11px] text-gray-600 mb-2 font-medium uppercase tracking-wider">Mensagem *</p>
                                <textarea value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} rows={4}
                                    placeholder="Descreva o comunicado com detalhes relevantes para os produtores…"
                                    className="w-full bg-white/[0.02] border border-white/[0.07] text-xs text-white placeholder-gray-700 p-3 focus:outline-none focus:border-blue-500/40 resize-none" />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <p className="text-[11px] text-gray-600 mb-2 font-medium uppercase tracking-wider">Tipo</p>
                                    <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                                        className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.07] text-xs text-white focus:outline-none focus:border-blue-500/40">
                                        {BROADCAST_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <p className="text-[11px] text-gray-600 mb-2 font-medium uppercase tracking-wider">Destinatário</p>
                                    <select value={form.target_plan} onChange={e => setForm(p => ({ ...p, target_plan: e.target.value }))}
                                        className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.07] text-xs text-white focus:outline-none focus:border-blue-500/40">
                                        {PLAN_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Preview */}
                            {form.title && (
                                <div className={`border p-3 ${BROADCAST_TYPES.find(t => t.id === form.type)?.color || ''}`}>
                                    <div className="flex items-center gap-1.5 mb-1">
                                        {BROADCAST_TYPES.find(t => t.id === form.type)?.icon}
                                        <span className="text-[10px] font-bold uppercase">Preview</span>
                                    </div>
                                    <p className="text-xs font-semibold">{form.title}</p>
                                    {form.message && <p className="text-[11px] opacity-80 mt-0.5">{form.message}</p>}
                                </div>
                            )}
                        </div>

                        <div className="px-5 py-3 border-t border-white/[0.06] flex gap-3 justify-end">
                            <button onClick={() => setShowCompose(false)} className="text-xs px-4 py-2 bg-white/[0.03] border border-white/[0.07] text-gray-400 hover:text-white transition-colors">Cancelar</button>
                            <button onClick={handleSend} disabled={sending || !form.title.trim() || !form.message.trim()}
                                className="text-xs px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-50 flex items-center gap-2">
                                {sending ? <><RefreshCw className="w-3 h-3 animate-spin" /> Enviando…</> : <><Send className="w-3 h-3" /> Enviar Broadcast</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Preview Modal */}
            {preview && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setPreview(null)}>
                    <div className="bg-[#0d1117] border border-white/[0.08] w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                            <h3 className="text-sm font-semibold text-white">Detalhes do Broadcast</h3>
                            <button onClick={() => setPreview(null)} className="text-gray-600 hover:text-gray-300"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="px-5 py-4 space-y-3">
                            <div className="flex items-center gap-2 flex-wrap"><TypeBadge type={preview.type} />{preview.target_plan ? <span className="text-[10px] px-2 py-0.5 bg-violet-500/10 border border-violet-500/20 text-violet-400 font-semibold">Plano {preview.target_plan}</span> : <span className="text-[10px] px-2 py-0.5 bg-white/[0.05] border border-white/[0.08] text-gray-400 font-semibold">Todos</span>}</div>
                            <div>
                                <p className="text-[10px] text-gray-600 font-semibold uppercase tracking-wider mb-1">Título</p>
                                <p className="text-xs text-white font-medium">{preview.title}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-600 font-semibold uppercase tracking-wider mb-1">Mensagem</p>
                                <p className="text-xs text-gray-300 whitespace-pre-wrap">{preview.message}</p>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-gray-600 pt-2 border-t border-white/[0.05]">
                                <span>Enviado por {preview.sent_by_email}</span>
                                <span>{new Date(preview.sent_at || preview.created_at).toLocaleString('pt-BR')}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
