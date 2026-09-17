import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'
import { getSupabaseSecretKey } from '@/lib/server-env'
import type { Database } from './database.types'

// Ignora RLS. Só depois de conferir dono e permissões no código que chama.
export function createSupabaseAdminClient() {
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, getSupabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
