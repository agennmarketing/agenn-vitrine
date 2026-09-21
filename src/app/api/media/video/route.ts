import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getApiUser } from '@/lib/auth/require-user'
import { deleteMediaRows } from '@/lib/media/remove-media'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { validateVideoFile } from '@/lib/video/rules'
import { getVideoService } from '@/lib/video/video-service'
import { isPlanLimitError, mapDbError } from '@/lib/vitrines/db-errors'

const bodySchema = z
  .object({
    role: z.enum(['video', 'banner']),
    vitrineId: z.uuid(),
    itemId: z.uuid().nullable().default(null),
    durationSeconds: z.number(),
    sizeBytes: z.number().int().nonnegative(),
    width: z.number().int().nonnegative(),
    height: z.number().int().nonnegative(),
  })
  .refine((value) => value.role === 'video' || value.itemId === null)

const fail = (status: number, error: string) => NextResponse.json({ error }, { status })
const PREPARE_FAILED = 'Não foi possível preparar o envio. Tente novamente.'

export async function POST(request: Request) {
  const session = await getApiUser()
  if (!session) return fail(401, 'Sua sessão expirou. Entre novamente.')

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return fail(400, 'Dados do envio inválidos.')
  const input = parsed.data
  const { supabase, userId } = session

  const { data: vitrine } = await supabase.from('vitrines').select('id, subdomain').eq('id', input.vitrineId).maybeSingle()
  if (!vitrine) return fail(404, 'Vitrine não encontrada.')
  if (input.itemId) {
    const { data: item } = await supabase
      .from('items')
      .select('id')
      .eq('id', input.itemId)
      .eq('vitrine_id', input.vitrineId)
      .is('deleted_at', null)
      .maybeSingle()
    if (!item) return fail(404, 'Item não encontrado.')
  }

  const { data: plan } = await supabase.rpc('my_entitlements')
  if (!plan) return fail(500, PREPARE_FAILED)
  if (input.role === 'banner' && !plan.allow_branding) return fail(403, 'Banner em vídeo é recurso do plano Pro.')

  const check = validateVideoFile(
    input,
    { maxSeconds: plan.max_video_seconds, maxUploadMb: plan.max_video_upload_mb },
    input.role,
  )
  if (!check.ok) return fail(422, check.message)

  let videos: ReturnType<typeof getVideoService>
  let admin: ReturnType<typeof createSupabaseAdminClient>
  try {
    videos = getVideoService()
    admin = createSupabaseAdminClient()
  } catch (error) {
    Sentry.captureException(error)
    return fail(503, 'Envio de vídeos indisponível no momento. Tente mais tarde.')
  }

  const { data: overQuota } = await admin.rpc('is_over_video_quota', { p_user_id: userId })
  if (overQuota) return fail(403, 'A franquia de vídeo deste mês acabou. Os vídeos voltam no próximo mês.')

  let upload: Awaited<ReturnType<typeof videos.upload>>
  try {
    upload = await videos.upload({
      title: `${vitrine.subdomain} · ${input.role}`,
      // O envio direto só é aceito se vier da origem do painel.
      corsOrigin: new URL(request.url).origin,
      durationSeconds: input.durationSeconds,
      width: input.width,
      height: input.height,
    })
  } catch (error) {
    Sentry.captureException(error)
    return fail(502, PREPARE_FAILED)
  }

  try {
    // O vídeo do item e o banner ocupam um espaço só: o anterior é substituído.
    if (input.itemId || input.role === 'banner') {
      let previousQuery = admin
        .from('media')
        .select('id, storage_paths, mux_upload_id, mux_asset_id')
        .eq('vitrine_id', input.vitrineId)
        .eq('role', input.role)
      if (input.itemId) previousQuery = previousQuery.eq('item_id', input.itemId)
      const { data: previous, error: previousError } = await previousQuery
      if (previousError) throw previousError
      await deleteMediaRows(admin, previous ?? [])
    }

    const mediaId = crypto.randomUUID()
    const { error: insertError } = await admin.from('media').insert({
      id: mediaId,
      owner_id: userId,
      vitrine_id: input.vitrineId,
      item_id: input.itemId,
      role: input.role,
      kind: 'video',
      status: 'processing',
      mux_upload_id: upload.uploadId,
      duration_seconds: check.durationSeconds,
      aspect: check.aspect,
      width: input.width,
      height: input.height,
      bytes: input.sizeBytes,
    })
    if (insertError) {
      if (isPlanLimitError(insertError)) return fail(403, mapDbError(insertError))
      throw insertError
    }

    if (input.role === 'banner') {
      const { error: linkError } = await admin.from('vitrines').update({ banner_media_id: mediaId }).eq('id', input.vitrineId)
      if (linkError) throw linkError
    }

    return NextResponse.json({ id: mediaId, upload: { url: upload.url } }, { status: 201 })
  } catch (error) {
    Sentry.captureException(error)
    return fail(500, PREPARE_FAILED)
  }
}
