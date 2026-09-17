import { expect, test } from '@playwright/test'
import { APP_URL } from '../playwright.config'
import { createAdminClient, createConfirmedUser, signIn, uniqueEmail } from './helpers'

test('login com e-mail não confirmado mostra aviso', async ({ page }) => {
  const admin = createAdminClient()
  const email = uniqueEmail('naoconfirmado')
  const { error } = await admin.auth.admin.createUser({ email, password: 'senhaForte123', email_confirm: false })
  if (error) throw error

  await page.goto('/entrar')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha', { exact: true }).fill('senhaForte123')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByText('Confirme seu e-mail antes de entrar.')).toBeVisible()
  await expect(page).toHaveURL(/\/entrar/)
})

test('domínio antigo redireciona com 301 preservando subdomínio, caminho e query', async ({ request }) => {
  // No CI, LEGACY_DOMAINS=legado.localhost:3000 e o domínio raiz é localhost:3000.
  const response = await request.get('http://loja.legado.localhost:3000/?item=104', { maxRedirects: 0 })
  expect(response.status()).toBe(301)
  expect(response.headers()['location']).toBe('http://loja.localhost:3000/?item=104')
})

test('sair de todos os aparelhos derruba a sessão de outro navegador', async ({ browser }) => {
  const user = await createConfirmedUser('todos2')
  const deviceA = await browser.newContext({ baseURL: APP_URL })
  const pageA = await deviceA.newPage()
  await signIn(pageA, user.email, user.password)

  const deviceB = await browser.newContext({ baseURL: APP_URL })
  const pageB = await deviceB.newPage()
  await signIn(pageB, user.email, user.password)
  await pageB.goto('/painel/conta')
  await pageB.getByRole('button', { name: 'Sair de todos os aparelhos' }).click()
  await expect(pageB).toHaveURL(/\/entrar$/)

  await pageA.goto('/painel')
  await expect(pageA).toHaveURL(/\/entrar/)

  await deviceA.close()
  await deviceB.close()
})
