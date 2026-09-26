import 'server-only'
import { getPanelSession } from '@/features/vitrines/queries'
import { env } from '@/lib/env'
import { imageSources } from '@/lib/media/urls'

export type PanelProfessional = {
  id: string
  name: string
  active: boolean
  position: number
  businessHours: { day: number; open: string; close: string }[] | null
  itemIds: string[]
  avatar: { id: string; url: string } | null
}

function readHours(value: unknown): PanelProfessional['businessHours'] {
  if (!Array.isArray(value)) return null
  return value.filter(
    (entry): entry is { day: number; open: string; close: string } =>
      typeof entry?.day === 'number' && typeof entry?.open === 'string' && typeof entry?.close === 'string',
  )
}

// Profissionais da vitrine, com os serviços que cada um atende e a foto.
export async function listProfessionals(vitrineId: string): Promise<PanelProfessional[]> {
  const { supabase } = await getPanelSession()
  const [professionals, links, avatars] = await Promise.all([
    supabase
      .from('professionals')
      .select('id, name, active, position, business_hours')
      .eq('vitrine_id', vitrineId)
      .order('position')
      .order('created_at'),
    supabase.from('professional_items').select('professional_id, item_id'),
    supabase.from('media').select('id, professional_id, storage_paths').eq('vitrine_id', vitrineId).eq('role', 'avatar'),
  ])
  if (professionals.error) throw professionals.error
  if (links.error) throw links.error
  if (avatars.error) throw avatars.error

  return (professionals.data ?? []).map((row) => {
    const avatarRow = (avatars.data ?? []).find((media) => media.professional_id === row.id)
    const sources = avatarRow ? imageSources(avatarRow.storage_paths, env.NEXT_PUBLIC_MEDIA_BASE_URL) : null
    return {
      id: row.id,
      name: row.name,
      active: row.active,
      position: row.position,
      businessHours: readHours(row.business_hours),
      itemIds: (links.data ?? []).filter((link) => link.professional_id === row.id).map((link) => link.item_id),
      avatar: avatarRow && sources ? { id: avatarRow.id, url: sources.small } : null,
    }
  })
}
