// Sem server-only: só calcula hashes (as chaves vêm de quem chama) e roda no Vitest.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export function tusSignature(input: { libraryId: string; apiKey: string; expires: number; videoId: string }): string {
  return createHash('sha256').update(`${input.libraryId}${input.apiKey}${input.expires}${input.videoId}`).digest('hex')
}

export function signWebhookBody(rawBody: string, secret: string): string {
  return createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
}

export function verifyWebhookSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature || !/^[0-9a-f]{64}$/.test(signature)) return false
  return timingSafeEqual(Buffer.from(signWebhookBody(rawBody, secret), 'hex'), Buffer.from(signature, 'hex'))
}
