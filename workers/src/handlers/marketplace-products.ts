// @ts-nocheck
import { createClient } from '../lib/supabase'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
}

export async function handleMarketplaceProducts(request: Request, env: any, pathSegments: string[]): Promise<Response> {
    if (request.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createClient(env)
        const authHeader = request.headers.get('Authorization')

        // Get user from token
        const { data: { user } } = await supabase.auth.getUser(authHeader?.replace('Bearer ', ''))

        if (!user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const url = new URL(request.url)
        const productId = pathSegments.length > 0 ? pathSegments[pathSegments.length - 1] : null

        switch (request.method) {
            case 'GET': {
                // List user products
                const { data, error } = await supabase
                    .from('marketplace_products')
                    .select('*')
                    .eq('owner_id', user.id)
                    .order('created_at', { ascending: false })

                if (error) throw error

                return new Response(JSON.stringify(data), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 200,
                })
            }

            case 'POST': {
                // Create new product
                const body = await request.json()

                // Validate required fields
                if (!body.name || body.name.trim() === '') {
                    return new Response(JSON.stringify({ error: 'Name is required' }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                }

                // Validate currency (must be USD, EUR or CHF)
                const validCurrencies = ['USD', 'EUR', 'CHF']
                const currency = body.currency && validCurrencies.includes(body.currency) ? body.currency : 'USD'

                // Generate base slug
                const baseSlug = body.name
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/(^-|-$)/g, '')

                // Check if slug already exists and generate unique if needed
                let slug = baseSlug || 'product'
                let counter = 1
                let slugExists = true

                while (slugExists) {
                    const { data: existing } = await supabase
                        .from('member_areas')
                        .select('id')
                        .eq('slug', slug)
                        .single()

                    if (!existing) {
                        slugExists = false
                    } else {
                        slug = `${baseSlug}-${counter}`
                        counter++
                    }
                }

                // Accept both marketplace_enabled and show_in_marketplace from frontend
                const marketplaceEnabled = body.marketplace_enabled ?? body.show_in_marketplace ?? false

                const productData = {
                    owner_id: user.id,
                    name: body.name.trim(),
                    description: body.description || null,
                    slug: slug,
                    price: parseFloat(body.price) || 0,
                    currency: currency,
                    category: body.category || null,
                    image_url: body.image_url || null,
                    marketplace_enabled: marketplaceEnabled,
                    show_in_marketplace: marketplaceEnabled,
                    delivery_type: body.delivery_type || 'app',
                    status: body.status || 'draft',
                    payment_type: body.payment_type || 'unique',
                    sales_page_url: body.sales_page_url || null,
                    recurrence_period: body.payment_type === 'recurrent' ? (body.recurrence_period || 'monthly') : null,
                    support_email: body.support_email || null,
                    support_whatsapp: body.support_whatsapp || null,
                    review_status: 'pending_review',
                }

                console.log('Creating member area with data:', JSON.stringify(productData))

                const { data, error } = await supabase
                    .from('member_areas')
                    .insert([productData])
                    .select()
                    .single()

                if (error) {
                    console.error('Supabase error:', JSON.stringify(error))
                    return new Response(JSON.stringify({
                        error: error.message,
                        details: error.details,
                        hint: error.hint,
                        code: error.code
                    }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                }

                return new Response(JSON.stringify(data), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 201,
                })
            }

            case 'PATCH': {
                // Update product
                const body = await request.json()

                const { data, error } = await supabase
                    .from('member_areas')
                    .update(body)
                    .eq('id', productId)
                    .eq('owner_id', user.id)
                    .select()
                    .single()

                if (error) throw error

                return new Response(JSON.stringify(data), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 200,
                })
            }

            case 'DELETE': {
                // Delete product
                const { error } = await supabase
                    .from('member_areas')
                    .delete()
                    .eq('id', productId)
                    .eq('owner_id', user.id)

                if (error) throw error

                return new Response(JSON.stringify({ success: true }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 200,
                })
            }

            default:
                return new Response('Method Not Allowed', {
                    headers: corsHeaders,
                    status: 405,
                })
        }
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
}
