import { describe, expect, it } from 'vitest'
import { fieldErrorsFromZod } from './form-state'

describe('fieldErrorsFromZod', () => {
  it('pega a primeira mensagem de cada campo', () => {
    expect(
      fieldErrorsFromZod({
        issues: [
          { path: ['email'], message: 'primeira' },
          { path: ['email'], message: 'segunda' },
          { path: ['password'], message: 'senha' },
        ],
      }),
    ).toEqual({ email: 'primeira', password: 'senha' })
  })
  it('ignora erros sem campo', () => {
    expect(fieldErrorsFromZod({ issues: [{ path: [], message: 'geral' }] })).toEqual({})
  })
})
