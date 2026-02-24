// @ts-nocheck
import { createClient } from '../lib/supabase'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
}

export async function handleMarketplaceProductsPublic(request: Request, env: any): Promise<Response> {
    if (request.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
        const url = new URL(request.url)
        const searchParams = url.searchParams

        // Parâmetros de filtro e busca
        const category = searchParams.get('category')
        const delivery_type = searchParams.get('delivery_type')
        const search = searchParams.get('search')
        const sort = searchParams.get('sort') || 'newest'
        const limit = parseInt(searchParams.get('limit') || '20')
        const offset = parseInt(searchParams.get('offset') || '0')

        let query = supabase
            .from('marketplace_products')
            .select('*', { count: 'exact' })
            .eq('marketplace_enabled', true)
            .eq('status', 'active')

        // Aplicar filtros
        if (category) {
            query = query.eq('category', category)
        }

        if (delivery_type) {
            query = query.eq('delivery_type', delivery_type)
        }

        if (search && search.trim().length > 0) {
            query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
        }

        // Aplicar ordenação
        switch (sort) {
            case 'price_asc':
                query = query.order('price', { ascending: true })
                break
            case 'price_desc':
                query = query.order('price', { ascending: false })
                break
            case 'popular':
                query = query.order('sales_count', { ascending: false })
                break
            case 'newest':
            default:
                query = query.order('created_at', { ascending: false })
                break
        }

        // Paginação
        query = query.range(offset, offset + limit - 1)

        const { data, error, count } = await query

        if (error) throw error

        return new Response(JSON.stringify({
            products: data || [],
            total: count || 0,
            limit,
            offset,
            has_more: (count || 0) > offset + limit
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    } catch (error: any) {
        console.error('Error:', error)
        return new Response(JSON.stringify({
            error: error.message || 'Erro interno do servidor',
            products: [],
            total: 0
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
}
