import { expect, it } from 'vitest'
import { clientIp, rateLimitKey } from './client-ip'

it('primeiro IP do x-forwarded-for, depois x-real-ip', () => {
  expect(clientIp(new Headers({ 'x-forwarded-for': '200.1.2.3, 10.0.0.1' }))).toBe('200.1.2.3')
  expect(clientIp(new Headers({ 'x-real-ip': '200.9.9.9' }))).toBe('200.9.9.9')
  expect(clientIp(new Headers())).toBe('desconhecido')
})

it('chave com hash do IP e sal, sem o IP em claro', async () => {
  const key = await rateLimitKey('200.1.2.3', 'orders', 'sal-de-teste-123456')
  expect(key).toMatch(/^orders:[0-9a-f]{64}$/)
  expect(key).not.toContain('200.1.2.3')
  expect(await rateLimitKey('200.1.2.3', 'orders', 'outro-sal-123456789')).not.toBe(key)
})
