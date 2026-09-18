import { NextResponse } from 'next/server'
import { ITEM_CODE_MESSAGES, validateItemCode } from '@/lib/codes/item-code'
import { AVAILABILITY_ERROR_MESSAGE } from '@/lib/forms/availability'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const result = validateItemCode(url.searchParams.get('valor') ?? '')
  if (!result.ok) return NextResponse.json({ ok: false, message: ITEM_CODE_MESSAGES[result.reason] })

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, message: 'Sessão expirada. Entre de novo.' }, { status: 401 })

  const { data, error } = await supabase.rpc('is_item_code_available', {
    p_code: result.value,
    p_item_id: url.searchParams.get('item') ?? undefined,
  })
  if (error) return NextResponse.json({ ok: false, message: AVAILABILITY_ERROR_MESSAGE })

  return NextResponse.json(
    data ? { ok: true, message: 'Código disponível.' } : { ok: false, message: ITEM_CODE_MESSAGES.taken },
  )
}
