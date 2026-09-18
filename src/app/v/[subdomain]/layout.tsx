import type { ReactNode } from 'react'
import { vitrineFont } from '@/lib/fonts-vitrine'

export default function VitrineLayout({ children }: { children: ReactNode }) {
  return <div className={vitrineFont.className}>{children}</div>
}
