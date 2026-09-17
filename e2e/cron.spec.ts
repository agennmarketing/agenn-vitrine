import { expect, test } from '@playwright/test'
import { APP_URL } from '../playwright.config'
import { createAdminClient, createConfirmedUser, seedVitrine } from './helpers'

const secret = process.env.CRON_SECRET ?? 'ci-cron-secret-somente-para-testes'

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
