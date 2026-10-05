import type { ReactNode } from 'react'
import { WhatsAppHelp } from '@/components/support/whatsapp-help'
import { appFont } from '@/lib/fonts'

export default function SiteAreaLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${appFont.className} min-h-dvh`}>
      {children}
      <WhatsAppHelp area="site" />
    </div>
  )
}
