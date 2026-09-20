import { expect, test, type Page } from '@playwright/test'
import { createAdminClient, createConfirmedUser, itemStep, seedItem, seedVitrine, signIn, uniqueSubdomain } from './helpers'

const vitrineUrl = (subdomain: string) => `http://${subdomain}.localhost:3000/`

async function captureWhatsApp(page: Page) {
  await page.route('https://wa.me/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: 'ok' }))
  return page.waitForRequest(/^https:\/\/wa\.me\//)
}

// O real formatado traz espaço fixo antes do valor; aqui comparamos com espaço comum.
function messageText(url: URL) {
  return url.searchParams.get('text')!.replaceAll('\u00a0', ' ')
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
  await expect(page).toHaveURL(/\/itens(\?criada=1)?$/)

  const after = await page.goto(vitrineUrl(subdomain))
  expect(after?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1, name: 'Loja Nova' })).toBeVisible()
})

test('catálogo, tela do item com variação e mensagem com código de pedido', async ({ page }) => {
  const user = await createConfirmedUser('publica')
  const vitrine = await seedVitrine(user.id, { name: 'Loja da Ana', phone: '+5511912345678', cartEnabled: false })
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
  await dialog.getByRole('button', { name: 'Adicionar à sacola' }).click()
  await expect(dialog.getByText('Escolha uma opção.')).toBeVisible()

  await dialog.getByLabel(/^G/).check()
  const whatsapp = captureWhatsApp(page)
  await dialog.getByRole('button', { name: 'Adicionar à sacola' }).click()
  const url = new URL((await whatsapp).url())
  expect(url.pathname).toBe('/5511912345678')
  const text = messageText(url)
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

  // Serviços: o CTA abre a etapa de solicitação; só o nome é obrigatório.
  await dialog.getByRole('button', { name: 'Quero esse serviço' }).click()
  await dialog.getByRole('button', { name: 'Enviar pelo WhatsApp' }).click()
  await expect(dialog.getByText('Informe seu nome.')).toBeVisible()

  await dialog.getByLabel('Nome', { exact: true }).fill('Maria')
  const whatsapp = captureWhatsApp(page)
  await dialog.getByRole('button', { name: 'Enviar pelo WhatsApp' }).click()
  const text = messageText(new URL((await whatsapp).url()))
  expect(text).toBe(
    `Olá! Vim da vitrine *Studio* e gostaria de agendar: *Manicure* (cód. ${item.code}).\n\nValor: R$ 40,00\nNome: Maria`,
  )
})

test('serviço: a etapa leva nome, data, horário e observação para o WhatsApp', async ({ page }) => {
  const user = await createConfirmedUser('servico')
  const vitrine = await seedVitrine(user.id, { type: 'servicos', name: 'Studio', phone: '+5511912345678' })
  const item = await seedItem(vitrine, user.id, { name: 'Corte de cabelo', priceType: 'from', priceCents: 5000 })

  await page.goto(vitrineUrl(vitrine.subdomain))
  await expect(page.getByText('A partir de R$ 50,00')).toBeVisible()
  await page.getByRole('button', { name: 'Corte de cabelo' }).click()
  const dialog = page.getByRole('dialog', { name: 'Corte de cabelo' })
  // Não há sacola em serviços: o botão é o CTA da solicitação.
  await expect(page.getByRole('button', { name: 'Abrir sacola' })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Quero esse serviço' }).click()

  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
  const [, month, day] = tomorrow.split('-')
  await dialog.getByLabel('Nome', { exact: true }).fill('Maria Silva')
  await dialog.getByLabel('Data desejada').fill(tomorrow)
  await dialog.getByLabel('Horário desejado').fill('14:30')
  await dialog.getByLabel('Observação').fill('bem curto')

  const whatsapp = captureWhatsApp(page)
  await dialog.getByRole('button', { name: 'Enviar pelo WhatsApp' }).click()
  const url = new URL((await whatsapp).url())
  expect(url.pathname).toBe('/5511912345678')
  const text = messageText(url)
  expect(text).toMatch(
    new RegExp(
      `^Olá! Vim da vitrine \\*Studio\\* e gostaria de agendar: \\*Corte de cabelo\\* \\(cód\\. ${item.code}\\)\\.( Pedido #[23456789A-HJ-NP-Z]{4})?\\n\\n` +
        `Valor: A partir de R\\$ 50,00\\nNome: Maria Silva\\nData desejada: ${day}/${month}\\nHorário desejado: 14:30\\n\\nObs: bem curto$`,
    ),
  )
})

test('alteração no painel aparece na vitrine pública', async ({ page }) => {
  const user = await createConfirmedUser('revalida')
  const vitrine = await seedVitrine(user.id)
  const item = await seedItem(vitrine, user.id, { name: 'Nome Antigo', priceCents: 1000 })

  await page.goto(vitrineUrl(vitrine.subdomain))
  await expect(page.getByText('Nome Antigo')).toBeVisible()

  await signIn(page, user.email, user.password)
  await page.goto(`/painel/vitrines/${vitrine.id}/itens/${item.id}`)
  await itemStep(page, 'Detalhes')
  await page.getByLabel('Nome', { exact: true }).fill('Nome Novo')
  await page.getByRole('button', { name: 'Salvar item' }).click()
  await expect(page.getByText('Item salvo.')).toBeVisible()

  await page.goto(vitrineUrl(vitrine.subdomain))
  await expect(page.getByText('Nome Novo')).toBeVisible()
})
