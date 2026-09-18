'use client'

import type { AddonSelection } from '@/lib/addons/addons'
import { Calculator, Check, Copy, Minus, Plus, ReceiptText, Search, Trash2, TriangleAlert } from 'lucide-react'
import { useState, useTransition, type FormEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Input, Select } from '@/components/ui/input'
import { Spinner } from '@/components/ui/submit-button'
import { findItemByCodeAction, lookupOrderAction } from '@/features/simulator/actions'
import { formatBRL } from '@/lib/money/money'
import { formatOrderTotal } from '@/lib/pricing/price'
import {
  buildPricedSummary,
  simulateOrder,
  type SimulatedLine,
  type SimulatorItem,
  type SimulatorLineInput,
} from '@/lib/simulator/simulate'

type Simulation = ReturnType<typeof simulateOrder>

export function Simulator() {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <OrderLookup />
      <ManualMode />
    </div>
  )
}

// Cabeçalho de cada bloco: ícone num quadrado verde, título e apoio curto.
function BlockHeader({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3.5">
      <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-control bg-go-soft text-go-strong">
        {icon}
      </span>
      <div className="flex min-w-0 flex-col gap-1 pt-0.5">
        <h2 className="text-xl font-black leading-tight tracking-[-0.02em] text-ink">{title}</h2>
        <p className="text-[0.9375rem] font-semibold leading-snug text-ink-muted">{description}</p>
      </div>
    </div>
  )
}

function OrderLookup() {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [order, setOrder] = useState<{ code: string; createdAt: string; lines: SimulatorLineInput[]; items: SimulatorItem[] } | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      const result = await lookupOrderAction(code)
      if ('error' in result) {
        setOrder(null)
        setError(result.error ?? 'Pedido não encontrado ou expirado.')
      } else {
        setError(null)
        setOrder(result)
      }
    })
  }

  const simulation = order ? simulateOrder(order.lines, new Map(order.items.map((item) => [item.id, item]))) : null

  return (
    <section className="flex min-w-0 flex-col gap-5 rounded-card border-2 border-line bg-surface p-5 sm:p-6">
      <BlockHeader
        icon={<Search className="size-6" strokeWidth={2.5} />}
        title="Por código do pedido"
        description="Digite o código que veio na mensagem do WhatsApp para conferir itens e valores de hoje."
      />
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Field label="Código do pedido" htmlFor="orderCode">
          <Input
            id="orderCode"
            value={code}
            maxLength={6}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="K7F2"
            onChange={(event) => setCode(event.target.value)}
            className="numeric h-16 text-center text-[1.75rem] font-black uppercase tracking-[0.18em] placeholder:font-black placeholder:text-ink-muted/40"
          />
        </Field>
        <Button type="submit" size="lg" disabled={pending || !code.trim()} aria-busy={pending} className="w-full">
          {pending ? <Spinner /> : null}
          Consultar
        </Button>
      </form>
      <FormMessage error={error ?? undefined} />
      {order && simulation ? (
        <Receipt
          simulation={simulation}
          title={`Pedido #${order.code}`}
          subtitle={`Enviado em ${new Date(order.createdAt).toLocaleString('pt-BR')}`}
          summary={buildPricedSummary(simulation, order.code)}
        />
      ) : null}
    </section>
  )
}

type ManualLine = { key: string; itemId: string; variationId: string | null; qty: number; addons: AddonSelection[] }

