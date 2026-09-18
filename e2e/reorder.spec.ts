import { expect, test, type Page } from '@playwright/test'
import { createAdminClient, createConfirmedUser, seedItem, seedVitrine, signIn } from './helpers'

// Ordem da lista do painel pelos links "Editar {nome}" de cada linha.
async function panelOrder(page: Page) {
  const labels = await page.locator('a[aria-label^="Editar "]').evaluateAll((links) =>
    links.map((link) => link.getAttribute('aria-label') ?? ''),
  )
  return labels.map((label) => label.replace(/^Editar /, ''))
}

test('reordena itens pelo teclado e a ordem continua depois de recarregar', async ({ page }) => {
  const user = await createConfirmedUser('reordenar')
  const vitrine = await seedVitrine(user.id)
  const admin = createAdminClient()
  for (const [position, name] of ['Primeiro', 'Segundo', 'Terceiro'].entries()) {
    const item = await seedItem(vitrine, user.id, { name })
    await admin.from('items').update({ position }).eq('id', item.id).throwOnError()
  }
  await signIn(page, user.email, user.password)

  await page.goto(`/painel/vitrines/${vitrine.id}/itens`)
  await expect.poll(() => panelOrder(page)).toEqual(['Primeiro', 'Segundo', 'Terceiro'])

  // Alça focada: Espaço pega, seta para baixo move uma posição, Espaço solta.
  const handle = page.getByRole('button', { name: 'Reordenar Primeiro', exact: true })
  await handle.focus()
  await page.keyboard.press('Space')
  // O dnd-kit anuncia "Pegou…" e logo em seguida o "movido para a posição 1", que o substitui
  // na região de anúncio; por isso a pegada é conferida pela alça pressionada.
  await expect(handle).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('ArrowDown')
  await expect(page.getByText(/Primeiro movido para a posição 2 de 3/)).toBeAttached()
  await page.keyboard.press('Space')
  await expect(page.getByText(/Primeiro solto na posição 2 de 3/)).toBeAttached()

  await expect(page.getByText('Ordem salva.')).toBeVisible()
  await expect.poll(() => panelOrder(page)).toEqual(['Segundo', 'Primeiro', 'Terceiro'])

  await page.reload()
  await expect.poll(() => panelOrder(page)).toEqual(['Segundo', 'Primeiro', 'Terceiro'])
})
