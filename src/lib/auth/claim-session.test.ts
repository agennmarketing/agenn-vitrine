import { afterEach, describe, expect, it, vi } from 'vitest'
import { claimSessionOrFail } from './claim-session'

function fakeSupabase(results: Array<{ error: unknown }>) {
  const rpc = vi.fn()
  results.forEach((result) => rpc.mockResolvedValueOnce(result))
  const signOut = vi.fn().mockResolvedValue({ error: null })
  return { client: { rpc, auth: { signOut } }, rpc, signOut }
}

describe('claimSessionOrFail', () => {
  afterEach(() => vi.restoreAllMocks())

  it('sucesso na primeira tentativa', async () => {
    const { client, rpc, signOut } = fakeSupabase([{ error: null }])
    await expect(claimSessionOrFail(client)).resolves.toBe(true)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('claim_session')
    expect(signOut).not.toHaveBeenCalled()
  })

  it('tenta de novo uma vez após erro', async () => {
    const { client, rpc, signOut } = fakeSupabase([{ error: { message: 'timeout' } }, { error: null }])
    await expect(claimSessionOrFail(client)).resolves.toBe(true)
    expect(rpc).toHaveBeenCalledTimes(2)
    expect(signOut).not.toHaveBeenCalled()
  })

  it('falhando duas vezes, registra o erro, encerra a sessão local e retorna false', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { client, rpc, signOut } = fakeSupabase([{ error: { message: 'a' } }, { error: { message: 'b' } }])
    await expect(claimSessionOrFail(client)).resolves.toBe(false)
    expect(rpc).toHaveBeenCalledTimes(2)
    expect(consoleError).toHaveBeenCalled()
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
  })
})
