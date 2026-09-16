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
})

export type Env = z.infer<typeof envSchema>

export function parseEnv(source: Record<string, string | undefined>): Env {
  return envSchema.parse(source)
}
