import { expect, test } from '@playwright/test'
import { createConfirmedUser, seedVitrine, signIn, uniqueSubdomain, vitrineBySubdomain } from './helpers'
import { APP_URL } from '../playwright.config'

test('cria vitrine pelo assistente e respeita a vitrine única da conta', async ({ page }) => {
  const user = await createConfirmedUser('assistente')
  await signIn(page, user.email, user.password)

  await page.getByRole('link', { name: 'Criar minha vitrine' }).click()
  // Primeiro passo: o tipo da vitrine. Comida não é oferecida.
  await expect(page.getByRole('heading', { name: 'Que tipo de vitrine você quer criar?' })).toBeVisible()
  await expect(page.getByLabel('Comida')).toHaveCount(0)
  await page.getByLabel('Serviços e Agendamentos').check()
  await page.getByRole('button', { name: 'Continuar' }).click()

  await expect(page.getByRole('heading', { name: 'Qual é o seu tipo de negócio?' })).toBeVisible()
  await page.getByLabel('Nail Designer / Manicure').check()
  await page.getByRole('button', { name: 'Continuar' }).click()

  // O segmento personaliza os exemplos.
  await expect(page.getByLabel('Nome do negócio')).toHaveAttribute('placeholder', 'Ex.: Studio Ana Nails')
  const subdomain = uniqueSubdomain('nails')
  await page.getByLabel('Nome do negócio').fill('Studio Teste')
  await page.getByLabel('Endereço da vitrine').fill(subdomain)
  await expect(page.getByText('Endereço disponível.')).toBeVisible()
  await page.getByRole('button', { name: 'Continuar' }).click()

  await expect(page.getByRole('heading', { name: 'Para onde vão as solicitações?' })).toBeVisible()
  await page.getByLabel('WhatsApp', { exact: true }).fill('(11) 98765-4321')
  await page.getByLabel('Instagram (opcional)').fill('@Studio.Teste')
  await page.getByLabel('Endereço de atendimento (opcional)').fill('Rua das Flores, 120')
  await page.getByRole('button', { name: 'Continuar' }).click()

  await expect(page.getByRole('heading', { name: 'Quando você atende?' })).toBeVisible()
  await page.getByRole('switch', { name: 'Atende sábado' }).click()
  await page.getByLabel('Segunda: abre às').fill('10:00')
  await page.getByLabel('Escuro').check()
  await page.getByRole('button', { name: 'Criar vitrine' }).click()

  await expect(page).toHaveURL(/\/painel\/vitrines\/[0-9a-f-]+\/itens(\?criada=1)?$/)
  await expect(page.getByRole('heading', { name: 'Studio Teste' })).toBeVisible()
  // Categorias de exemplo do segmento.
  await expect(page.getByRole('heading', { name: 'Mãos' })).toBeVisible()

  const saved = await vitrineBySubdomain(subdomain)
  expect(saved).toMatchObject({
    type: 'servicos',
    service_segment: 'nail',
    instagram: 'studio.teste',
    address: 'Rua das Flores, 120',
    theme: 'dark',
  })
  expect(saved.business_hours).toEqual([1, 2, 3, 4, 5].map((day) => ({ day, open: day === 1 ? '10:00' : '09:00', close: '18:00' })))

  // Uma vitrine por conta: o painel abre direto no editor dela.
  await page.goto('/painel')
  await expect(page).toHaveURL(/\/painel\/vitrines\/[0-9a-f-]+\/itens$/)
  await expect(page.getByRole('link', { name: 'Nova vitrine' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Criar minha vitrine' })).toHaveCount(0)

  // Quem já tem vitrine não entra mais no assistente.
  await page.goto('/painel/vitrines/nova')
  await expect(page.getByRole('heading', { name: 'Você já tem uma vitrine' })).toBeVisible()
})

test('assistente cria vitrine de produtos, sem segmento nem horários', async ({ page }) => {
  const user = await createConfirmedUser('assistente-produtos')
  await signIn(page, user.email, user.password)

  await page.goto('/painel/vitrines/nova')
  await page.getByLabel('Produtos').check()
  await page.getByRole('button', { name: 'Continuar' }).click()

  // Produtos pula o segmento: o passo seguinte já é o nome do negócio.
  await expect(page.getByRole('heading', { name: 'Como o seu negócio se chama?' })).toBeVisible()
  await expect(page.getByText('Passo 2 de 4')).toBeVisible()
  const subdomain = uniqueSubdomain('loja')
  await page.getByLabel('Nome do negócio').fill('Loja Teste')
  await page.getByLabel('Endereço da vitrine').fill(subdomain)
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByLabel('WhatsApp', { exact: true }).fill('(11) 98765-4321')
  await page.getByRole('button', { name: 'Continuar' }).click()

  // Sem horários de atendimento: a última tela é só a aparência.
  await expect(page.getByRole('heading', { name: 'Como a vitrine vai aparecer?' })).toBeVisible()
  await expect(page.getByRole('switch', { name: 'Atende sábado' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Criar vitrine' }).click()

  await expect(page).toHaveURL(/\/painel\/vitrines\/[0-9a-f-]+\/itens(\?criada=1)?$/)
  const saved = await vitrineBySubdomain(subdomain)
  expect(saved).toMatchObject({ type: 'produtos', service_segment: null, business_hours: null, cart_enabled: true })

  // A vitrine de produtos tem sacola e WhatsApp; Agenda não aparece na navegação.
  const abas = page.getByRole('navigation', { name: 'Seções da vitrine' })
  await expect(abas.getByRole('link')).toHaveText(['Produtos', 'Aparência', 'WhatsApp', 'Sacola e mensagens', 'Configurações', 'Compartilhar'])
  const principal = page.getByRole('navigation', { name: 'Principal' }).filter({ visible: true })
  await expect(principal.getByRole('link')).toHaveText(['Vitrine', 'Plano', 'Conta'])
})

test('telefone inválido volta ao passo do WhatsApp; endereço em uso é avisado', async ({ page }) => {
  const other = await createConfirmedUser('dono-endereco')
  const taken = await seedVitrine(other.id)
  const user = await createConfirmedUser('conflito')
  await signIn(page, user.email, user.password)

  await page.goto('/painel/vitrines/nova')
  await page.getByLabel('Serviços e Agendamentos').check()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByLabel('Estética').check()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByLabel('Nome do negócio').fill('Clínica')
  await page.getByLabel('Endereço da vitrine').fill(taken.subdomain)
  await expect(page.getByText('Este endereço já está em uso. Escolha outro.')).toBeVisible()
  await page.getByLabel('Endereço da vitrine').fill(uniqueSubdomain('clinica'))
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(page.getByRole('heading', { name: 'Para onde vão as solicitações?' })).toBeVisible()
  await page.getByLabel('WhatsApp', { exact: true }).fill('123')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByRole('button', { name: 'Criar vitrine' }).click()
  await expect(page.getByText('Passo 4 de 5')).toBeVisible()
  await expect(page.getByText('Informe um WhatsApp válido com DDD.')).toBeVisible()
})

test('checagem de disponibilidade exige sessão', async ({ request }) => {
  const response = await request.get(`${APP_URL}/api/disponibilidade/subdominio?valor=qualquer`)
  expect(response.status()).toBe(401)
  expect((await response.json()).ok).toBe(false)
})
