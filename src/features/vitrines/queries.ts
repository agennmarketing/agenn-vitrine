import 'server-only'
import { notFound, redirect } from 'next/navigation'
import { cache } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const getPanelSession = cache(async () => {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (typeof userId !== 'string') redirect('/entrar')
  return { supabase, userId }
})

export const getEntitlements = cache(async () => {
  const { supabase } = await getPanelSession()
  const { data, error } = await supabase.rpc('my_entitlements')
  if (error || !data) throw error ?? new Error('my_entitlements vazio')
  return data
})

export async function listMyVitrines() {
  const { supabase } = await getPanelSession()
  const { data, error } = await supabase
    .from('vitrines')
    .select('id, name, subdomain, type, status, created_at')
    .order('position')
    .order('created_at')
  if (error) throw error
  return data
}

export const getMyVitrine = cache(async (id: string) => {
  if (!UUID.test(id)) notFound()
  const { supabase } = await getPanelSession()
  const { data, error } = await supabase.from('vitrines').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) notFound()
  return data
})

export async function getVideoLimits() {
  const plan = await getEntitlements()
  return { maxSeconds: plan.max_video_seconds, maxUploadMb: plan.max_video_upload_mb }
}

export async function getVideoUsage() {
  const { supabase } = await getPanelSession()
  const { data } = await supabase.rpc('my_video_usage')
  const row = data?.[0]
  return {
    videosCount: row?.videos_count ?? 0,
    bytesDelivered: Number(row?.bytes_delivered ?? 0),
    overQuota: row?.over_quota ?? false,
  }
}
