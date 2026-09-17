import 'server-only'
import { revalidateTag } from 'next/cache'

export function vitrineTag(subdomain: string) {
  return `vitrine-sub:${subdomain}`
}

// expire: 0 — o dono vê a mudança na próxima visita, sem versão antiga.
export function revalidateVitrine(...subdomains: string[]) {
  for (const subdomain of new Set(subdomains)) revalidateTag(vitrineTag(subdomain), { expire: 0 })
}
