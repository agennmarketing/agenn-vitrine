import { expect, test } from '@playwright/test'
import { createConfirmedUser, signIn, uniqueEmail, waitForAuthLink } from './helpers'

test('cadastro com confirmação de e-mail leva ao painel', async ({ page }) => {
  const email = uniqueEmail('cadastro')
  await page.goto('/cadastro')
  await page.getByLabel('Nome').fill('Maria Teste')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha', { exact: true }).fill('senhaForte123')
  await page.getByRole('button', { name: 'Criar conta' }).click()

  await expect(page).toHaveURL(/\/confirmar-email\?email=/)
  await expect(page.getByRole('heading', { name: 'Confirme seu e-mail' })).toBeVisible()

  await page.goto(await waitForAuthLink(email, 'email'))
  await expect(page).toHaveURL(/\/painel$/)
  await expect(page.getByRole('heading', { name: 'Minhas vitrines' })).toBeVisible()
  // O nome fica na barra lateral (computador) e na página Conta (celular também).
  await page.goto('/painel/conta')
  await expect(page.getByRole('main').getByText('Maria Teste')).toBeVisible()
})

test('cadastro mostra erros de validação', async ({ page }) => {
  await page.goto('/cadastro')
  await page.getByLabel('Nome').fill('A')
  await page.getByLabel('E-mail').fill('invalido')
  await page.getByLabel('Senha', { exact: true }).fill('123')
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page.getByText('Informe seu nome.')).toBeVisible()
  await expect(page.getByText('Informe um e-mail válido.')).toBeVisible()
  await expect(page.getByText('A senha precisa ter pelo menos 8 caracteres.')).toBeVisible()
})

test('login, sair e senha errada', async ({ page }) => {
  const user = await createConfirmedUser('login')
  await signIn(page, user.email, user.password)
  await page.goto('/painel/conta')
  await expect(page.getByRole('main').getByText(user.name)).toBeVisible()

  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await expect(page).toHaveURL(/\/entrar$/)

  await page.getByLabel('E-mail').fill(user.email)
  await page.getByLabel('Senha', { exact: true }).fill('senhaErrada1')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible()
})

test('login volta para o destino pedido', async ({ page }) => {
  const user = await createConfirmedUser('destino')
  await page.goto('/painel')
  await expect(page).toHaveURL(/\/entrar\?next=%2Fpainel$/)
  await page.getByLabel('E-mail').fill(user.email)
  await page.getByLabel('Senha', { exact: true }).fill(user.password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/painel$/)
})

test('sessão de login com senha não abre a tela de nova senha sem a senha atual', async ({ page }) => {
  const user = await createConfirmedUser('sem-link')
  await signIn(page, user.email, user.password)
  await page.goto('/redefinir-senha')
  await expect(page).toHaveURL(/\/painel\/conta$/)
})

test('recuperação de senha por e-mail', async ({ page }) => {
  const user = await createConfirmedUser('recuperar')
  await page.goto('/entrar')
  await page.getByRole('link', { name: 'Esqueci minha senha' }).click()
  await expect(page.getByRole('heading', { name: 'Esqueci minha senha' })).toBeVisible()
  await page.getByLabel('E-mail').fill(user.email)
  await page.getByRole('button', { name: 'Enviar link' }).click()
  await expect(page.getByText('Se existir uma conta com este e-mail, enviamos um link para redefinir a senha.')).toBeVisible()

  await page.goto(await waitForAuthLink(user.email, 'recovery'))
  await expect(page).toHaveURL(/\/redefinir-senha$/)
  await page.getByLabel('Nova senha', { exact: true }).fill('novaSenha456')
  await page.getByLabel('Confirmar nova senha').fill('novaSenha456')
  await page.getByRole('button', { name: 'Salvar nova senha' }).click()
  await expect(page).toHaveURL(/\/painel$/)

  await page.goto('/painel/conta')
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await expect(page).toHaveURL(/\/entrar$/)
  await signIn(page, user.email, 'novaSenha456')
})
