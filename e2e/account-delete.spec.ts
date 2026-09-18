import { expect, test } from '@playwright/test'
import {
  countUserRows,
  createAdminClient,
  createConfirmedUser,
  fakeSubscription,
  seedItem,
  seedVitrine,
  setSubscription,
  signIn,
  uniqueSubdomain,
} from './helpers'

test('excluir conta cancela a assinatura, apaga tudo e tira a vitrine do ar', async ({ page, request }) => {
  const user = await createConfirmedUser('excluir')
  const customerId = `cus_fake_${crypto.randomUUID()}`
  const subscriptionId = await fakeSubscription({ customerId, userId: user.id })
  await setSubscription(user.id, { status: 'active', customerId, subscriptionId })

  const vitrine = await seedVitrine(user.id, { subdomain: uniqueSubdomain('sai') })
  await seedItem(vitrine, user.id, { name: 'Camiseta', priceCents: 4990 })
  await signIn(page, user.email, user.password)

  await page.goto(`http://${vitrine.subdomain}.localhost:3000/`)
  await expect(page.getByRole('heading', { level: 1, name: vitrine.name })).toBeVisible()

  await page.goto('/painel/conta')
  await page.getByRole('button', { name: 'Excluir conta' }).click()
  await page.getByLabel('Digite o e-mail da conta para confirmar').fill('outro@teste.com')
  await page.getByRole('button', { name: 'Excluir minha conta' }).click()
  await expect(page.getByText('Digite o e-mail da conta para confirmar.')).toBeVisible()

  // A confirmação errada não pode ter apagado nada.
  expect(await countUserRows(user.id)).toBeGreaterThan(0)

  await page.getByLabel('Digite o e-mail da conta para confirmar').fill(user.email)
  await page.getByRole('button', { name: 'Excluir minha conta' }).click()
  await expect(page).toHaveURL(/\/entrar\?motivo=conta-excluida$/)
  await expect(page.getByText('Sua conta foi excluída. Sentiremos sua falta!')).toBeVisible()

  expect(await countUserRows(user.id)).toBe(0)

  const admin = createAdminClient()
  const { data } = await admin.auth.admin.getUserById(user.id)
  expect(data.user).toBeNull()

  // A vitrine sai do ar (revalidação por tag).
  await expect
    .poll(async () => (await request.get(`http://${vitrine.subdomain}.localhost:3000/`)).status())
    .toBe(404)
})

test('não dá para entrar de novo com a conta excluída', async ({ page }) => {
  const user = await createConfirmedUser('excluir-login')
  await signIn(page, user.email, user.password)
  await page.goto('/painel/conta')
  await page.getByRole('button', { name: 'Excluir conta' }).click()
  await page.getByLabel('Digite o e-mail da conta para confirmar').fill(user.email)
  await page.getByRole('button', { name: 'Excluir minha conta' }).click()
  await expect(page).toHaveURL(/\/entrar\?motivo=conta-excluida$/)

  await page.getByLabel('E-mail').fill(user.email)
  await page.getByLabel('Senha', { exact: true }).fill(user.password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible()
})
