/**
 * Cliente Mollie para Cloudflare Workers
 * Integração via REST API (sem npm — menor bundle para edge)
 * Docs: https://docs.mollie.com/reference/v2/payments-api/create-payment
 */

const MOLLIE_BASE = 'https://api.mollie.com/v2'

export interface MollieConfig {
    apiKey: string          // live_... ou test_...
}

export interface MollieAmount {
    currency: string        // 'EUR', 'USD', etc.
    value: string           // string decimal ex: "9.95"
}

export interface MolliePaymentRequest {
    amount: MollieAmount
    description: string
    redirectUrl: string
    webhookUrl?: string
    method?: string         // 'ideal', 'bancontact', etc. — omitir para picker Mollie
    metadata?: Record<string, string>
    locale?: string
    issuer?: string         // para iDEAL: banco selecionado
}

export interface MolliePayment {
    id: string
    status: 'open' | 'canceled' | 'pending' | 'authorized' | 'expired' | 'failed' | 'paid'
    amount: MollieAmount
    description: string
    method: string | null
    metadata: Record<string, any>
    createdAt: string
    expiresAt?: string
    paidAt?: string
    canceledAt?: string
    expiredAt?: string
    failedAt?: string
    profileId: string
    sequenceType: string
    redirectUrl: string
    webhookUrl?: string
    _links: {
        self: { href: string }
        checkout?: { href: string }     // URL para redirecionar o cliente
        dashboard?: { href: string }
    }
}

export interface MollieMethodInfo {
    id: string
    description: string
    minimumAmount: MollieAmount
    maximumAmount: MollieAmount | null
    image: {
        size1x: string
        size2x: string
        svg: string
    }
    status: string
    _links: { self: { href: string } }
}

export interface MollieCustomer {
    resource: 'customer'
    id: string
    name: string | null
    email: string | null
    locale: string | null
    metadata: Record<string, any>
    createdAt: string
    _links: Record<string, any>
}

export interface MollieMandate {
    resource: 'mandate'
    id: string
    status: 'valid' | 'invalid' | 'pending'
    method: string
    details: Record<string, any>
    mandateReference: string | null
    signatureDate: string | null
    createdAt: string
    _links: Record<string, any>
}

/** Métodos Mollie que suportam sequenceType: 'first' para mandatos recorrentes */
export const MOLLIE_RECURRING_METHODS = new Set([
    'creditcard',
    'ideal',
    'bancontact',
    'directdebit',
])

export interface MollieFirstPaymentRequest extends MolliePaymentRequest {
    sequenceType: 'first'
    customerId: string
}

export interface MollieRecurringPaymentRequest {
    amount: MollieAmount
    description: string
    customerId: string
    mandateId?: string
    sequenceType: 'recurring'
    webhookUrl?: string
    metadata?: Record<string, string>
}

export class MollieClient {
    private apiKey: string
    private baseHeaders: Record<string, string>

    constructor(config: MollieConfig) {
        this.apiKey = config.apiKey
        this.baseHeaders = {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
        }
    }

    /**
     * Cria um pagamento Mollie
     */
    async createPayment(params: MolliePaymentRequest): Promise<MolliePayment> {
        const res = await fetch(`${MOLLIE_BASE}/payments`, {
            method: 'POST',
            headers: this.baseHeaders,
            body: JSON.stringify(params),
        })

        if (!res.ok) {
            const err = await res.json().catch(() => ({})) as any
            throw new Error(`Mollie createPayment failed: ${err?.detail || err?.message || res.statusText}`)
        }

        return res.json() as Promise<MolliePayment>
    }

    /**
     * Busca um pagamento pelo ID
     */
    async getPayment(paymentId: string): Promise<MolliePayment> {
        const res = await fetch(`${MOLLIE_BASE}/payments/${paymentId}`, {
            headers: this.baseHeaders,
        })

        if (!res.ok) {
            const err = await res.json().catch(() => ({})) as any
            throw new Error(`Mollie getPayment failed: ${err?.detail || err?.message || res.statusText}`)
        }

        return res.json() as Promise<MolliePayment>
    }

