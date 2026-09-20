import { expect, test, type Page } from '@playwright/test'
import { createAdminClient, createConfirmedUser, seedItem, seedVitrine, setCart, setCheckout } from './helpers'

const vitrineUrl = (subdomain: string) => `http://${subdomain}.localhost:3000/`
const ORDER = '[23456789A-HJ-NP-Z]{4}'

async function captureWhatsApp(page: Page) {
  await page.route('https://wa.me/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: 'ok' }))
  return page.waitForRequest(/^https:\/\/wa\.me\//)
}

test('sacola: variações, quantidade, guarda no aparelho, formulário e mensagem completa', async ({ page }) => {
  const user = await createConfirmedUser('sacola')
  const vitrine = await seedVitrine(user.id, { name: 'Loja da Ana', phone: '+5511912345678' })
  const camiseta = await seedItem(vitrine, user.id, {
    name: 'Camiseta básica',
    priceCents: 2590,
    variations: [{ name: 'Tamanho M', priceCents: 4990 }, { name: 'Tamanho G', priceCents: 5490 }],
  })
  const caneca = await seedItem(vitrine, user.id, { name: 'Caneca', priceCents: 600 })
  // Formulário do pedido no modo mais exigente, para conferir os avisos e o rodapé da mensagem.
  await setCheckout(vitrine.id, { name_mode: 'required', fulfillment_mode: 'required', payment_mode: 'required' })

  await page.goto(vitrineUrl(vitrine.subdomain))
  await expect(page.getByRole('button', { name: 'Abrir sacola' })).toBeVisible()

  await page.getByRole('button', { name: 'Camiseta básica' }).click()
  const sheet = page.getByRole('dialog', { name: 'Camiseta básica' })
  await sheet.getByRole('button', { name: /^Adicionar à sacola/ }).click()
  await expect(sheet.getByText('Escolha uma opção.')).toBeVisible()

  await sheet.getByRole('radio', { name: /^Tamanho M/ }).check()
  await sheet.getByRole('button', { name: 'Aumentar quantidade' }).click()
  await sheet.getByLabel('Observação').fill('sem estampa')
  await sheet.getByRole('button', { name: 'Adicionar à sacola · R$ 99,80' }).click()
  await expect(page.getByRole('button', { name: 'Ver sacola · 2 itens · R$ 99,80' })).toBeVisible()

  await page.getByRole('button', { name: 'Caneca' }).click()
  await page.getByRole('dialog', { name: 'Caneca' }).getByRole('button', { name: 'Adicionar à sacola · R$ 6,00' }).click()
  await expect(page.getByRole('button', { name: 'Ver sacola · 3 itens · R$ 105,80' })).toBeVisible()

  await page.reload()
  await page.getByRole('button', { name: 'Ver sacola · 3 itens · R$ 105,80' }).click()
  const cart = page.getByRole('dialog', { name: 'Sacola' })
  await cart.getByRole('button', { name: 'Enviar pedido' }).click()
  await expect(cart.getByText('Informe seu nome.')).toBeVisible()
  await expect(cart.getByText('Escolha retirada ou entrega.')).toBeVisible()
  await expect(cart.getByText('Escolha a forma de pagamento.')).toBeVisible()

  await cart.getByLabel('Nome').fill('Ana')
  await cart.getByLabel('Retirada').check()
  await cart.getByLabel('Forma de pagamento').selectOption('Pix')
  const whatsapp = captureWhatsApp(page)
  await cart.getByRole('button', { name: 'Enviar pedido' }).click()
  const url = new URL((await whatsapp).url())
  expect(url.pathname).toBe('/5511912345678')
  expect(url.searchParams.get('text')).toMatch(
    new RegExp(
      [
        `^\\*Pedido #(${ORDER}) – Loja da Ana\\*`,
        '',
        '\\*1\\.\\* 2x Camiseta básica – Tamanho M',
        `cód\\. ${camiseta.code} · R\\$ 49,90 cada · total R\\$ 99,80`,
        'Obs: sem estampa',
        '',
        '\\*2\\.\\* 1x Caneca',
        `cód\\. ${caneca.code} · R\\$ 6,00 cada · total R\\$ 6,00`,
        '',
        '\\*Total: R\\$ 105,80\\*',
        '',
        'Nome: Ana\\nEntrega: retirada\\nPagamento: Pix$',
      ].join('\\n'),
    ),
  )

  const orderCode = url.searchParams.get('text')!.match(new RegExp(`#(${ORDER})`))![1]
  const { data: snapshot } = await createAdminClient()
    .from('order_snapshots')
    .select('payload')
    .eq('owner_id', user.id)
    .eq('code', orderCode)
    .single()
    .throwOnError()
  expect(snapshot.payload.items[0]).toMatchObject({ qty: 2, unit_price_cents: 4990 })
  expect(JSON.stringify(snapshot.payload)).not.toContain('Ana')

  // Espera a ida ao WhatsApp terminar antes de voltar para a vitrine.
  await page.waitForURL(/^https:\/\/wa\.me\//)
  await page.goto(vitrineUrl(vitrine.subdomain))
  await expect(page.getByRole('button', { name: 'Abrir sacola' })).toHaveText('Sacola (0)')
})

test('sacola com item que não existe mais avisa e remove', async ({ page }) => {
  const user = await createConfirmedUser('sacola-reconcilia')
  const vitrine = await seedVitrine(user.id)
  const item = await seedItem(vitrine, user.id, { name: 'Caderno', priceCents: 800 })

  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [
      `agenn-sacola:${vitrine.id}`,
      JSON.stringify({
        version: 1,
        lines: [
          { itemId: item.id, variationId: null, qty: 1, note: '' },
          { itemId: '00000000-0000-4000-8000-000000000999', variationId: null, qty: 1, note: '' },
        ],
      }),
    ],
  )
  await page.goto(vitrineUrl(vitrine.subdomain))
  await page.getByRole('button', { name: 'Abrir sacola' }).click()
  const cart = page.getByRole('dialog', { name: 'Sacola' })
  await expect(cart.getByText('Alguns itens saíram da sacola porque não estão mais disponíveis: Um item.')).toBeVisible()
  await expect(cart.getByText('Caderno')).toBeVisible()
  await expect(cart.getByText('Total: R$ 8,00')).toBeVisible()
})

test('com a sacola desligada o produto vai direto para o WhatsApp', async ({ page }) => {
  const lojista = await createConfirmedUser('direto-produto')
  const loja = await seedVitrine(lojista.id, { name: 'Loja' })
  await setCart(loja.id, false)
  const camiseta = await seedItem(loja, lojista.id, {
    name: 'Camiseta',
    priceCents: 5000,
    variations: [{ name: 'Tamanho G', priceCents: 6000 }],
  })

  await page.goto(vitrineUrl(loja.subdomain))
  await page.getByRole('button', { name: 'Camiseta' }).click()
  const direto = page.getByRole('dialog', { name: 'Camiseta' })
  await direto.getByRole('radio', { name: /^Tamanho G/ }).check()
  await direto.getByLabel('Observação').fill('presente')
  const whatsapp = captureWhatsApp(page)
  await direto.getByRole('button', { name: 'Adicionar à sacola' }).click()
  expect(new URL((await whatsapp).url()).searchParams.get('text')).toMatch(
    new RegExp(`\\(cód\\. ${camiseta.code}\\)\\. Pedido #${ORDER}\\n\\nObs: presente$`),
  )
})
