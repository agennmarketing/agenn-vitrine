import { describe, expect, it } from 'vitest'
import { buildVideoCleanupEmail } from './video-cleanup-email'

const input = {
  ownerName: 'Ana',
  videosCount: 3,
  proEndedAt: '2026-06-26T12:00:00.000Z',
  deleteAt: '2026-09-24T12:00:00.000Z',
  panelUrl: 'https://app.agenn.com.br/painel/plano',
}

describe('buildVideoCleanupEmail', () => {
  it('avisa a data, a quantidade e o caminho para manter', () => {
    const email = buildVideoCleanupEmail(input)
    expect(email.subject).toBe('Seus vídeos serão apagados em 7 dias')
    expect(email.text).toContain('Olá, Ana!')
    expect(email.text).toContain('Seu plano Pro terminou em 26/06/2026')
    expect(email.text).toContain('Em 24/09/2026, 3 vídeos serão apagados')
    expect(email.text).toContain('https://app.agenn.com.br/painel/plano')
    expect(email.html).toContain('<a href="https://app.agenn.com.br/painel/plano">')
  })

  it('usa o singular com um vídeo só', () => {
    expect(buildVideoCleanupEmail({ ...input, videosCount: 1 }).text).toContain('1 vídeo será apagado')
  })

  it('funciona sem nome', () => {
    expect(buildVideoCleanupEmail({ ...input, ownerName: '  ' }).text).toContain('Olá!')
  })
})
