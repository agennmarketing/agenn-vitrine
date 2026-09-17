'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { PublicImage, PublicItem, PublicVitrine } from '@/features/public/build-catalog'
import { readableTextColor } from '@/lib/color/contrast'
import { formatBRL } from '@/lib/money/money'
import { addToCart, replaceLine, type CartLine } from '@/lib/cart/cart'
import { cartSummary } from '@/lib/cart/reconcile'
import { formatOrderTotal, formatPriceLabel, priceLabel } from '@/lib/pricing/price'
import { BannerVideo } from './banner-video'
import { useCart } from './cart-store'
import { useItemParam } from './item-param'

// Tela do item, galeria e envio só carregam quando um item é aberto.
const ItemSheet = dynamic(() => import('./item-sheet'), { ssr: false })
const CartSheet = dynamic(() => import('./cart-sheet'), { ssr: false })

const DARK_THEME = {
  '--color-canvas': '#0e1411',
  '--color-surface': '#18201b',
  '--color-subtle': '#222b25',
  '--color-ink': '#eef2ee',
  '--color-ink-muted': '#a6b0a9',
  '--color-line': '#2c362f',
  '--color-line-strong': '#46514a',
} as CSSProperties

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
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

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

  const style: CSSProperties = {
    ...(vitrine.theme === 'dark' ? DARK_THEME : {}),
    ...(vitrine.brandColor
      ? ({ '--color-brand': vitrine.brandColor, '--color-brand-ink': readableTextColor(vitrine.brandColor) } as CSSProperties)
      : {}),
  }

  return (
    <div data-theme={vitrine.theme} style={style} className="min-h-dvh bg-canvas text-ink">
      <header className="mx-auto flex max-w-5xl flex-col gap-3 px-4 pt-5">
        <div className="flex items-center gap-3">
          {vitrine.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={vitrine.logo.small} alt="" width={40} height={40} className="size-10 rounded-full object-cover" />
          ) : (
            <span className="flex size-10 items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-ink">
              {initials(vitrine.name)}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold">{vitrine.name}</h1>
            {vitrine.description ? <p className="line-clamp-2 text-sm text-ink-muted">{vitrine.description}</p> : null}
          </div>
          {vitrine.cartEnabled ? (
            <button
              type="button"
              aria-label="Abrir sacola"
              onClick={() => setCartOpen(true)}
              className="ml-auto shrink-0 rounded-full border border-line-strong px-3 py-2 text-sm"
            >
              Sacola ({summary.count})
            </button>
          ) : null}
        </div>
        <input
          type="search"
          aria-label="Buscar por nome ou código"
          placeholder="Buscar por nome ou código"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-11 w-full rounded-control border border-line-strong bg-surface px-3.5 text-base"
        />
      </header>

      {vitrine.bannerVideo ? (
        <div className="mx-auto mt-4 max-w-5xl px-4">
          <BannerVideo video={vitrine.bannerVideo} />
        </div>
      ) : vitrine.banner ? (
        <div className="mx-auto mt-4 max-w-5xl px-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={vitrine.banner.large}
            srcSet={srcSet(vitrine.banner)}
            sizes="(min-width: 1024px) 1024px, 100vw"
            alt=""
            fetchPriority="high"
            className="aspect-video w-full rounded-card object-cover"
          />
        </div>
      ) : null}

      {categories.length > 0 ? (
        <nav aria-label="Categorias" className="sticky top-0 z-10 mt-4 border-b border-line bg-canvas/95 backdrop-blur">
          <ul className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 py-2">
            {categories.map((category) => (
              <li key={category.id} className="shrink-0">
                <a
                  href={`#cat-${category.id}`}
                  aria-current={activeCategory === category.id ? 'true' : undefined}
                  className={`block rounded-full px-3 py-1.5 text-sm ${activeCategory === category.id ? 'bg-brand text-brand-ink' : 'bg-subtle'}`}
                >
                  {category.name}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <main className={`mx-auto flex max-w-5xl flex-col gap-8 px-4 py-6 ${vitrine.cartEnabled ? 'pb-24' : ''}`}>
        {categories.length === 0 ? <p className="text-ink-muted">Nenhum item encontrado.</p> : null}
        {categories.map((category) => (
          <section
            key={category.id}
            id={`cat-${category.id}`}
            data-category={category.id}
            aria-labelledby={`cat-${category.id}-title`}
            className="scroll-mt-16"
          >
            <h2 id={`cat-${category.id}-title`} className="mb-3 text-lg font-semibold">
              {category.name}
            </h2>
            <ul className={vitrine.showMedia ? 'grid grid-cols-2 gap-3 md:grid-cols-3' : 'flex flex-col divide-y divide-line'}>
              {category.items.map((item) => (
                <li key={item.id}>
                  <ItemCard item={item} showMedia={vitrine.showMedia} showPrices={vitrine.showPrices} onOpen={openItem} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>

      {vitrine.showWatermark ? (
        <footer className="pb-8 text-center text-sm text-ink-muted">
          <a href={siteUrl} className="underline">
            Feito com Agenn Vitrine
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
        <div className="fixed inset-x-0 bottom-0 z-40 p-4">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="mx-auto block h-12 w-full max-w-md rounded-control bg-brand font-semibold text-brand-ink shadow-lg"
          >
            {cartLabel}
          </button>
        </div>
      ) : null}
    </div>
  )
}

function ItemCard({
  item,
  showMedia,
  showPrices,
  onOpen,
}: {
  item: PublicItem
  showMedia: boolean
  showPrices: boolean
  onOpen: (code: string) => void
}) {
  const label = priceLabel(item, item.variations)
  return (
    <button
      type="button"
      aria-label={item.name}
      onClick={() => onOpen(item.code)}
      className={`flex w-full flex-col gap-1.5 text-left ${item.soldOut ? 'opacity-60' : ''} ${showMedia ? '' : 'py-3'}`}
    >
      {showMedia ? (
        <span className="block aspect-[4/5] w-full overflow-hidden rounded-card bg-subtle">
          {item.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.cover.small}
              srcSet={srcSet(item.cover)}
              sizes="(min-width: 768px) 33vw, 50vw"
              loading="lazy"
              decoding="async"
              alt=""
              width={4}
              height={5}
              className="size-full object-cover"
            />
          ) : null}
        </span>
      ) : null}
      <span className="font-medium leading-snug">{item.name}</span>
      {showPrices ? (
        <span className="text-sm">
          {label.kind === 'price' && label.originalCents !== null ? (
            <s className="mr-1 text-ink-muted">{formatBRL(label.originalCents)}</s>
          ) : null}
          {formatPriceLabel(label)}
        </span>
      ) : null}
      {item.durationMinutes ? <span className="text-sm text-ink-muted">{item.durationMinutes} min</span> : null}
      {item.tags.length > 0 ? (
        <span className="flex flex-wrap gap-1">
          {item.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-subtle px-2 py-0.5 text-xs">
              {tag}
            </span>
          ))}
        </span>
      ) : null}
      {item.soldOut ? <span className="text-xs font-medium">Esgotado</span> : null}
    </button>
  )
}
