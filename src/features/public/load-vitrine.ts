import 'server-only'
import { unstable_cache } from 'next/cache'
import { env } from '@/lib/env'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { vitrineTag } from '@/lib/vitrines/cache'
import { buildPublicCatalog, type CatalogRows, type PublicVitrine } from './build-catalog'

async function fetchCatalog(subdomain: string): Promise<PublicVitrine | null> {
  const admin = createSupabaseAdminClient()
  const { data: vitrine, error } = await admin
    .from('vitrines')
    .select('id, owner_id, subdomain, type, name, description, theme, status, show_prices, show_media, default_button_text, brand_color, banner_enabled, logo_media_id, banner_media_id, primary_whatsapp_id')
    .eq('subdomain', subdomain)
    .maybeSingle()
  if (error) throw error
  if (!vitrine) return null

  const { data: planId, error: planIdError } = await admin.rpc('effective_plan_id', { p_user_id: vitrine.owner_id })
  if (planIdError) throw planIdError
  const { data: overQuota, error: quotaError } = await admin.rpc('is_over_video_quota', { p_user_id: vitrine.owner_id })
  if (quotaError) throw quotaError

  const [plan, contacts, categories, items, media] = await Promise.all([
    admin.from('plans').select('max_items_per_vitrine, max_videos_per_vitrine, allow_branding, show_watermark').eq('id', planId).single(),
    admin.from('whatsapp_contacts').select('id, phone_e164').eq('vitrine_id', vitrine.id),
    admin.from('categories').select('id, name, position').eq('vitrine_id', vitrine.id),
    admin
      .from('items')
      .select('id, category_id, code, name, description, price_type, price_cents, promo_price_cents, duration_minutes, tags, sold_out, position, whatsapp_id, button_text, custom_message')
      .eq('vitrine_id', vitrine.id)
      .is('deleted_at', null)
      .order('position')
      .order('created_at'),
    admin.from('media').select('id, item_id, role, kind, position, storage_paths, bunny_video_id, aspect').eq('vitrine_id', vitrine.id).eq('status', 'ready'),
  ])
  for (const result of [plan, contacts, categories, items, media]) if (result.error) throw result.error

  const itemIds = (items.data ?? []).map((i) => i.id)
  const variations = itemIds.length
    ? await admin
        .from('item_variations')
        .select('id, item_id, name, price_cents, promo_price_cents, sold_out, position')
        .in('item_id', itemIds)
    : { data: [], error: null }
  if (variations.error) throw variations.error

  return buildPublicCatalog(
    {
      vitrine,
      plan: plan.data!,
      overQuota: overQuota ?? false,
      contacts: contacts.data ?? [],
      categories: categories.data ?? [],
      items: (items.data ?? []) as CatalogRows['items'],
      variations: variations.data ?? [],
      media: media.data ?? [],
    },
    env.NEXT_PUBLIC_MEDIA_BASE_URL,
    env.NEXT_PUBLIC_VIDEO_CDN_BASE_URL,
  )
}

export function loadPublicVitrine(subdomain: string) {
  return unstable_cache(() => fetchCatalog(subdomain), ['public-vitrine', subdomain], {
    tags: [vitrineTag(subdomain)],
  })()
}
