import type { EmailOtpType } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { originFor } from '@/lib/hosts/urls'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const ALLOWED_TYPES: readonly EmailOtpType[] = ['email', 'signup', 'recovery']

export async function GET(request: NextRequest) {
  const origin = originFor(request.headers.get('host') ?? '')
  const tokenHash = request.nextUrl.searchParams.get('token_hash')
  const type = request.nextUrl.searchParams.get('type') as EmailOtpType | null
  if (!tokenHash || !type || !ALLOWED_TYPES.includes(type)) {
    return NextResponse.redirect(`${origin}/entrar?erro=link-invalido`)
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
  if (error) return NextResponse.redirect(`${origin}/entrar?erro=link-invalido`)

  await supabase.rpc('claim_session')
  return NextResponse.redirect(`${origin}${type === 'recovery' ? '/redefinir-senha' : '/painel'}`)
}
