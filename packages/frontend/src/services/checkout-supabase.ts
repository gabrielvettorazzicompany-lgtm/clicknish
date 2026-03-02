/**
 * ⚡ CHECKOUT-ONLY Supabase client
 *
 * Este arquivo existe EXCLUSIVAMENTE para isolar o checkout do chunk compartilhado
 * `services/supabase.ts`. O chunk compartilhado fica contaminado com
 * `import"vendor-heroui"` como side-effect do entry point do dashboard
 * (que usa heroui), forçando o checkout a baixar +198KB desnecessários.
 *
 * Ao ter um arquivo separado importado APENAS pelo checkout, o Rollup cria um
 * chunk isolado sem side-effects do heroui.
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const checkoutSupabase = createClient(supabaseUrl, supabaseKey)
