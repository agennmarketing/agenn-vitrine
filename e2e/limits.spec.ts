import { expect, test } from '@playwright/test'
import { createConfirmedUser, seedItem, seedVitrine, signIn } from './helpers'

test('uma vitrine por conta; no teste a marca é liberada e a vitrine pública sai sem marca d’água', async ({ page }) => {
  const user = await createConfirmedUser('limite-vitrine')
  const vitrine = await seedVitrine(user.id)
  await seedItem(vitrine, user.id, { name: 'Único', priceCents: 1000 })
  await signIn(page, user.email, user.password)

  await page.goto('/painel/vitrines/nova')
  await expect(page.getByText('Cada conta tem uma vitrine. Edite a sua quando quiser.')).toBeVisible()

  await page.goto(`/painel/vitrines/${vitrine.id}/aparencia`)
  await expect(page.getByLabel('Cor da marca')).toBeEnabled()

  await page.goto(`http://${vitrine.subdomain}.localhost:3000/`)
  await expect(page.getByRole('heading', { level: 1, name: vitrine.name })).toBeVisible()
  await expect(page.getByText('Feito com Vitrimove')).toHaveCount(0)
})
