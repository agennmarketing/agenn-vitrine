import { expect, test } from '@playwright/test'
import { SITE_URL } from '../playwright.config'

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
