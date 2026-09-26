'use client'

import { CalendarDays, Crown, Store, UserRound } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS = [
  { href: '/painel', label: 'Vitrine', Icon: Store },
  { href: '/painel/agenda', label: 'Agenda', Icon: CalendarDays },
  { href: '/painel/plano', label: 'Plano', Icon: Crown },
  { href: '/painel/conta', label: 'Conta', Icon: UserRound },
] as const

// Vitrine de produtos não tem agenda: a seção some da navegação em vez de redirecionar.
function items(showAgenda: boolean) {
  return showAgenda ? ITEMS : ITEMS.filter((item) => item.href !== '/painel/agenda')
}

function isActive(pathname: string, href: string) {
  if (href === '/painel') return pathname === '/painel' || pathname.startsWith('/painel/vitrines')
  return pathname === href || pathname.startsWith(`${href}/`)
}

// Barra lateral (computador): o ativo ganha placa lilás-clara e texto roxo.
export function SideNav({ showAgenda = true }: { showAgenda?: boolean }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Principal" className="flex flex-col gap-0.5">
      {items(showAgenda).map(({ href, label, Icon }) => {
        const active = isActive(pathname, href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`flex h-11 items-center gap-3 rounded-control px-3 text-[0.9375rem] font-extrabold transition-colors duration-150 ${
              active ? 'bg-go-soft text-go-strong' : 'text-ink-muted hover:bg-subtle hover:text-ink'
            }`}
          >
            <Icon aria-hidden="true" className="size-5 shrink-0" strokeWidth={active ? 2.5 : 2.25} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

// Barra inferior (celular): quatro destinos rotulados ao alcance do polegar.
export function BottomNav({ showAgenda = true }: { showAgenda?: boolean }) {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] group-has-[[data-focus-mode]]/shell:hidden lg:hidden"
    >
      <ul className={`mx-auto grid max-w-md ${showAgenda ? 'grid-cols-4' : 'grid-cols-3'}`}>
        {items(showAgenda).map(({ href, label, Icon }) => {
          const active = isActive(pathname, href)
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-[0.75rem] font-extrabold ${
                  active ? 'text-go-strong' : 'text-ink-muted'
                }`}
              >
                <span
                  className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors duration-200 ${
                    active ? 'bg-go-soft' : ''
                  }`}
                >
                  <Icon aria-hidden="true" className="size-[1.375rem]" strokeWidth={active ? 2.75 : 2.25} />
                </span>
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
