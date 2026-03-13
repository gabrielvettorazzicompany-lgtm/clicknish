/**
 * Cliente PayPal para Cloudflare Workers
 * Integração com PayPal Orders API v2
 */

interface PayPalConfig {
    clientId: string
    clientSecret: string
    environment: 'sandbox' | 'live'
}

interface PayPalAccessToken {
    access_token: string
    expires_in: number
    token_type: string
}

export interface PayPalOrderRequest {
    amount: number
    currency: string
    description?: string
    customId?: string
    invoiceId?: string
    metadata?: Record<string, string>
}

export interface PayPalOrderResponse {
    id: string
    status: string
    links: Array<{
        href: string
        rel: string
        method: string
    }>
    create_time: string
    update_time: string
}

export class PayPalClient {
    private clientId: string
    private clientSecret: string
    private apiBase: string
    private accessToken?: PayPalAccessToken
    private tokenExpiration?: number

    constructor(config: PayPalConfig) {
        this.clientId = config.clientId
        this.clientSecret = config.clientSecret
        this.apiBase = config.environment === 'sandbox'
            ? 'https://api.sandbox.paypal.com'
            : 'https://api.paypal.com'
    }

    /**
     * Obter access token usando client credentials
     */
    private async getAccessToken(): Promise<string> {
        // Verificar se o token ainda é válido (com margem de 5 minutos)
        if (this.accessToken && this.tokenExpiration && Date.now() < this.tokenExpiration - 300000) {
            return this.accessToken.access_token
        }

        const credentials = btoa(`${this.clientId}:${this.clientSecret}`)

        const response = await fetch(`${this.apiBase}/v1/oauth2/token`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Accept-Language': 'en_US',
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'grant_type=client_credentials'
        })

        if (!response.ok) {
            throw new Error('Failed to obtain PayPal access token')
        }

        const tokenData: PayPalAccessToken = await response.json()

        this.accessToken = tokenData
        this.tokenExpiration = Date.now() + (tokenData.expires_in * 1000)

