import { expect, test } from '@playwright/test'
import { createAdminClient, createConfirmedUser, seedItem, seedVitrine, signIn } from './helpers'

test('simulador recalcula pedido pelo código e soma no modo manual', async ({ page }) => {
  const user = await createConfirmedUser('simulador')
  const vitrine = await seedVitrine(user.id)
  const camiseta = await seedItem(vitrine, user.id, { name: 'Camiseta', priceCents: 2590 })
  const caneca = await seedItem(vitrine, user.id, { name: 'Caneca', priceCents: 800 })

  const admin = createAdminClient()
  await admin
    .rpc('insert_order_snapshot', {
      p_vitrine_id: vitrine.id,
      p_code: 'K7F2',
      p_payload: {
        items: [{ item_id: camiseta.id, code: camiseta.code, name: 'Camiseta', qty: 2, variation: null, note: null, unit_price_cents: 2390 }],
      },
    })
    .throwOnError()

  await signIn(page, user.email, user.password)
  // Consultar Pedido saiu da barra lateral (produto de serviços); a página continua no endereço.
  await expect(page.getByRole('link', { name: 'Consultar Pedido' })).toHaveCount(0)
  await page.goto('/painel/simulador')

  await page.getByLabel('Código do pedido').fill('#k7f2')
  await page.getByRole('button', { name: 'Consultar' }).click()
  await expect(page.getByText('Preço mudou desde o envio (era R$ 23,90)')).toBeVisible()
  await expect(page.getByText('R$ 51,80').first()).toBeVisible()

  await page.getByLabel('Código do item').fill(caneca.code)
  await page.getByRole('button', { name: 'Adicionar' }).click()
  await page.getByLabel('Quantidade de Caneca').fill('3')
  await expect(page.getByText('R$ 24,00').last()).toBeVisible()

  await page.getByLabel('Código do item').fill('ZZZZZ')
  await page.getByRole('button', { name: 'Adicionar' }).click()
  await expect(page.getByText('Item não encontrado.')).toBeVisible()
})
