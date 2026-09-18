export type Availability = { ok: boolean; message: string }

const GENERIC = 'Não foi possível verificar agora.'

// Devolve `null` quando a checagem foi cancelada (a pessoa continuou digitando
// ou saiu da página): nesse caso não há nada para mostrar.
export async function fetchAvailability(url: string, signal: AbortSignal): Promise<Availability | null> {
  try {
    const response = await fetch(url, { signal, headers: { accept: 'application/json' } })
    if (!response.ok) return { ok: false, message: GENERIC }
    return (await response.json()) as Availability
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return null
    return { ok: false, message: GENERIC }
  }
}
