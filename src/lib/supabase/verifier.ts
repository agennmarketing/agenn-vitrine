import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'
import type { Database } from './database.types'

// Confere a senha atual sem tocar nos cookies da sessão do usuário.
export function createSupabaseVerifierClient() {
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
