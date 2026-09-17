import { expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { APP_URL } from '../playwright.config'

const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324'

const SUBJECT_BY_TYPE: Record<'email' | 'recovery', string> = {
  email: 'Confirme seu e-mail na Agenn Vitrine',
  recovery: 'Redefina sua senha da Agenn Vitrine',
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

export async function seedVitrine(
  ownerId: string,
  options: { type?: 'produtos' | 'servicos'; name?: string; subdomain?: string; phone?: string } = {},
): Promise<SeededVitrine> {
  const admin = createAdminClient()
  const type = options.type ?? 'produtos'
  const subdomain = options.subdomain ?? uniqueSubdomain('seed')
  const name = options.name ?? 'Vitrine Seed'
  const phone = options.phone ?? '+5511987654321'
  const { data: vitrine } = await admin
    .from('vitrines')
    .insert({ owner_id: ownerId, type, subdomain, name, default_button_text: type === 'servicos' ? 'Agendar' : 'Solicitar orçamento' })
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
