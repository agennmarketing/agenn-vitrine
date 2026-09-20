'use client'

import { Clock, ChevronRight, Plus, Search, ShoppingBag } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { PublicImage, PublicItem, PublicVitrine } from '@/features/public/build-catalog'
import { formatBRL } from '@/lib/money/money'
import { addToCart, replaceLine, type CartLine } from '@/lib/cart/cart'
import { cartSummary } from '@/lib/cart/reconcile'
import { formatOrderTotal, formatPriceLabel, priceLabel } from '@/lib/pricing/price'
import { BannerVideo } from './banner-video'
import { useCart } from './cart-store'
import { useItemParam } from './item-param'
import { vitrineTheme } from './theme'
import { brandButtonClass, TagList } from './vitrine-ui'

// Tela do item, galeria e envio só carregam quando um item é aberto.
const ItemSheet = dynamic(() => import('./item-sheet'), { ssr: false })
const CartSheet = dynamic(() => import('./cart-sheet'), { ssr: false })

function fold(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function srcSet(image: PublicImage) {
  return `${image.small} ${image.smallWidth}w, ${image.large} ${image.largeWidth}w`
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('')
}

const container = 'mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8'
// No computador o avatar entra um pouco para dentro do banner, sem colar no canto arredondado.
const headerContainer = 'mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-14'

export function Catalog({ vitrine, siteUrl }: { vitrine: PublicVitrine; siteUrl: string }) {
  const { itemCode, openItem, closeItem } = useItemParam()
  const { lines, setLines } = useCart(vitrine.id)
  const [cartOpen, setCartOpen] = useState(false)
  const [editing, setEditing] = useState<CartLine | null>(null)
  const itemsById = useMemo(
    () => new Map(vitrine.categories.flatMap((category) => category.items).map((item) => [item.id, item])),
    [vitrine.categories],
  )
  const summary = cartSummary(lines, itemsById)
  const cartLabel = `Ver sacola · ${summary.count} ${summary.count === 1 ? 'item' : 'itens'}${
    vitrine.showPrices ? ` · ${formatOrderTotal(summary.total)}` : ''
  }`
  const [query, setQuery] = useState('')
  // Começa na primeira categoria: a faixa já mostra onde o cliente está antes de rolar.
  const [activeCategory, setActiveCategory] = useState<string | null>(vitrine.categories[0]?.id ?? null)
  const navRef = useRef<HTMLUListElement>(null)

  const search = fold(query.trim())
  const categories = useMemo(
    () =>
      vitrine.categories
        .map((category) => ({
          ...category,
          items: search
            ? category.items.filter((item) => fold(item.name).includes(search) || fold(item.code).includes(search))
            : category.items,
        }))
        .filter((category) => category.items.length > 0),
    [vitrine.categories, search],
  )
  const openItemData = itemCode
    ? vitrine.categories.flatMap((category) => category.items).find((item) => item.code === itemCode)
    : undefined

  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>('section[data-category]')
    if (sections.length === 0 || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting)
        if (visible[0]) setActiveCategory((visible[0].target as HTMLElement).dataset.category ?? null)
      },
      { rootMargin: '-30% 0px -60% 0px' },
    )
    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [categories])

  // A pílula da categoria ativa acompanha a rolagem e fica sempre à vista na faixa.
  useEffect(() => {
    const list = navRef.current
    const pill = list?.querySelector<HTMLElement>('[aria-current="true"]')
    if (!list || !pill) return
    const left = pill.offsetLeft - list.clientWidth / 2 + pill.offsetWidth / 2
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    list.scrollTo({ left, behavior: reduced ? 'auto' : 'smooth' })
  }, [activeCategory])

  const { style, canvas } = useMemo(() => vitrineTheme(vitrine.brandColor, vitrine.theme), [vitrine.brandColor, vitrine.theme])
  const type = vitrine.type
  const firstCategory = vitrine.categories.find((category) => category.items.length > 0)

  const cartButton = vitrine.cartEnabled ? (
    <button
      type="button"
      aria-label="Abrir sacola"
      onClick={() => setCartOpen(true)}
      className="relative flex size-12 items-center justify-center rounded-full bg-surface/90 text-ink shadow-[0_4px_16px_rgb(0_0_0/0.18)] ring-1 ring-line backdrop-blur transition-transform duration-150 active:scale-95"
    >
      <ShoppingBag aria-hidden="true" className="size-[1.375rem]" strokeWidth={2.25} />
      {/* O texto completo é "Sacola (N)"; na tela aparece só o número no selo. */}
      <span className="sr-only">Sacola (</span>
      <span
        key={summary.count}
        className={
          summary.count > 0
            ? 'numeric absolute -right-1 -top-1 flex h-6 min-w-6 animate-bump items-center justify-center rounded-full bg-brand px-1.5 text-xs font-bold text-brand-ink ring-2 ring-canvas'
            : 'sr-only'
        }
      >
        {summary.count}
      </span>
      <span className="sr-only">)</span>
    </button>
  ) : null

  const bannerClass = 'aspect-[16/10] w-full object-cover sm:aspect-[5/2] lg:aspect-[16/5]'
  const hasBanner = Boolean(vitrine.bannerVideo || vitrine.banner)

  return (
    <div data-theme={vitrine.theme} style={style} className={`min-h-dvh bg-canvas text-ink ${vitrine.cartEnabled ? 'pb-24' : ''}`}>
      {/* Fundo do documento no tom da vitrine (rolagem elástica do celular não mostra outra cor). */}
      <style>{`html,body{background:${canvas}}`}</style>

      <div className="relative mx-auto max-w-[1200px] lg:px-8 lg:pt-6">
        {vitrine.bannerVideo ? (
          <div className="overflow-hidden bg-subtle lg:rounded-[1.75rem]">
            <BannerVideo video={vitrine.bannerVideo} className={bannerClass} />
          </div>
        ) : vitrine.banner ? (
          <div className="overflow-hidden bg-subtle lg:rounded-[1.75rem]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={vitrine.banner.large}
              srcSet={srcSet(vitrine.banner)}
              sizes="(min-width: 1200px) 1136px, (min-width: 1024px) calc(100vw - 64px), 100vw"
              alt=""
              fetchPriority="high"
              className={bannerClass}
            />
          </div>
        ) : (
          <div aria-hidden="true" className="h-24 bg-brand-soft sm:h-28 lg:h-32 lg:rounded-[1.75rem]" />
        )}
        {cartButton ? <div className="absolute right-4 top-4 sm:right-6 lg:right-12 lg:top-10">{cartButton}</div> : null}
      </div>

      <StoreHeader
        vitrine={vitrine}
        hasBanner={hasBanner}
        // O botão do cabeçalho leva à lista; o pedido do serviço acontece na tela do serviço.
        action={
          type === 'servicos' && firstCategory ? (
            <a href={`#cat-${firstCategory.id}`} className={`${brandButtonClass} h-12 w-full px-6 text-[0.9375rem] sm:w-auto`}>
              Ver serviços
            </a>
          ) : null
        }
      />

      <div className={`${container} mt-5`}>
        <div className="relative lg:max-w-md">
          <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-muted" strokeWidth={2.25} />
          <input
            type="search"
            aria-label="Buscar por nome ou código"
            placeholder="Buscar por nome ou código"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-12 w-full rounded-full border-2 border-line bg-surface pl-12 pr-4 text-base text-ink transition-colors duration-150 placeholder:text-ink-muted hover:border-line-strong focus-visible:border-(--color-accent)"
          />
        </div>
      </div>

      {categories.length > 0 ? (
        <nav aria-label="Categorias" className="sticky top-0 z-30 mt-4 border-b border-line bg-canvas/95">
          <ul ref={navRef} className={`${container} flex gap-2 overflow-x-auto py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}>
            {categories.map((category) => {
              const active = activeCategory === category.id
              return (
                <li key={category.id} className="shrink-0">
                  <a
                    href={`#cat-${category.id}`}
                    aria-current={active ? 'true' : undefined}
                    className={`flex h-10 items-center rounded-full px-4 text-sm font-semibold no-underline transition-colors duration-200 ${
                      active
                        ? 'bg-brand text-brand-ink shadow-[inset_0_0_0_1.5px_var(--color-brand-edge)]'
                        : 'bg-surface text-ink ring-1 ring-line hover:ring-line-strong'
                    }`}
                  >
                    {category.name}
                  </a>
                </li>
              )
            })}
          </ul>
        </nav>
      ) : null}

      <main className={`${container} flex flex-col gap-10 pb-12 pt-6`}>
        {categories.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-ink-muted">Nenhum item encontrado.</p>
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="rounded-full px-4 py-2 text-sm font-semibold underline decoration-2 underline-offset-4"
              >
                Limpar busca
              </button>
            ) : null}
          </div>
        ) : null}
        {categories.map((category) => (
          <section
            key={category.id}
            id={`cat-${category.id}`}
            data-category={category.id}
            aria-labelledby={`cat-${category.id}-title`}
            className="scroll-mt-20"
          >
            <h2 id={`cat-${category.id}-title`} className="mb-3 text-xl font-extrabold tracking-[-0.02em] sm:text-2xl">
              {category.name}
            </h2>
            <ItemList type={type} items={category.items} vitrine={vitrine} onOpen={openItem} />
          </section>
        ))}
      </main>

      {vitrine.showWatermark ? (
        <footer className={`${container} pb-8 text-center`}>
          <a
            href={siteUrl}
            className="inline-flex items-center rounded-full px-3 py-2 text-xs font-medium text-ink-muted no-underline transition-colors hover:text-ink"
          >
            Feito com Vitrimove
          </a>
        </footer>
      ) : null}

      {itemCode && openItemData ? (
        <ItemSheet
          vitrine={vitrine}
          item={openItemData}
          onClose={closeItem}
          cart={
            vitrine.cartEnabled
              ? {
                  onSubmit: (line) => {
                    setLines(addToCart(lines, line))
                    closeItem()
                  },
                }
              : undefined
          }
        />
      ) : null}

      {editing && itemsById.get(editing.itemId) ? (
        <ItemSheet
          vitrine={vitrine}
          item={itemsById.get(editing.itemId)!}
          onClose={() => setEditing(null)}
          cart={{
            initial: editing,
            onSubmit: (line) => {
              setLines(replaceLine(lines, editing.key, line))
              setEditing(null)
              setCartOpen(true)
            },
          }}
        />
      ) : null}

      {cartOpen ? (
        <CartSheet
          vitrine={vitrine}
          lines={lines}
          setLines={setLines}
          items={itemsById}
          onEdit={(line) => {
            setCartOpen(false)
            setEditing(line)
          }}
          onClose={() => setCartOpen(false)}
        />
      ) : null}

      {vitrine.cartEnabled && summary.count > 0 && !cartOpen && !editing && !itemCode ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 animate-rise px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            aria-label={cartLabel}
            onClick={() => setCartOpen(true)}
            className="pointer-events-auto mx-auto flex h-16 w-full max-w-md items-center gap-3 rounded-full bg-brand pl-2 pr-6 text-left text-brand-ink shadow-float ring-1 ring-(--color-brand-edge) transition-transform duration-150 ease-out-quint active:scale-[0.98]"
          >
            <span
              key={summary.count}
              className="numeric flex size-12 shrink-0 animate-bump items-center justify-center rounded-full bg-brand-ink/15 text-base font-extrabold"
            >
              {summary.count}
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="font-bold">Ver sacola</span>
              <span className="text-sm opacity-80">{summary.count === 1 ? '1 item' : `${summary.count} itens`}</span>
            </span>
            {vitrine.showPrices ? (
              <span className="numeric ml-auto text-lg font-extrabold">{formatOrderTotal(summary.total)}</span>
            ) : (
              <ShoppingBag aria-hidden="true" className="ml-auto size-5" strokeWidth={2.5} />
            )}
          </button>
        </div>
      ) : null}
    </div>
  )
}

