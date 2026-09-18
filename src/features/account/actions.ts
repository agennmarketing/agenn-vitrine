'use server'

import * as Sentry from '@sentry/nextjs'
import { redirect } from 'next/navigation'
import { mapAuthError } from '@/lib/auth/auth-errors'
import { changePasswordSchema, profileNameSchema } from '@/lib/auth/schemas'
import { hasPasswordLogin } from '@/lib/auth/session'
import { fieldErrorsFromZod, type FormState } from '@/lib/forms/form-state'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseVerifierClient } from '@/lib/supabase/verifier'
import { deleteAccount } from './delete-account'

export async function updateNameAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const fields = { name: String(formData.get('name') ?? '') }
  const parsed = profileNameSchema.safeParse(fields)
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error), values: fields }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/entrar')

  const { error } = await supabase.from('profiles').update({ name: parsed.data.name }).eq('id', user.id)
  if (error) return { error: 'Não foi possível salvar. Tente novamente.', values: fields }
  return { success: 'Nome atualizado.', values: { name: parsed.data.name } }
}

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = changePasswordSchema.safeParse({
    currentPassword: String(formData.get('currentPassword') ?? ''),
    password: String(formData.get('password') ?? ''),
    confirmPassword: String(formData.get('confirmPassword') ?? ''),
  })
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error) }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) redirect('/entrar')
  if (!hasPasswordLogin(user.identities)) return { error: 'Esta conta entra pelo Google e não usa senha.' }

  const captchaToken = formData.get('captchaToken')
  const verifier = createSupabaseVerifierClient()
  const { error: verifyError } = await verifier.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
    options: { captchaToken: typeof captchaToken === 'string' && captchaToken ? captchaToken : undefined },
  })
  if (verifyError) {
    if (verifyError.code === 'invalid_credentials') return { fieldErrors: { currentPassword: 'Senha atual incorreta.' } }
    return { error: mapAuthError(verifyError.code) }
  }
  await verifier.auth.signOut({ scope: 'local' })

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) return { error: mapAuthError(error.code) }
  return { success: 'Senha alterada com sucesso.' }
}

export async function signOutEverywhereAction(): Promise<void> {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut({ scope: 'global' })
  redirect('/entrar')
}

export async function deleteAccountAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/entrar')

  const confirm = String(formData.get('confirm') ?? '').trim().toLowerCase()
  if (!user.email || confirm !== user.email.toLowerCase()) {
    return { fieldErrors: { confirm: 'Digite o e-mail da conta para confirmar.' } }
  }

  try {
    await deleteAccount(user.id)
  } catch (error) {
    Sentry.captureException(error)
    console.error('[conta] falha ao excluir', error)
    return { error: 'Não foi possível excluir a conta agora. Tente de novo em instantes.' }
  }

  // O usuário já não existe; só limpamos os cookies desta sessão.
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
  redirect('/entrar?motivo=conta-excluida')
}
