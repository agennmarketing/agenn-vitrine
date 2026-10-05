/*
 * Tarefa diária na Netlify. Na Vercel quem chama /api/cron/diaria é o Vercel Cron
 * (vercel.json); a Netlify não chama URLs no horário, ela executa uma "scheduled
 * function". Esta função só faz a mesma chamada que a Vercel fazia: um GET com o
 * segredo no cabeçalho. O trabalho continua todo na rota do app.
 *
 * URL é definida pela própria Netlify (o domínio principal do site, ex.:
 * https://app.vitrimove.site). CRON_SECRET é o mesmo do app.
 */

// O tipo vem de @netlify/functions, que não precisa entrar no app só por isso.
type Config = { schedule: string }

export default async function cronDiaria() {
  const baseUrl = process.env.URL
  const secret = process.env.CRON_SECRET
  if (!baseUrl || !secret) {
    console.error('[cron-diaria] URL ou CRON_SECRET ausente')
    return
  }

  const response = await fetch(new URL('/api/cron/diaria', baseUrl), {
    headers: { authorization: `Bearer ${secret}` },
  })
  if (!response.ok) {
    // Aparece no log da função na Netlify. As falhas de dentro da tarefa o próprio
    // app já manda para o Sentry.
    console.error('[cron-diaria] falhou', response.status, await response.text().catch(() => ''))
    return
  }
  // Resumo no log (inclui `domains`: os subdomínios cadastrados ou removidos na Netlify).
  console.info('[cron-diaria] ok', await response.text().catch(() => ''))
}

// Mesmo horário do vercel.json: 07:00 UTC, que é 04:00 em Brasília.
export const config: Config = {
  schedule: '0 7 * * *',
}