        return tokenData.access_token
    }

    /**
     * Fazer requisição autenticada para a API do PayPal
     */
    private async request(endpoint: string, options: {
        method?: string
        body?: any
        headers?: Record<string, string>
    } = {}) {
        const { method = 'GET', body, headers = {} } = options

        const accessToken = await this.getAccessToken()

        const requestHeaders: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
            'PayPal-Request-Id': crypto.randomUUID(), // Idempotência
            ...headers
        }

        const response = await fetch(`${this.apiBase}${endpoint}`, {
            method,
            headers: requestHeaders,
            body: body ? JSON.stringify(body) : undefined,
        })

        if (!response.ok) {
            const error = await response.json().catch(() => ({}))
            const errorMessage = error.message || error.error_description || 'PayPal API error'
            throw new Error(`PayPal API Error: ${errorMessage}`)
        }

        // Retornar resposta vazia para alguns endpoints
        if (response.status === 204) {
            return {}
        }

        return response.json()
    }

    /**
     * Criar uma ordem no PayPal com Vault habilitado (salva método de pagamento para upsell one-click)
     * Requer "Reference Transactions" ativado pelo PayPal no account do merchant.
     * Se não estiver ativado, o PayPal retorna "failed business validation" — usar createOrder como fallback.
     * Após captura bem-sucedida, a resposta conterá payment_source.paypal.attributes.vault.id
     */
    async createOrderWithVault(orderData: PayPalOrderRequest & { returnUrl: string; cancelUrl: string }): Promise<PayPalOrderResponse & { _vaultEnabled?: boolean }> {
        const requestBody = {
            intent: 'CAPTURE',
            purchase_units: [{
                amount: {
                    currency_code: orderData.currency,
                    value: orderData.amount.toFixed(2)
                },
                description: orderData.description || 'Purchase',
                custom_id: orderData.customId,
                invoice_id: orderData.invoiceId
            }],
            payment_source: {
                paypal: {
                    experience_context: {
                        payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
                        brand_name: 'Clicknich',
                        locale: 'en-US',
                        landing_page: 'LOGIN',
                        shipping_preference: 'NO_SHIPPING',
                        user_action: 'PAY_NOW',
                        return_url: orderData.returnUrl,
                        cancel_url: orderData.cancelUrl,
                    },
                    attributes: {
                        vault: {
                            store_in_vault: 'ON_SUCCESS',
                            usage_type: 'MERCHANT',
                        }
                    }
                }
            }
        }

        try {
            const result = await this.request('/v2/checkout/orders', { method: 'POST', body: requestBody }) as any
            result._vaultEnabled = true
            return result
        } catch (err: any) {
            // Vault não ativado na conta — fallback para ordem padrão (sem one-click upsell)
            const isVaultError = err?.message?.includes('business validation') ||
                err?.message?.includes('VAULT_NOT_SUPPORTED') ||
                err?.message?.includes('semantically incorrect')
            if (isVaultError) {
                console.warn('[paypal] Vault não ativado — usando createOrder padrão. Ative "Reference Transactions" no PayPal Developer Dashboard.')
                const fallback = await this.createOrder(orderData) as any
                fallback._vaultEnabled = false
                return fallback
            }
            throw err
        }
    }

    /**
     * Cobrar upsell usando vault_id salvo (sem redirect — cliente não precisa aprovar)
     */
    async chargeVaultedPayment(vaultId: string, orderData: PayPalOrderRequest): Promise<any> {
        const requestBody = {
            intent: 'CAPTURE',
            purchase_units: [{
                amount: {
                    currency_code: orderData.currency,
                    value: orderData.amount.toFixed(2)
                },
                description: orderData.description || 'Purchase',
                custom_id: orderData.customId,
                invoice_id: orderData.invoiceId
            }],
            payment_source: {
                token: {
                    id: vaultId,
                    type: 'PAYMENT_METHOD_TOKEN',
                }
            }
        }

        const order = await this.request('/v2/checkout/orders', {
            method: 'POST',
            body: requestBody
        })

        // Capturar automaticamente (cliente não precisa aprovar)
        return this.request(`/v2/checkout/orders/${order.id}/capture`, {
            method: 'POST'
        })
    }

    /**
     * Criar uma ordem no PayPal (sem vault — compatibilidade)
     */
    async createOrder(orderData: PayPalOrderRequest & { returnUrl?: string; cancelUrl?: string }): Promise<PayPalOrderResponse> {
        const requestBody = {
            intent: 'CAPTURE',
            purchase_units: [{
                amount: {
                    currency_code: orderData.currency,
                    value: orderData.amount.toFixed(2)
                },
                description: orderData.description || 'Purchase',
                custom_id: orderData.customId,
                invoice_id: orderData.invoiceId
            }],
            payment_source: {
                paypal: {
                    experience_context: {
                        payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
                        brand_name: 'Clicknich',
                        locale: 'en-US',
                        landing_page: 'LOGIN',
                        shipping_preference: 'NO_SHIPPING',
                        user_action: 'PAY_NOW',
                        return_url: orderData.returnUrl || 'https://app.clicknich.com/paypal-return',
                        cancel_url: orderData.cancelUrl || 'https://app.clicknich.com',
                    }
                }
            }
        }

        return this.request('/v2/checkout/orders', {
            method: 'POST',
            body: requestBody
        })
    }

    /**
     * Capturar pagamento de uma ordem aprovada
     */
    async captureOrder(orderId: string): Promise<any> {
        return this.request(`/v2/checkout/orders/${orderId}/capture`, {
            method: 'POST'
        })
    }

    /**
     * Obter detalhes de uma ordem
     */
    async getOrder(orderId: string): Promise<any> {
        return this.request(`/v2/checkout/orders/${orderId}`)
    }

    /**
     * Verificar se uma ordem foi aprovada
     */
    async isOrderApproved(orderId: string): Promise<boolean> {
        try {
            const order = await this.getOrder(orderId)
            return order.status === 'APPROVED'
        } catch {
            return false
        }
    }

    /**
     * Verificar se uma ordem foi capturada (paga)
     */
    async isOrderCaptured(orderId: string): Promise<boolean> {
        try {
            const order = await this.getOrder(orderId)
            return order.status === 'COMPLETED'
        } catch {
            return false
        }
    }
}

/**
 * Factory function para criar cliente PayPal
 */
export function createPayPalClient(clientId: string, clientSecret: string, environment: 'sandbox' | 'live' = 'sandbox'): PayPalClient {
    return new PayPalClient({ clientId, clientSecret, environment })
}