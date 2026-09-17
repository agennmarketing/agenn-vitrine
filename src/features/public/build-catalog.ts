import { imageSources } from '@/lib/media/urls'
import type { PriceType } from '@/lib/pricing/price'
import type { VitrineType } from '@/lib/vitrines/vitrine-types'

export type CatalogRows = {
  vitrine: {
    id: string; subdomain: string; type: string; name: string; description: string; theme: string; status: string
    show_prices: boolean; show_media: boolean; default_button_text: string; brand_color: string | null
    banner_enabled: boolean; logo_media_id: string | null; banner_media_id: string | null; primary_whatsapp_id: string | null
  }
  plan: { max_items_per_vitrine: number; allow_branding: boolean; show_watermark: boolean }
  contacts: { id: string; phone_e164: string }[]
  categories: { id: string; name: string; position: number }[]
  items: {
    id: string; category_id: string | null; code: string; name: string; description: string; price_type: PriceType
    price_cents: number | null; promo_price_cents: number | null; duration_minutes: number | null; tags: string[]
    sold_out: boolean; position: number; whatsapp_id: string | null; button_text: string | null; custom_message: string | null
  }[]
  variations: { id: string; item_id: string; name: string; price_cents: number; promo_price_cents: number | null; sold_out: boolean; position: number }[]
  media: { id: string; item_id: string | null; role: string; position: number; storage_paths: unknown }[]
}

export type PublicImage = { small: string; large: string; smallWidth: number; largeWidth: number }

export type PublicItem = {
  id: string; code: string; name: string; description: string; priceType: PriceType; priceCents: number | null
  promoPriceCents: number | null; durationMinutes: number | null; tags: string[]; soldOut: boolean
  whatsappPhone: string | null; buttonText: string | null; customMessage: string | null
  cover: PublicImage | null; gallery: PublicImage[]
  variations: { id: string; name: string; priceCents: number; promoPriceCents: number | null; soldOut: boolean }[]
}

export type PublicVitrine = {
  id: string; subdomain: string; type: VitrineType; name: string; description: string; theme: 'light' | 'dark'
  status: 'active' | 'frozen'; showPrices: boolean; showMedia: boolean; defaultButtonText: string
  primaryPhone: string | null; logo: PublicImage | null; brandColor: string | null; banner: PublicImage | null
  showWatermark: boolean; categories: { id: string; name: string; items: PublicItem[] }[]
}

export function buildPublicCatalog(rows: CatalogRows, mediaBaseUrl: string): PublicVitrine {
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

  const toItem = (row: CatalogRows['items'][number]): PublicItem => {
    const media = rows.media.filter((m) => m.item_id === row.id)
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
      cover: image(media.find((m) => m.role === 'cover')?.storage_paths),
      gallery: media
        .filter((m) => m.role === 'gallery')
        .sort((a, b) => a.position - b.position)
        .map((m) => image(m.storage_paths))
        .filter((img): img is PublicImage => img !== null),
      variations: rows.variations
        .filter((v) => v.item_id === row.id)
        .sort((a, b) => a.position - b.position)
        .map((v) => ({ id: v.id, name: v.name, priceCents: v.price_cents, promoPriceCents: v.promo_price_cents, soldOut: v.sold_out })),
    }
  }

  const branding = rows.plan.allow_branding
  const { vitrine } = rows
  return {
    id: vitrine.id,
    subdomain: vitrine.subdomain,
    type: vitrine.type as VitrineType,
    name: vitrine.name,
    description: vitrine.description,
    theme: vitrine.theme === 'dark' ? 'dark' : 'light',
    status: vitrine.status === 'active' ? 'active' : 'frozen',
    showPrices: vitrine.show_prices,
    showMedia: vitrine.show_media,
    defaultButtonText: vitrine.default_button_text,
    primaryPhone: vitrine.primary_whatsapp_id ? (phoneById.get(vitrine.primary_whatsapp_id) ?? null) : null,
    logo: branding && vitrine.logo_media_id ? image(mediaById.get(vitrine.logo_media_id)?.storage_paths) : null,
    brandColor: branding ? vitrine.brand_color : null,
    banner:
      branding && vitrine.banner_enabled && vitrine.banner_media_id
        ? image(mediaById.get(vitrine.banner_media_id)?.storage_paths)
        : null,
    showWatermark: rows.plan.show_watermark,
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      items: visible.filter((i) => i.category_id === c.id).map(toItem),
    })),
  }
}
