import { useState, useEffect } from 'react'
import { supabase } from './supabase'

/**
 * Interface para checkout do banco de dados
 */
export interface CheckoutData {
    id: string
    name: string
    is_default: boolean
    custom_price?: number
    banner_image?: string
    banner_title?: string
    banner_subtitle?: string
    banner_description?: string
    custom_height?: number
    language?: string
    custom_fields?: Record<string, any>
    created_at: string
    updated_at: string

    // Relacionamentos (apenas um será preenchido)
    member_area_id?: string
    application_id?: string
}

/**
 * Interface para produto/app associado ao checkout
 */
export interface CheckoutProduct {
    id: string
    name: string
    price?: number
    currency?: string
    type: 'member_area' | 'application'
}

/**
 * Interface para métricas de checkout
 */
export interface CheckoutMetrics {
    visits: number
    conversions: number
    total_sales: number
    conversion_rate: number
}

/**
 * Interface para checkout completo com produto e métricas
 */
export interface CheckoutWithDetails extends CheckoutData {
    product: CheckoutProduct
    metrics: CheckoutMetrics
}

/**
 * Busca todos os checkouts do usuário autenticado
 * Inclui checkouts de member_areas e applications
 */
export async function fetchUserCheckouts(userId: string): Promise<CheckoutWithDetails[]> {
    try {
        // Primeiro, buscar IDs dos member_areas do usuário
        const { data: memberAreas, error: memberAreasError } = await supabase
            .from('member_areas')
            .select('id')
            .eq('owner_id', userId)

        if (memberAreasError) throw memberAreasError

        // Buscar IDs das applications do usuário
        const { data: applications, error: applicationsError } = await supabase
            .from('applications')
            .select('id')
            .eq('owner_id', userId)

        if (applicationsError) throw applicationsError

        const memberAreaIds = memberAreas?.map(m => m.id) || []
        const applicationIds = applications?.map(a => a.id) || []

        // Se não tem produtos nem apps, retornar vazio
        if (memberAreaIds.length === 0 && applicationIds.length === 0) {
            return []
        }

        // Buscar checkouts dos member_areas
        let allCheckouts: any[] = []

        if (memberAreaIds.length > 0) {
            const { data: memberAreaCheckouts, error: memberAreaCheckoutsError } = await supabase
                .from('checkouts')
                .select(`
                    *,
                    member_areas!checkouts_member_area_id_fkey(id, name, price, currency)
                `)
                .in('member_area_id', memberAreaIds)
                .order('created_at', { ascending: false })

            if (memberAreaCheckoutsError) throw memberAreaCheckoutsError
            if (memberAreaCheckouts) allCheckouts = [...allCheckouts, ...memberAreaCheckouts]
        }

        // Buscar checkouts das applications
        if (applicationIds.length > 0) {
            const { data: applicationCheckouts, error: applicationCheckoutsError } = await supabase
                .from('checkouts')
                .select(`
                    *,
                    applications!checkouts_application_id_fkey(id, name)
                `)
                .in('application_id', applicationIds)
                .order('created_at', { ascending: false })

            if (applicationCheckoutsError) throw applicationCheckoutsError
            if (applicationCheckouts) allCheckouts = [...allCheckouts, ...applicationCheckouts]
        }

        // Ordenar todos os checkouts por data
        const checkoutsData = allCheckouts.sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )

        // Batch fetch all metrics to avoid N+1 queries
        const allMetrics = await fetchAllCheckoutMetrics(checkoutsData)

        // Processar cada checkout para incluir métricas
        const checkoutsWithDetails = checkoutsData.map((checkout) => {
            // Determinar tipo de produto
            const isMemberArea = !!checkout.member_area_id
            const productData = isMemberArea
                ? checkout.member_areas
                : checkout.applications

            // Criar objeto de produto
            const product: CheckoutProduct = {
                id: productData.id,
                name: productData.name,
                price: isMemberArea ? productData.price : undefined,
                currency: isMemberArea ? productData.currency || 'BRL' : undefined,
                type: isMemberArea ? 'member_area' : 'application'
            }

            // Get pre-fetched metrics
            const metrics = allMetrics.get(checkout.id) || {
                visits: 0,
                conversions: 0,
                total_sales: 0,
                conversion_rate: 0
            }

            // Remover os objetos de join do resultado
            const { member_areas, applications, ...checkoutClean } = checkout

            return {
                ...checkoutClean,
                product,
                metrics
            }
        })

        return checkoutsWithDetails
    } catch (error) {
        console.error('Error fetching user checkouts:', error)
        throw error
    }
}

