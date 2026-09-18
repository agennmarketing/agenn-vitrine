import { expect, test } from '@playwright/test'
import { createConfirmedUser, seedVitrine, signIn, uniqueSubdomain } from './helpers'

test('QR Code da vitrine abre, mostra o endereço e pode ser baixado', async ({ page }) => {
  const user = await createConfirmedUser('qr')
  const vitrine = await seedVitrine(user.id, { name: 'Loja do QR', subdomain: uniqueSubdomain('qr') })
  await signIn(page, user.email, user.password)

  await page.getByRole('button', { name: 'QR Code' }).click()
  const dialog = page.getByRole('dialog', { name: 'QR Code de Loja do QR' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText(`${vitrine.subdomain}.localhost:3000`)).toBeVisible()

  const canvasElement = dialog.getByRole('img', { name: 'QR Code' })
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
  await dialog.getByRole('button', { name: 'Baixar PNG' }).click()
  expect((await download).suggestedFilename()).toBe(`qrcode-${vitrine.subdomain}.png`)

  await dialog.getByRole('button', { name: 'Fechar' }).click()
  await expect(dialog).toBeHidden()
})

test('QR Code do diálogo fecha com Escape', async ({ page }) => {
  const user = await createConfirmedUser('qr-escape')
  await seedVitrine(user.id, { name: 'Loja do Escape', subdomain: uniqueSubdomain('qr-escape') })
  await signIn(page, user.email, user.password)

  await page.getByRole('button', { name: 'QR Code' }).click()
  const dialog = page.getByRole('dialog', { name: 'QR Code de Loja do Escape' })
  await expect(dialog).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})
