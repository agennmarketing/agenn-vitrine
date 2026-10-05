import { expect, test } from '@playwright/test'
import { createAdminClient, createConfirmedUser, seedVitrine, uniqueSubdomain } from './helpers'

test('o link da vitrine tem prévia com o card do negócio', async ({ page, request }) => {
  const user = await createConfirmedUser('og')
  const vitrine = await seedVitrine(user.id, { subdomain: uniqueSubdomain('og'), name: 'Studio Prévia' })
  await createAdminClient()
    .from('vitrines')
    .update({ description: 'Unhas em gel e manicure', brand_color: '#ffd84d' })
    .eq('id', vitrine.id)
    .throwOnError()
  const base = `http://${vitrine.subdomain}.localhost:3000`

  await page.goto(`${base}/`)
  const og = (property: string) => page.locator(`meta[property="${property}"]`).getAttribute('content')
  expect(await og('og:title')).toBe('Studio Prévia')
  expect(await og('og:image:width')).toBe('1200')
  expect(await og('og:image:height')).toBe('630')
  const imageUrl = await og('og:image')
  expect(imageUrl).toMatch(new RegExp(`^${base}/og\\?v=[0-9a-z]+$`))

  const image = await request.get(imageUrl!)
  expect(image.status()).toBe(200)
  expect(image.headers()['content-type']).toBe('image/png')
  const png = await image.body()
  // Largura e altura ficam no cabeçalho IHDR do PNG; o WhatsApp descarta imagem pesada.
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630])
  expect(png.length).toBeLessThan(300_000)

  expect((await request.get(`http://${uniqueSubdomain('og-nada')}.localhost:3000/og`)).status()).toBe(404)
})
