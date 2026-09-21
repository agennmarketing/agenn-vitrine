import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { SYNC_MEDIA_COLUMNS, syncVideoStatus } from '@/features/videos/sync-status'
import { getWebhookSecret } from '@/lib/server-env'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { verifyMuxSignature } from '@/lib/video/signatures'

const payloadSchema = z.object({
  type: z.string().min(1),
  data: z.object({ id: z.string().min(1), upload_id: z.string().optional(), asset_id: z.string().optional() }),
})

// Eventos do asset trazem o upload que o originou; os do upload vêm com o próprio id.
const ASSET_EVENTS = new Set(['video.asset.ready', 'video.asset.errored', 'video.asset.deleted'])
const UPLOAD_EVENTS = new Set(['video.upload.asset_created', 'video.upload.errored', 'video.upload.cancelled'])

// O aviso do Mux só diz "algo mudou": o estado vem da API, como na consulta do painel.
export async function POST(request: Request) {
  const raw = await request.text()

  let secret: string
  try {
    secret = getWebhookSecret()
  } catch (error) {
    Sentry.captureException(error)
    return NextResponse.json({ error: 'Webhook indisponível.' }, { status: 503 })
  }
  if (!verifyMuxSignature(raw, request.headers.get('mux-signature'), secret)) {
    return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 401 })
  }

  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })
  }
  const payload = payloadSchema.safeParse(json)
  if (!payload.success) return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })

  const { type, data } = payload.data
  const uploadId = ASSET_EVENTS.has(type) ? data.upload_id : UPLOAD_EVENTS.has(type) ? data.id : undefined
  const assetId = ASSET_EVENTS.has(type) ? data.id : data.asset_id
  if (!uploadId && !assetId) return NextResponse.json({ ignored: true })

  try {
    const admin = createSupabaseAdminClient()
    const query = admin.from('media').select(SYNC_MEDIA_COLUMNS)
    const { data: media } = await (uploadId
      ? query.eq('mux_upload_id', uploadId)
      : query.eq('mux_asset_id', assetId!)
    ).maybeSingle()
    if (!media) return NextResponse.json({ ignored: true })

    const status = await syncVideoStatus(admin, media)
    return NextResponse.json({ status })
  } catch (error) {
    Sentry.captureException(error)
    // 500 faz o Mux tentar de novo.
    return NextResponse.json({ error: 'Falha ao processar o aviso.' }, { status: 500 })
  }
}
