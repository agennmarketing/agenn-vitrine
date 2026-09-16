# Fase 1 — Fundação: Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o projeto Next.js funcionando com roteamento por subdomínio, banco da conta (perfis, planos, assinaturas) protegido por RLS, e o acesso completo: cadastro com confirmação por e-mail, login por senha ou Google, recuperação de senha, sessão única, painel básico e página de conta.

**Architecture:** Um único app Next.js 16 (App Router). O `src/proxy.ts` lê o host e reescreve a requisição para `/site`, `/app` ou `/v/[subdomain]`. No host `app.`, ele também renova a sessão Supabase, protege rotas e aplica a regra de sessão única. As regras de negócio ficam em funções puras em `src/lib/**`, testadas com Vitest. O banco é versionado em migrações do Supabase CLI e testado com pgTAP. Os fluxos de ponta a ponta são testados com Playwright contra o Supabase local.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, @supabase/ssr, @supabase/supabase-js, Zod, Vitest, Playwright, Supabase CLI (Docker), pgTAP, Cloudflare Turnstile, @sentry/nextjs.

**Spec:** `docs/superpowers/specs/2026-09-16-agenn-vitrine-design.md`. Seções usadas nesta fase: 2, 2.1, 2.2, 3 (tabela `plans`), 4.1, 4.8, 8.1, 8.8 (exceto "Excluir conta", que é Fase 6), 10 (sessão substituída), 11 e 12 (Fase 1).

## Global Constraints

- **Idioma:** todo texto visível ao usuário em **português do Brasil**. Identificadores de código em inglês.
- **Domínio:** `NEXT_PUBLIC_ROOT_DOMAIN=agenn.com.br` em produção e `localhost:3000` em desenvolvimento. Nenhum domínio fixo no código.
- **Domínios antigos:** `LEGACY_DOMAINS` (lista separada por vírgula) recebe **redirecionamento 301** preservando subdomínio, caminho e query.
- **Hosts:** `ROOT_DOMAIN` e `www.ROOT_DOMAIN` → página inicial; `app.ROOT_DOMAIN` → Acesso e Painel; `{subdominio}.ROOT_DOMAIN` → vitrine.
- **Subdomínio:** 3 a 30 caracteres, regex `^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$`, não reservado.
- **Senha:** mínimo 8 caracteres, máximo 72.
- **E-mail:** não pode ser alterado. A troca de senha só aparece em contas com identidade `email`.
- **Sessão única:** a mensagem ao derrubar sessão é exatamente `Sua conta foi acessada em outro aparelho.`
- **Planos (seed):**
  - `free`: 1 vitrine, 10 itens/vitrine, 1 vídeo/vitrine, 1 vídeo/conta, 60 s, 500 MB, 1024 GB/mês, sem personalização, com marca d'água
  - `pro`: 3 vitrines, 300 itens/vitrine, 50 vídeos/vitrine, sem limite de vídeo por conta, 60 s, 500 MB, 1024 GB/mês, com personalização, sem marca d'água
- **Plano efetivo:** `active`/`trialing` → plano da assinatura; `past_due` com `grace_until > now()` → plano da assinatura; qualquer outro caso → `free`.
- **Banco:** toda tabela com RLS ativa. Escrita em `subscriptions` só pelo servidor (service role).
- **Pré-requisitos locais:** Node.js 20.9+, Docker Desktop em execução (para o Supabase CLI).
- **Design:** tarefas com interface usam a skill **impeccable** sem mudar nomes de componentes, props, rótulos, textos de botões e títulos usados pelos testes.
- **Cor da marca do sistema** (extraída do logo): verde profundo `#0B2A1C` com texto branco.

---

## Mapa de arquivos

```
.gitattributes                         # finais de linha LF
.env.example                           # variáveis documentadas
next.config.ts                         # allowedDevOrigins + Sentry
vitest.config.ts
playwright.config.ts
public/brand/logo-icone.png
supabase/config.toml                   # auth local: site_url, e-mail, templates
supabase/migrations/20260916000000_account.sql
supabase/templates/confirmacao.html
supabase/templates/recuperacao.html
supabase/tests/database/01_account.test.sql
src/proxy.ts                           # roteamento por host + sessão
src/instrumentation.ts                 # Sentry (servidor)
src/instrumentation-client.ts          # Sentry (navegador)
src/sentry.server.config.ts
src/sentry.edge.config.ts
src/lib/env-schema.ts                  # validação das variáveis (pura)
src/lib/env.ts                         # leitura de process.env
src/lib/hosts/subdomain.ts             # validação e reservados
src/lib/hosts/parse-host.ts            # host → destino, destino → caminho interno
src/lib/hosts/urls.ts                  # URLs absolutas e next seguro
src/lib/auth/session.ts                # sessão atual? tem senha?
src/lib/auth/app-routes.ts             # decisão de rota no host app
src/lib/auth/auth-errors.ts            # mensagens em PT
src/lib/auth/schemas.ts                # validação dos formulários
src/lib/forms/form-state.ts            # estado dos formulários
src/lib/supabase/database.types.ts     # gerado
src/lib/supabase/server.ts
src/lib/supabase/browser.ts
src/lib/supabase/verifier.ts           # cliente sem sessão para conferir senha atual
src/features/auth/actions.ts           # server actions de acesso
src/features/account/actions.ts        # server actions da conta
src/components/ui/button.tsx
src/components/ui/input.tsx
src/components/ui/field.tsx
src/components/ui/form-message.tsx
src/components/ui/card.tsx
src/components/ui/submit-button.tsx
src/components/auth/auth-shell.tsx
src/components/auth/turnstile.tsx
src/components/auth/google-button.tsx
src/app/layout.tsx
src/app/globals.css
src/app/host-invalido/page.tsx
src/app/site/page.tsx
src/app/v/[subdomain]/page.tsx
src/app/v/[subdomain]/not-found.tsx
src/app/app/auth/callback/route.ts
src/app/app/auth/confirm/route.ts
src/app/app/(auth)/entrar/page.tsx
src/app/app/(auth)/entrar/sign-in-form.tsx
src/app/app/(auth)/cadastro/page.tsx
src/app/app/(auth)/cadastro/sign-up-form.tsx
src/app/app/(auth)/confirmar-email/page.tsx
src/app/app/(auth)/confirmar-email/resend-form.tsx
src/app/app/(auth)/esqueci-senha/page.tsx
src/app/app/(auth)/esqueci-senha/forgot-password-form.tsx
src/app/app/(auth)/redefinir-senha/page.tsx
src/app/app/(auth)/redefinir-senha/reset-password-form.tsx
src/app/app/(painel)/layout.tsx
src/app/app/(painel)/painel/page.tsx
src/app/app/(painel)/painel/conta/page.tsx
src/app/app/(painel)/painel/conta/name-form.tsx
src/app/app/(painel)/painel/conta/change-password-form.tsx
e2e/helpers.ts
e2e/routing.spec.ts
e2e/auth.spec.ts
e2e/account.spec.ts
docs/setup/fase-1-infra.md
```

---

### Task 1: Projeto base e ferramentas

**Files:**
- Create: projeto Next.js na raiz, `.gitattributes`, `.env.example`, `vitest.config.ts`, `src/lib/env-schema.ts`, `src/lib/env.ts`
- Modify: `.gitignore`, `package.json`, `next.config.ts`
- Test: `src/lib/env-schema.test.ts`

**Interfaces:**
- Produces: `parseEnv(source: Record<string, string | undefined>): Env` e `env: Env`, com os campos `NEXT_PUBLIC_ROOT_DOMAIN: string`, `LEGACY_DOMAINS: string[]`, `NEXT_PUBLIC_SUPABASE_URL: string`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: string`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY: string` e `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: boolean`. Também produz os scripts npm `test`, `test:db`, `test:e2e`, `typecheck`, `db:start`, `db:reset` e `db:types`.

- [ ] **Step 1: Gerar o projeto em pasta temporária e mover para a raiz**

A raiz já tem `docs/`, `.claude/`, `banco de imagens/` e `.git/`, e o `create-next-app` recusa pastas não vazias. Rode no Git Bash, a partir da raiz do projeto:

```bash
npx create-next-app@16 agenn-tmp --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --turbopack --yes
shopt -s dotglob
for f in agenn-tmp/*; do name=$(basename "$f"); if [ "$name" != ".git" ]; then mv "$f" .; fi; done
rm -rf agenn-tmp
```

Expected: `package.json`, `src/app/`, `next.config.ts` e `tsconfig.json` na raiz.

- [ ] **Step 2: Instalar dependências**

```bash
npm i @supabase/supabase-js @supabase/ssr zod
npm i -D supabase vitest @playwright/test dotenv
npx playwright install chromium
```

- [ ] **Step 3: Configurar git, scripts e Next**

`.gitattributes`:

```
* text=auto eol=lf
*.png binary
```

Acrescente ao final do `.gitignore`:

```
# local
.env*.local
supabase/.temp
supabase/.branches
playwright-report
test-results
banco de imagens/
```

No `package.json`, deixe `"scripts"` assim:

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint .",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:db": "supabase test db",
  "test:e2e": "playwright test",
  "db:start": "supabase start",
  "db:reset": "supabase db reset",
  "db:types": "supabase gen types typescript --local > src/lib/supabase/database.types.ts"
}
```

`next.config.ts`:

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  allowedDevOrigins: ['localhost', '*.localhost'],
}

export default nextConfig
```

`vitest.config.ts`:

```ts
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
```

`.env.example`:

```
# Domínio raiz. Local: localhost:3000 | Produção: agenn.com.br
NEXT_PUBLIC_ROOT_DOMAIN=localhost:3000
# Domínios antigos que redirecionam (301) para o atual, separados por vírgula
LEGACY_DOMAINS=
# Supabase (local: copie de `npx supabase status`)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
# Cloudflare Turnstile (vazio = desligado, padrão local)
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
# Login com Google (true/false)
NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false
# Sentry (vazio = desligado)
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
# Mailpit do Supabase local (testes e2e)
MAILPIT_URL=http://127.0.0.1:54324
```

- [ ] **Step 4: Escrever o teste do env (falhando)**

A validação fica em `env-schema.ts` (função pura, testável) e a leitura de `process.env` fica em `env.ts`. Assim o teste não depende das variáveis da máquina.

`src/lib/env-schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseEnv } from './env-schema'

const base = {
  NEXT_PUBLIC_ROOT_DOMAIN: 'agenn.com.br',
  NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x',
}

describe('parseEnv', () => {
  it('aplica padrões para variáveis opcionais', () => {
    const env = parseEnv(base)
    expect(env.LEGACY_DOMAINS).toEqual([])
    expect(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY).toBe('')
    expect(env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED).toBe(false)
  })

  it('separa, limpa e normaliza domínios antigos', () => {
    const env = parseEnv({ ...base, LEGACY_DOMAINS: ' Agenn.com.br , ,old.com ' })
    expect(env.LEGACY_DOMAINS).toEqual(['agenn.com.br', 'old.com'])
  })

  it('normaliza o domínio raiz para minúsculas', () => {
    expect(parseEnv({ ...base, NEXT_PUBLIC_ROOT_DOMAIN: 'Agenn.com.br' }).NEXT_PUBLIC_ROOT_DOMAIN).toBe('agenn.com.br')
  })

  it('liga o Google só com "true"', () => {
    expect(parseEnv({ ...base, NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: 'true' }).NEXT_PUBLIC_GOOGLE_AUTH_ENABLED).toBe(true)
    expect(parseEnv({ ...base, NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: 'yes' }).NEXT_PUBLIC_GOOGLE_AUTH_ENABLED).toBe(false)
  })

  it('falha sem domínio raiz', () => {
    expect(() => parseEnv({ ...base, NEXT_PUBLIC_ROOT_DOMAIN: undefined })).toThrow()
  })
})
```

- [ ] **Step 5: Rodar e ver falhar**

Run: `npx vitest run src/lib/env-schema.test.ts`
Expected: FAIL com `Failed to resolve import "./env-schema"`.

- [ ] **Step 6: Implementar**

`src/lib/env-schema.ts`:

```ts
import { z } from 'zod'

export const envSchema = z.object({
  NEXT_PUBLIC_ROOT_DOMAIN: z.string().trim().min(1).toLowerCase(),
  LEGACY_DOMAINS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((domain) => domain.trim().toLowerCase())
        .filter(Boolean),
    ),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().default(''),
  NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: z
    .string()
    .default('false')
    .transform((value) => value === 'true'),
})

export type Env = z.infer<typeof envSchema>

export function parseEnv(source: Record<string, string | undefined>): Env {
  return envSchema.parse(source)
}
```

