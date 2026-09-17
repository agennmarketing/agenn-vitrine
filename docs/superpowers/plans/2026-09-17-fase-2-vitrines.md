# Fase 2 — Vitrines de Produtos e Serviços: Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O dono cria uma vitrine de Produtos ou Serviços, cadastra categorias e itens com imagens, variações e códigos, configura o WhatsApp, e a vitrine pública (estática, com revalidação sob demanda) envia o cliente ao WhatsApp com mensagem pronta e código de pedido. O simulador do painel recalcula qualquer pedido pelo código ou manualmente.

**Architecture:** Mesmo app Next.js 16 da Fase 1. Antes de tudo, o CI no GitHub Actions passa a rodar pgTAP e Playwright contra um Supabase local do próprio runner (nada depende de Docker na máquina de desenvolvimento), e o proxy passa a fazer uma única consulta de sessão (`session_state()`). O banco ganha vitrines, contatos, categorias, itens, códigos, variações, mídias, pedidos e limite de requisições, todos com RLS e travas de plano em triggers. As regras (preço, códigos, mensagens, telefone, visibilidade do plano) são funções puras testadas com Vitest. O painel escreve pelo cliente Supabase do usuário (RLS); só as rotas que precisam de privilégio (upload de imagem, pedidos, vitrine pública) usam a chave secreta no servidor. Imagens são recortadas e convertidas no navegador e gravadas no Bunny Storage por `POST /api/media/image`; no CI, um driver `fake` grava em disco. A vitrine pública é ISR (`generateStaticParams` vazio + `unstable_cache` com tag por subdomínio) e revalidada ao salvar no painel.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, @supabase/ssr, @supabase/supabase-js, Zod, libphonenumber-js, react-easy-crop, image-size, server-only, Vitest, Playwright, Supabase CLI, pgTAP, GitHub Actions, GitHub CLI, Bunny Storage.

**Spec:** `docs/superpowers/specs/2026-09-16-agenn-vitrine-design.md`. Seções usadas nesta fase: 1, 2.1, 3 (limites de vitrines, itens e imagens), 4.2, 4.3, 4.5, 4.6 (sem complementos), 4.7 (itens visíveis e personalização), 4.8, 5, 6.1, 6.3 (listagem e imagens da tela do item), 7.1, 7.2, 7.3 (sem sacola), 7.5 (botão direto), 8.2 (sem QR Code), 8.3, 8.4 (abas Itens, Aparência, WhatsApp, Sacola e mensagens, Configurações), 8.5 (sem vídeo e sem complementos), 8.6, 8.9, 10, 11 e 12 (Fase 2).

**Memória considerada:** pendências da Fase 1 ("proxy com uma consulta de sessão antes da Fase 2", coberturas faltantes, padrão `revoke` + RLS, stub do Sentry), ambiente (drive FAT32, sem Docker, Supabase dev na nuvem, Vercel em `app.agenn.com.br`) e a preferência de entregar a funcionalidade agora e deixar o design para uma fase posterior.

---

## Como trabalhar nesta fase (pela nuvem)

Nada desta fase roda `next dev`, Docker ou Supabase local na máquina de desenvolvimento. A verificação acontece em três lugares:

| Onde | O quê |
|---|---|
| Máquina local | `npm run lint`, `npm run typecheck`, `npm test` (Vitest). Rápidos e sem serviços. |
| GitHub Actions | pgTAP (`supabase test db`), geração dos tipos do banco, build de produção e Playwright (desktop e mobile) contra Supabase local do runner. |
| Nuvem | Migrações aplicadas automaticamente no Supabase dev ao entrar na `master`; a Vercel publica `app.agenn.com.br`; conferência manual curta no navegador ao fim de cada bloco. |

### Ciclo de cada bloco

1. `git switch master && git pull && git switch -c fase-2/bloco-N-<nome>`.
2. Implementar as tarefas do bloco, com um commit por tarefa (mensagens no padrão já usado: `feat(escopo): …`, `test(escopo): …`, `chore(escopo): …`).
3. Antes de cada push: `npm run lint && npm run typecheck && npm test`.
4. `git push -u origin HEAD` e `gh pr create --fill --base master`.
5. Acompanhar com `gh pr checks --watch`. Falhou? `gh run view --log-failed`, corrigir, novo commit, novo push.
6. Com tudo verde, **pedir autorização ao usuário** e então `gh pr merge --merge --delete-branch`.
7. O job `migrate` aplica as migrações novas no Supabase dev. A Vercel publica a `master`.
8. Fazer a conferência na nuvem descrita no fim do bloco.

### Rotina de migração (referenciada pelas tarefas de banco)

Os tipos em `src/lib/supabase/database.types.ts` são gerados no CI, porque a máquina local não roda o Supabase.

1. Escrever a migração e o teste pgTAP. Commit e push.
2. O job `db` roda o pgTAP e gera os tipos. Na primeira execução ele **falha de propósito** no passo "Tipos commitados estão atualizados", porque os tipos mudaram.
3. Baixar os tipos gerados:
   ```bash
   gh run download <run-id> --name database-types --dir <scratchpad>/types
   cp <scratchpad>/types/database.types.ts src/lib/supabase/database.types.ts
   ```
   O `gh` não sobrescreve arquivo existente, por isso baixa numa pasta temporária. O `<run-id>` vem de `gh run list --branch <branch> --limit 1`.
4. `git add src/lib/supabase/database.types.ts && git commit -m "chore(db): tipos gerados" && git push`.
5. O código TypeScript que usa as tabelas novas vem **depois** deste commit.

Migrações só acrescentam (nada de editar uma migração já na `master`). Toda migração nova repete o padrão de segurança das Global Constraints.

---

## Global Constraints

- **Idioma:** todo texto visível ao usuário em português do Brasil. Identificadores de código em inglês.
- **Domínio:** nenhum domínio fixo. Links absolutos com `buildAppUrl`/`buildVitrineUrl` e `NEXT_PUBLIC_ROOT_DOMAIN`.
- **Banco, segurança:** toda tabela nova tem `alter table … enable row level security`, `revoke all on … from anon, authenticated` e grants **explícitos por coluna** para o que o dono pode inserir/alterar. Funções `security definer` têm `set search_path = ''` e `revoke execute … from public, anon, authenticated`, com `grant` só para quem usa. Tabelas filhas têm `owner_id` e a política de escrita confere o dono do pai.
- **Banco, chaves de erro:** travas do banco levantam `P0001` com mensagem-chave estável: `plan_limit:vitrines`, `plan_limit:items`, `item_code_taken`, `invalid_reference:<coisa>`, `item_deleted`, `vitrine_not_found`. O `hint` leva o limite numérico quando houver. A interface traduz com `mapDbError`.
- **Limite de plano ao salvar:** nunca erro genérico. Sempre o convite: `Seu plano permite até {N} {coisa}. Assine o Pro para {ação}.`
- **Valores monetários:** inteiros em centavos. Exibição com `formatBRL` (usa `Intl`, com espaço não separável ` ` depois de `R$`).
- **Tipos de vitrine nesta fase:** o assistente oferece só `produtos` e `servicos`. O banco já aceita `comida` (Fase 4).
- **Botão padrão por tipo:** `produtos` → `Solicitar orçamento`, `servicos` → `Agendar`, `comida` → `Pedir`.
- **Categorias de exemplo:** `produtos` → `Destaques`, `Novidades`; `servicos` → `Serviços`, `Pacotes`.
- **Códigos:** item `^[A-Z0-9]{1,6}$`, automático a partir de `101`, único por conta e nunca reaproveitado. Pedido com 4 caracteres de `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`.
- **Pedidos:** no máximo 20 criações por hora por IP. `order_snapshots` nunca guarda dados pessoais. Falha ao criar o código nunca bloqueia o envio ao WhatsApp.
- **Imagens:** capa e galeria 4:5 em 480 e 1080 px de largura; logo 1:1 em 128 e 512; banner 16:9 em 960 e 1920. WebP; se o navegador não codificar WebP (Safari), JPEG. Caminho `{owner_id}/{vitrine_id}/{media_id}-{largura}.{webp|jpg}`.
- **Chaves privilegiadas:** `SUPABASE_SECRET_KEY` só em arquivos com `import 'server-only'`.
- **Sentry:** todo membro novo de `@sentry/nextjs` usado no código ganha espelho tipado em `src/lib/monitoring/sentry-noop.ts`.
- **Proxy:** o matcher continua excluindo `/api/`. Rotas de API autenticadas conferem a sessão com `getApiUser()`.
- **Design:** sem etapas de refinamento visual nesta fase. Telas limpas com os componentes da Fase 1 (`Button`, `Input`, `Field`, `FormMessage`, `Card`, `SubmitButton`) e os tokens de `globals.css`. Rótulos, textos de botões e títulos listados nas tarefas são usados pelos testes e não podem mudar sem atualizar os testes.
- **Next.js 16:** antes de escrever código de cache, rotas ou server actions, ler o guia correspondente em `node_modules/next/dist/docs/` (o `AGENTS.md` exige). Referências usadas aqui: `01-app/02-guides/caching-without-cache-components.md`, `01-app/03-api-reference/04-functions/revalidateTag.md`, `01-app/03-api-reference/04-functions/generate-static-params.md`, `01-app/03-api-reference/04-functions/use-search-params.md`.

---

## Decisões desta fase

| Tema | Decisão | Motivo |
|---|---|---|
| Cache da vitrine | `unstable_cache` com tag `vitrine-sub:{subdomain}` e `revalidateTag(tag, { expire: 0 })`, sem ligar `cacheComponents` | Ligar `cacheComponents` exigiria refatorar os layouts da Fase 1 que usam `cookies()`. A tag é pelo subdomínio porque é o que se conhece antes de buscar; ao trocar o subdomínio, as duas tags são revalidadas. |
| Tipos do banco | Gerados no CI e baixados com `gh` | Sem Supabase local na máquina. |
| Testes de banco | `supabase test db` no CI | Substitui o `scripts/test-db.mjs` (que depende de `docker exec`) no fluxo desta fase. O script continua no repositório para quem tiver Docker. |
| Criação da vitrine | Função `create_vitrine` (invoker) cria vitrine, WhatsApp principal e categorias numa transação | Evita vitrine sem WhatsApp se uma das inserções falhar. |
| Capa de item novo | Imagem enviada antes de o item existir (`item_id` nulo) e vinculada ao salvar | A capa é obrigatória; a limpeza de órfãs é tarefa diária da Fase 3. |
| Duplicar item | Copia as imagens no Storage | Cada mídia tem arquivos próprios; apagar uma cópia não quebra a outra. |
| Leitura pública | Servidor com a chave secreta, nenhum grant para `anon` nas tabelas | Mantém a regra da Fase 1 e permite aplicar a visibilidade do plano antes de mandar dados ao navegador. |
| `?item=` | Lido de `window.location` num componente pequeno | `useSearchParams` jogaria o catálogo inteiro para renderização no cliente. |

### Adiado para a fase de design (confirmar com o usuário)

- **Arrastar para reordenar** categorias e itens: nesta fase, botões `Subir` e `Descer`.
- **Prévia ao vivo** com dados não salvos no editor: nesta fase, link `Ver vitrine` para a página pública (atualizada ao salvar).
- **Barra fixa "Alterações não salvas"**: nesta fase, cada formulário tem seu botão de salvar e confirmação do navegador (`beforeunload`) quando há mudanças.
- Destaque animado da categoria visível: a barra de categorias fica fixa e destaca a categoria com `IntersectionObserver`, sem animação.

### Fica para outras fases (como na spec)

Vídeos e banner em vídeo (3), complementos, sacola, formulário e vitrine de Comida (4), Stripe, congelamento e página de plano (5), QR Code, excluir conta e `robots.txt`/`sitemap.xml` por vitrine (6). Pendências de endurecimento da Fase 1 (`/redefinir-senha`, confirmação por POST, prévias da Vercel) seguem registradas em `docs/setup/fase-1-infra.md`.

---

## Mapa de arquivos

```
.github/workflows/ci.yml                         # checks, db (pgTAP + tipos), e2e, migrate
scripts/ci-env.mjs                               # .env.local do CI a partir do `supabase status`
playwright.config.ts                             # CI usa `npm run start`
package.json                                     # novas dependências
.env.example                                     # novas variáveis
docs/setup/fase-2-infra.md                       # Bunny, variáveis, segredos do GitHub

supabase/migrations/20260918000000_session_state.sql
supabase/migrations/20260918000100_vitrines.sql
supabase/migrations/20260918000200_items_media.sql
supabase/migrations/20260918000300_orders.sql
supabase/tests/database/03_account_gaps.test.sql
supabase/tests/database/04_session_state.test.sql
supabase/tests/database/05_vitrines.test.sql
supabase/tests/database/06_items_media.test.sql
supabase/tests/database/07_orders.test.sql

src/proxy.ts                                     # uma consulta: session_state()
src/lib/auth/session-state.ts                    # interpreta session_state (+ test)
src/lib/auth/require-user.ts                     # getApiUser() para rotas de API
src/lib/auth/action-user.ts                      # requireActionUser() para server actions
src/lib/forms/form-state.ts                      # + readFormFields
src/components/ui/button.tsx                     # + buttonClasses
src/lib/vitrines/reorder.ts                      # moveInList (+ test)
src/lib/env-schema.ts                            # + NEXT_PUBLIC_MEDIA_BASE_URL
src/lib/env.ts
src/lib/server-env-schema.ts                     # variáveis do servidor (+ test)
src/lib/server-env.ts                            # server-only
src/lib/supabase/admin.ts                        # server-only, chave secreta
src/lib/monitoring/sentry-noop.ts                # + captureException

src/lib/money/money.ts                           # formatBRL, parseBRLToCents (+ test)
src/lib/pricing/price.ts                         # regras 4.6 sem complementos (+ test)
src/lib/codes/item-code.ts                       # (+ test)
src/lib/codes/order-code.ts                      # (+ test)
src/lib/whatsapp/phone.ts                        # E.164 (+ test)
src/lib/whatsapp/messages.ts                     # mensagens e wa.me (+ test)
src/lib/vitrines/vitrine-types.ts                # rótulos, botões e categorias por tipo (+ test)
src/lib/vitrines/schemas.ts                      # Zod dos formulários (+ test)
src/lib/vitrines/db-errors.ts                    # mapDbError (+ test)
src/lib/vitrines/cache.ts                        # vitrineTag, revalidateVitrine
src/lib/vitrines/reserved-sync.test.ts           # lista de reservados igual no SQL e no TS
src/lib/color/contrast.ts                        # texto branco ou preto (+ test)
src/lib/media/image-specs.ts                     # tamanhos por papel (+ test)
src/lib/media/validate-image.ts                  # tipo e dimensões (+ test)
src/lib/media/urls.ts                            # mediaUrl (+ test)
src/lib/media/storage.ts                         # interface + escolha do driver (server-only)
src/lib/media/bunny-storage.ts
src/lib/media/fake-storage.ts
src/lib/media/remove-media.ts                    # apaga linhas e arquivos (server-only)
src/lib/media/render-crop.ts                     # navegador: recorte → WebP/JPEG
src/lib/orders/snapshot.ts                       # payload do pedido (+ test)
src/lib/orders/client-ip.ts                      # IP e chave do limite (+ test)
src/lib/simulator/simulate.ts                    # recálculo e resumo (+ test)

src/features/vitrines/actions.ts
src/features/vitrines/queries.ts
src/features/whatsapp/actions.ts
src/features/categories/actions.ts
src/features/items/actions.ts
src/features/items/queries.ts
src/features/public/build-catalog.ts             # dados → catálogo público (+ test)
src/features/public/load-vitrine.ts              # busca + cache
src/features/simulator/actions.ts

src/app/api/media/image/route.ts
src/app/api/media/[id]/route.ts
src/app/api/dev-media/[...path]/route.ts
src/app/api/orders/route.ts

src/components/media/image-slot.tsx
src/components/media/image-cropper.tsx
src/components/ui/unsaved-changes.tsx

src/app/app/(painel)/layout.tsx                  # nav + getClaims
src/app/app/(painel)/painel/page.tsx             # Minhas vitrines
src/app/app/(painel)/painel/copy-link-button.tsx
src/app/app/(painel)/painel/vitrines/nova/page.tsx
src/app/app/(painel)/painel/vitrines/nova/wizard.tsx
src/app/app/(painel)/painel/vitrines/[id]/layout.tsx
src/app/app/(painel)/painel/vitrines/[id]/editor-tabs.tsx
src/app/app/(painel)/painel/vitrines/[id]/page.tsx
src/app/app/(painel)/painel/vitrines/[id]/itens/page.tsx
src/app/app/(painel)/painel/vitrines/[id]/itens/category-manager.tsx
src/app/app/(painel)/painel/vitrines/[id]/itens/item-list.tsx
src/app/app/(painel)/painel/vitrines/[id]/itens/novo/page.tsx
src/app/app/(painel)/painel/vitrines/[id]/itens/[itemId]/page.tsx
src/app/app/(painel)/painel/vitrines/[id]/itens/item-form.tsx
src/app/app/(painel)/painel/vitrines/[id]/aparencia/page.tsx
src/app/app/(painel)/painel/vitrines/[id]/aparencia/appearance-form.tsx
src/app/app/(painel)/painel/vitrines/[id]/whatsapp/page.tsx
src/app/app/(painel)/painel/vitrines/[id]/whatsapp/contacts.tsx
src/app/app/(painel)/painel/vitrines/[id]/mensagens/page.tsx
src/app/app/(painel)/painel/vitrines/[id]/mensagens/messages-form.tsx
src/app/app/(painel)/painel/vitrines/[id]/configuracoes/page.tsx
src/app/app/(painel)/painel/vitrines/[id]/configuracoes/settings-form.tsx
src/app/app/(painel)/painel/vitrines/[id]/configuracoes/delete-form.tsx
src/app/app/(painel)/painel/simulador/page.tsx
src/app/app/(painel)/painel/simulador/simulator.tsx

src/app/v/[subdomain]/page.tsx                   # vitrine pública (ISR)
src/app/v/[subdomain]/catalog.tsx
src/app/v/[subdomain]/item-sheet.tsx
src/app/v/[subdomain]/item-param.ts             # ?item= sem useSearchParams
src/app/v/[subdomain]/send-direct.ts

e2e/helpers.ts                                   # + seed de vitrine/itens, plano, imagem
e2e/auth-gaps.spec.ts
e2e/vitrines.spec.ts
e2e/editor.spec.ts
e2e/media.spec.ts
e2e/items.spec.ts
e2e/public-vitrine.spec.ts
e2e/simulator.spec.ts
e2e/fluxo-completo.spec.ts
e2e/limits.spec.ts
```

---

# Bloco 0 — Base de trabalho na nuvem

Branch: `fase-2/bloco-0-ci`. Entrega o CI que valida todo o resto da fase.

### Task 1: GitHub CLI e workflow de CI

**Files:**
- Create: `.github/workflows/ci.yml`, `scripts/ci-env.mjs`
- Modify: `playwright.config.ts`, `e2e/helpers.ts`

**Interfaces:**
- Produces: jobs `checks`, `db` (artefato `database-types`), `e2e` (artefato `playwright-report` em falha), `migrate`.
- Produces (e2e): `createAdminClient()` exportado; `createConfirmedUser()` passa a devolver também `id`.

- [ ] **Step 1: Instalar e autenticar o GitHub CLI (usuário)**

O `gh` não está instalado. Peça ao usuário para rodar no terminal (o login é interativo):

```powershell
winget install --id GitHub.cli -e
gh auth login
```

Confirme com `gh auth status` e `gh repo view agennmarketing/agenn-vitrine --json name`.

- [ ] **Step 2: Script que monta o `.env.local` do CI**

`scripts/ci-env.mjs`:

```js
#!/usr/bin/env node
// Só para o GitHub Actions: lê as chaves do Supabase local do runner e grava o
// .env.local usado pelo `next build`, `next start` e Playwright. As variáveis
// fixas do CI (domínio, driver de mídia etc.) vêm do `env:` do workflow.
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const status = JSON.parse(execFileSync('npx', ['supabase', 'status', '-o', 'json'], { encoding: 'utf8' }))

function pick(...names) {
  for (const name of names) if (status[name]) return status[name]
  throw new Error(`Chave ausente no supabase status: ${names.join(' | ')}. Disponíveis: ${Object.keys(status).join(', ')}`)
}

const values = {
  NEXT_PUBLIC_SUPABASE_URL: pick('API_URL'),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: pick('PUBLISHABLE_KEY', 'ANON_KEY'),
  SUPABASE_SECRET_KEY: pick('SECRET_KEY', 'SERVICE_ROLE_KEY'),
  MAILPIT_URL: pick('MAILPIT_URL', 'INBUCKET_URL'),
}

writeFileSync('.env.local', Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n') + '\n')
console.log(`.env.local gravado com ${Object.keys(values).join(', ')}`)
```

- [ ] **Step 3: Playwright usa build de produção no CI**

Em `playwright.config.ts`, troque o `webServer`:

```ts
  webServer: {
    // No CI o workflow já rodou `npm run build`; localmente segue o `next dev`.
    command: process.env.CI ? 'npm run start' : 'npm run dev',
    url: 'http://localhost:3000/',
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
```

- [ ] **Step 4: Expor o cliente admin e o id do usuário nos helpers**

Em `e2e/helpers.ts`, troque `function createAdminClient()` por `export function createAdminClient()` e faça `createConfirmedUser` devolver o id:

```ts
export async function createConfirmedUser(prefix: string) {
  const admin = createAdminClient()
  const user = { email: uniqueEmail(prefix), password: 'senhaForte123', name: 'Pessoa Teste' }
  const { data, error } = await admin.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: { name: user.name },
  })
  if (error) throw error
  return { ...user, id: data.user.id }
}
```

- [ ] **Step 5: Workflow**

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [master]
  workflow_dispatch:

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test

  db:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - name: Supabase local
        run: npx supabase start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor,realtime,storage-api,mailpit
      - name: pgTAP
        run: npx supabase test db
      - name: Gerar tipos do banco
        run: npx supabase gen types typescript --local > src/lib/supabase/database.types.ts
      - uses: actions/upload-artifact@v4
        with:
          name: database-types
          path: src/lib/supabase/database.types.ts
      - name: Tipos commitados estão atualizados
        run: git diff --exit-code -- src/lib/supabase/database.types.ts

  e2e:
    needs: [checks]
    runs-on: ubuntu-latest
    timeout-minutes: 40
    env:
      NEXT_PUBLIC_ROOT_DOMAIN: localhost:3000
      LEGACY_DOMAINS: legado.localhost:3000
      NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: 'false'
      NEXT_PUBLIC_MEDIA_BASE_URL: /api/dev-media
      MEDIA_STORAGE_DRIVER: fake
      RATE_LIMIT_SALT: ci-salt-somente-para-testes
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - name: Supabase local
        run: npx supabase start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor,realtime,storage-api
      - run: node scripts/ci-env.mjs
      - run: npx playwright install --with-deps chromium
      - run: npm run build
      - run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: |
            playwright-report
            test-results
          retention-days: 7

  migrate:
    # Aplica no Supabase dev as migrações que entraram na master. Não espera os
    # outros jobs: a Vercel publica a master em ~2 min e o código novo precisa das
    # tabelas. As migrações já passaram pelo pgTAP no PR.
    if: github.event_name == 'push' && github.ref == 'refs/heads/master'
    runs-on: ubuntu-latest
    concurrency: migrate-supabase-dev
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - name: supabase db push
        env:
          SUPABASE_DB_URL: ${{ secrets.SUPABASE_DB_URL }}
        run: npx supabase db push --db-url "$SUPABASE_DB_URL" --yes
```

- [ ] **Step 6: Segredo do banco no GitHub (usuário)**

O job `migrate` precisa da mesma URL que está em `.env.local` como `SUPABASE_DB_URL` (pooler `aws-0-sa-east-1`, porta 5432). Peça ao usuário para rodar, colando a URL quando o `gh` pedir:

```powershell
gh secret set SUPABASE_DB_URL --repo agennmarketing/agenn-vitrine
```

- [ ] **Step 7: Rodar e commitar**

```bash
npm run lint && npm run typecheck && npm test
git add .github scripts/ci-env.mjs playwright.config.ts e2e/helpers.ts
git commit -m "ci: pgTAP, tipos do banco, e2e e migrações automáticas no GitHub Actions"
git push -u origin HEAD
gh pr create --fill --base master
gh pr checks --watch
```

Expected: `checks`, `db` e `e2e` verdes, com os testes da Fase 1 passando no runner. Se `supabase start` recusar algum nome em `-x`, confira a lista com `npx supabase start --help` e ajuste. Se `ci-env.mjs` acusar chave ausente, a mensagem lista as chaves disponíveis; ajuste os nomes em `pick`.

---

### Task 2: Coberturas pendentes da Fase 1

**Files:**
- Create: `supabase/tests/database/03_account_gaps.test.sql`, `e2e/auth-gaps.spec.ts`

- [ ] **Step 1: pgTAP do plano gratuito e das negações ao visitante**

`supabase/tests/database/03_account_gaps.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000d1', 'livre@teste.com', '{"name":"Livre"}');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","session_id":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is((select (public.my_entitlements()).id), 'free', 'conta sem assinatura recebe o gratuito');
select is((select (public.my_entitlements()).max_vitrines), 1, 'gratuito permite 1 vitrine');
select is((select (public.my_entitlements()).show_watermark), true, 'gratuito mostra marca d''água');

reset role;
set local role anon;
select throws_ok($$ select * from public.profiles $$, '42501', null, 'visitante não lê perfis');
select throws_ok($$ select * from public.subscriptions $$, '42501', null, 'visitante não lê assinaturas');
select throws_ok($$ select public.my_entitlements() $$, '42501', null, 'visitante não chama my_entitlements');
select throws_ok($$ select public.claim_session() $$, '42501', null, 'visitante não chama claim_session');

select * from finish();
rollback;
```

- [ ] **Step 2: e2e que faltavam**

`e2e/auth-gaps.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { APP_URL } from '../playwright.config'
import { createAdminClient, createConfirmedUser, signIn, uniqueEmail } from './helpers'

test('login com e-mail não confirmado mostra aviso', async ({ page }) => {
  const admin = createAdminClient()
  const email = uniqueEmail('naoconfirmado')
  const { error } = await admin.auth.admin.createUser({ email, password: 'senhaForte123', email_confirm: false })
  if (error) throw error

  await page.goto('/entrar')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha', { exact: true }).fill('senhaForte123')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByText('Confirme seu e-mail antes de entrar.')).toBeVisible()
  await expect(page).toHaveURL(/\/entrar/)
})

test('domínio antigo redireciona com 301 preservando subdomínio, caminho e query', async ({ request }) => {
  // No CI, LEGACY_DOMAINS=legado.localhost:3000 e o domínio raiz é localhost:3000.
  const response = await request.get('http://loja.legado.localhost:3000/?item=104', { maxRedirects: 0 })
  expect(response.status()).toBe(301)
  expect(response.headers()['location']).toBe('http://loja.localhost:3000/?item=104')
})

test('sair de todos os aparelhos derruba a sessão de outro navegador', async ({ browser }) => {
  const user = await createConfirmedUser('todos2')
  const deviceA = await browser.newContext({ baseURL: APP_URL })
  const pageA = await deviceA.newPage()
  await signIn(pageA, user.email, user.password)

  const deviceB = await browser.newContext({ baseURL: APP_URL })
  const pageB = await deviceB.newPage()
  await signIn(pageB, user.email, user.password)
  await pageB.goto('/painel/conta')
  await pageB.getByRole('button', { name: 'Sair de todos os aparelhos' }).click()
  await expect(pageB).toHaveURL(/\/entrar$/)

  await pageA.goto('/painel')
  await expect(pageA).toHaveURL(/\/entrar/)

  await deviceA.close()
  await deviceB.close()
})
```

O teste do 301 depende de `LEGACY_DOMAINS` no CI; localmente, sem essa variável, ele falha. Isso é aceito: e2e roda no CI.

- [ ] **Step 3: Commit e push**

```bash
git add supabase/tests/database/03_account_gaps.test.sql e2e/auth-gaps.spec.ts
git commit -m "test: coberturas pendentes da Fase 1 (gratuito, visitante, e-mail não confirmado, 301, sair de todos)"
git push
gh pr checks --watch
```

Expected: `db` com `03_account_gaps` ok e `e2e` com os três testes novos passando em desktop e mobile.

**Fim do Bloco 0:** autorização do usuário → merge. Conferência na nuvem: na aba Actions da `master`, o job `migrate` roda e termina com "Remote database is up to date" (nenhuma migração nova ainda).

---

# Bloco 1 — Sessão com uma consulta (pendência antes da Fase 2)

Branch: `fase-2/bloco-1-sessao`.

### Task 3: `session_state()` no banco e no proxy

**Files:**
- Create: `supabase/migrations/20260918000000_session_state.sql`, `supabase/tests/database/04_session_state.test.sql`, `src/lib/auth/session-state.ts`, `src/lib/auth/session-state.test.ts`, `src/lib/auth/require-user.ts`
- Modify: `src/proxy.ts`, `src/app/app/(painel)/layout.tsx`, `src/lib/auth/session.ts` e `session.test.ts` (remover `isSessionGoneError` se ficar sem uso), `package.json` (`server-only`)

**Interfaces:**
- Produces:
  - SQL `public.session_state() returns text` → `'anonymous' | 'revoked' | 'replaced' | 'current'` (grant `authenticated`)
  - `interpretSessionState(input: { data: unknown; status: number; hasError: boolean }): { isAuthenticated: boolean; isSessionCurrent: boolean; clearCookies: boolean }`
  - `getApiUser(): Promise<{ supabase: SupabaseClient<Database>; userId: string } | null>`

- [ ] **Step 1: Conferir chaves assimétricas no Supabase dev (usuário)**

Sem chave assimétrica, `getClaims()` chama o Auth pela rede e o ganho some. Peça ao usuário para abrir **Project Settings → JWT Keys** no projeto `agenn-vitrine-dev` e confirmar que a chave **em uso** é ECC (P-256) ou RSA. Se for "Legacy HS256", seguir o passo 10 de `docs/setup/fase-1-infra.md` (criar, esperar, rotacionar) antes do merge deste bloco.

- [ ] **Step 2: Migração**

`supabase/migrations/20260918000000_session_state.sql`:

```sql
-- Estado da sessão do JWT atual numa única consulta (usado pelo proxy e pelas
-- rotas de API). Substitui getUser() + select em profiles.
--   anonymous: sem usuário no JWT
--   revoked:   a sessão do JWT não existe mais em auth.sessions (saiu, "sair de todos")
--   replaced:  outra sessão foi marcada como ativa (sessão única)
--   current:   sessão válida e ativa
create function public.session_state()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when auth.uid() is null then 'anonymous'
    when not exists (
      select 1
      from auth.sessions s
      where s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid
        and s.user_id = auth.uid()
    ) then 'revoked'
    when exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.active_session_id is not null
        and p.active_session_id is distinct from nullif(auth.jwt() ->> 'session_id', '')::uuid
    ) then 'replaced'
    else 'current'
  end;
$$;

revoke execute on function public.session_state() from public, anon;
grant execute on function public.session_state() to authenticated;
```

- [ ] **Step 3: pgTAP**

`supabase/tests/database/04_session_state.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'sessao@teste.com');
insert into auth.sessions (id, user_id) values
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-0000000000e1');

set local role authenticated;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e1","session_id":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
select is(public.session_state(), 'current', 'sessão existente sem sessão ativa marcada = current');

select public.claim_session();
select is(public.session_state(), 'current', 'sessão que é a ativa = current');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e1","session_id":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
select is(public.session_state(), 'revoked', 'session_id fora de auth.sessions = revoked');

reset role;
insert into auth.sessions (id, user_id) values
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-0000000000e1');
set local role authenticated;
select is(public.session_state(), 'replaced', 'sessão válida mas não ativa = replaced');

reset role;
set local role anon;
select throws_ok($$ select public.session_state() $$, '42501', null, 'visitante não chama session_state');

select * from finish();
rollback;
```

- [ ] **Step 4: Rotina de migração**

Seguir a "Rotina de migração" (push, baixar `database-types`, commit dos tipos).

- [ ] **Step 5: Teste da interpretação (falhando)**

`src/lib/auth/session-state.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { interpretSessionState } from './session-state'

describe('interpretSessionState', () => {
  it('current: autenticado e sessão atual', () => {
    expect(interpretSessionState({ data: 'current', status: 200, hasError: false })).toEqual({
      isAuthenticated: true,
      isSessionCurrent: true,
      clearCookies: false,
    })
  })

  it('replaced: autenticado, sessão substituída (o proxy encerra com a mensagem)', () => {
    expect(interpretSessionState({ data: 'replaced', status: 200, hasError: false })).toEqual({
      isAuthenticated: true,
      isSessionCurrent: false,
      clearCookies: false,
    })
  })

  it('revoked e anonymous: não autenticado e limpa cookies', () => {
    for (const data of ['revoked', 'anonymous', 'qualquer']) {
      expect(interpretSessionState({ data, status: 200, hasError: false })).toEqual({
        isAuthenticated: false,
        isSessionCurrent: true,
        clearCookies: true,
      })
    }
  })

  it('401: JWT recusado, limpa cookies', () => {
    expect(interpretSessionState({ data: null, status: 401, hasError: true })).toEqual({
      isAuthenticated: false,
      isSessionCurrent: true,
      clearCookies: true,
    })
  })

  it('falha de rede, 5xx ou 403: não autenticado, mas mantém os cookies', () => {
    for (const status of [0, 403, 500, 503]) {
      expect(interpretSessionState({ data: null, status, hasError: true })).toEqual({
        isAuthenticated: false,
        isSessionCurrent: true,
        clearCookies: false,
      })
    }
  })
})
```

Run: `npm test -- src/lib/auth/session-state.test.ts` → FAIL (módulo não existe).

- [ ] **Step 6: Implementação**

`src/lib/auth/session-state.ts`:

```ts
export type SessionStateResult = {
  isAuthenticated: boolean
  isSessionCurrent: boolean
  clearCookies: boolean
}

