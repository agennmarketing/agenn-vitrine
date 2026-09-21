import { rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import {
  createConfirmedUser,
  mediaOfItem,
  seedItem,
  seedVitrine,
  sendMuxWebhook,
  setPlan,
  signIn,
  videoFixture,
} from './helpers'

test('envia vídeo do item, processa pelo webhook e respeita o limite do gratuito', async ({ page, request }) => {
  const user = await createConfirmedUser('video-item')
  const vitrine = await seedVitrine(user.id)
  const first = await seedItem(vitrine, user.id, { name: 'Com vídeo', priceCents: 1000 })
  const second = await seedItem(vitrine, user.id, { name: 'Sem vídeo', priceCents: 1000 })
  await signIn(page, user.email, user.password)

  await page.goto(`/painel/vitrines/${vitrine.id}/itens/${first.id}`)
  await page.getByLabel('Vídeo', { exact: true }).setInputFiles(videoFixture('longo-61s'))
  await expect(page.getByText('O vídeo tem 61 s. O limite é 15 s.')).toBeVisible()

  await page.getByLabel('Vídeo', { exact: true }).setInputFiles(videoFixture('vertical-3s'))
  await expect(page.getByText('Processando o vídeo…')).toBeVisible({ timeout: 20_000 })

  const media = await mediaOfItem(first.id)
  expect(media?.status).toBe('processing')
  const response = await sendMuxWebhook(request, media!.mux_upload_id!)
  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual({ status: 'ready' })
  await expect(page.getByText('Vídeo pronto')).toBeVisible({ timeout: 15_000 })

  await page.goto(`/painel/vitrines/${vitrine.id}/itens/${second.id}`)
  await page.getByLabel('Vídeo', { exact: true }).setInputFiles(videoFixture('horizontal-3s'))
  await expect(page.getByText('Seu plano permite até 1 vídeo por vitrine. Assine o Pro para enviar mais.')).toBeVisible()

  await page.goto('/painel')
  await expect(page.getByText('1 vídeo', { exact: true })).toBeVisible()

  await setPlan(user.id, 'pro')
  await page.goto(`/painel/vitrines/${vitrine.id}/itens/${second.id}`)
  await page.getByLabel('Vídeo', { exact: true }).setInputFiles(videoFixture('horizontal-3s'))
  await expect(page.getByText('Processando o vídeo…')).toBeVisible({ timeout: 20_000 })
})

test('webhook: assinatura inválida é recusada e falha mostra Tentar novamente', async ({ page, request }) => {
  const user = await createConfirmedUser('video-falha')
  const vitrine = await seedVitrine(user.id)
  const item = await seedItem(vitrine, user.id, { name: 'Item', priceCents: 1000 })
  await signIn(page, user.email, user.password)

  const bad = await request.post('/api/webhooks/mux', {
    data: '{"type":"video.asset.ready","data":{"id":"x"}}',
    headers: {
      'content-type': 'application/json',
      'mux-signature': `t=${Math.floor(Date.now() / 1000)},v1=${'0'.repeat(64)}`,
    },
  })
  expect(bad.status()).toBe(401)

  await page.goto(`/painel/vitrines/${vitrine.id}/itens/${item.id}`)
  await page.getByLabel('Vídeo', { exact: true }).setInputFiles(videoFixture('vertical-3s'))
  await expect(page.getByText('Processando o vídeo…')).toBeVisible({ timeout: 20_000 })
  // O webhook consulta a API do provedor: para simular a falha, o "vídeo" some do driver fake.
  // Playwright e next start rodam no mesmo runner e compartilham o diretório temporário.
  const media = await mediaOfItem(item.id)
  await rm(path.join(os.tmpdir(), 'agenn-vitrine-video', `${media!.mux_upload_id}.json`), { force: true })
  await sendMuxWebhook(request, media!.mux_upload_id!, 'video.asset.errored')
  await expect(page.getByText('O processamento falhou.')).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Tentar novamente' }).click()
  await expect(page.getByLabel('Vídeo', { exact: true })).toBeVisible()
})

test('banner em vídeo: só Pro e só horizontal', async ({ page }) => {
  const user = await createConfirmedUser('video-banner')
  const vitrine = await seedVitrine(user.id)
  await signIn(page, user.email, user.password)

  await page.goto(`/painel/vitrines/${vitrine.id}/aparencia`)
  await expect(page.getByLabel('Banner em vídeo', { exact: true })).toBeDisabled()

  await setPlan(user.id, 'pro')
  await page.reload()
  await page.getByLabel('Banner em vídeo', { exact: true }).setInputFiles(videoFixture('vertical-3s'))
  await expect(page.getByText('O banner em vídeo precisa ser horizontal.')).toBeVisible()
  await page.getByLabel('Banner em vídeo', { exact: true }).setInputFiles(videoFixture('horizontal-3s'))
  await expect(page.getByText('Processando o vídeo…')).toBeVisible({ timeout: 20_000 })
})

test('status sincroniza com o provedor mesmo sem webhook', async ({ page }) => {
  const user = await createConfirmedUser('video-sync')
  const vitrine = await seedVitrine(user.id)
  const item = await seedItem(vitrine, user.id, { name: 'Sem aviso', priceCents: 1000 })
  await signIn(page, user.email, user.password)

  await page.goto(`/painel/vitrines/${vitrine.id}/itens/${item.id}`)
  await page.getByLabel('Vídeo', { exact: true }).setInputFiles(videoFixture('vertical-3s'))
  await expect(page.getByText('Vídeo pronto')).toBeVisible({ timeout: 30_000 })
  expect((await mediaOfItem(item.id))?.status).toBe('ready')
})
