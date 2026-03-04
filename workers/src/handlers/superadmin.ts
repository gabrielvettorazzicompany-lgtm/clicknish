// @ts-nocheck
import { createClient } from '../lib/supabase'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

const SUPER_ADMINS = [
    'admin@clicknich.com',
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

async function logAudit(
    supabase: any,
    adminId: string,
    adminEmail: string,
    action: string,
    targetType: string,
    targetId: string,
    details: Record<string, any> = {}
) {
    try {
        await supabase.from('admin_audit_log').insert({
            admin_id: adminId,
            admin_email: adminEmail,
            action,
            target_type: targetType,
            target_id: targetId,
            details,
            created_at: new Date().toISOString()
        })
    } catch (e) {
        console.error('Audit log error:', e)
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
            const { data: userProducts } = await supabase.from('member_areas').select('id, name, review_status, delivery_type, created_at').eq('owner_id', targetUserId)
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
            const { data: targetData } = await supabase.auth.admin.getUserById(targetUserId)
            const { data: adminData } = await supabase.auth.admin.getUserById(userId)
            const { error } = await supabase.auth.admin.deleteUser(targetUserId)
            if (error) throw error
            await logAudit(supabase, userId, adminData?.user?.email || '', 'delete_user', 'user', targetUserId, { deleted_email: targetData?.user?.email || 'unknown' })
            return new Response(JSON.stringify({ success: true, message: 'Usuário deletado com sucesso' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // PUT /api/superadmin/user/:userId/ban
        if (request.method === 'PUT' && pathSegments.length === 3 && pathSegments[0] === 'user' && pathSegments[2] === 'ban') {
            const targetUserId = pathSegments[1]
            const body = await request.json()
            const { ban } = body
            const { data: adminData } = await supabase.auth.admin.getUserById(userId)
            const { data: targetData } = await supabase.auth.admin.getUserById(targetUserId)
            const { error } = await supabase.auth.admin.updateUserById(targetUserId, { ban_duration: ban ? '876000h' : 'none' })
            if (error) throw error
            await logAudit(supabase, userId, adminData?.user?.email || '', ban ? 'ban_user' : 'unban_user', 'user', targetUserId, { target_email: targetData?.user?.email || 'unknown' })
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
            const { data: product, error: productError } = await supabase.from('member_areas').select('*').eq('id', productId).single()
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
            const { data: products, error } = await supabase.from('member_areas').select('id, name, description, price, currency, category, delivery_type, image_url, owner_id, created_at, review_status').eq('review_status', 'pending_review').order('created_at', { ascending: false })
            if (error) throw error
            const enrichedProducts = await Promise.all((products || []).map(async (product: any) => { try { const { data: authUser } = await supabase.auth.admin.getUserById(product.owner_id); return { ...product, owner_email: authUser?.user?.email || 'Unknown' } } catch { return { ...product, owner_email: 'Unknown' } } }))
            return new Response(JSON.stringify({ products: enrichedProducts }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // PUT /api/superadmin/products/:id/approve
        if (request.method === 'PUT' && pathSegments.length === 3 && pathSegments[0] === 'products' && pathSegments[2] === 'approve') {
            const productId = pathSegments[1]
            const { data: product, error: fetchError } = await supabase.from('member_areas').select('name, owner_id').eq('id', productId).single()
            if (fetchError || !product) return new Response(JSON.stringify({ error: 'Product not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            const { error: updateError } = await supabase.from('member_areas').update({ review_status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: userId }).eq('id', productId)
            if (updateError) throw updateError
            try { if (product.owner_id) await supabase.from('user_notifications').insert({ user_id: product.owner_id, title: 'Product Approved', message: `Your product "${product.name}" has been approved and is now live on the marketplace.`, type: 'success', read: false, created_at: new Date().toISOString() }) } catch { }
            return new Response(JSON.stringify({ success: true, message: 'Product approved successfully' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // PUT /api/superadmin/products/:id/reject
        if (request.method === 'PUT' && pathSegments.length === 3 && pathSegments[0] === 'products' && pathSegments[2] === 'reject') {
            const productId = pathSegments[1]
            const body = await request.json()
            const rejectionReason = body.reason || 'Your product was rejected. Please review and resubmit.'
            const { data: product, error: fetchError } = await supabase.from('member_areas').select('name, owner_id').eq('id', productId).single()
            if (fetchError || !product) return new Response(JSON.stringify({ error: 'Product not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            const { error: updateError } = await supabase.from('member_areas').update({ review_status: 'rejected', review_notes: rejectionReason, reviewed_at: new Date().toISOString(), reviewed_by: userId }).eq('id', productId)
            if (updateError) throw updateError
            try { if (product.owner_id) await supabase.from('user_notifications').insert({ user_id: product.owner_id, title: 'Product Rejected', message: `Your product "${product.name}" was rejected. Reason: ${rejectionReason}`, type: 'error', read: false, created_at: new Date().toISOString() }) } catch { }
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
            try { if (app.owner_id) await supabase.from('user_notifications').insert({ user_id: app.owner_id, title: 'App Approved', message: `Your app "${app.name}" has been approved and is now live.`, type: 'success', read: false, created_at: new Date().toISOString() }) } catch { }
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
            try { if (app.owner_id) await supabase.from('user_notifications').insert({ user_id: app.owner_id, title: 'App Rejected', message: `Your app "${app.name}" was rejected. Reason: ${rejectionReason}`, type: 'error', read: false, created_at: new Date().toISOString() }) } catch { }
            return new Response(JSON.stringify({ success: true, message: 'App rejected' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // ─── PLATFORM CONFIG ────────────────────────────────────────────────

        // GET /api/superadmin/platform-config
        if (request.method === 'GET' && pathSegments.length === 1 && pathSegments[0] === 'platform-config') {
            const { data, error } = await supabase.from('platform_config').select('*').order('key')
            if (error) throw error
            const config: Record<string, any> = {}
            data?.forEach((row: any) => { config[row.key] = { value: row.value, description: row.description, updated_at: row.updated_at } })
            return new Response(JSON.stringify(config), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // PUT /api/superadmin/platform-config
        if (request.method === 'PUT' && pathSegments.length === 1 && pathSegments[0] === 'platform-config') {
            const body = await request.json()
            const { key, value } = body
            if (!key) return new Response(JSON.stringify({ error: 'key é obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            const { data: adminData } = await supabase.auth.admin.getUserById(userId)
            const adminEmail = adminData?.user?.email || ''
            const { error } = await supabase.from('platform_config').upsert({ key, value, updated_by: userId, updated_at: new Date().toISOString() }, { onConflict: 'key' })
            if (error) throw error
            await logAudit(supabase, userId, adminEmail, 'update_platform_config', 'config', key, { key, old_value: null, new_value: value })
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // ─── PAYMENT CONFIG ─────────────────────────────────────────────────────

        // GET /api/superadmin/payment-configs  — lista todos os usuários com override
        if (request.method === 'GET' && pathSegments.length === 1 && pathSegments[0] === 'payment-configs') {
            const { data: configs, error } = await supabase.from('user_payment_config').select('*').order('updated_at', { ascending: false })
            if (error) throw error
            const enriched = await Promise.all((configs || []).map(async (cfg: any) => {
                try {
                    const { data: authUser } = await supabase.auth.admin.getUserById(cfg.user_id)
                    return { ...cfg, user_email: authUser?.user?.email || 'Unknown' }
                } catch { return { ...cfg, user_email: 'Unknown' } }
            }))
            return new Response(JSON.stringify({ configs: enriched }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // GET /api/superadmin/payment-config/:userId
        if (request.method === 'GET' && pathSegments.length === 2 && pathSegments[0] === 'payment-config') {
            const targetUserId = pathSegments[1]
            const { data: cfg } = await supabase.from('user_payment_config').select('*').eq('user_id', targetUserId).single()
            const { data: globalCfg } = await supabase.from('platform_config').select('value').eq('key', 'default_payment_provider').single()
            return new Response(JSON.stringify({ config: cfg || null, global_provider: globalCfg?.value || 'stripe' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // PUT /api/superadmin/payment-config/:userId
        if (request.method === 'PUT' && pathSegments.length === 2 && pathSegments[0] === 'payment-config') {
            const targetUserId = pathSegments[1]
            const body = await request.json()
            const { payment_provider, mollie_api_key, stripe_connect_account, override_platform_default, notes } = body
            const { data: adminData } = await supabase.auth.admin.getUserById(userId)
            const adminEmail = adminData?.user?.email || ''
            const upsertData: any = { user_id: targetUserId, updated_by: userId, updated_at: new Date().toISOString() }
            if (payment_provider !== undefined) upsertData.payment_provider = payment_provider
            if (mollie_api_key !== undefined) upsertData.mollie_api_key = mollie_api_key
            if (stripe_connect_account !== undefined) upsertData.stripe_connect_account = stripe_connect_account
            if (override_platform_default !== undefined) upsertData.override_platform_default = override_platform_default
            if (notes !== undefined) upsertData.notes = notes
            const { error } = await supabase.from('user_payment_config').upsert(upsertData, { onConflict: 'user_id' })
            if (error) throw error
            await logAudit(supabase, userId, adminEmail, 'change_payment_provider', 'user', targetUserId, { payment_provider, override_platform_default, notes })
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // ─── FINANCIAL OVERVIEW ─────────────────────────────────────────────────

        // GET /api/superadmin/financial
        if (request.method === 'GET' && pathSegments.length === 1 && pathSegments[0] === 'financial') {
            const { data: allOrders } = await supabase
                .from('checkout_analytics')
                .select('checkout_id, created_at')
                .eq('event_type', 'conversion')

            // GMV via checkouts + member_areas price
            const checkoutIds = [...new Set((allOrders || []).map((o: any) => o.checkout_id))]
            let totalGmv = 0
            let monthlyGmv: Record<string, number> = {}

            if (checkoutIds.length > 0) {
                const { data: checkouts } = await supabase
                    .from('checkouts')
                    .select('id, price, currency, application_id')
                    .in('id', checkoutIds)

                checkouts?.forEach((c: any) => {
                    const price = parseFloat(c.price) || 0
                    totalGmv += price
                })

                    ; (allOrders || []).forEach((o: any) => {
                        const month = o.created_at?.substring(0, 7) || ''
                        if (month) {
                            const checkout = checkouts?.find((c: any) => c.id === o.checkout_id)
                            const price = parseFloat(checkout?.price) || 0
                            monthlyGmv[month] = (monthlyGmv[month] || 0) + price
                        }
                    })
            }

            // Taxa padrão da plataforma
            const { data: feeConfig } = await supabase.from('platform_config').select('value').eq('key', 'platform_fee_percentage').single()
            const feePercent = parseFloat(feeConfig?.value) || 5
            const totalRevenue = totalGmv * (feePercent / 100)

            // Total de conversões
            const totalConversions = allOrders?.length || 0

            // Total de page_views
            const { count: totalViews } = await supabase
                .from('checkout_analytics')
                .select('id', { count: 'exact', head: true })
                .eq('event_type', 'page_view')

            const conversionRate = totalViews && totalViews > 0
                ? ((totalConversions / totalViews) * 100).toFixed(2)
                : '0.00'

            // Novos usuários últimos 30 dias
            const thirtyDaysAgo = new Date()
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
            const { data: allAppsForowners } = await supabase.from('applications').select('owner_id, created_at')
            const recentOwners = new Set(
                (allAppsForowners || []).filter((a: any) => new Date(a.created_at) > thirtyDaysAgo).map((a: any) => a.owner_id)
            )

            // Top sellers por apps criados (proxy de atividade)
            const ownerAppCount: Record<string, number> = {}
                ; (allAppsForowners || []).forEach((a: any) => {
                    ownerAppCount[a.owner_id] = (ownerAppCount[a.owner_id] || 0) + 1
                })
            const topSellers = await Promise.all(
                Object.entries(ownerAppCount)
                    .sort((a, b) => (b[1] as number) - (a[1] as number))
                    .slice(0, 10)
                    .map(async ([ownerId, count]) => {
                        try {
                            const { data: u } = await supabase.auth.admin.getUserById(ownerId)
                            return { user_id: ownerId, email: u?.user?.email || 'Unknown', app_count: count }
                        } catch { return { user_id: ownerId, email: 'Unknown', app_count: count } }
                    })
            )

            return new Response(JSON.stringify({
                gmv: totalGmv,
                platform_revenue: totalRevenue,
                fee_percent: feePercent,
                total_conversions: totalConversions,
                total_page_views: totalViews || 0,
                conversion_rate: conversionRate,
                new_users_30d: recentOwners.size,
                monthly_gmv: monthlyGmv,
                top_sellers: topSellers
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // ─── AUDIT LOG ──────────────────────────────────────────────────────────

        // GET /api/superadmin/audit-log
        if (request.method === 'GET' && pathSegments.length === 1 && pathSegments[0] === 'audit-log') {
            const page = parseInt(url.searchParams.get('page') || '1')
            const limit = parseInt(url.searchParams.get('limit') || '50')
            const action = url.searchParams.get('action') || ''
            const offset = (page - 1) * limit

            let query = supabase
                .from('admin_audit_log')
                .select('*', { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1)

            if (action) query = query.eq('action', action)

            const { data: logs, count, error } = await query
            if (error) throw error
            return new Response(JSON.stringify({ logs: logs || [], total: count || 0, page, limit }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // ─── ANNOUNCEMENTS ──────────────────────────────────────────────────────

        // GET /api/superadmin/announcements
        if (request.method === 'GET' && pathSegments.length === 1 && pathSegments[0] === 'announcements') {
            const { data, error } = await supabase
                .from('platform_announcements')
                .select('*')
                .order('created_at', { ascending: false })
            if (error) throw error
            return new Response(JSON.stringify({ announcements: data || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // POST /api/superadmin/announcements
        if (request.method === 'POST' && pathSegments.length === 1 && pathSegments[0] === 'announcements') {
            const body = await request.json()
            const { title, content, type = 'info', target_plan = 'all', expires_at } = body
            if (!title || !content) return new Response(JSON.stringify({ error: 'title e content são obrigatórios' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            const { data: adminData } = await supabase.auth.admin.getUserById(userId)
            const adminEmail = adminData?.user?.email || ''
            const insertData: any = { title, content, type, target_plan, created_by: userId, is_active: true }
            if (expires_at) insertData.expires_at = expires_at
            const { data, error } = await supabase.from('platform_announcements').insert(insertData).select().single()
            if (error) throw error
            await logAudit(supabase, userId, adminEmail, 'create_announcement', 'announcement', data.id, { title, type, target_plan })
            return new Response(JSON.stringify({ success: true, announcement: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // DELETE /api/superadmin/announcements/:id
        if (request.method === 'DELETE' && pathSegments.length === 2 && pathSegments[0] === 'announcements') {
            const announcementId = pathSegments[1]
            const { data: adminData } = await supabase.auth.admin.getUserById(userId)
            const adminEmail = adminData?.user?.email || ''
            const { error } = await supabase.from('platform_announcements').update({ is_active: false }).eq('id', announcementId)
            if (error) throw error
            await logAudit(supabase, userId, adminEmail, 'delete_announcement', 'announcement', announcementId, {})
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // ─── PAYMENT PROVIDERS ──────────────────────────────────────────────────

        // GET /api/superadmin/providers
        if (request.method === 'GET' && pathSegments.length === 1 && pathSegments[0] === 'providers') {
            const { data, error } = await supabase
                .from('payment_providers')
                .select('id, name, type, is_active, is_global_default, created_at, updated_at')
                .order('created_at', { ascending: true })
            if (error) throw error
            return new Response(JSON.stringify({ providers: data || [] }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // POST /api/superadmin/providers
        if (request.method === 'POST' && pathSegments.length === 1 && pathSegments[0] === 'providers') {
            const body = await request.json()
            const { name, type, credentials = {}, is_active = true } = body
            if (!name || !type) {
                return new Response(JSON.stringify({ error: 'name e type são obrigatórios' }), {
                    status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }
            const { data: adminData } = await supabase.auth.admin.getUserById(userId)
            const adminEmail = adminData?.user?.email || ''
            const { data, error } = await supabase
                .from('payment_providers')
                .insert({ name, type, credentials, is_active, created_by: userId })
                .select('id, name, type, is_active, is_global_default, created_at')
                .single()
            if (error) throw error
            await logAudit(supabase, userId, adminEmail, 'create_payment_provider', 'payment_provider', data.id, { name, type })
            return new Response(JSON.stringify({ success: true, provider: data }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // PUT /api/superadmin/providers/:id
        if (request.method === 'PUT' && pathSegments.length === 2 && pathSegments[0] === 'providers') {
            const providerId = pathSegments[1]
            const body = await request.json()
            const { name, credentials, is_active, is_global_default } = body
            const { data: adminData } = await supabase.auth.admin.getUserById(userId)
            const adminEmail = adminData?.user?.email || ''
            const updateData: any = { updated_at: new Date().toISOString() }
            if (name !== undefined) updateData.name = name
            if (credentials !== undefined) updateData.credentials = credentials
            if (is_active !== undefined) updateData.is_active = is_active
            if (is_global_default !== undefined) {
                // Garante que só um pode ser global default
                if (is_global_default) {
                    await supabase
                        .from('payment_providers')
                        .update({ is_global_default: false })
                        .eq('is_global_default', true)
                }
                updateData.is_global_default = is_global_default
            }
            const { error } = await supabase
                .from('payment_providers')
                .update(updateData)
                .eq('id', providerId)
            if (error) throw error
            await logAudit(supabase, userId, adminEmail, 'update_payment_provider', 'payment_provider', providerId, { is_active, is_global_default })
            return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // DELETE /api/superadmin/providers/:id
        if (request.method === 'DELETE' && pathSegments.length === 2 && pathSegments[0] === 'providers') {
            const providerId = pathSegments[1]
            const { data: adminData } = await supabase.auth.admin.getUserById(userId)
            const adminEmail = adminData?.user?.email || ''
            const { error } = await supabase.from('payment_providers').delete().eq('id', providerId)
            if (error) throw error
            await logAudit(supabase, userId, adminEmail, 'delete_payment_provider', 'payment_provider', providerId, {})
            return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // POST /api/superadmin/payment-config/search  —  busca usuário por email para criar override
        if (request.method === 'POST' && pathSegments.length === 2 && pathSegments[0] === 'payment-config' && pathSegments[1] === 'search') {
            const { email } = await request.json()
            if (!email) {
                return new Response(JSON.stringify({ error: 'email é obrigatório' }), {
                    status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }
            const { data: usersData } = await supabase.auth.admin.listUsers()
            const matched = (usersData?.users || [])
                .filter((u: any) => u.email?.toLowerCase().includes(email.toLowerCase()))
                .slice(0, 15)
            if (matched.length === 0) {
                return new Response(JSON.stringify({ users: [] }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }
            const ids = matched.map((u: any) => u.id)
            const { data: configs } = await supabase
                .from('user_payment_config')
                .select('*')
                .in('user_id', ids)
            const configMap: Record<string, any> = Object.fromEntries((configs || []).map((c: any) => [c.user_id, c]))
            const users = matched.map((u: any) => ({
                id: u.id,
                email: u.email,
                config: configMap[u.id] || null
            }))
            return new Response(JSON.stringify({ users }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // GET /api/superadmin/withdrawals
        if (request.method === 'GET' && pathSegments[0] === 'withdrawals') {
            const page = parseInt(url.searchParams.get('page') || '1')
            const limit = parseInt(url.searchParams.get('limit') || '50')
            const offset = (page - 1) * limit
            const statusFilter = url.searchParams.get('status') || ''
            const userFilter = url.searchParams.get('user_id') || ''

            let query = supabase
                .from('withdrawal_requests')
                .select('*', { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1)

            if (statusFilter) query = query.eq('status', statusFilter)
            if (userFilter) query = query.eq('user_id', userFilter)

            const { data, count, error } = await query
            if (error) throw error

            // Enriquecer com email do usuário
            const enriched = await Promise.all(
                (data || []).map(async (row: any) => {
                    try {
                        const { data: authUser } = await supabase.auth.admin.getUserById(row.user_id)
                        return { ...row, user_email: authUser?.user?.email || row.user_id }
                    } catch {
                        return { ...row, user_email: row.user_id }
                    }
                })
            )

            return new Response(JSON.stringify({ data: enriched, total: count, page, limit }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // PATCH /api/superadmin/withdrawals/:id
        if (request.method === 'PATCH' && pathSegments[0] === 'withdrawals' && pathSegments[1]) {
            const withdrawalId = pathSegments[1]
            const body: any = await request.json()
            const allowedFields = ['status', 'notes', 'completed_at']
            const updates: any = {}
            for (const field of allowedFields) {
                if (body[field] !== undefined) updates[field] = body[field]
            }
            if (updates.status === 'completed' && !updates.completed_at) {
                updates.completed_at = new Date().toISOString()
            }

            const { data, error } = await supabase
                .from('withdrawal_requests')
                .update(updates)
                .eq('id', withdrawalId)
                .select()
                .single()

            if (error) throw error

            const { data: authUser } = await supabase.auth.admin.getUserById(userId)
            await logAudit(supabase, userId, authUser?.user?.email || '', 'update_withdrawal', 'withdrawal', withdrawalId, updates)

            return new Response(JSON.stringify(data), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // GET /api/superadmin/anticipations
        if (request.method === 'GET' && pathSegments[0] === 'anticipations') {
            const page = parseInt(url.searchParams.get('page') || '1')
            const limit = parseInt(url.searchParams.get('limit') || '50')
            const offset = (page - 1) * limit
            const statusFilter = url.searchParams.get('status') || ''
            const userFilter = url.searchParams.get('user_id') || ''

            let query = supabase
                .from('anticipation_requests')
                .select('*', { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1)

            if (statusFilter) query = query.eq('status', statusFilter)
            if (userFilter) query = query.eq('user_id', userFilter)

            const { data, count, error } = await query
            if (error) throw error

            const enriched = await Promise.all(
                (data || []).map(async (row: any) => {
                    try {
                        const { data: authUser } = await supabase.auth.admin.getUserById(row.user_id)
                        return { ...row, user_email: authUser?.user?.email || row.user_id }
                    } catch {
                        return { ...row, user_email: row.user_id }
                    }
                })
            )

            return new Response(JSON.stringify({ data: enriched, total: count, page, limit }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // PATCH /api/superadmin/anticipations/:id
        if (request.method === 'PATCH' && pathSegments[0] === 'anticipations' && pathSegments[1]) {
            const anticipationId = pathSegments[1]
            const body: any = await request.json()
            const allowedFields = ['status', 'notes', 'completed_at']
            const updates: any = {}
            for (const field of allowedFields) {
                if (body[field] !== undefined) updates[field] = body[field]
            }
            if (updates.status === 'completed' && !updates.completed_at) {
                updates.completed_at = new Date().toISOString()
            }

            const { data, error } = await supabase
                .from('anticipation_requests')
                .update(updates)
                .eq('id', anticipationId)
                .select()
                .single()

            if (error) throw error

            const { data: authUser } = await supabase.auth.admin.getUserById(userId)
            await logAudit(supabase, userId, authUser?.user?.email || '', 'update_anticipation', 'anticipation', anticipationId, updates)

            return new Response(JSON.stringify(data), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
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
