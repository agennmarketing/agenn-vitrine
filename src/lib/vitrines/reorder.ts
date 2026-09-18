export function moveInList(ids: readonly string[], id: string, direction: 'up' | 'down'): string[] | null {
  const index = ids.indexOf(id)
  const target = direction === 'up' ? index - 1 : index + 1
  if (index === -1 || target < 0 || target >= ids.length) return null
  const next = [...ids]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

export const REORDER_STALE_MESSAGE = 'A lista mudou. Recarregue a página.'

/*
 * Confere se a ordem recebida do navegador tem exatamente os mesmos ids da lista atual no banco:
 * mesmo tamanho, sem repetidos, nenhum a mais ou a menos. Se alguém criou ou excluiu algo em outra
 * aba, a ordem enviada está velha e não pode ser gravada.
 */
export function isSameIdSet(current: readonly string[], received: unknown): received is string[] {
  if (!Array.isArray(received) || received.length !== current.length) return false
  if (!received.every((id) => typeof id === 'string')) return false
  const unique = new Set(received)
  if (unique.size !== received.length) return false
  return current.every((id) => unique.has(id))
}