/**
 * Batch fetch metrics for all checkouts to avoid N+1 queries
 * Returns a Map of checkout_id -> metrics
 */
async function fetchAllCheckoutMetrics(checkouts: any[]): Promise<Map<string, CheckoutMetrics>> {
    const metricsMap = new Map<string, CheckoutMetrics>()

    if (checkouts.length === 0) return metricsMap

    try {
        // Collect all IDs for batch queries
        const checkoutIds = checkouts.map(c => c.id)
        const memberAreaIds = checkouts.filter(c => c.member_area_id).map(c => c.member_area_id)
        const applicationIds = checkouts.filter(c => c.application_id).map(c => c.application_id)

        // Batch query 1: Get all visits from checkout_analytics
        const { data: analyticsData } = await supabase
            .from('checkout_analytics')
            .select('checkout_id')
            .in('checkout_id', checkoutIds)
            .eq('event_type', 'page_view')

        // Count visits per checkout
        const visitsByCheckout = new Map<string, number>()
        for (const row of analyticsData || []) {
            visitsByCheckout.set(row.checkout_id, (visitsByCheckout.get(row.checkout_id) || 0) + 1)
        }

        // Batch query 2: Get sales for member_areas
        const salesByMemberArea = new Map<string, number>()
        if (memberAreaIds.length > 0) {
            const { data: memberSales } = await supabase
                .from('user_marketplace_access')
                .select('member_area_id')
                .in('member_area_id', memberAreaIds)
                .eq('payment_status', 'completed')

            for (const row of memberSales || []) {
                salesByMemberArea.set(row.member_area_id, (salesByMemberArea.get(row.member_area_id) || 0) + 1)
            }
        }

        // Batch query 3: Get sales for applications
        const salesByApplication = new Map<string, number>()
        if (applicationIds.length > 0) {
            const { data: appSales } = await supabase
                .from('user_product_access')
                .select('application_id')
                .in('application_id', applicationIds)
                .eq('payment_status', 'completed')

            for (const row of appSales || []) {
                if (row.application_id) {
                    salesByApplication.set(row.application_id, (salesByApplication.get(row.application_id) || 0) + 1)
                }
            }
        }

        // Build metrics map for each checkout
        for (const checkout of checkouts) {
            const visits = visitsByCheckout.get(checkout.id) || 0
            let salesCount = 0

            if (checkout.member_area_id) {
                salesCount = salesByMemberArea.get(checkout.member_area_id) || 0
            } else if (checkout.application_id) {
                salesCount = salesByApplication.get(checkout.application_id) || 0
            }

            const totalSales = salesCount * 100 // Placeholder
            const conversionRate = visits > 0 ? (salesCount / visits) * 100 : 0

            metricsMap.set(checkout.id, {
                visits,
                conversions: salesCount,
                total_sales: totalSales,
                conversion_rate: conversionRate
            })
        }

        return metricsMap
    } catch (error) {
        console.error('Error fetching all checkout metrics:', error)
        // Return empty metrics for all checkouts on error
        for (const checkout of checkouts) {
            metricsMap.set(checkout.id, {
                visits: 0,
                conversions: 0,
                total_sales: 0,
                conversion_rate: 0
            })
        }
        return metricsMap
    }
}

/**
 * Busca métricas de um checkout específico
 * Calcula visitas, conversões e vendas totais
 */
