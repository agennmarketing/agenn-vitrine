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
    .select('id, owner_id, subdomain, type, name, description, theme, status, show_prices, show_media, default_button_text, brand_color, banner_enabled, cart_enabled, cart_button_text, logo_media_id, banner_media_id, primary_whatsapp_id')
    .eq('subdomain', subdomain)
    .maybeSingle()
  if (error) throw error
  if (!vitrine) return null

  const { data: planId, error: planIdError } = await admin.rpc('effective_plan_id', { p_user_id: vitrine.owner_id })
  if (planIdError) throw planIdError
  const { data: overQuota, error: quotaError } = await admin.rpc('is_over_video_quota', { p_user_id: vitrine.owner_id })
  if (quotaError) throw quotaError

  const [plan, contacts, categories, items, media, checkout] = await Promise.all([
    admin.from('plans').select('max_items_per_vitrine, max_videos_per_vitrine, allow_branding, show_watermark').eq('id', planId).single(),
    admin.from('whatsapp_contacts').select('id, phone_e164').eq('vitrine_id', vitrine.id),
    admin.from('categories').select('id, name, position').eq('vitrine_id', vitrine.id),
    admin
      .from('items')
      .select(
        'id, category_id, code, name, description, price_type, price_cents, promo_price_cents, duration_minutes, tags, sold_out, position, whatsapp_id, button_text, custom_message, notice, sale_mode, external_url',
      )
      .eq('vitrine_id', vitrine.id)
      .is('deleted_at', null)
      .order('position')
      .order('created_at'),
    admin
      .from('media')
      .select('id, item_id, professional_id, role, kind, position, storage_paths, mux_playback_id, thumbnail_url, aspect')
      .eq('vitrine_id', vitrine.id)
      .eq('status', 'ready'),
    admin
      .from('checkout_settings')
      .select(
        'name_mode, phone_mode, fulfillment_mode, allow_pickup, allow_delivery, payment_mode, schedule_mode, notes_mode, payment_options, extra_note',
      )
      .eq('vitrine_id', vitrine.id)
      .maybeSingle(),
  ])
  for (const result of [plan, contacts, categories, items, media, checkout]) if (result.error) throw result.error

  // Profissionais ativos e o que cada um atende (só vitrine de serviços tem).
  const professionals = await admin
    .from('professionals')
    .select('id, name, position')
    .eq('vitrine_id', vitrine.id)
    .eq('active', true)
  if (professionals.error) throw professionals.error
  const professionalIds = (professionals.data ?? []).map((p) => p.id)
  const professionalItems = professionalIds.length
    ? await admin.from('professional_items').select('professional_id, item_id').in('professional_id', professionalIds)
    : { data: [], error: null }
  if (professionalItems.error) throw professionalItems.error

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
      // Sem teste nem assinatura valendo, a vitrine sai do ar já na próxima geração,
      // mesmo antes de a tarefa diária congelá-la.
      vitrine: planId === 'essencial' ? vitrine : { ...vitrine, status: 'frozen' },
      plan: plan.data!,
      overQuota: overQuota ?? false,
      contacts: contacts.data ?? [],
      categories: categories.data ?? [],
      items: (items.data ?? []) as CatalogRows['items'],
      variations: variations.data ?? [],
      media: media.data ?? [],
      checkout: checkout.data ?? null,
      professionals: professionals.data ?? [],
      professionalItems: professionalItems.data ?? [],
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
