const TIME_ZONE = 'America/Sao_Paulo'

function yearMonth(now: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, year: 'numeric', month: 'numeric' }).formatToParts(now)
  return {
    year: Number(parts.find((part) => part.type === 'year')!.value),
    month: Number(parts.find((part) => part.type === 'month')!.value),
  }
}

export function videoMonthKey(now: Date): string {
  const { year, month } = yearMonth(now)
  return `${year}-${String(month).padStart(2, '0')}`
}

export function nextMonthStartLabel(now: Date): string {
  const { year, month } = yearMonth(now)
  const next = new Date(Date.UTC(month === 12 ? year + 1 : year, month % 12, 15))
  const name = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', month: 'long' }).format(next)
  return `1º de ${name}`
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? 'suas vitrines'
  return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function buildQuotaEmail(input: {
  ownerName: string
  vitrineNames: string[]
  quotaGb: number
  now: Date
  panelUrl: string
}): { subject: string; text: string; html: string } {
  const greeting = input.ownerName.trim() ? `Olá, ${input.ownerName.trim()}!` : 'Olá!'
  const until = nextMonthStartLabel(input.now)
  const vitrines = listNames(input.vitrineNames)
  const paragraphs = [
    greeting,
    `A franquia de vídeo deste mês (${input.quotaGb} GB) foi usada por completo.`,
    `Até ${until}, os itens de ${vitrines} mostram só as fotos. Os vídeos voltam sozinhos no próximo mês e nada foi apagado.`,
    `Acompanhe o consumo em: ${input.panelUrl}`,
    'Equipe Agenn Vitrine',
  ]

  const html = [
    `<p>${escapeHtml(greeting)}</p>`,
    `<p>${escapeHtml(paragraphs[1])}</p>`,
    `<p>${escapeHtml(paragraphs[2])}</p>`,
    `<p>Acompanhe o consumo em: <a href="${escapeHtml(input.panelUrl)}">${escapeHtml(input.panelUrl)}</a></p>`,
    '<p>Equipe Agenn Vitrine</p>',
  ].join('\n')

  return { subject: 'A franquia de vídeo deste mês acabou', text: paragraphs.join('\n\n'), html }
}
