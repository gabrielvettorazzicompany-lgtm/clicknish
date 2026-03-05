// Serviço para detecção automática de idioma baseado no IP do usuário
// services/languageDetection.ts

import { Language } from '@/i18n'

interface GeolocationData {
    country?: string
    country_code?: string
    country_name?: string
}

// Mapeamento de países para idiomas suportados
const COUNTRY_TO_LANGUAGE: Record<string, Language> = {
    // Português
    'BR': 'pt', // Brasil
    'PT': 'pt', // Portugal
    'MZ': 'pt', // Moçambique
    'AO': 'pt', // Angola
    'CV': 'pt', // Cabo Verde
    'GW': 'pt', // Guiné-Bissau
    'ST': 'pt', // São Tomé e Príncipe
    'TL': 'pt', // Timor-Leste

    // Espanhol
    'ES': 'es', // Espanha
    'AR': 'es', // Argentina
    'CL': 'es', // Chile
    'CO': 'es', // Colômbia
    'MX': 'es', // México
    'PE': 'es', // Peru
    'VE': 'es', // Venezuela
    'UY': 'es', // Uruguai
    'EC': 'es', // Equador
    'BO': 'es', // Bolívia
    'PY': 'es', // Paraguai
    'CR': 'es', // Costa Rica
    'PA': 'es', // Panamá
    'GT': 'es', // Guatemala
    'HN': 'es', // Honduras
    'SV': 'es', // El Salvador
    'NI': 'es', // Nicarágua
    'DO': 'es', // República Dominicana
    'CU': 'es', // Cuba
    'PR': 'es', // Porto Rico

    // Francês
    'FR': 'fr', // França
    'BE': 'fr', // Bélgica
    'CH': 'fr', // Suíça
    'CA': 'fr', // Canadá (bilíngue, mas aceitar francês)
    'SN': 'fr', // Senegal
    'CI': 'fr', // Costa do Marfim
    'ML': 'fr', // Mali
    'BF': 'fr', // Burkina Faso
    'NE': 'fr', // Níger
    'TD': 'fr', // Chade
    'MG': 'fr', // Madagascar
    'CM': 'fr', // Camarões
    'DJ': 'fr', // Djibuti
    'CF': 'fr', // República Centro-Africana
    'CG': 'fr', // República do Congo
    'GA': 'fr', // Gabão
    'GN': 'fr', // Guiné
    'RW': 'fr', // Ruanda
    'BI': 'fr', // Burundi
    'KM': 'fr', // Comores
    'VU': 'fr', // Vanuatu

    // Alemão
    'DE': 'de', // Alemanha
    'AT': 'de', // Áustria
    'LU': 'de', // Luxemburgo
    'LI': 'de', // Liechtenstein

    // Inglês (padrão) - países de língua inglesa
    'US': 'en', // Estados Unidos
    'GB': 'en', // Reino Unido
    'IE': 'en', // Irlanda
    'AU': 'en', // Austrália
    'NZ': 'en', // Nova Zelândia
    'ZA': 'en', // África do Sul
    'JM': 'en', // Jamaica
    'TT': 'en', // Trinidad e Tobago
    'BS': 'en', // Bahamas
    'BB': 'en', // Barbados
    'BZ': 'en', // Belize
    'GY': 'en', // Guiana
    'LC': 'en', // Santa Lúcia
    'GD': 'en', // Granada
    'VC': 'en', // São Vicente e Granadinas
    'AG': 'en', // Antígua e Barbuda
    'KN': 'en', // São Cristóvão e Névis
    'DM': 'en', // Dominica
    'IN': 'en', // Índia
    'PK': 'en', // Paquistão
    'BD': 'en', // Bangladesh
    'LK': 'en', // Sri Lanka
    'MY': 'en', // Malásia
    'SG': 'en', // Singapura
    'PH': 'en', // Filipinas
    'HK': 'en', // Hong Kong
    'MT': 'en', // Malta
    'CY': 'en', // Chipre
    'FJ': 'en', // Fiji
    'PG': 'en', // Papua Nova Guiné
    'VG': 'en', // Ilhas Virgens Britânicas
    'KY': 'en', // Ilhas Cayman
    'BM': 'en', // Bermudas
    'GI': 'en', // Gibraltar
    'FK': 'en', // Ilhas Malvinas
}

/**
 * Detecta o idioma baseado no IP do usuário
 */
