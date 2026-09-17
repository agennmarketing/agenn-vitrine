import { createHash, createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { signWebhookBody, tusSignature, verifyWebhookSignature } from './signatures'

describe('tusSignature', () => {
  it('SHA-256 hex de libraryId + apiKey + expires + videoId, nessa ordem', () => {
    const expected = createHash('sha256').update('123chave1700000000guid-1').digest('hex')
    expect(tusSignature({ libraryId: '123', apiKey: 'chave', expires: 1700000000, videoId: 'guid-1' })).toBe(expected)
  })
})

describe('webhook', () => {
  const body = '{"VideoLibraryId":123,"VideoGuid":"guid-1","Status":3}'

  it('assina com HMAC-SHA256 hex do corpo cru', () => {
    expect(signWebhookBody(body, 'segredo')).toBe(createHmac('sha256', 'segredo').update(body).digest('hex'))
  })

  it('verifica a assinatura', () => {
    const signature = signWebhookBody(body, 'segredo')
    expect(verifyWebhookSignature(body, signature, 'segredo')).toBe(true)
    expect(verifyWebhookSignature(body, signature, 'outro')).toBe(false)
    expect(verifyWebhookSignature(`${body} `, signature, 'segredo')).toBe(false)
    expect(verifyWebhookSignature(body, null, 'segredo')).toBe(false)
    expect(verifyWebhookSignature(body, 'zz', 'segredo')).toBe(false)
  })
})
