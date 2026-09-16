import { expect, test } from '@playwright/test'

test('domínio raiz mostra a página inicial', async ({ page }) => {
  await page.goto('http://localhost:3000/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Agenn Vitrine')
})

test('subdomínio sem vitrine responde 404', async ({ page }) => {
  const response = await page.goto('http://nao-existe.localhost:3000/')
  expect(response?.status()).toBe(404)
  await expect(page.getByRole('heading', { name: 'Vitrine não encontrada' })).toBeVisible()
})

test('app sem login leva para entrar', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/entrar$/)
})

test('rota protegida guarda o destino', async ({ page }) => {
  await page.goto('/painel/conta')
  await expect(page).toHaveURL(/\/entrar\?next=%2Fpainel%2Fconta$/)
})
