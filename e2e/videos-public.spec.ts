import { expect, test } from '@playwright/test'
import { createAdminClient, createConfirmedUser, readFakeEmails, seedItem, seedVideo, seedVitrine } from './helpers'

const vitrineUrl = (subdomain: string) => `http://${subdomain}.localhost:3000/`

test('vídeo só aparece ao abrir o item, cada um no seu', async ({ page }) => {
  const user = await createConfirmedUser('video-publico')
  const vitrine = await seedVitrine(user.id)
  const first = await seedItem(vitrine, user.id, { name: 'Primeiro', priceCents: 1000 })
  const second = await seedItem(vitrine, user.id, { name: 'Segundo', priceCents: 1000 })
  const firstVideo = await seedVideo(vitrine, user.id, first.id)
  await seedVideo(vitrine, user.id, second.id)

  const playlists: string[] = []
  page.on('request', (req) => {
    if (req.url().includes('.m3u8')) playlists.push(req.url())
  })

  await page.goto(vitrineUrl(vitrine.subdomain))
  await expect(page.locator('video, mux-player')).toHaveCount(0)
  expect(playlists).toEqual([])

  await page.getByRole('button', { name: 'Primeiro' }).click()
  const dialog = page.getByRole('dialog', { name: 'Primeiro' })
  // Mux Player: começa sozinho e mudo, uma vez só (sem loop), inline.
  const player = dialog.locator(`mux-player[data-media-id="${firstVideo.id}"]`)
  await expect(player).toHaveCount(1)
  await expect(player).toHaveAttribute('autoplay', 'muted')
  await expect(player).toHaveAttribute('playsinline', '')
  await expect(player).not.toHaveAttribute('loop')
  await expect.poll(() => player.evaluate((el: HTMLVideoElement) => [el.muted, el.loop])).toEqual([true, false])
  await expect(dialog.locator('video')).toHaveCount(1)
  await expect.poll(() => playlists.length > 0 && playlists.every((url) => url.includes(firstVideo.guid))).toBe(true)
  await dialog.getByRole('button', { name: 'Fechar' }).click()
  await expect(page.locator('video, mux-player')).toHaveCount(0)

  await page.getByRole('button', { name: 'Segundo' }).click()
  await expect(page.getByRole('dialog', { name: 'Segundo' }).locator('video')).toHaveCount(1)
})

test('banner em vídeo mostra só a capa na listagem, sem carregar vídeo', async ({ page }) => {
  const user = await createConfirmedUser('video-banner-capa')
  const vitrine = await seedVitrine(user.id)
  const item = await seedItem(vitrine, user.id, { name: 'Com vídeo', priceCents: 1000 })
  await seedVideo(vitrine, user.id, item.id)
  const banner = await seedVideo(vitrine, user.id, null, { role: 'banner' })
  await createAdminClient()
    .from('vitrines')
    .update({ banner_media_id: banner.id, banner_enabled: true })
    .eq('id', vitrine.id)
    .throwOnError()

  const playlists: string[] = []
  page.on('request', (req) => {
    if (req.url().includes('.m3u8')) playlists.push(req.url())
  })
  await page.goto(vitrineUrl(vitrine.subdomain), { waitUntil: 'load' })
  await expect(page.locator(`img[src*="${banner.guid}/thumbnail.jpg"]`)).toHaveCount(1)
  await page.waitForTimeout(1000)
  await expect(page.locator('video, mux-player')).toHaveCount(0)
  expect(playlists).toEqual([])
})

test('relatório de consumo soma bytes e franquia estourada esconde os vídeos', async ({ page, request }) => {
  const user = await createConfirmedUser('video-franquia')
  const vitrine = await seedVitrine(user.id)
  const item = await seedItem(vitrine, user.id, { name: 'Com vídeo', priceCents: 1000 })
  const video = await seedVideo(vitrine, user.id, item.id)
  const admin = createAdminClient()

  const small = await request.post(`${vitrineUrl(vitrine.subdomain)}api/video-usage`, {
    data: { mediaId: video.id, bytes: 1000, seconds: 5 },
  })
  expect(small.status()).toBe(204)
  const { data: usage } = await admin.from('video_usage_monthly').select('bytes_delivered, over_quota').eq('user_id', user.id).single().throwOnError()
  expect(Number(usage.bytes_delivered)).toBe(1000)

  await page.goto(vitrineUrl(vitrine.subdomain))
  await page.getByRole('button', { name: 'Com vídeo' }).click()
  await expect(page.getByRole('dialog', { name: 'Com vídeo' }).locator('video')).toHaveCount(1)

  // Quase no limite: o próximo relatório estoura e revalida a vitrine.
  await admin
    .from('video_usage_monthly')
    .update({ bytes_delivered: 1024 * 1024 ** 3 - 10 })
    .eq('user_id', user.id)
    .throwOnError()
  const crossing = await request.post(`${vitrineUrl(vitrine.subdomain)}api/video-usage`, {
    data: { mediaId: video.id, bytes: 1000, seconds: 5 },
  })
  expect(crossing.status()).toBe(204)
  await expect
    .poll(async () => (await readFakeEmails(user.email)).map((email) => email.subject), { timeout: 10_000 })
    .toEqual(['A franquia de vídeo deste mês acabou'])

  await page.goto(vitrineUrl(vitrine.subdomain))
  await page.getByRole('button', { name: 'Com vídeo' }).click()
  await expect(page.getByRole('dialog', { name: 'Com vídeo' }).locator('video')).toHaveCount(0)
})

test('relatório de outro host é ignorado', async ({ request }) => {
  const user = await createConfirmedUser('video-host')
  const vitrine = await seedVitrine(user.id)
  const other = await seedVitrine((await createConfirmedUser('video-host-2')).id)
  const item = await seedItem(vitrine, user.id, { name: 'X', priceCents: 1000 })
  const video = await seedVideo(vitrine, user.id, item.id)

  const response = await request.post(`${vitrineUrl(other.subdomain)}api/video-usage`, {
    data: { mediaId: video.id, bytes: 1000, seconds: 5 },
  })
  expect(response.status()).toBe(204)
  const { data } = await createAdminClient().from('video_usage_monthly').select('user_id').eq('user_id', user.id)
  expect(data).toEqual([])
})