// Traduz a resposta de `rpc('session_state')`. Falha de rede/5xx é fail-closed
// (não autenticado) sem apagar cookies, para não deslogar por instabilidade.
// 403 também não apaga: indica grant faltando (erro de deploy), não sessão ruim.
export function interpretSessionState(input: { data: unknown; status: number; hasError: boolean }): SessionStateResult {
  if (!input.hasError) {
    if (input.data === 'current') return { isAuthenticated: true, isSessionCurrent: true, clearCookies: false }
    if (input.data === 'replaced') return { isAuthenticated: true, isSessionCurrent: false, clearCookies: false }
    return { isAuthenticated: false, isSessionCurrent: true, clearCookies: true }
  }
  return { isAuthenticated: false, isSessionCurrent: true, clearCookies: input.status === 401 }
}
```

Run: `npm test -- src/lib/auth/session-state.test.ts` → PASS.

- [ ] **Step 7: Proxy com uma consulta**

Em `src/proxy.ts`, dentro de `handleApp`, substitua tudo entre `const { data } = await supabase.auth.getClaims()` e `const decision = decideAppRoute({` por:

```ts
  // Com chaves assimétricas, getClaims() valida o JWT localmente (JWKS em cache).
  // A revogação e a sessão única vêm de uma única consulta ao banco.
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims

  let isAuthenticated = false
  let sessionCurrent = true
  if (typeof claims?.sub === 'string') {
    const { data: state, error, status } = await supabase.rpc('session_state')
    if (error && status !== 401) console.error('[proxy] falha ao consultar session_state', error)
    const result = interpretSessionState({ data: state, status, hasError: Boolean(error) })
    isAuthenticated = result.isAuthenticated
    sessionCurrent = result.isSessionCurrent
    if (result.clearCookies) await supabase.auth.signOut({ scope: 'local' })
  }
```

E na chamada `decideAppRoute`, troque `isAuthenticated: Boolean(userId)` por `isAuthenticated`. Ajuste os imports: remova `isSessionCurrent, isSessionGoneError` e importe `interpretSessionState` de `@/lib/auth/session-state`. Se `isSessionCurrent`/`isSessionGoneError` de `src/lib/auth/session.ts` ficarem sem uso no projeto (`grep -r "isSessionGoneError\|isSessionCurrent" src`), remova-os junto com seus testes.

- [ ] **Step 8: Helper para rotas de API**

`npm install server-only`

`src/lib/auth/require-user.ts`:

```ts
import 'server-only'
import { interpretSessionState } from '@/lib/auth/session-state'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// Rotas em /api/ não passam pelo proxy: conferem sessão e sessão única aqui.
export async function getApiUser() {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (typeof userId !== 'string') return null

  const { data: state, error, status } = await supabase.rpc('session_state')
  const result = interpretSessionState({ data: state, status, hasError: Boolean(error) })
  if (!result.isAuthenticated || !result.isSessionCurrent) return null
  return { supabase, userId }
}
```

- [ ] **Step 9: Layout do painel sem ida extra ao Auth**

O proxy já validou a sessão. Em `src/app/app/(painel)/layout.tsx`, troque `getUser()` por `getClaims()`:

```tsx
  const supabase = await createSupabaseServerClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims
  if (typeof claims?.sub !== 'string') redirect('/entrar')
  const userId = claims.sub
  const email = typeof claims.email === 'string' ? claims.email : ''

  const [{ data: profile }, { data: plan }] = await Promise.all([
    supabase.from('profiles').select('name').eq('id', userId).single(),
    supabase.rpc('my_entitlements'),
  ])
  const displayName = profile?.name || email
```

As server actions continuam usando `getUser()` (escritas confirmam no Auth).

- [ ] **Step 10: Verificar e commitar**

```bash
npm run lint && npm run typecheck && npm test
git add -A supabase src package.json package-lock.json
git commit -m "feat(sessao): proxy e APIs conferem sessão com uma única consulta (session_state)"
git push
gh pr checks --watch
```

Expected: `db` com `04_session_state` ok; `e2e` com `account.spec.ts` (sessão única, sair de todos) e `auth-gaps.spec.ts` verdes.

**Fim do Bloco 1:** autorização → merge. Conferência na nuvem: job `migrate` aplica `20260918000000_session_state`; em `app.agenn.com.br`, entrar, abrir Conta, entrar em outro navegador e confirmar que o primeiro recebe "Sua conta foi acessada em outro aparelho."

---

# Bloco 2 — Banco das vitrines

Branch: `fase-2/bloco-2-banco`. Três migrações com pgTAP. Ao fim do bloco, fazer a "Rotina de migração" uma única vez (as três juntas) e commitar os tipos.

### Task 4: Vitrines, contatos de WhatsApp e categorias

**Files:**
- Create: `supabase/migrations/20260918000100_vitrines.sql`, `supabase/tests/database/05_vitrines.test.sql`, `src/lib/vitrines/reserved-sync.test.ts`

**Interfaces:**
- Produces (SQL):
  - tabelas `vitrines`, `whatsapp_contacts`, `categories`
  - `public.is_reserved_subdomain(text) returns boolean` (imutável, usada no `check`)
  - `public.create_vitrine(p_type, p_subdomain, p_name, p_theme, p_default_button_text, p_whatsapp_label, p_whatsapp_phone, p_categories text[]) returns uuid` (invoker, `authenticated`)
  - `public.is_subdomain_available(p_subdomain text, p_except_vitrine_id uuid default null) returns boolean` (`authenticated`)
  - erro `plan_limit:vitrines` com `hint` = limite

- [ ] **Step 1: Migração**

`supabase/migrations/20260918000100_vitrines.sql`:

```sql
-- Vitrines, contatos de WhatsApp e categorias (spec 4.2 e 4.8)

-- Sem revoke: função imutável, sem acesso a dados, usada em check constraint.
create function public.is_reserved_subdomain(p_value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  -- Manter igual a RESERVED_SUBDOMAINS em src/lib/hosts/subdomain.ts
  -- (conferido por src/lib/vitrines/reserved-sync.test.ts).
  select p_value = any (array[
    'www', 'app', 'painel', 'api', 'admin', 'suporte', 'blog', 'ajuda', 'status',
    'mail', 'email', 'smtp', 'static', 'cdn', 'assets', 'media', 'midia', 'img',
    'docs', 'dev', 'staging', 'teste', 'test', 'auth', 'login', 'entrar', 'cadastro',
    'conta', 'checkout', 'pagamento', 'billing', 'agenn', 'vitrine'
  ]);
$$;

create table public.vitrines (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null check (type in ('produtos', 'servicos', 'comida')),
  subdomain text not null unique
    constraint vitrines_subdomain_format check (
      char_length(subdomain) between 3 and 30
      and subdomain ~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$'
      and not public.is_reserved_subdomain(subdomain)
    ),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  description text not null default '' check (char_length(description) <= 300),
  logo_media_id uuid,
  brand_color text check (brand_color ~ '^#[0-9a-f]{6}$'),
  theme text not null default 'light' check (theme in ('light', 'dark')),
  banner_enabled boolean not null default false,
  banner_media_id uuid,
  show_prices boolean not null default true,
  show_media boolean not null default true,
  cart_enabled boolean not null default false,
  primary_whatsapp_id uuid,
  default_button_text text not null check (char_length(btrim(default_button_text)) between 1 and 30),
  cart_button_text text not null default 'Enviar pedido' check (char_length(btrim(cart_button_text)) between 1 and 30),
  status text not null default 'active' check (status in ('active', 'frozen')),
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index vitrines_owner_idx on public.vitrines (owner_id, position);

create trigger vitrines_set_updated_at
  before update on public.vitrines
  for each row execute function public.set_updated_at();

-- Trava do plano: quantidade de vitrines (spec 3 e 4.8)
create function public.enforce_vitrine_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max int;
begin
  perform pg_advisory_xact_lock(hashtextextended('vitrines:' || new.owner_id::text, 0));
  select p.max_vitrines into v_max
  from public.plans p
  where p.id = public.effective_plan_id(new.owner_id);

  if (select count(*) from public.vitrines v where v.owner_id = new.owner_id) >= v_max then
    raise exception 'plan_limit:vitrines' using errcode = 'P0001', hint = v_max::text;
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_vitrine_limit() from public, anon, authenticated;

create trigger vitrines_enforce_limit
  before insert on public.vitrines
  for each row execute function public.enforce_vitrine_limit();

create table public.whatsapp_contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  vitrine_id uuid not null references public.vitrines (id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 40),
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index whatsapp_contacts_vitrine_idx on public.whatsapp_contacts (vitrine_id, position);

create trigger whatsapp_contacts_set_updated_at
  before update on public.whatsapp_contacts
  for each row execute function public.set_updated_at();

alter table public.vitrines
  add constraint vitrines_primary_whatsapp_fk
  foreign key (primary_whatsapp_id) references public.whatsapp_contacts (id) on delete set null;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  vitrine_id uuid not null references public.vitrines (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index categories_vitrine_idx on public.categories (vitrine_id, position);

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

-- Criação atômica: vitrine + WhatsApp principal + categorias de exemplo.
-- security invoker: RLS, grants e a trava de plano valem normalmente.
create function public.create_vitrine(
  p_type text,
  p_subdomain text,
  p_name text,
  p_theme text,
  p_default_button_text text,
  p_whatsapp_label text,
  p_whatsapp_phone text,
  p_categories text[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_vitrine_id uuid;
  v_contact_id uuid;
  v_category text;
  v_position int := 0;
begin
  insert into public.vitrines (type, subdomain, name, theme, default_button_text, cart_enabled)
  values (p_type, p_subdomain, p_name, p_theme, p_default_button_text, p_type = 'comida')
  returning id into v_vitrine_id;

  insert into public.whatsapp_contacts (vitrine_id, label, phone_e164)
  values (v_vitrine_id, p_whatsapp_label, p_whatsapp_phone)
  returning id into v_contact_id;

  update public.vitrines set primary_whatsapp_id = v_contact_id where id = v_vitrine_id;

  foreach v_category in array coalesce(p_categories, '{}'::text[]) loop
    insert into public.categories (vitrine_id, name, position) values (v_vitrine_id, v_category, v_position);
    v_position := v_position + 1;
  end loop;

  return v_vitrine_id;
end;
$$;

revoke execute on function public.create_vitrine(text, text, text, text, text, text, text, text[]) from public, anon;
grant execute on function public.create_vitrine(text, text, text, text, text, text, text, text[]) to authenticated;

create function public.is_subdomain_available(p_subdomain text, p_except_vitrine_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from public.vitrines v
    where v.subdomain = lower(btrim(p_subdomain))
      and v.id is distinct from p_except_vitrine_id
  );
$$;

revoke execute on function public.is_subdomain_available(text, uuid) from public, anon;
grant execute on function public.is_subdomain_available(text, uuid) to authenticated;

-- RLS e privilégios
alter table public.vitrines enable row level security;
alter table public.whatsapp_contacts enable row level security;
alter table public.categories enable row level security;

revoke all on public.vitrines from anon, authenticated;
grant select, delete on public.vitrines to authenticated;
grant insert (type, subdomain, name, description, theme, show_prices, show_media, cart_enabled, default_button_text)
  on public.vitrines to authenticated;
grant update (subdomain, name, description, logo_media_id, brand_color, theme, banner_enabled, banner_media_id,
  show_prices, show_media, cart_enabled, primary_whatsapp_id, default_button_text, cart_button_text, position)
  on public.vitrines to authenticated;

create policy "dono lê as próprias vitrines" on public.vitrines
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "dono cria vitrines" on public.vitrines
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "dono altera as próprias vitrines" on public.vitrines
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "dono exclui as próprias vitrines" on public.vitrines
  for delete to authenticated using ((select auth.uid()) = owner_id);

revoke all on public.whatsapp_contacts from anon, authenticated;
grant select, delete on public.whatsapp_contacts to authenticated;
grant insert (vitrine_id, label, phone_e164, position) on public.whatsapp_contacts to authenticated;
grant update (label, phone_e164, position) on public.whatsapp_contacts to authenticated;

create policy "dono lê os próprios contatos" on public.whatsapp_contacts
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "dono cria contatos nas próprias vitrines" on public.whatsapp_contacts
  for insert to authenticated with check (
    (select auth.uid()) = owner_id
    and exists (select 1 from public.vitrines v where v.id = vitrine_id and v.owner_id = (select auth.uid()))
  );
create policy "dono altera os próprios contatos" on public.whatsapp_contacts
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "dono remove os próprios contatos" on public.whatsapp_contacts
  for delete to authenticated using ((select auth.uid()) = owner_id);

revoke all on public.categories from anon, authenticated;
grant select, delete on public.categories to authenticated;
grant insert (vitrine_id, name, position) on public.categories to authenticated;
grant update (name, position) on public.categories to authenticated;

create policy "dono lê as próprias categorias" on public.categories
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "dono cria categorias nas próprias vitrines" on public.categories
  for insert to authenticated with check (
    (select auth.uid()) = owner_id
    and exists (select 1 from public.vitrines v where v.id = vitrine_id and v.owner_id = (select auth.uid()))
  );
create policy "dono altera as próprias categorias" on public.categories
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "dono remove as próprias categorias" on public.categories
  for delete to authenticated using ((select auth.uid()) = owner_id);
```

- [ ] **Step 2: pgTAP**

`supabase/tests/database/05_vitrines.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'ana@vitrine.com'),
  ('00000000-0000-0000-0000-0000000000f2', 'bia@vitrine.com'),
  ('00000000-0000-0000-0000-0000000000f3', 'pro@vitrine.com');
insert into public.subscriptions (user_id, plan_id, status) values
  ('00000000-0000-0000-0000-0000000000f3', 'pro', 'active');

set local role authenticated;

-- Ana (gratuito)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);

select lives_ok(
  $$ select public.create_vitrine('produtos', 'loja-ana', 'Loja da Ana', 'light', 'Solicitar orçamento', 'Principal', '+5511987654321', array['Destaques', 'Novidades']) $$,
  'create_vitrine cria a vitrine'
);
select is(
  (select w.phone_e164 from public.vitrines v join public.whatsapp_contacts w on w.id = v.primary_whatsapp_id where v.subdomain = 'loja-ana'),
  '+5511987654321',
  'WhatsApp principal criado e ligado'
);
select is(
  (select array_agg(c.name order by c.position) from public.categories c join public.vitrines v on v.id = c.vitrine_id where v.subdomain = 'loja-ana'),
  array['Destaques', 'Novidades'],
  'categorias de exemplo na ordem'
);
select throws_ok(
  $$ select public.create_vitrine('servicos', 'ana-dois', 'Ana 2', 'light', 'Agendar', 'Principal', '+5511987654321', array[]::text[]) $$,
  'P0001', 'plan_limit:vitrines', 'gratuito não cria a segunda vitrine'
);
select throws_ok(
  $$ update public.vitrines set type = 'servicos' where subdomain = 'loja-ana' $$,
  '42501', null, 'tipo é imutável'
);
select throws_ok(
  $$ update public.vitrines set status = 'frozen' where subdomain = 'loja-ana' $$,
  '42501', null, 'status só pelo servidor'
);
select is(public.is_subdomain_available('LOJA-ANA'), false, 'subdomínio em uso fica indisponível');
select is(
  public.is_subdomain_available('loja-ana', (select id from public.vitrines where subdomain = 'loja-ana')),
  true,
  'o próprio subdomínio fica disponível para a vitrine dona'
);

-- Pro
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f3","role":"authenticated"}', true);
select lives_ok(
  $$ select public.create_vitrine('produtos', 'pro-um', 'Pro 1', 'dark', 'Solicitar orçamento', 'Principal', '+5511912345678', null) $$,
  'pro cria a primeira'
);
select lives_ok(
  $$ select public.create_vitrine('servicos', 'pro-dois', 'Pro 2', 'light', 'Agendar', 'Principal', '+5511912345678', null) $$,
  'pro cria a segunda'
);
select throws_ok(
  $$ select public.create_vitrine('produtos', 'Loja-Ana', 'Cópia', 'light', 'Solicitar orçamento', 'Principal', '+5511912345678', null) $$,
  '23514', null, 'subdomínio com maiúscula viola o formato'
);
select throws_ok(
  $$ select public.create_vitrine('produtos', 'admin', 'Admin', 'light', 'Solicitar orçamento', 'Principal', '+5511912345678', null) $$,
  '23514', null, 'subdomínio reservado é recusado'
);
select throws_ok(
  $$ select public.create_vitrine('produtos', 'loja-ana', 'Cópia', 'light', 'Solicitar orçamento', 'Principal', '+5511912345678', null) $$,
  '23505', null, 'subdomínio duplicado é recusado'
);

-- Bia não enxerga nem escreve na vitrine da Ana. O id é lido como postgres,
-- porque com as claims da Bia o select voltaria vazio.
reset role;
select set_config('test.ana_vitrine', (select id::text from public.vitrines where subdomain = 'loja-ana'), true);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f2","role":"authenticated"}', true);
select is((select count(*)::int from public.vitrines), 0, 'Bia não vê vitrines alheias');
select throws_ok(
  format(
    $$ insert into public.whatsapp_contacts (vitrine_id, label, phone_e164) values (%L, 'Invasor', '+5511900000000') $$,
    current_setting('test.ana_vitrine')
  ),
  '42501', null, 'Bia não cria contato na vitrine da Ana'
);

reset role;
set local role anon;
select throws_ok($$ select * from public.vitrines $$, '42501', null, 'visitante não lê vitrines direto');

select * from finish();
rollback;
```

- [ ] **Step 3: Teste de sincronia dos reservados**

`src/lib/vitrines/reserved-sync.test.ts`:

```ts
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
```

Run: `npm test -- src/lib/vitrines/reserved-sync.test.ts` → PASS.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260918000100_vitrines.sql supabase/tests/database/05_vitrines.test.sql src/lib/vitrines/reserved-sync.test.ts
git commit -m "feat(db): vitrines, contatos de WhatsApp, categorias e trava de vitrines por plano"
```

---

### Task 5: Itens, códigos, variações e mídias

**Files:**
- Create: `supabase/migrations/20260918000200_items_media.sql`, `supabase/tests/database/06_items_media.test.sql`

**Interfaces:**
- Produces (SQL):
  - tabelas `items`, `item_codes`, `item_code_counters`, `item_variations`, `media`
  - `public.peek_next_item_code() returns text` (`authenticated`)
  - `public.is_item_code_available(p_code text, p_item_id uuid default null) returns boolean` (`authenticated`)
  - erros `plan_limit:items` (`hint` = limite), `item_code_taken`, `item_deleted`, `invalid_reference:category|whatsapp|logo|banner`
  - `media`: só leitura para o dono; escrita só pelo servidor

- [ ] **Step 1: Migração**

`supabase/migrations/20260918000200_items_media.sql`:

```sql
-- Itens, códigos, variações e mídias (spec 4.3, 5.1 e 6.1)

create table public.items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  vitrine_id uuid not null references public.vitrines (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  code text not null check (code ~ '^[A-Z0-9]{1,6}$'),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text not null default '' check (char_length(description) <= 1000),
  price_type text not null default 'fixed' check (price_type in ('fixed', 'from', 'on_request')),
  price_cents int check (price_cents >= 0),
  promo_price_cents int check (promo_price_cents >= 0),
  duration_minutes int check (duration_minutes between 1 and 1440),
  tags text[] not null default '{}' check (cardinality(tags) <= 5),
  sold_out boolean not null default false,
  position int not null default 0,
  whatsapp_id uuid references public.whatsapp_contacts (id) on delete set null,
  button_text text check (char_length(btrim(button_text)) between 1 and 30),
  custom_message text check (char_length(custom_message) between 1 and 500),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint items_on_request_without_price check (
    price_type <> 'on_request' or (price_cents is null and promo_price_cents is null)
  ),
  constraint items_promo_below_price check (
    promo_price_cents is null or (price_cents is not null and promo_price_cents < price_cents)
  )
);

create index items_vitrine_idx on public.items (vitrine_id, category_id, position) where deleted_at is null;

create trigger items_set_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();

-- Códigos já usados pela conta. Nunca apagados: um código nunca é reaproveitado.
create table public.item_codes (
  owner_id uuid not null references auth.users (id) on delete cascade,
  code text not null check (code ~ '^[A-Z0-9]{1,6}$'),
  item_id uuid references public.items (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (owner_id, code)
);

create index item_codes_item_idx on public.item_codes (item_id);

create table public.item_code_counters (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  next_value int not null default 101
);

create function public.next_item_code(p_owner_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next int;
begin
  insert into public.item_code_counters (owner_id) values (p_owner_id) on conflict (owner_id) do nothing;
  select c.next_value into v_next from public.item_code_counters c where c.owner_id = p_owner_id for update;
  while exists (select 1 from public.item_codes ic where ic.owner_id = p_owner_id and ic.code = v_next::text) loop
    v_next := v_next + 1;
  end loop;
  update public.item_code_counters set next_value = v_next + 1 where owner_id = p_owner_id;
  return v_next::text;
end;
$$;

revoke execute on function public.next_item_code(uuid) from public, anon, authenticated;

create function public.items_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max int;
  v_count int;
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtextextended('items:' || new.vitrine_id::text, 0));
    select p.max_items_per_vitrine into v_max
    from public.plans p
    where p.id = public.effective_plan_id(new.owner_id);
    select count(*) into v_count
    from public.items i
    where i.vitrine_id = new.vitrine_id and i.deleted_at is null;
    if v_count >= v_max then
      raise exception 'plan_limit:items' using errcode = 'P0001', hint = v_max::text;
    end if;
    if new.code is null then
      new.code := public.next_item_code(new.owner_id);
    end if;
  elsif old.deleted_at is not null and new.deleted_at is null then
    raise exception 'item_deleted' using errcode = 'P0001';
  end if;

  new.code := upper(btrim(new.code));

  if new.category_id is not null and not exists (
    select 1 from public.categories c where c.id = new.category_id and c.vitrine_id = new.vitrine_id
  ) then
    raise exception 'invalid_reference:category' using errcode = 'P0001';
  end if;

  if new.whatsapp_id is not null and not exists (
    select 1 from public.whatsapp_contacts w where w.id = new.whatsapp_id and w.vitrine_id = new.vitrine_id
  ) then
    raise exception 'invalid_reference:whatsapp' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke execute on function public.items_before_write() from public, anon, authenticated;

create trigger items_before_write
  before insert or update on public.items
  for each row execute function public.items_before_write();

create function public.items_register_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.code = old.code then
    return null;
  end if;
  -- Voltar a um código que já foi deste mesmo item é permitido.
  if exists (
    select 1 from public.item_codes ic
    where ic.owner_id = new.owner_id and ic.code = new.code and ic.item_id = new.id
  ) then
    return null;
  end if;
  insert into public.item_codes (owner_id, code, item_id) values (new.owner_id, new.code, new.id);
  return null;
exception
  when unique_violation then
    raise exception 'item_code_taken' using errcode = 'P0001';
end;
$$;

revoke execute on function public.items_register_code() from public, anon, authenticated;

create trigger items_register_code
  after insert or update of code on public.items
  for each row execute function public.items_register_code();

create function public.peek_next_item_code()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_next int;
begin
  select coalesce((select c.next_value from public.item_code_counters c where c.owner_id = auth.uid()), 101)
  into v_next;
  while exists (select 1 from public.item_codes ic where ic.owner_id = auth.uid() and ic.code = v_next::text) loop
    v_next := v_next + 1;
  end loop;
  return v_next::text;
end;
$$;

revoke execute on function public.peek_next_item_code() from public, anon;
grant execute on function public.peek_next_item_code() to authenticated;

create function public.is_item_code_available(p_code text, p_item_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from public.item_codes ic
    where ic.owner_id = auth.uid()
      and ic.code = upper(btrim(p_code))
      and ic.item_id is distinct from p_item_id
  );
$$;

revoke execute on function public.is_item_code_available(text, uuid) from public, anon;
grant execute on function public.is_item_code_available(text, uuid) to authenticated;

create table public.item_variations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  price_cents int not null check (price_cents >= 0),
  promo_price_cents int check (promo_price_cents >= 0 and promo_price_cents < price_cents),
  sold_out boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index item_variations_item_idx on public.item_variations (item_id, position);

create trigger item_variations_set_updated_at
  before update on public.item_variations
  for each row execute function public.set_updated_at();

create table public.media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  vitrine_id uuid not null references public.vitrines (id) on delete cascade,
  item_id uuid references public.items (id) on delete cascade,
  role text not null check (role in ('cover', 'gallery', 'video', 'logo', 'banner')),
  kind text not null check (kind in ('image', 'video')),
  position int not null default 0,
  storage_paths jsonb,
  bunny_video_id text,
  duration_seconds int,
  aspect text check (aspect in ('9:16', '16:9')),
  width int,
  height int,
  bytes bigint,
  status text not null default 'ready' check (status in ('processing', 'ready', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_kind_for_role check (
    (role in ('cover', 'gallery', 'logo') and kind = 'image')
    or (role = 'video' and kind = 'video')
    or role = 'banner'
  ),
  constraint media_item_only_for_item_roles check (item_id is null or role in ('cover', 'gallery', 'video')),
  constraint media_image_has_paths check (kind <> 'image' or storage_paths is not null),
  constraint media_gallery_position check (role <> 'gallery' or position between 1 and 2)
);

create index media_vitrine_idx on public.media (vitrine_id);
create unique index media_one_cover_per_item on public.media (item_id) where role = 'cover' and item_id is not null;
create unique index media_gallery_slot_per_item on public.media (item_id, position) where role = 'gallery' and item_id is not null;
create unique index media_one_video_per_item on public.media (item_id) where role = 'video' and item_id is not null;

create trigger media_set_updated_at
  before update on public.media
  for each row execute function public.set_updated_at();

alter table public.vitrines
  add constraint vitrines_logo_media_fk foreign key (logo_media_id) references public.media (id) on delete set null,
  add constraint vitrines_banner_media_fk foreign key (banner_media_id) references public.media (id) on delete set null;

-- Referências da vitrine precisam ser da própria vitrine.
create function public.vitrines_check_refs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.primary_whatsapp_id is not null and not exists (
    select 1 from public.whatsapp_contacts w where w.id = new.primary_whatsapp_id and w.vitrine_id = new.id
  ) then
    raise exception 'invalid_reference:whatsapp' using errcode = 'P0001';
  end if;
  if new.logo_media_id is not null and not exists (
    select 1 from public.media m where m.id = new.logo_media_id and m.vitrine_id = new.id and m.role = 'logo'
  ) then
    raise exception 'invalid_reference:logo' using errcode = 'P0001';
  end if;
  if new.banner_media_id is not null and not exists (
    select 1 from public.media m where m.id = new.banner_media_id and m.vitrine_id = new.id and m.role = 'banner'
  ) then
    raise exception 'invalid_reference:banner' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function public.vitrines_check_refs() from public, anon, authenticated;

create trigger vitrines_check_refs
  before update on public.vitrines
  for each row execute function public.vitrines_check_refs();

-- RLS e privilégios
alter table public.items enable row level security;
alter table public.item_codes enable row level security;
alter table public.item_code_counters enable row level security;
alter table public.item_variations enable row level security;
alter table public.media enable row level security;

revoke all on public.items from anon, authenticated;
grant select on public.items to authenticated;
grant insert (vitrine_id, category_id, code, name, description, price_type, price_cents, promo_price_cents,
  duration_minutes, tags, sold_out, position, whatsapp_id, button_text, custom_message)
  on public.items to authenticated;
grant update (category_id, code, name, description, price_type, price_cents, promo_price_cents,
  duration_minutes, tags, sold_out, position, whatsapp_id, button_text, custom_message, deleted_at)
  on public.items to authenticated;

create policy "dono lê os próprios itens" on public.items
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "dono cria itens nas próprias vitrines" on public.items
  for insert to authenticated with check (
    (select auth.uid()) = owner_id
    and exists (select 1 from public.vitrines v where v.id = vitrine_id and v.owner_id = (select auth.uid()))
  );
create policy "dono altera os próprios itens" on public.items
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

revoke all on public.item_codes from anon, authenticated;
grant select on public.item_codes to authenticated;
create policy "dono lê os próprios códigos" on public.item_codes
  for select to authenticated using ((select auth.uid()) = owner_id);

revoke all on public.item_code_counters from anon, authenticated;

revoke all on public.item_variations from anon, authenticated;
grant select, delete on public.item_variations to authenticated;
grant insert (item_id, name, price_cents, promo_price_cents, sold_out, position) on public.item_variations to authenticated;
grant update (name, price_cents, promo_price_cents, sold_out, position) on public.item_variations to authenticated;

create policy "dono lê as próprias variações" on public.item_variations
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "dono cria variações nos próprios itens" on public.item_variations
  for insert to authenticated with check (
    (select auth.uid()) = owner_id
    and exists (
      select 1 from public.items i
      where i.id = item_id and i.owner_id = (select auth.uid()) and i.deleted_at is null
    )
  );
create policy "dono altera as próprias variações" on public.item_variations
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "dono remove as próprias variações" on public.item_variations
  for delete to authenticated using ((select auth.uid()) = owner_id);

revoke all on public.media from anon, authenticated;
grant select on public.media to authenticated;
create policy "dono lê as próprias mídias" on public.media
  for select to authenticated using ((select auth.uid()) = owner_id);
```

- [ ] **Step 2: pgTAP**

`supabase/tests/database/06_items_media.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000001a1', 'dono@itens.com'),
  ('00000000-0000-0000-0000-0000000001a2', 'outro@itens.com');

insert into public.vitrines (id, owner_id, type, subdomain, name, default_button_text) values
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000001a1', 'produtos', 'itens-dono', 'Dono', 'Solicitar orçamento'),
  ('00000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-0000000001a2', 'produtos', 'itens-outro', 'Outro', 'Solicitar orçamento');
insert into public.categories (id, owner_id, vitrine_id, name) values
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-00000000a001', 'Geral'),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-0000000001a2', '00000000-0000-0000-0000-00000000a002', 'Alheia');

-- O dono não escolhe o id do item (sem grant na coluna); este primeiro item, com id
-- fixo para os testes seguintes, é criado como postgres. Os triggers valem igual.
insert into public.items (id, owner_id, vitrine_id, category_id, name, price_cents)
values ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c001', 'Primeiro', 1000);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000001a1","role":"authenticated"}', true);
select is((select code from public.items where id = '00000000-0000-0000-0000-00000000e001'), '101', 'primeiro código automático é 101');

insert into public.items (vitrine_id, category_id, name, code) values
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c001', 'Personalizado', 'x1'),
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c001', 'Pula', '102');
select is((select code from public.items where name = 'Personalizado'), 'X1', 'código personalizado vira maiúsculo');

insert into public.items (vitrine_id, category_id, name) values
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c001', 'Automático');
select is((select code from public.items where name = 'Automático'), '103', 'automático pula código já usado');
select is(public.peek_next_item_code(), '104', 'peek mostra o próximo sem consumir');

select throws_ok(
  $$ insert into public.items (vitrine_id, category_id, name, code) values ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c001', 'Repetido', 'X1') $$,
  'P0001', 'item_code_taken', 'código repetido é recusado'
);

update public.items set code = 'NOVO' where id = '00000000-0000-0000-0000-00000000e001';
select throws_ok(
  $$ insert into public.items (vitrine_id, category_id, name, code) values ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c001', 'Reuso', '101') $$,
  'P0001', 'item_code_taken', 'código antigo nunca é reaproveitado'
);
select lives_ok(
  $$ update public.items set code = '101' where id = '00000000-0000-0000-0000-00000000e001' $$,
  'item pode voltar ao próprio código antigo'
);
select is(public.is_item_code_available('x1'), false, 'x1 indisponível');
select is(public.is_item_code_available('zz9'), true, 'zz9 disponível');
select is(public.is_item_code_available('NOVO', '00000000-0000-0000-0000-00000000e001'), true, 'código do próprio item conta como disponível');

select throws_ok(
  $$ insert into public.items (vitrine_id, category_id, name) values ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c002', 'Categoria alheia') $$,
  'P0001', 'invalid_reference:category', 'categoria de outra vitrine é recusada'
);

-- Limite do gratuito: já há 4 itens; completa 10.
insert into public.items (vitrine_id, category_id, name)
select '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c001', 'Lote ' || g from generate_series(1, 6) g;
select throws_ok(
  $$ insert into public.items (vitrine_id, category_id, name) values ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c001', 'Décimo primeiro') $$,
  'P0001', 'plan_limit:items', 'gratuito não passa de 10 itens'
);

update public.items set deleted_at = now() where name = 'Lote 1';
select lives_ok(
  $$ insert into public.items (vitrine_id, category_id, name) values ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c001', 'Depois de apagar') $$,
  'item apagado não conta no limite'
);
select throws_ok(
  $$ update public.items set deleted_at = null where name = 'Lote 1' $$,
  'P0001', 'item_deleted', 'item apagado não volta'
);

select throws_ok(
  $$ insert into public.media (owner_id, vitrine_id, role, kind, storage_paths) values ('00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-00000000a001', 'logo', 'image', '{}') $$,
  '42501', null, 'dono não grava mídia direto'
);

-- Outro usuário
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000001a2","role":"authenticated"}', true);
select is((select count(*)::int from public.items), 0, 'outro usuário não vê itens alheios');
select throws_ok(
  $$ insert into public.item_variations (item_id, name, price_cents) values ('00000000-0000-0000-0000-00000000e001', 'Invasora', 100) $$,
  '42501', null, 'outro usuário não cria variação em item alheio'
);

-- Mídias (servidor)
reset role;
insert into public.media (id, owner_id, vitrine_id, item_id, role, kind, storage_paths) values
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000e001', 'cover', 'image', '{"480":"a","1080":"b"}'),
  ('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-00000000a001', null, 'logo', 'image', '{"128":"a","512":"b"}'),
  ('00000000-0000-0000-0000-00000000d003', '00000000-0000-0000-0000-0000000001a2', '00000000-0000-0000-0000-00000000a002', null, 'logo', 'image', '{"128":"a","512":"b"}');

select throws_ok(
  $$ insert into public.media (owner_id, vitrine_id, item_id, role, kind, storage_paths) values ('00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000e001', 'cover', 'image', '{}') $$,
  '23505', null, 'uma capa por item'
);
select throws_ok(
  $$ insert into public.media (owner_id, vitrine_id, item_id, role, kind, position, storage_paths) values ('00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000e001', 'gallery', 'image', 3, '{}') $$,
  '23514', null, 'no máximo duas imagens de galeria'
);
select throws_ok(
  $$ update public.vitrines set logo_media_id = '00000000-0000-0000-0000-00000000d003' where id = '00000000-0000-0000-0000-00000000a001' $$,
  'P0001', 'invalid_reference:logo', 'logo de outra vitrine é recusado'
);

update public.vitrines set logo_media_id = '00000000-0000-0000-0000-00000000d002' where id = '00000000-0000-0000-0000-00000000a001';
delete from public.vitrines where id = '00000000-0000-0000-0000-00000000a001';
select is(
  (select count(*)::int from public.item_codes where owner_id = '00000000-0000-0000-0000-0000000001a1' and item_id is null),
  (select count(*)::int from public.item_codes where owner_id = '00000000-0000-0000-0000-0000000001a1'),
  'excluir a vitrine mantém os códigos, sem item'
);

select * from finish();
rollback;
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260918000200_items_media.sql supabase/tests/database/06_items_media.test.sql
git commit -m "feat(db): itens, códigos por conta, variações, mídias e trava de itens por plano"
```

---

### Task 6: Pedidos e limite de requisições

**Files:**
- Create: `supabase/migrations/20260918000300_orders.sql`, `supabase/tests/database/07_orders.test.sql`

**Interfaces:**
- Produces (SQL):
  - tabelas `order_snapshots` (dono lê), `rate_limits` (sem acesso)
  - `public.insert_order_snapshot(p_vitrine_id uuid, p_code text, p_payload jsonb) returns boolean` (`service_role`; `false` = código em uso, tente outro)
  - `public.hit_rate_limit(p_key text, p_limit int, p_window_seconds int) returns boolean` (`service_role`; `true` = permitido)

- [ ] **Step 1: Migração**

`supabase/migrations/20260918000300_orders.sql`:

```sql
-- Códigos de pedido (spec 4.5 e 5.2) e limite de requisições

create table public.order_snapshots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  vitrine_id uuid not null references public.vitrines (id) on delete cascade,
  code text not null check (code ~ '^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '90 days',
  unique (owner_id, code)
);

create index order_snapshots_expires_idx on public.order_snapshots (expires_at);

-- Grava o pedido. Um código só é reaproveitado depois de expirar.
create function public.insert_order_snapshot(p_vitrine_id uuid, p_code text, p_payload jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
begin
  select v.owner_id into v_owner_id
  from public.vitrines v
  where v.id = p_vitrine_id and v.status = 'active';
  if v_owner_id is null then
    raise exception 'vitrine_not_found' using errcode = 'P0001';
  end if;

  delete from public.order_snapshots o
  where o.owner_id = v_owner_id and o.code = p_code and o.expires_at <= now();

  insert into public.order_snapshots (owner_id, vitrine_id, code, payload)
  values (v_owner_id, p_vitrine_id, p_code, p_payload);
  return true;
exception
  when unique_violation then
    return false;
end;
$$;

revoke execute on function public.insert_order_snapshot(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.insert_order_snapshot(uuid, text, jsonb) to service_role;

create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, window_start)
);

-- Janela fixa: conta e responde se ainda está dentro do limite.
create function public.hit_rate_limit(p_key text, p_limit int, p_window_seconds int)
returns boolean
language sql
security definer
set search_path = ''
as $$
  insert into public.rate_limits as r (key, window_start, count)
  values (
    p_key,
    to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds),
    1
  )
  on conflict (key, window_start) do update set count = r.count + 1
  returning count <= p_limit;
$$;

revoke execute on function public.hit_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, int, int) to service_role;

alter table public.order_snapshots enable row level security;
alter table public.rate_limits enable row level security;

revoke all on public.order_snapshots from anon, authenticated;
grant select on public.order_snapshots to authenticated;
create policy "dono lê os próprios pedidos" on public.order_snapshots
  for select to authenticated using ((select auth.uid()) = owner_id);

revoke all on public.rate_limits from anon, authenticated;
```

- [ ] **Step 2: pgTAP**

`supabase/tests/database/07_orders.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000002b1', 'dono@pedidos.com'),
  ('00000000-0000-0000-0000-0000000002b2', 'outro@pedidos.com');
insert into public.vitrines (id, owner_id, type, subdomain, name, default_button_text) values
  ('00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-0000000002b1', 'produtos', 'pedidos-dono', 'Dono', 'Solicitar orçamento');

set local role service_role;

select is(public.insert_order_snapshot('00000000-0000-0000-0000-00000000b001', 'K7F2', '{"items":[]}'), true, 'grava o pedido');
select is(public.insert_order_snapshot('00000000-0000-0000-0000-00000000b001', 'K7F2', '{"items":[]}'), false, 'código em uso devolve false');

reset role;
update public.order_snapshots set expires_at = now() - interval '1 day' where code = 'K7F2';
set local role service_role;
select is(public.insert_order_snapshot('00000000-0000-0000-0000-00000000b001', 'K7F2', '{"items":[]}'), true, 'código expirado é reaproveitado');

select throws_ok(
  $$ select public.insert_order_snapshot('00000000-0000-0000-0000-00000000b001', 'K0F2', '{"items":[]}') $$,
  '23514', null, 'código com caractere ambíguo é recusado'
);

select is(public.hit_rate_limit('ip:teste', 2, 3600), true, '1ª requisição');
select is(public.hit_rate_limit('ip:teste', 2, 3600), true, '2ª requisição');
select is(public.hit_rate_limit('ip:teste', 2, 3600), false, '3ª passa do limite');

reset role;
update public.vitrines set status = 'frozen' where id = '00000000-0000-0000-0000-00000000b001';
set local role service_role;
select throws_ok(
  $$ select public.insert_order_snapshot('00000000-0000-0000-0000-00000000b001', 'AB23', '{"items":[]}') $$,
  'P0001', 'vitrine_not_found', 'vitrine congelada não recebe pedidos'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000002b1","role":"authenticated"}', true);
select is((select count(*)::int from public.order_snapshots), 1, 'dono lê os próprios pedidos');
select throws_ok(
  $$ select public.insert_order_snapshot('00000000-0000-0000-0000-00000000b001', 'CD34', '{}') $$,
  '42501', null, 'usuário não grava pedido direto'
);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000002b2","role":"authenticated"}', true);
select is((select count(*)::int from public.order_snapshots), 0, 'outro usuário não lê os pedidos');

select * from finish();
rollback;
```

- [ ] **Step 3: Rotina de migração do bloco**

```bash
git add supabase/migrations/20260918000300_orders.sql supabase/tests/database/07_orders.test.sql
git commit -m "feat(db): códigos de pedido e limite de requisições"
git push -u origin HEAD
gh pr create --fill --base master
gh pr checks --watch
```

Expected: `db` com 05, 06 e 07 ok e falha só em "Tipos commitados estão atualizados". Baixar e commitar os tipos (Rotina de migração, passos 3 e 4). Se algum `throws_ok` falhar por código de erro diferente do esperado (por exemplo, a mensagem vir com prefixo), corrija o **teste** apenas se o comportamento estiver certo; se o comportamento estiver errado, corrija a migração nesta branch (ela ainda não chegou à `master`).

**Fim do Bloco 2:** autorização → merge. Conferência na nuvem: job `migrate` aplica as três migrações. No painel do Supabase dev, **Table Editor** mostra `vitrines`, `items`, `media`, `order_snapshots` com RLS ligado, e **Database → Functions** lista `create_vitrine`, `session_state`, `insert_order_snapshot`.

---

# Bloco 3 — Regras puras

Branch: `fase-2/bloco-3-regras`. Só Vitest; nada de interface. Instalar a dependência do bloco:

```bash
npm install libphonenumber-js
```

### Task 7: Dinheiro e preço

**Files:**
- Create: `src/lib/money/money.ts`, `src/lib/money/money.test.ts`, `src/lib/pricing/price.ts`, `src/lib/pricing/price.test.ts`

**Interfaces:**
- Produces:
  - `formatBRL(cents: number): string`
  - `parseBRLToCents(input: string): number | null`
  - `centsToInput(cents: number | null): string`
  - `type PriceType = 'fixed' | 'from' | 'on_request'`
  - `type PricedItem = { priceType: PriceType; priceCents: number | null; promoPriceCents: number | null }`
  - `type PricedVariation = { priceCents: number; promoPriceCents: number | null }`
  - `unitPriceCents(item: PricedItem, variation?: PricedVariation | null): number | null`
  - `lineTotalCents(unitCents: number | null, qty: number, addonsCents?: number): number | null`
  - `orderTotal(lineTotals: ReadonlyArray<number | null>): { totalCents: number; hasOnRequest: boolean }`
  - `type PriceLabel = { kind: 'on_request' } | { kind: 'price'; fromPrefix: boolean; cents: number; originalCents: number | null }`
  - `priceLabel(item: PricedItem, variations?: ReadonlyArray<PricedVariation>): PriceLabel`
  - `formatPriceLabel(label: PriceLabel): string`
  - `formatOrderTotal(total: { totalCents: number; hasOnRequest: boolean }): string`

- [ ] **Step 1: Testes (falhando)**

`src/lib/money/money.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { centsToInput, formatBRL, parseBRLToCents } from './money'

describe('formatBRL', () => {
  it('formata centavos em reais', () => {
    expect(formatBRL(1290)).toBe('R$ 12,90')
    expect(formatBRL(123456)).toBe('R$ 1.234,56')
    expect(formatBRL(0)).toBe('R$ 0,00')
  })
})

describe('parseBRLToCents', () => {
  it('aceita os formatos comuns', () => {
    expect(parseBRLToCents('12,90')).toBe(1290)
    expect(parseBRLToCents('12')).toBe(1200)
    expect(parseBRLToCents('12,9')).toBe(1290)
    expect(parseBRLToCents('1.234,56')).toBe(123456)
    expect(parseBRLToCents('R$ 7,05')).toBe(705)
    expect(parseBRLToCents(' 0,99 ')).toBe(99)
  })

  it('recusa o que não é valor', () => {
    for (const bad of ['', 'abc', '-1', '12.9', '12,999', '1,2,3', '999999999']) {
      expect(parseBRLToCents(bad)).toBeNull()
    }
  })
})

describe('centsToInput', () => {
  it('volta para o formato do campo', () => {
    expect(centsToInput(1290)).toBe('12,90')
    expect(centsToInput(123456)).toBe('1234,56')
    expect(centsToInput(null)).toBe('')
  })
})
```

`src/lib/pricing/price.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { formatOrderTotal, formatPriceLabel, lineTotalCents, orderTotal, priceLabel, unitPriceCents } from './price'

const fixed = { priceType: 'fixed' as const, priceCents: 2000, promoPriceCents: null }
const promo = { priceType: 'fixed' as const, priceCents: 2000, promoPriceCents: 1500 }
const onRequest = { priceType: 'on_request' as const, priceCents: null, promoPriceCents: null }

describe('unitPriceCents (4.6.1)', () => {
  it('usa o preço do item e a promoção quando houver', () => {
    expect(unitPriceCents(fixed)).toBe(2000)
    expect(unitPriceCents(promo)).toBe(1500)
  })

  it('variação substitui o preço do item', () => {
    expect(unitPriceCents(promo, { priceCents: 3000, promoPriceCents: null })).toBe(3000)
    expect(unitPriceCents(fixed, { priceCents: 3000, promoPriceCents: 2500 })).toBe(2500)
  })

  it('sob consulta não tem preço', () => {
    expect(unitPriceCents(onRequest)).toBeNull()
    expect(unitPriceCents(onRequest, { priceCents: 3000, promoPriceCents: null })).toBeNull()
  })
})

describe('totais (4.6.4 e 4.6.5)', () => {
  it('linha multiplica pela quantidade', () => {
    expect(lineTotalCents(1500, 3)).toBe(4500)
    expect(lineTotalCents(1500, 2, 250)).toBe(3500)
    expect(lineTotalCents(null, 2)).toBeNull()
  })

  it('pedido soma e marca itens sob consulta', () => {
    expect(orderTotal([4500, null, 1000])).toEqual({ totalCents: 5500, hasOnRequest: true })
    expect(orderTotal([4500])).toEqual({ totalCents: 4500, hasOnRequest: false })
    expect(formatOrderTotal({ totalCents: 5500, hasOnRequest: true })).toBe('R$ 55,00 + itens sob consulta')
    expect(formatOrderTotal({ totalCents: 0, hasOnRequest: true })).toBe('Itens sob consulta')
  })
})

describe('priceLabel', () => {
  it('fixo, promoção e a partir de', () => {
    expect(priceLabel(fixed)).toEqual({ kind: 'price', fromPrefix: false, cents: 2000, originalCents: null })
    expect(priceLabel(promo)).toEqual({ kind: 'price', fromPrefix: false, cents: 1500, originalCents: 2000 })
    expect(formatPriceLabel(priceLabel({ ...fixed, priceType: 'from' }))).toBe('A partir de R$ 20,00')
  })

  it('sob consulta', () => {
    expect(formatPriceLabel(priceLabel(onRequest))).toBe('Sob consulta')
  })

  it('variações com preços diferentes mostram o menor com "A partir de"', () => {
    const label = priceLabel(fixed, [
      { priceCents: 3000, promoPriceCents: null },
      { priceCents: 2500, promoPriceCents: 2200 },
    ])
    expect(label).toEqual({ kind: 'price', fromPrefix: true, cents: 2200, originalCents: null })
  })

  it('variações com o mesmo preço mostram o preço sem prefixo', () => {
    const label = priceLabel(fixed, [
      { priceCents: 3000, promoPriceCents: 2500 },
      { priceCents: 2500, promoPriceCents: null },
    ])
    expect(label).toEqual({ kind: 'price', fromPrefix: false, cents: 2500, originalCents: null })
  })
})
```

Run: `npm test -- src/lib/money src/lib/pricing` → FAIL.

- [ ] **Step 2: Implementação**

`src/lib/money/money.ts`:

```ts
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const MAX_CENTS = 99_999_999

export function formatBRL(cents: number): string {
  return BRL.format(cents / 100)
}

const WITH_THOUSANDS = /^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/
const PLAIN = /^\d+(?:,\d{1,2})?$/

export function parseBRLToCents(input: string): number | null {
  const cleaned = input.replace(/R\$/i, '').replace(/\s/g, '')
  if (!WITH_THOUSANDS.test(cleaned) && !PLAIN.test(cleaned)) return null
  const [whole, fraction = ''] = cleaned.replace(/\./g, '').split(',')
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(cents) && cents <= MAX_CENTS ? cents : null
}

export function centsToInput(cents: number | null): string {
  if (cents == null) return ''
  return `${Math.trunc(cents / 100)},${String(cents % 100).padStart(2, '0')}`
}
```

`src/lib/pricing/price.ts`:

```ts
import { formatBRL } from '@/lib/money/money'

export type PriceType = 'fixed' | 'from' | 'on_request'
export type PricedItem = { priceType: PriceType; priceCents: number | null; promoPriceCents: number | null }
export type PricedVariation = { priceCents: number; promoPriceCents: number | null }

// Regra 4.6.1: variação substitui o item; promoção vale quando existe.
export function unitPriceCents(item: PricedItem, variation?: PricedVariation | null): number | null {
  if (item.priceType === 'on_request') return null
  const source = variation ?? item
  if (source.priceCents == null) return null
  return source.promoPriceCents ?? source.priceCents
}

// Regra 4.6.4. `addonsCents` fica 0 até a Fase 4 (complementos).
export function lineTotalCents(unitCents: number | null, qty: number, addonsCents = 0): number | null {
  if (unitCents == null) return null
  return (unitCents + addonsCents) * qty
}

// Regra 4.6.5: itens sob consulta ficam fora da soma.
export function orderTotal(lineTotals: ReadonlyArray<number | null>) {
  let totalCents = 0
  let hasOnRequest = false
  for (const line of lineTotals) {
    if (line == null) hasOnRequest = true
    else totalCents += line
  }
  return { totalCents, hasOnRequest }
}

export function formatOrderTotal(total: { totalCents: number; hasOnRequest: boolean }): string {
  if (total.totalCents === 0 && total.hasOnRequest) return 'Itens sob consulta'
  const value = formatBRL(total.totalCents)
  return total.hasOnRequest ? `${value} + itens sob consulta` : value
}

export type PriceLabel =
  | { kind: 'on_request' }
  | { kind: 'price'; fromPrefix: boolean; cents: number; originalCents: number | null }

export function priceLabel(item: PricedItem, variations: ReadonlyArray<PricedVariation> = []): PriceLabel {
  if (item.priceType === 'on_request') return { kind: 'on_request' }

  if (variations.length > 0) {
    const effective = variations.map((variation) => variation.promoPriceCents ?? variation.priceCents)
    const min = Math.min(...effective)
    const allEqual = effective.every((cents) => cents === min)
    return { kind: 'price', fromPrefix: !allEqual || item.priceType === 'from', cents: min, originalCents: null }
  }

  if (item.priceCents == null) return { kind: 'on_request' }
  return {
    kind: 'price',
    fromPrefix: item.priceType === 'from',
    cents: item.promoPriceCents ?? item.priceCents,
    originalCents: item.promoPriceCents != null ? item.priceCents : null,
  }
}

export function formatPriceLabel(label: PriceLabel): string {
  if (label.kind === 'on_request') return 'Sob consulta'
  const value = formatBRL(label.cents)
  return label.fromPrefix ? `A partir de ${value}` : value
}
```

Run: `npm test -- src/lib/money src/lib/pricing` → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/money src/lib/pricing package.json package-lock.json
git commit -m "feat(preco): formatação em reais e regras de preço sem complementos"
```

---

### Task 8: Códigos de item e de pedido

**Files:**
- Create: `src/lib/codes/item-code.ts`, `src/lib/codes/item-code.test.ts`, `src/lib/codes/order-code.ts`, `src/lib/codes/order-code.test.ts`

**Interfaces:**
- Produces:
  - `normalizeItemCode(input: string): string`
  - `validateItemCode(input: string): { ok: true; value: string } | { ok: false; reason: 'empty' | 'format' }`
  - `ITEM_CODE_MESSAGES: Record<'empty' | 'format' | 'taken', string>`
  - `ORDER_CODE_ALPHABET: string`
  - `generateOrderCode(randomBytes?: (size: number) => Uint8Array): string`
  - `normalizeOrderCode(input: string): string`
  - `isValidOrderCode(value: string): boolean`

- [ ] **Step 1: Testes (falhando)**

`src/lib/codes/item-code.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { normalizeItemCode, validateItemCode } from './item-code'

describe('código do item', () => {
  it('normaliza: maiúsculas, sem espaços e sem acentos', () => {
    expect(normalizeItemCode(' ab 1 ')).toBe('AB1')
    expect(normalizeItemCode('pão')).toBe('PAO')
    expect(normalizeItemCode('Açaí2')).toBe('ACAI2')
  })

  it('valida de 1 a 6 letras ou números', () => {
    expect(validateItemCode('x1')).toEqual({ ok: true, value: 'X1' })
    expect(validateItemCode('104')).toEqual({ ok: true, value: '104' })
    expect(validateItemCode('   ')).toEqual({ ok: false, reason: 'empty' })
    expect(validateItemCode('ABCDEFG')).toEqual({ ok: false, reason: 'format' })
    expect(validateItemCode('A-1')).toEqual({ ok: false, reason: 'format' })
  })
})
```

`src/lib/codes/order-code.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { generateOrderCode, isValidOrderCode, normalizeOrderCode, ORDER_CODE_ALPHABET } from './order-code'

describe('código do pedido', () => {
  it('alfabeto sem caracteres ambíguos', () => {
    expect(ORDER_CODE_ALPHABET).toHaveLength(32)
    for (const ambiguous of ['0', '1', 'I', 'O']) expect(ORDER_CODE_ALPHABET).not.toContain(ambiguous)
  })

  it('gera 4 caracteres do alfabeto a partir dos bytes', () => {
    expect(generateOrderCode(() => new Uint8Array([0, 31, 32, 255]))).toBe('2Z2Z')
    for (let i = 0; i < 200; i++) expect(isValidOrderCode(generateOrderCode())).toBe(true)
  })

  it('normaliza o que o dono digita', () => {
    expect(normalizeOrderCode(' #k7f2 ')).toBe('K7F2')
    expect(isValidOrderCode('K7F2')).toBe(true)
    expect(isValidOrderCode('K0F2')).toBe(false)
    expect(isValidOrderCode('K7F')).toBe(false)
  })
})
```

Run: `npm test -- src/lib/codes` → FAIL.

- [ ] **Step 2: Implementação**

`src/lib/codes/item-code.ts`:

```ts
const ITEM_CODE_PATTERN = /^[A-Z0-9]{1,6}$/

export const ITEM_CODE_MESSAGES = {
  empty: 'Informe um código.',
  format: 'Use até 6 letras ou números.',
  taken: 'Este código já foi usado na sua conta. Escolha outro.',
} as const

export function normalizeItemCode(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '')
    .toUpperCase()
}

export function validateItemCode(input: string): { ok: true; value: string } | { ok: false; reason: 'empty' | 'format' } {
  const value = normalizeItemCode(input)
  if (!value) return { ok: false, reason: 'empty' }
  if (!ITEM_CODE_PATTERN.test(value)) return { ok: false, reason: 'format' }
  return { ok: true, value }
}
```

`src/lib/codes/order-code.ts`:

```ts
export const ORDER_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

const ORDER_CODE_PATTERN = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/

const cryptoBytes = (size: number) => crypto.getRandomValues(new Uint8Array(size))

// 256 é múltiplo de 32: `byte % 32` não favorece nenhum caractere.
export function generateOrderCode(randomBytes: (size: number) => Uint8Array = cryptoBytes): string {
  return Array.from(randomBytes(4), (byte) => ORDER_CODE_ALPHABET[byte % 32]).join('')
}

export function normalizeOrderCode(input: string): string {
  return input.replace(/[#\s]/g, '').toUpperCase()
}

export function isValidOrderCode(value: string): boolean {
  return ORDER_CODE_PATTERN.test(value)
}
```

Run: `npm test -- src/lib/codes` → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/codes
git commit -m "feat(codigos): normalização do código do item e geração do código do pedido"
```

---

### Task 9: Telefone e mensagens do WhatsApp

**Files:**
- Create: `src/lib/vitrines/vitrine-types.ts`, `src/lib/vitrines/vitrine-types.test.ts`, `src/lib/whatsapp/phone.ts`, `src/lib/whatsapp/phone.test.ts`, `src/lib/whatsapp/messages.ts`, `src/lib/whatsapp/messages.test.ts`

**Interfaces:**
- Produces:
  - `VITRINE_TYPES`, `type VitrineType`, `WIZARD_VITRINE_TYPES`, `VITRINE_TYPE_LABEL`, `DEFAULT_BUTTON_TEXT`, `SAMPLE_CATEGORIES`
  - `normalizePhone(input: string): string | null` (E.164, padrão Brasil)
  - `formatPhone(e164: string): string`
  - `MESSAGE_VARIABLES: readonly string[]`
  - `type DirectMessageInput = { vitrineType: VitrineType; vitrineName: string; itemName: string; itemCode: string; variationName: string | null; orderCode: string | null; customTemplate: string | null; addonLines?: string[] }`
  - `buildDirectMessage(input: DirectMessageInput): string`
  - `buildWhatsAppUrl(phoneE164: string, text: string): string`

- [ ] **Step 1: Testes (falhando)**

`src/lib/vitrines/vitrine-types.test.ts`:

```ts
import { expect, it } from 'vitest'
import { DEFAULT_BUTTON_TEXT, SAMPLE_CATEGORIES, VITRINE_TYPES, WIZARD_VITRINE_TYPES } from './vitrine-types'

it('padrões por tipo de vitrine', () => {
  expect(VITRINE_TYPES).toEqual(['produtos', 'servicos', 'comida'])
  expect(WIZARD_VITRINE_TYPES).toEqual(['produtos', 'servicos'])
  expect(DEFAULT_BUTTON_TEXT).toEqual({ produtos: 'Solicitar orçamento', servicos: 'Agendar', comida: 'Pedir' })
  expect(SAMPLE_CATEGORIES.produtos).toEqual(['Destaques', 'Novidades'])
  expect(SAMPLE_CATEGORIES.servicos).toEqual(['Serviços', 'Pacotes'])
})
```

`src/lib/whatsapp/phone.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { formatPhone, normalizePhone } from './phone'

describe('normalizePhone', () => {
  it('assume Brasil quando não há código do país', () => {
    expect(normalizePhone('(11) 98765-4321')).toBe('+5511987654321')
    expect(normalizePhone('11987654321')).toBe('+5511987654321')
    expect(normalizePhone('+55 11 98765-4321')).toBe('+5511987654321')
  })

  it('aceita outros países com +', () => {
    expect(normalizePhone('+351 912 345 678')).toBe('+351912345678')
  })

  it('recusa números inválidos', () => {
    for (const bad of ['', '1234', '(11) 1234', 'abc']) expect(normalizePhone(bad)).toBeNull()
  })
})

it('formatPhone mostra o número legível', () => {
  expect(formatPhone('+5511987654321')).toBe('+55 11 98765 4321')
})
```

`src/lib/whatsapp/messages.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildDirectMessage, buildWhatsAppUrl } from './messages'

const base = {
  vitrineName: 'Loja da Ana',
  itemName: 'Camiseta',
  itemCode: '104',
  variationName: null,
  orderCode: 'K7F2',
  customTemplate: null,
}

describe('mensagem automática do botão direto (7.5)', () => {
  it('Produtos', () => {
    expect(buildDirectMessage({ ...base, vitrineType: 'produtos' })).toBe(
      'Olá! Vim da vitrine *Loja da Ana* e tenho interesse em: *Camiseta* (cód. 104). Pedido #K7F2',
    )
  })

  it('Serviços com variação', () => {
    expect(
      buildDirectMessage({ ...base, vitrineType: 'servicos', itemName: 'Manicure', variationName: 'Pé e mão' }),
    ).toBe('Olá! Vim da vitrine *Loja da Ana* e gostaria de agendar: *Manicure – Pé e mão* (cód. 104). Pedido #K7F2')
  })

  it('sem código de pedido (falha ao criar)', () => {
    expect(buildDirectMessage({ ...base, vitrineType: 'produtos', orderCode: null })).toBe(
      'Olá! Vim da vitrine *Loja da Ana* e tenho interesse em: *Camiseta* (cód. 104).',
    )
  })

  it('linhas de complementos vão ao final', () => {
    expect(
      buildDirectMessage({ ...base, vitrineType: 'comida', addonLines: ['   • Ponto: Ao ponto'] }),
    ).toBe('Olá! Vim da vitrine *Loja da Ana* e tenho interesse em: *Camiseta* (cód. 104). Pedido #K7F2\n\n   • Ponto: Ao ponto')
  })
})

describe('mensagem personalizada', () => {
  it('substitui as variáveis', () => {
    expect(
      buildDirectMessage({
        ...base,
        vitrineType: 'produtos',
        variationName: 'G',
        customTemplate: 'Quero {item} ({variacao}) cód {codigo} da {vitrine}. #{pedido}',
      }),
    ).toBe('Quero Camiseta (G) cód 104 da Loja da Ana. #K7F2')
  })

  it('variáveis sem valor ficam vazias', () => {
    expect(
      buildDirectMessage({ ...base, vitrineType: 'produtos', orderCode: null, customTemplate: 'Oi {item} {variacao} #{pedido}' }),
    ).toBe('Oi Camiseta  #')
  })
})

it('link do WhatsApp com texto codificado', () => {
  expect(buildWhatsAppUrl('+5511987654321', 'Olá! *X* & Y')).toBe(
    'https://wa.me/5511987654321?text=Ol%C3%A1!%20*X*%20%26%20Y',
  )
})
```

Run: `npm test -- src/lib/vitrines/vitrine-types.test.ts src/lib/whatsapp` → FAIL.

- [ ] **Step 2: Implementação**

`src/lib/vitrines/vitrine-types.ts`:

```ts
export const VITRINE_TYPES = ['produtos', 'servicos', 'comida'] as const
export type VitrineType = (typeof VITRINE_TYPES)[number]

// Comida entra no assistente na Fase 4, junto com complementos e sacola.
export const WIZARD_VITRINE_TYPES = ['produtos', 'servicos'] as const satisfies readonly VitrineType[]

export const VITRINE_TYPE_LABEL: Record<VitrineType, string> = {
  produtos: 'Produtos',
  servicos: 'Serviços',
  comida: 'Comida',
}

export const DEFAULT_BUTTON_TEXT: Record<VitrineType, string> = {
  produtos: 'Solicitar orçamento',
  servicos: 'Agendar',
  comida: 'Pedir',
}

export const SAMPLE_CATEGORIES: Record<VitrineType, readonly string[]> = {
  produtos: ['Destaques', 'Novidades'],
  servicos: ['Serviços', 'Pacotes'],
  comida: ['Lanches', 'Bebidas'],
}
```

`src/lib/whatsapp/phone.ts`:

```ts
import { parsePhoneNumberFromString } from 'libphonenumber-js/min'

export function normalizePhone(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const phone = parsePhoneNumberFromString(trimmed, 'BR')
  return phone?.isValid() ? phone.number : null
}

export function formatPhone(e164: string): string {
  return parsePhoneNumberFromString(e164)?.formatInternational() ?? e164
}
```

Se `formatInternational()` separar os blocos de outro jeito (a biblioteca segue os metadados), ajuste só a string esperada no teste de `formatPhone`.

`src/lib/whatsapp/messages.ts`:

```ts
import type { VitrineType } from '@/lib/vitrines/vitrine-types'

export const MESSAGE_VARIABLES = ['{item}', '{codigo}', '{variacao}', '{vitrine}', '{pedido}'] as const

export type DirectMessageInput = {
  vitrineType: VitrineType
  vitrineName: string
  itemName: string
  itemCode: string
  variationName: string | null
  orderCode: string | null
  customTemplate: string | null
  addonLines?: string[]
}

function itemLabel(itemName: string, variationName: string | null) {
  return variationName ? `${itemName} – ${variationName}` : itemName
}

export function buildDirectMessage(input: DirectMessageInput): string {
  let text: string
  if (input.customTemplate?.trim()) {
    text = input.customTemplate
      .replaceAll('{item}', input.itemName)
      .replaceAll('{codigo}', input.itemCode)
      .replaceAll('{variacao}', input.variationName ?? '')
      .replaceAll('{vitrine}', input.vitrineName)
      .replaceAll('{pedido}', input.orderCode ?? '')
      .trim()
  } else {
    const intent = input.vitrineType === 'servicos' ? 'gostaria de agendar' : 'tenho interesse em'
    const order = input.orderCode ? ` Pedido #${input.orderCode}` : ''
    text = `Olá! Vim da vitrine *${input.vitrineName}* e ${intent}: *${itemLabel(input.itemName, input.variationName)}* (cód. ${input.itemCode}).${order}`
  }
  const addons = (input.addonLines ?? []).join('\n')
  return addons ? `${text}\n\n${addons}` : text
}

export function buildWhatsAppUrl(phoneE164: string, text: string): string {
  return `https://wa.me/${phoneE164.replace(/^\+/, '')}?text=${encodeURIComponent(text)}`
}
```

Run: `npm test -- src/lib/vitrines/vitrine-types.test.ts src/lib/whatsapp` → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/vitrines/vitrine-types.ts src/lib/vitrines/vitrine-types.test.ts src/lib/whatsapp
git commit -m "feat(whatsapp): telefone em E.164 e mensagens do botão direto"
```

---

### Task 10: Formulários, erros do banco e contraste

**Files:**
- Create: `src/lib/vitrines/schemas.ts`, `src/lib/vitrines/schemas.test.ts`, `src/lib/vitrines/db-errors.ts`, `src/lib/vitrines/db-errors.test.ts`, `src/lib/color/contrast.ts`, `src/lib/color/contrast.test.ts`

**Interfaces:**
- Produces:
  - `subdomainField` (Zod: normaliza e valida com mensagens em PT)
  - `createVitrineSchema`, `vitrineSettingsSchema`, `messagesSchema`, `appearanceSchema`, `contactSchema`, `categoryNameSchema`, `itemSchema`, `type ItemInput`
  - `mapDbError(error: { code?: string; message?: string; hint?: string } | null | undefined): string`
  - `isPlanLimitError(error): boolean`
  - `readableTextColor(hex: string): '#ffffff' | '#000000'`

- [ ] **Step 1: Testes (falhando)**

`src/lib/vitrines/db-errors.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isPlanLimitError, mapDbError } from './db-errors'

describe('mapDbError', () => {
  it('limites viram convite para o Pro', () => {
    expect(mapDbError({ code: 'P0001', message: 'plan_limit:vitrines', hint: '1' })).toBe(
      'Seu plano permite até 1 vitrine. Assine o Pro para criar mais.',
    )
    expect(mapDbError({ code: 'P0001', message: 'plan_limit:vitrines', hint: '3' })).toBe(
      'Seu plano permite até 3 vitrines. Assine o Pro para criar mais.',
    )
    expect(mapDbError({ code: 'P0001', message: 'plan_limit:items', hint: '10' })).toBe(
      'Seu plano permite até 10 itens por vitrine. Assine o Pro para cadastrar mais.',
    )
    expect(isPlanLimitError({ message: 'plan_limit:items' })).toBe(true)
    expect(isPlanLimitError({ message: 'item_code_taken' })).toBe(false)
  })

  it('erros conhecidos', () => {
    expect(mapDbError({ message: 'item_code_taken' })).toBe('Este código já foi usado na sua conta. Escolha outro.')
    expect(mapDbError({ code: '23505', message: 'duplicate key value violates unique constraint "vitrines_subdomain_key"' })).toBe(
      'Este endereço já está em uso. Escolha outro.',
    )
    expect(mapDbError({ message: 'invalid_reference:category' })).toBe(
      'Algum dado escolhido não pertence a esta vitrine. Recarregue a página.',
    )
  })

  it('o resto é genérico', () => {
    expect(mapDbError({ code: 'XX000', message: 'boom' })).toBe('Não foi possível salvar. Tente novamente.')
    expect(mapDbError(null)).toBe('Não foi possível salvar. Tente novamente.')
  })
})
```

`src/lib/color/contrast.test.ts`:

```ts
import { expect, it } from 'vitest'
import { readableTextColor } from './contrast'

it('escolhe branco ou preto pelo maior contraste (WCAG)', () => {
  expect(readableTextColor('#0b2a1c')).toBe('#ffffff')
  expect(readableTextColor('#000000')).toBe('#ffffff')
  expect(readableTextColor('#ffffff')).toBe('#000000')
  expect(readableTextColor('#ffeb3b')).toBe('#000000')
  expect(readableTextColor('#1e88e5')).toBe('#000000')
  expect(readableTextColor('#c62828')).toBe('#ffffff')
})
```

`src/lib/vitrines/schemas.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createVitrineSchema, itemSchema, vitrineSettingsSchema } from './schemas'

const uuid = '00000000-0000-4000-8000-000000000001'

describe('createVitrineSchema', () => {
  it('normaliza subdomínio e telefone', () => {
    const parsed = createVitrineSchema.parse({
      type: 'produtos',
      name: ' Loja da Ana ',
      subdomain: ' Loja-Ana ',
      whatsappLabel: '',
      whatsappPhone: '(11) 98765-4321',
      theme: 'dark',
    })
    expect(parsed).toEqual({
      type: 'produtos',
      name: 'Loja da Ana',
      subdomain: 'loja-ana',
      whatsappLabel: 'Principal',
      whatsappPhone: '+5511987654321',
      theme: 'dark',
    })
  })

  it('mensagens em português', () => {
    const result = createVitrineSchema.safeParse({
      type: 'comida',
      name: '',
      subdomain: 'app',
      whatsappLabel: 'Principal',
      whatsappPhone: '123',
      theme: 'light',
    })
    expect(result.success).toBe(false)
    const messages = Object.fromEntries(result.error!.issues.map((issue) => [issue.path[0], issue.message]))
    expect(messages).toMatchObject({
      type: 'Escolha o tipo da vitrine.',
      name: 'Informe o nome da vitrine.',
      subdomain: 'Este endereço é reservado. Escolha outro.',
      whatsappPhone: 'Informe um WhatsApp válido com DDD.',
    })
  })
})

describe('vitrineSettingsSchema', () => {
  it('formato do subdomínio', () => {
    const result = vitrineSettingsSchema.safeParse({ name: 'X', description: '', subdomain: '-ab' })
    expect(result.error!.issues[0].message).toBe(
      'Use de 3 a 30 caracteres: letras minúsculas, números e hífen, sem começar ou terminar com hífen.',
    )
  })
})

describe('itemSchema', () => {
  const valid = {
    name: 'Camiseta',
    description: '',
    categoryId: uuid,
    code: '',
    priceType: 'fixed',
    price: '49,90',
    promoPrice: '',
    durationMinutes: '',
    tags: 'algodão, novo , algodão',
    soldOut: '',
    whatsappId: '',
    buttonText: '',
    customMessage: '',
    variations: '[]',
    coverMediaId: uuid,
    galleryMediaIds: '[]',
  }

  it('converte os campos do formulário', () => {
    const parsed = itemSchema.parse(valid)
    expect(parsed).toMatchObject({
      name: 'Camiseta',
      code: null,
      priceCents: 4990,
      promoPriceCents: null,
      durationMinutes: null,
      tags: ['algodão', 'novo'],
      soldOut: false,
      whatsappId: null,
      buttonText: null,
      customMessage: null,
      variations: [],
    })
  })

  it('exige preço sem variações e promoção menor que o preço', () => {
    const noPrice = itemSchema.safeParse({ ...valid, price: '' })
    expect(noPrice.error!.issues[0]).toMatchObject({ path: ['price'], message: 'Informe o preço.' })
    const badPromo = itemSchema.safeParse({ ...valid, promoPrice: '60,00' })
    expect(badPromo.error!.issues[0]).toMatchObject({
      path: ['promoPrice'],
      message: 'O preço promocional deve ser menor que o preço.',
    })
  })

  it('variações dispensam o preço do item', () => {
    const parsed = itemSchema.parse({
      ...valid,
      price: '',
      variations: JSON.stringify([{ name: 'P', price: '39,90', promoPrice: '', soldOut: false }]),
    })
    expect(parsed.priceCents).toBeNull()
    expect(parsed.variations).toEqual([{ id: null, name: 'P', priceCents: 3990, promoPriceCents: null, soldOut: false }])
  })

  it('sob consulta zera os preços', () => {
    const parsed = itemSchema.parse({ ...valid, priceType: 'on_request', price: '10,00' })
    expect(parsed.priceCents).toBeNull()
  })

  it('código personalizado é normalizado', () => {
    expect(itemSchema.parse({ ...valid, code: ' x 1 ' }).code).toBe('X1')
    expect(itemSchema.safeParse({ ...valid, code: 'ABCDEFG' }).error!.issues[0].message).toBe('Use até 6 letras ou números.')
  })
})
```

Run: `npm test -- src/lib/vitrines src/lib/color` → FAIL.

- [ ] **Step 2: Implementação**

`src/lib/vitrines/db-errors.ts`:

```ts
import { ITEM_CODE_MESSAGES } from '@/lib/codes/item-code'

type DbError = { code?: string; message?: string; hint?: string } | null | undefined

const GENERIC = 'Não foi possível salvar. Tente novamente.'

export function isPlanLimitError(error: DbError): boolean {
  return Boolean(error?.message?.startsWith('plan_limit:'))
}

export function mapDbError(error: DbError): string {
  if (!error) return GENERIC
  const limit = Number(error.hint)
  switch (error.message) {
    case 'plan_limit:vitrines':
      return `Seu plano permite até ${limit} ${limit === 1 ? 'vitrine' : 'vitrines'}. Assine o Pro para criar mais.`
    case 'plan_limit:items':
      return `Seu plano permite até ${limit} itens por vitrine. Assine o Pro para cadastrar mais.`
    case 'item_code_taken':
      return ITEM_CODE_MESSAGES.taken
    case 'item_deleted':
      return 'Este item foi excluído.'
    case 'vitrine_not_found':
      return 'Vitrine não encontrada.'
  }
  if (error.message?.startsWith('invalid_reference:')) {
    return 'Algum dado escolhido não pertence a esta vitrine. Recarregue a página.'
  }
  if (error.code === '23505' && error.message?.includes('vitrines_subdomain_key')) {
    return 'Este endereço já está em uso. Escolha outro.'
  }
  return GENERIC
}
```

`src/lib/color/contrast.ts`:

```ts
function channel(hex: string, start: number) {
  const value = parseInt(hex.slice(start, start + 2), 16) / 255
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

// Texto sobre a cor da marca: branco ou preto, o de maior contraste (WCAG 2).
export function readableTextColor(hex: string): '#ffffff' | '#000000' {
  const luminance = 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5)
  const withWhite = 1.05 / (luminance + 0.05)
  const withBlack = (luminance + 0.05) / 0.05
  return withWhite >= withBlack ? '#ffffff' : '#000000'
}
```

`src/lib/vitrines/schemas.ts`:

```ts
import { z } from 'zod'
import { ITEM_CODE_MESSAGES, validateItemCode } from '@/lib/codes/item-code'
import { validateSubdomain } from '@/lib/hosts/subdomain'
import { parseBRLToCents } from '@/lib/money/money'
import { normalizePhone } from '@/lib/whatsapp/phone'
import { WIZARD_VITRINE_TYPES } from './vitrine-types'

const SUBDOMAIN_MESSAGES = {
  length: 'Use de 3 a 30 caracteres: letras minúsculas, números e hífen, sem começar ou terminar com hífen.',
  format: 'Use de 3 a 30 caracteres: letras minúsculas, números e hífen, sem começar ou terminar com hífen.',
  reserved: 'Este endereço é reservado. Escolha outro.',
} as const

export const subdomainField = z.string().transform((value, ctx) => {
  const result = validateSubdomain(value)
  if (!result.ok) {
    ctx.addIssue({ code: 'custom', message: SUBDOMAIN_MESSAGES[result.reason] })
    return z.NEVER
  }
  return result.value
})

const vitrineName = z.string().trim().min(1, 'Informe o nome da vitrine.').max(60, 'Use até 60 caracteres.')
const theme = z.enum(['light', 'dark'], 'Escolha o tema.')
const checkbox = z.string().optional().transform((value) => value === 'on' || value === 'true')
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use até ${max} caracteres.`)
    .transform((value) => value || null)

const phone = z.string().transform((value, ctx) => {
  const normalized = normalizePhone(value)
  if (!normalized) {
    ctx.addIssue({ code: 'custom', message: 'Informe um WhatsApp válido com DDD.' })
    return z.NEVER
  }
  return normalized
})

const contactLabel = z
  .string()
  .trim()
  .max(40, 'Use até 40 caracteres.')
  .transform((value) => value || 'Principal')

export const createVitrineSchema = z.object({
  type: z.enum(WIZARD_VITRINE_TYPES, 'Escolha o tipo da vitrine.'),
  name: vitrineName,
  subdomain: subdomainField,
  whatsappLabel: contactLabel,
  whatsappPhone: phone,
  theme,
})

export const vitrineSettingsSchema = z.object({
  name: vitrineName,
  description: z.string().trim().max(300, 'Use até 300 caracteres.'),
  subdomain: subdomainField,
})

export const messagesSchema = z.object({
  defaultButtonText: z.string().trim().min(1, 'Informe o texto do botão.').max(30, 'Use até 30 caracteres.'),
})

export const appearanceSchema = z.object({
  theme,
  showPrices: checkbox,
  showMedia: checkbox,
  brandColor: z
    .string()
    .trim()
    .toLowerCase()
    .transform((value) => value || null)
    .refine((value) => value === null || /^#[0-9a-f]{6}$/.test(value), 'Cor inválida.'),
  bannerEnabled: checkbox,
})

export const contactSchema = z.object({ label: contactLabel, phone })

export const categoryNameSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome da categoria.').max(40, 'Use até 40 caracteres.'),
})

const money = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (!value) return null
    const cents = parseBRLToCents(value)
    if (cents === null) {
      ctx.addIssue({ code: 'custom', message: 'Valor inválido. Ex.: 49,90' })
      return z.NEVER
    }
    return cents
  })

