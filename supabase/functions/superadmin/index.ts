import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'



const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Lista de super admins (emails)
const SUPER_ADMINS = [
    'admin@exemplo.com', // Usuário de teste - Senha: admin123
    'teste@exemplo.com',
    'gabrielvettorazzii@gmail.com',
    // Adicione outros emails de super admins aqui
]

async function isSuperAdmin(userId: string): Promise<boolean> {
    try {
        const { data: user, error } = await supabase.auth.admin.getUserById(userId)
        if (error || !user) return false

        return SUPER_ADMINS.includes(user.user.email || '')
    } catch (error) {
        console.error('Error checking super admin:', error)
        return false
    }
}

Deno.serve(async (req) => {
    const url = new URL(req.url)
    const pathAfterFunction = url.pathname.replace(/^\/superadmin\/?/, '')
    const pathSegments = pathAfterFunction ? pathAfterFunction.split('/').filter(Boolean) : []



    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const userId = req.headers.get('x-user-id')

        if (!userId) {
            return new Response(JSON.stringify({ error: 'User ID é obrigatório' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Verificar se é super admin
        const isAdmin = await isSuperAdmin(userId)
        if (!isAdmin) {
            return new Response(JSON.stringify({ error: 'Acesso negado - Super Admin necessário' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // GET /superadmin/stats - Estatísticas gerais da plataforma
        if (req.method === 'GET' && pathSegments.length === 1 && pathSegments[0] === 'stats') {
            console.log('📊 Fetching platform statistics...')

            // Buscar estatísticas em paralelo
            const [
                applicationsResult,
                domainsResult,
                productsResult,
                clientsResult
            ] = await Promise.all([
                // Total de aplicações criadas
                supabase.from('applications').select('id, created_at, name, owner_id', { count: 'exact' }),

                // Total de domínios personalizados
                supabase.from('app_domains').select('id, domain, status', { count: 'exact' }),

                // Total de produtos criados
                supabase.from('products').select('id', { count: 'exact' }),

                // Total de clientes/usuários dos apps
                supabase.from('app_users').select('id', { count: 'exact' })
            ])

            // Contar usuários únicos através das aplicações
            const uniqueOwners = new Set(applicationsResult.data?.map(app => app.owner_id) || [])
            const totalUsers = uniqueOwners.size

            // Buscar todas as aplicações para fazer agregação manual
            const { data: allApps } = await supabase
                .from('applications')
                .select('owner_id')

            // Agrupar manualmente por owner_id
            const userAppCounts = {}
            allApps?.forEach(app => {
                userAppCounts[app.owner_id] = (userAppCounts[app.owner_id] || 0) + 1
            })

            // Converter para array e ordenar
            const topUsers = Object.entries(userAppCounts)
                .map(([owner_id, count]) => ({ owner_id, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10)

            // Buscar emails dos top users
            const topUsersWithEmails = await Promise.all(
                topUsers.map(async (user) => {
                    try {
                        const { data: authUser } = await supabase.auth.admin.getUserById(user.owner_id)
                        return {
                            owner_id: user.owner_id,
                            email: authUser?.user?.email || 'Usuário desconhecido',
                            count: user.count
                        }
                    } catch (error) {
                        return {
                            owner_id: user.owner_id,
                            email: 'Erro ao carregar',
                            count: user.count
                        }
                    }
                })
            )

            // Aplicações criadas por mês (últimos 6 meses)
            const sixMonthsAgo = new Date()
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

            const { data: monthlyApps } = await supabase
                .from('applications')
                .select('created_at')
                .gte('created_at', sixMonthsAgo.toISOString())

            // Agrupar por mês
            const monthlyStats = {}
            monthlyApps?.forEach(app => {
                const month = new Date(app.created_at).toISOString().substring(0, 7) // YYYY-MM
                monthlyStats[month] = (monthlyStats[month] || 0) + 1
            })

            // Buscar todos os domínios para agregação manual
            const { data: allDomains } = await supabase
                .from('app_domains')
                .select('status')

            // Agrupar manualmente por status
            const statusCounts = {}
            allDomains?.forEach(domain => {
                statusCounts[domain.status] = (statusCounts[domain.status] || 0) + 1
            })

            // Converter para formato esperado
            const domainsByStatus = Object.entries(statusCounts)
                .map(([status, count]) => ({ status, count }))

            const stats = {
                overview: {
                    totalUsers: totalUsers,
                    totalApplications: applicationsResult.count || 0,
                    totalDomains: domainsResult.count || 0,
                    totalProducts: productsResult.count || 0,
                    totalClients: clientsResult.count || 0
                },
                charts: {
                    monthlyApps: monthlyStats,
                    domainsByStatus: domainsByStatus || [],
                    topUsers: topUsersWithEmails || []
                },
                recent: {
                    applications: applicationsResult.data?.slice(0, 10) || [],
                    domains: domainsResult.data?.slice(0, 10) || []
                }
            }

            return new Response(JSON.stringify(stats), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // GET /superadmin/users - Lista de todos os usuários
        if (req.method === 'GET' && pathSegments.length === 1 && pathSegments[0] === 'users') {


            const page = parseInt(url.searchParams.get('page') || '1')
            const limit = parseInt(url.searchParams.get('limit') || '20')
            const offset = (page - 1) * limit
            const searchQuery = url.searchParams.get('search') || ''
            const planFilter = url.searchParams.get('plan') || ''



            // Buscar todas as aplicações dos usuários
            const { data: allUserApps, error } = await supabase
                .from('applications')
                .select('owner_id, created_at')

            if (error) throw error

            // Agrupar manualmente por owner_id
            const userStats = {}
            allUserApps?.forEach(app => {
                const ownerId = app.owner_id
                if (!userStats[ownerId]) {
                    userStats[ownerId] = {
                        owner_id: ownerId,
                        app_count: 0,
                        last_activity: app.created_at
                    }
                }
                userStats[ownerId].app_count += 1
                if (new Date(app.created_at) > new Date(userStats[ownerId].last_activity)) {
                    userStats[ownerId].last_activity = app.created_at
                }
            })

            // Converter para array, ordenar e paginar
            const users = Object.values(userStats)
                .sort((a, b) => b.app_count - a.app_count)
                .slice(offset, offset + limit)

            if (error) throw error

            // Buscar dados dos usuários via Auth Admin API
            const usersWithDetails = await Promise.all(
                users.map(async (user) => {
                    try {
                        const { data: authUser } = await supabase.auth.admin.getUserById(user.owner_id)

                        // Buscar nome do admin_profiles
                        const { data: profile } = await supabase
                            .from('admin_profiles')
                            .select('name')
                            .eq('user_id', user.owner_id)
                            .single()

                        // Simular plano baseado no número de apps (pode ser implementado via tabela no futuro)
                        let plan = 'free'
                        if (user.app_count >= 5) {
                            plan = 'advanced'
                        } else if (user.app_count >= 2) {
                            plan = 'pro'
                        }

                        return {
                            id: user.owner_id,
                            name: profile?.name || authUser?.user?.email || 'N/A',
                            email: authUser?.user?.email || 'N/A',
                            created_at: authUser?.user?.created_at || null,
                            app_count: user.app_count,
                            last_activity: user.last_activity,
                            plan: plan
                        }
                    } catch (error) {
                        return {
                            id: user.owner_id,
                            name: 'Erro ao carregar',
                            email: 'Erro ao carregar',
                            created_at: null,
                            app_count: user.app_count,
                            last_activity: user.last_activity,
                            plan: 'free'
                        }
                    }
                })
            )

            // Aplicar filtros
            let filteredUsers = usersWithDetails

            // Filtro por email/nome
            if (searchQuery) {
                filteredUsers = filteredUsers.filter(u =>
                    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    u.name.toLowerCase().includes(searchQuery.toLowerCase())
                )
            }

            // Filtro por plano
            if (planFilter && planFilter !== 'all') {
                filteredUsers = filteredUsers.filter(u => u.plan === planFilter)
            }

            return new Response(JSON.stringify({
                users: filteredUsers,
                pagination: {
                    page,
                    limit,
                    hasMore: users.length === limit
                },
                filters: {
                    search: searchQuery,
                    plan: planFilter
                }
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // GET /superadmin/applications - Lista de todas as aplicações
        if (req.method === 'GET' && pathSegments.length === 1 && pathSegments[0] === 'applications') {


            const page = parseInt(url.searchParams.get('page') || '1')
            const limit = parseInt(url.searchParams.get('limit') || '20')
            const offset = (page - 1) * limit
            const userId = url.searchParams.get('user_id') // Filtro por usuário

            let query = supabase
                .from('applications')
                .select(`
                    id,
                    name,
                    slug,
                    created_at,
                    owner_id,
                    app_type,
                    language
                `)
                .order('created_at', { ascending: false })

            // Se houver filtro de usuário, aplicar
            if (userId) {
                query = query.eq('owner_id', userId)
            } else {
                query = query.range(offset, offset + limit - 1)
            }

            const { data: applications, error } = await query

            if (error) throw error

            // Buscar emails dos donos
            const appsWithOwners = await Promise.all(
                applications.map(async (app) => {
                    try {
                        const { data: authUser } = await supabase.auth.admin.getUserById(app.owner_id)
                        return {
                            ...app,
                            owner_email: authUser?.user?.email || 'N/A'
                        }
                    } catch (error) {
                        return {
                            ...app,
                            owner_email: 'Erro ao carregar'
                        }
                    }
                })
            )


            return new Response(JSON.stringify({
                applications: appsWithOwners,
                pagination: {
                    page,
                    limit,
                    hasMore: applications.length === limit
                }
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // GET /superadmin/domains - Lista de todos os domínios
        if (req.method === 'GET' && pathSegments.length === 1 && pathSegments[0] === 'domains') {
            console.log('🌐 Fetching all domains...')

            const { data: domains, error } = await supabase
                .from('app_domains')
                .select(`
                    id,
                    domain,
                    status,
                    created_at,
                    verified_at,
                    applications (
                        name,
                        owner_id
                    )
                `)
                .order('created_at', { ascending: false })
                .limit(100)

            if (error) throw error

            return new Response(JSON.stringify(domains), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // GET /superadmin/user-details/:userId - Detalhes completos de um usuário
        if (req.method === 'GET' && pathSegments.length === 2 && pathSegments[0] === 'user-details') {
            const targetUserId = pathSegments[1]
            console.log('👤 Fetching user details for:', targetUserId)

            try {
                // Buscar aplicações do usuário
                const { data: userApps, error: appsError } = await supabase
                    .from('applications')
                    .select('id, name, slug, app_type, review_status, created_at')
                    .eq('owner_id', targetUserId)

                if (appsError) throw appsError

                // Buscar total de clientes (app_users) de todas as aplicações do usuário
                const appIds = userApps?.map(app => app.id) || []
                let totalClients = 0

                if (appIds.length > 0) {
                    const { count, error: clientsError } = await supabase
                        .from('app_users')
                        .select('id', { count: 'exact', head: true })
                        .in('application_id', appIds)

                    if (!clientsError) {
                        totalClients = count || 0
                    }
                }

                // Buscar domínios do usuário
                const { data: userDomains, error: domainsError } = await supabase
                    .from('app_domains')
                    .select('id, domain, status, created_at')
                    .in('application_id', appIds)

                // Buscar produtos do usuário
                const { data: userProducts, error: productsError } = await supabase
                    .from('marketplace_products')
                    .select('id, name, review_status, delivery_type, created_at')
                    .eq('owner_id', targetUserId)

                // Contar produtos por status
                const productsApproved = userProducts?.filter(p => p.review_status === 'approved').length || 0
                const productsRejected = userProducts?.filter(p => p.review_status === 'rejected').length || 0
                const productsPending = userProducts?.filter(p => p.review_status === 'pending_review').length || 0

                // Contar apps com área de membros (delivery_type === 'member_area')
                const appsWithMemberArea = userProducts?.filter(p => p.delivery_type === 'member_area').length || 0

                return new Response(JSON.stringify({
                    apps: userApps || [],
                    totalClients: totalClients,
                    domains: userDomains || [],
                    plan: 'Free', // Será implementado no futuro
                    products: {
                        total: userProducts?.length || 0,
                        approved: productsApproved,
                        rejected: productsRejected,
                        pending: productsPending,
                        memberAreaApps: appsWithMemberArea
                    }
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            } catch (error) {
                console.error('Error fetching user details:', error)
                return new Response(JSON.stringify({ error: error.message }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }
        }

        // DELETE /superadmin/user/:userId - Deletar usuário
        if (req.method === 'DELETE' && pathSegments.length === 2 && pathSegments[0] === 'user') {
            const targetUserId = pathSegments[1]
            console.log('🗑️ Deleting user:', targetUserId)

            try {
                const { error } = await supabase.auth.admin.deleteUser(targetUserId)

                if (error) throw error

                return new Response(JSON.stringify({ success: true, message: 'Usuário deletado com sucesso' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            } catch (error) {
                console.error('Error deleting user:', error)
                return new Response(JSON.stringify({ error: error.message }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }
        }

        // PUT /superadmin/user/:userId/ban - Desativar/banir usuário
        if (req.method === 'PUT' && pathSegments.length === 3 && pathSegments[0] === 'user' && pathSegments[2] === 'ban') {
            const targetUserId = pathSegments[1]
            const body = await req.json()
            const { ban } = body // ban: true para banir, false para desbanir

            console.log(ban ? '🚫 Banning user:' : '✅ Unbanning user:', targetUserId)

            try {
                const { error } = await supabase.auth.admin.updateUserById(targetUserId, {
                    ban_duration: ban ? '876000h' : 'none' // 100 anos ou nenhum
                })

                if (error) throw error

                return new Response(JSON.stringify({
                    success: true,
                    message: ban ? 'Usuário desativado com sucesso' : 'Usuário reativado com sucesso'
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            } catch (error) {
                console.error('Error banning/unbanning user:', error)
                return new Response(JSON.stringify({ error: error.message }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }
        }

        // GET /superadmin/bank-verifications - List pending bank account verifications
        if (req.method === 'GET' && pathSegments.length === 1 && pathSegments[0] === 'bank-verifications') {
            console.log('📋 Fetching pending bank verifications...')

            try {
                const { data: verifications, error } = await supabase
                    .from('payment_settings')
                    .select(`
                        id,
                        user_id,
                        account_holder_name,
                        date_of_birth,
                        phone_number,
                        tax_id_last4,
                        address_line1,
                        address_line2,
                        city,
                        state,
                        postal_code,
                        country,
                        bank_name,
                        bank_country,
                        account_type,
                        account_number,
                        routing_number,
                        iban,
                        bic_swift,
                        currency,
                        id_document_url,
                        address_proof_url,
                        bank_statement_url,
                        verification_status,
                        rejection_reason,
                        submitted_at,
                        approved_at,
                        approved_by
                    `)
                    .eq('verification_status', 'pending')
                    .not('bank_name', 'is', null)
                    .order('submitted_at', { ascending: false })

                if (error) throw error

                // Get user emails for each verification
                const verificationsWithEmail = await Promise.all(
                    (verifications || []).map(async (v) => {
                        const { data: userData } = await supabase.auth.admin.getUserById(v.user_id)
                        return {
                            ...v,
                            user_email: userData?.user?.email || 'Unknown'
                        }
                    })
                )

                return new Response(JSON.stringify({
                    verifications: verificationsWithEmail,
                    total: verificationsWithEmail.length
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            } catch (error) {
                console.error('Error fetching bank verifications:', error)
                return new Response(JSON.stringify({ error: error.message }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }
        }

        // PUT /superadmin/bank-verifications/:id/approve - Approve bank account
        if (req.method === 'PUT' && pathSegments.length === 3 && pathSegments[0] === 'bank-verifications' && pathSegments[2] === 'approve') {
            const verificationId = pathSegments[1]
            console.log('✅ Approving bank verification:', verificationId)

            try {
                // Get the payment settings record
                const { data: paymentSettings, error: fetchError } = await supabase
                    .from('payment_settings')
                    .select('user_id')
                    .eq('id', verificationId)
                    .single()

                if (fetchError || !paymentSettings) {
                    return new Response(JSON.stringify({ error: 'Verification not found' }), {
                        status: 404,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                }

                // Update verification status
                const { error: updateError } = await supabase
                    .from('payment_settings')
                    .update({
                        verification_status: 'approved',
                        is_verified: true,
                        approved_by: userId,
                        approved_at: new Date().toISOString(),
                        rejection_reason: null
                    })
                    .eq('id', verificationId)

                if (updateError) throw updateError

                // Create notification for the user
                await supabase.from('user_notifications').insert({
                    user_id: paymentSettings.user_id,
                    title: 'Bank Account Approved',
                    message: 'Your bank account has been verified and approved. You can now receive payouts.',
                    type: 'success',
                    read: false,
                    created_at: new Date().toISOString()
                })

                return new Response(JSON.stringify({
                    success: true,
                    message: 'Bank account approved successfully'
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            } catch (error) {
                console.error('Error approving bank verification:', error)
                return new Response(JSON.stringify({ error: error.message }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }
        }

        // PUT /superadmin/bank-verifications/:id/reject - Reject bank account
        if (req.method === 'PUT' && pathSegments.length === 3 && pathSegments[0] === 'bank-verifications' && pathSegments[2] === 'reject') {
            const verificationId = pathSegments[1]
            console.log('❌ Rejecting bank verification:', verificationId)

            try {
                const body = await req.json()
                const rejectionReason = body.reason || 'Your bank account verification was rejected. Please review the information and resubmit.'

                // Get the payment settings record
                const { data: paymentSettings, error: fetchError } = await supabase
                    .from('payment_settings')
                    .select('user_id')
                    .eq('id', verificationId)
                    .single()

                if (fetchError || !paymentSettings) {
                    return new Response(JSON.stringify({ error: 'Verification not found' }), {
                        status: 404,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                }

                // Update verification status
                const { error: updateError } = await supabase
                    .from('payment_settings')
                    .update({
                        verification_status: 'rejected',
                        is_verified: false,
                        rejection_reason: rejectionReason,
                        approved_by: null,
                        approved_at: null
                    })
                    .eq('id', verificationId)

                if (updateError) throw updateError

                // Create notification for the user
                await supabase.from('user_notifications').insert({
                    user_id: paymentSettings.user_id,
                    title: 'Bank Account Verification Rejected',
                    message: `Your bank account verification was rejected. Reason: ${rejectionReason}`,
                    type: 'error',
                    read: false,
                    created_at: new Date().toISOString()
                })

                return new Response(JSON.stringify({
                    success: true,
                    message: 'Bank account rejected'
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            } catch (error) {
                console.error('Error rejecting bank verification:', error)
                return new Response(JSON.stringify({ error: error.message }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }
        }

        // GET /superadmin/product-details/:productId - Detalhes completos do produto para review
        if (req.method === 'GET' && pathSegments.length === 2 && pathSegments[0] === 'product-details') {
            const productId = pathSegments[1]
            console.log('📦 Fetching product details for review:', productId)

            try {
                // Buscar informações básicas do produto
                const { data: product, error: productError } = await supabase
                    .from('marketplace_products')
                    .select('*')
                    .eq('id', productId)
                    .single()

                if (productError || !product) {
                    return new Response(JSON.stringify({ error: 'Product not found' }), {
                        status: 404,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                }

                // Buscar email do owner
                let ownerEmail = 'Unknown'
                try {
                    const { data: authUser } = await supabase.auth.admin.getUserById(product.owner_id)
                    ownerEmail = authUser?.user?.email || 'Unknown'
                } catch { }

                // Buscar módulos do produto
                const { data: modules, error: modulesError } = await supabase
                    .from('community_modules')
                    .select('*')
                    .eq('member_area_id', productId)
                    .order('order_position', { ascending: true })

                // Buscar lições de todos os módulos
                const moduleIds = modules?.map(m => m.id) || []
                let lessons: any[] = []

                if (moduleIds.length > 0) {
                    const { data: lessonsData, error: lessonsError } = await supabase
                        .from('community_lessons')
                        .select('*')
                        .in('module_id', moduleIds)
                        .order('order_position', { ascending: true })

                    lessons = lessonsData || []
                }

                // Agrupar lições por módulo
                const modulesWithLessons = (modules || []).map(module => ({
                    ...module,
                    lessons: lessons.filter(l => l.module_id === module.id)
                }))

                // Contar membros do produto
                const { count: memberCount } = await supabase
                    .from('product_members')
                    .select('id', { count: 'exact', head: true })
                    .eq('member_area_id', productId)

                return new Response(JSON.stringify({
                    product: {
                        ...product,
                        owner_email: ownerEmail
                    },
                    modules: modulesWithLessons,
                    stats: {
                        totalModules: modules?.length || 0,
                        totalLessons: lessons.length,
                        totalMembers: memberCount || 0
                    }
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            } catch (error) {
                console.error('Error fetching product details:', error)
                return new Response(JSON.stringify({ error: error.message }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }
        }

        // GET /superadmin/pending-products - Lista produtos pendentes de aprovação
        if (req.method === 'GET' && pathSegments.length === 1 && pathSegments[0] === 'pending-products') {
            console.log('📦 Fetching pending products...')

            try {
                const { data: products, error } = await supabase
                    .from('marketplace_products')
                    .select(`
                        id, 
                        name, 
                        description, 
                        price, 
                        currency, 
                        category,
                        delivery_type,
                        image_url, 
                        owner_id,
                        created_at, 
                        review_status
                    `)
                    .eq('review_status', 'pending_review')
                    .order('created_at', { ascending: false })

                if (error) throw error

                // Enrich products with owner email
                const enrichedProducts = await Promise.all(
                    (products || []).map(async (product) => {
                        try {
                            const { data: authUser } = await supabase.auth.admin.getUserById(product.owner_id)
                            return {
                                ...product,
                                owner_email: authUser?.user?.email || 'Unknown'
                            }
                        } catch {
                            return {
                                ...product,
                                owner_email: 'Unknown'
                            }
                        }
                    })
                )

                return new Response(JSON.stringify({ products: enrichedProducts }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            } catch (error) {
                console.error('Error fetching pending products:', error)
                return new Response(JSON.stringify({ error: error.message }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }
        }

        // PUT /superadmin/products/:id/approve - Aprovar produto
        if (req.method === 'PUT' && pathSegments.length === 3 && pathSegments[0] === 'products' && pathSegments[2] === 'approve') {
            const productId = pathSegments[1]
            console.log('✅ Approving product:', productId)

            try {
                // Get product info first
                const { data: product, error: fetchError } = await supabase
                    .from('marketplace_products')
                    .select('name, owner_id')
                    .eq('id', productId)
                    .single()

                if (fetchError || !product) {
                    return new Response(JSON.stringify({ error: 'Product not found' }), {
                        status: 404,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                }

                // Update product review status
                const { error: updateError } = await supabase
                    .from('marketplace_products')
                    .update({
                        review_status: 'approved',
                        reviewed_at: new Date().toISOString(),
                        reviewed_by: userId
                    })
                    .eq('id', productId)

                if (updateError) throw updateError

                // Send notification to product owner
                if (product.owner_id) {
                    await supabase.from('user_notifications').insert({
                        user_id: product.owner_id,
                        title: 'Product Approved',
                        message: `Your product "${product.name}" has been approved and is now live on the marketplace.`,
                        type: 'success',
                        read: false,
                        created_at: new Date().toISOString()
                    })
                }

                return new Response(JSON.stringify({
                    success: true,
                    message: 'Product approved successfully'
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            } catch (error) {
                console.error('Error approving product:', error)
                return new Response(JSON.stringify({ error: error.message }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }
        }

        // PUT /superadmin/products/:id/reject - Rejeitar produto
        if (req.method === 'PUT' && pathSegments.length === 3 && pathSegments[0] === 'products' && pathSegments[2] === 'reject') {
            const productId = pathSegments[1]
            console.log('❌ Rejecting product:', productId)

            try {
                const body = await req.json()
                const rejectionReason = body.reason || 'Your product was rejected. Please review and resubmit.'

                // Get product info first
                const { data: product, error: fetchError } = await supabase
                    .from('marketplace_products')
                    .select('name, owner_id')
                    .eq('id', productId)
                    .single()

                if (fetchError || !product) {
                    return new Response(JSON.stringify({ error: 'Product not found' }), {
                        status: 404,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                }

                // Update product review status
                const { error: updateError } = await supabase
                    .from('marketplace_products')
                    .update({
                        review_status: 'rejected',
                        review_notes: rejectionReason,
                        reviewed_at: new Date().toISOString(),
                        reviewed_by: userId
                    })
                    .eq('id', productId)

                if (updateError) throw updateError

                // Send notification to product owner
                if (product.owner_id) {
                    await supabase.from('user_notifications').insert({
                        user_id: product.owner_id,
                        title: 'Product Rejected',
                        message: `Your product "${product.name}" was rejected. Reason: ${rejectionReason}`,
                        type: 'error',
                        read: false,
                        created_at: new Date().toISOString()
                    })
                }

                return new Response(JSON.stringify({
                    success: true,
                    message: 'Product rejected'
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            } catch (error) {
                console.error('Error rejecting product:', error)
                return new Response(JSON.stringify({ error: error.message }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }
        }

        // GET /superadmin/pending-apps - Lista apps pendentes de aprovação
        if (req.method === 'GET' && pathSegments.length === 1 && pathSegments[0] === 'pending-apps') {
            console.log('📱 Fetching pending apps...')

            try {
                const { data: apps, error } = await supabase
                    .from('applications')
                    .select(`
                        id, 
                        name, 
                        slug,
                        logo_url,
                        app_type,
                        language,
                        owner_id,
                        created_at, 
                        review_status
                    `)
                    .eq('review_status', 'pending_review')
                    .order('created_at', { ascending: false })

                if (error) throw error

                // Enrich apps with owner email
                const enrichedApps = await Promise.all(
                    (apps || []).map(async (app) => {
                        try {
                            const { data: authUser } = await supabase.auth.admin.getUserById(app.owner_id)
                            return {
                                ...app,
                                owner_email: authUser?.user?.email || 'Unknown'
                            }
                        } catch {
                            return {
                                ...app,
                                owner_email: 'Unknown'
                            }
                        }
                    })
                )

                return new Response(JSON.stringify({ apps: enrichedApps }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            } catch (error) {
                console.error('Error fetching pending apps:', error)
                return new Response(JSON.stringify({ error: error.message }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }
        }

        // PUT /superadmin/apps/:id/approve - Aprovar app
        if (req.method === 'PUT' && pathSegments.length === 3 && pathSegments[0] === 'apps' && pathSegments[2] === 'approve') {
            const appId = pathSegments[1]
            console.log('✅ Approving app:', appId)

            try {
                // Get app info first
                const { data: app, error: fetchError } = await supabase
                    .from('applications')
                    .select('name, owner_id')
                    .eq('id', appId)
                    .single()

                if (fetchError || !app) {
                    return new Response(JSON.stringify({ error: 'App not found' }), {
                        status: 404,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                }

                // Update app review status
                const { error: updateError } = await supabase
                    .from('applications')
                    .update({
                        review_status: 'approved',
                        reviewed_at: new Date().toISOString(),
                        reviewed_by: userId
                    })
                    .eq('id', appId)

                if (updateError) throw updateError

                // Send notification to app owner
                if (app.owner_id) {
                    await supabase.from('user_notifications').insert({
                        user_id: app.owner_id,
                        title: 'App Approved',
                        message: `Your app "${app.name}" has been approved and is now live.`,
                        type: 'success',
                        read: false,
                        created_at: new Date().toISOString()
                    })
                }

                return new Response(JSON.stringify({
                    success: true,
                    message: 'App approved successfully'
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            } catch (error) {
                console.error('Error approving app:', error)
                return new Response(JSON.stringify({ error: error.message }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }
        }

        // PUT /superadmin/apps/:id/reject - Rejeitar app
        if (req.method === 'PUT' && pathSegments.length === 3 && pathSegments[0] === 'apps' && pathSegments[2] === 'reject') {
            const appId = pathSegments[1]
            console.log('❌ Rejecting app:', appId)

            try {
                const body = await req.json()
                const rejectionReason = body.reason || 'Your app was rejected. Please review and resubmit.'

                // Get app info first
                const { data: app, error: fetchError } = await supabase
                    .from('applications')
                    .select('name, owner_id')
                    .eq('id', appId)
                    .single()

                if (fetchError || !app) {
                    return new Response(JSON.stringify({ error: 'App not found' }), {
                        status: 404,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                }

                // Update app review status
                const { error: updateError } = await supabase
                    .from('applications')
                    .update({
                        review_status: 'rejected',
                        review_notes: rejectionReason,
                        reviewed_at: new Date().toISOString(),
                        reviewed_by: userId
                    })
                    .eq('id', appId)

                if (updateError) throw updateError

                // Send notification to app owner
                if (app.owner_id) {
                    await supabase.from('user_notifications').insert({
                        user_id: app.owner_id,
                        title: 'App Rejected',
                        message: `Your app "${app.name}" was rejected. Reason: ${rejectionReason}`,
                        type: 'error',
                        read: false,
                        created_at: new Date().toISOString()
                    })
                }

                return new Response(JSON.stringify({
                    success: true,
                    message: 'App rejected'
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            } catch (error) {
                console.error('Error rejecting app:', error)
                return new Response(JSON.stringify({ error: error.message }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }
        }

        return new Response(JSON.stringify({ error: 'Endpoint não encontrado' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error) {
        console.error('SuperAdmin function error:', error)
        return new Response(JSON.stringify({
            error: error.message,
            timestamp: new Date().toISOString()
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})