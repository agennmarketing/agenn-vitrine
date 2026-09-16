import { describe, expect, it } from 'vitest'
import { loginNotice, mapAuthError, SESSION_REPLACED_MESSAGE } from './auth-errors'

describe('mapAuthError', () => {
  it('traduz códigos conhecidos', () => {
    expect(mapAuthError('invalid_credentials')).toBe('E-mail ou senha incorretos.')
    expect(mapAuthError('email_not_confirmed')).toBe('Confirme seu e-mail antes de entrar.')
    expect(mapAuthError('user_already_exists')).toBe('Já existe uma conta com este e-mail.')
    expect(mapAuthError('same_password')).toBe('A nova senha deve ser diferente da atual.')
    expect(mapAuthError('over_email_send_rate_limit')).toBe('Muitas tentativas. Aguarde alguns minutos e tente de novo.')
  })
  it('tem mensagem padrão', () => {
    expect(mapAuthError(undefined)).toBe('Algo deu errado. Tente novamente.')
    expect(mapAuthError('qualquer_coisa')).toBe('Algo deu errado. Tente novamente.')
  })
})

describe('loginNotice', () => {
  it('mensagens da tela de login', () => {
    expect(loginNotice({ motivo: 'outro-aparelho' })).toEqual({ kind: 'error', text: SESSION_REPLACED_MESSAGE })
    expect(SESSION_REPLACED_MESSAGE).toBe('Sua conta foi acessada em outro aparelho.')
    expect(loginNotice({ erro: 'link-invalido' })).toEqual({ kind: 'error', text: 'Link inválido ou expirado. Solicite um novo.' })
    expect(loginNotice({ erro: 'google' })).toEqual({ kind: 'error', text: 'Não foi possível entrar com o Google. Tente novamente.' })
    expect(loginNotice({ aviso: 'senha-alterada' })).toEqual({ kind: 'success', text: 'Senha alterada. Entre com a nova senha.' })
    expect(loginNotice({})).toBeNull()
  })
})
