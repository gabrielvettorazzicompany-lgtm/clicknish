import { useState, useEffect, useMemo, useCallback } from 'react'
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

export function useFinance(params: UseFinanceParams) {
    const [allTransactions, setAllTransactions] = useState<Transaction[]>([])
    const [transfers] = useState<Transfer[]>([])
    const [anticipations] = useState<Anticipation[]>([])
    const [loading, setLoading] = useState(false)
    const [rawStats, setRawStats] = useState<FinanceStats>({
        availableBalance: 0,
        pendingBalance: 0,
        awaitingAnticipation: 0,
        financialReserve: 0
    })
    const [statsByCurrency, setStatsByCurrency] = useState<Record<string, FinanceStats>>({})

    // Memoizar parâmetros que afetam a query do servidor (datas)
    const serverParams = useMemo(() => ({
        fromDate: params.dateRange?.from,
        toDate: params.dateRange?.to,
    }), [params.dateRange?.from, params.dateRange?.to])

    // Fetch do Worker (apenas quando datas mudam)
    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { setLoading(false); return }

            const response = await fetch('https://api.clicknich.com/api/finance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    fromDate: serverParams.fromDate?.toISOString(),
                    toDate: serverParams.toDate?.toISOString(),
                })
            })

            const data = await response.json()

            if (!response.ok) {
                console.error('Error fetching finance:', data.error)
                setAllTransactions([])
                return
            }

            setAllTransactions(data.transactions || [])
            setRawStats(data.stats || { availableBalance: 0, pendingBalance: 0, awaitingAnticipation: 0, financialReserve: 0 })
            setStatsByCurrency(data.statsByCurrency || {})
        } catch (err) {
            console.error('Error fetching finance:', err)
            setAllTransactions([])
        } finally {
            setLoading(false)
        }
    }, [serverParams])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    // Filtros locais (aplicados no frontend, sem nova requisição)
    const transactions = useMemo(() => {
        let filtered = [...allTransactions]

        // Filtro por busca
        if (params.searchQuery) {
            const q = params.searchQuery.toLowerCase()
            filtered = filtered.filter(t =>
                t.description.toLowerCase().includes(q) ||
                (t.email ?? '').toLowerCase().includes(q)
            )
        }

        // Filtro por moeda
        if (params.selectedCurrency && params.selectedCurrency !== 'all') {
            filtered = filtered.filter(t =>
                t.currency.toUpperCase() === params.selectedCurrency!.toUpperCase()
            )
        }

        return filtered
    }, [allTransactions, params.searchQuery, params.selectedCurrency])

    // Stats filtrados por moeda
    const stats = useMemo(() => {
        if (params.selectedCurrency && params.selectedCurrency !== 'all') {
            return statsByCurrency[params.selectedCurrency.toUpperCase()] || rawStats
        }
        return rawStats
    }, [rawStats, statsByCurrency, params.selectedCurrency])

    return { transactions, transfers, anticipations, loading, stats, statsByCurrency }
}
