import { describe, expect, it } from 'vitest'
import { COMPANY, LEGAL_VERSION, LEGAL_VERSION_LABEL } from './company'

describe('dados da empresa', () => {
  it('tem todos os campos preenchidos ou marcados para preencher', () => {
    for (const value of Object.values(COMPANY)) {
      expect(value.trim().length).toBeGreaterThan(0)
    }
  })

  it('versão em ISO e rótulo no formato brasileiro', () => {
    expect(LEGAL_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(LEGAL_VERSION_LABEL).toMatch(/^\d{2}\/\d{2}\/\d{4}$/)
    const [ano, mes, dia] = LEGAL_VERSION.split('-')
    expect(LEGAL_VERSION_LABEL).toBe(`${dia}/${mes}/${ano}`)
  })
})
