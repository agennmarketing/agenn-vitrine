import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'
import { SYNC_MEDIA_COLUMNS, syncVideoStatus } from '@/features/videos/sync-status'
import { getApiUser } from '@/lib/auth/require-user'
import { deleteMediaRows } from '@/lib/media/remove-media'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { revalidateVitrine } from '@/lib/vitrines/cache'
import { NO_ACCESS_MESSAGE } from '@/lib/billing/status'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiUser()
  if (!session) return NextResponse.json({ error: 'Sua sessão expirou. Entre novamente.' }, { status: 401 })
  const { data: plan } = await session.supabase.rpc('my_entitlements')
  if (plan?.id !== 'essencial') return NextResponse.json({ error: NO_ACCESS_MESSAGE }, { status: 403 })
  const { id } = await params

  // RLS: só encontra mídia do próprio dono.
  const { data: media } = await session.supabase
    .from('media')
    .select('id, role, item_id, storage_paths, mux_upload_id, mux_asset_id, vitrines!media_vitrine_id_fkey(subdomain)')
    .eq('id', id)
    .maybeSingle()
  if (!media) return new NextResponse(null, { status: 204 })
  if (media.role === 'cover' && media.item_id) {
    return NextResponse.json({ error: 'A capa é obrigatória. Envie outra imagem para trocar.' }, { status: 409 })
  }

  try {
    await deleteMediaRows(createSupabaseAdminClient(), [media])
  } catch (error) {
    Sentry.captureException(error)
    return NextResponse.json({ error: 'Não foi possível remover a imagem. Tente novamente.' }, { status: 503 })
  }
  const subdomain = (media.vitrines as { subdomain: string } | null)?.subdomain
  if (subdomain && (media.item_id || media.role === 'logo' || media.role === 'banner')) revalidateVitrine(subdomain)
  return new NextResponse(null, { status: 204 })
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiUser()
  if (!session) return NextResponse.json({ error: 'Sua sessão expirou. Entre novamente.' }, { status: 401 })
  const { id } = await params
  // RLS: só encontra mídia do próprio dono.
  const { data: media } = await session.supabase
    .from('media')
    .select(`${SYNC_MEDIA_COLUMNS}, thumbnail_url`)
    .eq('id', id)
    .maybeSingle()
  if (!media) return NextResponse.json({ error: 'Mídia não encontrada.' }, { status: 404 })

  let status = media.status
  // Enquanto processa, consulta o provedor: o painel não depende só do webhook.
  if (status === 'processing' && (media.mux_upload_id || media.mux_asset_id)) {
    try {
      status = await syncVideoStatus(createSupabaseAdminClient(), media)
    } catch (error) {
      Sentry.captureException(error)
    }
  }

  // A miniatura só existe depois de pronto: relê a linha que o sync acabou de atualizar.
  let thumbnailUrl = media.thumbnail_url
  if (status === 'ready' && !thumbnailUrl) {
    const { data: fresh } = await session.supabase.from('media').select('thumbnail_url').eq('id', id).maybeSingle()
    thumbnailUrl = fresh?.thumbnail_url ?? null
  }
  return NextResponse.json({ status, thumbnailUrl }, { headers: { 'Cache-Control': 'no-store' } })
}
