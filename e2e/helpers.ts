import { expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { APP_URL } from '../playwright.config'

const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324'

const SUBJECT_BY_TYPE: Record<'email' | 'recovery', string> = {
  email: 'Confirme seu e-mail na Agenn Vitrine',
  recovery: 'Redefina sua senha da Agenn Vitrine',
}

function createAdminClient() {
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
  const { error } = await admin.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: { name: user.name },
  })
  if (error) throw error
  return user
}

export async function signIn(page: Page, email: string, password: string) {
  await page.goto('/entrar')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/painel$/)
}
