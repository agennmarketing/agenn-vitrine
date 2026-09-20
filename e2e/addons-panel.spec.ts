import { expect, test } from '@playwright/test'
import { createConfirmedUser, itemStep, seedItem, seedVitrine, signIn, uniqueSubdomain } from './helpers'

test('grupos a partir de modelos, ligados ao item, e formulário da sacola', async ({ page }) => {
  const user = await createConfirmedUser('complementos')
  const vitrine = await seedVitrine(user.id, { type: 'produtos', cartEnabled: true })
  const item = await seedItem(vitrine, user.id, { name: 'Camiseta', priceCents: 5900 })
  await signIn(page, user.email, user.password)

  await page.goto(`/painel/vitrines/${vitrine.id}/complementos`)
  const novo = page.getByRole('form', { name: 'Novo grupo' })
  await novo.getByRole('button', { name: 'Salvar grupo' }).click()
  await expect(novo.getByText('Informe o nome do grupo.')).toBeVisible()

  await page.getByLabel('Começar de um modelo').selectOption({ label: 'Tamanho (P, M, G)' })
  await expect(page.getByRole('form', { name: 'Novo grupo' }).getByLabel('Nome do grupo')).toHaveValue('Tamanho')
  await page.getByRole('form', { name: 'Novo grupo' }).getByRole('button', { name: 'Salvar grupo' }).click()
  await expect(page.getByText('Grupo salvo.')).toBeVisible()
  await expect(page.getByRole('form', { name: 'Grupo Tamanho' })).toBeVisible()

  await page.getByLabel('Começar de um modelo').selectOption({ label: 'Embalagem para presente' })
  const embalagem = page.getByRole('form', { name: 'Novo grupo' })
  await expect(embalagem.getByLabel('Nome do grupo')).toHaveValue('Embalagem')
  await embalagem.getByRole('button', { name: 'Salvar grupo' }).click()
  await expect(page.getByRole('form', { name: 'Grupo Embalagem' })).toBeVisible()
  // Sabores (meia a meia) era coisa das vitrines de comida: não aparece mais.
  await expect(page.getByRole('option', { name: 'Sabores de pizza' })).toHaveCount(0)

  await page.goto(`/painel/vitrines/${vitrine.id}/itens/${item.id}`)
  await itemStep(page, 'Extras')
  await page.getByLabel('Tamanho').check()
  await page.getByLabel('Embalagem').check()
  await page.getByRole('button', { name: 'Salvar item' }).click()
  await expect(page.getByText('Item salvo.')).toBeVisible()
  await page.goto(`/painel/vitrines/${vitrine.id}/itens/${item.id}`)
  await itemStep(page, 'Extras')
  await expect(page.getByLabel('Tamanho')).toBeChecked()
  await expect(page.getByLabel('Embalagem')).toBeChecked()

  await page.goto(`/painel/vitrines/${vitrine.id}/mensagens`)
  await expect(page.getByLabel('Usar sacola')).toBeChecked()
  await page.getByLabel('Forma de pagamento', { exact: true }).selectOption('required')
  await page.getByLabel('Formas de pagamento (uma por linha)').fill('')
  await page.getByRole('button', { name: 'Salvar mensagens' }).click()
  await expect(page.getByText('Informe pelo menos uma forma de pagamento.')).toBeVisible()
  await page.getByLabel('Formas de pagamento (uma por linha)').fill('Pix\nDinheiro')
  await page.getByRole('button', { name: 'Salvar mensagens' }).click()
  await expect(page.getByText('Mensagens salvas.')).toBeVisible()
})

test('assistente só oferece Produtos e Serviços', async ({ page }) => {
  const user = await createConfirmedUser('tipos')
  await signIn(page, user.email, user.password)

  await page.goto('/painel/vitrines/nova')
  await expect(page.getByLabel('Produtos')).toBeVisible()
  await expect(page.getByLabel('Serviços')).toBeVisible()
  await expect(page.getByLabel('Comida')).toHaveCount(0)

  await page.getByLabel('Serviços').check()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByLabel('Nome da vitrine').fill('Clínica Teste')
  await page.getByLabel('Endereço da vitrine', { exact: true }).fill(uniqueSubdomain('clinica'))
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByLabel('WhatsApp', { exact: true }).fill('(11) 98765-4321')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByRole('button', { name: 'Criar vitrine' }).click()
  await expect(page.getByRole('heading', { name: 'Serviços' })).toBeVisible()

  await page.getByRole('link', { name: 'Sacola e mensagens' }).click()
  await expect(page.getByLabel('Texto padrão do botão')).toHaveValue('Agendar')
})
