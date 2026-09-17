import { expect, test } from '@playwright/test'
import { createConfirmedUser, makeTestImage, signIn, uniqueSubdomain, uploadImage } from './helpers'

test('criar vitrine → cadastrar item → vitrine pública → WhatsApp → simulador', async ({ page }) => {
  const user = await createConfirmedUser('fluxo')
  await signIn(page, user.email, user.password)

  const subdomain = uniqueSubdomain('fluxo')
  await page.goto('/painel/vitrines/nova')
  await page.getByLabel('Produtos').check()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByLabel('Nome da vitrine').fill('Burger do Zé')
  await page.getByLabel('Endereço da vitrine').fill(subdomain)
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByLabel('WhatsApp', { exact: true }).fill('(11) 98765-4321')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByRole('button', { name: 'Criar vitrine' }).click()
  await expect(page).toHaveURL(/\/itens$/)

  await page.getByRole('link', { name: 'Novo item' }).click()
  await uploadImage(page, 'Capa', await makeTestImage(page))
  await page.getByLabel('Nome', { exact: true }).fill('X-Bacon')
  await page.getByLabel('Categoria').selectOption({ label: 'Destaques' })
  await page.getByLabel('Preço', { exact: true }).fill('25,90')
  await page.getByRole('button', { name: 'Salvar item' }).click()
  await expect(page.getByText('Item salvo.')).toBeVisible()

  await page.goto(`http://${subdomain}.localhost:3000/`)
  await expect(page.getByRole('heading', { level: 1, name: 'Burger do Zé' })).toBeVisible()
  await page.getByRole('button', { name: 'X-Bacon' }).click()
  await page.route('https://wa.me/**', (route) => route.fulfill({ status: 200, body: 'ok' }))
  const request = page.waitForRequest(/^https:\/\/wa\.me\//)
  await page.getByRole('dialog', { name: 'X-Bacon' }).getByRole('button', { name: 'Solicitar orçamento' }).click()
  const url = new URL((await request).url())
  expect(url.pathname).toBe('/5511987654321')
  const text = url.searchParams.get('text')!
  expect(text).toContain('*X-Bacon* (cód. 101)')
  const orderCode = text.match(/Pedido #([23456789A-HJ-NP-Z]{4})$/)![1]

  await page.goto('/painel/simulador')
  await page.getByLabel('Código do pedido').fill(orderCode)
  await page.getByRole('button', { name: 'Consultar' }).click()
  await expect(page.getByText('R$ 25,90').first()).toBeVisible()
})
