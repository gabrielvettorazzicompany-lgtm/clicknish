import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log("Applications function loaded!")

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id, x-user-email, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Helper function to get user_id from admin_profiles
const getCurrentUserId = (req: Request): string | null => {
    return req.headers.get('x-user-id') || null
}

Deno.serve(async (req) => {
    const url = new URL(req.url)
    // Remove /applications prefix to get relative path
    const pathAfterFunction = url.pathname.replace(/^\/applications\/?/, '')
    const pathSegments = pathAfterFunction ? pathAfterFunction.split('/').filter(Boolean) : []

    console.log('=== APPLICATIONS EDGE FUNCTION ===')
    console.log('Method:', req.method)
    console.log('Full Path:', url.pathname)
    console.log('Path after function:', pathAfterFunction)
    console.log('Segments:', pathSegments)

    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Get user_id from x-user-id header sent by frontend
        const userId = getCurrentUserId(req)

        // === PUBLIC ROUTES (no x-user-id required) ===

        // GET /applications/:id - Get application by ID (public)
        if (req.method === 'GET' && pathSegments.length === 1) {
            const appId = pathSegments[0]

            const { data, error } = await supabase
                .from('applications')
                .select(`
          *,
          app_banners (*)
        `)
                .eq('id', appId)
                .single()

            if (error) throw error

            return new Response(JSON.stringify(data), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // GET /applications/:id/products - List application products (public)
        if (req.method === 'GET' && pathSegments.length === 2 && pathSegments[1] === 'products') {
            const appId = pathSegments[0]

            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('application_id', appId)
                .order('order', { ascending: true })

            if (error) throw error

            return new Response(JSON.stringify(data || []), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // GET /applications/:id/banners - Get application banners (public)
        if (req.method === 'GET' && pathSegments.length === 2 && pathSegments[1] === 'banners') {
            const appId = pathSegments[0]

            const { data, error } = await supabase
                .from('app_banners')
                .select('*')
                .eq('application_id', appId)
                .order('display_order', { ascending: true })

            if (error) throw error

            return new Response(JSON.stringify(data || []), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // GET /applications/:appId/products/:productId/contents - Get product contents (public)
        if (req.method === 'GET' && pathSegments.length === 4 && pathSegments[1] === 'products' && pathSegments[3] === 'contents') {
            const productId = pathSegments[2]

            const { data, error } = await supabase
                .from('product_content')
                .select('*')
                .eq('product_id', productId)
                .order('order', { ascending: true })

            if (error) throw error

            // Map database fields to frontend expected fields
            const mappedData = data?.map(item => ({
                id: item.id,
                product_id: item.product_id,
                name: item.title,
                type: item.content_type,
                url: item.content_url,
                description: item.text_content,
                cover_url: item.cover_url,
                attachments: item.attachments || [],
                order: item.order,
                order_index: item.order,
                created_at: item.created_at,
                updated_at: item.updated_at
            })) || []

            return new Response(JSON.stringify(mappedData), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // === AUTHENTICATED ROUTES (x-user-id required) ===

        if (!userId) {
            return new Response(JSON.stringify({ error: 'Missing x-user-id header' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        console.log('👤 User ID:', userId)
        if (req.method === 'GET' && pathSegments.length === 0) {
            console.log('📋 GET request to list applications for userId:', userId)

            // First, let's see what's in the database
            console.log('🔍 Checking ALL applications in database...')
            const { data: allApps, error: allAppsError } = await supabase
                .from('applications')
                .select('id, name, owner_id')

            if (allAppsError) {
                console.error('Error fetching all apps:', allAppsError)
            } else {
                console.log('🗄️ ALL APPS in database:', JSON.stringify(allApps, null, 2))
            }

            // Get apps para este usuário
            const { data, error } = await supabase
                .from('applications')
                .select('*')
                .eq('owner_id', userId)

            if (error) throw error

            console.log('👤 Found', data?.length || 0, 'applications for user', userId, ':', JSON.stringify(data, null, 2))

            return new Response(JSON.stringify(data || []), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // POST /applications - Create application
        if (req.method === 'POST' && pathSegments.length === 0) {
            const body = await req.json()

            const newApp = {
                owner_id: userId,
                name: body.name,
                slug: body.slug || body.name.toLowerCase().replace(/\s+/g, '-'),
                logo_url: body.logo_url,
                primary_color: body.primary_color || '#6366f1',
                secondary_color: body.secondary_color || '#ec4899',
                show_names: body.show_names || false,
                highlight_community: body.highlight_community || false,
                free_registration: body.free_registration || false,
                support_enabled: body.support_enabled || false,
                support_email: body.support_email || null,
                whatsapp_number: body.whatsapp_number || null,
                support_icon_url: body.support_icon_url || null,
                app_type: body.app_type || 'login-complete',
                language: body.language || 'pt-br',
                theme: body.theme || 'light',
                review_status: 'pending_review'  // Apps novos precisam de aprovação
            }

            const { data, error } = await supabase
                .from('applications')
                .insert(newApp)
                .select()
                .single()

            if (error) throw error

            // Save banners if provided
            if (body.banners && Array.isArray(body.banners) && body.banners.length > 0) {
                const bannersData = body.banners.map((banner: any, index: number) => ({
                    application_id: data.id,
                    image_url: banner.image || null,
                    link_url: banner.link || null,
                    display_order: index
                }))

                await supabase.from('app_banners').insert(bannersData)
            }

            return new Response(JSON.stringify(data), {
                status: 201,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // POST /applications/:id/products - Create product
        if (req.method === 'POST' && pathSegments.length === 2 && pathSegments[1] === 'products') {
            const appId = pathSegments[0]
            const body = await req.json()

            const newProduct = {
                application_id: appId,
                name: body.name,
                description: body.description,
                type: body.access_type || 'course',
                cover_url: body.logo_url,
                offer_type: body.offer_type || 'main',
                release_type: body.release_type || 'immediate',
                release_days: body.release_type === 'days-after' ? parseInt(body.release_days) || null : null,
                release_date: body.release_type === 'fixed-date' ? body.release_date || null : null,
                platform_ids: body.platform_ids || []
            }

            const { data, error } = await supabase
                .from('products')
                .insert(newProduct)
                .select()
                .single()

            if (error) throw error

            return new Response(JSON.stringify(data), {
                status: 201,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // PUT /applications/:appId/products/:productId - Update product
        if (req.method === 'PUT' && pathSegments.length === 3 && pathSegments[1] === 'products') {
            const appId = pathSegments[0]
            const productId = pathSegments[2]
            const body = await req.json()

            const updateProduct = {
                name: body.name,
                description: body.description,
                type: body.access_type || 'course',
                cover_url: body.logo_url,
                offer_type: body.offer_type,
                release_type: body.release_type || 'immediate',
                release_days: body.release_type === 'days-after' ? parseInt(body.release_days) || null : null,
                release_date: body.release_type === 'fixed-date' ? body.release_date || null : null,
                platform_ids: body.platform_ids
            }

            const { data, error } = await supabase
                .from('products')
                .update(updateProduct)
                .eq('id', productId)
                .eq('application_id', appId)
                .select()
                .single()

            if (error) throw error

            return new Response(JSON.stringify(data), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // DELETE /applications/:appId/products/:productId - Delete product
        if (req.method === 'DELETE' && pathSegments.length === 3 && pathSegments[1] === 'products') {
            const appId = pathSegments[0]
            const productId = pathSegments[2]

            const { error } = await supabase
                .from('products')
                .delete()
                .eq('id', productId)
                .eq('application_id', appId)

            if (error) throw error

            return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // POST /applications/:appId/products/:productId/contents - Create product content
        if (req.method === 'POST' && pathSegments.length === 4 && pathSegments[1] === 'products' && pathSegments[3] === 'contents') {
            const productId = pathSegments[2]
            const body = await req.json()

            const { data, error } = await supabase
                .from('product_content')
                .insert({
                    product_id: productId,
                    title: body.name || body.title,
                    content_type: body.type || 'video',
                    content_url: body.url,
                    text_content: body.description,
                    cover_url: body.cover_url,
                    attachments: body.attachments || [],
                    order: body.order_index || 0
                })
                .select()
                .single()

            if (error) throw error

            // Map database fields to frontend expected fields
            const mappedData = {
                id: data.id,
                product_id: data.product_id,
                name: data.title,
                type: data.content_type,
                url: data.content_url,
                description: data.text_content,
                cover_url: data.cover_url,
                attachments: data.attachments || [],
                order: data.order,
                order_index: data.order,
                created_at: data.created_at,
                updated_at: data.updated_at
            }

            return new Response(JSON.stringify(mappedData), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // PUT /applications/:appId/products/:productId/contents/:contentId - Update product content
        if (req.method === 'PUT' && pathSegments.length === 5 && pathSegments[1] === 'products' && pathSegments[3] === 'contents') {
            const contentId = pathSegments[4]
            const body = await req.json()

            const { data, error } = await supabase
                .from('product_content')
                .update({
                    title: body.name || body.title,
                    content_type: body.type || 'video',
                    content_url: body.url,
                    text_content: body.description,
                    cover_url: body.cover_url,
                    attachments: body.attachments || [],
                    order: body.order_index || 0
                })
                .eq('id', contentId)
                .select()
                .single()

            if (error) throw error

            // Map database fields to frontend expected fields
            const mappedData = {
                id: data.id,
                product_id: data.product_id,
                name: data.title,
                type: data.content_type,
                url: data.content_url,
                description: data.text_content,
                cover_url: data.cover_url,
                attachments: data.attachments || [],
                order: data.order,
                order_index: data.order,
                created_at: data.created_at,
                updated_at: data.updated_at
            }

            return new Response(JSON.stringify(mappedData), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // DELETE /applications/:appId/products/:productId/contents/:contentId - Delete product content
        if (req.method === 'DELETE' && pathSegments.length === 5 && pathSegments[1] === 'products' && pathSegments[3] === 'contents') {
            const contentId = pathSegments[4]

            const { error } = await supabase
                .from('product_content')
                .delete()
                .eq('id', contentId)

            if (error) throw error

            return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // DELETE /applications/:id - Delete application
        if (req.method === 'DELETE' && pathSegments.length === 1) {
            const appId = pathSegments[0]

            console.log('🗑️ DELETE request for app:', appId, 'by user:', userId)

            // First delete related banners
            const { error: bannersError } = await supabase.from('app_banners').delete().eq('application_id', appId)
            if (bannersError) {
                console.error('Error deleting banners:', bannersError)
            }

            // Then delete the application
            const { error } = await supabase
                .from('applications')
                .delete()
                .eq('id', appId)
                .eq('owner_id', userId) // Only allow owner to delete

            if (error) {
                console.error('Error deleting application:', error)
                throw error
            }

            console.log('✅ App deleted successfully:', appId)
            return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // PUT /applications/:id - Update application
        if (req.method === 'PUT' && pathSegments.length === 1) {
            const appId = pathSegments[0]
            const body = await req.json()

            const updateData = {
                name: body.name,
                slug: body.slug || body.name.toLowerCase().replace(/\s+/g, '-'),
                logo_url: body.logo_url,
                primary_color: body.primary_color || '#6366f1',
                secondary_color: body.secondary_color || '#ec4899',
                show_names: body.show_names || false,
                highlight_community: body.highlight_community || false,
                free_registration: body.free_registration || false,
                support_enabled: body.support_enabled || false,
                support_email: body.support_email || null,
                whatsapp_number: body.whatsapp_number || null,
                support_icon_url: body.support_icon_url || null,
                app_type: body.app_type || 'login-complete',
                language: body.language || 'pt-br',
                theme: body.theme || 'light'
            }

            const { data, error } = await supabase
                .from('applications')
                .update(updateData)
                .eq('id', appId)
                .eq('owner_id', userId) // Only allow owner to update
                .select()
                .single()

            if (error) throw error

            // Update banners if provided
            if (body.banners && Array.isArray(body.banners)) {
                // Delete existing banners
                await supabase.from('app_banners').delete().eq('application_id', appId)

                // Insert new banners
                if (body.banners.length > 0) {
                    const bannersData = body.banners.map((banner: any, index: number) => ({
                        application_id: appId,
                        image_url: banner.image || null,
                        link_url: banner.link || null,
                        display_order: index
                    }))

                    await supabase.from('app_banners').insert(bannersData)
                }
            }

            return new Response(JSON.stringify(data), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // GET /applications/:appId/feed/posts - Get feed posts
        if (req.method === 'GET' && pathSegments.length === 3 && pathSegments[1] === 'feed' && pathSegments[2] === 'posts') {
            const appId = pathSegments[0]
            const status = url.searchParams.get('status')

            let query = supabase
                .from('feed_posts')
                .select('*')
                .eq('application_id', appId)

            if (status) {
                query = query.eq('status', status)
            }

            const { data, error } = await query.order('created_at', { ascending: false })

            if (error) throw error

            return new Response(JSON.stringify(data || []), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // POST /applications/:appId/feed/posts - Create feed post
        if (req.method === 'POST' && pathSegments.length === 3 && pathSegments[1] === 'feed' && pathSegments[2] === 'posts') {
            const appId = pathSegments[0]
            const body = await req.json()

            console.log('📝 Creating feed post:', { appId, body })

            const now = new Date().toISOString()
            const scheduledFor = body.scheduled_for ? new Date(body.scheduled_for).toISOString() : null

            // Se tem scheduled_for e é no futuro, status = pending, senão published
            const isPending = scheduledFor && new Date(scheduledFor) > new Date()

            const newPost = {
                application_id: appId,
                content: body.content,
                image_url: body.image_url || null,
                scheduled_for: scheduledFor,
                status: isPending ? 'pending' : 'published',
                published_at: isPending ? null : now
            }

            console.log('Creating post with data:', newPost)

            const { data, error } = await supabase
                .from('feed_posts')
                .insert(newPost)
                .select()
                .single()

            if (error) {
                console.error('❌ Error creating feed post:', error)
                throw error
            }

            console.log('✅ Feed post created:', data)

            return new Response(JSON.stringify(data), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // PUT /applications/:appId/feed/posts/:postId - Update feed post
        if (req.method === 'PUT' && pathSegments.length === 4 && pathSegments[1] === 'feed' && pathSegments[2] === 'posts') {
            const appId = pathSegments[0]
            const postId = pathSegments[3]
            const body = await req.json()

            const updateData: any = {}
            if (body.content !== undefined) updateData.content = body.content
            if (body.image_url !== undefined) updateData.image_url = body.image_url
            if (body.scheduled_for !== undefined) updateData.scheduled_for = body.scheduled_for
            if (body.status !== undefined) updateData.status = body.status

            const { data, error } = await supabase
                .from('feed_posts')
                .update(updateData)
                .eq('id', postId)
                .eq('application_id', appId)
                .select()
                .single()

            if (error) throw error

            return new Response(JSON.stringify(data), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // DELETE /applications/:appId/feed/posts/:postId - Delete feed post
        if (req.method === 'DELETE' && pathSegments.length === 4 && pathSegments[1] === 'feed' && pathSegments[2] === 'posts') {
            const appId = pathSegments[0]
            const postId = pathSegments[3]

            const { error } = await supabase
                .from('feed_posts')
                .delete()
                .eq('id', postId)
                .eq('application_id', appId)

            if (error) throw error

            return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // GET /applications/:appId/community/posts - Get community posts
        if (req.method === 'GET' && pathSegments.length === 3 && pathSegments[1] === 'community' && pathSegments[2] === 'posts') {
            const appId = pathSegments[0]

            const { data, error } = await supabase
                .from('community_posts')
                .select('*')
                .eq('application_id', appId)
                .order('created_at', { ascending: false })

            if (error) throw error

            return new Response(JSON.stringify(data || []), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // POST /applications/:appId/community/posts - Create community post
        if (req.method === 'POST' && pathSegments.length === 3 && pathSegments[1] === 'community' && pathSegments[2] === 'posts') {
            const appId = pathSegments[0]
            const body = await req.json()

            const newPost = {
                application_id: appId,
                author_name: body.author_name,
                author_avatar: body.author_avatar || null,
                content: body.content,
                image_url: body.image_url || null,
                is_pinned: false,
                likes_count: 0
            }

            const { data, error } = await supabase
                .from('community_posts')
                .insert(newPost)
                .select()
                .single()

            if (error) throw error

            return new Response(JSON.stringify(data), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // DELETE /applications/community/posts/:postId - Delete community post
        if (req.method === 'DELETE' && pathSegments.length === 3 && pathSegments[0] === 'community' && pathSegments[1] === 'posts') {
            const postId = pathSegments[2]

            const { error } = await supabase
                .from('community_posts')
                .delete()
                .eq('id', postId)

            if (error) throw error

            return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // POST /applications/community/posts/:postId/like - Like a post
        if (req.method === 'POST' && pathSegments.length === 4 && pathSegments[0] === 'community' && pathSegments[1] === 'posts' && pathSegments[3] === 'like') {
            const postId = pathSegments[2]

            const { data, error } = await supabase
                .rpc('increment_post_likes', { post_id: postId })

            if (error) {
                // Fallback: increment manually
                const { data: post } = await supabase
                    .from('community_posts')
                    .select('likes_count')
                    .eq('id', postId)
                    .single()

                const newCount = (post?.likes_count || 0) + 1

                await supabase
                    .from('community_posts')
                    .update({ likes_count: newCount })
                    .eq('id', postId)

                return new Response(JSON.stringify({ likes_count: newCount }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // GET /applications/community/posts/:postId/comments - Get post comments
        if (req.method === 'GET' && pathSegments.length === 4 && pathSegments[0] === 'community' && pathSegments[1] === 'posts' && pathSegments[3] === 'comments') {
            const postId = pathSegments[2]

            const { data, error } = await supabase
                .from('community_comments')
                .select('*')
                .eq('post_id', postId)
                .order('created_at', { ascending: true })

            if (error) throw error

            return new Response(JSON.stringify(data || []), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // POST /applications/community/posts/:postId/comments - Add comment
        if (req.method === 'POST' && pathSegments.length === 4 && pathSegments[0] === 'community' && pathSegments[1] === 'posts' && pathSegments[3] === 'comments') {
            const postId = pathSegments[2]
            const body = await req.json()

            const newComment = {
                post_id: postId,
                author_name: body.author_name,
                author_avatar: body.author_avatar || null,
                content: body.content
            }

            const { data, error } = await supabase
                .from('community_comments')
                .insert(newComment)
                .select()
                .single()

            if (error) throw error

            // Increment comments_count on post
            const { data: post } = await supabase
                .from('community_posts')
                .select('comments_count')
                .eq('id', postId)
                .single()

            const newCount = (post?.comments_count || 0) + 1

            await supabase
                .from('community_posts')
                .update({ comments_count: newCount })
                .eq('id', postId)

            return new Response(JSON.stringify(data), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // DELETE /applications/community/comments/:commentId - Delete comment
        if (req.method === 'DELETE' && pathSegments.length === 3 && pathSegments[0] === 'community' && pathSegments[1] === 'comments') {
            const commentId = pathSegments[2]

            // Get comment to find post_id
            const { data: comment } = await supabase
                .from('community_comments')
                .select('post_id')
                .eq('id', commentId)
                .single()

            const { error } = await supabase
                .from('community_comments')
                .delete()
                .eq('id', commentId)

            if (error) throw error

            // Decrement comments_count on post
            if (comment?.post_id) {
                const { data: post } = await supabase
                    .from('community_posts')
                    .select('comments_count')
                    .eq('id', comment.post_id)
                    .single()

                const newCount = Math.max((post?.comments_count || 1) - 1, 0)

                await supabase
                    .from('community_posts')
                    .update({ comments_count: newCount })
                    .eq('id', comment.post_id)
            }

            return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // GET /applications/:appId/user/profile - Get user profile
        if (req.method === 'GET' && pathSegments.length === 3 && pathSegments[1] === 'user' && pathSegments[2] === 'profile') {
            const appId = pathSegments[0]
            const userEmail = req.headers.get('x-user-email')

            if (!userEmail) {
                return new Response(JSON.stringify({ error: 'User email required' }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            const { data, error } = await supabase
                .from('app_users')
                .select('*')
                .eq('application_id', appId)
                .eq('email', userEmail)
                .single()

            if (error) {
                return new Response(JSON.stringify({ error: 'User not found' }), {
                    status: 404,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            return new Response(JSON.stringify(data), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // PUT /applications/:appId/user/profile - Update user profile
        if (req.method === 'PUT' && pathSegments.length === 3 && pathSegments[1] === 'user' && pathSegments[2] === 'profile') {
            const appId = pathSegments[0]
            const userEmail = req.headers.get('x-user-email')
            const body = await req.json()

            console.log('🔄 PUT user profile:', { appId, userEmail, body })

            if (!userEmail) {
                return new Response(JSON.stringify({ error: 'User email required' }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            // Verificar se o usuário já existe
            const { data: existingUser } = await supabase
                .from('app_users')
                .select('*')
                .eq('application_id', appId)
                .eq('email', userEmail)
                .single()

            if (existingUser) {
                // Atualizar usuário existente
                const updateData: any = {}
                if (body.full_name !== undefined) updateData.full_name = body.full_name
                if (body.avatar_url !== undefined) updateData.avatar_url = body.avatar_url

                const { data, error } = await supabase
                    .from('app_users')
                    .update(updateData)
                    .eq('application_id', appId)
                    .eq('email', userEmail)
                    .select()
                    .single()

                if (error) {
                    console.error('❌ Error updating user:', error)
                    return new Response(JSON.stringify({ error: error.message }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                }

                console.log('✅ User updated:', data)
                return new Response(JSON.stringify(data), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            } else {
                // Criar novo usuário
                const newUser = {
                    application_id: appId,
                    email: userEmail,
                    full_name: body.full_name || null,
                    avatar_url: body.avatar_url || null,
                    user_id: `user_${Date.now()}`
                }

                const { data, error } = await supabase
                    .from('app_users')
                    .insert(newUser)
                    .select()
                    .single()

                if (error) {
                    console.error('❌ Error creating user:', error)
                    return new Response(JSON.stringify({ error: error.message }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                }

                console.log('✅ User created:', data)
                return new Response(JSON.stringify(data), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }
        }

        // GET /applications/:appId/notifications - Get user notifications OR admin history
        if (req.method === 'GET' && pathSegments.length === 2 && pathSegments[1] === 'notifications') {
            const appId = pathSegments[0]
            const userEmail = req.headers.get('x-user-email')
            const isAdmin = url.searchParams.get('admin') === 'true'

            // Se for admin, retornar histórico de notificações enviadas
            if (isAdmin) {
                const { data: history, error } = await supabase
                    .from('push_notifications')
                    .select('*')
                    .eq('application_id', appId)
                    .order('sent_at', { ascending: false })
                    .limit(100)

                if (error) throw error

                return new Response(JSON.stringify(history || []), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            // Se não for admin, buscar notificações do usuário
            if (!userEmail) {
                return new Response(JSON.stringify({ error: 'User email required' }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            // Buscar o usuário
            const { data: user } = await supabase
                .from('app_users')
                .select('id')
                .eq('application_id', appId)
                .eq('email', userEmail)
                .single()

            if (!user) {
                return new Response(JSON.stringify([]), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            // Buscar notificações do usuário
            const { data: notifications, error } = await supabase
                .from('user_notifications')
                .select('*')
                .eq('application_id', appId)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(50)

            if (error) throw error

            return new Response(JSON.stringify(notifications || []), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // POST /applications/:appId/notifications - Send push notification to all users
        if (req.method === 'POST' && pathSegments.length === 2 && pathSegments[1] === 'notifications') {
            const appId = pathSegments[0]
            const body = await req.json()

            console.log('📱 Sending notification to all users of app:', appId)

            // Validar dados
            if (!body.title || !body.message) {
                return new Response(JSON.stringify({ error: 'Title and message are required' }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            // Buscar todos os usuários do app
            const { data: users, error: usersError } = await supabase
                .from('app_users')
                .select('id, email, full_name')
                .eq('application_id', appId)

            if (usersError) {
                console.error('❌ Error fetching users:', usersError)
                throw usersError
            }

            console.log(`📊 Found ${users?.length || 0} users`)

            // Criar notificações individuais para cada usuário
            if (users && users.length > 0) {
                const notificationsToInsert = users.map(user => ({
                    application_id: appId,
                    user_id: user.id,
                    title: body.title,
                    message: body.message,
                    redirect_url: body.redirect_url || null,
                    read: false
                }))

                const { error: insertError } = await supabase
                    .from('user_notifications')
                    .insert(notificationsToInsert)

                if (insertError) {
                    console.error('❌ Error creating notifications:', insertError)
                    throw insertError
                }
            }

            // Aqui você pode integrar com um serviço de push notifications
            // Por exemplo: Firebase Cloud Messaging, OneSignal, etc.

            // Salvar no histórico de notificações
            const { data: historyRecord, error: historyError } = await supabase
                .from('push_notifications')
                .insert({
                    application_id: appId,
                    title: body.title,
                    message: body.message
                })
                .select()
                .single()

            if (historyError) {
                console.error('❌ Error saving notification history:', historyError)
            }

            console.log('✅ Notification sent to', users?.length || 0, 'users')

            return new Response(JSON.stringify({
                success: true,
                recipients_count: users?.length || 0,
                notification: historyRecord
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // PUT /applications/:appId/notifications/mark-read - Mark all notifications as read
        if (req.method === 'PUT' && pathSegments.length === 3 && pathSegments[1] === 'notifications' && pathSegments[2] === 'mark-read') {
            const appId = pathSegments[0]
            const userEmail = req.headers.get('x-user-email')

            if (!userEmail) {
                return new Response(JSON.stringify({ error: 'User email required' }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            // Buscar o usuário
            const { data: user } = await supabase
                .from('app_users')
                .select('id')
                .eq('application_id', appId)
                .eq('email', userEmail)
                .single()

            if (!user) {
                return new Response(JSON.stringify({ error: 'User not found' }), {
                    status: 404,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            // Marcar todas as notificações como lidas
            const { error } = await supabase
                .from('user_notifications')
                .update({ read: true })
                .eq('application_id', appId)
                .eq('user_id', user.id)
                .eq('read', false)

            if (error) {
                console.error('❌ Error marking notifications as read:', error)
                throw error
            }

            console.log('✅ Notifications marked as read for user:', userEmail)

            return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // GET /admin/profile/:userId - Get admin profile
        if (req.method === 'GET' && pathSegments.length === 3 && pathSegments[0] === 'admin' && pathSegments[1] === 'profile') {
            const userId = pathSegments[2]

            console.log('👤 GET admin profile for userId:', userId)

            const { data: profile, error } = await supabase
                .from('admin_profiles')
                .select('*')
                .eq('user_id', userId)
                .single()

            if (error && error.code !== 'PGRST116') { // PGRST116 = not found
                console.error('❌ Error fetching admin profile:', error)
                throw error
            }

            // Se não existe perfil, criar um novo
            if (!profile) {
                console.log('📝 Creating new admin profile for userId:', userId)

                const { data: newProfile, error: createError } = await supabase
                    .from('admin_profiles')
                    .insert({
                        user_id: userId,
                        full_name: ''
                    })
                    .select()
                    .single()

                if (createError) {
                    console.error('❌ Error creating admin profile:', createError)
                    throw createError
                }

                return new Response(JSON.stringify(newProfile), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            return new Response(JSON.stringify(profile), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // PUT /admin/profile/:userId - Update admin profile
        if (req.method === 'PUT' && pathSegments.length === 3 && pathSegments[0] === 'admin' && pathSegments[1] === 'profile') {
            const userId = pathSegments[2]
            const body = await req.json()

            console.log('🔄 PUT admin profile for userId:', userId, 'body:', body)

            const { data: profile, error } = await supabase
                .from('admin_profiles')
                .update({
                    full_name: body.full_name,
                    avatar_path: body.avatar_path,
                    phone: body.phone,
                    bio: body.bio
                })
                .eq('user_id', userId)
                .select()
                .single()

            if (error) {
                console.error('❌ Error updating admin profile:', error)
                throw error
            }

            console.log('✅ Admin profile updated:', profile)

            return new Response(JSON.stringify(profile), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // POST /admin/change-password - Change admin password
        if (req.method === 'POST' && pathSegments.length === 2 && pathSegments[0] === 'admin' && pathSegments[1] === 'change-password') {
            const body = await req.json()
            const { userId, newPassword } = body

            console.log('🔐 Changing password for userId:', userId)

            if (!userId || !newPassword) {
                return new Response(JSON.stringify({ error: 'userId and newPassword are required' }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            if (newPassword.length < 6) {
                return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            // Usar Supabase Admin API para alterar a senha
            const { data, error } = await supabase.auth.admin.updateUserById(
                userId,
                { password: newPassword }
            )

            if (error) {
                console.error('❌ Error changing password:', error)
                return new Response(JSON.stringify({ error: error.message }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            console.log('✅ Password changed successfully for user:', userId)

            return new Response(JSON.stringify({ success: true, message: 'Password changed successfully' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // GET /admin/password-history/:userId - Get password change history (placeholder)
        if (req.method === 'GET' && pathSegments.length === 3 && pathSegments[0] === 'admin' && pathSegments[1] === 'password-history') {
            const userId = pathSegments[2]

            console.log('📜 GET password history for userId:', userId)

            // Por enquanto retorna array vazio, você pode implementar uma tabela para armazenar histórico
            return new Response(JSON.stringify([]), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        return new Response(JSON.stringify({ error: 'Not Found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error) {
        console.error('Function error:', error)
        return new Response(JSON.stringify({
            error: error.message,
            timestamp: new Date().toISOString()
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})