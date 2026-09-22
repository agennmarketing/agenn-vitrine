import type { CheckoutSettings, FieldMode } from '@/lib/cart/checkout'
import { imageSources } from '@/lib/media/urls'
import { videoPlaylistUrl } from '@/lib/video/urls'
import type { PriceType } from '@/lib/pricing/price'
import type { VitrineType } from '@/lib/vitrines/vitrine-types'

export type CatalogRows = {
  vitrine: {
    id: string; subdomain: string; type: string; name: string; description: string; theme: string; status: string
    show_prices: boolean; show_media: boolean; default_button_text: string; brand_color: string | null
    banner_enabled: boolean; cart_enabled: boolean; cart_button_text: string; logo_media_id: string | null; banner_media_id: string | null; primary_whatsapp_id: string | null
  }
  plan: { max_items_per_vitrine: number; max_videos_per_vitrine: number; allow_branding: boolean; show_watermark: boolean }
  overQuota: boolean
  contacts: { id: string; phone_e164: string }[]
  categories: { id: string; name: string; position: number }[]
  items: {
    id: string; category_id: string | null; code: string; name: string; description: string; price_type: PriceType
    price_cents: number | null; promo_price_cents: number | null; duration_minutes: number | null; tags: string[]
    sold_out: boolean; position: number; whatsapp_id: string | null; button_text: string | null; custom_message: string | null; notice: string | null
  }[]
  checkout: {
    name_mode: string; fulfillment_mode: string; payment_mode: string; schedule_mode: string; notes_mode: string; payment_options: string[]
  } | null
  variations: { id: string; item_id: string; name: string; price_cents: number; promo_price_cents: number | null; sold_out: boolean; position: number }[]
  media: {
    id: string
    item_id: string | null
    role: string
    kind: string
    position: number
    storage_paths: unknown
    mux_playback_id: string | null
    thumbnail_url: string | null
    aspect: string | null
  }[]
}

export type PublicVideo = { mediaId: string; playlistUrl: string; posterUrl: string | null; aspect: '9:16' | '16:9' }

export type PublicImage = { small: string; large: string; smallWidth: number; largeWidth: number }

export type PublicItem = {
  id: string; code: string; name: string; description: string; priceType: PriceType; priceCents: number | null
  promoPriceCents: number | null; durationMinutes: number | null; tags: string[]; soldOut: boolean
  whatsappPhone: string | null; buttonText: string | null; customMessage: string | null; notice: string | null
  cover: PublicImage | null; gallery: PublicImage[]; video: PublicVideo | null
  variations: { id: string; name: string; priceCents: number; promoPriceCents: number | null; soldOut: boolean }[]
}

export type PublicVitrine = {
  id: string; subdomain: string; type: VitrineType; name: string; description: string; theme: 'light' | 'dark'
  status: 'active' | 'frozen'; showPrices: boolean; showMedia: boolean; defaultButtonText: string
  primaryPhone: string | null; logo: PublicImage | null; brandColor: string | null; banner: PublicImage | null
  bannerVideo: PublicVideo | null
  cartEnabled: boolean; cartButtonText: string; checkout: CheckoutSettings
  showWatermark: boolean; categories: { id: string; name: string; items: PublicItem[] }[]
}

