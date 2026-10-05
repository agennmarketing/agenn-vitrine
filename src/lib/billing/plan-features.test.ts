import { describe, expect, it } from 'vitest'
import { planFeatures } from './plan-features'

const mentionsAgenda = (list: string[]) => list.some((feature) => /agend/i.test(feature))

describe('planFeatures', () => {
  it('serviços mostra agenda e agendamentos', () => {
    const list = planFeatures({ type: 'servicos' })
    expect(list).toContain('Agenda online')
    expect(list).toContain('Agendamentos')
    expect(list).not.toContain('Sacola de compras')
  })

  it('produtos próprios fala de pedidos e sacola, nunca de agenda', () => {
    for (const mode of [null, 'proprios']) {
      const list = planFeatures({ type: 'produtos', product_mode: mode })
      expect(list).toContain('Sacola de compras')
      expect(mentionsAgenda(list)).toBe(false)
    }
  })

  it('afiliado não vê agenda, sacola nem WhatsApp', () => {
    const list = planFeatures({ type: 'produtos', product_mode: 'afiliado' })
    expect(mentionsAgenda(list)).toBe(false)
    expect(list.some((feature) => /sacola|whatsapp/i.test(feature))).toBe(false)
    expect(list.some((feature) => /afiliado/i.test(feature))).toBe(true)
  })

  it('sem vitrine, só o que vale para todos', () => {
    expect(mentionsAgenda(planFeatures(null))).toBe(false)
  })
})
