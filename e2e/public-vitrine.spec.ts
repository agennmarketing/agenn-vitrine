import { expect, test, type Page } from '@playwright/test'
import { createAdminClient, createConfirmedUser, seedItem, seedVitrine, signIn, uniqueSubdomain } from './helpers'

const vitrineUrl = (subdomain: string) => `http://${subdomain}.localhost:3000/`

async function captureWhatsApp(page: Page) {
  await page.route('https://wa.me/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: 'ok' }))
  return page.waitForRequest(/^https:\/\/wa\.me\//)
}

test('endereço passa de 404 para a vitrine assim que ela é criada no painel', async ({ page }) => {
  const subdomain = uniqueSubdomain('nasce')
  const before = await page.goto(vitrineUrl(subdomain))
  expect(before?.status()).toBe(404)

  const user = await createConfirmedUser('nasce')
  await signIn(page, user.email, user.password)
  await page.goto('/painel/vitrines/nova')
  await page.getByLabel('Produtos').check()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByLabel('Nome da vitrine').fill('Loja Nova')
  await page.getByLabel('Endereço da vitrine').fill(subdomain)
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByLabel('WhatsApp', { exact: true }).fill('(11) 98765-4321')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByRole('button', { name: 'Criar vitrine' }).click()
  await expect(page).toHaveURL(/\/itens$/)

  const after = await page.goto(vitrineUrl(subdomain))
  expect(after?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1, name: 'Loja Nova' })).toBeVisible()
})

test('catálogo, tela do item com variação e mensagem com código de pedido', async ({ page }) => {
  const user = await createConfirmedUser('publica')
  const vitrine = await seedVitrine(user.id, { name: 'Loja da Ana', phone: '+5511912345678' })
  const simple = await seedItem(vitrine, user.id, { name: 'Caneca', priceCents: 2590 })
  const withVariations = await seedItem(vitrine, user.id, {
    name: 'Camiseta',
    variations: [
      { name: 'P', priceCents: 3990 },
      { name: 'G', priceCents: 4490 },
    ],
  })

  await page.goto(vitrineUrl(vitrine.subdomain))
  await expect(page.getByRole('heading', { level: 1, name: 'Loja da Ana' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Destaques' })).toBeVisible()
  await expect(page.getByText('R$ 25,90')).toBeVisible()
  await expect(page.getByText('A partir de R$ 39,90')).toBeVisible()
  await expect(page.getByText('Feito com Vitrimove')).toBeVisible()

  await page.getByRole('button', { name: 'Camiseta' }).click()
  await expect(page).toHaveURL(new RegExp(`\\?item=${withVariations.code}$`))
  const dialog = page.getByRole('dialog', { name: 'Camiseta' })
  await dialog.getByRole('button', { name: 'Solicitar orçamento' }).click()
  await expect(dialog.getByText('Escolha uma opção.')).toBeVisible()

  await dialog.getByLabel(/^G/).check()
  const whatsapp = captureWhatsApp(page)
  await dialog.getByRole('button', { name: 'Solicitar orçamento' }).click()
  const url = new URL((await whatsapp).url())
  expect(url.pathname).toBe('/5511912345678')
  const text = url.searchParams.get('text')!
  expect(text).toMatch(
    new RegExp(`^Olá! Vim da vitrine \\*Loja da Ana\\* e tenho interesse em: \\*Camiseta – G\\* \\(cód\\. ${withVariations.code}\\)\\. Pedido #[23456789A-HJ-NP-Z]{4}$`),
  )

  const orderCode = text.slice(-4)
  const { data: snapshot } = await createAdminClient()
    .from('order_snapshots')
    .select('payload')
    .eq('owner_id', user.id)
    .eq('code', orderCode)
    .single()
    .throwOnError()
  expect(snapshot.payload.items[0]).toMatchObject({ code: withVariations.code, variation: { name: 'G' }, unit_price_cents: 4490 })
  expect(simple.code).toBeTruthy()
})

test('link com ?item= abre a tela e falha na API ainda envia sem código', async ({ page }) => {
  const user = await createConfirmedUser('deeplink')
  const vitrine = await seedVitrine(user.id, { type: 'servicos', name: 'Studio' })
  const item = await seedItem(vitrine, user.id, { name: 'Manicure', priceCents: 4000 })

  await page.route('**/api/orders', (route) => route.abort())
  await page.goto(`${vitrineUrl(vitrine.subdomain)}?item=${item.code}`)
  const dialog = page.getByRole('dialog', { name: 'Manicure' })
  await expect(dialog).toBeVisible()

  const whatsapp = captureWhatsApp(page)
  await dialog.getByRole('button', { name: 'Agendar' }).click()
  const text = new URL((await whatsapp).url()).searchParams.get('text')
  expect(text).toBe(`Olá! Vim da vitrine *Studio* e gostaria de agendar: *Manicure* (cód. ${item.code}).`)
})

test('alteração no painel aparece na vitrine pública', async ({ page }) => {
  const user = await createConfirmedUser('revalida')
  const vitrine = await seedVitrine(user.id)
  const item = await seedItem(vitrine, user.id, { name: 'Nome Antigo', priceCents: 1000 })

  await page.goto(vitrineUrl(vitrine.subdomain))
  await expect(page.getByText('Nome Antigo')).toBeVisible()

  await signIn(page, user.email, user.password)
  await page.goto(`/painel/vitrines/${vitrine.id}/itens/${item.id}`)
  await page.getByLabel('Nome', { exact: true }).fill('Nome Novo')
  await page.getByRole('button', { name: 'Salvar item' }).click()
  await expect(page.getByText('Item salvo.')).toBeVisible()

  await page.goto(vitrineUrl(vitrine.subdomain))
  await expect(page.getByText('Nome Novo')).toBeVisible()
})
