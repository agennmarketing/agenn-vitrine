import { formatDateBR } from '@/lib/dates/format'
import { escapeHtml } from './html'

// Spec 6.4: aviso do dia 83, sete dias antes de apagar os vídeos excedentes.
export function buildVideoCleanupEmail(input: {
  ownerName: string
  videosCount: number
  proEndedAt: Date | string
  deleteAt: Date | string
  panelUrl: string
}): { subject: string; text: string; html: string } {
  const greeting = input.ownerName.trim() ? `Olá, ${input.ownerName.trim()}!` : 'Olá!'
  const videos = input.videosCount === 1 ? '1 vídeo será apagado' : `${input.videosCount} vídeos serão apagados`
  const paragraphs = [
    greeting,
    `Seu plano Pro terminou em ${formatDateBR(input.proEndedAt)} e a conta voltou ao gratuito, que mostra 1 vídeo.`,
    `Em ${formatDateBR(input.deleteAt)}, ${videos} e não será possível recuperar.`,
    `Para manter todos, assine o Pro de novo em: ${input.panelUrl}`,
    'Equipe Vitrimove',
  ]

  const html = [
    `<p>${escapeHtml(paragraphs[0])}</p>`,
    `<p>${escapeHtml(paragraphs[1])}</p>`,
    `<p>${escapeHtml(paragraphs[2])}</p>`,
    `<p>Para manter todos, assine o Pro de novo em: <a href="${escapeHtml(input.panelUrl)}">${escapeHtml(input.panelUrl)}</a></p>`,
    '<p>Equipe Vitrimove</p>',
  ].join('\n')

  return { subject: 'Seus vídeos serão apagados em 7 dias', text: paragraphs.join('\n\n'), html }
}
