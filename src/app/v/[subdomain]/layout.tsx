import type { ReactNode } from 'react'
import { ServiceWorker } from '@/components/pwa/service-worker'
import { vitrineFont } from '@/lib/fonts-vitrine'

export default function VitrineLayout({ children }: { children: ReactNode }) {
  return (
    <div className={vitrineFont.className}>
      {children}
      {/* A vitrine pode ser instalada como aplicativo pelo cliente. */}
      <ServiceWorker />
    </div>
  )
}
