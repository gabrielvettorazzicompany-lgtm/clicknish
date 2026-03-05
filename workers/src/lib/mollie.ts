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
