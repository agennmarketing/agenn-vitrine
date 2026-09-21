// Sem server-only: só calcula hashes (o segredo vem de quem chama) e roda no Vitest.
import { createHmac, timingSafeEqual } from 'node:crypto'

// O Mux assina `${timestamp}.${corpo}` e manda tudo no cabeçalho mux-signature.
const TOLERANCE_SECONDS = 300

export function signMuxBody(rawBody: string, timestamp: string, secret: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${rawBody}`, 'utf8').digest('hex')
}

export function muxSignatureHeader(rawBody: string, secret: string, timestamp = Math.floor(Date.now() / 1000)): string {
  return `t=${timestamp},v1=${signMuxBody(rawBody, String(timestamp), secret)}`
}

export function verifyMuxSignature(rawBody: string, header: string | null, secret: string, nowSeconds?: number): boolean {
  if (!header) return false
  const parts = new Map(header.split(',').map((part) => part.trim().split('=', 2) as [string, string]))
  const timestamp = parts.get('t')
  const signature = parts.get('v1')
  if (!timestamp || !/^\d+$/.test(timestamp) || !signature || !/^[0-9a-f]{64}$/.test(signature)) return false

  const now = nowSeconds ?? Math.floor(Date.now() / 1000)
  if (Math.abs(now - Number(timestamp)) > TOLERANCE_SECONDS) return false

  return timingSafeEqual(Buffer.from(signMuxBody(rawBody, timestamp, secret), 'hex'), Buffer.from(signature, 'hex'))
}
