import { expect, test } from '@playwright/test'
import { createConfirmedUser, seedVitrine, setPlan, setTrialEndsAt, signIn } from './helpers'

// Os rótulos vêm do Intl (R$ + espaço não separável), por isso casamos por regex.
const ASSINAR = /Assinar por R\$.?69,90 por mês/
const DAY_MS = 86_400_000

test('conta nova está no teste grátis e assina o Plano Essencial', async ({ page }) => {
  const user = await createConfirmedUser('plano')
  await seedVitrine(user.id)
  await signIn(page, user.email, user.password)

  await page.goto('/painel/plano')
  await expect(page.getByRole('heading', { name: /^Teste grátis — \d dias restantes$/ })).toBeVisible()
  await expect(page.getByText(/Vai até \d{2}\/\d{2}\/\d{4}/)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Essencial', exact: true })).toBeVisible()
  // Um plano só: nada de Gratuito nem Pro na tela.
  await expect(page.getByText(/Gratuito|Plano Pro/)).toHaveCount(0)

  await page.getByRole('button', { name: 'Assinar Essencial' }).click()
  await page.waitForURL(/\/painel\/plano\?assinatura=ok$/)
  await expect(page.getByText('Assinatura confirmada. Bom proveito!')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Plano Essencial — Ativo' })).toBeVisible()
  await expect(page.getByText(/Próxima cobrança em/)).toBeVisible()

  await page.getByRole('button', { name: 'Gerenciar assinatura' }).click()
  await page.waitForURL(/\/api\/dev-billing\/portal/)
  await page.getByRole('link', { name: 'Cancelar agora' }).click()
  await page.waitForURL(/\/painel\/plano$/)
  // Cancelou ainda dentro dos 7 dias: o teste continua valendo até o fim.
  await expect(page.getByRole('heading', { name: /^Teste grátis — / })).toBeVisible()
})

test('avisa nos últimos dias do teste', async ({ page }) => {
  const user = await createConfirmedUser('aviso-teste')
  await seedVitrine(user.id)
  await signIn(page, user.email, user.password)

  await page.goto('/painel/agenda')
  await expect(page.getByText(/Seu teste grátis termina/)).toHaveCount(0)

  await setTrialEndsAt(user.id, new Date(Date.now() + 2 * DAY_MS))
  await page.reload()
  await expect(page.getByText('Seu teste grátis termina em 2 dias. Assine para continuar usando o Vitrimove.')).toBeVisible()
  await page.getByRole('link', { name: 'Assinar', exact: true }).click()
  await expect(page).toHaveURL(/\/painel\/plano$/)
})

test('teste vencido: o painel vira a tela de assinatura, mas Conta continua aberta', async ({ page }) => {
  const user = await createConfirmedUser('teste-vencido')
  const vitrine = await seedVitrine(user.id)
  await signIn(page, user.email, user.password)
  await setPlan(user.id, 'expired')

  for (const path of ['/painel/agenda', `/painel/vitrines/${vitrine.id}/aparencia`]) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: 'Seu teste grátis terminou' })).toBeVisible()
    await expect(page.getByRole('button', { name: ASSINAR })).toBeVisible()
  }

  await page.goto('/painel/plano')
  await expect(page.getByRole('heading', { name: 'Seu teste terminou' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Assinar por R\$.?69,90\/mês/ })).toBeVisible()

  await page.goto('/painel/conta')
  await expect(page.getByRole('heading', { name: 'Seu teste grátis terminou' })).toHaveCount(0)
})
