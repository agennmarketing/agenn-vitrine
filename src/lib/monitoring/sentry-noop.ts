// No-op stand-in for `@sentry/nextjs`.
//
// Why this exists: the real SDK pulls in `import-in-the-middle` /
// `require-in-the-middle` for its OpenTelemetry-based instrumentation. Next.js /
// Turbopack link those packages into `.next/node_modules` via NTFS junction
// points during `next build` / `next dev`. This project's local drive is FAT32
// (removable media), which cannot create junctions, so importing the real
// package here breaks the build with `TurbopackInternalError: failed to create
// junction point`.
//
// `next.config.ts` aliases `@sentry/nextjs` to this stub via
// `turbopack.resolveAlias` whenever no DSN is configured at build time. On
// Vercel (NTFS-backed, no junction issue), setting `SENTRY_DSN` /
// `NEXT_PUBLIC_SENTRY_DSN` switches back to the real SDK and `withSentryConfig`.
//
// Only the members actually imported from `@sentry/nextjs` in this codebase
// need to exist here. Each one is typed against the real SDK (type-only import,
// erased at build time), so `tsc` flags any drift in signatures. Add more as
// needed if new Sentry APIs are used.

type SentrySdk = typeof import('@sentry/nextjs')

export const init: SentrySdk['init'] = () => undefined

export const captureRequestError: SentrySdk['captureRequestError'] = () => {}

export const captureRouterTransitionStart: SentrySdk['captureRouterTransitionStart'] = () => {}

export const captureConsoleIntegration: SentrySdk['captureConsoleIntegration'] = () => ({ name: 'CaptureConsole' })

export const captureException: SentrySdk['captureException'] = () => ''

export const captureMessage: SentrySdk['captureMessage'] = () => ''