const variationInput = z.object({
  id: z.uuid().nullish().transform((value) => value ?? null),
  name: z.string().trim().min(1, 'Informe o nome da variação.').max(40, 'Use até 40 caracteres.'),
  price: money,
  promoPrice: money,
  soldOut: z.boolean().default(false),
})

function jsonArray<T extends z.ZodType>(schema: T, max: number) {
  return z.string().transform((value, ctx) => {
    let raw: unknown
    try {
      raw = JSON.parse(value || '[]')
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Dados inválidos. Recarregue a página.' })
      return z.NEVER
    }
    const parsed = z.array(schema).max(max, `No máximo ${max}.`).safeParse(raw)
    if (!parsed.success) {
      ctx.addIssue({ code: 'custom', message: parsed.error.issues[0]?.message ?? 'Dados inválidos.' })
      return z.NEVER
    }
    return parsed.data as z.output<T>[]
  })
}

export const itemSchema = z
  .object({
    name: z.string().trim().min(1, 'Informe o nome do item.').max(80, 'Use até 80 caracteres.'),
    description: z.string().trim().max(1000, 'Use até 1000 caracteres.'),
    categoryId: z.uuid('Escolha a categoria.'),
    code: z.string().transform((value, ctx) => {
      if (!value.trim()) return null
      const result = validateItemCode(value)
      if (!result.ok) {
        ctx.addIssue({ code: 'custom', message: ITEM_CODE_MESSAGES[result.reason] })
        return z.NEVER
      }
      return result.value
    }),
    priceType: z.enum(['fixed', 'from', 'on_request'], 'Escolha o tipo de preço.'),
    price: money,
    promoPrice: money,
    durationMinutes: z
      .string()
      .trim()
      .transform((value, ctx) => {
        if (!value) return null
        const minutes = Number(value)
        if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
          ctx.addIssue({ code: 'custom', message: 'Informe a duração em minutos (1 a 1440).' })
          return z.NEVER
        }
        return minutes
      }),
    tags: z.string().transform((value, ctx) => {
      const tags = [...new Set(value.split(',').map((tag) => tag.trim()).filter(Boolean))]
      if (tags.length > 5 || tags.some((tag) => tag.length > 20)) {
        ctx.addIssue({ code: 'custom', message: 'Até 5 etiquetas com até 20 caracteres cada.' })
        return z.NEVER
      }
      return tags
    }),
    soldOut: checkbox,
    whatsappId: z.union([z.uuid(), z.literal('')]).transform((value) => value || null),
    buttonText: optionalText(30),
    customMessage: optionalText(500),
    variations: jsonArray(variationInput, 20),
    coverMediaId: z.uuid('Envie a imagem de capa.'),
    galleryMediaIds: jsonArray(z.uuid(), 2),
  })
  .superRefine((data, ctx) => {
    if (data.priceType === 'on_request') return
    if (data.variations.length === 0 && data.price === null) {
      ctx.addIssue({ code: 'custom', path: ['price'], message: 'Informe o preço.' })
    }
    if (data.promoPrice !== null && (data.price === null || data.promoPrice >= data.price)) {
      ctx.addIssue({ code: 'custom', path: ['promoPrice'], message: 'O preço promocional deve ser menor que o preço.' })
    }
    data.variations.forEach((variation, index) => {
      if (variation.price === null) {
        ctx.addIssue({ code: 'custom', path: ['variations'], message: `Informe o preço da variação ${index + 1}.` })
      } else if (variation.promoPrice !== null && variation.promoPrice >= variation.price) {
        ctx.addIssue({
          code: 'custom',
          path: ['variations'],
          message: `O preço promocional da variação ${index + 1} deve ser menor que o preço.`,
        })
      }
    })
  })
  .transform((data) => {
    const onRequest = data.priceType === 'on_request'
    return {
      name: data.name,
      description: data.description,
      categoryId: data.categoryId,
      code: data.code,
      priceType: data.priceType,
      priceCents: onRequest ? null : data.price,
      promoPriceCents: onRequest ? null : data.promoPrice,
      durationMinutes: data.durationMinutes,
      tags: data.tags,
      soldOut: data.soldOut,
      whatsappId: data.whatsappId,
      buttonText: data.buttonText,
      customMessage: data.customMessage,
      // Em "sob consulta" as variações servem só para escolha; o preço guardado é ignorado no cálculo.
      variations: data.variations.map((variation) => ({
        id: variation.id,
        name: variation.name,
        priceCents: variation.price ?? 0,
        promoPriceCents: variation.promoPrice,
        soldOut: variation.soldOut,
      })),
      coverMediaId: data.coverMediaId,
      galleryMediaIds: data.galleryMediaIds,
    }
  })

