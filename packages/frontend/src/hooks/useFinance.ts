import { useState, useEffect, useMemo, useCallback } from 'react'
import { DateRange } from 'react-day-picker'
import { supabase } from '@/services/supabase'
import type { WithdrawalRequest } from '@/components/finance/WithdrawalTable'

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
    amount: number
    currency: string
    payoutSchedule: string
    feePercentage: number
    feeFixed: number
    feeAmount: number
    netAmount: number
    status: 'completed' | 'pending' | 'processing' | 'failed'
    createdAt: string
    completedAt: string | null
}

interface UseFinanceParams {
    tab: 'withdrawals' | 'transfers' | 'anticipations'
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
    const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([])
    const [transfers] = useState<Transfer[]>([])
    const [anticipations, setAnticipations] = useState<Anticipation[]>([])
    const [loading, setLoading] = useState(false)
    const [rawStats, setRawStats] = useState<FinanceStats>({
        availableBalance: 0,
        pendingBalance: 0,
        awaitingAnticipation: 0,
        financialReserve: 0
    })
    const [statsByCurrency, setStatsByCurrency] = useState<Record<string, FinanceStats>>({})

    const serverParams = useMemo(() => ({
        fromDate: params.dateRange?.from,
        toDate: params.dateRange?.to,
    }), [params.dateRange?.from, params.dateRange?.to])

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
                setWithdrawals([])
                return
            }

            setWithdrawals(data.withdrawals || [])
            if (data.anticipations) setAnticipations(data.anticipations)
            setRawStats(data.stats || { availableBalance: 0, pendingBalance: 0, awaitingAnticipation: 0, financialReserve: 0 })
            setStatsByCurrency(data.statsByCurrency || {})
        } catch (err) {
            console.error('Error fetching finance:', err)
            setWithdrawals([])
        } finally {
            setLoading(false)
        }
    }, [serverParams])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const stats = useMemo(() => {
        if (params.selectedCurrency && params.selectedCurrency !== 'all') {
            return statsByCurrency[params.selectedCurrency.toUpperCase()] || rawStats
        }
        return rawStats
    }, [rawStats, statsByCurrency, params.selectedCurrency])

    return { withdrawals, transfers, anticipations, loading, stats, statsByCurrency, refresh: fetchData }
}
