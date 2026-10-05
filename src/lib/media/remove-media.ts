import 'server-only'
import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { getMediaStorage } from './storage'
import { storagePathList } from './urls'

export async function removeStoredFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  const storage = getMediaStorage()
  const results = await Promise.allSettled(paths.map((path) => storage.remove(path)))
  // Arquivo que ficou para trás é removido pela limpeza diária de órfãos (Fase 3).
  for (const result of results) if (result.status === 'rejected') Sentry.captureException(result.reason)
}

export async function deleteMediaRows(
  admin: SupabaseClient<Database>,
  rows: ReadonlyArray<{ id: string; storage_paths: unknown }>,
): Promise<void> {
  if (rows.length === 0) return
  const { error } = await admin.from('media').delete().in('id', rows.map((row) => row.id))
  if (error) throw error
  await removeStoredFiles(rows.flatMap((row) => storagePathList(row.storage_paths)))
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
