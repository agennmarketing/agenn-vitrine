import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import type { MediaStorage } from './storage'

// Bucket público do Supabase Storage: grava com a chave secreta e a vitrine lê pela URL pública.
export const MEDIA_BUCKET = 'media'

function isNotFound(error: unknown): boolean {
  const e = error as { status?: number; statusCode?: string; code?: string }
  return e.status === 404 || e.statusCode === '404' || e.code === 'NoSuchKey' || e.code === 'not_found'
}

export function createSupabaseStorage(): MediaStorage {
  const bucket = () => createSupabaseAdminClient().storage.from(MEDIA_BUCKET)
  return {
    async put(path, body, contentType) {
      const { error } = await bucket().upload(path, new Uint8Array(body), { contentType, upsert: true, cacheControl: '31536000' })
      if (error) throw new Error(`Supabase Storage PUT ${path}: ${error.message}`)
    },
    async get(path) {
      const { data, error } = await bucket().download(path)
      if (error) {
        if (isNotFound(error)) return null
        throw new Error(`Supabase Storage GET ${path}: ${error.message}`)
      }
      return new Uint8Array(await data.arrayBuffer())
    },
    async remove(path) {
      // Remover o que não existe não é erro no Supabase: a resposta vem vazia.
      const { error } = await bucket().remove([path])
      if (error && !isNotFound(error)) throw new Error(`Supabase Storage DELETE ${path}: ${error.message}`)
    },
  }
}
