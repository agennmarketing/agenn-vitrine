import type { ReactNode } from 'react'
import { appFont } from '@/lib/fonts'

export default function SiteAreaLayout({ children }: { children: ReactNode }) {
  return <div className={`${appFont.className} min-h-dvh`}>{children}</div>
}
