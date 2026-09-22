import { expect, test } from '@playwright/test'
import { APP_URL } from '../playwright.config'
import {
  createAdminClient,
  createConfirmedUser,
  fakeSubscription,
  readSubscription,
  seedItem,
  seedVideo,
  seedVitrine,
  setSubscription,
  vitrineStatuses,
} from './helpers'

const secret = process.env.CRON_SECRET ?? 'ci-cron-secret-somente-para-testes'
const DAY_MS = 86_400_000

test('tarefa diária exige o segredo e apaga envios órfãos antigos', async ({ request }) => {
  const unauthorized = await request.get(`${APP_URL}/api/cron/diaria`)
  expect(unauthorized.status()).toBe(401)

  const user = await createConfirmedUser('cron')
  const vitrine = await seedVitrine(user.id)
  const admin = createAdminClient()
  const { data: orphan } = await admin
    .from('media')
    .insert({
      owner_id: user.id,
      vitrine_id: vitrine.id,
      item_id: null,
      role: 'cover',
      kind: 'image',
      storage_paths: { '480': `${user.id}/${vitrine.id}/orfa-480.webp` },
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select('id')
    .single()
    .throwOnError()
  const { data: recent } = await admin
    .from('media')
    .insert({
      owner_id: user.id,
      vitrine_id: vitrine.id,
      item_id: null,
      role: 'cover',
      kind: 'image',
      storage_paths: { '480': `${user.id}/${vitrine.id}/recente-480.webp` },
    })
    .select('id')
    .single()
    .throwOnError()

  const response = await request.get(`${APP_URL}/api/cron/diaria`, { headers: { authorization: `Bearer ${secret}` } })
  expect(response.status()).toBe(200)
  const body = await response.json()
  expect(body.media).toBeGreaterThanOrEqual(1)

  const { data: remaining } = await admin.from('media').select('id').in('id', [orphan.id, recent.id])
  expect((remaining ?? []).map((row) => row.id)).toEqual([recent.id])
})

test('teste vencido sem assinatura: a tarefa diária tira a vitrine do ar sem apagar nada', async ({ request }) => {
  const user = await createConfirmedUser('cron-teste')
  const vitrine = await seedVitrine(user.id)
  const item = await seedItem(vitrine, user.id, { name: 'Com vídeo' })
  const video = await seedVideo(vitrine, user.id, item.id)
  await setSubscription(user.id, {
    status: 'none',
    trialEndsAt: new Date(Date.now() - DAY_MS).toISOString(),
    subscriptionStatus: 'trialing',
  })

  const response = await request.get(`${APP_URL}/api/cron/diaria`, {
    headers: { authorization: `Bearer ${secret}` },
  })
  expect(response.status()).toBe(200)
  expect((await response.json()).blockedVitrines).toBeGreaterThanOrEqual(1)

  expect((await readSubscription(user.id))?.subscription_status).toBe('expired')
  expect(await vitrineStatuses(user.id)).toEqual([`${vitrine.subdomain}:frozen`])
  const admin = createAdminClient()
  const { data: restantes } = await admin.from('media').select('id').eq('id', video.id)
  expect((restantes ?? []).map((row) => row.id)).toEqual([video.id])
})

test('a conferência diária corrige uma assinatura cancelada sem webhook', async ({ request }) => {
  const user = await createConfirmedUser('cron-conferencia')
  const customerId = `cus_fake_${crypto.randomUUID()}`
  const subscriptionId = await fakeSubscription({ customerId, userId: user.id, status: 'canceled' })
  // O banco ainda acha que está ativa: é o webhook que se perdeu.
  await setSubscription(user.id, { status: 'active', customerId, subscriptionId })

  const response = await request.get(`${APP_URL}/api/cron/diaria`, {
    headers: { authorization: `Bearer ${secret}` },
  })
  expect(response.status()).toBe(200)
  expect((await response.json()).subscriptions.updated).toBeGreaterThanOrEqual(1)

  const row = await readSubscription(user.id)
  expect(row?.status).toBe('canceled')
  expect(row?.pro_ended_at).not.toBeNull()
})
