// @ts-nocheck
import { createClient } from '../lib/supabase'
import { createMollieClient } from '../lib/mollie'

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
            const [applicationsResult, domainsResult, productsResult, clientsResult, profilesCountResult] = await Promise.all([
                supabase.from('applications').select('id, created_at, name, owner_id', { count: 'exact' }),
                supabase.from('app_domains').select('id, domain, status', { count: 'exact' }),
                supabase.from('products').select('id', { count: 'exact' }),
                supabase.from('app_users').select('id', { count: 'exact' }),
                supabase.from('admin_profiles').select('user_id', { count: 'exact' })
            ])

            // Total real de owners = total de perfis na plataforma
            const totalUsers = profilesCountResult.count ?? (profilesCountResult.data?.length || 0)

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
            const limit = parseInt(url.searchParams.get('limit') || '50')
            const offset = (page - 1) * limit
            const searchQuery = url.searchParams.get('search') || ''
            const planFilter = url.searchParams.get('plan') || ''

            // Buscar todos os owners da plataforma via admin_profiles
            const { data: allProfiles, error: profilesError } = await supabase
                .from('admin_profiles')
                .select('user_id, full_name, created_at')
                .order('created_at', { ascending: false })

            if (profilesError) throw profilesError

            // Buscar estatísticas de aplicações por owner
            const { data: allUserApps } = await supabase.from('applications').select('owner_id, created_at')
            const userStats: Record<string, any> = {}
            allUserApps?.forEach((app: any) => {
                const ownerId = app.owner_id
                if (!userStats[ownerId]) {
                    userStats[ownerId] = { app_count: 0, last_activity: app.created_at }
                }
                userStats[ownerId].app_count += 1
                if (new Date(app.created_at) > new Date(userStats[ownerId].last_activity)) {
                    userStats[ownerId].last_activity = app.created_at
                }
            })

            // Enriquecer com dados de auth
            const usersWithDetails = await Promise.all(
                (allProfiles || []).map(async (profile: any) => {
                    try {
                        const { data: authUser } = await supabase.auth.admin.getUserById(profile.user_id)
                        const stats = userStats[profile.user_id] || { app_count: 0, last_activity: null }
                        let plan = 'free'
                        if (stats.app_count >= 5) plan = 'advanced'
                        else if (stats.app_count >= 2) plan = 'pro'
                        return {
                            id: profile.user_id,
                            name: profile.full_name || authUser?.user?.email || 'N/A',
                            email: authUser?.user?.email || 'N/A',
                            created_at: authUser?.user?.created_at || profile.created_at,
                            app_count: stats.app_count,
                            last_activity: stats.last_activity || authUser?.user?.last_sign_in_at,
                            plan,
                            is_banned: authUser?.user?.banned_until ? new Date(authUser.user.banned_until) > new Date() : false,
                        }
                    } catch {
                        const stats = userStats[profile.user_id] || { app_count: 0, last_activity: null }
                        return {
                            id: profile.user_id,
                            name: profile.full_name || 'N/A',
                            email: 'N/A',
                            created_at: profile.created_at,
                            app_count: stats.app_count,
                            last_activity: stats.last_activity,
                            plan: 'free',
                            is_banned: false,
                        }
                    }
                })
            )

            // Aplicar filtros
            let filteredUsers = usersWithDetails
            if (searchQuery) {
                const q = searchQuery.toLowerCase()
                filteredUsers = filteredUsers.filter((u: any) =>
                    u.email.toLowerCase().includes(q) ||
                    u.name.toLowerCase().includes(q)
                )
            }
            if (planFilter && planFilter !== 'all') {
                filteredUsers = filteredUsers.filter((u: any) => u.plan === planFilter)
            }

            const paginatedUsers = filteredUsers.slice(offset, offset + limit)

            return new Response(JSON.stringify({
                users: paginatedUsers,
                total: filteredUsers.length,
                pagination: { page, limit, hasMore: filteredUsers.length > offset + limit, total: filteredUsers.length },
                filters: { search: searchQuery, plan: planFilter }
            }), {
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
            const statusFilter = url.searchParams.get('status') || ''
            let verQuery = supabase.from('payment_settings').select('*').not('bank_name', 'is', null).order('submitted_at', { ascending: false })
            if (statusFilter) verQuery = verQuery.eq('verification_status', statusFilter)
            const { data: verifications, error } = await verQuery
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

        // GET /api/superadmin/all-products?status=all|pending_review|approved|rejected
        if (request.method === 'GET' && pathSegments.length === 1 && pathSegments[0] === 'all-products') {
            const url = new URL(request.url)
            const statusFilter = url.searchParams.get('status')
            let query = supabase.from('member_areas').select('id, name, description, price, currency, category, delivery_type, image_url, owner_id, created_at, review_status, review_notes').order('created_at', { ascending: false })
            if (statusFilter && statusFilter !== 'all') {
                query = query.eq('review_status', statusFilter)
            } else {
                query = query.in('review_status', ['pending_review', 'approved', 'rejected', 'draft'])
            }
            const { data: products, error } = await query
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

        // GET /api/superadmin/app-details/:appId
        if (request.method === 'GET' && pathSegments.length === 2 && pathSegments[0] === 'app-details') {
            const appId = pathSegments[1]
            const { data: app, error: appError } = await supabase.from('applications').select('*').eq('id', appId).single()
            if (appError || !app) return new Response(JSON.stringify({ error: 'App not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            let ownerEmail = 'Unknown'
            try { const { data: authUser } = await supabase.auth.admin.getUserById(app.owner_id); ownerEmail = authUser?.user?.email || 'Unknown' } catch { }

            // Busca produtos da aplicação (products com application_id)
            const { data: appProducts } = await supabase.from('products').select('id, name, description, type, cover_url, created_at').eq('application_id', appId).order('created_at', { ascending: false })
            const productIds = (appProducts || []).map((p: any) => p.id)

            // Busca community_modules E product_content em paralelo
            let modules: any[] = []
            let productContents: any[] = []
            if (productIds.length > 0) {
                const [modulesResult, contentsResult] = await Promise.all([
                    supabase.from('community_modules').select('id, member_area_id, title, description, order_position').in('member_area_id', productIds).order('order_position', { ascending: true }),
                    supabase.from('product_content').select('id, product_id, title, content_type, content_url, text_content, order').in('product_id', productIds).order('order', { ascending: true })
                ])
                modules = modulesResult.data || []
                productContents = contentsResult.data || []
                const moduleIds = modules.map((m: any) => m.id)
                if (moduleIds.length > 0) {
                    const { data: lessonsData } = await supabase.from('community_lessons').select('id, module_id, title, content_type, video_url, order_position').in('module_id', moduleIds).order('order_position', { ascending: true })
                    modules = modules.map((mod: any) => ({ ...mod, lessons: (lessonsData || []).filter((l: any) => l.module_id === mod.id) }))
                }
            }
            const productsWithContent = (appProducts || []).map((product: any) => ({
                ...product,
                modules: modules.filter((m: any) => m.member_area_id === product.id),
                contents: productContents.filter((c: any) => c.product_id === product.id)
            }))
            const totalLessons = modules.reduce((sum: number, m: any) => sum + (m.lessons?.length || 0), 0)
            const totalContents = productContents.length

            return new Response(JSON.stringify({
                app: { ...app, owner_email: ownerEmail },
                memberAreas: productsWithContent,
                stats: { totalMemberAreas: appProducts?.length || 0, totalModules: modules.length, totalLessons, totalContents }
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // GET /api/superadmin/all-apps?status=all|pending_review|approved|rejected|draft
        if (request.method === 'GET' && pathSegments.length === 1 && pathSegments[0] === 'all-apps') {
            const url = new URL(request.url)
            const statusFilter = url.searchParams.get('status')
            let query = supabase.from('applications').select('id, name, slug, logo_url, app_type, language, owner_id, created_at, review_status, review_notes').order('created_at', { ascending: false })
            if (statusFilter && statusFilter !== 'all') {
                query = query.eq('review_status', statusFilter)
            } else {
                query = query.in('review_status', ['pending_review', 'approved', 'rejected', 'draft'])
            }
            const { data: apps, error } = await query
            if (error) throw error
            const enrichedApps = await Promise.all((apps || []).map(async (app: any) => { try { const { data: authUser } = await supabase.auth.admin.getUserById(app.owner_id); return { ...app, owner_email: authUser?.user?.email || 'Unknown' } } catch { return { ...app, owner_email: 'Unknown' } } }))
            return new Response(JSON.stringify({ apps: enrichedApps }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // GET /api/superadmin/pending-apps
        if (request.method === 'GET' && pathSegments.length === 1 && pathSegments[0] === 'pending-apps') {
            const { data: apps, error } = await supabase.from('applications').select('id, name, slug, logo_url, app_type, language, owner_id, created_at, review_status').in('review_status', ['pending_review', 'draft']).order('created_at', { ascending: false })
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
            const { payment_provider, mollie_api_key, stripe_connect_account, override_platform_default, notes, provider_id } = body
            const { data: adminData } = await supabase.auth.admin.getUserById(userId)
            const adminEmail = adminData?.user?.email || ''

            const updateFields: any = { updated_by: userId, updated_at: new Date().toISOString() }
            if (payment_provider !== undefined) updateFields.payment_provider = payment_provider
            if (mollie_api_key !== undefined) updateFields.mollie_api_key = mollie_api_key
            if (stripe_connect_account !== undefined) updateFields.stripe_connect_account = stripe_connect_account
            if (override_platform_default !== undefined) updateFields.override_platform_default = override_platform_default
            if (notes !== undefined) updateFields.notes = notes
            if (provider_id !== undefined) {
                updateFields.provider_id = provider_id || null
                if (provider_id) {
                    const { data: provRow } = await supabase.from('payment_providers').select('type').eq('id', provider_id).maybeSingle()
                    if (provRow?.type) updateFields.payment_provider = provRow.type
                    updateFields.override_platform_default = true
                } else {
                    updateFields.override_platform_default = false
                }
            }

            // Verifica se já existe registro para o usuário
            const { data: existing } = await supabase
                .from('user_payment_config')
                .select('id')
                .eq('user_id', targetUserId)
                .maybeSingle()

            let dbError
            if (existing?.id) {
                const { error } = await supabase
                    .from('user_payment_config')
                    .update(updateFields)
                    .eq('user_id', targetUserId)
                dbError = error
            } else {
                const { error } = await supabase
                    .from('user_payment_config')
                    .insert({ ...updateFields, user_id: targetUserId, payment_provider: updateFields.payment_provider || 'stripe' })
                dbError = error
            }

            if (dbError) throw dbError
            await logAudit(supabase, userId, adminEmail, 'change_payment_provider', 'user', targetUserId, { provider_id, override_platform_default: updateFields.override_platform_default })
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // ─── FINANCIAL OVERVIEW ─────────────────────────────────────────────────

        // GET /api/superadmin/financial
        if (request.method === 'GET' && pathSegments.length === 1 && pathSegments[0] === 'financial') {
            // Buscar todas as vendas reais da sale_locations
            const { data: allSales } = await supabase
                .from('sale_locations')
                .select('id, amount, currency, sale_date, created_at, user_id')
                .order('sale_date', { ascending: false })

            // Calcular GMV real agrupado por moeda e por mês
            let totalGmvBRL = 0
            let totalGmvUSD = 0
            const monthlyGmv: Record<string, number> = {}

                ; (allSales || []).forEach((s: any) => {
                    const amount = parseFloat(s.amount) || 0
                    const currency = (s.currency || 'USD').toUpperCase()
                    const dateStr: string = s.sale_date || s.created_at || ''
                    const month = dateStr.substring(0, 7)

                    if (currency === 'BRL') totalGmvBRL += amount
                    else totalGmvUSD += amount

                    if (month) {
                        monthlyGmv[month] = (monthlyGmv[month] || 0) + amount
                    }
                })

            // GMV total (BRL + USD convertido 1:1 para referência)
            const totalGmv = totalGmvBRL + totalGmvUSD

            // Taxa padrão da plataforma
            const { data: feeConfig } = await supabase.from('platform_config').select('value').eq('key', 'platform_fee_percentage').single()
            const feePercent = parseFloat(feeConfig?.value) || 5
            const totalRevenue = totalGmv * (feePercent / 100)

            // Total de conversões = total de vendas
            const totalConversions = allSales?.length || 0

            // Novos usuários últimos 30 dias
            const thirtyDaysAgo = new Date()
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
            const { data: allAppsForowners } = await supabase.from('applications').select('owner_id, created_at')
            const recentOwners = new Set(
                (allAppsForowners || []).filter((a: any) => new Date(a.created_at) > thirtyDaysAgo).map((a: any) => a.owner_id)
            )

            // Top sellers por volume de vendas
            const sellerSales: Record<string, number> = {}
                ; (allSales || []).forEach((s: any) => {
                    if (s.user_id) sellerSales[s.user_id] = (sellerSales[s.user_id] || 0) + 1
                })
            const topSellers = await Promise.all(
                Object.entries(sellerSales)
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
                gmv_brl: totalGmvBRL,
                gmv_usd: totalGmvUSD,
                platform_revenue: totalRevenue,
                fee_percent: feePercent,
                total_conversions: totalConversions,
                conversion_rate: '0.00',
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
                .select('id, name, type, credentials, is_active, is_global_default, created_at, updated_at')
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
                .select('id, name, type, credentials, is_active, is_global_default, created_at')
                .single()
            if (error) throw error
            await logAudit(supabase, userId, adminEmail, 'create_payment_provider', 'payment_provider', data.id, { name, type })
            return new Response(JSON.stringify({ success: true, provider: data }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // GET /api/superadmin/providers/:id/mollie-methods
        // Busca métodos disponíveis na conta Mollie deste provedor
        if (request.method === 'GET' && pathSegments.length === 3 && pathSegments[0] === 'providers' && pathSegments[2] === 'mollie-methods') {
            const providerId = pathSegments[1]
            const { data: prov } = await supabase
                .from('payment_providers')
                .select('credentials, type, enabled_methods')
                .eq('id', providerId)
                .single()
            if (!prov || prov.type !== 'mollie') {
                return new Response(JSON.stringify({ error: 'Provedor não encontrado ou não é Mollie' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }
            const apiKey = prov.credentials?.live_api_key || prov.credentials?.api_key
            if (!apiKey) {
                return new Response(JSON.stringify({ error: 'Chave Mollie não configurada neste provedor' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }
            try {
                const mollie = createMollieClient(apiKey)
                const methods = await mollie.listMethods()
                return new Response(JSON.stringify({
                    available: methods,
                    enabled: prov.enabled_methods || [],
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            } catch (mollieErr: any) {
                return new Response(JSON.stringify({ error: `Erro Mollie: ${mollieErr.message}` }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }
        }

        // GET /api/superadmin/providers/:id/stripe-methods
        // Busca métodos disponíveis via /v1/account (capabilities) — requer apenas "Account → Read"
        if (request.method === 'GET' && pathSegments.length === 3 && pathSegments[0] === 'providers' && pathSegments[2] === 'stripe-methods') {
            const providerId = pathSegments[1]
            const { data: prov } = await supabase
                .from('payment_providers')
                .select('credentials, type, enabled_methods')
                .eq('id', providerId)
                .single()
            if (!prov || !['stripe', 'stripe_connect'].includes(prov.type)) {
                return new Response(JSON.stringify({ error: 'Provedor não encontrado ou não é Stripe' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }
            const secretKey = prov.credentials?.secret_key
            if (!secretKey) {
                return new Response(JSON.stringify({ error: 'Secret Key Stripe não configurada neste provedor' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }

            // Mapeamento: capability → { id, label }
            const CAPABILITY_MAP: Record<string, { id: string; label: string }> = {
                card_payments: { id: 'card', label: 'Card (Visa, Mastercard, etc.)' },
                ideal_payments: { id: 'ideal', label: 'iDEAL' },
                sepa_debit_payments: { id: 'sepa_debit', label: 'SEPA Direct Debit' },
                bancontact_payments: { id: 'bancontact', label: 'Bancontact' },
                giropay_payments: { id: 'giropay', label: 'Giropay' },
                sofort_payments: { id: 'sofort', label: 'Sofort' },
                klarna_payments: { id: 'klarna', label: 'Klarna' },
                afterpay_clearpay_payments: { id: 'afterpay_clearpay', label: 'Afterpay / Clearpay' },
                affirm_payments: { id: 'affirm', label: 'Affirm' },
                p24_payments: { id: 'p24', label: 'Przelewy24' },
                eps_payments: { id: 'eps', label: 'EPS' },
                bacs_debit_payments: { id: 'bacs_debit', label: 'Bacs Direct Debit' },
                au_becs_debit_payments: { id: 'au_becs_debit', label: 'BECS Direct Debit' },
                boleto_payments: { id: 'boleto', label: 'Boleto' },
                oxxo_payments: { id: 'oxxo', label: 'OXXO' },
                konbini_payments: { id: 'konbini', label: 'Konbini' },
                paynow_payments: { id: 'paynow', label: 'PayNow' },
                promptpay_payments: { id: 'promptpay', label: 'PromptPay' },
                wechat_payments: { id: 'wechat_pay', label: 'WeChat Pay' },
                alipay_payments: { id: 'alipay', label: 'Alipay' },
                cashapp_payments: { id: 'cashapp', label: 'Cash App Pay' },
                amazon_pay_payments: { id: 'amazon_pay', label: 'Amazon Pay' },
                revolut_pay_payments: { id: 'revolut_pay', label: 'Revolut Pay' },
                mobilepay_payments: { id: 'mobilepay', label: 'MobilePay' },
                twint_payments: { id: 'twint', label: 'TWINT' },
                multibanco_payments: { id: 'multibanco', label: 'Multibanco' },
                link_payments: { id: 'link', label: 'Link' },
                paypal_payments: { id: 'paypal', label: 'PayPal' },
            }

            try {
                const accountRes = await fetch('https://api.stripe.com/v1/account', {
                    headers: { 'Authorization': `Bearer ${secretKey}` }
                })
                if (!accountRes.ok) {
                    const err = await accountRes.json().catch(() => ({})) as any
                    throw new Error(err?.error?.message || accountRes.statusText)
                }
                const account = await accountRes.json() as any
                const capabilities: Record<string, string> = account.capabilities || {}

                const available: Array<{ id: string; label: string; active: boolean }> = []
                for (const [capKey, status] of Object.entries(capabilities)) {
                    const mapping = CAPABILITY_MAP[capKey]
                    if (!mapping) continue
                    available.push({
                        id: mapping.id,
                        label: mapping.label,
                        active: status === 'active',
                    })
                }

                // Garantir que "card" aparece sempre (pode não estar em capabilities)
                if (!available.find(m => m.id === 'card')) {
                    available.unshift({ id: 'card', label: 'Card (Visa, Mastercard, etc.)', active: true })
                }

                // Apple Pay e Google Pay não são capabilities separadas — funcionam
                // sobre card_payments. Adicioná-las sempre que card estiver disponível.
                const cardEntry = available.find(m => m.id === 'card')
                if (cardEntry) {
                    if (!available.find(m => m.id === 'apple_pay')) {
                        available.push({ id: 'apple_pay', label: 'Apple Pay', active: cardEntry.active })
                    }
                    if (!available.find(m => m.id === 'google_pay')) {
                        available.push({ id: 'google_pay', label: 'Google Pay', active: cardEntry.active })
                    }
                }

                return new Response(JSON.stringify({
                    available,
                    enabled: prov.enabled_methods || [],
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            } catch (stripeErr: any) {
                return new Response(JSON.stringify({ error: `Erro Stripe: ${stripeErr.message}` }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }
        }

        // GET /api/superadmin/mollie/enabled-methods  (métodos habilitados globalmente)
        if (request.method === 'GET' && pathSegments.length === 2 && pathSegments[0] === 'mollie' && pathSegments[1] === 'enabled-methods') {
            const { data: prov } = await supabase
                .from('payment_providers')
                .select('id, name, enabled_methods')
                .eq('type', 'mollie')
                .eq('is_active', true)
                .order('is_global_default', { ascending: false })
                .limit(1)
                .maybeSingle()
            return new Response(JSON.stringify({
                provider_id: prov?.id || null,
                provider_name: prov?.name || null,
                enabled_methods: prov?.enabled_methods || [],
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // PUT /api/superadmin/providers/:id
        if (request.method === 'PUT' && pathSegments.length === 2 && pathSegments[0] === 'providers') {
            const providerId = pathSegments[1]
            let body: any = {}
            try {
                const rawText = await request.text()
                if (rawText && rawText.trim()) body = JSON.parse(rawText)
            } catch {
                return new Response(JSON.stringify({ error: 'Corpo da requisição inválido (JSON malformado)' }), {
                    status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }
            const { name, credentials, is_active, is_global_default, enabled_methods, available_methods } = body
            const { data: adminData } = await supabase.auth.admin.getUserById(userId)
            const adminEmail = adminData?.user?.email || ''
            const updateData: any = { updated_at: new Date().toISOString() }
            if (name !== undefined) updateData.name = name
            // Só atualiza credentials se vier preenchido (não sobrescreve com objeto vazio)
            if (credentials !== undefined && Object.keys(credentials).length > 0) updateData.credentials = credentials
            if (is_active !== undefined) updateData.is_active = is_active
            if (enabled_methods !== undefined) updateData.enabled_methods = enabled_methods
            // Sincronizar métodos disponíveis da API Mollie na tabela de referência
            // (apenas insere métodos novos que ainda não existem — nunca sobrescreve dados existentes)
            if (available_methods && Array.isArray(available_methods) && available_methods.length > 0) {
                const rows = available_methods.map((m: any) => ({
                    id: m.id,
                    label: m.description || m.id,
                    icon_url: m.image?.svg || null,
                    countries: ['*'],
                    currencies: ['EUR'],
                    is_redirect: true,
                    sort_order: 99,
                }))
                await supabase
                    .from('mollie_payment_methods')
                    .upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
            }
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
            if (error) {
                console.error('update_payment_provider error:', JSON.stringify(error))
                return new Response(JSON.stringify({ error: error.message || 'Erro ao atualizar provedor', details: error }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }
            await logAudit(supabase, userId, adminEmail, 'update_payment_provider', 'payment_provider', providerId, { is_active, is_global_default, enabled_methods })
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

        // GET /api/superadmin/transactions
        if (request.method === 'GET' && pathSegments.length === 1 && pathSegments[0] === 'transactions') {
            const page = parseInt(url.searchParams.get('page') || '1')
            const limit = parseInt(url.searchParams.get('limit') || '50')
            const offset = (page - 1) * limit

            // Global platform fee
            const { data: feeConfig } = await supabase.from('platform_config').select('value').eq('key', 'platform_fee_percentage').single()
            const feePercent = parseFloat(feeConfig?.value) || 5

            // Fonte única: sale_locations (1 linha = 1 venda, sem duplicatas de módulos/produtos).
            // user_product_access tem N linhas por pedido quando o app tem múltiplos módulos,
            // causando contagem e valores inflados — nunca deve ser usado como fonte de extrato.
            const { data: saleLoc, count: saleLocCount } = await supabase
                .from('sale_locations')
                .select('id, user_id, customer_email, customer_id, amount, currency, payment_method, sale_date, product_id, checkout_id, country, created_at', { count: 'exact' })
                .order('sale_date', { ascending: false })
                .range(offset, offset + limit - 1)

            // Enriquecer product_name via applications
            const productIds = [...new Set((saleLoc || []).filter((s: any) => s.product_id).map((s: any) => s.product_id))]
            const productNameMap: Record<string, string> = {}
            if (productIds.length > 0) {
                const { data: appsForNames } = await supabase.from('applications').select('id, name').in('id', productIds)
                appsForNames?.forEach((a: any) => { productNameMap[a.id] = a.name })
            }

            // Fallback de email: quando customer_email está vazio, buscar via customer_id → app_users
            const missingEmailCustomerIds = [...new Set((saleLoc || [])
                .filter((s: any) => !s.customer_email && s.customer_id)
                .map((s: any) => s.customer_id))]
            const emailByCustomerId: Record<string, string> = {}
            if (missingEmailCustomerIds.length > 0) {
                const { data: appUsers } = await supabase
                    .from('app_users')
                    .select('user_id, email')
                    .in('user_id', missingEmailCustomerIds)
                    ; (appUsers || []).forEach((u: any) => {
                        if (u.user_id && u.email) emailByCustomerId[u.user_id] = u.email
                    })
            }

            const transactions = (saleLoc || []).map((s: any) => {
                const gross = parseFloat(s.amount) || 0
                const buyerEmail = s.customer_email || emailByCustomerId[s.customer_id] || ''
                return {
                    id: s.id,
                    sale_date: s.sale_date || s.created_at,
                    buyer_email: buyerEmail,
                    product_name: (s.product_id && productNameMap[s.product_id]) || 'Produto',
                    gross_value: gross,
                    currency: (s.currency || 'USD').toUpperCase(),
                    payment_method: s.payment_method || 'card',
                    platform_fee: gross * (feePercent / 100),
                    net_producer: gross * ((100 - feePercent) / 100),
                    fee_percent: feePercent,
                    seller_id: s.user_id,
                    checkout_id: s.checkout_id,
                    country: s.country || null,
                    source: 'sale_locations',
                }
            })

            return new Response(JSON.stringify({ data: transactions, total: saleLocCount || 0, page, limit, fee_percent: feePercent }), {
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

            // Buscar dados bancários e emails em paralelo para todos os usuários
            const uniqueUserIds = [...new Set((data || []).map((r: any) => r.user_id))]
            const [bankResults, ...authResults] = await Promise.all([
                uniqueUserIds.length > 0
                    ? supabase.from('payment_settings')
                        .select('user_id, bank_name, bank_code, account_number, account_type, account_holder_name, iban, bic_swift, routing_number, bank_country, currency, tax_id_last4, pix_key, verification_status')
                        .in('user_id', uniqueUserIds)
                        .eq('verification_status', 'approved')
                        .order('approved_at', { ascending: false })
                    : Promise.resolve({ data: [] }),
                ...uniqueUserIds.map((uid: string) =>
                    supabase.auth.admin.getUserById(uid).catch(() => ({ data: null }))
                )
            ])

            // Mapear user_id → dados bancários (primeira conta aprovada)
            const bankByUser: Record<string, any> = {}
            for (const b of (bankResults as any).data || []) {
                if (!bankByUser[b.user_id]) bankByUser[b.user_id] = b
            }

            // Mapear user_id → email
            const emailByUser: Record<string, string> = {}
            uniqueUserIds.forEach((uid: string, i: number) => {
                emailByUser[uid] = (authResults[i] as any)?.data?.user?.email || uid
            })

            const enriched = (data || []).map((row: any) => {
                const bank = bankByUser[row.user_id] || null
                return {
                    ...row,
                    user_email: emailByUser[row.user_id] || row.user_id,
                    bank_info: bank ? {
                        bank: bank.bank_name || '—',
                        agency: bank.routing_number || bank.bic_swift || '—',
                        account: bank.account_number || bank.iban || '—',
                        cpf: bank.tax_id_last4 ? `***${bank.tax_id_last4}` : '—',
                        account_holder: bank.account_holder_name || '—',
                        account_type: bank.account_type || '—',
                        country: bank.bank_country || '—',
                        currency: bank.currency || '—',
                        pix_key: bank.pix_key || null,
                        verified: true,
                    } : null,
                }
            })

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

        // ─────────────────────────────────────────────────────────
        // PLANS MANAGEMENT
        // ─────────────────────────────────────────────────────────

        // GET /api/superadmin/users-plans — list users with their plans
        if (request.method === 'GET' && pathSegments[0] === 'users-plans') {
            const search = url.searchParams.get('search') || ''
            const plan = url.searchParams.get('plan') || ''
            let query = supabase.from('profiles').select('id, email, name, plan, created_at, updated_at', { count: 'exact' })
            if (search) query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%`)
            if (plan) query = query.eq('plan', plan)
            query = query.order('created_at', { ascending: false }).limit(200)
            const { data, count, error } = await query
            if (error) throw error
            return new Response(JSON.stringify({ users: data || [], total: count || 0 }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // PATCH /api/superadmin/users-plans/:id — change user plan
        if (request.method === 'PATCH' && pathSegments[0] === 'users-plans' && pathSegments[1]) {
            const targetId = pathSegments[1]
            const body: any = await request.json()
            const { plan, notes } = body
            const validPlans = ['free', 'pro', 'advanced', 'enterprise']
            if (!validPlans.includes(plan)) {
                return new Response(JSON.stringify({ error: 'Plano inválido' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }
            const { error } = await supabase.from('profiles').update({ plan, updated_at: new Date().toISOString() }).eq('id', targetId)
            if (error) throw error
            // Log history
            await supabase.from('plan_change_history').insert({
                user_id: targetId, changed_by: userId, new_plan: plan, notes: notes || null
            }).then(() => {}) // silent fail if table doesn't exist yet
            const { data: adminData } = await supabase.auth.admin.getUserById(userId)
            await logAudit(supabase, userId, adminData?.user?.email || '', 'update_plan', 'user', targetId, { new_plan: plan, notes })
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // GET /api/superadmin/plan-history/:userId — get plan change history
        if (request.method === 'GET' && pathSegments[0] === 'plan-history' && pathSegments[1]) {
            const targetId = pathSegments[1]
            const { data, error } = await supabase
                .from('plan_change_history')
                .select('*')
                .eq('user_id', targetId)
                .order('created_at', { ascending: false })
                .limit(50)
            if (error) return new Response(JSON.stringify({ history: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            return new Response(JSON.stringify({ history: data || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // ─────────────────────────────────────────────────────────
        // COMMISSION OVERRIDE
        // ─────────────────────────────────────────────────────────

        // GET /api/superadmin/commission-override/:userId
        if (request.method === 'GET' && pathSegments[0] === 'commission-override' && pathSegments[1]) {
            const targetId = pathSegments[1]
            const { data, error } = await supabase
                .from('commission_overrides')
                .select('*')
                .eq('user_id', targetId)
                .maybeSingle()
            if (error) return new Response(JSON.stringify({ override: null }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            return new Response(JSON.stringify({ override: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // PUT /api/superadmin/commission-override/:userId
        if (request.method === 'PUT' && pathSegments[0] === 'commission-override' && pathSegments[1]) {
            const targetId = pathSegments[1]
            const body: any = await request.json()
            const { fee_percentage, notes } = body
            if (fee_percentage === null || fee_percentage === undefined) {
                // Remove override
                await supabase.from('commission_overrides').delete().eq('user_id', targetId)
            } else {
                const pct = parseFloat(fee_percentage)
                if (isNaN(pct) || pct < 0 || pct > 100) {
                    return new Response(JSON.stringify({ error: 'Percentual inválido' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
                }
                await supabase.from('commission_overrides').upsert({
                    user_id: targetId, fee_percentage: pct, notes: notes || null,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' })
            }
            const { data: adminData } = await supabase.auth.admin.getUserById(userId)
            await logAudit(supabase, userId, adminData?.user?.email || '', 'update_commission', 'user', targetId, { fee_percentage, notes })
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // ─────────────────────────────────────────────────────────
        // BROADCASTS
        // ─────────────────────────────────────────────────────────

        // GET /api/superadmin/broadcasts
        if (request.method === 'GET' && pathSegments[0] === 'broadcasts' && !pathSegments[1]) {
            const { data, error } = await supabase
                .from('admin_broadcasts')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50)
            if (error) throw error
            return new Response(JSON.stringify({ broadcasts: data || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // POST /api/superadmin/broadcasts
        if (request.method === 'POST' && pathSegments[0] === 'broadcasts') {
            const body: any = await request.json()
            const { title, message, type, target_plan, target_all } = body
            if (!title || !message) {
                return new Response(JSON.stringify({ error: 'Título e mensagem obrigatórios' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }
            const { data: adminData } = await supabase.auth.admin.getUserById(userId)
            const { data, error } = await supabase.from('admin_broadcasts').insert({
                title, message, type: type || 'info', target_plan: target_plan || null,
                target_all: target_all ?? true, sent_by: userId,
                sent_by_email: adminData?.user?.email || '',
                status: 'sent', sent_at: new Date().toISOString()
            }).select().single()
            if (error) throw error

            // If broadcasting to all or a plan, insert notifications for matching users
            let profileQuery = supabase.from('profiles').select('id')
            if (!target_all && target_plan) profileQuery = profileQuery.eq('plan', target_plan)
            const { data: profiles } = await profileQuery
            if (profiles && profiles.length > 0) {
                const notifications = profiles.map((p: any) => ({
                    user_id: p.id, type: 'admin_broadcast',
                    title, message, read: false,
                    metadata: { broadcast_id: data.id, broadcast_type: type || 'info' }
                }))
                // batch insert in chunks of 100
                for (let i = 0; i < notifications.length; i += 100) {
                    await supabase.from('notifications').insert(notifications.slice(i, i + 100)).then(() => {})
                }
            }

            await logAudit(supabase, userId, adminData?.user?.email || '', 'send_broadcast', 'broadcast', data.id, { title, target_all, target_plan })
            return new Response(JSON.stringify({ success: true, broadcast: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // DELETE /api/superadmin/broadcasts/:id
        if (request.method === 'DELETE' && pathSegments[0] === 'broadcasts' && pathSegments[1]) {
            const broadcastId = pathSegments[1]
            const { error } = await supabase.from('admin_broadcasts').delete().eq('id', broadcastId)
            if (error) throw error
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // ─────────────────────────────────────────────────────────
        // SUPPORT TICKETS
        // ─────────────────────────────────────────────────────────

        // GET /api/superadmin/support-tickets
        if (request.method === 'GET' && pathSegments[0] === 'support-tickets' && !pathSegments[1]) {
            const status = url.searchParams.get('status') || ''
            const priority = url.searchParams.get('priority') || ''
            const page = parseInt(url.searchParams.get('page') || '1')
            const limit = parseInt(url.searchParams.get('limit') || '50')
            const offset = (page - 1) * limit
            let query = supabase.from('support_tickets').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(offset, offset + limit - 1)
            if (status) query = query.eq('status', status)
            if (priority) query = query.eq('priority', priority)
            const { data, count, error } = await query
            if (error) throw error
            const enriched = await Promise.all((data || []).map(async (t: any) => {
                try {
                    const { data: u } = await supabase.auth.admin.getUserById(t.user_id)
                    return { ...t, user_email: u?.user?.email || t.user_id }
                } catch { return { ...t, user_email: t.user_id } }
            }))
            return new Response(JSON.stringify({ tickets: enriched, total: count || 0, page, limit }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // GET /api/superadmin/support-tickets/:id — ticket detail + replies
        if (request.method === 'GET' && pathSegments[0] === 'support-tickets' && pathSegments[1]) {
            const ticketId = pathSegments[1]
            const { data: ticket, error } = await supabase.from('support_tickets').select('*').eq('id', ticketId).single()
            if (error || !ticket) return new Response(JSON.stringify({ error: 'Ticket not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            const { data: replies } = await supabase.from('support_ticket_replies').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true })
            try {
                const { data: u } = await supabase.auth.admin.getUserById(ticket.user_id)
                return new Response(JSON.stringify({ ticket: { ...ticket, user_email: u?.user?.email || ticket.user_id }, replies: replies || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            } catch {
                return new Response(JSON.stringify({ ticket, replies: replies || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }
        }

        // PATCH /api/superadmin/support-tickets/:id — update status/priority/assignee
        if (request.method === 'PATCH' && pathSegments[0] === 'support-tickets' && pathSegments[1] && !pathSegments[2]) {
            const ticketId = pathSegments[1]
            const body: any = await request.json()
            const allowedFields = ['status', 'priority', 'assigned_to', 'internal_notes']
            const updates: any = { updated_at: new Date().toISOString() }
            for (const f of allowedFields) { if (body[f] !== undefined) updates[f] = body[f] }
            const { error } = await supabase.from('support_tickets').update(updates).eq('id', ticketId)
            if (error) throw error
            const { data: adminData } = await supabase.auth.admin.getUserById(userId)
            await logAudit(supabase, userId, adminData?.user?.email || '', 'update_ticket', 'support_ticket', ticketId, updates)
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // POST /api/superadmin/support-tickets/:id/reply — admin reply
        if (request.method === 'POST' && pathSegments[0] === 'support-tickets' && pathSegments[1] && pathSegments[2] === 'reply') {
            const ticketId = pathSegments[1]
            const body: any = await request.json()
            const { message } = body
            if (!message) return new Response(JSON.stringify({ error: 'Mensagem obrigatória' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            const { data: adminData } = await supabase.auth.admin.getUserById(userId)
            const { data, error } = await supabase.from('support_ticket_replies').insert({
                ticket_id: ticketId, author_id: userId,
                author_email: adminData?.user?.email || '',
                message, is_admin: true
            }).select().single()
            if (error) throw error
            // Update ticket status to 'waiting_user' when admin replies
            await supabase.from('support_tickets').update({ status: 'waiting_user', updated_at: new Date().toISOString() }).eq('id', ticketId)
            return new Response(JSON.stringify({ success: true, reply: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        return new Response(JSON.stringify({ error: 'Endpoint não encontrado' }), {
            status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
