import { describe, expect, it } from 'vitest'
import { buildPublicCatalog, type CatalogRows } from './build-catalog'

const base: CatalogRows = {
  vitrine: {
    id: 'v1', subdomain: 'loja', type: 'produtos', name: 'Loja', description: '', theme: 'light', status: 'active',
    show_prices: true, show_media: true, default_button_text: 'Solicitar orçamento', brand_color: '#ff0000',
    banner_enabled: true, cart_enabled: true, cart_button_text: 'Enviar pedido', logo_media_id: 'logo', banner_media_id: 'banner', primary_whatsapp_id: 'w1',
  },
  plan: { max_items_per_vitrine: 2, max_videos_per_vitrine: 1, allow_branding: false, show_watermark: true },
  overQuota: false,
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
  checkout: {
    name_mode: 'required', fulfillment_mode: 'optional', payment_mode: 'off', schedule_mode: 'off', notes_mode: 'optional',
    payment_options: ['Pix'],
  },
  media: [
    { id: 'm1', item_id: 'i2', role: 'cover', kind: 'image', position: 0, storage_paths: { '480': 'a-480.webp', '1080': 'a-1080.webp' }, mux_playback_id: null, thumbnail_url: null, aspect: null },
    { id: 'logo', item_id: null, role: 'logo', kind: 'image', position: 0, storage_paths: { '128': 'l-128.webp', '512': 'l-512.webp' }, mux_playback_id: null, thumbnail_url: null, aspect: null },
    { id: 'banner', item_id: null, role: 'banner', kind: 'image', position: 0, storage_paths: { '960': 'b-960.webp', '1920': 'b-1920.webp' }, mux_playback_id: null, thumbnail_url: null, aspect: null },
    { id: 'v-i2', item_id: 'i2', role: 'video', kind: 'video', position: 0, storage_paths: null, mux_playback_id: 'g2', thumbnail_url: null, aspect: '9:16' },
    { id: 'v-i1', item_id: 'i1', role: 'video', kind: 'video', position: 0, storage_paths: null, mux_playback_id: 'g1', thumbnail_url: null, aspect: '16:9' },
  ],
}

function item(id: string, categoryId: string | null, position: number, extra: Partial<CatalogRows['items'][number]> = {}) {
  return {
    id, category_id: categoryId, code: id.toUpperCase().slice(0, 6), name: `Item ${id}`, description: '',
    price_type: 'fixed' as const, price_cents: 1000, promo_price_cents: null, duration_minutes: null, tags: [],
    sold_out: false, position, whatsapp_id: null, button_text: null, custom_message: null, notice: null, ...extra,
  }
}

describe('buildPublicCatalog', () => {
  it('ordena por categoria e item e corta no limite do plano (4.7)', () => {
    const catalog = buildPublicCatalog(base, 'https://cdn', 'https://vz')
    expect(catalog.categories.map((c) => [c.name, c.items.map((i) => i.id)])).toEqual([
      ['Primeira', ['i2', 'i1']],
      ['Segunda', []],
    ])
  })

  it('ignora marca sem o Pro e mostra marca d’água', () => {
    const catalog = buildPublicCatalog(base, 'https://cdn', 'https://vz')
    expect([catalog.logo, catalog.brandColor, catalog.banner, catalog.showWatermark]).toEqual([null, null, null, true])
  })

  it('usa marca com o Pro', () => {
    const catalog = buildPublicCatalog({ ...base, plan: { max_items_per_vitrine: 300, max_videos_per_vitrine: 50, allow_branding: true, show_watermark: false } }, 'https://cdn', 'https://vz')
    expect(catalog.logo?.small).toBe('https://cdn/l-128.webp')
    expect(catalog.banner?.large).toBe('https://cdn/b-1920.webp')
    expect(catalog.brandColor).toBe('#ff0000')
    expect(catalog.showWatermark).toBe(false)
    expect(catalog.categories[1].items.map((i) => i.id)).toEqual(['i3'])
  })

  it('telefones, imagens e variações do item', () => {
    const [first] = buildPublicCatalog(base, 'https://cdn', 'https://vz').categories[0].items
    expect(first.whatsappPhone).toBe('+5511900000002')
    expect(first.cover?.small).toBe('https://cdn/a-480.webp')
    expect(first.variations.map((v) => v.name)).toEqual(['P', 'G'])
    expect(buildPublicCatalog(base, 'https://cdn', 'https://vz').primaryPhone).toBe('+5511900000001')
  })
})

describe('vídeos', () => {
  it('gratuito mostra só o primeiro vídeo na ordem da vitrine (4.7)', () => {
    const [first, second] = buildPublicCatalog(base, 'https://cdn', 'https://vz').categories[0].items
    expect(first.video).toEqual({ mediaId: 'v-i2', playlistUrl: 'https://vz/g2.m3u8', posterUrl: 'https://cdn/a-1080.webp', aspect: '9:16' })
    expect(second.video).toBeNull()
  })

  it('Pro mostra todos', () => {
    const catalog = buildPublicCatalog(
      { ...base, plan: { max_items_per_vitrine: 300, max_videos_per_vitrine: 50, allow_branding: true, show_watermark: false } },
      'https://cdn',
      'https://vz',
    )
    expect(catalog.categories[0].items.map((i) => i.video?.mediaId)).toEqual(['v-i2', 'v-i1'])
  })

  it('franquia estourada: nenhum vídeo', () => {
    const catalog = buildPublicCatalog({ ...base, overQuota: true }, 'https://cdn', 'https://vz')
    expect(catalog.categories[0].items.every((i) => i.video === null)).toBe(true)
  })

  it('banner em vídeo só com marca liberada e sem franquia estourada', () => {
    const rows: CatalogRows = {
      ...base,
      plan: { max_items_per_vitrine: 300, max_videos_per_vitrine: 50, allow_branding: true, show_watermark: false },
      media: [
        ...base.media.filter((m) => m.id !== 'banner'),
        { id: 'banner', item_id: null, role: 'banner', kind: 'video', position: 0, storage_paths: null, mux_playback_id: 'gb', thumbnail_url: 'https://image.mux.com/gb/thumbnail.jpg', aspect: '16:9' },
      ],
    }
    const catalog = buildPublicCatalog(rows, 'https://cdn', 'https://vz')
    expect(catalog.banner).toBeNull()
    expect(catalog.bannerVideo).toEqual({ mediaId: 'banner', playlistUrl: 'https://vz/gb.m3u8', posterUrl: 'https://image.mux.com/gb/thumbnail.jpg', aspect: '16:9' })
    expect(buildPublicCatalog({ ...rows, overQuota: true }, 'https://cdn', 'https://vz').bannerVideo).toBeNull()
    expect(buildPublicCatalog(base, 'https://cdn', 'https://vz').bannerVideo).toBeNull()
  })
})

describe('sacola', () => {
  it('sacola e formulário da vitrine', () => {
    const catalog = buildPublicCatalog(base, 'https://cdn', 'https://vz')
    expect([catalog.cartEnabled, catalog.cartButtonText]).toEqual([true, 'Enviar pedido'])
    expect(catalog.checkout).toEqual({
      nameMode: 'required', fulfillmentMode: 'optional', paymentMode: 'off', scheduleMode: 'off', notesMode: 'optional', paymentOptions: ['Pix'],
    })
    expect(buildPublicCatalog({ ...base, checkout: null }, 'https://cdn', 'https://vz').checkout).toEqual({
      nameMode: 'optional', fulfillmentMode: 'off', paymentMode: 'off', scheduleMode: 'off', notesMode: 'optional', paymentOptions: [],
    })
  })
})
