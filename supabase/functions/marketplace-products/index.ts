import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            {
                global: {
                    headers: { Authorization: req.headers.get('Authorization')! },
                },
            }
        )

        const { data: { user } } = await supabaseClient.auth.getUser()

        if (!user) {
            throw new Error('Unauthorized')
        }

        const url = new URL(req.url)
        const pathParts = url.pathname.split('/').filter(Boolean)
        const productId = pathParts[pathParts.length - 1]

        switch (req.method) {
            case 'GET': {
                // List user products
                const { data, error } = await supabaseClient
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
                const body = await req.json()

                // Generate base slug
                const baseSlug = body.name
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/(^-|-$)/g, '')

                // Check if slug already exists and generate unique if needed
                let slug = baseSlug
                let counter = 1
                let slugExists = true

                while (slugExists) {
                    const { data: existing } = await supabaseClient
                        .from('marketplace_products')
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

                const productData = {
                    owner_id: user.id,
                    name: body.name,
                    description: body.description,
                    slug: slug,
                    price: body.price,
                    currency: body.currency || 'USD',
                    category: body.category,
                    image_url: body.image_url,
                    marketplace_enabled: body.marketplace_enabled || false,
                    delivery_type: body.delivery_type || 'app',
                    status: body.status || 'draft',
                    payment_type: body.payment_type || 'unique',
                    sales_page_url: body.sales_page_url || null,
                    recurrence_period: body.payment_type === 'recurrent' ? body.recurrence_period : null,
                    support_email: body.support_email || null,
                    support_whatsapp: body.support_whatsapp || null,
                    review_status: 'pending_review', // New products need approval
                }

                const { data, error } = await supabaseClient
                    .from('member_areas')
                    .insert([productData])
                    .select()
                    .single()

                if (error) throw error

                return new Response(JSON.stringify(data), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 201,
                })
            }

            case 'PATCH': {
                // Update product
                const body = await req.json()

                const { data, error } = await supabaseClient
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
                const { error } = await supabaseClient
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
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