`src/lib/env.ts`:

```ts
import { parseEnv } from './env-schema'

export type { Env } from './env-schema'

// Referências literais: o Next só injeta NEXT_PUBLIC_* no navegador quando escritas assim.
export const env = parseEnv({
  NEXT_PUBLIC_ROOT_DOMAIN: process.env.NEXT_PUBLIC_ROOT_DOMAIN,
  LEGACY_DOMAINS: process.env.LEGACY_DOMAINS,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED,
})
```

- [ ] **Step 7: Rodar os testes**

Run: `npx vitest run`
Expected: PASS (5 testes).

- [ ] **Step 8: Conferir o build**

Crie `.env.local` copiando `.env.example` e preencha `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=placeholder` por enquanto (a chave real vem na Task 3).
Run: `npm run typecheck && npm run build`
Expected: os dois sem erros.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: projeto Next.js 16 com Vitest, Playwright e validação de env"
```

---

### Task 2: Hosts, subdomínios e URLs

**Files:**
- Create: `src/lib/hosts/subdomain.ts`, `src/lib/hosts/parse-host.ts`, `src/lib/hosts/urls.ts`
- Test: `src/lib/hosts/subdomain.test.ts`, `src/lib/hosts/parse-host.test.ts`, `src/lib/hosts/urls.test.ts`

**Interfaces:**
- Produces:
  - `validateSubdomain(input: string): { ok: true; value: string } | { ok: false; reason: 'length' | 'format' | 'reserved' }`
  - `isValidSubdomainFormat(value: string): boolean`
  - `isReservedSubdomain(value: string): boolean`
  - `RESERVED_SUBDOMAINS: ReadonlySet<string>`
  - `type HostResolution = { type: 'marketing' } | { type: 'app' } | { type: 'vitrine'; subdomain: string } | { type: 'redirect'; host: string } | { type: 'invalid' }`
  - `parseHost(rawHost: string | null, config: { rootDomain: string; legacyDomains: string[] }): HostResolution`
  - `internalPathFor(resolution: HostResolution, pathname: string): string`
  - `originFor(host: string): string`
  - `buildAppUrl(path: string, rootDomain: string): string`
  - `buildVitrineUrl(subdomain: string, rootDomain: string): string`
  - `safeNextPath(next: string | null | undefined, fallback?: string): string`

- [ ] **Step 1: Escrever os testes (falhando)**

`src/lib/hosts/subdomain.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isReservedSubdomain, isValidSubdomainFormat, validateSubdomain } from './subdomain'

describe('validateSubdomain', () => {
  it('aceita e normaliza um subdomínio válido', () => {
    expect(validateSubdomain('  BurgerDoZe ')).toEqual({ ok: true, value: 'burgerdoze' })
    expect(validateSubdomain('loja-da-ana-2')).toEqual({ ok: true, value: 'loja-da-ana-2' })
  })

  it('recusa tamanho fora de 3 a 30', () => {
    expect(validateSubdomain('ab')).toEqual({ ok: false, reason: 'length' })
    expect(validateSubdomain('a'.repeat(31))).toEqual({ ok: false, reason: 'length' })
    expect(validateSubdomain('abc')).toEqual({ ok: true, value: 'abc' })
    expect(validateSubdomain('a'.repeat(30)).ok).toBe(true)
  })

  it('recusa formato inválido', () => {
    for (const bad of ['-loja', 'loja-', 'lo ja', 'lojá', 'lo_ja', 'lo.ja']) {
      expect(validateSubdomain(bad)).toEqual({ ok: false, reason: 'format' })
    }
  })

  it('recusa nomes reservados', () => {
    for (const reserved of ['www', 'app', 'painel', 'api', 'admin', 'suporte', 'blog']) {
      expect(validateSubdomain(reserved)).toEqual({ ok: false, reason: 'reserved' })
    }
  })
})

describe('helpers', () => {
  it('isValidSubdomainFormat considera tamanho e formato', () => {
    expect(isValidSubdomainFormat('loja')).toBe(true)
    expect(isValidSubdomainFormat('lo')).toBe(false)
    expect(isValidSubdomainFormat('Loja')).toBe(false)
  })

  it('isReservedSubdomain', () => {
    expect(isReservedSubdomain('api')).toBe(true)
    expect(isReservedSubdomain('burgerdoze')).toBe(false)
  })
})
```

`src/lib/hosts/parse-host.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { internalPathFor, parseHost } from './parse-host'

const prod = { rootDomain: 'agennvitrine.com.br', legacyDomains: ['agenn.com.br'] }
const local = { rootDomain: 'localhost:3000', legacyDomains: [] }

describe('parseHost', () => {
  it('domínio raiz e www vão para a página inicial', () => {
    expect(parseHost('agennvitrine.com.br', prod)).toEqual({ type: 'marketing' })
    expect(parseHost('www.agennvitrine.com.br', prod)).toEqual({ type: 'marketing' })
    expect(parseHost('localhost:3000', local)).toEqual({ type: 'marketing' })
  })

  it('app. vai para o painel', () => {
    expect(parseHost('app.agennvitrine.com.br', prod)).toEqual({ type: 'app' })
    expect(parseHost('APP.localhost:3000', local)).toEqual({ type: 'app' })
  })

  it('subdomínio válido vai para a vitrine', () => {
    expect(parseHost('burgerdoze.agennvitrine.com.br', prod)).toEqual({ type: 'vitrine', subdomain: 'burgerdoze' })
    expect(parseHost('burgerdoze.localhost:3000', local)).toEqual({ type: 'vitrine', subdomain: 'burgerdoze' })
    expect(parseHost('burgerdoze.agennvitrine.com.br.', prod)).toEqual({ type: 'vitrine', subdomain: 'burgerdoze' })
  })

  it('domínio antigo redireciona preservando o subdomínio', () => {
    expect(parseHost('agenn.com.br', prod)).toEqual({ type: 'redirect', host: 'agennvitrine.com.br' })
    expect(parseHost('burgerdoze.agenn.com.br', prod)).toEqual({ type: 'redirect', host: 'burgerdoze.agennvitrine.com.br' })
    expect(parseHost('app.agenn.com.br', prod)).toEqual({ type: 'redirect', host: 'app.agennvitrine.com.br' })
  })

  it('hosts inválidos', () => {
    expect(parseHost(null, prod)).toEqual({ type: 'invalid' })
    expect(parseHost('outro.com', prod)).toEqual({ type: 'invalid' })
    expect(parseHost('a.b.agennvitrine.com.br', prod)).toEqual({ type: 'invalid' })
    expect(parseHost('api.agennvitrine.com.br', prod)).toEqual({ type: 'invalid' })
    expect(parseHost('xy.agennvitrine.com.br', prod)).toEqual({ type: 'invalid' })
    expect(parseHost('fakeagennvitrine.com.br', prod)).toEqual({ type: 'invalid' })
  })
})

describe('internalPathFor', () => {
  it('prefixa o caminho conforme o destino', () => {
    expect(internalPathFor({ type: 'marketing' }, '/')).toBe('/site')
    expect(internalPathFor({ type: 'marketing' }, '/precos')).toBe('/site/precos')
    expect(internalPathFor({ type: 'app' }, '/painel/conta')).toBe('/app/painel/conta')
    expect(internalPathFor({ type: 'vitrine', subdomain: 'burgerdoze' }, '/')).toBe('/v/burgerdoze')
    expect(internalPathFor({ type: 'invalid' }, '/qualquer')).toBe('/host-invalido')
    expect(internalPathFor({ type: 'redirect', host: 'x' }, '/qualquer')).toBe('/host-invalido')
  })
})
```

`src/lib/hosts/urls.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildAppUrl, buildVitrineUrl, originFor, safeNextPath } from './urls'

