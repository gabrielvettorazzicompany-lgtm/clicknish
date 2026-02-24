// @ts-nocheck
import { createClient } from '../lib/supabase'

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
        const body = await request.json()
        const { email, applicationId, productIds, name, phone } = body

        // 1. Check if the user already exists in app_users for this app
        const { data: existingAppUser } = await supabase
            .from('app_users')
            .select('*')
            .eq('email', email)
            .eq('application_id', applicationId)
            .maybeSingle()

        if (existingAppUser) {
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
        let existingAuthUser = false

        // 2. Check if the user already exists in auth
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: email,
            email_confirm: true,
            user_metadata: {
                created_via: 'admin_manual',
                application_id: applicationId,
                name: name
            }
        })

        if (authError) {
            if (authError.message?.includes('already been registered') || authError.message?.includes('already exists')) {
                const { data: allUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 })
                const found = allUsers?.users?.find(u => u.email === email)
                if (found) {
                    userId = found.id
                    existingAuthUser = true
                } else {
                    throw new Error('User already registered in another app. Contact support.')
                }
            } else {
                throw authError
            }
        } else {
            userId = authData.user.id
        }

        // 3. Create record in app_users
        const { data: newUser, error: userError } = await supabase
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

        if (userError) {
            if (!existingAuthUser) {
                await supabase.auth.admin.deleteUser(userId)
            }
            throw userError
        }

        // If there are products, create access
        if (productIds && productIds.length > 0) {
            const accessRecords = productIds.map((productId: string) => ({
                user_id: userId,
                product_id: productId,
                application_id: applicationId,
                access_type: 'manual',
                is_active: true,
                created_at: new Date().toISOString()
            }))

            const { error: accessError } = await supabase
                .from('user_product_access')
                .insert(accessRecords)

            if (accessError) {
                throw accessError
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                user: newUser,
                message: 'Client created successfully'
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 201
            }
        )

    } catch (error: any) {
        console.error('Error:', error)
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
