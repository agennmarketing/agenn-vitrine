import { z } from 'zod'

export const envSchema = z.object({
  NEXT_PUBLIC_ROOT_DOMAIN: z.string().trim().min(1).toLowerCase(),
  LEGACY_DOMAINS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((domain) => domain.trim().toLowerCase())
        .filter(Boolean),
    ),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().default(''),
  NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: z
    .string()
    .default('false')
    .transform((value) => value === 'true'),
  NEXT_PUBLIC_MEDIA_BASE_URL: z
    .string()
    .default('')
    .transform((value) => value.trim().replace(/\/+$/, '')),
})
  // As imagens moram no bucket público `media` do Supabase. Sem URL base (ou com a do Bunny,
  // que foi aposentado) a vitrine montaria links quebrados: usa a URL pública do próprio projeto.
  .transform((value) => {
    const media = value.NEXT_PUBLIC_MEDIA_BASE_URL
    if (media && !/\.b-cdn\.net$/i.test(new URL(media, 'http://local').hostname)) return value
    const supabase = value.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, '')
    return { ...value, NEXT_PUBLIC_MEDIA_BASE_URL: `${supabase}/storage/v1/object/public/media` }
  })

export type Env = z.infer<typeof envSchema>

export function parseEnv(source: Record<string, string | undefined>): Env {
  return envSchema.parse(source)
}
