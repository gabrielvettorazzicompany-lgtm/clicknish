import { useState, useEffect } from 'react'
import { DateRange } from 'react-day-picker'
import { supabase } from '@/services/supabase'

export interface Transaction {
    id: string
    description: string
    type: 'sale' | 'commission' | 'withdrawal' | 'refund' | 'anticipation'
    amount: number
    currency: string
    direction: 'in' | 'out'
    date: string
    status: 'completed' | 'pending' | 'processing'
    email?: string
    paymentMethod?: string
}

export interface Transfer {
    id: string
    value: number
    destination: string
    status: 'completed' | 'pending' | 'processing' | 'failed'
    message: string
    requestDate: string
    paymentDate: string | null
}

export interface Anticipation {
    id: string
    value: number
    status: 'completed' | 'pending' | 'processing' | 'failed'
    message: string
    requestDate: string
    paymentDate: string | null
}

interface UseFinanceParams {
    tab: 'extract' | 'transfers' | 'anticipations'
    searchQuery: string
    dateRange: DateRange | undefined
    selectedCurrency?: string
}

export interface FinanceStats {
    availableBalance: number
    pendingBalance: number
    awaitingAnticipation: number
    financialReserve: number
}

function mapPaymentStatus(status: string): Transaction['status'] {
    if (status === 'completed') return 'completed'
    if (status === 'pending') return 'pending'
    return 'processing'
}

function mapTransactionType(status: string): Transaction['type'] {
    if (status === 'refunded' || status === 'reversed') return 'refund'
    return 'sale'
}

function mapDirection(status: string): Transaction['direction'] {
    if (status === 'refunded' || status === 'reversed') return 'out'
    return 'in'
}