    /**
     * Lista métodos disponíveis para este perfil Mollie
     * Útil para o superadmin verificar quais estão ativos na sua conta
     */
    async listMethods(params?: { amount?: MollieAmount; locale?: string }): Promise<MollieMethodInfo[]> {
        const qs = new URLSearchParams()
        if (params?.amount) {
            qs.set('amount[currency]', params.amount.currency)
            qs.set('amount[value]', params.amount.value)
        }
        if (params?.locale) qs.set('locale', params.locale)

        const url = `${MOLLIE_BASE}/methods?${qs.toString()}`
        const res = await fetch(url, { headers: this.baseHeaders })

        if (!res.ok) {
            const err = await res.json().catch(() => ({})) as any
            throw new Error(`Mollie listMethods failed: ${err?.detail || err?.message || res.statusText}`)
        }

        const data = await res.json() as any
        return (data?._embedded?.methods || []) as MollieMethodInfo[]
    }

    /**
     * Cria um cliente Mollie (necessário para pagamentos recorrentes)
     */
    async createCustomer(email: string, name?: string): Promise<MollieCustomer> {
        const res = await fetch(`${MOLLIE_BASE}/customers`, {
            method: 'POST',
            headers: this.baseHeaders,
            body: JSON.stringify({ email, name: name || undefined }),
        })
        if (!res.ok) {
            const err = await res.json().catch(() => ({})) as any
            throw new Error(`Mollie createCustomer failed: ${err?.detail || err?.message || res.statusText}`)
        }
        return res.json() as Promise<MollieCustomer>
    }

    /**
     * Busca clientes Mollie pelo e-mail
     */
    async listCustomersByEmail(email: string): Promise<MollieCustomer[]> {
        const url = `${MOLLIE_BASE}/customers?email=${encodeURIComponent(email)}`
        const res = await fetch(url, { headers: this.baseHeaders })
        if (!res.ok) return []
        const data = await res.json() as any
        return (data?._embedded?.customers || []) as MollieCustomer[]
    }

    /**
     * Obtém (ou cria) cliente Mollie pelo e-mail — evita duplicatas
     */
    async getOrCreateCustomer(email: string, name?: string): Promise<MollieCustomer> {
        const existing = await this.listCustomersByEmail(email)
        if (existing.length > 0) return existing[0]
        return this.createCustomer(email, name)
    }

    /**
     * Lista os mandatos de um cliente Mollie
     */
    async listMandates(customerId: string): Promise<MollieMandate[]> {
        const res = await fetch(`${MOLLIE_BASE}/customers/${customerId}/mandates`, {
            headers: this.baseHeaders,
        })
        if (!res.ok) return []
        const data = await res.json() as any
        return (data?._embedded?.mandates || []) as MollieMandate[]
    }

    /**
     * Cria um pagamento recorrente (1-click) usando mandato existente
     * Não exige redirect — processado em background pela Mollie
     */
    async createRecurringPayment(params: MollieRecurringPaymentRequest): Promise<MolliePayment> {
        const res = await fetch(`${MOLLIE_BASE}/payments`, {
            method: 'POST',
            headers: this.baseHeaders,
            body: JSON.stringify(params),
        })
        if (!res.ok) {
            const err = await res.json().catch(() => ({})) as any
            throw new Error(`Mollie createRecurringPayment failed: ${err?.detail || err?.message || res.statusText}`)
        }
        return res.json() as Promise<MolliePayment>
    }
}

/**
 * Factory — cria cliente a partir da chave da variável de ambiente ou credenciais do provedor
 */
export function createMollieClient(apiKey: string): MollieClient {
    if (!apiKey) throw new Error('Mollie API key is required')
    return new MollieClient({ apiKey })
}

/**
 * Formata valor numérico como string Mollie (2 casas decimais, obrigatório)
 */
export function toMollieAmount(amount: number, currency = 'EUR'): MollieAmount {
    return {
        currency: currency.toUpperCase(),
        value: amount.toFixed(2),
    }
}

/**
 * Mapeamento de moeda ISO → locale padrão Mollie para melhor UX regional
 */
export function currencyToLocale(currency: string): string {
    const map: Record<string, string> = {
        EUR: 'nl_NL',
        USD: 'en_US',
        GBP: 'en_GB',
        CHF: 'de_CH',
        PLN: 'pl_PL',
        SEK: 'sv_SE',
        NOK: 'nb_NO',
        DKK: 'da_DK',
    }
    return map[currency.toUpperCase()] || 'en_US'
}