function StoreHeader({ vitrine, hasBanner, action }: { vitrine: PublicVitrine; hasBanner: boolean; action: ReactNode }) {
  // Serviços: cabeçalho de perfil (nome ao lado do avatar), subindo sobre o banner no celular.
  const profile = vitrine.type === 'servicos'
  const overlap = profile && hasBanner
  const title = <h1 className="text-2xl font-extrabold leading-tight tracking-[-0.025em] sm:text-3xl">{vitrine.name}</h1>

  return (
    <header
      className={`${headerContainer} relative ${
        overlap ? '-mt-6 rounded-t-[1.75rem] bg-canvas pt-5 lg:mt-0 lg:rounded-none lg:bg-transparent lg:pt-0' : ''
      }`}
    >
      <div className={`flex gap-4 ${overlap ? 'items-center lg:-mt-12 lg:items-end' : '-mt-10 items-end sm:-mt-12'}`}>
        <span className="block size-20 shrink-0 rounded-full bg-surface ring-4 ring-canvas sm:size-24 lg:size-28">
          {vitrine.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={vitrine.logo.small} alt="" width={112} height={112} className="size-full rounded-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center rounded-full bg-brand text-2xl font-extrabold tracking-[-0.02em] text-brand-ink shadow-[inset_0_0_0_1.5px_var(--color-brand-edge)] sm:text-3xl">
              {initials(vitrine.name)}
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1 pb-1">{profile ? title : null}</div>
        {action ? <div className="hidden shrink-0 pb-1 sm:block">{action}</div> : null}
      </div>
      {profile ? null : <div className="mt-3">{title}</div>}
      {vitrine.description ? (
        <p className="mt-2 max-w-[65ch] whitespace-pre-line text-[0.9375rem] leading-relaxed text-ink-muted">{vitrine.description}</p>
      ) : null}
      {action ? <div className="mt-4 sm:hidden">{action}</div> : null}
    </header>
  )
}

function ItemList({
  type,
  items,
  vitrine,
  onOpen,
}: {
  type: PublicVitrine['type']
  items: PublicItem[]
  vitrine: PublicVitrine
  onOpen: (code: string) => void
}) {
  const props = { showMedia: vitrine.showMedia, showPrices: vitrine.showPrices, onOpen }
  if (type === 'comida') {
    return (
      <ul className="grid divide-y divide-line lg:grid-cols-2 lg:gap-x-10 lg:divide-y-0 lg:[&>li]:border-b lg:[&>li]:border-line">
        {items.map((item) => (
          <li key={item.id}>
            <FoodRow item={item} {...props} />
          </li>
        ))}
      </ul>
    )
  }
  if (type === 'servicos') {
    return (
      <ul className="grid grid-cols-2 gap-3 max-[359px]:grid-cols-1 sm:gap-4 lg:grid-cols-3">
        {items.map((item) => (
          <li key={item.id} className="flex">
            <ServiceCard item={item} {...props} />
          </li>
        ))}
      </ul>
    )
  }
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-8">
      {items.map((item) => (
        <li key={item.id} className="flex">
          <ProductCard item={item} {...props} />
        </li>
      ))}
    </ul>
  )
}

