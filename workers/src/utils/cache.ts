/**
 * Cache utilities para Cloudflare KV
 * Reduz latência em dados que não mudam frequentemente
 */

import { Env } from '../index'

interface CacheOptions {
    ttl?: number // Time to live em segundos (default: 300 = 5 min)
    staleWhileRevalidate?: boolean // Retorna cache antigo enquanto atualiza
}

/**
 * Busca dado do cache ou executa função e cacheia resultado
 */
export async function withCache<T>(
    env: Env,
    key: string,
    fetchFn: () => Promise<T>,
    options: CacheOptions = {}
): Promise<T> {
    const { ttl = 300 } = options

    // Se KV não está disponível, executar direto
    if (!env.CACHE) {
        return fetchFn()
    }

    try {
        // Tentar buscar do cache
        const cached = await env.CACHE.get(key, 'json') as T | null

        if (cached !== null) {
            return cached
        }

        // Cache miss - buscar dados frescos
        const data = await fetchFn()

        // Salvar no cache em background (não bloqueia resposta)
        // Usando waitUntil se disponível, senão faz sync
        await env.CACHE.put(key, JSON.stringify(data), {
            expirationTtl: ttl
        })

        return data
    } catch (error) {
        console.warn(`Cache error for key ${key}:`, error)
        // Em caso de erro no cache, executar função diretamente
        return fetchFn()
    }
}

/**
 * Invalida cache para uma chave específica
 */
export async function invalidateCache(env: Env, key: string): Promise<void> {
    if (!env.CACHE) return

    try {
        await env.CACHE.delete(key)
    } catch (error) {
        console.warn(`Failed to invalidate cache for ${key}:`, error)
    }
}

/**
 * Invalida múltiplas chaves por prefixo
 * Nota: KV não suporta wildcard, então precisamos listar as chaves
 */
export async function invalidateCacheByPrefix(env: Env, prefix: string): Promise<void> {
    if (!env.CACHE) return

    try {
        const list = await env.CACHE.list({ prefix })
        await Promise.all(list.keys.map(k => env.CACHE!.delete(k.name)))
    } catch (error) {
        console.warn(`Failed to invalidate cache prefix ${prefix}:`, error)
    }
}

/**
 * Gera chave de cache para usuário + recurso
 */
export function userCacheKey(userId: string, resource: string): string {
    return `user:${userId}:${resource}`
}

/**
 * Gera chave de cache global
 */
export function globalCacheKey(resource: string): string {
    return `global:${resource}`
}
