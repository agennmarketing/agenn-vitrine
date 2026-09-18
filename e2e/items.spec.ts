import { expect, test } from '@playwright/test'
import { createConfirmedUser, makeTestImage, seedVitrine, signIn, uploadImage } from './helpers'

test('cadastra item com capa e variações, edita código, esgota, duplica e exclui', async ({ page }) => {
  const user = await createConfirmedUser('itens')
  const vitrine = await seedVitrine(user.id)
  await signIn(page, user.email, user.password)

  await page.goto(`/painel/vitrines/${vitrine.id}/itens`)
  await page.getByRole('link', { name: 'Novo item' }).click()
  await uploadImage(page, 'Capa', await makeTestImage(page))
  await page.getByLabel('Nome', { exact: true }).fill('Camiseta')
  await expect(page.getByLabel('Código')).toHaveValue('101')
  await page.getByLabel('Categoria').selectOption({ label: 'Destaques' })
  await page.getByRole('button', { name: 'Adicionar variação' }).click()
  await page.getByLabel('Nome da variação 1').fill('P')
  await page.getByLabel('Preço da variação 1').fill('39,90')
  await page.getByRole('button', { name: 'Adicionar variação' }).click()
  await page.getByLabel('Nome da variação 2').fill('G')
  await page.getByLabel('Preço da variação 2').fill('44,90')
  await page.getByRole('button', { name: 'Salvar item' }).click()

  await expect(page.getByText('Item salvo.')).toBeVisible()
  await expect(page.getByText('Camiseta')).toBeVisible()
  await expect(page.getByText('A partir de R$ 39,90')).toBeVisible()

  await page.getByRole('link', { name: 'Editar' }).click()
  await page.getByLabel('Código').fill('cam1')
  await expect(page.getByText('Código disponível.')).toBeVisible()
  await page.getByRole('button', { name: 'Salvar item' }).click()
  await expect(page.getByText('cód. CAM1')).toBeVisible()

  // Disponibilidade é um interruptor; Duplicar, Subir, Descer e Excluir ficam no menu "Mais ações".
  await page.getByRole('switch', { name: 'Camiseta disponível' }).click()
  await expect(page.getByText('Esgotado', { exact: true })).toBeVisible()
  await expect(page.getByRole('switch', { name: 'Camiseta disponível' })).toHaveAttribute('aria-checked', 'false')

  await page.getByRole('button', { name: 'Mais ações' }).click()
  await page.getByRole('menuitem', { name: 'Duplicar' }).click()
  await expect(page.getByText('Item duplicado.')).toBeVisible()
  await expect(page.getByText('Camiseta (cópia)')).toBeVisible()

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Mais ações' }).last().click()
  await page.getByRole('menuitem', { name: 'Excluir' }).click()
  await expect(page.getByText('Item excluído.')).toBeVisible()
})

test('item sem capa mostra erro', async ({ page }) => {
  const user = await createConfirmedUser('itens-erro')
  const vitrine = await seedVitrine(user.id)
  await signIn(page, user.email, user.password)

  await page.goto(`/painel/vitrines/${vitrine.id}/itens/novo`)
  await page.getByLabel('Nome', { exact: true }).fill('Sem capa')
  await page.getByLabel('Preço', { exact: true }).fill('10')
  await page.getByRole('button', { name: 'Salvar item' }).click()
  await expect(page.getByText('Envie a imagem de capa.')).toBeVisible()
})
