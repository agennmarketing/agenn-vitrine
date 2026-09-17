import { expect, test } from '@playwright/test'
import { createConfirmedUser, seedVitrine, signIn, uniqueSubdomain, vitrineStatuses } from './helpers'

// Os rótulos vêm do Intl (R$ + espaço não separável), por isso casamos por regex.
const ASSINAR_MENSAL = /Assinar por R\$.?149,90 por mês/
const ASSINAR_ANUAL = /Assinar por R\$.?1\.499,00 por ano/

test('assina o Pro, cancela pelo portal e escolhe a vitrine que fica ativa', async ({ page }) => {
  const user = await createConfirmedUser('plano')
  const primeira = await seedVitrine(user.id, { name: 'Loja Um', subdomain: uniqueSubdomain('pl-a') })
  await signIn(page, user.email, user.password)

  await page.goto('/painel/plano')
  await expect(page.getByRole('heading', { name: 'Plano Gratuito' })).toBeVisible()

  await page.getByRole('button', { name: ASSINAR_MENSAL }).click()
  await page.waitForURL(/\/painel\/plano\?assinatura=ok$/)
  await expect(page.getByText('Assinatura confirmada. Bom proveito!')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Plano Pro' })).toBeVisible()
  await expect(page.getByText('Renova em')).toBeVisible()

  // Com o Pro, a segunda vitrine passa na trava do banco.
  const segunda = await seedVitrine(user.id, { name: 'Loja Dois', subdomain: uniqueSubdomain('pl-b') })

  await page.getByRole('button', { name: 'Gerenciar assinatura' }).click()
  await page.waitForURL(/\/api\/dev-billing\/portal/)
  await page.getByRole('link', { name: 'Cancelar agora' }).click()
  await page.waitForURL(/\/painel\/plano$/)
  await expect(page.getByRole('heading', { name: 'Plano Gratuito' })).toBeVisible()

  await expect(page.getByText('Escolha qual vitrine fica ativa')).toBeVisible()
  expect(await vitrineStatuses(user.id)).toEqual([`${primeira.subdomain}:active`, `${segunda.subdomain}:frozen`])

  await page.getByRole('radio', { name: /Loja Dois/ }).check()
  await page.getByRole('button', { name: 'Salvar escolha' }).click()
  await expect(page.getByText('Vitrine ativa atualizada.')).toBeVisible()
  expect(await vitrineStatuses(user.id)).toEqual([`${primeira.subdomain}:frozen`, `${segunda.subdomain}:active`])
})

test('cadeado da aparência e limite de vitrines levam à tela do plano', async ({ page }) => {
  const user = await createConfirmedUser('cadeado')
  const vitrine = await seedVitrine(user.id)
  await signIn(page, user.email, user.password)

  await page.goto(`/painel/vitrines/${vitrine.id}/aparencia`)
  await expect(page.getByText('Recurso do plano Pro')).toBeVisible()
  await page.getByRole('link', { name: 'Ver o plano Pro' }).click()
  await expect(page).toHaveURL(/\/painel\/plano$/)

  await page.goto('/painel/vitrines/nova')
  await page.getByRole('link', { name: 'Ver o plano Pro' }).click()
  await expect(page).toHaveURL(/\/painel\/plano$/)
})

test('assinatura anual mostra a economia', async ({ page }) => {
  const user = await createConfirmedUser('plano-anual')
  await seedVitrine(user.id)
  await signIn(page, user.email, user.password)

  await page.goto('/painel/plano')
  await expect(page.getByText('Economize 17% em relação ao mensal.')).toBeVisible()

  await page.getByRole('button', { name: ASSINAR_ANUAL }).click()
  await page.waitForURL(/\/painel\/plano\?assinatura=ok$/)
  await expect(page.getByRole('heading', { name: 'Plano Pro' })).toBeVisible()
})
