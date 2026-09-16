import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { decideAppRoute } from '@/lib/auth/app-routes'
import { isSessionCurrent } from '@/lib/auth/session'
import { env } from '@/lib/env'
import { internalPathFor, parseHost, type HostResolution } from '@/lib/hosts/parse-host'
import type { Database } from '@/lib/supabase/database.types'

export async function proxy(request: NextRequest) {
  const resolution = parseHost(request.headers.get('host'), {
    rootDomain: env.NEXT_PUBLIC_ROOT_DOMAIN,
    legacyDomains: env.LEGACY_DOMAINS,
  })
  const { pathname, search } = request.nextUrl

  if (resolution.type === 'redirect') {
    return NextResponse.redirect(`${request.nextUrl.protocol}//${resolution.host}${pathname}${search}`, 301)
  }
  if (resolution.type === 'app') return handleApp(request, resolution)
  return rewriteTo(request, internalPathFor(resolution, pathname))
}

function rewriteTo(request: NextRequest, pathname: string, init?: Parameters<typeof NextResponse.rewrite>[1]) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  return NextResponse.rewrite(url, init)
}

function copyCookies(target: NextResponse, source: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie))
  return target
}

async function handleApp(request: NextRequest, resolution: HostResolution) {
  let sessionResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        // Recriado a cada chamada: se setAll rodar mais de uma vez (ex.: refresh seguido de
        // signOut), os cookies da última chamada são os que valem no response final.
        sessionResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => sessionResponse.cookies.set(name, value, options))
      },
    },
  })

  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  let userId = typeof claims?.sub === 'string' ? claims.sub : null

  if (userId) {
    // getClaims() só decodifica o JWT local e não enxerga revogação (ex.: signOut em
    // outra aba/requisição): confirmamos com o Auth server antes de tratar como logado,
    // senão um cookie de sessão já revogada pode gerar loop de redirecionamento entre
    // rota protegida e rota de visitante.
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) userId = null
  }

  let sessionCurrent = true
  if (userId) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('active_session_id')
      .eq('id', userId)
      .maybeSingle()
    // Sessão única é proteção contra compartilhamento de conta, não uma fronteira de
    // autenticação: se a consulta falhar, seguimos com a sessão como válida (fail-open),
    // mas registramos o erro para investigação.
    if (profileError) {
      console.error('[proxy] falha ao consultar sessão ativa do perfil', profileError)
    }
    const claimSessionId = typeof claims?.session_id === 'string' ? claims.session_id : undefined
    sessionCurrent = isSessionCurrent(claimSessionId, profile?.active_session_id)
  }

  const decision = decideAppRoute({
    pathname: request.nextUrl.pathname,
    isAuthenticated: Boolean(userId),
    isSessionCurrent: sessionCurrent,
  })

  if (decision.action === 'end-session') {
    await supabase.auth.signOut({ scope: 'local' })
    return copyCookies(NextResponse.redirect(new URL(decision.to, request.url)), sessionResponse)
  }
  if (decision.action === 'redirect') {
    return copyCookies(NextResponse.redirect(new URL(decision.to, request.url)), sessionResponse)
  }
  return copyCookies(
    rewriteTo(request, internalPathFor(resolution, request.nextUrl.pathname), { request }),
    sessionResponse,
  )
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|api/|brand/|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|xml)$).*)'],
}