describe('urls', () => {
  it('usa http em localhost e https no resto', () => {
    expect(originFor('app.localhost:3000')).toBe('http://app.localhost:3000')
    expect(originFor('localhost:3000')).toBe('http://localhost:3000')
    expect(originFor('app.agenn.com.br')).toBe('https://app.agenn.com.br')
  })

  it('monta URLs do app e da vitrine', () => {
    expect(buildAppUrl('/auth/callback', 'agenn.com.br')).toBe('https://app.agenn.com.br/auth/callback')
    expect(buildVitrineUrl('burgerdoze', 'localhost:3000')).toBe('http://burgerdoze.localhost:3000')
  })

  it('safeNextPath só aceita caminhos internos', () => {
    expect(safeNextPath('/painel/conta')).toBe('/painel/conta')
    expect(safeNextPath(null)).toBe('/painel')
    expect(safeNextPath('https://mal.com')).toBe('/painel')
    expect(safeNextPath('//mal.com')).toBe('/painel')
    expect(safeNextPath('/\\mal.com')).toBe('/painel')
    expect(safeNextPath('', '/entrar')).toBe('/entrar')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/hosts`
Expected: FAIL com `Failed to resolve import` nos três arquivos.

- [ ] **Step 3: Implementar**

`src/lib/hosts/subdomain.ts`:

```ts
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
```

`src/lib/hosts/parse-host.ts`:

```ts
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
```

`src/lib/hosts/urls.ts`:

```ts
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
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    return fallback
  }
  return next
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npx vitest run src/lib/hosts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/hosts
git commit -m "feat: resolução de host, subdomínios reservados e URLs"
```

---

### Task 3: Banco da conta (Supabase local, migração e RLS)

**Files:**
- Create: `supabase/config.toml` (via `supabase init`), `supabase/migrations/20260916000000_account.sql`, `supabase/tests/database/01_account.test.sql`, `src/lib/supabase/database.types.ts` (gerado)
- Modify: `.env.local`

**Interfaces:**
- Produces:
  - tabelas `public.plans`, `public.profiles` (`id`, `name`, `active_session_id`, `created_at`, `updated_at`) e `public.subscriptions`
  - funções `public.claim_session(): void` (exposta), `public.my_entitlements(): public.plans` (exposta) e `public.effective_plan_id(uuid): text` (**não** exposta)
  - tipo `Database` em `src/lib/supabase/database.types.ts`

- [ ] **Step 1: Iniciar o Supabase local**

Com o Docker Desktop aberto:

```bash
npx supabase init
npx supabase start
npx supabase status
```

Copie `API URL`, `Publishable key` e `Secret key` do `status` para `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SECRET_KEY`).

- [ ] **Step 2: Escrever o teste do banco (falhando)**

`supabase/tests/database/01_account.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@teste.com', '{"name":"Ana"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bia@teste.com', '{"full_name":"Bia Google"}'),
  ('00000000-0000-0000-0000-00000000000c', 'caio@teste.com', '{}');

select is((select name from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 'Ana', 'profile usa name do cadastro');
select is((select name from public.profiles where id = '00000000-0000-0000-0000-00000000000b'), 'Bia Google', 'profile usa full_name do Google');
select is((select name from public.profiles where id = '00000000-0000-0000-0000-00000000000c'), '', 'profile sem nome fica vazio');

insert into public.subscriptions (user_id, plan_id, status, grace_until) values
  ('00000000-0000-0000-0000-00000000000a', 'pro', 'active', null),
  ('00000000-0000-0000-0000-00000000000b', 'pro', 'past_due', now() + interval '2 days'),
  ('00000000-0000-0000-0000-00000000000c', 'pro', 'past_due', now() - interval '1 day');

select is(public.effective_plan_id('00000000-0000-0000-0000-00000000000a'), 'pro', 'assinatura ativa = pro');
select is(public.effective_plan_id('00000000-0000-0000-0000-00000000000b'), 'pro', 'past_due dentro da carência = pro');
select is(public.effective_plan_id('00000000-0000-0000-0000-00000000000c'), 'free', 'past_due fora da carência = free');
select is(public.effective_plan_id('00000000-0000-0000-0000-0000000000ff'), 'free', 'sem assinatura = free');

set local role anon;
select is((select count(*)::int from public.plans), 2, 'visitante lê os planos');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","session_id":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select is((select count(*)::int from public.profiles), 1, 'usuário vê só o próprio profile');
select is((select count(*)::int from public.subscriptions), 1, 'usuário vê só a própria assinatura');
select lives_ok($$ update public.profiles set name = 'Ana Maria' where id = '00000000-0000-0000-0000-00000000000a' $$, 'usuário altera o próprio nome');
select throws_ok($$ update public.profiles set active_session_id = gen_random_uuid() where id = '00000000-0000-0000-0000-00000000000a' $$, '42501', null, 'usuário não altera active_session_id direto');
select throws_ok($$ insert into public.subscriptions (user_id, plan_id, status) values ('00000000-0000-0000-0000-00000000000a', 'pro', 'active') $$, '42501', null, 'usuário não grava assinatura');
select lives_ok($$ select public.claim_session() $$, 'claim_session executa');
select is((select active_session_id::text from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), '11111111-1111-1111-1111-111111111111', 'claim_session grava a sessão do JWT');
select is((select (public.my_entitlements()).id), 'pro', 'my_entitlements retorna o plano efetivo');
select throws_ok($$ select public.effective_plan_id('00000000-0000-0000-0000-00000000000b') $$, '42501', null, 'effective_plan_id não é exposto ao usuário');

select * from finish();
rollback;
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm run test:db`
Expected: FAIL (a tabela `public.profiles` não existe).

- [ ] **Step 4: Escrever a migração**

`supabase/migrations/20260916000000_account.sql`:

```sql
-- Conta: planos, perfis e assinaturas

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Planos: todos os limites vivem aqui (spec seção 3)
create table public.plans (
  id text primary key,
  name text not null,
  max_vitrines int not null,
  max_items_per_vitrine int not null,
  max_videos_per_vitrine int not null,
  max_videos_per_account int,
  max_video_seconds int not null,
  max_video_upload_mb int not null,
  monthly_video_gb int not null,
  allow_branding boolean not null,
  show_watermark boolean not null
);

insert into public.plans values
  ('free', 'Gratuito', 1, 10, 1, 1, 60, 500, 1024, false, true),
  ('pro', 'Pro', 3, 300, 50, null, 60, 500, 1024, true, false);

-- Perfis
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  active_session_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Assinaturas (escritas só pelo servidor)
create table public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  plan_id text not null default 'free' references public.plans (id),
  status text not null default 'none',
  interval text check (interval in ('month', 'year')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  grace_until timestamptz,
  pro_ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- Plano efetivo (uso interno: triggers e servidor)
create function public.effective_plan_id(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select case
        when s.status in ('active', 'trialing') then s.plan_id
        when s.status = 'past_due' and s.grace_until > now() then s.plan_id
      end
      from public.subscriptions s
      where s.user_id = p_user_id
    ),
    'free'
  );
$$;

revoke execute on function public.effective_plan_id(uuid) from public, anon, authenticated;

-- Limites do usuário logado
create function public.my_entitlements()
returns public.plans
language sql
stable
security definer
set search_path = ''
as $$
  select p.* from public.plans p where p.id = public.effective_plan_id(auth.uid());
$$;

revoke execute on function public.my_entitlements() from public, anon;
grant execute on function public.my_entitlements() to authenticated;

-- Sessão única: grava a sessão do JWT atual como a ativa
create function public.claim_session()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles
  set active_session_id = (auth.jwt() ->> 'session_id')::uuid
  where id = auth.uid();
$$;

revoke execute on function public.claim_session() from public, anon;
grant execute on function public.claim_session() to authenticated;

-- RLS e privilégios
alter table public.plans enable row level security;
alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;

revoke all on public.plans from anon, authenticated;
grant select on public.plans to anon, authenticated;
create policy "planos são públicos" on public.plans
  for select to anon, authenticated using (true);

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (name) on public.profiles to authenticated;
create policy "dono lê o próprio perfil" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "dono altera o próprio perfil" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

revoke all on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;
create policy "dono lê a própria assinatura" on public.subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);
```

- [ ] **Step 5: Aplicar e testar**

Run: `npm run db:reset && npm run test:db`
Expected: `01_account.test.sql .. ok` e `All tests successful`.

- [ ] **Step 6: Gerar os tipos**

Run: `npm run db:types`
Expected: `src/lib/supabase/database.types.ts` criado, contendo `profiles`, `plans`, `subscriptions`, `claim_session` e `my_entitlements`.

- [ ] **Step 7: Commit**

```bash
git add supabase src/lib/supabase/database.types.ts
git commit -m "feat(db): planos, perfis, assinaturas, plano efetivo e sessão única com RLS"
```

---

### Task 4: Regras de acesso (funções puras)

**Files:**
- Create: `src/lib/auth/session.ts`, `src/lib/auth/app-routes.ts`, `src/lib/auth/auth-errors.ts`, `src/lib/auth/schemas.ts`, `src/lib/forms/form-state.ts`
- Test: `src/lib/auth/session.test.ts`, `src/lib/auth/app-routes.test.ts`, `src/lib/auth/auth-errors.test.ts`, `src/lib/auth/schemas.test.ts`, `src/lib/forms/form-state.test.ts`

**Interfaces:**
- Produces:
  - `isSessionCurrent(claimSessionId: string | null | undefined, activeSessionId: string | null | undefined): boolean`
  - `hasPasswordLogin(identities: ReadonlyArray<{ provider: string }> | null | undefined): boolean`
  - `PUBLIC_APP_PATHS: readonly string[]`
  - `type AppRouteDecision = { action: 'continue' } | { action: 'redirect'; to: string } | { action: 'end-session'; to: string }`
  - `decideAppRoute(input: { pathname: string; isAuthenticated: boolean; isSessionCurrent: boolean }): AppRouteDecision`
  - `SESSION_REPLACED_MESSAGE: string`
  - `mapAuthError(code: string | undefined): string`
  - `loginNotice(params: { motivo?: string; erro?: string; aviso?: string }): { kind: 'error' | 'success'; text: string } | null`
  - `signUpSchema`, `signInSchema`, `forgotPasswordSchema`, `resetPasswordSchema`, `changePasswordSchema`, `profileNameSchema` (Zod)
  - `type FormState = { error?: string; success?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> }`
  - `initialFormState: FormState`
  - `fieldErrorsFromZod(error: { issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }> }): Record<string, string>`

- [ ] **Step 1: Escrever os testes (falhando)**

`src/lib/auth/session.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { hasPasswordLogin, isSessionCurrent } from './session'

describe('isSessionCurrent', () => {
  it('sem sessão ativa registrada, aceita', () => {
    expect(isSessionCurrent('s1', null)).toBe(true)
  })
  it('aceita só a sessão registrada', () => {
    expect(isSessionCurrent('s1', 's1')).toBe(true)
    expect(isSessionCurrent('s2', 's1')).toBe(false)
    expect(isSessionCurrent(undefined, 's1')).toBe(false)
  })
})

describe('hasPasswordLogin', () => {
  it('true só com identidade email', () => {
    expect(hasPasswordLogin([{ provider: 'email' }])).toBe(true)
    expect(hasPasswordLogin([{ provider: 'google' }])).toBe(false)
    expect(hasPasswordLogin([{ provider: 'google' }, { provider: 'email' }])).toBe(true)
    expect(hasPasswordLogin(undefined)).toBe(false)
  })
})
```

`src/lib/auth/app-routes.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { decideAppRoute } from './app-routes'

const guest = { isAuthenticated: false, isSessionCurrent: true }
const user = { isAuthenticated: true, isSessionCurrent: true }

describe('decideAppRoute', () => {
  it('raiz leva ao painel ou ao login', () => {
    expect(decideAppRoute({ pathname: '/', ...guest })).toEqual({ action: 'redirect', to: '/entrar' })
    expect(decideAppRoute({ pathname: '/', ...user })).toEqual({ action: 'redirect', to: '/painel' })
  })

  it('visitante em rota protegida vai para o login guardando o destino', () => {
    expect(decideAppRoute({ pathname: '/painel/conta', ...guest })).toEqual({
      action: 'redirect',
      to: '/entrar?next=%2Fpainel%2Fconta',
    })
    expect(decideAppRoute({ pathname: '/redefinir-senha', ...guest })).toEqual({
      action: 'redirect',
      to: '/entrar?next=%2Fredefinir-senha',
    })
  })

  it('visitante acessa as rotas públicas', () => {
    for (const pathname of ['/entrar', '/cadastro', '/confirmar-email', '/esqueci-senha', '/auth/callback', '/auth/confirm']) {
      expect(decideAppRoute({ pathname, ...guest })).toEqual({ action: 'continue' })
    }
  })

  it('usuário logado não vê telas de visitante', () => {
    for (const pathname of ['/entrar', '/cadastro', '/esqueci-senha']) {
      expect(decideAppRoute({ pathname, ...user })).toEqual({ action: 'redirect', to: '/painel' })
    }
    expect(decideAppRoute({ pathname: '/painel', ...user })).toEqual({ action: 'continue' })
    expect(decideAppRoute({ pathname: '/redefinir-senha', ...user })).toEqual({ action: 'continue' })
  })

  it('sessão substituída é encerrada em qualquer rota', () => {
    expect(decideAppRoute({ pathname: '/painel', isAuthenticated: true, isSessionCurrent: false })).toEqual({
      action: 'end-session',
      to: '/entrar?motivo=outro-aparelho',
    })
  })

  it('não confunde prefixos parecidos', () => {
    expect(decideAppRoute({ pathname: '/entrarx', ...guest })).toEqual({ action: 'redirect', to: '/entrar?next=%2Fentrarx' })
  })
})
```

`src/lib/auth/auth-errors.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { loginNotice, mapAuthError, SESSION_REPLACED_MESSAGE } from './auth-errors'

describe('mapAuthError', () => {
  it('traduz códigos conhecidos', () => {
    expect(mapAuthError('invalid_credentials')).toBe('E-mail ou senha incorretos.')
    expect(mapAuthError('email_not_confirmed')).toBe('Confirme seu e-mail antes de entrar.')
    expect(mapAuthError('user_already_exists')).toBe('Já existe uma conta com este e-mail.')
    expect(mapAuthError('same_password')).toBe('A nova senha deve ser diferente da atual.')
    expect(mapAuthError('over_email_send_rate_limit')).toBe('Muitas tentativas. Aguarde alguns minutos e tente de novo.')
  })
  it('tem mensagem padrão', () => {
    expect(mapAuthError(undefined)).toBe('Algo deu errado. Tente novamente.')
    expect(mapAuthError('qualquer_coisa')).toBe('Algo deu errado. Tente novamente.')
  })
})

describe('loginNotice', () => {
  it('mensagens da tela de login', () => {
    expect(loginNotice({ motivo: 'outro-aparelho' })).toEqual({ kind: 'error', text: SESSION_REPLACED_MESSAGE })
    expect(SESSION_REPLACED_MESSAGE).toBe('Sua conta foi acessada em outro aparelho.')
    expect(loginNotice({ erro: 'link-invalido' })).toEqual({ kind: 'error', text: 'Link inválido ou expirado. Solicite um novo.' })
    expect(loginNotice({ erro: 'google' })).toEqual({ kind: 'error', text: 'Não foi possível entrar com o Google. Tente novamente.' })
    expect(loginNotice({ aviso: 'senha-alterada' })).toEqual({ kind: 'success', text: 'Senha alterada. Entre com a nova senha.' })
    expect(loginNotice({})).toBeNull()
  })
})
```

`src/lib/auth/schemas.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { changePasswordSchema, resetPasswordSchema, signInSchema, signUpSchema } from './schemas'

describe('schemas', () => {
  it('cadastro normaliza e valida', () => {
    const ok = signUpSchema.safeParse({ name: '  Ana ', email: ' ANA@Teste.com ', password: '12345678' })
    expect(ok.success && ok.data).toEqual({ name: 'Ana', email: 'ana@teste.com', password: '12345678' })

    const bad = signUpSchema.safeParse({ name: 'A', email: 'x', password: '123' })
    expect(bad.success).toBe(false)
    const messages = bad.success ? [] : bad.error.issues.map((i) => i.message)
    expect(messages).toContain('Informe seu nome.')
    expect(messages).toContain('Informe um e-mail válido.')
    expect(messages).toContain('A senha precisa ter pelo menos 8 caracteres.')
  })

  it('senha acima de 72 caracteres é recusada', () => {
    expect(signUpSchema.safeParse({ name: 'Ana', email: 'a@a.com', password: 'a'.repeat(73) }).success).toBe(false)
  })

  it('login exige senha', () => {
    expect(signInSchema.safeParse({ email: 'a@a.com', password: '' }).success).toBe(false)
  })

  it('redefinição exige senhas iguais', () => {
    const r = resetPasswordSchema.safeParse({ password: '12345678', confirmPassword: '87654321' })
    expect(r.success).toBe(false)
    expect(r.success ? null : r.error.issues[0]).toMatchObject({ path: ['confirmPassword'], message: 'As senhas não conferem.' })
  })

  it('troca de senha exige senha nova diferente', () => {
    const r = changePasswordSchema.safeParse({ currentPassword: '12345678', password: '12345678', confirmPassword: '12345678' })
    expect(r.success).toBe(false)
    expect(r.success ? null : r.error.issues[0]).toMatchObject({ path: ['password'], message: 'A nova senha deve ser diferente da atual.' })
  })
})
```

`src/lib/forms/form-state.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { fieldErrorsFromZod } from './form-state'

describe('fieldErrorsFromZod', () => {
  it('pega a primeira mensagem de cada campo', () => {
    expect(
      fieldErrorsFromZod({
        issues: [
          { path: ['email'], message: 'primeira' },
          { path: ['email'], message: 'segunda' },
          { path: ['password'], message: 'senha' },
        ],
      }),
    ).toEqual({ email: 'primeira', password: 'senha' })
  })
  it('ignora erros sem campo', () => {
    expect(fieldErrorsFromZod({ issues: [{ path: [], message: 'geral' }] })).toEqual({})
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/auth src/lib/forms`
Expected: FAIL com `Failed to resolve import`.

- [ ] **Step 3: Implementar**

`src/lib/auth/session.ts`:

```ts
export function isSessionCurrent(
  claimSessionId: string | null | undefined,
  activeSessionId: string | null | undefined,
): boolean {
  if (!activeSessionId) return true
  return claimSessionId === activeSessionId
}

export function hasPasswordLogin(identities: ReadonlyArray<{ provider: string }> | null | undefined): boolean {
  return Boolean(identities?.some((identity) => identity.provider === 'email'))
}
```

`src/lib/auth/app-routes.ts`:

```ts
export const PUBLIC_APP_PATHS = [
  '/entrar',
  '/cadastro',
  '/confirmar-email',
  '/esqueci-senha',
  '/auth/callback',
  '/auth/confirm',
] as const

const GUEST_ONLY_PATHS: readonly string[] = ['/entrar', '/cadastro', '/esqueci-senha']

export type AppRouteDecision =
  | { action: 'continue' }
  | { action: 'redirect'; to: string }
  | { action: 'end-session'; to: string }

function matches(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`)
}

export function decideAppRoute(input: {
  pathname: string
  isAuthenticated: boolean
  isSessionCurrent: boolean
}): AppRouteDecision {
  const { pathname, isAuthenticated, isSessionCurrent } = input

  if (isAuthenticated && !isSessionCurrent) {
    return { action: 'end-session', to: '/entrar?motivo=outro-aparelho' }
  }
  if (pathname === '/') {
    return { action: 'redirect', to: isAuthenticated ? '/painel' : '/entrar' }
  }

  const isPublic = PUBLIC_APP_PATHS.some((path) => matches(pathname, path))
  if (!isAuthenticated && !isPublic) {
    return { action: 'redirect', to: `/entrar?next=${encodeURIComponent(pathname)}` }
  }
  if (isAuthenticated && GUEST_ONLY_PATHS.some((path) => matches(pathname, path))) {
    return { action: 'redirect', to: '/painel' }
  }
  return { action: 'continue' }
}
```

`src/lib/auth/auth-errors.ts`:

```ts
export const SESSION_REPLACED_MESSAGE = 'Sua conta foi acessada em outro aparelho.'

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'E-mail ou senha incorretos.',
  email_not_confirmed: 'Confirme seu e-mail antes de entrar.',
  user_already_exists: 'Já existe uma conta com este e-mail.',
  email_exists: 'Já existe uma conta com este e-mail.',
  weak_password: 'Escolha uma senha mais forte.',
  same_password: 'A nova senha deve ser diferente da atual.',
  captcha_failed: 'Não conseguimos verificar que você é humano. Recarregue a página e tente de novo.',
  over_email_send_rate_limit: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
  over_request_rate_limit: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
  otp_expired: 'Link inválido ou expirado. Solicite um novo.',
  session_not_found: 'Sua sessão expirou. Entre novamente.',
}

export function mapAuthError(code: string | undefined): string {
  return (code && AUTH_ERROR_MESSAGES[code]) || 'Algo deu errado. Tente novamente.'
}

export function loginNotice(params: {
  motivo?: string
  erro?: string
  aviso?: string
}): { kind: 'error' | 'success'; text: string } | null {
  if (params.motivo === 'outro-aparelho') return { kind: 'error', text: SESSION_REPLACED_MESSAGE }
  if (params.erro === 'link-invalido') return { kind: 'error', text: 'Link inválido ou expirado. Solicite um novo.' }
  if (params.erro === 'google') return { kind: 'error', text: 'Não foi possível entrar com o Google. Tente novamente.' }
  if (params.aviso === 'senha-alterada') return { kind: 'success', text: 'Senha alterada. Entre com a nova senha.' }
  return null
}
```

`src/lib/auth/schemas.ts`:

```ts
import { z } from 'zod'

const name = z.string().trim().min(2, 'Informe seu nome.').max(80, 'O nome pode ter no máximo 80 caracteres.')
const email = z.string().trim().toLowerCase().email('Informe um e-mail válido.')
const newPassword = z
  .string()
  .min(8, 'A senha precisa ter pelo menos 8 caracteres.')
  .max(72, 'A senha pode ter no máximo 72 caracteres.')

export const signUpSchema = z.object({ name, email, password: newPassword })

export const signInSchema = z.object({ email, password: z.string().min(1, 'Informe sua senha.') })

export const forgotPasswordSchema = z.object({ email })

export const resetPasswordSchema = z
  .object({ password: newPassword, confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não conferem.',
    path: ['confirmPassword'],
  })

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual.'),
    password: newPassword,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password !== data.currentPassword, {
    message: 'A nova senha deve ser diferente da atual.',
    path: ['password'],
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não conferem.',
    path: ['confirmPassword'],
  })

export const profileNameSchema = z.object({ name })
```

`src/lib/forms/form-state.ts`:

```ts
export type FormState = {
  error?: string
  success?: string
  fieldErrors?: Record<string, string>
  values?: Record<string, string>
}

export const initialFormState: FormState = {}

export function fieldErrorsFromZod(error: {
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>
}): Record<string, string> {
  const result: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path[0]
    if (key === undefined) continue
    const field = String(key)
    if (!result[field]) result[field] = issue.message
  }
  return result
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npx vitest run`
Expected: PASS em todos os arquivos.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth src/lib/forms
git commit -m "feat(auth): regras de rota, sessão única, mensagens e validações"
```

---

### Task 5: Clientes Supabase, proxy por host e páginas de destino

**Files:**
- Create: `src/lib/supabase/server.ts`, `src/lib/supabase/browser.ts`, `src/lib/supabase/verifier.ts`, `src/proxy.ts`, `src/app/site/page.tsx`, `src/app/v/[subdomain]/page.tsx`, `src/app/v/[subdomain]/not-found.tsx`, `src/app/host-invalido/page.tsx`, `playwright.config.ts`, `e2e/routing.spec.ts`
- Delete: `src/app/page.tsx` (página padrão do create-next-app)

**Interfaces:**
- Consumes: `env` (Task 1); `parseHost` e `internalPathFor` (Task 2); `decideAppRoute` e `isSessionCurrent` (Task 4); `Database` (Task 3)
- Produces:
  - `createSupabaseServerClient(): Promise<SupabaseClient<Database>>`
  - `createSupabaseBrowserClient(): SupabaseClient<Database>`
  - `createSupabaseVerifierClient(): SupabaseClient<Database>` (sem sessão persistida)
  - rotas internas `/site`, `/v/[subdomain]`, `/host-invalido` e o prefixo `/app/*`

- [ ] **Step 1: Escrever o teste e2e de roteamento (falhando)**

`playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

export const APP_URL = 'http://app.localhost:3000'

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: APP_URL, trace: 'retain-on-failure', locale: 'pt-BR' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
```

`e2e/routing.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

test('domínio raiz mostra a página inicial', async ({ page }) => {
  await page.goto('http://localhost:3000/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Agenn Vitrine')
})

test('subdomínio sem vitrine responde 404', async ({ page }) => {
  const response = await page.goto('http://nao-existe.localhost:3000/')
  expect(response?.status()).toBe(404)
  await expect(page.getByRole('heading', { name: 'Vitrine não encontrada' })).toBeVisible()
})

test('app sem login leva para entrar', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/entrar$/)
})

test('rota protegida guarda o destino', async ({ page }) => {
  await page.goto('/painel/conta')
  await expect(page).toHaveURL(/\/entrar\?next=%2Fpainel%2Fconta$/)
})
```

O teste de "app sem login" só confere a URL. A tela `/entrar` ainda não existe e fica para a Task 7.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx playwright test e2e/routing.spec.ts --project=desktop`
Expected: FAIL (a raiz mostra a página padrão do Next e os redirecionamentos não existem).

- [ ] **Step 3: Implementar os clientes Supabase**

`src/lib/supabase/server.ts`:

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { env } from '@/lib/env'
import type { Database } from './database.types'

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Chamado de um Server Component: o proxy renova os cookies.
        }
      },
    },
  })
}
```

`src/lib/supabase/browser.ts`:

```ts
import { createBrowserClient } from '@supabase/ssr'
import { env } from '@/lib/env'
import type { Database } from './database.types'

export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
}
```

`src/lib/supabase/verifier.ts`:

```ts
import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'
import type { Database } from './database.types'

// Confere a senha atual sem tocar nos cookies da sessão do usuário.
export function createSupabaseVerifierClient() {
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
```

- [ ] **Step 4: Implementar o proxy**

`src/proxy.ts`:

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { decideAppRoute } from '@/lib/auth/app-routes'
import { isSessionCurrent } from '@/lib/auth/session'
import { env } from '@/lib/env'
import { internalPathFor, parseHost, type HostResolution } from '@/lib/hosts/parse-host'
import type { Database } from '@/lib/supabase/database.types'

export async function proxy(request: NextRequest) {
  const resolution = parseHost(request.headers.get('host'), {
    rootDomain: env.NEXT_PUBLIC_ROOT_DOMAIN,
    legacyDomains: env.LEGACY_DOMAINS,
  })
  const { pathname, search } = request.nextUrl

  if (resolution.type === 'redirect') {
    return NextResponse.redirect(`${request.nextUrl.protocol}//${resolution.host}${pathname}${search}`, 301)
  }
  if (resolution.type === 'app') return handleApp(request, resolution)
  return rewriteTo(request, internalPathFor(resolution, pathname))
}

function rewriteTo(request: NextRequest, pathname: string, init?: Parameters<typeof NextResponse.rewrite>[1]) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  return NextResponse.rewrite(url, init)
}

function copyCookies(target: NextResponse, source: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie))
  return target
}

async function handleApp(request: NextRequest, resolution: HostResolution) {
  let sessionResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        sessionResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => sessionResponse.cookies.set(name, value, options))
      },
    },
  })

  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  const userId = typeof claims?.sub === 'string' ? claims.sub : null

  let sessionCurrent = true
  if (userId) {
    const { data: profile } = await supabase.from('profiles').select('active_session_id').eq('id', userId).maybeSingle()
    const claimSessionId = typeof claims?.session_id === 'string' ? claims.session_id : undefined
    sessionCurrent = isSessionCurrent(claimSessionId, profile?.active_session_id)
  }

  const decision = decideAppRoute({
    pathname: request.nextUrl.pathname,
    isAuthenticated: Boolean(userId),
    isSessionCurrent: sessionCurrent,
  })

  if (decision.action === 'end-session') {
    await supabase.auth.signOut({ scope: 'local' })
    return copyCookies(NextResponse.redirect(new URL(decision.to, request.url)), sessionResponse)
  }
  if (decision.action === 'redirect') {
    return copyCookies(NextResponse.redirect(new URL(decision.to, request.url)), sessionResponse)
  }
  return copyCookies(
    rewriteTo(request, internalPathFor(resolution, request.nextUrl.pathname), { request }),
    sessionResponse,
  )
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|api/|brand/|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|xml)$).*)'],
}
```

- [ ] **Step 5: Criar as páginas de destino**

Apague `src/app/page.tsx`.

`src/app/site/page.tsx`:

```tsx
import Link from 'next/link'
import { env } from '@/lib/env'
import { buildAppUrl } from '@/lib/hosts/urls'

export default function MarketingHome() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col items-start justify-center gap-6 px-4">
      <h1 className="text-4xl font-semibold tracking-tight">Agenn Vitrine</h1>
      <p className="text-lg text-ink-muted">Catálogos e cardápios com vídeo, prontos para o WhatsApp.</p>
      <Link href={buildAppUrl('/cadastro', env.NEXT_PUBLIC_ROOT_DOMAIN)} className="underline">
        Criar minha vitrine
      </Link>
    </main>
  )
}
```

`src/app/v/[subdomain]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'

// A vitrine pública é construída na Fase 2. Até lá, todo subdomínio responde 404.
export default function VitrinePage() {
  notFound()
}
```

`src/app/v/[subdomain]/not-found.tsx`:

```tsx
export default function VitrineNotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-2 px-4 text-center">
      <h1 className="text-2xl font-semibold">Vitrine não encontrada</h1>
      <p className="text-ink-muted">Confira o endereço digitado.</p>
    </main>
  )
}
```

`src/app/host-invalido/page.tsx`:

```tsx
import { notFound } from 'next/navigation'

export default function InvalidHostPage() {
  notFound()
}
```

- [ ] **Step 6: Rodar o e2e**

Run: `npx playwright test e2e/routing.spec.ts`
Expected: PASS nos dois projetos (desktop e mobile).

As classes `text-ink-muted` só ganham cor na Task 6. Isso não afeta os testes.

- [ ] **Step 7: Conferir tipos e testes**

Run: `npm run typecheck && npm test`
Expected: sem erros.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: proxy por host com sessão Supabase e páginas de destino"
```

---

### Task 6: Fundação visual (tokens e componentes base)

**Files:**
- Create: `public/brand/logo-icone.png`, `src/components/ui/button.tsx`, `src/components/ui/input.tsx`, `src/components/ui/field.tsx`, `src/components/ui/form-message.tsx`, `src/components/ui/card.tsx`, `src/components/ui/submit-button.tsx`, `src/components/auth/auth-shell.tsx`, `src/components/auth/turnstile.tsx`, `src/components/auth/google-button.tsx`
- Modify: `src/app/globals.css`, `src/app/layout.tsx`

**Interfaces:**
- Consumes: `env` (Task 1), `createSupabaseBrowserClient` (Task 5)
- Produces (nomes e props **fixos**, usados pelas próximas tasks):
  - `Button(props: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' })`
  - `Input(props: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean })`
  - `Field({ label, htmlFor, error, hint, children }: { label: string; htmlFor: string; error?: string; hint?: string; children: ReactNode })`
  - `FormMessage({ error, success }: { error?: string; success?: string })`
  - `Card({ className, children }: { className?: string; children: ReactNode })`
  - `SubmitButton({ children, variant }: { children: ReactNode; variant?: 'primary' | 'secondary' | 'danger' })`
  - `AuthShell({ title, description, children, footer }: { title: string; description?: string; children: ReactNode; footer?: ReactNode })`
  - `Turnstile({ resetSignal }: { resetSignal?: unknown })`: renderiza o widget com o campo `captchaToken`, ou nada se não houver site key
  - `GoogleButton({ next }: { next?: string })`: não renderiza nada se `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` for falso

- [ ] **Step 1: Copiar o logo**

```bash
mkdir -p public/brand && cp "banco de imagens/Logo icone.png" public/brand/logo-icone.png
```

- [ ] **Step 2: Escrever a base de tokens e layout**

`src/app/globals.css`:

```css
@import "tailwindcss";

@theme {
  --color-canvas: #f6f6f3;
  --color-surface: #ffffff;
  --color-ink: #141714;
  --color-ink-muted: #5c625d;
  --color-line: #e3e5e0;
  --color-brand: #0b2a1c;
  --color-brand-hover: #134230;
  --color-brand-ink: #ffffff;
  --color-danger: #b42318;
  --color-danger-soft: #fdecea;
  --color-success: #1a7f4b;
  --color-success-soft: #e7f6ee;
  --radius-control: 0.625rem;
  --radius-card: 1rem;
  --font-sans: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
}

html,
body {
  background: var(--color-canvas);
  color: var(--color-ink);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}
```

`src/app/layout.tsx`:

```tsx
import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'

const geist = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })

export const metadata: Metadata = {
  title: { default: 'Agenn Vitrine', template: '%s · Agenn Vitrine' },
  description: 'Catálogos e cardápios com vídeo, prontos para o WhatsApp.',
  icons: { icon: '/brand/logo-icone.png' },
}

export const viewport: Viewport = { themeColor: '#0b2a1c' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={geist.variable}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 3: Escrever os componentes base**

`src/components/ui/button.tsx`:

```tsx
import type { ButtonHTMLAttributes } from 'react'

const VARIANTS = {
  primary: 'bg-brand text-brand-ink hover:bg-brand-hover',
  secondary: 'border border-line bg-surface text-ink hover:bg-canvas',
  ghost: 'text-ink hover:bg-canvas',
  danger: 'bg-danger text-white hover:opacity-90',
} as const

export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof VARIANTS }) {
  return (
    <button
      type={type}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-control px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}
```

`src/components/ui/input.tsx`:

```tsx
import type { InputHTMLAttributes } from 'react'

export function Input({ invalid, className = '', ...props }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={`h-11 w-full rounded-control border bg-surface px-3 text-base text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand read-only:bg-canvas read-only:text-ink-muted ${invalid ? 'border-danger' : 'border-line'} ${className}`}
      {...props}
    />
  )
}
```

`src/components/ui/field.tsx`:

```tsx
import type { ReactNode } from 'react'

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  error?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-ink-muted">{hint}</p>
      ) : null}
    </div>
  )
}
```

`src/components/ui/form-message.tsx`:

```tsx
export function FormMessage({ error, success }: { error?: string; success?: string }) {
  if (error) {
    return (
      <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
        {error}
      </p>
    )
  }
  if (success) {
    return (
      <p role="status" className="rounded-control bg-success-soft px-3 py-2 text-sm text-success">
        {success}
      </p>
    )
  }
  return null
}
```

`src/components/ui/card.tsx`:

```tsx
import type { ReactNode } from 'react'

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <section className={`rounded-card border border-line bg-surface p-6 ${className}`}>{children}</section>
}
```

`src/components/ui/submit-button.tsx`:

```tsx
'use client'

import type { ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from './button'

export function SubmitButton({
  children,
  variant = 'primary',
}: {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'danger'
}) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant={variant} disabled={pending} aria-busy={pending} className="w-full">
      {children}
    </Button>
  )
}
```

`src/components/auth/auth-shell.tsx`:

```tsx
import Image from 'next/image'
import type { ReactNode } from 'react'

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Image src="/brand/logo-icone.png" alt="Agenn Vitrine" width={48} height={48} className="mb-8 rounded-xl" priority />
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-2 text-ink-muted">{description}</p> : null}
        <div className="mt-8">{children}</div>
        {footer ? <div className="mt-6 text-sm text-ink-muted">{footer}</div> : null}
      </div>
    </main>
  )
}
```

`src/components/auth/turnstile.tsx`:

```tsx
'use client'

import Script from 'next/script'
import { useCallback, useEffect, useRef } from 'react'
import { env } from '@/lib/env'

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string
  reset: (widgetId: string) => void
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

export function Turnstile({ resetSignal }: { resetSignal?: unknown }) {
  const siteKey = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)

  const renderWidget = useCallback(() => {
    if (!siteKey || !containerRef.current || !window.turnstile || widgetIdRef.current) return
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      'response-field-name': 'captchaToken',
      appearance: 'interaction-only',
      language: 'pt-br',
    })
  }, [siteKey])

  useEffect(() => {
    renderWidget()
    return () => {
      if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current)
      widgetIdRef.current = null
    }
  }, [renderWidget])

  // O token é de uso único: renova depois de cada envio do formulário.
  useEffect(() => {
    if (widgetIdRef.current && window.turnstile) window.turnstile.reset(widgetIdRef.current)
  }, [resetSignal])

  if (!siteKey) return null
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={renderWidget}
      />
      <div ref={containerRef} />
    </>
  )
}
```

`src/components/auth/google-button.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { env } from '@/lib/env'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'

export function GoogleButton({ next }: { next?: string }) {
  const [pending, setPending] = useState(false)
  if (!env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED) return null

  async function handleClick() {
    setPending(true)
    const supabase = createSupabaseBrowserClient()
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next ?? '/painel')}`
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
    if (error) setPending(false)
  }

  return (
    <Button variant="secondary" className="w-full" onClick={handleClick} disabled={pending}>
      Continuar com Google
    </Button>
  )
}
```

- [ ] **Step 4: Refinar com a skill impeccable**

Invoque a skill `impeccable` com este pedido:

> "Defina a direção visual do painel SaaS 'Agenn Vitrine' (pt-BR, público de pequenos comerciantes, visual premium de sistema, sóbrio e confiável). A marca é verde profundo `#0B2A1C` com branco (logo em `public/brand/logo-icone.png`). Refine `src/app/globals.css` (tokens `@theme`), `src/app/layout.tsx` (fonte) e os componentes em `src/components/ui/*` e `src/components/auth/*`. **Restrições:** não renomeie componentes, props nem variantes; mantenha `h-11` (44 px) como altura mínima de controles; mantenha foco visível, contraste AA e layout sem rolagem horizontal a 360 px; não adicione dependências de UI."

Aplique as mudanças propostas respeitando as restrições.

- [ ] **Step 5: Conferir**

Run: `npm run typecheck && npm run lint && npm test && npx playwright test e2e/routing.spec.ts`
Expected: tudo passa.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(ui): tokens da marca e componentes base do painel"
```

---

### Task 7: Cadastro, confirmação de e-mail e login

**Files:**
- Modify: `supabase/config.toml`
- Create: `supabase/templates/confirmacao.html`, `supabase/templates/recuperacao.html`, `src/features/auth/actions.ts`, `src/app/app/auth/callback/route.ts`, `src/app/app/auth/confirm/route.ts`, `src/app/app/(auth)/cadastro/page.tsx`, `src/app/app/(auth)/cadastro/sign-up-form.tsx`, `src/app/app/(auth)/confirmar-email/page.tsx`, `src/app/app/(auth)/confirmar-email/resend-form.tsx`, `src/app/app/(auth)/entrar/page.tsx`, `src/app/app/(auth)/entrar/sign-in-form.tsx`, `src/app/app/(painel)/layout.tsx`, `src/app/app/(painel)/painel/page.tsx`, `e2e/helpers.ts`, `e2e/auth.spec.ts`

**Interfaces:**
- Consumes: Tasks 1 a 6
- Produces:
  - server actions `signUpAction(prev: FormState, formData: FormData): Promise<FormState>`, `signInAction(...)`, `resendConfirmationAction(...)`, `signOutAction(): Promise<void>`, com a mesma assinatura `(prev: FormState, formData: FormData) => Promise<FormState>` nas três primeiras
  - e2e helpers `uniqueEmail(prefix: string): string`, `waitForAuthLink(email: string, type: 'email' | 'recovery'): Promise<string>`, `createConfirmedUser(prefix: string): Promise<{ email: string; password: string; name: string }>` e `signIn(page: Page, email: string, password: string): Promise<void>`
  - painel com o nome do usuário visível e botão **Sair**

- [ ] **Step 1: Configurar o Auth local**

Em `supabase/config.toml`, ajuste as chaves existentes nas seções abaixo (crie as que não existirem):

```toml
[auth]
site_url = "http://app.localhost:3000"
additional_redirect_urls = ["http://app.localhost:3000/auth/callback"]
minimum_password_length = 8

[auth.rate_limit]
email_sent = 100

[auth.email]
enable_signup = true
enable_confirmations = true

[auth.email.template.confirmation]
subject = "Confirme seu e-mail na Agenn Vitrine"
content_path = "./supabase/templates/confirmacao.html"

[auth.email.template.recovery]
subject = "Redefina sua senha da Agenn Vitrine"
content_path = "./supabase/templates/recuperacao.html"
```

Neste arquivo, `[auth.captcha]` fica desligado e `[auth.external.google]` fica `enabled = false`. Os dois são ligados em produção (Task 11).

`supabase/templates/confirmacao.html`:

```html
<h2>Confirme seu e-mail</h2>
<p>Olá! Para começar a criar suas vitrines na Agenn Vitrine, confirme seu e-mail:</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirmar meu e-mail</a></p>
<p>Se você não criou uma conta, ignore esta mensagem.</p>
```

`supabase/templates/recuperacao.html`:

```html
<h2>Redefinir senha</h2>
<p>Recebemos um pedido para redefinir a senha da sua conta na Agenn Vitrine.</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Criar nova senha</a></p>
<p>Se você não pediu, ignore esta mensagem. Sua senha continua a mesma.</p>
```

Run: `npx supabase stop && npx supabase start`
Expected: o Supabase sobe sem erro de configuração.

- [ ] **Step 2: Escrever os helpers e o teste e2e (falhando)**

`e2e/helpers.ts`:

```ts
import { expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324'

export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.com`
}

export async function waitForAuthLink(email: string, type: 'email' | 'recovery', timeoutMs = 20_000): Promise<string> {
  const deadline = Date.now() + timeoutMs
  const pattern = new RegExp(`href="([^"]*/auth/confirm\\?[^"]*type=${type}[^"]*)"`)
  while (Date.now() < deadline) {
    const search = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`)
    const { messages = [] } = (await search.json()) as { messages?: { ID: string }[] }
    for (const { ID } of messages) {
      const message = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${ID}`)).json()) as { HTML: string }
      const match = message.HTML.match(pattern)
      if (match) return match[1].replaceAll('&amp;', '&')
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`Nenhum e-mail "${type}" chegou para ${email}`)
}

export async function createConfirmedUser(prefix: string) {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  })
  const user = { email: uniqueEmail(prefix), password: 'senhaForte123', name: 'Pessoa Teste' }
  const { error } = await admin.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: { name: user.name },
  })
  if (error) throw error
  return user
}