function ManualMode() {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<Map<string, SimulatorItem>>(new Map())
  const [lines, setLines] = useState<ManualLine[]>([])
  const [pending, startTransition] = useTransition()

  function onAdd(event: FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      const result = await findItemByCodeAction(code)
      if ('error' in result) {
        setError(result.error ?? 'Item não encontrado.')
        return
      }
      const item = result.item
      setError(null)
      setCode('')
      setItems((current) => new Map(current).set(item.id, item))
      setLines((current) => [
        ...current,
        { key: Math.random().toString(36).slice(2), itemId: item.id, variationId: item.variations[0]?.id ?? null, qty: 1, addons: [] },
      ])
    })
  }

  function update(key: string, patch: Partial<ManualLine>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  }

  function setAddonQty(line: ManualLine, optionId: string, qty: number) {
    const rest = line.addons.filter((addon) => addon.optionId !== optionId)
    update(line.key, { addons: qty > 0 ? [...rest, { optionId, qty }] : rest })
  }

  const simulation = simulateOrder(lines, items)

  return (
    <section className="flex min-w-0 flex-col gap-5 rounded-card border-2 border-line bg-surface p-5 sm:p-6">
      <BlockHeader
        icon={<Calculator className="size-6" strokeWidth={2.5} />}
        title="Modo manual"
        description="Monte um pedido pelo código de cada item e veja o total na hora."
      />
      <form onSubmit={onAdd} className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Field label="Código do item" htmlFor="itemCode">
            <Input
              id="itemCode"
              value={code}
              maxLength={6}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setCode(event.target.value)}
              className="numeric font-extrabold uppercase tracking-[0.12em]"
            />
          </Field>
        </div>
        <Button type="submit" disabled={pending || !code.trim()} aria-busy={pending} className="shrink-0">
          {pending ? <Spinner /> : <Plus aria-hidden="true" className="size-5" strokeWidth={3} />}
          Adicionar
        </Button>
      </form>
      <FormMessage error={error ?? undefined} />

      {lines.length === 0 ? (
        <p className="rounded-control border-2 border-dashed border-line-strong px-4 py-6 text-center text-[0.9375rem] font-semibold text-ink-muted">
          O código de cada item aparece na lista de itens da vitrine.
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {lines.map((line, index) => {
              const item = items.get(line.itemId)
              if (!item) return null
              const result = simulation.lines[index]
              return (
                <li key={line.key} className="flex animate-rise flex-col gap-4 rounded-control border-2 border-line bg-canvas p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-extrabold leading-snug text-ink">{item.name}</span>
                      <span className="text-sm font-semibold text-ink-muted">
                        cód. <span className="numeric">{item.code}</span> · {item.vitrineName}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-mr-2 -mt-1 shrink-0 text-ink-muted hover:text-danger"
                      onClick={() => setLines((current) => current.filter((l) => l.key !== line.key))}
                    >
                      <Trash2 aria-hidden="true" className="size-4" strokeWidth={2.5} />
                      Remover
                    </Button>
                  </div>

                  {item.variations.length > 0 ? (
                    <label className="flex flex-col gap-1.5 text-sm font-extrabold text-ink">
                      Variação
                      <Select
                        aria-label={`Variação de ${item.name}`}
                        value={line.variationId ?? ''}
                        onChange={(event) => update(line.key, { variationId: event.target.value })}
                      >
                        {item.variations.map((variation) => (
                          <option key={variation.id} value={variation.id}>
                            {variation.name}
                          </option>
                        ))}
                      </Select>
                    </label>
                  ) : null}

                  <div className="flex items-end justify-between gap-3">
                    <div className="flex flex-col gap-1.5">
                      <span aria-hidden="true" className="text-sm font-extrabold text-ink">
                        Quantidade
                      </span>
                      <Stepper
                        label={`Quantidade de ${item.name}`}
                        stepName={item.name}
                        value={line.qty}
                        min={1}
                        max={99}
                        onChange={(qty) => update(line.key, { qty })}
                      />
                    </div>
                    <span className="numeric pb-3 text-right text-lg font-black text-ink">
                      {result?.subtotalCents != null ? formatBRL(result.subtotalCents) : 'Sob consulta'}
                    </span>
                  </div>

                  {(item.addonGroups ?? []).map((group) => (
                    <fieldset key={group.id} className="flex flex-col gap-2 border-t-2 border-line pt-3">
                      <legend className="mb-1 text-sm font-extrabold text-ink-muted">{group.name}</legend>
                      {group.options.map((option) => (
                        <div key={option.id} className="flex items-center justify-between gap-3">
                          <span aria-hidden="true" className="min-w-0 text-[0.9375rem] font-bold leading-snug text-ink">
                            {option.name}
                          </span>
                          <Stepper
                            label={`${option.name} em ${item.name}`}
                            stepName={`${option.name} (${item.name})`}
                            value={line.addons.find((addon) => addon.optionId === option.id)?.qty ?? 0}
                            min={0}
                            max={20}
                            size="sm"
                            onChange={(qty) => setAddonQty(line, option.id, qty)}
                          />
                        </div>
                      ))}
                    </fieldset>
                  ))}
                </li>
              )
            })}
          </ul>
          <TotalRow value={formatOrderTotal(simulation.total)} />
          <CopySummary text={buildPricedSummary(simulation, null)} />
        </>
      )}
    </section>
  )
}

