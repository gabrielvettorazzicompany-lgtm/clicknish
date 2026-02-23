/**
 * Cliente Stripe simplificado para Cloudflare Workers
 * Usa fetch nativo (sem SDK pesado)
 */

const STRIPE_API_BASE = 'https://api.stripe.com/v1'

export interface StripeConfig {
    secretKey: string
}

export class StripeClient {
    private secretKey: string

    constructor(config: StripeConfig) {
        this.secretKey = config.secretKey
    }

    private async request(endpoint: string, options: {
        method?: string
        body?: Record<string, any>
    } = {}) {
        const { method = 'GET', body } = options

        const headers: Record<string, string> = {
            'Authorization': `Bearer ${this.secretKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        }

        let fetchBody: string | undefined
        if (body) {
            fetchBody = this.toFormData(body)
        }

        const response = await fetch(`${STRIPE_API_BASE}${endpoint}`, {
            method,
            headers,
            body: fetchBody,
        })

        const data = await response.json() as any

        if (!response.ok) {
            const error: any = new Error(data.error?.message || 'Stripe API error')
            error.type = data.error?.type
            error.code = data.error?.code
            throw error
        }

        return data
    }

    /**
     * Converte objeto para form-urlencoded (formato do Stripe)
     */
    private toFormData(obj: Record<string, any>, prefix = ''): string {
        const params: string[] = []

        for (const [key, value] of Object.entries(obj)) {
            const fullKey = prefix ? `${prefix}[${key}]` : key

            if (value === null || value === undefined) {
                continue
            }

            if (typeof value === 'object' && !Array.isArray(value)) {
                params.push(this.toFormData(value, fullKey))
            } else if (Array.isArray(value)) {
                value.forEach((item, index) => {
                    if (typeof item === 'object') {
                        params.push(this.toFormData(item, `${fullKey}[${index}]`))
                    } else {
                        params.push(`${encodeURIComponent(`${fullKey}[${index}]`)}=${encodeURIComponent(item)}`)
                    }
                })
            } else {
                params.push(`${encodeURIComponent(fullKey)}=${encodeURIComponent(value)}`)
            }
        }

        return params.filter(p => p).join('&')
    }

    /**
     * Customers
     */
    customers = {
        create: async (params: {
            email: string
            name?: string
            phone?: string
            metadata?: Record<string, string>
        }) => {
            return this.request('/customers', { method: 'POST', body: params })
        },

        list: async (params: { email?: string; limit?: number }) => {
            const queryParams = new URLSearchParams()
            if (params.email) queryParams.set('email', params.email)
            if (params.limit) queryParams.set('limit', String(params.limit))

            return this.request(`/customers?${queryParams.toString()}`)
        },

        retrieve: async (customerId: string) => {
            return this.request(`/customers/${customerId}`)
        },
    }

    /**
     * Payment Methods
     */
    paymentMethods = {
        attach: async (paymentMethodId: string, params: { customer: string }) => {
            return this.request(`/payment_methods/${paymentMethodId}/attach`, {
                method: 'POST',
                body: params,
            })
        },
    }

    /**
     * Payment Intents
     */
    paymentIntents = {
        create: async (params: {
            amount: number
            currency: string
            customer?: string
            payment_method?: string
            confirm?: boolean
            off_session?: boolean
            automatic_payment_methods?: {
                enabled: boolean
                allow_redirects?: string
            }
            metadata?: Record<string, string>
            description?: string
        }) => {
            return this.request('/payment_intents', { method: 'POST', body: params })
        },

        retrieve: async (paymentIntentId: string) => {
            return this.request(`/payment_intents/${paymentIntentId}`)
        },

        confirm: async (paymentIntentId: string, params?: { payment_method?: string }) => {
            return this.request(`/payment_intents/${paymentIntentId}/confirm`, {
                method: 'POST',
                body: params,
            })
        },
    }
}

/**
 * Factory function
 */
export function createStripeClient(secretKey: string): StripeClient {
    return new StripeClient({ secretKey })
}
