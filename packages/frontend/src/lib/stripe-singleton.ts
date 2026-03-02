import { loadStripe } from '@stripe/stripe-js'

/**
 * ⚡ Singleton do Stripe — extraído de CheckoutDigital para permitir preload
 * independente do lazy load do componente.
 *
 * Importar este arquivo é barato (~0KB de JS de produto), mas inicia a
 * conexão com js.stripe.com imediatamente, economizando ~200–300ms.
 */
let stripePromise: ReturnType<typeof loadStripe> | null = null

export const getStripePromise = () => {
    if (!stripePromise && import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
        stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY as string)
    }
    return stripePromise
}
