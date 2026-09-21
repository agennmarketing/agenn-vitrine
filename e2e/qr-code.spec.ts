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

  const canvasElement = page.getByRole('img', { name: 'QR Code' })
  await expect(canvasElement).toBeVisible()

  // O canvas precisa ter conteúdo, não só existir. Esperamos até que tenha sido renderizado.
  await expect.poll(
    async () => {
      const pixels = await canvasElement.evaluate((element) => {
        const canvas = element as HTMLCanvasElement
        const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data
        return new Set(data).size
      })
      return pixels
    },
    { timeout: 10000 }
  ).toBeGreaterThan(1)

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Baixar PNG' }).click()
  expect((await download).suggestedFilename()).toBe(`qrcode-${vitrine.subdomain}.png`)
})
