import { expect, test } from '@playwright/test'
import { APP_URL, SITE_URL } from '../playwright.config'
import { createAdminClient, createConfirmedUser, seedItem, seedVitrine, setSubscription, uniqueSubdomain } from './helpers'

test('cada host tem seu robots.txt e a vitrine tem sitemap', async ({ request }) => {
  const user = await createConfirmedUser('robots')
  const vitrine = await seedVitrine(user.id, { subdomain: uniqueSubdomain('rb') })
  const item = await seedItem(vitrine, user.id, { name: 'Camiseta', priceCents: 4990 })
  const base = `http://${vitrine.subdomain}.localhost:3000`

  const painel = await request.get(`${APP_URL}/robots.txt`)
  expect(painel.status()).toBe(200)
  expect(await painel.text()).toContain('Disallow: /')

  const site = await request.get(`${SITE_URL}/robots.txt`)
  expect(await site.text()).toContain('Allow: /')
  expect(await (await request.get(`${SITE_URL}/sitemap.xml`)).text()).toContain('/termos')

  const robots = await request.get(`${base}/robots.txt`)
  expect(robots.status()).toBe(200)
  expect(await robots.text()).toContain(`Sitemap: ${base}/sitemap.xml`)

  const sitemap = await request.get(`${base}/sitemap.xml`)
  expect(sitemap.headers()['content-type']).toContain('application/xml')
  const xml = await sitemap.text()
  expect(xml).toContain(`<loc>${base}/</loc>`)
  expect(xml).toContain(`?item=${item.code}`)

  // Congelada some dos buscadores. Uma vitrine nova, já congelada, nunca foi gerada
  // antes: o primeiro acesso já mostra o estado certo, sem depender de revalidação.
  // Cada conta tem uma vitrine só, então a congelada é de outro dono.
  const outro = await createConfirmedUser('robots-congelada')
  await setSubscription(outro.id, { status: 'active' })
  const congelada = await seedVitrine(outro.id, { subdomain: uniqueSubdomain('rb-frozen') })
  await createAdminClient().from('vitrines').update({ status: 'frozen' }).eq('id', congelada.id).throwOnError()
  const baseCongelada = `http://${congelada.subdomain}.localhost:3000`
  expect(await (await request.get(`${baseCongelada}/robots.txt`)).text()).toContain('Disallow: /')
  expect((await request.get(`${baseCongelada}/sitemap.xml`)).status()).toBe(404)
})
