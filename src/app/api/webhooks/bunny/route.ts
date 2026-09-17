import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { SYNC_MEDIA_COLUMNS, syncVideoStatus } from '@/features/videos/sync-status'
import { getWebhookSecret } from '@/lib/server-env'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { verifyWebhookSignature } from '@/lib/video/signatures'

const payloadSchema = z.object({ VideoGuid: z.string().min(1), Status: z.number().int() })

// Spec 6.2: o aviso do Bunny só diz "algo mudou"; o estado vem da API do Stream.
export async function POST(request: Request) {
  const raw = await request.text()

  let secret: string
  try {
    secret = getWebhookSecret()
  } catch (error) {
    Sentry.captureException(error)
    return NextResponse.json({ error: 'Webhook indisponível.' }, { status: 503 })
  }
  if (!verifyWebhookSignature(raw, request.headers.get('x-bunnystream-signature'), secret)) {
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

  try {
    const admin = createSupabaseAdminClient()
    const { data: media } = await admin
      .from('media')
      .select(SYNC_MEDIA_COLUMNS)
      .eq('bunny_video_id', payload.data.VideoGuid)
      .maybeSingle()
    if (!media) return NextResponse.json({ ignored: true })

    const status = await syncVideoStatus(admin, media)
    return NextResponse.json({ status })
  } catch (error) {
    Sentry.captureException(error)
    // 500 faz o Bunny tentar de novo.
    return NextResponse.json({ error: 'Falha ao processar o aviso.' }, { status: 500 })
  }
}
