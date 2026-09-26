import { expect, test } from '@playwright/test'
import { APP_URL } from '../playwright.config'
import { createAdminClient, createConfirmedUser, seedItem, seedVitrine, setSubscription, uniqueSubdomain } from './helpers'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

async function seedComLogo(prefix: string) {
  const user = await createConfirmedUser(prefix)
  const vitrine = await seedVitrine(user.id, { subdomain: uniqueSubdomain(prefix), name: 'Studio da Ana', type: 'servicos' })
  await seedItem(vitrine, user.id, { name: 'Manicure', priceCents: 4500 })
  const admin = createAdminClient()
  const { data: logo } = await admin
    .from('media')
    .insert({
      owner_id: user.id,
      vitrine_id: vitrine.id,
      role: 'logo',
      kind: 'image',
      storage_paths: { '128': 'logo-128.webp', '512': 'logo-512.webp' },
      width: 512,
      height: 512,
    })
    .select('id')
    .single()
    .throwOnError()
  await admin.from('vitrines').update({ logo_media_id: logo.id, brand_color: '#e0457b' }).eq('id', vitrine.id).throwOnError()
  return { user, vitrine, base: `http://${vitrine.subdomain}.localhost:3000` }
}

test('a vitrine vira aplicativo com a logo do lojista', async ({ page, request }) => {
  const { base } = await seedComLogo('pwa')
  await page.goto(`${base}/`)

  // O ícone da aba é a logo da vitrine, e não mais o do Agenn.
  await expect(page.locator('link[rel="icon"]').first()).toHaveAttribute('href', /logo-128\.webp$/)
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', /logo-512\.webp$/)
  expect(await page.locator('link[rel="icon"][href*="favicon"]').count()).toBe(0)
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest')

  const response = await request.get(`${base}/manifest.webmanifest`)
  expect(response.headers()['content-type']).toContain('application/manifest+json')
  const manifest = await response.json()
  expect(manifest.name).toBe('Studio da Ana')
  expect(manifest.short_name).toBe('Studio')
  expect(manifest.start_url).toBe('/')
  expect(manifest.display).toBe('standalone')
  expect(manifest.theme_color).toBe('#e0457b')
  expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual(['128x128', '512x512'])

  // Sem o service worker o navegador não oferece instalar.
  expect((await request.get(`${base}/sw.js`)).status()).toBe(200)
  expect(await page.evaluate(async () => (await navigator.serviceWorker.ready).scope)).toBe(`${base}/`)
})

test('o painel tem o manifesto do aplicativo do profissional, aberto sem sessão', async ({ request }) => {
  // O navegador busca o manifesto sem mandar cookie: se caísse no login, ninguém instalaria.
  const response = await request.get(`${APP_URL}/pwa/manifest.webmanifest`)
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toContain('application/manifest+json')
  const manifest = await response.json()
  expect(manifest.name).toBe('Vitrimove')
  expect(manifest.start_url).toBe('/painel')
  expect(manifest.shortcuts.map((atalho: { url: string }) => atalho.url)).toEqual(['/painel', '/painel/agenda'])
  expect((await request.get(`${APP_URL}/sw.js`)).status()).toBe(200)
})

test('vitrine fora do ar não vira aplicativo', async ({ request }) => {
  // Cada conta tem uma vitrine só, então a congelada é de outro dono.
  const outro = await createConfirmedUser('pwa-congelada')
  await setSubscription(outro.id, { status: 'active' })
  const congelada = await seedVitrine(outro.id, { subdomain: uniqueSubdomain('pwa-frozen') })
  await createAdminClient().from('vitrines').update({ status: 'frozen' }).eq('id', congelada.id).throwOnError()
  const response = await request.get(`http://${congelada.subdomain}.localhost:3000/manifest.webmanifest`)
  expect(response.status()).toBe(404)
})

test.describe('no iPhone', () => {
  test.use({ userAgent: IPHONE })

  test('a vitrine ensina o caminho da tela de compartilhar', async ({ page }) => {
    const { base } = await seedComLogo('pwa-ios')
    await page.goto(`${base}/`)
    await page.getByRole('button', { name: 'Instalar aplicativo' }).click()
    await expect(page.getByText('Adicionar à Tela de Início')).toBeVisible()
  })
})
