import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getApiUser } from '@/lib/auth/require-user'
import { env } from '@/lib/env'
import { heightFor, IMAGE_SPECS } from '@/lib/media/image-specs'
import { deleteMediaRows, removeStoredFiles } from '@/lib/media/remove-media'
import { getMediaStorage } from '@/lib/media/storage'
import { imageSources } from '@/lib/media/urls'
import { validateImageFile } from '@/lib/media/validate-image'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { revalidateVitrine } from '@/lib/vitrines/cache'

const fieldsSchema = z
  .object({
    role: z.enum(['cover', 'gallery', 'logo', 'banner']),
    vitrineId: z.uuid(),
    itemId: z.uuid().nullable(),
    position: z.coerce.number().int().min(1).max(2).nullable(),
  })
  .refine((value) => value.role !== 'gallery' || value.position !== null)
  .refine((value) => (value.role === 'logo' || value.role === 'banner' ? value.itemId === null : true))

const REASON_MESSAGE = {
  size: 'Imagem grande demais. Tente outra foto.',
  type: 'Formato não suportado. Envie uma foto JPG, PNG ou WebP.',
  dimensions: 'Não foi possível processar a imagem. Tente novamente.',
} as const

const fail = (status: number, error: string) => NextResponse.json({ error }, { status })

export async function POST(request: Request) {
  const session = await getApiUser()
  if (!session) return fail(401, 'Sua sessão expirou. Entre novamente.')

  const form = await request.formData()
  const text = (key: string) => {
    const value = form.get(key)
    return typeof value === 'string' && value !== '' ? value : null
  }
  const parsed = fieldsSchema.safeParse({
    role: text('role'),
    vitrineId: text('vitrineId'),
    itemId: text('itemId'),
    position: text('position'),
  })
  if (!parsed.success) return fail(400, 'Dados do envio inválidos.')
  const { role, vitrineId, itemId, position } = parsed.data
  const { supabase, userId } = session

  const { data: vitrine } = await supabase.from('vitrines').select('id, subdomain').eq('id', vitrineId).maybeSingle()
  if (!vitrine) return fail(404, 'Vitrine não encontrada.')
  if (itemId) {
    const { data: item } = await supabase
      .from('items')
      .select('id')
      .eq('id', itemId)
      .eq('vitrine_id', vitrineId)
      .is('deleted_at', null)
      .maybeSingle()
    if (!item) return fail(404, 'Item não encontrado.')
  }
  if (role === 'logo' || role === 'banner') {
    const { data: plan } = await supabase.rpc('my_entitlements')
    if (!plan?.allow_branding) return fail(403, 'Logo e banner são recursos do plano Pro.')
  }

  const spec = IMAGE_SPECS[role]
  const files: { width: number; bytes: Uint8Array; ext: string; contentType: string }[] = []
  for (const [index, key] of (['small', 'large'] as const).entries()) {
    const file = form.get(key)
    if (!(file instanceof File)) return fail(400, 'Arquivo ausente.')
    const width = spec.widths[index]
    const bytes = new Uint8Array(await file.arrayBuffer())
    const result = validateImageFile(bytes, { width, height: heightFor(role, width), maxBytes: spec.maxBytes[index] })
    if (!result.ok) return fail(422, REASON_MESSAGE[result.reason])
    files.push({ width, bytes, ext: result.format.ext, contentType: result.format.contentType })
  }

  const mediaId = crypto.randomUUID()
  const storagePaths = Object.fromEntries(
    files.map((file) => [String(file.width), `${userId}/${vitrineId}/${mediaId}-${file.width}.${file.ext}`]),
  )
  // Configuração do servidor (armazenamento, chave secreta) conferida antes de enviar qualquer
  // arquivo: se faltar algo, nada fica órfão no Storage.
  let storage: ReturnType<typeof getMediaStorage>
  let admin: ReturnType<typeof createSupabaseAdminClient>
  try {
    storage = getMediaStorage()
    admin = createSupabaseAdminClient()
  } catch (error) {
    Sentry.captureException(error)
    return fail(503, 'Envio de imagens indisponível no momento. Tente mais tarde.')
  }

  try {
    await Promise.all(files.map((file) => storage.put(storagePaths[String(file.width)], file.bytes, file.contentType)))
  } catch (error) {
    Sentry.captureException(error)
    await removeStoredFiles(Object.values(storagePaths))
    return fail(502, 'Não foi possível enviar a imagem. Tente novamente.')
  }

  const large = files[files.length - 1]
  const insertRow = {
    id: mediaId,
    owner_id: userId,
    vitrine_id: vitrineId,
    item_id: itemId,
    role,
    kind: 'image' as const,
    position: role === 'gallery' ? position! : 0,
    storage_paths: storagePaths,
    width: large.width,
    height: heightFor(role, large.width),
    bytes: files.reduce((sum, file) => sum + file.bytes.length, 0),
    status: 'ready' as const,
  }

  try {
    // Mídia que ocupa o mesmo espaço (capa, posição da galeria, logo ou banner) é substituída.
    if (itemId || role === 'logo' || role === 'banner') {
      let previousQuery = admin.from('media').select('id, storage_paths, mux_upload_id, mux_asset_id').eq('vitrine_id', vitrineId).eq('role', role)
      if (itemId) previousQuery = previousQuery.eq('item_id', itemId)
      if (role === 'gallery') previousQuery = previousQuery.eq('position', position!)
      const { data: previous, error: previousError } = await previousQuery
      if (previousError) throw previousError
      await deleteMediaRows(admin, previous ?? [])
    }
    const { error } = await admin.from('media').insert(insertRow)
    if (error) throw error
    if (role === 'logo' || role === 'banner') {
      const link = role === 'logo' ? { logo_media_id: mediaId } : { banner_media_id: mediaId }
      const { error: linkError } = await admin.from('vitrines').update(link).eq('id', vitrineId)
      if (linkError) throw linkError
    }
  } catch (error) {
    Sentry.captureException(error)
    await removeStoredFiles(Object.values(storagePaths))
    return fail(500, 'Não foi possível salvar a imagem. Tente novamente.')
  }

  if (itemId || role === 'logo' || role === 'banner') revalidateVitrine(vitrine.subdomain)
  const sources = imageSources(storagePaths, env.NEXT_PUBLIC_MEDIA_BASE_URL)
  return NextResponse.json({ id: mediaId, url: sources?.small }, { status: 201 })
}
