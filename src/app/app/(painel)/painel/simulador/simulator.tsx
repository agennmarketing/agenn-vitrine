'use client'

import type { AddonSelection } from '@/lib/addons/addons'
import { useState, useTransition, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { findItemByCodeAction, lookupOrderAction } from '@/features/simulator/actions'
import { formatBRL } from '@/lib/money/money'
import { formatOrderTotal } from '@/lib/pricing/price'
import {
  buildPricedSummary,
  simulateOrder,
  type SimulatorItem,
  type SimulatorLineInput,
} from '@/lib/simulator/simulate'

type Simulation = ReturnType<typeof simulateOrder>

export function Simulator() {
  return (
    <div className="flex flex-col gap-6">
      <OrderLookup />
      <ManualMode />
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
    <Card className="flex flex-col gap-4 p-5">
      <h2 className="text-lg font-medium">Por código do pedido</h2>
      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <Field label="Código do pedido" htmlFor="orderCode">
            <Input
              id="orderCode"
              value={code}
              maxLength={6}
              autoCapitalize="characters"
              placeholder="K7F2"
              onChange={(event) => setCode(event.target.value)}
            />
          </Field>
        </div>
        <Button type="submit" disabled={pending || !code.trim()}>
          Consultar
        </Button>
      </form>
      <FormMessage error={error ?? undefined} />
      {order && simulation ? (
        <>
          <p className="text-sm text-ink-muted">
            Pedido #{order.code} · {new Date(order.createdAt).toLocaleString('pt-BR')}
          </p>
          <SimulationTable simulation={simulation} />
          <CopySummary text={buildPricedSummary(simulation, order.code)} />
        </>
      ) : null}
    </Card>
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

  const simulation = simulateOrder(lines, items)

  return (
    <Card className="flex flex-col gap-4 p-5">
      <h2 className="text-lg font-medium">Modo manual</h2>
      <form onSubmit={onAdd} className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <Field label="Código do item" htmlFor="itemCode">
            <Input
              id="itemCode"
              value={code}
              maxLength={6}
              autoCapitalize="characters"
              onChange={(event) => setCode(event.target.value)}
            />
          </Field>
        </div>
        <Button type="submit" disabled={pending || !code.trim()}>
          Adicionar
        </Button>
      </form>
      <FormMessage error={error ?? undefined} />

      {lines.length > 0 ? (
        <>
          <ul className="flex flex-col gap-3">
            {lines.map((line, index) => {
              const item = items.get(line.itemId)
              if (!item) return null
              const result = simulation.lines[index]
              return (
                <li key={line.key} className="flex flex-col gap-2 rounded-control border border-line p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">
                      {item.name} <span className="text-sm text-ink-muted">cód. {item.code} · {item.vitrineName}</span>
                    </span>
                    <Button variant="ghost" onClick={() => setLines((current) => current.filter((l) => l.key !== line.key))}>
                      Remover
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-end gap-3">
                    {item.variations.length > 0 ? (
                      <label className="flex flex-col gap-1 text-sm">
                        Variação
                        <select
                          aria-label={`Variação de ${item.name}`}
                          value={line.variationId ?? ''}
                          onChange={(event) => update(line.key, { variationId: event.target.value })}
                          className="h-11 rounded-control border border-line-strong bg-surface px-3"
                        >
                          {item.variations.map((variation) => (
                            <option key={variation.id} value={variation.id}>
                              {variation.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <label className="flex flex-col gap-1 text-sm">
                      Quantidade
                      <Input
                        aria-label={`Quantidade de ${item.name}`}
                        type="number"
                        min={1}
                        max={99}
                        value={line.qty}
                        onChange={(event) =>
                          update(line.key, { qty: Math.min(99, Math.max(1, Number(event.target.value) || 1)) })
                        }
                        className="w-24"
                      />
                    </label>
                    <span className="text-sm">
                      {result?.subtotalCents != null ? formatBRL(result.subtotalCents) : 'Sob consulta'}
                    </span>
                  </div>
                  {(item.addonGroups ?? []).map((group) => (
                    <fieldset key={group.id} className="flex flex-wrap items-end gap-3">
                      <legend className="text-sm text-ink-muted">{group.name}</legend>
                      {group.options.map((option) => (
                        <label key={option.id} className="flex flex-col gap-1 text-sm">
                          {option.name}
                          <Input
                            aria-label={`${option.name} em ${item.name}`}
                            type="number"
                            min={0}
                            max={20}
                            value={line.addons.find((addon) => addon.optionId === option.id)?.qty ?? 0}
                            onChange={(event) => {
                              const qty = Math.min(20, Math.max(0, Number(event.target.value) || 0))
                              const rest = line.addons.filter((addon) => addon.optionId !== option.id)
                              update(line.key, { addons: qty > 0 ? [...rest, { optionId: option.id, qty }] : rest })
                            }}
                            className="w-24"
                          />
                        </label>
                      ))}
                    </fieldset>
                  ))}
                </li>
              )
            })}
          </ul>
          <p className="font-semibold">Total: {formatOrderTotal(simulation.total)}</p>
          <CopySummary text={buildPricedSummary(simulation, null)} />
        </>
      ) : null}
    </Card>
  )
}

function SimulationTable({ simulation }: { simulation: Simulation }) {
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-line">
        {simulation.lines.map((line, index) => (
          <li key={index} className="flex flex-col gap-1 py-2">
            <div className="flex flex-wrap justify-between gap-2">
              <span>
                {line.qty}x {line.name}
                {line.variationName ? ` – ${line.variationName}` : ''}{' '}
                <span className="text-sm text-ink-muted">cód. {line.code}</span>
              </span>
              <span>
                {line.unitCents != null ? `${formatBRL(line.unitCents)} = ${formatBRL(line.subtotalCents!)}` : null}
                {line.unitCents == null && line.status === 'ok' ? 'Sob consulta' : null}
              </span>
            </div>
            {line.status === 'price_changed' ? (
              <span className="text-sm text-danger">
                Preço mudou desde o envio (era {line.previousUnitCents != null ? formatBRL(line.previousUnitCents) : 'sob consulta'})
              </span>
            ) : null}
            {line.addonLines.map((text) => (
              <span key={text} className="text-sm text-ink-muted">
                {text.trim()}
              </span>
            ))}
            {line.status === 'removed' ? <span className="text-sm text-danger">Item não existe mais</span> : null}
            {line.status === 'variation_removed' ? (
              <span className="text-sm text-danger">Variação não existe mais</span>
            ) : null}
            {line.status === 'addon_removed' ? (
              <span className="text-sm text-danger">Complemento não existe mais</span>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="font-semibold">Total: {formatOrderTotal(simulation.total)}</p>
    </div>
  )
}

function CopySummary({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center gap-3">
      <Button
        variant="secondary"
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
        Copiar resumo com valores
      </Button>
      {copied ? (
        <span role="status" className="text-sm">
          Resumo copiado.
        </span>
      ) : null}
    </div>
  )
}
