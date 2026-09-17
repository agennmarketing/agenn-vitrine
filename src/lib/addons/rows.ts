import type { AddonGroup } from './addons'

export const ADDON_GROUP_COLUMNS =
  'id, name, kind, required, min_select, max_select, allow_repeat, flavor_price_rule, position, addon_options(id, name, price_cents, sold_out, position)'

export type AddonGroupRow = {
  id: string
  name: string
  kind: string
  required: boolean
  min_select: number
  max_select: number
  allow_repeat: boolean
  flavor_price_rule: string | null
  position: number
  addon_options: { id: string; name: string; price_cents: number; sold_out: boolean; position: number }[]
}

export function toAddonGroup(row: AddonGroupRow): AddonGroup {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind === 'flavors' ? 'flavors' : 'standard',
    required: row.required,
    minSelect: row.min_select,
    maxSelect: row.max_select,
    allowRepeat: row.allow_repeat,
    flavorPriceRule: row.flavor_price_rule === 'max' || row.flavor_price_rule === 'average' ? row.flavor_price_rule : null,
    options: [...row.addon_options]
      .sort((a, b) => a.position - b.position)
      .map((option) => ({ id: option.id, name: option.name, priceCents: option.price_cents, soldOut: option.sold_out })),
  }
}

export function groupsFromLinks(links: { position: number; addon_groups: AddonGroupRow | null }[]): AddonGroup[] {
  return [...links]
    .sort((a, b) => a.position - b.position)
    .flatMap((link) => (link.addon_groups ? [toAddonGroup(link.addon_groups)] : []))
}
