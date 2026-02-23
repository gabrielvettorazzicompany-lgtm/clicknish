import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const body = await req.json()
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

        // 2. Check if the user already exists in auth (may have been created in another app/member area)
        // First try to create - if fails with duplicate, then get existing
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
            // Check if it's a duplicate email error
            if (authError.message?.includes('already been registered') || authError.message?.includes('already exists')) {
                // User exists in auth, get their ID via listUsers
                const { data: allUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 })
                const found = allUsers?.users?.find(u => u.email === email)
                if (found) {
                    userId = found.id
                    existingAuthUser = true
                } else {
                    // Last attempt - getUserByEmail (if available)
                    try {
                        const { data: userByEmail } = await supabase.auth.admin.getUserById(email)
                        if (userByEmail?.user) {
                            userId = userByEmail.user.id
                            existingAuthUser = true
                        } else {
                            throw new Error('Could not find existing user')
                        }
                    } catch {
                        throw new Error('User already registered in another app. Contact support.')
                    }
                }
            } else {
                console.error('Error creating auth user:', authError)
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
            console.error('Error creating app_user:', userError)
            // If it was a new auth user and it failed, try to revert
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
                console.error('Error creating product access:', accessError)
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

    } catch (error) {
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
})
