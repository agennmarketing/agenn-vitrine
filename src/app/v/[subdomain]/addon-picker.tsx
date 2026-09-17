'use client'

import { groupBadge, type AddonGroup, type AddonSelection } from '@/lib/addons/addons'
import { formatBRL } from '@/lib/money/money'

function qtyOf(selections: AddonSelection[], optionId: string) {
  return selections.find((selection) => selection.optionId === optionId)?.qty ?? 0
}

function withQty(selections: AddonSelection[], optionId: string, qty: number): AddonSelection[] {
  const rest = selections.filter((selection) => selection.optionId !== optionId)
  return qty > 0 ? [...rest, { optionId, qty }] : rest
}

export function AddonPicker({
  groups,
  showPrices,
  selections,
  onChange,
  errorGroupId,
  errorMessage,
}: {
  groups: AddonGroup[]
  showPrices: boolean
  selections: AddonSelection[]
  onChange: (next: AddonSelection[]) => void
  errorGroupId: string | null
  errorMessage: string | null
}) {
  return (
    <div className="mt-5 flex flex-col gap-4">
      {groups.map((group) => {
        const count = group.options.reduce((sum, option) => sum + qtyOf(selections, option.id), 0)
        const full = count >= group.maxSelect
        const single = group.minSelect > 0 && group.maxSelect === 1 && !group.allowRepeat
        const hasError = errorGroupId === group.id

        return (
          <fieldset
            key={group.id}
            id={`addon-group-${group.id}`}
            className={`flex flex-col gap-2 rounded-control border p-3 ${hasError ? 'border-danger' : 'border-line'}`}
          >
            <legend className="px-1 font-medium">{group.name}</legend>
            <p className="text-xs text-ink-muted">{groupBadge(group)}</p>
            {group.options.map((option) => {
              const qty = qtyOf(selections, option.id)
              const price =
                showPrices && option.priceCents > 0
                  ? group.kind === 'flavors'
                    ? ` · ${formatBRL(option.priceCents)}`
                    : ` · + ${formatBRL(option.priceCents)}`
                  : ''
              const label = `${option.name}${price}${option.soldOut ? ' · Esgotado' : ''}`

              if (group.allowRepeat && group.kind === 'standard') {
                return (
                  <div key={option.id} className={`flex items-center justify-between gap-2 ${option.soldOut ? 'opacity-60' : ''}`}>
                    <span>{label}</span>
                    <span className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={`Diminuir ${option.name}`}
                        disabled={qty === 0}
                        onClick={() => onChange(withQty(selections, option.id, qty - 1))}
                        className="size-9 rounded-full border border-line-strong disabled:opacity-40"
                      >
                        −
                      </button>
                      <span aria-live="polite" className="w-5 text-center">{qty}</span>
                      <button
                        type="button"
                        aria-label={`Aumentar ${option.name}`}
                        disabled={option.soldOut || full}
                        onClick={() => onChange(withQty(selections, option.id, qty + 1))}
                        className="size-9 rounded-full border border-line-strong disabled:opacity-40"
                      >
                        +
                      </button>
                    </span>
                  </div>
                )
              }

              if (single) {
                return (
                  <label key={option.id} className={`flex items-center gap-2 ${option.soldOut ? 'opacity-60' : ''}`}>
                    <input
                      type="radio"
                      name={`group-${group.id}`}
                      disabled={option.soldOut}
                      checked={qty > 0}
                      onChange={() =>
                        onChange([
                          ...selections.filter((selection) => !group.options.some((o) => o.id === selection.optionId)),
                          { optionId: option.id, qty: 1 },
                        ])
                      }
                    />
                    {label}
                  </label>
                )
              }

              return (
                <label key={option.id} className={`flex items-center gap-2 ${option.soldOut ? 'opacity-60' : ''}`}>
                  <input
                    type="checkbox"
                    disabled={option.soldOut || (full && qty === 0)}
                    checked={qty > 0}
                    onChange={(event) => onChange(withQty(selections, option.id, event.target.checked ? 1 : 0))}
                  />
                  {label}
                </label>
              )
            })}
            {hasError && errorMessage ? (
              <p role="alert" className="text-sm text-danger">
                {errorMessage}
              </p>
            ) : null}
          </fieldset>
        )
      })}
    </div>
  )
}
