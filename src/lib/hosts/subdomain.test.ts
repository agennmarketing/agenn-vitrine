import { describe, expect, it } from 'vitest'
import { isReservedSubdomain, isValidSubdomainFormat, validateSubdomain } from './subdomain'

describe('validateSubdomain', () => {
  it('aceita e normaliza um subdomínio válido', () => {
    expect(validateSubdomain('  BurgerDoZe ')).toEqual({ ok: true, value: 'burgerdoze' })
    expect(validateSubdomain('loja-da-ana-2')).toEqual({ ok: true, value: 'loja-da-ana-2' })
  })

  it('recusa tamanho fora de 3 a 30', () => {
    expect(validateSubdomain('ab')).toEqual({ ok: false, reason: 'length' })
    expect(validateSubdomain('a'.repeat(31))).toEqual({ ok: false, reason: 'length' })
    expect(validateSubdomain('abc')).toEqual({ ok: true, value: 'abc' })
    expect(validateSubdomain('a'.repeat(30)).ok).toBe(true)
  })

  it('recusa formato inválido', () => {
    for (const bad of ['-loja', 'loja-', 'lo ja', 'lojá', 'lo_ja', 'lo.ja']) {
      expect(validateSubdomain(bad)).toEqual({ ok: false, reason: 'format' })
    }
  })

  it('recusa nomes reservados', () => {
    for (const reserved of ['www', 'app', 'painel', 'api', 'admin', 'suporte', 'blog']) {
      expect(validateSubdomain(reserved)).toEqual({ ok: false, reason: 'reserved' })
    }
  })
})

describe('helpers', () => {
  it('isValidSubdomainFormat considera tamanho e formato', () => {
    expect(isValidSubdomainFormat('loja')).toBe(true)
    expect(isValidSubdomainFormat('lo')).toBe(false)
    expect(isValidSubdomainFormat('Loja')).toBe(false)
  })

  it('isReservedSubdomain', () => {
    expect(isReservedSubdomain('api')).toBe(true)
    expect(isReservedSubdomain('burgerdoze')).toBe(false)
  })
})
