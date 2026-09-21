import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { muxSignatureHeader, signMuxBody, verifyMuxSignature } from './signatures'

const body = '{"type":"video.asset.ready","data":{"id":"asset-1"}}'
const now = 1_700_000_000

describe('assinatura do Mux', () => {
  it('assina com HMAC-SHA256 hex de timestamp.corpo', () => {
    expect(signMuxBody(body, '1700000000', 'segredo')).toBe(
      createHmac('sha256', 'segredo').update(`1700000000.${body}`).digest('hex'),
    )
  })

  it('verifica a assinatura', () => {
    const header = muxSignatureHeader(body, 'segredo', now)
    expect(verifyMuxSignature(body, header, 'segredo', now)).toBe(true)
    expect(verifyMuxSignature(body, header, 'outro', now)).toBe(false)
    expect(verifyMuxSignature(`${body} `, header, 'segredo', now)).toBe(false)
    expect(verifyMuxSignature(body, null, 'segredo', now)).toBe(false)
    expect(verifyMuxSignature(body, 'v1=zz', 'segredo', now)).toBe(false)
  })

  it('recusa aviso velho (repetição)', () => {
    const header = muxSignatureHeader(body, 'segredo', now)
    expect(verifyMuxSignature(body, header, 'segredo', now + 301)).toBe(false)
    expect(verifyMuxSignature(body, header, 'segredo', now + 299)).toBe(true)
  })
})
