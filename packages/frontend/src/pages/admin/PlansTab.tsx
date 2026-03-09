import { useState, useEffect } from 'react'
import { useI18n } from '@/i18n'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import { adminFetch } from './adminApi'

interface PlanUser {
    id: string
    name: string
    email: string
    created_at: string
    app_count: number
    last_activity: string
    plan?: string
}

export function PlansTab({ userId, onNavigateToUsers }: { userId: string; onNavigateToUsers: () => void }) {
    const { t } = useI18n()
    const [users, setUsers] = useState<PlanUser[]>([])
    const [loading, setLoading] = useState(false)

    const fetchUsers = async () => {
        setLoading(true)
        try {
            const res = await adminFetch('/users', userId)
            if (res.ok) {
                const d = await res.json()
                setUsers(d.users || [])
            }
        } catch (e) { console.error(e) } finally { setLoading(false) }
    }

    useEffect(() => { fetchUsers() }, [])

    return (
        <div className="backdrop-blur-xl bg-white/[0.02] rounded-none border border-white/[0.05]">
            <div className="p-4">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-semibold text-white">{t('superadmin.user_plans')}</h3>
                        <p className="text-sm text-gray-500 mt-1">{t('superadmin.stripe_integration')}</p>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>
                ) : (
                    <>
                        {/* Plan Statistics */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            {[
                                { label: 'Free', value: users.filter(u => u.plan === 'free' || !u.plan).length, color: 'text-gray-500' },
                                { label: 'Pro', value: users.filter(u => u.plan === 'pro').length, color: 'text-blue-400' },
                                { label: 'Advanced', value: users.filter(u => u.plan === 'advanced').length, color: 'text-blue-400' },
                            ].map(s => (
                                <div key={s.label} className="backdrop-blur-xl bg-white/[0.02] p-4 rounded-xl border border-white/[0.05]">
                                    <div className={`text-sm ${s.color}`}>{s.label}</div>
                                    <div className="text-xl font-bold text-white">{s.value}</div>
                                </div>
                            ))}
                        </div>

                        {/* Plan Distribution Chart */}
                        {users.length > 0 && (
                            <div className="mb-5">
                                <HighchartsReact highcharts={Highcharts} options={{
                                    chart: { type: 'bar', backgroundColor: 'transparent', height: 80, margin: [5, 10, 5, 10], style: { fontFamily: 'inherit' } },
                                    title: { text: undefined }, credits: { enabled: false }, legend: { enabled: false },
                                    xAxis: { categories: ['Free', 'Pro', 'Advanced'], labels: { style: { color: '#6b7280', fontSize: '11px' } }, lineColor: 'transparent', tickColor: 'transparent' },
                                    yAxis: { visible: false, max: Math.max(users.length, 1) },
                                    tooltip: { backgroundColor: '#0d1829', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 6, style: { color: '#fff', fontSize: '10px' }, formatter() { return `<b>${this.x}:</b> ${this.y} usuários` } },
                                    plotOptions: { bar: { borderWidth: 0, borderRadius: 4, dataLabels: { enabled: true, style: { color: '#9ca3af', fontSize: '10px', fontWeight: '600', textOutline: 'none' } } } },
                                    series: [{
                                        type: 'bar', data: [
                                            { y: users.filter(u => u.plan === 'free' || !u.plan).length, color: 'rgba(107,114,128,0.6)' },
                                            { y: users.filter(u => u.plan === 'pro').length, color: 'rgba(59,130,246,0.7)' },
                                            { y: users.filter(u => u.plan === 'advanced').length, color: '#3b82f6' },
                                        ],
                                    }],
                                } as Highcharts.Options} />
                            </div>
                        )}

                        {/* Users Table */}
                        <div className="overflow-x-auto">
                            <table className="min-w-full">
                                <thead>
                                    <tr className="border-b border-white/[0.05]">
                                        {['User', 'Plano', 'Apps', 'Cadastro', 'Ações'].map(h => (
                                            <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.04]">
                                    {users.map(u => (
                                        <tr key={u.id} className="hover:bg-white/[0.03] transition-colors">
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                                                        {u.email.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium text-white">{u.email}</div>
                                                        <div className="text-xs text-gray-500 truncate max-w-[150px]">{u.id}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${u.plan === 'advanced' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : u.plan === 'pro' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'}`}>
                                                    {u.plan === 'advanced' ? 'Advanced' : u.plan === 'pro' ? 'Pro' : 'Free'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-white">{u.app_count} apps</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                {u.created_at ? new Date(u.created_at).toLocaleDateString('en-US') : 'N/A'}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                                                <button onClick={onNavigateToUsers} className="text-blue-400 hover:text-blue-300 font-medium transition-colors text-sm">
                                                    {t('superadmin.change_plan')}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="mt-6 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                            <h4 className="text-sm font-medium text-blue-400 mb-1">{t('superadmin.stripe_in_dev')}</h4>
                            <p className="text-xs text-gray-500">
                                Current plans are based on the number of applications created. Soon, you'll be able to manage real subscriptions through Stripe, including webhooks for automatic payment synchronization and plan upgrades/downgrades.
                            </p>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
