import { useState, useEffect } from 'react'
import { useI18n } from '@/i18n'
import { adminFetch } from './adminApi'

interface BankVerification {
    id: string
    user_id: string
    user_email: string
    account_holder_name: string
    date_of_birth: string
    phone_number: string
    bank_name: string
    bank_country: string
    account_type: string
    account_number: string
    iban: string
    bic_swift: string
    currency: string
    city: string
    state: string
    country: string
    id_document_url: string
    address_proof_url: string
    bank_statement_url: string
    verification_status: string
    submitted_at: string
}

export function VerificationsTab({ userId, onCountChange }: { userId: string; onCountChange?: (n: number) => void }) {
    const { t } = useI18n()
    const [verifications, setVerifications] = useState<BankVerification[]>([])
    const [loading, setLoading] = useState(false)
    const [processingId, setProcessingId] = useState<string | null>(null)
    const [showRejectModal, setShowRejectModal] = useState(false)
    const [showDetailsModal, setShowDetailsModal] = useState(false)
    const [selected, setSelected] = useState<BankVerification | null>(null)
    const [rejectionReason, setRejectionReason] = useState('')
    const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')

    const fetchVerifications = async () => {
        setLoading(true)
        try {
            const res = await adminFetch('/bank-verifications', userId)
            if (res.ok) {
                const d = await res.json()
                const list = d.verifications || []
                setVerifications(list)
                onCountChange?.(list.filter((v: any) => v.verification_status === 'pending').length)
            }
        } catch (e) { console.error(e) } finally { setLoading(false) }
    }

    useEffect(() => { fetchVerifications() }, [])

    const handleApprove = async (id: string) => {
        setProcessingId(id)
        try {
            const res = await adminFetch(`/bank-verifications/${id}/approve`, userId, { method: 'PUT' })
            if (res.ok) { alert('Bank account approved!'); fetchVerifications() }
            else { const e = await res.json(); alert(`Error: ${e.error}`) }
        } catch (e) { console.error(e) } finally { setProcessingId(null) }
    }

    const handleReject = async () => {
        if (!selected) return
        setProcessingId(selected.id)
        try {
            const res = await adminFetch(`/bank-verifications/${selected.id}/reject`, userId, {
                method: 'PUT',
                body: JSON.stringify({ reason: rejectionReason || 'Your bank account verification was rejected. Please review the information and resubmit.' }),
            })
            if (res.ok) {
                alert('Bank account rejected')
                setShowRejectModal(false)
                setSelected(null)
                setRejectionReason('')
                fetchVerifications()
            } else { const e = await res.json(); alert(`Error: ${e.error}`) }
        } catch (e) { console.error(e) } finally { setProcessingId(null) }
    }

    const pendingCount = verifications.filter(v => v.verification_status === 'pending').length
    const approvedCount = verifications.filter(v => v.verification_status === 'approved').length
    const rejectedCount = verifications.filter(v => v.verification_status === 'rejected').length

    const filteredVerifications = activeTab === 'all' ? verifications : verifications.filter(v => v.verification_status === activeTab)

    return (
        <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
                {[
                    { label: 'Pendentes', value: pendingCount, color: 'text-amber-400', dot: 'bg-amber-400' },
                    { label: 'Aprovadas', value: approvedCount, color: 'text-emerald-400', dot: 'bg-emerald-400' },
                    { label: 'Rejeitadas', value: rejectedCount, color: 'text-red-400', dot: 'bg-red-400' },
                ].map(s => (
                    <div key={s.label} className="flex flex-col items-center justify-center bg-[#101624] rounded-lg py-3 border border-white/[0.04]">
                        <span className={`w-2 h-2 rounded-full mb-1 ${s.dot}`} />
                        <span className={`text-lg font-bold ${s.color}`}>{s.value}</span>
                        <span className="text-xs text-gray-500 mt-0.5">{s.label}</span>
                    </div>
                ))}
            </div>

            <div className="bg-[#101624] rounded-lg border border-white/[0.04] p-5">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-semibold text-white">Verificações Bancárias</h2>
                        <p className="text-xs text-gray-500 mt-0.5">{t('superadmin.review_accounts_desc')}</p>
                    </div>
                    <button onClick={fetchVerifications} className="px-3 py-1 bg-gray-900 hover:bg-gray-800 text-gray-300 hover:text-white rounded text-xs border border-white/[0.06] transition-colors">
                        {t('superadmin.refresh')}
                    </button>
                </div>

                {/* Status Tabs */}
                <div className="flex gap-1 mb-4 bg-[#0d1422] rounded-lg p-1 border border-white/[0.04]">
                    {([
                        { key: 'all', label: 'Todas', count: verifications.length },
                        { key: 'pending', label: 'Pendentes', count: pendingCount },
                        { key: 'approved', label: 'Aprovadas', count: approvedCount },
                        { key: 'rejected', label: 'Rejeitadas', count: rejectedCount },
                    ] as const).map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${activeTab === tab.key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/[0.05]'}`}
                        >
                            {tab.label}
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-white/[0.06] text-gray-400'}`}>{tab.count}</span>
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="text-center py-12">
                        <div className="w-10 h-10 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto" />
                        <p className="text-gray-500 text-sm mt-4">{t('superadmin.loading_verifications')}</p>
                    </div>
                ) : filteredVerifications.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-xl font-bold text-blue-400 mb-2">{t('superadmin.all_caught_up')}</p>
                        <p className="text-sm text-gray-500">{t('superadmin.no_pending_verifications')}</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredVerifications.map(v => (
                            <div key={v.id} className="bg-[#0d1422] border border-white/[0.04] rounded-lg p-4 flex flex-col gap-3">
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-blue-600/80 flex items-center justify-center text-white font-bold text-base">
                                            {v.account_holder_name?.charAt(0) || 'U'}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-semibold text-white text-base">{v.account_holder_name || 'Unknown'}</h3>
                                                <span className={`text-xs px-2 py-0.5 rounded-full border border-white/[0.08] ${v.verification_status === 'pending' ? 'text-amber-400 bg-amber-400/10' : v.verification_status === 'approved' ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'}`}>{v.verification_status}</span>
                                            </div>
                                            <p className="text-xs text-gray-400">{v.user_email}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 mt-2 md:mt-0">
                                        {v.verification_status === 'pending' && (
                                            <>
                                                <button onClick={() => handleApprove(v.id)} disabled={processingId === v.id} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded text-xs font-medium transition-colors">
                                                    {processingId === v.id ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : t('superadmin.approve')}
                                                </button>
                                                <button onClick={() => { setSelected(v); setShowRejectModal(true) }} disabled={processingId === v.id} className="px-3 py-1 bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white rounded text-xs font-medium transition-colors">
                                                    {t('superadmin.reject')}
                                                </button>
                                            </>
                                        )}
                                        <button onClick={() => { setSelected(v); setShowDetailsModal(true) }} className="px-3 py-1 bg-gray-900 hover:bg-gray-800 text-gray-300 hover:text-white rounded text-xs font-medium border border-white/[0.06] transition-colors">
                                            {t('superadmin.view_details')}
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mt-1">
                                    {[['Banco', v.bank_name], ['País', v.bank_country], ['Tipo', v.account_type], ['Moeda', v.currency], ['Conta', `****${(v.account_number || v.iban)?.slice(-4) || 'XXXX'}`], ['Enviado', new Date(v.submitted_at).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })]].map(([label, val]) => (
                                        <div key={label}>
                                            <span className="text-gray-500">{label}</span>
                                            <div className="text-white font-medium">{val || 'N/A'}</div>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {v.id_document_url && <a href={v.id_document_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-2 py-1 bg-gray-900 text-gray-300 rounded text-xs hover:bg-gray-800 border border-white/[0.06]">Doc ID ↗</a>}
                                    {v.address_proof_url && <a href={v.address_proof_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-2 py-1 bg-gray-900 text-gray-300 rounded text-xs hover:bg-gray-800 border border-white/[0.06]">Comprovante Endereço ↗</a>}
                                    {v.bank_statement_url && <a href={v.bank_statement_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-2 py-1 bg-gray-900 text-gray-300 rounded text-xs hover:bg-gray-800 border border-white/[0.06]">Extrato Bancário ↗</a>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Reject Modal */}
            {showRejectModal && selected && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="backdrop-blur-xl bg-[#0d1117]/95 rounded-none shadow-2xl w-full max-w-md border border-white/[0.05]">
                        <div className="p-4 border-b border-white/[0.05]">
                            <h3 className="text-lg font-semibold text-white">Reject Bank Account</h3>
                            <p className="text-sm text-gray-500 mt-1">Rejecting: {selected.account_holder_name}'s account</p>
                        </div>
                        <div className="p-4">
                            <label className="block text-sm font-medium text-gray-300 mb-2">Rejection Reason *</label>
                            <textarea
                                value={rejectionReason}
                                onChange={e => setRejectionReason(e.target.value)}
                                placeholder="Enter the reason for rejection (will be shown to the user)"
                                rows={4}
                                className="w-full p-3 bg-white/[0.03] border border-white/[0.08] rounded-xl focus:ring-2 focus:ring-blue-400/50 focus:border-blue-500 text-white"
                            />
                        </div>
                        <div className="p-4 border-t border-white/[0.05] flex gap-3 justify-end">
                            <button onClick={() => { setShowRejectModal(false); setSelected(null); setRejectionReason('') }} className="px-4 py-2 text-gray-300 bg-white/[0.05] hover:bg-white/[0.1] rounded-lg font-medium transition-colors">Cancel</button>
                            <button onClick={handleReject} disabled={processingId === selected.id} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">
                                {processingId === selected.id ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : 'Reject Account'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Details Modal */}
            {showDetailsModal && selected && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="backdrop-blur-xl bg-[#0d1117]/95 rounded-none shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-white/[0.05]">
                        <div className="p-4 border-b border-white/[0.05] sticky top-0 backdrop-blur-xl bg-white/[0.02] z-10 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-white">Verification Details</h3>
                                <p className="text-sm text-gray-500 mt-1">{selected.user_email}</p>
                            </div>
                            <button onClick={() => { setShowDetailsModal(false); setSelected(null) }} className="text-gray-400 hover:text-white text-xl font-light">×</button>
                        </div>
                        <div className="p-4 space-y-4">
                            {[
                                { section: 'Account Holder', fields: [['Full Name', selected.account_holder_name], ['Date of Birth', selected.date_of_birth], ['Phone Number', selected.phone_number]] },
                                { section: 'Address', fields: [['City', selected.city], ['State', selected.state], ['Country', selected.country]] },
                                { section: 'Bank Account', fields: [['Bank Name', selected.bank_name], ['Bank Country', selected.bank_country], ['Account Type', selected.account_type], ['Currency', selected.currency], ...(selected.account_number ? [['Account Number', selected.account_number]] : []), ...(selected.iban ? [['IBAN', selected.iban]] : []), ...(selected.bic_swift ? [['BIC/SWIFT', selected.bic_swift]] : [])] },
                            ].map(({ section, fields }) => (
                                <div key={section}>
                                    <h4 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">{section}</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        {fields.map(([label, val]) => (
                                            <div key={label}>
                                                <p className="text-xs text-gray-500">{label}</p>
                                                <p className="text-sm text-white">{val || 'N/A'}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">Uploaded Documents</h4>
                                <div className="flex flex-wrap gap-3">
                                    {[['id_document_url', 'View ID Document ↗'], ['address_proof_url', 'View Address Proof ↗'], ['bank_statement_url', 'View Bank Statement ↗']].map(([key, label]) => {
                                        const url = selected[key as keyof BankVerification] as string
                                        return url
                                            ? <a key={key} href={url} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-lg text-sm hover:bg-blue-500/20 transition-colors">{label}</a>
                                            : <div key={key} className="px-4 py-2 bg-gray-500/10 text-gray-400 border border-gray-500/30 rounded-lg text-sm">{label.replace('View ', '').replace(' ↗', ' Missing')}</div>
                                    })}
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t border-white/[0.05] flex gap-3 justify-end sticky bottom-0 backdrop-blur-xl bg-white/[0.02]">
                            <button onClick={() => { setShowDetailsModal(false); setSelected(selected); setShowRejectModal(true) }} className="px-3 py-1 bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 hover:text-white rounded text-sm transition-colors border border-gray-600/30">Rejeitar</button>
                            <button onClick={() => { handleApprove(selected.id); setShowDetailsModal(false) }} className="px-3 py-1 bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 hover:text-white rounded text-sm transition-colors border border-gray-600/30">Aprovar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
