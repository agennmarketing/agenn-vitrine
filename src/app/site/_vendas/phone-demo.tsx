import { Clock, CupSoda, Droplet, ExternalLink, Flame, Flower2, Gift, Headphones, Palette, Plus, ShoppingBag, type LucideIcon } from 'lucide-react'
import type { CSSProperties } from 'react'
import { vitrineFont } from '@/lib/fonts-vitrine'
import type { Persona } from './personas'
import styles from './vendas.module.css'

// Só desenho: a "foto" de cada produto de exemplo é um ladrilho na cor do lojista.
const PRODUCT_ICONS: Record<string, LucideIcon> = {
  'Vela aromática': Flame,
  'Sabonete de argila': Droplet,
  'Difusor de varetas': Flower2,
  'Kit presente': Gift,
  'Fone sem fio': Headphones,
  'Organizador de maquiagem': Palette,
  'Garrafa térmica': CupSoda,
}

/** Celular com uma vitrine de exemplo, na cor do negócio do perfil. Decorativo: o texto ao lado explica. */
export function PhoneDemo({ persona }: { persona: Persona }) {
  const { demo } = persona
  const vars = { '--m': demo.color } as CSSProperties

  return (
    <div className={`${styles.phone} ${vitrineFont.className}`} style={vars}>
      <div className={styles.phoneScreen}>
        <div className={styles.phoneBar}>
          <span className="numeric">9:41</span>
          <span className={styles.phoneUrl}>{demo.subdomain}.vitrimove.site</span>
        </div>

        <div className={styles.demoBanner} />
        <div className="relative px-4">
          <div className={styles.demoAvatar}>{demo.initials}</div>
          <p className="mt-2 text-[1.0625rem] font-extrabold leading-tight tracking-[-0.02em] text-[#17181b]">{demo.store}</p>
          <p className="text-[0.75rem] font-medium text-[#5c5d66]">{demo.tagline}</p>
        </div>

        {demo.kind === 'servicos' ? (
          <>
            <ul className="mt-3 flex flex-col gap-2 px-4">
              {demo.services.map((service, index) => (
                <li key={service.name} className={`${styles.demoRow} ${index === 0 ? styles.demoRowPicked : ''}`}>
                  <span className="min-w-0">
                    <span className="block truncate text-[0.8125rem] font-bold text-[#17181b]">{service.name}</span>
                    <span className="flex items-center gap-1 text-[0.6875rem] font-medium text-[#5c5d66]">
                      <Clock aria-hidden="true" className="size-3" strokeWidth={2.5} />
                      {service.duration}
                    </span>
                  </span>
                  <span className="numeric shrink-0 text-[0.75rem] font-bold text-[#17181b]">{service.price}</span>
                </li>
              ))}
            </ul>

            <div className={styles.demoSheet}>
              <p className="text-[0.8125rem] font-extrabold text-[#17181b]">
                {demo.pros ? 'Com quem e que horas?' : 'Escolha o horário'}
                <span className="ml-1 font-medium text-[#5c5d66]">· sáb, 4 de out</span>
              </p>
              {demo.pros ? (
                <div className="mt-2 flex gap-1.5">
                  {demo.pros.map((pro, index) => (
                    <span key={pro} className={`${styles.demoPro} ${index === 0 ? styles.demoProPicked : ''}`}>
                      {pro}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {demo.slots.map((slot) => (
                  <span
                    key={slot.time}
                    className={`numeric ${styles.demoSlot} ${slot.busy ? styles.demoSlotBusy : ''} ${slot.time === demo.picked ? styles.demoSlotPicked : ''}`}
                  >
                    {slot.time}
                  </span>
                ))}
              </div>
              <span className={styles.demoButton}>Confirmar às {demo.picked}</span>
            </div>
          </>
        ) : null}

        {demo.kind === 'loja' ? (
          <>
            <ul className="mt-3 grid grid-cols-2 gap-2.5 px-4">
              {demo.products.map((product) => {
                const Icon = PRODUCT_ICONS[product.name] ?? ShoppingBag
                return (
                  <li key={product.name}>
                    <span className={styles.demoTile}>
                      <Icon aria-hidden="true" className="size-7" strokeWidth={2} />
                      <span className={styles.demoPlus} aria-hidden="true">
                        <Plus className="size-3.5" strokeWidth={3} />
                      </span>
                    </span>
                    <span className="mt-1 block truncate text-[0.75rem] font-semibold text-[#17181b]">{product.name}</span>
                    <span className="numeric block text-[0.75rem] font-bold text-[#17181b]">{product.price}</span>
                  </li>
                )
              })}
            </ul>
            <div className={styles.demoBag}>
              <span className={styles.demoBagCount}>{demo.bag.count}</span>
              <span className="flex-1">Ver sacola</span>
              <span className="numeric">{demo.bag.total}</span>
            </div>
          </>
        ) : null}

        {demo.kind === 'afiliado' ? (
          <ul className="mt-3 flex flex-col gap-2.5 px-4">
            {demo.products.map((product) => {
              const Icon = PRODUCT_ICONS[product.name] ?? ShoppingBag
              return (
                <li key={product.name} className={styles.demoAffiliate}>
                  <span className={styles.demoTileSmall}>
                    <Icon aria-hidden="true" className="size-6" strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.8125rem] font-bold text-[#17181b]">{product.name}</span>
                    <span className="block text-[0.6875rem] font-medium text-[#5c5d66]">na {product.store}</span>
                    <span className="numeric block text-[0.75rem] font-bold text-[#17181b]">{product.price}</span>
                    <span className={styles.demoBuy}>
                      Comprar agora
                      <ExternalLink aria-hidden="true" className="size-3" strokeWidth={2.75} />
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
