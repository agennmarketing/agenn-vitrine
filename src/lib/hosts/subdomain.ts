export const SUBDOMAIN_MIN_LENGTH = 3
export const SUBDOMAIN_MAX_LENGTH = 30

const SUBDOMAIN_FORMAT = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/

export const RESERVED_SUBDOMAINS: ReadonlySet<string> = new Set([
  'www', 'app', 'painel', 'api', 'admin', 'suporte', 'blog', 'ajuda', 'status',
  'mail', 'email', 'smtp', 'static', 'cdn', 'assets', 'media', 'midia', 'img',
  'docs', 'dev', 'staging', 'teste', 'test', 'auth', 'login', 'entrar', 'cadastro',
  'conta', 'checkout', 'pagamento', 'billing', 'agenn', 'vitrine',
])

export type SubdomainValidation =
  | { ok: true; value: string }
  | { ok: false; reason: 'length' | 'format' | 'reserved' }

export function isReservedSubdomain(value: string): boolean {
  return RESERVED_SUBDOMAINS.has(value)
}

export function isValidSubdomainFormat(value: string): boolean {
  return (
    value.length >= SUBDOMAIN_MIN_LENGTH &&
    value.length <= SUBDOMAIN_MAX_LENGTH &&
    SUBDOMAIN_FORMAT.test(value)
  )
}

export function validateSubdomain(input: string): SubdomainValidation {
  const value = input.trim().toLowerCase()
  if (value.length < SUBDOMAIN_MIN_LENGTH || value.length > SUBDOMAIN_MAX_LENGTH) {
    return { ok: false, reason: 'length' }
  }
  if (!SUBDOMAIN_FORMAT.test(value)) return { ok: false, reason: 'format' }
  if (isReservedSubdomain(value)) return { ok: false, reason: 'reserved' }
  return { ok: true, value }
}

/*
 * Filtro da digitação do endereço: o que não pode entrar não chega a aparecer no campo.
 * Maiúscula vira minúscula e acento sai da letra (Á → a); espaço, símbolo e hífen no
 * começo são descartados. O hífen no fim fica, porque a pessoa pode estar no meio da palavra:
 * esse caso a validação continua avisando.
 */
export function sanitizeSubdomainInput(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+/, '')
    .slice(0, SUBDOMAIN_MAX_LENGTH)
}
