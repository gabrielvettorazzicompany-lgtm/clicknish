import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'



const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

Deno.serve(async (req) => {
    const url = new URL(req.url)
    // Remove /products prefix to get relative path
    const pathAfterFunction = url.pathname.replace(/^\/products\/?/, '')
    const pathSegments = pathAfterFunction ? pathAfterFunction.split('/').filter(Boolean) : []

    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // PUT /products/:id - Update product
        if (req.method === 'PUT' && pathSegments.length === 1) {
            const productId = pathSegments[0]
            const body = await req.json()

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

    } catch (error) {
        console.error('Products function error:', error)
        return new Response(JSON.stringify({
            error: error.message,
            timestamp: new Date().toISOString()
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})