import 'server-only'
import * as Sentry from '@sentry/nextjs'
import { after } from 'next/server'
import { env } from '@/lib/env'
import { getNetlifyDomainsEnv } from '@/lib/server-env'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { syncNetlifyDomainAliases } from './domain-aliases'

// null = sincronização desligada (sem NETLIFY_API_TOKEN/NETLIFY_SITE_ID).
export async function syncDomainAliases(): Promise<{ added: string[]; removed: string[] } | null> {
  const netlify = getNetlifyDomainsEnv()
  if (!netlify) return null
  const { data, error } = await createSupabaseAdminClient().from('vitrines').select('subdomain')
  if (error) throw error
  return syncNetlifyDomainAliases({
    ...netlify,
    rootDomain: env.NEXT_PUBLIC_ROOT_DOMAIN,
    subdomains: (data ?? []).map((row) => row.subdomain),
  })
}

// Depois da resposta: uma falha na Netlify não atrapalha quem está salvando, e a
// tarefa diária corrige o que ficar para trás.
export function scheduleDomainSync() {
  after(() => syncDomainAliases().catch((error) => Sentry.captureException(error)))
}
