import { expect, test } from '@playwright/test'
import { createAdminClient, createConfirmedUser, openAgenda, seedItem, seedVitrine, signIn, uniqueSubdomain } from './helpers'

test('abas do editor por tipo de vitrine', async ({ page }) => {
  const user = await createConfirmedUser('abas')
  const vitrine = await seedVitrine(user.id, { type: 'servicos' })
  await signIn(page, user.email, user.password)

  const abas = page.getByRole('navigation', { name: 'Seções da vitrine' })
  await page.goto(`/painel/vitrines/${vitrine.id}/itens`)
  await expect(abas.getByRole('link')).toHaveText(['Serviços', 'Aparência', 'Profissionais', 'Configurações', 'Compartilhar'])
  const principal = page.getByRole('navigation', { name: 'Principal' }).filter({ visible: true })
  await expect(principal.getByRole('link')).toHaveText(['Vitrine', 'Agenda', 'Plano', 'Conta'])
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
  await expect(abas.getByRole('link')).toHaveText(['Produtos', 'Aparência', 'WhatsApp', 'Sacola e mensagens', 'Configurações', 'Compartilhar'])
})

test('serviços: contato nas configurações aparece na vitrine', async ({ page }) => {
  const user = await createConfirmedUser('contato')
  const vitrine = await seedVitrine(user.id, { type: 'servicos' })
  await seedItem(vitrine, user.id, { name: 'Corte' })
  await openAgenda(vitrine.id, { business_hours: [{ day: 1, open: '09:00', close: '18:00' }] })
  await signIn(page, user.email, user.password)

  await page.goto(`/painel/vitrines/${vitrine.id}/configuracoes`)
  const whatsapp = page.getByLabel('WhatsApp', { exact: true })
  await expect(whatsapp).toHaveValue('(11) 98765-4321')
  await whatsapp.fill('')
  await page.getByRole('button', { name: 'Salvar configurações' }).click()
  await expect(page.getByText('Informe um WhatsApp válido com DDD.')).toBeVisible()

  await whatsapp.fill('(21) 99876-5432')
  await page.getByLabel('Instagram (opcional)').fill('https://instagram.com/Studio.Ana')
  await page.getByLabel('Endereço de atendimento (opcional)').fill('Rua das Flores, 120 - Centro')
  await page.getByRole('button', { name: 'Salvar configurações' }).click()
  await expect(page.getByText('Configurações salvas.')).toBeVisible()
  const { data: contact } = await createAdminClient()
    .from('whatsapp_contacts')
    .select('phone_e164')
    .eq('id', vitrine.contactId)
    .single()
    .throwOnError()
  expect(contact.phone_e164).toBe('+5521998765432')

  await page.goto(`http://${vitrine.subdomain}.localhost:3000/`)
  await expect(page.getByRole('link', { name: '@studio.ana' })).toHaveAttribute('href', 'https://instagram.com/studio.ana')
  await expect(page.getByRole('link', { name: 'Rua das Flores, 120 - Centro' })).toHaveAttribute('href', /google\.com\/maps/)
  const horarios = page.getByRole('button', { name: /^(Hoje: 9h–18h|Fechado hoje)$/ })
  await horarios.click()
  await expect(page.getByText('Segunda', { exact: true })).toBeVisible()
  await expect(page.getByText('9h–18h', { exact: true })).toBeVisible()
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
  await page.getByRole('button', { name: 'Salvar configurações de pedido' }).click()
  await expect(page.getByText('Configurações de pedido salvas.')).toBeVisible()

  await page.getByRole('link', { name: 'WhatsApp', exact: true }).click()
  await page.getByLabel('Nome do novo contato').fill('Loja 2')
  await page.getByLabel('Número do novo contato').fill('(21) 99876-5432')
  await page.getByRole('button', { name: 'Adicionar contato' }).click()
  await expect(page.getByText('Contato salvo.')).toBeVisible()
  await page.getByRole('button', { name: 'Tornar principal' }).click()
  await expect(page.getByText('Contato principal alterado.')).toBeVisible()
  await page.getByRole('button', { name: 'Remover' }).click()
  await expect(page.getByText('Contato removido.')).toBeVisible()
})

test('aparência: tema e marca liberados no teste grátis', async ({ page }) => {
  const user = await createConfirmedUser('aparencia')
  const vitrine = await seedVitrine(user.id)
  await signIn(page, user.email, user.password)

  await page.goto(`/painel/vitrines/${vitrine.id}/aparencia`)
  await expect(page.getByLabel('Cor da marca')).toBeEnabled()
  await page.getByLabel('Escuro').check()
  await page.getByRole('button', { name: 'Salvar aparência' }).click()
  await expect(page.getByText('Aparência salva.')).toBeVisible()
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
  // Sem vitrine, o painel leva direto ao assistente.
  await expect(page).toHaveURL(/\/painel\/vitrines\/nova$/)
  await expect(page.getByRole('heading', { name: 'Que tipo de vitrine você quer criar?' })).toBeVisible()
})
