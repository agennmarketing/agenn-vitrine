const LOCALHOST = /(^|\.)localhost(:\d+)?$/

export function originFor(host: string): string {
  return `${LOCALHOST.test(host) ? 'http' : 'https'}://${host}`
}

export function buildAppUrl(path: string, rootDomain: string): string {
  return `${originFor(`app.${rootDomain}`)}${path}`
}

export function buildVitrineUrl(subdomain: string, rootDomain: string): string {
  return originFor(`${subdomain}.${rootDomain}`)
}

export function safeNextPath(next: string | null | undefined, fallback = '/painel'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\') || /[\s]/.test(next)) {
    return fallback
  }
  return next
}
