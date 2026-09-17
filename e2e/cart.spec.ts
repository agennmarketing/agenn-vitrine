import { expect, test, type Page } from '@playwright/test'
import {
  createAdminClient,
  createConfirmedUser,
  linkAddonGroup,
  seedAddonGroup,
  seedItem,
  seedVitrine,
} from './helpers'

const vitrineUrl = (subdomain: string) => `http://${subdomain}.localhost:3000/`
const ORDER = '[23456789A-HJ-NP-Z]{4}'

async function captureWhatsApp(page: Page) {
  await page.route('https://wa.me/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: 'ok' }))
  return page.waitForRequest(/^https:\/\/wa\.me\//)
}

test('sacola: complementos, quantidade, guarda no aparelho, formulário e mensagem completa', async ({ page }) => {
  const user = await createConfirmedUser('sacola')
  const vitrine = await seedVitrine(user.id, { type: 'comida', name: 'Burger do Zé', phone: '+5511912345678' })
  const burger = await seedItem(vitrine, user.id, { name: 'X-Bacon', priceCents: 2590 })
  const coca = await seedItem(vitrine, user.id, { name: 'Coca-Cola lata', priceCents: 600 })
  const ponto = await seedAddonGroup(vitrine, user.id, {
    name: 'Ponto', required: true, options: [{ name: 'Mal passado' }, { name: 'Ao ponto' }],
  })
  const adicionais = await seedAddonGroup(vitrine, user.id, {
    name: 'Adicionais', maxSelect: 5, allowRepeat: true, options: [{ name: 'Bacon', priceCents: 400 }, { name: 'Cheddar', priceCents: 300 }],
  })
  await linkAddonGroup(user.id, burger.id, ponto.id, 0)
  await linkAddonGroup(user.id, burger.id, adicionais.id, 1)

  await page.goto(vitrineUrl(vitrine.subdomain))
  await expect(page.getByRole('button', { name: 'Abrir sacola' })).toBeVisible()

  await page.getByRole('button', { name: 'X-Bacon' }).click()
  const sheet = page.getByRole('dialog', { name: 'X-Bacon' })
  await expect(sheet.getByText('Obrigatório · escolha 1')).toBeVisible()
  await expect(sheet.getByText('Opcional · até 5')).toBeVisible()
  await sheet.getByRole('button', { name: 'Adicionar · R$ 25,90' }).click()
  await expect(sheet.getByText('Escolha uma opção em Ponto.')).toBeVisible()

  await sheet.getByLabel('Ao ponto').check()
  await sheet.getByRole('button', { name: 'Aumentar Bacon' }).click()
  await sheet.getByRole('button', { name: 'Aumentar Bacon' }).click()
  await sheet.getByRole('button', { name: 'Aumentar Cheddar' }).click()
  await sheet.getByRole('button', { name: 'Aumentar quantidade' }).click()
  await sheet.getByLabel('Observação').fill('sem cebola')
  await sheet.getByRole('button', { name: 'Adicionar · R$ 73,80' }).click()
  await expect(page.getByRole('button', { name: 'Ver sacola · 2 itens · R$ 73,80' })).toBeVisible()

  await page.getByRole('button', { name: 'Coca-Cola lata' }).click()
  await page.getByRole('dialog', { name: 'Coca-Cola lata' }).getByRole('button', { name: 'Adicionar · R$ 6,00' }).click()
  await expect(page.getByRole('button', { name: 'Ver sacola · 3 itens · R$ 79,80' })).toBeVisible()

  await page.reload()
  await page.getByRole('button', { name: 'Ver sacola · 3 itens · R$ 79,80' }).click()
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
        `^\\*Pedido #(${ORDER}) – Burger do Zé\\*`,
        '',
        `2x \\*X-Bacon\\* \\(cód\\. ${burger.code}\\)`,
        '   • Ponto: Ao ponto',
        '   • Adicionais: 2x Bacon, 1x Cheddar',
        '   • Obs: sem cebola',
        '',
        `1x \\*Coca-Cola lata\\* \\(cód\\. ${coca.code}\\)`,
        '',
        'Retirada · Nome: Ana · Pagamento: Pix$',
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
  expect(snapshot.payload.items[0]).toMatchObject({ qty: 2, unit_price_cents: 2590, addons_unit_cents: 1100 })
  expect(JSON.stringify(snapshot.payload)).not.toContain('Ana')

  await page.goto(vitrineUrl(vitrine.subdomain))
  await expect(page.getByRole('button', { name: 'Abrir sacola' })).toHaveText('Sacola (0)')
})

test('sacola com item que não existe mais avisa e remove', async ({ page }) => {
  const user = await createConfirmedUser('sacola-reconcilia')
  const vitrine = await seedVitrine(user.id, { type: 'comida' })
  const item = await seedItem(vitrine, user.id, { name: 'Suco', priceCents: 800 })

  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [
      `agenn-sacola:${vitrine.id}`,
      JSON.stringify({
        version: 1,
        lines: [
          { itemId: item.id, variationId: null, qty: 1, note: '', addons: [] },
          { itemId: '00000000-0000-4000-8000-000000000999', variationId: null, qty: 1, note: '', addons: [] },
        ],
      }),
    ],
  )
  await page.goto(vitrineUrl(vitrine.subdomain))
  await page.getByRole('button', { name: 'Abrir sacola' }).click()
  const cart = page.getByRole('dialog', { name: 'Sacola' })
  await expect(cart.getByText('Alguns itens saíram da sacola porque não estão mais disponíveis: Um item.')).toBeVisible()
  await expect(cart.getByText('Suco')).toBeVisible()
  await expect(cart.getByText('Total: R$ 8,00')).toBeVisible()
})

test('sabores de pizza pela média e botão direto com complementos', async ({ page }) => {
  const user = await createConfirmedUser('sabores')
  const pizzaria = await seedVitrine(user.id, { type: 'comida', name: 'Pizzaria' })
  const pizza = await seedItem(pizzaria, user.id, { name: 'Pizza grande', priceCents: 0 })
  const sabores = await seedAddonGroup(pizzaria, user.id, {
    name: 'Sabores', kind: 'flavors', required: true, maxSelect: 2, flavorPriceRule: 'average',
    options: [{ name: 'Calabresa', priceCents: 4990 }, { name: 'Quatro queijos', priceCents: 5491 }],
  })
  await linkAddonGroup(user.id, pizza.id, sabores.id)

  await page.goto(vitrineUrl(pizzaria.subdomain))
  await page.getByRole('button', { name: 'Pizza grande' }).click()
  const sheet = page.getByRole('dialog', { name: 'Pizza grande' })
  await sheet.getByLabel('Calabresa').check()
  await sheet.getByLabel('Quatro queijos').check()
  await expect(sheet.getByRole('button', { name: 'Adicionar · R$ 52,41' })).toBeVisible()

  // Botão direto (sacola desligada) numa vitrine de produtos, de outro dono (plano grátis: 1 vitrine)
  const lojista = await createConfirmedUser('direto-complementos')
  const loja = await seedVitrine(lojista.id, { name: 'Loja' })
  const camiseta = await seedItem(loja, lojista.id, { name: 'Camiseta', priceCents: 5000 })
  const tamanho = await seedAddonGroup(loja, lojista.id, {
    name: 'Tamanho', required: true, options: [{ name: 'P' }, { name: 'G', priceCents: 1000 }],
  })
  await linkAddonGroup(lojista.id, camiseta.id, tamanho.id)

  await page.goto(vitrineUrl(loja.subdomain))
  await page.getByRole('button', { name: 'Camiseta' }).click()
  const direto = page.getByRole('dialog', { name: 'Camiseta' })
  await direto.getByRole('radio', { name: /^G/ }).check()
  await direto.getByLabel('Observação').fill('presente')
  const whatsapp = captureWhatsApp(page)
  await direto.getByRole('button', { name: 'Solicitar orçamento' }).click()
  expect(new URL((await whatsapp).url()).searchParams.get('text')).toMatch(
    new RegExp(`\\(cód\\. ${camiseta.code}\\)\\. Pedido #${ORDER}\\n\\n   • Tamanho: G\\n   • Obs: presente$`),
  )
})
