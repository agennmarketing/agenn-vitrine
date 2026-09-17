import 'server-only'
import { notFound } from 'next/navigation'
import { getMyVitrine, getPanelSession } from '@/features/vitrines/queries'
import { env } from '@/lib/env'
import { imageSources } from '@/lib/media/urls'

export async function getItemFormOptions(vitrineId: string) {
  const vitrine = await getMyVitrine(vitrineId)
  const { supabase } = await getPanelSession()
  const [categories, contacts, nextCode, groups] = await Promise.all([
    supabase.from('categories').select('id, name').eq('vitrine_id', vitrineId).order('position'),
    supabase.from('whatsapp_contacts').select('id, label').eq('vitrine_id', vitrineId).order('position'),
    supabase.rpc('peek_next_item_code'),
    supabase.from('addon_groups').select('id, name').eq('vitrine_id', vitrineId).order('position').order('created_at'),
  ])
  return {
    vitrine: { id: vitrine.id, type: vitrine.type, subdomain: vitrine.subdomain },
    categories: categories.data ?? [],
    contacts: contacts.data ?? [],
    nextCode: nextCode.data ?? '',
    addonGroups: groups.data ?? [],
  }
}

export async function getItemForEdit(vitrineId: string, itemId: string) {
  const { supabase } = await getPanelSession()
  const { data: item } = await supabase
    .from('items')
    .select('*, item_variations(id, name, price_cents, promo_price_cents, sold_out, position), media(id, role, position, storage_paths, status), item_addon_groups(group_id, position)')
    .eq('id', itemId)
    .eq('vitrine_id', vitrineId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!item) notFound()

  const toSlot = (row: { id: string; storage_paths: unknown } | undefined) => {
    const sources = row ? imageSources(row.storage_paths, env.NEXT_PUBLIC_MEDIA_BASE_URL) : null
    return row && sources ? { id: row.id, url: sources.small } : null
  }
  const media = item.media ?? []
  return {
    ...item,
    variations: [...(item.item_variations ?? [])].sort((a, b) => a.position - b.position),
    addonGroupIds: [...(item.item_addon_groups ?? [])].sort((a, b) => a.position - b.position).map((link) => link.group_id),
    cover: toSlot(media.find((m) => m.role === 'cover')),
    gallery: [1, 2].map((position) => toSlot(media.find((m) => m.role === 'gallery' && m.position === position))) as [
      { id: string; url: string } | null,
      { id: string; url: string } | null,
    ],
    video: (() => {
      const row = media.find((m) => m.role === 'video')
      return row ? { id: row.id, status: row.status as 'processing' | 'ready' | 'failed' } : null
    })(),
  }
}
