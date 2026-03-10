import { loadStripe } from '@stripe/stripe-js'

/**
 * ⚡ Singleton do Stripe — extraído de CheckoutDigital para permitir preload
 * independente do lazy load do componente.
 *
 * Prioridade da chave:
 *  1. VITE_STRIPE_PUBLIC_KEY (env de build)
 *  2. GET /api/stripe-public-key?shortId=xxx — resolve provedor individual do vendedor
 *  3. GET /api/stripe-public-key — provedor global padrão
 *
 * Cache por shortId: cada checkout reutiliza a mesma instância Stripe.
 */
const API_BASE = 'https://api.clicknich.com/api'

const cache = new Map<string, ReturnType<typeof loadStripe>>()

export const getStripePromise = (shortId?: string): ReturnType<typeof loadStripe> => {
    const key = shortId ?? '__global__'
    if (!cache.has(key)) {
        const envKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY as string | undefined
        const promise = envKey
            ? loadStripe(envKey)
            : fetch(`${API_BASE}/stripe-public-key${shortId ? `?shortId=${encodeURIComponent(shortId)}` : ''}`)
                .then(r => r.json())
                .then((d: { publishable_key: string | null }) => d.publishable_key ? loadStripe(d.publishable_key) : null)
                .catch(() => null)
        cache.set(key, promise as ReturnType<typeof loadStripe>)
    }
    return cache.get(key)!
}
