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
        const { email, marketplaceProductId, name, phone } = body



        // 1. Verificar se o membro já existe para este produto de marketplace
        const { data: existingMember } = await supabase
            .from('member_profiles')
            .select('*')
            .eq('email', email)
            .eq('product_id', marketplaceProductId)
            .maybeSingle()

        if (existingMember) {
            return new Response(
                JSON.stringify({
                    error: 'A member with this email address has already been registered for this membership area'
                }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 400
                }
            )
        }

        let userId: string

        // 2. Verificar se o usuário já existe no auth
        const { data: existingAuthUsers } = await supabase.auth.admin.listUsers()
        const existingAuthUser = existingAuthUsers?.users?.find(u => u.email === email)

        if (existingAuthUser) {
            // Usuário já existe na autenticação, apenas usar o ID existente
            userId = existingAuthUser.id
            console.log('✅ Using existing auth user:', userId)
        } else {
            // Criar novo usuário no Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                email: email,
                email_confirm: true, // Auto-confirma o email
                user_metadata: {
                    created_via: 'admin_manual_member',
                    member_area_id: marketplaceProductId,
                    name: name
                }
            })

            if (authError) {
                console.error('Error creating auth user:', authError)
                throw authError
            }

            userId = authData.user.id
            console.log('✅ New auth user created:', userId)
        }

        // 3. Criar registro no member_profiles
        const { data: newMember, error: memberError } = await supabase
            .from('member_profiles')
            .insert({
                email: email,
                name: name || null,
                phone: phone || null,
                product_id: marketplaceProductId,
                created_at: new Date().toISOString()
            })
            .select()
            .single()

        if (memberError) {
            console.error('Error creating member_profile:', memberError)
            // Se foi um novo usuário auth e falhou, tentar reverter
            if (!existingAuthUser) {
                await supabase.auth.admin.deleteUser(userId)
            }
            throw memberError
        }

        console.log('✅ Member profile created:', userId)

        // 4. Criar acesso ao member area (marketplace)
        const { error: accessError } = await supabase
            .from('user_member_area_access')
            .insert({
                user_id: userId,
                member_area_id: marketplaceProductId,
                access_type: 'manual',
                is_active: true,
                created_at: new Date().toISOString()
            })

        if (accessError) {
            console.error('Error creating member area access:', accessError)
            throw accessError
        }

        console.log('✅ Member area access created')

        return new Response(
            JSON.stringify({
                success: true,
                member: newMember,
                message: 'Member created successfully'
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
                error: error.message || 'Error creating member'
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500
            }
        )
    }
})
