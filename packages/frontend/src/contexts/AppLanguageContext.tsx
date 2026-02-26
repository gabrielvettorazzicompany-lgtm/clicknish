import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { type Language } from '@/locales/translations'

interface AppLanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
}

const AppLanguageContext = createContext<AppLanguageContextType>({
  language: 'pt-br',
  setLanguage: () => {}
})

export function useAppLanguage() {
  return useContext(AppLanguageContext)
}

interface AppLanguageProviderProps {
  children: ReactNode
  initialLanguage?: string
}

/**
 * Provider para gerenciar o idioma do app em toda a aplicação do cliente
 * 
 * @example
 * // No componente raiz após o cliente fazer login
 * <AppLanguageProvider initialLanguage={appData?.language}>
 *   <ClientApp />
 * </AppLanguageProvider>
 */
export function AppLanguageProvider({ children, initialLanguage = 'pt-br' }: AppLanguageProviderProps) {
  const [language, setLanguage] = useState<Language>(initialLanguage as Language)

  useEffect(() => {
    if (initialLanguage) {
      setLanguage(initialLanguage as Language)
    }
  }, [initialLanguage])

  return (
    <AppLanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </AppLanguageContext.Provider>
  )
}
