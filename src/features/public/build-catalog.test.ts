import { describe, expect, it } from 'vitest'
import { buildPublicCatalog, type CatalogRows } from './build-catalog'

const base: CatalogRows = {
  vitrine: {
    id: 'v1', subdomain: 'loja', type: 'produtos', name: 'Loja', description: '', theme: 'light', status: 'active',
    show_prices: true, show_media: true, default_button_text: 'Solicitar orçamento', brand_color: '#ff0000',
    banner_enabled: true, logo_media_id: 'logo', banner_media_id: 'banner', primary_whatsapp_id: 'w1',
  },
  plan: { max_items_per_vitrine: 2, allow_branding: false, show_watermark: true },
  contacts: [
    { id: 'w1', phone_e164: '+5511900000001' },
    { id: 'w2', phone_e164: '+5511900000002' },
  ],
  categories: [
    { id: 'c2', name: 'Segunda', position: 1 },
    { id: 'c1', name: 'Primeira', position: 0 },
  ],
  items: [
    item('i3', 'c2', 0),
    item('i1', 'c1', 1),
    item('i2', 'c1', 0, { whatsapp_id: 'w2' }),
    item('sem-categoria', null, 0),
  ],
  variations: [
    { id: 'v-b', item_id: 'i2', name: 'G', price_cents: 200, promo_price_cents: null, sold_out: false, position: 1 },
    { id: 'v-a', item_id: 'i2', name: 'P', price_cents: 100, promo_price_cents: null, sold_out: false, position: 0 },
  ],
  media: [
    { id: 'm1', item_id: 'i2', role: 'cover', position: 0, storage_paths: { '480': 'a-480.webp', '1080': 'a-1080.webp' } },
    { id: 'logo', item_id: null, role: 'logo', position: 0, storage_paths: { '128': 'l-128.webp', '512': 'l-512.webp' } },
    { id: 'banner', item_id: null, role: 'banner', position: 0, storage_paths: { '960': 'b-960.webp', '1920': 'b-1920.webp' } },
  ],
}

function item(id: string, categoryId: string | null, position: number, extra: Partial<CatalogRows['items'][number]> = {}) {
  return {
    id, category_id: categoryId, code: id.toUpperCase().slice(0, 6), name: `Item ${id}`, description: '',
    price_type: 'fixed' as const, price_cents: 1000, promo_price_cents: null, duration_minutes: null, tags: [],
    sold_out: false, position, whatsapp_id: null, button_text: null, custom_message: null, ...extra,
  }
}

describe('buildPublicCatalog', () => {
  it('ordena por categoria e item e corta no limite do plano (4.7)', () => {
    const catalog = buildPublicCatalog(base, 'https://cdn')
    expect(catalog.categories.map((c) => [c.name, c.items.map((i) => i.id)])).toEqual([
      ['Primeira', ['i2', 'i1']],
      ['Segunda', []],
    ])
  })

  it('ignora marca sem o Pro e mostra marca d’água', () => {
    const catalog = buildPublicCatalog(base, 'https://cdn')
    expect([catalog.logo, catalog.brandColor, catalog.banner, catalog.showWatermark]).toEqual([null, null, null, true])
  })

  it('usa marca com o Pro', () => {
    const catalog = buildPublicCatalog({ ...base, plan: { max_items_per_vitrine: 300, allow_branding: true, show_watermark: false } }, 'https://cdn')
    expect(catalog.logo?.small).toBe('https://cdn/l-128.webp')
    expect(catalog.banner?.large).toBe('https://cdn/b-1920.webp')
    expect(catalog.brandColor).toBe('#ff0000')
    expect(catalog.showWatermark).toBe(false)
    expect(catalog.categories[1].items.map((i) => i.id)).toEqual(['i3'])
  })

  it('telefones, imagens e variações do item', () => {
    const [first] = buildPublicCatalog(base, 'https://cdn').categories[0].items
    expect(first.whatsappPhone).toBe('+5511900000002')
    expect(first.cover?.small).toBe('https://cdn/a-480.webp')
    expect(first.variations.map((v) => v.name)).toEqual(['P', 'G'])
    expect(buildPublicCatalog(base, 'https://cdn').primaryPhone).toBe('+5511900000001')
  })
})
