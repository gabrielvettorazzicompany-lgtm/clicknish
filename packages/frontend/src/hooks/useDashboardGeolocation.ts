import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/services/supabase'
import { DateRange } from 'react-day-picker'

interface CountryData {
    country: string
    count: number
    percentage: number
}

interface GeolocationAnalytics {
    countries: CountryData[]
    totalVisits: number
    uniqueCountries: number
    loading: boolean
    error: string | null
}

export function useDashboardGeolocation(
    userId: string | undefined,
    dateRange?: DateRange
): GeolocationAnalytics {
    const [data, setData] = useState<CountryData[]>([])
    const [totalVisits, setTotalVisits] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchGeolocationData = async () => {
        try {
            setLoading(true)
            setError(null)

            if (!userId) {
                setData([])
                setTotalVisits(0)
                setLoading(false)
                return
            }
                    .eq('created_by', userId)
            ])

    const memberAreaIds = memberAreasResponse.data?.map(m => m.id) || []
    const applicationIds = applicationsResponse.data?.map(a => a.id) || []
    const allCheckoutIds = [...memberAreaIds, ...applicationIds]

    if (allCheckoutIds.length === 0) {
        setData([])
        setTotalVisits(0)
        setLoading(false)
        return
    }

    // 2. Construir query para analytics com filtro de data
    let analyticsQuery = supabase
        .from('checkout_analytics')
        .select('country, created_at')
        .in('checkout_id', allCheckoutIds)
        .eq('event_type', 'page_view')
        .not('country', 'is', null)

    // Aplicar filtro de data se fornecido
    if (dateRange?.from) {
        analyticsQuery = analyticsQuery.gte('created_at', dateRange.from.toISOString())
    }
    if (dateRange?.to) {
        const endDate = new Date(dateRange.to)
        endDate.setHours(23, 59, 59, 999)
        analyticsQuery = analyticsQuery.lte('created_at', endDate.toISOString())
    }

    const { data: analyticsData, error: analyticsError } = await analyticsQuery

    if (analyticsError) {
        console.error('Error fetching analytics:', analyticsError)
        setError('Erro ao buscar dados de análise')
        setLoading(false)
        return
    }

    // 3. Contar total de visits (incluindo sem país)
    let totalVisitsQuery = supabase
        .from('checkout_analytics')
        .select('*', { count: 'exact', head: true })
        .in('checkout_id', allCheckoutIds)
        .eq('event_type', 'page_view')

    if (dateRange?.from) {
        totalVisitsQuery = totalVisitsQuery.gte('created_at', dateRange.from.toISOString())
    }
    if (dateRange?.to) {
        const endDate = new Date(dateRange.to)
        endDate.setHours(23, 59, 59, 999)
        totalVisitsQuery = totalVisitsQuery.lte('created_at', endDate.toISOString())
    }

    const { count: totalCount } = await totalVisitsQuery
    const total = totalCount || 0

    // 4. Processar dados dos países
    const countryCount = (analyticsData || []).reduce((acc, row) => {
        acc[row.country] = (acc[row.country] || 0) + 1
        return acc
    }, {} as Record<string, number>)

    const countries = Object.entries(countryCount)
        .map(([country, count]) => ({
            country,
            count,
            percentage: total > 0 ? (count / total) * 100 : 0
        }))
        .sort((a, b) => b.count - a.count)

    setData(countries)
    setTotalVisits(total)
    setLoading(false)

} catch (err) {
    console.error('Error in fetchGeolocationData:', err)
    setError('Erro ao carregar dados de geolocalização')
    setLoading(false)
}
    }

useEffect(() => {
    fetchGeolocationData()
}, [userId, dateRange?.from, dateRange?.to])

const analytics = useMemo(() => ({
    countries: data,
    totalVisits,
    uniqueCountries: data.length,
    loading,
    error
}), [data, totalVisits, loading, error])

return analytics
}