/*
 * Menos / campo / mais. O campo continua digitável (nome acessível = `label`).
 * Os botões usam "Menos 1 …"/"Mais 1 …" com `stepName`, que nunca contém `label`:
 * a busca pelo rótulo do campo acha só o campo.
 */
function Stepper({
  label,
  stepName,
  value,
  min,
  max,
  size = 'md',
  onChange,
}: {
  label: string
  stepName: string
  value: number
  min: number
  max: number
  size?: 'sm' | 'md'
  onChange: (value: number) => void
}) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next))
  const box = size === 'sm' ? 'h-10 w-10' : 'h-12 w-12'
  const step = `flex ${box} shrink-0 items-center justify-center text-ink transition-colors hover:bg-subtle disabled:cursor-not-allowed disabled:text-ink-muted/50 disabled:hover:bg-transparent`
  return (
    <div className="flex shrink-0 items-stretch overflow-hidden rounded-control border-2 border-line-strong bg-surface focus-within:border-go-strong">
      <button type="button" aria-label={`Menos 1 ${stepName}`} disabled={value <= min} onClick={() => onChange(clamp(value - 1))} className={step}>
        <Minus aria-hidden="true" className="size-4" strokeWidth={3} />
      </button>
      <input
        aria-label={label}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(clamp(Number(event.target.value) || min))}
        className={`numeric w-12 min-w-0 border-x-2 border-line bg-transparent text-center font-black text-ink [appearance:textfield] focus-visible:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
          size === 'sm' ? 'text-base' : 'text-lg'
        }`}
      />
      <button type="button" aria-label={`Mais 1 ${stepName}`} disabled={value >= max} onClick={() => onChange(clamp(value + 1))} className={step}>
        <Plus aria-hidden="true" className="size-4" strokeWidth={3} />
      </button>
    </div>
  )
}

function TotalRow({ value }: { value: string }) {
  return (
    <p className="flex items-baseline justify-between gap-4 border-t-2 border-dashed border-line-strong pt-4 text-ink">
      <span className="text-lg font-black">Total:</span>{' '}
      <span className="numeric text-right text-[1.75rem] font-black leading-none tracking-[-0.02em]">{value}</span>
    </p>
  )
}

// O pedido lido como uma comanda: linhas, complementos, avisos em destaque e o total embaixo.
function Receipt({
  simulation,
  title,
  subtitle,
  summary,
}: {
  simulation: Simulation
  title: string
  subtitle: string
  summary: string
}) {
  return (
    <div className="flex animate-rise flex-col gap-4">
      <article className="flex flex-col gap-4 rounded-control border-2 border-line bg-canvas p-4 sm:p-5">
        <header className="flex items-start gap-3 border-b-2 border-dashed border-line-strong pb-4">
          <ReceiptText aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-go-strong" strokeWidth={2.5} />
          <div className="flex min-w-0 flex-col gap-0.5">
            <h3 className="numeric text-lg font-black leading-tight tracking-[-0.01em] text-ink">{title}</h3>
            <p className="text-sm font-semibold text-ink-muted">{subtitle}</p>
          </div>
        </header>

        {simulation.hasChanges ? (
          <p className="flex items-start gap-2 rounded-control bg-sun-soft px-3 py-2.5 text-sm font-bold leading-5 text-sun-ink">
            <TriangleAlert aria-hidden="true" className="mt-px size-4 shrink-0" strokeWidth={2.5} />
            Algo mudou desde o envio. Confira os avisos antes de confirmar com o cliente.
          </p>
        ) : null}

        <ul className="flex flex-col divide-y-2 divide-dashed divide-line">
          {simulation.lines.map((line, index) => (
            <ReceiptLine key={index} line={line} />
          ))}
        </ul>

        <TotalRow value={formatOrderTotal(simulation.total)} />
      </article>
      <CopySummary text={summary} />
    </div>
  )
}

