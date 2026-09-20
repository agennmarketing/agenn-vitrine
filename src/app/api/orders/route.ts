import * as Sentry from '@sentry/nextjs'
import { NextResponse, type NextRequest } from 'next/server'
import { generateOrderCode } from '@/lib/codes/order-code'
import { env } from '@/lib/env'
import { parseHost } from '@/lib/hosts/parse-host'
import { clientIp, rateLimitKey } from '@/lib/orders/client-ip'
import { buildSnapshotPayload, orderRequestSchema, type SnapshotSourceItem } from '@/lib/orders/snapshot'
import { getOrderRateLimit, getRateLimitSalt } from '@/lib/server-env'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

const fail = (status: number, error: string) => NextResponse.json({ error }, { status })

// Chamada pela vitrine pública (mesmo host). Se falhar, o navegador envia a
// mensagem sem código: a venda nunca é bloqueada (spec 7.5 e 10).
export async function POST(request: NextRequest) {
  const host = parseHost(request.headers.get('host'), {
    rootDomain: env.NEXT_PUBLIC_ROOT_DOMAIN,
    legacyDomains: env.LEGACY_DOMAINS,
  })
  if (host.type !== 'vitrine') return fail(404, 'Vitrine não encontrada.')

  const parsed = orderRequestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return fail(400, 'Pedido inválido.')

  try {
    const admin = createSupabaseAdminClient()
    const key = await rateLimitKey(clientIp(request.headers), 'orders', getRateLimitSalt())
    const { data: allowed, error: limitError } = await admin.rpc('hit_rate_limit', {
      p_key: key,
      p_limit: getOrderRateLimit(),
      p_window_seconds: 3600,
    })
    if (limitError) throw limitError
    if (!allowed) return fail(429, 'Muitos pedidos em pouco tempo. Tente mais tarde.')

    const { data: vitrine } = await admin
      .from('vitrines')
      .select('id, status')
      .eq('subdomain', host.subdomain)
      .maybeSingle()
    if (!vitrine || vitrine.status !== 'active') return fail(404, 'Vitrine não encontrada.')

    const { data: items, error: itemsError } = await admin
      .from('items')
      .select(
        'id, code, name, price_type, price_cents, promo_price_cents, sold_out, item_variations(id, name, price_cents, promo_price_cents, sold_out)',
      )
      .eq('vitrine_id', vitrine.id)
      .in('id', parsed.data.lines.map((line) => line.itemId))
      .is('deleted_at', null)
    if (itemsError) throw itemsError

    const snapshot = buildSnapshotPayload(parsed.data.lines, (items ?? []) as SnapshotSourceItem[])
    if (!snapshot.ok) return fail(422, 'Algum item não está mais disponível.')

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateOrderCode()
      const { data: inserted, error } = await admin.rpc('insert_order_snapshot', {
        p_vitrine_id: vitrine.id,
        p_code: code,
        p_payload: snapshot.payload,
      })
      if (error) throw error
      if (inserted) return NextResponse.json({ code }, { status: 201 })
    }
    return fail(503, 'Não foi possível gerar o código agora.')
  } catch (error) {
    Sentry.captureException(error)
    return fail(503, 'Não foi possível gerar o código agora.')
  }
}
