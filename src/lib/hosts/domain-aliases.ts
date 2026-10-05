import { isReservedSubdomain, isValidSubdomainFormat } from './subdomain'

const NETLIFY_API = 'https://api.netlify.com/api/v1'

/*
 * O app só cuida dos aliases que têm cara de vitrine (`<sub>.<raiz>` com subdomínio
 * válido e não reservado). O domínio raiz, o www e qualquer outro nome cadastrado à
 * mão na Netlify ficam como estão.
 */
function vitrineLabel(alias: string, rootDomain: string): string | null {
  const suffix = `.${rootDomain}`
  if (!alias.endsWith(suffix)) return null
  const label = alias.slice(0, -suffix.length)
  return isValidSubdomainFormat(label) && !isReservedSubdomain(label) ? label : null
}

// A Netlify recusa a lista inteira se passar disso (422 "Only 100 domain aliases allowed").
export const NETLIFY_MAX_ALIASES = 100

export type DomainAliasPlan = { aliases: string[]; added: string[]; removed: string[]; skipped: string[]; changed: boolean }

/*
 * Se não couberem todas, entram nesta ordem: `first` (a vitrine que acabou de ser salva),
 * as que já têm endereço na Netlify (ninguém perde o seu) e o resto na ordem de
 * `subdomains`. O que sobra vai em `skipped`, em vez de a Netlify recusar tudo.
 */
export function planDomainAliases(input: { rootDomain: string; current: string[]; subdomains: string[]; first?: string }): DomainAliasPlan {
  const { rootDomain, current } = input
  const kept = current.filter((alias) => vitrineLabel(alias, rootDomain) === null)
  const ordered = [...(input.first ? [input.first] : []), ...input.subdomains]
  const listed = [
    ...new Set(
      ordered
        .filter((sub) => isValidSubdomainFormat(sub) && !isReservedSubdomain(sub))
        .map((sub) => `${sub}.${rootDomain}`),
    ),
  ].filter((alias) => !kept.includes(alias))
  const firstAlias = input.first ? `${input.first}.${rootDomain}` : null
  const rank = (alias: string) => (alias === firstAlias ? 0 : current.includes(alias) ? 1 : 2)
  const valid = [...listed].sort((a, b) => rank(a) - rank(b))
  const room = Math.max(0, NETLIFY_MAX_ALIASES - kept.length)
  const wanted = valid.slice(0, room)
  const skipped = valid.slice(room)
  const aliases = [...kept, ...wanted].sort()
  const added = wanted.filter((alias) => !current.includes(alias)).sort()
  const removed = current.filter((alias) => !aliases.includes(alias)).sort()
  return { aliases, added, removed, skipped, changed: added.length > 0 || removed.length > 0 }
}

type Fetch = (url: string, init?: RequestInit) => Promise<Response>

async function netlify(fetch: Fetch, token: string, path: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(`${NETLIFY_API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  })
  if (!response.ok) {
    // O corpo traz o motivo (ex.: 422 com o domínio recusado): vai junto para o log.
    const detail = (await response.text().catch(() => '')).slice(0, 500)
    throw new Error(`Netlify ${init.method ?? 'GET'} ${path}: ${response.status}${detail ? ` ${detail}` : ''}`)
  }
  return response
}

/*
 * Deixa os aliases do site na Netlify iguais aos subdomínios das vitrines. O PATCH
 * substitui a lista inteira, por isso a lista atual é lida antes. Depois de mudar,
 * pede o certificado de novo; se ele não sair na hora, a Netlify tenta sozinha e a
 * próxima sincronização não depende disso.
 */
export async function syncNetlifyDomainAliases(input: {
  token: string
  siteId: string
  rootDomain: string
  subdomains: string[]
  first?: string
  fetch?: Fetch
}): Promise<{ added: string[]; removed: string[]; skipped: string[] }> {
  const fetch = input.fetch ?? globalThis.fetch
  const sitePath = `/sites/${encodeURIComponent(input.siteId)}`
  const site = (await (await netlify(fetch, input.token, sitePath)).json()) as { domain_aliases?: string[] | null }
  const plan = planDomainAliases({
    rootDomain: input.rootDomain,
    current: site.domain_aliases ?? [],
    subdomains: input.subdomains,
    first: input.first,
  })
  if (!plan.changed) return { added: [], removed: [], skipped: plan.skipped }

  await netlify(fetch, input.token, sitePath, { method: 'PATCH', body: JSON.stringify({ domain_aliases: plan.aliases }) })
  await netlify(fetch, input.token, `${sitePath}/ssl`, { method: 'POST' }).catch(() => undefined)
  return { added: plan.added, removed: plan.removed, skipped: plan.skipped }
}
