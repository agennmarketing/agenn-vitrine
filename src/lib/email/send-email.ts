import 'server-only'
import { mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { getEmailEnv } from '@/lib/server-env'

export type EmailMessage = { to: string; subject: string; text: string; html: string; idempotencyKey?: string }

// Só CI e desenvolvimento: e-mails viram arquivos JSON para os testes lerem.
const FAKE_EMAIL_DIR = path.join(os.tmpdir(), 'agenn-vitrine-email')

export async function sendEmail(message: EmailMessage): Promise<void> {
  const config = getEmailEnv()
  if (config.driver === 'off') return

  if (config.driver === 'fake') {
    await mkdir(FAKE_EMAIL_DIR, { recursive: true })
    await writeFile(
      path.join(FAKE_EMAIL_DIR, `${Date.now()}-${crypto.randomUUID()}.json`),
      JSON.stringify({ to: message.to, subject: message.subject, text: message.text }),
    )
    return
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      ...(message.idempotencyKey ? { 'Idempotency-Key': message.idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from: config.from,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
  })
  if (!response.ok) throw new Error(`Resend ${response.status}: ${await response.text()}`)
}
