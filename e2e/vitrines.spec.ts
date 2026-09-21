import { expect, test } from '@playwright/test'
import { createConfirmedUser, seedVitrine, signIn, uniqueSubdomain } from './helpers'
import { APP_URL } from '../playwright.config'

test('cria vitrine pelo assistente e respeita a vitrine única da conta', async ({ page }) => {
  const user = await createConfirmedUser('assistente')
  await signIn(page, user.email, user.password)

  await page.getByRole('link', { name: 'Criar minha vitrine' }).click()
  await expect(page.getByLabel('Comida')).toHaveCount(0)
  await page.getByLabel('Produtos').check()
  await page.getByRole('button', { name: 'Continuar' }).click()

  const subdomain = uniqueSubdomain('loja')
  await page.getByLabel('Nome da vitrine').fill('Loja Teste')
  await page.getByLabel('Endereço da vitrine').fill(subdomain)
  await expect(page.getByText('Endereço disponível.')).toBeVisible()
  await page.getByRole('button', { name: 'Continuar' }).click()

  // Vitrine de produtos: o passo do contato fala em pedidos.
  await expect(page.getByRole('heading', { name: 'Para onde vão os pedidos?' })).toBeVisible()
  await page.getByLabel('WhatsApp', { exact: true }).fill('(11) 98765-4321')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByLabel('Escuro').check()
  await page.getByRole('button', { name: 'Criar vitrine' }).click()

  await expect(page).toHaveURL(/\/painel\/vitrines\/[0-9a-f-]+\/itens(\?criada=1)?$/)
  await expect(page.getByRole('heading', { name: 'Loja Teste' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Destaques' })).toBeVisible()

  // Uma vitrine por conta: o painel abre direto no editor dela.
  await page.goto('/painel')
  await expect(page).toHaveURL(/\/painel\/vitrines\/[0-9a-f-]+\/itens$/)
  await expect(page.getByRole('link', { name: 'Nova vitrine' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Criar minha vitrine' })).toHaveCount(0)

  // Quem já tem vitrine não entra mais no assistente.
  await page.goto('/painel/vitrines/nova')
  await expect(page.getByRole('heading', { name: 'Você já tem uma vitrine' })).toBeVisible()
})

test('telefone inválido volta ao passo do WhatsApp; endereço em uso é avisado', async ({ page }) => {
  const other = await createConfirmedUser('dono-endereco')
  const taken = await seedVitrine(other.id)
  const user = await createConfirmedUser('conflito')
  await signIn(page, user.email, user.password)

  await page.goto('/painel/vitrines/nova')
  await page.getByLabel('Serviços').check()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByLabel('Nome da vitrine').fill('Clínica')
  await page.getByLabel('Endereço da vitrine').fill(taken.subdomain)
  await expect(page.getByText('Este endereço já está em uso. Escolha outro.')).toBeVisible()
  await page.getByLabel('Endereço da vitrine').fill(uniqueSubdomain('clinica'))
  await page.getByRole('button', { name: 'Continuar' }).click()
  // Vitrine de serviços: o mesmo passo fala em solicitações.
  await expect(page.getByRole('heading', { name: 'Para onde vão as solicitações?' })).toBeVisible()
  await page.getByLabel('WhatsApp', { exact: true }).fill('123')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByRole('button', { name: 'Criar vitrine' }).click()
  await expect(page.getByText('Passo 3 de 4')).toBeVisible()
  await expect(page.getByText('Informe um WhatsApp válido com DDD.')).toBeVisible()
})

test('checagem de disponibilidade exige sessão', async ({ request }) => {
  const response = await request.get(`${APP_URL}/api/disponibilidade/subdominio?valor=qualquer`)
  expect(response.status()).toBe(401)
  expect((await response.json()).ok).toBe(false)
})
