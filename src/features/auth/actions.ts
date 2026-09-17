'use server'

import { redirect } from 'next/navigation'
import { mapAuthError } from '@/lib/auth/auth-errors'
import { claimSessionOrFail } from '@/lib/auth/claim-session'
import { forgotPasswordSchema, resetPasswordSchema, signInSchema, signUpSchema } from '@/lib/auth/schemas'
import { isRecentEmailLinkSession } from '@/lib/auth/session'
import { fieldErrorsFromZod, type FormState } from '@/lib/forms/form-state'
import { safeNextPath } from '@/lib/hosts/urls'
import { createSupabaseServerClient } from '@/lib/supabase/server'

function readFields<const K extends string>(formData: FormData, keys: readonly K[]): Record<K, string> {
  return Object.fromEntries(keys.map((key) => [key, String(formData.get(key) ?? '')])) as Record<K, string>
}

function readCaptcha(formData: FormData): string | undefined {
  const token = formData.get('captchaToken')
  return typeof token === 'string' && token ? token : undefined
}

export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const fields = readFields(formData, ['name', 'email', 'password'])
  const keep = { name: fields.name, email: fields.email }
  const parsed = signUpSchema.safeParse(fields)
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error), values: keep }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { name: parsed.data.name }, captchaToken: readCaptcha(formData) },
  })
  if (error) return { error: mapAuthError(error.code), values: keep }

  redirect(`/confirmar-email?email=${encodeURIComponent(parsed.data.email)}`)
}

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const fields = readFields(formData, ['email', 'password'])
  const keep = { email: fields.email }
  const parsed = signInSchema.safeParse(fields)
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error), values: keep }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { captchaToken: readCaptcha(formData) },
  })
  if (error) return { error: mapAuthError(error.code), values: keep }

  if (!(await claimSessionOrFail(supabase))) return { error: 'Algo deu errado. Tente novamente.', values: keep }
  redirect(safeNextPath(String(formData.get('next') ?? '')))
}

export async function resendConfirmationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse({ email: String(formData.get('email') ?? '') })
  if (!parsed.success) return { error: 'Informe um e-mail válido.' }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: parsed.data.email,
    options: { captchaToken: readCaptcha(formData) },
  })
  if (error) return { error: mapAuthError(error.code) }
  return { success: 'Enviamos um novo link. Confira sua caixa de entrada e o spam.' }
}

export async function forgotPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const fields = readFields(formData, ['email'])
  const parsed = forgotPasswordSchema.safeParse(fields)
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error), values: fields }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    captchaToken: readCaptcha(formData),
  })
  // Não revela se o e-mail existe. Só limite de envio e captcha viram erro.
  if (error && ['over_email_send_rate_limit', 'over_request_rate_limit', 'captcha_failed'].includes(error.code ?? '')) {
    return { error: mapAuthError(error.code), values: fields }
  }
  return { success: 'Se existir uma conta com este e-mail, enviamos um link para redefinir a senha.' }
}

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse(readFields(formData, ['password', 'confirmPassword']))
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error) }

  const supabase = await createSupabaseServerClient()
  // Sem senha atual, só quem acabou de abrir o link de recuperação pode criar nova senha.
  const { data: claimsData } = await supabase.auth.getClaims()
  if (!isRecentEmailLinkSession(claimsData?.claims?.amr)) {
    return { error: 'Link de recuperação expirado. Solicite um novo.' }
  }
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) return { error: mapAuthError(error.code) }

  redirect('/painel')
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut({ scope: 'local' })
  redirect('/entrar')
}
