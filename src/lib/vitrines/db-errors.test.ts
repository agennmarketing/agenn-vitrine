import { describe, expect, it } from 'vitest'
import { isPlanLimitError, mapDbError } from './db-errors'

describe('mapDbError', () => {
  it('limites do plano', () => {
    expect(mapDbError({ code: 'P0001', message: 'plan_limit:vitrines', hint: '1' })).toBe(
      'Cada conta pode ter uma vitrine. Edite a que você já tem.',
    )
    expect(mapDbError({ code: 'P0001', message: 'plan_limit:items', hint: '300' })).toBe(
      'Seu plano permite até 300 itens por vitrine.',
    )
    expect(isPlanLimitError({ message: 'plan_limit:items' })).toBe(true)
    expect(isPlanLimitError({ message: 'item_code_taken' })).toBe(false)
  })

  it('limites de vídeo', () => {
    expect(mapDbError({ message: 'plan_limit:videos_vitrine', hint: '1' })).toBe('Seu plano permite até 1 vídeo por vitrine.')
    expect(mapDbError({ message: 'plan_limit:videos_account', hint: '50' })).toBe('Seu plano permite até 50 vídeos na conta.')
  })

  it('limite zero é a conta sem acesso', () => {
    expect(mapDbError({ message: 'plan_limit:items', hint: '0' })).toBe(
      'Seu acesso está pausado. Assine o Plano Essencial para continuar usando o Vitrimove.',
    )
  })

  it('erros conhecidos', () => {
    expect(mapDbError({ message: 'item_code_taken' })).toBe('Este código já foi usado na sua conta. Escolha outro.')
    expect(mapDbError({ code: '23505', message: 'duplicate key value violates unique constraint "vitrines_subdomain_key"' })).toBe(
      'Este endereço já está em uso. Escolha outro.',
    )
    expect(mapDbError({ message: 'invalid_reference:category' })).toBe(
      'Algum dado escolhido não pertence a esta vitrine. Recarregue a página.',
    )
  })

  it('o resto é genérico', () => {
    expect(mapDbError({ code: 'XX000', message: 'boom' })).toBe('Não foi possível salvar. Tente novamente.')
    expect(mapDbError(null)).toBe('Não foi possível salvar. Tente novamente.')
  })
})