type CardProps = { item: PublicItem; showMedia: boolean; showPrices: boolean; onOpen: (code: string) => void }

function Price({ item, className = '' }: { item: PublicItem; className?: string }) {
  const label = priceLabel(item, item.variations)
  return (
    <span className={`numeric flex flex-wrap items-baseline gap-x-1.5 ${className}`}>
      {label.kind === 'price' && label.originalCents !== null ? (
        <s className="text-[0.8125rem] font-medium text-ink-muted">{formatBRL(label.originalCents)}</s>
      ) : null}
      <span>{formatPriceLabel(label)}</span>
    </span>
  )
}

function Duration({ minutes }: { minutes: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-ink-muted">
      <Clock aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
      {minutes} min
    </span>
  )
}

function SoldOut({ overlay = false }: { overlay?: boolean }) {
  return (
    <span
      className={`w-fit rounded-full bg-ink px-2.5 py-1 text-xs font-bold text-canvas ${overlay ? 'absolute left-2 top-2' : ''}`}
    >
      Esgotado
    </span>
  )
}

function Cover({ image, sizes, soldOut, className = '' }: { image: PublicImage | null; sizes: string; soldOut: boolean; className?: string }) {
  if (!image) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image.small}
      srcSet={srcSet(image)}
      sizes={sizes}
      loading="lazy"
      decoding="async"
      alt=""
      width={4}
      height={5}
      className={`size-full object-cover transition-transform duration-500 ease-out-quint ${soldOut ? 'grayscale' : ''} ${className}`}
    />
  )
}

