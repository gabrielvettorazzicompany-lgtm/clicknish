/**
 * FX (Foreign Exchange) Utilities
 *
 * - Mapeamento país ISO → moeda
 * - Conversão apenas para moedas europeias (EUR, CHF, GBP)
 * - Necessário para compatibilidade com métodos Mollie (iDEAL, Bancontact = EUR obrigatório)
 * - Cache de rates no KV por 1 hora
 * - Spread de +1.7% nas moedas convertidas
 *
 * Países fora da Europa → mantém USD (sem conversão)
 */

// Apenas moedas europeias — os métodos Mollie exigem EUR
export const SPREAD_CURRENCIES = new Set(['EUR', 'CHF', 'GBP'])

const FX_SPREAD = 0.017 // 1.7%
const FX_CACHE_TTL = 3600 // 1 hora

// Moedas a buscar nas taxas
const TARGET_CURRENCIES = ['EUR', 'CHF', 'GBP']

// Mapeamento país ISO → moeda (apenas Europa)
const COUNTRY_TO_CURRENCY: Record<string, string> = {
    // Zona Euro
    'AT': 'EUR', 'BE': 'EUR', 'CY': 'EUR', 'DE': 'EUR', 'EE': 'EUR',
    'ES': 'EUR', 'FI': 'EUR', 'FR': 'EUR', 'GR': 'EUR', 'HR': 'EUR',
    'IE': 'EUR', 'IT': 'EUR', 'LT': 'EUR', 'LU': 'EUR', 'LV': 'EUR',
    'MT': 'EUR', 'NL': 'EUR', 'PT': 'EUR', 'SI': 'EUR', 'SK': 'EUR',
    // Europa não-euro
    'GB': 'GBP',
    'CH': 'CHF',
    // Todos os outros países (BR, MX, US, CA, etc.) → USD via fallback
}

/**
 * Retorna a moeda de exibição para um país ISO (ou 'USD' se desconhecido)
 */
export function countryToCurrency(country: string | null | undefined): string {
    if (!country) return 'USD'
    return COUNTRY_TO_CURRENCY[country.toUpperCase()] || 'USD'
}

/**
 * Busca taxas de câmbio da frankfurter.app (dados do ECB, sem auth)
 * Retorna mapa { EUR: 0.92, BRL: 5.1, ... } com base na moeda fornecida
 */
async function fetchFxRatesFromApi(baseCurrency: string): Promise<Record<string, number>> {
    const to = TARGET_CURRENCIES.filter(c => c !== baseCurrency).join(',')
    const url = `https://api.frankfurter.app/latest?from=${baseCurrency}&to=${to}`
    const resp = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        // @ts-ignore — AbortSignal.timeout disponível no CF Workers runtime
        signal: AbortSignal.timeout(4000),
    })
    if (!resp.ok) throw new Error(`FX API error ${resp.status}`)
    const data = await resp.json() as { rates: Record<string, number> }
    return data.rates
}

/**
 * Obtém taxas de câmbio com cache KV de 1h.
 * Em caso de falha na API, lança erro (o caller faz fallback para moeda base).
 */
export async function getFxRates(
    baseCurrency: string,
    kvCache?: KVNamespace
): Promise<Record<string, number>> {
    const cacheKey = `fx-rates:${baseCurrency.toUpperCase()}`

    if (kvCache) {
        try {
            const cached = await kvCache.get(cacheKey, 'json') as Record<string, number> | null
            if (cached) return cached
        } catch { /* KV miss, fetch da API */ }
    }

    const rates = await fetchFxRatesFromApi(baseCurrency)

    if (kvCache) {
        // Fire-and-forget: não bloquear a resposta pelo KV write
        kvCache.put(cacheKey, JSON.stringify(rates), { expirationTtl: FX_CACHE_TTL })
            .catch(e => console.warn('[fx] KV put failed:', e))
    }

    return rates
}

export interface FxResult {
    /** Preço convertido e com spread (para exibição e cobrança) */
    displayPrice: number
    /** Moeda de exibição (código ISO 4217) */
    displayCurrency: string
    /** Preço original na moeda base */
    basePrice: number
    /** Moeda base do produto */
    baseCurrency: string
    /** Taxa aplicada (inclui spread se houver) */
    rateApplied: number
}

/**
 * Converte um preço base para a moeda do cliente com spread de 1.7%.
 *
 * Regras:
 * - Se a moeda do cliente = moeda base → sem conversão, sem spread
 * - Se a moeda do cliente não é suportada → USD sem spread
 * - Falha na API FX → fallback para moeda base sem spread
 *
 * @param basePrice   Preço na moeda base do produto
 * @param baseCurrency Moeda base do produto (ex: 'USD', 'BRL')
 * @param clientCountry Código ISO do país do cliente (de cf-ipcountry)
 * @param env         Env com CACHE KV para cache de rates
 */
export async function applyFxConversion(
    basePrice: number,
    baseCurrency: string,
    clientCountry: string | null | undefined,
    env: { CACHE?: KVNamespace }
): Promise<FxResult> {
    const normalizedBase = baseCurrency.toUpperCase()
    const displayCurrency = countryToCurrency(clientCountry)

    // Sem conversão: mesma moeda ou moeda do cliente não tem spread
    if (displayCurrency === normalizedBase || !SPREAD_CURRENCIES.has(displayCurrency)) {
        return {
            displayPrice: basePrice,
            displayCurrency: normalizedBase,
            basePrice,
            baseCurrency: normalizedBase,
            rateApplied: 1,
        }
    }

    try {
        const rates = await getFxRates(normalizedBase, env.CACHE)
        const rate = rates[displayCurrency]

        if (!rate || isNaN(rate)) {
            // Taxa não disponível para esta moeda → sem conversão
            return { displayPrice: basePrice, displayCurrency: normalizedBase, basePrice, baseCurrency: normalizedBase, rateApplied: 1 }
        }

        const effectiveRate = rate * (1 + FX_SPREAD)
        const rawConverted = basePrice * effectiveRate
        const displayPrice = roundForCurrency(rawConverted, displayCurrency)

        return { displayPrice, displayCurrency, basePrice, baseCurrency: normalizedBase, rateApplied: effectiveRate }
    } catch (err) {
        console.warn('[fx] FX conversion failed, using base currency:', err)
        return { displayPrice: basePrice, displayCurrency: normalizedBase, basePrice, baseCurrency: normalizedBase, rateApplied: 1 }
    }
}

/**
 * Arredonda preço de acordo com convenção da moeda.
 * Moedas sem decimais (CLP, COP) → arredonda para inteiro.
 */
export function roundForCurrency(price: number, currency: string): number {
    if (currency === 'CLP' || currency === 'COP') {
        return Math.round(price)
    }
    return Math.round(price * 100) / 100
}