function Warning({ children }: { children: ReactNode }) {
  return (
    <span className="flex w-fit max-w-full items-start gap-1.5 rounded-lg bg-danger-soft px-2.5 py-1.5 text-sm font-extrabold leading-5 text-danger">
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={2.5} />
      <span>{children}</span>
    </span>
  )
}

function ReceiptLine({ line }: { line: SimulatedLine }) {
  const counted = line.status === 'ok' || line.status === 'price_changed'
  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <span className="numeric flex h-7 min-w-9 shrink-0 items-center justify-center rounded-lg bg-deep px-1.5 text-sm font-black text-deep-ink">
          {line.qty}x
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={`font-extrabold leading-snug ${counted ? 'text-ink' : 'text-ink-muted line-through'}`}>
            {line.name}
            {line.variationName ? ` – ${line.variationName}` : ''}
          </span>
          <span className="text-sm font-semibold text-ink-muted">
            cód. <span className="numeric">{line.code}</span>
            {line.unitCents != null ? <span className="numeric"> · {formatBRL(line.unitCents)} cada</span> : null}
          </span>
        </div>
        <span className="numeric shrink-0 text-right font-black text-ink">
          {line.unitCents != null ? formatBRL(line.subtotalCents!) : null}
          {line.unitCents == null && line.status === 'ok' ? 'Sob consulta' : null}
        </span>
      </div>
      {line.addonLines.length > 0 ? (
        <div className="flex flex-col gap-0.5 pl-12">
          {line.addonLines.map((text) => (
            <span key={text} className="text-sm font-semibold text-ink-muted">
              {text.trim()}
            </span>
          ))}
        </div>
      ) : null}
      {line.status === 'price_changed' ? (
        <div className="pl-12">
          <Warning>
            Preço mudou desde o envio (era {line.previousUnitCents != null ? formatBRL(line.previousUnitCents) : 'sob consulta'})
          </Warning>
        </div>
      ) : null}
      {line.status === 'removed' ? (
        <div className="pl-12">
          <Warning>Item não existe mais</Warning>
        </div>
      ) : null}
      {line.status === 'variation_removed' ? (
        <div className="pl-12">
          <Warning>Variação não existe mais</Warning>
        </div>
      ) : null}
      {line.status === 'addon_removed' ? (
        <div className="pl-12">
          <Warning>Complemento não existe mais</Warning>
        </div>
      ) : null}
    </li>
  )
}

function CopySummary({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="secondary"
        className="w-full sm:w-auto"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text)
            setCopied(true)
            setTimeout(() => setCopied(false), 2500)
          } catch {
            window.prompt('Copie o resumo:', text)
          }
        }}
      >
        {copied ? (
          <Check aria-hidden="true" className="size-[1.125rem] animate-pop text-go-strong" strokeWidth={3} />
        ) : (
          <Copy aria-hidden="true" className="size-[1.125rem]" strokeWidth={2.5} />
        )}
        Copiar resumo com valores
      </Button>
      {copied ? (
        <span role="status" className="animate-rise text-sm font-extrabold text-go-strong">
          Resumo copiado.
        </span>
      ) : null}
    </div>
  )
}
