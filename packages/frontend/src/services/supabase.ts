import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

// API fetch helper for Supabase Edge Functions
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || `${supabaseUrl}/functions/v1`

interface FetchOptions extends RequestInit {
  headers?: Record<string, string>
}

export async function supabaseFetch(endpoint: string, options: FetchOptions = {}): Promise<Response> {
  const url = endpoint.startsWith('http') ? endpoint : `${apiBaseUrl}/${endpoint}`

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
    ...options.headers,
  }

  return fetch(url, {
    ...options,
    headers,
  })
}

// Expor globalmente para compatibilidade com código existente
declare global {
  function supabaseFetch(endpoint: string, options?: FetchOptions): Promise<Response>
}

(window as any).supabaseFetch = supabaseFetch
