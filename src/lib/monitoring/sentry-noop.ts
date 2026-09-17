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
// (`init`, `captureRequestError`, `captureRouterTransitionStart`) need to exist
// here. Add more as needed if new Sentry APIs are used.

export function init(): void {}

export function captureRequestError(): void {}

export function captureRouterTransitionStart(): void {}
