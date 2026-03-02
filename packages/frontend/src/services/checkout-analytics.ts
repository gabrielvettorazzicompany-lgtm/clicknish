import { useState, useEffect } from 'react'

/**
 * ⚡ Analytics do checkout SEM dependência do cliente Supabase.
 *
 * Envia eventos diretamente ao Cloudflare Worker (/api/track-checkout),
 * que grava no banco via Service Role + extrai geolocalização dos headers CF.
 *
 * Benefício: remove ~200KB (vendor-supabase) do bundle crítico do checkout.
 * O Supabase só é carregado se o usuário cair no path legado (KV miss / URL longa).
 */

const WORKER_API = 'https://api.clicknich.com'

function getSessionId(): string {
    try {
        let id = sessionStorage.getItem('checkout_session_id')
        if (!id) {
            id = crypto.randomUUID()
            sessionStorage.setItem('checkout_session_id', id)
        }
        return id
    } catch {
        return 'unknown'
    }
}

export async function trackCheckoutEvent(
    checkoutId: string,
    eventType: 'page_view' | 'conversion' | 'bounce',
    metadata?: Record<string, any>
): Promise<void> {
    if (!checkoutId) return
    try {
        await fetch(`${WORKER_API}/api/track-checkout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                checkoutId,
                eventType,
                userAgent: navigator?.userAgent,
                referrer: document?.referrer || null,
                sessionId: getSessionId(),
                metadata: {
                    ...metadata,
                    timestamp: new Date().toISOString(),
                    screen_resolution: screen?.width ? `${screen.width}x${screen.height}` : null,
                    language: navigator.language,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                },
            }),
        })
    } catch {
        // Silencioso — analytics nunca bloqueia o checkout
    }
}

export function useCheckoutPageView(checkoutId: string) {
    const [tracked, setTracked] = useState(false)

    useEffect(() => {
        if (checkoutId && !tracked) {
            trackCheckoutEvent(checkoutId, 'page_view')
            setTracked(true)
        }
    }, [checkoutId, tracked])
}
