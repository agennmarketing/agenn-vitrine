import { createHmac } from 'node:crypto'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, type APIRequestContext, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { APP_URL } from '../playwright.config'

const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324'

const SUBJECT_BY_TYPE: Record<'email' | 'recovery', string> = {
  email: 'Confirme seu e-mail na Vitrimove',
  recovery: 'Redefina sua senha da Vitrimove',
}

export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  })
}

export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.com`
}

// Nesta máquina o Docker Desktop monta cada `supabase/templates/*.html` como um
// diretório vazio dentro do container do Kong (o repositório vive num drive FAT32
// que não suporta bind mount de arquivo único), então o corpo do e-mail local nunca
// contém o link do nosso template — só o assunto customizado chega correto. Por isso
// confirmamos primeiro, via Mailpit, que o Supabase realmente enviou o e-mail certo
// (pelo assunto) e então geramos o mesmo link de autenticação pela Admin API, que é
// o link que o template real produz em produção (onde os templates são servidos
// normalmente e fazem parte do checklist de produção).
export async function waitForAuthLink(email: string, type: 'email' | 'recovery', timeoutMs = 20_000): Promise<string> {
  const deadline = Date.now() + timeoutMs
  const subject = SUBJECT_BY_TYPE[type]
  let sent = false
  while (Date.now() < deadline) {
    const search = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`)
    const { messages = [] } = (await search.json()) as { messages?: { Subject: string }[] }
    if (messages.some((message) => message.Subject === subject)) {
      sent = true
      break
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  if (!sent) throw new Error(`Nenhum e-mail "${type}" chegou para ${email}`)

  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.generateLink(
    type === 'recovery' ? { type: 'recovery', email } : { type: 'magiclink', email },
  )
  if (error) throw error
  return `${APP_URL}/auth/confirm?token_hash=${data.properties.hashed_token}&type=${type}`
}

export async function createConfirmedUser(prefix: string) {
  const admin = createAdminClient()
  const user = { email: uniqueEmail(prefix), password: 'senhaForte123', name: 'Pessoa Teste' }
  const { data, error } = await admin.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: { name: user.name },
  })
  if (error) throw error
  return { ...user, id: data.user.id }
}

export async function signIn(page: Page, email: string, password: string) {
  await page.goto('/entrar')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/painel$/)
}
export function uniqueSubdomain(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.slice(0, 30)
}

export async function setPlan(userId: string, plan: 'free' | 'pro') {
  const admin = createAdminClient()
  await admin
    .from('subscriptions')
    .upsert({ user_id: userId, plan_id: plan, status: plan === 'pro' ? 'active' : 'none' })
    .throwOnError()
}

export type SeededVitrine = { id: string; subdomain: string; categoryId: string; contactId: string; phone: string; name: string }

// Passos do popup de item (Fotos, Detalhes, Preço, Extras): cada um mostra só os seus campos.
export async function itemStep(page: Page, label: 'Fotos' | 'Detalhes' | 'Preço' | 'Extras') {
  await page.getByRole('navigation', { name: 'Passos do item' }).getByRole('button', { name: label }).click()
}

export async function seedVitrine(
  ownerId: string,
  options: {
    type?: 'produtos' | 'servicos' | 'comida'
    name?: string
    subdomain?: string
    phone?: string
    cartEnabled?: boolean
  } = {},
): Promise<SeededVitrine> {
  const admin = createAdminClient()
  const type = options.type ?? 'produtos'
  const subdomain = options.subdomain ?? uniqueSubdomain('seed')
  const name = options.name ?? 'Vitrine Seed'
  const phone = options.phone ?? '+5511987654321'
  const cartEnabled = options.cartEnabled ?? type !== 'servicos'
  const { data: vitrine } = await admin
    .from('vitrines')
    .insert({ owner_id: ownerId, type, subdomain, name, default_button_text: { produtos: 'Adicionar à sacola', servicos: 'Quero esse serviço', comida: 'Pedir' }[type], cart_enabled: cartEnabled })
    .select('id')
    .single()
    .throwOnError()
  const { data: contact } = await admin
    .from('whatsapp_contacts')
    .insert({ owner_id: ownerId, vitrine_id: vitrine.id, label: 'Principal', phone_e164: phone })
    .select('id')
    .single()
    .throwOnError()
  await admin.from('vitrines').update({ primary_whatsapp_id: contact.id }).eq('id', vitrine.id).throwOnError()
  const { data: category } = await admin
    .from('categories')
    .insert({ owner_id: ownerId, vitrine_id: vitrine.id, name: 'Destaques' })
    .select('id')
    .single()
    .throwOnError()
  return { id: vitrine.id, subdomain, categoryId: category.id, contactId: contact.id, phone, name }
}

export async function seedItem(
  vitrine: SeededVitrine,
  ownerId: string,
  fields: {
    name: string
    priceCents?: number | null
    priceType?: 'fixed' | 'from' | 'on_request'
    variations?: { name: string; priceCents: number }[]
  },
) {
  const admin = createAdminClient()
  const { data: item } = await admin
    .from('items')
    .insert({
      owner_id: ownerId,
      vitrine_id: vitrine.id,
      category_id: vitrine.categoryId,
      name: fields.name,
      price_type: fields.priceType ?? 'fixed',
      price_cents: fields.priceType === 'on_request' ? null : (fields.priceCents ?? 1000),
    })
    .select('id, code')
    .single()
    .throwOnError()
  if (fields.variations?.length) {
    await admin
      .from('item_variations')
      .insert(fields.variations.map((v, position) => ({ owner_id: ownerId, item_id: item.id, name: v.name, price_cents: v.priceCents, position })))
      .throwOnError()
  }
  await admin
    .from('media')
    .insert({
      owner_id: ownerId,
      vitrine_id: vitrine.id,
      item_id: item.id,
      role: 'cover',
      kind: 'image',
      storage_paths: { '480': `${ownerId}/${vitrine.id}/seed-480.webp`, '1080': `${ownerId}/${vitrine.id}/seed-1080.webp` },
      width: 1080,
      height: 1350,
    })
    .throwOnError()
  return item as { id: string; code: string }
}

export async function makeTestImage(page: Page, width = 1200, height = 1500): Promise<Buffer> {
  const dataUrl = await page.evaluate(
    ([w, h]) => {
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const context = canvas.getContext('2d')!
      context.fillStyle = '#0b2a1c'
      context.fillRect(0, 0, w, h)
      context.fillStyle = '#ffffff'
      context.fillRect(w / 4, h / 4, w / 2, h / 2)
      return canvas.toDataURL('image/png')
    },
    [width, height],
  )
  return Buffer.from(dataUrl.split(',')[1], 'base64')
}

export async function uploadImage(page: Page, label: string, image: Buffer) {
  await page.getByLabel(label, { exact: true }).setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: image })
  await page.getByRole('button', { name: 'Usar imagem' }).click()
  await expect(page.getByRole('img', { name: label, exact: true })).toBeVisible()
}

export function videoFixture(name: 'horizontal-3s' | 'vertical-3s' | 'longo-61s') {
  return path.join('e2e', 'fixtures', `${name}.webm`)
}

export function signMuxWebhook(body: string, timestamp = Math.floor(Date.now() / 1000)) {
  const secret = process.env.MUX_WEBHOOK_SECRET ?? 'ci-webhook-secret'
  return `t=${timestamp},v1=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`
}

export async function sendMuxWebhook(request: APIRequestContext, uploadId: string, type = 'video.asset.ready') {
  // No driver fake um único id faz as vezes de envio, asset e playback.
  const body = JSON.stringify({ type, object: { type: 'asset', id: uploadId }, data: { id: uploadId, upload_id: uploadId } })
  return request.post(`${APP_URL}/api/webhooks/mux`, {
    data: body,
    headers: { 'content-type': 'application/json', 'mux-signature': signMuxWebhook(body) },
  })
}

export async function seedVideo(
  vitrine: SeededVitrine,
  ownerId: string,
  itemId: string | null,
  options: { status?: 'processing' | 'ready' | 'failed'; role?: 'video' | 'banner' } = {},
) {
  const admin = createAdminClient()
  const guid = crypto.randomUUID()
  const { data } = await admin
    .from('media')
    .insert({
      owner_id: ownerId,
      vitrine_id: vitrine.id,
      item_id: itemId,
      role: options.role ?? 'video',
      kind: 'video',
      status: options.status ?? 'ready',
      mux_upload_id: guid,
      mux_asset_id: guid,
      mux_playback_id: guid,
      thumbnail_url: `/api/dev-video/${guid}/thumbnail.jpg`,
      duration_seconds: 3,
      aspect: '9:16',
      width: 360,
      height: 640,
    })
    .select('id')
    .single()
    .throwOnError()
  return { id: data.id as string, guid }
}

export async function mediaOfItem(itemId: string, role: 'video' | 'cover' = 'video') {
  const { data } = await createAdminClient()
    .from('media')
    .select('id, status, mux_upload_id, mux_asset_id')
    .eq('item_id', itemId)
    .eq('role', role)
    .maybeSingle()
    .throwOnError()
  return data as { id: string; status: string; mux_upload_id: string | null; mux_asset_id: string | null } | null
}

export async function readFakeEmails(to: string) {
  const dir = path.join(os.tmpdir(), 'agenn-vitrine-email')
  const files = await readdir(dir).catch(() => [] as string[])
  const emails = await Promise.all(
    files.map(async (file) => JSON.parse(await readFile(path.join(dir, file), 'utf8')) as { to: string; subject: string; text: string }),
  )
  return emails.filter((email) => email.to === to)
}


export async function setCheckout(vitrineId: string, patch: Record<string, unknown>) {
  await createAdminClient().from('checkout_settings').update(patch).eq('vitrine_id', vitrineId).throwOnError()
}

export async function setCart(vitrineId: string, enabled: boolean) {
  await createAdminClient().from('vitrines').update({ cart_enabled: enabled }).eq('id', vitrineId).throwOnError()
}

// Soma as linhas do dono nas tabelas que devem cair junto com a conta.
export async function countUserRows(userId: string) {
  const admin = createAdminClient()
  const tabelas = [
    ['profiles', 'id'],
    ['subscriptions', 'user_id'],
    ['vitrines', 'owner_id'],
    ['items', 'owner_id'],
    ['media', 'owner_id'],
    ['item_codes', 'owner_id'],
  ] as const
  let total = 0
  for (const [tabela, coluna] of tabelas) {
    const { count } = await admin.from(tabela).select('*', { count: 'exact', head: true }).eq(coluna, userId)
    total += count ?? 0
  }
  return total
}

export async function setSubscription(
  userId: string,
  fields: {
    status?: string
    planId?: 'free' | 'pro'
    customerId?: string | null
    subscriptionId?: string | null
    currentPeriodEnd?: string | null
    cancelAtPeriodEnd?: boolean
    graceUntil?: string | null
    proEndedAt?: string | null
  } = {},
) {
  const admin = createAdminClient()
  await admin
    .from('subscriptions')
    .upsert({
      user_id: userId,
      plan_id: fields.planId ?? 'pro',
      status: fields.status ?? 'active',
      stripe_customer_id: fields.customerId ?? null,
      stripe_subscription_id: fields.subscriptionId ?? null,
      current_period_end: fields.currentPeriodEnd ?? null,
      cancel_at_period_end: fields.cancelAtPeriodEnd ?? false,
      grace_until: fields.graceUntil ?? null,
      pro_ended_at: fields.proEndedAt ?? null,
    })
    .throwOnError()
}

export async function setVitrineStatus(vitrineId: string, status: 'active' | 'frozen') {
  await createAdminClient().from('vitrines').update({ status }).eq('id', vitrineId).throwOnError()
}

export async function vitrineStatuses(ownerId: string) {
  const { data } = await createAdminClient()
    .from('vitrines')
    .select('subdomain, status')
    .eq('owner_id', ownerId)
    .order('position')
    .order('created_at')
    .throwOnError()
  return (data ?? []).map((row) => `${row.subdomain}:${row.status}`)
}

export async function readSubscription(userId: string) {
  const { data } = await createAdminClient()
    .from('subscriptions')
    .select('status, plan_id, interval, grace_until, pro_ended_at, cancel_at_period_end, stripe_subscription_id')
    .eq('user_id', userId)
    .maybeSingle()
    .throwOnError()
  return data
}

// Mesma criptografia do Stripe: o driver falso confere a assinatura de verdade.
export function signStripeWebhook(body: string) {
  const stripe = new Stripe('sk_test_e2e')
  return stripe.webhooks.generateTestHeaderString({
    payload: body,
    secret: process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec-ci-somente-para-testes',
  })
}

export async function sendStripeEvent(
  request: APIRequestContext,
  type: string,
  object: Record<string, unknown>,
  id = `evt_fake_${crypto.randomUUID()}`,
) {
  const body = JSON.stringify({ id, object: 'event', type, data: { object } })
  return request.post(`${APP_URL}/api/webhooks/stripe`, {
    data: body,
    headers: { 'content-type': 'application/json', 'stripe-signature': signStripeWebhook(body) },
  })
}

// Escreve direto no armazenamento do driver falso (mesmo formato de fake-billing.ts).
export async function fakeSubscription(fields: {
  customerId: string
  userId?: string | null
  status?: string
  interval?: 'month' | 'year'
  cancelAtPeriodEnd?: boolean
  currentPeriodEnd?: string | null
}) {
  const id = `sub_fake_${crypto.randomUUID()}`
  const dir = path.join(os.tmpdir(), 'agenn-vitrine-billing')
  await mkdir(dir, { recursive: true })
  await writeFile(
    path.join(dir, `${id}.json`),
    JSON.stringify({
      id,
      customerId: fields.customerId,
      userId: fields.userId ?? null,
      status: fields.status ?? 'active',
      interval: fields.interval ?? 'month',
      currentPeriodEnd: fields.currentPeriodEnd ?? new Date(Date.now() + 30 * 86_400_000).toISOString(),
      cancelAtPeriodEnd: fields.cancelAtPeriodEnd ?? false,
    }),
  )
  return id
}