export async function signIn(page: Page, email: string, password: string) {
  await page.goto('/entrar')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/painel$/)
}
```

`e2e/auth.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { createConfirmedUser, signIn, uniqueEmail, waitForAuthLink } from './helpers'

test('cadastro com confirmação de e-mail leva ao painel', async ({ page }) => {
  const email = uniqueEmail('cadastro')
  await page.goto('/cadastro')
  await page.getByLabel('Nome').fill('Maria Teste')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha', { exact: true }).fill('senhaForte123')
  await page.getByRole('button', { name: 'Criar conta' }).click()

  await expect(page).toHaveURL(/\/confirmar-email\?email=/)
  await expect(page.getByRole('heading', { name: 'Confirme seu e-mail' })).toBeVisible()

  await page.goto(await waitForAuthLink(email, 'email'))
  await expect(page).toHaveURL(/\/painel$/)
  await expect(page.getByText('Maria Teste')).toBeVisible()
})

test('cadastro mostra erros de validação', async ({ page }) => {
  await page.goto('/cadastro')
  await page.getByLabel('Nome').fill('A')
  await page.getByLabel('E-mail').fill('invalido')
  await page.getByLabel('Senha', { exact: true }).fill('123')
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page.getByText('Informe seu nome.')).toBeVisible()
  await expect(page.getByText('Informe um e-mail válido.')).toBeVisible()
  await expect(page.getByText('A senha precisa ter pelo menos 8 caracteres.')).toBeVisible()
})

