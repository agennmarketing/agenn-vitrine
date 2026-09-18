import { expect, test } from '@playwright/test'
import { APP_URL } from '../playwright.config'
import { createConfirmedUser, signIn } from './helpers'

test('login em outro aparelho encerra a sessão anterior', async ({ browser }) => {
  const user = await createConfirmedUser('sessao')
  const deviceA = await browser.newContext({ baseURL: APP_URL })
  const deviceB = await browser.newContext({ baseURL: APP_URL })
  const pageA = await deviceA.newPage()
  const pageB = await deviceB.newPage()

  await signIn(pageA, user.email, user.password)
  await signIn(pageB, user.email, user.password)

  await pageA.goto('/painel/conta')
  await expect(pageA).toHaveURL(/\/entrar\?motivo=outro-aparelho$/)
  await expect(pageA.getByText('Sua conta foi acessada em outro aparelho.')).toBeVisible()

  await pageB.goto('/painel/conta')
  await expect(pageB).toHaveURL(/\/painel\/conta$/)

  await deviceA.close()
  await deviceB.close()
})

test('conta: e-mail só leitura, alterar nome e trocar senha', async ({ page }) => {
  const user = await createConfirmedUser('conta')
  await signIn(page, user.email, user.password)
  // Pela navegação: barra lateral no computador, barra inferior no celular.
  await page.getByRole('link', { name: 'Conta', exact: true }).filter({ visible: true }).click()
  await expect(page).toHaveURL(/\/painel\/conta$/)

  const emailInput = page.getByLabel('E-mail')
  await expect(emailInput).toHaveValue(user.email)
  await expect(emailInput).toHaveAttribute('readonly', '')

  await page.getByLabel('Nome').fill('Nome Novo')
  await page.getByRole('button', { name: 'Salvar nome' }).click()
  await expect(page.getByText('Nome atualizado.')).toBeVisible()

  await page.getByLabel('Senha atual').fill('senhaErrada1')
  await page.getByLabel('Nova senha', { exact: true }).fill('outraSenha789')
  await page.getByLabel('Confirmar nova senha').fill('outraSenha789')
  await page.getByRole('button', { name: 'Trocar senha' }).click()
  await expect(page.getByText('Senha atual incorreta.')).toBeVisible()

  await page.getByLabel('Senha atual').fill(user.password)
  await page.getByLabel('Nova senha', { exact: true }).fill('outraSenha789')
  await page.getByLabel('Confirmar nova senha').fill('outraSenha789')
  await page.getByRole('button', { name: 'Trocar senha' }).click()
  await expect(page.getByText('Senha alterada com sucesso.')).toBeVisible()

  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await expect(page).toHaveURL(/\/entrar$/)
  await signIn(page, user.email, 'outraSenha789')
})

test('sair de todos os aparelhos', async ({ page }) => {
  const user = await createConfirmedUser('todos')
  await signIn(page, user.email, user.password)
  await page.goto('/painel/conta')
  await page.getByRole('button', { name: 'Sair de todos os aparelhos' }).click()
  await expect(page).toHaveURL(/\/entrar$/)
  await page.goto('/painel')
  await expect(page).toHaveURL(/\/entrar\?next=%2Fpainel$/)
})