function PlusBubble({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`flex items-center justify-center rounded-full bg-brand text-brand-ink shadow-[inset_0_0_0_1.5px_var(--color-brand-edge),0_4px_12px_rgb(0_0_0/0.18)] transition-transform duration-200 ease-out-back group-hover:scale-110 group-active:scale-90 ${className}`}
    >
      <Plus className="size-[55%]" strokeWidth={3} />
    </span>
  )
}

// Comida: a foto manda. Texto à esquerda, foto quadrada à direita com o "+".
function FoodRow({ item, showMedia, showPrices, onOpen }: CardProps) {
  return (
    <button
      type="button"
      aria-label={item.name}
      onClick={() => onOpen(item.code)}
      className="group flex w-full items-start gap-4 py-4 text-left"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className={`text-[1.0625rem] font-bold leading-snug ${item.soldOut ? 'text-ink-muted' : ''}`}>{item.name}</span>
        {item.description ? <span className="line-clamp-2 text-sm leading-snug text-ink-muted">{item.description}</span> : null}
        {showPrices ? <Price item={item} className="mt-1 text-[0.9375rem] font-bold" /> : null}
        {item.durationMinutes ? <Duration minutes={item.durationMinutes} /> : null}
        <TagList tags={item.tags} className="mt-1" />
        {item.soldOut && !(showMedia && item.cover) ? <span className="mt-1"><SoldOut /></span> : null}
      </span>
      {showMedia ? (
        <span className="relative size-28 shrink-0 sm:size-32">
          <span className="block size-full overflow-hidden rounded-2xl bg-subtle">
            <Cover image={item.cover} sizes="(min-width: 640px) 128px, 112px" soldOut={item.soldOut} />
          </span>
          {item.soldOut && item.cover ? <SoldOut overlay /> : null}
          {!item.soldOut ? <PlusBubble className="absolute bottom-1.5 right-1.5 size-10 ring-4 ring-canvas" /> : null}
        </span>
      ) : !item.soldOut ? (
        <PlusBubble className="mt-0.5 size-10 shrink-0" />
      ) : null}
    </button>
  )
}

