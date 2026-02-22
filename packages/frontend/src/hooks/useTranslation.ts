import { useState, useEffect } from 'react'
import { getTranslation, type Language, type TranslationKey } from '@/locales/translations'

/**
 * Hook para usar traduções no app
 * 
 * @param appLanguage - Idioma do app (opcional, padrão é 'en')
 * @returns Função t() para traduzir e o idioma atual
 * 
 * @example
 * const { t } = useTranslation(appData?.language)
 * 
 * // Uso básico
 * <button>{t('access')}</button>
 * 
 * // Com parâmetros
 * <p>{t('welcomeMessage', { productName: 'Curso XYZ' })}</p>
 */
export function useTranslation(appLanguage?: string) {
  const [language, setLanguage] = useState<Language>((appLanguage || 'en') as Language)

  useEffect(() => {
    if (appLanguage) {
      setLanguage(appLanguage as Language)
    }
  }, [appLanguage])

  const t = (key: TranslationKey, params?: Record<string, string>) => {
    return getTranslation(language, key, params)
  }

  return { t, language, setLanguage }
}
