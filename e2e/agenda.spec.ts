import { expect, test } from '@playwright/test'
import {
  appointmentsOf,
  createAdminClient,
  createConfirmedUser,
  openAgenda,
  seedItem,
  seedVitrine,
  signIn,
  tomorrowInSaoPaulo,
} from './helpers'

const vitrineUrl = (subdomain: string) => `http://${subdomain}.localhost:3000/`

test('Agenda: agendamento aparece, cancelar libera o horário e bloqueio tira a data da vitrine', async ({ page }) => {
  const user = await createConfirmedUser('agenda')
  const vitrine = await seedVitrine(user.id, { type: 'servicos', name: 'Studio' })
  await openAgenda(vitrine.id)
  const item = await seedItem(vitrine, user.id, { name: 'Manicure', priceCents: 4000, durationMinutes: 60 })
  const tomorrow = tomorrowInSaoPaulo()

  await createAdminClient()
    .rpc('book_appointment', {
      p_vitrine_id: vitrine.id,
      p_item_id: item.id,
      p_code: 'AB23',
      p_starts_at: new Date(`${tomorrow}T10:00:00-03:00`).toISOString(),
      p_customer_name: 'Maria Silva',
      p_customer_phone: '+5511988887777',
      p_notes: 'unha curta',
      p_price_text: 'R$ 40,00',
    })
    .throwOnError()

  const agenda = `${vitrineUrl(vitrine.subdomain)}api/agenda?item=${item.id}`
  const before = (await (await page.request.get(`${agenda}&data=${tomorrow}`)).json()) as { times: string[] }
  expect(before.times).not.toContain('10:00')

  await signIn(page, user.email, user.password)
  await page.goto(`/painel/vitrines/${vitrine.id}/agenda`)
  const tomorrowSection = page.getByRole('region', { name: 'Amanhã' })
  await expect(tomorrowSection.getByText('Maria Silva')).toBeVisible()
  await expect(tomorrowSection.getByText('Manicure')).toBeVisible()
  await expect(tomorrowSection.getByText('Obs.: unha curta')).toBeVisible()

  await page.getByRole('button', { name: 'Cancelar agendamento de Maria Silva às 10:00' }).click()
  await page.getByRole('button', { name: 'Confirmar cancelamento' }).click()
  await expect(page.getByText('Agendamento cancelado. O horário voltou a ficar livre.')).toBeVisible()
  await expect(page.getByText('Nenhum agendamento por enquanto.', { exact: false })).toBeVisible()
  expect((await appointmentsOf(vitrine.id))[0].status).toBe('cancelled')

  const after = (await (await page.request.get(`${agenda}&data=${tomorrow}`)).json()) as { times: string[] }
  expect(after.times).toContain('10:00')

  // Bloqueio de dia inteiro: amanhã some das datas da vitrine.
  await page.getByLabel('Data', { exact: true }).fill(tomorrow)
  await page.getByLabel('Motivo (opcional)').fill('Feriado')
  await page.getByRole('button', { name: 'Adicionar bloqueio' }).click()
  await expect(page.getByText('Bloqueio adicionado.')).toBeVisible()
  await expect(page.getByRole('button', { name: /^Remover bloqueio de / })).toHaveCount(1)
  await expect(page.getByText('Feriado', { exact: true })).toBeVisible()
  const dates = (await (await page.request.get(agenda)).json()) as { dates: string[] }
  expect(dates.dates).not.toContain(tomorrow)

  // Regras: intervalo de 15 min fica salvo.
  await page.getByLabel('Intervalo entre atendimentos').selectOption('15')
  await page.getByRole('button', { name: 'Salvar regras da agenda' }).click()
  await expect(page.getByText('Regras da agenda salvas.')).toBeVisible()
  const { data } = await createAdminClient()
    .from('vitrines')
    .select('booking_buffer_minutes')
    .eq('id', vitrine.id)
    .single()
    .throwOnError()
  expect(data.booking_buffer_minutes).toBe(15)
})
