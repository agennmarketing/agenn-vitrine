import { expect, test } from '@playwright/test'
import { APP_URL } from '../playwright.config'
import {
  createAdminClient,
  createConfirmedUser,
  fakeSubscription,
  readFakeEmails,
  readSubscription,
  seedItem,
  seedVideo,
  seedVitrine,
  setSubscription,
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

test('90 dias depois do fim do Pro, os vídeos excedentes são apagados', async ({ request }) => {
  const user = await createConfirmedUser('cron-90-dias')
  await setSubscription(user.id, { status: 'active' })
  const vitrine = await seedVitrine(user.id)
  const primeiro = await seedItem(vitrine, user.id, { name: 'Com vídeo 1' })
  const segundo = await seedItem(vitrine, user.id, { name: 'Com vídeo 2' })
  const mantido = await seedVideo(vitrine, user.id, primeiro.id)
  const apagado = await seedVideo(vitrine, user.id, segundo.id)
  await setSubscription(user.id, {
    status: 'canceled',
    proEndedAt: new Date(Date.now() - 100 * DAY_MS).toISOString(),
  })

  const response = await request.get(`${APP_URL}/api/cron/diaria`, {
    headers: { authorization: `Bearer ${secret}` },
  })
  expect(response.status()).toBe(200)
  expect((await response.json()).videosDeleted).toBeGreaterThanOrEqual(1)

  const admin = createAdminClient()
  const { data: restantes } = await admin.from('media').select('id').in('id', [mantido.id, apagado.id])
  expect((restantes ?? []).map((row) => row.id)).toEqual([mantido.id])
})

test('no dia 83 o dono recebe o aviso por e-mail', async ({ request }) => {
  const user = await createConfirmedUser('cron-aviso')
  await setSubscription(user.id, { status: 'active' })
  const vitrine = await seedVitrine(user.id)
  const primeiro = await seedItem(vitrine, user.id, { name: 'Vídeo A' })
  const segundo = await seedItem(vitrine, user.id, { name: 'Vídeo B' })
  await seedVideo(vitrine, user.id, primeiro.id)
  await seedVideo(vitrine, user.id, segundo.id)
  await setSubscription(user.id, {
    status: 'canceled',
    proEndedAt: new Date(Date.now() - 83 * DAY_MS - 2 * 60 * 60 * 1000).toISOString(),
  })

  const response = await request.get(`${APP_URL}/api/cron/diaria`, {
    headers: { authorization: `Bearer ${secret}` },
  })
  expect(response.status()).toBe(200)

  const emails = await readFakeEmails(user.email)
  const aviso = emails.find((email) => email.subject === 'Seus vídeos serão apagados em 7 dias')
  // O gratuito mostra 1 vídeo (spec 4.7): dos dois, só um é apagado.
  expect(aviso?.text).toContain('1 vídeo será apagado')
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
