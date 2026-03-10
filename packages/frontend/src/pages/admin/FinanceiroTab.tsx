// FinanceiroTab.tsx — Página completa de gestão financeira
// Dados reais: /api/superadmin/transactions, /api/superadmin/withdrawals, /api/superadmin/financial

import { useState, useEffect, useCallback, useMemo } from 'react'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import * as XLSX from 'xlsx'
import {
    DollarSign, Download, CheckCircle, XCircle, AlertTriangle,
    Clock, ArrowUpRight, Search, Eye, RefreshCw,
    X, Upload, TrendingUp, Wallet, AlertCircle,
    ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

const API_BASE = 'https://api.clicknich.com/api/superadmin'
const ANON_KEY = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY'

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

type PaymentMethod = 'Pix' | 'Cartão' | 'Boleto'
type PaymentStatus = 'Aprovado' | 'Pendente' | 'Reembolsado' | 'Cancelado'
type ReleaseStatus = 'Pendente' | 'Disponível' | 'Liberado'
type WithdrawalStatus = 'Aguardando' | 'Aprovado' | 'Rejeitado' | 'Processando'
type ChargebackStatus = 'Pendente' | 'Em Análise' | 'Aprovado' | 'Contestado'

interface Transaction {
    id: string
    date: string
    buyerName: string
    buyerEmail: string
    sellerEmail: string
    product: string
    grossValue: number
    paymentMethod: PaymentMethod
    paymentStatus: PaymentStatus
    platformFee: number
    affiliateComission: number
    affiliatePercent: number
    netProducer: number
    releaseDate: string
    releaseStatus: ReleaseStatus
    currency: string
    sellerId: string
}

interface Withdrawal {
    id: string
    userName: string
    userEmail: string
    userType: 'Produtor' | 'Afiliado'
    requestedAmount: number
    availableBalance: number
    requestDate: string
    retentionDays: number
    status: WithdrawalStatus
    bankInfo: { bank: string; agency: string; account: string; cpf: string; account_holder?: string; account_type?: string; country?: string; currency?: string; pix_key?: string | null; verified?: boolean }
}

interface Chargeback {
    id: string
    originalSaleId: string
    buyerName: string
    product: string
    reason: string
    amount: number
    requestDate: string
    status: ChargebackStatus
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function addBusinessDays(dateStr: string, days: number): string {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return '—'
    let added = 0
    while (added < days) {
        date.setDate(date.getDate() + 1)
        const dow = date.getDay()
        if (dow !== 0 && dow !== 6) added++
    }
    return date.toLocaleDateString('pt-BR')
}

function computeReleaseStatus(saleDateStr: string): ReleaseStatus {
    const release = new Date(saleDateStr)
    if (isNaN(release.getTime())) return 'Pendente'
    let added = 0
    while (added < 5) {
        release.setDate(release.getDate() + 1)
        const dow = release.getDay()
        if (dow !== 0 && dow !== 6) added++
    }
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return release > today ? 'Pendente' : 'Disponível'
}

function mapPaymentMethod(m: string): PaymentMethod {
    if (m === 'pix') return 'Pix'
    if (m === 'card' || m === 'credit_card' || m === 'debit_card') return 'Cartão'
    return 'Boleto'
}

function mapWdStatus(s: string): WithdrawalStatus {
    if (s === 'processing') return 'Aguardando'
    if (s === 'completed') return 'Aprovado'
    if (s === 'failed' || s === 'cancelled') return 'Rejeitado'
    return 'Processando'
}

function retentionDays(schedule: string): number {
    const m = (schedule || '').match(/D\+?(\d+)/)
    return m ? parseInt(m[1]) : 5
}

function makeFmt(currency: string) {
    const locale = currency === 'BRL' ? 'pt-BR' : 'en-US'
    return (v: number) => v.toLocaleString(locale, { style: 'currency', currency })
}
const fmt = makeFmt('BRL')

function exportCSV(rows: Transaction[], currency: string) {
    const fmtVal = makeFmt(currency === 'all' ? 'BRL' : currency)
    const headers = ['ID', 'Data', 'Comprador', 'Email', 'Produto', 'Valor Bruto', 'Método Pgto', 'Status Pgto', 'Taxa Plataforma', 'Valor Líquido', 'Data Liberação', 'Status Liberação', 'Moeda']
    const lines = rows.map(t => [
        t.id, t.date, t.buyerName, t.buyerEmail, t.product,
        fmtVal(t.grossValue), t.paymentMethod, t.paymentStatus,
        fmtVal(t.platformFee), fmtVal(t.netProducer),
        t.releaseDate, t.releaseStatus, t.currency
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    const blob = new Blob(['﻿' + [headers.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transacoes_${currency}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
}

function exportExcel(rows: Transaction[], currency: string) {
    const fmtVal = makeFmt(currency === 'all' ? 'BRL' : currency)
    const data = rows.map(t => ({
        'ID': t.id,
        'Data': t.date,
        'Comprador': t.buyerName,
        'Email': t.buyerEmail,
        'Produto': t.product,
        'Valor Bruto': fmtVal(t.grossValue),
        'Método Pgto': t.paymentMethod,
        'Status Pgto': t.paymentStatus,
        'Taxa Plataforma': fmtVal(t.platformFee),
        'Valor Líquido': fmtVal(t.netProducer),
        'Data Liberação': t.releaseDate,
        'Status Liberação': t.releaseStatus,
        'Moeda': t.currency,
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Transações')
    XLSX.writeFile(wb, `transacoes_${currency}_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

// ─────────────────────────────────────────────────────────────
// BADGE HELPERS
// ─────────────────────────────────────────────────────────────

function PayBadge({ status }: { status: PaymentStatus }) {
    const m: Record<PaymentStatus, string> = {
        Aprovado: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
        Pendente: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
        Reembolsado: 'bg-red-500/15 text-red-400 border-red-500/25',
        Cancelado: 'bg-gray-500/15 text-gray-400 border-gray-500/25',
    }
    return <span className={`text-[10px] px-2 py-0.5 font-semibold border ${m[status]}`}>{status}</span>
}

function ReleaseBadge({ status }: { status: ReleaseStatus }) {
    const m: Record<ReleaseStatus, string> = {
        Pendente: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
        Disponível: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
        Liberado: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    }
    return <span className={`text-[10px] px-2 py-0.5 font-semibold border ${m[status]}`}>{status}</span>
}

function WdBadge({ status }: { status: WithdrawalStatus }) {
    const m: Record<WithdrawalStatus, string> = {
        Aguardando: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
        Aprovado: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
        Rejeitado: 'bg-red-500/15 text-red-400 border-red-500/25',
        Processando: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
    }
    return <span className={`text-[10px] px-2 py-0.5 font-semibold border ${m[status]}`}>{status}</span>
}

function CbBadge({ status }: { status: ChargebackStatus }) {
    const m: Record<ChargebackStatus, string> = {
        Pendente: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
        'Em Análise': 'bg-blue-500/15 text-blue-400 border-blue-500/25',
        Aprovado: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
        Contestado: 'bg-gray-500/15 text-gray-400 border-gray-500/25',
    }
    return <span className={`text-[10px] px-2 py-0.5 font-semibold border ${m[status]}`}>{status}</span>
}

// ─────────────────────────────────────────────────────────────
// MODAL: Liberar Repasse / Saque
// ─────────────────────────────────────────────────────────────

interface ReleaseModalProps {
    isOpen: boolean
    onClose: () => void
    title: string
    amount: number
    userName: string
    bankInfo?: Withdrawal['bankInfo']
    onConfirm: (obs: string, file: File | null) => void
}

function ReleaseModal({ isOpen, onClose, title, amount, userName, bankInfo, onConfirm }: ReleaseModalProps) {
    const [obs, setObs] = useState('')
    const [file, setFile] = useState<File | null>(null)
    const [busy, setBusy] = useState(false)

    if (!isOpen) return null

    const handleConfirm = () => {
        setBusy(true)
        setTimeout(() => { onConfirm(obs, file); setObs(''); setFile(null); setBusy(false) }, 700)
    }

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-[#0d1117] border border-white/[0.08] w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                    <div>
                        <h3 className="text-sm font-semibold text-white">{title}</h3>
                        <p className="text-[11px] text-gray-500 mt-0.5">Confirme antes de liberar</p>
                    </div>
                    <button onClick={onClose} className="text-gray-600 hover:text-gray-300 transition-colors"><X className="w-4 h-4" /></button>
                </div>

                <div className="px-5 py-4 space-y-4">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 text-center">
                        <p className="text-[11px] text-emerald-400 font-medium">Valor a liberar</p>
                        <p className="text-2xl font-bold text-emerald-400 mt-1">{fmt(amount)}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">Para: {userName}</p>
                    </div>

                    {bankInfo ? (
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <p className="text-[11px] text-gray-600 uppercase tracking-wider font-medium">Dados bancários</p>
                                {bankInfo.verified && (
                                    <span className="text-[9px] px-1.5 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 font-semibold">✓ VERIFICADO</span>
                                )}
                            </div>
                            <div className="bg-white/[0.02] border border-white/[0.05] p-3 space-y-1.5">
                                {[
                                    ['Titular', bankInfo.account_holder],
                                    ['Banco', bankInfo.bank],
                                    ['Tipo de conta', bankInfo.account_type],
                                    ['Agência / Routing', bankInfo.agency],
                                    ['Conta / IBAN', bankInfo.account],
                                    ['CPF/CNPJ', bankInfo.cpf],
                                    ['País', bankInfo.country],
                                    ['Moeda', bankInfo.currency],
                                    ...(bankInfo.pix_key ? [['Chave PIX', bankInfo.pix_key]] : []),
                                ].filter(([, v]) => v && v !== '—').map(([k, v]) => (
                                    <div key={k as string} className="flex justify-between gap-4">
                                        <span className="text-[11px] text-gray-600 shrink-0">{k}</span>
                                        <span className="text-[11px] text-white font-medium text-right break-all">{v}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-amber-500/10 border border-amber-500/20 p-3">
                            <p className="text-[11px] text-amber-400">⚠ Nenhuma conta bancária verificada encontrada para este produtor.</p>
                        </div>
                    )}

                    <div>
                        <p className="text-[11px] text-gray-600 uppercase tracking-wider font-medium mb-2">Comprovante (opcional)</p>
                        <label className="flex items-center gap-3 px-4 py-3 bg-white/[0.02] border border-dashed border-white/[0.10] cursor-pointer hover:border-blue-500/40 transition-colors">
                            <Upload className="w-4 h-4 text-gray-500" />
                            <span className="text-xs text-gray-500">{file ? file.name : 'Clique para anexar PDF ou imagem'}</span>
                            <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
                        </label>
                    </div>

                    <div>
                        <p className="text-[11px] text-gray-600 uppercase tracking-wider font-medium mb-2">Observação</p>
                        <textarea
                            value={obs}
                            onChange={e => setObs(e.target.value)}
                            placeholder="Ex: PIX enviado às 14:32 — protocolo #XXXXX"
                            rows={3}
                            className="w-full bg-white/[0.02] border border-white/[0.07] text-xs text-white placeholder-gray-700 p-3 focus:outline-none focus:border-blue-500/40 resize-none"
                        />
                    </div>
                </div>

                <div className="px-5 py-3 border-t border-white/[0.06] flex gap-3 justify-end">
                    <button onClick={onClose} className="text-xs px-4 py-2 bg-white/[0.03] border border-white/[0.07] text-gray-400 hover:text-white transition-colors">Cancelar</button>
                    <button onClick={handleConfirm} disabled={busy}
                        className="text-xs px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors disabled:opacity-50 flex items-center gap-2">
                        {busy ? <><RefreshCw className="w-3 h-3 animate-spin" /> Processando…</> : <><CheckCircle className="w-3 h-3" /> Confirmar Liberação</>}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
// MODAL: Reembolso
// ─────────────────────────────────────────────────────────────

interface RefundModalProps {
    isOpen: boolean
    onClose: () => void
    chargeback: Chargeback | null
    onConfirm: (method: string, obs: string) => void
}

function RefundModal({ isOpen, onClose, chargeback, onConfirm }: RefundModalProps) {
    const [method, setMethod] = useState<'pix' | 'estorno' | 'manual'>('pix')
    const [obs, setObs] = useState('')
    const [busy, setBusy] = useState(false)

    if (!isOpen || !chargeback) return null

    const handleConfirm = () => {
        setBusy(true)
        setTimeout(() => { onConfirm(method, obs); setObs(''); setBusy(false) }, 700)
    }

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-[#0d1117] border border-white/[0.08] w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                    <div>
                        <h3 className="text-sm font-semibold text-white">Processar Reembolso</h3>
                        <p className="text-[11px] text-gray-500 mt-0.5">{chargeback.id} — {chargeback.product}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-600 hover:text-gray-300 transition-colors"><X className="w-4 h-4" /></button>
                </div>

                <div className="px-5 py-4 space-y-4">
                    <div className="bg-red-500/10 border border-red-500/20 p-4 text-center">
                        <p className="text-[11px] text-red-400 font-medium">Valor do reembolso</p>
                        <p className="text-2xl font-bold text-red-400 mt-1">{fmt(chargeback.amount)}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">Comprador: {chargeback.buyerName}</p>
                        <p className="text-[11px] text-gray-600">Motivo: {chargeback.reason}</p>
                    </div>

                    <div>
                        <p className="text-[11px] text-gray-600 uppercase tracking-wider font-medium mb-2">Forma de devolução</p>
                        <div className="flex gap-2">
                            {(['pix', 'estorno', 'manual'] as const).map(m => (
                                <button key={m} onClick={() => setMethod(m)}
                                    className={`flex-1 text-xs py-2 border transition-colors capitalize ${method === m ? 'bg-blue-500/20 border-blue-500/40 text-blue-400' : 'border-white/[0.07] text-gray-500 hover:text-gray-300 bg-white/[0.02]'}`}>
                                    {m === 'pix' ? 'PIX' : m === 'estorno' ? 'Estorno Cartão' : 'Manual'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="text-[11px] text-gray-600 uppercase tracking-wider font-medium mb-2">Observação</p>
                        <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2}
                            placeholder="Protocolo, chave PIX, etc."
                            className="w-full bg-white/[0.02] border border-white/[0.07] text-xs text-white placeholder-gray-700 p-3 focus:outline-none focus:border-blue-500/40 resize-none" />
                    </div>
                </div>

                <div className="px-5 py-3 border-t border-white/[0.06] flex gap-3 justify-end">
                    <button onClick={onClose} className="text-xs px-4 py-2 bg-white/[0.03] border border-white/[0.07] text-gray-400 hover:text-white transition-colors">Cancelar</button>
                    <button onClick={handleConfirm} disabled={busy}
                        className="text-xs px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-medium transition-colors disabled:opacity-50 flex items-center gap-2">
                        {busy ? <><RefreshCw className="w-3 h-3 animate-spin" /> Processando…</> : <><XCircle className="w-3 h-3" /> Confirmar Reembolso</>}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
// MODAL: Bulk
// ─────────────────────────────────────────────────────────────

function BulkModal({ count, onClose, onConfirm }: { count: number; onClose: () => void; onConfirm: () => void }) {
    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-[#0d1117] border border-white/[0.08] w-full max-w-sm p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                <h3 className="text-sm font-semibold text-white mb-2">Liberar em Massa</h3>
                <p className="text-xs text-gray-500 mb-5">
                    Você está prestes a aprovar <strong className="text-white">{count} saque(s)</strong>. Esta ação não pode ser desfeita.
                </p>
                <div className="flex gap-3 justify-end">
                    <button onClick={onClose} className="text-xs px-4 py-2 bg-white/[0.03] border border-white/[0.07] text-gray-400 hover:text-white transition-colors">Cancelar</button>
                    <button onClick={onConfirm} className="text-xs px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors flex items-center gap-2">
                        <CheckCircle className="w-3 h-3" /> Confirmar liberação
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
// MAIN: FinanceiroTab
// ─────────────────────────────────────────────────────────────

export function FinanceiroTab() {
    const { user } = useAuthStore()

    const adminHeaders = useMemo(() => ({
        'Authorization': ANON_KEY,
        'Content-Type': 'application/json',
        'x-user-id': user?.id || '',
    }), [user?.id])

    // ── State ─────────────────────────────────────────────────
    const [period, setPeriod] = useState<'hoje' | '7d' | '30d' | 'mes'>('30d')
    const [search, setSearch] = useState('')
    const [producerFilter, setProducerFilter] = useState<string>('all')
    const [page, setPage] = useState(1)
    const [sortField, setSortField] = useState<keyof Transaction>('date')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
    const [section, setSection] = useState<'transactions' | 'withdrawals' | 'chargebacks'>('transactions')
    const [selectedWds, setSelectedWds] = useState<Set<string>>(new Set())

    // Real data
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
    const [chargebacks] = useState<Chargeback[]>([])
    const [financialData, setFinancialData] = useState<any>(null)
    const [loadingTx, setLoadingTx] = useState(true)
    const [loadingWd, setLoadingWd] = useState(true)

    // Modals
    const [releaseModal, setReleaseModal] = useState<{
        open: boolean; title: string; amount: number; userName: string
        bankInfo?: Withdrawal['bankInfo']; txId?: string; wdId?: string
    }>({ open: false, title: '', amount: 0, userName: '' })
    const [refundModal, setRefundModal] = useState<{ open: boolean; chargeback: Chargeback | null }>({ open: false, chargeback: null })
    const [bulkOpen, setBulkOpen] = useState(false)

    // Toast
    const [toasts, setToasts] = useState<{ id: number; msg: string; ok: boolean }[]>([])
    const toast = (msg: string, ok = true) => {
        const id = Date.now()
        setToasts(p => [...p, { id, msg, ok }])
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500)
    }

    // ── Fetch helpers ─────────────────────────────────────────
    const fetchTransactions = useCallback(async () => {
        setLoadingTx(true)
        try {
            const res = await fetch(`${API_BASE}/transactions?limit=200`, { headers: adminHeaders })
            if (!res.ok) return
            const json = await res.json()
            const mapped: Transaction[] = (json.data || []).map((s: any) => {
                const saleDate: string = s.sale_date || s.created_at || ''
                return {
                    id: s.id,
                    date: saleDate ? new Date(saleDate).toLocaleString('pt-BR') : '—',
                    buyerName: s.buyer_email ? s.buyer_email.split('@')[0] : '—',
                    buyerEmail: s.buyer_email || '—',
                    sellerEmail: s.seller_email || '—',
                    sellerId: s.seller_id || '',
                    product: s.product_name || 'Produto',
                    grossValue: s.gross_value || 0,
                    paymentMethod: mapPaymentMethod(s.payment_method || ''),
                    paymentStatus: 'Aprovado' as PaymentStatus,
                    platformFee: s.platform_fee || 0,
                    affiliateComission: 0,
                    affiliatePercent: 0,
                    netProducer: s.net_producer || 0,
                    releaseDate: saleDate ? addBusinessDays(saleDate, 5) : '—',
                    releaseStatus: saleDate ? computeReleaseStatus(saleDate) : 'Pendente' as ReleaseStatus,
                    currency: s.currency || 'BRL',
                }
            })
            setTransactions(mapped)
        } catch (e) { console.error('[FinanceiroTab] fetchTransactions', e) }
        finally { setLoadingTx(false) }
    }, [adminHeaders])

    const fetchWithdrawals = useCallback(async () => {
        setLoadingWd(true)
        try {
            const res = await fetch(`${API_BASE}/withdrawals?limit=100`, { headers: adminHeaders })
            if (!res.ok) return
            const json = await res.json()
            const mapped: Withdrawal[] = (json.data || []).map((w: any) => {
                // Prioridade: bank_info vindo de payment_settings (conta bancária aprovada)
                let bankInfo: Withdrawal['bankInfo'] = { bank: '—', agency: '—', account: '—', cpf: '—' }
                if (w.bank_info) {
                    bankInfo = w.bank_info
                } else if (w.destination) {
                    try {
                        const d = typeof w.destination === 'string' ? JSON.parse(w.destination) : w.destination
                        bankInfo = {
                            bank: d.bank || d.bank_name || '—',
                            agency: d.agency || d.branch || '—',
                            account: d.account || d.account_number || '—',
                            cpf: d.cpf || d.document || '—',
                        }
                    } catch { /* ignore */ }
                }
                const email: string = w.user_email || w.user_id || '—'
                return {
                    id: w.id,
                    userName: email.includes('@') ? email.split('@')[0] : email,
                    userEmail: email,
                    userType: 'Produtor' as const,
                    requestedAmount: parseFloat(w.amount) || 0,
                    availableBalance: parseFloat(w.net_amount) || 0,
                    requestDate: w.created_at ? new Date(w.created_at).toLocaleDateString('pt-BR') : '—',
                    retentionDays: retentionDays(w.payout_schedule || ''),
                    status: mapWdStatus(w.status),
                    bankInfo,
                }
            })
            setWithdrawals(mapped)
        } catch (e) { console.error('[FinanceiroTab] fetchWithdrawals', e) }
        finally { setLoadingWd(false) }
    }, [adminHeaders])

    const fetchFinancial = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/financial`, { headers: adminHeaders })
            if (res.ok) setFinancialData(await res.json())
        } catch (e) { console.error('[FinanceiroTab] fetchFinancial', e) }
    }, [adminHeaders])

    useEffect(() => {
        fetchTransactions()
        fetchWithdrawals()
        fetchFinancial()
    }, [fetchTransactions, fetchWithdrawals, fetchFinancial])

    // ── Lista de produtores únicos das transações ────────────
    const producerList = useMemo(() => {
        const map = new Map<string, string>()
        transactions.forEach(t => { if (t.sellerId) map.set(t.sellerId, t.sellerEmail || t.sellerId) })
        return Array.from(map.entries()).map(([id, email]) => ({ id, email }))
    }, [transactions])

    // ── Computed KPIs ─────────────────────────────────────────
    const kpis = useMemo(() => {
        const txForKpi = producerFilter === 'all' ? transactions : transactions.filter(t => t.sellerId === producerFilter)
        const gross = producerFilter === 'all'
            ? (financialData?.gmv ?? txForKpi.reduce((a, t) => a + t.grossValue, 0))
            : txForKpi.reduce((a, t) => a + t.grossValue, 0)
        const commission = producerFilter === 'all'
            ? (financialData?.platform_revenue ?? txForKpi.reduce((a, t) => a + t.platformFee, 0))
            : txForKpi.reduce((a, t) => a + t.platformFee, 0)
        const pendingRelease = txForKpi
            .filter(t => t.releaseStatus !== 'Liberado')
            .reduce((a, t) => a + t.netProducer, 0)
        const urgentCbs = chargebacks.filter(c => c.status === 'Pendente' || c.status === 'Em Análise')
        const pendingWds = withdrawals.filter(w => w.status === 'Aguardando')
        return {
            balance: commission,
            gross,
            commission,
            pendingRelease,
            cbAmount: urgentCbs.reduce((a, c) => a + c.amount, 0),
            cbCount: urgentCbs.length,
            wdAmount: pendingWds.reduce((a, w) => a + w.requestedAmount, 0),
            wdCount: pendingWds.length,
            approvedCount: txForKpi.filter(t => t.paymentStatus === 'Aprovado').length || (producerFilter === 'all' ? (financialData?.total_conversions ?? 0) : 0),
            pendingCount: txForKpi.filter(t => t.paymentStatus === 'Pendente').length,
            refundedCount: txForKpi.filter(t => t.paymentStatus === 'Reembolsado').length,
        }
    }, [transactions, chargebacks, withdrawals, financialData, currencyFilter])

    // ── Highcharts: GMV mensal (real) ─────────────────────────
    const chartOpts = useMemo((): Highcharts.Options => {
        const monthlyGmv: Record<string, number> = financialData?.monthly_gmv || {}
        const sortedMonths = Object.keys(monthlyGmv).sort().slice(-6)
        const categories = sortedMonths.length
            ? sortedMonths.map(m => { const [y, mo] = m.split('-'); return `${mo}/${y.slice(2)}` })
            : ['—']
        const gmvData = sortedMonths.length ? sortedMonths.map(m => Math.round(monthlyGmv[m] || 0)) : [0]
        const revenueData = gmvData.map(v => Math.round(v * ((financialData?.fee_percent || 5) / 100)))
        return {
            chart: { type: 'area', backgroundColor: 'transparent', height: 155, margin: [5, 5, 24, 52], style: { fontFamily: 'inherit' } },
            title: { text: undefined }, credits: { enabled: false }, legend: { enabled: false },
            xAxis: { categories, labels: { style: { color: '#4b5563', fontSize: '10px' } }, lineColor: 'rgba(255,255,255,0.05)', tickColor: 'transparent' },
            yAxis: { title: { text: undefined }, labels: { style: { color: '#4b5563', fontSize: '10px' }, formatter() { const v = this.value as number; const sym = currencyFilter === 'EUR' ? '€' : currencyFilter === 'USD' ? '$' : 'R$'; return sym + (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v) } }, gridLineColor: 'rgba(255,255,255,0.04)' },
            tooltip: { backgroundColor: '#0a1628', borderColor: 'rgba(255,255,255,0.08)', borderRadius: 8, style: { color: '#e5e7eb', fontSize: '11px' }, shared: true },
            plotOptions: { area: { fillOpacity: 1, marker: { enabled: false, states: { hover: { enabled: true, radius: 3 } } }, lineWidth: 2 } },
            series: [
                { name: 'GMV', type: 'area', data: gmvData, color: '#3b82f6', fillColor: { linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 }, stops: [[0, 'rgba(59,130,246,0.22)'], [1, 'rgba(59,130,246,0.01)']] } },
                { name: 'Comissão', type: 'area', data: revenueData, color: '#22c55e', fillColor: { linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 }, stops: [[0, 'rgba(34,197,94,0.22)'], [1, 'rgba(34,197,94,0.01)']] } },
            ],
        }
    }, [financialData])

    // ── Table logic ─────────────────────────────────────────
    const filteredTx = useMemo(() => {
        const q = search.toLowerCase()
        return transactions
            .filter(t => !q || t.buyerName.toLowerCase().includes(q) || t.product.toLowerCase().includes(q) || t.buyerEmail.toLowerCase().includes(q) || t.sellerEmail.toLowerCase().includes(q))
            .filter(t => producerFilter === 'all' || t.sellerId === producerFilter)
            .sort((a, b) => {
                const cmp = String(a[sortField]).localeCompare(String(b[sortField]))
                return sortDir === 'asc' ? cmp : -cmp
            })
    }, [transactions, search, currencyFilter, sortField, sortDir])

    const PER_PAGE = 7
    const paged = filteredTx.slice((page - 1) * PER_PAGE, page * PER_PAGE)
    const totalPages = Math.max(1, Math.ceil(filteredTx.length / PER_PAGE))

    const onSort = (f: keyof Transaction) => {
        if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
        else { setSortField(f); setSortDir('asc') }
    }
    const sortIco = (f: keyof Transaction) => (
        <span className={`ml-1 text-[9px] ${sortField === f ? 'text-blue-400' : 'text-gray-700'}`}>
            {sortField === f ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
    )

    // ── Actions ───────────────────────────────────────────────
    const pendingUrgent = chargebacks.filter(c => c.status === 'Pendente' || c.status === 'Em Análise')

    const openReleaseTx = (tx: Transaction) =>
        setReleaseModal({ open: true, title: `Liberar repasse — ${tx.id}`, amount: tx.netProducer, userName: tx.buyerName, txId: tx.id })

    const openReleaseWd = (wd: Withdrawal) =>
        setReleaseModal({ open: true, title: `Liberar saque — ${wd.id}`, amount: wd.requestedAmount, userName: wd.userName, bankInfo: wd.bankInfo, wdId: wd.id })

    const confirmRelease = async (obs: string, _file: File | null) => {
        if (releaseModal.txId) {
            setTransactions(prev => prev.map(t => t.id === releaseModal.txId ? { ...t, releaseStatus: 'Liberado' as ReleaseStatus } : t))
            toast('Repasse liberado com sucesso!')
        }
        if (releaseModal.wdId) {
            try {
                const res = await fetch(`${API_BASE}/withdrawals/${releaseModal.wdId}`, {
                    method: 'PATCH',
                    headers: adminHeaders,
                    body: JSON.stringify({ status: 'completed', notes: obs || undefined, completed_at: new Date().toISOString() }),
                })
                if (res.ok) {
                    setWithdrawals(prev => prev.map(w => w.id === releaseModal.wdId ? { ...w, status: 'Aprovado' as WithdrawalStatus } : w))
                    toast('Saque aprovado com sucesso!')
                } else {
                    toast('Erro ao aprovar saque.', false)
                }
            } catch { toast('Erro ao aprovar saque.', false) }
        }
        setReleaseModal({ open: false, title: '', amount: 0, userName: '' })
    }

    const rejectWd = async (id: string) => {
        try {
            const res = await fetch(`${API_BASE}/withdrawals/${id}`, {
                method: 'PATCH',
                headers: adminHeaders,
                body: JSON.stringify({ status: 'cancelled' }),
            })
            if (res.ok) {
                setWithdrawals(prev => prev.map(w => w.id === id ? { ...w, status: 'Rejeitado' as WithdrawalStatus } : w))
                toast('Saque rejeitado.', false)
            } else {
                toast('Erro ao rejeitar saque.', false)
            }
        } catch { toast('Erro ao rejeitar saque.', false) }
    }

    const confirmBulk = async () => {
        const ids = [...selectedWds]
        await Promise.allSettled(ids.map(id =>
            fetch(`${API_BASE}/withdrawals/${id}`, {
                method: 'PATCH',
                headers: adminHeaders,
                body: JSON.stringify({ status: 'completed', completed_at: new Date().toISOString() }),
            })
        ))
        setWithdrawals(prev => prev.map(w => selectedWds.has(w.id) ? { ...w, status: 'Aprovado' as WithdrawalStatus } : w))
        toast(`${selectedWds.size} saques liberados!`)
        setSelectedWds(new Set())
        setBulkOpen(false)
    }

    const confirmRefund = (_method: string, _obs: string) => {
        if (refundModal.chargeback) {
            toast(`Reembolso via ${_method} processado!`)
        }
        setRefundModal({ open: false, chargeback: null })
    }

    const toggleWd = (id: string) =>
        setSelectedWds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

    const pendingWdList = withdrawals.filter(w => w.status === 'Aguardando')

    // ─────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────
    return (
        <div className="space-y-4">
            {/* ── Toast ─────────────────────────────────────── */}
            <div className="fixed top-4 right-4 z-[100] space-y-2 pointer-events-none">
                {toasts.map(t => (
                    <div key={t.id} className={`px-4 py-2.5 text-xs font-medium border pointer-events-auto shadow-lg ${t.ok ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' : 'bg-red-500/20 border-red-500/30 text-red-400'}`}>
                        {t.msg}
                    </div>
                ))}
            </div>

            {/* ── Alerta chargebacks urgentes ───────────────── */}
            {pendingUrgent.length > 0 && (
                <div className="flex items-center gap-3 px-4 py-2.5 bg-red-500/10 border border-red-500/20 text-red-400">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <p className="text-xs font-medium">
                        {pendingUrgent.length} chargeback(s) urgente(s) aguardando ação.{' '}
                        <button onClick={() => setSection('chargebacks')} className="underline">Ver agora →</button>
                    </p>
                </div>
            )}

            {/* ── Filtros + exportar ────────────────────────── */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex bg-white/[0.02] border border-white/[0.06]">
                    {(['hoje', '7d', '30d', 'mes'] as const).map(p => (
                        <button key={p} onClick={() => setPeriod(p)}
                            className={`px-3 py-1.5 text-xs font-medium transition-colors ${period === p ? 'bg-blue-500/20 text-blue-400 border-x border-blue-500/30' : 'text-gray-500 hover:text-gray-300'}`}>
                            {p === 'hoje' ? 'Hoje' : p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : 'Este mês'}
                        </button>
                    ))}
                </div>

                <div className="relative flex-1 min-w-[200px] max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none" />
                    <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
                        placeholder="Buscar por nome, email ou produto…"
                        className="w-full pl-9 pr-4 py-1.5 bg-white/[0.02] border border-white/[0.06] text-xs text-white placeholder-gray-700 focus:outline-none focus:border-blue-500/40" />
                </div>

                {producerList.length > 0 && (
                    <div className="min-w-[180px]">
                        <select value={producerFilter} onChange={e => { setProducerFilter(e.target.value); setPage(1) }}
                            className="w-full px-3 py-1.5 bg-white/[0.02] border border-white/[0.06] text-xs text-white focus:outline-none focus:border-blue-500/40">
                            <option value="all">Todos os produtores</option>
                            {producerList.map(p => (
                                <option key={p.id} value={p.id}>{p.email}</option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="flex items-center gap-2 ml-auto">
                    <button onClick={() => { fetchTransactions(); fetchWithdrawals(); fetchFinancial() }}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white/[0.02] border border-white/[0.06] text-gray-500 hover:text-white hover:bg-white/[0.05] transition-colors">
                        <RefreshCw className="w-3.5 h-3.5" /> Atualizar
                    </button>
                    <button onClick={() => exportCSV(filteredTx, currencyFilter)}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white/[0.02] border border-white/[0.06] text-gray-500 hover:text-white hover:bg-white/[0.05] transition-colors">
                        <Download className="w-3.5 h-3.5" /> CSV
                    </button>
                    <button onClick={() => exportExcel(filteredTx, currencyFilter)}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white/[0.02] border border-white/[0.06] text-gray-500 hover:text-white hover:bg-white/[0.05] transition-colors">
                        <Download className="w-3.5 h-3.5" /> Excel
                    </button>
                </div>
            </div>

            {/* ── KPI Cards ─────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                {[
                    { label: 'Saldo Plataforma', value: fmt(kpis.balance), sub: 'comissões acumuladas', icon: <Wallet className="w-4 h-4" />, accent: '#3b82f6' },
                    { label: 'Vendas Brutas', value: fmt(kpis.gross), sub: `${kpis.approvedCount} transações`, icon: <TrendingUp className="w-4 h-4" />, accent: '#3b82f6' },
                    { label: `Comissão (${financialData?.fee_percent ?? 5}%)`, value: fmt(kpis.commission), sub: 'receita da plataforma', icon: <DollarSign className="w-4 h-4" />, accent: '#3b82f6' },
                    { label: 'Pendente Repasse', value: fmt(kpis.pendingRelease), sub: 'a liberar p/ produtores', icon: <Clock className="w-4 h-4" />, accent: '#3b82f6' },
                    { label: 'Chargebacks', value: `${kpis.cbCount} · ${fmt(kpis.cbAmount)}`, sub: 'pendentes urgentes', icon: <AlertCircle className="w-4 h-4" />, accent: '#3b82f6' },
                    { label: 'Saques Aguardando', value: `${kpis.wdCount} · ${fmt(kpis.wdAmount)}`, sub: 'aprovação pendente', icon: <ArrowUpRight className="w-4 h-4" />, accent: '#3b82f6' },
                ].map(k => (
                    <div key={k.label} className="relative bg-[#0d1829] border border-white/[0.06] p-4 overflow-hidden group hover:border-white/[0.14] transition-all duration-300">
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: `radial-gradient(ellipse at top left, ${k.accent}18 0%, transparent 60%)` }} />
                        <div className="absolute left-0 top-0 bottom-0 w-0.5 group-hover:w-1 transition-all duration-300" style={{ background: k.accent }} />
                        <div className="flex items-start justify-between mb-2" style={{ color: k.accent }}>{k.icon}</div>
                        <p className="text-sm font-bold text-white leading-snug">{k.value}</p>
                        <p className="text-[10px] text-gray-500 mt-1">{k.label}</p>
                        <p className="text-[10px] text-gray-700 mt-0.5">{k.sub}</p>
                    </div>
                ))}
            </div>



            {/* ── Chart + Resumo ────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <div className="lg:col-span-2 bg-[#0d1829] border border-white/[0.06] p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <p className="text-xs font-semibold text-white">GMV Mensal</p>
                            <p className="text-[11px] text-gray-600 mt-0.5">Volume de vendas vs Comissão — últimos 6 meses</p>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-gray-600">
                            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-blue-400 inline-block rounded" /> GMV</span>
                            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-emerald-400 inline-block rounded" /> Comissão</span>
                        </div>
                    </div>
                    <HighchartsReact highcharts={Highcharts} options={chartOpts} />
                </div>

                <div className="bg-[#0d1829] border border-white/[0.06] p-4 flex flex-col gap-2.5">
                    <p className="text-xs font-semibold text-white">Resumo do período</p>
                    {[
                        { label: 'Transações aprovadas', value: kpis.approvedCount, color: 'text-emerald-400' },
                        { label: 'Transações pendentes', value: kpis.pendingCount, color: 'text-amber-400' },
                        { label: 'Reembolsadas', value: kpis.refundedCount, color: 'text-red-400' },
                        { label: 'Repasses pendentes', value: transactions.filter(t => t.releaseStatus === 'Pendente').length, color: 'text-amber-400' },
                        { label: 'Repasses disponíveis', value: transactions.filter(t => t.releaseStatus === 'Disponível').length, color: 'text-blue-400' },
                        { label: 'Repasses liberados', value: transactions.filter(t => t.releaseStatus === 'Liberado').length, color: 'text-emerald-400' },
                        { label: 'Saques aguardando', value: kpis.wdCount, color: 'text-amber-400' },
                    ].map(m => (
                        <div key={m.label} className="flex items-center justify-between py-1.5 border-b border-white/[0.03] last:border-0">
                            <span className="text-[11px] text-gray-500">{m.label}</span>
                            <span className={`text-xs font-bold ${m.color}`}>{m.value}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Section nav ───────────────────────────────── */}
            <div className="flex items-center gap-1 border-b border-white/[0.05]">
                {([
                    { id: 'transactions', label: 'Extrato de Vendas', count: filteredTx.length },
                    { id: 'withdrawals', label: 'Saques Solicitados', count: pendingWdList.length },
                    { id: 'chargebacks', label: 'Chargebacks & Reembolsos', count: pendingUrgent.length },
                ] as const).map(tab => (
                    <button key={tab.id} onClick={() => setSection(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 text-xs font-medium transition-all border-b-2 -mb-px ${section === tab.id ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                        {tab.label}
                        {tab.count > 0 && <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-white/[0.06] text-gray-400">{tab.count}</span>}
                    </button>
                ))}
            </div>

            {/* ────────────────────────────────────────────────
                SEÇÃO 1: EXTRATO DE VENDAS
            ──────────────────────────────────────────────── */}
            {section === 'transactions' && (
                <div className="bg-[#0d1829] border border-white/[0.06] overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/[0.05] flex items-center justify-between">
                        <p className="text-xs font-semibold text-white">Extrato de Vendas / Transações</p>
                        <span className="text-[11px] text-gray-600">{filteredTx.length} registros</span>
                    </div>

                    <div className="overflow-x-auto">
                        {loadingTx ? (
                            <div className="flex items-center justify-center py-16 gap-2 text-gray-600">
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span className="text-xs">Carregando transações…</span>
                            </div>
                        ) : transactions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-600">
                                <DollarSign className="w-8 h-8 opacity-30" />
                                <p className="text-xs">Nenhuma transação encontrada</p>
                            </div>
                        ) : (
                            <>
                                <table className="w-full text-[11px]">
                                    <thead>
                                        <tr className="border-b border-white/[0.05]">
                                            {[
                                                { key: 'date' as keyof Transaction, label: 'Data/Hora' },
                                                { key: 'buyerName' as keyof Transaction, label: 'Comprador' },
                                                { key: 'product' as keyof Transaction, label: 'Produto' },
                                                { key: 'grossValue' as keyof Transaction, label: 'Bruto' },
                                                { key: 'currency' as keyof Transaction, label: 'Moeda' },
                                                { key: 'paymentMethod' as keyof Transaction, label: 'Pagto' },
                                                { key: 'paymentStatus' as keyof Transaction, label: 'Status' },
                                                { key: 'platformFee' as keyof Transaction, label: 'Taxa %' },
                                                { key: 'affiliateComission' as keyof Transaction, label: 'Afiliado' },
                                                { key: 'netProducer' as keyof Transaction, label: 'Líquido' },
                                                { key: 'releaseDate' as keyof Transaction, label: 'Previsto D+5' },
                                                { key: 'releaseStatus' as keyof Transaction, label: 'Liberação' },
                                                { key: null, label: 'Ações' },
                                            ].map(col => (
                                                <th key={col.label}
                                                    onClick={() => col.key && onSort(col.key)}
                                                    className={`px-3 py-2.5 text-left text-gray-600 font-semibold whitespace-nowrap ${col.key ? 'cursor-pointer hover:text-gray-400 select-none' : ''}`}>
                                                    {col.label}{col.key && sortIco(col.key)}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/[0.03]">
                                        {paged.map(tx => (
                                            <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors group">
                                                <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap font-mono">{tx.date}</td>
                                                <td className="px-3 py-2.5">
                                                    <p className="text-white font-medium leading-none">{tx.buyerName}</p>
                                                    <p className="text-gray-600 mt-0.5">{tx.buyerEmail}</p>
                                                </td>
                                                <td className="px-3 py-2.5 text-gray-300 max-w-[130px] truncate">{tx.product}</td>
                                                <td className="px-3 py-2.5 text-white font-semibold whitespace-nowrap">{makeFmt(tx.currency)(tx.grossValue)}</td>
                                                <td className="px-3 py-2.5">
                                                    <span className="text-xs font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5">
                                                        {tx.currency}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <span className={`text-[10px] px-2 py-0.5 font-medium border ${tx.paymentMethod === 'Pix' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : tx.paymentMethod === 'Cartão' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
                                                        {tx.paymentMethod}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5"><PayBadge status={tx.paymentStatus} /></td>
                                                <td className="px-3 py-2.5 text-gray-500">{tx.platformFee > 0 ? makeFmt(tx.currency)(tx.platformFee) : '—'}</td>
                                                <td className="px-3 py-2.5">
                                                    {tx.affiliatePercent > 0 ? (
                                                        <div>
                                                            <span className="text-amber-400">{makeFmt(tx.currency)(tx.affiliateComission)}</span>
                                                            <span className="text-gray-700 ml-1">({tx.affiliatePercent}%)</span>
                                                        </div>
                                                    ) : <span className="text-gray-700">—</span>}
                                                </td>
                                                <td className="px-3 py-2.5 text-emerald-400 font-semibold whitespace-nowrap">{tx.netProducer > 0 ? makeFmt(tx.currency)(tx.netProducer) : '—'}</td>
                                                <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{tx.releaseDate}</td>
                                                <td className="px-3 py-2.5"><ReleaseBadge status={tx.releaseStatus} /></td>
                                                <td className="px-3 py-2.5">
                                                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button title="Ver detalhes" className="p-1 text-gray-600 hover:text-blue-400 transition-colors"><Eye className="w-3.5 h-3.5" /></button>
                                                        {tx.releaseStatus !== 'Liberado' && tx.paymentStatus === 'Aprovado' && (
                                                            <button title="Liberar repasse" onClick={() => openReleaseTx(tx)} className="p-1 text-gray-600 hover:text-emerald-400 transition-colors"><CheckCircle className="w-3.5 h-3.5" /></button>
                                                        )}
                                                        {tx.paymentStatus === 'Aprovado' && (
                                                            <button title="Reembolso" onClick={() => setRefundModal({ open: true, chargeback: { id: `CHB-${tx.id}`, originalSaleId: tx.id, buyerName: tx.buyerName, product: tx.product, reason: 'Solicitado pelo admin', amount: tx.grossValue, requestDate: new Date().toLocaleDateString('pt-BR'), status: 'Pendente' } })}
                                                                className="p-1 text-gray-600 hover:text-red-400 transition-colors"><XCircle className="w-3.5 h-3.5" /></button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {/* Paginação */}
                                <div className="px-4 py-3 border-t border-white/[0.05] flex items-center justify-between">
                                    <span className="text-[11px] text-gray-600">Página {page} de {totalPages} · {filteredTx.length} registros</span>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                            className="p-1.5 text-gray-500 hover:text-white disabled:opacity-30 transition-colors"><ChevronLeft className="w-3.5 h-3.5" /></button>
                                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                                            <button key={p} onClick={() => setPage(p)}
                                                className={`w-6 h-6 text-[11px] transition-colors ${page === p ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-gray-500 hover:text-white'}`}>{p}</button>
                                        ))}
                                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                                            className="p-1.5 text-gray-500 hover:text-white disabled:opacity-30 transition-colors"><ChevronRight className="w-3.5 h-3.5" /></button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ────────────────────────────────────────────────
                SEÇÃO 2: SAQUES SOLICITADOS
            ──────────────────────────────────────────────── */}
            {section === 'withdrawals' && (
                <div className="bg-[#0d1829] border border-white/[0.06] overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/[0.05] flex items-center justify-between">
                        <p className="text-xs font-semibold text-white">Saques Solicitados</p>
                        <div className="flex items-center gap-2">
                            {selectedWds.size > 0 && (
                                <button onClick={() => setBulkOpen(true)}
                                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors">
                                    <CheckCircle className="w-3.5 h-3.5" /> Liberar em Massa ({selectedWds.size})
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        {loadingWd ? (
                            <div className="flex items-center justify-center py-16 gap-2 text-gray-600">
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span className="text-xs">Carregando saques…</span>
                            </div>
                        ) : withdrawals.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-600">
                                <ArrowUpRight className="w-8 h-8 opacity-30" />
                                <p className="text-xs">Nenhum saque solicitado</p>
                            </div>
                        ) : (
                            <table className="w-full text-[11px]">
                                <thead>
                                    <tr className="border-b border-white/[0.05]">
                                        <th className="px-3 py-2.5 w-8">
                                            <input type="checkbox" className="w-3 h-3 accent-blue-500"
                                                checked={selectedWds.size === pendingWdList.length && pendingWdList.length > 0}
                                                onChange={e => setSelectedWds(e.target.checked ? new Set(pendingWdList.map(w => w.id)) : new Set())} />
                                        </th>
                                        {['Usuário', 'Tipo', 'Valor Solicitado', 'Líquido', 'Retenção', 'Data', 'Status', 'Ações'].map(h => (
                                            <th key={h} className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.03]">
                                    {withdrawals.map(wd => (
                                        <tr key={wd.id} className="hover:bg-white/[0.02] transition-colors group">
                                            <td className="px-3 py-2.5">
                                                {wd.status === 'Aguardando' && (
                                                    <input type="checkbox" className="w-3 h-3 accent-blue-500"
                                                        checked={selectedWds.has(wd.id)} onChange={() => toggleWd(wd.id)} />
                                                )}
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-[10px] text-white font-bold flex-shrink-0">
                                                        {wd.userName.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="text-white font-medium">{wd.userName}</p>
                                                        <p className="text-gray-600">{wd.userEmail}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <span className={`text-[10px] px-2 py-0.5 border ${wd.userType === 'Produtor' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-violet-500/10 border-violet-500/20 text-violet-400'}`}>
                                                    {wd.userType}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5 text-emerald-400 font-semibold">{fmt(wd.requestedAmount)}</td>
                                            <td className="px-3 py-2.5 text-gray-400">{fmt(wd.availableBalance)}</td>
                                            <td className="px-3 py-2.5 text-gray-500">D+{wd.retentionDays}</td>
                                            <td className="px-3 py-2.5 text-gray-500">{wd.requestDate}</td>
                                            <td className="px-3 py-2.5"><WdBadge status={wd.status} /></td>
                                            <td className="px-3 py-2.5">
                                                {wd.status === 'Aguardando' && (
                                                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => openReleaseWd(wd)}
                                                            className="flex items-center gap-1 text-[10px] px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                                                            <CheckCircle className="w-3 h-3" /> Aprovar
                                                        </button>
                                                        <button onClick={() => rejectWd(wd.id)}
                                                            className="flex items-center gap-1 text-[10px] px-2 py-1 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors">
                                                            <XCircle className="w-3 h-3" /> Rejeitar
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* ────────────────────────────────────────────────
                SEÇÃO 3: CHARGEBACKS & REEMBOLSOS
            ──────────────────────────────────────────────── */}
            {section === 'chargebacks' && (
                <div className="bg-[#0d1829] border border-white/[0.06] overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/[0.05] flex items-center justify-between">
                        <p className="text-xs font-semibold text-white">Chargebacks / Reembolsos Pendentes</p>
                        <span className="text-[11px] text-gray-600">{chargebacks.length} registros</span>
                    </div>

                    {chargebacks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-600">
                            <AlertCircle className="w-8 h-8 opacity-30" />
                            <p className="text-xs">Nenhum chargeback registrado</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-[11px]">
                                <thead>
                                    <tr className="border-b border-white/[0.05]">
                                        {['ID', 'Venda Orig.', 'Comprador', 'Produto', 'Motivo', 'Valor', 'Data Pedido', 'Status', 'Ações'].map(h => (
                                            <th key={h} className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.03]">
                                    {chargebacks.map(cb => (
                                        <tr key={cb.id} className="hover:bg-white/[0.02] transition-colors group">
                                            <td className="px-3 py-2.5 text-gray-600 font-mono">{cb.id}</td>
                                            <td className="px-3 py-2.5 text-gray-500 font-mono">{cb.originalSaleId}</td>
                                            <td className="px-3 py-2.5 text-white">{cb.buyerName}</td>
                                            <td className="px-3 py-2.5 text-gray-400 max-w-[110px] truncate">{cb.product}</td>
                                            <td className="px-3 py-2.5 text-amber-400">{cb.reason}</td>
                                            <td className="px-3 py-2.5 text-red-400 font-semibold whitespace-nowrap">{fmt(cb.amount)}</td>
                                            <td className="px-3 py-2.5 text-gray-500">{cb.requestDate}</td>
                                            <td className="px-3 py-2.5"><CbBadge status={cb.status} /></td>
                                            <td className="px-3 py-2.5">
                                                {(cb.status === 'Pendente' || cb.status === 'Em Análise') && (
                                                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => setRefundModal({ open: true, chargeback: cb })}
                                                            className="flex items-center gap-1 text-[10px] px-2 py-1 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors">
                                                            <XCircle className="w-3 h-3" /> Reembolso
                                                        </button>
                                                        <button onClick={() => toast('Contestação registrada.')}
                                                            className="flex items-center gap-1 text-[10px] px-2 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors">
                                                            <AlertTriangle className="w-3 h-3" /> Contestar
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ── Modals ──────────────────────────────────────── */}
            <ReleaseModal
                isOpen={releaseModal.open}
                onClose={() => setReleaseModal({ open: false, title: '', amount: 0, userName: '' })}
                title={releaseModal.title}
                amount={releaseModal.amount}
                userName={releaseModal.userName}
                bankInfo={releaseModal.bankInfo}
                onConfirm={confirmRelease}
            />
            <RefundModal
                isOpen={refundModal.open}
                onClose={() => setRefundModal({ open: false, chargeback: null })}
                chargeback={refundModal.chargeback}
                onConfirm={confirmRefund}
            />
            {bulkOpen && <BulkModal count={selectedWds.size} onClose={() => setBulkOpen(false)} onConfirm={confirmBulk} />}
        </div>
    )
}