test('login, sair e senha errada', async ({ page }) => {
  const user = await createConfirmedUser('login')
  await signIn(page, user.email, user.password)
  await expect(page.getByText(user.name)).toBeVisible()

  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page).toHaveURL(/\/entrar$/)

  await page.getByLabel('E-mail').fill(user.email)
  await page.getByLabel('Senha', { exact: true }).fill('senhaErrada1')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible()
})

test('login volta para o destino pedido', async ({ page }) => {
  const user = await createConfirmedUser('destino')
  await page.goto('/painel')
  await expect(page).toHaveURL(/\/entrar\?next=%2Fpainel$/)
  await page.getByLabel('E-mail').fill(user.email)
  await page.getByLabel('Senha', { exact: true }).fill(user.password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/painel$/)
})
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx playwright test e2e/auth.spec.ts --project=desktop`
Expected: FAIL (a rota `/app/cadastro` não existe e responde 404).

- [ ] **Step 4: Implementar as server actions**

`src/features/auth/actions.ts`:

```ts
'use server'

import { redirect } from 'next/navigation'
import { mapAuthError } from '@/lib/auth/auth-errors'
import { forgotPasswordSchema, signInSchema, signUpSchema } from '@/lib/auth/schemas'
import { fieldErrorsFromZod, type FormState } from '@/lib/forms/form-state'
import { safeNextPath } from '@/lib/hosts/urls'
import { createSupabaseServerClient } from '@/lib/supabase/server'

