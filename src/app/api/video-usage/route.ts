import * as Sentry from '@sentry/nextjs'
import { after, NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { notifyVideoQuotaExceeded } from '@/features/videos/notify-quota'
import { env } from '@/lib/env'
import { parseHost } from '@/lib/hosts/parse-host'
import { clientIp, rateLimitKey } from '@/lib/orders/client-ip'
import { getRateLimitSalt } from '@/lib/server-env'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { clampReportedBytes } from '@/lib/video/rules'
import { revalidateVitrine } from '@/lib/vitrines/cache'

const bodySchema = z.object({ mediaId: z.uuid(), bytes: z.number(), seconds: z.number() })
const noContent = () => new NextResponse(null, { status: 204 })

export async function POST(request: NextRequest) {
  const host = parseHost(request.headers.get('host'), {
    rootDomain: env.NEXT_PUBLIC_ROOT_DOMAIN,
    legacyDomains: env.LEGACY_DOMAINS,
  })
  if (host.type !== 'vitrine') return noContent()

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Relatório inválido.' }, { status: 400 })
  const bytes = clampReportedBytes(parsed.data.bytes, parsed.data.seconds)
  if (bytes === 0) return noContent()

  try {
    const admin = createSupabaseAdminClient()
    const key = await rateLimitKey(clientIp(request.headers), 'video-usage', getRateLimitSalt())
    const { data: allowed } = await admin.rpc('hit_rate_limit', { p_key: key, p_limit: 600, p_window_seconds: 3600 })
    if (allowed === false) return NextResponse.json({ error: 'Muitos relatórios.' }, { status: 429 })

    // O vídeo precisa ser desta vitrine: outro host não soma consumo alheio.
    const { data: media } = await admin
      .from('media')
      .select('id, vitrines!media_vitrine_id_fkey!inner(subdomain)')
      .eq('id', parsed.data.mediaId)
      .eq('kind', 'video')
      .eq('status', 'ready')
      .maybeSingle()
    const subdomain = (media?.vitrines as { subdomain: string } | undefined)?.subdomain
    if (!media || subdomain !== host.subdomain) return noContent()

    const { data: usage, error } = await admin.rpc('add_video_usage', { p_media_id: media.id, p_bytes: bytes })
    if (error) throw error
    const result = usage?.[0]
    if (result?.crossed_quota) {
      const { data: vitrines } = await admin.from('vitrines').select('subdomain').eq('owner_id', result.usage_owner_id)
      revalidateVitrine(...(vitrines ?? []).map((v) => v.subdomain))
      const ownerId = result.usage_owner_id
      // O e-mail sai depois da resposta: a vitrine não espera o Resend.
      after(async () => {
        try {
          await notifyVideoQuotaExceeded(admin, ownerId)
        } catch (error) {
          Sentry.captureException(error)
        }
      })
    }
    return noContent()
  } catch (error) {
    Sentry.captureException(error)
    return noContent()
  }
}
