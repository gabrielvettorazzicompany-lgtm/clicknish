/**
 * Customer Authentication JWT Utilities
 * Sistema de JWT para autenticação de clientes usando crypto.subtle
 */

import type { CustomerJWTPayload } from '../types/customer-auth'

// Configurações do JWT
const JWT_EXPIRY_HOURS = 24 * 7 // 7 dias
const JWT_ISSUER = 'clicknish-customer-auth'
const JWT_ALGORITHM = 'HS256'

/**
 * Gera um token JWT para o cliente
 */
export async function generateCustomerJWT(
    customerId: string,
    email: string,
    secret: string
): Promise<string> {
    const header = {
        alg: JWT_ALGORITHM,
        typ: 'JWT'
    }

    const now = Math.floor(Date.now() / 1000)
    const payload: CustomerJWTPayload = {
        sub: customerId,
        email,
        iat: now,
        exp: now + (JWT_EXPIRY_HOURS * 3600),
        jti: crypto.randomUUID(),
        type: 'customer'
    }

    const encodedHeader = base64UrlEncode(JSON.stringify(header))
    const encodedPayload = base64UrlEncode(JSON.stringify(payload))
    const data = `${encodedHeader}.${encodedPayload}`

    // Gerar assinatura HMAC-SHA256
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    )

    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
    const encodedSignature = base64UrlEncode(signature)

    return `${data}.${encodedSignature}`
}

/**
 * Verifica e decodifica um token JWT do cliente
 */
export async function verifyCustomerJWT(
    token: string,
    secret: string
): Promise<CustomerJWTPayload | null> {
    try {
        const parts = token.split('.')
        if (parts.length !== 3) {
            throw new Error('Invalid JWT format')
        }

        const [encodedHeader, encodedPayload, encodedSignature] = parts
        const data = `${encodedHeader}.${encodedPayload}`

        // Verificar assinatura
        const key = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(secret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['verify']
        )

        const signature = base64UrlDecode(encodedSignature)
        const isValid = await crypto.subtle.verify('HMAC', key, signature, new TextEncoder().encode(data))

        if (!isValid) {
            throw new Error('Invalid JWT signature')
        }

        // Decodificar payload
        const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedPayload))) as CustomerJWTPayload

        // Verificar expiração
        const now = Math.floor(Date.now() / 1000)
        if (payload.exp && payload.exp < now) {
            throw new Error('JWT token expired')
        }

        // Verificar tipo
        if (payload.type !== 'customer') {
            throw new Error('Invalid token type')
        }

        return payload
    } catch (error) {
        console.error('JWT verification failed:', error)
        return null
    }
}

/**
 * Gera hash bcrypt da senha usando WebCrypto (PBKDF2)
 * Para produção, considere usar uma lib dedicada como bcryptjs no futuro
 */
export async function hashPassword(password: string): Promise<string> {
    // Usar PBKDF2 com sal aleatório (mais simples que bcrypt em WebCrypto)
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const encodedPassword = new TextEncoder().encode(password)

    const key = await crypto.subtle.importKey(
        'raw',
        encodedPassword,
        'PBKDF2',
        false,
        ['deriveBits']
    )

    const derivedBits = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt,
            iterations: 100000, // 100k iterations
            hash: 'SHA-256'
        },
        key,
        256 // 32 bytes
    )

    // Concatenar salt + hash e codificar em base64
    const combined = new Uint8Array(salt.length + derivedBits.byteLength)
    combined.set(salt)
    combined.set(new Uint8Array(derivedBits), salt.length)

    return btoa(String.fromCharCode(...combined))
}

/**
 * Verifica senha contra hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
        // Decodificar hash
        const combined = Uint8Array.from(atob(hash), c => c.charCodeAt(0))
        const salt = combined.slice(0, 16)
        const storedHash = combined.slice(16)

        // Derivar hash da senha fornecida
        const encodedPassword = new TextEncoder().encode(password)
        const key = await crypto.subtle.importKey(
            'raw',
            encodedPassword,
            'PBKDF2',
            false,
            ['deriveBits']
        )

        const derivedBits = await crypto.subtle.deriveBits(
            {
                name: 'PBKDF2',
                salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            key,
            256
        )

        // Comparar hashes
        const derivedHash = new Uint8Array(derivedBits)
        return derivedHash.every((byte, i) => byte === storedHash[i])
    } catch (error) {
        console.error('Password verification failed:', error)
        return false
    }
}

/**
 * Gera secret JWT aleatório para novo cliente
 */
export function generateJWTSecret(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(32))
    return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
}

/**
 * Utilitários de Base64 URL encoding
 */
function base64UrlEncode(data: string | ArrayBuffer): string {
    let base64: string

    if (typeof data === 'string') {
        base64 = btoa(data)
    } else {
        const bytes = new Uint8Array(data)
        base64 = btoa(String.fromCharCode(...bytes))
    }

    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function base64UrlDecode(data: string): Uint8Array {
    // Adicionar padding se necessário
    const padded = data + '=='.substring(0, (4 - data.length % 4) % 4)
    const base64 = padded.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(base64)
    return Uint8Array.from(binary, c => c.charCodeAt(0))
}