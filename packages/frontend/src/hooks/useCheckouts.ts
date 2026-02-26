import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import {
    fetchUserCheckouts,
    CheckoutWithDetails,
    getCheckoutUrl
} from '@/services/checkouts'

/**
 * Interface para checkout exibido na tabela
 */
export interface Checkout {
    id: string
    name: string
    slug: string
    product_id: string
    product_name: string
    product_type: 'member_area' | 'application'
    price?: number
    currency?: string
    status: 'active' | 'inactive'
    payment_methods: ('pix' | 'boleto' | 'credit_card')[]
    installments: number
    visits: number
    conversions: number
    total_sales: number
    conversion_rate: number
    created_at: string
    checkout_url: string
}

interface UseCheckoutsParams {
    searchQuery: string
    statusFilter: string
    productFilter: string
    refreshKey?: number
}

interface CheckoutStats {
    total: number
    active: number
    inactive: number
    totalSales: number
    avgConversion: number
}

/**
 * Hook para gerenciar checkouts do usuário
 * Busca dados reais do Supabase e permite filtrar por busca, status e produto
 */
export function useCheckouts(params: UseCheckoutsParams) {
    const { user } = useAuthStore()
    const [checkouts, setCheckouts] = useState<Checkout[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [stats, setStats] = useState<CheckoutStats>({
        total: 0,
        active: 0,
        inactive: 0,
        totalSales: 0,
        avgConversion: 0
    })

    useEffect(() => {
        if (!user?.id) {
            setLoading(false)
            setCheckouts([])
            return
        }

        const loadCheckouts = async () => {
            try {
                setLoading(true)
                setError(null)

                // Buscar checkouts do banco de dados
                const checkoutsData = await fetchUserCheckouts(user.id)

                // Função para gerar slug amigável
                const generateSlug = (name: string, id: string) => {
                    return name
                        .toLowerCase()
                        .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres especiais
                        .replace(/\s+/g, '-') // Substitui espaços por hífens
                        .replace(/-+/g, '-') // Remove hífens duplos
                        .trim()
                        .substring(0, 50) || id.substring(0, 8) // Fallback para primeiros 8 caracteres do ID
                }

                // Transformar dados para o formato esperado pela UI
                const transformedCheckouts: Checkout[] = checkoutsData.map((checkout) => ({
                    id: checkout.id,
                    name: checkout.name,
                    slug: generateSlug(checkout.name, checkout.id),
                    product_id: checkout.product.id,
                    product_name: checkout.product.name,
                    product_type: checkout.product.type,
                    price: checkout.custom_price || checkout.product.price,
                    currency: checkout.metrics.total_sales_currency || checkout.product.currency || 'BRL',
                    status: checkout.is_active !== false ? 'active' : 'inactive',
                    payment_methods: ['credit_card', 'pix'], // TODO: Buscar do produto
                    installments: 12, // TODO: Buscar do custom_fields ou produto
                    visits: checkout.metrics.visits,
                    conversions: checkout.metrics.conversions,
                    total_sales: checkout.metrics.total_sales,
                    conversion_rate: checkout.metrics.conversion_rate,
                    created_at: checkout.created_at,
                    checkout_url: getCheckoutUrl(checkout.id)
                }))

                // Aplicar filtros
                let filtered = transformedCheckouts

                // Filtro de busca
                if (params.searchQuery) {
                    const query = params.searchQuery.toLowerCase()
                    filtered = filtered.filter(c =>
                        c.name.toLowerCase().includes(query) ||
                        c.product_name.toLowerCase().includes(query) ||
                        c.slug.toLowerCase().includes(query)
                    )
                }

                // Filtro de status
                if (params.statusFilter !== 'all') {
                    filtered = filtered.filter(c => c.status === params.statusFilter)
                }

                // Filtro de produto
                if (params.productFilter !== 'all') {
                    filtered = filtered.filter(c => c.product_id === params.productFilter)
                }

                setCheckouts(filtered)

                // Calcular estatísticas com base nos dados filtrados
                const totalSales = filtered.reduce((sum, c) => sum + c.total_sales, 0)
                const avgConv = filtered.length > 0
                    ? filtered.reduce((sum, c) => sum + c.conversion_rate, 0) / filtered.length
                    : 0

                setStats({
                    total: filtered.length,
                    active: filtered.filter(c => c.status === 'active').length,
                    inactive: filtered.filter(c => c.status === 'inactive').length,
                    totalSales,
                    avgConversion: avgConv
                })
            } catch (err) {
                console.error('Error fetching checkouts:', err)
                setError('Erro ao carregar checkouts')
                setCheckouts([])
                setStats({
                    total: 0,
                    active: 0,
                    inactive: 0,
                    totalSales: 0,
                    avgConversion: 0
                })
            } finally {
                setLoading(false)
            }
        }

        loadCheckouts()
    }, [user?.id, params.searchQuery, params.statusFilter, params.productFilter, params.refreshKey])

    return {
        checkouts,
        loading,
        error,
        stats,
        removeCheckout: (id: string) => {
            setCheckouts(prev => prev.filter(c => c.id !== id))
            setStats(prev => ({
                ...prev,
                total: prev.total - 1,
                active: prev.active - (checkouts.find(c => c.id === id)?.status === 'active' ? 1 : 0),
                inactive: prev.inactive - (checkouts.find(c => c.id === id)?.status === 'inactive' ? 1 : 0),
            }))
        }
    }
}
