import 'server-only'
import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { getVideoService } from '@/lib/video/video-service'
import { getMediaStorage } from './storage'
import { storagePathList } from './urls'

type VideoRow = { mux_upload_id?: string | null; mux_asset_id?: string | null }

export async function removeStoredFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  const storage = getMediaStorage()
  const results = await Promise.allSettled(paths.map((path) => storage.remove(path)))
  // Arquivo que ficou para trás é removido pela limpeza diária de órfãos (Fase 3).
  for (const result of results) if (result.status === 'rejected') Sentry.captureException(result.reason)
}

// Apagar a mídia também apaga o vídeo no provedor. Quando o envio ainda não virou
// asset, o id do asset é buscado pelo id do envio antes de apagar.
export async function removeVideoAssets(rows: ReadonlyArray<VideoRow>): Promise<void> {
  const videos = rows.filter((row) => row.mux_asset_id || row.mux_upload_id)
  if (videos.length === 0) return
  try {
    const service = getVideoService()
    const results = await Promise.allSettled(
      videos.map(async (row) => {
        let assetId = row.mux_asset_id ?? null
        if (!assetId) assetId = (await service.status({ uploadId: row.mux_upload_id!, assetId: null }))?.assetId ?? null
        if (assetId) await service.delete(assetId)
      }),
    )
    for (const result of results) if (result.status === 'rejected') Sentry.captureException(result.reason)
  } catch (error) {
    // Configuração ausente: o vídeo fica no provedor até a próxima limpeza.
    Sentry.captureException(error)
  }
}

export async function deleteMediaRows(
  admin: SupabaseClient<Database>,
  rows: ReadonlyArray<{ id: string; storage_paths: unknown } & VideoRow>,
): Promise<void> {
  if (rows.length === 0) return
  const { error } = await admin.from('media').delete().in('id', rows.map((row) => row.id))
  if (error) throw error
  await Promise.all([removeStoredFiles(rows.flatMap((row) => storagePathList(row.storage_paths))), removeVideoAssets(rows)])
}

// Duplicar item: cada cópia tem arquivos próprios.
export async function copyMediaFiles(storagePaths: unknown, newPrefix: string): Promise<Record<string, string>> {
  const storage = getMediaStorage()
  const copied: Record<string, string> = {}
  for (const [width, path] of Object.entries((storagePaths ?? {}) as Record<string, string>)) {
    const bytes = await storage.get(path)
    if (!bytes) throw new Error(`Arquivo de mídia ausente: ${path}`)
    const ext = path.endsWith('.jpg') ? 'jpg' : 'webp'
    const target = `${newPrefix}-${width}.${ext}`
    await storage.put(target, bytes, ext === 'jpg' ? 'image/jpeg' : 'image/webp')
    copied[width] = target
  }
  return copied
}
