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

test('Agenda: abas por situação, remarcar, concluir, cancelar e bloquear horários', async ({ page }) => {
  const user = await createConfirmedUser('agenda')
  const vitrine = await seedVitrine(user.id, { type: 'servicos', name: 'Studio' })
  await openAgenda(vitrine.id)
  const item = await seedItem(vitrine, user.id, { name: 'Manicure', priceCents: 4000, durationMinutes: 60 })
  const tomorrow = tomorrowInSaoPaulo()
  const yesterday = new Date(Date.now() - 3 * 3_600_000 - 86_400_000).toISOString().slice(0, 10)
  const book = (code: string, time: string, name: string, date = tomorrow) =>
    createAdminClient()
      .rpc('book_appointment', {
        p_vitrine_id: vitrine.id,
        p_item_id: item.id,
        p_code: code,
        p_starts_at: new Date(`${date}T${time}:00-03:00`).toISOString(),
        p_customer_name: name,
        p_customer_phone: '+5511988887777',
        p_notes: name === 'Maria Silva' ? 'unha curta' : '',
        p_price_text: 'R$ 40,00',
      })
      .throwOnError()
  await book('AB23', '10:00', 'Maria Silva')
  await book('CD45', '14:00', 'João Souza')
  await book('EF67', '10:00', 'Ana Lima', yesterday)

  const agenda = `${vitrineUrl(vitrine.subdomain)}api/agenda?item=${item.id}`
  const times = async () => ((await (await page.request.get(`${agenda}&data=${tomorrow}`)).json()) as { times: string[] }).times
  expect(await times()).not.toContain('10:00')

  await signIn(page, user.email, user.password)
  await page.getByRole('navigation', { name: 'Principal' }).filter({ visible: true }).getByRole('link', { name: 'Agenda' }).click()
  await expect(page).toHaveURL(/\/painel\/agenda$/)

  // Hoje traz também o que ficou pendente de dias anteriores, para concluir.
  await expect(page.getByRole('region', { name: 'Ontem' }).getByText('Ana Lima')).toBeVisible()
  await page.getByRole('button', { name: 'Concluir atendimento de Ana Lima às 10:00' }).click()
  await expect(page.getByText('Atendimento concluído.')).toBeVisible()
  await expect(page.getByText('Nada marcado para hoje.')).toBeVisible()

  await page.getByRole('link', { name: /^Próximos/ }).click()
  const tomorrowSection = page.getByRole('region', { name: 'Amanhã' })
  await expect(tomorrowSection.getByText('Maria Silva')).toBeVisible()
  await expect(tomorrowSection.getByText('Manicure').first()).toBeVisible()
  await expect(tomorrowSection.getByText('Obs.: unha curta')).toBeVisible()
  // Horário que ainda não chegou não se conclui.
  await expect(page.getByRole('button', { name: /^Concluir atendimento/ })).toHaveCount(0)

  // Remarcar: o horário antigo volta a ficar livre e o novo sai da vitrine.
  await page.getByRole('button', { name: 'Remarcar agendamento de Maria Silva às 10:00' }).click()
  await page.getByLabel('Novo horário').fill('11:00')
  await page.getByRole('button', { name: 'Salvar novo horário' }).click()
  await expect(page.getByText('Agendamento remarcado.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Remarcar agendamento de Maria Silva às 11:00' })).toBeVisible()
  expect(await times()).toContain('10:00')
  expect(await times()).not.toContain('11:00')

  // Remarcar em cima de outro agendamento não passa.
  await page.getByRole('button', { name: 'Remarcar agendamento de Maria Silva às 11:00' }).click()
  await page.getByLabel('Novo horário').fill('14:30')
  await page.getByRole('button', { name: 'Salvar novo horário' }).click()
  await expect(page.getByText('Esse horário está ocupado ou bloqueado. Escolha outro.')).toBeVisible()
  await page.getByRole('button', { name: 'Voltar' }).click()

  await page.getByRole('button', { name: 'Cancelar agendamento de João Souza às 14:00' }).click()
  await page.getByRole('button', { name: 'Confirmar cancelamento' }).click()
  await expect(page.getByText('Agendamento cancelado. O horário voltou a ficar livre.')).toBeVisible()
  expect(await times()).toContain('14:00')

  expect((await appointmentsOf(vitrine.id)).map((row) => row.status)).toEqual(['completed', 'confirmed', 'cancelled'])

  await page.getByRole('link', { name: 'Concluídos' }).click()
  await expect(page.getByText('Ana Lima')).toBeVisible()
  await expect(page.getByRole('button', { name: /^Concluir|^Remarcar|^Cancelar/ })).toHaveCount(0)
  await page.getByRole('link', { name: 'Cancelados' }).click()
  await expect(page.getByText('João Souza')).toBeVisible()

  // Bloqueio de dia inteiro: amanhã some das datas da vitrine.
  await page.getByRole('link', { name: 'Configurar agenda' }).click()
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
