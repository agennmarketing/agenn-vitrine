import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getWebhookSecret } from '@/lib/server-env'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { aspectFor, bunnyStatusToMedia, type MediaStatus } from '@/lib/video/rules'
import { verifyWebhookSignature } from '@/lib/video/signatures'
import { getVideoStream } from '@/lib/video/stream'
import { revalidateVitrine } from '@/lib/vitrines/cache'

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
      .select('id, owner_id, item_id, role, status, vitrines(subdomain)')
      .eq('bunny_video_id', payload.data.VideoGuid)
      .maybeSingle()
    if (!media) return NextResponse.json({ ignored: true })

    const stream = getVideoStream()
    const video = await stream.getVideo(payload.data.VideoGuid)

    let update: { status: MediaStatus; duration_seconds?: number; width?: number; height?: number; aspect?: '9:16' | '16:9' }
    if (!video) {
      update = { status: 'failed' }
    } else {
      const status = bunnyStatusToMedia(video.status)
      if (status !== 'ready') {
        update = { status }
      } else {
        const { data: planId } = await admin.rpc('effective_plan_id', { p_user_id: media.owner_id })
        const { data: plan } = await admin.from('plans').select('max_video_seconds').eq('id', planId ?? 'free').single()
        if (plan && video.length > plan.max_video_seconds + 1) {
          await stream.deleteVideo(video.guid)
          update = { status: 'failed' }
        } else {
          update = {
            status: 'ready',
            duration_seconds: video.length,
            width: video.width,
            height: video.height,
            aspect: aspectFor(video.width, video.height),
          }
        }
      }
    }

    if (update.status === media.status && update.status !== 'ready') return NextResponse.json({ unchanged: true })

    const { error } = await admin.from('media').update(update).eq('id', media.id)
    if (error) throw error

    const subdomain = (media.vitrines as { subdomain: string } | null)?.subdomain
    const visibleChange = update.status === 'ready' || media.status === 'ready'
    if (subdomain && visibleChange && (media.item_id || media.role === 'banner')) revalidateVitrine(subdomain)

    return NextResponse.json({ status: update.status })
  } catch (error) {
    Sentry.captureException(error)
    // 500 faz o Bunny tentar de novo.
    return NextResponse.json({ error: 'Falha ao processar o aviso.' }, { status: 500 })
  }
}
