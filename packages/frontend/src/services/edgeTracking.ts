// Serviço otimizado para tracking usando Cloudflare Worker
// services/edgeTracking.ts

import { useState, useEffect } from 'react'

const EDGE_FUNCTION_URL = 'https://api.clicknich.com/api/track-checkout'

interface EdgeTrackingPayload {
    checkoutId: string
    eventType: 'page_view' | 'conversion' | 'bounce'
    userAgent?: string
    referrer?: string
    sessionId?: string
    metadata?: Record<string, any>
}

interface EdgeTrackingResponse {
    success: boolean
    id?: string
    ip?: string
    location?: string
    error?: string
}

// Cache para evitar múltiplas chamadas na mesma sessão
const trackingCache = new Map<string, boolean>()

// Gerar ou recuperar session ID
function getSessionId(): string {
    const storageKey = 'huskyapp_session_id'
    let sessionId = sessionStorage.getItem(storageKey)

    if (!sessionId) {
        sessionId = crypto.randomUUID()
        sessionStorage.setItem(storageKey, sessionId)
    }

    return sessionId
}

// Coletar metadados do dispositivo/browser
function collectMetadata(): Record<string, any> {
    return {
        screen_resolution: `${screen.width}x${screen.height}`,
        viewport_size: `${window.innerWidth}x${window.innerHeight}`,
        color_depth: screen.colorDepth,
        pixel_ratio: window.devicePixelRatio,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        languages: navigator.languages?.slice(0, 3), // Primeiros 3 idiomas
        platform: navigator.platform,
        cookie_enabled: navigator.cookieEnabled,
        online: navigator.onLine,
        connection: (navigator as any).connection ? {
            effective_type: (navigator as any).connection.effectiveType,
            downlink: (navigator as any).connection.downlink,
        } : null,
        memory: (performance as any).memory ? {
            used: Math.round((performance as any).memory.usedJSHeapSize / 1048576), // MB
            total: Math.round((performance as any).memory.totalJSHeapSize / 1048576), // MB
        } : null,
        timestamp: Date.now(),
        url: window.location.href,
        path: window.location.pathname,
        query: window.location.search,
        hash: window.location.hash
    }
}

// Função principal de tracking otimizada
export async function trackCheckoutEventEdge(
    checkoutId: string,
    eventType: 'page_view' | 'conversion' | 'bounce',
    additionalData: Record<string, any> = {}
): Promise<EdgeTrackingResponse | null> {

    // Evitar tracking duplicado na mesma sessão
    const cacheKey = `${checkoutId}-${eventType}-${getSessionId()}`
    if (eventType === 'page_view' && trackingCache.has(cacheKey)) {

        return null
    }

    try {
        console.time(`🚀 [EdgeTracking] ${eventType}`)

        const payload: EdgeTrackingPayload = {
            checkoutId,
            eventType,
            userAgent: navigator.userAgent,
            referrer: document.referrer,
            sessionId: getSessionId(),
            metadata: {
                ...collectMetadata(),
                ...additionalData
            }
        }

        const response = await fetch(EDGE_FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        })

        const result: EdgeTrackingResponse = await response.json()

        console.timeEnd(`🚀 [EdgeTracking] ${eventType}`)

        if (result.success) {
            // Marcar como trackeado no cache
            if (eventType === 'page_view') {
                trackingCache.set(cacheKey, true)
            }


            id: result.id,
                ip: result.ip,
                    location: result.location
        })

        return result
    } else {
        console.error('❌ [EdgeTracking] Error:', result.error)
        return null
    }

} catch (error) {
    console.error('🚨 [EdgeTracking] Network error:', error)
    return null
}
}

// Hook para tracking automático de page view
export function useEdgePageView(checkoutId: string, enabled: boolean = true) {
    const [tracked, setTracked] = useState(false)

    useEffect(() => {
        if (!enabled || !checkoutId || tracked) return

        const trackPageView = async () => {
            const result = await trackCheckoutEventEdge(checkoutId, 'page_view')
            if (result?.success) {
                setTracked(true)
            }
        }

        // Delay pequeno para garantir que a página carregou
        const timer = setTimeout(trackPageView, 100)
        return () => clearTimeout(timer)
    }, [checkoutId, enabled, tracked])

    return tracked
}

// Função para tracking de conversão
export async function trackCheckoutConversion(
    checkoutId: string,
    conversionData: {
        amount?: number
        currency?: string
        paymentMethod?: string
        productId?: string
        couponCode?: string
    } = {}
): Promise<boolean> {

    const result = await trackCheckoutEventEdge(checkoutId, 'conversion', {
        ...conversionData,
        conversion_timestamp: new Date().toISOString()
    })

    return result?.success || false
}

// Função para tracking de bounce (saída sem interação)
export function setupBounceTracking(checkoutId: string) {
    let bounceTracked = false

    // Considerar bounce se sair em menos de 30 segundos sem interação
    const bounceTimer = setTimeout(() => {
        if (!bounceTracked) {
            trackCheckoutEventEdge(checkoutId, 'bounce', {
                time_on_page: 30000,
                bounce_reason: 'timeout'
            })
            bounceTracked = true
        }
    }, 30000)

    // Cancelar bounce se houver interação
    const cancelBounce = () => {
        if (!bounceTracked) {
            clearTimeout(bounceTimer)
            bounceTracked = true
        }
    }

    // Event listeners para interações
    const events = ['click', 'scroll', 'keypress', 'mousemove']
    events.forEach(event => {
        document.addEventListener(event, cancelBounce, { once: true, passive: true })
    })

    // Cleanup
    return () => {
        clearTimeout(bounceTimer)
        events.forEach(event => {
            document.removeEventListener(event, cancelBounce)
        })
    }
}

// Fallback para client-side (se Edge Function falhar)
export async function trackCheckoutEventClientSide(
    checkoutId: string,
    eventType: 'page_view' | 'conversion' | 'bounce',
    additionalData: Record<string, any> = {}
): Promise<boolean> {

    // Import dinâmico para evitar carregar sempre
    const { trackCheckoutEvent } = await import('./checkouts')

    try {
        await trackCheckoutEvent(checkoutId, eventType, additionalData)
        return true
    } catch (error) {
        console.error('❌ [ClientTracking] Fallback failed:', error)
        return false
    }
}

// Função híbrida com fallback automático
export async function trackCheckoutEventHybrid(
    checkoutId: string,
    eventType: 'page_view' | 'conversion' | 'bounce',
    additionalData: Record<string, any> = {}
): Promise<boolean> {

    // Tentar Edge Function primeiro
    const edgeResult = await trackCheckoutEventEdge(checkoutId, eventType, additionalData)

    if (edgeResult?.success) {
        return true
    }

    // Fallback para client-side

    return await trackCheckoutEventClientSide(checkoutId, eventType, additionalData)
}