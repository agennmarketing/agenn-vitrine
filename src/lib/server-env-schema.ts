import { z } from 'zod'

type Source = Record<string, string | undefined>

const mediaStorageSchema = z
  .object({
    MEDIA_STORAGE_DRIVER: z.enum(['bunny', 'fake']).default('bunny'),
    BUNNY_STORAGE_ZONE: z.string().default(''),
    BUNNY_STORAGE_PASSWORD: z.string().default(''),
    BUNNY_STORAGE_HOST: z.string().default('br.storage.bunnycdn.com'),
    VERCEL_ENV: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.MEDIA_STORAGE_DRIVER === 'bunny' && (!value.BUNNY_STORAGE_ZONE || !value.BUNNY_STORAGE_PASSWORD)) {
      ctx.addIssue({ code: 'custom', message: 'BUNNY_STORAGE_ZONE e BUNNY_STORAGE_PASSWORD são obrigatórias com o driver bunny.' })
    }
    if (value.MEDIA_STORAGE_DRIVER === 'fake' && value.VERCEL_ENV === 'production') {
      ctx.addIssue({ code: 'custom', message: 'MEDIA_STORAGE_DRIVER=fake não pode ser usado em produção.' })
    }
  })

export type MediaStorageEnv = { driver: 'fake' } | { driver: 'bunny'; zone: string; password: string; host: string }

export function parseMediaStorageEnv(source: Source): MediaStorageEnv {
  const value = mediaStorageSchema.parse(source)
  if (value.MEDIA_STORAGE_DRIVER === 'fake') return { driver: 'fake' }
  return { driver: 'bunny', zone: value.BUNNY_STORAGE_ZONE, password: value.BUNNY_STORAGE_PASSWORD, host: value.BUNNY_STORAGE_HOST }
}

export function parseRateLimitSalt(source: Source): string {
  return z.string().min(16, 'RATE_LIMIT_SALT precisa de pelo menos 16 caracteres.').parse(source.RATE_LIMIT_SALT)
}

export function parseSupabaseSecretKey(source: Source): string {
  return z.string().min(1, 'SUPABASE_SECRET_KEY não configurada.').parse(source.SUPABASE_SECRET_KEY)
}

export function parseOrderRateLimit(source: Source): number {
  return z.coerce.number().int().min(1).default(20).parse(source.ORDER_RATE_LIMIT_PER_HOUR ?? undefined)
}
