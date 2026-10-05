import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'
import { reconcileSubscriptions } from '@/features/billing/reconcile'
import { syncDomainAliases } from '@/lib/hosts/sync-domains'
import { deleteMediaRows } from '@/lib/media/remove-media'
import { getCronSecret } from '@/lib/server-env'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { revalidateVitrine } from '@/lib/vitrines/cache'

const BATCH = 100

// Spec 6.4: mídias órfãs e falhas, pedidos expirados, limites antigos, conferência das
// assinaturas com o Stripe e fim dos testes grátis sem assinatura (vitrine sai do ar, nada
// é apagado) e os subdomínios cadastrados na Netlify, para o caso de uma sincronização
// feita na hora ter falhado.
export async function GET(request: Request) {
  let secret: string
  try {
    secret = getCronSecret()
  } catch (error) {
    Sentry.captureException(error)
    return NextResponse.json({ error: 'Cron indisponível.' }, { status: 503 })
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  try {
    const admin = createSupabaseAdminClient()

    const { data: candidates, error: candidatesError } = await admin.rpc('media_cleanup_candidates')
    if (candidatesError) throw candidatesError
    const rows = candidates ?? []
    for (let start = 0; start < rows.length; start += BATCH) {
      await deleteMediaRows(admin, rows.slice(start, start + BATCH))
    }

    const { data: expired, error: expiredError } = await admin.rpc('cleanup_expired_rows')
    if (expiredError) throw expiredError

    const subscriptions = await reconcileSubscriptions(admin)
    const { data: expiredTrials, error: trialsError } = await admin.rpc('expire_trials')
    if (trialsError) throw trialsError
    revalidateVitrine(...(expiredTrials ?? []))

    // Falha aqui não derruba o resto da tarefa: vai para o Sentry e tenta de novo amanhã.
    const domains = await syncDomainAliases().catch((error) => {
      Sentry.captureException(error)
      return 'erro' as const
    })

    return NextResponse.json({
      media: rows.length,
      orders: expired?.[0]?.orders_deleted ?? 0,
      rateLimits: expired?.[0]?.rate_limits_deleted ?? 0,
      subscriptions,
      blockedVitrines: expiredTrials?.length ?? 0,
      domains,
    })
  } catch (error) {
    Sentry.captureException(error)
    return NextResponse.json({ error: 'Falha na tarefa diária.' }, { status: 500 })
  }
}
