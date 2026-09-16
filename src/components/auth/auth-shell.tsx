import Image from 'next/image'
import type { ReactNode } from 'react'

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Image src="/brand/logo-icone.png" alt="Agenn Vitrine" width={48} height={48} className="mb-8 rounded-xl" priority />
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-2 text-ink-muted">{description}</p> : null}
        <div className="mt-8">{children}</div>
        {footer ? <div className="mt-6 text-sm text-ink-muted">{footer}</div> : null}
      </div>
    </main>
  )
}
