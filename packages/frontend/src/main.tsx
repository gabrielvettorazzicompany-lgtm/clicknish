import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HeroUIProvider } from '@heroui/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import App from './App'
import './index.css'
import { OnboardingProvider } from './contexts/OnboardingContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { I18nProvider } from './i18n'
import { queryClient } from './services/queryClient'
// Inicializa funções globais supabaseFetch e supabaseRestFetch
import './services/supabase'

// Registrar Service Worker para PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(() => {
        console.log('Service Worker registrado com sucesso')
      })
      .catch((error) => {
        console.log('Falha ao registrar Service Worker:', error)
      })
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <HeroUIProvider>
          <ThemeProvider>
            <I18nProvider>
              <OnboardingProvider>
                <App />
              </OnboardingProvider>
            </I18nProvider>
          </ThemeProvider>
        </HeroUIProvider>
        {/* React Query Devtools - apenas em desenvolvimento */}
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
