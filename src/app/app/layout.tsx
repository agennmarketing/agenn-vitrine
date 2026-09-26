import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { ServiceWorker } from '@/components/pwa/service-worker'
import { appFont } from '@/lib/fonts'
import { PAINEL_MANIFEST_PATH } from '@/lib/pwa/manifest'

// O painel é instalável: o profissional cuida da vitrine e da agenda como aplicativo.
export const metadata: Metadata = {
  manifest: PAINEL_MANIFEST_PATH,
  appleWebApp: { capable: true, title: 'Vitrimove', statusBarStyle: 'default' },
}

export default function AppAreaLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${appFont.className} min-h-dvh`}>
      {children}
      <ServiceWorker />
    </div>
  )
}
