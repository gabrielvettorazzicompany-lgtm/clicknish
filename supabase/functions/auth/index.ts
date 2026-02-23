import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Cliente com service_role para criar usuários
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})

Deno.serve(async (req) => {
    const url = new URL(req.url)
    const pathAfterFunction = url.pathname.replace(/^\/auth\/?/, '')
    const pathSegments = pathAfterFunction ? pathAfterFunction.split('/').filter(Boolean) : []

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // ============================================================
        // POST /auth/login - Login de membros
        // ============================================================
        if (req.method === 'POST' && pathSegments[0] === 'login') {
            const body = await req.json()
            const { email, password, appId, access_type } = body

            if (!email || !appId) {
                return new Response(JSON.stringify({ error: 'Email e appId são obrigatórios' }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            // Verificar se o app existe
            const { data: app, error: appError } = await supabaseAdmin
                .from('applications')
                .select('id, name, app_type, free_registration')
                .eq('id', appId)
                .single()

            if (appError || !app) {
                return new Response(JSON.stringify({ error: 'App não encontrado' }), {
                    status: 404,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            // Normalizar email
            const normalizedEmail = email.toLowerCase().trim()

            // Verificar se usuário já existe no auth.users
            const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
            const existingAuthUser = existingUsers?.users?.find(u => u.email === normalizedEmail)

            let authUser = existingAuthUser
            let isNewUser = false

            if (!authUser) {
                // Criar novo usuário no Supabase Auth
                isNewUser = true

                // Gerar senha aleatória se não fornecida (para login-simple/email-only)
                const userPassword = password || crypto.randomUUID()

                const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
                    email: normalizedEmail,
                    password: userPassword,
                    email_confirm: true, // Auto-confirmar email
                    user_metadata: {
                        source: 'member_area',
                        first_app_id: appId
                    }
                })

                if (createError) {
                    console.error('Erro ao criar usuário:', createError)
                    return new Response(JSON.stringify({ error: 'Erro ao criar conta: ' + createError.message }), {
                        status: 500,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                }

                authUser = newUser.user
            }

            // Fazer login para obter tokens
            let session = null

            // Derivar senha padrão para usuários email-only
            // Isso permite login automático sem o usuário saber a senha
            const derivedPassword = `derived_${normalizedEmail}_${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.slice(-8)}`

            if (access_type === 'email-only' || access_type === 'login-simple' || !password) {
                // Para usuários novos criados sem senha, atualizar com senha derivada
                if (isNewUser) {
                    await supabaseAdmin.auth.admin.updateUserById(authUser!.id, {
                        password: derivedPassword
                    })
                }

                // Tentar login com senha derivada
                const { data: loginResult, error: loginError } = await supabaseAdmin.auth.signInWithPassword({
                    email: normalizedEmail,
                    password: derivedPassword
                })

                if (loginError) {
                    // Se falhou, pode ser usuário antigo sem senha derivada
                    // Atualizar senha e tentar novamente
                    await supabaseAdmin.auth.admin.updateUserById(authUser!.id, {
                        password: derivedPassword
                    })

                    const { data: retryResult, error: retryError } = await supabaseAdmin.auth.signInWithPassword({
                        email: normalizedEmail,
                        password: derivedPassword
                    })

                    if (retryError) {
                        console.error('Erro ao criar sessão:', retryError)
                        // Fallback: retornar dados sem sessão completa
                        session = {
                            access_token: `member_${authUser!.id}_${Date.now()}`,
                            refresh_token: `refresh_${authUser!.id}_${Date.now()}`,
                            user: authUser
                        }
                    } else {
                        session = retryResult.session
                    }
                } else {
                    session = loginResult.session
                }
            } else {
                // Login com senha
                const { data: loginData, error: loginError } = await supabaseAdmin.auth.signInWithPassword({
                    email: normalizedEmail,
                    password: password
                })

                if (loginError) {
                    return new Response(JSON.stringify({ error: 'Email ou senha incorretos' }), {
                        status: 401,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                }

                session = loginData.session
            }

            // Verificar/criar registro em app_users
            const { data: appUser, error: appUserError } = await supabaseAdmin
                .from('app_users')
                .select('*')
                .eq('email', normalizedEmail)
                .eq('application_id', appId)
                .single()

            if (!appUser) {
                // Criar registro em app_users vinculado ao auth.users
                const { error: insertError } = await supabaseAdmin
                    .from('app_users')
                    .insert({
                        email: normalizedEmail,
                        application_id: appId,
                        user_id: authUser!.id, // Vincular ao auth.users!
                        status: 'active',
                        created_at: new Date().toISOString()
                    })

                if (insertError) {
                    console.error('Erro ao criar app_user:', insertError)
                }
            } else if (!appUser.user_id) {
                // Atualizar app_user existente para vincular ao auth.users
                const { error: updateError } = await supabaseAdmin
                    .from('app_users')
                    .update({ user_id: authUser!.id })
                    .eq('id', appUser.id)

                if (updateError) {
                    console.error('Erro ao atualizar app_user:', updateError)
                }
            }

            // Retornar dados de sessão
            return new Response(JSON.stringify({
                success: true,
                message: isNewUser ? 'Conta criada com sucesso' : 'Login realizado com sucesso',
                user: {
                    id: authUser!.id,
                    email: normalizedEmail,
                    application_id: appId
                },
                access_token: session?.access_token,
                refresh_token: session?.refresh_token,
                expires_at: session?.expires_at || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            }), {
                status: isNewUser ? 201 : 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // ============================================================
        // POST /auth/signup - Cadastro de membros (alias para login)
        // ============================================================
        if (req.method === 'POST' && pathSegments[0] === 'signup') {
            // Redirecionar para login (que também cria conta se não existir)
            const body = await req.json()
            const newReq = new Request(req.url.replace('/signup', '/login'), {
                method: 'POST',
                headers: req.headers,
                body: JSON.stringify(body)
            })
            return Deno.serve(newReq)
        }

        // ============================================================
        // POST /auth/refresh - Renovar token
        // ============================================================
        if (req.method === 'POST' && pathSegments[0] === 'refresh') {
            const body = await req.json()
            const { refresh_token } = body

            if (!refresh_token) {
                return new Response(JSON.stringify({ error: 'refresh_token é obrigatório' }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            const { data, error } = await supabaseAdmin.auth.refreshSession({ refresh_token })

            if (error) {
                return new Response(JSON.stringify({ error: 'Token inválido ou expirado' }), {
                    status: 401,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            return new Response(JSON.stringify({
                access_token: data.session?.access_token,
                refresh_token: data.session?.refresh_token,
                expires_at: data.session?.expires_at
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // ============================================================
        // GET /auth/me - Obter usuário atual
        // ============================================================
        if (req.method === 'GET' && pathSegments[0] === 'me') {
            const authHeader = req.headers.get('Authorization')

            if (!authHeader?.startsWith('Bearer ')) {
                return new Response(JSON.stringify({ error: 'Token não fornecido' }), {
                    status: 401,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            const token = authHeader.replace('Bearer ', '')

            // Criar cliente com token do usuário
            const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
                global: {
                    headers: { Authorization: `Bearer ${token}` }
                }
            })

            const { data: { user }, error } = await supabaseClient.auth.getUser()

            if (error || !user) {
                return new Response(JSON.stringify({ error: 'Token inválido' }), {
                    status: 401,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            return new Response(JSON.stringify({
                id: user.id,
                email: user.email,
                created_at: user.created_at
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // ============================================================
        // POST /auth/logout - Logout
        // ============================================================
        if (req.method === 'POST' && pathSegments[0] === 'logout') {
            // Supabase Auth é stateless no servidor, então só retornamos sucesso
            // O frontend deve limpar os tokens localmente
            return new Response(JSON.stringify({ success: true, message: 'Logout realizado' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        return new Response(JSON.stringify({ error: 'Endpoint não encontrado' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error) {
        console.error('Auth function error:', error)
        return new Response(JSON.stringify({
            error: error.message,
            timestamp: new Date().toISOString()
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
