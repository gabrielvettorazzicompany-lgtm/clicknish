// @ts-nocheck
import { createClient } from '../lib/supabase'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

export async function handleProducts(request: Request, env: any, pathSegments: string[]): Promise<Response> {
    if (request.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createClient(env)

        // PUT /api/products/:id - Update product
        if (request.method === 'PUT' && pathSegments.length === 1) {
            const productId = pathSegments[0]
            const body = await request.json()

            const updateData = {
                name: body.name,
                description: body.description,
                price: body.price,
                cover_url: body.logo_url,
                access_type: body.access_type,
                release_type: body.release_type,
                release_days: body.release_days,
                release_date: body.release_date,
                offer_type: body.offer_type,
                platform_ids: body.platform_ids
            }

            const { data, error } = await supabase
                .from('products')
                .update(updateData)
                .eq('id', productId)
                .select()
                .single()

            if (error) throw error

            return new Response(JSON.stringify(data), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        return new Response(JSON.stringify({ error: 'Not Found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error: any) {
        console.error('Products function error:', error)
        return new Response(JSON.stringify({
            error: error.message,
            timestamp: new Date().toISOString()
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
}
