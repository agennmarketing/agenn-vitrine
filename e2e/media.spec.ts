import { expect, test } from '@playwright/test'
import { createConfirmedUser, makeTestImage, seedVitrine, setPlan, signIn, uploadImage } from './helpers'

test('Pro envia logo e banner; gratuito vê bloqueado', async ({ page }) => {
  const user = await createConfirmedUser('logo')
  const vitrine = await seedVitrine(user.id)
  await signIn(page, user.email, user.password)

  await page.goto(`/painel/vitrines/${vitrine.id}/aparencia`)
  await expect(page.getByLabel('Logo', { exact: true })).toBeDisabled()

  await setPlan(user.id, 'pro')
  await page.reload()
  const image = await makeTestImage(page, 2000, 1200)
  await uploadImage(page, 'Logo', image)
  await uploadImage(page, 'Banner', image)

  await page.reload()
  await expect(page.getByRole('img', { name: 'Logo', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Remover imagem' }).first().click()
  await expect(page.getByRole('img', { name: 'Logo', exact: true })).toHaveCount(0)
  // Recarregar confirma que a mídia saiu do banco, e não só da tela.
  await page.reload()
  await expect(page.getByRole('img', { name: 'Logo', exact: true })).toHaveCount(0)
})