function readFields<const K extends string>(formData: FormData, keys: readonly K[]): Record<K, string> {
  return Object.fromEntries(keys.map((key) => [key, String(formData.get(key) ?? '')])) as Record<K, string>
}

function readCaptcha(formData: FormData): string | undefined {
  const token = formData.get('captchaToken')
  return typeof token === 'string' && token ? token : undefined
}

export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const fields = readFields(formData, ['name', 'email', 'password'])
  const keep = { name: fields.name, email: fields.email }
  const parsed = signUpSchema.safeParse(fields)
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error), values: keep }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { name: parsed.data.name }, captchaToken: readCaptcha(formData) },
  })
  if (error) return { error: mapAuthError(error.code), values: keep }

  redirect(`/confirmar-email?email=${encodeURIComponent(parsed.data.email)}`)
}

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const fields = readFields(formData, ['email', 'password'])
  const keep = { email: fields.email }
  const parsed = signInSchema.safeParse(fields)
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error), values: keep }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { captchaToken: readCaptcha(formData) },
  })
  if (error) return { error: mapAuthError(error.code), values: keep }

  await supabase.rpc('claim_session')
  redirect(safeNextPath(String(formData.get('next') ?? '')))
}

export async function resendConfirmationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse({ email: String(formData.get('email') ?? '') })
  if (!parsed.success) return { error: 'Informe um e-mail válido.' }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: parsed.data.email,
    options: { captchaToken: readCaptcha(formData) },
  })
  if (error) return { error: mapAuthError(error.code) }
  return { success: 'Enviamos um novo link. Confira sua caixa de entrada e o spam.' }
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut({ scope: 'local' })
  redirect('/entrar')
}
```

- [ ] **Step 5: Implementar as rotas de callback e confirmação**

`src/app/app/auth/callback/route.ts`:

```ts
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { originFor, safeNextPath } from '@/lib/hosts/urls'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const origin = originFor(request.headers.get('host') ?? '')
  const code = request.nextUrl.searchParams.get('code')
  const next = safeNextPath(request.nextUrl.searchParams.get('next'))
  if (!code) return NextResponse.redirect(`${origin}/entrar?erro=google`)

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return NextResponse.redirect(`${origin}/entrar?erro=google`)

  await supabase.rpc('claim_session')
  return NextResponse.redirect(`${origin}${next}`)
}
```

`src/app/app/auth/confirm/route.ts`:

```ts
import type { EmailOtpType } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { originFor } from '@/lib/hosts/urls'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const ALLOWED_TYPES: readonly EmailOtpType[] = ['email', 'signup', 'recovery']

export async function GET(request: NextRequest) {
  const origin = originFor(request.headers.get('host') ?? '')
  const tokenHash = request.nextUrl.searchParams.get('token_hash')
  const type = request.nextUrl.searchParams.get('type') as EmailOtpType | null
  if (!tokenHash || !type || !ALLOWED_TYPES.includes(type)) {
    return NextResponse.redirect(`${origin}/entrar?erro=link-invalido`)
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
  if (error) return NextResponse.redirect(`${origin}/entrar?erro=link-invalido`)

  await supabase.rpc('claim_session')
  return NextResponse.redirect(`${origin}${type === 'recovery' ? '/redefinir-senha' : '/painel'}`)
}
```

- [ ] **Step 6: Implementar as telas de cadastro, confirmação e login**

`src/app/app/(auth)/cadastro/page.tsx`:

```tsx
import Link from 'next/link'
import { AuthShell } from '@/components/auth/auth-shell'
import { SignUpForm } from './sign-up-form'

export const metadata = { title: 'Criar conta' }

export default function SignUpPage() {
  return (
    <AuthShell
      title="Criar conta"
      description="Monte sua vitrine em poucos minutos."
      footer={
        <>
          Já tem conta?{' '}
          <Link href="/entrar" className="font-medium text-ink underline">
            Entrar
          </Link>
        </>
      }
    >
      <SignUpForm />
    </AuthShell>
  )
}
```

`src/app/app/(auth)/cadastro/sign-up-form.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { GoogleButton } from '@/components/auth/google-button'
import { Turnstile } from '@/components/auth/turnstile'
import { Field } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { SubmitButton } from '@/components/ui/submit-button'
import { signUpAction } from '@/features/auth/actions'
import { initialFormState } from '@/lib/forms/form-state'

export function SignUpForm() {
  const [state, formAction] = useActionState(signUpAction, initialFormState)
  const errors = state.fieldErrors ?? {}

  return (
    <div className="flex flex-col gap-6">
      <GoogleButton />
      <form action={formAction} noValidate className="flex flex-col gap-4">
        <Field label="Nome" htmlFor="name" error={errors.name}>
          <Input id="name" name="name" autoComplete="name" defaultValue={state.values?.name} invalid={!!errors.name} />
        </Field>
        <Field label="E-mail" htmlFor="email" error={errors.email}>
          <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" defaultValue={state.values?.email} invalid={!!errors.email} />
        </Field>
        <Field label="Senha" htmlFor="password" error={errors.password} hint="Mínimo de 8 caracteres.">
          <Input id="password" name="password" type="password" autoComplete="new-password" invalid={!!errors.password} />
        </Field>
        <Turnstile resetSignal={state} />
        <FormMessage error={state.error} />
        <SubmitButton>Criar conta</SubmitButton>
      </form>
    </div>
  )
}
```

`src/app/app/(auth)/confirmar-email/page.tsx`:

```tsx
import Link from 'next/link'
import { AuthShell } from '@/components/auth/auth-shell'
import { ResendForm } from './resend-form'

export const metadata = { title: 'Confirme seu e-mail' }

export default async function ConfirmEmailPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email = '' } = await searchParams
  return (
    <AuthShell
      title="Confirme seu e-mail"
      description={
        email
          ? `Enviamos um link de confirmação para ${email}. Abra o e-mail para ativar sua conta.`
          : 'Enviamos um link de confirmação para o seu e-mail. Abra o e-mail para ativar sua conta.'
      }
      footer={
        <Link href="/entrar" className="font-medium text-ink underline">
          Voltar para entrar
        </Link>
      }
    >
      {email ? <ResendForm email={email} /> : null}
    </AuthShell>
  )
}
```

`src/app/app/(auth)/confirmar-email/resend-form.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { Turnstile } from '@/components/auth/turnstile'
import { FormMessage } from '@/components/ui/form-message'
import { SubmitButton } from '@/components/ui/submit-button'
import { resendConfirmationAction } from '@/features/auth/actions'
import { initialFormState } from '@/lib/forms/form-state'

export function ResendForm({ email }: { email: string }) {
  const [state, formAction] = useActionState(resendConfirmationAction, initialFormState)
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="email" value={email} />
      <Turnstile resetSignal={state} />
      <FormMessage error={state.error} success={state.success} />
      <SubmitButton variant="secondary">Reenviar link</SubmitButton>
    </form>
  )
}
```

`src/app/app/(auth)/entrar/page.tsx`:

```tsx
import Link from 'next/link'
import { AuthShell } from '@/components/auth/auth-shell'
import { loginNotice } from '@/lib/auth/auth-errors'
import { safeNextPath } from '@/lib/hosts/urls'
import { SignInForm } from './sign-in-form'

export const metadata = { title: 'Entrar' }

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; motivo?: string; erro?: string; aviso?: string }>
}) {
  const params = await searchParams
  return (
    <AuthShell
      title="Entrar"
      description="Acesse o painel das suas vitrines."
      footer={
        <>
          Ainda não tem conta?{' '}
          <Link href="/cadastro" className="font-medium text-ink underline">
            Criar conta
          </Link>
        </>
      }
    >
      <SignInForm next={safeNextPath(params.next)} notice={loginNotice(params)} />
    </AuthShell>
  )
}
```

`src/app/app/(auth)/entrar/sign-in-form.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { GoogleButton } from '@/components/auth/google-button'
import { Turnstile } from '@/components/auth/turnstile'
import { Field } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { SubmitButton } from '@/components/ui/submit-button'
import { signInAction } from '@/features/auth/actions'
import { initialFormState } from '@/lib/forms/form-state'

