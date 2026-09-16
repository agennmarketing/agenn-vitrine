import type { Metadata, Viewport } from 'next'
import { Figtree } from 'next/font/google'
import './globals.css'

// Figtree: sans geométrica de terminais suaves, como o traço do logo; cobre bem os acentos do português.
const figtree = Figtree({ variable: '--font-figtree', subsets: ['latin', 'latin-ext'], display: 'swap' })

export const metadata: Metadata = {
  title: { default: 'Agenn Vitrine', template: '%s · Agenn Vitrine' },
  description: 'Catálogos e cardápios com vídeo, prontos para o WhatsApp.',
  applicationName: 'Agenn Vitrine',
  openGraph: { locale: 'pt_BR', siteName: 'Agenn Vitrine' },
}

export const viewport: Viewport = { themeColor: '#0b2a1c', colorScheme: 'light' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={figtree.variable}>
      <body>{children}</body>
    </html>
  )
}
