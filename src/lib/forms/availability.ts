export type Availability = { ok: boolean; message: string }

export const AVAILABILITY_ERROR_MESSAGE = 'Não foi possível verificar agora.'

// Devolve `null` quando a checagem foi cancelada (a pessoa continuou digitando
// ou saiu da página): nesse caso não há nada para mostrar.
export async function fetchAvailability(url: string, signal: AbortSignal): Promise<Availability | null> {
  try {
    const response = await fetch(url, { signal, headers: { accept: 'application/json' } })
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as Partial<Availability> | null
      const message = typeof body?.message === 'string' && body.message.trim() ? body.message : AVAILABILITY_ERROR_MESSAGE
      return { ok: false, message }
    }
    return (await response.json()) as Availability
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return null
    return { ok: false, message: AVAILABILITY_ERROR_MESSAGE }
  }
}