export function SignInForm({
  next,
  notice,
}: {
  next: string
  notice: { kind: 'error' | 'success'; text: string } | null
}) {
  const [state, formAction] = useActionState(signInAction, initialFormState)
  const errors = state.fieldErrors ?? {}
  const submitted = state !== initialFormState

  return (
    <div className="flex flex-col gap-6">
      {!submitted && notice ? (
        <FormMessage error={notice.kind === 'error' ? notice.text : undefined} success={notice.kind === 'success' ? notice.text : undefined} />
      ) : null}
      <GoogleButton next={next} />
      <form action={formAction} noValidate className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <Field label="E-mail" htmlFor="email" error={errors.email}>
          <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" defaultValue={state.values?.email} invalid={!!errors.email} />
        </Field>
        <Field label="Senha" htmlFor="password" error={errors.password}>
          <Input id="password" name="password" type="password" autoComplete="current-password" invalid={!!errors.password} />
        </Field>
        <Link href="/esqueci-senha" className="self-end text-sm font-medium text-ink underline">
          Esqueci minha senha
        </Link>
        <Turnstile resetSignal={state} />
        <FormMessage error={state.error} />
        <SubmitButton>Entrar</SubmitButton>
      </form>
    </div>
  )
}
```

- [ ] **Step 7: Implementar o layout do painel e a tela inicial**

`src/app/app/(painel)/layout.tsx`:

```tsx
import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { signOutAction } from '@/features/auth/actions'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function PainelLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/entrar')

  const [{ data: profile }, { data: plan }] = await Promise.all([
    supabase.from('profiles').select('name').eq('id', user.id).single(),
    supabase.rpc('my_entitlements'),
  ])

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Link href="/painel" className="flex items-center gap-2 font-semibold">
            <Image src="/brand/logo-icone.png" alt="" width={32} height={32} className="rounded-lg" />
            <span className="hidden sm:inline">Agenn Vitrine</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link href="/painel" className="rounded-control px-3 py-2 hover:bg-canvas">
              Vitrines
            </Link>
            <Link href="/painel/conta" className="rounded-control px-3 py-2 hover:bg-canvas">
              Conta
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex flex-col items-end leading-tight">
              <span className="max-w-[10rem] truncate text-sm font-medium">{profile?.name || user.email}</span>
              <span className="text-xs text-ink-muted">Plano {plan?.name ?? 'Gratuito'}</span>
            </div>
            <form action={signOutAction}>
              <Button type="submit" variant="ghost">
                Sair
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  )
}
```

`src/app/app/(painel)/painel/page.tsx`:

```tsx
import { Card } from '@/components/ui/card'

export const metadata = { title: 'Minhas vitrines' }

export default function PainelHome() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Minhas vitrines</h1>
      <Card className="text-center">
        <h2 className="text-lg font-medium">Você ainda não tem vitrines</h2>
        <p className="mt-2 text-ink-muted">Em breve você poderá criar sua primeira vitrine por aqui.</p>
      </Card>
    </div>
  )
}
```

- [ ] **Step 8: Rodar o e2e**

Run: `npx playwright test e2e/auth.spec.ts e2e/routing.spec.ts`
Expected: PASS em desktop e mobile.

- [ ] **Step 9: Refinar as telas com impeccable**

Invoque a skill `impeccable` para as telas **Entrar**, **Criar conta** e **Confirme seu e-mail**, e para o **cabeçalho do painel**. Use as mesmas restrições da Task 6 e mais estas: manter os rótulos `Nome`, `E-mail`, `Senha`, os botões `Criar conta`, `Entrar`, `Sair`, `Reenviar link`, o link `Esqueci minha senha` e os títulos das páginas; e manter o nome do usuário e o botão `Sair` visíveis em 360 px. Depois rode de novo `npx playwright test`.
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(auth): cadastro com confirmação por e-mail, login, Google e painel inicial"
```

---

### Task 8: Recuperação de senha

**Files:**
- Modify: `src/features/auth/actions.ts`
- Create: `src/app/app/(auth)/esqueci-senha/page.tsx`, `src/app/app/(auth)/esqueci-senha/forgot-password-form.tsx`, `src/app/app/(auth)/redefinir-senha/page.tsx`, `src/app/app/(auth)/redefinir-senha/reset-password-form.tsx`
- Test: `e2e/auth.spec.ts` (novo teste)

**Interfaces:**
- Consumes: `waitForAuthLink`, `createConfirmedUser` e `signIn` (Task 7); `forgotPasswordSchema` e `resetPasswordSchema` (Task 4)
- Produces: `forgotPasswordAction(prev: FormState, formData: FormData): Promise<FormState>` e `resetPasswordAction(prev: FormState, formData: FormData): Promise<FormState>`

- [ ] **Step 1: Escrever o teste e2e (falhando)**

Acrescente ao final de `e2e/auth.spec.ts`:

```ts
test('recuperação de senha por e-mail', async ({ page }) => {
  const user = await createConfirmedUser('recuperar')
  await page.goto('/entrar')
  await page.getByRole('link', { name: 'Esqueci minha senha' }).click()
  await expect(page.getByRole('heading', { name: 'Esqueci minha senha' })).toBeVisible()
  await page.getByLabel('E-mail').fill(user.email)
  await page.getByRole('button', { name: 'Enviar link' }).click()
  await expect(page.getByText('Se existir uma conta com este e-mail, enviamos um link para redefinir a senha.')).toBeVisible()

  await page.goto(await waitForAuthLink(user.email, 'recovery'))
  await expect(page).toHaveURL(/\/redefinir-senha$/)
  await page.getByLabel('Nova senha', { exact: true }).fill('novaSenha456')
  await page.getByLabel('Confirmar nova senha').fill('novaSenha456')
  await page.getByRole('button', { name: 'Salvar nova senha' }).click()
  await expect(page).toHaveURL(/\/painel$/)

  await page.getByRole('button', { name: 'Sair' }).click()
  await signIn(page, user.email, 'novaSenha456')
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx playwright test e2e/auth.spec.ts -g "recuperação" --project=desktop`
Expected: FAIL (o link "Esqueci minha senha" leva a uma página 404).

- [ ] **Step 3: Implementar as actions**

Acrescente a `src/features/auth/actions.ts`. Troque o import de schemas para `import { forgotPasswordSchema, resetPasswordSchema, signInSchema, signUpSchema } from '@/lib/auth/schemas'` e adicione:

```ts
export async function forgotPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const fields = readFields(formData, ['email'])
  const parsed = forgotPasswordSchema.safeParse(fields)
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error), values: fields }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    captchaToken: readCaptcha(formData),
  })
  // Não revela se o e-mail existe. Só limite de envio e captcha viram erro.
  if (error && ['over_email_send_rate_limit', 'over_request_rate_limit', 'captcha_failed'].includes(error.code ?? '')) {
    return { error: mapAuthError(error.code), values: fields }
  }
  return { success: 'Se existir uma conta com este e-mail, enviamos um link para redefinir a senha.' }
}

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse(readFields(formData, ['password', 'confirmPassword']))
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error) }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) return { error: mapAuthError(error.code) }

  redirect('/painel')
}
```

- [ ] **Step 4: Implementar as telas**

`src/app/app/(auth)/esqueci-senha/page.tsx`:

```tsx
import Link from 'next/link'
import { AuthShell } from '@/components/auth/auth-shell'
import { ForgotPasswordForm } from './forgot-password-form'

export const metadata = { title: 'Esqueci minha senha' }

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Esqueci minha senha"
      description="Informe seu e-mail e enviaremos um link para criar uma nova senha."
      footer={
        <Link href="/entrar" className="font-medium text-ink underline">
          Voltar para entrar
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  )
}
```

`src/app/app/(auth)/esqueci-senha/forgot-password-form.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { Turnstile } from '@/components/auth/turnstile'
import { Field } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { SubmitButton } from '@/components/ui/submit-button'
import { forgotPasswordAction } from '@/features/auth/actions'
import { initialFormState } from '@/lib/forms/form-state'

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(forgotPasswordAction, initialFormState)
  const errors = state.fieldErrors ?? {}
  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <Field label="E-mail" htmlFor="email" error={errors.email}>
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" defaultValue={state.values?.email} invalid={!!errors.email} />
      </Field>
      <Turnstile resetSignal={state} />
      <FormMessage error={state.error} success={state.success} />
      <SubmitButton>Enviar link</SubmitButton>
    </form>
  )
}
```

`src/app/app/(auth)/redefinir-senha/page.tsx`:

```tsx
import { AuthShell } from '@/components/auth/auth-shell'
import { ResetPasswordForm } from './reset-password-form'

export const metadata = { title: 'Criar nova senha' }

// Protegida pelo proxy: só chega aqui quem abriu o link de recuperação (sessão ativa).
export default function ResetPasswordPage() {
  return (
    <AuthShell title="Criar nova senha" description="Escolha uma nova senha para sua conta.">
      <ResetPasswordForm />
    </AuthShell>
  )
}
```

`src/app/app/(auth)/redefinir-senha/reset-password-form.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { Field } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { SubmitButton } from '@/components/ui/submit-button'
import { resetPasswordAction } from '@/features/auth/actions'
import { initialFormState } from '@/lib/forms/form-state'

export function ResetPasswordForm() {
  const [state, formAction] = useActionState(resetPasswordAction, initialFormState)
  const errors = state.fieldErrors ?? {}
  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <Field label="Nova senha" htmlFor="password" error={errors.password} hint="Mínimo de 8 caracteres.">
        <Input id="password" name="password" type="password" autoComplete="new-password" invalid={!!errors.password} />
      </Field>
      <Field label="Confirmar nova senha" htmlFor="confirmPassword" error={errors.confirmPassword}>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" invalid={!!errors.confirmPassword} />
      </Field>
      <FormMessage error={state.error} />
      <SubmitButton>Salvar nova senha</SubmitButton>
    </form>
  )
}
```

- [ ] **Step 5: Rodar o e2e**

Run: `npx playwright test e2e/auth.spec.ts`
Expected: PASS em desktop e mobile.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(auth): recuperação de senha por e-mail"
```

---

### Task 9: Página de conta e sessão única de ponta a ponta

**Files:**
- Create: `src/features/account/actions.ts`, `src/app/app/(painel)/painel/conta/page.tsx`, `src/app/app/(painel)/painel/conta/name-form.tsx`, `src/app/app/(painel)/painel/conta/change-password-form.tsx`, `e2e/account.spec.ts`

**Interfaces:**
- Consumes: `hasPasswordLogin` (Task 4), `createSupabaseVerifierClient` (Task 5), `signIn` e `createConfirmedUser` (Task 7), `profileNameSchema` e `changePasswordSchema` (Task 4)
- Produces: `updateNameAction(prev: FormState, formData: FormData): Promise<FormState>`, `changePasswordAction(prev: FormState, formData: FormData): Promise<FormState>` e `signOutEverywhereAction(): Promise<void>`

- [ ] **Step 1: Escrever o teste e2e (falhando)**

`e2e/account.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { APP_URL } from '../playwright.config'
import { createConfirmedUser, signIn } from './helpers'

test('login em outro aparelho encerra a sessão anterior', async ({ browser }) => {
  const user = await createConfirmedUser('sessao')
  const deviceA = await browser.newContext({ baseURL: APP_URL })
  const deviceB = await browser.newContext({ baseURL: APP_URL })
  const pageA = await deviceA.newPage()
  const pageB = await deviceB.newPage()

  await signIn(pageA, user.email, user.password)
  await signIn(pageB, user.email, user.password)

  await pageA.goto('/painel/conta')
  await expect(pageA).toHaveURL(/\/entrar\?motivo=outro-aparelho$/)
  await expect(pageA.getByText('Sua conta foi acessada em outro aparelho.')).toBeVisible()

  await pageB.goto('/painel/conta')
  await expect(pageB).toHaveURL(/\/painel\/conta$/)

  await deviceA.close()
  await deviceB.close()
})

test('conta: e-mail só leitura, alterar nome e trocar senha', async ({ page }) => {
  const user = await createConfirmedUser('conta')
  await signIn(page, user.email, user.password)
  await page.goto('/painel/conta')

  const emailInput = page.getByLabel('E-mail')
  await expect(emailInput).toHaveValue(user.email)
  await expect(emailInput).toHaveAttribute('readonly', '')

  await page.getByLabel('Nome').fill('Nome Novo')
  await page.getByRole('button', { name: 'Salvar nome' }).click()
  await expect(page.getByText('Nome atualizado.')).toBeVisible()

  await page.getByLabel('Senha atual').fill('senhaErrada1')
  await page.getByLabel('Nova senha', { exact: true }).fill('outraSenha789')
  await page.getByLabel('Confirmar nova senha').fill('outraSenha789')
  await page.getByRole('button', { name: 'Trocar senha' }).click()
  await expect(page.getByText('Senha atual incorreta.')).toBeVisible()

  await page.getByLabel('Senha atual').fill(user.password)
  await page.getByLabel('Nova senha', { exact: true }).fill('outraSenha789')
  await page.getByLabel('Confirmar nova senha').fill('outraSenha789')
  await page.getByRole('button', { name: 'Trocar senha' }).click()
  await expect(page.getByText('Senha alterada com sucesso.')).toBeVisible()

  await page.getByRole('button', { name: 'Sair' }).click()
  await signIn(page, user.email, 'outraSenha789')
})

