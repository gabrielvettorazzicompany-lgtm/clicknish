// Serviço simples para capturar IP e localização nas vendas
// services/salesTracking.ts

import { supabase } from './supabase'

interface SaleLocation {
    ip: string
    country?: string
    region?: string
    city?: string
    latitude?: number
    longitude?: number
}

// Função simples para obter IP
async function getUserIP(): Promise<string> {
    try {
        const response = await fetch('https://api.ipify.org?format=json', {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        })

        if (response.ok) {
            const data = await response.json()
            return data.ip || 'unknown'
        }
    } catch (error) {
        console.warn('Erro ao capturar IP:', error)
    }
    return 'unknown'
}

// Função simples para obter localização
async function getLocationFromIP(ip: string): Promise<Partial<SaleLocation>> {
    if (ip === 'unknown' || ip.startsWith('127.') || ip.startsWith('192.168.')) {
        return { ip }
    }

    try {
        const response = await fetch(`http://ip-api.com/json/${ip}?fields=country,regionName,city,lat,lon`, {
            method: 'GET'
        })

        if (response.ok) {
            const data = await response.json()
            if (data.status === 'success') {
                return {
                    ip,
                    country: data.country,
                    region: data.regionName,
                    city: data.city,
                    latitude: data.lat,
                    longitude: data.lon
                }
            }
        }
    } catch (error) {
        console.warn('Erro ao obter localização:', error)
    }

    return { ip }
}

// Função principal: rastrear venda com localização
export async function trackSaleWithLocation(saleData: {
    checkoutId?: string
    productId?: string
    amount: number
    currency: string
    paymentMethod: string
    customerEmail?: string
    customerId?: string
    userId: string // ID do vendedor
}): Promise<void> {
    try {


        // 1. Capturar IP
        const ip = await getUserIP()


        // 2. Obter localização  
        const location = await getLocationFromIP(ip)


        // 3. Salvar dados da venda com localização
        const { error } = await supabase
            .from('sale_locations')
            .insert({
                checkout_id: saleData.checkoutId,
                product_id: saleData.productId,
                user_id: saleData.userId,
                customer_id: saleData.customerId,
                customer_email: saleData.customerEmail,
                amount: saleData.amount,
                currency: saleData.currency,
                payment_method: saleData.paymentMethod,
                customer_ip: location.ip,
                country: location.country,
                region: location.region,
                city: location.city,
                latitude: location.latitude,
                longitude: location.longitude,
                sale_date: new Date().toISOString()
            })

        if (error) {
            console.error('❌ [SalesTracking] Erro ao salvar:', error)
            throw error
        }



    } catch (error) {
        console.error('🚨 [SalesTracking] Erro no tracking:', error)
        // Não falhar a venda por causa do tracking
    }
}

// Função para buscar estatísticas de vendas por localização
export async function getSalesLocationStats(userId: string, dateRange?: { from: Date, to: Date }) {
    try {
        let query = supabase
            .from('sale_locations')
            .select('country, city, amount, sale_date, customer_ip')
            .eq('user_id', userId)
            .not('country', 'is', null)

        if (dateRange?.from) {
            query = query.gte('sale_date', dateRange.from.toISOString())
        }
        if (dateRange?.to) {
            const endDate = new Date(dateRange.to)
            endDate.setHours(23, 59, 59, 999)
            query = query.lte('sale_date', endDate.toISOString())
        }

        const { data, error } = await query

        if (error) {
            console.error('Erro ao buscar estatísticas:', error)
            return { countries: [], totalSales: 0, totalAmount: 0 }
        }

        // Processar dados por país
        const countryStats = new Map<string, { count: number, amount: number }>()
        let totalSales = 0
        let totalAmount = 0

        data?.forEach(sale => {
            const country = sale.country
            if (country) {
                const current = countryStats.get(country) || { count: 0, amount: 0 }
                countryStats.set(country, {
                    count: current.count + 1,
                    amount: current.amount + (sale.amount || 0)
                })
            }
            totalSales++
            totalAmount += sale.amount || 0
        })

        const countries = Array.from(countryStats.entries())
            .map(([country, stats]) => ({
                country,
                count: stats.count,
                amount: stats.amount,
                percentage: totalSales > 0 ? (stats.count / totalSales) * 100 : 0
            }))
            .sort((a, b) => b.count - a.count)

        return {
            countries,
            totalSales,
            totalAmount
        }

    } catch (error) {
        console.error('Erro ao processar estatísticas:', error)
        return { countries: [], totalSales: 0, totalAmount: 0 }
    }
}