// Serviços: cartão com imagem, "a partir de", duração e seta.
function ServiceCard({ item, showMedia, showPrices, onOpen }: CardProps) {
  return (
    <button
      type="button"
      aria-label={item.name}
      onClick={() => onOpen(item.code)}
      className="group flex w-full flex-col overflow-hidden rounded-card bg-surface text-left ring-1 ring-line transition-shadow duration-200 hover:shadow-[0_10px_28px_-12px_rgb(0_0_0/0.3)]"
    >
      {showMedia ? (
        <span className="relative block aspect-[4/3] overflow-hidden bg-subtle">
          <Cover image={item.cover} sizes="(min-width: 1024px) 360px, (min-width: 360px) 50vw, 100vw" soldOut={item.soldOut} className="group-hover:scale-[1.03]" />
          {item.soldOut ? <SoldOut overlay /> : null}
        </span>
      ) : null}
      <span className="flex flex-1 flex-col gap-1.5 p-3 sm:p-4">
        <span className={`line-clamp-2 font-bold leading-snug ${item.soldOut ? 'text-ink-muted' : ''}`}>{item.name}</span>
        {item.description ? <span className="line-clamp-2 text-sm leading-snug text-ink-muted max-sm:hidden">{item.description}</span> : null}
        <TagList tags={item.tags} />
        {item.soldOut && !showMedia ? <SoldOut /> : null}
        <span className="mt-auto flex items-end justify-between gap-2 pt-1">
          <span className="flex min-w-0 flex-col gap-0.5">
            {showPrices ? <Price item={item} className="text-sm font-bold" /> : null}
            {item.durationMinutes ? <Duration minutes={item.durationMinutes} /> : null}
          </span>
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-(--color-accent) transition-transform duration-200 ease-out-quint group-hover:translate-x-0.5"
          >
            <ChevronRight className="size-4" strokeWidth={3} />
          </span>
        </span>
      </span>
    </button>
  )
}

// Produtos: grade limpa, imagem 4:5, nome, preço e "+" pequeno.
function ProductCard({ item, showMedia, showPrices, onOpen }: CardProps) {
  return (
    <button
      type="button"
      aria-label={item.name}
      onClick={() => onOpen(item.code)}
      className={`group flex w-full flex-col gap-2.5 text-left ${showMedia ? '' : 'rounded-card bg-surface p-3 ring-1 ring-line'}`}
    >
      {showMedia ? (
        <span className="relative block aspect-[4/5] w-full overflow-hidden rounded-card bg-subtle">
          <Cover
            image={item.cover}
            sizes="(min-width: 1200px) 270px, (min-width: 1024px) 23vw, (min-width: 640px) 31vw, 48vw"
            soldOut={item.soldOut}
            className="group-hover:scale-[1.03]"
          />
          {item.soldOut ? <SoldOut overlay /> : null}
        </span>
      ) : null}
      <span className="flex items-start justify-between gap-2 px-0.5">
        <span className="flex min-w-0 flex-col gap-1">
          <span className={`line-clamp-2 text-sm font-semibold leading-snug sm:text-[0.9375rem] ${item.soldOut ? 'text-ink-muted' : ''}`}>
            {item.name}
          </span>
          {showPrices ? <Price item={item} className="text-[0.9375rem] font-bold" /> : null}
          {item.soldOut && !showMedia ? <SoldOut /> : null}
        </span>
        {!item.soldOut ? <PlusBubble className="mt-0.5 size-8 shrink-0" /> : null}
      </span>
    </button>
  )
}