export type ItemInput = z.output<typeof itemSchema>
```

No Zod 4, `z.enum(values, 'mensagem')` e `z.uuid('mensagem')` aceitam a mensagem como segundo argumento. Atenção: `z.uuid()` do Zod 4 exige UUID no formato RFC (versão e variante válidas); os ids do banco (`gen_random_uuid()`) atendem, e os testes usam `00000000-0000-4000-8000-…`.

Run: `npm test -- src/lib/vitrines src/lib/color` → PASS.

- [ ] **Step 3: Verificar e abrir o PR do bloco**

```bash
npm run lint && npm run typecheck && npm test
git add src/lib/vitrines src/lib/color
git commit -m "feat(vitrines): validação dos formulários, erros do banco em português e contraste da cor da marca"
git push -u origin HEAD
gh pr create --fill --base master
gh pr checks --watch
```

**Fim do Bloco 3:** autorização → merge. Sem conferência na nuvem (só regras).

---

# Bloco 4 — Painel: vitrines

Branch: `fase-2/bloco-4-painel-vitrines`.

**Antes do merge (usuário):** na Vercel, em **Settings → Environment Variables → Production**, criar `SUPABASE_SECRET_KEY` (chave secreta do projeto `agenn-vitrine-dev`, em **Project Settings → API Keys**) se ainda não existir. Redeploy depois do merge.

### Task 11: Base do servidor

**Files:**
- Create: `src/lib/server-env-schema.ts`, `src/lib/server-env-schema.test.ts`, `src/lib/server-env.ts`, `src/lib/supabase/admin.ts`, `src/lib/auth/action-user.ts`, `src/lib/vitrines/cache.ts`, `src/lib/vitrines/reorder.ts`, `src/lib/vitrines/reorder.test.ts`
- Modify: `src/lib/env-schema.ts`, `src/lib/env.ts`, `src/lib/env-schema.test.ts`, `src/lib/forms/form-state.ts`, `src/lib/forms/form-state.test.ts`, `src/components/ui/button.tsx`, `.env.example`

**Interfaces:**
- Produces:
  - `parseMediaStorageEnv(source)`: `{ driver: 'fake' } | { driver: 'bunny'; zone: string; password: string; host: string }`
  - `parseRateLimitSalt(source): string`
  - `getSupabaseSecretKey()`, `getMediaStorageEnv()`, `getRateLimitSalt()` (server-only, avaliadas sob demanda)
  - `createSupabaseAdminClient(): SupabaseClient<Database>` (server-only)
  - `requireActionUser(): Promise<{ supabase; user }>` (redireciona para `/entrar`)
  - `vitrineTag(subdomain): string`, `revalidateVitrine(...subdomains: string[]): void`
  - `moveInList(ids: string[], id: string, direction: 'up' | 'down'): string[] | null`
  - `readFormFields(formData: FormData, keys: readonly string[]): Record<string, string>`
  - `buttonClasses(variant?, className?): string`
  - `env.NEXT_PUBLIC_MEDIA_BASE_URL: string` (padrão `''`)

- [ ] **Step 1: Testes (falhando)**

`src/lib/server-env-schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseMediaStorageEnv, parseRateLimitSalt } from './server-env-schema'

describe('parseMediaStorageEnv', () => {
  it('bunny é o padrão e exige zona e senha', () => {
    expect(() => parseMediaStorageEnv({})).toThrow(/BUNNY_STORAGE_ZONE/)
    expect(parseMediaStorageEnv({ BUNNY_STORAGE_ZONE: 'z', BUNNY_STORAGE_PASSWORD: 'p' })).toEqual({
      driver: 'bunny',
      zone: 'z',
      password: 'p',
      host: 'br.storage.bunnycdn.com',
    })
  })

  it('fake só fora de produção', () => {
    expect(parseMediaStorageEnv({ MEDIA_STORAGE_DRIVER: 'fake' })).toEqual({ driver: 'fake' })
    expect(() => parseMediaStorageEnv({ MEDIA_STORAGE_DRIVER: 'fake', VERCEL_ENV: 'production' })).toThrow(/produção/)
  })
})

it('parseRateLimitSalt exige 16 caracteres', () => {
  expect(() => parseRateLimitSalt({ RATE_LIMIT_SALT: 'curto' })).toThrow()
  expect(parseRateLimitSalt({ RATE_LIMIT_SALT: 'ci-salt-somente-para-testes' })).toBe('ci-salt-somente-para-testes')
})
```

`src/lib/vitrines/reorder.test.ts`:

```ts
import { expect, it } from 'vitest'
import { moveInList } from './reorder'

it('move um id para cima ou para baixo', () => {
  expect(moveInList(['a', 'b', 'c'], 'b', 'up')).toEqual(['b', 'a', 'c'])
  expect(moveInList(['a', 'b', 'c'], 'b', 'down')).toEqual(['a', 'c', 'b'])
  expect(moveInList(['a', 'b', 'c'], 'a', 'up')).toBeNull()
  expect(moveInList(['a', 'b', 'c'], 'c', 'down')).toBeNull()
  expect(moveInList(['a', 'b'], 'x', 'up')).toBeNull()
})
```

Acrescente em `src/lib/forms/form-state.test.ts`:

```ts
import { readFormFields } from './form-state'

it('readFormFields lê strings e troca ausentes por vazio', () => {
  const data = new FormData()
  data.set('name', 'Ana')
  expect(readFormFields(data, ['name', 'phone'])).toEqual({ name: 'Ana', phone: '' })
})
```

Acrescente em `src/lib/env-schema.test.ts` um caso: sem `NEXT_PUBLIC_MEDIA_BASE_URL`, `parseEnv` devolve `''`; com `https://cdn.exemplo.com/`, devolve sem a barra final.

Run: `npm test` → FAIL nos novos.

- [ ] **Step 2: Implementação**

`src/lib/server-env-schema.ts`:

```ts
import { z } from 'zod'

type Source = Record<string, string | undefined>

const mediaStorageSchema = z
  .object({
    MEDIA_STORAGE_DRIVER: z.enum(['bunny', 'fake']).default('bunny'),
    BUNNY_STORAGE_ZONE: z.string().default(''),
    BUNNY_STORAGE_PASSWORD: z.string().default(''),
    BUNNY_STORAGE_HOST: z.string().default('br.storage.bunnycdn.com'),
    VERCEL_ENV: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.MEDIA_STORAGE_DRIVER === 'bunny' && (!value.BUNNY_STORAGE_ZONE || !value.BUNNY_STORAGE_PASSWORD)) {
      ctx.addIssue({ code: 'custom', message: 'BUNNY_STORAGE_ZONE e BUNNY_STORAGE_PASSWORD são obrigatórias com o driver bunny.' })
    }
    if (value.MEDIA_STORAGE_DRIVER === 'fake' && value.VERCEL_ENV === 'production') {
      ctx.addIssue({ code: 'custom', message: 'MEDIA_STORAGE_DRIVER=fake não pode ser usado em produção.' })
    }
  })

export type MediaStorageEnv = { driver: 'fake' } | { driver: 'bunny'; zone: string; password: string; host: string }

export function parseMediaStorageEnv(source: Source): MediaStorageEnv {
  const value = mediaStorageSchema.parse(source)
  if (value.MEDIA_STORAGE_DRIVER === 'fake') return { driver: 'fake' }
  return { driver: 'bunny', zone: value.BUNNY_STORAGE_ZONE, password: value.BUNNY_STORAGE_PASSWORD, host: value.BUNNY_STORAGE_HOST }
}

export function parseRateLimitSalt(source: Source): string {
  return z.string().min(16, 'RATE_LIMIT_SALT precisa de pelo menos 16 caracteres.').parse(source.RATE_LIMIT_SALT)
}

export function parseSupabaseSecretKey(source: Source): string {
  return z.string().min(1, 'SUPABASE_SECRET_KEY não configurada.').parse(source.SUPABASE_SECRET_KEY)
}
```

`src/lib/server-env.ts`:

```ts
import 'server-only'
import { parseMediaStorageEnv, parseRateLimitSalt, parseSupabaseSecretKey } from './server-env-schema'

// Avaliadas sob demanda: uma variável que falta só quebra a rota que precisa dela.
export const getSupabaseSecretKey = () => parseSupabaseSecretKey(process.env)
export const getMediaStorageEnv = () => parseMediaStorageEnv(process.env)
export const getRateLimitSalt = () => parseRateLimitSalt(process.env)
```

`src/lib/supabase/admin.ts`:

```ts
import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'
import { getSupabaseSecretKey } from '@/lib/server-env'
import type { Database } from './database.types'

// Ignora RLS. Só depois de conferir dono e permissões no código que chama.
export function createSupabaseAdminClient() {
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, getSupabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
```

`src/lib/auth/action-user.ts`:

```ts
import 'server-only'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function requireActionUser() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/entrar')
  return { supabase, user }
}
```

`src/lib/vitrines/cache.ts`:

```ts
import 'server-only'
import { revalidateTag } from 'next/cache'

export function vitrineTag(subdomain: string) {
  return `vitrine-sub:${subdomain}`
}

// expire: 0 — o dono vê a mudança na próxima visita, sem versão antiga.
export function revalidateVitrine(...subdomains: string[]) {
  for (const subdomain of new Set(subdomains)) revalidateTag(vitrineTag(subdomain), { expire: 0 })
}
```

`src/lib/vitrines/reorder.ts`:

```ts
export function moveInList(ids: readonly string[], id: string, direction: 'up' | 'down'): string[] | null {
  const index = ids.indexOf(id)
  const target = direction === 'up' ? index - 1 : index + 1
  if (index === -1 || target < 0 || target >= ids.length) return null
  const next = [...ids]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}
```

Em `src/lib/forms/form-state.ts`:

```ts
export function readFormFields(formData: FormData, keys: readonly string[]): Record<string, string> {
  return Object.fromEntries(keys.map((key) => [key, String(formData.get(key) ?? '')]))
}
```

(Se `src/features/auth/actions.ts` tiver um `readFields` local equivalente, troque pelo novo.)

Em `src/components/ui/button.tsx`, extraia as classes para `export function buttonClasses(variant: keyof typeof VARIANTS = 'primary', className = '')` e use-a no `Button`. Links com cara de botão usam `<Link className={buttonClasses('primary')}>`.

Em `src/lib/env-schema.ts` acrescente:

```ts
  NEXT_PUBLIC_MEDIA_BASE_URL: z
    .string()
    .default('')
    .transform((value) => value.trim().replace(/\/+$/, '')),
```

e em `src/lib/env.ts` a referência literal `NEXT_PUBLIC_MEDIA_BASE_URL: process.env.NEXT_PUBLIC_MEDIA_BASE_URL`.

Em `.env.example` acrescente:

```bash
# Segredo do Supabase (só servidor)
# SUPABASE_SECRET_KEY já existe acima
# Mídia: bunny (produção) ou fake (CI/local, grava no disco)
MEDIA_STORAGE_DRIVER=fake
BUNNY_STORAGE_ZONE=
BUNNY_STORAGE_PASSWORD=
BUNNY_STORAGE_HOST=br.storage.bunnycdn.com
# URL pública das imagens. Produção: Pull Zone do Bunny. Fake: /api/dev-media
NEXT_PUBLIC_MEDIA_BASE_URL=/api/dev-media
# Sal do hash de IP no limite de pedidos (mínimo 16 caracteres)
RATE_LIMIT_SALT=
```

Run: `npm test` → PASS. `npm run typecheck` → PASS.

- [ ] **Step 3: Commit**

```bash
git add -A src .env.example
git commit -m "feat(servidor): cliente admin, variáveis do servidor sob demanda, revalidação da vitrine e utilitários"
```

---

### Task 12: Minhas vitrines e assistente de criação

**Files:**
- Create: `src/features/vitrines/queries.ts`, `src/features/vitrines/actions.ts`, `src/app/app/(painel)/painel/copy-link-button.tsx`, `src/app/app/(painel)/painel/vitrines/nova/page.tsx`, `src/app/app/(painel)/painel/vitrines/nova/wizard.tsx`, `e2e/vitrines.spec.ts`
- Modify: `src/app/app/(painel)/painel/page.tsx`, `src/app/app/(painel)/layout.tsx` (nav com `Simulador`), `e2e/helpers.ts`

**Interfaces:**
- Produces:
  - `getPanelSession()` (cache por requisição): `{ supabase, userId }`
  - `listMyVitrines()`, `getEntitlements()`, `getMyVitrine(id)` (`notFound()` se não for do dono)
  - `createVitrineAction(prev: FormState, formData: FormData): Promise<FormState>`
  - `checkSubdomainAction(value: string, vitrineId?: string): Promise<{ ok: boolean; message: string }>`
  - e2e: `uniqueSubdomain(prefix)`, `seedVitrine(ownerId, options?)`, `seedItem(vitrine, ownerId, fields)`, `setPlan(userId, plan)`
- Textos usados pelos testes: `Nova vitrine`, `Vitrines: {n} de {max}`, `Copiar link`, `Editar`, `Produtos`, `Serviços`, `Continuar`, `Voltar`, `Nome da vitrine`, `Endereço da vitrine`, `Endereço disponível.`, `WhatsApp`, `Nome do contato`, `Claro`, `Escuro`, `Criar vitrine`.

- [ ] **Step 1: Consultas**

`src/features/vitrines/queries.ts`:

```ts
import 'server-only'
import { notFound, redirect } from 'next/navigation'
import { cache } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const getPanelSession = cache(async () => {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (typeof userId !== 'string') redirect('/entrar')
  return { supabase, userId }
})

export const getEntitlements = cache(async () => {
  const { supabase } = await getPanelSession()
  const { data, error } = await supabase.rpc('my_entitlements')
  if (error || !data) throw error ?? new Error('my_entitlements vazio')
  return data
})

export async function listMyVitrines() {
  const { supabase } = await getPanelSession()
  const { data, error } = await supabase
    .from('vitrines')
    .select('id, name, subdomain, type, status, created_at')
    .order('position')
    .order('created_at')
  if (error) throw error
  return data
}

export const getMyVitrine = cache(async (id: string) => {
  if (!UUID.test(id)) notFound()
  const { supabase } = await getPanelSession()
  const { data, error } = await supabase.from('vitrines').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) notFound()
  return data
})
```

- [ ] **Step 2: Ações**

`src/features/vitrines/actions.ts` (este arquivo cresce na Task 13):

```ts
'use server'

import { redirect } from 'next/navigation'
import { requireActionUser } from '@/lib/auth/action-user'
import { fieldErrorsFromZod, readFormFields, type FormState } from '@/lib/forms/form-state'
import { revalidateVitrine } from '@/lib/vitrines/cache'
import { mapDbError } from '@/lib/vitrines/db-errors'
import { createVitrineSchema, subdomainField } from '@/lib/vitrines/schemas'
import { DEFAULT_BUTTON_TEXT, SAMPLE_CATEGORIES } from '@/lib/vitrines/vitrine-types'

const SUBDOMAIN_TAKEN = 'Este endereço já está em uso. Escolha outro.'

export async function createVitrineAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const fields = readFormFields(formData, ['type', 'name', 'subdomain', 'whatsappLabel', 'whatsappPhone', 'theme'])
  const parsed = createVitrineSchema.safeParse(fields)
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error), values: fields }

  const input = parsed.data
  const { supabase } = await requireActionUser()
  const { data: vitrineId, error } = await supabase.rpc('create_vitrine', {
    p_type: input.type,
    p_subdomain: input.subdomain,
    p_name: input.name,
    p_theme: input.theme,
    p_default_button_text: DEFAULT_BUTTON_TEXT[input.type],
    p_whatsapp_label: input.whatsappLabel,
    p_whatsapp_phone: input.whatsappPhone,
    p_categories: [...SAMPLE_CATEGORIES[input.type]],
  })
  if (error) {
    if (error.code === '23505') return { fieldErrors: { subdomain: SUBDOMAIN_TAKEN }, values: fields }
    return { error: mapDbError(error), values: fields }
  }

  // Limpa um eventual "Vitrine não encontrada" em cache para este endereço.
  revalidateVitrine(input.subdomain)
  redirect(`/painel/vitrines/${vitrineId}/itens`)
}

export async function checkSubdomainAction(value: string, vitrineId?: string): Promise<{ ok: boolean; message: string }> {
  const parsed = subdomainField.safeParse(value)
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Endereço inválido.' }
  const { supabase } = await requireActionUser()
  const { data, error } = await supabase.rpc('is_subdomain_available', {
    p_subdomain: parsed.data,
    p_except_vitrine_id: vitrineId,
  })
  if (error) return { ok: false, message: 'Não foi possível verificar agora.' }
  return data ? { ok: true, message: 'Endereço disponível.' } : { ok: false, message: SUBDOMAIN_TAKEN }
}
```

- [ ] **Step 3: Minhas vitrines**

`src/app/app/(painel)/painel/copy-link-button.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant="secondary"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch {
          window.prompt('Copie o link:', url)
        }
      }}
    >
      {copied ? 'Link copiado' : 'Copiar link'}
    </Button>
  )
}
```

Reescreva `src/app/app/(painel)/painel/page.tsx`:

```tsx
import Link from 'next/link'
import { buttonClasses } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getEntitlements, listMyVitrines } from '@/features/vitrines/queries'
import { env } from '@/lib/env'
import { buildVitrineUrl } from '@/lib/hosts/urls'
import { mapDbError } from '@/lib/vitrines/db-errors'
import { VITRINE_TYPE_LABEL } from '@/lib/vitrines/vitrine-types'
import { CopyLinkButton } from './copy-link-button'

export const metadata = { title: 'Minhas vitrines' }

export default async function PainelHome() {
  const [vitrines, plan] = await Promise.all([listMyVitrines(), getEntitlements()])
  const atLimit = vitrines.length >= plan.max_vitrines

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Minhas vitrines</h1>
        {atLimit ? null : (
          <Link href="/painel/vitrines/nova" className={buttonClasses('primary')}>
            Nova vitrine
          </Link>
        )}
      </div>
      <p className="text-sm text-ink-muted">
        Vitrines: {vitrines.length} de {plan.max_vitrines} · Plano {plan.name}
      </p>
      {atLimit ? (
        <Card className="px-5 py-4">
          <p>{mapDbError({ message: 'plan_limit:vitrines', hint: String(plan.max_vitrines) })}</p>
        </Card>
      ) : null}

      {vitrines.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <h2 className="text-lg font-medium">Você ainda não tem vitrines</h2>
          <p className="max-w-sm text-ink-muted">Crie sua primeira vitrine e receba pedidos pelo WhatsApp.</p>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {vitrines.map((vitrine) => {
            const url = buildVitrineUrl(vitrine.subdomain, env.NEXT_PUBLIC_ROOT_DOMAIN)
            return (
              <li key={vitrine.id}>
                <Card className="flex flex-col gap-3 p-5">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-lg font-medium">{vitrine.name}</h2>
                    <span className="rounded-full bg-subtle px-2 py-0.5 text-xs">
                      {vitrine.status === 'active' ? 'Ativa' : 'Congelada'}
                    </span>
                  </div>
                  <p className="text-sm text-ink-muted">{VITRINE_TYPE_LABEL[vitrine.type as keyof typeof VITRINE_TYPE_LABEL]}</p>
                  <a href={url} target="_blank" rel="noreferrer" className="truncate text-sm underline">
                    {url.replace(/^https?:\/\//, '')}
                  </a>
                  <div className="flex flex-wrap gap-2">
                    <CopyLinkButton url={url} />
                    <Link href={`/painel/vitrines/${vitrine.id}/itens`} className={buttonClasses('primary')}>
                      Editar
                    </Link>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
```

Antes, rode `grep -rn "preparando\|ainda não tem vitrines" e2e` e atualize qualquer teste da Fase 1 que dependa do texto antigo.

No `src/app/app/(painel)/layout.tsx`, acrescente o link `Simulador` (`/painel/simulador`) na navegação, entre `Vitrines` e `Conta`.

- [ ] **Step 4: Assistente**

`src/app/app/(painel)/painel/vitrines/nova/page.tsx`:

```tsx
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { getEntitlements, listMyVitrines } from '@/features/vitrines/queries'
import { env } from '@/lib/env'
import { mapDbError } from '@/lib/vitrines/db-errors'
import { VitrineWizard } from './wizard'

export const metadata = { title: 'Nova vitrine' }

export default async function NovaVitrinePage() {
  const [vitrines, plan] = await Promise.all([listMyVitrines(), getEntitlements()])
  if (vitrines.length >= plan.max_vitrines) {
    return (
      <Card className="flex flex-col gap-3 p-6">
        <h1 className="text-xl font-semibold">Nova vitrine</h1>
        <p>{mapDbError({ message: 'plan_limit:vitrines', hint: String(plan.max_vitrines) })}</p>
        <Link href="/painel" className="underline">
          Voltar para Minhas vitrines
        </Link>
      </Card>
    )
  }
  return <VitrineWizard rootDomain={env.NEXT_PUBLIC_ROOT_DOMAIN} />
}
```

`src/app/app/(painel)/painel/vitrines/nova/wizard.tsx`:

```tsx
'use client'

import { useActionState, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { checkSubdomainAction, createVitrineAction } from '@/features/vitrines/actions'
import { initialFormState, type FormState } from '@/lib/forms/form-state'

const STEPS = ['Tipo', 'Nome e endereço', 'WhatsApp', 'Aparência'] as const

function stepForErrors(errors: FormState['fieldErrors']): number | null {
  if (!errors) return null
  if (errors.type) return 0
  if (errors.name || errors.subdomain) return 1
  if (errors.whatsappPhone || errors.whatsappLabel) return 2
  return 3
}

export function VitrineWizard({ rootDomain }: { rootDomain: string }) {
  const [step, setStep] = useState(0)
  const [state, formAction, pending] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await createVitrineAction(prev, formData)
    const errorStep = stepForErrors(result.fieldErrors)
    if (errorStep !== null) setStep(errorStep)
    return result
  }, initialFormState)

  const [availability, setAvailability] = useState<{ ok: boolean; message: string } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  function onSubdomainChange(value: string) {
    setAvailability(null)
    clearTimeout(timer.current)
    if (!value.trim()) return
    timer.current = setTimeout(async () => setAvailability(await checkSubdomainAction(value)), 400)
  }

  const errors = state.fieldErrors ?? {}
  const values = state.values ?? {}

  return (
    <Card className="mx-auto flex w-full max-w-xl flex-col gap-5 p-6">
      <div>
        <p className="text-sm text-ink-muted">
          Passo {step + 1} de {STEPS.length} · {STEPS[step]}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Nova vitrine</h1>
      </div>

      <form action={formAction} noValidate className="flex flex-col gap-5">
        <fieldset hidden={step !== 0} className="flex flex-col gap-3">
          <legend className="mb-2 font-medium">Que tipo de vitrine?</legend>
          {[
            ['produtos', 'Produtos', 'Lojas e catálogos. Botão "Solicitar orçamento".'],
            ['servicos', 'Serviços', 'Profissionais e clínicas. Botão "Agendar".'],
          ].map(([value, label, hint]) => (
            <label key={value} className="flex items-start gap-3 rounded-control border border-line p-3">
              <input type="radio" name="type" value={value} defaultChecked={values.type === value} aria-label={label} />
              <span>
                <span className="block font-medium">{label}</span>
                <span className="block text-sm text-ink-muted">{hint}</span>
              </span>
            </label>
          ))}
          <p className="text-sm text-ink-muted">O tipo não poderá ser alterado depois.</p>
          <FormMessage error={errors.type} />
        </fieldset>

        <fieldset hidden={step !== 1} className="flex flex-col gap-4">
          <Field label="Nome da vitrine" htmlFor="name" error={errors.name}>
            <Input id="name" name="name" defaultValue={values.name} maxLength={60} invalid={!!errors.name} />
          </Field>
          <Field label="Endereço da vitrine" htmlFor="subdomain" error={errors.subdomain}>
            <div className="flex items-center gap-2">
              <Input
                id="subdomain"
                name="subdomain"
                defaultValue={values.subdomain}
                maxLength={30}
                autoCapitalize="none"
                invalid={!!errors.subdomain}
                onChange={(event) => onSubdomainChange(event.target.value)}
              />
              <span className="shrink-0 text-sm text-ink-muted">.{rootDomain}</span>
            </div>
          </Field>
          {availability ? (
            <p className={`text-sm ${availability.ok ? 'text-brand' : 'text-danger'}`} aria-live="polite">
              {availability.message}
            </p>
          ) : null}
        </fieldset>

        <fieldset hidden={step !== 2} className="flex flex-col gap-4">
          <Field label="WhatsApp" htmlFor="whatsappPhone" error={errors.whatsappPhone}>
            <Input
              id="whatsappPhone"
              name="whatsappPhone"
              type="tel"
              inputMode="tel"
              placeholder="(11) 98765-4321"
              defaultValue={values.whatsappPhone}
              invalid={!!errors.whatsappPhone}
            />
          </Field>
          <Field label="Nome do contato" htmlFor="whatsappLabel" error={errors.whatsappLabel}>
            <Input id="whatsappLabel" name="whatsappLabel" placeholder="Principal" defaultValue={values.whatsappLabel} />
          </Field>
        </fieldset>

        <fieldset hidden={step !== 3} className="flex flex-col gap-3">
          <legend className="mb-2 font-medium">Tema</legend>
          {[
            ['light', 'Claro'],
            ['dark', 'Escuro'],
          ].map(([value, label]) => (
            <label key={value} className="flex items-center gap-2">
              <input
                type="radio"
                name="theme"
                value={value}
                defaultChecked={(values.theme || 'light') === value}
                aria-label={label}
              />
              {label}
            </label>
          ))}
          <div className="rounded-control border border-dashed border-line p-3 text-sm text-ink-muted">
            <span className="font-medium text-ink">Logo, cor da marca e banner</span> · Pro. Disponível no plano Pro.
          </div>
        </fieldset>

        <FormMessage error={state.error} />

        <div className="flex justify-between gap-2">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep(step - 1)}>
              Voltar
            </Button>
          ) : (
            <span />
          )}
          {/* Chaves diferentes: sem elas o React reaproveita o mesmo <button> e o troca
              para submit durante o clique em Continuar, enviando o formulário antes da hora. */}
          {step < STEPS.length - 1 ? (
            <Button key="next" onClick={() => setStep(step + 1)}>
              Continuar
            </Button>
          ) : (
            <Button key="submit" type="submit" disabled={pending}>
              Criar vitrine
            </Button>
          )}
        </div>
      </form>
    </Card>
  )
}
```

Se o `Field` da Fase 1 exigir um único filho com `id`, mova o sufixo `.{rootDomain}` para fora do `Field`.

- [ ] **Step 5: Helpers de e2e**

Acrescente em `e2e/helpers.ts`:

```ts
export function uniqueSubdomain(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.slice(0, 30)
}

export async function setPlan(userId: string, plan: 'free' | 'pro') {
  const admin = createAdminClient()
  await admin
    .from('subscriptions')
    .upsert({ user_id: userId, plan_id: plan, status: plan === 'pro' ? 'active' : 'none' })
    .throwOnError()
}

export type SeededVitrine = { id: string; subdomain: string; categoryId: string; contactId: string; phone: string; name: string }

export async function seedVitrine(
  ownerId: string,
  options: { type?: 'produtos' | 'servicos'; name?: string; subdomain?: string; phone?: string } = {},
): Promise<SeededVitrine> {
  const admin = createAdminClient()
  const type = options.type ?? 'produtos'
  const subdomain = options.subdomain ?? uniqueSubdomain('seed')
  const name = options.name ?? 'Vitrine Seed'
  const phone = options.phone ?? '+5511987654321'
  const { data: vitrine } = await admin
    .from('vitrines')
    .insert({ owner_id: ownerId, type, subdomain, name, default_button_text: type === 'servicos' ? 'Agendar' : 'Solicitar orçamento' })
    .select('id')
    .single()
    .throwOnError()
  const { data: contact } = await admin
    .from('whatsapp_contacts')
    .insert({ owner_id: ownerId, vitrine_id: vitrine.id, label: 'Principal', phone_e164: phone })
    .select('id')
    .single()
    .throwOnError()
  await admin.from('vitrines').update({ primary_whatsapp_id: contact.id }).eq('id', vitrine.id).throwOnError()
  const { data: category } = await admin
    .from('categories')
    .insert({ owner_id: ownerId, vitrine_id: vitrine.id, name: 'Destaques' })
    .select('id')
    .single()
    .throwOnError()
  return { id: vitrine.id, subdomain, categoryId: category.id, contactId: contact.id, phone, name }
}

export async function seedItem(
  vitrine: SeededVitrine,
  ownerId: string,
  fields: {
    name: string
    priceCents?: number | null
    priceType?: 'fixed' | 'from' | 'on_request'
    variations?: { name: string; priceCents: number }[]
  },
) {
  const admin = createAdminClient()
  const { data: item } = await admin
    .from('items')
    .insert({
      owner_id: ownerId,
      vitrine_id: vitrine.id,
      category_id: vitrine.categoryId,
      name: fields.name,
      price_type: fields.priceType ?? 'fixed',
      price_cents: fields.priceType === 'on_request' ? null : (fields.priceCents ?? 1000),
    })
    .select('id, code')
    .single()
    .throwOnError()
  if (fields.variations?.length) {
    await admin
      .from('item_variations')
      .insert(fields.variations.map((v, position) => ({ owner_id: ownerId, item_id: item.id, name: v.name, price_cents: v.priceCents, position })))
      .throwOnError()
  }
  await admin
    .from('media')
    .insert({
      owner_id: ownerId,
      vitrine_id: vitrine.id,
      item_id: item.id,
      role: 'cover',
      kind: 'image',
      storage_paths: { '480': `${ownerId}/${vitrine.id}/seed-480.webp`, '1080': `${ownerId}/${vitrine.id}/seed-1080.webp` },
      width: 1080,
      height: 1350,
    })
    .throwOnError()
  return item as { id: string; code: string }
}
```

O cliente admin dos testes não é tipado; o `throwOnError()` garante que falhas de seed apareçam como erro.

- [ ] **Step 6: e2e**

`e2e/vitrines.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { createConfirmedUser, seedVitrine, signIn, uniqueSubdomain } from './helpers'

test('cria vitrine pelo assistente e respeita o limite do gratuito', async ({ page }) => {
  const user = await createConfirmedUser('assistente')
  await signIn(page, user.email, user.password)

  await page.getByRole('link', { name: 'Nova vitrine' }).click()
  await page.getByLabel('Produtos').check()
  await page.getByRole('button', { name: 'Continuar' }).click()

  const subdomain = uniqueSubdomain('loja')
  await page.getByLabel('Nome da vitrine').fill('Loja Teste')
  await page.getByLabel('Endereço da vitrine').fill(subdomain)
  await expect(page.getByText('Endereço disponível.')).toBeVisible()
  await page.getByRole('button', { name: 'Continuar' }).click()

  await page.getByLabel('WhatsApp', { exact: true }).fill('(11) 98765-4321')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByLabel('Escuro').check()
  await page.getByRole('button', { name: 'Criar vitrine' }).click()

  await expect(page).toHaveURL(/\/painel\/vitrines\/[0-9a-f-]+\/itens$/)
  await expect(page.getByRole('heading', { name: 'Loja Teste' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Destaques' })).toBeVisible()

  await page.goto('/painel')
  await expect(page.getByText('Vitrines: 1 de 1')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Nova vitrine' })).toHaveCount(0)
  await expect(page.getByText('Seu plano permite até 1 vitrine. Assine o Pro para criar mais.')).toBeVisible()
})

test('telefone inválido volta ao passo do WhatsApp; endereço em uso é avisado', async ({ page }) => {
  const other = await createConfirmedUser('dono-endereco')
  const taken = await seedVitrine(other.id)
  const user = await createConfirmedUser('conflito')
  await signIn(page, user.email, user.password)

  await page.goto('/painel/vitrines/nova')
  await page.getByLabel('Serviços').check()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByLabel('Nome da vitrine').fill('Clínica')
  await page.getByLabel('Endereço da vitrine').fill(taken.subdomain)
  await expect(page.getByText('Este endereço já está em uso. Escolha outro.')).toBeVisible()
  await page.getByLabel('Endereço da vitrine').fill(uniqueSubdomain('clinica'))
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByLabel('WhatsApp', { exact: true }).fill('123')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByRole('button', { name: 'Criar vitrine' }).click()
  await expect(page.getByText('Passo 3 de 4')).toBeVisible()
  await expect(page.getByText('Informe um WhatsApp válido com DDD.')).toBeVisible()
})
```

A página `/itens` usada no primeiro teste nasce na Task 13 (versão simples) e é completada no Bloco 6.

- [ ] **Step 7: Commit**

```bash
npm run lint && npm run typecheck && npm test
git add -A src e2e
git commit -m "feat(painel): Minhas vitrines e assistente de criação"
```

---

### Task 13: Editor da vitrine (abas sem imagens)

**Files:**
- Create: `src/app/app/(painel)/painel/vitrines/[id]/layout.tsx`, `.../[id]/editor-tabs.tsx`, `.../[id]/page.tsx`, `.../[id]/itens/page.tsx` (versão simples), `.../[id]/configuracoes/page.tsx`, `settings-form.tsx`, `delete-form.tsx`, `.../[id]/mensagens/page.tsx`, `messages-form.tsx`, `.../[id]/whatsapp/page.tsx`, `contacts.tsx`, `.../[id]/aparencia/page.tsx`, `appearance-form.tsx`, `src/features/whatsapp/actions.ts`, `src/components/ui/unsaved-changes.tsx`, `e2e/editor.spec.ts`
- Modify: `src/features/vitrines/actions.ts`

(`...` = `src/app/app/(painel)/painel/vitrines`)

**Interfaces:**
- Produces (todas as ações recebem o id com `.bind(null, vitrineId)` e devolvem `FormState`):
  - `updateSettingsAction(vitrineId, prev, formData)` — campos `name`, `description`, `subdomain`, `confirmSubdomainChange`
  - `deleteVitrineAction(vitrineId, prev, formData)` — campo `confirm` (igual ao subdomínio); redireciona para `/painel`
  - `updateMessagesAction(vitrineId, prev, formData)` — campo `defaultButtonText`
  - `updateAppearanceAction(vitrineId, prev, formData)` — `theme`, `showPrices`, `showMedia`, `brandColor`, `bannerEnabled`
  - `addContactAction(vitrineId, prev, formData)`, `updateContactAction(vitrineId, contactId, prev, formData)` — `label`, `phone`
  - `setPrimaryContactAction(vitrineId, contactId)`, `removeContactAction(vitrineId, contactId)` — `Promise<FormState>`
  - `<UnsavedChangesGuard formId: string />`
- Textos usados pelos testes: abas `Itens`, `Aparência`, `WhatsApp`, `Sacola e mensagens`, `Configurações`; `Ver vitrine`; mensagens de sucesso `Configurações salvas.`, `Mensagens salvas.`, `Aparência salva.`, `Contato salvo.`; botões `Salvar configurações`, `Salvar mensagens`, `Salvar aparência`, `Adicionar contato`, `Salvar contato`, `Tornar principal`, `Remover`, `Excluir definitivamente`; rótulos `Descrição`, `Entendi que o link antigo vai parar de funcionar`, `Texto padrão do botão`, `Mostrar preços`, `Mostrar fotos`, `Cor da marca`, `Mostrar banner`, `Nome do novo contato`, `Número do novo contato`, `Digite o endereço da vitrine para confirmar`; aviso Pro `Recurso do plano Pro`.

- [ ] **Step 1: Ações da vitrine**

Acrescente em `src/features/vitrines/actions.ts`:

