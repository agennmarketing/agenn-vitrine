import { ITEM_CODE_MESSAGES } from '@/lib/codes/item-code'

type DbError = { code?: string; message?: string; hint?: string } | null | undefined

const GENERIC = 'Não foi possível salvar. Tente novamente.'

export function isPlanLimitError(error: DbError): boolean {
  return Boolean(error?.message?.startsWith('plan_limit:'))
}

export function mapDbError(error: DbError): string {
  if (!error) return GENERIC
  const limit = Number(error.hint)
  switch (error.message) {
    case 'plan_limit:vitrines':
      return `Seu plano permite até ${limit} ${limit === 1 ? 'vitrine' : 'vitrines'}. Assine o Pro para criar mais.`
    case 'plan_limit:items':
      return `Seu plano permite até ${limit} itens por vitrine. Assine o Pro para cadastrar mais.`
    case 'plan_limit:videos_vitrine':
      return `Seu plano permite até ${limit} ${limit === 1 ? 'vídeo' : 'vídeos'} por vitrine. Assine o Pro para enviar mais.`
    case 'plan_limit:videos_account':
      return `Seu plano permite até ${limit} ${limit === 1 ? 'vídeo' : 'vídeos'} na conta. Assine o Pro para enviar mais.`
    case 'item_code_taken':
      return ITEM_CODE_MESSAGES.taken
    case 'item_deleted':
      return 'Este item foi excluído.'
    case 'vitrine_not_found':
      return 'Vitrine não encontrada.'
  }
  if (error.message?.startsWith('invalid_reference:')) {
    return 'Algum dado escolhido não pertence a esta vitrine. Recarregue a página.'
  }
  if (error.code === '23505' && error.message?.includes('vitrines_subdomain_key')) {
    return 'Este endereço já está em uso. Escolha outro.'
  }
  return GENERIC
}
