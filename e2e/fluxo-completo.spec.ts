import { expect, test } from '@playwright/test'
import {
  createConfirmedUser,
  makeTestImage,
  mediaOfItem,
  sendBunnyWebhook,
  signIn,
  uniqueSubdomain,
  uploadImage,
  videoFixture,
} from './helpers'

test('criar vitrine → cadastrar item com vídeo → vitrine pública → WhatsApp → simulador', async ({ page, request: api }) => {
  const user = await createConfirmedUser('fluxo')
  await signIn(page, user.email, user.password)

  const subdomain = uniqueSubdomain('fluxo')
  await page.goto('/painel/vitrines/nova')
  await page.getByLabel('Produtos').check()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByLabel('Nome da vitrine').fill('Burger do Zé')
  await page.getByLabel('Endereço da vitrine').fill(subdomain)
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByLabel('WhatsApp', { exact: true }).fill('(11) 98765-4321')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByRole('button', { name: 'Criar vitrine' }).click()
  await expect(page).toHaveURL(/\/itens$/)

  await page.getByRole('link', { name: 'Novo item' }).click()
  await uploadImage(page, 'Capa', await makeTestImage(page))
  await page.getByLabel('Nome', { exact: true }).fill('X-Bacon')
  await page.getByLabel('Categoria').selectOption({ label: 'Destaques' })
  await page.getByLabel('Preço', { exact: true }).fill('25,90')
  await page.getByRole('button', { name: 'Salvar item' }).click()
  await expect(page.getByText('Item salvo.')).toBeVisible()

  // Vídeo no item (conta gratuita: 1 vídeo permitido)
  await page.getByRole('link', { name: 'Editar' }).click()
  await page.getByLabel('Vídeo', { exact: true }).setInputFiles(videoFixture('vertical-3s'))
  await expect(page.getByText(/Processando o vídeo…|Vídeo pronto/)).toBeVisible({ timeout: 20_000 })
  const itemId = page.url().split('/').pop()!
  const media = await mediaOfItem(itemId)
  await sendBunnyWebhook(api, media!.bunny_video_id!)
  await expect(page.getByText('Vídeo pronto')).toBeVisible({ timeout: 15_000 })

  await page.goto(`http://${subdomain}.localhost:3000/`)
  await expect(page.getByRole('heading', { level: 1, name: 'Burger do Zé' })).toBeVisible()
  await page.getByRole('button', { name: 'X-Bacon' }).click()
  await expect(page.getByRole('dialog', { name: 'X-Bacon' }).locator(`video[data-media-id="${media!.id}"]`)).toHaveCount(1)
  await page.route('https://wa.me/**', (route) => route.fulfill({ status: 200, body: 'ok' }))
  const request = page.waitForRequest(/^https:\/\/wa\.me\//)
  await page.getByRole('dialog', { name: 'X-Bacon' }).getByRole('button', { name: 'Solicitar orçamento' }).click()
  const url = new URL((await request).url())
  expect(url.pathname).toBe('/5511987654321')
  const text = url.searchParams.get('text')!
  expect(text).toContain('*X-Bacon* (cód. 101)')
  const orderCode = text.match(/Pedido #([23456789A-HJ-NP-Z]{4})$/)![1]

  await page.goto('/painel/simulador')
  await page.getByLabel('Código do pedido').fill(orderCode)
  await page.getByRole('button', { name: 'Consultar' }).click()
  await expect(page.getByText('R$ 25,90').first()).toBeVisible()
})
