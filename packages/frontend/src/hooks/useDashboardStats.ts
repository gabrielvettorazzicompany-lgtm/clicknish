import { useState, useEffect, useMemo, useCallback } from 'react'
import { DateRange } from 'react-day-picker'
import { supabase } from '@/services/supabase'

interface DashboardStats {
    totalSales: number
    salesCount: number
    conversionRate: number
    checkouts: number
    paymentMethods: {
        name: string
        icon: string
        conversion: number
        value: number
    }[]
    abandonedCheckouts: number
    refundRate: number
    chargebackRate: number
    medRate: number
    pendingAmount: number
    refundCount: number
    dailySales: {
        date: string
        value: number
        formattedDate: string
    }[]
}

interface Product {
    id: string
    name: string
    type: 'marketplace' | 'app' | 'community'
}

const defaultStats: DashboardStats = {
    totalSales: 0,
    salesCount: 0,
    conversionRate: 0,
    checkouts: 0,
    paymentMethods: [
        { name: 'Cartão de Crédito', icon: 'card', conversion: 0, value: 0 },
    ],
    abandonedCheckouts: 0,
    refundRate: 0,
    chargebackRate: 0,
    medRate: 0,
    pendingAmount: 0,
    refundCount: 0,
    dailySales: []
}

export function useDashboardStats(
    userId: string | undefined,
    dateRange: DateRange | undefined,
    selectedApp?: string,
    selectedMarketplace?: string,
    selectedCurrency?: string
) {
    const [rawStats, setRawStats] = useState<DashboardStats>(defaultStats)
    const [loading, setLoading] = useState(true)

    // Memoizar função de fetch para evitar recriações
    const fetchStats = useCallback(async () => {
        if (!userId) return

        setLoading(true)
        try {
            // Chamar Worker que faz todas as queries em uma única requisição
            const response = await fetch('https://api.clicknich.com/api/dashboard-stats', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId,
                    fromDate: dateRange?.from?.toISOString(),
                    toDate: dateRange?.to?.toISOString(),
                    selectedApp,
                    selectedMarketplace,
                    selectedCurrency
                })
            })

            const data = await response.json()

            if (!response.ok) {
                console.error('Error calling dashboard-stats:', data.error)
                return
            }

            if (data) {
                setRawStats(data)
            }
        } catch (error) {
            console.error('Error fetching dashboard stats:', error)
        } finally {
            setLoading(false)
        }
    }, [userId, dateRange, selectedApp, selectedMarketplace, selectedCurrency])

    // useEffect para executar fetch quando parâmetros mudarem
    useEffect(() => {
        fetchStats()
    }, [fetchStats])

    // Memoizar stats finais para evitar re-renders desnecessários
    const stats = useMemo(() => rawStats, [rawStats])

    return { stats, loading }
}
