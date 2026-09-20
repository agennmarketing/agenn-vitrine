import { describe, expect, it } from 'vitest'
import { isPlanLimitError, mapDbError } from './db-errors'

describe('mapDbError', () => {
  it('limites viram convite para o Pro', () => {
    expect(mapDbError({ code: 'P0001', message: 'plan_limit:vitrines', hint: '1' })).toBe(
      'Cada conta pode ter uma vitrine. Edite a que você já tem.',
    )
    expect(mapDbError({ code: 'P0001', message: 'plan_limit:items', hint: '10' })).toBe(
      'Seu plano permite até 10 itens por vitrine. Assine o Pro para cadastrar mais.',
    )
    expect(isPlanLimitError({ message: 'plan_limit:items' })).toBe(true)
    expect(isPlanLimitError({ message: 'item_code_taken' })).toBe(false)
  })

  it('limites de vídeo viram convite para o Pro', () => {
    expect(mapDbError({ message: 'plan_limit:videos_vitrine', hint: '1' })).toBe(
      'Seu plano permite até 1 vídeo por vitrine. Assine o Pro para enviar mais.',
    )
    expect(mapDbError({ message: 'plan_limit:videos_account', hint: '1' })).toBe(
      'Seu plano permite até 1 vídeo na conta. Assine o Pro para enviar mais.',
    )
    expect(mapDbError({ message: 'plan_limit:videos_vitrine', hint: '50' })).toBe(
      'Seu plano permite até 50 vídeos por vitrine. Assine o Pro para enviar mais.',
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
