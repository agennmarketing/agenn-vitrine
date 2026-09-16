import { isReservedSubdomain, isValidSubdomainFormat } from './subdomain'

export const APP_SUBDOMAIN = 'app'

export type HostResolution =
  | { type: 'marketing' }
  | { type: 'app' }
  | { type: 'vitrine'; subdomain: string }
  | { type: 'redirect'; host: string }
  | { type: 'invalid' }

export type HostConfig = { rootDomain: string; legacyDomains: string[] }

export function parseHost(rawHost: string | null, config: HostConfig): HostResolution {
  if (!rawHost) return { type: 'invalid' }
  const host = rawHost.trim().toLowerCase().replace(/\.$/, '')
  const root = config.rootDomain.toLowerCase()

  for (const legacy of config.legacyDomains) {
    if (host === legacy) return { type: 'redirect', host: root }
    if (host.endsWith(`.${legacy}`)) {
      return { type: 'redirect', host: `${host.slice(0, -legacy.length)}${root}` }
    }
  }

  if (host === root || host === `www.${root}`) return { type: 'marketing' }
  if (!host.endsWith(`.${root}`)) return { type: 'invalid' }

  const label = host.slice(0, -(root.length + 1))
  if (label.includes('.')) return { type: 'invalid' }
  if (label === APP_SUBDOMAIN) return { type: 'app' }
  if (isReservedSubdomain(label) || !isValidSubdomainFormat(label)) return { type: 'invalid' }
  return { type: 'vitrine', subdomain: label }
}

export function internalPathFor(resolution: HostResolution, pathname: string): string {
  const suffix = pathname === '/' ? '' : pathname
  switch (resolution.type) {
    case 'marketing':
      return `/site${suffix}`
    case 'app':
      return `/app${suffix}`
    case 'vitrine':
      return `/v/${resolution.subdomain}${suffix}`
    default:
      return '/host-invalido'
  }
}
