import { describe, expect, it } from 'vitest'
import { buildPublicCatalog, type CatalogRows } from './build-catalog'

const base: CatalogRows = {
  vitrine: {
    id: 'v1', subdomain: 'loja', type: 'produtos', name: 'Loja', description: '', theme: 'light', status: 'active',
    show_prices: true, show_media: true, default_button_text: 'Solicitar orçamento', brand_color: '#ff0000',
    banner_enabled: true, cart_enabled: true, cart_button_text: 'Enviar pedido', logo_media_id: 'logo', banner_media_id: 'banner', primary_whatsapp_id: 'w1',
    instagram: null, address: null, business_hours: null,
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
  checkout: {
    name_mode: 'required', phone_mode: 'optional', fulfillment_mode: 'optional', allow_pickup: true, allow_delivery: false,
    payment_mode: 'off', schedule_mode: 'off', notes_mode: 'optional', payment_options: ['Pix'], extra_note: null,
  },
  professionals: [],
  professionalItems: [],
  media: [
    { id: 'm1', item_id: 'i2', professional_id: null, role: 'cover', position: 0, storage_paths: { '480': 'a-480.webp', '1080': 'a-1080.webp' } },
    { id: 'logo', item_id: null, professional_id: null, role: 'logo', position: 0, storage_paths: { '128': 'l-128.webp', '512': 'l-512.webp' } },
    { id: 'banner', item_id: null, professional_id: null, role: 'banner', position: 0, storage_paths: { '960': 'b-960.webp', '1920': 'b-1920.webp' } },
    // Vídeo antigo (a função saiu): fica no banco, mas não aparece.
    { id: 'v-i2', item_id: 'i2', professional_id: null, role: 'video', position: 0, storage_paths: null },
  ],
}

function item(id: string, categoryId: string | null, position: number, extra: Partial<CatalogRows['items'][number]> = {}) {
  return {
    id, category_id: categoryId, code: id.toUpperCase().slice(0, 6), name: `Item ${id}`, description: '',
    price_type: 'fixed' as const, price_cents: 1000, promo_price_cents: null, duration_minutes: null, tags: [],
    sold_out: false, position, whatsapp_id: null, button_text: null, custom_message: null, notice: null,
    sale_mode: 'whatsapp', external_url: null, ...extra,
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

  it('ignora marca quando o plano não libera e mostra marca d’água', () => {
    const catalog = buildPublicCatalog(base, 'https://cdn')
    expect([catalog.logo, catalog.brandColor, catalog.banner, catalog.showWatermark]).toEqual([null, null, null, true])
  })

  it('usa marca quando o plano libera', () => {
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

  it('Instagram, endereço e horários do negócio', () => {
    const hours = [{ day: 1, open: '09:00', close: '18:00' }]
    const contact = { instagram: 'studio.ana', address: 'Rua A, 10', business_hours: hours }
    const servicos = buildPublicCatalog({ ...base, vitrine: { ...base.vitrine, ...contact, type: 'servicos' } }, 'https://cdn')
    expect([servicos.instagram, servicos.address, servicos.businessHours]).toEqual(['studio.ana', 'Rua A, 10', hours])
    // Horários só fazem sentido na vitrine com agenda.
    const produtos = buildPublicCatalog({ ...base, vitrine: { ...base.vitrine, ...contact } }, 'https://cdn')
    expect(produtos.businessHours).toBeNull()
    expect(buildPublicCatalog(base, 'https://cdn')).toMatchObject({ instagram: null, address: null, businessHours: null })
  })
})

describe('vídeos antigos', () => {
  it('o item mostra só as imagens', () => {
    const [first] = buildPublicCatalog(base, 'https://cdn').categories[0].items
    expect(first).not.toHaveProperty('video')
    expect(first.gallery).toEqual([])
  })

  it('banner que era vídeo fica sem banner', () => {
    const rows: CatalogRows = {
      ...base,
      plan: { max_items_per_vitrine: 300, allow_branding: true, show_watermark: false },
      media: [
        ...base.media.filter((m) => m.id !== 'banner'),
        { id: 'banner', item_id: null, professional_id: null, role: 'banner', position: 0, storage_paths: null },
      ],
    }
    expect(buildPublicCatalog(rows, 'https://cdn').banner).toBeNull()
  })
})

describe('sacola', () => {
  it('sacola e formulário da vitrine', () => {
    const catalog = buildPublicCatalog(base, 'https://cdn')
    expect([catalog.cartEnabled, catalog.cartButtonText]).toEqual([true, 'Enviar pedido'])
    expect(catalog.checkout).toEqual({
      nameMode: 'required', phoneMode: 'optional', fulfillmentMode: 'optional', allowPickup: true, allowDelivery: false,
      paymentMode: 'off', scheduleMode: 'off', notesMode: 'optional', paymentOptions: ['Pix'], extraNote: null,
    })
    expect(buildPublicCatalog({ ...base, checkout: null }, 'https://cdn').checkout).toEqual({
      nameMode: 'optional', phoneMode: 'off', fulfillmentMode: 'off', allowPickup: true, allowDelivery: true,
      paymentMode: 'off', scheduleMode: 'off', notesMode: 'optional', paymentOptions: [], extraNote: null,
    })
  })
})
