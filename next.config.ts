import { withSentryConfig } from '@sentry/nextjs/config'
import type { NextConfig } from 'next'

// FAT32 removable drives (this project's local dev environment) cannot create
// the NTFS junction points Turbopack needs to link @sentry/nextjs's
// OpenTelemetry dependencies (import-in-the-middle / require-in-the-middle)
// into `.next/node_modules`, which breaks `next build` / `next dev` with
// `TurbopackInternalError: failed to create junction point`. When no DSN is
// configured at build time, alias `@sentry/nextjs` to a local no-op stub and
// skip `withSentryConfig` so Turbopack never touches those packages. On
// Vercel (NTFS-backed, no junction issue) setting `SENTRY_DSN` /
// `NEXT_PUBLIC_SENTRY_DSN` enables the real SDK below.
const hasSentryDsn = Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN)

// Produção é produção em qualquer hospedagem: a Vercel informa VERCEL_ENV, e nas
// outras (Cloudflare) a gente define APP_ENV.
const isProduction = (process.env.APP_ENV ?? process.env.VERCEL_ENV) === 'production'

// SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN precisam estar disponíveis em tempo de
// build (não só em runtime) na Vercel, pois é este arquivo — executado
// durante `next build` — que decide entre o SDK real e o stub no-op acima.
// Se faltarem em um build de produção, avisa em vez de falhar silenciosamente
// com o Sentry desligado.
if (isProduction && !hasSentryDsn) {
  console.warn('[sentry] build de produção sem SENTRY_DSN/NEXT_PUBLIC_SENTRY_DSN: o Sentry ficará desligado neste build.')
}

// Cabeçalhos de segurança para todas as rotas (página inicial, app e vitrines).
// Nenhuma página é feita para ser embutida em iframe. HSTS só em produção, para
// não fixar HTTPS em localhost nem em prévias.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  ...(isProduction ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }] : []),
]

const nextConfig: NextConfig = {
  allowedDevOrigins: ['localhost', '*.localhost'],
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
  ...(hasSentryDsn
    ? {}
    : {
        turbopack: {
          resolveAlias: {
            '@sentry/nextjs': './src/lib/monitoring/sentry-noop.ts',
          },
        },
      }),
}

export default hasSentryDsn
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: !process.env.CI,
    })
  : nextConfig