async function fetchCheckoutMetrics(
    checkoutId: string,
    memberAreaId?: string,
    applicationId?: string
): Promise<CheckoutMetrics> {
    try {
        // Buscar visitas do checkout
        const { count: visits, error: visitsError } = await supabase
            .from('checkout_analytics')
            .select('*', { count: 'exact', head: true })
            .eq('checkout_id', checkoutId)
            .eq('event_type', 'page_view')

        if (visitsError) {
            console.warn('Error fetching visits:', visitsError)
            // Continuar com visitas = 0 se houver erro
        }

        // Buscar vendas de member_areas
        if (memberAreaId) {
            const { count: salesCount, error: salesError } = await supabase
                .from('user_marketplace_access')
                .select('*', { count: 'exact', head: true })
                .eq('member_area_id', memberAreaId)
                .eq('payment_status', 'completed')

            if (salesError) throw salesError

            const { data: accessData, error: accessError } = await supabase
                .from('user_marketplace_access')
                .select('created_at')
                .eq('member_area_id', memberAreaId)
                .eq('payment_status', 'completed')

            if (accessError) throw accessError

            // TODO: Buscar valor total de vendas quando tivermos preços armazenados
            const totalSales = (salesCount || 0) * 100 // Placeholder
            const conversionRate = (visits || 0) > 0 ? ((salesCount || 0) / (visits || 0)) * 100 : 0

            return {
                visits: visits || 0,
                conversions: salesCount || 0,
                total_sales: totalSales,
                conversion_rate: conversionRate
            }
        }

        // Buscar vendas de applications
        if (applicationId) {
            const { count: salesCount, error: salesError } = await supabase
                .from('user_product_access')
                .select('*', { count: 'exact', head: true })
                .eq('product_id', applicationId)
                .eq('payment_status', 'completed')

            if (salesError) throw salesError

            const totalSales = (salesCount || 0) * 100 // Placeholder
            const conversionRate = (visits || 0) > 0 ? ((salesCount || 0) / (visits || 0)) * 100 : 0

            return {
                visits: visits || 0,
                conversions: salesCount || 0,
                total_sales: totalSales,
                conversion_rate: conversionRate
            }
        }

        // Sem produtos associados
        return {
            visits: visits || 0,
            conversions: 0,
            total_sales: 0,
            conversion_rate: 0
        }
    } catch (error) {
        console.error('Error fetching checkout metrics:', error)
        // Retornar métricas zeradas em caso de erro
        return {
            visits: 0,
            conversions: 0,
            total_sales: 0,
            conversion_rate: 0
        }
    }
}

/**
 * Busca checkouts de um produto específico
 */
export async function fetchProductCheckouts(
    productId: string,
    productType: 'member_area' | 'application'
): Promise<CheckoutWithDetails[]> {
    try {
        const columnName = productType === 'member_area' ? 'member_area_id' : 'application_id'

        const { data: checkoutsData, error: checkoutsError } = await supabase
            .from('checkouts')
            .select(`
                *,
                member_areas!checkouts_member_area_id_fkey(id, name, price, currency),
                applications!checkouts_application_id_fkey(id, name)
            `)
            .eq(columnName, productId)
            .order('created_at', { ascending: false })

        if (checkoutsError) throw checkoutsError
        if (!checkoutsData) return []

        // Batch fetch all metrics to avoid N+1 queries
        const allMetrics = await fetchAllCheckoutMetrics(checkoutsData)

        // Processar checkouts
        const checkoutsWithDetails = checkoutsData.map((checkout) => {
            const isMemberArea = productType === 'member_area'
            const productData = isMemberArea
                ? checkout.member_areas
                : checkout.applications

            const product: CheckoutProduct = {
                id: productData.id,
                name: productData.name,
                price: isMemberArea ? productData.price : undefined,
                currency: isMemberArea ? productData.currency || 'BRL' : undefined,
                type: productType
            }

            const metrics = allMetrics.get(checkout.id) || {
                visits: 0,
                conversions: 0,
                total_sales: 0,
                conversion_rate: 0
            }

            const { member_areas, applications, ...checkoutClean } = checkout

            return {
                ...checkoutClean,
                product,
                metrics
            }
        })

        return checkoutsWithDetails
    } catch (error) {
        console.error('Error fetching product checkouts:', error)
        throw error
    }
}

/**
 * Cria um novo checkout
 */
export async function createCheckout(data: {
    name: string
    memberAreaId?: string
    applicationId?: string
    isDefault?: boolean
    customPrice?: number
    bannerTitle?: string
}): Promise<CheckoutData> {
    try {
        const insertData: any = {
            name: data.name,
            is_default: data.isDefault || false,
            custom_price: data.customPrice,
            banner_title: data.bannerTitle
        }

        if (data.memberAreaId) {
            insertData.member_area_id = data.memberAreaId
        } else if (data.applicationId) {
            insertData.application_id = data.applicationId
        } else {
            throw new Error('É necessário fornecer memberAreaId ou applicationId')
        }

        const { data: checkout, error } = await supabase
            .from('checkouts')
            .insert(insertData)
            .select()
            .single()

        if (error) throw error
        return checkout
    } catch (error) {
        console.error('Error creating checkout:', error)
        throw error
    }
}

/**
 * Atualiza um checkout existente
 */
