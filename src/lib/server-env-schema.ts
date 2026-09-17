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

const videoStreamSchema = z
  .object({
    VIDEO_STREAM_DRIVER: z.enum(['bunny', 'fake']).default('bunny'),
    BUNNY_STREAM_LIBRARY_ID: z.string().default(''),
    BUNNY_STREAM_API_KEY: z.string().default(''),
    VERCEL_ENV: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.VIDEO_STREAM_DRIVER === 'bunny' && (!value.BUNNY_STREAM_LIBRARY_ID || !value.BUNNY_STREAM_API_KEY)) {
      ctx.addIssue({ code: 'custom', message: 'BUNNY_STREAM_LIBRARY_ID e BUNNY_STREAM_API_KEY são obrigatórias com o driver bunny.' })
    }
    if (value.VIDEO_STREAM_DRIVER === 'fake' && value.VERCEL_ENV === 'production') {
      ctx.addIssue({ code: 'custom', message: 'VIDEO_STREAM_DRIVER=fake não pode ser usado em produção.' })
    }
  })

export type VideoStreamEnv = { driver: 'fake' } | { driver: 'bunny'; libraryId: string; apiKey: string }

export function parseVideoStreamEnv(source: Source): VideoStreamEnv {
  const value = videoStreamSchema.parse(source)
  if (value.VIDEO_STREAM_DRIVER === 'fake') return { driver: 'fake' }
  return { driver: 'bunny', libraryId: value.BUNNY_STREAM_LIBRARY_ID, apiKey: value.BUNNY_STREAM_API_KEY }
}

export function parseWebhookSecret(source: Source): string {
  return z.string().min(8, 'BUNNY_STREAM_WEBHOOK_SECRET não configurada.').parse(source.BUNNY_STREAM_WEBHOOK_SECRET)
}

export function parseCronSecret(source: Source): string {
  return z.string().min(16, 'CRON_SECRET precisa de pelo menos 16 caracteres.').parse(source.CRON_SECRET)
}

const emailSchema = z
  .object({
    EMAIL_DRIVER: z.enum(['off', 'fake', 'resend']).default('off'),
    RESEND_API_KEY: z.string().default(''),
    EMAIL_FROM: z.string().default(''),
    VERCEL_ENV: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.EMAIL_DRIVER === 'resend' && (!value.RESEND_API_KEY || !value.EMAIL_FROM)) {
      ctx.addIssue({ code: 'custom', message: 'RESEND_API_KEY e EMAIL_FROM são obrigatórias com EMAIL_DRIVER=resend.' })
    }
    if (value.EMAIL_DRIVER === 'fake' && value.VERCEL_ENV === 'production') {
      ctx.addIssue({ code: 'custom', message: 'EMAIL_DRIVER=fake não pode ser usado em produção.' })
    }
  })

export type EmailEnv = { driver: 'off' } | { driver: 'fake' } | { driver: 'resend'; apiKey: string; from: string }

export function parseEmailEnv(source: Source): EmailEnv {
  const value = emailSchema.parse(source)
  if (value.EMAIL_DRIVER === 'resend') return { driver: 'resend', apiKey: value.RESEND_API_KEY, from: value.EMAIL_FROM }
  return { driver: value.EMAIL_DRIVER }
}