export async function detectLanguageByIP(): Promise<Language> {
    try {
        const userIP = await getUserIP()
        if (!userIP) return 'en' // Fallback para inglês

        const geoData = await getGeolocationFromIP(userIP)
        if (!geoData) return 'en' // Fallback para inglês

        // Tentar obter código do país
        const countryCode = geoData.country_code || geoData.country
        if (!countryCode) return 'en' // Fallback para inglês

        // Mapear país para idioma
        const language = COUNTRY_TO_LANGUAGE[countryCode.toUpperCase()]
        return language || 'en' // Fallback para inglês se país não mapeado

    } catch (error) {
        console.warn('Erro ao detectar idioma por IP:', error)
        return 'en' // Fallback para inglês em caso de erro
    }
}

/**
 * Captura IP do usuário usando serviços externos
 */
async function getUserIP(): Promise<string | null> {
    try {
        // Tentar múltiplos serviços para garantir que funcione
        const services = [
            'https://api.ipify.org?format=json',
            'https://ipapi.co/json/',
            'https://api.ip.sb/jsonip'
        ]

        for (const service of services) {
            try {
                const controller = new AbortController()
                const timeoutId = setTimeout(() => controller.abort(), 3000)

                const response = await fetch(service, {
                    signal: controller.signal
                })

                clearTimeout(timeoutId)

                if (!response.ok) continue

                const data = await response.json()
                const ip = data.ip || data.query

                if (ip && ip !== '::1' && ip !== '127.0.0.1') {
                    return ip
                }
            } catch (error) {
                console.warn(`Failed to get IP from ${service}:`, error)
                continue
            }
        }

        return null
    } catch (error) {
        console.warn('Failed to get user IP:', error)
        return null
    }
}

/**
 * Captura informações de geolocalização baseado no IP
 */
async function getGeolocationFromIP(ip: string): Promise<GeolocationData | null> {
    try {
        // Usar múltiplos serviços para melhor confiabilidade
        const services = [
            {
                url: `https://ipapi.co/${ip}/json/`,
                parser: (data: any) => ({
                    country: data.country_name,
                    country_code: data.country_code
                })
            },
            {
                url: `http://ip-api.com/json/${ip}?fields=country,countryCode`,
                parser: (data: any) => ({
                    country: data.country,
                    country_code: data.countryCode
                })
            }
        ]

        for (const service of services) {
            try {
                const controller = new AbortController()
                const timeoutId = setTimeout(() => controller.abort(), 5000)

                const response = await fetch(service.url, {
                    signal: controller.signal
                })

                clearTimeout(timeoutId)

                if (!response.ok) continue

                const data = await response.json()

                // Verificar se a resposta é válida
                if (service.url.includes('ip-api.com') && data.status !== 'success') {
                    continue
                }

                const parsedData = service.parser(data)

                if (parsedData.country_code) {
                    return parsedData
                }
            } catch (error) {
                console.warn(`Failed to get geolocation from ${service.url}:`, error)
                continue
            }
        }

        return null
    } catch (error) {
        console.warn('Failed to get geolocation:', error)
        return null
    }
}

/**
 * Mapeia nome do país para código (backup para APIs que retornam só nome)
 */
const COUNTRY_NAME_TO_CODE: Record<string, string> = {
    'Brazil': 'BR',
    'Brasil': 'BR',
    'Portugal': 'PT',
    'Spain': 'ES',
    'España': 'ES',
    'France': 'FR',
    'Francia': 'FR',
    'Germany': 'DE',
    'Alemanha': 'DE',
    'Deutschland': 'DE',
    'United States': 'US',
    'Estados Unidos': 'US',
    'United Kingdom': 'GB',
    'Reino Unido': 'GB',
    'Argentina': 'AR',
    'Chile': 'CL',
    'Colombia': 'CO',
    'Mexico': 'MX',
    'México': 'MX',
    'Peru': 'PE',
    'Perú': 'PE',
    'Venezuela': 'VE',
    'Uruguay': 'UY',
    'Ecuador': 'EC',
    'Bolivia': 'BO',
    'Paraguay': 'PY',
}

/**
 * Resolve código do país a partir do nome se necessário
 */
export function getCountryCodeFromName(countryName: string): string | null {
    return COUNTRY_NAME_TO_CODE[countryName] || null
}

/**
 * Obtém lista de idiomas suportados com rótulos amigáveis
 */
export const SUPPORTED_LANGUAGES: Array<{ code: Language; name: string; flag: string }> = [
    { code: 'pt', name: 'Português', flag: '🇵🇹' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
]