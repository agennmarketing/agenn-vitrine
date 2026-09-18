import { expect, test } from '@playwright/test'
import { createConfirmedUser, makeTestImage, seedItem, seedVitrine, setPlan, signIn, uploadImage } from './helpers'

test('gratuito: 11º item vira convite para o Pro; Pro cadastra', async ({ page }) => {
  const user = await createConfirmedUser('limite-itens')
  const vitrine = await seedVitrine(user.id)
  for (let i = 1; i <= 10; i++) await seedItem(vitrine, user.id, { name: `Item ${i}`, priceCents: 1000 })
  await signIn(page, user.email, user.password)

  await page.goto(`/painel/vitrines/${vitrine.id}/itens/novo`)
  await uploadImage(page, 'Capa', await makeTestImage(page))
  await page.getByLabel('Nome', { exact: true }).fill('Décimo primeiro')
  await page.getByLabel('Categoria').selectOption({ label: 'Destaques' })
  await page.getByLabel('Preço', { exact: true }).fill('10')
  await page.getByRole('button', { name: 'Salvar item' }).click()
  await expect(page.getByText('Seu plano permite até 10 itens por vitrine. Assine o Pro para cadastrar mais.')).toBeVisible()

  await setPlan(user.id, 'pro')
  await page.getByRole('button', { name: 'Salvar item' }).click()
  await expect(page.getByText('Item salvo.')).toBeVisible()
})

test('gratuito: nova vitrine bloqueada; marca com cadeado; vitrine pública com marca d’água', async ({ page }) => {
  const user = await createConfirmedUser('limite-vitrine')
  const vitrine = await seedVitrine(user.id)
  await seedItem(vitrine, user.id, { name: 'Único', priceCents: 1000 })
  await signIn(page, user.email, user.password)

  await page.goto('/painel/vitrines/nova')
  await expect(page.getByText('Seu plano permite até 1 vitrine. Assine o Pro para criar mais.')).toBeVisible()

  await page.goto(`/painel/vitrines/${vitrine.id}/aparencia`)
  await expect(page.getByText('Recurso do plano Pro')).toBeVisible()

  await page.goto(`http://${vitrine.subdomain}.localhost:3000/`)
  await expect(page.getByText('Feito com Vitrimove')).toBeVisible()
})
