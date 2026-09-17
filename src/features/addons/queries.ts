import 'server-only'
import { getPanelSession } from '@/features/vitrines/queries'
import { ADDON_GROUP_COLUMNS, toAddonGroup, type AddonGroupRow } from '@/lib/addons/rows'

export async function listAddonGroups(vitrineId: string) {
  const { supabase } = await getPanelSession()
  const { data, error } = await supabase
    .from('addon_groups')
    .select(ADDON_GROUP_COLUMNS)
    .eq('vitrine_id', vitrineId)
    .order('position')
    .order('created_at')
  if (error) throw error
  return ((data ?? []) as AddonGroupRow[]).map(toAddonGroup)
}
