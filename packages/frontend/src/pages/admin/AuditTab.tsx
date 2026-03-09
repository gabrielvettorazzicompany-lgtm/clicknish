import { useState, useEffect } from 'react'
import { adminFetch } from './adminApi'

const ACTION_META: Record<string, { label: string; color: string; dot: string }> = {
    ban_user: { label: 'Banir usuário', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30', dot: 'bg-amber-400' },
    unban_user: { label: 'Desbanir usuário', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400' },
    delete_user: { label: 'Deletar usuário', color: 'bg-red-500/10 text-red-400 border-red-500/30', dot: 'bg-red-400' },
    change_payment_provider: { label: 'Provedor (legado)', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30', dot: 'bg-purple-400' },
    create_payment_provider: { label: 'Criar provedor', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30', dot: 'bg-blue-400' },
    update_payment_provider: { label: 'Atualizar provedor', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30', dot: 'bg-indigo-400' },
    delete_payment_provider: { label: 'Deletar provedor', color: 'bg-red-500/10 text-red-400 border-red-500/30', dot: 'bg-red-400' },
    update_platform_config: { label: 'Config. plataforma', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30', dot: 'bg-cyan-400' },
    create_announcement: { label: 'Criar comunicado', color: 'bg-violet-500/10 text-violet-400 border-violet-500/30', dot: 'bg-violet-400' },
    delete_announcement: { label: 'Deletar comunicado', color: 'bg-white/[0.04] text-gray-400 border-white/[0.1]', dot: 'bg-gray-500' },
    approve_bank_verification: { label: 'Aprovar verificação', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400' },
    reject_bank_verification: { label: 'Rejeitar verificação', color: 'bg-orange-500/10 text-orange-400 border-orange-500/30', dot: 'bg-orange-400' },
}

function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'agora'
    if (m < 60) return `${m}min atrás`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h atrás`
    return new Date(dateStr).toLocaleDateString('pt-BR')
}

export function AuditTab({ userId }: { userId: string }) {
    const [logs, setLogs] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [actionFilter, setActionFilter] = useState('')

    const fetchLogs = async (p: number, filter = actionFilter) => {
        setLoading(true)
        try {
            const params = new URLSearchParams({ page: String(p), limit: '50' })
            if (filter) params.set('action', filter)
            const res = await adminFetch(`/audit-log?${params}`, userId)
            if (res.ok) {
                const d = await res.json()
                setLogs(d.logs || [])
                setTotal(d.total || 0)
                setPage(p)
            }
        } catch (e) { console.error(e) } finally { setLoading(false) }
    }

    useEffect(() => { fetchLogs(1) }, [])

    return (
        <div className="space-y-3">
            <div className="bg-[#0d1829] border border-white/[0.06] overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.05] flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <p className="text-sm font-semibold text-white">Audit Log</p>
                        <p className="text-xs text-gray-500 mt-0.5">{total} ações registradas</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            value={actionFilter}
                            onChange={e => { setActionFilter(e.target.value); fetchLogs(1, e.target.value) }}
                            className="px-2 py-1.5 bg-[#0d1829] border border-white/[0.07] text-white text-xs focus:outline-none"
                        >
                            <option value="">Todas as ações</option>
                            <option value="ban_user">Banir usuário</option>
                            <option value="unban_user">Desbanir usuário</option>
                            <option value="delete_user">Deletar usuário</option>
                            <option value="change_payment_provider">Alterar provedor (legado)</option>
                            <option value="create_payment_provider">Criar provedor</option>
                            <option value="update_payment_provider">Atualizar provedor</option>
                            <option value="delete_payment_provider">Deletar provedor</option>
                            <option value="update_platform_config">Config. plataforma</option>
                            <option value="create_announcement">Criar comunicado</option>
                            <option value="delete_announcement">Deletar comunicado</option>
                            <option value="approve_bank_verification">Aprovar verificação</option>
                            <option value="reject_bank_verification">Rejeitar verificação</option>
                        </select>
                        <button onClick={() => fetchLogs(1)} className="px-3 py-1.5 bg-white/[0.03] hover:bg-white/[0.06] text-gray-400 hover:text-gray-200 text-xs border border-white/[0.07] transition-colors">
                            Atualizar
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="px-4 py-6 flex justify-center"><div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>
                ) : logs.length === 0 ? (
                    <div className="px-4 py-6 text-center">
                        <p className="text-xs text-gray-600">Nenhuma ação registrada ainda.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/[0.04]">
                        {logs.map((log) => {
                            const meta = ACTION_META[log.action] || { label: log.action, color: 'bg-white/[0.03] text-gray-500 border-white/[0.07]', dot: 'bg-gray-600' }
                            const detailStr = JSON.stringify(log.details || {})
                            return (
                                <div key={log.id} className="px-4 py-3 flex items-start gap-3 hover:bg-white/[0.02] transition-colors">
                                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${meta.dot}`} />
                                    <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-violet-600 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                                        {log.admin_email?.charAt(0)?.toUpperCase() || 'A'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <span className="text-xs font-semibold text-white">{log.admin_email?.split('@')[0] || '—'}</span>
                                            <span className={`text-[10px] px-2 py-0.5 font-semibold border ${meta.color}`}>{meta.label}</span>
                                            {log.target_type && (
                                                <span className="text-[10px] text-gray-600 font-mono">{log.target_type} · {log.target_id?.slice(0, 8)}…</span>
                                            )}
                                        </div>
                                        {detailStr !== '{}' && (
                                            <p className="text-[10px] text-gray-600 font-mono truncate max-w-sm mt-0.5">
                                                {detailStr.slice(0, 80)}{detailStr.length > 80 ? '…' : ''}
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-[10px] text-gray-500">{timeAgo(log.created_at)}</p>
                                        <p className="text-[10px] text-gray-700">{new Date(log.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {total > 50 && (
                    <div className="px-4 py-3 border-t border-white/[0.05] flex items-center justify-between">
                        <p className="text-xs text-gray-600">Página {page} de {Math.ceil(total / 50)} · {total} registros</p>
                        <div className="flex gap-2">
                            <button disabled={page === 1} onClick={() => fetchLogs(page - 1)} className="px-3 py-1.5 bg-white/[0.03] hover:bg-white/[0.06] disabled:opacity-30 text-gray-400 text-xs border border-white/[0.07] transition-colors">← Anterior</button>
                            <button disabled={page * 50 >= total} onClick={() => fetchLogs(page + 1)} className="px-3 py-1.5 bg-white/[0.03] hover:bg-white/[0.06] disabled:opacity-30 text-gray-400 text-xs border border-white/[0.07] transition-colors">Próxima →</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
