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

                // Helper para resultado vazio sem fazer query
                const emptyResult = () => Promise.resolve({ data: [], error: null })

                // Buscar apps do usuário
                const { data: userApps } = await supabase
                    .from('applications')
                    .select('id, name')
                    .eq('owner_id', user.id)
                const appIds = userApps?.map(a => a.id) || []
                const appNames = new Map(userApps?.map(a => [a.id, a.name]) || [])

                // Buscar member_areas do usuário
                const { data: userMemberAreas } = await supabase
                    .from('member_areas')
                    .select('id, name, currency')
                    .eq('owner_id', user.id)
                const memberAreaIds = userMemberAreas?.map(m => m.id) || []
                const memberAreaInfo = new Map(userMemberAreas?.map(m => [m.id, { name: m.name, currency: m.currency }]) || [])

                // ── Buscar vendas de produtos de apps - só se tiver apps ──────────
                let appSalesQuery: any = emptyResult()
                if (appIds.length > 0) {
                    let query = supabase
                        .from('user_product_access')
                        .select(`
                            id,
                            payment_id,
                            purchase_price,
                            payment_status,
                            payment_method,
                            created_at,
                            application_id
                        `)
                        .in('application_id', appIds)
                        .not('payment_status', 'eq', 'failed')

                    if (fromDate) query = query.gte('created_at', fromDate.toISOString())
                    if (toDate) {
                        const end = new Date(toDate)
                        end.setHours(23, 59, 59, 999)
                        query = query.lte('created_at', end.toISOString())
                    }
                    appSalesQuery = query
                }

                // ── Buscar vendas de áreas de membros - só se tiver member_areas ──────
                let memberSalesQuery: any = emptyResult()
                if (memberAreaIds.length > 0) {
                    let query = supabase
                        .from('user_member_area_access')
                        .select(`
                            id,
                            member_area_id,
                            purchase_price,
                            payment_status,
                            payment_method,
                            created_at
                        `)
                        .in('member_area_id', memberAreaIds)
                        .not('payment_status', 'eq', 'failed')

                    if (fromDate) query = query.gte('created_at', fromDate.toISOString())
                    if (toDate) {
                        const end = new Date(toDate)
                        end.setHours(23, 59, 59, 999)
                        query = query.lte('created_at', end.toISOString())
                    }
                    memberSalesQuery = query
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
                    const productName = appNames.get(row.application_id) ?? 'Produto'
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
                    const maInfo = memberAreaInfo.get(row.member_area_id)
                    const productName = maInfo?.name ?? 'Produto'
                    const status = row.payment_status ?? 'completed'
                    return {
                        id: `member-${row.id}`,
                        description: `Venda - ${productName}`,
                        type: mapTransactionType(status),
                        amount: Number(row.purchase_price ?? 0),
                        currency: (maInfo?.currency ?? 'USD').toUpperCase(),
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
