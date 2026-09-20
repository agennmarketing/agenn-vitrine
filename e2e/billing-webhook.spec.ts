import { expect, test } from '@playwright/test'
import { APP_URL } from '../playwright.config'
import {
  createConfirmedUser,
  fakeSubscription,
  readSubscription,
  seedVitrine,
  sendStripeEvent,
  setSubscription,
  setVitrineStatus,
  uniqueSubdomain,
  vitrineStatuses,
} from './helpers'

test('webhook recusa assinatura inválida e ignora evento fora da lista', async ({ request }) => {
  const semAssinatura = await request.post(`${APP_URL}/api/webhooks/stripe`, {
    data: JSON.stringify({ id: 'evt_1', type: 'invoice.paid', data: { object: {} } }),
    headers: { 'content-type': 'application/json' },
  })
  expect(semAssinatura.status()).toBe(401)

  const outroTipo = await sendStripeEvent(request, 'customer.created', { id: 'cus_fake_x', object: 'customer' })
  expect(outroTipo.status()).toBe(200)
  expect(await outroTipo.json()).toEqual({ ignored: true })
})

test('checkout completo deixa a conta Pro e descongela a vitrine', async ({ request }) => {
  const user = await createConfirmedUser('webhook-pro')
  const customerId = `cus_fake_${crypto.randomUUID()}`
  await setSubscription(user.id, { status: 'none', planId: 'free', customerId })

  const vitrine = await seedVitrine(user.id, { subdomain: uniqueSubdomain('wh-a') })
  // Como se a vitrine tivesse sido congelada antes: o checkout precisa devolvê-la ao ar.
  await setVitrineStatus(vitrine.id, 'frozen')

  const subscriptionId = await fakeSubscription({ customerId, userId: user.id })
  const response = await sendStripeEvent(request, 'checkout.session.completed', {
    id: 'cs_fake_um',
    object: 'checkout.session',
    customer: customerId,
    subscription: subscriptionId,
  })
  expect(response.status()).toBe(200)
  expect((await response.json()).status).toBe('active')

  const row = await readSubscription(user.id)
  expect([row?.status, row?.plan_id, row?.interval]).toEqual(['active', 'pro', 'month'])
  expect(await vitrineStatuses(user.id)).toEqual([`${vitrine.subdomain}:active`])
  await expect
    .poll(async () => (await request.get(`http://${vitrine.subdomain}.localhost:3000/`)).text())
    .not.toContain('Vitrine indisponível no momento')
})

test('evento repetido não é processado duas vezes', async ({ request }) => {
  const user = await createConfirmedUser('webhook-repetido')
  const customerId = `cus_fake_${crypto.randomUUID()}`
  await setSubscription(user.id, { status: 'none', planId: 'free', customerId })
  const subscriptionId = await fakeSubscription({ customerId, userId: user.id })

  const eventId = `evt_fake_${crypto.randomUUID()}`
  const object = { id: 'sub_evento', object: 'subscription', customer: customerId, subscription: subscriptionId }
  const primeira = await sendStripeEvent(request, 'checkout.session.completed', object, eventId)
  expect((await primeira.json()).status).toBe('active')

  const repetida = await sendStripeEvent(request, 'checkout.session.completed', object, eventId)
  expect(await repetida.json()).toEqual({ duplicated: true })
})

test('falha de pagamento dá carência de 7 dias e o cancelamento encerra o Pro', async ({ request }) => {
  const user = await createConfirmedUser('webhook-carencia')
  const customerId = `cus_fake_${crypto.randomUUID()}`
  await setSubscription(user.id, { status: 'active', customerId })
  const vitrine = await seedVitrine(user.id, { subdomain: uniqueSubdomain('wh-c') })

  const pastDue = await fakeSubscription({ customerId, userId: user.id, status: 'past_due' })
  await sendStripeEvent(request, 'invoice.payment_failed', {
    id: 'in_fake_1',
    object: 'invoice',
    customer: customerId,
    parent: { type: 'subscription_details', subscription_details: { subscription: pastDue } },
  })
  const emCarencia = await readSubscription(user.id)
  expect(emCarencia?.status).toBe('past_due')
  expect(new Date(emCarencia!.grace_until!).getTime()).toBeGreaterThan(Date.now() + 6 * 86_400_000)
  // Ainda é Pro: a vitrine continua no ar.
  expect((await request.get(`http://${vitrine.subdomain}.localhost:3000/`)).status()).toBe(200)

  const cancelada = await fakeSubscription({ customerId, userId: user.id, status: 'canceled' })
  await sendStripeEvent(request, 'customer.subscription.deleted', {
    id: cancelada,
    object: 'subscription',
    customer: customerId,
  })
  const encerrada = await readSubscription(user.id)
  expect(encerrada?.status).toBe('canceled')
  expect(encerrada?.pro_ended_at).not.toBeNull()
  // Uma vitrine por conta: no gratuito ela continua ativa, não há excedente para congelar.
  expect(await vitrineStatuses(user.id)).toEqual([`${vitrine.subdomain}:active`])
  expect(await (await request.get(`http://${vitrine.subdomain}.localhost:3000/`)).text()).not.toContain(
    'Vitrine indisponível no momento',
  )

  // Spec 7.1: vitrine congelada continua respondendo 200, com o aviso no lugar do catálogo.
  // Cada conta tem uma vitrine, então a congelada é de outro dono, ainda não gerada.
  const outro = await createConfirmedUser('webhook-congelada')
  const congelada = await seedVitrine(outro.id, { subdomain: uniqueSubdomain('wh-d') })
  await setVitrineStatus(congelada.id, 'frozen')
  const resposta = await request.get(`http://${congelada.subdomain}.localhost:3000/`)
  expect(resposta.status()).toBe(200)
  expect(await resposta.text()).toContain('Vitrine indisponível no momento')
})
