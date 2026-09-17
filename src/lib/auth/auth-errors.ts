export const SESSION_REPLACED_MESSAGE = 'Sua conta foi acessada em outro aparelho.'

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'E-mail ou senha incorretos.',
  email_not_confirmed: 'Confirme seu e-mail antes de entrar.',
  user_already_exists: 'Já existe uma conta com este e-mail.',
  email_exists: 'Já existe uma conta com este e-mail.',
  weak_password: 'Escolha uma senha mais forte.',
  same_password: 'A nova senha deve ser diferente da atual.',
  captcha_failed: 'Não conseguimos verificar que você é humano. Recarregue a página e tente de novo.',
  over_email_send_rate_limit: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
  over_request_rate_limit: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
  otp_expired: 'Link inválido ou expirado. Solicite um novo.',
  session_not_found: 'Sua sessão expirou. Entre novamente.',
}

export function mapAuthError(code: string | undefined): string {
  return (code && AUTH_ERROR_MESSAGES[code]) || 'Algo deu errado. Tente novamente.'
}

export function loginNotice(params: {
  motivo?: string
  erro?: string
  aviso?: string
}): { kind: 'error' | 'success'; text: string } | null {
  if (params.motivo === 'outro-aparelho') return { kind: 'error', text: SESSION_REPLACED_MESSAGE }
  if (params.erro === 'link-invalido') return { kind: 'error', text: 'Link inválido ou expirado. Solicite um novo.' }
  if (params.erro === 'google') return { kind: 'error', text: 'Não foi possível entrar com o Google. Tente novamente.' }
  if (params.erro === 'sessao') return { kind: 'error', text: 'Não foi possível iniciar sua sessão. Tente novamente.' }
  if (params.aviso === 'senha-alterada') return { kind: 'success', text: 'Senha alterada. Entre com a nova senha.' }
  return null
}
