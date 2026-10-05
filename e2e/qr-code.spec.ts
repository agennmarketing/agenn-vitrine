import { expect, test } from '@playwright/test'
import { createConfirmedUser, seedVitrine, signIn, uniqueSubdomain } from './helpers'

test('Compartilhar mostra o link e o QR Code, que pode ser baixado', async ({ page }) => {
  const user = await createConfirmedUser('qr')
  const vitrine = await seedVitrine(user.id, { name: 'Loja do QR', subdomain: uniqueSubdomain('qr') })
  await signIn(page, user.email, user.password)

  await page.getByRole('navigation', { name: 'Seções da vitrine' }).getByRole('link', { name: 'Compartilhar' }).click()
  await expect(page).toHaveURL(new RegExp(`/painel/vitrines/${vitrine.id}/compartilhar$`))
  await expect(page.getByLabel('Link da vitrine')).toHaveValue(`${vitrine.subdomain}.localhost:3000`)
  await expect(page.getByRole('button', { name: 'Copiar link' })).toBeVisible()

  // O QR precisa ter sido desenhado (SVG com os módulos), não só o espaço reservado.
  const qr = page.getByRole('img', { name: 'QR Code' })
  await expect(qr).toBeVisible()
  await expect(qr.locator('svg path').first()).toBeAttached({ timeout: 10000 })

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Baixar PNG' }).click()
  expect((await download).suggestedFilename()).toBe(`qrcode-${vitrine.subdomain}.png`)
})
