import 'server-only'
import * as Sentry from '@sentry/nextjs'
import { env } from '@/lib/env'
import { getNetlifyDomainsEnv } from '@/lib/server-env'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { NETLIFY_MAX_ALIASES, syncNetlifyDomainAliases } from './domain-aliases'

const inProduction = () => (process.env.APP_ENV ?? process.env.VERCEL_ENV) === 'production'

// null = sincronização desligada (sem NETLIFY_API_TOKEN).
export async function syncDomainAliases(): Promise<{ added: string[]; removed: string[]; skipped: string[] } | null> {
  const netlify = getNetlifyDomainsEnv()
  if (!netlify) {
    // Em produção isso deixa as vitrines novas sem endereço: avisa no log das funções.
    if (inProduction()) console.warn('[subdominios] NETLIFY_API_TOKEN ausente: as vitrines não são cadastradas na Netlify.')
    return null
  }
  // Prioridade se passar do limite da Netlify: ativas antes das congeladas ('active' < 'frozen'), as mais novas primeiro.
  const { data, error } = await createSupabaseAdminClient()
    .from('vitrines')
    .select('subdomain')
    .order('status')
    .order('created_at', { ascending: false })
  if (error) throw error
  const result = await syncNetlifyDomainAliases({
    ...netlify,
    rootDomain: env.NEXT_PUBLIC_ROOT_DOMAIN,
    subdomains: (data ?? []).map((row) => row.subdomain),
  })
  if (result.added.length || result.removed.length) console.info('[subdominios] Netlify atualizada', { added: result.added, removed: result.removed })
  if (result.skipped.length) {
    console.warn(`[subdominios] limite de ${NETLIFY_MAX_ALIASES} aliases da Netlify: ${result.skipped.length} vitrine(s) sem endereço`, result.skipped.slice(0, 20))
  }
  return result
}

/*
 * Roda dentro da própria ação (e não em `after()`, que a hospedagem pode encerrar
 * antes de terminar): são três chamadas rápidas à Netlify. Uma falha não atrapalha
 * quem está salvando; vai para o log e o Sentry, e a tarefa diária corrige depois.
 */
export async function syncDomainsSafely(): Promise<void> {
  try {
    await syncDomainAliases()
  } catch (error) {
    console.error('[subdominios] falha ao sincronizar com a Netlify', error)
    Sentry.captureException(error)
  }
}
