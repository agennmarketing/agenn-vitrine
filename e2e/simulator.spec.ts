import { expect, test } from '@playwright/test'
import { createAdminClient, createConfirmedUser, seedItem, seedVitrine, signIn } from './helpers'

test('simulador recalcula pedido pelo código e soma no modo manual', async ({ page }) => {
  const user = await createConfirmedUser('simulador')
  const vitrine = await seedVitrine(user.id)
  const bacon = await seedItem(vitrine, user.id, { name: 'X-Bacon', priceCents: 2590 })
  const suco = await seedItem(vitrine, user.id, { name: 'Suco', priceCents: 800 })

  const admin = createAdminClient()
  await admin
    .rpc('insert_order_snapshot', {
      p_vitrine_id: vitrine.id,
      p_code: 'K7F2',
      p_payload: {
        items: [{ item_id: bacon.id, code: bacon.code, name: 'X-Bacon', qty: 2, variation: null, addons: [], note: null, unit_price_cents: 2390 }],
      },
    })
    .throwOnError()

  await signIn(page, user.email, user.password)
  await page.getByRole('link', { name: 'Simulador' }).filter({ visible: true }).first().click()

  await page.getByLabel('Código do pedido').fill('#k7f2')
  await page.getByRole('button', { name: 'Consultar' }).click()
  await expect(page.getByText('Preço mudou desde o envio (era R$ 23,90)')).toBeVisible()
  await expect(page.getByText('R$ 51,80').first()).toBeVisible()

  await page.getByLabel('Código do item').fill(suco.code)
  await page.getByRole('button', { name: 'Adicionar' }).click()
  await page.getByLabel('Quantidade de Suco').fill('3')
  await expect(page.getByText('R$ 24,00').last()).toBeVisible()

  await page.getByLabel('Código do item').fill('ZZZZZ')
  await page.getByRole('button', { name: 'Adicionar' }).click()
  await expect(page.getByText('Item não encontrado.')).toBeVisible()
})
