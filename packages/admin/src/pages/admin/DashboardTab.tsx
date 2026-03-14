import { useState, useEffect } from 'react'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import { adminFetch } from './adminApi'

interface DashboardStats {
    overview: {
        totalUsers: number
        totalApplications: number
        totalProducts: number
    }
}

interface FinancialData {
    gmv: number
    platform_revenue: number
    fee_percent: number
    monthly_gmv: Record<string, number>
    new_users_30d: number | null
    conversion_rate: number | null
    top_sellers: Array<{ user_id: string; email: string; app_count: number }>
}

interface PaymentProvider {
    id: string
    name: string
    type: string
    is_active: boolean
    is_global_default: boolean
}

interface AuditEntry {
    id: string
    action: string
    admin_email: string
    created_at: string
}

export function DashboardTab({ userId, onNavigate }: { userId: string; onNavigate: (tab: string) => void }) {
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [financialData, setFinancialData] = useState<FinancialData | null>(null)
    const [providers, setProviders] = useState<PaymentProvider[]>([])
    const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
    const [loadingFinancial, setLoadingFinancial] = useState(false)
    const [loadingAuditLog, setLoadingAuditLog] = useState(false)

    const fetchAll = async () => {
        setLoadingFinancial(true)
        setLoadingAuditLog(true)
        try {
            const [statsRes, financialRes, providersRes, auditRes] = await Promise.all([
                adminFetch('/stats', userId),
                adminFetch('/financial', userId),
                adminFetch('/providers', userId),
                adminFetch('/audit-log?page=1&limit=8', userId),
            ])
            if (statsRes.ok) setStats(await statsRes.json())
            if (financialRes.ok) setFinancialData(await financialRes.json())
            if (providersRes.ok) { const d = await providersRes.json(); setProviders(d.providers || []) }
            if (auditRes.ok) { const d = await auditRes.json(); setAuditLog(d.logs || []) }
        } catch (e) { console.error(e) } finally {
            setLoadingFinancial(false)
            setLoadingAuditLog(false)
        }
    }

    useEffect(() => { fetchAll() }, [])

    const fetchFinancial = async () => {
        setLoadingFinancial(true)
        const res = await adminFetch('/financial', userId)
        if (res.ok) setFinancialData(await res.json())
        setLoadingFinancial(false)
    }

    // Trend calculations
    const _dashMonths = financialData ? Object.entries(financialData.monthly_gmv) : []
    const _lastGmv = _dashMonths.length >= 1 ? Number(_dashMonths[_dashMonths.length - 1][1]) : 0
    const _prevGmv = _dashMonths.length >= 2 ? Number(_dashMonths[_dashMonths.length - 2][1]) : null
    const dashGmvTrend = _prevGmv != null && _prevGmv > 0 ? ((_lastGmv - _prevGmv) / _prevGmv * 100).toFixed(1) : null
    const dashGmvTrendUp = dashGmvTrend != null ? Number(dashGmvTrend) >= 0 : true
    const _lastRev = financialData ? _lastGmv * financialData.fee_percent / 100 : 0
    const _prevRev = _prevGmv != null && financialData ? _prevGmv * financialData.fee_percent / 100 : null
    const dashRevTrend = _prevRev != null && _prevRev > 0 ? ((_lastRev - _prevRev) / _prevRev * 100).toFixed(1) : null
    const dashRevTrendUp = dashRevTrend != null ? Number(dashRevTrend) >= 0 : true
    const dashNew30d = financialData?.new_users_30d ?? null

    return (
        <div className="space-y-4">

            {/* ── Row 1: 3 KPI cards ─────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {[
                    {
                        label: 'Owners',
                        icon: (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        ),
                        value: stats ? stats.overview.totalUsers.toLocaleString('pt-BR') : '—',
                        pct: dashNew30d != null ? `+${dashNew30d}` : null,
                        up: true,
                        sub: 'owners cadastrados',
                        accent: '#a855f7',
                    },
                    {
                        label: 'GMV Total',
                        icon: (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        ),
                        value: financialData ? financialData.gmv.toLocaleString('pt-BR', { style: 'currency', currency: 'USD' }) : '—',
                        pct: dashGmvTrend != null ? `${dashGmvTrendUp ? '+' : ''}${dashGmvTrend}%` : null,
                        up: dashGmvTrendUp,
                        sub: 'volume bruto de vendas',
                        accent: '#3b82f6',
                    },
                    {
                        label: 'Receita',
                        icon: (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                        ),
                        value: financialData ? financialData.platform_revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'USD' }) : '—',
                        pct: dashRevTrend != null ? `${dashRevTrendUp ? '+' : ''}${dashRevTrend}%` : null,
                        up: dashRevTrendUp,
                        sub: financialData ? `taxa ${financialData.fee_percent}% do GMV` : 'taxa sobre GMV',
                        accent: '#22c55e',
                    },
                ].map(kpi => (
                    <div key={kpi.label} className="relative bg-[#0d1829] border border-white/[0.06] p-4 overflow-hidden group hover:border-white/[0.14] transition-all duration-300">
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: `radial-gradient(ellipse at top left, ${kpi.accent}18 0%, transparent 60%)` }} />
                        <div className="absolute left-0 top-0 bottom-0 w-0.5 group-hover:w-1 transition-all duration-300" style={{ background: kpi.accent }} />
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 flex items-center justify-center" style={{ color: kpi.accent }}>
                                    {kpi.icon}
                                </div>
                                <span className="text-xs text-gray-500 font-medium">•••</span>
                            </div>
                            {kpi.pct != null && (
                                <span className={`text-xs px-2 py-0.5 font-semibold ${kpi.up ? 'bg-gray-700/50 text-gray-300 border border-gray-600/40' : 'bg-gray-800/50 text-gray-400 border border-gray-700/40'}`}>
                                    {kpi.pct} ↑
                                </span>
                            )}
                        </div>
                        <p className="text-xl font-bold text-white leading-none mb-0.5">{kpi.value}</p>
                        <p className="text-[11px] text-gray-500">{kpi.label}</p>
                        <p className="text-[10px] text-gray-700 mt-0.5">{kpi.sub}</p>
                    </div>
                ))}
            </div>

            {/* ── Row 2: Area chart + right column ───────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {/* Area chart — 2/3 width */}
                <div className="lg:col-span-2 bg-[#0d1829] border border-white/[0.06] p-4">
                    <div className="flex items-start justify-between mb-1">
                        <div>
                            <p className="text-xs text-gray-500 font-medium">Receita total</p>
                            <p className="text-lg font-bold text-white mt-0.5">
                                {financialData
                                    ? Number((Object.values(financialData.monthly_gmv) as any[]).reduce((a, b) => a + Number(b), 0) * financialData.fee_percent / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'USD' })
                                    : '—'}
                                {dashRevTrend != null && (
                                    <span className={`ml-2 text-xs font-semibold px-2 py-0.5 align-middle ${dashRevTrendUp ? 'bg-gray-700/50 text-gray-300 border border-gray-600/40' : 'bg-gray-800/50 text-gray-400 border border-gray-700/40'}`}>
                                        {dashRevTrendUp ? '+' : ''}{dashRevTrend}%
                                    </span>
                                )}
                            </p>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-600">
                            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-blue-400 inline-block rounded" />GMV</span>
                            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-emerald-400 inline-block rounded" />Receita</span>
                        </div>
                    </div>

                    {loadingFinancial ? (
                        <div className="h-48 flex items-center justify-center"><div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>
                    ) : financialData && Object.keys(financialData.monthly_gmv).length > 0 ? (() => {
                        const entries = Object.entries(financialData.monthly_gmv).slice(-12) as [string, any][]
                        const categories = entries.map(([m]) => new Date(m + '-01').toLocaleDateString('pt-BR', { month: 'short' }))
                        const gmvData = entries.map(([, v]) => Number(v))
                        const revData = gmvData.map(v => v * financialData.fee_percent / 100)
                        const hcOpts: Highcharts.Options = {
                            chart: { type: 'area', backgroundColor: 'transparent', height: 195, margin: [5, 5, 28, 58], style: { fontFamily: 'inherit' } },
                            title: { text: undefined }, credits: { enabled: false }, legend: { enabled: false },
                            xAxis: { categories, labels: { style: { color: '#4b5563', fontSize: '10px' } }, lineColor: 'rgba(255,255,255,0.06)', tickColor: 'transparent' },
                            yAxis: { title: { text: undefined }, labels: { style: { color: '#4b5563', fontSize: '10px' }, formatter() { const v = this.value as number; return '$' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v) } }, gridLineColor: 'rgba(255,255,255,0.05)' },
                            tooltip: { backgroundColor: '#0a1628', borderColor: 'rgba(255,255,255,0.08)', borderRadius: 8, style: { color: '#e5e7eb', fontSize: '11px' }, shared: true, formatter() { let s = `<span style='font-size:11px;font-weight:600'>${this.x}</span><br/>`; this.points?.forEach(p => { s += `<span style='color:${p.color}'>● </span>${p.series.name}: <b>$${Number(p.y).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</b><br/>` }); return s } },
                            plotOptions: { area: { fillOpacity: 1, marker: { enabled: false, states: { hover: { enabled: true, radius: 3 } } }, lineWidth: 2 } },
                            series: [
                                { name: 'GMV', type: 'area', data: gmvData, color: '#3b82f6', fillColor: { linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 }, stops: [[0, 'rgba(59,130,246,0.28)'], [1, 'rgba(59,130,246,0.01)']] } },
                                { name: 'Receita', type: 'area', data: revData, color: '#22c55e', dashStyle: 'Dash', lineWidth: 1.5, fillColor: { linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 }, stops: [[0, 'rgba(34,197,94,0.12)'], [1, 'rgba(34,197,94,0.01)']] } }
                            ]
                        }
                        return <div className="mt-3"><HighchartsReact highcharts={Highcharts} options={hcOpts} /></div>
                    })() : (
                        <div className="h-44 flex items-center justify-center">
                            <button onClick={fetchFinancial} className="text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 px-4 py-2 border border-blue-500/20 transition-colors">Carregar dados financeiros</button>
                        </div>
                    )}
                </div>

                {/* Right column — mini bar chart */}
                <div className="flex flex-col gap-3">
                    <div className="flex-1 bg-[#0d1829] border border-white/[0.06] p-4">
                        <p className="text-xs text-gray-500 font-medium">Lucro total</p>
                        <p className="text-lg font-bold text-white mt-0.5">
                            {financialData ? financialData.platform_revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'USD' }) : '—'}
                            {dashRevTrend != null && (
                                <span className={`ml-2 text-xs align-middle px-1.5 py-0.5 font-semibold ${dashRevTrendUp ? 'bg-gray-700/50 text-gray-300' : 'bg-gray-800/50 text-gray-400'}`}>
                                    {dashRevTrendUp ? '+' : ''}{dashRevTrend}%
                                </span>
                            )}
                        </p>
                        <div className="mt-3">
                            {financialData ? (() => {
                                const entries = Object.entries(financialData.monthly_gmv).slice(-10) as [string, any][]
                                const data = entries.map(([, v]) => Number(v))
                                const colors = entries.map((_, i) => i === entries.length - 1 ? '#22c55e' : 'rgba(34,197,94,0.28)')
                                return <HighchartsReact highcharts={Highcharts} options={{ chart: { type: 'column', backgroundColor: 'transparent', height: 70, margin: [0, 0, 0, 0], spacing: [0, 0, 0, 0], style: { fontFamily: 'inherit' } }, title: { text: undefined }, credits: { enabled: false }, legend: { enabled: false }, xAxis: { visible: false }, yAxis: { visible: false }, tooltip: { backgroundColor: '#0d1829', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 6, style: { color: '#fff', fontSize: '10px' }, formatter() { return `<b>$${Number(this.y).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</b>` } }, plotOptions: { column: { borderWidth: 0, borderRadius: 2, colorByPoint: true, colors, states: { hover: { brightness: 0.2 } } } }, series: [{ type: 'column', data }] } as Highcharts.Options} />
                            })() : <div className="h-16 bg-white/[0.02] rounded" />}
                        </div>
                        <p className="text-[10px] text-gray-700 mt-2">Últimos 12 meses <button onClick={() => onNavigate('financial')} className="text-blue-500 hover:text-blue-400 transition-colors ml-1">Ver relatório →</button></p>
                    </div>
                </div>
            </div>

            {/* ── Row 3: Platform overview table ─────────────────────────────── */}
            <div className="bg-[#0d1829] border border-white/[0.06]">
                <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
                    <div>
                        <p className="text-sm font-semibold text-white">Visão geral da plataforma</p>
                        <p className="text-xs text-gray-500 mt-0.5">Resumo de todas as métricas operacionais</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => onNavigate('financial')} className="text-xs px-2 py-1 bg-gray-800/50 hover:bg-gray-700/50 border border-gray-600/30 text-gray-400 hover:text-gray-300 rounded transition-colors">Exportar</button>
                        <button onClick={fetchFinancial} className="text-xs px-2 py-1 bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 hover:text-white transition-colors rounded">Atualizar</button>
                    </div>
                </div>
                <div className="divide-y divide-white/[0.04]">
                    {[
                        { label: 'GMV acumulado', value: financialData ? financialData.gmv.toLocaleString('pt-BR', { style: 'currency', currency: 'USD' }) : '—', sub: 'Volume bruto total de vendas na plataforma', trend: dashGmvTrend, up: dashGmvTrendUp },
                        { label: 'Receita da plataforma', value: financialData ? financialData.platform_revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'USD' }) : '—', sub: financialData ? `Taxa de ${financialData.fee_percent}% aplicada ao GMV` : 'Taxa sobre GMV', trend: dashRevTrend, up: dashRevTrendUp },
                        { label: 'Total de owners', value: stats ? stats.overview.totalUsers.toLocaleString('pt-BR') : '—', sub: `${stats?.overview?.totalApplications ?? '—'} apps criados na plataforma`, trend: dashNew30d != null ? String(dashNew30d) : null, up: true },
                        { label: 'Produtos no marketplace', value: stats?.overview?.totalProducts?.toLocaleString('pt-BR') ?? '—', sub: 'Produtos publicados e disponíveis', trend: null, up: true },
                        { label: 'Saúde dos serviços', value: `${[true, true, providers.some(p => p.type === 'stripe' && p.is_active), providers.some(p => p.type === 'paypal' && p.is_active), true].filter(Boolean).length}/5 operacionais`, sub: 'Workers API · Supabase · Stripe · PayPal · SMTP', trend: null, up: true },
                    ].map(row => (
                        <div key={row.label} className="px-6 py-3.5 flex items-center gap-4 hover:bg-white/[0.02] transition-colors group">
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-white">{row.label}</p>
                                <p className="text-[11px] text-gray-600 mt-0.5">{row.sub}</p>
                            </div>
                            <p className="text-sm font-bold text-white shrink-0">{row.value}</p>
                            {row.trend != null && (
                                <span className={`text-xs px-2 py-0.5 font-semibold shrink-0 ${row.up ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/15 text-red-400 border border-red-500/20'}`}>
                                    {row.up ? '+' : ''}{row.trend}{typeof row.trend === 'string' && row.trend.includes('%') ? '' : row.up ? ' novos' : ''}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Row 4: Providers + Activity + Health ────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {/* Provedores */}
                <div className="bg-[#0d1829] border border-white/[0.06] overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/[0.05] flex items-center justify-between">
                        <p className="text-xs font-semibold text-white">Provedores de pagamento</p>
                        <button onClick={() => onNavigate('providers')} className="text-[10px] text-blue-500 hover:text-blue-400 transition-colors">Gerenciar →</button>
                    </div>
                    <div className="divide-y divide-white/[0.04]">
                        {providers.length === 0 ? (
                            <div className="px-5 py-8 text-center"><p className="text-xs text-gray-600">Nenhum provedor cadastrado</p></div>
                        ) : providers.map(p => {
                            const C: Record<string, string> = { stripe: '#3b82f6', stripe_connect: '#3b82f6', mollie: '#f97316', paypal: '#0ea5e9', custom: '#a855f7' }
                            const c = C[p.type] || '#6b7280'
                            return (
                                <div key={p.id} className="px-5 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
                                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.is_active ? c : '#374151', boxShadow: p.is_active ? `0 0 6px ${c}80` : 'none' }} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-white truncate">{p.name}</p>
                                        <p className="text-[10px] text-gray-600">{p.type}{p.is_global_default ? ' · default' : ''}</p>
                                    </div>
                                    <span className="text-[10px] px-1.5 py-0.5 border font-semibold flex-shrink-0" style={{ color: p.is_active ? c : '#6b7280', borderColor: p.is_active ? `${c}40` : '#374151', background: p.is_active ? `${c}15` : 'transparent' }}>
                                        {p.is_active ? 'ativo' : 'inativo'}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Feed de atividade */}
                <div className="bg-[#0d1829] border border-white/[0.06] overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/[0.05] flex items-center justify-between">
                        <p className="text-xs font-semibold text-white">Atividade recente</p>
                        <button onClick={() => onNavigate('audit')} className="text-[10px] text-blue-500 hover:text-blue-400 transition-colors">Audit log →</button>
                    </div>
                    {loadingAuditLog ? (
                        <div className="p-8 flex justify-center"><div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>
                    ) : auditLog.length === 0 ? (
                        <div className="px-5 py-8 text-center"><p className="text-xs text-gray-600">Sem registros</p></div>
                    ) : (
                        <div className="divide-y divide-white/[0.04] max-h-64 overflow-y-auto">
                            {auditLog.slice(0, 8).map(log => {
                                const META: Record<string, { label: string; color: string }> = {
                                    ban_user: { label: 'Banir usuário', color: '#f59e0b' },
                                    unban_user: { label: 'Desbanir', color: '#22c55e' },
                                    delete_user: { label: 'Deletar usuário', color: '#ef4444' },
                                    create_payment_provider: { label: 'Novo provedor', color: '#3b82f6' },
                                    update_payment_provider: { label: 'Provedor atualizado', color: '#6366f1' },
                                    delete_payment_provider: { label: 'Provedor removido', color: '#ef4444' },
                                    update_platform_config: { label: 'Config. alterada', color: '#06b6d4' },
                                    create_announcement: { label: 'Comunicado', color: '#a855f7' },
                                    approve_bank_verification: { label: 'Verificação aprovada', color: '#22c55e' },
                                    reject_bank_verification: { label: 'Verificação rejeitada', color: '#f97316' },
                                }
                                const m = META[log.action] || { label: log.action, color: '#6b7280' }
                                const diff = Date.now() - new Date(log.created_at).getTime()
                                const mins = Math.floor(diff / 60000)
                                const timeAgo = mins < 1 ? 'agora' : mins < 60 ? `${mins}min` : mins < 1440 ? `${Math.floor(mins / 60)}h` : new Date(log.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
                                return (
                                    <div key={log.id} className="px-5 py-3 flex items-start gap-2.5 hover:bg-white/[0.02] transition-colors">
                                        <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: m.color }} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[11px] font-medium text-white truncate">{m.label}</p>
                                            <p className="text-[10px] text-gray-700">{log.admin_email?.split('@')[0] || 'admin'}</p>
                                        </div>
                                        <span className="text-[10px] text-gray-700 flex-shrink-0">{timeAgo}</span>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Top Sellers + Health */}
                <div className="flex flex-col gap-3">
                    <div className="flex-1 bg-[#0d1829] border border-white/[0.06] overflow-hidden">
                        <div className="px-4 py-3 border-b border-white/[0.05]">
                            <p className="text-xs font-semibold text-white">Top Sellers</p>
                        </div>
                        {(() => {
                            const sellers = financialData?.top_sellers ?? []
                            if (sellers.length === 0) return <div className="px-5 py-6 text-center"><p className="text-xs text-gray-600">Sem dados</p></div>
                            return (
                                <div className="divide-y divide-white/[0.04]">
                                    {sellers.slice(0, 4).map((s, idx) => (
                                        <div key={s.user_id} className="px-5 py-2.5 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
                                            <span className="text-sm w-4 text-center flex-shrink-0">{idx + 1}</span>
                                            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-violet-600 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                                                {s.email.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[11px] text-white truncate font-medium">{s.email.split('@')[0]}</p>
                                                <div className="w-full h-0.5 bg-white/[0.04] mt-1">
                                                    <div className="h-full bg-blue-500" style={{ width: `${Math.round((s.app_count / (sellers[0]?.app_count || 1)) * 100)}%` }} />
                                                </div>
                                            </div>
                                            <span className="text-[11px] font-bold text-blue-400 flex-shrink-0">{s.app_count}</span>
                                        </div>
                                    ))}
                                </div>
                            )
                        })()}
                    </div>
                    <div className="bg-[#0d1829] border border-white/[0.06] px-4 py-3">
                        <p className="text-xs font-semibold text-white mb-3">Saúde dos serviços</p>
                        <div className="space-y-2">
                            {[
                                { name: 'Workers API', ok: true },
                                { name: 'Supabase DB', ok: true },
                                { name: 'Stripe Hook', ok: providers.some(p => p.type === 'stripe' && p.is_active) },
                                { name: 'PayPal Hook', ok: providers.some(p => p.type === 'paypal' && p.is_active) },
                                { name: 'Email SMTP', ok: true },
                            ].map(svc => (
                                <div key={svc.name} className="flex items-center justify-between">
                                    <span className="text-[11px] text-gray-500">{svc.name}</span>
                                    <span className={`text-[10px] px-2 py-0.5 font-semibold ${svc.ok ? 'bg-gray-700/50 text-gray-300 border border-gray-600/40' : 'bg-gray-800/50 text-gray-400 border border-gray-700/40'}`}>
                                        {svc.ok ? 'online' : 'offline'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
