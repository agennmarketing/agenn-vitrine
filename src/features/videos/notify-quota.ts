import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildQuotaEmail, videoMonthKey } from '@/lib/email/quota-email'
import { sendEmail } from '@/lib/email/send-email'
import { env } from '@/lib/env'
import { buildAppUrl } from '@/lib/hosts/urls'
import type { Database } from '@/lib/supabase/database.types'

// Spec 3: ao passar da franquia, o dono é avisado no painel e por e-mail.
// Chamado só quando add_video_usage informa que a franquia acabou de estourar (uma vez por mês).
export async function notifyVideoQuotaExceeded(admin: SupabaseClient<Database>, ownerId: string): Promise<void> {
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(ownerId)
  if (userError) throw userError
  const email = userData.user?.email
  if (!email) return

  const [{ data: profile }, { data: vitrines }, { data: planId }] = await Promise.all([
    admin.from('profiles').select('name').eq('id', ownerId).maybeSingle(),
    admin.from('vitrines').select('name').eq('owner_id', ownerId).order('position').order('created_at'),
    admin.rpc('effective_plan_id', { p_user_id: ownerId }),
  ])
  const { data: plan } = await admin.from('plans').select('monthly_video_gb').eq('id', planId ?? 'essencial').single()

  const now = new Date()
  const message = buildQuotaEmail({
    ownerName: profile?.name ?? '',
    vitrineNames: (vitrines ?? []).map((vitrine) => vitrine.name),
    quotaGb: plan?.monthly_video_gb ?? 1024,
    now,
    panelUrl: buildAppUrl('/painel', env.NEXT_PUBLIC_ROOT_DOMAIN),
  })
  await sendEmail({ to: email, ...message, idempotencyKey: `video-quota-${ownerId}-${videoMonthKey(now)}` })
}
