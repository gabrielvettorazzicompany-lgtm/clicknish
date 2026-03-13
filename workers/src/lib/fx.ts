/**
 * FX (Foreign Exchange) Utilities
 *
 * - Mapeamento país ISO → moeda
 * - Conversão para moedas europeias e latinas (EUR, CHF, GBP, CAD, MXN, COP, CLP, PEN)
 * - Necessário para compatibilidade com métodos Mollie (iDEAL, Bancontact = EUR obrigatório)
 * - Cache de rates no KV por 1 hora
 * - Spread de +1.7% sobre a moeda diferente da moeda base do produto
 *
 * Países não detectados por IP → USD (fallback)
 */

// Moedas que recebem spread de +1.7% quando diferem da moeda base do produto
export const SPREAD_CURRENCIES = new Set(['EUR', 'CHF', 'GBP', 'CAD', 'MXN', 'COP', 'CLP', 'PEN'])

const FX_SPREAD = 0.017 // 1.7%
const FX_CACHE_TTL = 3600 // 1 hora

// Moedas suportadas pela frankfurter.app (ECB)
const FRANKFURTER_CURRENCIES = ['EUR', 'CHF', 'GBP', 'CAD', 'MXN']
// Moedas latinas não suportadas pelo ECB → buscadas via open.er-api.com (gratuito, sem chave)
const OPENERATE_CURRENCIES = ['COP', 'CLP', 'PEN']
// Total de moedas alvo
const TARGET_CURRENCIES = [...FRANKFURTER_CURRENCIES, ...OPENERATE_CURRENCIES]

// Mapeamento país ISO → moeda
// Países não listados → USD via fallback
const COUNTRY_TO_CURRENCY: Record<string, string> = {
    // Zona Euro
    'AT': 'EUR', 'BE': 'EUR', 'CY': 'EUR', 'DE': 'EUR', 'EE': 'EUR',
    'ES': 'EUR', 'FI': 'EUR', 'FR': 'EUR', 'GR': 'EUR', 'HR': 'EUR',
    'IE': 'EUR', 'IT': 'EUR', 'LT': 'EUR', 'LU': 'EUR', 'LV': 'EUR',
    'MT': 'EUR', 'NL': 'EUR', 'PT': 'EUR', 'SI': 'EUR', 'SK': 'EUR',
    // Europa não-euro
    'GB': 'GBP',
    'CH': 'CHF',
    // América do Norte
    'CA': 'CAD',
    // América Latina
    'MX': 'MXN',
    'CO': 'COP',
    'CL': 'CLP',
    'PE': 'PEN',
    // Todos os outros países → USD via fallback
}

/**
 * Retorna a moeda de exibição para um país ISO (ou 'USD' se desconhecido)
 */
export function countryToCurrency(country: string | null | undefined): string {
    if (!country) return 'USD'
    return COUNTRY_TO_CURRENCY[country.toUpperCase()] || 'USD'
}

/**
 * Busca taxas via frankfurter.app (ECB) para EUR, CHF, GBP, CAD, MXN.
 */
async function fetchFrankfurterRates(baseCurrency: string): Promise<Record<string, number>> {
    const to = FRANKFURTER_CURRENCIES.filter(c => c !== baseCurrency).join(',')
    if (!to) return {}
    const url = `https://api.frankfurter.app/latest?from=${baseCurrency}&to=${to}`
    const resp = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        // @ts-ignore — AbortSignal.timeout disponível no CF Workers runtime
        signal: AbortSignal.timeout(4000),
    })
    if (!resp.ok) throw new Error(`Frankfurter API error ${resp.status}`)
    const data = await resp.json() as { rates: Record<string, number> }
    return data.rates
}

/**
 * Busca taxas via open.er-api.com (gratuito, sem auth) para COP, CLP, PEN.
 * Resposta base sempre em USD → converte para baseCurrency se necessário.
 */
async function fetchOpenErRates(baseCurrency: string): Promise<Record<string, number>> {
    const url = `https://open.er-api.com/v6/latest/USD`
    const resp = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        // @ts-ignore
        signal: AbortSignal.timeout(4000),
    })
    if (!resp.ok) throw new Error(`OpenER API error ${resp.status}`)
    const data = await resp.json() as { result: string; rates: Record<string, number> }
    if (data.result !== 'success') throw new Error('OpenER API returned non-success')

    const usdRates = data.rates
    const baseToUsd = usdRates[baseCurrency] ?? 1

    // Converte taxas de USD para baseCurrency
    const result: Record<string, number> = {}
    for (const cur of OPENERATE_CURRENCIES) {
        if (usdRates[cur]) {
            result[cur] = usdRates[cur] / baseToUsd
        }
    }
    return result
}

/**
 * Busca todas as taxas de câmbio necessárias combinando frankfurter + open.er-api.
 */
async function fetchFxRatesFromApi(baseCurrency: string): Promise<Record<string, number>> {
    const [frankfurterRates, openErRates] = await Promise.allSettled([
        fetchFrankfurterRates(baseCurrency),
        fetchOpenErRates(baseCurrency),
    ])

    const rates: Record<string, number> = {}

    if (frankfurterRates.status === 'fulfilled') {
        Object.assign(rates, frankfurterRates.value)
    } else {
        console.warn('[fx] Frankfurter failed:', frankfurterRates.reason)
    }

    if (openErRates.status === 'fulfilled') {
        Object.assign(rates, openErRates.value)
    } else {
        console.warn('[fx] OpenER failed:', openErRates.reason)
    }

    if (Object.keys(rates).length === 0) throw new Error('All FX APIs failed')
    return rates
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
    // Moedas sem casas decimais
    if (currency === 'CLP' || currency === 'COP') {
        return Math.round(price)
    }
    return Math.round(price * 100) / 100
}
