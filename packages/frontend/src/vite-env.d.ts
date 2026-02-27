/// &lt;reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_API_BASE_URL?: string
  readonly VITE_PROD?: string
  readonly VITE_STRIPE_PUBLIC_KEY?: string
  readonly VITE_APP_URL?: string
  readonly PROD: boolean
  readonly MODE: string
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  __IS_CUSTOM_DOMAIN__?: boolean
  __CUSTOM_DOMAIN__?: string
  // ⚡ Checkout prefetch — iniciado em index.html antes do React carregar
  __IS_CHECKOUT_ROUTE__?: boolean
  __CHECKOUT_SHORT_ID__?: string
  __checkoutDataPromise?: Promise<any>
  // Dados já resolvidos pelo pre-render (disponível antes do React montar)
  __CHECKOUT_DATA__?: any
}