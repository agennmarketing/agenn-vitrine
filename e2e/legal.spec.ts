import { expect, test } from '@playwright/test'
import { APP_URL, SITE_URL } from '../playwright.config'

test('termos e privacidade estão publicados e ligados ao cadastro', async ({ page }) => {
  await page.goto(`${SITE_URL}/termos`)
  await expect(page.getByRole('heading', { level: 1, name: 'Termos de uso' })).toBeVisible()
  await expect(page.getByText('Última atualização:').first()).toBeVisible()
  await expect(page.getByText('renovação automática').first()).toBeVisible()

  await page.goto(`${SITE_URL}/privacidade`)
  await expect(page.getByRole('heading', { level: 1, name: 'Política de privacidade' })).toBeVisible()
  await expect(page.getByText('LGPD').first()).toBeVisible()

  await page.goto(`${SITE_URL}/`)
  await page.getByRole('link', { name: 'Termos de uso' }).click()
  await expect(page).toHaveURL(/\/termos$/)

  await page.goto('/cadastro')
  await expect(page.getByRole('link', { name: 'Termos de uso' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Política de privacidade' })).toBeVisible()
})

test('termos e privacidade também abrem no host do painel, sem sessão, e o cadastro liga para lá', async ({
  page,
}) => {
  // O apex (agenn.com.br) não é servido pela nossa aplicação em produção: as páginas
  // legais também precisam responder no host do painel (app.agenn.com.br), sem exigir login.
  await page.goto(`${APP_URL}/termos`)
  await expect(page).toHaveURL(`${APP_URL}/termos`)
  await expect(page.getByRole('heading', { level: 1, name: 'Termos de uso' })).toBeVisible()

  await page.goto(`${APP_URL}/privacidade`)
  await expect(page).toHaveURL(`${APP_URL}/privacidade`)
  await expect(page.getByRole('heading', { level: 1, name: 'Política de privacidade' })).toBeVisible()

  await page.goto('/cadastro')
  const termosLink = page.getByRole('link', { name: 'Termos de uso' })
  const privacidadeLink = page.getByRole('link', { name: 'Política de privacidade' })
  await expect(termosLink).toHaveAttribute('href', '/termos')
  await expect(privacidadeLink).toHaveAttribute('href', '/privacidade')

  const [popup] = await Promise.all([page.context().waitForEvent('page'), termosLink.click()])
  await popup.waitForLoadState()
  await expect(popup).toHaveURL(`${APP_URL}/termos`)
})
