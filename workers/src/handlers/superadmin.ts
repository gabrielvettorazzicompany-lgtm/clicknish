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
        // Busca métodos disponíveis na conta Stripe deste provedor via payment_method_configurations
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
            try {
                const stripeRes = await fetch('https://api.stripe.com/v1/payment_method_configurations', {
                    headers: { 'Authorization': `Bearer ${secretKey}` }
                })
                if (!stripeRes.ok) {
                    const err = await stripeRes.json().catch(() => ({})) as any
                    throw new Error(err?.error?.message || stripeRes.statusText)
                }
                const stripeData = await stripeRes.json() as any
                const config = stripeData.data?.[0] || {}

                const STRIPE_METHOD_LABELS: Record<string, string> = {
                    card: 'Card (Visa, Mastercard, etc.)',
                    ideal: 'iDEAL',
                    sepa_debit: 'SEPA Direct Debit',
                    bancontact: 'Bancontact',
                    giropay: 'Giropay',
                    sofort: 'Sofort',
                    klarna: 'Klarna',
                    afterpay_clearpay: 'Afterpay / Clearpay',
                    affirm: 'Affirm',
                    p24: 'Przelewy24',
                    eps: 'EPS',
                    bacs_debit: 'Bacs Direct Debit',
                    au_becs_debit: 'BECS Direct Debit',
                    boleto: 'Boleto',
                    oxxo: 'OXXO',
                    konbini: 'Konbini',
                    paynow: 'PayNow',
                    promptpay: 'PromptPay',
                    wechat_pay: 'WeChat Pay',
                    alipay: 'Alipay',
                    cashapp: 'Cash App Pay',
                    amazon_pay: 'Amazon Pay',
                    revolut_pay: 'Revolut Pay',
                    mobilepay: 'MobilePay',
                    twint: 'TWINT',
                    multibanco: 'Multibanco',
                    link: 'Link',
                    paypal: 'PayPal',
                }

                const skipFields = new Set(['id', 'object', 'application', 'is_default', 'livemode', 'name', 'parent', 'metadata'])
                const available: Array<{ id: string; label: string; active: boolean }> = []
                for (const [key, val] of Object.entries(config)) {
                    if (skipFields.has(key)) continue
                    if (typeof val !== 'object' || val === null) continue
                    const method = val as any
                    if ('available' in method) {
                        const isOn = method.display_preference?.value === 'on'
                        available.push({
                            id: key,
                            label: STRIPE_METHOD_LABELS[key] || key,
                            active: isOn,
                        })
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

            // Fonte primária: sale_locations (tem amount + currency reais)
            const { data: saleLoc, count: saleLocCount } = await supabase
                .from('sale_locations')
                .select('id, user_id, customer_email, amount, currency, payment_method, sale_date, product_id, checkout_id, country, created_at', { count: 'exact' })
                .order('sale_date', { ascending: false })
                .range(offset, offset + limit - 1)

            // Fonte secundária: user_product_access com payment_status completed (vendas que podem não estar em sale_locations)
            const { data: upa } = await supabase
                .from('user_product_access')
                .select('id, user_id, application_id, product_id, purchase_price, payment_method, payment_status, payment_id, created_at')
                .eq('payment_status', 'completed')
                .neq('access_type', 'manual')
                .order('created_at', { ascending: false })
                .limit(500)

            // IDs já presentes em sale_locations para deduplicação
            const saleLocIds = new Set((saleLoc || []).map((s: any) => s.id))

            // Buscar nomes e currency das applications para enriquecer user_product_access
            const appIds = [...new Set((upa || []).filter((u: any) => u.application_id).map((u: any) => u.application_id))]
            let appMap: Record<string, { name: string; currency: string; owner_id: string }> = {}
            if (appIds.length > 0) {
                const { data: apps } = await supabase
                    .from('applications')
                    .select('id, name, currency, owner_id')
                    .in('id', appIds)
                apps?.forEach((a: any) => { appMap[a.id] = { name: a.name, currency: (a.currency || 'USD').toUpperCase(), owner_id: a.owner_id } })
            }

            // Buscar emails de sale_locations para user_product_access (via checkout_id ou product_id)
            const emailBySeller: Record<string, string> = {}
                ; (saleLoc || []).forEach((s: any) => {
                    if (s.user_id && s.customer_email) emailBySeller[`${s.user_id}_${s.product_id}`] = s.customer_email
                })

            // Combinar sale_locations rows
            const fromSaleLoc = (saleLoc || []).map((s: any) => {
                const gross = parseFloat(s.amount) || 0
                return {
                    id: s.id,
                    sale_date: s.sale_date || s.created_at,
                    buyer_email: s.customer_email || '',
                    product_name: 'Produto',
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

            // Adicionar registros de user_product_access que NÃO estão em sale_locations
            const saleLocPaymentIds = new Set((saleLoc || []).map((s: any) => s.checkout_id).filter(Boolean))
            const fromUpa = (upa || [])
                .filter((u: any) => {
                    // Excluir se já existe em sale_locations (via checkout_id/product_id match no mesmo período)
                    const app = appMap[u.application_id]
                    if (!app) return false
                    // Se payment_id aparece como checkout_id em sale_locations, já está incluído
                    if (u.payment_id && saleLocPaymentIds.has(u.payment_id)) return false
                    return true
                })
                .map((u: any) => {
                    const app = appMap[u.application_id] || { name: 'Produto', currency: 'USD', owner_id: '' }
                    const gross = parseFloat(u.purchase_price) || 0
                    const emailKey = `${app.owner_id}_${u.product_id}`
                    return {
                        id: u.id,
                        sale_date: u.created_at,
                        buyer_email: emailBySeller[emailKey] || '',
                        product_name: app.name,
                        gross_value: gross,
                        currency: app.currency,
                        payment_method: u.payment_method || 'card',
                        platform_fee: gross * (feePercent / 100),
                        net_producer: gross * ((100 - feePercent) / 100),
                        fee_percent: feePercent,
                        seller_id: app.owner_id,
                        checkout_id: u.payment_id || null,
                        country: null,
                        source: 'user_product_access',
                    }
                })

            // Enriquecer product_name em sale_locations via appMap
            const productIdsForSaleLoc = [...new Set((saleLoc || []).filter((s: any) => s.product_id).map((s: any) => s.product_id))]
            const productNameMap: Record<string, string> = {}
            if (productIdsForSaleLoc.length > 0) {
                const { data: apps2 } = await supabase.from('applications').select('id, name').in('id', productIdsForSaleLoc)
                apps2?.forEach((a: any) => { productNameMap[a.id] = a.name })
            }
            fromSaleLoc.forEach((t: any) => {
                const sale = (saleLoc || []).find((s: any) => s.id === t.id)
                if (sale?.product_id && productNameMap[sale.product_id]) t.product_name = productNameMap[sale.product_id]
            })

            const allTransactions = [...fromSaleLoc, ...fromUpa]
                .sort((a: any, b: any) => new Date(b.sale_date).getTime() - new Date(a.sale_date).getTime())

            // Paginar manualmente (já que combinamos duas fontes)
            const paged = allTransactions.slice(offset, offset + limit)
            const total = (saleLocCount || 0) + fromUpa.length

            return new Response(JSON.stringify({ data: paged, total, page, limit, fee_percent: feePercent }), {
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
            status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

        // ─── PAYOUT PLAN REQUESTS ────────────────────────────────────────────────

        // GET /api/superadmin/plan-requests  — lista solicitações de D+2
        if (request.method === 'GET' && pathSegments.length === 1 && pathSegments[0] === 'plan-requests') {
            const statusFilter = url.searchParams.get('status') || 'pending'
            let query = supabase
                .from('payout_plan_requests')
                .select('*', { count: 'exact' })
                .order('created_at', { ascending: false })
            if (statusFilter !== 'all') query = query.eq('status', statusFilter)
            const { data, count, error } = await query
            if (error) throw error
            const enriched = await Promise.all(
                (data || []).map(async (row: any) => {
                    try {
                        const { data: authUser } = await supabase.auth.admin.getUserById(row.user_id)
                        return { ...row, user_email: authUser?.user?.email || row.user_id }
                    } catch { return { ...row, user_email: row.user_id } }
                })
            )
            return new Response(JSON.stringify({ data: enriched, total: count || 0 }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // PUT /api/superadmin/plan-requests/:id/approve
        if (request.method === 'PUT' && pathSegments.length === 3 && pathSegments[0] === 'plan-requests' && pathSegments[2] === 'approve') {
            const reqId = pathSegments[1]
            const { data: planReq, error: fetchErr } = await supabase
                .from('payout_plan_requests')
                .select('user_id, requested_plan')
                .eq('id', reqId)
                .single()
            if (fetchErr || !planReq) {
                return new Response(JSON.stringify({ error: 'Solicitação não encontrada' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }
            const { data: adminData } = await supabase.auth.admin.getUserById(userId)
            const adminEmail = adminData?.user?.email || ''
            // Atualizar plano do produtor
            const { error: cfgErr } = await supabase
                .from('user_payment_config')
                .upsert({ user_id: planReq.user_id, payout_schedule: planReq.requested_plan }, { onConflict: 'user_id' })
            if (cfgErr) throw cfgErr
            // Marcar solicitação como aprovada
            await supabase.from('payout_plan_requests').update({
                status: 'approved',
                reviewed_by: userId,
                reviewed_at: new Date().toISOString(),
            }).eq('id', reqId)
            await logAudit(supabase, userId, adminEmail, 'approve_plan_request', 'payout_plan_request', reqId, { plan: planReq.requested_plan, producer: planReq.user_id })
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // PUT /api/superadmin/plan-requests/:id/reject
        if (request.method === 'PUT' && pathSegments.length === 3 && pathSegments[0] === 'plan-requests' && pathSegments[2] === 'reject') {
            const reqId = pathSegments[1]
            const body: any = await request.json().catch(() => ({}))
            const { data: adminData } = await supabase.auth.admin.getUserById(userId)
            const adminEmail = adminData?.user?.email || ''
            await supabase.from('payout_plan_requests').update({
                status: 'rejected',
                reviewed_by: userId,
                reviewed_at: new Date().toISOString(),
                admin_notes: body.reason || null,
            }).eq('id', reqId)
            await logAudit(supabase, userId, adminEmail, 'reject_plan_request', 'payout_plan_request', reqId, { reason: body.reason })
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
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
