import { describe, expect, it } from 'vitest'
import { COMPANY } from './company'
import { PRIVACY } from './privacy'
import { TERMS } from './terms'

describe.each([
  ['termos de uso', TERMS],
  ['política de privacidade', PRIVACY],
])('%s', (_nome, sections) => {
  it('tem seções com título e conteúdo', () => {
    expect(sections.length).toBeGreaterThan(5)
    for (const section of sections) {
      expect(section.title.trim().length).toBeGreaterThan(0)
      expect(section.paragraphs.length).toBeGreaterThan(0)
      for (const paragraph of section.paragraphs) expect(paragraph.trim().length).toBeGreaterThan(0)
    }
  })

  it('cita a empresa e o contato', () => {
    const texto = sections.flatMap((section) => section.paragraphs).join(' ')
    expect(texto).toContain(COMPANY.legalName)
    expect(texto).toContain(COMPANY.tradeName)
  })
})

describe('termos de uso', () => {
  it('fala de renovação automática, cancelamento e arrependimento', () => {
    const texto = TERMS.flatMap((section) => section.paragraphs).join(' ')
    expect(texto).toContain('renovação automática')
    expect(texto).toContain('7 dias')
  })

  it('explica o que acontece ao voltar para o gratuito', () => {
    const texto = TERMS.flatMap((section) => section.paragraphs).join(' ')
    expect(texto).toContain('90 dias')
    expect(texto).toContain('marca d’água')
  })
})

describe('política de privacidade', () => {
  it('lista os operadores e os direitos da LGPD', () => {
    const texto = PRIVACY.flatMap((section) => section.paragraphs).join(' ')
    for (const parceiro of ['Supabase', 'Vercel', 'Bunny', 'Mux', 'Stripe', 'Resend', 'Cloudflare']) {
      expect(texto).toContain(parceiro)
    }
    expect(texto).toContain('LGPD')
  })

  it('deixa claro que não guardamos dados do cliente final nem cartão', () => {
    const texto = PRIVACY.flatMap((section) => section.paragraphs).join(' ')
    expect(texto).toContain('não guardamos')
  })
})