export async function updateCheckout(
    checkoutId: string,
    data: Partial<CheckoutData>
): Promise<CheckoutData> {
    try {
        const { data: checkout, error } = await supabase
            .from('checkouts')
            .update(data)
            .eq('id', checkoutId)
            .select()
            .single()

        if (error) throw error
        return checkout
    } catch (error) {
        console.error('Error updating checkout:', error)
        throw error
    }
}

/**
 * Deleta um checkout
 */
export async function deleteCheckout(checkoutId: string): Promise<void> {
    try {
        const { error } = await supabase
            .from('checkouts')
            .delete()
            .eq('id', checkoutId)

        if (error) throw error
    } catch (error) {
        console.error('Error deleting checkout:', error)
        throw error
    }
}

/**
 * Gera URL do checkout
 */
export function getCheckoutUrl(checkoutId: string, baseUrl?: string): string {
    const base = baseUrl || window.location.origin
    return `${base}/checkout/${checkoutId}`
}

/**
 * Captura IP do usuário usando serviços externos
 */
async function getUserIP(): Promise<string | null> {
    try {
        // Tentar múltiplos serviços para garantir que funcione
        const services = [
            'https://api.ipify.org?format=json',
            'https://ipapi.co/json/',
            'https://api.ip.sb/jsonip'
        ]

        for (const service of services) {
            try {
                const response = await fetch(service, {
                    timeout: 3000,
                    signal: AbortSignal.timeout(3000)
                })

                if (!response.ok) continue

                const data = await response.json()
                const ip = data.ip || data.query

                if (ip && ip !== '::1' && ip !== '127.0.0.1') {
                    return ip
                }
            } catch (error) {
                console.warn(`Failed to get IP from ${service}:`, error)
                continue
            }
        }

        return null
    } catch (error) {
        console.warn('Failed to get user IP:', error)
        return null
    }
}

/**
 * Captura informações de geolocalização (opcional)
 */
async function getLocationInfo(): Promise<any> {
    try {
        const response = await fetch('https://ipapi.co/json/', {
            timeout: 5000,
            signal: AbortSignal.timeout(5000)
        })

        if (!response.ok) return null

        const data = await response.json()
        return {
            country: data.country_name,
            region: data.region,
            city: data.city,
            timezone: data.timezone,
            latitude: data.latitude,
            longitude: data.longitude
        }
    } catch (error) {
        console.warn('Failed to get location info:', error)
        return null
    }
}
export async function trackCheckoutEvent(
    checkoutId: string,
    eventType: 'page_view' | 'conversion' | 'bounce',
    metadata?: Record<string, any>
): Promise<void> {
    try {
        // Capturar IP e localização em paralelo
        const [userIP, locationInfo] = await Promise.all([
            getUserIP(),
            getLocationInfo()
        ])

        const eventData: any = {
            checkout_id: checkoutId,
            event_type: eventType,
            user_ip: userIP,
            user_agent: navigator?.userAgent,
            referrer: document?.referrer || null,
            session_id: getSessionId(),
            metadata: {
                ...metadata,
                location: locationInfo,
                timestamp: new Date().toISOString(),
                screen_resolution: screen?.width ? `${screen.width}x${screen.height}` : null,
                language: navigator.language,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            }
        }

        const { error } = await supabase
            .from('checkout_analytics')
            .insert(eventData)

        if (error) {
            console.warn('Error tracking checkout event:', error)
            // Não bloquear a aplicação por erro de analytics
        }
    } catch (error) {
        console.warn('Error tracking checkout event:', error)
    }
}

/**
 * Gera ou recupera session ID do session storage
 */
function getSessionId(): string {
    if (typeof window === 'undefined') return 'server-side'

    let sessionId = sessionStorage.getItem('checkout_session_id')
    if (!sessionId) {
        sessionId = generateUUID()
        sessionStorage.setItem('checkout_session_id', sessionId)
    }
    return sessionId
}

/**
 * Gera um UUID simples para session ID
 */
function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0
        const v = c == 'x' ? r : (r & 0x3 | 0x8)
        return v.toString(16)
    })
}

/**
 * Hook para registrar page view quando componente monta
 */
export function useCheckoutPageView(checkoutId: string) {
    const [tracked, setTracked] = useState(false)

    useEffect(() => {
        if (checkoutId && !tracked) {
            trackCheckoutEvent(checkoutId, 'page_view')
            setTracked(true)
        }
    }, [checkoutId, tracked])
}
