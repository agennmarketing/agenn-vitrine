import { describe, expect, it, vi } from 'vitest'
import { planDomainAliases, syncNetlifyDomainAliases } from './domain-aliases'

const ROOT = 'vitrimove.site'

describe('planDomainAliases', () => {
  it('acrescenta as vitrines novas e tira as que não existem mais', () => {
    const plan = planDomainAliases({
      rootDomain: ROOT,
      current: ['vitrimove.site', 'www.vitrimove.site', 'antiga.vitrimove.site', 'ananails.vitrimove.site'],
      subdomains: ['ananails', 'barbearia'],
    })
    expect(plan.changed).toBe(true)
    expect(plan.aliases).toEqual(['ananails.vitrimove.site', 'barbearia.vitrimove.site', 'vitrimove.site', 'www.vitrimove.site'])
    expect(plan.added).toEqual(['barbearia.vitrimove.site'])
    expect(plan.removed).toEqual(['antiga.vitrimove.site'])
  })

  it('não mexe em domínio de fora nem em subdomínio reservado', () => {
    const plan = planDomainAliases({
      rootDomain: ROOT,
      current: ['www.vitrimove.site', 'status.vitrimove.site', 'loja.agenn.com.br', 'a.b.vitrimove.site'],
      subdomains: [],
    })
    expect(plan.changed).toBe(false)
  })

  it('sem diferença não há o que enviar, seja qual for a ordem', () => {
    const plan = planDomainAliases({
      rootDomain: ROOT,
      current: ['bbb.vitrimove.site', 'aaa.vitrimove.site'],
      subdomains: ['aaa', 'bbb'],
    })
    expect(plan.changed).toBe(false)
  })

  it('ignora subdomínio reservado ou inválido vindo do banco', () => {
    const plan = planDomainAliases({ rootDomain: ROOT, current: [], subdomains: ['app', 'Com Espaço', 'ok-1'] })
    expect(plan.aliases).toEqual(['ok-1.vitrimove.site'])
  })
})

function netlifyFetch(aliases: string[]) {
  return vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init?.method || init.method === 'GET') return Response.json({ domain_aliases: aliases })
    return Response.json({})
  })
}

describe('syncNetlifyDomainAliases', () => {
  const base = { token: 'tok', siteId: 'site-1', rootDomain: ROOT }

  it('envia a lista nova e pede o certificado quando algo mudou', async () => {
    const fetch = netlifyFetch(['www.vitrimove.site'])
    const result = await syncNetlifyDomainAliases({ ...base, subdomains: ['ananails'], fetch })

    expect(result).toEqual({ added: ['ananails.vitrimove.site'], removed: [] })
    expect(fetch).toHaveBeenCalledTimes(3)
    const [patchUrl, patchInit] = fetch.mock.calls[1]
    expect(patchUrl).toBe('https://api.netlify.com/api/v1/sites/site-1')
    expect(patchInit?.method).toBe('PATCH')
    expect(JSON.parse(String(patchInit?.body))).toEqual({
      domain_aliases: ['ananails.vitrimove.site', 'www.vitrimove.site'],
    })
    expect(new Headers(patchInit?.headers).get('authorization')).toBe('Bearer tok')
    expect(fetch.mock.calls[2][0]).toBe('https://api.netlify.com/api/v1/sites/site-1/ssl')
  })

  it('só lê quando já está tudo cadastrado', async () => {
    const fetch = netlifyFetch(['ananails.vitrimove.site'])
    const result = await syncNetlifyDomainAliases({ ...base, subdomains: ['ananails'], fetch })
    expect(result).toEqual({ added: [], removed: [] })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('falha da API vira erro', async () => {
    const fetch = vi.fn(async () => new Response('nope', { status: 401 }))
    await expect(syncNetlifyDomainAliases({ ...base, subdomains: [], fetch })).rejects.toThrow(/401 nope/)
  })

  it('certificado que não sai na hora não desfaz o cadastro', async () => {
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      if (!init?.method || init.method === 'GET') return Response.json({ domain_aliases: [] })
      if (init.method === 'PATCH') return Response.json({})
      return new Response('pending', { status: 422 })
    })
    const result = await syncNetlifyDomainAliases({ ...base, subdomains: ['ananails'], fetch })
    expect(result.added).toEqual(['ananails.vitrimove.site'])
  })
})