export function useFinance(params: UseFinanceParams) {
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [transfers] = useState<Transfer[]>([])
    const [anticipations] = useState<Anticipation[]>([])
    const [loading, setLoading] = useState(false)
    const [stats, setStats] = useState<FinanceStats>({
        availableBalance: 0,
        pendingBalance: 0,
        awaitingAnticipation: 0,
        financialReserve: 0
    })
    const [statsByCurrency, setStatsByCurrency] = useState<Record<string, FinanceStats>>({})

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return

                const fromDate = params.dateRange?.from
                const toDate = params.dateRange?.to

                // ── Buscar vendas de produtos de apps (user_product_access) ──────────
                let appSalesQuery = supabase
                    .from('user_product_access')
                    .select(`
                        id,
                        payment_id,
                        purchase_price,
                        payment_status,
                        payment_method,
                        created_at,
                        applications!inner(owner_id, name)
                    `)
                    .eq('applications.owner_id', user.id)
                    .not('payment_status', 'eq', 'failed')

                if (fromDate) appSalesQuery = appSalesQuery.gte('created_at', fromDate.toISOString())
                if (toDate) {
                    const end = new Date(toDate)
                    end.setHours(23, 59, 59, 999)
                    appSalesQuery = appSalesQuery.lte('created_at', end.toISOString())
                }

                // ── Buscar vendas de áreas de membros (user_member_area_access) ──────
                let memberSalesQuery = supabase
                    .from('user_member_area_access')
                    .select(`
                        id,
                        purchase_price,
                        payment_status,
                        payment_method,
                        created_at,
                        member_areas!inner(owner_id, name, currency)
                    `)
                    .eq('member_areas.owner_id', user.id)
                    .not('payment_status', 'eq', 'failed')

                if (fromDate) memberSalesQuery = memberSalesQuery.gte('created_at', fromDate.toISOString())
                if (toDate) {
                    const end = new Date(toDate)
                    end.setHours(23, 59, 59, 999)
                    memberSalesQuery = memberSalesQuery.lte('created_at', end.toISOString())
                }

                const [appSalesResult, memberSalesResult] = await Promise.all([
                    appSalesQuery,
                    memberSalesQuery
                ])

                // ── Mapear vendas de apps para Transaction ────────────────────────────
                // Deduplica por payment_id: cada checkout gera N rows (1 por produto) mas
                // com o mesmo payment_id e purchase_price total. Conta apenas 1 por pagamento.
                const seenAppPayments = new Set<string>()
                const appTransactions: Transaction[] = (appSalesResult.data ?? []).reduce((acc: Transaction[], row: any) => {
                    const paymentKey = row.payment_id ?? row.id // fallback se não tiver payment_id
                    if (seenAppPayments.has(paymentKey)) return acc
                    seenAppPayments.add(paymentKey)
                    const productName = row.applications?.name ?? 'Produto'
                    const status = row.payment_status ?? 'completed'
                    acc.push({
                        id: `app-${row.id}`,
                        description: `Venda - ${productName}`,
                        type: mapTransactionType(status),
                        amount: Number(row.purchase_price ?? 0),
                        currency: 'USD',
                        direction: mapDirection(status),
                        date: row.created_at,
                        status: mapPaymentStatus(status),
                        paymentMethod: row.payment_method ?? undefined,
                    })
                    return acc
                }, [])

                // ── Mapear vendas de áreas de membros para Transaction ────────────────
                const memberTransactions: Transaction[] = (memberSalesResult.data ?? []).map((row: any) => {
                    const productName = row.member_areas?.name ?? 'Produto'
                    const status = row.payment_status ?? 'completed'
                    return {
                        id: `member-${row.id}`,
                        description: `Venda - ${productName}`,
                        type: mapTransactionType(status),
                        amount: Number(row.purchase_price ?? 0),
                        currency: (row.member_areas?.currency ?? 'USD').toUpperCase(),
                        direction: mapDirection(status),
                        date: row.created_at,
                        status: mapPaymentStatus(status),
                        paymentMethod: row.payment_method ?? undefined,
                    }
                })

                // ── Juntar e ordenar por data desc ────────────────────────────────────
                let allTransactions = [...appTransactions, ...memberTransactions]
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

                // ── Filtrar por searchQuery ────────────────────────────────────────────
                if (params.searchQuery) {
                    const q = params.searchQuery.toLowerCase()
                    allTransactions = allTransactions.filter(t =>
                        t.description.toLowerCase().includes(q) ||
                        (t.email ?? '').toLowerCase().includes(q)
                    )
                }

                // ── Filtrar por moeda ─────────────────────────────────────────────────
                // Calcular stats por moeda (antes do filtro de moeda)
                const uniqueCurrencies = [...new Set(allTransactions.map(t => t.currency))]
                const computedStatsByCurrency: Record<string, FinanceStats> = {}
                for (const currency of uniqueCurrencies) {
                    const currencyTxs = allTransactions.filter(t => t.currency === currency)
                    computedStatsByCurrency[currency] = {
                        availableBalance: currencyTxs
                            .filter(t => t.status === 'completed' && t.direction === 'in')
                            .reduce((sum, t) => sum + t.amount, 0),
                        pendingBalance: currencyTxs
                            .filter(t => t.status === 'pending' && t.direction === 'in')
                            .reduce((sum, t) => sum + t.amount, 0),
                        awaitingAnticipation: 0,
                        financialReserve: 0
                    }
                }
                setStatsByCurrency(computedStatsByCurrency)

                if (params.selectedCurrency && params.selectedCurrency !== 'all') {
                    allTransactions = allTransactions.filter(t =>
                        t.currency.toUpperCase() === params.selectedCurrency!.toUpperCase()
                    )
                }

                // ── Calcular stats (respeitando todos os filtros ativos) ──────────────
                const availableBalance = allTransactions
                    .filter(t => t.status === 'completed' && t.direction === 'in')
                    .reduce((sum, t) => sum + t.amount, 0)

                const pendingBalance = allTransactions
                    .filter(t => t.status === 'pending' && t.direction === 'in')
                    .reduce((sum, t) => sum + t.amount, 0)

                setTransactions(allTransactions)
                setStats({
                    availableBalance,
                    pendingBalance,
                    awaitingAnticipation: 0,
                    financialReserve: 0
                })
            } catch (err) {
                console.error('useFinance error:', err)
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [params.tab, params.searchQuery, params.dateRange, params.selectedCurrency])

    return { transactions, transfers, anticipations, loading, stats, statsByCurrency }
}
