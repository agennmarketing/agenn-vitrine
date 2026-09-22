import { expect, test } from '@playwright/test'
import {
  createConfirmedUser,
  itemStep,
  makeTestImage,
  mediaOfItem,
  seedItem,
  seedVitrine,
  sendMuxWebhook,
  setPlan,
  signIn,
  uniqueSubdomain,
  uploadImage,
  videoFixture,
  vitrineStatuses,
} from './helpers'

test('criar vitrine → cadastrar item com vídeo → vitrine pública → WhatsApp → simulador', async ({ page, request: api }) => {
  const user = await createConfirmedUser('fluxo')
  await signIn(page, user.email, user.password)

  // O modo Produtos saiu do assistente, mas continua no banco: a vitrine nasce semeada.
  const subdomain = uniqueSubdomain('fluxo')
  const vitrine = await seedVitrine(user.id, { type: 'produtos', name: 'Loja do Zé', subdomain })
  await page.goto(`/painel/vitrines/${vitrine.id}/itens`)

  await page.getByRole('link', { name: 'Novo item' }).click()
  await uploadImage(page, 'Capa', await makeTestImage(page))
  await itemStep(page, 'Detalhes')
  await page.getByLabel('Nome', { exact: true }).fill('Camiseta')
  await page.getByLabel('Categoria', { exact: true }).selectOption({ label: 'Destaques' })
  await itemStep(page, 'Preço')
  await page.getByLabel('Preço', { exact: true }).fill('25,90')
  await page.getByRole('button', { name: 'Salvar item' }).click()
  await expect(page.getByText('Primeiro item no ar!')).toBeVisible()

  // Vídeo no item (conta gratuita: 1 vídeo permitido)
  await page.getByRole('link', { name: 'Editar' }).click()
  await page.getByLabel('Vídeo', { exact: true }).setInputFiles(videoFixture('vertical-3s'))
  await expect(page.getByText(/Processando o vídeo…|Vídeo pronto/)).toBeVisible({ timeout: 20_000 })
  const itemId = page.url().split('/').pop()!
  const media = await mediaOfItem(itemId)
  await sendMuxWebhook(api, media!.mux_upload_id!)
  await expect(page.getByText('Vídeo pronto')).toBeVisible({ timeout: 15_000 })

  await page.goto(`http://${subdomain}.localhost:3000/`)
  await expect(page.getByRole('heading', { level: 1, name: 'Loja do Zé' })).toBeVisible()
  await page.getByRole('button', { name: 'Camiseta' }).click()
  await expect(page.getByRole('dialog', { name: 'Camiseta' }).locator(`mux-player[data-media-id="${media!.id}"]`)).toHaveCount(1)
  await page.route('https://wa.me/**', (route) => route.fulfill({ status: 200, body: 'ok' }))
  const request = page.waitForRequest(/^https:\/\/wa\.me\//)
  await page.getByRole('dialog', { name: 'Camiseta' }).getByRole('button', { name: 'Adicionar à sacola · R$ 25,90' }).click()
  await page.getByRole('button', { name: 'Ver sacola · 1 item · R$ 25,90' }).click()
  await page.getByRole('dialog', { name: 'Sacola' }).getByRole('button', { name: 'Enviar pedido' }).click()
  const url = new URL((await request).url())
  expect(url.pathname).toBe('/5511987654321')
  const text = url.searchParams.get('text')!
  expect(text).toContain('*1.* 1x Camiseta\ncód. 101 · R$ 25,90 cada · total R$ 25,90')
  const orderCode = text.match(/Pedido #([23456789A-HJ-NP-Z]{4})/)![1]

  await page.goto('/painel/simulador')
  await page.getByLabel('Código do pedido').fill(orderCode)
  await page.getByRole('button', { name: 'Consultar' }).click()
  await expect(page.getByText('R$ 25,90').first()).toBeVisible()
})

test('sacola: vitrine → item → sacola → WhatsApp → simulador', async ({ page }) => {
  const user = await createConfirmedUser('fluxo-sacola')
  await signIn(page, user.email, user.password)

  const subdomain = uniqueSubdomain('loja-sacola')
  const vitrine = await seedVitrine(user.id, { type: 'produtos', name: 'Loja Sacola', subdomain })
  const vitrinePath = `/painel/vitrines/${vitrine.id}`

  // A sacola e o formulário do pedido são ligados pelo dono, em Sacola e mensagens.
  await page.goto(`${vitrinePath}/mensagens`)
  await page.getByLabel('Nome', { exact: true }).selectOption('required')
  await page.getByLabel('Retirada ou entrega').selectOption('required')
  await page.getByLabel('Forma de pagamento', { exact: true }).selectOption('required')
  await page.getByRole('button', { name: 'Salvar mensagens' }).click()
  await expect(page.getByText('Mensagens salvas.')).toBeVisible()

  await page.goto(`${vitrinePath}/itens/novo`)
  await uploadImage(page, 'Capa', await makeTestImage(page))
  await itemStep(page, 'Detalhes')
  await page.getByLabel('Nome', { exact: true }).fill('Camisa Linho')
  await page.getByLabel('Categoria', { exact: true }).selectOption({ label: 'Destaques' })
  await itemStep(page, 'Preço')
  await page.getByLabel('Preço', { exact: true }).fill('22,00')
  await page.getByRole('button', { name: 'Salvar item' }).click()
  await expect(page.getByText('Primeiro item no ar!')).toBeVisible()

  await page.goto(`http://${subdomain}.localhost:3000/`)
  await page.getByRole('button', { name: 'Camisa Linho' }).click()
  const sheet = page.getByRole('dialog', { name: 'Camisa Linho' })
  await sheet.getByRole('button', { name: 'Adicionar à sacola · R$ 22,00' }).click()
  await page.getByRole('button', { name: 'Ver sacola · 1 item · R$ 22,00' }).click()

  const cart = page.getByRole('dialog', { name: 'Sacola' })
  await cart.getByLabel('Nome').fill('Rui')
  // "Entrega" por papel: o rótulo do select de pagamento contém "Cartão na entrega".
  await cart.getByRole('radio', { name: 'Entrega' }).check()
  await cart.getByLabel('Endereço de entrega').fill('Rua das Flores, 100')
  await cart.getByLabel('Forma de pagamento').selectOption('Dinheiro')
  await cart.getByLabel('Troco para quanto?').fill('50')
  await page.route('https://wa.me/**', (route) => route.fulfill({ status: 200, body: 'ok' }))
  const whatsapp = page.waitForRequest(/^https:\/\/wa\.me\//)
  await cart.getByRole('button', { name: 'Enviar pedido' }).click()
  const text = new URL((await whatsapp).url()).searchParams.get('text')!
  expect(text).toContain('*1.* 1x Camisa Linho\ncód. 101 · R$ 22,00 cada · total R$ 22,00')
  expect(text).toContain('Nome: Rui\nEntrega: entrega\nEndereço: Rua das Flores, 100\nPagamento: Dinheiro (troco para R$ 50,00)')
  const orderCode = text.match(/#([23456789A-HJ-NP-Z]{4})/)![1]

  await page.goto('/painel/simulador')
  await page.getByLabel('Código do pedido').fill(orderCode)
  await page.getByRole('button', { name: 'Consultar' }).click()
  await expect(page.getByText('R$ 22,00').first()).toBeVisible()
})

test('teste vencido tira a vitrine do ar; assinar devolve tudo na hora; cancelar tira de novo', async ({ page }) => {
  const user = await createConfirmedUser('fluxo-plano')
  const vitrine = await seedVitrine(user.id, { name: 'Loja do Teste', subdomain: uniqueSubdomain('fp-a') })
  await seedItem(vitrine, user.id, { name: 'Camiseta', priceCents: 5990 })
  await signIn(page, user.email, user.password)
  await setPlan(user.id, 'expired')

  // Painel: no lugar do editor, a tela de assinatura. A vitrine pública sai do ar.
  await page.goto(`/painel/vitrines/${vitrine.id}/itens`)
  await expect(page.getByRole('heading', { name: 'Seu teste grátis terminou' })).toBeVisible()
  await page.goto(`http://${vitrine.subdomain}.localhost:3000/`)
  await expect(page.getByText('Vitrine indisponível no momento')).toBeVisible()

  // Assinar pela própria tela de assinatura.
  await page.goto(`/painel/vitrines/${vitrine.id}/itens`)
  await page.getByRole('button', { name: /Assinar por R\$.?79,90 por mês/ }).click()
  await page.waitForURL(/\/painel\/plano\?assinatura=ok$/)
  await expect(page.getByRole('heading', { name: 'Plano Essencial' })).toBeVisible()

  // A revalidação por tag acontece no webhook: a vitrine volta com os dados de antes.
  expect(await vitrineStatuses(user.id)).toEqual([`${vitrine.subdomain}:active`])
  await page.goto(`http://${vitrine.subdomain}.localhost:3000/`)
  await expect(page.getByRole('heading', { level: 1, name: 'Loja do Teste' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Camiseta' })).toBeVisible()
  await page.goto(`/painel/vitrines/${vitrine.id}/itens`)
  await expect(page.getByRole('heading', { name: 'Seu teste grátis terminou' })).toHaveCount(0)

  await page.goto('/painel/plano')
  await page.getByRole('button', { name: 'Gerenciar assinatura' }).click()
  await page.waitForURL(/\/api\/dev-billing\/portal/)
  await page.getByRole('link', { name: 'Cancelar agora' }).click()
  await page.waitForURL(/\/painel\/plano$/)
  await expect(page.getByText(/Sua assinatura foi cancelada/)).toBeVisible()

  expect(await vitrineStatuses(user.id)).toEqual([`${vitrine.subdomain}:frozen`])
  await page.goto(`/painel/agenda`)
  await expect(page.getByRole('heading', { name: 'Sua assinatura foi cancelada' })).toBeVisible()
})
