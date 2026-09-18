'use client'

import { CircleAlert } from 'lucide-react'
import { groupBadge, type AddonGroup, type AddonSelection } from '@/lib/addons/addons'
import { formatBRL } from '@/lib/money/money'
import { GroupBadge, OptionMark, optionCardClass, optionInputClass, StepButton } from './vitrine-ui'

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
    <div className="mt-7 flex flex-col gap-7">
      {groups.map((group) => {
        const count = group.options.reduce((sum, option) => sum + qtyOf(selections, option.id), 0)
        const full = count >= group.maxSelect
        const single = group.minSelect > 0 && group.maxSelect === 1 && !group.allowRepeat
        const hasError = errorGroupId === group.id

        return (
          <fieldset key={group.id} id={`addon-group-${group.id}`} className="min-w-0 scroll-mt-16">
            <legend className="float-left mb-3 flex w-full items-center justify-between gap-3">
              <span className="min-w-0 text-lg font-extrabold tracking-[-0.01em]">{group.name}</span>
              <GroupBadge required={group.minSelect > 0}>{groupBadge(group)}</GroupBadge>
            </legend>
            <div
              className={`clear-both flex flex-col gap-2 rounded-2xl transition-shadow duration-200 ${
                hasError ? 'ring-2 ring-danger ring-offset-4 ring-offset-surface' : ''
              }`}
            >
              {group.options.map((option) => {
                const qty = qtyOf(selections, option.id)
                const price =
                  showPrices && option.priceCents > 0
                    ? group.kind === 'flavors'
                      ? formatBRL(option.priceCents)
                      : `+ ${formatBRL(option.priceCents)}`
                    : null
                const text = (
                  <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <span className="font-semibold">
                      {option.name}
                      {option.soldOut ? <span className="font-medium text-ink-muted"> · Esgotado</span> : null}
                    </span>
                    {price ? <span className="numeric text-[0.9375rem] font-semibold text-ink-muted">{price}</span> : null}
                  </span>
                )

                if (group.allowRepeat && group.kind === 'standard') {
                  return (
                    <div
                      key={option.id}
                      className={`flex min-h-14 items-center gap-3 rounded-2xl border-2 py-1.5 pl-4 pr-1.5 transition-colors duration-150 ${
                        qty > 0 ? 'border-(--color-accent) bg-brand-soft' : 'border-line bg-surface'
                      } ${option.soldOut ? 'opacity-55' : ''}`}
                    >
                      {text}
                      <span className="flex shrink-0 items-center gap-1">
                        {/* Com zero, só o "+" aparece; o "−" e o número entram na primeira escolha. */}
                        {qty > 0 ? (
                          <StepButton
                            kind="minus"
                            aria-label={`Diminuir ${option.name}`}
                            onClick={() => onChange(withQty(selections, option.id, qty - 1))}
                          />
                        ) : null}
                        <span aria-live="polite" className={qty > 0 ? 'numeric w-6 text-center font-bold' : 'sr-only'}>
                          <span key={qty} className="inline-block animate-bump">
                            {qty}
                          </span>
                        </span>
                        <StepButton
                          kind="plus"
                          aria-label={`Aumentar ${option.name}`}
                          disabled={option.soldOut || full}
                          onClick={() => onChange(withQty(selections, option.id, qty + 1))}
                        />
                      </span>
                    </div>
                  )
                }

                if (single) {
                  return (
                    <label key={option.id} className={optionCardClass}>
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
                        className={optionInputClass}
                      />
                      <OptionMark type="radio" />
                      {text}
                    </label>
                  )
                }

                return (
                  <label key={option.id} className={optionCardClass}>
                    <input
                      type="checkbox"
                      disabled={option.soldOut || (full && qty === 0)}
                      checked={qty > 0}
                      onChange={(event) => onChange(withQty(selections, option.id, event.target.checked ? 1 : 0))}
                      className={optionInputClass}
                    />
                    <OptionMark type="checkbox" />
                    {text}
                  </label>
                )
              })}
            </div>
            {hasError && errorMessage ? (
              <p role="alert" className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-danger">
                <CircleAlert aria-hidden="true" className="size-4 shrink-0" strokeWidth={2.5} />
                {errorMessage}
              </p>
            ) : null}
          </fieldset>
        )
      })}
    </div>
  )
}
