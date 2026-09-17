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

// SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN precisam estar disponíveis em tempo de
// build (não só em runtime) na Vercel, pois é este arquivo — executado
// durante `next build` — que decide entre o SDK real e o stub no-op acima.
// Se faltarem em um build de produção, avisa em vez de falhar silenciosamente
// com o Sentry desligado.
if (process.env.VERCEL_ENV === 'production' && !hasSentryDsn) {
  console.warn(
    '[sentry] VERCEL_ENV=production sem SENTRY_DSN/NEXT_PUBLIC_SENTRY_DSN: o Sentry ficará desligado neste build.',
  )
}

const nextConfig: NextConfig = {
  allowedDevOrigins: ['localhost', '*.localhost'],
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
