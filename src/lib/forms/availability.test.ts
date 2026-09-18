import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchAvailability } from './availability'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchAvailability', () => {
  it('devolve o que a rota respondeu', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ ok: true, message: 'Endereço disponível.' })))
    const controller = new AbortController()
    expect(await fetchAvailability('/api/disponibilidade/subdominio?valor=loja', controller.signal)).toEqual({
      ok: true,
      message: 'Endereço disponível.',
    })
  })

  it('erro de rede vira mensagem em português', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('sem rede')
    })
    const controller = new AbortController()
    expect(await fetchAvailability('/x', controller.signal)).toEqual({
      ok: false,
      message: 'Não foi possível verificar agora.',
    })
  })

  it('resposta de erro do servidor também', async () => {
    vi.stubGlobal('fetch', async () => new Response('', { status: 500 }))
    expect(await fetchAvailability('/x', new AbortController().signal)).toEqual({
      ok: false,
      message: 'Não foi possível verificar agora.',
    })
  })

  it('401 com corpo com mensagem devolve a mensagem do corpo', async () => {
    vi.stubGlobal(
      'fetch',
      async () => new Response(JSON.stringify({ ok: false, message: 'Sessão expirada. Entre de novo.' }), { status: 401 }),
    )
    expect(await fetchAvailability('/x', new AbortController().signal)).toEqual({
      ok: false,
      message: 'Sessão expirada. Entre de novo.',
    })
  })

  it('checagem cancelada devolve nulo, sem mensagem', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new DOMException('cancelada', 'AbortError')
    })
    const controller = new AbortController()
    controller.abort()
    expect(await fetchAvailability('/x', controller.signal)).toBeNull()
  })
})
