import { expect, test, type Page } from '@playwright/test'
import {
  appointmentsOf,
  createAdminClient,
  createConfirmedUser,
  itemStep,
  openAgenda,
  seedItem,
  seedProfessional,
  seedVitrine,
  signIn,
  tomorrowInSaoPaulo,
  uniqueSubdomain,
} from './helpers'

const vitrineUrl = (subdomain: string) => `http://${subdomain}.localhost:3000/`

async function captureWhatsApp(page: Page) {
  await page.route('https://wa.me/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: 'ok' }))
  return page.waitForRequest(/^https:\/\/wa\.me\//)
}

// O real formatado traz espaço fixo antes do valor; aqui comparamos com espaço comum.
function messageText(url: URL) {
  return url.searchParams.get('text')!.replaceAll('\u00a0', ' ')
}

test('endereço passa de 404 para a vitrine assim que ela é criada no painel', async ({ page }) => {
  const subdomain = uniqueSubdomain('nasce')
  const before = await page.goto(vitrineUrl(subdomain))
  expect(before?.status()).toBe(404)

  const user = await createConfirmedUser('nasce')
  await signIn(page, user.email, user.password)
  await page.goto('/painel/vitrines/nova')
  await page.getByLabel('Serviços e Agendamentos').check()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByLabel('Barbearia').check()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByLabel('Nome do negócio').fill('Barbearia Nova')
  await page.getByLabel('Endereço da vitrine').fill(subdomain)
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByLabel('WhatsApp', { exact: true }).fill('(11) 98765-4321')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByRole('button', { name: 'Criar vitrine' }).click()
  await expect(page).toHaveURL(/\/itens(\?criada=1)?$/)

  const after = await page.goto(vitrineUrl(subdomain))
  expect(after?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1, name: 'Barbearia Nova' })).toBeVisible()
})

