// @ts-nocheck
/**
 * Handler: Applications
 * CRUD completo para aplicações, produtos, conteúdos, feed, comunidade, notificações e perfil admin
 */

import { createClient } from '../lib/supabase'
import type { Env } from '../index'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id, x-user-email',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
}

// Helper para resposta JSON
function jsonResponse(data: any, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
}

// Helper para extrair user_id do header
function getCurrentUserId(request: Request): string | null {
    return request.headers.get('x-user-id') || null
}

// Helper para extrair user_email do header
function getUserEmail(request: Request): string | null {
    return request.headers.get('x-user-email') || null
}

export async function handleApplications(
    request: Request,
    env: Env,
    ctx: ExecutionContext
): Promise<Response> {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
    const url = new URL(request.url)

    // Remove /api/applications prefix to get relative path
    const pathAfterFunction = url.pathname.replace(/^\/api\/applications\/?/, '')
    const pathSegments = pathAfterFunction ? pathAfterFunction.split('/').filter(Boolean) : []

    try {
        const userId = getCurrentUserId(request)
        const userEmail = getUserEmail(request)

        // ═══════════════════════════════════════════════════════════════════
        // PUBLIC ROUTES (no x-user-id required)
        // ═══════════════════════════════════════════════════════════════════

        // GET /applications/:id - Get application by ID (public)
        if (request.method === 'GET' && pathSegments.length === 1 && !['admin', 'community'].includes(pathSegments[0])) {
            const appId = pathSegments[0]

            const { data, error } = await supabase
                .from('applications')
                .select(`*, app_banners (*)`)
                .eq('id', appId)
                .single()

            if (error) throw error
            return jsonResponse(data)
        }

        // GET /applications/:id/products - List application products (public)
        if (request.method === 'GET' && pathSegments.length === 2 && pathSegments[1] === 'products') {
            const appId = pathSegments[0]

            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('application_id', appId)
                .order('order', { ascending: true })

            if (error) throw error
            return jsonResponse(data || [])
        }

        // GET /applications/:id/banners - Get application banners (public)
        if (request.method === 'GET' && pathSegments.length === 2 && pathSegments[1] === 'banners') {
            const appId = pathSegments[0]

            const { data, error } = await supabase
                .from('app_banners')
                .select('*')
                .eq('application_id', appId)
                .order('display_order', { ascending: true })

            if (error) throw error
            return jsonResponse(data || [])
        }

        // GET /applications/:appId/products-contents - Get ALL product contents for an app (batch - avoids N+1)
        if (request.method === 'GET' && pathSegments.length === 2 && pathSegments[1] === 'products-contents') {
            const appId = pathSegments[0]

            // First get all product IDs for this application
            const { data: products, error: productsError } = await supabase
                .from('products')
                .select('id')
                .eq('application_id', appId)

            if (productsError) throw productsError

            const productIds = products?.map(p => p.id) || []

            if (productIds.length === 0) {
                return jsonResponse({})
            }

            // Fetch all contents for all products in one query
            const { data: allContents, error: contentsError } = await supabase
                .from('product_content')
                .select('*')
                .in('product_id', productIds)
                .order('order', { ascending: true })

            if (contentsError) throw contentsError

            // Group contents by product_id
            const contentsByProduct: { [productId: string]: any[] } = {}
            for (const item of allContents || []) {
                const mappedItem = {
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
                }
                if (!contentsByProduct[item.product_id]) {
                    contentsByProduct[item.product_id] = []
                }
                contentsByProduct[item.product_id].push(mappedItem)
            }

            return jsonResponse(contentsByProduct)
        }

        // GET /applications/:appId/products/:productId/contents - Get product contents (public)
        if (request.method === 'GET' && pathSegments.length === 4 && pathSegments[1] === 'products' && pathSegments[3] === 'contents') {
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

            return jsonResponse(mappedData)
        }

        // ═══════════════════════════════════════════════════════════════════
        // ADMIN ROUTES (special paths)
        // ═══════════════════════════════════════════════════════════════════

        // GET /admin/profile/:userId - Get admin profile
        if (request.method === 'GET' && pathSegments.length === 3 && pathSegments[0] === 'admin' && pathSegments[1] === 'profile') {
            const profileUserId = pathSegments[2]

            const { data: profile, error } = await supabase
                .from('admin_profiles')
                .select('*')
                .eq('user_id', profileUserId)
                .single()

            if (error && error.code !== 'PGRST116') throw error

            // Se não existe perfil, criar um novo
            if (!profile) {
                const { data: newProfile, error: createError } = await supabase
                    .from('admin_profiles')
                    .insert({ user_id: profileUserId, full_name: '' })
                    .select()
                    .single()

                if (createError) throw createError
                return jsonResponse(newProfile)
            }

            return jsonResponse(profile)
        }

        // PUT /admin/profile/:userId - Update admin profile
        if (request.method === 'PUT' && pathSegments.length === 3 && pathSegments[0] === 'admin' && pathSegments[1] === 'profile') {
            const profileUserId = pathSegments[2]
            const body = await request.json() as any

            const { data: profile, error } = await supabase
                .from('admin_profiles')
                .update({
                    full_name: body.full_name,
                    avatar_path: body.avatar_path,
                    phone: body.phone,
                    bio: body.bio
                })
                .eq('user_id', profileUserId)
                .select()
                .single()

            if (error) throw error
            return jsonResponse(profile)
        }

        // POST /admin/change-password - Change admin password
        if (request.method === 'POST' && pathSegments.length === 2 && pathSegments[0] === 'admin' && pathSegments[1] === 'change-password') {
            const body = await request.json() as any
            const { userId: targetUserId, newPassword } = body

            if (!targetUserId || !newPassword) {
                return jsonResponse({ error: 'userId and newPassword are required' }, 400)
            }

            if (newPassword.length < 6) {
                return jsonResponse({ error: 'Password must be at least 6 characters' }, 400)
            }

            const { error } = await supabase.auth.admin.updateUserById(targetUserId, { password: newPassword })
            if (error) {
                return jsonResponse({ error: error.message }, 400)
            }

            return jsonResponse({ success: true, message: 'Password changed successfully' })
        }

        // GET /admin/password-history/:userId
        if (request.method === 'GET' && pathSegments.length === 3 && pathSegments[0] === 'admin' && pathSegments[1] === 'password-history') {
            return jsonResponse([])
        }

        // ═══════════════════════════════════════════════════════════════════
        // COMMUNITY ROUTES (public paths with community prefix)
        // ═══════════════════════════════════════════════════════════════════

        // DELETE /community/posts/:postId - Delete community post
        if (request.method === 'DELETE' && pathSegments.length === 3 && pathSegments[0] === 'community' && pathSegments[1] === 'posts') {
            const postId = pathSegments[2]

            const { error } = await supabase.from('community_posts').delete().eq('id', postId)
            if (error) throw error

            return jsonResponse({ success: true })
        }

        // POST /community/posts/:postId/like - Like a post
        if (request.method === 'POST' && pathSegments.length === 4 && pathSegments[0] === 'community' && pathSegments[1] === 'posts' && pathSegments[3] === 'like') {
            const postId = pathSegments[2]

            const { data, error } = await supabase.rpc('increment_post_likes', { post_id: postId })

            if (error) {
                // Fallback: increment manually
                const { data: post } = await supabase
                    .from('community_posts')
                    .select('likes_count')
                    .eq('id', postId)
                    .single()

                const newCount = (post?.likes_count || 0) + 1
                await supabase.from('community_posts').update({ likes_count: newCount }).eq('id', postId)

                return jsonResponse({ likes_count: newCount })
            }

            return jsonResponse({ success: true })
        }

        // GET /community/posts/:postId/comments - Get post comments
        if (request.method === 'GET' && pathSegments.length === 4 && pathSegments[0] === 'community' && pathSegments[1] === 'posts' && pathSegments[3] === 'comments') {
            const postId = pathSegments[2]

            const { data, error } = await supabase
                .from('community_comments')
                .select('*')
                .eq('post_id', postId)
                .order('created_at', { ascending: true })

            if (error) throw error
            return jsonResponse(data || [])
        }

        // POST /community/posts/:postId/comments - Add comment
        if (request.method === 'POST' && pathSegments.length === 4 && pathSegments[0] === 'community' && pathSegments[1] === 'posts' && pathSegments[3] === 'comments') {
            const postId = pathSegments[2]
            const body = await request.json() as any

            const { data, error } = await supabase
                .from('community_comments')
                .insert({
                    post_id: postId,
                    author_name: body.author_name,
                    author_avatar: body.author_avatar || null,
                    content: body.content
                })
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
            await supabase.from('community_posts').update({ comments_count: newCount }).eq('id', postId)

            return jsonResponse(data)
        }

        // DELETE /community/comments/:commentId - Delete comment
        if (request.method === 'DELETE' && pathSegments.length === 3 && pathSegments[0] === 'community' && pathSegments[1] === 'comments') {
            const commentId = pathSegments[2]

            // Get comment to find post_id
            const { data: comment } = await supabase
                .from('community_comments')
                .select('post_id')
                .eq('id', commentId)
                .single()

            const { error } = await supabase.from('community_comments').delete().eq('id', commentId)
            if (error) throw error

            // Decrement comments_count on post
            if (comment?.post_id) {
                const { data: post } = await supabase
                    .from('community_posts')
                    .select('comments_count')
                    .eq('id', comment.post_id)
                    .single()

                const newCount = Math.max((post?.comments_count || 1) - 1, 0)
                await supabase.from('community_posts').update({ comments_count: newCount }).eq('id', comment.post_id)
            }

            return jsonResponse({ success: true })
        }

        // ═══════════════════════════════════════════════════════════════════
        // AUTHENTICATED ROUTES (x-user-id required)
        // ═══════════════════════════════════════════════════════════════════

        if (!userId) {
            return jsonResponse({ error: 'Missing x-user-id header' }, 401)
        }

        // GET /applications - List user's applications
        if (request.method === 'GET' && pathSegments.length === 0) {
            const { data, error } = await supabase
                .from('applications')
                .select('*')
                .eq('owner_id', userId)

            if (error) throw error
            return jsonResponse(data || [])
        }

        // POST /applications - Create application
        if (request.method === 'POST' && pathSegments.length === 0) {
            const body = await request.json() as any

            // Accept both camelCase (from frontend) and snake_case
            const newApp = {
                owner_id: userId,
                name: body.name,
                slug: body.slug || body.name.toLowerCase().replace(/\s+/g, '-'),
                description: body.description || null,
                category: body.category || null,
                logo_url: body.logo_url || body.logoUrl || null,
                primary_color: body.primary_color || body.primaryColor || '#6366f1',
                secondary_color: body.secondary_color || body.secondaryColor || '#ec4899',
                show_names: body.show_names ?? body.showNames ?? false,
                highlight_community: body.highlight_community ?? body.highlightCommunity ?? false,
                free_registration: body.free_registration ?? body.freeRegistration ?? false,
                support_enabled: body.support_enabled ?? body.supportEnabled ?? (body.support_email || body.whatsapp_number ? true : false),
                support_email: body.support_email || body.supportEmail || null,
                whatsapp_number: body.whatsapp_number || body.whatsappNumber || null,
                support_icon_url: body.support_icon_url || body.supportIconUrl || null,
                app_type: body.app_type || body.appType || 'login-complete',
                language: body.language || 'pt-br',
                theme: body.theme || 'light',
                price: body.price || null,
                currency: body.currency || null,
                payment_type: body.payment_type || body.paymentType || null,
                recurrence_period: body.recurrence_period || body.recurrencePeriod || null,
                sales_page_url: body.sales_page_url || body.salesPageUrl || null,
                review_status: 'pending_review'
            }

            console.log('Creating application with data:', JSON.stringify(newApp))

            const { data, error } = await supabase.from('applications').insert(newApp).select().single()
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

            return jsonResponse(data, 201)
        }

        // PUT /applications/:id - Update application
        if (request.method === 'PUT' && pathSegments.length === 1) {
            const appId = pathSegments[0]
            const body = await request.json() as any

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
                theme: body.theme || 'light',
                payment_methods: body.payment_methods || ['credit_card'],
                default_payment_method: body.default_payment_method || 'credit_card'
            }

            const { data, error } = await supabase
                .from('applications')
                .update(updateData)
                .eq('id', appId)
                .eq('owner_id', userId)
                .select()
                .single()

            if (error) throw error

            // Update banners if provided
            if (body.banners && Array.isArray(body.banners)) {
                await supabase.from('app_banners').delete().eq('application_id', appId)

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

            return jsonResponse(data)
        }

        // PUT /applications/:id/submit-review - Submit app for review
        if (request.method === 'PUT' && pathSegments.length === 2 && pathSegments[1] === 'submit-review') {
            const appId = pathSegments[0]
            const { data: app, error: fetchError } = await supabase
                .from('applications')
                .select('id, review_status')
                .eq('id', appId)
                .eq('owner_id', userId)
                .single()
            if (fetchError || !app) return jsonResponse({ error: 'App not found' }, 404)
            if (app.review_status !== 'draft' && app.review_status !== 'rejected') {
                return jsonResponse({ error: 'App is not in draft or rejected status' }, 400)
            }
            const { error } = await supabase
                .from('applications')
                .update({ review_status: 'pending_review' })
                .eq('id', appId)
                .eq('owner_id', userId)
            if (error) throw error
            return jsonResponse({ success: true, message: 'App submitted for review' })
        }

        // DELETE /applications/:id - Delete application
        if (request.method === 'DELETE' && pathSegments.length === 1) {
            const appId = pathSegments[0]

            console.log('Deleting application:', appId, 'for user:', userId)

            // Delete related records that don't have CASCADE first
            await supabase.from('user_product_access').delete().eq('application_id', appId)
            await supabase.from('webhook_logs').delete().eq('application_id', appId)

            // Delete other related records (these have CASCADE but delete explicitly for safety)
            await supabase.from('app_banners').delete().eq('application_id', appId)
            await supabase.from('products').delete().eq('application_id', appId)
            await supabase.from('app_users').delete().eq('application_id', appId)
            await supabase.from('checkouts').delete().eq('application_id', appId)
            await supabase.from('checkout_urls').delete().eq('application_id', appId)
            await supabase.from('feed_posts').delete().eq('application_id', appId)
            await supabase.from('community_posts').delete().eq('application_id', appId)
            await supabase.from('push_notifications').delete().eq('application_id', appId)
            await supabase.from('user_notifications').delete().eq('application_id', appId)

            const { error } = await supabase
                .from('applications')
                .delete()
                .eq('id', appId)
                .eq('owner_id', userId)

            if (error) {
                console.error('Error deleting application:', error)
                throw error
            }
            return jsonResponse({ success: true })
        }

        // POST /applications/:id/products - Create product
        if (request.method === 'POST' && pathSegments.length === 2 && pathSegments[1] === 'products') {
            const appId = pathSegments[0]
            const body = await request.json() as any

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

            const { data, error } = await supabase.from('products').insert(newProduct).select().single()
            if (error) throw error

            return jsonResponse(data, 201)
        }

        // PUT /applications/:appId/products/:productId - Update product
        if (request.method === 'PUT' && pathSegments.length === 3 && pathSegments[1] === 'products') {
            const productId = pathSegments[2]
            const body = await request.json() as any

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
                .select()
                .single()

            if (error) throw error
            return jsonResponse(data)
        }

        // DELETE /applications/:appId/products/:productId - Delete product
        if (request.method === 'DELETE' && pathSegments.length === 3 && pathSegments[1] === 'products') {
            const productId = pathSegments[2]

            const { error } = await supabase.from('products').delete().eq('id', productId)
            if (error) throw error

            return jsonResponse({ success: true })
        }

        // POST /applications/:appId/products/:productId/contents - Create product content
        if (request.method === 'POST' && pathSegments.length === 4 && pathSegments[1] === 'products' && pathSegments[3] === 'contents') {
            const productId = pathSegments[2]
            const body = await request.json() as any

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

            return jsonResponse(mappedData)
        }

        // PUT /applications/:appId/products/:productId/contents/:contentId - Update product content
        if (request.method === 'PUT' && pathSegments.length === 5 && pathSegments[1] === 'products' && pathSegments[3] === 'contents') {
            const contentId = pathSegments[4]
            const body = await request.json() as any

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

            return jsonResponse(mappedData)
        }

        // DELETE /applications/:appId/products/:productId/contents/:contentId - Delete product content
        if (request.method === 'DELETE' && pathSegments.length === 5 && pathSegments[1] === 'products' && pathSegments[3] === 'contents') {
            const contentId = pathSegments[4]

            const { error } = await supabase.from('product_content').delete().eq('id', contentId)
            if (error) throw error

            return jsonResponse({ success: true })
        }

        // ═══════════════════════════════════════════════════════════════════
        // FEED ROUTES
        // ═══════════════════════════════════════════════════════════════════

        // GET /applications/:appId/feed/posts - Get feed posts
        if (request.method === 'GET' && pathSegments.length === 3 && pathSegments[1] === 'feed' && pathSegments[2] === 'posts') {
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

            return jsonResponse(data || [])
        }

        // POST /applications/:appId/feed/posts - Create feed post
        if (request.method === 'POST' && pathSegments.length === 3 && pathSegments[1] === 'feed' && pathSegments[2] === 'posts') {
            const appId = pathSegments[0]
            const body = await request.json() as any

            const now = new Date().toISOString()
            const scheduledFor = body.scheduled_for ? new Date(body.scheduled_for).toISOString() : null
            const isPending = scheduledFor && new Date(scheduledFor) > new Date()

            const newPost = {
                application_id: appId,
                content: body.content,
                image_url: body.image_url || null,
                scheduled_for: scheduledFor,
                status: isPending ? 'pending' : 'published',
                published_at: isPending ? null : now
            }

            const { data, error } = await supabase.from('feed_posts').insert(newPost).select().single()
            if (error) throw error

            return jsonResponse(data)
        }

        // PUT /applications/:appId/feed/posts/:postId - Update feed post
        if (request.method === 'PUT' && pathSegments.length === 4 && pathSegments[1] === 'feed' && pathSegments[2] === 'posts') {
            const appId = pathSegments[0]
            const postId = pathSegments[3]
            const body = await request.json() as any

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
            return jsonResponse(data)
        }

        // DELETE /applications/:appId/feed/posts/:postId - Delete feed post
        if (request.method === 'DELETE' && pathSegments.length === 4 && pathSegments[1] === 'feed' && pathSegments[2] === 'posts') {
            const appId = pathSegments[0]
            const postId = pathSegments[3]

            const { error } = await supabase
                .from('feed_posts')
                .delete()
                .eq('id', postId)
                .eq('application_id', appId)

            if (error) throw error
            return jsonResponse({ success: true })
        }

        // ═══════════════════════════════════════════════════════════════════
        // COMMUNITY ROUTES (app-specific)
        // ═══════════════════════════════════════════════════════════════════

        // GET /applications/:appId/community/posts - Get community posts
        if (request.method === 'GET' && pathSegments.length === 3 && pathSegments[1] === 'community' && pathSegments[2] === 'posts') {
            const appId = pathSegments[0]

            const { data, error } = await supabase
                .from('community_posts')
                .select('*')
                .eq('application_id', appId)
                .order('created_at', { ascending: false })

            if (error) throw error
            return jsonResponse(data || [])
        }

        // POST /applications/:appId/community/posts - Create community post
        if (request.method === 'POST' && pathSegments.length === 3 && pathSegments[1] === 'community' && pathSegments[2] === 'posts') {
            const appId = pathSegments[0]
            const body = await request.json() as any

            const newPost = {
                application_id: appId,
                author_name: body.author_name,
                author_avatar: body.author_avatar || null,
                content: body.content,
                image_url: body.image_url || null,
                is_pinned: false,
                likes_count: 0
            }

            const { data, error } = await supabase.from('community_posts').insert(newPost).select().single()
            if (error) throw error

            return jsonResponse(data)
        }

        // ═══════════════════════════════════════════════════════════════════
        // USER PROFILE ROUTES
        // ═══════════════════════════════════════════════════════════════════

        // GET /applications/:appId/user/profile - Get user profile
        if (request.method === 'GET' && pathSegments.length === 3 && pathSegments[1] === 'user' && pathSegments[2] === 'profile') {
            const appId = pathSegments[0]

            if (!userEmail) {
                return jsonResponse({ error: 'User email required' }, 400)
            }

            const { data, error } = await supabase
                .from('app_users')
                .select('*')
                .eq('application_id', appId)
                .eq('email', userEmail)
                .single()

            if (error) {
                return jsonResponse({ error: 'User not found' }, 404)
            }

            return jsonResponse(data)
        }

        // PUT /applications/:appId/user/profile - Update user profile
        if (request.method === 'PUT' && pathSegments.length === 3 && pathSegments[1] === 'user' && pathSegments[2] === 'profile') {
            const appId = pathSegments[0]
            const body = await request.json() as any

            if (!userEmail) {
                return jsonResponse({ error: 'User email required' }, 400)
            }

            // Check if user exists
            const { data: existingUser } = await supabase
                .from('app_users')
                .select('*')
                .eq('application_id', appId)
                .eq('email', userEmail)
                .single()

            if (existingUser) {
                // Update existing user
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
                    return jsonResponse({ error: error.message }, 400)
                }

                return jsonResponse(data)
            } else {
                // Create new user
                const newUser = {
                    application_id: appId,
                    email: userEmail,
                    full_name: body.full_name || null,
                    avatar_url: body.avatar_url || null,
                    user_id: `user_${Date.now()}`
                }

                const { data, error } = await supabase.from('app_users').insert(newUser).select().single()

                if (error) {
                    return jsonResponse({ error: error.message }, 400)
                }

                return jsonResponse(data)
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // NOTIFICATIONS ROUTES
        // ═══════════════════════════════════════════════════════════════════

        // GET /applications/:appId/notifications - Get user notifications OR admin history
        if (request.method === 'GET' && pathSegments.length === 2 && pathSegments[1] === 'notifications') {
            const appId = pathSegments[0]
            const isAdmin = url.searchParams.get('admin') === 'true'

            if (isAdmin) {
                const { data: history, error } = await supabase
                    .from('push_notifications')
                    .select('*')
                    .eq('application_id', appId)
                    .order('sent_at', { ascending: false })
                    .limit(100)

                if (error) throw error
                return jsonResponse(history || [])
            }

            if (!userEmail) {
                return jsonResponse({ error: 'User email required' }, 400)
            }

            // Get user
            const { data: user } = await supabase
                .from('app_users')
                .select('id')
                .eq('application_id', appId)
                .eq('email', userEmail)
                .single()

            if (!user) {
                return jsonResponse([])
            }

            const { data: notifications, error } = await supabase
                .from('user_notifications')
                .select('*')
                .eq('application_id', appId)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(50)

            if (error) throw error
            return jsonResponse(notifications || [])
        }

        // POST /applications/:appId/notifications - Send push notification to all users
        if (request.method === 'POST' && pathSegments.length === 2 && pathSegments[1] === 'notifications') {
            const appId = pathSegments[0]
            const body = await request.json() as any

            if (!body.title || !body.message) {
                return jsonResponse({ error: 'Title and message are required' }, 400)
            }

            // Get all users
            const { data: users, error: usersError } = await supabase
                .from('app_users')
                .select('id, email, full_name')
                .eq('application_id', appId)

            if (usersError) throw usersError

            // Create individual notifications
            if (users && users.length > 0) {
                const notificationsToInsert = users.map(user => ({
                    application_id: appId,
                    user_id: user.id,
                    title: body.title,
                    message: body.message,
                    redirect_url: body.redirect_url || null,
                    read: false
                }))

                await supabase.from('user_notifications').insert(notificationsToInsert)
            }

            // Save to history
            const { data: historyRecord } = await supabase
                .from('push_notifications')
                .insert({
                    application_id: appId,
                    title: body.title,
                    message: body.message
                })
                .select()
                .single()

            return jsonResponse({
                success: true,
                recipients_count: users?.length || 0,
                notification: historyRecord
            })
        }

        // PUT /applications/:appId/notifications/mark-read - Mark all notifications as read
        if (request.method === 'PUT' && pathSegments.length === 3 && pathSegments[1] === 'notifications' && pathSegments[2] === 'mark-read') {
            const appId = pathSegments[0]

            if (!userEmail) {
                return jsonResponse({ error: 'User email required' }, 400)
            }

            // Get user
            const { data: user } = await supabase
                .from('app_users')
                .select('id')
                .eq('application_id', appId)
                .eq('email', userEmail)
                .single()

            if (!user) {
                return jsonResponse({ error: 'User not found' }, 404)
            }

            const { error } = await supabase
                .from('user_notifications')
                .update({ read: true })
                .eq('application_id', appId)
                .eq('user_id', user.id)
                .eq('read', false)

            if (error) throw error
            return jsonResponse({ success: true })
        }

        // ═══════════════════════════════════════════════════════════════════
        // 404 NOT FOUND
        // ═══════════════════════════════════════════════════════════════════

        return jsonResponse({ error: 'Not Found', path: url.pathname }, 404)

    } catch (error: any) {
        console.error('Applications handler error:', error)
        return jsonResponse({
            error: error.message || 'Internal server error',
            timestamp: new Date().toISOString()
        }, 500)
    }
}
