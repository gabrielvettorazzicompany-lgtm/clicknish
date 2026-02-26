// hooks/useSalesGeolocation.ts
// Hook simplificado para buscar vendas com localização da tabela sale_locations
import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/services/supabase'

interface CountryData {
    country: string
    count: number // número de vendas (era 'sales')
    percentage: number
}

interface SalesGeolocationData {
    countries: CountryData[]
    loading: boolean
    error: string | null
    totalSales: number
    totalRevenue: number
}

export function useSalesGeolocation(userId?: string, currency?: string): SalesGeolocationData {
    const [rawData, setRawData] = useState<{
        countries: CountryData[]
        totalSales: number
        totalRevenue: number
    }>({
        countries: [],
        totalSales: 0,
        totalRevenue: 0
    })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Memoizar função de fetch
    const fetchSalesData = useCallback(async () => {
        if (!userId) {
            setLoading(false)
            return
        }

        try {
            setLoading(true)
            setError(null)

            // Buscar todas as vendas com localização
            const { data: sales, error: salesError } = await supabase
                .from('sale_locations')
                .select('country, amount, city, customer_ip, sale_date, currency')
                .eq('user_id', userId)
                .order('sale_date', { ascending: false })

            if (salesError) throw salesError

            // Filtrar por moeda no frontend (comparação case-insensitive)
            const filteredSales = currency
                ? sales?.filter(sale => {
                    const saleCurrency = (sale.currency || 'USD').toUpperCase()
                    return saleCurrency === currency.toUpperCase()
                })
                : sales

            // 3. Agregar dados por país
            const countryStats: Record<string, number> = {}
            let total = 0
            let revenue = 0

            filteredSales?.forEach(sale => {
                const country = sale.country || 'Desconhecido'
                countryStats[country] = (countryStats[country] || 0) + 1
                total += 1
                revenue += sale.amount || 0
            })

            // 4. Calcular percentuais e ordenar (formato compatível com CountryAnalytics e WorldMapHighcharts)
            const countriesData = Object.entries(countryStats)
                .map(([country, count]) => ({
                    country,
                    count,
                    percentage: total > 0 ? (count / total) * 100 : 0
                }))
                .sort((a, b) => b.count - a.count)

            setRawData({
                countries: countriesData,
                totalSales: total,
                totalRevenue: revenue
            })

        } catch (err) {
            console.error('Erro ao buscar dados de vendas:', err)
            setError(err instanceof Error ? err.message : 'Erro desconhecido')
            setRawData({
                countries: [],
                totalSales: 0,
                totalRevenue: 0
            })
        } finally {
            setLoading(false)
        }
    }, [userId, currency])

    // useEffect para executar fetch quando userId mudar
    useEffect(() => {
        fetchSalesData()
    }, [fetchSalesData])

    // Memoizar dados finais
    const result = useMemo(() => ({
        countries: rawData.countries,
        loading,
        error,
        totalSales: rawData.totalSales,
        totalRevenue: rawData.totalRevenue
    }), [rawData, loading, error])

    return result
}
