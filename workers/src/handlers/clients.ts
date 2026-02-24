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
        
        let body
        try {
            body = await request.json()
        } catch (e) {
            return new Response(
                JSON.stringify({ error: 'Invalid JSON body' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
        }
        
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
        let existingAuthUser = false

        // 2. Create user in auth
        const authResult = await supabase.auth.admin.createUser({
            email: email,
            email_confirm: true,
            user_metadata: {
                created_via: 'admin_manual',
                application_id: applicationId,
                name: name
            }
        })

        console.log('Auth result:', JSON.stringify(authResult))

        if (authResult.error) {
            const errorMsg = authResult.error.message || authResult.error.msg || JSON.stringify(authResult.error)
            if (errorMsg.includes('already been registered') || errorMsg.includes('already exists')) {
                // User exists, try to find them
                const listResult = await supabase.auth.admin.listUsers({ perPage: 1000 })
                const found = listResult.data?.users?.find((u: any) => u.email === email)
                if (found) {
                    userId = found.id
                    existingAuthUser = true
                } else {
                    return new Response(
                        JSON.stringify({ error: 'User already registered in another app. Contact support.' }),
                        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
                    )
                }
            } else {
                return new Response(
                    JSON.stringify({ error: errorMsg }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
                )
            }
        } else {
            userId = authResult.data.user.id
        }

        console.log('User ID:', userId)

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