export function buildPublicCatalog(rows: CatalogRows, mediaBaseUrl: string, videoBaseUrl: string): PublicVitrine {
  const phoneById = new Map(rows.contacts.map((c) => [c.id, c.phone_e164]))
  const image = (paths: unknown) => imageSources(paths, mediaBaseUrl)
  const mediaById = new Map(rows.media.map((m) => [m.id, m]))
  const categories = [...rows.categories].sort((a, b) => a.position - b.position)
  const categoryOrder = new Map(categories.map((c, index) => [c.id, index]))

  // Ordem da vitrine (categoria, depois item) e corte do plano (spec 4.7).
  const visible = rows.items
    .filter((i) => i.category_id !== null && categoryOrder.has(i.category_id))
    .sort((a, b) => categoryOrder.get(a.category_id!)! - categoryOrder.get(b.category_id!)! || a.position - b.position)
    .slice(0, rows.plan.max_items_per_vitrine)

  // Só os primeiros vídeos até o limite do plano aparecem; com a franquia estourada, nenhum.
  let videosLeft = rows.overQuota ? 0 : rows.plan.max_videos_per_vitrine
  const videoByItem = new Map<string, CatalogRows['media'][number]>()
  for (const item of visible) {
    const video = rows.media.find((m) => m.item_id === item.id && m.role === 'video' && m.mux_playback_id)
    if (video && videosLeft > 0) {
      videoByItem.set(item.id, video)
      videosLeft -= 1
    }
  }

  const toItem = (row: CatalogRows['items'][number]): PublicItem => {
    const media = rows.media.filter((m) => m.item_id === row.id)
    const cover = image(media.find((m) => m.role === 'cover')?.storage_paths)
    const videoRow = videoByItem.get(row.id)
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      priceType: row.price_type,
      priceCents: row.price_cents,
      promoPriceCents: row.promo_price_cents,
      durationMinutes: row.duration_minutes,
      tags: row.tags,
      soldOut: row.sold_out,
      whatsappPhone: row.whatsapp_id ? (phoneById.get(row.whatsapp_id) ?? null) : null,
      buttonText: row.button_text,
      customMessage: row.custom_message,
      notice: row.notice,
      cover,
      gallery: media
        .filter((m) => m.role === 'gallery')
        .sort((a, b) => a.position - b.position)
        .map((m) => image(m.storage_paths))
        .filter((img): img is PublicImage => img !== null),
      variations: rows.variations
        .filter((v) => v.item_id === row.id)
        .sort((a, b) => a.position - b.position)
        .map((v) => ({ id: v.id, name: v.name, priceCents: v.price_cents, promoPriceCents: v.promo_price_cents, soldOut: v.sold_out })),
      video: videoRow
        ? {
            mediaId: videoRow.id,
            playlistUrl: videoPlaylistUrl(videoBaseUrl, videoRow.mux_playback_id!),
            posterUrl: cover?.large ?? null,
            aspect: videoRow.aspect === '16:9' ? '16:9' : '9:16',
          }
        : null,
    }
  }

  const mode = (value: string | undefined, fallback: FieldMode): FieldMode =>
    value === 'off' || value === 'optional' || value === 'required' ? value : fallback
  const checkout: CheckoutSettings = {
    nameMode: mode(rows.checkout?.name_mode, 'optional'),
    fulfillmentMode: mode(rows.checkout?.fulfillment_mode, 'off'),
    paymentMode: mode(rows.checkout?.payment_mode, 'off'),
    scheduleMode: mode(rows.checkout?.schedule_mode, 'off'),
    notesMode: mode(rows.checkout?.notes_mode, 'optional'),
    paymentOptions: rows.checkout?.payment_options ?? [],
  }

  const branding = rows.plan.allow_branding
  const { vitrine } = rows
  const bannerRow = vitrine.banner_media_id ? mediaById.get(vitrine.banner_media_id) : undefined
  const bannerAllowed = branding && vitrine.banner_enabled && bannerRow !== undefined
  const bannerIsVideo = bannerRow?.kind === 'video' && Boolean(bannerRow.mux_playback_id)
  return {
    id: vitrine.id,
    subdomain: vitrine.subdomain,
    type: vitrine.type as VitrineType,
    name: vitrine.name,
    description: vitrine.description,
    theme: vitrine.theme === 'dark' ? 'dark' : 'light',
    status: vitrine.status === 'active' ? 'active' : 'frozen',
    showPrices: vitrine.show_prices,
    cartEnabled: vitrine.cart_enabled,
    cartButtonText: vitrine.cart_button_text,
    checkout,
    showMedia: vitrine.show_media,
    defaultButtonText: vitrine.default_button_text,
    primaryPhone: vitrine.primary_whatsapp_id ? (phoneById.get(vitrine.primary_whatsapp_id) ?? null) : null,
    logo: branding && vitrine.logo_media_id ? image(mediaById.get(vitrine.logo_media_id)?.storage_paths) : null,
    brandColor: branding ? vitrine.brand_color : null,
    banner: bannerAllowed && !bannerIsVideo ? image(bannerRow!.storage_paths) : null,
    bannerVideo:
      bannerAllowed && bannerIsVideo && !rows.overQuota
        ? {
            mediaId: bannerRow!.id,
            playlistUrl: videoPlaylistUrl(videoBaseUrl, bannerRow!.mux_playback_id!),
            posterUrl: bannerRow!.thumbnail_url,
            aspect: '16:9',
          }
        : null,
    showWatermark: rows.plan.show_watermark,
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      items: visible.filter((i) => i.category_id === c.id).map(toItem),
    })),
  }
}
