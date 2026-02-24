// @ts-nocheck
import { createClient } from '../lib/supabase'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

const SUPER_ADMINS = [
    'admin@exemplo.com',
    'teste@exemplo.com',
    'gabrielvettorazzii@gmail.com',
]

async function isSuperAdmin(supabase: any, userId: string): Promise<boolean> {
    try {
        const { data: user, error } = await supabase.auth.admin.getUserById(userId)
        if (error || !user) return false
        return SUPER_ADMINS.includes(user.user.email || '')
    } catch (error) {
        console.error('Error checking super admin:', error)
        return false
    }
}

export async function handleSuperadmin(request: Request, env: any, pathSegments: string[]): Promise<Response> {
    if (request.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
        const url = new URL(request.url)
        const userId = request.headers.get('x-user-id')

        if (!userId) {
            return new Response(JSON.stringify({ error: 'User ID é obrigatório' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const isAdmin = await isSuperAdmin(supabase, userId)
        if (!isAdmin) {
            return new Response(JSON.stringify({ error: 'Acesso negado - Super Admin necessário' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // GET /api/superadmin/stats
        if (request.method === 'GET' && pathSegments.length === 1 && pathSegments[0] === 'stats') {
            const [applicationsResult, domainsResult, productsResult, clientsResult] = await Promise.all([
                supabase.from('applications').select('id, created_at, name, owner_id', { count: 'exact' }),
                supabase.from('app_domains').select('id, domain, status', { count: 'exact' }),
                supabase.from('products').select('id', { count: 'exact' }),
                supabase.from('app_users').select('id', { count: 'exact' })
            ])

            const uniqueOwners = new Set(applicationsResult.data?.map((app: any) => app.owner_id) || [])
            const totalUsers = uniqueOwners.size

            const { data: allApps } = await supabase.from('applications').select('owner_id')
            const userAppCounts: Record<string, number> = {}
            allApps?.forEach((app: any) => {
                userAppCounts[app.owner_id] = (userAppCounts[app.owner_id] || 0) + 1
            })

            const topUsers = Object.entries(userAppCounts)
                .map(([owner_id, count]) => ({ owner_id, count }))
                .sort((a, b) => (b.count as number) - (a.count as number))
                .slice(0, 10)

            const topUsersWithEmails = await Promise.all(
                topUsers.map(async (user) => {
                    try {
                        const { data: authUser } = await supabase.auth.admin.getUserById(user.owner_id)
                        return { owner_id: user.owner_id, email: authUser?.user?.email || 'Usuário desconhecido', count: user.count }
                    } catch {
                        return { owner_id: user.owner_id, email: 'Erro ao carregar', count: user.count }
                    }
                })
            )

            const sixMonthsAgo = new Date()
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
            const { data: monthlyApps } = await supabase.from('applications').select('created_at').gte('created_at', sixMonthsAgo.toISOString())

            const monthlyStats: Record<string, number> = {}
            monthlyApps?.forEach((app: any) => {
                const month = new Date(app.created_at).toISOString().substring(0, 7)
                monthlyStats[month] = (monthlyStats[month] || 0) + 1
            })

            const { data: allDomains } = await supabase.from('app_domains').select('status')
            const statusCounts: Record<string, number> = {}
            allDomains?.forEach((domain: any) => {
                statusCounts[domain.status] = (statusCounts[domain.status] || 0) + 1
            })
            const domainsByStatus = Object.entries(statusCounts).map(([status, count]) => ({ status, count }))

            const stats = {
                overview: {
                    totalUsers,
                    totalApplications: applicationsResult.count || 0,
                    totalDomains: domainsResult.count || 0,
                    totalProducts: productsResult.count || 0,
                    totalClients: clientsResult.count || 0
                },
                charts: { monthlyApps: monthlyStats, domainsByStatus, topUsers: topUsersWithEmails },
                recent: {
                    applications: applicationsResult.data?.slice(0, 10) || [],
                    domains: domainsResult.data?.slice(0, 10) || []
                }
            }

            return new Response(JSON.stringify(stats), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // GET /api/superadmin/users
        if (request.method === 'GET' && pathSegments.length === 1 && pathSegments[0] === 'users') {
            const page = parseInt(url.searchParams.get('page') || '1')
            const limit = parseInt(url.searchParams.get('limit') || '20')
            const offset = (page - 1) * limit
            const searchQuery = url.searchParams.get('search') || ''
            const planFilter = url.searchParams.get('plan') || ''

            const { data: allUserApps } = await supabase.from('applications').select('owner_id, created_at')
            const userStats: Record<string, any> = {}
            allUserApps?.forEach((app: any) => {
                const ownerId = app.owner_id
                if (!userStats[ownerId]) {
                    userStats[ownerId] = { owner_id: ownerId, app_count: 0, last_activity: app.created_at }
                }
                userStats[ownerId].app_count += 1
                if (new Date(app.created_at) > new Date(userStats[ownerId].last_activity)) {
                    userStats[ownerId].last_activity = app.created_at
                }
            })

            const users = Object.values(userStats).sort((a: any, b: any) => b.app_count - a.app_count).slice(offset, offset + limit)

            const usersWithDetails = await Promise.all(
                users.map(async (user: any) => {
                    try {
                        const { data: authUser } = await supabase.auth.admin.getUserById(user.owner_id)
                        const { data: profile } = await supabase.from('admin_profiles').select('name').eq('user_id', user.owner_id).single()
                        let plan = 'free'
                        if (user.app_count >= 5) plan = 'advanced'
                        else if (user.app_count >= 2) plan = 'pro'

                        return {
                            id: user.owner_id, name: profile?.name || authUser?.user?.email || 'N/A', email: authUser?.user?.email || 'N/A',
                            created_at: authUser?.user?.created_at || null, app_count: user.app_count, last_activity: user.last_activity, plan
                        }
                    } catch {
                        return { id: user.owner_id, name: 'Erro ao carregar', email: 'Erro ao carregar', created_at: null, app_count: user.app_count, last_activity: user.last_activity, plan: 'free' }
                    }
                })
            )

            let filteredUsers = usersWithDetails
            if (searchQuery) filteredUsers = filteredUsers.filter(u => u.email.toLowerCase().includes(searchQuery.toLowerCase()) || u.name.toLowerCase().includes(searchQuery.toLowerCase()))
            if (planFilter && planFilter !== 'all') filteredUsers = filteredUsers.filter(u => u.plan === planFilter)

            return new Response(JSON.stringify({ users: filteredUsers, pagination: { page, limit, hasMore: users.length === limit }, filters: { search: searchQuery, plan: planFilter } }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // GET /api/superadmin/applications
        if (request.method === 'GET' && pathSegments.length === 1 && pathSegments[0] === 'applications') {
            const page = parseInt(url.searchParams.get('page') || '1')
            const limit = parseInt(url.searchParams.get('limit') || '20')
            const offset = (page - 1) * limit
            const userIdFilter = url.searchParams.get('user_id')

            let query = supabase.from('applications').select('id, name, slug, created_at, owner_id, app_type, language').order('created_at', { ascending: false })
            if (userIdFilter) query = query.eq('owner_id', userIdFilter)
            else query = query.range(offset, offset + limit - 1)

            const { data: applications, error } = await query
            if (error) throw error

            const appsWithOwners = await Promise.all(
                applications.map(async (app: any) => {
                    try {
                        const { data: authUser } = await supabase.auth.admin.getUserById(app.owner_id)
                        return { ...app, owner_email: authUser?.user?.email || 'N/A' }
                    } catch { return { ...app, owner_email: 'Erro ao carregar' } }
                })
            )

            return new Response(JSON.stringify({ applications: appsWithOwners, pagination: { page, limit, hasMore: applications.length === limit } }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // GET /api/superadmin/domains
        if (request.method === 'GET' && pathSegments.length === 1 && pathSegments[0] === 'domains') {
            const { data: domains, error } = await supabase.from('app_domains').select('id, domain, status, created_at, verified_at, applications (name, owner_id)').order('created_at', { ascending: false }).limit(100)
            if (error) throw error
            return new Response(JSON.stringify(domains), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // GET /api/superadmin/user-details/:userId
        if (request.method === 'GET' && pathSegments.length === 2 && pathSegments[0] === 'user-details') {
            const targetUserId = pathSegments[1]
            const { data: userApps } = await supabase.from('applications').select('id, name, slug, app_type, review_status, created_at').eq('owner_id', targetUserId)
            const appIds = userApps?.map((app: any) => app.id) || []
            let totalClients = 0
            if (appIds.length > 0) {
                const { count } = await supabase.from('app_users').select('id', { count: 'exact', head: true }).in('application_id', appIds)
                totalClients = count || 0
            }
            const { data: userDomains } = await supabase.from('app_domains').select('id, domain, status, created_at').in('application_id', appIds)
            const { data: userProducts } = await supabase.from('marketplace_products').select('id, name, review_status, delivery_type, created_at').eq('owner_id', targetUserId)
            const productsApproved = userProducts?.filter((p: any) => p.review_status === 'approved').length || 0
            const productsRejected = userProducts?.filter((p: any) => p.review_status === 'rejected').length || 0
            const productsPending = userProducts?.filter((p: any) => p.review_status === 'pending_review').length || 0
            const appsWithMemberArea = userProducts?.filter((p: any) => p.delivery_type === 'member_area').length || 0

            return new Response(JSON.stringify({
                apps: userApps || [], totalClients, domains: userDomains || [], plan: 'Free',
                products: { total: userProducts?.length || 0, approved: productsApproved, rejected: productsRejected, pending: productsPending, memberAreaApps: appsWithMemberArea }
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // DELETE /api/superadmin/user/:userId
        if (request.method === 'DELETE' && pathSegments.length === 2 && pathSegments[0] === 'user') {
            const targetUserId = pathSegments[1]
            const { error } = await supabase.auth.admin.deleteUser(targetUserId)
            if (error) throw error
            return new Response(JSON.stringify({ success: true, message: 'Usuário deletado com sucesso' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // PUT /api/superadmin/user/:userId/ban
        if (request.method === 'PUT' && pathSegments.length === 3 && pathSegments[0] === 'user' && pathSegments[2] === 'ban') {
            const targetUserId = pathSegments[1]
            const body = await request.json()
            const { ban } = body
            const { error } = await supabase.auth.admin.updateUserById(targetUserId, { ban_duration: ban ? '876000h' : 'none' })
            if (error) throw error
            return new Response(JSON.stringify({ success: true, message: ban ? 'Usuário desativado com sucesso' : 'Usuário reativado com sucesso' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // GET /api/superadmin/bank-verifications
        if (request.method === 'GET' && pathSegments.length === 1 && pathSegments[0] === 'bank-verifications') {
            const { data: verifications, error } = await supabase.from('payment_settings').select('*').eq('verification_status', 'pending').not('bank_name', 'is', null).order('submitted_at', { ascending: false })
            if (error) throw error
            const verificationsWithEmail = await Promise.all(
                (verifications || []).map(async (v: any) => {
                    const { data: userData } = await supabase.auth.admin.getUserById(v.user_id)
                    return { ...v, user_email: userData?.user?.email || 'Unknown' }
                })
            )
            return new Response(JSON.stringify({ verifications: verificationsWithEmail, total: verificationsWithEmail.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // PUT /api/superadmin/bank-verifications/:id/approve
        if (request.method === 'PUT' && pathSegments.length === 3 && pathSegments[0] === 'bank-verifications' && pathSegments[2] === 'approve') {
            const verificationId = pathSegments[1]
            const { data: paymentSettings, error: fetchError } = await supabase.from('payment_settings').select('user_id').eq('id', verificationId).single()
            if (fetchError || !paymentSettings) return new Response(JSON.stringify({ error: 'Verification not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            const { error: updateError } = await supabase.from('payment_settings').update({ verification_status: 'approved', is_verified: true, approved_by: userId, approved_at: new Date().toISOString(), rejection_reason: null }).eq('id', verificationId)
            if (updateError) throw updateError
            await supabase.from('user_notifications').insert({ user_id: paymentSettings.user_id, title: 'Bank Account Approved', message: 'Your bank account has been verified and approved. You can now receive payouts.', type: 'success', read: false, created_at: new Date().toISOString() })
            return new Response(JSON.stringify({ success: true, message: 'Bank account approved successfully' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // PUT /api/superadmin/bank-verifications/:id/reject
        if (request.method === 'PUT' && pathSegments.length === 3 && pathSegments[0] === 'bank-verifications' && pathSegments[2] === 'reject') {
            const verificationId = pathSegments[1]
            const body = await request.json()
            const rejectionReason = body.reason || 'Your bank account verification was rejected. Please review the information and resubmit.'
            const { data: paymentSettings, error: fetchError } = await supabase.from('payment_settings').select('user_id').eq('id', verificationId).single()
            if (fetchError || !paymentSettings) return new Response(JSON.stringify({ error: 'Verification not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            const { error: updateError } = await supabase.from('payment_settings').update({ verification_status: 'rejected', is_verified: false, rejection_reason: rejectionReason, approved_by: null, approved_at: null }).eq('id', verificationId)
            if (updateError) throw updateError
            await supabase.from('user_notifications').insert({ user_id: paymentSettings.user_id, title: 'Bank Account Verification Rejected', message: `Your bank account verification was rejected. Reason: ${rejectionReason}`, type: 'error', read: false, created_at: new Date().toISOString() })
            return new Response(JSON.stringify({ success: true, message: 'Bank account rejected' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // GET /api/superadmin/product-details/:productId
        if (request.method === 'GET' && pathSegments.length === 2 && pathSegments[0] === 'product-details') {
            const productId = pathSegments[1]
            const { data: product, error: productError } = await supabase.from('marketplace_products').select('*').eq('id', productId).single()
            if (productError || !product) return new Response(JSON.stringify({ error: 'Product not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            let ownerEmail = 'Unknown'
            try { const { data: authUser } = await supabase.auth.admin.getUserById(product.owner_id); ownerEmail = authUser?.user?.email || 'Unknown' } catch { }
            const { data: modules } = await supabase.from('community_modules').select('*').eq('member_area_id', productId).order('order_position', { ascending: true })
            const moduleIds = modules?.map((m: any) => m.id) || []
            let lessons: any[] = []
            if (moduleIds.length > 0) {
                const { data: lessonsData } = await supabase.from('community_lessons').select('*').in('module_id', moduleIds).order('order_position', { ascending: true })
                lessons = lessonsData || []
            }
            const modulesWithLessons = (modules || []).map((module: any) => ({ ...module, lessons: lessons.filter(l => l.module_id === module.id) }))
            const { count: memberCount } = await supabase.from('product_members').select('id', { count: 'exact', head: true }).eq('member_area_id', productId)
            return new Response(JSON.stringify({ product: { ...product, owner_email: ownerEmail }, modules: modulesWithLessons, stats: { totalModules: modules?.length || 0, totalLessons: lessons.length, totalMembers: memberCount || 0 } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // GET /api/superadmin/pending-products
        if (request.method === 'GET' && pathSegments.length === 1 && pathSegments[0] === 'pending-products') {
            const { data: products, error } = await supabase.from('marketplace_products').select('id, name, description, price, currency, category, delivery_type, image_url, owner_id, created_at, review_status').eq('review_status', 'pending_review').order('created_at', { ascending: false })
            if (error) throw error
            const enrichedProducts = await Promise.all((products || []).map(async (product: any) => { try { const { data: authUser } = await supabase.auth.admin.getUserById(product.owner_id); return { ...product, owner_email: authUser?.user?.email || 'Unknown' } } catch { return { ...product, owner_email: 'Unknown' } } }))
            return new Response(JSON.stringify({ products: enrichedProducts }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // PUT /api/superadmin/products/:id/approve
        if (request.method === 'PUT' && pathSegments.length === 3 && pathSegments[0] === 'products' && pathSegments[2] === 'approve') {
            const productId = pathSegments[1]
            const { data: product, error: fetchError } = await supabase.from('marketplace_products').select('name, owner_id').eq('id', productId).single()
            if (fetchError || !product) return new Response(JSON.stringify({ error: 'Product not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            const { error: updateError } = await supabase.from('marketplace_products').update({ review_status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: userId }).eq('id', productId)
            if (updateError) throw updateError
            if (product.owner_id) await supabase.from('user_notifications').insert({ user_id: product.owner_id, title: 'Product Approved', message: `Your product "${product.name}" has been approved and is now live on the marketplace.`, type: 'success', read: false, created_at: new Date().toISOString() })
            return new Response(JSON.stringify({ success: true, message: 'Product approved successfully' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // PUT /api/superadmin/products/:id/reject
        if (request.method === 'PUT' && pathSegments.length === 3 && pathSegments[0] === 'products' && pathSegments[2] === 'reject') {
            const productId = pathSegments[1]
            const body = await request.json()
            const rejectionReason = body.reason || 'Your product was rejected. Please review and resubmit.'
            const { data: product, error: fetchError } = await supabase.from('marketplace_products').select('name, owner_id').eq('id', productId).single()
            if (fetchError || !product) return new Response(JSON.stringify({ error: 'Product not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            const { error: updateError } = await supabase.from('marketplace_products').update({ review_status: 'rejected', review_notes: rejectionReason, reviewed_at: new Date().toISOString(), reviewed_by: userId }).eq('id', productId)
            if (updateError) throw updateError
            if (product.owner_id) await supabase.from('user_notifications').insert({ user_id: product.owner_id, title: 'Product Rejected', message: `Your product "${product.name}" was rejected. Reason: ${rejectionReason}`, type: 'error', read: false, created_at: new Date().toISOString() })
            return new Response(JSON.stringify({ success: true, message: 'Product rejected' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // GET /api/superadmin/pending-apps
        if (request.method === 'GET' && pathSegments.length === 1 && pathSegments[0] === 'pending-apps') {
            const { data: apps, error } = await supabase.from('applications').select('id, name, slug, logo_url, app_type, language, owner_id, created_at, review_status').eq('review_status', 'pending_review').order('created_at', { ascending: false })
            if (error) throw error
            const enrichedApps = await Promise.all((apps || []).map(async (app: any) => { try { const { data: authUser } = await supabase.auth.admin.getUserById(app.owner_id); return { ...app, owner_email: authUser?.user?.email || 'Unknown' } } catch { return { ...app, owner_email: 'Unknown' } } }))
            return new Response(JSON.stringify({ apps: enrichedApps }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // PUT /api/superadmin/apps/:id/approve
        if (request.method === 'PUT' && pathSegments.length === 3 && pathSegments[0] === 'apps' && pathSegments[2] === 'approve') {
            const appId = pathSegments[1]
            const { data: app, error: fetchError } = await supabase.from('applications').select('name, owner_id').eq('id', appId).single()
            if (fetchError || !app) return new Response(JSON.stringify({ error: 'App not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            const { error: updateError } = await supabase.from('applications').update({ review_status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: userId }).eq('id', appId)
            if (updateError) throw updateError
            if (app.owner_id) await supabase.from('user_notifications').insert({ user_id: app.owner_id, title: 'App Approved', message: `Your app "${app.name}" has been approved and is now live.`, type: 'success', read: false, created_at: new Date().toISOString() })
            return new Response(JSON.stringify({ success: true, message: 'App approved successfully' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // PUT /api/superadmin/apps/:id/reject
        if (request.method === 'PUT' && pathSegments.length === 3 && pathSegments[0] === 'apps' && pathSegments[2] === 'reject') {
            const appId = pathSegments[1]
            const body = await request.json()
            const rejectionReason = body.reason || 'Your app was rejected. Please review and resubmit.'
            const { data: app, error: fetchError } = await supabase.from('applications').select('name, owner_id').eq('id', appId).single()
            if (fetchError || !app) return new Response(JSON.stringify({ error: 'App not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            const { error: updateError } = await supabase.from('applications').update({ review_status: 'rejected', review_notes: rejectionReason, reviewed_at: new Date().toISOString(), reviewed_by: userId }).eq('id', appId)
            if (updateError) throw updateError
            if (app.owner_id) await supabase.from('user_notifications').insert({ user_id: app.owner_id, title: 'App Rejected', message: `Your app "${app.name}" was rejected. Reason: ${rejectionReason}`, type: 'error', read: false, created_at: new Date().toISOString() })
            return new Response(JSON.stringify({ success: true, message: 'App rejected' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        return new Response(JSON.stringify({ error: 'Endpoint não encontrado' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error: any) {
        console.error('SuperAdmin function error:', error)
        return new Response(JSON.stringify({
            error: error.message,
            timestamp: new Date().toISOString()
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
}
