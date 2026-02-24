// @ts-nocheck
import { createClient } from '../lib/supabase'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

export async function handleMembers(request: Request, env: any): Promise<Response> {
    if (request.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createClient(env)
        const body = await request.json()
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
            userId = existingAuthUser.id
        } else {
            // Criar novo usuário no Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                email: email,
                email_confirm: true,
                user_metadata: {
                    created_via: 'admin_manual_member',
                    member_area_id: marketplaceProductId,
                    name: name
                }
            })

            if (authError) {
                throw authError
            }

            userId = authData.user.id
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
            if (!existingAuthUser) {
                await supabase.auth.admin.deleteUser(userId)
            }
            throw memberError
        }

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
            throw accessError
        }

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

    } catch (error: any) {
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
}