```ts
import { appearanceSchema, messagesSchema, vitrineSettingsSchema } from '@/lib/vitrines/schemas'

async function loadOwnedVitrine(vitrineId: string) {
  const session = await requireActionUser()
  const { data: vitrine } = await session.supabase
    .from('vitrines')
    .select('id, subdomain')
    .eq('id', vitrineId)
    .maybeSingle()
  if (!vitrine) redirect('/painel')
  return { ...session, vitrine }
}

export async function updateSettingsAction(vitrineId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const fields = readFormFields(formData, ['name', 'description', 'subdomain'])
  const parsed = vitrineSettingsSchema.safeParse(fields)
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error), values: fields }

  const { supabase, vitrine } = await loadOwnedVitrine(vitrineId)
  const changingSubdomain = parsed.data.subdomain !== vitrine.subdomain
  if (changingSubdomain && formData.get('confirmSubdomainChange') !== 'on') {
    return {
      fieldErrors: { confirmSubdomainChange: 'Confirme que o link antigo vai parar de funcionar.' },
      values: fields,
    }
  }

  const { error } = await supabase
    .from('vitrines')
    .update({ name: parsed.data.name, description: parsed.data.description, subdomain: parsed.data.subdomain })
    .eq('id', vitrineId)
  if (error) {
    if (error.code === '23505') return { fieldErrors: { subdomain: SUBDOMAIN_TAKEN }, values: fields }
    return { error: mapDbError(error), values: fields }
  }
  revalidateVitrine(vitrine.subdomain, parsed.data.subdomain)
  return { success: 'Configurações salvas.', values: { ...fields, subdomain: parsed.data.subdomain } }
}

export async function deleteVitrineAction(vitrineId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, vitrine } = await loadOwnedVitrine(vitrineId)
  if (String(formData.get('confirm') ?? '').trim().toLowerCase() !== vitrine.subdomain) {
    return { fieldErrors: { confirm: 'Digite o endereço da vitrine para confirmar.' } }
  }
  // Bloco 5: apagar também os arquivos das mídias (Task 15).
  const { error } = await supabase.from('vitrines').delete().eq('id', vitrineId)
  if (error) return { error: mapDbError(error) }
  revalidateVitrine(vitrine.subdomain)
  redirect('/painel')
}

export async function updateMessagesAction(vitrineId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const fields = readFormFields(formData, ['defaultButtonText'])
  const parsed = messagesSchema.safeParse(fields)
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error), values: fields }
  const { supabase, vitrine } = await loadOwnedVitrine(vitrineId)
  const { error } = await supabase
    .from('vitrines')
    .update({ default_button_text: parsed.data.defaultButtonText })
    .eq('id', vitrineId)
  if (error) return { error: mapDbError(error), values: fields }
  revalidateVitrine(vitrine.subdomain)
  return { success: 'Mensagens salvas.', values: fields }
}

export async function updateAppearanceAction(vitrineId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const fields = readFormFields(formData, ['theme', 'brandColor'])
  const parsed = appearanceSchema.safeParse({
    theme: fields.theme,
    showPrices: formData.get('showPrices') ?? undefined,
    showMedia: formData.get('showMedia') ?? undefined,
    brandColor: fields.brandColor,
    bannerEnabled: formData.get('bannerEnabled') ?? undefined,
  })
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error), values: fields }

  const { supabase, vitrine } = await loadOwnedVitrine(vitrineId)
  const { data: plan } = await supabase.rpc('my_entitlements')
  const update: Record<string, unknown> = {
    theme: parsed.data.theme,
    show_prices: parsed.data.showPrices,
    show_media: parsed.data.showMedia,
  }
  // Sem o Pro, os campos de marca ficam desabilitados e não são enviados.
  // Não apagar o que já existe: ao voltar para o Pro, tudo reaparece (spec 4.7).
  if (plan?.allow_branding) {
    update.brand_color = parsed.data.brandColor
    update.banner_enabled = parsed.data.bannerEnabled
  }
  const { error } = await supabase.from('vitrines').update(update).eq('id', vitrineId)
  if (error) return { error: mapDbError(error), values: fields }
  revalidateVitrine(vitrine.subdomain)
  return { success: 'Aparência salva.', values: fields }
}
```

Exporte `loadOwnedVitrine` de um módulo não-`'use server'` se o lint reclamar de função não assíncrona exportada; como ela não é exportada, pode ficar aqui.

- [ ] **Step 2: Ações de WhatsApp**

`src/features/whatsapp/actions.ts`:

```ts
'use server'

import { redirect } from 'next/navigation'
import { requireActionUser } from '@/lib/auth/action-user'
import { fieldErrorsFromZod, readFormFields, type FormState } from '@/lib/forms/form-state'
import { revalidateVitrine } from '@/lib/vitrines/cache'
import { mapDbError } from '@/lib/vitrines/db-errors'
import { contactSchema } from '@/lib/vitrines/schemas'

async function ownedVitrine(vitrineId: string) {
  const { supabase } = await requireActionUser()
  const { data: vitrine } = await supabase
    .from('vitrines')
    .select('id, subdomain, primary_whatsapp_id')
    .eq('id', vitrineId)
    .maybeSingle()
  if (!vitrine) redirect('/painel')
  return { supabase, vitrine }
}

export async function addContactAction(vitrineId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const fields = readFormFields(formData, ['label', 'phone'])
  const parsed = contactSchema.safeParse(fields)
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error), values: fields }
  const { supabase, vitrine } = await ownedVitrine(vitrineId)
  const { count } = await supabase
    .from('whatsapp_contacts')
    .select('id', { count: 'exact', head: true })
    .eq('vitrine_id', vitrineId)
  const { error } = await supabase
    .from('whatsapp_contacts')
    .insert({ vitrine_id: vitrineId, label: parsed.data.label, phone_e164: parsed.data.phone, position: count ?? 0 })
  if (error) return { error: mapDbError(error), values: fields }
  revalidateVitrine(vitrine.subdomain)
  return { success: 'Contato salvo.' }
}

export async function updateContactAction(
  vitrineId: string,
  contactId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const fields = readFormFields(formData, ['label', 'phone'])
  const parsed = contactSchema.safeParse(fields)
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error), values: fields }
  const { supabase, vitrine } = await ownedVitrine(vitrineId)
  const { error } = await supabase
    .from('whatsapp_contacts')
    .update({ label: parsed.data.label, phone_e164: parsed.data.phone })
    .eq('id', contactId)
    .eq('vitrine_id', vitrineId)
  if (error) return { error: mapDbError(error), values: fields }
  revalidateVitrine(vitrine.subdomain)
  return { success: 'Contato salvo.', values: fields }
}

export async function setPrimaryContactAction(vitrineId: string, contactId: string): Promise<FormState> {
  const { supabase, vitrine } = await ownedVitrine(vitrineId)
  const { error } = await supabase.from('vitrines').update({ primary_whatsapp_id: contactId }).eq('id', vitrineId)
  if (error) return { error: mapDbError(error) }
  revalidateVitrine(vitrine.subdomain)
  return { success: 'Contato principal alterado.' }
}

export async function removeContactAction(vitrineId: string, contactId: string): Promise<FormState> {
  const { supabase, vitrine } = await ownedVitrine(vitrineId)
  if (vitrine.primary_whatsapp_id === contactId) {
    return { error: 'Escolha outro contato principal antes de remover este.' }
  }
  // Itens que usavam este contato passam a usar o principal (FK on delete set null).
  const { error } = await supabase.from('whatsapp_contacts').delete().eq('id', contactId).eq('vitrine_id', vitrineId)
  if (error) return { error: mapDbError(error) }
  revalidateVitrine(vitrine.subdomain)
  return { success: 'Contato removido.' }
}
```

- [ ] **Step 3: Layout, abas e itens (versão simples)**

`.../[id]/layout.tsx` (Server Component): `params: Promise<{ id: string }>`; carrega `getMyVitrine(id)`; mostra `<h1>` com o nome da vitrine, link `Ver vitrine` (`buildVitrineUrl`, `target="_blank"`) e `<EditorTabs vitrineId={id} />`; abaixo, `children`.

`.../[id]/editor-tabs.tsx` (Client): `<nav aria-label="Seções da vitrine">` com `Link`s para `itens`, `aparencia`, `whatsapp`, `mensagens`, `configuracoes` e os rótulos listados acima; a aba ativa (por `usePathname()`) recebe `aria-current="page"`. Rolagem horizontal no celular (`overflow-x-auto`).

`.../[id]/page.tsx`: `redirect(\`/painel/vitrines/${id}/itens\`)`.

`.../[id]/itens/page.tsx` (simples, substituída no Bloco 6): lista as categorias da vitrine em ordem, cada uma com `<h2>` do nome e o texto `Nenhum item nesta categoria.`

- [ ] **Step 4: Formulários**

Todos seguem o padrão do `name-form.tsx` da Fase 1: `'use client'`, `useActionState(action.bind(null, vitrineId), { values })`, `Field` + `Input`, `FormMessage error/success`, `Button type="submit" disabled={pending}`, `noValidate`. Cada formulário tem `id` e inclui `<UnsavedChangesGuard formId="…" />`.

`src/components/ui/unsaved-changes.tsx`:

```tsx
'use client'

import { useEffect } from 'react'

// Pede confirmação do navegador ao sair com alterações não salvas no formulário.
export function UnsavedChangesGuard({ formId }: { formId: string }) {
  useEffect(() => {
    const form = document.getElementById(formId)
    if (!(form instanceof HTMLFormElement)) return
    let dirty = false
    const markDirty = () => {
      dirty = true
    }
    const clear = () => {
      dirty = false
    }
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault()
    }
    form.addEventListener('input', markDirty)
    form.addEventListener('submit', clear)
    window.addEventListener('beforeunload', warn)
    return () => {
      form.removeEventListener('input', markDirty)
      form.removeEventListener('submit', clear)
      window.removeEventListener('beforeunload', warn)
    }
  }, [formId])
  return null
}
```

**Configurações** (`configuracoes/page.tsx` carrega a vitrine e passa para os dois formulários):
- `settings-form.tsx`: `Nome da vitrine`, `Descrição` (`textarea`, 300), `Endereço da vitrine` (com sufixo `.{rootDomain}` e a mesma verificação com atraso de 400 ms do assistente, chamando `checkSubdomainAction(value, vitrineId)`). Quando o valor digitado difere do atual, aparece o aviso `O endereço antigo deixará de funcionar imediatamente.` e a caixa `Entendi que o link antigo vai parar de funcionar` (`name="confirmSubdomainChange"`). Botão `Salvar configurações`.
- `delete-form.tsx`: seção "Excluir vitrine" com o texto `Isso apaga a vitrine, os itens e as imagens. Não dá para desfazer.`, campo `Digite o endereço da vitrine para confirmar` (`name="confirm"`, placeholder = subdomínio) e botão `Excluir definitivamente` (`variant="danger"`).

**Sacola e mensagens** (`mensagens/`): campo `Texto padrão do botão` (`defaultButtonText`, 30) e o parágrafo `A mensagem personalizada de cada item fica em Itens → Avançado. A sacola chega em uma próxima atualização.` Botão `Salvar mensagens`.

**Aparência** (`aparencia/`; a página também carrega `getEntitlements()`):
- `Tema`: rádios `Claro`/`Escuro`.
- Caixas `Mostrar preços` (`showPrices`) e `Mostrar fotos` (`showMedia`), marcadas conforme a vitrine.
- `<fieldset disabled={!plan.allow_branding}>` com legenda "Marca": `Cor da marca` (`<input type="color" name="brandColor">`, valor atual ou `#0b2a1c`) e `Mostrar banner` (`bannerEnabled`). Sem o Pro, acima do fieldset: `Recurso do plano Pro` e `Assine o Pro para usar logo, cor da marca e banner.` (spec 8.9: visível com cadeado, nunca escondido). Logo e banner entram na Task 16.
- Botão `Salvar aparência`.

**WhatsApp** (`whatsapp/page.tsx` lista os contatos da vitrine por `position`; `contacts.tsx` é Client):
- Cada contato: formulário com `Nome do contato` e `Número` (`label`, `phone`, valor exibido com `formatPhone`), botão `Salvar contato`; o principal mostra o selo `Principal`; os demais mostram `Tornar principal` e `Remover` (botões que chamam as ações com `useTransition` e exibem a mensagem de retorno). Os `id`s dos campos incluem o id do contato para não repetir.
- No fim: formulário `Nome do novo contato` (`label`) e `Número do novo contato` (`phone`), botão `Adicionar contato`. Depois de sucesso, `router.refresh()`.

- [ ] **Step 5: e2e**

`e2e/editor.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { createConfirmedUser, seedVitrine, setPlan, signIn, uniqueSubdomain } from './helpers'

test('configurações, mensagens e WhatsApp', async ({ page }) => {
  const user = await createConfirmedUser('editor')
  const vitrine = await seedVitrine(user.id)
  await signIn(page, user.email, user.password)

  await page.goto(`/painel/vitrines/${vitrine.id}/configuracoes`)
  await page.getByLabel('Nome da vitrine').fill('Nome Novo')
  const novo = uniqueSubdomain('novo')
  await page.getByLabel('Endereço da vitrine', { exact: true }).fill(novo)
  await page.getByRole('button', { name: 'Salvar configurações' }).click()
  await expect(page.getByText('Confirme que o link antigo vai parar de funcionar.')).toBeVisible()
  await page.getByLabel('Entendi que o link antigo vai parar de funcionar').check()
  await page.getByRole('button', { name: 'Salvar configurações' }).click()
  await expect(page.getByText('Configurações salvas.')).toBeVisible()

  await page.getByRole('link', { name: 'Sacola e mensagens' }).click()
  await page.getByLabel('Texto padrão do botão').fill('Quero este')
  await page.getByRole('button', { name: 'Salvar mensagens' }).click()
  await expect(page.getByText('Mensagens salvas.')).toBeVisible()

  await page.getByRole('link', { name: 'WhatsApp' }).click()
  await page.getByLabel('Nome do novo contato').fill('Loja 2')
  await page.getByLabel('Número do novo contato').fill('(21) 99876-5432')
  await page.getByRole('button', { name: 'Adicionar contato' }).click()
  await expect(page.getByText('Contato salvo.')).toBeVisible()
  await page.getByRole('button', { name: 'Tornar principal' }).click()
  await expect(page.getByText('Contato principal alterado.')).toBeVisible()
  await page.getByRole('button', { name: 'Remover' }).click()
  await expect(page.getByText('Contato removido.')).toBeVisible()
})

test('aparência: marca bloqueada no gratuito e liberada no Pro', async ({ page }) => {
  const user = await createConfirmedUser('aparencia')
  const vitrine = await seedVitrine(user.id)
  await signIn(page, user.email, user.password)

  await page.goto(`/painel/vitrines/${vitrine.id}/aparencia`)
  await expect(page.getByText('Recurso do plano Pro')).toBeVisible()
  await expect(page.getByLabel('Cor da marca')).toBeDisabled()
  await page.getByLabel('Escuro').check()
  await page.getByRole('button', { name: 'Salvar aparência' }).click()
  await expect(page.getByText('Aparência salva.')).toBeVisible()

  await setPlan(user.id, 'pro')
  await page.reload()
  await expect(page.getByLabel('Cor da marca')).toBeEnabled()
})

test('excluir vitrine pede o endereço', async ({ page }) => {
  const user = await createConfirmedUser('excluir')
  const vitrine = await seedVitrine(user.id)
  await signIn(page, user.email, user.password)

  await page.goto(`/painel/vitrines/${vitrine.id}/configuracoes`)
  await page.getByRole('button', { name: 'Excluir definitivamente' }).click()
  await expect(page.getByText('Digite o endereço da vitrine para confirmar.').last()).toBeVisible()
  await page.getByLabel('Digite o endereço da vitrine para confirmar').fill(vitrine.subdomain)
  await page.getByRole('button', { name: 'Excluir definitivamente' }).click()
  await expect(page).toHaveURL(/\/painel$/)
  await expect(page.getByText('Você ainda não tem vitrines')).toBeVisible()
})
```

A etiqueta do campo e a mensagem de erro de exclusão têm o mesmo texto; por isso o `.last()`.

- [ ] **Step 6: Commit, PR e merge do bloco**

```bash
npm run lint && npm run typecheck && npm test
git add -A src e2e
git commit -m "feat(painel): editor da vitrine com configurações, mensagens, WhatsApp e aparência"
git push -u origin HEAD
gh pr create --fill --base master
gh pr checks --watch
```

**Fim do Bloco 4:** confirmar `SUPABASE_SECRET_KEY` na Vercel → autorização → merge → redeploy se a variável foi criada agora. Conferência na nuvem: em `app.agenn.com.br`, criar uma vitrine real pelo assistente, trocar o nome em Configurações e adicionar um segundo WhatsApp. (A vitrine pública ainda responde "Vitrine não encontrada" até o Bloco 7.)

---

# Bloco 5 — Imagens

Branch: `fase-2/bloco-5-imagens`.

```bash
npm install image-size react-easy-crop
```

**Antes do merge (usuário), no Bunny:**
1. **Storage → Add Storage Zone**: nome `agenn-vitrine-img`, região principal **São Paulo (BR)**, sem replicação. Anotar a **senha** (FTP & API Access → Password).
2. **CDN → Add Pull Zone** ligada a essa Storage Zone, rede **Volume**. Em **Caching**: "Cache expiration time" = 1 ano, "Browser cache expiration" = 1 ano (arquivos imutáveis; trocar imagem gera outro nome). Anotar o host `https://agenn-vitrine-img.b-cdn.net`.
3. Na Vercel (Production): `MEDIA_STORAGE_DRIVER=bunny`, `BUNNY_STORAGE_ZONE=agenn-vitrine-img`, `BUNNY_STORAGE_PASSWORD=<senha>`, `BUNNY_STORAGE_HOST=br.storage.bunnycdn.com`, `NEXT_PUBLIC_MEDIA_BASE_URL=https://agenn-vitrine-img.b-cdn.net`.
4. Em **Account → Billing**, configurar o alerta de gasto (spec 6.4).

Esses passos entram em `docs/setup/fase-2-infra.md` (Task 16, Step 6).

### Task 14: Regras de imagem (puras)

**Files:**
- Create: `src/lib/media/image-specs.ts`, `src/lib/media/image-specs.test.ts`, `src/lib/media/validate-image.ts`, `src/lib/media/validate-image.test.ts`, `src/lib/media/urls.ts`, `src/lib/media/urls.test.ts`

**Interfaces:**
- Produces:
  - `type ImageRole = 'cover' | 'gallery' | 'logo' | 'banner'`
  - `IMAGE_SPECS: Record<ImageRole, { aspect: readonly [number, number]; widths: readonly [number, number]; maxBytes: readonly [number, number] }>`
  - `heightFor(role: ImageRole, width: number): number`
  - `type ImageFormat = { ext: 'webp' | 'jpg'; contentType: 'image/webp' | 'image/jpeg' }`
  - `sniffImageFormat(bytes: Uint8Array): ImageFormat | null`
  - `validateImageFile(bytes: Uint8Array, expected: { width: number; height: number; maxBytes: number }): { ok: true; format: ImageFormat } | { ok: false; reason: 'size' | 'type' | 'dimensions' }`
  - `mediaUrl(path: string, baseUrl: string): string`
  - `storagePathList(storagePaths: unknown): string[]`
  - `imageSources(storagePaths: unknown, baseUrl: string): { small: string; large: string; smallWidth: number; largeWidth: number } | null`

- [ ] **Step 1: Testes (falhando)**

`src/lib/media/image-specs.test.ts`:

```ts
import { expect, it } from 'vitest'
import { heightFor, IMAGE_SPECS } from './image-specs'

it('tamanhos por papel (spec 6.1)', () => {
  expect(IMAGE_SPECS.cover.widths).toEqual([480, 1080])
  expect([heightFor('cover', 480), heightFor('cover', 1080)]).toEqual([600, 1350])
  expect([heightFor('banner', 960), heightFor('banner', 1920)]).toEqual([540, 1080])
  expect([heightFor('logo', 128), heightFor('logo', 512)]).toEqual([128, 512])
})
```

`src/lib/media/validate-image.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { sniffImageFormat, validateImageFile } from './validate-image'

const ascii = (text: string) => Array.from(text, (char) => char.charCodeAt(0))

// WebP sem perdas (VP8L) mínimo, só com o cabeçalho de dimensões.
function fakeWebp(width: number, height: number) {
  const bytes = new Uint8Array(30)
  const view = new DataView(bytes.buffer)
  bytes.set(ascii('RIFF'), 0)
  view.setUint32(4, 22, true)
  bytes.set(ascii('WEBP'), 8)
  bytes.set(ascii('VP8L'), 12)
  view.setUint32(16, 10, true)
  bytes[20] = 0x2f
  view.setUint32(21, (width - 1) | ((height - 1) << 14), true)
  return bytes
}

// JPEG mínimo: SOI, APP0 e SOF0 com as dimensões.
function fakeJpeg(width: number, height: number) {
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x10, ...ascii('JFIF'), 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff,
    0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
    0xff, 0xd9,
  ])
}

describe('sniffImageFormat', () => {
  it('reconhece WebP e JPEG pelos bytes', () => {
    expect(sniffImageFormat(fakeWebp(480, 600))).toEqual({ ext: 'webp', contentType: 'image/webp' })
    expect(sniffImageFormat(fakeJpeg(480, 600))).toEqual({ ext: 'jpg', contentType: 'image/jpeg' })
    expect(sniffImageFormat(new Uint8Array(ascii('<svg></svg>')))).toBeNull()
  })
})

describe('validateImageFile', () => {
  const expected = { width: 480, height: 600, maxBytes: 300_000 }

  it('aceita dimensões exatas', () => {
    expect(validateImageFile(fakeWebp(480, 600), expected)).toMatchObject({ ok: true })
    expect(validateImageFile(fakeJpeg(480, 600), expected)).toMatchObject({ ok: true })
  })

  it('recusa dimensões, tipo e tamanho errados', () => {
    expect(validateImageFile(fakeWebp(480, 601), expected)).toEqual({ ok: false, reason: 'dimensions' })
    expect(validateImageFile(new Uint8Array(ascii('GIF89a......')), expected)).toEqual({ ok: false, reason: 'type' })
    expect(validateImageFile(fakeWebp(480, 600), { ...expected, maxBytes: 10 })).toEqual({ ok: false, reason: 'size' })
  })
})
```

`src/lib/media/urls.test.ts`:

```ts
import { expect, it } from 'vitest'
import { imageSources, mediaUrl, storagePathList } from './urls'

const paths = { '1080': 'u/v/m-1080.webp', '480': 'u/v/m-480.webp' }

it('monta URLs públicas', () => {
  expect(mediaUrl('u/v/m-480.webp', 'https://cdn.exemplo.com')).toBe('https://cdn.exemplo.com/u/v/m-480.webp')
  expect(mediaUrl('/u/a.webp', '/api/dev-media/')).toBe('/api/dev-media/u/a.webp')
})

it('lista caminhos e escolhe menor e maior', () => {
  expect(storagePathList(paths).sort()).toEqual(['u/v/m-1080.webp', 'u/v/m-480.webp'])
  expect(storagePathList(null)).toEqual([])
  expect(imageSources(paths, 'https://cdn.exemplo.com')).toEqual({
    small: 'https://cdn.exemplo.com/u/v/m-480.webp',
    large: 'https://cdn.exemplo.com/u/v/m-1080.webp',
    smallWidth: 480,
    largeWidth: 1080,
  })
  expect(imageSources({}, 'x')).toBeNull()
})
```

Run: `npm test -- src/lib/media` → FAIL.

- [ ] **Step 2: Implementação**

`src/lib/media/image-specs.ts`:

```ts
export type ImageRole = 'cover' | 'gallery' | 'logo' | 'banner'

type ImageSpec = {
  aspect: readonly [number, number]
  widths: readonly [number, number]
  maxBytes: readonly [number, number]
}

export const IMAGE_SPECS: Record<ImageRole, ImageSpec> = {
  cover: { aspect: [4, 5], widths: [480, 1080], maxBytes: [400_000, 1_500_000] },
  gallery: { aspect: [4, 5], widths: [480, 1080], maxBytes: [400_000, 1_500_000] },
  logo: { aspect: [1, 1], widths: [128, 512], maxBytes: [100_000, 600_000] },
  banner: { aspect: [16, 9], widths: [960, 1920], maxBytes: [600_000, 2_500_000] },
}

export function heightFor(role: ImageRole, width: number): number {
  const [w, h] = IMAGE_SPECS[role].aspect
  return Math.round((width * h) / w)
}
```

`src/lib/media/validate-image.ts`:

```ts
import { imageSize } from 'image-size'

export type ImageFormat = { ext: 'webp' | 'jpg'; contentType: 'image/webp' | 'image/jpeg' }

const text = (bytes: Uint8Array, start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end))

export function sniffImageFormat(bytes: Uint8Array): ImageFormat | null {
  if (bytes.length >= 12 && text(bytes, 0, 4) === 'RIFF' && text(bytes, 8, 12) === 'WEBP') {
    return { ext: 'webp', contentType: 'image/webp' }
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ext: 'jpg', contentType: 'image/jpeg' }
  }
  return null
}

export function validateImageFile(
  bytes: Uint8Array,
  expected: { width: number; height: number; maxBytes: number },
): { ok: true; format: ImageFormat } | { ok: false; reason: 'size' | 'type' | 'dimensions' } {
  if (bytes.length > expected.maxBytes) return { ok: false, reason: 'size' }
  const format = sniffImageFormat(bytes)
  if (!format) return { ok: false, reason: 'type' }
  let size: { width?: number; height?: number }
  try {
    size = imageSize(bytes)
  } catch {
    return { ok: false, reason: 'type' }
  }
  if (size.width !== expected.width || size.height !== expected.height) return { ok: false, reason: 'dimensions' }
  return { ok: true, format }
}
```

Se o `image-size` instalado não reconhecer os cabeçalhos mínimos dos testes, o erro aparece como `reason: 'type'` nos casos válidos. Nesse caso, confira em `node_modules/image-size/dist` os offsets lidos para VP8L e SOF0 e ajuste **os geradores do teste** (não a validação).

`src/lib/media/urls.ts`:

```ts
export function mediaUrl(path: string, baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

function entries(storagePaths: unknown): [number, string][] {
  if (!storagePaths || typeof storagePaths !== 'object') return []
  return Object.entries(storagePaths as Record<string, unknown>)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && Number.isFinite(Number(entry[0])))
    .map(([width, path]) => [Number(width), path] as [number, string])
    .sort((a, b) => a[0] - b[0])
}

export function storagePathList(storagePaths: unknown): string[] {
  return entries(storagePaths).map(([, path]) => path)
}

export function imageSources(storagePaths: unknown, baseUrl: string) {
  const list = entries(storagePaths)
  if (list.length === 0) return null
  const [smallWidth, small] = list[0]
  const [largeWidth, large] = list[list.length - 1]
  return { small: mediaUrl(small, baseUrl), large: mediaUrl(large, baseUrl), smallWidth, largeWidth }
}
```

Run: `npm test -- src/lib/media` → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/media package.json package-lock.json
git commit -m "feat(midia): tamanhos, validação de imagem e URLs públicas"
```

---

### Task 15: Armazenamento e rotas de mídia

**Files:**
- Create: `src/lib/media/storage.ts`, `src/lib/media/bunny-storage.ts`, `src/lib/media/fake-storage.ts`, `src/lib/media/remove-media.ts`, `src/app/api/media/image/route.ts`, `src/app/api/media/[id]/route.ts`, `src/app/api/dev-media/[...path]/route.ts`
- Modify: `src/lib/monitoring/sentry-noop.ts`, `src/features/vitrines/actions.ts` (`deleteVitrineAction`)

**Interfaces:**
- Produces:
  - `interface MediaStorage { put(path, body: Uint8Array, contentType): Promise<void>; get(path): Promise<Uint8Array | null>; remove(path): Promise<void> }`
  - `getMediaStorage(): MediaStorage`
  - `removeStoredFiles(paths: string[]): Promise<void>` (falhas vão ao Sentry, não lançam)
  - `deleteMediaRows(admin, rows: { id: string; storage_paths: unknown }[]): Promise<void>`
  - `copyMediaFiles(storagePaths: unknown, newPrefix: string): Promise<Record<string, string>>`
  - `POST /api/media/image` — `multipart/form-data`: `role`, `vitrineId`, `itemId?`, `position?` (1|2 na galeria), `small`, `large` → `201 { id, url }` | `4xx/5xx { error }`
  - `DELETE /api/media/{id}` → `204` | `409 { error }` (capa de item salvo)
  - `GET /api/dev-media/{...path}` (só com driver `fake`)

- [ ] **Step 1: Drivers**

`src/lib/media/storage.ts`:

```ts
import 'server-only'
import { getMediaStorageEnv } from '@/lib/server-env'
import { createBunnyStorage } from './bunny-storage'
import { createFakeStorage } from './fake-storage'

export interface MediaStorage {
  put(path: string, body: Uint8Array, contentType: string): Promise<void>
  get(path: string): Promise<Uint8Array | null>
  remove(path: string): Promise<void>
}

export function getMediaStorage(): MediaStorage {
  const config = getMediaStorageEnv()
  return config.driver === 'fake' ? createFakeStorage() : createBunnyStorage(config)
}
```

`src/lib/media/bunny-storage.ts`:

```ts
import 'server-only'
import type { MediaStorage } from './storage'

export function createBunnyStorage(config: { zone: string; password: string; host: string }): MediaStorage {
  const url = (path: string) => `https://${config.host}/${config.zone}/${path}`
  const headers = { AccessKey: config.password }
  return {
    async put(path, body, contentType) {
      const response = await fetch(url(path), {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': contentType },
        body: new Uint8Array(body),
      })
      if (!response.ok) throw new Error(`Bunny Storage PUT ${response.status} ${path}`)
    },
    async get(path) {
      const response = await fetch(url(path), { headers })
      if (response.status === 404) return null
      if (!response.ok) throw new Error(`Bunny Storage GET ${response.status} ${path}`)
      return new Uint8Array(await response.arrayBuffer())
    },
    async remove(path) {
      const response = await fetch(url(path), { method: 'DELETE', headers })
      if (!response.ok && response.status !== 404) throw new Error(`Bunny Storage DELETE ${response.status} ${path}`)
    },
  }
}
```

`src/lib/media/fake-storage.ts`:

```ts
import 'server-only'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { MediaStorage } from './storage'

// Só CI e desenvolvimento: grava no diretório temporário do sistema.
const ROOT = path.join(os.tmpdir(), 'agenn-vitrine-media')

export function resolveFakePath(relative: string): string {
  const full = path.resolve(ROOT, relative)
  if (!full.startsWith(ROOT + path.sep)) throw new Error('Caminho de mídia inválido')
  return full
}

export function createFakeStorage(): MediaStorage {
  return {
    async put(relative, body) {
      const full = resolveFakePath(relative)
      await mkdir(path.dirname(full), { recursive: true })
      await writeFile(full, body)
    },
    async get(relative) {
      try {
        return new Uint8Array(await readFile(resolveFakePath(relative)))
      } catch {
        return null
      }
    },
    async remove(relative) {
      await rm(resolveFakePath(relative), { force: true })
    },
  }
}
```

`src/lib/media/remove-media.ts`:

```ts
import 'server-only'
import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { getMediaStorage } from './storage'
import { storagePathList } from './urls'

export async function removeStoredFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  const storage = getMediaStorage()
  const results = await Promise.allSettled(paths.map((path) => storage.remove(path)))
  // Arquivo que ficou para trás é removido pela limpeza diária de órfãos (Fase 3).
  for (const result of results) if (result.status === 'rejected') Sentry.captureException(result.reason)
}

export async function deleteMediaRows(
  admin: SupabaseClient<Database>,
  rows: ReadonlyArray<{ id: string; storage_paths: unknown }>,
): Promise<void> {
  if (rows.length === 0) return
  const { error } = await admin.from('media').delete().in('id', rows.map((row) => row.id))
  if (error) throw error
  await removeStoredFiles(rows.flatMap((row) => storagePathList(row.storage_paths)))
}

// Duplicar item: cada cópia tem arquivos próprios.
export async function copyMediaFiles(storagePaths: unknown, newPrefix: string): Promise<Record<string, string>> {
  const storage = getMediaStorage()
  const copied: Record<string, string> = {}
  for (const [width, path] of Object.entries((storagePaths ?? {}) as Record<string, string>)) {
    const bytes = await storage.get(path)
    if (!bytes) throw new Error(`Arquivo de mídia ausente: ${path}`)
    const ext = path.endsWith('.jpg') ? 'jpg' : 'webp'
    const target = `${newPrefix}-${width}.${ext}`
    await storage.put(target, bytes, ext === 'jpg' ? 'image/jpeg' : 'image/webp')
    copied[width] = target
  }
  return copied
}
```

Em `src/lib/monitoring/sentry-noop.ts` acrescente:

```ts
export const captureException: SentrySdk['captureException'] = () => ''
```

- [ ] **Step 2: Upload de imagem**

`src/app/api/media/image/route.ts`:

```ts
import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getApiUser } from '@/lib/auth/require-user'
import { env } from '@/lib/env'
import { heightFor, IMAGE_SPECS } from '@/lib/media/image-specs'
import { deleteMediaRows, removeStoredFiles } from '@/lib/media/remove-media'
import { getMediaStorage } from '@/lib/media/storage'
import { imageSources } from '@/lib/media/urls'
import { validateImageFile } from '@/lib/media/validate-image'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { revalidateVitrine } from '@/lib/vitrines/cache'

const fieldsSchema = z
  .object({
    role: z.enum(['cover', 'gallery', 'logo', 'banner']),
    vitrineId: z.uuid(),
    itemId: z.uuid().nullable(),
    position: z.coerce.number().int().min(1).max(2).nullable(),
  })
  .refine((value) => value.role !== 'gallery' || value.position !== null)
  .refine((value) => (value.role === 'logo' || value.role === 'banner' ? value.itemId === null : true))

const REASON_MESSAGE = {
  size: 'Imagem grande demais. Tente outra foto.',
  type: 'Formato não suportado. Envie uma foto JPG, PNG ou WebP.',
  dimensions: 'Não foi possível processar a imagem. Tente novamente.',
} as const

const fail = (status: number, error: string) => NextResponse.json({ error }, { status })

export async function POST(request: Request) {
  const session = await getApiUser()
  if (!session) return fail(401, 'Sua sessão expirou. Entre novamente.')

  const form = await request.formData()
  const text = (key: string) => {
    const value = form.get(key)
    return typeof value === 'string' && value !== '' ? value : null
  }
  const parsed = fieldsSchema.safeParse({
    role: text('role'),
    vitrineId: text('vitrineId'),
    itemId: text('itemId'),
    position: text('position'),
  })
  if (!parsed.success) return fail(400, 'Dados do envio inválidos.')
  const { role, vitrineId, itemId, position } = parsed.data
  const { supabase, userId } = session

  const { data: vitrine } = await supabase.from('vitrines').select('id, subdomain').eq('id', vitrineId).maybeSingle()
  if (!vitrine) return fail(404, 'Vitrine não encontrada.')
  if (itemId) {
    const { data: item } = await supabase
      .from('items')
      .select('id')
      .eq('id', itemId)
      .eq('vitrine_id', vitrineId)
      .is('deleted_at', null)
      .maybeSingle()
    if (!item) return fail(404, 'Item não encontrado.')
  }
  if (role === 'logo' || role === 'banner') {
    const { data: plan } = await supabase.rpc('my_entitlements')
    if (!plan?.allow_branding) return fail(403, 'Logo e banner são recursos do plano Pro.')
  }

  const spec = IMAGE_SPECS[role]
  const files: { width: number; bytes: Uint8Array; ext: string; contentType: string }[] = []
  for (const [index, key] of (['small', 'large'] as const).entries()) {
    const file = form.get(key)
    if (!(file instanceof File)) return fail(400, 'Arquivo ausente.')
    const width = spec.widths[index]
    const bytes = new Uint8Array(await file.arrayBuffer())
    const result = validateImageFile(bytes, { width, height: heightFor(role, width), maxBytes: spec.maxBytes[index] })
    if (!result.ok) return fail(422, REASON_MESSAGE[result.reason])
    files.push({ width, bytes, ext: result.format.ext, contentType: result.format.contentType })
  }

  const mediaId = crypto.randomUUID()
  const storagePaths = Object.fromEntries(
    files.map((file) => [String(file.width), `${userId}/${vitrineId}/${mediaId}-${file.width}.${file.ext}`]),
  )
  const storage = getMediaStorage()
  try {
    await Promise.all(files.map((file) => storage.put(storagePaths[String(file.width)], file.bytes, file.contentType)))
  } catch (error) {
    Sentry.captureException(error)
    await removeStoredFiles(Object.values(storagePaths))
    return fail(502, 'Não foi possível enviar a imagem. Tente novamente.')
  }

  const admin = createSupabaseAdminClient()

  // Mídia que ocupa o mesmo espaço (capa, posição da galeria, logo ou banner) é substituída.
  let previousQuery = admin.from('media').select('id, storage_paths').eq('vitrine_id', vitrineId).eq('role', role)
  if (itemId) previousQuery = previousQuery.eq('item_id', itemId)
  if (role === 'gallery') previousQuery = previousQuery.eq('position', position!)
  const { data: previous } = itemId || role === 'logo' || role === 'banner' ? await previousQuery : { data: [] }

  const large = files[files.length - 1]
  const insertRow = {
    id: mediaId,
    owner_id: userId,
    vitrine_id: vitrineId,
    item_id: itemId,
    role,
    kind: 'image' as const,
    position: role === 'gallery' ? position! : 0,
    storage_paths: storagePaths,
    width: large.width,
    height: heightFor(role, large.width),
    bytes: files.reduce((sum, file) => sum + file.bytes.length, 0),
    status: 'ready' as const,
  }

  try {
    await deleteMediaRows(admin, previous ?? [])
    const { error } = await admin.from('media').insert(insertRow)
    if (error) throw error
    if (role === 'logo' || role === 'banner') {
      const link = role === 'logo' ? { logo_media_id: mediaId } : { banner_media_id: mediaId }
      const { error: linkError } = await admin.from('vitrines').update(link).eq('id', vitrineId)
      if (linkError) throw linkError
    }
  } catch (error) {
    Sentry.captureException(error)
    await removeStoredFiles(Object.values(storagePaths))
    return fail(500, 'Não foi possível salvar a imagem. Tente novamente.')
  }

  if (itemId || role === 'logo' || role === 'banner') revalidateVitrine(vitrine.subdomain)
  const sources = imageSources(storagePaths, env.NEXT_PUBLIC_MEDIA_BASE_URL)
  return NextResponse.json({ id: mediaId, url: sources?.small }, { status: 201 })
}
```

Imagens de item novo (`itemId` nulo) ficam pendentes até o item ser salvo (Task 19) e não substituem nada.

- [ ] **Step 3: Remover mídia e servir o driver fake**

`src/app/api/media/[id]/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { getApiUser } from '@/lib/auth/require-user'
import { deleteMediaRows } from '@/lib/media/remove-media'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { revalidateVitrine } from '@/lib/vitrines/cache'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiUser()
  if (!session) return NextResponse.json({ error: 'Sua sessão expirou. Entre novamente.' }, { status: 401 })
  const { id } = await params

  // RLS: só encontra mídia do próprio dono.
  const { data: media } = await session.supabase
    .from('media')
    .select('id, role, item_id, storage_paths, vitrines(subdomain)')
    .eq('id', id)
    .maybeSingle()
  if (!media) return new NextResponse(null, { status: 204 })
  if (media.role === 'cover' && media.item_id) {
    return NextResponse.json({ error: 'A capa é obrigatória. Envie outra imagem para trocar.' }, { status: 409 })
  }

  await deleteMediaRows(createSupabaseAdminClient(), [media])
  const subdomain = (media.vitrines as { subdomain: string } | null)?.subdomain
  if (subdomain && (media.item_id || media.role === 'logo' || media.role === 'banner')) revalidateVitrine(subdomain)
  return new NextResponse(null, { status: 204 })
}
```

`src/app/api/dev-media/[...path]/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { getMediaStorageEnv } from '@/lib/server-env'
import { createFakeStorage } from '@/lib/media/fake-storage'

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (getMediaStorageEnv().driver !== 'fake') return new NextResponse(null, { status: 404 })
  const { path } = await params
  const relative = path.join('/')
  let bytes: Uint8Array | null = null
  try {
    bytes = await createFakeStorage().get(relative)
  } catch {
    bytes = null
  }
  if (!bytes) return new NextResponse(null, { status: 404 })
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': relative.endsWith('.jpg') ? 'image/jpeg' : 'image/webp',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
```

- [ ] **Step 4: Excluir vitrine apaga os arquivos**

Em `deleteVitrineAction`, antes do `delete` da vitrine, troque o comentário do Bloco 5 por:

```ts
  const admin = createSupabaseAdminClient()
  const { data: mediaRows } = await admin.from('media').select('storage_paths').eq('vitrine_id', vitrineId)
  const paths = (mediaRows ?? []).flatMap((row) => storagePathList(row.storage_paths))