test('catálogo, tela do item com variação e mensagem com código de pedido', async ({ page }) => {
  const user = await createConfirmedUser('publica')
  const vitrine = await seedVitrine(user.id, { name: 'Loja da Ana', phone: '+5511912345678', cartEnabled: false })
  const simple = await seedItem(vitrine, user.id, { name: 'Caneca', priceCents: 2590 })
  const withVariations = await seedItem(vitrine, user.id, {
    name: 'Camiseta',
    variations: [
      { name: 'P', priceCents: 3990 },
      { name: 'G', priceCents: 4490 },
    ],
  })

  await page.goto(vitrineUrl(vitrine.subdomain))
  await expect(page.getByRole('heading', { level: 1, name: 'Loja da Ana' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Destaques' })).toBeVisible()
  await expect(page.getByText('R$ 25,90')).toBeVisible()
  await expect(page.getByText('A partir de R$ 39,90')).toBeVisible()
  await expect(page.getByText('Feito com Vitrimove')).toHaveCount(0)

  await page.getByRole('button', { name: 'Camiseta' }).click()
  await expect(page).toHaveURL(new RegExp(`\\?item=${withVariations.code}$`))
  const dialog = page.getByRole('dialog', { name: 'Camiseta' })
  await dialog.getByRole('button', { name: 'Adicionar à sacola' }).click()
  await expect(dialog.getByText('Escolha uma opção.')).toBeVisible()

  await dialog.getByLabel(/^G/).check()
  const whatsapp = captureWhatsApp(page)
  await dialog.getByRole('button', { name: 'Adicionar à sacola' }).click()
  const url = new URL((await whatsapp).url())
  expect(url.pathname).toBe('/5511912345678')
  const text = messageText(url)
  expect(text).toMatch(
    new RegExp(`^Olá! Vim da vitrine \\*Loja da Ana\\* e tenho interesse em: \\*Camiseta – G\\* \\(cód\\. ${withVariations.code}\\)\\. Pedido #[23456789A-HJ-NP-Z]{4}$`),
  )

  const orderCode = text.slice(-4)
  const { data: snapshot } = await createAdminClient()
    .from('order_snapshots')
    .select('payload')
    .eq('owner_id', user.id)
    .eq('code', orderCode)
    .single()
    .throwOnError()
  expect(snapshot.payload.items[0]).toMatchObject({ code: withVariations.code, variation: { name: 'G' }, unit_price_cents: 4490 })
  expect(simple.code).toBeTruthy()
})

test('link com ?item= abre a tela e falha na API ainda envia sem código', async ({ page }) => {
  const user = await createConfirmedUser('deeplink')
  const vitrine = await seedVitrine(user.id, { name: 'Loja', cartEnabled: false })
  const item = await seedItem(vitrine, user.id, { name: 'Caneca', priceCents: 4000 })

  await page.route('**/api/orders', (route) => route.abort())
  await page.goto(`${vitrineUrl(vitrine.subdomain)}?item=${item.code}`)
  const dialog = page.getByRole('dialog', { name: 'Caneca' })
  await expect(dialog).toBeVisible()

  const whatsapp = captureWhatsApp(page)
  await dialog.getByRole('button', { name: 'Adicionar à sacola' }).click()
  const text = messageText(new URL((await whatsapp).url()))
  expect(text).toBe(`Olá! Vim da vitrine *Loja* e tenho interesse em: *Caneca* (cód. ${item.code}).`)
})

test('serviço: agenda data e horário livres, confirma e o horário some para o próximo cliente', async ({ page }) => {
  const user = await createConfirmedUser('agendar')
  const vitrine = await seedVitrine(user.id, { type: 'servicos', name: 'Studio', phone: '+5511912345678' })
  await openAgenda(vitrine.id, { booking_buffer_minutes: 15 })
  const item = await seedItem(vitrine, user.id, {
    name: 'Corte de cabelo',
    priceType: 'from',
    priceCents: 5000,
    durationMinutes: 45,
    notice: 'Chegue 10 minutos antes.',
  })
  const tomorrow = tomorrowInSaoPaulo()

  await page.goto(vitrineUrl(vitrine.subdomain))
  await page.getByRole('button', { name: 'Corte de cabelo' }).click()
  const dialog = page.getByRole('dialog', { name: 'Corte de cabelo' })
  // Não há sacola em serviços: o botão principal agenda.
  await expect(page.getByRole('button', { name: 'Abrir sacola' })).toHaveCount(0)
  await expect(dialog.getByText('Chegue 10 minutos antes.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Agendar horário' }).click()

  // Só datas com horário livre; depois da data, só os horários livres dela.
  const dates = dialog.getByRole('group', { name: 'Escolha a data' }).getByRole('radio')
  await expect(dates.first()).toBeVisible()
  await dialog.locator(`input[value="${tomorrow}"]`).check()
  const times = dialog.getByRole('group', { name: 'Escolha o horário' }).getByRole('radio')
  await expect(times.first()).toHaveAccessibleName('08:00')
  await expect(times.last()).toHaveAccessibleName('19:00')
  await dialog.getByRole('radio', { name: '10:00', exact: true }).check()
  await dialog.getByRole('button', { name: 'Continuar' }).click()

  await dialog.getByRole('button', { name: 'Confirmar agendamento' }).click()
  await expect(dialog.getByText('Informe seu nome.')).toBeVisible()
  await expect(dialog.getByText('Informe seu WhatsApp.')).toBeVisible()
  await dialog.getByLabel('Nome', { exact: true }).fill('Maria Silva')
  await dialog.getByLabel('WhatsApp', { exact: true }).fill('(11) 98888-7777')
  await dialog.getByLabel('Observação').fill('bem curto')
  await dialog.getByRole('button', { name: 'Confirmar agendamento' }).click()

  await expect(dialog.getByText('Horário agendado!')).toBeVisible()
  const [appointment] = await appointmentsOf(vitrine.id)
  expect(appointment).toMatchObject({
    status: 'confirmed',
    customer_name: 'Maria Silva',
    customer_phone: '+5511988887777',
    notes: 'bem curto',
    service_name: 'Corte de cabelo',
  })
  expect(new Date(appointment.starts_at).toISOString()).toBe(new Date(`${tomorrow}T10:00:00-03:00`).toISOString())
  // 45 min de serviço + 15 de intervalo.
  expect(new Date(appointment.blocked_until).toISOString()).toBe(new Date(`${tomorrow}T11:00:00-03:00`).toISOString())
  await expect(dialog.getByText(`#${appointment.code}`)).toBeVisible()

  const href = await dialog.getByRole('link', { name: 'Avisar no WhatsApp' }).getAttribute('href')
  const url = new URL(href!)
  expect(url.pathname).toBe('/5511912345678')
  const message = messageText(url)
  expect(message).toContain('*Corte de cabelo*\nData: ')
  expect(message).toContain(`às 10:00\nValor: A partir de R$ 50,00\nNome: Maria Silva\nAgendamento #${appointment.code}\n\nObs: bem curto`)

  // A agenda pública não mostra quem marcou: só os horários que continuam livres.
  const base = `${vitrineUrl(vitrine.subdomain)}api/agenda?item=${item.id}`
  const free = (await (await page.request.get(`${base}&data=${tomorrow}`)).json()) as { times: string[] }
  expect(Object.keys(free)).toEqual(['times'])
  expect(free.times).not.toContain('09:30')
  expect(free.times).not.toContain('10:00')
  expect(free.times).not.toContain('10:30')
  expect(free.times).toContain('09:00')
  expect(free.times).toContain('11:00')

  // Dupla reserva: o mesmo horário é recusado.
  const again = await page.request.post(`${vitrineUrl(vitrine.subdomain)}api/agendamentos`, {
    data: { itemId: item.id, date: tomorrow, time: '10:00', name: 'Outra', whatsapp: '11977776666', notes: '' },
  })
  expect(again.status()).toBe(409)
  expect(await appointmentsOf(vitrine.id)).toHaveLength(1)
})

test('serviço: horário tomado por outro cliente volta para a escolha com a lista atualizada', async ({ page }) => {
  const user = await createConfirmedUser('agendar-corrida')
  const vitrine = await seedVitrine(user.id, { type: 'servicos', name: 'Studio' })
  await openAgenda(vitrine.id)
  const item = await seedItem(vitrine, user.id, { name: 'Manicure', priceCents: 4000, durationMinutes: 60 })
  const tomorrow = tomorrowInSaoPaulo()

  await page.goto(`${vitrineUrl(vitrine.subdomain)}?item=${item.code}`)
  const dialog = page.getByRole('dialog', { name: 'Manicure' })
  await dialog.getByRole('button', { name: 'Agendar horário' }).click()
  await dialog.locator(`input[value="${tomorrow}"]`).check()
  await dialog.getByRole('radio', { name: '14:00', exact: true }).check()
  await dialog.getByRole('button', { name: 'Continuar' }).click()
  await dialog.getByLabel('Nome', { exact: true }).fill('Ana')
  await dialog.getByLabel('WhatsApp', { exact: true }).fill('11912345670')

  // Outro cliente confirma o mesmo horário antes.
  const first = await page.request.post(`${vitrineUrl(vitrine.subdomain)}api/agendamentos`, {
    data: { itemId: item.id, date: tomorrow, time: '14:00', name: 'Bia', whatsapp: '11912345671', notes: '' },
  })
  expect(first.status()).toBe(201)

  await dialog.getByRole('button', { name: 'Confirmar agendamento' }).click()
  await expect(dialog.getByText('Esse horário acabou de ser reservado. Escolha outro.')).toBeVisible()
  await expect(dialog.getByRole('radio', { name: '13:30', exact: true })).toHaveCount(0)
  await expect(dialog.getByRole('radio', { name: '14:00', exact: true })).toHaveCount(0)
  await expect(dialog.getByRole('radio', { name: '15:00', exact: true })).toBeVisible()
})

test('alteração no painel aparece na vitrine pública', async ({ page }) => {
  const user = await createConfirmedUser('revalida')
  const vitrine = await seedVitrine(user.id)
  const item = await seedItem(vitrine, user.id, { name: 'Nome Antigo', priceCents: 1000 })

  await page.goto(vitrineUrl(vitrine.subdomain))
  await expect(page.getByText('Nome Antigo')).toBeVisible()

  await signIn(page, user.email, user.password)
  await page.goto(`/painel/vitrines/${vitrine.id}/itens/${item.id}`)
  await itemStep(page, 'Detalhes')
  await page.getByLabel('Nome', { exact: true }).fill('Nome Novo')
  await page.getByRole('button', { name: 'Salvar item' }).click()
  await expect(page.getByText('Item salvo.')).toBeVisible()

  await page.goto(vitrineUrl(vitrine.subdomain))
  await expect(page.getByText('Nome Novo')).toBeVisible()
})

test('serviço com profissionais: escolher o horário e depois quem atende, sem dupla reserva', async ({ page }) => {
  const user = await createConfirmedUser('profissionais')
  const vitrine = await seedVitrine(user.id, { type: 'servicos', name: 'Studio Duo', phone: '+5511912345678' })
  await openAgenda(vitrine.id)
  const corte = await seedItem(vitrine, user.id, { name: 'Corte', priceCents: 5000, durationMinutes: 60 })
  const unha = await seedItem(vitrine, user.id, { name: 'Unha', priceCents: 4000, durationMinutes: 60 })
  await seedProfessional(vitrine.id, user.id, { name: 'Ana Souza', itemIds: [corte.id, unha.id] })
  await seedProfessional(vitrine.id, user.id, { name: 'Bia Lima', itemIds: [corte.id] })
  const tomorrow = tomorrowInSaoPaulo()

  // Caminho 1: serviço → data → horário → profissional.
  await page.goto(vitrineUrl(vitrine.subdomain))
  await page.getByRole('button', { name: 'Corte', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Corte' })
  await dialog.getByRole('button', { name: 'Agendar horário' }).click()
  await dialog.locator(`input[value="${tomorrow}"]`).check()
  await dialog.getByRole('radio', { name: '10:00', exact: true }).check()
  await dialog.getByRole('button', { name: 'Continuar' }).click()

  // As duas atendem esse horário; o cliente escolhe.
  await expect(dialog.getByRole('radio', { name: 'Ana Souza' })).toBeVisible()
  await dialog.getByRole('radio', { name: 'Bia Lima' }).check()
  await dialog.getByRole('button', { name: 'Continuar' }).click()
  await dialog.getByLabel('Nome', { exact: true }).fill('Carla')
  await dialog.getByLabel('WhatsApp', { exact: true }).fill('(11) 98888-7777')
  await dialog.getByRole('button', { name: 'Confirmar agendamento' }).click()
  await expect(dialog.getByText('Horário agendado!')).toBeVisible()
  await expect(dialog.getByText('Bia Lima')).toBeVisible()

  const [primeiro] = await appointmentsOf(vitrine.id)
  expect(primeiro).toMatchObject({ status: 'confirmed', service_name: 'Corte', professional_name: 'Bia Lima' })

  // Mesmo horário continua livre: sobrou a Ana.
  await page.goto(vitrineUrl(vitrine.subdomain))
  await page.getByRole('button', { name: 'Corte', exact: true }).click()
  await dialog.getByRole('button', { name: 'Agendar horário' }).click()
  await dialog.locator(`input[value="${tomorrow}"]`).check()
  await dialog.getByRole('radio', { name: '10:00', exact: true }).check()
  await dialog.getByRole('button', { name: 'Continuar' }).click()
  await expect(dialog.getByRole('radio', { name: 'Ana Souza' })).toBeVisible()
  await expect(dialog.getByRole('radio', { name: 'Bia Lima' })).toHaveCount(0)

  // Caminho 2: profissional → serviço → data → horário. A Bia só faz Corte.
  await page.goto(vitrineUrl(vitrine.subdomain))
  await page.getByRole('button', { name: 'Bia Lima' }).click()
  const escolha = page.getByRole('dialog', { name: 'Bia Lima' })
  await expect(escolha.getByRole('button', { name: /Unha/ })).toHaveCount(0)
  await escolha.getByRole('button', { name: /Corte/ }).click()
  await dialog.locator(`input[value="${tomorrow}"]`).check()
  // O horário que ela já tem marcado não aparece na agenda dela.
  await expect(dialog.getByRole('radio', { name: '10:00', exact: true })).toHaveCount(0)
  await dialog.getByRole('radio', { name: '11:00', exact: true }).check()
  await dialog.getByRole('button', { name: 'Continuar' }).click()
  await dialog.getByLabel('Nome', { exact: true }).fill('Duda')
  await dialog.getByLabel('WhatsApp', { exact: true }).fill('(11) 97777-6666')
  await dialog.getByRole('button', { name: 'Confirmar agendamento' }).click()
  await expect(dialog.getByText('Horário agendado!')).toBeVisible()

  const agendamentos = await appointmentsOf(vitrine.id)
  expect(agendamentos.map((a) => a.professional_name)).toEqual(['Bia Lima', 'Bia Lima'])
})
