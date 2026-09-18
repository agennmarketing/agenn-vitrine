import { NextResponse } from 'next/server'
import { AVAILABILITY_ERROR_MESSAGE } from '@/lib/forms/availability'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { SUBDOMAIN_TAKEN_MESSAGE, subdomainField } from '@/lib/vitrines/schemas'

// Checagem enquanto o dono digita (spec 5.1 e 8.3). Era Server Action; virou rota
// para poder ser cancelada e não sujar o log quando a página muda.
export async function GET(request: Request) {
  const url = new URL(request.url)
  const parsed = subdomainField.safeParse(url.searchParams.get('valor') ?? '')
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? 'Endereço inválido.' })
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, message: 'Sessão expirada. Entre de novo.' }, { status: 401 })

  const { data, error } = await supabase.rpc('is_subdomain_available', {
    p_subdomain: parsed.data,
    p_except_vitrine_id: url.searchParams.get('vitrine') ?? undefined,
  })
  if (error) return NextResponse.json({ ok: false, message: AVAILABILITY_ERROR_MESSAGE })

  return NextResponse.json(
    data ? { ok: true, message: 'Endereço disponível.' } : { ok: false, message: SUBDOMAIN_TAKEN_MESSAGE },
  )
}
