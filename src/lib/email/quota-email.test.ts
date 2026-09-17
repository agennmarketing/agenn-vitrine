import { describe, expect, it } from 'vitest'
import { buildQuotaEmail, nextMonthStartLabel, videoMonthKey } from './quota-email'

describe('datas no fuso de São Paulo', () => {
  it('mês da franquia', () => {
    expect(videoMonthKey(new Date('2026-09-17T12:00:00Z'))).toBe('2026-09')
    // 1º de outubro, 01:00 UTC = 30 de setembro, 22:00 em São Paulo
    expect(videoMonthKey(new Date('2026-10-01T01:00:00Z'))).toBe('2026-09')
  })

  it('início do próximo mês por extenso', () => {
    expect(nextMonthStartLabel(new Date('2026-09-17T12:00:00Z'))).toBe('1º de outubro')
    expect(nextMonthStartLabel(new Date('2026-12-20T12:00:00Z'))).toBe('1º de janeiro')
  })
})

describe('buildQuotaEmail', () => {
  const base = {
    ownerName: 'Ana',
    vitrineNames: ['Loja da Ana'],
    quotaGb: 1024,
    now: new Date('2026-09-17T12:00:00Z'),
    panelUrl: 'https://app.agenn.com.br/painel',
  }

  it('monta assunto e texto', () => {
    const email = buildQuotaEmail(base)
    expect(email.subject).toBe('A franquia de vídeo deste mês acabou')
    expect(email.text).toBe(
      [
        'Olá, Ana!',
        '',
        'A franquia de vídeo deste mês (1024 GB) foi usada por completo.',
        '',
        'Até 1º de outubro, os itens de Loja da Ana mostram só as fotos. Os vídeos voltam sozinhos no próximo mês e nada foi apagado.',
        '',
        'Acompanhe o consumo em: https://app.agenn.com.br/painel',
        '',
        'Equipe Agenn Vitrine',
      ].join('\n'),
    )
  })

  it('várias vitrines, nome vazio e HTML escapado', () => {
    const email = buildQuotaEmail({ ...base, ownerName: '', vitrineNames: ['A', 'B <b>', 'C'] })
    expect(email.text.startsWith('Olá!')).toBe(true)
    expect(email.text).toContain('os itens de A, B <b> e C mostram')
    expect(email.html).toContain('A, B &lt;b&gt; e C')
    expect(email.html).toContain('<a href="https://app.agenn.com.br/painel">')
  })
})