```

e, depois do `delete` bem-sucedido, `await removeStoredFiles(paths)`. Imports: `createSupabaseAdminClient`, `storagePathList`, `removeStoredFiles`.

- [ ] **Step 5: Commit**

```bash
npm run lint && npm run typecheck && npm test
git add -A src package.json package-lock.json
git commit -m "feat(midia): Bunny Storage, driver fake e rotas de envio e remoção de imagens"
```

---

### Task 16: Recorte no navegador, logo e banner

**Files:**
- Create: `src/lib/media/render-crop.ts`, `src/components/media/image-cropper.tsx`, `src/components/media/image-slot.tsx`, `e2e/media.spec.ts`, `docs/setup/fase-2-infra.md`
- Modify: `.../[id]/aparencia/page.tsx`, `appearance-form.tsx`, `e2e/helpers.ts`

**Interfaces:**
- Produces:
  - `type PixelCrop = { x: number; y: number; width: number; height: number }`
  - `renderCrop(file: Blob, crop: PixelCrop, role: ImageRole): Promise<[Blob, Blob]>`
  - `<ImageCropper imageUrl aspect onCancel onConfirm(crop: PixelCrop) />`
  - `<ImageSlot label role vitrineId itemId? position? initial={{ id, url } | null} removable? disabled? onChange?(media | null) />`
  - e2e: `makeTestImage(page, width?, height?): Promise<Buffer>`
- Textos usados pelos testes: input de arquivo com `aria-label` = `label` do slot (ex.: `Logo`, `Banner`, `Capa`, `Imagem 2`, `Imagem 3`); botões `Usar imagem`, `Cancelar`, `Remover imagem`; imagem de prévia com `alt` = `label`; status `Enviando…`.

- [ ] **Step 1: Recorte e conversão**

`src/lib/media/render-crop.ts`:

```ts
import { heightFor, IMAGE_SPECS, type ImageRole } from './image-specs'

export type PixelCrop = { x: number; y: number; width: number; height: number }

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, 0.85))
}

// WebP quando o navegador codifica; senão (Safari) JPEG. O servidor aceita os dois.
async function encode(canvas: HTMLCanvasElement): Promise<Blob> {
  const webp = await toBlob(canvas, 'image/webp')
  if (webp?.type === 'image/webp') return webp
  const jpeg = await toBlob(canvas, 'image/jpeg')
  if (!jpeg) throw new Error('Não foi possível converter a imagem.')
  return jpeg
}

export async function renderCrop(file: Blob, crop: PixelCrop, role: ImageRole): Promise<[Blob, Blob]> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const blobs: Blob[] = []
    for (const width of IMAGE_SPECS[role].widths) {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = heightFor(role, width)
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Canvas indisponível.')
      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'
      context.drawImage(bitmap, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height)
      blobs.push(await encode(canvas))
    }
    return [blobs[0], blobs[1]]
  } finally {
    bitmap.close()
  }
}
```

- [ ] **Step 2: Recortador**

`src/components/media/image-cropper.tsx`:

```tsx
'use client'

import { useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { Button } from '@/components/ui/button'
import type { PixelCrop } from '@/lib/media/render-crop'

export function ImageCropper(props: {
  imageUrl: string
  aspect: number
  onCancel: () => void
  onConfirm: (crop: PixelCrop) => void
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState<Area | null>(null)

  return (
    <div role="dialog" aria-modal="true" aria-label="Recortar imagem" className="fixed inset-0 z-50 flex flex-col bg-black/80 p-4">
      <div className="relative flex-1">
        <Cropper
          image={props.imageUrl}
          crop={crop}
          zoom={zoom}
          aspect={props.aspect}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={(_, pixels) => setArea(pixels)}
        />
      </div>
      <div className="mx-auto flex w-full max-w-md flex-col gap-3 pt-4">
        <label className="flex items-center gap-3 text-white">
          Zoom
          <input type="range" min={1} max={3} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1" />
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={props.onCancel}>
            Cancelar
          </Button>
          <Button disabled={!area} onClick={() => area && props.onConfirm(area)}>
            Usar imagem
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Espaço de imagem**

`src/components/media/image-slot.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { IMAGE_SPECS, type ImageRole } from '@/lib/media/image-specs'
import { renderCrop, type PixelCrop } from '@/lib/media/render-crop'
import { ImageCropper } from './image-cropper'

type SlotMedia = { id: string; url: string }

export function ImageSlot(props: {
  label: string
  role: ImageRole
  vitrineId: string
  itemId?: string | null
  position?: 1 | 2
  initial: SlotMedia | null
  removable?: boolean
  disabled?: boolean
  onChange?: (media: SlotMedia | null) => void
}) {
  const [media, setMedia] = useState<SlotMedia | null>(props.initial)
  const [source, setSource] = useState<{ file: File; url: string } | null>(null)
  const [status, setStatus] = useState<'idle' | 'sending'>('idle')
  const [error, setError] = useState<string | null>(null)
  const spec = IMAGE_SPECS[props.role]

  function update(next: SlotMedia | null) {
    setMedia(next)
    props.onChange?.(next)
  }

  async function upload(crop: PixelCrop) {
    if (!source) return
    const file = source.file
    URL.revokeObjectURL(source.url)
    setSource(null)
    setError(null)
    if (crop.width < spec.widths[0]) {
      setError(`Imagem muito pequena. Use pelo menos ${spec.widths[0]} px de largura.`)
      return
    }
    setStatus('sending')
    try {
      const [small, large] = await renderCrop(file, crop, props.role)
      const body = new FormData()
      body.set('role', props.role)
      body.set('vitrineId', props.vitrineId)
      if (props.itemId) body.set('itemId', props.itemId)
      if (props.position) body.set('position', String(props.position))
      body.set('small', small, 'small')
      body.set('large', large, 'large')
      const response = await fetch('/api/media/image', { method: 'POST', body })
      const result = (await response.json().catch(() => ({}))) as { id?: string; url?: string; error?: string }
      if (!response.ok || !result.id || !result.url) {
        setError(result.error ?? 'Não foi possível enviar a imagem. Tente novamente.')
        return
      }
      update({ id: result.id, url: result.url })
    } catch {
      setError('Conexão caiu. Tente enviar de novo.')
    } finally {
      setStatus('idle')
    }
  }

  async function remove() {
    if (!media) return
    const response = await fetch(`/api/media/${media.id}`, { method: 'DELETE' })
    if (response.status === 204) update(null)
    else setError(((await response.json().catch(() => ({}))) as { error?: string }).error ?? 'Não foi possível remover.')
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{props.label}</span>
      {media ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={media.url} alt={props.label} className="w-32 rounded-control border border-line object-cover" />
      ) : null}
      <input
        type="file"
        accept="image/*"
        aria-label={props.label}
        disabled={props.disabled || status === 'sending'}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) setSource({ file, url: URL.createObjectURL(file) })
        }}
      />
      {status === 'sending' ? <p className="text-sm" aria-live="polite">Enviando…</p> : null}
      {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
      {media && props.removable ? (
        <Button variant="ghost" onClick={remove} className="self-start">
          Remover imagem
        </Button>
      ) : null}
      {source ? (
        <ImageCropper
          imageUrl={source.url}
          aspect={spec.aspect[0] / spec.aspect[1]}
          onCancel={() => {
            URL.revokeObjectURL(source.url)
            setSource(null)
          }}
          onConfirm={upload}
        />
      ) : null}
    </div>
  )
}
```

- [ ] **Step 4: Logo e banner na Aparência**

`aparencia/page.tsx` busca (cliente do usuário) as mídias `logo` e `banner` da vitrine e monta `{ id, url }` com `imageSources(...).small`. `appearance-form.tsx` coloca, dentro da área Pro e fora do `<form>` (o envio é imediato), `<ImageSlot label="Logo" role="logo" … removable disabled={!plan.allow_branding} />` e `<ImageSlot label="Banner" role="banner" … removable disabled={!plan.allow_branding} />`.

- [ ] **Step 5: e2e**

Acrescente em `e2e/helpers.ts`:

```ts
export async function makeTestImage(page: Page, width = 1200, height = 1500): Promise<Buffer> {
  const dataUrl = await page.evaluate(
    ([w, h]) => {
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const context = canvas.getContext('2d')!
      context.fillStyle = '#0b2a1c'
      context.fillRect(0, 0, w, h)
      context.fillStyle = '#ffffff'
      context.fillRect(w / 4, h / 4, w / 2, h / 2)
      return canvas.toDataURL('image/png')
    },
    [width, height],
  )
  return Buffer.from(dataUrl.split(',')[1], 'base64')
}

export async function uploadImage(page: Page, label: string, image: Buffer) {
  await page.getByLabel(label, { exact: true }).setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: image })
  await page.getByRole('button', { name: 'Usar imagem' }).click()
  await expect(page.getByRole('img', { name: label, exact: true })).toBeVisible()
}
```

`e2e/media.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { createConfirmedUser, makeTestImage, seedVitrine, setPlan, signIn, uploadImage } from './helpers'

test('Pro envia logo e banner; gratuito vê bloqueado', async ({ page }) => {
  const user = await createConfirmedUser('logo')
  const vitrine = await seedVitrine(user.id)
  await signIn(page, user.email, user.password)

  await page.goto(`/painel/vitrines/${vitrine.id}/aparencia`)
  await expect(page.getByLabel('Logo', { exact: true })).toBeDisabled()

  await setPlan(user.id, 'pro')
  await page.reload()
  const image = await makeTestImage(page, 2000, 1200)
  await uploadImage(page, 'Logo', image)
  await uploadImage(page, 'Banner', image)

  await page.reload()
  await expect(page.getByRole('img', { name: 'Logo', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Remover imagem' }).first().click()
  await expect(page.getByRole('img', { name: 'Logo', exact: true })).toHaveCount(0)
})
```

- [ ] **Step 6: Guia de infraestrutura**

Crie `docs/setup/fase-2-infra.md` com as seções:
1. **Bunny Storage e Pull Zone** — os quatro passos do início deste bloco.
2. **Variáveis na Vercel (Production)** — tabela: `SUPABASE_SECRET_KEY`, `MEDIA_STORAGE_DRIVER=bunny`, `BUNNY_STORAGE_ZONE`, `BUNNY_STORAGE_PASSWORD`, `BUNNY_STORAGE_HOST`, `NEXT_PUBLIC_MEDIA_BASE_URL`, `RATE_LIMIT_SALT` (Bloco 7; gerar com `node -e "console.log(crypto.randomUUID()+crypto.randomUUID())"`). Lembrar do redeploy.
3. **GitHub** — segredo `SUPABASE_DB_URL` e o que cada job do CI faz.
4. **Riscos aceitos** — imagens enviadas e não salvas ficam órfãs até a limpeza diária (Fase 3); `MEDIA_STORAGE_DRIVER=fake` é recusado em produção.

- [ ] **Step 7: Commit, PR e merge do bloco**

```bash
npm run lint && npm run typecheck && npm test
git add -A src e2e docs
git commit -m "feat(midia): recorte e conversão no navegador, logo e banner na aparência"
git push -u origin HEAD
gh pr create --fill --base master
gh pr checks --watch
```

**Fim do Bloco 5:** confirmar Bunny e variáveis na Vercel → autorização → merge → redeploy. Conferência na nuvem: com uma conta marcada como Pro no Supabase dev (inserir linha em `subscriptions` com `plan_id='pro'`, `status='active'`), enviar um logo pelo celular; abrir a URL da imagem (`https://agenn-vitrine-img.b-cdn.net/...`) e conferir no Bunny **Storage → Files** os dois tamanhos.

---

# Bloco 6 — Categorias e itens

Branch: `fase-2/bloco-6-itens`.

### Task 17: Categorias

**Files:**
- Create: `src/features/categories/actions.ts`, `.../[id]/itens/category-manager.tsx`
- Modify: `.../[id]/itens/page.tsx`

**Interfaces:**
- Produces:
  - `addCategoryAction(vitrineId, prev, formData)` — campo `name`
  - `renameCategoryAction(vitrineId, categoryId, prev, formData)` — campo `name`
  - `moveCategoryAction(vitrineId, categoryId, direction: 'up' | 'down'): Promise<FormState>`
  - `deleteCategoryAction(vitrineId, categoryId): Promise<FormState>`
- Textos: `Nova categoria`, `Adicionar categoria`, `Nome da categoria`, `Renomear`, `Subir`, `Descer`, `Excluir categoria`, `Mova ou exclua os itens desta categoria antes.`

- [ ] **Step 1: Ações**

`src/features/categories/actions.ts`:

```ts
'use server'

import { redirect } from 'next/navigation'
import { requireActionUser } from '@/lib/auth/action-user'
import { fieldErrorsFromZod, readFormFields, type FormState } from '@/lib/forms/form-state'
import { revalidateVitrine } from '@/lib/vitrines/cache'
import { mapDbError } from '@/lib/vitrines/db-errors'
import { moveInList } from '@/lib/vitrines/reorder'
import { categoryNameSchema } from '@/lib/vitrines/schemas'

async function ownedVitrine(vitrineId: string) {
  const { supabase } = await requireActionUser()
  const { data: vitrine } = await supabase.from('vitrines').select('id, subdomain').eq('id', vitrineId).maybeSingle()
  if (!vitrine) redirect('/painel')
  return { supabase, vitrine }
}

export async function addCategoryAction(vitrineId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const fields = readFormFields(formData, ['name'])
  const parsed = categoryNameSchema.safeParse(fields)
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error), values: fields }
  const { supabase, vitrine } = await ownedVitrine(vitrineId)
  const { data: last } = await supabase
    .from('categories')
    .select('position')
    .eq('vitrine_id', vitrineId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  const { error } = await supabase
    .from('categories')
    .insert({ vitrine_id: vitrineId, name: parsed.data.name, position: (last?.position ?? -1) + 1 })
  if (error) return { error: mapDbError(error), values: fields }
  revalidateVitrine(vitrine.subdomain)
  return { success: 'Categoria adicionada.' }
}

export async function renameCategoryAction(
  vitrineId: string,
  categoryId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const fields = readFormFields(formData, ['name'])
  const parsed = categoryNameSchema.safeParse(fields)
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error), values: fields }
  const { supabase, vitrine } = await ownedVitrine(vitrineId)
  const { error } = await supabase
    .from('categories')
    .update({ name: parsed.data.name })
    .eq('id', categoryId)
    .eq('vitrine_id', vitrineId)
  if (error) return { error: mapDbError(error), values: fields }
  revalidateVitrine(vitrine.subdomain)
  return { success: 'Categoria renomeada.', values: fields }
}

export async function moveCategoryAction(vitrineId: string, categoryId: string, direction: 'up' | 'down'): Promise<FormState> {
  const { supabase, vitrine } = await ownedVitrine(vitrineId)
  const { data: categories } = await supabase
    .from('categories')
    .select('id')
    .eq('vitrine_id', vitrineId)
    .order('position')
    .order('created_at')
  const next = moveInList((categories ?? []).map((c) => c.id), categoryId, direction)
  if (!next) return {}
  const results = await Promise.all(
    next.map((id, position) => supabase.from('categories').update({ position }).eq('id', id)),
  )
  const failed = results.find((result) => result.error)
  if (failed?.error) return { error: mapDbError(failed.error) }
  revalidateVitrine(vitrine.subdomain)
  return {}
}

export async function deleteCategoryAction(vitrineId: string, categoryId: string): Promise<FormState> {
  const { supabase, vitrine } = await ownedVitrine(vitrineId)
  const { count } = await supabase
    .from('items')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', categoryId)
    .is('deleted_at', null)
  if ((count ?? 0) > 0) return { error: 'Mova ou exclua os itens desta categoria antes.' }
  const { error } = await supabase.from('categories').delete().eq('id', categoryId).eq('vitrine_id', vitrineId)
  if (error) return { error: mapDbError(error) }
  revalidateVitrine(vitrine.subdomain)
  return { success: 'Categoria excluída.' }
}
```

- [ ] **Step 2: Gerenciador**

`category-manager.tsx` (Client) recebe `vitrineId` e `categories: { id, name }[]`:
- Formulário `Nova categoria` (legenda) com campo `Nome da categoria` (`name`) e botão `Adicionar categoria`.
- Para cada categoria: formulário inline com `Input` (`aria-label="Nome da categoria {nome}"`) e botão `Renomear`; botões `Subir`, `Descer` (desabilitados no primeiro/último) e `Excluir categoria`, que chamam as ações com `useTransition` e mostram a mensagem de retorno (`FormMessage`). Após sucesso, `router.refresh()`.
- Fica recolhido em `<details><summary>Categorias</summary>` acima da lista de itens.

- [ ] **Step 3: Commit**

```bash
git add -A src
git commit -m "feat(itens): categorias com criar, renomear, ordenar e excluir"
```

---

### Task 18: Editor de item

**Files:**
- Create: `src/features/items/queries.ts`, `src/features/items/actions.ts`, `.../[id]/itens/item-form.tsx`, `.../[id]/itens/novo/page.tsx`, `.../[id]/itens/[itemId]/page.tsx`

**Interfaces:**
- Produces:
  - `getItemFormOptions(vitrineId)`: `{ vitrine: { id, type, subdomain }, categories: { id, name }[], contacts: { id, label }[], nextCode: string }`
  - `getItemForEdit(vitrineId, itemId)`: item + `variations` + `cover: { id, url } | null` + `gallery: [slot1 | null, slot2 | null]` (`notFound()` se não for do dono ou estiver excluído)
  - `saveItemAction(vitrineId, itemId: string | null, prev, formData)` → redireciona para `/painel/vitrines/{id}/itens?salvo=1`
  - `checkItemCodeAction(code: string, itemId: string | null): Promise<{ ok: boolean; message: string }>`
- Campos do formulário (`name`): `name`, `description`, `categoryId`, `code`, `codeAuto` (`1` enquanto o código sugerido não foi editado), `priceType`, `price`, `promoPrice`, `durationMinutes`, `tags`, `soldOut`, `whatsappId`, `buttonText`, `customMessage`, `variations` (JSON), `coverMediaId`, `galleryMediaIds` (JSON).
- Textos: `Novo item`, `Editar item`, `Capa`, `Imagem 2`, `Imagem 3`, `Nome`, `Descrição`, `Categoria`, `Código`, `Código disponível.`, `Tipo de preço` (opções `Preço fixo`, `A partir de`, `Sob consulta`), `Preço`, `Preço promocional`, `Duração (minutos)`, `Etiquetas`, `Esgotado`, `Variações`, `Adicionar variação`, `Nome da variação {n}`, `Preço da variação {n}`, `Preço promocional da variação {n}`, `Variação {n} esgotada`, `Remover variação {n}`, `Avançado`, `WhatsApp do item` (opção `Usar o principal`), `Texto do botão`, `Mensagem personalizada`, `Salvar item`, `Item salvo.`

- [ ] **Step 1: Consultas**

`src/features/items/queries.ts`:

```ts
import 'server-only'
import { notFound } from 'next/navigation'
import { getMyVitrine, getPanelSession } from '@/features/vitrines/queries'
import { env } from '@/lib/env'
import { imageSources } from '@/lib/media/urls'

export async function getItemFormOptions(vitrineId: string) {
  const vitrine = await getMyVitrine(vitrineId)
  const { supabase } = await getPanelSession()
  const [categories, contacts, nextCode] = await Promise.all([
    supabase.from('categories').select('id, name').eq('vitrine_id', vitrineId).order('position'),
    supabase.from('whatsapp_contacts').select('id, label').eq('vitrine_id', vitrineId).order('position'),
    supabase.rpc('peek_next_item_code'),
  ])
  return {
    vitrine: { id: vitrine.id, type: vitrine.type, subdomain: vitrine.subdomain },
    categories: categories.data ?? [],
    contacts: contacts.data ?? [],
    nextCode: nextCode.data ?? '',
  }
}

export async function getItemForEdit(vitrineId: string, itemId: string) {
  const { supabase } = await getPanelSession()
  const { data: item } = await supabase
    .from('items')
    .select('*, item_variations(id, name, price_cents, promo_price_cents, sold_out, position), media(id, role, position, storage_paths)')
    .eq('id', itemId)
    .eq('vitrine_id', vitrineId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!item) notFound()

  const toSlot = (row: { id: string; storage_paths: unknown } | undefined) => {
    const sources = row ? imageSources(row.storage_paths, env.NEXT_PUBLIC_MEDIA_BASE_URL) : null
    return row && sources ? { id: row.id, url: sources.small } : null
  }
  const media = item.media ?? []
  return {
    ...item,
    variations: [...(item.item_variations ?? [])].sort((a, b) => a.position - b.position),
    cover: toSlot(media.find((m) => m.role === 'cover')),
    gallery: [1, 2].map((position) => toSlot(media.find((m) => m.role === 'gallery' && m.position === position))) as [
      { id: string; url: string } | null,
      { id: string; url: string } | null,
    ],
  }
}
```

- [ ] **Step 2: Ações**

`src/features/items/actions.ts`:

```ts
'use server'

import { redirect } from 'next/navigation'
import { requireActionUser } from '@/lib/auth/action-user'
import { ITEM_CODE_MESSAGES, validateItemCode } from '@/lib/codes/item-code'
import { fieldErrorsFromZod, readFormFields, type FormState } from '@/lib/forms/form-state'
import { deleteMediaRows } from '@/lib/media/remove-media'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { revalidateVitrine } from '@/lib/vitrines/cache'
import { mapDbError } from '@/lib/vitrines/db-errors'
import { itemSchema, type ItemInput } from '@/lib/vitrines/schemas'

const ITEM_FIELDS = [
  'name', 'description', 'categoryId', 'code', 'priceType', 'price', 'promoPrice', 'durationMinutes', 'tags',
  'soldOut', 'whatsappId', 'buttonText', 'customMessage', 'variations', 'coverMediaId', 'galleryMediaIds',
] as const

export async function checkItemCodeAction(code: string, itemId: string | null): Promise<{ ok: boolean; message: string }> {
  const result = validateItemCode(code)
  if (!result.ok) return { ok: false, message: ITEM_CODE_MESSAGES[result.reason] }
  const { supabase } = await requireActionUser()
  const { data, error } = await supabase.rpc('is_item_code_available', { p_code: result.value, p_item_id: itemId ?? undefined })
  if (error) return { ok: false, message: 'Não foi possível verificar agora.' }
  return data ? { ok: true, message: 'Código disponível.' } : { ok: false, message: ITEM_CODE_MESSAGES.taken }
}

export async function saveItemAction(
  vitrineId: string,
  itemId: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const fields = readFormFields(formData, ITEM_FIELDS)
  const parsed = itemSchema.safeParse(fields)
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error), values: fields }
  const input = parsed.data
  const keepValues = { values: fields }

  const { supabase, user } = await requireActionUser()
  const { data: vitrine } = await supabase.from('vitrines').select('id, type, subdomain').eq('id', vitrineId).maybeSingle()
  if (!vitrine) redirect('/painel')

  const admin = createSupabaseAdminClient()
  const { data: cover } = await admin
    .from('media')
    .select('id, item_id')
    .eq('id', input.coverMediaId)
    .eq('owner_id', user.id)
    .eq('vitrine_id', vitrineId)
    .eq('role', 'cover')
    .maybeSingle()
  if (!cover || (cover.item_id !== null && cover.item_id !== itemId)) {
    return { fieldErrors: { coverMediaId: 'Envie a imagem de capa.' }, ...keepValues }
  }

  const code = formData.get('codeAuto') === '1' && !itemId ? null : input.code
  const row = {
    category_id: input.categoryId,
    name: input.name,
    description: input.description,
    price_type: input.priceType,
    price_cents: input.priceCents,
    promo_price_cents: input.promoPriceCents,
    duration_minutes: vitrine.type === 'servicos' ? input.durationMinutes : null,
    tags: input.tags,
    sold_out: input.soldOut,
    whatsapp_id: input.whatsappId,
    button_text: input.buttonText,
    custom_message: input.customMessage,
  }

  let savedId = itemId
  if (!itemId) {
    const { data: last } = await supabase
      .from('items')
      .select('position')
      .eq('category_id', input.categoryId)
      .is('deleted_at', null)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle()
    const { data, error } = await supabase
      .from('items')
      // code nulo: o trigger items_before_write gera o próximo código automático.
      .insert({ ...row, vitrine_id: vitrineId, code: code as string, position: (last?.position ?? -1) + 1 })
      .select('id')
      .single()
    if (error) return itemError(error, keepValues)
    savedId = data.id
  } else {
    const { error } = await supabase
      .from('items')
      .update(code ? { ...row, code } : row)
      .eq('id', itemId)
      .is('deleted_at', null)
    if (error) return itemError(error, keepValues)
  }

  const variationError = await syncVariations(supabase, savedId!, input.variations)
  if (variationError) return { error: variationError, ...keepValues }
  await linkPendingMedia(admin, { userId: user.id, vitrineId, itemId: savedId!, input })

  revalidateVitrine(vitrine.subdomain)
  redirect(`/painel/vitrines/${vitrineId}/itens?salvo=1`)
}

function itemError(error: { code?: string; message?: string; hint?: string }, keep: FormState): FormState {
  if (error.message === 'item_code_taken') return { fieldErrors: { code: ITEM_CODE_MESSAGES.taken }, ...keep }
  return { error: mapDbError(error), ...keep }
}

type ServerClient = Awaited<ReturnType<typeof requireActionUser>>['supabase']

async function syncVariations(supabase: ServerClient, itemId: string, variations: ItemInput['variations']) {
  const { data: existing } = await supabase.from('item_variations').select('id').eq('item_id', itemId)
  const keep = new Set(variations.map((v) => v.id).filter(Boolean))
  const removed = (existing ?? []).map((v) => v.id).filter((id) => !keep.has(id))
  if (removed.length) {
    const { error } = await supabase.from('item_variations').delete().in('id', removed)
    if (error) return mapDbError(error)
  }
  for (const [position, variation] of variations.entries()) {
    const values = {
      name: variation.name,
      price_cents: variation.priceCents,
      promo_price_cents: variation.promoPriceCents,
      sold_out: variation.soldOut,
      position,
    }
    const { error } = variation.id
      ? await supabase.from('item_variations').update(values).eq('id', variation.id).eq('item_id', itemId)
      : await supabase.from('item_variations').insert({ ...values, item_id: itemId })
    if (error) return mapDbError(error)
  }
  return null
}

// Imagens enviadas antes de o item existir (item_id nulo) passam a pertencer a ele.
async function linkPendingMedia(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  args: { userId: string; vitrineId: string; itemId: string; input: ItemInput },
) {
  const wanted = [
    { id: args.input.coverMediaId, role: 'cover' as const, position: 0 },
    ...args.input.galleryMediaIds.map((id, index) => ({ id, role: 'gallery' as const, position: index + 1 })),
  ]
  for (const slot of wanted) {
    const { data: pending } = await admin
      .from('media')
      .select('id')
      .eq('id', slot.id)
      .eq('owner_id', args.userId)
      .eq('vitrine_id', args.vitrineId)
      .eq('role', slot.role)
      .is('item_id', null)
      .maybeSingle()
    if (!pending) continue
    let occupied = admin.from('media').select('id, storage_paths').eq('item_id', args.itemId).eq('role', slot.role)
    if (slot.role === 'gallery') occupied = occupied.eq('position', slot.position)
    const { data: previous } = await occupied
    await deleteMediaRows(admin, previous ?? [])
    const { error } = await admin.from('media').update({ item_id: args.itemId, position: slot.position }).eq('id', slot.id)
    if (error) throw error
  }
}
```

- [ ] **Step 3: Formulário**

`item-form.tsx` (Client). Props: `vitrineId`, `vitrineType`, `categories`, `contacts`, `nextCode`, `item?` (resultado de `getItemForEdit`). Regras:

- `useActionState(saveItemAction.bind(null, vitrineId, item?.id ?? null), { values })`.
- **Mídias** no topo, fora do `<form>` mas ligadas por estado: `ImageSlot` `Capa` (`role="cover"`, `itemId={item?.id}`, `removable={false}`), `Imagem 2` (`gallery`, `position={1}`, `removable`) e `Imagem 3` (`position={2}`). O `onChange` atualiza `coverId` e `galleryIds`, gravados nos `<input type="hidden">` `coverMediaId` e `galleryMediaIds` (`JSON.stringify(galleryIds.filter(Boolean))`). Sem capa, mostrar o erro `fieldErrors.coverMediaId` perto do slot.
- **Código**: `Input` `Código` com valor inicial `item?.code ?? nextCode` e `<input type="hidden" name="codeAuto" value={edited ? '0' : '1'}>` (novo item). Ao digitar, marca `edited`, normaliza com `normalizeItemCode` e, após 400 ms, chama `checkItemCodeAction(value, item?.id ?? null)`, exibindo a mensagem.
- **Preço**: `select` `Tipo de preço` (`fixed`/`from`/`on_request` com os rótulos listados); `Preço` e `Preço promocional` (`inputMode="decimal"`, valor inicial `centsToInput`) ficam ocultos em `on_request`.
- `Duração (minutos)` só quando `vitrineType === 'servicos'`.
- `Etiquetas`: texto separado por vírgula, com a dica `Até 5, separadas por vírgula.`
- `Esgotado`: checkbox `soldOut`.
- **Variações**: estado `{ key, id, name, price, promoPrice, soldOut }[]` (preços como texto); linhas com os rótulos numerados listados; `Adicionar variação` acrescenta linha vazia (máximo 20); hidden `variations` = `JSON.stringify(rows.map(({ key, ...rest }) => rest))`. Dica: `Com variações, o cliente escolhe uma e o preço dela substitui o do item.`
- **Avançado**: `<details>` com `<summary>Avançado</summary>`: `WhatsApp do item` (`select` `whatsappId`, primeira opção `Usar o principal` com valor vazio), `Texto do botão` (placeholder = texto padrão da vitrine), `Mensagem personalizada` (`textarea`, 500) com a dica `Variáveis: {item}, {codigo}, {variacao}, {vitrine}, {pedido}`.
- Botão `Salvar item`; `FormMessage error={state.error}`; `UnsavedChangesGuard`.
- Se `state.fieldErrors` tiver chave dentro de Avançado, abrir o `<details>`.

`itens/novo/page.tsx`: título `Novo item`; se não houver categorias, mostrar `Crie uma categoria antes de cadastrar itens.` com link para a lista. `itens/[itemId]/page.tsx`: título `Editar item`.

- [ ] **Step 4: Commit**

```bash
npm run lint && npm run typecheck && npm test
git add -A src
git commit -m "feat(itens): editor de item com imagens, código, preços, variações e avançado"
```

---

### Task 19: Lista de itens

**Files:**
- Create: `.../[id]/itens/item-list.tsx`, `e2e/items.spec.ts`
- Modify: `.../[id]/itens/page.tsx`, `src/features/items/actions.ts`

**Interfaces:**
- Produces:
  - `toggleSoldOutAction(vitrineId, itemId): Promise<FormState>`
  - `moveItemAction(vitrineId, itemId, direction): Promise<FormState>`
  - `deleteItemAction(vitrineId, itemId): Promise<FormState>` — exclusão lógica + remove mídias e arquivos
  - `duplicateItemAction(vitrineId, itemId): Promise<FormState>` — cópia com código automático, variações e imagens copiadas
- Textos: `Novo item`, `Buscar itens`, `Editar`, `Duplicar`, `Marcar como esgotado`, `Marcar como disponível`, `Subir`, `Descer`, `Excluir`, `Excluir este item?`, `Esgotado`, `Item salvo.`, `Item duplicado.`, `Item excluído.`, `(cópia)`

- [ ] **Step 1: Ações**

Acrescente em `src/features/items/actions.ts`:

```ts
import { copyMediaFiles, removeStoredFiles } from '@/lib/media/remove-media'
import { moveInList } from '@/lib/vitrines/reorder'

async function ownedItem(vitrineId: string, itemId: string) {
  const session = await requireActionUser()
  const { data: item } = await session.supabase
    .from('items')
    .select('*, vitrines(subdomain), item_variations(*)')
    .eq('id', itemId)
    .eq('vitrine_id', vitrineId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!item) redirect(`/painel/vitrines/${vitrineId}/itens`)
  const subdomain = (item.vitrines as { subdomain: string }).subdomain
  return { ...session, item, subdomain }
}

export async function toggleSoldOutAction(vitrineId: string, itemId: string): Promise<FormState> {
  const { supabase, item, subdomain } = await ownedItem(vitrineId, itemId)
  const { error } = await supabase.from('items').update({ sold_out: !item.sold_out }).eq('id', itemId)
  if (error) return { error: mapDbError(error) }
  revalidateVitrine(subdomain)
  return {}
}

export async function moveItemAction(vitrineId: string, itemId: string, direction: 'up' | 'down'): Promise<FormState> {
  const { supabase, item, subdomain } = await ownedItem(vitrineId, itemId)
  const { data: siblings } = await supabase
    .from('items')
    .select('id')
    .eq('category_id', item.category_id!)
    .is('deleted_at', null)
    .order('position')
    .order('created_at')
  const next = moveInList((siblings ?? []).map((s) => s.id), itemId, direction)
  if (!next) return {}
  const results = await Promise.all(next.map((id, position) => supabase.from('items').update({ position }).eq('id', id)))
  const failed = results.find((r) => r.error)
  if (failed?.error) return { error: mapDbError(failed.error) }
  revalidateVitrine(subdomain)
  return {}
}

export async function deleteItemAction(vitrineId: string, itemId: string): Promise<FormState> {
  const { supabase, user, subdomain } = await ownedItem(vitrineId, itemId)
  const { error } = await supabase.from('items').update({ deleted_at: new Date().toISOString() }).eq('id', itemId)
  if (error) return { error: mapDbError(error) }
  const admin = createSupabaseAdminClient()
  const { data: media } = await admin.from('media').select('id, storage_paths').eq('item_id', itemId).eq('owner_id', user.id)
  await deleteMediaRows(admin, media ?? [])
  revalidateVitrine(subdomain)
  return { success: 'Item excluído.' }
}

export async function duplicateItemAction(vitrineId: string, itemId: string): Promise<FormState> {
  const { supabase, user, item, subdomain } = await ownedItem(vitrineId, itemId)
  const { data: copy, error } = await supabase
    .from('items')
    .insert({
      vitrine_id: vitrineId,
      category_id: item.category_id,
      // code nulo: o trigger gera o próximo código automático.
      code: null as unknown as string,
      name: `${item.name.slice(0, 72)} (cópia)`,
      description: item.description,
      price_type: item.price_type,
      price_cents: item.price_cents,
      promo_price_cents: item.promo_price_cents,
      duration_minutes: item.duration_minutes,
      tags: item.tags,
      sold_out: item.sold_out,
      position: item.position + 1,
      whatsapp_id: item.whatsapp_id,
      button_text: item.button_text,
      custom_message: item.custom_message,
    })
    .select('id')
    .single()
  if (error) return { error: mapDbError(error) }

  const variations = (item.item_variations ?? []).map((v) => ({
    item_id: copy.id,
    name: v.name,
    price_cents: v.price_cents,
    promo_price_cents: v.promo_price_cents,
    sold_out: v.sold_out,
    position: v.position,
  }))
  if (variations.length) await supabase.from('item_variations').insert(variations)

  const admin = createSupabaseAdminClient()
  const { data: media } = await admin.from('media').select('*').eq('item_id', itemId).in('role', ['cover', 'gallery'])
  const copiedPaths: string[] = []
  try {
    for (const row of media ?? []) {
      const newId = crypto.randomUUID()
      const storagePaths = await copyMediaFiles(row.storage_paths, `${user.id}/${vitrineId}/${newId}`)
      copiedPaths.push(...Object.values(storagePaths))
      const { error: mediaError } = await admin.from('media').insert({
        id: newId,
        owner_id: user.id,
        vitrine_id: vitrineId,
        item_id: copy.id,
        role: row.role,
        kind: row.kind,
        position: row.position,
        storage_paths: storagePaths,
        width: row.width,
        height: row.height,
        bytes: row.bytes,
        status: 'ready',
      })
      if (mediaError) throw mediaError
    }
  } catch {
    await removeStoredFiles(copiedPaths)
    return { error: 'Item duplicado, mas as imagens não foram copiadas. Envie a capa no item novo.' }
  }

  revalidateVitrine(subdomain)
  return { success: 'Item duplicado.' }
}
```

A ordem de `position` dos itens depois do original pode empatar; a lista ordena por `position` e `created_at`, o que mantém a cópia logo abaixo.

- [ ] **Step 2: Página e lista**

`itens/page.tsx` (Server): carrega categorias (`position`) e itens não excluídos da vitrine com `id, name, code, category_id, price_type, price_cents, promo_price_cents, sold_out, position, item_variations(price_cents, promo_price_cents)` ordenados por `position`, `created_at`. Mostra `Item salvo.` quando `searchParams.salvo === '1'`, o `CategoryManager`, o link `Novo item` (`buttonClasses`) e `<ItemList>`. Esta página pode ler `searchParams`: é painel, não vitrine pública.

`item-list.tsx` (Client):
- Campo `Buscar itens` filtra por nome ou código (sem acento, sem diferenciar maiúsculas).
- Por categoria, `<h2>` com o nome; sem itens, `Nenhum item nesta categoria.`
- Cada item: nome, `cód. {code}`, `formatPriceLabel(priceLabel(...))`, selo `Esgotado` quando for o caso; link `Editar`; botões `Duplicar`, `Marcar como esgotado`/`Marcar como disponível`, `Subir`, `Descer`, `Excluir` (com `window.confirm('Excluir este item?')`). Cada botão usa `useTransition`, mostra a mensagem retornada numa região `aria-live` do topo da lista e chama `router.refresh()`.

- [ ] **Step 3: e2e**

`e2e/items.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { createConfirmedUser, makeTestImage, seedVitrine, signIn, uploadImage } from './helpers'

test('cadastra item com capa e variações, edita código, esgota, duplica e exclui', async ({ page }) => {
  const user = await createConfirmedUser('itens')
  const vitrine = await seedVitrine(user.id)
  await signIn(page, user.email, user.password)

  await page.goto(`/painel/vitrines/${vitrine.id}/itens`)
  await page.getByRole('link', { name: 'Novo item' }).click()
  await uploadImage(page, 'Capa', await makeTestImage(page))
  await page.getByLabel('Nome', { exact: true }).fill('Camiseta')
  await expect(page.getByLabel('Código')).toHaveValue('101')
  await page.getByLabel('Categoria').selectOption({ label: 'Destaques' })
  await page.getByRole('button', { name: 'Adicionar variação' }).click()
  await page.getByLabel('Nome da variação 1').fill('P')
  await page.getByLabel('Preço da variação 1').fill('39,90')
  await page.getByRole('button', { name: 'Adicionar variação' }).click()
  await page.getByLabel('Nome da variação 2').fill('G')
  await page.getByLabel('Preço da variação 2').fill('44,90')
  await page.getByRole('button', { name: 'Salvar item' }).click()

  await expect(page.getByText('Item salvo.')).toBeVisible()
  await expect(page.getByText('Camiseta')).toBeVisible()
  await expect(page.getByText('A partir de R$ 39,90')).toBeVisible()

  await page.getByRole('link', { name: 'Editar' }).click()
  await page.getByLabel('Código').fill('cam1')
  await expect(page.getByText('Código disponível.')).toBeVisible()
  await page.getByRole('button', { name: 'Salvar item' }).click()
  await expect(page.getByText('cód. CAM1')).toBeVisible()

  await page.getByRole('button', { name: 'Marcar como esgotado' }).click()
  await expect(page.getByText('Esgotado', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Duplicar' }).click()
  await expect(page.getByText('Item duplicado.')).toBeVisible()
  await expect(page.getByText('Camiseta (cópia)')).toBeVisible()

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Excluir' }).last().click()
  await expect(page.getByText('Item excluído.')).toBeVisible()
})

test('item sem capa mostra erro', async ({ page }) => {
  const user = await createConfirmedUser('itens-erro')
  const vitrine = await seedVitrine(user.id)
  await signIn(page, user.email, user.password)

  await page.goto(`/painel/vitrines/${vitrine.id}/itens/novo`)
  await page.getByLabel('Nome', { exact: true }).fill('Sem capa')
  await page.getByLabel('Preço', { exact: true }).fill('10')
  await page.getByRole('button', { name: 'Salvar item' }).click()
  await expect(page.getByText('Envie a imagem de capa.')).toBeVisible()
})
```

(O caso de código repetido já é coberto por pgTAP e pela verificação `Código disponível.`; manter o e2e enxuto.)

- [ ] **Step 4: Commit, PR e merge do bloco**

```bash
npm run lint && npm run typecheck && npm test
git add -A src e2e
git commit -m "feat(itens): lista com busca, esgotado, ordenar, duplicar e excluir"
git push -u origin HEAD
gh pr create --fill --base master
gh pr checks --watch
```

**Fim do Bloco 6:** autorização → merge. Conferência na nuvem: na vitrine criada no Bloco 4, cadastrar dois itens com foto pelo celular (um com variações), duplicar um e excluir a cópia; no Bunny, conferir que os arquivos da cópia sumiram.

---

# Bloco 7 — Vitrine pública e botão direto

Branch: `fase-2/bloco-7-vitrine-publica`.

**Antes do merge (usuário):** criar `RATE_LIMIT_SALT` na Vercel (Production) com um valor aleatório longo (comando em `docs/setup/fase-2-infra.md`).

### Task 20: Catálogo público com ISR

**Files:**
- Create: `src/features/public/build-catalog.ts`, `src/features/public/build-catalog.test.ts`, `src/features/public/load-vitrine.ts`, `src/app/v/[subdomain]/catalog.tsx`, `src/app/v/[subdomain]/item-param.ts`
- Modify: `src/app/v/[subdomain]/page.tsx`

**Interfaces:**
- Produces:
  - `type PublicImage = { small: string; large: string; smallWidth: number; largeWidth: number }`
  - `type PublicItem = { id; code; name; description; priceType; priceCents; promoPriceCents; durationMinutes; tags: string[]; soldOut; whatsappPhone: string | null; buttonText: string | null; customMessage: string | null; cover: PublicImage | null; gallery: PublicImage[]; variations: { id; name; priceCents; promoPriceCents; soldOut }[] }`
  - `type PublicVitrine = { id; subdomain; type: VitrineType; name; description; theme: 'light' | 'dark'; status: 'active' | 'frozen'; showPrices; showMedia; defaultButtonText; primaryPhone: string | null; logo: PublicImage | null; brandColor: string | null; banner: PublicImage | null; showWatermark: boolean; categories: { id; name; items: PublicItem[] }[] }`
  - `buildPublicCatalog(rows: CatalogRows, mediaBaseUrl: string): PublicVitrine`
  - `loadPublicVitrine(subdomain: string): Promise<PublicVitrine | null>` (cache com tag `vitrine-sub:{subdomain}`)
  - `useItemParam(): { itemCode: string | null; openItem(code): void; closeItem(): void }`
- Textos: `Buscar por nome ou código`, navegação `Categorias`, `Esgotado`, `Sob consulta`, `Nenhum item encontrado.`, `Vitrine indisponível no momento`, `Feito com Agenn Vitrine`.

- [ ] **Step 1: Teste da montagem (falhando)**

`src/features/public/build-catalog.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildPublicCatalog, type CatalogRows } from './build-catalog'

const base: CatalogRows = {
  vitrine: {
    id: 'v1', subdomain: 'loja', type: 'produtos', name: 'Loja', description: '', theme: 'light', status: 'active',
    show_prices: true, show_media: true, default_button_text: 'Solicitar orçamento', brand_color: '#ff0000',
    banner_enabled: true, logo_media_id: 'logo', banner_media_id: 'banner', primary_whatsapp_id: 'w1',
  },
  plan: { max_items_per_vitrine: 2, allow_branding: false, show_watermark: true },
  contacts: [
    { id: 'w1', phone_e164: '+5511900000001' },
    { id: 'w2', phone_e164: '+5511900000002' },
  ],
  categories: [
    { id: 'c2', name: 'Segunda', position: 1 },
    { id: 'c1', name: 'Primeira', position: 0 },
  ],
  items: [
    item('i3', 'c2', 0),
    item('i1', 'c1', 1),
    item('i2', 'c1', 0, { whatsapp_id: 'w2' }),
    item('sem-categoria', null, 0),
  ],
  variations: [
    { id: 'v-b', item_id: 'i2', name: 'G', price_cents: 200, promo_price_cents: null, sold_out: false, position: 1 },
    { id: 'v-a', item_id: 'i2', name: 'P', price_cents: 100, promo_price_cents: null, sold_out: false, position: 0 },
  ],
  media: [
    { id: 'm1', item_id: 'i2', role: 'cover', position: 0, storage_paths: { '480': 'a-480.webp', '1080': 'a-1080.webp' } },
    { id: 'logo', item_id: null, role: 'logo', position: 0, storage_paths: { '128': 'l-128.webp', '512': 'l-512.webp' } },
    { id: 'banner', item_id: null, role: 'banner', position: 0, storage_paths: { '960': 'b-960.webp', '1920': 'b-1920.webp' } },
  ],
}

function item(id: string, categoryId: string | null, position: number, extra: Partial<CatalogRows['items'][number]> = {}) {
  return {
    id, category_id: categoryId, code: id.toUpperCase().slice(0, 6), name: `Item ${id}`, description: '',
    price_type: 'fixed' as const, price_cents: 1000, promo_price_cents: null, duration_minutes: null, tags: [],
    sold_out: false, position, whatsapp_id: null, button_text: null, custom_message: null, ...extra,
  }
}

describe('buildPublicCatalog', () => {
  it('ordena por categoria e item e corta no limite do plano (4.7)', () => {
    const catalog = buildPublicCatalog(base, 'https://cdn')
    expect(catalog.categories.map((c) => [c.name, c.items.map((i) => i.id)])).toEqual([
      ['Primeira', ['i2', 'i1']],
      ['Segunda', []],
    ])
  })

  it('ignora marca sem o Pro e mostra marca d’água', () => {
    const catalog = buildPublicCatalog(base, 'https://cdn')
    expect([catalog.logo, catalog.brandColor, catalog.banner, catalog.showWatermark]).toEqual([null, null, null, true])
  })

  it('usa marca com o Pro', () => {
    const catalog = buildPublicCatalog({ ...base, plan: { max_items_per_vitrine: 300, allow_branding: true, show_watermark: false } }, 'https://cdn')
    expect(catalog.logo?.small).toBe('https://cdn/l-128.webp')
    expect(catalog.banner?.large).toBe('https://cdn/b-1920.webp')
    expect(catalog.brandColor).toBe('#ff0000')
    expect(catalog.showWatermark).toBe(false)
    expect(catalog.categories[1].items.map((i) => i.id)).toEqual(['i3'])
  })

  it('telefones, imagens e variações do item', () => {
    const [first] = buildPublicCatalog(base, 'https://cdn').categories[0].items
    expect(first.whatsappPhone).toBe('+5511900000002')
    expect(first.cover?.small).toBe('https://cdn/a-480.webp')
    expect(first.variations.map((v) => v.name)).toEqual(['P', 'G'])
    expect(buildPublicCatalog(base, 'https://cdn').primaryPhone).toBe('+5511900000001')
  })
})
```

Run: `npm test -- src/features/public` → FAIL.

- [ ] **Step 2: Montagem**

`src/features/public/build-catalog.ts`:

```ts
import { imageSources } from '@/lib/media/urls'
import type { PriceType } from '@/lib/pricing/price'
import type { VitrineType } from '@/lib/vitrines/vitrine-types'

export type CatalogRows = {
  vitrine: {
    id: string; subdomain: string; type: string; name: string; description: string; theme: string; status: string
    show_prices: boolean; show_media: boolean; default_button_text: string; brand_color: string | null
    banner_enabled: boolean; logo_media_id: string | null; banner_media_id: string | null; primary_whatsapp_id: string | null
  }
  plan: { max_items_per_vitrine: number; allow_branding: boolean; show_watermark: boolean }
  contacts: { id: string; phone_e164: string }[]
  categories: { id: string; name: string; position: number }[]
  items: {
    id: string; category_id: string | null; code: string; name: string; description: string; price_type: PriceType
    price_cents: number | null; promo_price_cents: number | null; duration_minutes: number | null; tags: string[]
    sold_out: boolean; position: number; whatsapp_id: string | null; button_text: string | null; custom_message: string | null
  }[]
  variations: { id: string; item_id: string; name: string; price_cents: number; promo_price_cents: number | null; sold_out: boolean; position: number }[]
  media: { id: string; item_id: string | null; role: string; position: number; storage_paths: unknown }[]
}

export type PublicImage = { small: string; large: string; smallWidth: number; largeWidth: number }

export type PublicItem = {
  id: string; code: string; name: string; description: string; priceType: PriceType; priceCents: number | null
  promoPriceCents: number | null; durationMinutes: number | null; tags: string[]; soldOut: boolean
  whatsappPhone: string | null; buttonText: string | null; customMessage: string | null
  cover: PublicImage | null; gallery: PublicImage[]
  variations: { id: string; name: string; priceCents: number; promoPriceCents: number | null; soldOut: boolean }[]
}

export type PublicVitrine = {
  id: string; subdomain: string; type: VitrineType; name: string; description: string; theme: 'light' | 'dark'
  status: 'active' | 'frozen'; showPrices: boolean; showMedia: boolean; defaultButtonText: string
  primaryPhone: string | null; logo: PublicImage | null; brandColor: string | null; banner: PublicImage | null
  showWatermark: boolean; categories: { id: string; name: string; items: PublicItem[] }[]
}

export function buildPublicCatalog(rows: CatalogRows, mediaBaseUrl: string): PublicVitrine {
  const phoneById = new Map(rows.contacts.map((c) => [c.id, c.phone_e164]))
  const image = (paths: unknown) => imageSources(paths, mediaBaseUrl)
  const mediaById = new Map(rows.media.map((m) => [m.id, m]))
  const categories = [...rows.categories].sort((a, b) => a.position - b.position)
  const categoryOrder = new Map(categories.map((c, index) => [c.id, index]))

  // Ordem da vitrine (categoria, depois item) e corte do plano (spec 4.7).
  const visible = rows.items
    .filter((i) => i.category_id !== null && categoryOrder.has(i.category_id))
    .sort((a, b) => categoryOrder.get(a.category_id!)! - categoryOrder.get(b.category_id!)! || a.position - b.position)
    .slice(0, rows.plan.max_items_per_vitrine)

  const toItem = (row: CatalogRows['items'][number]): PublicItem => {
    const media = rows.media.filter((m) => m.item_id === row.id)
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      priceType: row.price_type,
      priceCents: row.price_cents,
      promoPriceCents: row.promo_price_cents,
      durationMinutes: row.duration_minutes,
      tags: row.tags,
      soldOut: row.sold_out,
      whatsappPhone: row.whatsapp_id ? (phoneById.get(row.whatsapp_id) ?? null) : null,
      buttonText: row.button_text,
      customMessage: row.custom_message,
      cover: image(media.find((m) => m.role === 'cover')?.storage_paths),
      gallery: media
        .filter((m) => m.role === 'gallery')
        .sort((a, b) => a.position - b.position)
        .map((m) => image(m.storage_paths))
        .filter((img): img is PublicImage => img !== null),
      variations: rows.variations
        .filter((v) => v.item_id === row.id)
        .sort((a, b) => a.position - b.position)
        .map((v) => ({ id: v.id, name: v.name, priceCents: v.price_cents, promoPriceCents: v.promo_price_cents, soldOut: v.sold_out })),
    }
  }

  const branding = rows.plan.allow_branding
  const { vitrine } = rows
  return {
    id: vitrine.id,
    subdomain: vitrine.subdomain,
    type: vitrine.type as VitrineType,
    name: vitrine.name,
    description: vitrine.description,
    theme: vitrine.theme === 'dark' ? 'dark' : 'light',
    status: vitrine.status === 'active' ? 'active' : 'frozen',
    showPrices: vitrine.show_prices,
    showMedia: vitrine.show_media,
    defaultButtonText: vitrine.default_button_text,
    primaryPhone: vitrine.primary_whatsapp_id ? (phoneById.get(vitrine.primary_whatsapp_id) ?? null) : null,
    logo: branding && vitrine.logo_media_id ? image(mediaById.get(vitrine.logo_media_id)?.storage_paths) : null,
    brandColor: branding ? vitrine.brand_color : null,
    banner:
      branding && vitrine.banner_enabled && vitrine.banner_media_id
        ? image(mediaById.get(vitrine.banner_media_id)?.storage_paths)
        : null,
    showWatermark: rows.plan.show_watermark,
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      items: visible.filter((i) => i.category_id === c.id).map(toItem),
    })),
  }
}
```

Run: `npm test -- src/features/public` → PASS.

- [ ] **Step 3: Carregador com cache**

Leia antes `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/unstable_cache.md`.

`src/features/public/load-vitrine.ts`:

```ts
import 'server-only'
import { unstable_cache } from 'next/cache'
import { env } from '@/lib/env'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { vitrineTag } from '@/lib/vitrines/cache'
import { buildPublicCatalog, type CatalogRows, type PublicVitrine } from './build-catalog'

async function fetchCatalog(subdomain: string): Promise<PublicVitrine | null> {
  const admin = createSupabaseAdminClient()
  const { data: vitrine, error } = await admin
    .from('vitrines')
    .select('id, owner_id, subdomain, type, name, description, theme, status, show_prices, show_media, default_button_text, brand_color, banner_enabled, logo_media_id, banner_media_id, primary_whatsapp_id')
    .eq('subdomain', subdomain)
    .maybeSingle()
  if (error) throw error
  if (!vitrine) return null

  const { data: planId, error: planIdError } = await admin.rpc('effective_plan_id', { p_user_id: vitrine.owner_id })
  if (planIdError) throw planIdError

  const [plan, contacts, categories, items, media] = await Promise.all([
    admin.from('plans').select('max_items_per_vitrine, allow_branding, show_watermark').eq('id', planId).single(),
    admin.from('whatsapp_contacts').select('id, phone_e164').eq('vitrine_id', vitrine.id),
    admin.from('categories').select('id, name, position').eq('vitrine_id', vitrine.id),
    admin
      .from('items')
      .select('id, category_id, code, name, description, price_type, price_cents, promo_price_cents, duration_minutes, tags, sold_out, position, whatsapp_id, button_text, custom_message')
      .eq('vitrine_id', vitrine.id)
      .is('deleted_at', null)
      .order('position')
      .order('created_at'),
    admin.from('media').select('id, item_id, role, position, storage_paths').eq('vitrine_id', vitrine.id).eq('status', 'ready'),
  ])
  for (const result of [plan, contacts, categories, items, media]) if (result.error) throw result.error

  const itemIds = (items.data ?? []).map((i) => i.id)
  const variations = itemIds.length
    ? await admin
        .from('item_variations')
        .select('id, item_id, name, price_cents, promo_price_cents, sold_out, position')
        .in('item_id', itemIds)
    : { data: [], error: null }
  if (variations.error) throw variations.error

  return buildPublicCatalog(
    {
      vitrine,
      plan: plan.data!,
      contacts: contacts.data ?? [],
      categories: categories.data ?? [],
      items: (items.data ?? []) as CatalogRows['items'],
      variations: variations.data ?? [],
      media: media.data ?? [],
    },
    env.NEXT_PUBLIC_MEDIA_BASE_URL,
  )
}

export function loadPublicVitrine(subdomain: string) {
  return unstable_cache(() => fetchCatalog(subdomain), ['public-vitrine', subdomain], {
    tags: [vitrineTag(subdomain)],
  })()
}
```

Se `rpc('effective_plan_id')` responder `42501` com a chave secreta, crie a migração `20260918000400_service_role_grants.sql` com `grant execute on function public.effective_plan_id(uuid) to service_role;` (e siga a Rotina de migração).

- [ ] **Step 4: Página**

`src/app/v/[subdomain]/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { loadPublicVitrine } from '@/features/public/load-vitrine'
import { env } from '@/lib/env'
import { buildVitrineUrl, originFor } from '@/lib/hosts/urls'
import { Catalog } from './catalog'

type Props = { params: Promise<{ subdomain: string }> }

// Lista vazia + sem APIs dinâmicas = cada vitrine é gerada na primeira visita e
// fica estática até revalidateTag (generate-static-params.md, "All paths at runtime").
export async function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { subdomain } = await params
  const vitrine = await loadPublicVitrine(subdomain)
  if (!vitrine) return { title: 'Vitrine não encontrada' }
  const image = vitrine.banner?.large ?? vitrine.logo?.large
  const absoluteImage = image?.startsWith('http') ? image : undefined
  return {
    title: vitrine.name,
    description: vitrine.description || undefined,
    metadataBase: new URL(buildVitrineUrl(vitrine.subdomain, env.NEXT_PUBLIC_ROOT_DOMAIN)),
    openGraph: {
      title: vitrine.name,
      description: vitrine.description || undefined,
      images: absoluteImage ? [absoluteImage] : undefined,
    },
    icons: vitrine.logo?.small?.startsWith('http') ? { icon: vitrine.logo.small } : undefined,
    other: vitrine.brandColor ? { 'theme-color': vitrine.brandColor } : undefined,
  }
}

export default async function VitrinePage({ params }: Props) {
  const { subdomain } = await params
  const vitrine = await loadPublicVitrine(subdomain)
  if (!vitrine) notFound()
  if (vitrine.status !== 'active') {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6 text-center">
        <h1 className="text-xl font-semibold">Vitrine indisponível no momento</h1>
      </main>
    )
  }
  return <Catalog vitrine={vitrine} siteUrl={originFor(env.NEXT_PUBLIC_ROOT_DOMAIN)} />
}
```

- [ ] **Step 5: Parâmetro `?item=` sem `useSearchParams`**

`src/app/v/[subdomain]/item-param.ts`:

```ts
'use client'

import { useCallback, useSyncExternalStore } from 'react'

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange)
  return () => window.removeEventListener('popstate', onChange)
}

// Lê ?item= do endereço. useSearchParams faria o catálogo inteiro renderizar só no
// navegador (use-search-params.md); aqui a página continua estática.
export function useItemParam() {
  const search = useSyncExternalStore(subscribe, () => window.location.search, () => '')
  const itemCode = new URLSearchParams(search).get('item')

  const navigate = useCallback((code: string | null) => {
    const url = new URL(window.location.href)
    if (code) url.searchParams.set('item', code)
    else url.searchParams.delete('item')
    window.history.pushState(null, '', url)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, [])

  return {
    itemCode,
    openItem: useCallback((code: string) => navigate(code), [navigate]),
    closeItem: useCallback(() => navigate(null), [navigate]),
  }
}
```

- [ ] **Step 6: Catálogo**

`src/app/v/[subdomain]/catalog.tsx` (Client). Props `vitrine: PublicVitrine`, `siteUrl: string`. Estrutura (spec 7.2):

1. Contêiner com `data-theme={vitrine.theme}` e, com `brandColor`, `style={{ '--brand': brandColor, '--brand-ink': readableTextColor(brandColor) }}`. Fundo e texto do tema escuro com as classes/tokens existentes de `globals.css`; se não houver tokens escuros, usar `bg-neutral-950 text-neutral-50` quando `theme === 'dark'`.
2. **Topo:** logo (`<img>` 40 px, `alt=""`) ou iniciais do nome num círculo; nome em `<h1>`; campo de busca `aria-label="Buscar por nome ou código"`. A busca (sem acento, sem diferenciar maiúsculas) filtra nome e código; sem resultados, `Nenhum item encontrado.`
3. **Banner** 16:9 quando `vitrine.banner`: `<img srcSet="{small} {smallWidth}w, {large} {largeWidth}w" sizes="100vw" fetchPriority="high">`.
4. **Barra de categorias:** `<nav aria-label="Categorias" className="sticky top-0 …">` com links `#cat-{id}` (só categorias com itens visíveis). A categoria visível recebe `aria-current="true"`, calculada com `IntersectionObserver` sobre as `<section>` (callback do observer atualiza o estado, fora do corpo do efeito).
5. **Seções:** `<section id="cat-{id}" aria-labelledby="cat-{id}-title">` com `<h2>`. Cards:
   - `<button type="button" onClick={() => openItem(item.code)} aria-label={item.name}>`.
   - Com `showMedia`: capa `<img src={cover.small} srcSet="{small} {smallWidth}w, {large} {largeWidth}w" sizes="(min-width: 768px) 33vw, 50vw" loading="lazy" decoding="async" alt="" width={4} height={5}>` em caixa 4:5; sem capa, caixa neutra. Sem `showMedia`: lista só de texto.
   - Nome; preço quando `showPrices`: `formatPriceLabel(priceLabel(item, item.variations))`, com o preço original riscado (`<s>`) quando `originalCents`; duração `{n} min`; etiquetas; selo `Esgotado` e card com `opacity-60`.
6. **Rodapé:** com `showWatermark`, link `Feito com Agenn Vitrine` para `siteUrl`.
7. **Tela do item:** `const ItemSheet = dynamic(() => import('./item-sheet'), { ssr: false })`, renderizada só quando `itemCode` corresponde a um item visível (`{ itemCode && item ? <ItemSheet … onClose={closeItem} /> : null }`). Código inexistente é ignorado.

Nenhum JavaScript de vídeo nesta fase; imagens da listagem com `loading="lazy"`.

- [ ] **Step 7: Commit**

```bash
npm run lint && npm run typecheck && npm test
git add -A src
git commit -m "feat(vitrine): catálogo público estático com revalidação por subdomínio"
```

A tela do item vem na Task 22; até lá o `import('./item-sheet')` não compila. Crie `item-sheet.tsx` provisório neste commit, já com as props definitivas:

```tsx
'use client'

import type { PublicItem, PublicVitrine } from '@/features/public/build-catalog'

export type ItemSheetProps = { vitrine: PublicVitrine; item: PublicItem; onClose: () => void }

export default function ItemSheet(_props: ItemSheetProps) {
  return null
}
```

---

### Task 21: API de pedidos

**Files:**
- Create: `src/lib/orders/snapshot.ts`, `src/lib/orders/snapshot.test.ts`, `src/lib/orders/client-ip.ts`, `src/lib/orders/client-ip.test.ts`, `src/app/api/orders/route.ts`
- Modify: `src/lib/server-env-schema.ts` (+ teste), `src/lib/server-env.ts`, `.github/workflows/ci.yml`, `.env.example`

**Interfaces:**
- Produces:
  - `orderRequestSchema` (Zod): `{ lines: { itemId: uuid; variationId: uuid | null; qty: 1..99; note: string ≤ 140 }[1..50] }`
  - `type SnapshotLine = { item_id; code; name; qty; variation: { id; name } | null; addons: []; note: string | null; unit_price_cents: number | null }`
  - `buildSnapshotPayload(lines, items: SnapshotSourceItem[]): { ok: true; payload: { items: SnapshotLine[] } } | { ok: false; reason: 'item_not_found' | 'sold_out' | 'variation_required' | 'variation_not_found' }`
  - `clientIp(headers: Headers): string`, `rateLimitKey(ip: string, action: string, salt: string): Promise<string>`
  - `parseOrderRateLimit(source): number` (padrão 20), `getOrderRateLimit()`
  - `POST /api/orders` (host da vitrine) → `201 { code }` | `400` | `404` | `422` | `429` | `503`, sempre `{ error }` em falha

- [ ] **Step 1: Testes (falhando)**

`src/lib/orders/snapshot.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildSnapshotPayload, orderRequestSchema } from './snapshot'

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

const items = [
  { id: uuid(1), code: '101', name: 'Camiseta', price_type: 'fixed' as const, price_cents: 5000, promo_price_cents: 4500, sold_out: false, item_variations: [] },
  {
    id: uuid(2), code: '102', name: 'Manicure', price_type: 'fixed' as const, price_cents: null, promo_price_cents: null, sold_out: false,
    item_variations: [
      { id: uuid(20), name: 'Mão', price_cents: 3000, promo_price_cents: null, sold_out: false },
      { id: uuid(21), name: 'Pé', price_cents: 3500, promo_price_cents: null, sold_out: true },
    ],
  },
  { id: uuid(3), code: '103', name: 'Esgotado', price_type: 'on_request' as const, price_cents: null, promo_price_cents: null, sold_out: true, item_variations: [] },
]

describe('orderRequestSchema', () => {
  it('aplica padrões e limites', () => {
    expect(orderRequestSchema.parse({ lines: [{ itemId: uuid(1), qty: 1 }] })).toEqual({
      lines: [{ itemId: uuid(1), variationId: null, qty: 1, note: '' }],
    })
    expect(orderRequestSchema.safeParse({ lines: [] }).success).toBe(false)
    expect(orderRequestSchema.safeParse({ lines: [{ itemId: uuid(1), qty: 100 }] }).success).toBe(false)
  })
})

describe('buildSnapshotPayload', () => {
  it('usa nomes e preços atuais do banco, nunca do navegador', () => {
    const result = buildSnapshotPayload([{ itemId: uuid(1), variationId: null, qty: 2, note: '' }], items)
    expect(result).toEqual({
      ok: true,
      payload: {
        items: [{ item_id: uuid(1), code: '101', name: 'Camiseta', qty: 2, variation: null, addons: [], note: null, unit_price_cents: 4500 }],
      },
    })
  })

  it('variação obrigatória, existente e disponível', () => {
    expect(buildSnapshotPayload([{ itemId: uuid(2), variationId: null, qty: 1, note: '' }], items)).toEqual({ ok: false, reason: 'variation_required' })
    expect(buildSnapshotPayload([{ itemId: uuid(2), variationId: uuid(99), qty: 1, note: '' }], items)).toEqual({ ok: false, reason: 'variation_not_found' })
    expect(buildSnapshotPayload([{ itemId: uuid(2), variationId: uuid(21), qty: 1, note: '' }], items)).toEqual({ ok: false, reason: 'sold_out' })
    const ok = buildSnapshotPayload([{ itemId: uuid(2), variationId: uuid(20), qty: 1, note: 'sem pressa' }], items)
    expect(ok.ok && ok.payload.items[0]).toMatchObject({ variation: { id: uuid(20), name: 'Mão' }, unit_price_cents: 3000, note: 'sem pressa' })
  })

  it('item inexistente ou esgotado', () => {
    expect(buildSnapshotPayload([{ itemId: uuid(9), variationId: null, qty: 1, note: '' }], items)).toEqual({ ok: false, reason: 'item_not_found' })
    expect(buildSnapshotPayload([{ itemId: uuid(3), variationId: null, qty: 1, note: '' }], items)).toEqual({ ok: false, reason: 'sold_out' })
  })
})
```

`src/lib/orders/client-ip.test.ts`:

```ts
import { expect, it } from 'vitest'
import { clientIp, rateLimitKey } from './client-ip'

it('primeiro IP do x-forwarded-for, depois x-real-ip', () => {
  expect(clientIp(new Headers({ 'x-forwarded-for': '200.1.2.3, 10.0.0.1' }))).toBe('200.1.2.3')
  expect(clientIp(new Headers({ 'x-real-ip': '200.9.9.9' }))).toBe('200.9.9.9')
  expect(clientIp(new Headers())).toBe('desconhecido')
})

it('chave com hash do IP e sal, sem o IP em claro', async () => {
  const key = await rateLimitKey('200.1.2.3', 'orders', 'sal-de-teste-123456')
  expect(key).toMatch(/^orders:[0-9a-f]{64}$/)
  expect(key).not.toContain('200.1.2.3')
  expect(await rateLimitKey('200.1.2.3', 'orders', 'outro-sal-123456789')).not.toBe(key)
})
```

Acrescente em `src/lib/server-env-schema.test.ts`:

```ts
import { parseOrderRateLimit } from './server-env-schema'

it('limite de pedidos por hora', () => {
  expect(parseOrderRateLimit({})).toBe(20)
  expect(parseOrderRateLimit({ ORDER_RATE_LIMIT_PER_HOUR: '1000' })).toBe(1000)
})
```

Run: `npm test -- src/lib/orders src/lib/server-env-schema.test.ts` → FAIL.

- [ ] **Step 2: Implementação**

`src/lib/orders/snapshot.ts`:

```ts
import { z } from 'zod'
import { unitPriceCents, type PriceType } from '@/lib/pricing/price'

export const orderRequestSchema = z.object({
  lines: z
    .array(
      z.object({
        itemId: z.uuid(),
        variationId: z.uuid().nullable().default(null),
        qty: z.number().int().min(1).max(99),
        note: z.string().trim().max(140).default(''),
      }),
    )
    .min(1)
    .max(50),
})

export type OrderRequestLine = z.output<typeof orderRequestSchema>['lines'][number]

export type SnapshotSourceItem = {
  id: string
  code: string
  name: string
  price_type: PriceType
  price_cents: number | null
  promo_price_cents: number | null
  sold_out: boolean
  item_variations: { id: string; name: string; price_cents: number; promo_price_cents: number | null; sold_out: boolean }[]
}

export type SnapshotLine = {
  item_id: string
  code: string
  name: string
  qty: number
  variation: { id: string; name: string } | null
  addons: never[]
  note: string | null
  unit_price_cents: number | null
}

type BuildResult =
  | { ok: true; payload: { items: SnapshotLine[] } }
  | { ok: false; reason: 'item_not_found' | 'sold_out' | 'variation_required' | 'variation_not_found' }

// Nunca guarda dados pessoais (spec 4.5): só itens, escolhas e preços do momento.
export function buildSnapshotPayload(lines: readonly OrderRequestLine[], items: readonly SnapshotSourceItem[]): BuildResult {
  const byId = new Map(items.map((item) => [item.id, item]))
  const result: SnapshotLine[] = []
  for (const line of lines) {
    const item = byId.get(line.itemId)
    if (!item) return { ok: false, reason: 'item_not_found' }
    if (item.sold_out) return { ok: false, reason: 'sold_out' }

    let variation: SnapshotSourceItem['item_variations'][number] | null = null
    if (item.item_variations.length > 0) {
      if (!line.variationId) return { ok: false, reason: 'variation_required' }
      variation = item.item_variations.find((v) => v.id === line.variationId) ?? null
      if (!variation) return { ok: false, reason: 'variation_not_found' }
      if (variation.sold_out) return { ok: false, reason: 'sold_out' }
    }

    result.push({
      item_id: item.id,
      code: item.code,
      name: item.name,
      qty: line.qty,
      variation: variation ? { id: variation.id, name: variation.name } : null,
      addons: [],
      note: line.note || null,
      unit_price_cents: unitPriceCents(
        { priceType: item.price_type, priceCents: item.price_cents, promoPriceCents: item.promo_price_cents },
        variation ? { priceCents: variation.price_cents, promoPriceCents: variation.promo_price_cents } : null,
      ),
    })
  }
  return { ok: true, payload: { items: result } }
}
```

`src/lib/orders/client-ip.ts`:

```ts
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return headers.get('x-real-ip')?.trim() || 'desconhecido'
}

export async function rateLimitKey(ip: string, action: string, salt: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${ip}`))
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${action}:${hex}`
}
```

Em `src/lib/server-env-schema.ts`:

```ts
export function parseOrderRateLimit(source: Source): number {
  return z.coerce.number().int().min(1).default(20).parse(source.ORDER_RATE_LIMIT_PER_HOUR ?? undefined)
}
```

Em `src/lib/server-env.ts`: `export const getOrderRateLimit = () => parseOrderRateLimit(process.env)`.

No job `e2e` de `.github/workflows/ci.yml`, acrescente em `env:` a linha `ORDER_RATE_LIMIT_PER_HOUR: '1000'` (todos os testes saem do mesmo IP). Em `.env.example`: `ORDER_RATE_LIMIT_PER_HOUR=20`.

- [ ] **Step 3: Rota**

`src/app/api/orders/route.ts`:

```ts
import * as Sentry from '@sentry/nextjs'
import { NextResponse, type NextRequest } from 'next/server'
import { generateOrderCode } from '@/lib/codes/order-code'
import { env } from '@/lib/env'
import { parseHost } from '@/lib/hosts/parse-host'
import { clientIp, rateLimitKey } from '@/lib/orders/client-ip'
import { buildSnapshotPayload, orderRequestSchema, type SnapshotSourceItem } from '@/lib/orders/snapshot'
import { getOrderRateLimit, getRateLimitSalt } from '@/lib/server-env'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

const fail = (status: number, error: string) => NextResponse.json({ error }, { status })

// Chamada pela vitrine pública (mesmo host). Se falhar, o navegador envia a
// mensagem sem código: a venda nunca é bloqueada (spec 7.5 e 10).
export async function POST(request: NextRequest) {
  const host = parseHost(request.headers.get('host'), {
    rootDomain: env.NEXT_PUBLIC_ROOT_DOMAIN,
    legacyDomains: env.LEGACY_DOMAINS,
  })
  if (host.type !== 'vitrine') return fail(404, 'Vitrine não encontrada.')

  const parsed = orderRequestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return fail(400, 'Pedido inválido.')

  try {
    const admin = createSupabaseAdminClient()
    const key = await rateLimitKey(clientIp(request.headers), 'orders', getRateLimitSalt())
    const { data: allowed, error: limitError } = await admin.rpc('hit_rate_limit', {
      p_key: key,
      p_limit: getOrderRateLimit(),
      p_window_seconds: 3600,
    })
    if (limitError) throw limitError
    if (!allowed) return fail(429, 'Muitos pedidos em pouco tempo. Tente mais tarde.')

    const { data: vitrine } = await admin
      .from('vitrines')
      .select('id, status')
      .eq('subdomain', host.subdomain)
      .maybeSingle()
    if (!vitrine || vitrine.status !== 'active') return fail(404, 'Vitrine não encontrada.')

    const { data: items, error: itemsError } = await admin
      .from('items')
      .select('id, code, name, price_type, price_cents, promo_price_cents, sold_out, item_variations(id, name, price_cents, promo_price_cents, sold_out)')
      .eq('vitrine_id', vitrine.id)
      .in('id', parsed.data.lines.map((line) => line.itemId))
      .is('deleted_at', null)
    if (itemsError) throw itemsError

    const snapshot = buildSnapshotPayload(parsed.data.lines, (items ?? []) as SnapshotSourceItem[])
    if (!snapshot.ok) return fail(422, 'Algum item não está mais disponível.')

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateOrderCode()
      const { data: inserted, error } = await admin.rpc('insert_order_snapshot', {
        p_vitrine_id: vitrine.id,
        p_code: code,
        p_payload: snapshot.payload,
      })
      if (error) throw error
      if (inserted) return NextResponse.json({ code }, { status: 201 })
    }
    return fail(503, 'Não foi possível gerar o código agora.')
  } catch (error) {
    Sentry.captureException(error)
    return fail(503, 'Não foi possível gerar o código agora.')
  }
}
```

- [ ] **Step 4: Commit**

```bash
npm run lint && npm run typecheck && npm test
git add -A src .github .env.example
git commit -m "feat(pedidos): API que grava o pedido com código e limite por IP"
```

---

### Task 22: Tela do item e envio ao WhatsApp

**Files:**
- Create: `src/app/v/[subdomain]/send-direct.ts`, `e2e/public-vitrine.spec.ts`
- Modify: `src/app/v/[subdomain]/item-sheet.tsx`

**Interfaces:**
- Consumes: `buildDirectMessage`, `buildWhatsAppUrl`, `isValidOrderCode`, `priceLabel`/`formatPriceLabel`, `POST /api/orders`
- Produces:
  - `requestOrderCode(itemId: string, variationId: string | null): Promise<string | null>` (tempo máximo 4 s; qualquer falha → `null`)
  - `sendDirect(vitrine: PublicVitrine, item: PublicItem, variation: { id: string; name: string } | null): Promise<void>`
- Textos: diálogo com `aria-label` = nome do item; `Fechar`; grupo `Escolha uma opção` com selo `Obrigatório · escolha 1`; erro `Escolha uma opção.`; botão com o texto do item ou da vitrine; `Esgotado`; `Abrindo o WhatsApp…`; `WhatsApp não configurado`.

- [ ] **Step 1: Envio**

`src/app/v/[subdomain]/send-direct.ts`:

```ts
import type { PublicItem, PublicVitrine } from '@/features/public/build-catalog'
import { isValidOrderCode } from '@/lib/codes/order-code'
import { buildDirectMessage, buildWhatsAppUrl } from '@/lib/whatsapp/messages'

export async function requestOrderCode(itemId: string, variationId: string | null): Promise<string | null> {
  try {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lines: [{ itemId, variationId, qty: 1 }] }),
      signal: AbortSignal.timeout(4000),
    })
    if (!response.ok) return null
    const { code } = (await response.json()) as { code?: unknown }
    return typeof code === 'string' && isValidOrderCode(code) ? code : null
  } catch {
    return null
  }
}

export async function sendDirect(
  vitrine: PublicVitrine,
  item: PublicItem,
  variation: { id: string; name: string } | null,
): Promise<void> {
  const phone = item.whatsappPhone ?? vitrine.primaryPhone
  if (!phone) return
  const orderCode = await requestOrderCode(item.id, variation?.id ?? null)
  const text = buildDirectMessage({
    vitrineType: vitrine.type,
    vitrineName: vitrine.name,
    itemName: item.name,
    itemCode: item.code,
    variationName: variation?.name ?? null,
    orderCode,
    customTemplate: item.customMessage,
  })
  window.location.assign(buildWhatsAppUrl(phone, text))
}
```

- [ ] **Step 2: Tela do item**

Substitua o provisório de `item-sheet.tsx` (Client, `export default`, props `ItemSheetProps`):

- `<div role="dialog" aria-modal="true" aria-label={item.name}>` sobre um fundo escuro. Celular: painel preso embaixo, altura máxima 90dvh, rolagem interna. Desktop (`md:`): janela centralizada, largura máxima 640 px. `Escape` e o botão `Fechar` chamam `onClose`; ao abrir, foco no botão `Fechar`; `document.body.style.overflow = 'hidden'` enquanto aberto.
- **Mídias** (só com `vitrine.showMedia`): carrossel horizontal com `scroll-snap` de capa + galeria, `<img src={large} srcSet=… sizes="(min-width: 768px) 640px, 100vw" alt="">`. Nesta fase não há vídeo.
- Nome (`<h2>`), descrição (`whitespace-pre-line`), preço (quando `showPrices`, com a variação escolhida: `formatBRL(unitPriceCents(item, variação))`; sem escolha, `formatPriceLabel(priceLabel(item, item.variations))`), duração e etiquetas.
- **Variações** (quando houver): `<fieldset>` com `<legend>Escolha uma opção</legend>`, selo `Obrigatório · escolha 1`, rádios com nome e preço (quando `showPrices`); variação esgotada fica `disabled` com `· Esgotado`.
- **Botão do rodapé** (fixo no fim do painel):
  - item esgotado → botão desabilitado `Esgotado`;
  - sem telefone (`item.whatsappPhone ?? vitrine.primaryPhone` nulo) → desabilitado `WhatsApp não configurado`;
  - senão, texto `item.buttonText ?? vitrine.defaultButtonText`. Ao clicar: sem variação escolhida quando obrigatória → mostra `Escolha uma opção.` com `role="alert"`, rola até o `fieldset` (`scrollIntoView({ block: 'center' })`) e destaca a borda; caso contrário, estado `Abrindo o WhatsApp…` (botão desabilitado) e `await sendDirect(vitrine, item, variação)`.
- Quantidade, observação e "Adicionar à sacola" ficam para a Fase 4.

- [ ] **Step 3: e2e**

`e2e/public-vitrine.spec.ts`:

```ts
import { expect, test, type Page } from '@playwright/test'
import { createAdminClient, createConfirmedUser, seedItem, seedVitrine, signIn, uniqueSubdomain } from './helpers'

const vitrineUrl = (subdomain: string) => `http://${subdomain}.localhost:3000/`

async function captureWhatsApp(page: Page) {
  await page.route('https://wa.me/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: 'ok' }))
  return page.waitForRequest(/^https:\/\/wa\.me\//)
}

test('endereço passa de 404 para a vitrine assim que ela é criada no painel', async ({ page }) => {
  const subdomain = uniqueSubdomain('nasce')
  const before = await page.goto(vitrineUrl(subdomain))
  expect(before?.status()).toBe(404)

  const user = await createConfirmedUser('nasce')
  await signIn(page, user.email, user.password)
  await page.goto('/painel/vitrines/nova')
  await page.getByLabel('Produtos').check()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByLabel('Nome da vitrine').fill('Loja Nova')
  await page.getByLabel('Endereço da vitrine').fill(subdomain)
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByLabel('WhatsApp', { exact: true }).fill('(11) 98765-4321')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByRole('button', { name: 'Criar vitrine' }).click()
  await expect(page).toHaveURL(/\/itens$/)

  const after = await page.goto(vitrineUrl(subdomain))
  expect(after?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1, name: 'Loja Nova' })).toBeVisible()
})

test('catálogo, tela do item com variação e mensagem com código de pedido', async ({ page }) => {
  const user = await createConfirmedUser('publica')
  const vitrine = await seedVitrine(user.id, { name: 'Loja da Ana', phone: '+5511912345678' })
  const simple = await seedItem(vitrine, user.id, { name: 'Caneca', priceCents: 2590 })
  const withVariations = await seedItem(vitrine, user.id, {
    name: 'Camiseta',
    variations: [
      { name: 'P', priceCents: 3990 },
      { name: 'G', priceCents: 4490 },
    ],
  })

  await page.goto(vitrineUrl(vitrine.subdomain))
  await expect(page.getByRole('heading', { level: 1, name: 'Loja da Ana' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Destaques' })).toBeVisible()
  await expect(page.getByText('R$ 25,90')).toBeVisible()
  await expect(page.getByText('A partir de R$ 39,90')).toBeVisible()
  await expect(page.getByText('Feito com Agenn Vitrine')).toBeVisible()

  await page.getByRole('button', { name: 'Camiseta' }).click()
  await expect(page).toHaveURL(new RegExp(`\\?item=${withVariations.code}$`))
  const dialog = page.getByRole('dialog', { name: 'Camiseta' })
  await dialog.getByRole('button', { name: 'Solicitar orçamento' }).click()
  await expect(dialog.getByText('Escolha uma opção.')).toBeVisible()

  await dialog.getByLabel(/^G/).check()
  const whatsapp = captureWhatsApp(page)
  await dialog.getByRole('button', { name: 'Solicitar orçamento' }).click()
  const url = new URL((await whatsapp).url())
  expect(url.pathname).toBe('/5511912345678')
  const text = url.searchParams.get('text')!
  expect(text).toMatch(
    new RegExp(`^Olá! Vim da vitrine \\*Loja da Ana\\* e tenho interesse em: \\*Camiseta – G\\* \\(cód\\. ${withVariations.code}\\)\\. Pedido #[23456789A-HJ-NP-Z]{4}$`),
  )

  const orderCode = text.slice(-4)
  const { data: snapshot } = await createAdminClient()
    .from('order_snapshots')
    .select('payload')
    .eq('owner_id', user.id)
    .eq('code', orderCode)
    .single()
    .throwOnError()
  expect(snapshot.payload.items[0]).toMatchObject({ code: withVariations.code, variation: { name: 'G' }, unit_price_cents: 4490 })
  expect(simple.code).toBeTruthy()
})

test('link com ?item= abre a tela e falha na API ainda envia sem código', async ({ page }) => {
  const user = await createConfirmedUser('deeplink')
  const vitrine = await seedVitrine(user.id, { type: 'servicos', name: 'Studio' })
  const item = await seedItem(vitrine, user.id, { name: 'Manicure', priceCents: 4000 })

  await page.route('**/api/orders', (route) => route.abort())
  await page.goto(`${vitrineUrl(vitrine.subdomain)}?item=${item.code}`)
  const dialog = page.getByRole('dialog', { name: 'Manicure' })
  await expect(dialog).toBeVisible()

  const whatsapp = captureWhatsApp(page)
  await dialog.getByRole('button', { name: 'Agendar' }).click()
  const text = new URL((await whatsapp).url()).searchParams.get('text')
  expect(text).toBe(`Olá! Vim da vitrine *Studio* e gostaria de agendar: *Manicure* (cód. ${item.code}).`)
})

test('alteração no painel aparece na vitrine pública', async ({ page }) => {
  const user = await createConfirmedUser('revalida')
  const vitrine = await seedVitrine(user.id)
  const item = await seedItem(vitrine, user.id, { name: 'Nome Antigo', priceCents: 1000 })

  await page.goto(vitrineUrl(vitrine.subdomain))
  await expect(page.getByText('Nome Antigo')).toBeVisible()

  await signIn(page, user.email, user.password)
  await page.goto(`/painel/vitrines/${vitrine.id}/itens/${item.id}`)
  await page.getByLabel('Nome', { exact: true }).fill('Nome Novo')
  await page.getByRole('button', { name: 'Salvar item' }).click()
  await expect(page.getByText('Item salvo.')).toBeVisible()

  await page.goto(vitrineUrl(vitrine.subdomain))
  await expect(page.getByText('Nome Novo')).toBeVisible()
})
```

O último teste depende de a capa semeada existir como mídia `cover` do item (o `seedItem` cria), para o `saveItemAction` aceitar o `coverMediaId` que o formulário carrega.

- [ ] **Step 4: Verificar o modo de renderização**

No log do job `e2e` (passo `npm run build`), a rota `/v/[subdomain]` deve aparecer como **SSG/ISR** (`●`), não como dinâmica (`ƒ`). Se aparecer `ƒ`, algo na página usa API dinâmica (`cookies`, `headers`, `searchParams`): remova antes do merge.

- [ ] **Step 5: Commit, PR e merge do bloco**

```bash
npm run lint && npm run typecheck && npm test
git add -A src e2e
git commit -m "feat(vitrine): tela do item com variações e envio direto ao WhatsApp com código de pedido"
git push -u origin HEAD
gh pr create --fill --base master
gh pr checks --watch
```

**Fim do Bloco 7:** confirmar `RATE_LIMIT_SALT` na Vercel → autorização → merge → redeploy. Conferência na nuvem: abrir `https://{subdominio}.agenn.com.br` no celular, abrir um item, tocar no botão e conferir que o WhatsApp abre com a mensagem e `Pedido #XXXX`; editar o preço no painel e recarregar a vitrine; compartilhar o link `?item=` e abrir em outro aparelho. Rodar o Lighthouse (mobile) do Chrome na vitrine e anotar a nota; a meta de 90 é trabalhada na fase de design/desempenho.

---

# Bloco 8 — Simulador

Branch: `fase-2/bloco-8-simulador`.

### Task 23: Recálculo e resumo com valores

**Files:**
- Create: `src/lib/simulator/simulate.ts`, `src/lib/simulator/simulate.test.ts`, `src/features/simulator/actions.ts`, `src/app/app/(painel)/painel/simulador/page.tsx`, `src/app/app/(painel)/painel/simulador/simulator.tsx`, `e2e/simulator.spec.ts`

**Interfaces:**
- Produces:
  - `type SimulatorItem = { id; code; name; vitrineName; deleted: boolean; soldOut: boolean; priceType; priceCents; promoPriceCents; variations: { id; name; priceCents; promoPriceCents }[] }`
  - `type SimulatorLineInput = { itemId: string; variationId: string | null; qty: number; previousUnitCents?: number | null; snapshotName?: string; snapshotCode?: string; snapshotVariationName?: string | null }`
  - `type SimulatedLine = { name; code; variationName: string | null; qty; unitCents: number | null; subtotalCents: number | null; status: 'ok' | 'price_changed' | 'removed' | 'variation_removed'; previousUnitCents: number | null }`
  - `simulateOrder(lines: SimulatorLineInput[], items: Map<string, SimulatorItem>): { lines: SimulatedLine[]; total: { totalCents; hasOnRequest }; hasChanges: boolean }`
  - `linesFromSnapshot(payload: unknown): SimulatorLineInput[]`
  - `buildPricedSummary(result, orderCode: string | null): string`
  - `lookupOrderAction(code: string): Promise<{ error: string } | { code; createdAt; lines: SimulatorLineInput[]; items: SimulatorItem[] }>`
  - `findItemByCodeAction(code: string): Promise<{ error: string } | { item: SimulatorItem }>`
- Textos: `Simulador`, `Por código do pedido`, `Código do pedido`, `Consultar`, `Pedido não encontrado ou expirado.`, `Modo manual`, `Código do item`, `Adicionar`, `Item não encontrado.`, `Variação`, `Quantidade`, `Remover`, `Total`, `Preço mudou desde o envio (era {valor})`, `Item não existe mais`, `Variação não existe mais`, `Copiar resumo com valores`, `Resumo copiado.`

- [ ] **Step 1: Testes (falhando)**

`src/lib/simulator/simulate.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildPricedSummary, linesFromSnapshot, simulateOrder, type SimulatorItem } from './simulate'

const items = new Map<string, SimulatorItem>([
  ['i1', { id: 'i1', code: '104', name: 'X-Bacon', vitrineName: 'Burger', deleted: false, soldOut: false, priceType: 'fixed', priceCents: 2590, promoPriceCents: null, variations: [] }],
  ['i2', {
    id: 'i2', code: '105', name: 'Camiseta', vitrineName: 'Loja', deleted: false, soldOut: false, priceType: 'fixed', priceCents: null, promoPriceCents: null,
    variations: [{ id: 'g', name: 'G', priceCents: 4490, promoPriceCents: 3990 }],
  }],
  ['i3', { id: 'i3', code: '106', name: 'Consulta', vitrineName: 'Loja', deleted: false, soldOut: false, priceType: 'on_request', priceCents: null, promoPriceCents: null, variations: [] }],
  ['i4', { id: 'i4', code: '107', name: 'Antigo', vitrineName: 'Loja', deleted: true, soldOut: false, priceType: 'fixed', priceCents: 1000, promoPriceCents: null, variations: [] }],
])

describe('simulateOrder', () => {
  it('soma com preços atuais e marca mudanças', () => {
    const result = simulateOrder(
      [
        { itemId: 'i1', variationId: null, qty: 2, previousUnitCents: 2390 },
        { itemId: 'i2', variationId: 'g', qty: 1, previousUnitCents: 3990 },
        { itemId: 'i3', variationId: null, qty: 1, previousUnitCents: null },
      ],
      items,
    )
    expect(result.lines.map((l) => [l.name, l.unitCents, l.subtotalCents, l.status])).toEqual([
      ['X-Bacon', 2590, 5180, 'price_changed'],
      ['Camiseta', 3990, 3990, 'ok'],
      ['Consulta', null, null, 'ok'],
    ])
    expect(result.total).toEqual({ totalCents: 9170, hasOnRequest: true })
    expect(result.hasChanges).toBe(true)
  })

  it('item ou variação removidos ficam fora do total', () => {
    const result = simulateOrder(
      [
        { itemId: 'i4', variationId: null, qty: 1, previousUnitCents: 1000, snapshotName: 'Antigo', snapshotCode: '107' },
        { itemId: 'i2', variationId: 'sumiu', qty: 1, previousUnitCents: 3000, snapshotVariationName: 'M' },
        { itemId: 'nao-existe', variationId: null, qty: 1, snapshotName: 'Fantasma', snapshotCode: '999' },
      ],
      items,
    )
    expect(result.lines.map((l) => [l.name, l.status, l.subtotalCents])).toEqual([
      ['Antigo', 'removed', null],
      ['Camiseta', 'variation_removed', null],
      ['Fantasma', 'removed', null],
    ])
    expect(result.total).toEqual({ totalCents: 0, hasOnRequest: false })
  })
})

it('linesFromSnapshot lê o payload gravado', () => {
  expect(
    linesFromSnapshot({
      items: [{ item_id: 'i1', code: '104', name: 'X-Bacon', qty: 2, variation: null, addons: [], note: null, unit_price_cents: 2390 }],
    }),
  ).toEqual([{ itemId: 'i1', variationId: null, qty: 2, previousUnitCents: 2390, snapshotName: 'X-Bacon', snapshotCode: '104', snapshotVariationName: null }])
  expect(linesFromSnapshot(null)).toEqual([])
})

it('resumo com valores para colar no WhatsApp', () => {
  const result = simulateOrder(
    [
      { itemId: 'i1', variationId: null, qty: 2 },
      { itemId: 'i2', variationId: 'g', qty: 1 },
      { itemId: 'i3', variationId: null, qty: 1 },
    ],
    items,
  )
  expect(buildPricedSummary(result, 'K7F2')).toBe(
    [
      '*Pedido #K7F2*',
      '',
      '2x X-Bacon (cód. 104) – R$ 25,90 = R$ 51,80',
      '1x Camiseta – G (cód. 105) – R$ 39,90 = R$ 39,90',
      '1x Consulta (cód. 106) – sob consulta',
      '',
      '*Total: R$ 91,70 + itens sob consulta*',
    ].join('\n'),
  )
  expect(buildPricedSummary(result, null).startsWith('*Resumo*')).toBe(true)
})
```

Run: `npm test -- src/lib/simulator` → FAIL.

- [ ] **Step 2: Implementação**

`src/lib/simulator/simulate.ts`:

```ts
import { formatBRL } from '@/lib/money/money'
import { formatOrderTotal, lineTotalCents, orderTotal, unitPriceCents, type PriceType } from '@/lib/pricing/price'

export type SimulatorItem = {
  id: string; code: string; name: string; vitrineName: string; deleted: boolean; soldOut: boolean
  priceType: PriceType; priceCents: number | null; promoPriceCents: number | null
  variations: { id: string; name: string; priceCents: number; promoPriceCents: number | null }[]
}

export type SimulatorLineInput = {
  itemId: string
  variationId: string | null
  qty: number
  previousUnitCents?: number | null
  snapshotName?: string
  snapshotCode?: string
  snapshotVariationName?: string | null
}

export type SimulatedLine = {
  name: string
  code: string
  variationName: string | null
  qty: number
  unitCents: number | null
  subtotalCents: number | null
  status: 'ok' | 'price_changed' | 'removed' | 'variation_removed'
  previousUnitCents: number | null
}

export function simulateOrder(lines: readonly SimulatorLineInput[], items: ReadonlyMap<string, SimulatorItem>) {
  const simulated: SimulatedLine[] = lines.map((line) => {
    const item = items.get(line.itemId)
    const previousUnitCents = line.previousUnitCents ?? null
    if (!item || item.deleted) {
      return {
        name: item?.name ?? line.snapshotName ?? 'Item',
        code: item?.code ?? line.snapshotCode ?? '',
        variationName: line.snapshotVariationName ?? null,
        qty: line.qty,
        unitCents: null,
        subtotalCents: null,
        status: 'removed',
        previousUnitCents,
      }
    }
    const variation = line.variationId ? item.variations.find((v) => v.id === line.variationId) : null
    if (line.variationId && !variation) {
      return {
        name: item.name, code: item.code, variationName: line.snapshotVariationName ?? null, qty: line.qty,
        unitCents: null, subtotalCents: null, status: 'variation_removed', previousUnitCents,
      }
    }
    const unitCents = unitPriceCents(item, variation ?? null)
    const changed = line.previousUnitCents !== undefined && previousUnitCents !== unitCents
    return {
      name: item.name,
      code: item.code,
      variationName: variation?.name ?? null,
      qty: line.qty,
      unitCents,
      subtotalCents: lineTotalCents(unitCents, line.qty),
      status: changed ? 'price_changed' : 'ok',
      previousUnitCents,
    }
  })

  const counted = simulated.filter((line) => line.status === 'ok' || line.status === 'price_changed')
  return {
    lines: simulated,
    total: orderTotal(counted.map((line) => line.subtotalCents)),
    hasChanges: simulated.some((line) => line.status !== 'ok'),
  }
}

export function linesFromSnapshot(payload: unknown): SimulatorLineInput[] {
  const items = (payload as { items?: unknown })?.items
  if (!Array.isArray(items)) return []
  return items.map((raw) => {
    const line = raw as {
      item_id: string; code: string; name: string; qty: number
      variation: { id: string; name: string } | null; unit_price_cents: number | null
    }
    return {
      itemId: line.item_id,
      variationId: line.variation?.id ?? null,
      qty: line.qty,
      previousUnitCents: line.unit_price_cents,
      snapshotName: line.name,
      snapshotCode: line.code,
      snapshotVariationName: line.variation?.name ?? null,
    }
  })
}

export function buildPricedSummary(result: ReturnType<typeof simulateOrder>, orderCode: string | null): string {
  const lines = result.lines
    .filter((line) => line.status === 'ok' || line.status === 'price_changed')
    .map((line) => {
      const label = line.variationName ? `${line.name} – ${line.variationName}` : line.name
      const prefix = `${line.qty}x ${label} (cód. ${line.code})`
      if (line.unitCents === null) return `${prefix} – sob consulta`
      return `${prefix} – ${formatBRL(line.unitCents)} = ${formatBRL(line.subtotalCents!)}`
    })
  const title = orderCode ? `*Pedido #${orderCode}*` : '*Resumo*'
  return [title, '', ...lines, '', `*Total: ${formatOrderTotal(result.total)}*`].join('\n')
}
```

Run: `npm test -- src/lib/simulator` → PASS.

- [ ] **Step 3: Ações**

`src/features/simulator/actions.ts`:

```ts
'use server'

import { requireActionUser } from '@/lib/auth/action-user'
import { validateItemCode } from '@/lib/codes/item-code'
import { isValidOrderCode, normalizeOrderCode } from '@/lib/codes/order-code'
import { linesFromSnapshot, type SimulatorItem } from '@/lib/simulator/simulate'

const ITEM_COLUMNS =
  'id, code, name, deleted_at, sold_out, price_type, price_cents, promo_price_cents, vitrines(name), item_variations(id, name, price_cents, promo_price_cents)'

type ItemRow = {
  id: string; code: string; name: string; deleted_at: string | null; sold_out: boolean; price_type: string
  price_cents: number | null; promo_price_cents: number | null; vitrines: { name: string } | null
  item_variations: { id: string; name: string; price_cents: number; promo_price_cents: number | null }[]
}

function toSimulatorItem(row: ItemRow): SimulatorItem {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    vitrineName: row.vitrines?.name ?? '',
    deleted: row.deleted_at !== null,
    soldOut: row.sold_out,
    priceType: row.price_type as SimulatorItem['priceType'],
    priceCents: row.price_cents,
    promoPriceCents: row.promo_price_cents,
    variations: row.item_variations.map((v) => ({ id: v.id, name: v.name, priceCents: v.price_cents, promoPriceCents: v.promo_price_cents })),
  }
}

export async function lookupOrderAction(input: string) {
  const code = normalizeOrderCode(input)
  if (!isValidOrderCode(code)) return { error: 'Pedido não encontrado ou expirado.' }
  const { supabase } = await requireActionUser()
  const { data: order } = await supabase
    .from('order_snapshots')
    .select('code, payload, created_at')
    .eq('code', code)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  if (!order) return { error: 'Pedido não encontrado ou expirado.' }

  const lines = linesFromSnapshot(order.payload)
  const ids = [...new Set(lines.map((line) => line.itemId))]
  const { data: rows } = ids.length ? await supabase.from('items').select(ITEM_COLUMNS).in('id', ids) : { data: [] }
  return {
    code: order.code,
    createdAt: order.created_at,
    lines,
    items: ((rows ?? []) as unknown as ItemRow[]).map(toSimulatorItem),
  }
}

export async function findItemByCodeAction(input: string) {
  const result = validateItemCode(input)
  if (!result.ok) return { error: 'Item não encontrado.' }
  const { supabase } = await requireActionUser()
  const { data: row } = await supabase
    .from('items')
    .select(ITEM_COLUMNS)
    .eq('code', result.value)
    .is('deleted_at', null)
    .maybeSingle()
  if (!row) return { error: 'Item não encontrado.' }
  return { item: toSimulatorItem(row as unknown as ItemRow) }
}
```

O código é único por conta, então a busca não precisa da vitrine (spec 8.6).

- [ ] **Step 4: Tela**

`simulador/page.tsx`: título `Simulador` e `<Simulator />`.

`simulator.tsx` (Client), duas seções:

- **`Por código do pedido`**: campo `Código do pedido` + botão `Consultar` (`useTransition` → `lookupOrderAction`). Com resultado: data do pedido (`toLocaleString('pt-BR')`), tabela das linhas de `simulateOrder(lines, new Map(items.map(i => [i.id, i])))` com quantidade, nome (+ variação), código, unitário, subtotal e avisos por status: `Preço mudou desde o envio (era {formatBRL(previous)})`, `Item não existe mais`, `Variação não existe mais`. Linha `Total` com `formatOrderTotal`. Botão `Copiar resumo com valores` → `navigator.clipboard.writeText(buildPricedSummary(result, code))` e mensagem `Resumo copiado.`
- **`Modo manual`**: campo `Código do item` + `Adicionar` (`findItemByCodeAction`; erro `Item não encontrado.`). Estado com os itens encontrados e as linhas `{ key, itemId, variationId, qty }`. Cada linha: nome e vitrine, `select` `Variação` (se houver; obrigatório, começa na primeira), campo `Quantidade` (1 a 99), `Remover`. O total é recalculado a cada mudança com `simulateOrder` (sem `previousUnitCents`), e o mesmo botão `Copiar resumo com valores` usa `buildPricedSummary(result, null)`. Os rótulos dos campos de cada linha incluem o nome do item (`aria-label="Quantidade de {nome}"`).

- [ ] **Step 5: e2e**

`e2e/simulator.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { createAdminClient, createConfirmedUser, seedItem, seedVitrine, signIn } from './helpers'

test('simulador recalcula pedido pelo código e soma no modo manual', async ({ page }) => {
  const user = await createConfirmedUser('simulador')
  const vitrine = await seedVitrine(user.id)
  const bacon = await seedItem(vitrine, user.id, { name: 'X-Bacon', priceCents: 2590 })
  const suco = await seedItem(vitrine, user.id, { name: 'Suco', priceCents: 800 })

  const admin = createAdminClient()
  await admin
    .rpc('insert_order_snapshot', {
      p_vitrine_id: vitrine.id,
      p_code: 'K7F2',
      p_payload: {
        items: [{ item_id: bacon.id, code: bacon.code, name: 'X-Bacon', qty: 2, variation: null, addons: [], note: null, unit_price_cents: 2390 }],
      },
    })
    .throwOnError()

  await signIn(page, user.email, user.password)
  await page.getByRole('link', { name: 'Simulador' }).filter({ visible: true }).first().click()

  await page.getByLabel('Código do pedido').fill('#k7f2')
  await page.getByRole('button', { name: 'Consultar' }).click()
  await expect(page.getByText('Preço mudou desde o envio (era R$ 23,90)')).toBeVisible()
  await expect(page.getByText('R$ 51,80').first()).toBeVisible()

  await page.getByLabel('Código do item').fill(suco.code)
  await page.getByRole('button', { name: 'Adicionar' }).click()
  await page.getByLabel('Quantidade de Suco').fill('3')
  await expect(page.getByText('R$ 24,00').last()).toBeVisible()

  await page.getByLabel('Código do item').fill('ZZZZZ')
  await page.getByRole('button', { name: 'Adicionar' }).click()
  await expect(page.getByText('Item não encontrado.')).toBeVisible()
})
```

No projeto `mobile`, o link `Simulador` fica escondido na navegação do topo (Fase 1 esconde a nav no celular). Acrescente o link `Simulador` também no conteúdo de `/painel` (abaixo do contador de vitrines), para existir um caminho no celular; o `.first()` do teste cobre os dois.

- [ ] **Step 6: Commit, PR e merge do bloco**

```bash
npm run lint && npm run typecheck && npm test
git add -A src e2e
git commit -m "feat(simulador): recálculo por código do pedido, modo manual e resumo com valores"
git push -u origin HEAD
gh pr create --fill --base master
gh pr checks --watch
```

**Fim do Bloco 8:** autorização → merge. Conferência na nuvem: usar o código recebido no WhatsApp no Bloco 7, consultar no simulador pelo celular, copiar o resumo e colar numa conversa.

---

# Bloco 9 — Ponta a ponta e fechamento

Branch: `fase-2/bloco-9-fechamento`.

### Task 24: Fluxo completo e bloqueios do gratuito

**Files:**
- Create: `e2e/fluxo-completo.spec.ts`, `e2e/limits.spec.ts`

- [ ] **Step 1: Fluxo completo (spec 11)**

`e2e/fluxo-completo.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { createConfirmedUser, makeTestImage, signIn, uniqueSubdomain, uploadImage } from './helpers'

test('criar vitrine → cadastrar item → vitrine pública → WhatsApp → simulador', async ({ page }) => {
  const user = await createConfirmedUser('fluxo')
  await signIn(page, user.email, user.password)

  const subdomain = uniqueSubdomain('fluxo')
  await page.goto('/painel/vitrines/nova')
  await page.getByLabel('Produtos').check()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByLabel('Nome da vitrine').fill('Burger do Zé')
  await page.getByLabel('Endereço da vitrine').fill(subdomain)
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByLabel('WhatsApp', { exact: true }).fill('(11) 98765-4321')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByRole('button', { name: 'Criar vitrine' }).click()
  await expect(page).toHaveURL(/\/itens$/)

  await page.getByRole('link', { name: 'Novo item' }).click()
  await uploadImage(page, 'Capa', await makeTestImage(page))
  await page.getByLabel('Nome', { exact: true }).fill('X-Bacon')
  await page.getByLabel('Categoria').selectOption({ label: 'Destaques' })
  await page.getByLabel('Preço', { exact: true }).fill('25,90')
  await page.getByRole('button', { name: 'Salvar item' }).click()
  await expect(page.getByText('Item salvo.')).toBeVisible()

  await page.goto(`http://${subdomain}.localhost:3000/`)
  await expect(page.getByRole('heading', { level: 1, name: 'Burger do Zé' })).toBeVisible()
  await page.getByRole('button', { name: 'X-Bacon' }).click()
  await page.route('https://wa.me/**', (route) => route.fulfill({ status: 200, body: 'ok' }))
  const request = page.waitForRequest(/^https:\/\/wa\.me\//)
  await page.getByRole('dialog', { name: 'X-Bacon' }).getByRole('button', { name: 'Solicitar orçamento' }).click()
  const url = new URL((await request).url())
  expect(url.pathname).toBe('/5511987654321')
  const text = url.searchParams.get('text')!
  expect(text).toContain('*X-Bacon* (cód. 101)')
  const orderCode = text.match(/Pedido #([23456789A-HJ-NP-Z]{4})$/)![1]

  await page.goto('/painel/simulador')
  await page.getByLabel('Código do pedido').fill(orderCode)
  await page.getByRole('button', { name: 'Consultar' }).click()
  await expect(page.getByText('R$ 25,90').first()).toBeVisible()
})
```

- [ ] **Step 2: Bloqueios do gratuito**

`e2e/limits.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { createConfirmedUser, makeTestImage, seedItem, seedVitrine, setPlan, signIn, uploadImage } from './helpers'

test('gratuito: 11º item vira convite para o Pro; Pro cadastra', async ({ page }) => {
  const user = await createConfirmedUser('limite-itens')
  const vitrine = await seedVitrine(user.id)
  for (let i = 1; i <= 10; i++) await seedItem(vitrine, user.id, { name: `Item ${i}`, priceCents: 1000 })
  await signIn(page, user.email, user.password)

  await page.goto(`/painel/vitrines/${vitrine.id}/itens/novo`)
  await uploadImage(page, 'Capa', await makeTestImage(page))
  await page.getByLabel('Nome', { exact: true }).fill('Décimo primeiro')
  await page.getByLabel('Categoria').selectOption({ label: 'Destaques' })
  await page.getByLabel('Preço', { exact: true }).fill('10')
  await page.getByRole('button', { name: 'Salvar item' }).click()
  await expect(page.getByText('Seu plano permite até 10 itens por vitrine. Assine o Pro para cadastrar mais.')).toBeVisible()

  await setPlan(user.id, 'pro')
  await page.getByRole('button', { name: 'Salvar item' }).click()
  await expect(page.getByText('Item salvo.')).toBeVisible()
})

test('gratuito: nova vitrine bloqueada; marca com cadeado; vitrine pública com marca d’água', async ({ page }) => {
  const user = await createConfirmedUser('limite-vitrine')
  const vitrine = await seedVitrine(user.id)
  await seedItem(vitrine, user.id, { name: 'Único', priceCents: 1000 })
  await signIn(page, user.email, user.password)

  await page.goto('/painel/vitrines/nova')
  await expect(page.getByText('Seu plano permite até 1 vitrine. Assine o Pro para criar mais.')).toBeVisible()

  await page.goto(`/painel/vitrines/${vitrine.id}/aparencia`)
  await expect(page.getByText('Recurso do plano Pro')).toBeVisible()

  await page.goto(`http://${vitrine.subdomain}.localhost:3000/`)
  await expect(page.getByText('Feito com Agenn Vitrine')).toBeVisible()
})
```

O congelamento ao voltar para o gratuito (spec 11) é da Fase 5.

- [ ] **Step 3: Commit**

```bash
git add e2e/fluxo-completo.spec.ts e2e/limits.spec.ts
git commit -m "test(e2e): fluxo completo da vitrine e bloqueios do plano gratuito"
```

---

### Task 25: Guia de infraestrutura, conferência final e memória

**Files:**
- Modify: `docs/setup/fase-2-infra.md`, `README.md` (seção "Como testar": CI e `gh`)

- [ ] **Step 1: Completar o guia**

Em `docs/setup/fase-2-infra.md`, acrescentar:
- **Conferência em produção** — a lista abaixo (Step 2).
- **Pendências registradas** — arrastar para reordenar, prévia ao vivo e barra "Alterações não salvas" (fase de design); `robots.txt`/`sitemap.xml` por vitrine e matcher do proxy (Fase 6); prévias `*.vercel.app` sem roteamento; limpeza de mídias órfãs e de `order_snapshots`/`rate_limits` antigos (tarefas diárias da Fase 3); meta de Lighthouse ≥ 90 ainda não medida no CI.

No `README.md`, descrever: testes rodam no GitHub Actions (`gh pr checks --watch`); localmente só `npm run lint`, `npm run typecheck` e `npm test`; tipos do banco vêm do artefato `database-types`.

- [ ] **Step 2: Conferência em produção (`app.agenn.com.br`)**

Com o usuário, no celular e no computador:
1. Criar conta nova, criar vitrine de Serviços, cadastrar dois itens com foto (um com variações e mensagem personalizada, outro com WhatsApp secundário).
2. Abrir `https://{subdominio}.agenn.com.br`: listagem, busca por código, barra de categorias, tela do item, envio ao WhatsApp (conferir número, texto e `Pedido #`).
3. Abrir o link `?item=` recebido em outro aparelho.
4. Simulador: consultar o código, alterar um preço no painel, consultar de novo e ver o aviso de preço alterado; copiar o resumo.
5. Trocar o subdomínio em Configurações: o antigo responde "Vitrine não encontrada" e o novo abre.
6. Excluir a vitrine de teste e conferir no Bunny que a pasta da vitrine ficou vazia.
7. Conferir no Sentry (se configurado) que não houve erros novos.

- [ ] **Step 3: PR e merge final**

```bash
npm run lint && npm run typecheck && npm test
git add docs README.md
git commit -m "docs(infra): guia da Fase 2 e conferência em produção"
git push -u origin HEAD
gh pr create --fill --base master
gh pr checks --watch
```

Autorização do usuário → merge.

- [ ] **Step 4: Atualizar a memória**

Atualizar `fase-1-pendencias.md` (pendência do proxy resolvida; coberturas feitas) e criar a memória `fase-2-pendencias` com os itens de "Pendências registradas" e qualquer desvio decidido durante a execução.

---

## Cobertura da spec nesta fase

| Spec | Onde |
|---|---|
| 3 — limites de vitrines, itens e imagens por item | Tasks 4, 5 (triggers), 12, 19, 24 |
| 4.2 — vitrines, WhatsApp, categorias | Tasks 4, 12, 13, 17 |
| 4.3 — itens, códigos, variações, mídias | Tasks 5, 18, 19 |
| 4.5 — `order_snapshots`, `rate_limits` | Tasks 6, 21 |
| 4.6 — preço (sem complementos) | Tasks 7, 21, 23 |
| 4.7 — itens visíveis e marca ignorada no gratuito | Task 20 |
| 4.8 — RLS, travas, leitura pública só de `active` | Tasks 4–6, 20 |
| 5.1 / 5.2 — códigos | Tasks 5, 8, 18, 21 |
| 6.1 — imagens | Tasks 14–16 |
| 6.3 — exibição de imagens | Tasks 20, 22 |
| 7.1 — geração estática, revalidação, OG, 404 e indisponível | Tasks 20, 22 |
| 7.2 / 7.3 — estrutura e tela do item (sem sacola) | Tasks 20, 22 |
| 7.5 — botão direto e mensagens | Tasks 9, 22 |
| 8.2 — Minhas vitrines (sem QR Code) | Task 12 |
| 8.3 — assistente | Task 12 |
| 8.4 — editor (abas desta fase) | Task 13 |
| 8.5 — editor de item (sem vídeo e complementos) | Task 18 |
| 8.6 — simulador | Task 23 |
| 8.9 — Pro com cadeado | Tasks 13, 16 |
| 10 — erros (envio de mídia, código de pedido, limite por IP, limite de plano) | Tasks 10, 15, 16, 21, 22 |
| 11 — testes | Todas; e2e em 12, 13, 16, 19, 22, 23, 24 |
| Pendências da Fase 1 | Tasks 1–3 |

