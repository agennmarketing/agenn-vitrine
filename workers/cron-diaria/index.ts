/*
 * Worker só para a tarefa diária. Na Vercel quem chama /api/cron/diaria é o Vercel
 * Cron; no Cloudflare, os Cron Triggers acionam o handler `scheduled` de um worker,
 * e não uma rota HTTP. Em vez de mexer no app, este worker minúsculo faz a mesma
 * chamada que a Vercel fazia: um GET com o segredo no cabeçalho.
 *
 * Publicação: `npm run cf:deploy-cron`.
 */

// Os tipos do Workers moram em @cloudflare/workers-types, que não entra no app (ele
// conflita com os tipos de DOM do Next). Aqui só precisamos destes dois.
type ExecutionContext = { waitUntil(promise: Promise<unknown>): void }
type ScheduledController = { scheduledTime: number; cron: string }

type Env = {
  /** Endereço do painel, com barra no fim. Ex.: https://app.agenn.com.br/ */
  CRON_TARGET_URL: string
  /** O mesmo CRON_SECRET do app. */
  CRON_SECRET: string
}

async function runDailyTask(env: Env) {
  const url = new URL('api/cron/diaria', env.CRON_TARGET_URL)
  const response = await fetch(url, { headers: { authorization: `Bearer ${env.CRON_SECRET}` } })
  if (!response.ok) {
    // Aparece no log do worker (observability ligada). As falhas de dentro da tarefa
    // o próprio app já manda para o Sentry.
    console.error('[cron-diaria] falhou', response.status, await response.text().catch(() => ''))
  }
}

const worker = {
  scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runDailyTask(env))
  },
}

export default worker
