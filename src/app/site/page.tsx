import { Brush, ChevronRight, Eye, Flower2, Link2, Paintbrush, Scissors, ShoppingBag, Wind, type LucideIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { SiteFooter, SiteHeader } from './_vendas/chrome'
import { PERSONAS, type Persona } from './_vendas/personas'
import styles from './_vendas/vendas.module.css'

export const metadata: Metadata = {
  title: { absolute: 'Vitrimove · Vitrine on-line com agenda e pedidos no WhatsApp' },
  description:
    'Vitrine on-line feita para o seu negócio: agenda para manicure, salão, barbearia, lash, sobrancelha e estética, ou catálogo com pedido no WhatsApp e links de afiliado. 7 dias grátis, sem cartão.',
}

const ICONS: Record<string, LucideIcon> = {
  manicure: Paintbrush,
  cabeleireiro: Wind,
  barbearia: Scissors,
  lash: Eye,
  sobrancelha: Brush,
  estetica: Flower2,
  loja: ShoppingBag,
  afiliado: Link2,
}

function Choice({ persona }: { persona: Persona }) {
  const Icon = ICONS[persona.slug] ?? ShoppingBag
  return (
    <li>
      <Link href={`/${persona.slug}`} className={styles.choice}>
        <span className={styles.choiceIcon} aria-hidden="true">
          <Icon className="size-6" strokeWidth={2.5} />
        </span>
        <span className="flex-1">{persona.label}</span>
        <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-ink-muted" strokeWidth={3} />
      </Link>
    </li>
  )
}

export default function MarketingHome() {
  const services = PERSONAS.filter((persona) => persona.group === 'servicos')
  const products = PERSONAS.filter((persona) => persona.group === 'produtos')

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <div className="flex flex-col items-center text-center">
          <Image src="/site/vitri.webp" alt="" width={900} height={776} priority unoptimized className={styles.chooserVitri} />
          <h1 className={`${styles.display} mt-5`}>
            <span className="sr-only">Vitrimove: </span>O que você faz?
          </h1>
          <p className="mt-4 max-w-md text-lg font-semibold leading-relaxed text-ink-muted">
            Escolha o seu negócio e veja a vitrine feita para ele.
          </p>
        </div>

        <section aria-labelledby="grupo-produtos" className="mt-12">
          <h2 id="grupo-produtos" className="text-[1.0625rem] font-black tracking-[-0.01em] text-ink">
            Vendo produtos
          </h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {products.map((persona) => (
              <Choice key={persona.slug} persona={persona} />
            ))}
          </ul>
        </section>

        <section aria-labelledby="grupo-servicos" className="mt-10">
          <h2 id="grupo-servicos" className="text-[1.0625rem] font-black tracking-[-0.01em] text-ink">
            Atendo com hora marcada
          </h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {services.map((persona) => (
              <Choice key={persona.slug} persona={persona} />
            ))}
          </ul>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
