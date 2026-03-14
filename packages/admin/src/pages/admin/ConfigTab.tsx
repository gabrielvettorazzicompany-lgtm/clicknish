import { useState, useEffect } from 'react'
import { adminFetch } from './adminApi'

export function ConfigTab({ userId }: { userId: string }) {
    const [platformConfig, setPlatformConfig] = useState<Record<string, any>>({})
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState<string | null>(null)
    const [edits, setEdits] = useState<Record<string, any>>({})

    const fetchConfig = async () => {
        setLoading(true)
        try {
            const res = await adminFetch('/platform-config', userId)
            if (res.ok) {
                const d = await res.json()
                setPlatformConfig(d)
                const e: Record<string, any> = {}
                Object.entries(d).forEach(([k, v]: [string, any]) => { e[k] = v.value })
                setEdits(e)
            }
        } catch (e) { console.error(e) } finally { setLoading(false) }
    }

    const saveKey = async (key: string) => {
        setSaving(key)
        try {
            const res = await adminFetch('/platform-config', userId, {
                method: 'PUT',
                body: JSON.stringify({ key, value: edits[key] }),
            })
            if (res.ok) fetchConfig()
        } catch (e) { console.error(e) } finally { setSaving(null) }
    }

    useEffect(() => { fetchConfig() }, [])

    const CONFIG_FIELDS = [
        { key: 'platform_fee_percentage', label: 'Taxa da plataforma (%)', desc: 'Percentual cobrado sobre cada transação', suffix: '%' },
        { key: 'max_free_apps', label: 'Máx. apps no plano Free', desc: 'Limite de apps para usuários gratuitos', suffix: 'apps' },
        { key: 'min_withdrawal_amount', label: 'Saque mínimo', desc: 'Valor mínimo em USD para solicitar saque', suffix: 'USD' },
        { key: 'withdrawal_hold_days', label: 'Prazo de retenção (D+N)', desc: 'Dias antes de liberar saldo para saque', suffix: 'dias' },
    ]

    return (
        <div className="space-y-4">
            {loading ? (
                <div className="flex justify-center py-24"><div className="w-10 h-10 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>
            ) : (
                <>
                    <div className="bg-[#0d1829] border border-white/[0.06] overflow-hidden">
                        <div className="px-4 py-3 border-b border-white/[0.05]">
                            <p className="text-sm font-semibold text-white">Configurações da Plataforma</p>
                            <p className="text-xs text-gray-500 mt-0.5">Valores aplicados globalmente para todos os usuários</p>
                        </div>
                        <div className="divide-y divide-white/[0.04]">
                            {CONFIG_FIELDS.map(({ key, label, desc, suffix }) => (
                                <div key={key} className="px-4 py-3 flex items-center gap-4 hover:bg-white/[0.02] transition-colors">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-white">{label}</p>
                                        <p className="text-[11px] text-gray-600 mt-0.5">{desc}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={edits[key] ?? ''}
                                                onChange={e => setEdits(ed => ({ ...ed, [key]: e.target.value }))}
                                                className="w-32 pr-10 pl-3 py-1.5 bg-white/[0.03] border border-white/[0.07] text-white text-sm focus:outline-none focus:border-blue-500/40 text-right"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-600 pointer-events-none">{suffix}</span>
                                        </div>
                                        <button
                                            onClick={() => saveKey(key)}
                                            disabled={saving === key}
                                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
                                        >
                                            {saving === key ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Salvar'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {edits['feature_flags'] && typeof edits['feature_flags'] === 'object' && (
                        <div className="bg-[#0d1829] border border-white/[0.06] overflow-hidden">
                            <div className="px-4 py-3 border-b border-white/[0.05]">
                                <p className="text-sm font-semibold text-white">Feature Flags</p>
                                <p className="text-xs text-gray-500 mt-0.5">Ligue e desligue funcionalidades sem deploy</p>
                            </div>
                            <div className="divide-y divide-white/[0.04]">
                                {Object.entries(edits['feature_flags'] as Record<string, boolean>).map(([flag]) => (
                                    <div key={flag} className="px-4 py-3 flex items-center gap-3">
                                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-gray-600" />
                                        <span className="flex-1 text-xs font-semibold text-white capitalize">{flag.replace(/_/g, ' ')}</span>
                                        <span className="text-[10px] px-2 py-0.5 font-semibold border flex-shrink-0 bg-white/[0.02] text-gray-500 border-white/[0.07]">
                                            Inativo
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
