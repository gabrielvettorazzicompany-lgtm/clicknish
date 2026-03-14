import { createContext, useContext, useState, ReactNode } from 'react'
import pt from '@/locales/pt.json'
import en from '@/locales/en.json'
import es from '@/locales/es.json'
import fr from '@/locales/fr.json'
import de from '@/locales/de.json'
import nl from '@/locales/nl.json'

export type Language = 'pt' | 'es' | 'en' | 'fr' | 'de' | 'nl'

interface I18nContextProps {
    language: Language
    setLanguage: (lang: Language) => void
    t: (key: string, vars?: Record<string, any>) => string
}

const translations: Record<Language, Record<string, any>> = { pt, en, es, fr, de, nl }

/**
 * Resolve a dot-notation key (e.g. "orders.tabs.all") from a nested object.
 */
function resolve(obj: Record<string, any>, path: string): string | undefined {
    const parts = path.split('.')
    let current: any = obj
    for (const part of parts) {
        if (current == null || typeof current !== 'object') return undefined
        current = current[part]
    }
    return typeof current === 'string' ? current : undefined
}

const STORAGE_KEY = 'huskyapp_language'

function getInitialLanguage(): Language {
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored === 'pt' || stored === 'en' || stored === 'es' || stored === 'fr' || stored === 'de' || stored === 'nl') return stored
    } catch { /* ignore */ }
    const nav = navigator.language?.toLowerCase() ?? ''
    if (nav.startsWith('es')) return 'es'
    if (nav.startsWith('fr')) return 'fr'
    if (nav.startsWith('de')) return 'de'
    if (nav.startsWith('nl')) return 'nl'
    if (nav.startsWith('en')) return 'en'
    return 'pt'
}

const I18nContext = createContext<I18nContextProps | undefined>(undefined)

export function I18nProvider({ children }: { children: ReactNode }) {
    const [language, setLanguageState] = useState<Language>(getInitialLanguage)

    const setLanguage = (lang: Language) => {
        setLanguageState(lang)
        try { localStorage.setItem(STORAGE_KEY, lang) } catch { /* ignore */ }
    }

    const t = (key: string, vars?: Record<string, any>) => {
        let str = resolve(translations[language], key) ?? resolve(translations['pt'], key) ?? key
        if (vars) {
            Object.entries(vars).forEach(([k, v]) => {
                str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
            })
        }
        return str
    }

    return (
        <I18nContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </I18nContext.Provider>
    )
}

export function useI18n() {
    const ctx = useContext(I18nContext)
    if (!ctx) throw new Error('useI18n must be used within I18nProvider')
    return ctx
}

/**
 * Resolve a translation key for a specific language (without changing global state).
 * Normalizes 'pt-br' / 'pt-BR' to 'pt'.
 */
export function tForLang(lang: string, key: string, vars?: Record<string, any>): string {
    const normalised = lang.toLowerCase().replace('pt-br', 'pt') as Language
    const dict = translations[normalised] || translations['en']
    let str = resolve(dict, key) ?? resolve(translations['en'], key) ?? key
    if (vars) {
        Object.entries(vars).forEach(([k, v]) => {
            str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
        })
    }
    return str
}
