export type AddonOption = { id: string; name: string; priceCents: number; soldOut: boolean }

export type AddonGroup = {
  id: string
  name: string
  kind: 'standard' | 'flavors'
  required: boolean
  minSelect: number
  maxSelect: number
  allowRepeat: boolean
  flavorPriceRule: 'max' | 'average' | null
  options: AddonOption[]
}

export type AddonSelection = { optionId: string; qty: number }

export function groupBadge(group: AddonGroup): string {
  if (group.minSelect > 0) {
    return group.minSelect === group.maxSelect
      ? `Obrigatório · escolha ${group.minSelect}`
      : `Obrigatório · escolha ${group.minSelect} a ${group.maxSelect}`
  }
  return `Opcional · até ${group.maxSelect}`
}

type Located = { group: AddonGroup; groupIndex: number; option: AddonOption; optionIndex: number }

function locate(groups: AddonGroup[]): Map<string, Located> {
  const map = new Map<string, Located>()
  groups.forEach((group, groupIndex) =>
    group.options.forEach((option, optionIndex) => map.set(option.id, { group, groupIndex, option, optionIndex })),
  )
  return map
}

// Junta quantidades da mesma opção e ignora opções que não existem.
function mergeKnown(groups: AddonGroup[], selections: AddonSelection[]) {
  const located = locate(groups)
  const qtyByOption = new Map<string, number>()
  for (const selection of selections) {
    if (!located.has(selection.optionId)) continue
    qtyByOption.set(selection.optionId, (qtyByOption.get(selection.optionId) ?? 0) + selection.qty)
  }
  return [...qtyByOption.entries()]
    .map(([optionId, qty]) => ({ ...located.get(optionId)!, qty }))
    .sort((a, b) => a.groupIndex - b.groupIndex || a.optionIndex - b.optionIndex)
}

export function validateAddonSelections(
  groups: AddonGroup[],
  selections: AddonSelection[],
): { ok: true; selections: AddonSelection[] } | { ok: false; groupId: string | null; message: string } {
  const located = locate(groups)
  for (const selection of selections) {
    if (!located.has(selection.optionId)) {
      return { ok: false, groupId: null, message: 'Uma opção escolhida não está mais disponível.' }
    }
    if (!Number.isInteger(selection.qty) || selection.qty < 1) {
      return { ok: false, groupId: located.get(selection.optionId)!.group.id, message: 'Quantidade inválida.' }
    }
  }

  const merged = mergeKnown(groups, selections)
  for (const { group, option, qty } of merged) {
    if (option.soldOut) return { ok: false, groupId: group.id, message: `${option.name} está esgotado.` }
    if (qty > 1 && (!group.allowRepeat || group.kind === 'flavors')) {
      return { ok: false, groupId: group.id, message: `Em ${group.name}, escolha cada opção só uma vez.` }
    }
  }

  for (const group of groups) {
    const count = merged.filter((entry) => entry.group.id === group.id).reduce((sum, entry) => sum + entry.qty, 0)
    if (count < group.minSelect) {
      const message =
        group.minSelect === 1
          ? `Escolha uma opção em ${group.name}.`
          : `Escolha pelo menos ${group.minSelect} opções em ${group.name}.`
      return { ok: false, groupId: group.id, message }
    }
    if (count > group.maxSelect) {
      const noun = group.maxSelect === 1 ? 'opção' : 'opções'
      return { ok: false, groupId: group.id, message: `Escolha até ${group.maxSelect} ${noun} em ${group.name}.` }
    }
  }

  return { ok: true, selections: merged.map(({ option, qty }) => ({ optionId: option.id, qty })) }
}

// Spec 4.6, regras 2 e 3.
export function addonsUnitCents(groups: AddonGroup[], selections: AddonSelection[]): number {
  const merged = mergeKnown(groups, selections)
  let total = 0
  for (const group of groups) {
    const chosen = merged.filter((entry) => entry.group.id === group.id)
    if (chosen.length === 0) continue
    if (group.kind === 'flavors') {
      const prices = chosen.map((entry) => entry.option.priceCents)
      total +=
        group.flavorPriceRule === 'max'
          ? Math.max(...prices)
          : Math.ceil(prices.reduce((sum, price) => sum + price, 0) / prices.length)
    } else {
      total += chosen.reduce((sum, entry) => sum + entry.option.priceCents * entry.qty, 0)
    }
  }
  return total
}

export function addonMessageLines(groups: AddonGroup[], selections: AddonSelection[]): string[] {
  const merged = mergeKnown(groups, selections)
  const lines: string[] = []
  for (const group of groups) {
    const chosen = merged.filter((entry) => entry.group.id === group.id)
    if (chosen.length === 0) continue
    const parts = chosen.map((entry) => (group.allowRepeat ? `${entry.qty}x ${entry.option.name}` : entry.option.name))
    lines.push(`   • ${group.name}: ${parts.join(', ')}`)
  }
  return lines
}
