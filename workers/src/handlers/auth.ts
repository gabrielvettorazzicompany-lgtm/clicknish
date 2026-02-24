// @ts-nocheck
import { createClient } from '../lib/supabase'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

export async function handleAuth(request: Request, env: any, pathSegments: string[]): Promise<Response> {
    if (request.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
        const supabaseUrl = env.SUPABASE_URL

        // POST /api/auth/login - Login de membros
        if (request.method === 'POST' && pathSegments[0] === 'login') {
            const body = await request.json()
            const { email, password, appId, access_type } = body

            if (!email || !appId) {
                return new Response(JSON.stringify({ error: 'Email e appId são obrigatórios' }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            // Verificar se o app existe
            const { data: app, error: appError } = await supabase
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

            const normalizedEmail = email.toLowerCase().trim()

            // Verificar se usuário já existe no auth.users
            const { data: existingUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 })
            let authUser = existingUsers?.users?.find(u => u.email === normalizedEmail)
            let isNewUser = false

            if (!authUser) {
                isNewUser = true
                const userPassword = password || crypto.randomUUID()

                const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
                    email: normalizedEmail,
                    password: userPassword,
                    email_confirm: true,
                    user_metadata: {
                        source: 'member_area',
                        first_app_id: appId
                    }
                })

                if (createError) {
                    if (createError.message?.includes('already been registered') || createError.message?.includes('already exists')) {
                        const { data: retryUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 })
                        const foundUser = retryUsers?.users?.find(u => u.email === normalizedEmail)
                        if (foundUser) {
                            authUser = foundUser
                        } else {
                            return new Response(JSON.stringify({ error: 'Erro ao localizar conta existente. Tente novamente.' }), {
                                status: 500,
                                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                            })
                        }
                    } else {
                        return new Response(JSON.stringify({ error: 'Erro ao criar conta: ' + createError.message }), {
                            status: 500,
                            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                        })
                    }
                } else {
                    authUser = newUser.user
                }
            }

            let session = null
            const derivedPassword = `derived_${normalizedEmail}_${env.SUPABASE_SERVICE_ROLE_KEY?.slice(-8)}`

            if (access_type === 'email-only' || access_type === 'login-simple' || !password) {
                if (isNewUser) {
                    await supabase.auth.admin.updateUserById(authUser!.id, {
                        password: derivedPassword
                    })
                }

                const { data: loginResult, error: loginError } = await supabase.auth.signInWithPassword({
                    email: normalizedEmail,
                    password: derivedPassword
                })

                if (loginError) {
                    await supabase.auth.admin.updateUserById(authUser!.id, {
                        password: derivedPassword
                    })

                    const { data: retryResult, error: retryError } = await supabase.auth.signInWithPassword({
                        email: normalizedEmail,
                        password: derivedPassword
                    })

                    if (retryError) {
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
                const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
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
            const { data: appUser } = await supabase
                .from('app_users')
                .select('*')
                .eq('email', normalizedEmail)
                .eq('application_id', appId)
                .single()

            if (!appUser) {
                await supabase
                    .from('app_users')
                    .insert({
                        email: normalizedEmail,
                        application_id: appId,
                        user_id: authUser!.id,
                        status: 'active',
                        created_at: new Date().toISOString()
                    })
            } else if (!appUser.user_id) {
                await supabase
                    .from('app_users')
                    .update({ user_id: authUser!.id })
                    .eq('id', appUser.id)
            }

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

        // POST /api/auth/signup - Alias para login
        if (request.method === 'POST' && pathSegments[0] === 'signup') {
            const body = await request.json()
            const newUrl = request.url.replace('/signup', '/login')
            const newRequest = new Request(newUrl, {
                method: 'POST',
                headers: request.headers,
                body: JSON.stringify(body)
            })
            return handleAuth(newRequest, env, ['login'])
        }

        // POST /api/auth/refresh - Renovar token
        if (request.method === 'POST' && pathSegments[0] === 'refresh') {
            const body = await request.json()
            const { refresh_token } = body

            if (!refresh_token) {
                return new Response(JSON.stringify({ error: 'refresh_token é obrigatório' }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            const { data, error } = await supabase.auth.refreshSession({ refresh_token })

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

        // GET /api/auth/me - Obter usuário atual
        if (request.method === 'GET' && pathSegments[0] === 'me') {
            const authHeader = request.headers.get('Authorization')

            if (!authHeader?.startsWith('Bearer ')) {
                return new Response(JSON.stringify({ error: 'Token não fornecido' }), {
                    status: 401,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            const token = authHeader.replace('Bearer ', '')

            // For member tokens, extract user ID
            if (token.startsWith('member_')) {
                const parts = token.split('_')
                const userId = parts[1]

                const { data: authUser } = await supabase.auth.admin.getUserById(userId)

                if (!authUser?.user) {
                    return new Response(JSON.stringify({ error: 'Token inválido' }), {
                        status: 401,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                }

                return new Response(JSON.stringify({
                    id: authUser.user.id,
                    email: authUser.user.email,
                    created_at: authUser.user.created_at
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            const { data: { user }, error } = await supabase.auth.getUser(token)

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

        // POST /api/auth/logout - Logout
        if (request.method === 'POST' && pathSegments[0] === 'logout') {
            return new Response(JSON.stringify({ success: true, message: 'Logout realizado' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        return new Response(JSON.stringify({ error: 'Endpoint não encontrado' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error: any) {
        console.error('Auth function error:', error)
        return new Response(JSON.stringify({
            error: error.message,
            timestamp: new Date().toISOString()
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
}
