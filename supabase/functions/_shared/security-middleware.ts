/**
 * Security Middleware - Rate Limiting & IP Protection
 * Protege edge functions contra abuso e ataques
 */

interface RateLimitConfig {
  maxRequests: number
  windowMs: number
  blockDurationMs?: number
}

interface SecurityContext {
  ip: string
  endpoint: string
  timestamp: number
  blocked?: boolean
}

// Cache em memória para rate limiting (Edge runtime)
const requestsCache = new Map<string, SecurityContext[]>()
const blockedIPs = new Map<string, number>()

/**
 * Rate Limiter - Limita requisições por IP
 */
export async function rateLimit(
  request: Request,
  config: RateLimitConfig = {
    maxRequests: 10,
    windowMs: 60000, // 1 minuto
    blockDurationMs: 300000 // 5 minutos de bloqueio
  }
): Promise<{ allowed: boolean; reason?: string; retryAfter?: number }> {
  
  const ip = getClientIP(request)
  const endpoint = new URL(request.url).pathname
  const now = Date.now()

  // Verificar se IP está bloqueado
  const blockedUntil = blockedIPs.get(ip)
  if (blockedUntil && now < blockedUntil) {
    const retryAfter = Math.ceil((blockedUntil - now) / 1000)
    return {
      allowed: false,
      reason: 'IP_BLOCKED',
      retryAfter
    }
  }

  // Limpar bloqueio expirado
  if (blockedUntil && now >= blockedUntil) {
    blockedIPs.delete(ip)
  }

  // Obter histórico de requisições do IP
  const key = `${ip}:${endpoint}`
  let requests = requestsCache.get(key) || []

  // Limpar requisições antigas
  requests = requests.filter(r => now - r.timestamp < config.windowMs)

  // Verificar limite
  if (requests.length >= config.maxRequests) {
    // Bloquear IP se configurado
    if (config.blockDurationMs) {
      blockedIPs.set(ip, now + config.blockDurationMs)
    }

    return {
      allowed: false,
      reason: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil(config.windowMs / 1000)
    }
  }

  // Adicionar requisição atual
  requests.push({ ip, endpoint, timestamp: now })
  requestsCache.set(key, requests)

  // Limpar cache antigo (garbage collection simples)
  if (requestsCache.size > 10000) {
    const oldestKey = requestsCache.keys().next().value
    if (oldestKey) requestsCache.delete(oldestKey)
  }

  return { allowed: true }
}

/**
 * Extrai IP real do cliente (suporta proxies/CDN)
 */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIP = request.headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }

  const cfConnectingIP = request.headers.get('cf-connecting-ip')
  if (cfConnectingIP) {
    return cfConnectingIP
  }

  return 'unknown'
}

/**
 * Valida origem da requisição
 */
export function validateOrigin(
  request: Request,
  allowedOrigins: string[]
): { valid: boolean; reason?: string } {
  
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')

  // Requisições sem origin/referer são suspeitas
  if (!origin && !referer) {
    return {
      valid: false,
      reason: 'MISSING_ORIGIN_AND_REFERER'
    }
  }

  // Verificar origin
  if (origin) {
    const isAllowed = allowedOrigins.some(allowed => 
      origin === allowed || origin.endsWith(allowed)
    )
    
    if (!isAllowed) {
      return {
        valid: false,
        reason: 'INVALID_ORIGIN'
      }
    }
  }

  return { valid: true }
}

/**
 * Cria resposta de erro de segurança
 */
export function securityErrorResponse(
  reason: string,
  statusCode = 429,
  retryAfter?: number
): Response {
  
  const messages: Record<string, string> = {
    'RATE_LIMIT_EXCEEDED': 'Muitas requisições. Tente novamente mais tarde.',
    'IP_BLOCKED': 'Seu IP foi temporariamente bloqueado por atividade suspeita.',
    'INVALID_ORIGIN': 'Origem da requisição não autorizada.',
    'MISSING_ORIGIN_AND_REFERER': 'Requisição inválida.',
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (retryAfter) {
    headers['Retry-After'] = retryAfter.toString()
  }

  return new Response(
    JSON.stringify({
      error: reason,
      message: messages[reason] || 'Acesso negado.',
    }),
    {
      status: statusCode,
      headers,
    }
  )
}

/**
 * Middleware principal - aplica todas as proteções
 */
export async function securityMiddleware(
  request: Request,
  options: {
    rateLimit?: RateLimitConfig
    allowedOrigins?: string[]
    requireOrigin?: boolean
  } = {}
): Promise<{ allowed: boolean; response?: Response }> {
  
  // Rate limiting
  if (options.rateLimit) {
    const rateLimitResult = await rateLimit(request, options.rateLimit)
    
    if (!rateLimitResult.allowed) {
      return {
        allowed: false,
        response: securityErrorResponse(
          rateLimitResult.reason!,
          429,
          rateLimitResult.retryAfter
        )
      }
    }
  }

  // Validação de origem (apenas se configurado)
  if (options.requireOrigin && options.allowedOrigins) {
    const originValidation = validateOrigin(request, options.allowedOrigins)
    
    if (!originValidation.valid) {
      return {
        allowed: false,
        response: securityErrorResponse(originValidation.reason!, 403)
      }
    }
  }

  return { allowed: true }
}
