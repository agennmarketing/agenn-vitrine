import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { expect, it } from 'vitest'
import { RESERVED_SUBDOMAINS } from '@/lib/hosts/subdomain'

it('subdomínios reservados são os mesmos no banco e no código', () => {
  const dir = path.join(process.cwd(), 'supabase', 'migrations')
  const sql = readdirSync(dir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => readFileSync(path.join(dir, file), 'utf8'))
    .join('\n')
  const definitions = [...sql.matchAll(/function public\.is_reserved_subdomain[\s\S]*?array\[([\s\S]*?)\]/g)]
  expect(definitions.length).toBeGreaterThan(0)
  const fromSql = [...definitions.at(-1)![1].matchAll(/'([^']+)'/g)].map((match) => match[1]).sort()
  expect(fromSql).toEqual([...RESERVED_SUBDOMAINS].sort())
})
