import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { claimSessionOrFail } from '@/lib/auth/claim-session'
import { originFor, safeNextPath } from '@/lib/hosts/urls'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const origin = originFor(request.headers.get('host') ?? '')
  const code = request.nextUrl.searchParams.get('code')
  const next = safeNextPath(request.nextUrl.searchParams.get('next'))
  if (!code) return NextResponse.redirect(`${origin}/entrar?erro=google`)

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return NextResponse.redirect(`${origin}/entrar?erro=google`)

  if (!(await claimSessionOrFail(supabase))) return NextResponse.redirect(`${origin}/entrar?erro=sessao`)
  return NextResponse.redirect(`${origin}${next}`)
}
