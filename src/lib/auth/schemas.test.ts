import { describe, expect, it } from 'vitest'
import { changePasswordSchema, resetPasswordSchema, signInSchema, signUpSchema } from './schemas'

describe('schemas', () => {
  it('cadastro normaliza e valida', () => {
    const ok = signUpSchema.safeParse({ name: '  Ana ', email: ' ANA@Teste.com ', password: '12345678' })
    expect(ok.success && ok.data).toEqual({ name: 'Ana', email: 'ana@teste.com', password: '12345678' })

    const bad = signUpSchema.safeParse({ name: 'A', email: 'x', password: '123' })
    expect(bad.success).toBe(false)
    const messages = bad.success ? [] : bad.error.issues.map((i) => i.message)
    expect(messages).toContain('Informe seu nome.')
    expect(messages).toContain('Informe um e-mail válido.')
    expect(messages).toContain('A senha precisa ter pelo menos 8 caracteres.')
  })

  it('senha acima de 72 caracteres é recusada', () => {
    expect(signUpSchema.safeParse({ name: 'Ana', email: 'a@a.com', password: 'a'.repeat(73) }).success).toBe(false)
  })

  it('login exige senha', () => {
    expect(signInSchema.safeParse({ email: 'a@a.com', password: '' }).success).toBe(false)
  })

  it('redefinição exige senhas iguais', () => {
    const r = resetPasswordSchema.safeParse({ password: '12345678', confirmPassword: '87654321' })
    expect(r.success).toBe(false)
    expect(r.success ? null : r.error.issues[0]).toMatchObject({ path: ['confirmPassword'], message: 'As senhas não conferem.' })
  })

  it('troca de senha exige senha nova diferente', () => {
    const r = changePasswordSchema.safeParse({ currentPassword: '12345678', password: '12345678', confirmPassword: '12345678' })
    expect(r.success).toBe(false)
    expect(r.success ? null : r.error.issues[0]).toMatchObject({ path: ['password'], message: 'A nova senha deve ser diferente da atual.' })
  })
})
