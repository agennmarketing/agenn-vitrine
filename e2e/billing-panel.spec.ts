import { expect, test } from '@playwright/test'
import { createConfirmedUser, seedVitrine, signIn, uniqueSubdomain, vitrineStatuses } from './helpers'

// Os rótulos vêm do Intl (R$ + espaço não separável), por isso casamos por regex.
const ASSINAR_MENSAL = /Assinar por R\$.?149,90 por mês/
const ASSINAR_ANUAL = /Assinar por R\$.?1\.499,00 por ano/

test('assina o Pro e cancela pelo portal', async ({ page }) => {
  const user = await createConfirmedUser('plano')
  const vitrine = await seedVitrine(user.id, { name: 'Loja Um', subdomain: uniqueSubdomain('pl-a') })
  await signIn(page, user.email, user.password)

  await page.goto('/painel/plano')
  await expect(page.getByRole('heading', { name: 'Plano Gratuito' })).toBeVisible()

  await page.getByRole('button', { name: ASSINAR_MENSAL }).click()
  await page.waitForURL(/\/painel\/plano\?assinatura=ok$/)
  await expect(page.getByText('Assinatura confirmada. Bom proveito!')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Plano Pro' })).toBeVisible()
  await expect(page.getByText('Renova em')).toBeVisible()

  await page.getByRole('button', { name: 'Gerenciar assinatura' }).click()
  await page.waitForURL(/\/api\/dev-billing\/portal/)
  await page.getByRole('link', { name: 'Cancelar agora' }).click()
  await page.waitForURL(/\/painel\/plano$/)
  await expect(page.getByRole('heading', { name: 'Plano Gratuito' })).toBeVisible()

  // Uma vitrine por conta: ao voltar para o gratuito ela continua ativa e não há escolha a fazer.
  await expect(page.getByText('Escolha qual vitrine fica ativa')).toHaveCount(0)
  expect(await vitrineStatuses(user.id)).toEqual([`${vitrine.subdomain}:active`])
})

test('cadeado da aparência leva à tela do plano', async ({ page }) => {
  const user = await createConfirmedUser('cadeado')
  const vitrine = await seedVitrine(user.id)
  await signIn(page, user.email, user.password)

  await page.goto(`/painel/vitrines/${vitrine.id}/aparencia`)
  await expect(page.getByText('Recurso do plano Pro')).toBeVisible()
  await page.getByRole('link', { name: 'Ver o plano Pro' }).click()
  await expect(page).toHaveURL(/\/painel\/plano$/)
})

test('assinatura anual mostra a economia', async ({ page }) => {
  const user = await createConfirmedUser('plano-anual')
  await seedVitrine(user.id)
  await signIn(page, user.email, user.password)

  await page.goto('/painel/plano')
  await expect(page.getByText('Economize 17% em relação ao mensal.')).toBeVisible()

  // Mensal vem marcado; ao escolher o anual, o botão passa a assinar o anual.
  await page.getByRole('radio', { name: /Anual/ }).check()
  await page.getByRole('button', { name: ASSINAR_ANUAL }).click()
  await page.waitForURL(/\/painel\/plano\?assinatura=ok$/)
  await expect(page.getByRole('heading', { name: 'Plano Pro' })).toBeVisible()
})
