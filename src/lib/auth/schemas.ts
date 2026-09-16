import { z } from 'zod'

const name = z.string().trim().min(2, 'Informe seu nome.').max(80, 'O nome pode ter no máximo 80 caracteres.')
const email = z.string().trim().toLowerCase().email('Informe um e-mail válido.')
const newPassword = z
  .string()
  .min(8, 'A senha precisa ter pelo menos 8 caracteres.')
  .max(72, 'A senha pode ter no máximo 72 caracteres.')

export const signUpSchema = z.object({ name, email, password: newPassword })

export const signInSchema = z.object({ email, password: z.string().min(1, 'Informe sua senha.') })

export const forgotPasswordSchema = z.object({ email })

export const resetPasswordSchema = z
  .object({ password: newPassword, confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não conferem.',
    path: ['confirmPassword'],
  })

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual.'),
    password: newPassword,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password !== data.currentPassword, {
    message: 'A nova senha deve ser diferente da atual.',
    path: ['password'],
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não conferem.',
    path: ['confirmPassword'],
  })

export const profileNameSchema = z.object({ name })
