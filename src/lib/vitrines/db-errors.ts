import { NO_ACCESS_MESSAGE } from '@/lib/billing/status'
import { ITEM_CODE_MESSAGES } from '@/lib/codes/item-code'

type DbError = { code?: string; message?: string; hint?: string } | null | undefined

const GENERIC = 'Não foi possível salvar. Tente novamente.'

export function isPlanLimitError(error: DbError): boolean {
  return Boolean(error?.message?.startsWith('plan_limit:'))
}

export function mapDbError(error: DbError): string {
  if (!error) return GENERIC
  const limit = Number(error.hint)
  // Limite zero é a conta sem teste nem assinatura valendo (plano 'bloqueado').
  if (isPlanLimitError(error) && limit === 0) return NO_ACCESS_MESSAGE
  switch (error.message) {
    case 'plan_limit:vitrines':
      // Uma vitrine por conta: é a regra do produto.
      return 'Cada conta pode ter uma vitrine. Edite a que você já tem.'
    case 'plan_limit:items':
      return `Seu plano permite até ${limit} itens por vitrine.`
    case 'plan_limit:videos_vitrine':
      return `Seu plano permite até ${limit} ${limit === 1 ? 'vídeo' : 'vídeos'} por vitrine.`
    case 'plan_limit:videos_account':
      return `Seu plano permite até ${limit} ${limit === 1 ? 'vídeo' : 'vídeos'} na conta.`
    case 'item_code_taken':
      return ITEM_CODE_MESSAGES.taken
    case 'item_deleted':
      return 'Este item foi excluído.'
    case 'vitrine_not_found':
      return 'Vitrine não encontrada.'
    case 'appointment_not_found':
      return 'Este agendamento não está mais confirmado. Recarregue a página.'
    case 'slot_unavailable':
      return 'Esse horário está ocupado ou bloqueado. Escolha outro.'
    case 'slot_in_past':
      return 'Esse horário já passou. Escolha outro.'
  }
  if (error.message?.startsWith('invalid_reference:')) {
    return 'Algum dado escolhido não pertence a esta vitrine. Recarregue a página.'
  }
  if (error.code === '23505' && error.message?.includes('vitrines_subdomain_key')) {
    return 'Este endereço já está em uso. Escolha outro.'
  }
  return GENERIC
}
