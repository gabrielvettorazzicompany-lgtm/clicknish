/**
 * Customer Authentication System Types
 * Sistema de autenticação personalizada para clientes (separado da auth.users)
 */

export interface CustomerAuth {
    id: string
    email: string
    password_hash: string
    jwt_secret: string
    last_login_at?: string
    ip_address?: string
    user_agent?: string
    login_attempts: number
    locked_until?: string
    created_at: string
    updated_at: string
}

export interface CustomerAuthLog {
    id: string
    customer_id?: string
    email: string
    action: 'login_success' | 'login_failed' | 'password_reset' | 'account_created'
    ip_address?: string
    user_agent?: string
    success: boolean
    error_message?: string
    metadata: Record<string, any>
    created_at: string
}

export interface CustomerJWTPayload {
    sub: string          // customer_id
    email: string        // email do cliente
    iat: number         // issued at
    exp: number         // expires at
    jti: string         // JWT ID único
    type: 'customer'    // tipo de token
}

export interface CustomerLoginRequest {
    email: string
    password: string       // senha obrigatória (derivada ou real)
    ip_address?: string
    user_agent?: string
}

export interface CustomerLoginResponse {
    success: boolean
    message: string
    access_token?: string  // JWT token
    customer_id?: string
    email?: string
    expires_in?: number    // segundos até expirar o token
}

export interface CustomerPasswordUpdateRequest {
    access_token: string
    new_password: string
}

export interface CustomerVerifyTokenRequest {
    access_token: string
}

export interface CustomerVerifyTokenResponse {
    valid: boolean
    customer_id?: string
    email?: string
    expires_at?: number
    error?: string
}