import { expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324'

export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.com`
}

export async function waitForAuthLink(email: string, type: 'email' | 'recovery', timeoutMs = 20_000): Promise<string> {
  const deadline = Date.now() + timeoutMs
  const pattern = new RegExp(`href="([^"]*/auth/confirm\\?[^"]*type=${type}[^"]*)"`)
  while (Date.now() < deadline) {
    const search = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`)
    const { messages = [] } = (await search.json()) as { messages?: { ID: string }[] }
    for (const { ID } of messages) {
      const message = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${ID}`)).json()) as { HTML: string }
      const match = message.HTML.match(pattern)
      if (match) return match[1].replaceAll('&amp;', '&')
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`Nenhum e-mail "${type}" chegou para ${email}`)
}

export async function createConfirmedUser(prefix: string) {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  })
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
