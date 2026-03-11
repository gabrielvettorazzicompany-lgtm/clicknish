/**
 * Customer Authentication Handler  
 * Sistema de autenticação para clientes (separado da auth.users)
 * Endpoints: login com senha, verificação de tokens, update de senha
 */

import type {
    CustomerAuth,
    CustomerAuthLog,
    CustomerLoginRequest,
    CustomerLoginResponse,
    CustomerVerifyTokenRequest,
    CustomerVerifyTokenResponse,
    CustomerPasswordUpdateRequest
} from '../types/customer-auth'

import {
    generateCustomerJWT,
    verifyCustomerJWT,
    generateJWTSecret,
    hashPassword,
    verifyPassword
} from '../utils/customer-jwt'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}

export async function handleCustomerAuth(request: Request, env: any): Promise<Response> {
    // Handle CORS
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    const url = new URL(request.url)
    const path = url.pathname.split('/').filter(Boolean)

    // Routing: /api/customer-auth/{action}
    if (path.length >= 3 && path[0] === 'api' && path[1] === 'customer-auth') {
        const action = path[2]

        try {
            switch (action) {
                case 'login':
                    return await handleCustomerLogin(request, env)
                case 'verify':
                    return await handleVerifyToken(request, env)
                case 'update-password':
                    return await handleUpdatePassword(request, env)
                default:
                    return new Response(
                        JSON.stringify({ error: 'Invalid authentication action' }),
                        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    )
            }
        } catch (error: any) {
            console.error('Customer auth error:', error)
            return new Response(
                JSON.stringify({ error: error.message || 'Internal server error' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }
    }

    return new Response(
        JSON.stringify({ error: 'Customer auth endpoint not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
}

/**
 * Login do cliente com email e senha
 * POST /api/customer-auth/login
 */
async function handleCustomerLogin(request: Request, env: any): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response(
            JSON.stringify({ error: 'Method not allowed' }),
            { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    const body: CustomerLoginRequest = await request.json()
    const { email, password, ip_address, user_agent } = body

    if (!email || !password) {
        return new Response(
            JSON.stringify({ error: 'Email and password are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

    try {
        // Buscar cliente
        const { data: customer, error } = await supabase
            .from('customer_auth')
            .select('*')
            .eq('email', email.toLowerCase())
            .single()

        if (error || !customer) {
            return createLoggedResponse({
                success: false,
                message: 'Invalid credentials'
            }, 401, supabase, email, 'login_failed', false, ip_address, user_agent, 'Customer not found')
        }

        // Verificar se conta não está bloqueada
        if (customer.locked_until && new Date(customer.locked_until) > new Date()) {
            const unlockTime = new Date(customer.locked_until).toLocaleString()
            return createLoggedResponse({
                success: false,
                message: `Account temporarily locked. Try again after ${unlockTime}`
            }, 423, supabase, email, 'login_failed', false, ip_address, user_agent, 'Account locked')
        }

        // Verificar senha
        const loginSuccess = await verifyPassword(password, customer.password_hash)

        if (!loginSuccess) {
            // Incrementar tentativas falhadas
            const newAttempts = (customer.login_attempts || 0) + 1
            let lockedUntil: string | null = null

            // Bloquear após 5 tentativas (por 15 minutos)
            if (newAttempts >= 5) {
                lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString()
            }

            await supabase
                .from('customer_auth')
                .update({
                    login_attempts: newAttempts,
                    locked_until: lockedUntil
                })
                .eq('id', customer.id)

            return createLoggedResponse({
                success: false,
                message: lockedUntil ? 'Account locked due to too many failed attempts' : 'Invalid credentials'
            }, 401, supabase, email, 'login_failed', false, ip_address, user_agent, 'Invalid credentials')
        }

        // Login bem-sucedido: gerar JWT
        const accessToken = await generateCustomerJWT(customer.id, customer.email, customer.jwt_secret)

        // Atualizar último login
        await supabase
            .from('customer_auth')
            .update({
                last_login_at: new Date().toISOString(),
                ip_address: ip_address,
                user_agent: user_agent,
                login_attempts: 0,
                locked_until: null
            })
            .eq('id', customer.id)

        return createLoggedResponse({
            success: true,
            message: 'Login successful',
            access_token: accessToken,
            customer_id: customer.id,
            email: customer.email,
            expires_in: 24 * 7 * 3600 // 7 dias em segundos
        }, 200, supabase, email, 'login_success', true, ip_address, user_agent)

    } catch (error: any) {
        console.error('Login error:', error)
        return createLoggedResponse({
            success: false,
            message: 'Login failed'
        }, 500, supabase, email, 'login_failed', false, ip_address, user_agent, error.message)
    }
}

/**
 * Verifica se o token JWT do cliente é válido
 * POST /customer-auth/verify
 */
async function handleVerifyToken(request: Request, env: any): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response(
            JSON.stringify({ error: 'Method not allowed' }),
            { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    const body: CustomerVerifyTokenRequest = await request.json()
    const { access_token } = body

    if (!access_token) {
        return new Response(
            JSON.stringify({ error: 'Access token is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

    try {
        // Primeiro, extrair o customer_id do token sem verificar (para buscar o secret)
        const tokenParts = access_token.split('.')
        if (tokenParts.length !== 3) {
            return new Response(
                JSON.stringify({ valid: false, error: 'Invalid token format' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const payload = JSON.parse(atob(tokenParts[1].replace(/-/g, '+').replace(/_/g, '/')))
        const customerId = payload.sub

        // Buscar customer para obter JWT secret
        const { data: customer, error } = await supabase
            .from('customer_auth')
            .select('jwt_secret, email')
            .eq('id', customerId)
            .single()

        if (error || !customer) {
            return new Response(
                JSON.stringify({ valid: false, error: 'Customer not found' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Verificar token com o secret do customer
        const verifiedPayload = await verifyCustomerJWT(access_token, customer.jwt_secret)

        if (!verifiedPayload) {
            return new Response(
                JSON.stringify({ valid: false, error: 'Invalid or expired token' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const response: CustomerVerifyTokenResponse = {
            valid: true,
            customer_id: verifiedPayload.sub,
            email: verifiedPayload.email,
            expires_at: verifiedPayload.exp
        }

        return new Response(
            JSON.stringify(response),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error: any) {
        console.error('Token verification error:', error)
        return new Response(
            JSON.stringify({ valid: false, error: 'Token verification failed' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
}

/**
 * Verifica se o token JWT do cliente é válido
 * POST /api/customer-auth/verify
 */
async function handleVerifyToken(request: Request, env: any): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response(
            JSON.stringify({ error: 'Method not allowed' }),
            { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    const body: CustomerVerifyTokenRequest = await request.json()
    const { access_token } = body

    if (!access_token) {
        return new Response(
            JSON.stringify({ error: 'Access token is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

    try {
        // Primeiro, extrair o customer_id do token sem verificar (para buscar o secret)
        const tokenParts = access_token.split('.')
        if (tokenParts.length !== 3) {
            return new Response(
                JSON.stringify({ valid: false, error: 'Invalid token format' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const payload = JSON.parse(atob(tokenParts[1].replace(/-/g, '+').replace(/_/g, '/')))
        const customerId = payload.sub

        // Buscar customer para obter JWT secret
        const { data: customer, error } = await supabase
            .from('customer_auth')
            .select('jwt_secret, email')
            .eq('id', customerId)
            .single()

        if (error || !customer) {
            return new Response(
                JSON.stringify({ valid: false, error: 'Customer not found' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Verificar token com o secret do customer
        const verifiedPayload = await verifyCustomerJWT(access_token, customer.jwt_secret)

        if (!verifiedPayload) {
            return new Response(
                JSON.stringify({ valid: false, error: 'Invalid or expired token' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const response: CustomerVerifyTokenResponse = {
            valid: true,
            customer_id: verifiedPayload.sub,
            email: verifiedPayload.email,
            expires_at: verifiedPayload.exp
        }

        return new Response(
            JSON.stringify(response),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error: any) {
        console.error('Token verification error:', error)
        return new Response(
            JSON.stringify({ valid: false, error: 'Token verification failed' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
}

/**
 * Helper: Cria um novo cliente na tabela customer_auth
 */
export async function createCustomerAccount(
    supabase: any,
    email: string,
    password: string
): Promise<CustomerAuth> {
    const passwordHash = await hashPassword(password)
    const jwtSecret = generateJWTSecret()

    const { data: customer, error } = await supabase
        .from('customer_auth')
        .insert({
            email: email.toLowerCase(),
            password_hash: passwordHash,
            jwt_secret: jwtSecret,
            created_at: new Date().toISOString()
        })
        .select()
        .single()

    if (error) {
        throw new Error('Failed to create customer account: ' + error.message)
    }

    // Log de criação
    await supabase
        .from('customer_auth_logs')
        .insert({
            customer_id: customer.id,
            email: email.toLowerCase(),
            action: 'account_created',
            success: true,
            created_at: new Date().toISOString()
        })

    return customer
}
async function handleUpdatePassword(request: Request, env: any): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response(
            JSON.stringify({ error: 'Method not allowed' }),
            { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    const body: CustomerPasswordUpdateRequest = await request.json()
    const { access_token, new_password } = body

    if (!access_token || !new_password) {
        return new Response(
            JSON.stringify({ error: 'Access token and new password are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    if (new_password.length < 6) {
        return new Response(
            JSON.stringify({ error: 'Password must be at least 6 characters' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

    try {
        // Verificar token primeiro
        const verifyResult = await handleVerifyToken(
            new Request(request.url, {
                method: 'POST',
                headers: request.headers,
                body: JSON.stringify({ access_token })
            }),
            env
        )

        const verifyData = await verifyResult.json()
        if (!verifyData.valid) {
            return new Response(
                JSON.stringify({ error: 'Invalid or expired token' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Hash da nova senha
        const passwordHash = await hashPassword(new_password)

        // Atualizar senha
        const { error } = await supabase
            .from('customer_auth')
            .update({ password_hash: passwordHash })
            .eq('id', verifyData.customer_id)

        if (error) {
            throw new Error('Failed to update password')
        }

        // Log da operação
        await supabase
            .from('customer_auth_logs')
            .insert({
                customer_id: verifyData.customer_id,
                email: verifyData.email,
                action: 'password_reset',
                success: true,
                created_at: new Date().toISOString()
            })

        return new Response(
            JSON.stringify({ success: true, message: 'Password updated successfully' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error: any) {
        console.error('Update password error:', error)
        return new Response(
            JSON.stringify({ error: 'Failed to update password' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
}

/**
 * Cria response e registra log automaticamente
 */
async function createLoggedResponse(
    response: any,
    status: number,
    supabase: any,
    email: string,
    action: string,
    success: boolean,
    ip_address?: string,
    user_agent?: string,
    error_message?: string,
    metadata: Record<string, any> = {}
): Promise<Response> {
    // Registrar log
    try {
        await supabase
            .from('customer_auth_logs')
            .insert({
                email: email.toLowerCase(),
                action,
                success,
                ip_address,
                user_agent,
                error_message,
                metadata,
                created_at: new Date().toISOString()
            })
    } catch (logError) {
        console.error('Failed to log auth event:', logError)
    }

    return new Response(
        JSON.stringify(response),
        { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
}

/**
 * Helper: Substitui supabase.auth.admin.createUser para clientes
 * Usa a mesma lógica derivedPassword para manter compatibilidade
 */
export async function createCustomerUser(
    supabase: any,
    env: any,
    customerData: {
        email: string
        name?: string
        phone?: string
        created_via?: string
    }
): Promise<{ user: { id: string } }> {
    const email = customerData.email.toLowerCase().trim()

    // Gerar senha derivada (mesma lógica do auth.ts)
    const derivedPassword = `derived_${email}_${env.SUPABASE_SERVICE_ROLE_KEY?.slice(-8)}`

    try {
        // Verificar se cliente já existe
        const { data: existingCustomer } = await supabase
            .from('customer_auth')
            .select('id')
            .eq('email', email)
            .single()

        if (existingCustomer) {
            // Cliente já existe, retornar o ID existente
            return { user: { id: existingCustomer.id } }
        }

        // Criar novo cliente
        const passwordHash = await hashPassword(derivedPassword)
        const jwtSecret = generateJWTSecret()

        const { data: customer, error } = await supabase
            .from('customer_auth')
            .insert({
                email,
                password_hash: passwordHash,
                jwt_secret: jwtSecret,
                created_at: new Date().toISOString()
            })
            .select('id')
            .single()

        if (error) {
            if (error.code === '23505') { // unique constraint violation
                // Race condition: outro request criou o customer no meio tempo
                const { data: retryCustomer } = await supabase
                    .from('customer_auth')
                    .select('id')
                    .eq('email', email)
                    .single()

                if (retryCustomer) {
                    return { user: { id: retryCustomer.id } }
                }
            }
            throw new Error(`Failed to create customer: ${error.message}`)
        }

        // Log de criação
        await supabase
            .from('customer_auth_logs')
            .insert({
                customer_id: customer.id,
                email,
                action: 'account_created',
                success: true,
                metadata: {
                    created_via: customerData.created_via || 'purchase',
                    name: customerData.name,
                    phone: customerData.phone
                },
                created_at: new Date().toISOString()
            })

        console.log(`✅ Customer account created: ${email} (${customer.id})`)
        return { user: { id: customer.id } }

    } catch (error: any) {
        console.error('createCustomerUser failed:', error)
        throw error
    }
}
}