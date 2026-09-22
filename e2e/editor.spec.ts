import { expect, test } from '@playwright/test'
import { createConfirmedUser, seedVitrine, setPlan, signIn, uniqueSubdomain } from './helpers'

test('abas do editor por tipo de vitrine', async ({ page }) => {
  const user = await createConfirmedUser('abas')
  const vitrine = await seedVitrine(user.id, { type: 'servicos' })
  await signIn(page, user.email, user.password)

  const abas = page.getByRole('navigation', { name: 'Seções da vitrine' })
  await page.goto(`/painel/vitrines/${vitrine.id}/itens`)
  await expect(abas.getByRole('link')).toHaveText(['Serviços', 'Agenda', 'Aparência', 'WhatsApp', 'Configurações', 'Compartilhar'])
  await expect(abas.getByRole('link', { name: 'Complementos' })).toHaveCount(0)

  // Sem sacola em serviços: a seção não abre nem pelo endereço.
  await page.goto(`/painel/vitrines/${vitrine.id}/mensagens`)
  await expect(page).toHaveURL(new RegExp(`/painel/vitrines/${vitrine.id}/itens$`))

  // Uma vitrine por conta: a de produtos é de outro dono.
  const lojista = await createConfirmedUser('abas-produtos')
  const loja = await seedVitrine(lojista.id, { type: 'produtos' })
  await page.context().clearCookies()
  await signIn(page, lojista.email, lojista.password)
  await page.goto(`/painel/vitrines/${loja.id}/itens`)
  await expect(abas.getByRole('link')).toHaveText(['Itens', 'Aparência', 'WhatsApp', 'Sacola e mensagens', 'Configurações', 'Compartilhar'])
})

test('configurações, mensagens e WhatsApp', async ({ page }) => {
  const user = await createConfirmedUser('editor')
  const vitrine = await seedVitrine(user.id)
  await signIn(page, user.email, user.password)

  await page.goto(`/painel/vitrines/${vitrine.id}/configuracoes`)
  await page.getByLabel('Nome da vitrine').fill('Nome Novo')
  const novo = uniqueSubdomain('novo')
  await page.getByLabel('Endereço da vitrine', { exact: true }).fill(novo)
  await page.getByRole('button', { name: 'Salvar configurações' }).click()
  await expect(page.getByText('Confirme que o link antigo vai parar de funcionar.')).toBeVisible()
  await page.getByLabel('Entendi que o link antigo vai parar de funcionar').check()
  await page.getByRole('button', { name: 'Salvar configurações' }).click()
  await expect(page.getByText('Configurações salvas.')).toBeVisible()

  await page.getByRole('link', { name: 'Sacola e mensagens' }).click()
  await page.getByLabel('Texto padrão do botão').fill('Quero este')
  await page.getByRole('button', { name: 'Salvar mensagens' }).click()
  await expect(page.getByText('Mensagens salvas.')).toBeVisible()

  await page.getByRole('link', { name: 'WhatsApp' }).click()
  await page.getByLabel('Nome do novo contato').fill('Loja 2')
  await page.getByLabel('Número do novo contato').fill('(21) 99876-5432')
  await page.getByRole('button', { name: 'Adicionar contato' }).click()
  await expect(page.getByText('Contato salvo.')).toBeVisible()
  await page.getByRole('button', { name: 'Tornar principal' }).click()
  await expect(page.getByText('Contato principal alterado.')).toBeVisible()
  await page.getByRole('button', { name: 'Remover' }).click()
  await expect(page.getByText('Contato removido.')).toBeVisible()
})

test('aparência: marca bloqueada no gratuito e liberada no Pro', async ({ page }) => {
  const user = await createConfirmedUser('aparencia')
  const vitrine = await seedVitrine(user.id)
  await signIn(page, user.email, user.password)

  await page.goto(`/painel/vitrines/${vitrine.id}/aparencia`)
  await expect(page.getByText('Recurso do plano Pro')).toBeVisible()
  await expect(page.getByLabel('Cor da marca')).toBeDisabled()
  await page.getByLabel('Escuro').check()
  await page.getByRole('button', { name: 'Salvar aparência' }).click()
  await expect(page.getByText('Aparência salva.')).toBeVisible()

  await setPlan(user.id, 'pro')
  await page.reload()
  await expect(page.getByLabel('Cor da marca')).toBeEnabled()
})

test('excluir vitrine pede o endereço', async ({ page }) => {
  const user = await createConfirmedUser('excluir')
  const vitrine = await seedVitrine(user.id)
  await signIn(page, user.email, user.password)

  await page.goto(`/painel/vitrines/${vitrine.id}/configuracoes`)
  await page.getByRole('button', { name: 'Excluir definitivamente' }).click()
  await expect(page.getByText('Digite o endereço da vitrine para confirmar.').last()).toBeVisible()
  await page.getByLabel('Digite o endereço da vitrine para confirmar').fill(vitrine.subdomain)
  await page.getByRole('button', { name: 'Excluir definitivamente' }).click()
  await expect(page).toHaveURL(/\/painel$/)
  await expect(page.getByText('Você ainda não tem vitrine')).toBeVisible()
})
