import { loadStripe } from '@stripe/stripe-js'

/**
 * ⚡ Singleton do Stripe — extraído de CheckoutDigital para permitir preload
 * independente do lazy load do componente.
 *
 * Prioridade da chave:
 *  1. VITE_STRIPE_PUBLIC_KEY (env de build)
 *  2. GET /api/stripe-public-key (configurado pelo superadmin no DB)
 */
const API_BASE = 'https://api.clicknich.com/api'

let stripePromise: ReturnType<typeof loadStripe> | null = null

async function resolvePublishableKey(): Promise<string | null> {
    const envKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY as string | undefined
    if (envKey) return envKey
    try {
        const res = await fetch(`${API_BASE}/stripe-public-key`)
        if (!res.ok) return null
        const data = await res.json() as { publishable_key: string | null }
        return data.publishable_key || null
    } catch {
        return null
    }
}

export const getStripePromise = () => {
    if (!stripePromise) {
        stripePromise = resolvePublishableKey().then(key => key ? loadStripe(key) : null) as ReturnType<typeof loadStripe>
    }
    return stripePromise
}

/**
 * Cria uma instância Stripe para uma publishable key específica (provedor individual).
 * Não usa o singleton — sempre retorna uma nova promise para a chave fornecida.
 */
export const createStripeForKey = (publishableKey: string): ReturnType<typeof loadStripe> => {
    return loadStripe(publishableKey) as ReturnType<typeof loadStripe>
}
