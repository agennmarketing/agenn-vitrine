'use server'

import * as Sentry from '@sentry/nextjs'
import { redirect } from 'next/navigation'
import { requireActionUser } from '@/lib/auth/action-user'
import { getBilling } from '@/lib/billing/billing'
import type { BillingInterval } from '@/lib/billing/types'
import { env } from '@/lib/env'
import type { FormState } from '@/lib/forms/form-state'
import { buildAppUrl } from '@/lib/hosts/urls'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { revalidateVitrine } from '@/lib/vitrines/cache'
import { mapDbError } from '@/lib/vitrines/db-errors'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CHECKOUT_FAILED = 'Não foi possível abrir o pagamento. Tente de novo em instantes.'
const PORTAL_FAILED = 'Não foi possível abrir o gerenciamento da assinatura. Tente de novo em instantes.'

export async function startCheckoutAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const interval: BillingInterval = formData.get('interval') === 'year' ? 'year' : 'month'
  const { supabase, user } = await requireActionUser()

  let url: string
  try {
    const billing = getBilling()
    const admin = createSupabaseAdminClient()
    const [{ data: row }, { data: profile }] = await Promise.all([
      admin.from('subscriptions').select('stripe_customer_id').eq('user_id', user.id).maybeSingle(),
      supabase.from('profiles').select('name').eq('id', user.id).maybeSingle(),
    ])

    const customerId = await billing.ensureCustomer({
      userId: user.id,
      email: user.email ?? '',
      name: profile?.name ?? '',
      customerId: row?.stripe_customer_id ?? null,
    })
    // Guarda o Customer antes de abrir o checkout: um webhook que chegue primeiro
    // já encontra o dono pela coluna stripe_customer_id.
    if (customerId !== row?.stripe_customer_id) {
      const { error } = await admin.from('subscriptions').upsert({ user_id: user.id, stripe_customer_id: customerId })
      if (error) throw error
    }

    url = await billing.createCheckoutSession({
      userId: user.id,
      customerId,
      priceId: billing.priceIdFor(interval),
      successUrl: buildAppUrl('/painel/plano?assinatura=ok', env.NEXT_PUBLIC_ROOT_DOMAIN),
      cancelUrl: buildAppUrl('/painel/plano', env.NEXT_PUBLIC_ROOT_DOMAIN),
    })
  } catch (error) {
    Sentry.captureException(error)
    return { error: CHECKOUT_FAILED }
  }
  redirect(url)
}

// Sem parâmetros: o portal não tem campos, e useActionState aceita uma ação mais curta.
export async function openPortalAction(): Promise<FormState> {
  const { user } = await requireActionUser()

  let url: string
  try {
    const admin = createSupabaseAdminClient()
    const { data: row, error } = await admin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) throw error
    if (!row?.stripe_customer_id) return { error: 'Você ainda não tem assinatura para gerenciar.' }

    url = await getBilling().createPortalSession({
      customerId: row.stripe_customer_id,
      returnUrl: buildAppUrl('/painel/plano', env.NEXT_PUBLIC_ROOT_DOMAIN),
    })
  } catch (error) {
    Sentry.captureException(error)
    return { error: PORTAL_FAILED }
  }
  redirect(url)
}

// Spec 8.7: com mais vitrines do que o plano permite, o dono escolhe qual fica ativa.
export async function chooseActiveVitrineAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const vitrineId = String(formData.get('vitrineId') ?? '')
  if (!UUID.test(vitrineId)) return { error: 'Escolha uma vitrine.' }

  const { supabase } = await requireActionUser()
  const { data: subdomains, error } = await supabase.rpc('choose_active_vitrine', { p_vitrine_id: vitrineId })
  if (error) return { error: mapDbError(error) }

  revalidateVitrine(...(subdomains ?? []))
  return { success: 'Vitrine ativa atualizada.' }
}
