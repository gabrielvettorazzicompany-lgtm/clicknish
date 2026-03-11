// @ts-nocheck
import { createClient } from '../lib/supabase'
import { createCustomerUser } from './customer-auth'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

export async function handleClients(request: Request, env: any): Promise<Response> {
    if (request.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

        let body
        try {
            body = await request.json()
        } catch (e) {
            return new Response(
                JSON.stringify({ error: 'Invalid JSON body' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
        }

        // ============================================================
        // DELETE - Deletar cliente
        // ============================================================
        if (request.method === 'DELETE') {
            const { clientId, table = 'app_users', deleteFromAuth = true } = body

            if (!clientId) {
                return new Response(
                    JSON.stringify({ error: 'clientId é obrigatório' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
                )
            }

            // Buscar o cliente para obter o user_id
            const { data: client, error: findError } = await supabase
                .from(table)
                .select('id, user_id, email')
                .eq('id', clientId)
                .maybeSingle()

            if (findError || !client) {
                return new Response(
                    JSON.stringify({ error: 'Cliente não encontrado' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
                )
            }

            const userId = client.user_id

            // Deletar acessos relacionados
            if (userId) {
                // Deletar acessos a produtos
                await supabase
                    .from('user_product_access')
                    .delete()
                    .eq('user_id', userId)
                    .select()

                // Deletar acessos a member areas
                await supabase
                    .from('user_member_area_access')
                    .delete()
                    .eq('user_id', userId)
                    .select()
            }

            // Deletar o registro da tabela (app_users ou member_profiles)
            const { error: deleteError } = await supabase
                .from(table)
                .delete()
                .eq('id', clientId)
                .select()

            if (deleteError) {
                console.error('Erro ao deletar cliente:', deleteError)
                return new Response(
                    JSON.stringify({ error: 'Erro ao deletar cliente: ' + deleteError.message }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
                )
            }

            // Se tem user_id e deve deletar do auth, verificar se não tem outros registros
            if (userId && deleteFromAuth) {
                const [appUsersResult, memberProfilesResult] = await Promise.all([
                    supabase.from('app_users').select('id').eq('user_id', userId),
                    supabase.from('member_profiles').select('id').eq('user_id', userId)
                ])

                const hasOtherAppUsers = (appUsersResult.data?.length || 0) > 0
                const hasOtherMemberProfiles = (memberProfilesResult.data?.length || 0) > 0

                // Só deletar do customer_auth se não tiver outros registros
                if (!hasOtherAppUsers && !hasOtherMemberProfiles) {
                    try {
                        // Deletar logs primeiro
                        await supabase
                            .from('customer_auth_logs')
                            .delete()
                            .eq('customer_id', userId)

                        // Deletar from customer_auth (não auth.users)
                        await supabase
                            .from('customer_auth')
                            .delete()
                            .eq('id', userId)

                        console.log('Customer completamente deletado:', userId)
                    } catch (authError) {
                        console.error('Erro ao deletar do customer_auth:', authError)
                    }
                } else {
                    console.log('Customer ainda tem outros registros, mantendo customer_auth:', userId)
                }
            }

            return new Response(
                JSON.stringify({ success: true, message: 'Cliente deletado com sucesso' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            )
        }

        // ============================================================
        // POST - Criar cliente (lógica existente)
        // ============================================================
        const { email, applicationId, productIds, name, phone } = body

        if (!email) {
            return new Response(
                JSON.stringify({ error: 'Email is required' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
        }

        if (!applicationId) {
            return new Response(
                JSON.stringify({ error: 'Application ID is required' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
        }

        console.log('Creating client:', { email, applicationId, name })

        // 1. Check if the user already exists in app_users for this app
        const existingResult = await supabase
            .from('app_users')
            .select('*')
            .eq('email', email)
            .eq('application_id', applicationId)
            .maybeSingle()

        if (existingResult.data) {
            return new Response(
                JSON.stringify({
                    error: 'A user with this email address has already been registered'
                }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 400
                }
            )
        }

        let userId: string

        // 2. Create customer in our auth system
        console.log('🔧 [DEBUG] Creating customer auth for:', email)
        try {
            const authResult = await createCustomerUser(supabase, env, {
                email: email,
                name: name,
                created_via: 'admin_manual'
            })

            userId = authResult.user.id
            console.log('✅ [DEBUG] Customer auth created successfully. User ID:', userId)
        } catch (authError: any) {
            console.error('❌ [DEBUG] Failed to create customer auth:', authError)
            throw new Error(`Authentication creation failed: ${authError.message}`)
        }

        // 3. Create record in app_users
        const insertResult = await supabase
            .from('app_users')
            .insert({
                user_id: userId,
                email: email,
                full_name: name || null,
                phone: phone || null,
                application_id: applicationId,
                status: 'active',
                created_at: new Date().toISOString()
            })
            .select()
            .single()

        if (insertResult.error) {
            console.error('Insert error:', insertResult.error)
            if (!existingAuthUser) {
                await supabase.auth.admin.deleteUser(userId)
            }
            return new Response(
                JSON.stringify({ error: insertResult.error.message || 'Error creating app user' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
            )
        }

        // 4. If there are products, create access
        if (productIds && productIds.length > 0) {
            const accessRecords = productIds.map((productId: string) => ({
                user_id: userId,
                product_id: productId,
                application_id: applicationId,
                access_type: 'manual',
                is_active: true,
                created_at: new Date().toISOString()
            }))

            const accessResult = await supabase
                .from('user_product_access')
                .insert(accessRecords)

            if (accessResult.error) {
                console.error('Access error:', accessResult.error)
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                user: insertResult.data,
                message: 'Client created successfully'
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 201
            }
        )

    } catch (error: any) {
        console.error('Handler error:', error)
        return new Response(
            JSON.stringify({
                error: error.message || 'Error creating client'
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500
            }
        )
    }
}