test('sair de todos os aparelhos', async ({ page }) => {
  const user = await createConfirmedUser('todos')
  await signIn(page, user.email, user.password)
  await page.goto('/painel/conta')
  await page.getByRole('button', { name: 'Sair de todos os aparelhos' }).click()
  await expect(page).toHaveURL(/\/entrar$/)
  await page.goto('/painel')
  await expect(page).toHaveURL(/\/entrar\?next=%2Fpainel$/)
})
```

A regra "contas do Google não veem a troca de senha" está coberta pelo teste unitário de `hasPasswordLogin` (Task 4), já que o login do Google não roda no ambiente local.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx playwright test e2e/account.spec.ts --project=desktop`
Expected: o teste de sessão **passa** (o proxy já aplica a regra desde a Task 5); os outros dois **falham** (`/painel/conta` responde 404).

- [ ] **Step 3: Implementar as actions**

`src/features/account/actions.ts`:

```ts
'use server'

import { redirect } from 'next/navigation'
import { mapAuthError } from '@/lib/auth/auth-errors'
import { changePasswordSchema, profileNameSchema } from '@/lib/auth/schemas'
import { hasPasswordLogin } from '@/lib/auth/session'
import { fieldErrorsFromZod, type FormState } from '@/lib/forms/form-state'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseVerifierClient } from '@/lib/supabase/verifier'

export async function updateNameAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const fields = { name: String(formData.get('name') ?? '') }
  const parsed = profileNameSchema.safeParse(fields)
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error), values: fields }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/entrar')

  const { error } = await supabase.from('profiles').update({ name: parsed.data.name }).eq('id', user.id)
  if (error) return { error: 'Não foi possível salvar. Tente novamente.', values: fields }
  return { success: 'Nome atualizado.', values: { name: parsed.data.name } }
}

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = changePasswordSchema.safeParse({
    currentPassword: String(formData.get('currentPassword') ?? ''),
    password: String(formData.get('password') ?? ''),
    confirmPassword: String(formData.get('confirmPassword') ?? ''),
  })
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error) }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) redirect('/entrar')
  if (!hasPasswordLogin(user.identities)) return { error: 'Esta conta entra pelo Google e não usa senha.' }

  const captchaToken = formData.get('captchaToken')
  const verifier = createSupabaseVerifierClient()
  const { error: verifyError } = await verifier.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
    options: { captchaToken: typeof captchaToken === 'string' && captchaToken ? captchaToken : undefined },
  })
  if (verifyError) {
    if (verifyError.code === 'invalid_credentials') return { fieldErrors: { currentPassword: 'Senha atual incorreta.' } }
    return { error: mapAuthError(verifyError.code) }
  }
  await verifier.auth.signOut({ scope: 'local' })

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) return { error: mapAuthError(error.code) }
  return { success: 'Senha alterada com sucesso.' }
}

export async function signOutEverywhereAction(): Promise<void> {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut({ scope: 'global' })
  redirect('/entrar')
}
```

- [ ] **Step 4: Implementar a tela**

`src/app/app/(painel)/painel/conta/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { signOutEverywhereAction } from '@/features/account/actions'
import { hasPasswordLogin } from '@/lib/auth/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { ChangePasswordForm } from './change-password-form'
import { NameForm } from './name-form'

export const metadata = { title: 'Conta' }

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/entrar')
  const { data: profile } = await supabase.from('profiles').select('name').eq('id', user.id).single()

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Conta</h1>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Dados pessoais</h2>
        <NameForm name={profile?.name ?? ''} />
        <Field label="E-mail" htmlFor="account-email" hint="O e-mail da conta não pode ser alterado.">
          <Input id="account-email" type="email" value={user.email ?? ''} readOnly />
        </Field>
      </Card>

      {hasPasswordLogin(user.identities) ? (
        <Card className="flex flex-col gap-4">
          <h2 className="text-lg font-medium">Senha</h2>
          <ChangePasswordForm />
        </Card>
      ) : null}

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Sessões</h2>
        <p className="text-ink-muted">Encerra o acesso em todos os aparelhos, inclusive neste.</p>
        <form action={signOutEverywhereAction}>
          <Button type="submit" variant="secondary">
            Sair de todos os aparelhos
          </Button>
        </form>
      </Card>
    </div>
  )
}
```

`src/app/app/(painel)/painel/conta/name-form.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { updateNameAction } from '@/features/account/actions'

export function NameForm({ name }: { name: string }) {
  const [state, formAction, pending] = useActionState(updateNameAction, { values: { name } })
  const error = state.fieldErrors?.name
  return (
    <form action={formAction} noValidate className="flex flex-col gap-3">
      <Field label="Nome" htmlFor="name" error={error}>
        <Input id="name" name="name" autoComplete="name" defaultValue={state.values?.name ?? name} invalid={!!error} />
      </Field>
      <FormMessage error={state.error} success={state.success} />
      <Button type="submit" variant="secondary" disabled={pending} className="self-start">
        Salvar nome
      </Button>
    </form>
  )
}
```

`src/app/app/(painel)/painel/conta/change-password-form.tsx`:

```tsx
'use client'

import { useActionState, useEffect, useRef } from 'react'
import { Turnstile } from '@/components/auth/turnstile'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { changePasswordAction } from '@/features/account/actions'
import { initialFormState } from '@/lib/forms/form-state'

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, initialFormState)
  const formRef = useRef<HTMLFormElement>(null)
  const errors = state.fieldErrors ?? {}

  useEffect(() => {
    if (state.success) formRef.current?.reset()
  }, [state])

  return (
    <form ref={formRef} action={formAction} noValidate className="flex flex-col gap-3">
      <Field label="Senha atual" htmlFor="currentPassword" error={errors.currentPassword}>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" invalid={!!errors.currentPassword} />
      </Field>
      <Field label="Nova senha" htmlFor="password" error={errors.password} hint="Mínimo de 8 caracteres.">
        <Input id="password" name="password" type="password" autoComplete="new-password" invalid={!!errors.password} />
      </Field>
      <Field label="Confirmar nova senha" htmlFor="confirmPassword" error={errors.confirmPassword}>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" invalid={!!errors.confirmPassword} />
      </Field>
      <Turnstile resetSignal={state} />
      <FormMessage error={state.error} success={state.success} />
      <Button type="submit" disabled={pending} className="self-start">
        Trocar senha
      </Button>
    </form>
  )
}
```

- [ ] **Step 5: Rodar todos os e2e**

Run: `npx playwright test`
Expected: PASS em desktop e mobile.

- [ ] **Step 6: Refinar com impeccable**

Invoque a skill `impeccable` para a página **Conta** e para **Minhas vitrines** (estado vazio). Use as mesmas restrições da Task 6 e mantenha todos os rótulos, textos de botão e mensagens usados em `e2e/account.spec.ts`. Depois rode `npx playwright test`.
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(conta): nome, troca de senha só para contas com senha, sair de todos"
```

---

### Task 10: Monitoramento de erros (Sentry)

**Files:**
- Create: `src/instrumentation.ts`, `src/instrumentation-client.ts`, `src/sentry.server.config.ts`, `src/sentry.edge.config.ts`
- Modify: `next.config.ts`

**Interfaces:**
- Consumes: variáveis `SENTRY_DSN` e `NEXT_PUBLIC_SENTRY_DSN` (vazias = Sentry desligado)
- Produces: erros de servidor, de requisição e do navegador enviados ao Sentry quando o DSN existe

- [ ] **Step 1: Instalar**

```bash
npm i @sentry/nextjs
```

- [ ] **Step 2: Configurar**

`src/sentry.server.config.ts`:

```ts
import * as Sentry from '@sentry/nextjs'

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? 'development',
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  })
}
```

`src/sentry.edge.config.ts`: o mesmo conteúdo de `src/sentry.server.config.ts`.

`src/instrumentation.ts`:

```ts
import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') await import('./sentry.server.config')
  if (process.env.NEXT_RUNTIME === 'edge') await import('./sentry.edge.config')
}

export const onRequestError = Sentry.captureRequestError
```

`src/instrumentation-client.ts`:

```ts
import * as Sentry from '@sentry/nextjs'

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? 'development',
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  })
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
```

`next.config.ts`:

```ts
import { withSentryConfig } from '@sentry/nextjs'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  allowedDevOrigins: ['localhost', '*.localhost'],
}

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
})
```

- [ ] **Step 3: Conferir**

Run: `npm run typecheck && npm run build && npx playwright test e2e/routing.spec.ts`
Expected: build sem erros (sem DSN, o Sentry fica inativo) e e2e passando.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: monitoramento de erros com Sentry (ativo só com DSN)"
```

---

### Task 11: Guia de infraestrutura e verificação final

**Files:**
- Create: `docs/setup/fase-1-infra.md`

**Interfaces:**
- Consumes: tudo o que foi entregue nas Tasks 1 a 10
- Produces: passo a passo para colocar a Fase 1 em produção em `agenn.com.br`

- [ ] **Step 1: Escrever o guia**

`docs/setup/fase-1-infra.md`:

````markdown
# Fase 1: Infraestrutura de produção

## 1. Supabase (projeto de produção)
1. Crie o projeto na região **South America (São Paulo)**.
2. Vincule o projeto e aplique as migrações:
   ```bash
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
3. Em **Authentication → URL Configuration**:
   - Site URL: `https://app.agenn.com.br`
   - Redirect URLs: `https://app.agenn.com.br/auth/callback`
4. Em **Authentication → Emails → Templates**, cole o conteúdo de `supabase/templates/confirmacao.html` (Confirm signup) e `supabase/templates/recuperacao.html` (Reset password), com os assuntos do `config.toml`.
5. Em **Authentication → Providers → Email**: confirmação de e-mail ligada e senha mínima de 8.
6. Em **Authentication → SMTP**, use o SMTP do Resend (seção 3).
7. Em **Authentication → Attack Protection**, ligue o CAPTCHA **Turnstile** com a secret key (seção 4).
8. Em **Authentication → Providers → Google**, ligue o provedor com Client ID e Secret (seção 5).

## 2. Vercel
1. Importe o repositório e use Node 20+.
2. Domínios: `agenn.com.br`, `app.agenn.com.br` e `*.agenn.com.br`. O domínio curinga exige que o DNS do domínio use os **nameservers da Vercel**.
3. Variáveis de ambiente (Production):
   - `NEXT_PUBLIC_ROOT_DOMAIN=agenn.com.br`
   - `LEGACY_DOMAINS=` (vazio)
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`
   - `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
   - `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`
   - `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`

## 3. Resend
1. Adicione o domínio `agenn.com.br` e configure os registros DNS (SPF, DKIM).
2. Remetente: `Agenn Vitrine <nao-responda@agenn.com.br>`.
3. Gere as credenciais SMTP e use-as no Supabase (seção 1.6).

## 4. Cloudflare Turnstile
1. Crie um widget **Managed** para os hostnames `agenn.com.br` e `app.agenn.com.br`.
2. A site key vai em `NEXT_PUBLIC_TURNSTILE_SITE_KEY` e a secret key no Supabase (seção 1.7).

## 5. Google OAuth
1. No Google Cloud Console, crie a tela de consentimento (nome "Agenn Vitrine") e credenciais **OAuth Client ID (Web)**.
2. Origem JavaScript autorizada: `https://app.agenn.com.br`.
3. URI de redirecionamento autorizado: `https://<ref>.supabase.co/auth/v1/callback`.

## 6. Sentry
Crie o projeto Next.js e copie DSN, org, project e auth token para a Vercel.

## 7. Conferência em produção
- [ ] `https://agenn.com.br` mostra a página inicial
- [ ] `https://qualquer.agenn.com.br` mostra "Vitrine não encontrada"
- [ ] Cadastro recebe e-mail do Resend e o link leva ao painel
- [ ] "Continuar com Google" entra e a página Conta **não** mostra "Senha"
- [ ] Login em outro navegador derruba o primeiro com "Sua conta foi acessada em outro aparelho."
- [ ] Recuperação de senha funciona

## Migração futura para agennvitrine.com.br
Siga a seção 2.2 da spec: novo domínio e curinga na Vercel, `NEXT_PUBLIC_ROOT_DOMAIN=agennvitrine.com.br`, `LEGACY_DOMAINS=agenn.com.br`, e atualização de Supabase (Site URL e Redirect URLs), Google OAuth, Resend e Turnstile.
````

- [ ] **Step 2: Verificação completa**

Run:

```bash
npm run lint && npm run typecheck && npm test && npm run test:db && npm run build && npx playwright test
```

Expected: tudo passa, com testes unitários, pgTAP (17), build e e2e em desktop e mobile.

- [ ] **Step 3: Commit**

```bash
git add docs/setup/fase-1-infra.md
git commit -m "docs: guia de infraestrutura da Fase 1"
```
