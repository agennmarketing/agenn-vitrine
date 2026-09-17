import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'
import { getApiUser } from '@/lib/auth/require-user'
import { deleteMediaRows } from '@/lib/media/remove-media'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { revalidateVitrine } from '@/lib/vitrines/cache'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiUser()
  if (!session) return NextResponse.json({ error: 'Sua sessão expirou. Entre novamente.' }, { status: 401 })
  const { id } = await params

  // RLS: só encontra mídia do próprio dono.
  const { data: media } = await session.supabase
    .from('media')
    .select('id, role, item_id, storage_paths, vitrines(subdomain)')
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
