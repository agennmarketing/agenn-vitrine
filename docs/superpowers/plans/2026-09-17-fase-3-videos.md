# Fase 3 — Vídeos: Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O dono envia vídeos (9:16 ou 16:9, até 60 s) para os itens e um banner em vídeo (Pro) direto ao Bunny Stream, com envio retomável e status de processamento; a vitrine pública toca o vídeo só quando a tela do item abre (hls.js sob demanda), mede os bytes entregues para a franquia mensal de 1 TB e, ao estourar, volta a mostrar só as capas e avisa o dono por e-mail (Resend); uma tarefa diária limpa mídias órfãs e registros expirados.

**Architecture:** Mesmo app Next.js 16 das fases anteriores. O servidor cria o vídeo no Bunny Stream e devolve uma assinatura TUS temporária; o navegador envia o arquivo direto ao Bunny com `tus-js-client`. O webhook assinado do Bunny (`POST /api/webhooks/bunny`) consulta o vídeo na API antes de atualizar `media`. Travas de quantidade de vídeos ficam em trigger; o consumo mensal fica em `video_usage_monthly`, alimentado pelo próprio player da vitrine (`POST /api/video-usage`) e atualizado por uma função do banco que avisa quando a franquia estoura. No CI, um driver `fake` substitui o Bunny Stream (mesma interface), como já acontece com as imagens. Uma rota de Vercel Cron roda uma vez por dia.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase (Postgres + RLS), Bunny Stream (API HTTP, TUS, webhooks), tus-js-client, hls.js, Resend (API HTTP), Vercel Cron, Vitest, Playwright, pgTAP, GitHub Actions, ffmpeg (só no CI, para gerar vídeos de teste).

**Spec:** `docs/superpowers/specs/2026-09-16-agenn-vitrine-design.md`. Seções usadas: 3 (limites de vídeo e franquia), 4.1 (`video_usage_monthly`), 4.3 (`media` de vídeo), 4.7 (1 vídeo visível no gratuito), 4.8 (trava de vídeos), 6.2, 6.3, 6.4 (exceto os itens que dependem do Stripe), 7.1 (revalidar ao terminar o vídeo), 8.2 (uso do plano), 8.5 (espaço Vídeo), 10 (envio interrompido, vídeo fora do limite, processamento falhou), 11 (webhook do Bunny com API simulada) e 12 (Fase 3).

**Base:** Fase 2 concluída (PRs #1–#11). Plano anterior: `docs/superpowers/plans/2026-09-17-fase-2-vitrines.md`. Guia de infraestrutura: `docs/setup/fase-2-infra.md`.

---

## Validação pedida pela spec (seção 6.4)

> "A validar no início da fase 3: se a API de estatísticas do Bunny informa o consumo por vídeo."

**Resultado (conferido na especificação OpenAPI oficial `https://video.bunnycdn.com/openapi/bunnynet-video-api.public.json`, em 2026-09-17):**

- `GET /library/{libraryId}/statistics?videoGuid=…` devolve só `viewsChart`, `watchTimeChart`, `countryViewCounts`, `countryWatchTime` e `engagementScore`. **Não há bytes nem banda por vídeo.**
- Banda só existe no total da biblioteca ou da Pull Zone (`GET /statistics?pullZone=…` da API geral: `TotalBandwidthUsed`, `BandwidthUsedChart`), sem divisão por vídeo ou por dono.
- As estatísticas de visualização vêm do player do Bunny. Esta vitrine usa hls.js direto, então nem essas contariam.

**Consequência:** vale o caminho alternativo da spec ("o sistema registra as aberturas do player e estima bytes"), com uma melhoria: o hls.js informa o tamanho real de cada trecho baixado (`FRAG_LOADED`). O player soma esses bytes e envia ao servidor, que limita o valor a um teto por segundo assistido (proteção contra números inflados). No Safari, onde o HLS é nativo e não há acesso aos trechos, a estimativa é segundos assistidos × bitrate de referência.

---

## Como trabalhar nesta fase

Igual à Fase 2 (seção "Como trabalhar nesta fase (pela nuvem)" do plano anterior):

- Uma branch e um PR por bloco: `fase-3/bloco-N-<nome>`.
- Localmente só `npm run lint`, `npm run typecheck`, `npm test`. pgTAP, tipos do banco, build e Playwright rodam no CI.
- **Rotina de migração:** push → job `db` gera o artefato `database-types` (falha esperada no passo de diff) → `gh run download <run-id> --name database-types --dir <scratchpad>/types` → copiar para `src/lib/supabase/database.types.ts` → commit.
- Merge só com CI verde e autorização do usuário. O job `migrate` aplica migrações no Supabase dev.
- `gh` fica em `C:\Program Files\GitHub CLI\gh.exe` (no bash: `export PATH="$PATH:/c/Program Files/GitHub CLI"`).

**Lições da Fase 2 que valem aqui:**
- Variáveis novas na Vercel precisam estar marcadas para **Production**. Tipo **Secret** para chaves.
- `getByLabel` do Playwright casa por trecho: use `{ exact: true }` quando um rótulo é começo de outro.
- Botões que trocam entre `type="button"` e `type="submit"` na mesma posição precisam de `key` diferente.
- Tipos gerados exigem colunas preenchidas por trigger (ex.: `items.code`): converter com comentário.
- Nunca pôr crases de Markdown dentro de strings de `bash -c`/`node -e` entre aspas duplas.
- Links duplicados (menu escondido no celular): `locator.filter({ visible: true }).first()`.

---

## Global Constraints

- **Idioma:** textos visíveis em português do Brasil; identificadores em inglês.
- **Limites (tabela `plans`, sem número fixo no código):** duração máxima `max_video_seconds` (60), envio máximo `max_video_upload_mb` (500), `max_videos_per_vitrine` (gratuito 1, Pro 50), `max_videos_per_account` (gratuito 1, Pro sem limite), franquia `monthly_video_gb` (1024 GB = 1024 × 1024³ bytes).
- **Vídeo de item:** no máximo 1 por item (índice `media_one_video_per_item` já existe). Proporção `9:16` ou `16:9`: largura ≥ altura → `16:9`, senão `9:16`.
- **Banner em vídeo:** só Pro (`allow_branding`) e só horizontal.
- **Contagem de vídeos:** só `role = 'video'` com `status <> 'failed'`. Banner em vídeo não conta no limite de vídeos de item.
- **Biblioteca Bunny Stream (spec 6.2):** rede Volume; resoluções 240p, 360p, 480p e 720p; sem guardar o original; sem MP4 de fallback; referrers permitidos `*.ROOT_DOMAIN`; acesso direto aos arquivos bloqueado.
- **URLs do Bunny Stream:** API `https://video.bunnycdn.com/library/{libraryId}/videos[/{guid}]` com cabeçalho `AccessKey`; TUS `https://video.bunnycdn.com/tusupload` com cabeçalhos `AuthorizationSignature` = SHA-256 hex de `libraryId + apiKey + expires + videoId`, `AuthorizationExpire` (Unix em segundos), `VideoId`, `LibraryId`; playlist `{CDN}/{guid}/playlist.m3u8`; miniatura `{CDN}/{guid}/thumbnail.jpg`.
- **Webhook:** corpo `{ VideoLibraryId, VideoGuid, Status }`; cabeçalho `X-BunnyStream-Signature` = HMAC-SHA256 hex do corpo cru, chave = Read-Only API key da biblioteca. Status 3 e 4 → `ready`; 5 e 8 → `failed`; demais → `processing`. **Sempre consultar o vídeo na API antes de confiar no aviso.**
- **Mês da franquia:** mês civil no fuso `America/Sao_Paulo`.
- **Mensagens de recusa (exatas, usadas nos testes):**
  - `Não foi possível ler o vídeo. Tente outro arquivo.`
  - `O vídeo tem {N} s. O limite é {MAX} s.`
  - `O arquivo tem {N} MB. O limite é {MAX} MB.`
  - `O banner em vídeo precisa ser horizontal.`
  - `Seu plano permite até {N} {vídeo|vídeos} por vitrine. Assine o Pro para enviar mais.`
  - `Seu plano permite até {N} {vídeo|vídeos} na conta. Assine o Pro para enviar mais.`
  - `A franquia de vídeo deste mês acabou. Os vídeos voltam no próximo mês.`
  - Envio interrompido: `Conexão caiu, retomando…`; processamento falhou: botão `Tentar novamente`.
  - Assunto do e-mail de franquia: `A franquia de vídeo deste mês acabou`.
- **E-mail:** remetente `Agenn Vitrine <nao-responda@agenn.com.br>` (definido na Fase 1). Um aviso por dono por mês (só quando a franquia estoura), enviado depois da resposta com `after()` do Next.
- **Segurança:** toda tabela nova com RLS, `revoke all … from anon, authenticated` e grants explícitos; funções `security definer` com `set search_path = ''` e grant só para quem usa. Chaves do Bunny Stream e `CRON_SECRET` só em arquivos `server-only`.
- **Sentry:** membro novo de `@sentry/nextjs` ganha espelho em `src/lib/monitoring/sentry-noop.ts`.
- **Design:** sem etapas de refinamento visual; componentes da Fase 1/2.
- **Next.js 16:** ler `node_modules/next/dist/docs/` antes de rotas novas (em especial `01-app/03-api-reference/03-file-conventions/route.md` e o guia de Vercel Cron em `vercel.json`, se houver).

---

## Decisões desta fase

| Tema | Decisão | Motivo |
|---|---|---|
| Consumo por vídeo | Player mede bytes (hls.js `FRAG_LOADED`) ou estima (Safari); servidor limita por segundo assistido e soma em `video_usage_monthly` | A API do Bunny não informa banda por vídeo (seção acima). |
| Atualização da franquia | Na hora, pela função `add_video_usage`, que avisa quando a franquia estoura para revalidar as vitrines do dono | Tira a necessidade de um job de agregação; a tarefa diária só revalida vitrines na virada do mês. |
| Testes sem Bunny | Driver `fake` do Stream (envio por `PUT` para uma rota de desenvolvimento, estado em disco) e webhook assinado com um segredo do CI | Mesmo padrão do driver `fake` de imagens. |
| Vídeos de teste | Gerados no CI com ffmpeg em WebM (VP8): 3 s horizontal, 3 s vertical e 61 s pequeno | O Chromium do Playwright não toca H.264; WebM lê duração e dimensões. |
| Reprodução no e2e | Verifica que o `<video>` só aparece na tela do item e que a listagem não tem vídeo; não verifica a imagem tocando | Não há HLS real no CI. A reprodução é conferida na nuvem. |
| Poster do vídeo do item | Capa do item | Já existe e carrega antes; a miniatura do Bunny fica para o banner. |
| E-mail de franquia | Resend pela API HTTP, disparado com `after()` quando `add_video_usage` informa o estouro; driver `fake` grava em disco no CI; chave de idempotência por dono e mês | Pedido do usuário (não adiar). Não atrasa a vitrine e não duplica aviso. |
| Duplicar item | Não copia o vídeo | O Bunny Stream não copia vídeos pela API; recopiar exigiria reenviar o arquivo. O dono envia o vídeo na cópia. |

### Fica para outras fases (aprovado pelo usuário)

- **Apagar vídeos excedentes 90 dias depois de sair do Pro e aviso no dia 83** (spec 6.4): depende de `pro_ended_at`, que só o Stripe preenche → Fase 5.
- **Conferir assinaturas com o Stripe** (spec 6.4) → Fase 5.
- **Arquivos órfãos sem linha no banco** (ex.: pasta `56561127-…` no Bunny Storage): a limpeza diária trabalha a partir das linhas de `media`; apagar à mão.

---

## Mapa de arquivos

```
.github/workflows/ci.yml                          # ffmpeg + fixtures + variáveis de vídeo no e2e
scripts/make-video-fixtures.mjs                   # gera e2e/fixtures/*.webm no CI
vercel.json                                       # + crons
.env.example                                      # + variáveis de vídeo e cron
docs/setup/fase-3-infra.md                        # biblioteca do Bunny Stream, webhook, variáveis, cron
package.json                                      # + tus-js-client, hls.js

supabase/migrations/20260919000000_videos.sql
supabase/tests/database/08_videos.test.sql

src/lib/env-schema.ts                             # + NEXT_PUBLIC_VIDEO_CDN_BASE_URL
src/lib/env.ts
src/lib/server-env-schema.ts                      # + parseVideoStreamEnv, parseWebhookSecret, parseCronSecret (+ test)
src/lib/server-env.ts
src/lib/monitoring/sentry-noop.ts                 # (sem membros novos previstos)

src/lib/video/rules.ts                            # validação, proporção, status, bytes, mês (+ test)
src/lib/video/signatures.ts                       # TUS e webhook (+ test)
src/lib/video/urls.ts                             # playlist e miniatura (+ test)
src/lib/video/stream.ts                           # interface + escolha do driver (server-only)
src/lib/video/bunny-stream.ts
src/lib/video/fake-stream.ts
src/lib/vitrines/db-errors.ts                     # + plan_limit:videos_* (+ test)
src/lib/vitrines/schemas.ts                       # itemSchema + videoMediaId (+ test)
src/lib/media/remove-media.ts                     # apaga também vídeos no Stream

src/app/api/media/video/route.ts                  # cria vídeo + assinatura
src/app/api/media/[id]/route.ts                   # + GET status; DELETE com vídeo
src/app/api/media/image/route.ts                  # seleciona bunny_video_id ao substituir banner
src/app/api/webhooks/bunny/route.ts
src/app/api/dev-video/upload/[guid]/route.ts      # só driver fake
src/app/api/video-usage/route.ts                  # relatório de bytes da vitrine
src/app/api/cron/diaria/route.ts

src/lib/email/quota-email.ts                      # texto do aviso e datas em São Paulo (+ test)
src/lib/email/send-email.ts                       # Resend / fake / off (server-only)
src/features/videos/notify-quota.ts               # busca dono, vitrines e plano e envia

src/features/items/actions.ts                     # vincula vídeo pendente; seleções com bunny_video_id
src/features/items/queries.ts                     # + video no item
src/features/vitrines/actions.ts                  # excluir vitrine apaga vídeos
src/features/vitrines/queries.ts                  # + getVideoUsage
src/features/public/build-catalog.ts              # vídeo do item, banner em vídeo, visibilidade, franquia (+ test)
src/features/public/load-vitrine.ts

src/components/media/video-slot.tsx               # leitura, envio TUS/PUT, progresso, status, tentar de novo
src/app/app/(painel)/painel/page.tsx              # uso: vídeos e franquia do mês
src/app/app/(painel)/painel/vitrines/[id]/itens/item-form.tsx
src/app/app/(painel)/painel/vitrines/[id]/aparencia/page.tsx
src/app/app/(painel)/painel/vitrines/[id]/aparencia/appearance-form.tsx

src/app/v/[subdomain]/video-player.tsx            # hls.js sob demanda + medição
src/app/v/[subdomain]/banner-video.tsx
src/app/v/[subdomain]/item-sheet.tsx              # carrossel com vídeo primeiro
src/app/v/[subdomain]/catalog.tsx                 # banner em vídeo

e2e/helpers.ts                                    # + seedVideo, signBunnyWebhook, videoFixture
e2e/videos-panel.spec.ts
e2e/videos-public.spec.ts
e2e/cron.spec.ts
```

---

# Bloco 0 — Bunny Stream e preparo do CI

Branch: `fase-3/bloco-0-infra`.

### Task 1: Biblioteca do Bunny Stream e variáveis (usuário)

**Files:**
- Create: `docs/setup/fase-3-infra.md`
- Modify: `.env.example`

- [ ] **Step 1: Criar a biblioteca (usuário, no painel do Bunny)**

Passo a passo para o usuário:
1. **Stream → Add Video Library**. Nome: `agenn-vitrine-videos`. Regiões de replicação: só **São Paulo** (ou a mais próxima oferecida). **Rede: Volume**.
2. Na biblioteca, **Encoding**:
   - Resoluções habilitadas: **240p, 360p, 480p, 720p** (desmarcar 1080p, 1440p, 2160p).
   - **Keep original files: desligado**.
   - **Enable MP4 fallback: desligado**.
3. **Security**:
   - **Allowed referrers:** `*.agenn.com.br` (e `agenn.com.br`).
   - **Block direct URL file access: ligado**.
   - Token authentication: **desligado** (o referrer basta nesta fase).
4. **API** (ou "API & Webhooks"): anotar **Library ID**, **API Key** e **Read-Only API Key**. Em **Webhook URL**: `https://app.agenn.com.br/api/webhooks/bunny`.
5. Anotar o **CDN Hostname** da biblioteca (ex.: `vz-1a2b3c4d-5e6.b-cdn.net`).
6. **Account → Billing**: conferir o alerta de gasto (já criado na Fase 2) e incluir Stream.

- [ ] **Step 2: Variáveis na Vercel (usuário, `agenn-vitrine-v1`, Production)**

| Key | Value | Type |
|---|---|---|
| `VIDEO_STREAM_DRIVER` | `bunny` | Config |
| `BUNNY_STREAM_LIBRARY_ID` | Library ID | Config |
| `BUNNY_STREAM_API_KEY` | API Key | **Secret** |
| `BUNNY_STREAM_WEBHOOK_SECRET` | Read-Only API Key | **Secret** |
| `NEXT_PUBLIC_VIDEO_CDN_BASE_URL` | `https://<CDN Hostname>` (sem barra final) | Config |
| `CRON_SECRET` | valor aleatório de 64+ caracteres (`node -e "console.log(crypto.randomUUID()+crypto.randomUUID())"`) | **Secret** |

A Vercel envia `Authorization: Bearer <CRON_SECRET>` nas chamadas de cron quando essa variável existe.

- [ ] **Step 3: `.env.example`**

Acrescentar ao fim:

```bash
# Vídeos: bunny (produção) ou fake (CI/local)
VIDEO_STREAM_DRIVER=fake
BUNNY_STREAM_LIBRARY_ID=
BUNNY_STREAM_API_KEY=
# Read-Only API Key da biblioteca: assina os webhooks
BUNNY_STREAM_WEBHOOK_SECRET=
# CDN da biblioteca de vídeo. Fake: /api/dev-video
NEXT_PUBLIC_VIDEO_CDN_BASE_URL=/api/dev-video
# Segredo das chamadas do Vercel Cron (mínimo 16 caracteres)
CRON_SECRET=
```

- [ ] **Step 4: Guia**

`docs/setup/fase-3-infra.md` com as seções: **1. Biblioteca do Bunny Stream** (Step 1), **2. Variáveis na Vercel** (Step 2), **3. Vercel Cron** (rota `/api/cron/diaria`, horário 07:00 UTC = 04:00 em São Paulo, autenticação por `CRON_SECRET`; no plano Hobby da Vercel o cron roda 1×/dia e o minuto exato pode variar), **4. Consumo de vídeo** (resumo da seção "Validação pedida pela spec"), **5. Riscos aceitos** (bytes relatados pelo navegador podem ser manipulados dentro do teto por segundo; regra dos 90 dias e conferência do Stripe ficam para a Fase 5).

- [ ] **Step 5: Commit**

```bash
git add docs/setup/fase-3-infra.md .env.example
git commit -m "docs(infra): biblioteca do Bunny Stream, webhook, variáveis de vídeo e cron"
```

---

### Task 2: Vídeos de teste e variáveis no CI

**Files:**
- Create: `scripts/make-video-fixtures.mjs`
- Modify: `.github/workflows/ci.yml`, `.gitignore`

**Interfaces:**
- Produces (no CI, antes do Playwright): `e2e/fixtures/horizontal-3s.webm` (640×360, 3 s), `e2e/fixtures/vertical-3s.webm` (360×640, 3 s), `e2e/fixtures/longo-61s.webm` (160×90, 61 s).

- [ ] **Step 1: Script**

`scripts/make-video-fixtures.mjs`:

```js
#!/usr/bin/env node
// Só para o CI: gera vídeos WebM (VP8) pequenos para os testes de envio.
// O Chromium do Playwright não decodifica H.264, mas lê duração e dimensões de WebM.
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'

mkdirSync('e2e/fixtures', { recursive: true })

const fixtures = [
  { name: 'horizontal-3s', size: '640x360', seconds: 3 },
  { name: 'vertical-3s', size: '360x640', seconds: 3 },
  { name: 'longo-61s', size: '160x90', seconds: 61 },
]

for (const { name, size, seconds } of fixtures) {
  execFileSync(
    'ffmpeg',
    [
      '-y', '-loglevel', 'error',
      '-f', 'lavfi', '-i', `testsrc=duration=${seconds}:size=${size}:rate=15`,
      '-c:v', 'libvpx', '-b:v', '100k',
      `e2e/fixtures/${name}.webm`,
    ],
    { stdio: 'inherit' },
  )
  console.log(`e2e/fixtures/${name}.webm`)
}
```

- [ ] **Step 2: Workflow**

No job `e2e` de `.github/workflows/ci.yml`:

1. Em `env:`, acrescentar:

```yaml
      VIDEO_STREAM_DRIVER: fake
      BUNNY_STREAM_WEBHOOK_SECRET: ci-webhook-secret
      NEXT_PUBLIC_VIDEO_CDN_BASE_URL: /api/dev-video
      CRON_SECRET: ci-cron-secret-somente-para-testes
```

2. Antes do passo `npx playwright install --with-deps chromium`, acrescentar:

```yaml
      - name: Vídeos de teste
        run: |
          sudo apt-get update -qq
          sudo apt-get install -y -qq ffmpeg
          node scripts/make-video-fixtures.mjs
```

Em `.gitignore`, acrescentar `e2e/fixtures/*.webm`.

- [ ] **Step 3: Commit, PR e merge do bloco**

```bash
npm run lint && npm run typecheck && npm test
git add scripts/make-video-fixtures.mjs .github/workflows/ci.yml .gitignore
git commit -m "ci: vídeos de teste gerados com ffmpeg e variáveis de vídeo no e2e"
git push -u origin HEAD
gh pr create --fill --base master
gh pr checks --watch
```

Expected: CI verde; no log do job `e2e`, o passo "Vídeos de teste" lista os três arquivos.

**Fim do Bloco 0:** biblioteca criada e variáveis na Vercel (Production) → autorização → merge.

---

# Bloco 1 — Banco dos vídeos

Branch: `fase-3/bloco-1-banco`.

### Task 3: Travas de vídeo, franquia mensal e limpezas

**Files:**
- Create: `supabase/migrations/20260919000000_videos.sql`, `supabase/tests/database/08_videos.test.sql`

**Interfaces:**
- Produces (SQL):
  - índice único `media_bunny_video_id_key` em `media (bunny_video_id)` quando não nulo
  - trigger `media_enforce_video_limits` → erros `plan_limit:videos_vitrine` e `plan_limit:videos_account` (`hint` = limite)
  - tabela `video_usage_monthly (user_id, month, bytes_delivered, over_quota, created_at, updated_at)`, PK `(user_id, month)`; dono lê
  - `public.current_video_month() returns date` (mês civil em São Paulo)
  - `public.add_video_usage(p_media_id uuid, p_bytes bigint) returns table (usage_owner_id uuid, crossed_quota boolean)` — `service_role`
  - `public.is_over_video_quota(p_user_id uuid) returns boolean` — `service_role`
  - `public.my_video_usage() returns table (videos_count int, bytes_delivered bigint, over_quota boolean)` — `authenticated`
  - `public.media_cleanup_candidates(p_older_than interval default '24 hours') returns table (id uuid, storage_paths jsonb, bunny_video_id text)` — `service_role`
  - `public.cleanup_expired_rows() returns table (orders_deleted int, rate_limits_deleted int)` — `service_role`
  - `public.subdomains_over_quota_last_month() returns setof text` — `service_role`

- [ ] **Step 1: Migração**

`supabase/migrations/20260919000000_videos.sql`:

```sql
-- Vídeos: travas do plano, franquia mensal e limpezas diárias (spec 3, 4.1, 4.8 e 6.4)

create unique index media_bunny_video_id_key on public.media (bunny_video_id) where bunny_video_id is not null;

-- Trava do plano: vídeos de item por vitrine e por conta (banner em vídeo não conta).
create function public.enforce_video_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_per_vitrine int;
  v_per_account int;
begin
  if new.kind <> 'video' or new.role <> 'video' then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('videos:' || new.owner_id::text, 0));
  select p.max_videos_per_vitrine, p.max_videos_per_account
  into v_per_vitrine, v_per_account
  from public.plans p
  where p.id = public.effective_plan_id(new.owner_id);

  if (
    select count(*) from public.media m
    where m.vitrine_id = new.vitrine_id and m.role = 'video' and m.status <> 'failed'
  ) >= v_per_vitrine then
    raise exception 'plan_limit:videos_vitrine' using errcode = 'P0001', hint = v_per_vitrine::text;
  end if;

  if v_per_account is not null and (
    select count(*) from public.media m
    where m.owner_id = new.owner_id and m.role = 'video' and m.status <> 'failed'
  ) >= v_per_account then
    raise exception 'plan_limit:videos_account' using errcode = 'P0001', hint = v_per_account::text;
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_video_limits() from public, anon, authenticated;

create trigger media_enforce_video_limits
  before insert on public.media
  for each row execute function public.enforce_video_limits();

-- Franquia mensal de entrega de vídeo
create table public.video_usage_monthly (
  user_id uuid not null references auth.users (id) on delete cascade,
  month date not null,
  bytes_delivered bigint not null default 0 check (bytes_delivered >= 0),
  over_quota boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, month)
);

create trigger video_usage_monthly_set_updated_at
  before update on public.video_usage_monthly
  for each row execute function public.set_updated_at();

create function public.current_video_month()
returns date
language sql
stable
set search_path = ''
as $$
  select date_trunc('month', now() at time zone 'America/Sao_Paulo')::date;
$$;

-- Soma bytes entregues ao mês do dono do vídeo e diz se a franquia acabou de estourar.
create function public.add_video_usage(p_media_id uuid, p_bytes bigint)
returns table (usage_owner_id uuid, crossed_quota boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_limit bigint;
  v_before boolean;
  v_after boolean;
  v_month date := public.current_video_month();
  v_bytes bigint := greatest(coalesce(p_bytes, 0), 0);
begin
  select m.owner_id into v_owner
  from public.media m
  where m.id = p_media_id and m.kind = 'video' and m.status = 'ready';
  if v_owner is null then
    return;
  end if;

  select p.monthly_video_gb::bigint * 1073741824 into v_limit
  from public.plans p
  where p.id = public.effective_plan_id(v_owner);

  select u.over_quota into v_before
  from public.video_usage_monthly u
  where u.user_id = v_owner and u.month = v_month;

  insert into public.video_usage_monthly as u (user_id, month, bytes_delivered, over_quota)
  values (v_owner, v_month, v_bytes, v_bytes > v_limit)
  on conflict (user_id, month) do update
    set bytes_delivered = u.bytes_delivered + v_bytes,
        over_quota = u.bytes_delivered + v_bytes > v_limit
  returning u.over_quota into v_after;

  usage_owner_id := v_owner;
  crossed_quota := not coalesce(v_before, false) and v_after;
  return next;
end;
$$;

revoke execute on function public.add_video_usage(uuid, bigint) from public, anon, authenticated;
grant execute on function public.add_video_usage(uuid, bigint) to service_role;

create function public.is_over_video_quota(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select u.over_quota from public.video_usage_monthly u
     where u.user_id = p_user_id and u.month = public.current_video_month()),
    false
  );
$$;

revoke execute on function public.is_over_video_quota(uuid) from public, anon, authenticated;
grant execute on function public.is_over_video_quota(uuid) to service_role;

create function public.my_video_usage()
returns table (videos_count int, bytes_delivered bigint, over_quota boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*)::int from public.media m
     where m.owner_id = auth.uid() and m.role = 'video' and m.status <> 'failed'),
    coalesce((select u.bytes_delivered from public.video_usage_monthly u
              where u.user_id = auth.uid() and u.month = public.current_video_month()), 0),
    coalesce((select u.over_quota from public.video_usage_monthly u
              where u.user_id = auth.uid() and u.month = public.current_video_month()), false);
$$;

revoke execute on function public.my_video_usage() from public, anon;
grant execute on function public.my_video_usage() to authenticated;

-- Limpeza diária: falhas e processamentos parados há mais de 24 h, e mídias de item
-- nunca vinculadas (envios de item que não foi salvo).
create function public.media_cleanup_candidates(p_older_than interval default interval '24 hours')
returns table (id uuid, storage_paths jsonb, bunny_video_id text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.storage_paths, m.bunny_video_id
  from public.media m
  where (m.status = 'failed' and m.updated_at < now() - p_older_than)
     or (m.status = 'processing' and m.created_at < now() - p_older_than)
     or (m.item_id is null and m.role in ('cover', 'gallery', 'video') and m.created_at < now() - p_older_than);
$$;

revoke execute on function public.media_cleanup_candidates(interval) from public, anon, authenticated;
grant execute on function public.media_cleanup_candidates(interval) to service_role;

create function public.cleanup_expired_rows()
returns table (orders_deleted int, rate_limits_deleted int)
language plpgsql
security definer
set search_path = ''
as $$
begin
  with deleted as (
    delete from public.order_snapshots o where o.expires_at <= now() returning 1
  )
  select count(*)::int into orders_deleted from deleted;

  with deleted as (
    delete from public.rate_limits r where r.window_start < now() - interval '2 days' returning 1
  )
  select count(*)::int into rate_limits_deleted from deleted;

  return next;
end;
$$;

revoke execute on function public.cleanup_expired_rows() from public, anon, authenticated;
grant execute on function public.cleanup_expired_rows() to service_role;

-- Virada do mês: vitrines de quem estourou no mês anterior precisam voltar a mostrar vídeos.
create function public.subdomains_over_quota_last_month()
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select v.subdomain
  from public.vitrines v
  join public.video_usage_monthly u on u.user_id = v.owner_id
  where u.over_quota
    and u.month = (public.current_video_month() - interval '1 month')::date;
$$;

revoke execute on function public.subdomains_over_quota_last_month() from public, anon, authenticated;
grant execute on function public.subdomains_over_quota_last_month() to service_role;

alter table public.video_usage_monthly enable row level security;
revoke all on public.video_usage_monthly from anon, authenticated;
grant select on public.video_usage_monthly to authenticated;
create policy "dono lê o próprio consumo de vídeo" on public.video_usage_monthly
  for select to authenticated using ((select auth.uid()) = user_id);
```

- [ ] **Step 2: pgTAP**

`supabase/tests/database/08_videos.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000003c1', 'livre@videos.com'),
  ('00000000-0000-0000-0000-0000000003c2', 'pro@videos.com');
insert into public.subscriptions (user_id, plan_id, status) values
  ('00000000-0000-0000-0000-0000000003c2', 'pro', 'active');

insert into public.vitrines (id, owner_id, type, subdomain, name, default_button_text) values
  ('00000000-0000-0000-0000-00000000f301', '00000000-0000-0000-0000-0000000003c1', 'produtos', 'videos-livre', 'Livre', 'Solicitar orçamento'),
  ('00000000-0000-0000-0000-00000000f302', '00000000-0000-0000-0000-0000000003c2', 'produtos', 'videos-pro-1', 'Pro 1', 'Solicitar orçamento'),
  ('00000000-0000-0000-0000-00000000f303', '00000000-0000-0000-0000-0000000003c2', 'produtos', 'videos-pro-2', 'Pro 2', 'Solicitar orçamento');
insert into public.categories (id, owner_id, vitrine_id, name) values
  ('00000000-0000-0000-0000-00000000c301', '00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-00000000f301', 'Geral'),
  ('00000000-0000-0000-0000-00000000c302', '00000000-0000-0000-0000-0000000003c2', '00000000-0000-0000-0000-00000000f302', 'Geral');
insert into public.items (id, owner_id, vitrine_id, category_id, name, price_cents) values
  ('00000000-0000-0000-0000-00000000e301', '00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-00000000f301', '00000000-0000-0000-0000-00000000c301', 'A', 100),
  ('00000000-0000-0000-0000-00000000e302', '00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-00000000f301', '00000000-0000-0000-0000-00000000c301', 'B', 100),
  ('00000000-0000-0000-0000-00000000e303', '00000000-0000-0000-0000-0000000003c2', '00000000-0000-0000-0000-00000000f302', '00000000-0000-0000-0000-00000000c302', 'C', 100),
  ('00000000-0000-0000-0000-00000000e304', '00000000-0000-0000-0000-0000000003c2', '00000000-0000-0000-0000-00000000f302', '00000000-0000-0000-0000-00000000c302', 'D', 100);

-- Gratuito: 1 vídeo
insert into public.media (id, owner_id, vitrine_id, item_id, role, kind, status, bunny_video_id) values
  ('00000000-0000-0000-0000-00000000d301', '00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-00000000f301', '00000000-0000-0000-0000-00000000e301', 'video', 'video', 'ready', 'guid-livre-1');
select throws_ok(
  $$ insert into public.media (owner_id, vitrine_id, item_id, role, kind, status, bunny_video_id) values ('00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-00000000f301', '00000000-0000-0000-0000-00000000e302', 'video', 'video', 'processing', 'guid-livre-2') $$,
  'P0001', 'plan_limit:videos_vitrine', 'gratuito não passa de 1 vídeo'
);

update public.media set status = 'failed' where id = '00000000-0000-0000-0000-00000000d301';
select lives_ok(
  $$ insert into public.media (owner_id, vitrine_id, item_id, role, kind, status, bunny_video_id) values ('00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-00000000f301', '00000000-0000-0000-0000-00000000e302', 'video', 'video', 'processing', 'guid-livre-3') $$,
  'vídeo com falha não conta no limite'
);
select throws_ok(
  $$ insert into public.media (owner_id, vitrine_id, item_id, role, kind, status, bunny_video_id) values ('00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-00000000f301', null, 'banner', 'video', 'processing', 'guid-livre-3') $$,
  '23505', null, 'bunny_video_id é único'
);
select lives_ok(
  $$ insert into public.media (owner_id, vitrine_id, item_id, role, kind, status, bunny_video_id) values ('00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-00000000f301', null, 'banner', 'video', 'processing', 'guid-livre-banner') $$,
  'banner em vídeo não conta no limite de vídeos de item'
);

-- Pro: vários vídeos e em mais de uma vitrine
insert into public.media (owner_id, vitrine_id, item_id, role, kind, status, bunny_video_id) values
  ('00000000-0000-0000-0000-0000000003c2', '00000000-0000-0000-0000-00000000f302', '00000000-0000-0000-0000-00000000e303', 'video', 'video', 'ready', 'guid-pro-1');
select lives_ok(
  $$ insert into public.media (owner_id, vitrine_id, item_id, role, kind, status, bunny_video_id) values ('00000000-0000-0000-0000-0000000003c2', '00000000-0000-0000-0000-00000000f302', '00000000-0000-0000-0000-00000000e304', 'video', 'video', 'ready', 'guid-pro-2') $$,
  'Pro envia mais de um vídeo'
);

-- Franquia
select is(public.current_video_month(), date_trunc('month', now() at time zone 'America/Sao_Paulo')::date, 'mês em São Paulo');

set local role service_role;
select is(
  (select crossed_quota from public.add_video_usage('00000000-0000-0000-0000-00000000d301', 1000)),
  null,
  'vídeo que não está pronto não soma'
);
select is(
  (select crossed_quota from public.add_video_usage((select id from public.media where bunny_video_id = 'guid-pro-1'), 1000)),
  false,
  'primeira soma não estoura'
);
select is(
  (select crossed_quota from public.add_video_usage((select id from public.media where bunny_video_id = 'guid-pro-1'), 1099511627776)),
  true,
  'passar de 1024 GB estoura e avisa'
);
select is(
  (select crossed_quota from public.add_video_usage((select id from public.media where bunny_video_id = 'guid-pro-1'), 10)),
  false,
  'depois de estourado não avisa de novo'
);
select is(public.is_over_video_quota('00000000-0000-0000-0000-0000000003c2'), true, 'is_over_video_quota');
select is(
  (select bytes_delivered from public.video_usage_monthly where user_id = '00000000-0000-0000-0000-0000000003c2'),
  1099511628786::bigint,
  'bytes somados'
);

-- Limpezas
reset role;
insert into public.media (owner_id, vitrine_id, item_id, role, kind, status, storage_paths, created_at, updated_at) values
  ('00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-00000000f301', null, 'cover', 'image', 'ready', '{"480":"velha"}', now() - interval '2 days', now() - interval '2 days'),
  ('00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-00000000f301', null, 'cover', 'image', 'ready', '{"480":"nova"}', now(), now());
-- O trigger set_updated_at sobrescreveria a data; desligado só nesta atualização.
alter table public.media disable trigger media_set_updated_at;
update public.media set updated_at = now() - interval '2 days' where bunny_video_id = 'guid-livre-1';
alter table public.media enable trigger media_set_updated_at;
insert into public.order_snapshots (owner_id, vitrine_id, code, payload, expires_at) values
  ('00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-00000000f301', 'AB23', '{}', now() - interval '1 day');
insert into public.rate_limits (key, window_start, count) values ('antigo', now() - interval '3 days', 1);
insert into public.video_usage_monthly (user_id, month, bytes_delivered, over_quota) values
  ('00000000-0000-0000-0000-0000000003c1', (public.current_video_month() - interval '1 month')::date, 5, true);

set local role service_role;
select ok(
  exists (select 1 from public.media_cleanup_candidates() c where c.storage_paths ->> '480' = 'velha'),
  'capa nunca vinculada há mais de 24 h é candidata'
);
select ok(
  not exists (select 1 from public.media_cleanup_candidates() c where c.storage_paths ->> '480' = 'nova'),
  'envio recente não é candidato'
);
select ok(
  exists (select 1 from public.media_cleanup_candidates() c where c.bunny_video_id = 'guid-livre-1'),
  'vídeo com falha antiga é candidato'
);
select results_eq(
  $$ select orders_deleted, rate_limits_deleted from public.cleanup_expired_rows() $$,
  $$ values (1, 1) $$,
  'apaga pedido expirado e limite antigo'
);
select ok(
  'videos-livre' in (select public.subdomains_over_quota_last_month()),
  'lista vitrines de quem estourou no mês anterior'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000003c2","role":"authenticated"}', true);
select is((select videos_count from public.my_video_usage()), 2, 'my_video_usage conta os vídeos do dono');

select * from finish();
rollback;
```

- [ ] **Step 3: Rotina de migração**

```bash
git add supabase/migrations/20260919000000_videos.sql supabase/tests/database/08_videos.test.sql
git commit -m "feat(db): travas de vídeo, franquia mensal e limpezas diárias"
git push -u origin HEAD
gh pr create --fill --base master
```

Esperar o job `db`: `08_videos` ok e falha só no diff dos tipos. Baixar `database-types`, copiar, commitar `chore(db): tipos gerados`, push, CI verde.

**Fim do Bloco 1:** autorização → merge → `migrate` aplica `20260919000000_videos` no Supabase dev.

---

# Bloco 2 — Regras puras

Branch: `fase-3/bloco-2-regras`. Só Vitest.

### Task 4: Regras de vídeo, assinaturas e URLs

**Files:**
- Create: `src/lib/video/rules.ts`, `src/lib/video/rules.test.ts`, `src/lib/video/signatures.ts`, `src/lib/video/signatures.test.ts`, `src/lib/video/urls.ts`, `src/lib/video/urls.test.ts`

**Interfaces:**
- Produces:
  - `type VideoAspect = '9:16' | '16:9'`, `type MediaStatus = 'processing' | 'ready' | 'failed'`
  - `aspectFor(width: number, height: number): VideoAspect`
  - `validateVideoFile(meta: { durationSeconds: number; sizeBytes: number; width: number; height: number }, limits: { maxSeconds: number; maxUploadMb: number }, role: 'video' | 'banner'): { ok: true; aspect: VideoAspect; durationSeconds: number } | { ok: false; message: string }`
  - `bunnyStatusToMedia(status: number): MediaStatus`
  - `MAX_VIDEO_BITRATE_BPS`, `NATIVE_HLS_ESTIMATED_BPS`, `MAX_REPORT_SECONDS`
  - `clampReportedBytes(bytes: number, seconds: number): number`
  - `estimateBytesFromSeconds(seconds: number): number`
  - `formatGigabytes(bytes: number): string`
  - `tusSignature(input: { libraryId: string; apiKey: string; expires: number; videoId: string }): string` (Node; usado só no servidor)
  - `signWebhookBody(rawBody: string, secret: string): string`, `verifyWebhookSignature(rawBody: string, signature: string | null, secret: string): boolean` (Node; usado só no servidor)
  - `videoPlaylistUrl(baseUrl: string, guid: string): string`, `videoThumbnailUrl(baseUrl: string, guid: string): string`

- [ ] **Step 1: Testes (falhando)**

`src/lib/video/rules.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  aspectFor,
  bunnyStatusToMedia,
  clampReportedBytes,
  estimateBytesFromSeconds,
  formatGigabytes,
  validateVideoFile,
} from './rules'

const limits = { maxSeconds: 60, maxUploadMb: 500 }
const ok = { durationSeconds: 12.4, sizeBytes: 10 * 1024 * 1024, width: 1080, height: 1920 }

describe('aspectFor', () => {
  it('horizontal ou quadrado = 16:9; vertical = 9:16', () => {
    expect(aspectFor(1920, 1080)).toBe('16:9')
    expect(aspectFor(1000, 1000)).toBe('16:9')
    expect(aspectFor(1080, 1920)).toBe('9:16')
  })
})

describe('validateVideoFile', () => {
  it('aceita e arredonda a duração', () => {
    expect(validateVideoFile(ok, limits, 'video')).toEqual({ ok: true, aspect: '9:16', durationSeconds: 12 })
  })

  it('recusa com o motivo em português (spec 10)', () => {
    expect(validateVideoFile({ ...ok, durationSeconds: Number.NaN }, limits, 'video')).toEqual({
      ok: false,
      message: 'Não foi possível ler o vídeo. Tente outro arquivo.',
    })
    expect(validateVideoFile({ ...ok, width: 0 }, limits, 'video').ok).toBe(false)
    expect(validateVideoFile({ ...ok, durationSeconds: 61 }, limits, 'video')).toEqual({
      ok: false,
      message: 'O vídeo tem 61 s. O limite é 60 s.',
    })
    expect(validateVideoFile({ ...ok, sizeBytes: 501 * 1024 * 1024 }, limits, 'video')).toEqual({
      ok: false,
      message: 'O arquivo tem 501 MB. O limite é 500 MB.',
    })
    expect(validateVideoFile(ok, limits, 'banner')).toEqual({
      ok: false,
      message: 'O banner em vídeo precisa ser horizontal.',
    })
  })

  it('tolera meio segundo acima do limite (arredondamento do arquivo)', () => {
    expect(validateVideoFile({ ...ok, durationSeconds: 60.4 }, limits, 'video').ok).toBe(true)
  })
})

describe('bunnyStatusToMedia', () => {
  it('mapeia os códigos do webhook', () => {
    expect([3, 4].map(bunnyStatusToMedia)).toEqual(['ready', 'ready'])
    expect([5, 8].map(bunnyStatusToMedia)).toEqual(['failed', 'failed'])
    expect([0, 1, 2, 6, 7, 9, 10].map(bunnyStatusToMedia)).toEqual(Array(7).fill('processing'))
  })
})

describe('bytes entregues', () => {
  it('limita os bytes relatados a 1,5 × 4 Mbps por segundo, com no máximo 120 s por relatório', () => {
    expect(clampReportedBytes(1_000_000, 10)).toBe(1_000_000)
    expect(clampReportedBytes(10_000_000, 10)).toBe(7_500_000)
    expect(clampReportedBytes(999_999_999, 1000)).toBe(90_000_000)
    expect(clampReportedBytes(-5, 10)).toBe(0)
    expect(clampReportedBytes(100, 0)).toBe(0)
    expect(clampReportedBytes(Number.NaN, 10)).toBe(0)
  })

  it('estima bytes no HLS nativo por 2,8 Mbps', () => {
    expect(estimateBytesFromSeconds(8)).toBe(2_800_000)
    expect(estimateBytesFromSeconds(-1)).toBe(0)
  })

  it('formata gigabytes', () => {
    expect(formatGigabytes(0)).toBe('0,0 GB')
    expect(formatGigabytes(1024 ** 3 * 1.25)).toBe('1,3 GB')
  })
})
```

`src/lib/video/signatures.test.ts`:

```ts
import { createHash, createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { signWebhookBody, tusSignature, verifyWebhookSignature } from './signatures'

describe('tusSignature', () => {
  it('SHA-256 hex de libraryId + apiKey + expires + videoId, nessa ordem', () => {
    const expected = createHash('sha256').update('123chave1700000000guid-1').digest('hex')
    expect(tusSignature({ libraryId: '123', apiKey: 'chave', expires: 1700000000, videoId: 'guid-1' })).toBe(expected)
  })
})

describe('webhook', () => {
  const body = '{"VideoLibraryId":123,"VideoGuid":"guid-1","Status":3}'

  it('assina com HMAC-SHA256 hex do corpo cru', () => {
    expect(signWebhookBody(body, 'segredo')).toBe(createHmac('sha256', 'segredo').update(body).digest('hex'))
  })

  it('verifica a assinatura', () => {
    const signature = signWebhookBody(body, 'segredo')
    expect(verifyWebhookSignature(body, signature, 'segredo')).toBe(true)
    expect(verifyWebhookSignature(body, signature, 'outro')).toBe(false)
    expect(verifyWebhookSignature(`${body} `, signature, 'segredo')).toBe(false)
    expect(verifyWebhookSignature(body, null, 'segredo')).toBe(false)
    expect(verifyWebhookSignature(body, 'zz', 'segredo')).toBe(false)
  })
})
```

`src/lib/video/urls.test.ts`:

```ts
import { expect, it } from 'vitest'
import { videoPlaylistUrl, videoThumbnailUrl } from './urls'

it('URLs do Bunny Stream', () => {
  expect(videoPlaylistUrl('https://vz-1.b-cdn.net/', 'g1')).toBe('https://vz-1.b-cdn.net/g1/playlist.m3u8')
  expect(videoThumbnailUrl('/api/dev-video', 'g1')).toBe('/api/dev-video/g1/thumbnail.jpg')
})
```

Run: `npm test -- src/lib/video` → FAIL.

- [ ] **Step 2: Implementação**

`src/lib/video/rules.ts`:

```ts
export type VideoAspect = '9:16' | '16:9'
export type MediaStatus = 'processing' | 'ready' | 'failed'

export function aspectFor(width: number, height: number): VideoAspect {
  return width >= height ? '16:9' : '9:16'
}

export function validateVideoFile(
  meta: { durationSeconds: number; sizeBytes: number; width: number; height: number },
  limits: { maxSeconds: number; maxUploadMb: number },
  role: 'video' | 'banner',
): { ok: true; aspect: VideoAspect; durationSeconds: number } | { ok: false; message: string } {
  const readable =
    Number.isFinite(meta.durationSeconds) && meta.durationSeconds > 0 && meta.width > 0 && meta.height > 0
  if (!readable) return { ok: false, message: 'Não foi possível ler o vídeo. Tente outro arquivo.' }
  if (meta.durationSeconds > limits.maxSeconds + 0.5) {
    return { ok: false, message: `O vídeo tem ${Math.round(meta.durationSeconds)} s. O limite é ${limits.maxSeconds} s.` }
  }
  if (meta.sizeBytes > limits.maxUploadMb * 1024 * 1024) {
    return {
      ok: false,
      message: `O arquivo tem ${Math.ceil(meta.sizeBytes / (1024 * 1024))} MB. O limite é ${limits.maxUploadMb} MB.`,
    }
  }
  if (role === 'banner' && meta.height > meta.width) {
    return { ok: false, message: 'O banner em vídeo precisa ser horizontal.' }
  }
  return { ok: true, aspect: aspectFor(meta.width, meta.height), durationSeconds: Math.round(meta.durationSeconds) }
}

// Códigos do webhook do Bunny Stream: 3 = pronto, 4 = já tocável em uma resolução,
// 5 = falha na codificação, 8 = falha no envio pré-assinado.
export function bunnyStatusToMedia(status: number): MediaStatus {
  if (status === 3 || status === 4) return 'ready'
  if (status === 5 || status === 8) return 'failed'
  return 'processing'
}

// Teto por segundo: 720p do Bunny fica abaixo de 4 Mbps; a margem cobre o buffer à frente.
export const MAX_VIDEO_BITRATE_BPS = 4_000_000
export const NATIVE_HLS_ESTIMATED_BPS = 2_800_000
export const MAX_REPORT_SECONDS = 120

export function clampReportedBytes(bytes: number, seconds: number): number {
  if (!Number.isFinite(bytes) || !Number.isFinite(seconds) || bytes <= 0 || seconds <= 0) return 0
  const ceiling = Math.ceil((Math.min(seconds, MAX_REPORT_SECONDS) * MAX_VIDEO_BITRATE_BPS * 1.5) / 8)
  return Math.min(Math.round(bytes), ceiling)
}

export function estimateBytesFromSeconds(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0
  return Math.round((seconds * NATIVE_HLS_ESTIMATED_BPS) / 8)
}

export function formatGigabytes(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(1).replace('.', ',')} GB`
}
```

`src/lib/video/signatures.ts`:

```ts
// Sem server-only: só calcula hashes (as chaves vêm de quem chama) e roda no Vitest.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export function tusSignature(input: { libraryId: string; apiKey: string; expires: number; videoId: string }): string {
  return createHash('sha256').update(`${input.libraryId}${input.apiKey}${input.expires}${input.videoId}`).digest('hex')
}

export function signWebhookBody(rawBody: string, secret: string): string {
  return createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
}

export function verifyWebhookSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature || !/^[0-9a-f]{64}$/.test(signature)) return false
  return timingSafeEqual(Buffer.from(signWebhookBody(rawBody, secret), 'hex'), Buffer.from(signature, 'hex'))
}
```

`src/lib/video/urls.ts`:

```ts
const trimBase = (baseUrl: string) => baseUrl.replace(/\/+$/, '')

export function videoPlaylistUrl(baseUrl: string, guid: string): string {
  return `${trimBase(baseUrl)}/${guid}/playlist.m3u8`
}

export function videoThumbnailUrl(baseUrl: string, guid: string): string {
  return `${trimBase(baseUrl)}/${guid}/thumbnail.jpg`
}
```

Run: `npm test -- src/lib/video` → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/video
git commit -m "feat(video): validação, status do Bunny, bytes entregues, assinaturas e URLs"
```

---

### Task 5: Variáveis, mensagens de limite e formulário do item

**Files:**
- Modify: `src/lib/server-env-schema.ts` (+ test), `src/lib/server-env.ts`, `src/lib/env-schema.ts` (+ test), `src/lib/env.ts`, `src/lib/vitrines/db-errors.ts` (+ test), `src/lib/vitrines/schemas.ts` (+ test)

**Interfaces:**
- Produces:
  - `type VideoStreamEnv = { driver: 'fake' } | { driver: 'bunny'; libraryId: string; apiKey: string }`
  - `parseVideoStreamEnv(source)`, `parseWebhookSecret(source): string`, `parseCronSecret(source): string`
  - `getVideoStreamEnv()`, `getWebhookSecret()`, `getCronSecret()` (server-only)
  - `env.NEXT_PUBLIC_VIDEO_CDN_BASE_URL: string`
  - `mapDbError` reconhece `plan_limit:videos_vitrine` e `plan_limit:videos_account`
  - `itemSchema` aceita `videoMediaId` (`''` → `null`) e o devolve como `videoMediaId: string | null`

- [ ] **Step 1: Testes (falhando)**

Acrescente em `src/lib/server-env-schema.test.ts`:

```ts
import { parseCronSecret, parseVideoStreamEnv, parseWebhookSecret } from './server-env-schema'

describe('parseVideoStreamEnv', () => {
  it('bunny exige biblioteca e chave', () => {
    expect(() => parseVideoStreamEnv({})).toThrow(/BUNNY_STREAM_LIBRARY_ID/)
    expect(parseVideoStreamEnv({ BUNNY_STREAM_LIBRARY_ID: '123', BUNNY_STREAM_API_KEY: 'k' })).toEqual({
      driver: 'bunny',
      libraryId: '123',
      apiKey: 'k',
    })
  })

  it('fake só fora de produção', () => {
    expect(parseVideoStreamEnv({ VIDEO_STREAM_DRIVER: 'fake' })).toEqual({ driver: 'fake' })
    expect(() => parseVideoStreamEnv({ VIDEO_STREAM_DRIVER: 'fake', VERCEL_ENV: 'production' })).toThrow(/produção/)
  })
})

it('segredos do webhook e do cron', () => {
  expect(() => parseWebhookSecret({})).toThrow()
  expect(parseWebhookSecret({ BUNNY_STREAM_WEBHOOK_SECRET: 'ci-webhook-secret' })).toBe('ci-webhook-secret')
  expect(() => parseCronSecret({ CRON_SECRET: 'curto' })).toThrow()
  expect(parseCronSecret({ CRON_SECRET: 'ci-cron-secret-somente-para-testes' })).toBe('ci-cron-secret-somente-para-testes')
})
```

(se `describe` ainda não estiver importado no topo do arquivo, inclua-o no import de `vitest`).

Acrescente em `src/lib/env-schema.test.ts`:

```ts
  it('URL base dos vídeos: vazia por padrão e sem barra final', () => {
    expect(parseEnv(base).NEXT_PUBLIC_VIDEO_CDN_BASE_URL).toBe('')
    expect(parseEnv({ ...base, NEXT_PUBLIC_VIDEO_CDN_BASE_URL: 'https://vz-1.b-cdn.net/' }).NEXT_PUBLIC_VIDEO_CDN_BASE_URL).toBe(
      'https://vz-1.b-cdn.net',
    )
  })
```

Acrescente em `src/lib/vitrines/db-errors.test.ts`, dentro de `describe('mapDbError')`:

```ts
  it('limites de vídeo viram convite para o Pro', () => {
    expect(mapDbError({ message: 'plan_limit:videos_vitrine', hint: '1' })).toBe(
      'Seu plano permite até 1 vídeo por vitrine. Assine o Pro para enviar mais.',
    )
    expect(mapDbError({ message: 'plan_limit:videos_account', hint: '1' })).toBe(
      'Seu plano permite até 1 vídeo na conta. Assine o Pro para enviar mais.',
    )
    expect(mapDbError({ message: 'plan_limit:videos_vitrine', hint: '50' })).toBe(
      'Seu plano permite até 50 vídeos por vitrine. Assine o Pro para enviar mais.',
    )
  })
```

Em `src/lib/vitrines/schemas.test.ts`, no objeto `valid` de `describe('itemSchema')`, acrescente `videoMediaId: ''`, e acrescente o caso:

```ts
  it('vídeo do item é opcional', () => {
    expect(itemSchema.parse(valid).videoMediaId).toBeNull()
    expect(itemSchema.parse({ ...valid, videoMediaId: uuid }).videoMediaId).toBe(uuid)
  })
```

Run: `npm test` → FAIL nos novos.

- [ ] **Step 2: Implementação**

Em `src/lib/server-env-schema.ts`, acrescente:

```ts
const videoStreamSchema = z
  .object({
    VIDEO_STREAM_DRIVER: z.enum(['bunny', 'fake']).default('bunny'),
    BUNNY_STREAM_LIBRARY_ID: z.string().default(''),
    BUNNY_STREAM_API_KEY: z.string().default(''),
    VERCEL_ENV: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.VIDEO_STREAM_DRIVER === 'bunny' && (!value.BUNNY_STREAM_LIBRARY_ID || !value.BUNNY_STREAM_API_KEY)) {
      ctx.addIssue({ code: 'custom', message: 'BUNNY_STREAM_LIBRARY_ID e BUNNY_STREAM_API_KEY são obrigatórias com o driver bunny.' })
    }
    if (value.VIDEO_STREAM_DRIVER === 'fake' && value.VERCEL_ENV === 'production') {
      ctx.addIssue({ code: 'custom', message: 'VIDEO_STREAM_DRIVER=fake não pode ser usado em produção.' })
    }
  })

export type VideoStreamEnv = { driver: 'fake' } | { driver: 'bunny'; libraryId: string; apiKey: string }

export function parseVideoStreamEnv(source: Source): VideoStreamEnv {
  const value = videoStreamSchema.parse(source)
  if (value.VIDEO_STREAM_DRIVER === 'fake') return { driver: 'fake' }
  return { driver: 'bunny', libraryId: value.BUNNY_STREAM_LIBRARY_ID, apiKey: value.BUNNY_STREAM_API_KEY }
}

export function parseWebhookSecret(source: Source): string {
  return z.string().min(8, 'BUNNY_STREAM_WEBHOOK_SECRET não configurada.').parse(source.BUNNY_STREAM_WEBHOOK_SECRET)
}

export function parseCronSecret(source: Source): string {
  return z.string().min(16, 'CRON_SECRET precisa de pelo menos 16 caracteres.').parse(source.CRON_SECRET)
}
```

Em `src/lib/server-env.ts`, amplie o import e acrescente:

```ts
export const getVideoStreamEnv = () => parseVideoStreamEnv(process.env)
export const getWebhookSecret = () => parseWebhookSecret(process.env)
export const getCronSecret = () => parseCronSecret(process.env)
```

Em `src/lib/env-schema.ts`, depois de `NEXT_PUBLIC_MEDIA_BASE_URL`:

```ts
  NEXT_PUBLIC_VIDEO_CDN_BASE_URL: z
    .string()
    .default('')
    .transform((value) => value.trim().replace(/\/+$/, '')),
```

e em `src/lib/env.ts`: `NEXT_PUBLIC_VIDEO_CDN_BASE_URL: process.env.NEXT_PUBLIC_VIDEO_CDN_BASE_URL,`.

Em `src/lib/vitrines/db-errors.ts`, dentro do `switch`:

```ts
    case 'plan_limit:videos_vitrine':
      return `Seu plano permite até ${limit} ${limit === 1 ? 'vídeo' : 'vídeos'} por vitrine. Assine o Pro para enviar mais.`
    case 'plan_limit:videos_account':
      return `Seu plano permite até ${limit} ${limit === 1 ? 'vídeo' : 'vídeos'} na conta. Assine o Pro para enviar mais.`
```

Em `src/lib/vitrines/schemas.ts`, no objeto de `itemSchema`, depois de `galleryMediaIds`:

```ts
    videoMediaId: z
      .union([z.uuid(), z.literal('')])
      .default('')
      .transform((value) => value || null),
```

e no `.transform` final, depois de `galleryMediaIds: data.galleryMediaIds,`: `videoMediaId: data.videoMediaId,`.

Run: `npm test` → PASS. `npm run typecheck` → PASS.

- [ ] **Step 3: Commit, PR e merge do bloco**

```bash
npm run lint && npm run typecheck && npm test
git add -A src
git commit -m "feat(video): variáveis do Stream, webhook e cron, limites de vídeo em português e vídeo no formulário do item"
git push -u origin HEAD
gh pr create --fill --base master
gh pr checks --watch
```

**Fim do Bloco 2:** autorização → merge.

---

# Bloco 3 — Servidor: Bunny Stream, webhook e rotas de mídia

Branch: `fase-3/bloco-3-servidor`.

```bash
npm install tus-js-client hls.js
```

(As duas bibliotecas são usadas nos Blocos 4 e 5; instalar aqui evita outro commit de `package-lock.json`.)

### Task 6: Drivers do Stream e remoção de vídeos

**Files:**
- Create: `src/lib/video/stream.ts`, `src/lib/video/bunny-stream.ts`, `src/lib/video/fake-stream.ts`
- Modify: `src/lib/media/remove-media.ts`

**Interfaces:**
- Produces:
  - `type StreamVideo = { guid: string; status: number; length: number; width: number; height: number }`
  - `type UploadTicket = { mode: 'tus'; endpoint: string; headers: Record<string, string> } | { mode: 'put'; url: string }`
  - `interface VideoStream { createVideo(title: string, declared: { durationSeconds: number; width: number; height: number }): Promise<string>; uploadTicket(guid: string): UploadTicket; getVideo(guid: string): Promise<StreamVideo | null>; deleteVideo(guid: string): Promise<void> }`
  - `getVideoStream(): VideoStream`
  - `markFakeUploaded(guid: string): Promise<boolean>`
  - `removeStreamVideos(guids: string[]): Promise<void>`
  - `deleteMediaRows(admin, rows: ReadonlyArray<{ id: string; storage_paths: unknown; bunny_video_id?: string | null }>)` — agora também apaga os vídeos no Stream

- [ ] **Step 1: Interface e drivers**

`src/lib/video/stream.ts`:

```ts
import 'server-only'
import { getVideoStreamEnv } from '@/lib/server-env'
import { createBunnyStream } from './bunny-stream'
import { createFakeStream } from './fake-stream'

export type StreamVideo = { guid: string; status: number; length: number; width: number; height: number }

export type UploadTicket =
  | { mode: 'tus'; endpoint: string; headers: Record<string, string> }
  | { mode: 'put'; url: string }

export interface VideoStream {
  createVideo(title: string, declared: { durationSeconds: number; width: number; height: number }): Promise<string>
  uploadTicket(guid: string): UploadTicket
  getVideo(guid: string): Promise<StreamVideo | null>
  deleteVideo(guid: string): Promise<void>
}

export function getVideoStream(): VideoStream {
  const config = getVideoStreamEnv()
  return config.driver === 'fake' ? createFakeStream() : createBunnyStream(config)
}
```

`src/lib/video/bunny-stream.ts`:

```ts
import 'server-only'
import { tusSignature } from './signatures'
import type { StreamVideo, VideoStream } from './stream'

const API = 'https://video.bunnycdn.com'
const TICKET_SECONDS = 6 * 60 * 60

export function createBunnyStream(config: { libraryId: string; apiKey: string }): VideoStream {
  const videos = `${API}/library/${config.libraryId}/videos`
  const headers = { AccessKey: config.apiKey, accept: 'application/json' }

  return {
    async createVideo(title) {
      const response = await fetch(videos, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      if (!response.ok) throw new Error(`Bunny Stream POST ${response.status}`)
      const { guid } = (await response.json()) as { guid?: string }
      if (!guid) throw new Error('Bunny Stream não devolveu o guid')
      return guid
    },

    uploadTicket(guid) {
      const expires = Math.floor(Date.now() / 1000) + TICKET_SECONDS
      return {
        mode: 'tus',
        endpoint: `${API}/tusupload`,
        headers: {
          AuthorizationSignature: tusSignature({ libraryId: config.libraryId, apiKey: config.apiKey, expires, videoId: guid }),
          AuthorizationExpire: String(expires),
          VideoId: guid,
          LibraryId: config.libraryId,
        },
      }
    },

    async getVideo(guid) {
      const response = await fetch(`${videos}/${guid}`, { headers })
      if (response.status === 404) return null
      if (!response.ok) throw new Error(`Bunny Stream GET ${response.status}`)
      const video = (await response.json()) as StreamVideo
      return { guid: video.guid, status: video.status, length: video.length, width: video.width, height: video.height }
    },

    async deleteVideo(guid) {
      const response = await fetch(`${videos}/${guid}`, { method: 'DELETE', headers })
      if (!response.ok && response.status !== 404) throw new Error(`Bunny Stream DELETE ${response.status}`)
    },
  }
}
```

`src/lib/video/fake-stream.ts`:

```ts
import 'server-only'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { StreamVideo, VideoStream } from './stream'

// Só CI e desenvolvimento: "vídeos" são arquivos JSON no diretório temporário.
const ROOT = path.join(os.tmpdir(), 'agenn-vitrine-video')
const GUID = /^[0-9a-f-]{36}$/

function fileFor(guid: string) {
  if (!GUID.test(guid)) throw new Error('guid inválido')
  return path.join(ROOT, `${guid}.json`)
}

async function read(guid: string): Promise<StreamVideo | null> {
  try {
    return JSON.parse(await readFile(fileFor(guid), 'utf8')) as StreamVideo
  } catch {
    return null
  }
}

async function write(video: StreamVideo) {
  await mkdir(ROOT, { recursive: true })
  await writeFile(fileFor(video.guid), JSON.stringify(video))
}

export async function markFakeUploaded(guid: string): Promise<boolean> {
  const video = await read(guid)
  if (!video) return false
  await write({ ...video, status: 3 })
  return true
}

export function createFakeStream(): VideoStream {
  return {
    async createVideo(_title, declared) {
      const guid = crypto.randomUUID()
      await write({
        guid,
        status: 0,
        length: Math.round(declared.durationSeconds),
        width: declared.width,
        height: declared.height,
      })
      return guid
    },
    uploadTicket(guid) {
      return { mode: 'put', url: `/api/dev-video/upload/${guid}` }
    },
    getVideo: read,
    async deleteVideo(guid) {
      await rm(fileFor(guid), { force: true })
    },
  }
}
```

- [ ] **Step 2: Remoção também no Stream**

Em `src/lib/media/remove-media.ts`:

```ts
import { getVideoStream } from '@/lib/video/stream'

export async function removeStreamVideos(guids: string[]): Promise<void> {
  if (guids.length === 0) return
  try {
    const stream = getVideoStream()
    const results = await Promise.allSettled(guids.map((guid) => stream.deleteVideo(guid)))
    for (const result of results) if (result.status === 'rejected') Sentry.captureException(result.reason)
  } catch (error) {
    // Configuração ausente: o vídeo fica no Stream até a próxima limpeza.
    Sentry.captureException(error)
  }
}
```

E troque `deleteMediaRows` por:

```ts
export async function deleteMediaRows(
  admin: SupabaseClient<Database>,
  rows: ReadonlyArray<{ id: string; storage_paths: unknown; bunny_video_id?: string | null }>,
): Promise<void> {
  if (rows.length === 0) return
  const { error } = await admin.from('media').delete().in('id', rows.map((row) => row.id))
  if (error) throw error
  await Promise.all([
    removeStoredFiles(rows.flatMap((row) => storagePathList(row.storage_paths))),
    removeStreamVideos(rows.flatMap((row) => (row.bunny_video_id ? [row.bunny_video_id] : []))),
  ])
}
```

- [ ] **Step 3: Quem apaga mídias passa a trazer `bunny_video_id`**

Troque `select('id, storage_paths')` por `select('id, storage_paths, bunny_video_id')` em:
- `src/app/api/media/image/route.ts` (busca da mídia anterior; substituir um banner em vídeo por imagem apaga o vídeo)
- `src/features/items/actions.ts` → `deleteItemAction` e `linkPendingMedia`

Em `src/app/api/media/[id]/route.ts`, no `select` do `DELETE`, acrescente `bunny_video_id`.

Em `src/features/vitrines/actions.ts` → `deleteVitrineAction`, troque a coleta de caminhos por:

```ts
  let paths: string[]
  let guids: string[]
  try {
    const admin = createSupabaseAdminClient()
    const { data: mediaRows, error: mediaError } = await admin
      .from('media')
      .select('storage_paths, bunny_video_id')
      .eq('vitrine_id', vitrineId)
    if (mediaError) throw mediaError
    paths = (mediaRows ?? []).flatMap((row) => storagePathList(row.storage_paths))
    guids = (mediaRows ?? []).flatMap((row) => (row.bunny_video_id ? [row.bunny_video_id] : []))
  } catch (error) {
    Sentry.captureException(error)
    return { error: 'Não foi possível excluir agora. Tente novamente.' }
  }
```

e, depois do `delete` bem-sucedido, `await Promise.all([removeStoredFiles(paths), removeStreamVideos(guids)])` (import de `removeStreamVideos`).

- [ ] **Step 4: Verificar e commitar**

```bash
npm run lint && npm run typecheck && npm test
git add -A src package.json package-lock.json
git commit -m "feat(video): drivers do Bunny Stream e fake; apagar mídia apaga o vídeo no Stream"
```

---

### Task 7: Rotas de envio, status, webhook e envio fake

**Files:**
- Create: `src/app/api/media/video/route.ts`, `src/app/api/webhooks/bunny/route.ts`, `src/app/api/dev-video/upload/[guid]/route.ts`
- Modify: `src/app/api/media/[id]/route.ts` (+ `GET`)

**Interfaces:**
- Produces:
  - `POST /api/media/video` (host `app.`), JSON `{ role: 'video' | 'banner', vitrineId, itemId: string | null, durationSeconds, sizeBytes, width, height }` → `201 { id, upload: UploadTicket }` | `4xx/5xx { error }`
  - `GET /api/media/{id}` → `200 { status }` | `404`
  - `POST /api/webhooks/bunny` → `200` (inclusive guid desconhecido) | `401` assinatura inválida | `400` corpo inválido | `503` sem segredo
  - `PUT /api/dev-video/upload/{guid}` (só driver fake) → `204` | `404`

- [ ] **Step 1: Envio**

`src/app/api/media/video/route.ts`:

```ts
import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getApiUser } from '@/lib/auth/require-user'
import { deleteMediaRows } from '@/lib/media/remove-media'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { validateVideoFile } from '@/lib/video/rules'
import { getVideoStream } from '@/lib/video/stream'
import { isPlanLimitError, mapDbError } from '@/lib/vitrines/db-errors'

const bodySchema = z
  .object({
    role: z.enum(['video', 'banner']),
    vitrineId: z.uuid(),
    itemId: z.uuid().nullable().default(null),
    durationSeconds: z.number(),
    sizeBytes: z.number().int().nonnegative(),
    width: z.number().int().nonnegative(),
    height: z.number().int().nonnegative(),
  })
  .refine((value) => value.role === 'video' || value.itemId === null)

const fail = (status: number, error: string) => NextResponse.json({ error }, { status })
const PREPARE_FAILED = 'Não foi possível preparar o envio. Tente novamente.'

export async function POST(request: Request) {
  const session = await getApiUser()
  if (!session) return fail(401, 'Sua sessão expirou. Entre novamente.')

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return fail(400, 'Dados do envio inválidos.')
  const input = parsed.data
  const { supabase, userId } = session

  const { data: vitrine } = await supabase.from('vitrines').select('id, subdomain').eq('id', input.vitrineId).maybeSingle()
  if (!vitrine) return fail(404, 'Vitrine não encontrada.')
  if (input.itemId) {
    const { data: item } = await supabase
      .from('items')
      .select('id')
      .eq('id', input.itemId)
      .eq('vitrine_id', input.vitrineId)
      .is('deleted_at', null)
      .maybeSingle()
    if (!item) return fail(404, 'Item não encontrado.')
  }

  const { data: plan } = await supabase.rpc('my_entitlements')
  if (!plan) return fail(500, PREPARE_FAILED)
  if (input.role === 'banner' && !plan.allow_branding) return fail(403, 'Banner em vídeo é recurso do plano Pro.')

  const check = validateVideoFile(
    input,
    { maxSeconds: plan.max_video_seconds, maxUploadMb: plan.max_video_upload_mb },
    input.role,
  )
  if (!check.ok) return fail(422, check.message)

  let stream: ReturnType<typeof getVideoStream>
  let admin: ReturnType<typeof createSupabaseAdminClient>
  try {
    stream = getVideoStream()
    admin = createSupabaseAdminClient()
  } catch (error) {
    Sentry.captureException(error)
    return fail(503, 'Envio de vídeos indisponível no momento. Tente mais tarde.')
  }

  const { data: overQuota } = await admin.rpc('is_over_video_quota', { p_user_id: userId })
  if (overQuota) return fail(403, 'A franquia de vídeo deste mês acabou. Os vídeos voltam no próximo mês.')

  let guid: string
  try {
    guid = await stream.createVideo(`${vitrine.subdomain} · ${input.role}`, input)
  } catch (error) {
    Sentry.captureException(error)
    return fail(502, PREPARE_FAILED)
  }

  try {
    // O vídeo do item e o banner ocupam um espaço só: o anterior é substituído.
    if (input.itemId || input.role === 'banner') {
      let previousQuery = admin
        .from('media')
        .select('id, storage_paths, bunny_video_id')
        .eq('vitrine_id', input.vitrineId)
        .eq('role', input.role)
      if (input.itemId) previousQuery = previousQuery.eq('item_id', input.itemId)
      const { data: previous, error: previousError } = await previousQuery
      if (previousError) throw previousError
      await deleteMediaRows(admin, previous ?? [])
    }

    const mediaId = crypto.randomUUID()
    const { error: insertError } = await admin.from('media').insert({
      id: mediaId,
      owner_id: userId,
      vitrine_id: input.vitrineId,
      item_id: input.itemId,
      role: input.role,
      kind: 'video',
      status: 'processing',
      bunny_video_id: guid,
      duration_seconds: check.durationSeconds,
      aspect: check.aspect,
      width: input.width,
      height: input.height,
      bytes: input.sizeBytes,
    })
    if (insertError) {
      await stream.deleteVideo(guid).catch(() => undefined)
      if (isPlanLimitError(insertError)) return fail(403, mapDbError(insertError))
      throw insertError
    }

    if (input.role === 'banner') {
      const { error: linkError } = await admin.from('vitrines').update({ banner_media_id: mediaId }).eq('id', input.vitrineId)
      if (linkError) throw linkError
    }

    return NextResponse.json({ id: mediaId, upload: stream.uploadTicket(guid) }, { status: 201 })
  } catch (error) {
    Sentry.captureException(error)
    await stream.deleteVideo(guid).catch(() => undefined)
    return fail(500, PREPARE_FAILED)
  }
}
```

- [ ] **Step 2: Status**

Em `src/app/api/media/[id]/route.ts`, acrescente:

```ts
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiUser()
  if (!session) return NextResponse.json({ error: 'Sua sessão expirou. Entre novamente.' }, { status: 401 })
  const { id } = await params
  const { data: media } = await session.supabase.from('media').select('status').eq('id', id).maybeSingle()
  if (!media) return NextResponse.json({ error: 'Mídia não encontrada.' }, { status: 404 })
  return NextResponse.json({ status: media.status }, { headers: { 'Cache-Control': 'no-store' } })
}
```

- [ ] **Step 3: Webhook**

`src/app/api/webhooks/bunny/route.ts`:

```ts
import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getWebhookSecret } from '@/lib/server-env'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { aspectFor, bunnyStatusToMedia, type MediaStatus } from '@/lib/video/rules'
import { verifyWebhookSignature } from '@/lib/video/signatures'
import { getVideoStream } from '@/lib/video/stream'
import { revalidateVitrine } from '@/lib/vitrines/cache'

const payloadSchema = z.object({ VideoGuid: z.string().min(1), Status: z.number().int() })

// Spec 6.2: o aviso do Bunny só diz "algo mudou"; o estado vem da API do Stream.
export async function POST(request: Request) {
  const raw = await request.text()

  let secret: string
  try {
    secret = getWebhookSecret()
  } catch (error) {
    Sentry.captureException(error)
    return NextResponse.json({ error: 'Webhook indisponível.' }, { status: 503 })
  }
  if (!verifyWebhookSignature(raw, request.headers.get('x-bunnystream-signature'), secret)) {
    return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 401 })
  }

  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })
  }
  const payload = payloadSchema.safeParse(json)
  if (!payload.success) return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })

  try {
    const admin = createSupabaseAdminClient()
    const { data: media } = await admin
      .from('media')
      .select('id, owner_id, item_id, role, status, vitrines(subdomain)')
      .eq('bunny_video_id', payload.data.VideoGuid)
      .maybeSingle()
    if (!media) return NextResponse.json({ ignored: true })

    const stream = getVideoStream()
    const video = await stream.getVideo(payload.data.VideoGuid)

    let update: { status: MediaStatus; duration_seconds?: number; width?: number; height?: number; aspect?: '9:16' | '16:9' }
    if (!video) {
      update = { status: 'failed' }
    } else {
      const status = bunnyStatusToMedia(video.status)
      if (status !== 'ready') {
        update = { status }
      } else {
        const { data: planId } = await admin.rpc('effective_plan_id', { p_user_id: media.owner_id })
        const { data: plan } = await admin.from('plans').select('max_video_seconds').eq('id', planId ?? 'free').single()
        if (plan && video.length > plan.max_video_seconds + 1) {
          await stream.deleteVideo(video.guid)
          update = { status: 'failed' }
        } else {
          update = {
            status: 'ready',
            duration_seconds: video.length,
            width: video.width,
            height: video.height,
            aspect: aspectFor(video.width, video.height),
          }
        }
      }
    }

    if (update.status === media.status && update.status !== 'ready') return NextResponse.json({ unchanged: true })

    const { error } = await admin.from('media').update(update).eq('id', media.id)
    if (error) throw error

    const subdomain = (media.vitrines as { subdomain: string } | null)?.subdomain
    const visibleChange = update.status === 'ready' || media.status === 'ready'
    if (subdomain && visibleChange && (media.item_id || media.role === 'banner')) revalidateVitrine(subdomain)

    return NextResponse.json({ status: update.status })
  } catch (error) {
    Sentry.captureException(error)
    // 500 faz o Bunny tentar de novo.
    return NextResponse.json({ error: 'Falha ao processar o aviso.' }, { status: 500 })
  }
}
```

Se o Zod reclamar de `z.number().int()` para `Status` vindo como número, está certo: o Bunny envia inteiro.

- [ ] **Step 4: Envio no driver fake**

`src/app/api/dev-video/upload/[guid]/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { getVideoStreamEnv } from '@/lib/server-env'
import { markFakeUploaded } from '@/lib/video/fake-stream'

// Só CI e desenvolvimento: recebe o arquivo (descartado) e marca o "vídeo" como codificado.
// O webhook continua sendo chamado à parte (nos testes), como faria o Bunny.
export async function PUT(request: Request, { params }: { params: Promise<{ guid: string }> }) {
  if (getVideoStreamEnv().driver !== 'fake') return new NextResponse(null, { status: 404 })
  const { guid } = await params
  await request.arrayBuffer()
  const found = await markFakeUploaded(guid).catch(() => false)
  return new NextResponse(null, { status: found ? 204 : 404 })
}
```

- [ ] **Step 5: Commit, PR e merge do bloco**

```bash
npm run lint && npm run typecheck && npm test
git add -A src
git commit -m "feat(video): rota de envio com assinatura TUS, status, webhook assinado do Bunny e envio fake"
git push -u origin HEAD
gh pr create --fill --base master
gh pr checks --watch
```

Os testes de ponta a ponta dessas rotas vêm no Bloco 4 (painel) e no Bloco 5 (vitrine), onde há tela para exercitá-las.

**Fim do Bloco 3:** autorização → merge. Conferência na nuvem: com a biblioteca configurada, no painel do Bunny Stream **Webhook** mostra a URL; um `curl -X POST https://app.agenn.com.br/api/webhooks/bunny -d '{}'` responde `401` (assinatura exigida).

---

# Bloco 4 — Painel: envio de vídeo e uso do plano

Branch: `fase-3/bloco-4-painel`.

### Task 8: Espaço de vídeo

**Files:**
- Create: `src/components/media/video-slot.tsx`

**Interfaces:**
- Consumes: `validateVideoFile`, `POST /api/media/video`, `GET /api/media/{id}`, `DELETE /api/media/{id}`, `tus-js-client`
- Produces: `<VideoSlot label: string; role: 'video' | 'banner'; vitrineId: string; itemId?: string | null; initial: { id: string; status: 'processing' | 'ready' | 'failed' } | null; limits: { maxSeconds: number; maxUploadMb: number }; disabled?: boolean; onChange?: (media: { id: string; status: string } | null) => void />`
- Textos (usados nos testes): input de arquivo com `aria-label` = `label`; `Enviando… {N}%`; `Conexão caiu, retomando…`; `Processando o vídeo…`; `Vídeo pronto`; `O processamento falhou.`; botões `Tentar novamente` e `Remover vídeo`.

- [ ] **Step 1: Componente**

`src/components/media/video-slot.tsx`:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { validateVideoFile } from '@/lib/video/rules'

type SlotMedia = { id: string; status: 'processing' | 'ready' | 'failed' }
type UploadTicket = { mode: 'tus'; endpoint: string; headers: Record<string, string> } | { mode: 'put'; url: string }

function readMetadata(file: File): Promise<{ durationSeconds: number; width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    const done = (value: { durationSeconds: number; width: number; height: number }) => {
      URL.revokeObjectURL(url)
      resolve(value)
    }
    const timeout = setTimeout(() => done({ durationSeconds: Number.NaN, width: 0, height: 0 }), 15_000)
    video.preload = 'metadata'
    video.muted = true
    video.onloadedmetadata = () => {
      clearTimeout(timeout)
      done({ durationSeconds: video.duration, width: video.videoWidth, height: video.videoHeight })
    }
    video.onerror = () => {
      clearTimeout(timeout)
      done({ durationSeconds: Number.NaN, width: 0, height: 0 })
    }
    video.src = url
  })
}

function putWithProgress(url: string, file: File, onProgress: (ratio: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('PUT', url)
    request.upload.onprogress = (event) => event.lengthComputable && onProgress(event.loaded / event.total)
    request.onload = () => (request.status < 300 ? resolve() : reject(new Error(String(request.status))))
    request.onerror = () => reject(new Error('rede'))
    request.send(file)
  })
}

export function VideoSlot(props: {
  label: string
  role: 'video' | 'banner'
  vitrineId: string
  itemId?: string | null
  initial: SlotMedia | null
  limits: { maxSeconds: number; maxUploadMb: number }
  disabled?: boolean
  onChange?: (media: SlotMedia | null) => void
}) {
  const [media, setMedia] = useState<SlotMedia | null>(props.initial)
  const [progress, setProgress] = useState<number | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const onChangeRef = useRef(props.onChange)
  // Atualizado em efeito: escrever em ref durante a renderização é recusado pelo lint do React.
  useEffect(() => {
    onChangeRef.current = props.onChange
  })

  function update(next: SlotMedia | null) {
    setMedia(next)
    onChangeRef.current?.(next)
  }

  // Enquanto processa, consulta o status a cada 5 s.
  useEffect(() => {
    if (media?.status !== 'processing' || progress !== null) return
    const id = media.id
    const timer = setInterval(async () => {
      const response = await fetch(`/api/media/${id}`, { cache: 'no-store' }).catch(() => null)
      if (!response?.ok) return
      const { status } = (await response.json()) as { status: SlotMedia['status'] }
      if (status !== 'processing') {
        setMedia({ id, status })
        onChangeRef.current?.({ id, status })
      }
    }, 5000)
    return () => clearInterval(timer)
  }, [media, progress])

  async function onFile(file: File) {
    setError(null)
    setNotice(null)
    const meta = await readMetadata(file)
    const check = validateVideoFile({ ...meta, sizeBytes: file.size }, props.limits, props.role)
    if (!check.ok) {
      setError(check.message)
      return
    }

    const response = await fetch('/api/media/video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: props.role,
        vitrineId: props.vitrineId,
        itemId: props.itemId ?? null,
        durationSeconds: meta.durationSeconds,
        sizeBytes: file.size,
        width: meta.width,
        height: meta.height,
      }),
    }).catch(() => null)
    const result = (await response?.json().catch(() => ({}))) as { id?: string; upload?: UploadTicket; error?: string }
    if (!response?.ok || !result.id || !result.upload) {
      setError(result.error ?? 'Não foi possível preparar o envio. Tente novamente.')
      return
    }

    const mediaId = result.id
    update({ id: mediaId, status: 'processing' })
    setProgress(0)
    try {
      if (result.upload.mode === 'put') {
        await putWithProgress(result.upload.url, file, setProgress)
      } else {
        const ticket = result.upload
        const tus = await import('tus-js-client')
        await new Promise<void>((resolve, reject) => {
          const upload = new tus.Upload(file, {
            endpoint: ticket.endpoint,
            headers: ticket.headers,
            metadata: { filetype: file.type, title: file.name },
            retryDelays: [0, 3000, 5000, 10000, 20000, 60000],
            onShouldRetry: () => {
              setNotice('Conexão caiu, retomando…')
              return true
            },
            onProgress: (sent, total) => {
              setNotice(null)
              setProgress(total ? sent / total : 0)
            },
            onError: reject,
            onSuccess: () => resolve(),
          })
          upload.findPreviousUploads().then((previous) => {
            if (previous.length) upload.resumeFromPreviousUpload(previous[0])
            upload.start()
          })
        })
      }
      setProgress(null)
      setNotice(null)
    } catch {
      setProgress(null)
      setError('Não foi possível enviar o vídeo. Tente novamente.')
      await fetch(`/api/media/${mediaId}`, { method: 'DELETE' }).catch(() => null)
      update(null)
    }
  }

  async function remove() {
    if (!media) return
    const response = await fetch(`/api/media/${media.id}`, { method: 'DELETE' }).catch(() => null)
    if (response?.status === 204) update(null)
    else setError('Não foi possível remover o vídeo.')
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{props.label}</span>
      {media === null || progress !== null ? (
        <input
          type="file"
          accept="video/*"
          aria-label={props.label}
          disabled={props.disabled || progress !== null}
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) void onFile(file)
          }}
        />
      ) : null}
      <div aria-live="polite" className="text-sm">
        {progress !== null ? <p>Enviando… {Math.round(progress * 100)}%</p> : null}
        {notice ? <p>{notice}</p> : null}
        {media?.status === 'processing' && progress === null ? <p>Processando o vídeo…</p> : null}
        {media?.status === 'ready' ? <p>Vídeo pronto</p> : null}
        {media?.status === 'failed' ? <p className="text-danger">O processamento falhou.</p> : null}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {media && progress === null ? (
        <Button variant="ghost" className="self-start" onClick={remove}>
          {media.status === 'failed' ? 'Tentar novamente' : 'Remover vídeo'}
        </Button>
      ) : null}
    </div>
  )
}
```

"Tentar novamente" remove o vídeo com falha e volta a mostrar o campo de arquivo.

- [ ] **Step 2: Commit**

```bash
npm run lint && npm run typecheck
git add src/components/media/video-slot.tsx
git commit -m "feat(video): espaço de vídeo com leitura do arquivo, envio retomável, progresso e status"
```

---

### Task 9: Vídeo no item, banner em vídeo e uso do plano

**Files:**
- Modify: `src/features/items/queries.ts`, `src/features/items/actions.ts`, `src/app/app/(painel)/painel/vitrines/[id]/itens/item-form.tsx`, `.../itens/novo/page.tsx`, `.../itens/[itemId]/page.tsx`, `.../aparencia/page.tsx`, `.../aparencia/appearance-form.tsx`, `src/features/vitrines/queries.ts`, `src/app/app/(painel)/painel/page.tsx`
- Create: `e2e/videos-panel.spec.ts`
- Modify: `e2e/helpers.ts`

(`...` = `src/app/app/(painel)/painel/vitrines/[id]`)

**Interfaces:**
- Produces:
  - `getItemForEdit(...).video: { id: string; status: 'processing' | 'ready' | 'failed' } | null`
  - `getVideoLimits(): Promise<{ maxSeconds: number; maxUploadMb: number }>` (em `features/vitrines/queries.ts`)
  - `getVideoUsage(): Promise<{ videosCount: number; bytesDelivered: number; overQuota: boolean }>`
  - e2e: `videoFixture(name)`, `signBunnyWebhook(body)`, `sendBunnyWebhook(request, guid, status?)`, `seedVideo(vitrine, ownerId, itemId, options?)`
- Textos: `Vídeo` (espaço do item), `Banner em vídeo` (Aparência), `Vídeos: {n} de {max}` ou `Vídeos: {n}` quando sem limite, `Franquia do mês: {x} de {y} GB`, aviso `A franquia de vídeo deste mês acabou. Os vídeos voltam no próximo mês.`

- [ ] **Step 1: Consultas**

Em `src/features/items/queries.ts`, no `select` de `getItemForEdit`, troque `media(id, role, position, storage_paths)` por `media(id, role, position, storage_paths, status)` e acrescente ao objeto retornado:

```ts
    video: (() => {
      const row = media.find((m) => m.role === 'video')
      return row ? { id: row.id, status: row.status as 'processing' | 'ready' | 'failed' } : null
    })(),
```

Em `src/features/vitrines/queries.ts`:

```ts
export async function getVideoLimits() {
  const plan = await getEntitlements()
  return { maxSeconds: plan.max_video_seconds, maxUploadMb: plan.max_video_upload_mb }
}

export async function getVideoUsage() {
  const { supabase } = await getPanelSession()
  const { data } = await supabase.rpc('my_video_usage')
  const row = data?.[0]
  return {
    videosCount: row?.videos_count ?? 0,
    bytesDelivered: Number(row?.bytes_delivered ?? 0),
    overQuota: row?.over_quota ?? false,
  }
}
```

- [ ] **Step 2: Salvar o item vincula o vídeo pendente**

Em `src/features/items/actions.ts`:
- acrescente `'videoMediaId'` a `ITEM_FIELDS`;
- em `linkPendingMedia`, troque a montagem de `wanted` por:

```ts
  const wanted = [
    { id: args.input.coverMediaId, role: 'cover' as const, position: 0 },
    ...args.input.galleryMediaIds.map((id, index) => ({ id, role: 'gallery' as const, position: index + 1 })),
    ...(args.input.videoMediaId ? [{ id: args.input.videoMediaId, role: 'video' as const, position: 0 }] : []),
  ]
```

(o restante da função já substitui o que ocupa o espaço e vincula a mídia pendente.)

Depois de vincular um vídeo que já está `ready`, a vitrine é revalidada pelo `revalidateVitrine` que `saveItemAction` já chama.

- [ ] **Step 3: Formulário do item**

Em `item-form.tsx`:
- nova prop `videoLimits: { maxSeconds: number; maxUploadMb: number }`;
- estado `const [videoId, setVideoId] = useState<string>(item?.video?.id ?? '')` e `<input type="hidden" name="videoMediaId" value={videoId} />` dentro do `<form>`;
- no card "Imagens" (renomear o título para `Imagens e vídeo`), depois dos espaços de imagem:

```tsx
        <VideoSlot
          label="Vídeo"
          role="video"
          vitrineId={vitrineId}
          itemId={item?.id}
          initial={item?.video ?? null}
          limits={props.videoLimits}
          onChange={(media) => setVideoId(media?.id ?? '')}
        />
        <p className="text-sm text-ink-muted">Até {props.videoLimits.maxSeconds} s, vertical (9:16) ou horizontal (16:9).</p>
```

Em `itens/novo/page.tsx` e `itens/[itemId]/page.tsx`, busque `getVideoLimits()` no `Promise.all` e passe `videoLimits`.

- [ ] **Step 4: Banner em vídeo**

Em `aparencia/page.tsx`: o `select` de mídias passa a trazer `kind, status`; `banner` (imagem) só quando `kind = 'image'`; novo `bannerVideo = row && row.kind === 'video' ? { id: row.id, status: row.status } : null`; busque `getVideoLimits()` e passe `bannerVideo` e `videoLimits` ao formulário.

Em `appearance-form.tsx`, depois do `ImageSlot` do banner:

```tsx
        <VideoSlot
          label="Banner em vídeo"
          role="banner"
          vitrineId={vitrineId}
          initial={bannerVideo}
          limits={videoLimits}
          disabled={!allowBranding}
        />
        <p className="text-sm text-ink-muted">O banner mostra a imagem ou o vídeo enviado por último. Vídeo só horizontal.</p>
```

- [ ] **Step 5: Uso do plano em Minhas vitrines**

Em `src/app/app/(painel)/painel/page.tsx`, busque `getVideoUsage()` junto com as vitrines e o plano, e troque o parágrafo do contador por:

```tsx
        <p className="text-sm text-ink-muted">
          Vitrines: {vitrines.length} de {plan.max_vitrines} · Vídeos: {usage.videosCount}
          {plan.max_videos_per_account !== null ? ` de ${plan.max_videos_per_account}` : ''} · Franquia do mês:{' '}
          {formatGigabytes(usage.bytesDelivered)} de {plan.monthly_video_gb} GB · Plano {plan.name}
        </p>
```

e, abaixo do cartão de limite de vitrines:

```tsx
      {usage.overQuota ? (
        <Card className="px-5 py-4">
          <p>A franquia de vídeo deste mês acabou. Os vídeos voltam no próximo mês.</p>
        </Card>
      ) : null}
```

**Atenção:** o texto `Vitrines: 1 de 1` usado em `e2e/vitrines.spec.ts` continua no início do parágrafo; o teste usa `getByText('Vitrines: 1 de 1')`, que casa por trecho.

- [ ] **Step 6: Helpers de e2e**

Acrescente em `e2e/helpers.ts`:

```ts
import { createHmac } from 'node:crypto'
import path from 'node:path'
import type { APIRequestContext } from '@playwright/test'

export function videoFixture(name: 'horizontal-3s' | 'vertical-3s' | 'longo-61s') {
  return path.join('e2e', 'fixtures', `${name}.webm`)
}

export function signBunnyWebhook(body: string) {
  return createHmac('sha256', process.env.BUNNY_STREAM_WEBHOOK_SECRET ?? 'ci-webhook-secret').update(body).digest('hex')
}

export async function sendBunnyWebhook(request: APIRequestContext, guid: string, status = 3) {
  const body = JSON.stringify({ VideoLibraryId: 1, VideoGuid: guid, Status: status })
  return request.post(`${APP_URL}/api/webhooks/bunny`, {
    data: body,
    headers: { 'content-type': 'application/json', 'x-bunnystream-signature': signBunnyWebhook(body) },
  })
}

export async function seedVideo(
  vitrine: SeededVitrine,
  ownerId: string,
  itemId: string | null,
  options: { status?: 'processing' | 'ready' | 'failed'; role?: 'video' | 'banner' } = {},
) {
  const admin = createAdminClient()
  const guid = crypto.randomUUID()
  const { data } = await admin
    .from('media')
    .insert({
      owner_id: ownerId,
      vitrine_id: vitrine.id,
      item_id: itemId,
      role: options.role ?? 'video',
      kind: 'video',
      status: options.status ?? 'ready',
      bunny_video_id: guid,
      duration_seconds: 3,
      aspect: '9:16',
      width: 360,
      height: 640,
    })
    .select('id')
    .single()
    .throwOnError()
  return { id: data.id as string, guid }
}

export async function mediaOfItem(itemId: string, role: 'video' | 'cover' = 'video') {
  const { data } = await createAdminClient()
    .from('media')
    .select('id, status, bunny_video_id')
    .eq('item_id', itemId)
    .eq('role', role)
    .maybeSingle()
    .throwOnError()
  return data as { id: string; status: string; bunny_video_id: string | null } | null
}
```

(Junte os imports novos aos existentes no topo do arquivo; `seedItem` passa a ser usado com o id do item retornado.)

- [ ] **Step 7: e2e do painel**

`e2e/videos-panel.spec.ts`:

```ts
import { rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import {
  createConfirmedUser,
  mediaOfItem,
  seedItem,
  seedVitrine,
  sendBunnyWebhook,
  setPlan,
  signIn,
  videoFixture,
} from './helpers'

test('envia vídeo do item, processa pelo webhook e respeita o limite do gratuito', async ({ page, request }) => {
  const user = await createConfirmedUser('video-item')
  const vitrine = await seedVitrine(user.id)
  const first = await seedItem(vitrine, user.id, { name: 'Com vídeo', priceCents: 1000 })
  const second = await seedItem(vitrine, user.id, { name: 'Sem vídeo', priceCents: 1000 })
  await signIn(page, user.email, user.password)

  await page.goto(`/painel/vitrines/${vitrine.id}/itens/${first.id}`)
  await page.getByLabel('Vídeo', { exact: true }).setInputFiles(videoFixture('longo-61s'))
  await expect(page.getByText('O vídeo tem 61 s. O limite é 60 s.')).toBeVisible()

  await page.getByLabel('Vídeo', { exact: true }).setInputFiles(videoFixture('vertical-3s'))
  await expect(page.getByText('Processando o vídeo…')).toBeVisible({ timeout: 20_000 })

  const media = await mediaOfItem(first.id)
  expect(media?.status).toBe('processing')
  const response = await sendBunnyWebhook(request, media!.bunny_video_id!)
  expect(response.status()).toBe(200)
  await expect(page.getByText('Vídeo pronto')).toBeVisible({ timeout: 15_000 })

  await page.goto(`/painel/vitrines/${vitrine.id}/itens/${second.id}`)
  await page.getByLabel('Vídeo', { exact: true }).setInputFiles(videoFixture('horizontal-3s'))
  await expect(page.getByText('Seu plano permite até 1 vídeo por vitrine. Assine o Pro para enviar mais.')).toBeVisible()

  await page.goto('/painel')
  await expect(page.getByText(/Vídeos: 1 de 1/)).toBeVisible()

  await setPlan(user.id, 'pro')
  await page.goto(`/painel/vitrines/${vitrine.id}/itens/${second.id}`)
  await page.getByLabel('Vídeo', { exact: true }).setInputFiles(videoFixture('horizontal-3s'))
  await expect(page.getByText('Processando o vídeo…')).toBeVisible({ timeout: 20_000 })
})

test('webhook: assinatura inválida é recusada e falha mostra Tentar novamente', async ({ page, request }) => {
  const user = await createConfirmedUser('video-falha')
  const vitrine = await seedVitrine(user.id)
  const item = await seedItem(vitrine, user.id, { name: 'Item', priceCents: 1000 })
  await signIn(page, user.email, user.password)

  const bad = await request.post('/api/webhooks/bunny', {
    data: '{"VideoLibraryId":1,"VideoGuid":"x","Status":3}',
    headers: { 'content-type': 'application/json', 'x-bunnystream-signature': '0'.repeat(64) },
  })
  expect(bad.status()).toBe(401)

  await page.goto(`/painel/vitrines/${vitrine.id}/itens/${item.id}`)
  await page.getByLabel('Vídeo', { exact: true }).setInputFiles(videoFixture('vertical-3s'))
  await expect(page.getByText('Processando o vídeo…')).toBeVisible({ timeout: 20_000 })
  // O webhook consulta a API do Stream: para simular a falha, o "vídeo" some do driver fake.
  // Playwright e next start rodam no mesmo runner e compartilham o diretório temporário.
  const media = await mediaOfItem(item.id)
  await rm(path.join(os.tmpdir(), 'agenn-vitrine-video', `${media!.bunny_video_id}.json`), { force: true })
  await sendBunnyWebhook(request, media!.bunny_video_id!, 5)
  await expect(page.getByText('O processamento falhou.')).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Tentar novamente' }).click()
  await expect(page.getByLabel('Vídeo', { exact: true })).toBeVisible()
})

test('banner em vídeo: só Pro e só horizontal', async ({ page }) => {
  const user = await createConfirmedUser('video-banner')
  const vitrine = await seedVitrine(user.id)
  await signIn(page, user.email, user.password)

  await page.goto(`/painel/vitrines/${vitrine.id}/aparencia`)
  await expect(page.getByLabel('Banner em vídeo', { exact: true })).toBeDisabled()

  await setPlan(user.id, 'pro')
  await page.reload()
  await page.getByLabel('Banner em vídeo', { exact: true }).setInputFiles(videoFixture('vertical-3s'))
  await expect(page.getByText('O banner em vídeo precisa ser horizontal.')).toBeVisible()
  await page.getByLabel('Banner em vídeo', { exact: true }).setInputFiles(videoFixture('horizontal-3s'))
  await expect(page.getByText('Processando o vídeo…')).toBeVisible({ timeout: 20_000 })
})
```

- [ ] **Step 8: Commit, PR e merge do bloco**

```bash
npm run lint && npm run typecheck && npm test
git add -A src e2e
git commit -m "feat(video): vídeo no item, banner em vídeo e uso de vídeos e franquia no painel"
git push -u origin HEAD
gh pr create --fill --base master
gh pr checks --watch
```

**Fim do Bloco 4:** autorização → merge. Conferência na nuvem: enviar um vídeo curto de celular num item; ver "Enviando… N%", depois "Processando o vídeo…" e, em 1–2 minutos, "Vídeo pronto" (webhook real do Bunny). No painel do Bunny Stream o vídeo aparece com as resoluções 240p–720p.

---

# Bloco 5 — Vitrine pública: player sob demanda e franquia

Branch: `fase-3/bloco-5-vitrine`.

### Task 10: Catálogo com vídeos, visibilidade e franquia

**Files:**
- Modify: `src/features/public/build-catalog.ts`, `src/features/public/build-catalog.test.ts`, `src/features/public/load-vitrine.ts`

**Interfaces:**
- Produces:
  - `CatalogRows.plan` ganha `max_videos_per_vitrine: number`
  - `CatalogRows.overQuota: boolean`
  - `CatalogRows.media[]` ganha `kind: string` e `bunny_video_id: string | null`
  - `type PublicVideo = { mediaId: string; playlistUrl: string; posterUrl: string | null; aspect: '9:16' | '16:9' }`
  - `PublicItem.video: PublicVideo | null`
  - `PublicVitrine.bannerVideo: PublicVideo | null` (quando há, `banner` é `null`)
  - `buildPublicCatalog(rows: CatalogRows, mediaBaseUrl: string, videoBaseUrl: string): PublicVitrine`

- [ ] **Step 1: Testes (falhando)**

Em `build-catalog.test.ts`:
- no `base`, acrescente `overQuota: false`, `max_videos_per_vitrine: 1` em `plan`, `kind: 'image', bunny_video_id: null` nas três mídias existentes, e duas mídias de vídeo:

```ts
    { id: 'v-i2', item_id: 'i2', role: 'video', kind: 'video', position: 0, storage_paths: null, bunny_video_id: 'g2', aspect: '9:16' },
    { id: 'v-i1', item_id: 'i1', role: 'video', kind: 'video', position: 0, storage_paths: null, bunny_video_id: 'g1', aspect: '16:9' },
```

(`aspect` passa a fazer parte das linhas de mídia: acrescente `aspect: null` nas imagens.)

- troque as chamadas `buildPublicCatalog(x, 'https://cdn')` por `buildPublicCatalog(x, 'https://cdn', 'https://vz')`;
- acrescente:

```ts
describe('vídeos', () => {
  it('gratuito mostra só o primeiro vídeo na ordem da vitrine (4.7)', () => {
    const [first, second] = buildPublicCatalog(base, 'https://cdn', 'https://vz').categories[0].items
    expect(first.video).toEqual({ mediaId: 'v-i2', playlistUrl: 'https://vz/g2/playlist.m3u8', posterUrl: 'https://cdn/a-1080.webp', aspect: '9:16' })
    expect(second.video).toBeNull()
  })

  it('Pro mostra todos', () => {
    const catalog = buildPublicCatalog(
      { ...base, plan: { max_items_per_vitrine: 300, max_videos_per_vitrine: 50, allow_branding: true, show_watermark: false } },
      'https://cdn',
      'https://vz',
    )
    expect(catalog.categories[0].items.map((i) => i.video?.mediaId)).toEqual(['v-i2', 'v-i1'])
  })

  it('franquia estourada: nenhum vídeo', () => {
    const catalog = buildPublicCatalog({ ...base, overQuota: true }, 'https://cdn', 'https://vz')
    expect(catalog.categories[0].items.every((i) => i.video === null)).toBe(true)
  })

  it('banner em vídeo só com marca liberada e sem franquia estourada', () => {
    const rows = {
      ...base,
      plan: { max_items_per_vitrine: 300, max_videos_per_vitrine: 50, allow_branding: true, show_watermark: false },
      media: [
        ...base.media.filter((m) => m.id !== 'banner'),
        { id: 'banner', item_id: null, role: 'banner', kind: 'video', position: 0, storage_paths: null, bunny_video_id: 'gb', aspect: '16:9' },
      ],
    }
    const catalog = buildPublicCatalog(rows, 'https://cdn', 'https://vz')
    expect(catalog.banner).toBeNull()
    expect(catalog.bannerVideo).toEqual({ mediaId: 'banner', playlistUrl: 'https://vz/gb/playlist.m3u8', posterUrl: 'https://vz/gb/thumbnail.jpg', aspect: '16:9' })
    expect(buildPublicCatalog({ ...rows, overQuota: true }, 'https://cdn', 'https://vz').bannerVideo).toBeNull()
    expect(buildPublicCatalog(base, 'https://cdn', 'https://vz').bannerVideo).toBeNull()
  })
})
```

Run: `npm test -- src/features/public` → FAIL.

- [ ] **Step 2: Implementação**

Em `build-catalog.ts`:

1. Tipos:

```ts
import { videoPlaylistUrl, videoThumbnailUrl } from '@/lib/video/urls'

export type PublicVideo = { mediaId: string; playlistUrl: string; posterUrl: string | null; aspect: '9:16' | '16:9' }
```

`CatalogRows`: em `plan` acrescente `max_videos_per_vitrine: number`; acrescente `overQuota: boolean`; em `media[]` acrescente `kind: string; bunny_video_id: string | null; aspect: string | null`. `PublicItem` ganha `video: PublicVideo | null`; `PublicVitrine` ganha `bannerVideo: PublicVideo | null`.

2. Assinatura: `export function buildPublicCatalog(rows: CatalogRows, mediaBaseUrl: string, videoBaseUrl: string): PublicVitrine`.

3. Depois de calcular `visible`, reserve os vídeos na ordem da vitrine:

```ts
  // Spec 4.7 e 3: no gratuito só o primeiro vídeo aparece; com a franquia estourada, nenhum.
  let videosLeft = rows.overQuota ? 0 : rows.plan.max_videos_per_vitrine
  const videoByItem = new Map<string, CatalogRows['media'][number]>()
  for (const item of visible) {
    const video = rows.media.find((m) => m.item_id === item.id && m.role === 'video' && m.bunny_video_id)
    if (video && videosLeft > 0) {
      videoByItem.set(item.id, video)
      videosLeft -= 1
    }
  }
```

4. Em `toItem`, acrescente (a capa já calculada vira o poster):

```ts
    const cover = image(media.find((m) => m.role === 'cover')?.storage_paths)
    const videoRow = videoByItem.get(row.id)
```

use `cover` no campo `cover` e acrescente:

```ts
      video: videoRow
        ? {
            mediaId: videoRow.id,
            playlistUrl: videoPlaylistUrl(videoBaseUrl, videoRow.bunny_video_id!),
            posterUrl: cover?.large ?? null,
            aspect: videoRow.aspect === '16:9' ? '16:9' : '9:16',
          }
        : null,
```

5. Banner:

```ts
  const bannerRow = vitrine.banner_media_id ? mediaById.get(vitrine.banner_media_id) : undefined
  const bannerAllowed = branding && vitrine.banner_enabled && bannerRow !== undefined
  const bannerIsVideo = bannerRow?.kind === 'video' && Boolean(bannerRow.bunny_video_id)
```

e no retorno:

```ts
    banner: bannerAllowed && !bannerIsVideo ? image(bannerRow!.storage_paths) : null,
    bannerVideo:
      bannerAllowed && bannerIsVideo && !rows.overQuota
        ? {
            mediaId: bannerRow!.id,
            playlistUrl: videoPlaylistUrl(videoBaseUrl, bannerRow!.bunny_video_id!),
            posterUrl: videoThumbnailUrl(videoBaseUrl, bannerRow!.bunny_video_id!),
            aspect: '16:9',
          }
        : null,
```

Em `load-vitrine.ts`:
- `plans` passa a selecionar `max_items_per_vitrine, max_videos_per_vitrine, allow_branding, show_watermark`;
- `media` passa a selecionar `id, item_id, role, kind, position, storage_paths, bunny_video_id, aspect` (continua filtrando `status = 'ready'`);
- depois do `planId`, busque `const { data: overQuota } = await admin.rpc('is_over_video_quota', { p_user_id: vitrine.owner_id })` e passe `overQuota: overQuota ?? false`;
- chame `buildPublicCatalog(rows, env.NEXT_PUBLIC_MEDIA_BASE_URL, env.NEXT_PUBLIC_VIDEO_CDN_BASE_URL)`.

Run: `npm test -- src/features/public` → PASS. `npm run typecheck` → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/public
git commit -m "feat(vitrine): vídeos no catálogo com limite do gratuito, franquia e banner em vídeo"
```

---

### Task 11: Relatório de consumo

**Files:**
- Create: `src/app/api/video-usage/route.ts`

**Interfaces:**
- Produces: `POST /api/video-usage` (host da vitrine), JSON `{ mediaId: uuid, bytes: number, seconds: number }` → `204` (sempre que o corpo é válido, mesmo ignorado) | `400` | `429`

- [ ] **Step 1: Rota**

`src/app/api/video-usage/route.ts`:

```ts
import * as Sentry from '@sentry/nextjs'
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { env } from '@/lib/env'
import { parseHost } from '@/lib/hosts/parse-host'
import { clientIp, rateLimitKey } from '@/lib/orders/client-ip'
import { getRateLimitSalt } from '@/lib/server-env'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { clampReportedBytes } from '@/lib/video/rules'
import { revalidateVitrine } from '@/lib/vitrines/cache'

const bodySchema = z.object({ mediaId: z.uuid(), bytes: z.number(), seconds: z.number() })
const noContent = () => new NextResponse(null, { status: 204 })

export async function POST(request: NextRequest) {
  const host = parseHost(request.headers.get('host'), {
    rootDomain: env.NEXT_PUBLIC_ROOT_DOMAIN,
    legacyDomains: env.LEGACY_DOMAINS,
  })
  if (host.type !== 'vitrine') return noContent()

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Relatório inválido.' }, { status: 400 })
  const bytes = clampReportedBytes(parsed.data.bytes, parsed.data.seconds)
  if (bytes === 0) return noContent()

  try {
    const admin = createSupabaseAdminClient()
    const key = await rateLimitKey(clientIp(request.headers), 'video-usage', getRateLimitSalt())
    const { data: allowed } = await admin.rpc('hit_rate_limit', { p_key: key, p_limit: 600, p_window_seconds: 3600 })
    if (allowed === false) return NextResponse.json({ error: 'Muitos relatórios.' }, { status: 429 })

    // O vídeo precisa ser desta vitrine: outro host não soma consumo alheio.
    const { data: media } = await admin
      .from('media')
      .select('id, vitrines!inner(subdomain)')
      .eq('id', parsed.data.mediaId)
      .eq('kind', 'video')
      .eq('status', 'ready')
      .maybeSingle()
    const subdomain = (media?.vitrines as { subdomain: string } | undefined)?.subdomain
    if (!media || subdomain !== host.subdomain) return noContent()

    const { data: usage, error } = await admin.rpc('add_video_usage', { p_media_id: media.id, p_bytes: bytes })
    if (error) throw error
    const result = usage?.[0]
    if (result?.crossed_quota) {
      const { data: vitrines } = await admin.from('vitrines').select('subdomain').eq('owner_id', result.usage_owner_id)
      revalidateVitrine(...(vitrines ?? []).map((v) => v.subdomain))
    }
    return noContent()
  } catch (error) {
    Sentry.captureException(error)
    return noContent()
  }
}
```

- [ ] **Step 2: Commit**

```bash
npm run lint && npm run typecheck
git add src/app/api/video-usage
git commit -m "feat(video): relatório de bytes entregues com teto por segundo e revalidação ao estourar a franquia"
```

---

### Task 12: Player sob demanda, carrossel e banner

**Files:**
- Create: `src/app/v/[subdomain]/usage-reporter.ts`, `src/app/v/[subdomain]/video-player.tsx`, `src/app/v/[subdomain]/banner-video.tsx`, `e2e/videos-public.spec.ts`
- Modify: `src/app/v/[subdomain]/item-sheet.tsx`, `src/app/v/[subdomain]/catalog.tsx`

**Interfaces:**
- Produces:
  - `createUsageReporter(mediaId: string): { addBytes(bytes: number): void; addSeconds(seconds: number): void; flush(): void }`
  - `<VideoPlayer video: PublicVideo; autoPlay?: boolean; controls?: boolean; showSoundToggle?: boolean; className?: string />` — `<video data-media-id>`; botões `Ativar som` / `Desativar som`
  - `<BannerVideo video: PublicVideo />`

- [ ] **Step 1: Medição**

`src/app/v/[subdomain]/usage-reporter.ts`:

```ts
import { estimateBytesFromSeconds } from '@/lib/video/rules'

const REPORT_EVERY_MS = 15_000

// Envia a cada 15 s e ao fechar: bytes medidos pelo hls.js ou, no HLS nativo,
// estimativa por segundos assistidos. "seconds" é o tempo de relógio desde o último envio,
// usado no servidor como teto.
export function createUsageReporter(mediaId: string) {
  let bytes = 0
  let watchedSeconds = 0
  let since = Date.now()

  function send(final: boolean) {
    const seconds = (Date.now() - since) / 1000
    const total = bytes > 0 ? bytes : estimateBytesFromSeconds(watchedSeconds)
    bytes = 0
    watchedSeconds = 0
    since = Date.now()
    if (total <= 0) return
    const body = JSON.stringify({ mediaId, bytes: total, seconds })
    if (final && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon('/api/video-usage', new Blob([body], { type: 'application/json' }))
      return
    }
    void fetch('/api/video-usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => undefined)
  }

  const timer = setInterval(() => send(false), REPORT_EVERY_MS)
  return {
    addBytes(value: number) {
      if (Number.isFinite(value) && value > 0) bytes += value
    },
    addSeconds(value: number) {
      if (Number.isFinite(value) && value > 0 && value < 5) watchedSeconds += value
    },
    flush() {
      clearInterval(timer)
      send(true)
    },
  }
}
```

- [ ] **Step 2: Player**

`src/app/v/[subdomain]/video-player.tsx`:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import type { PublicVideo } from '@/features/public/build-catalog'
import { createUsageReporter } from './usage-reporter'

// hls.js só é importado aqui, e este componente só monta quando a mídia de vídeo
// está visível (spec 6.3). Ao desmontar: pausa, destrói e envia o consumo.
export function VideoPlayer({
  video,
  autoPlay = true,
  controls = false,
  showSoundToggle = true,
  className = '',
}: {
  video: PublicVideo
  autoPlay?: boolean
  controls?: boolean
  showSoundToggle?: boolean
  className?: string
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const [muted, setMuted] = useState(true)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const reporter = createUsageReporter(video.mediaId)
    let destroyHls: (() => void) | null = null
    let cancelled = false
    let lastTime = 0

    const onTimeUpdate = () => {
      const delta = element.currentTime - lastTime
      lastTime = element.currentTime
      reporter.addSeconds(delta)
    }

    if (element.canPlayType('application/vnd.apple.mpegurl')) {
      element.src = video.playlistUrl
      element.addEventListener('timeupdate', onTimeUpdate)
      if (autoPlay) element.play().catch(() => undefined)
    } else {
      void import('hls.js').then(({ default: Hls }) => {
        if (cancelled) return
        // Sem suporte a MSE nem HLS nativo: fica o poster do próprio <video>.
        if (!Hls.isSupported()) return
        const hls = new Hls({ capLevelToPlayerSize: true, maxBufferLength: 20 })
        hls.on(Hls.Events.FRAG_LOADED, (_event, data) => {
          const stats = data.frag.stats as { total?: number; loaded?: number }
          reporter.addBytes(stats.total || stats.loaded || 0)
        })
        hls.on(Hls.Events.ERROR, (_event, data) => {
          // Erro fatal (rede, CDN): para o download e mantém o poster.
          if (data.fatal) hls.destroy()
        })
        hls.loadSource(video.playlistUrl)
        hls.attachMedia(element)
        if (autoPlay) element.play().catch(() => undefined)
        destroyHls = () => hls.destroy()
      })
    }

    return () => {
      cancelled = true
      element.removeEventListener('timeupdate', onTimeUpdate)
      element.pause()
      destroyHls?.()
      element.removeAttribute('src')
      element.load()
      reporter.flush()
    }
  }, [video.mediaId, video.playlistUrl, autoPlay])

  return (
    <div className="relative">
      <video
        ref={ref}
        data-media-id={video.mediaId}
        poster={video.posterUrl ?? undefined}
        muted={muted}
        loop
        playsInline
        controls={controls}
        className={className}
      />
      {showSoundToggle ? (
        <button
          type="button"
          onClick={() => {
            const next = !muted
            setMuted(next)
            if (ref.current) ref.current.muted = next
          }}
          className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1.5 text-sm text-white"
        >
          {muted ? 'Ativar som' : 'Desativar som'}
        </button>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 3: Banner**

`src/app/v/[subdomain]/banner-video.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import type { PublicVideo } from '@/features/public/build-catalog'
import { VideoPlayer } from './video-player'

// Spec 6.3: poster primeiro; o vídeo só começa depois do carregamento da página.
// Com Save-Data ou prefers-reduced-motion, fica só o poster.
export function BannerVideo({ video }: { video: PublicVideo }) {
  const [play, setPlay] = useState(false)

  useEffect(() => {
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (saveData || reducedMotion) return
    const start = () => setPlay(true)
    if (document.readyState === 'complete') {
      const timer = setTimeout(start, 0)
      return () => clearTimeout(timer)
    }
    window.addEventListener('load', start, { once: true })
    return () => window.removeEventListener('load', start)
  }, [])

  const className = 'aspect-video w-full rounded-card object-cover'
  if (!play) {
    // eslint-disable-next-line @next/next/no-img-element
    return video.posterUrl ? <img src={video.posterUrl} alt="" fetchPriority="high" className={className} /> : null
  }
  return <VideoPlayer video={video} showSoundToggle={false} className={className} />
}
```

Em `catalog.tsx`, onde o banner é desenhado:

```tsx
      {vitrine.bannerVideo ? (
        <div className="mx-auto mt-4 max-w-5xl px-4">
          <BannerVideo video={vitrine.bannerVideo} />
        </div>
      ) : vitrine.banner ? (
        /* bloco do banner em imagem que já existe */
      ) : null}
```

`BannerVideo` pode ser importado direto: ele não importa hls.js no topo (só `VideoPlayer`, que faz `import('hls.js')` dentro do efeito).

- [ ] **Step 4: Carrossel da tela do item**

Em `item-sheet.tsx`:
- as mídias do carrossel passam a ser `[...(item.video ? [{ kind: 'video' as const, video: item.video }] : []), ...images.map((image) => ({ kind: 'image' as const, image }))]`, com o vídeo primeiro (spec 6.3);
- guarde `activeIndex` num estado atualizado por `onScroll` do carrossel: `setActiveIndex(Math.round(el.scrollLeft / el.clientWidth))`;
- slide de vídeo: `activeIndex === 0` → `<VideoPlayer video={item.video} className="aspect-[4/5] w-full object-cover md:aspect-auto" />`; senão, a capa (`item.video.posterUrl`) como `<img>`. Assim, trocar de mídia desmonta o player (pausa e destrói);
- fechar a tela já desmonta tudo.

- [ ] **Step 5: e2e da vitrine**

`e2e/videos-public.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { createAdminClient, createConfirmedUser, seedItem, seedVideo, seedVitrine, setPlan } from './helpers'

const vitrineUrl = (subdomain: string) => `http://${subdomain}.localhost:3000/`

test('vídeo só aparece ao abrir o item; gratuito mostra só o primeiro', async ({ page }) => {
  const user = await createConfirmedUser('video-publico')
  await setPlan(user.id, 'pro')
  const vitrine = await seedVitrine(user.id)
  const first = await seedItem(vitrine, user.id, { name: 'Primeiro', priceCents: 1000 })
  const second = await seedItem(vitrine, user.id, { name: 'Segundo', priceCents: 1000 })
  const firstVideo = await seedVideo(vitrine, user.id, first.id)
  await seedVideo(vitrine, user.id, second.id)
  await setPlan(user.id, 'free')

  await page.goto(vitrineUrl(vitrine.subdomain))
  await expect(page.locator('video')).toHaveCount(0)

  await page.getByRole('button', { name: 'Primeiro' }).click()
  const dialog = page.getByRole('dialog', { name: 'Primeiro' })
  await expect(dialog.locator(`video[data-media-id="${firstVideo.id}"]`)).toHaveCount(1)
  await dialog.getByRole('button', { name: 'Fechar' }).click()
  await expect(page.locator('video')).toHaveCount(0)

  await page.getByRole('button', { name: 'Segundo' }).click()
  await expect(page.getByRole('dialog', { name: 'Segundo' }).locator('video')).toHaveCount(0)
})

test('relatório de consumo soma bytes e franquia estourada esconde os vídeos', async ({ page, request }) => {
  const user = await createConfirmedUser('video-franquia')
  const vitrine = await seedVitrine(user.id)
  const item = await seedItem(vitrine, user.id, { name: 'Com vídeo', priceCents: 1000 })
  const video = await seedVideo(vitrine, user.id, item.id)
  const admin = createAdminClient()

  const small = await request.post(`${vitrineUrl(vitrine.subdomain)}api/video-usage`, {
    data: { mediaId: video.id, bytes: 1000, seconds: 5 },
  })
  expect(small.status()).toBe(204)
  const { data: usage } = await admin.from('video_usage_monthly').select('bytes_delivered, over_quota').eq('user_id', user.id).single().throwOnError()
  expect(Number(usage.bytes_delivered)).toBe(1000)

  await page.goto(vitrineUrl(vitrine.subdomain))
  await page.getByRole('button', { name: 'Com vídeo' }).click()
  await expect(page.getByRole('dialog', { name: 'Com vídeo' }).locator('video')).toHaveCount(1)

  // Quase no limite: o próximo relatório estoura e revalida a vitrine.
  await admin
    .from('video_usage_monthly')
    .update({ bytes_delivered: 1024 * 1024 ** 3 - 10 })
    .eq('user_id', user.id)
    .throwOnError()
  const crossing = await request.post(`${vitrineUrl(vitrine.subdomain)}api/video-usage`, {
    data: { mediaId: video.id, bytes: 1000, seconds: 5 },
  })
  expect(crossing.status()).toBe(204)

  await page.goto(vitrineUrl(vitrine.subdomain))
  await page.getByRole('button', { name: 'Com vídeo' }).click()
  await expect(page.getByRole('dialog', { name: 'Com vídeo' }).locator('video')).toHaveCount(0)
})

test('relatório de outro host é ignorado', async ({ request }) => {
  const user = await createConfirmedUser('video-host')
  const vitrine = await seedVitrine(user.id)
  const other = await seedVitrine((await createConfirmedUser('video-host-2')).id)
  const item = await seedItem(vitrine, user.id, { name: 'X', priceCents: 1000 })
  const video = await seedVideo(vitrine, user.id, item.id)

  const response = await request.post(`${vitrineUrl(other.subdomain)}api/video-usage`, {
    data: { mediaId: video.id, bytes: 1000, seconds: 5 },
  })
  expect(response.status()).toBe(204)
  const { data } = await createAdminClient().from('video_usage_monthly').select('user_id').eq('user_id', user.id)
  expect(data).toEqual([])
})
```

- [ ] **Step 6: Commit, PR e merge do bloco**

```bash
npm run lint && npm run typecheck && npm test
git add -A src e2e
git commit -m "feat(vitrine): player HLS sob demanda com medição de consumo, carrossel com vídeo e banner em vídeo"
git push -u origin HEAD
gh pr create --fill --base master
gh pr checks --watch
```

Conferir no log do build que `/v/[subdomain]` continua `●` (SSG/ISR).

**Fim do Bloco 5:** autorização → merge. Conferência na nuvem (celular com 4G): abrir a vitrine; a listagem não baixa vídeo (DevTools → Network sem `.m3u8` até abrir o item); abrir o item com vídeo toca sem som, em loop, com "Ativar som"; fechar para o download; no Safari/iPhone toca pelo HLS nativo; no Supabase dev, `video_usage_monthly` do dono ganha bytes depois de alguns segundos.

---

# Bloco 6 — E-mail de franquia estourada (Resend)

Branch: `fase-3/bloco-6-email`.

**Antes do merge (usuário), no Resend e no Cloudflare:**
1. Criar conta em resend.com (se ainda não existir).
2. **Domains → Add Domain**: `agenn.com.br`, região **São Paulo (sa-east-1)**.
3. O Resend mostra os registros DNS (DKIM em `resend._domainkey`, MX e TXT de SPF no subdomínio `send`). Criá-los no **Cloudflare → DNS** exatamente como aparecem, com **Proxy status: DNS only** (nuvem cinza). Voltar ao Resend e clicar **Verify**; esperar o status **Verified**.
4. **API Keys → Create API Key**: nome `agenn-vitrine-producao`, permissão **Sending access**, domínio `agenn.com.br`. Copiar a chave (começa com `re_`; só aparece uma vez).
5. Na Vercel (`agenn-vitrine-v1`, **Production**):

| Key | Value | Type |
|---|---|---|
| `EMAIL_DRIVER` | `resend` | Config |
| `RESEND_API_KEY` | chave `re_…` | **Secret** |
| `EMAIL_FROM` | `Agenn Vitrine <nao-responda@agenn.com.br>` | Config |

6. (Recomendado, aproveitando o domínio verificado) Fazer a pendência da Fase 1: **Supabase → Authentication → SMTP** com o SMTP do Resend (host `smtp.resend.com`, porta `465`, usuário `resend`, senha = uma API key do Resend, remetente `nao-responda@agenn.com.br`). Assim os e-mails de cadastro deixam de ir só para a equipe.

### Task 13: Mensagem e envio do e-mail de franquia

**Files:**
- Create: `src/lib/email/quota-email.ts`, `src/lib/email/quota-email.test.ts`, `src/lib/email/send-email.ts`, `src/features/videos/notify-quota.ts`
- Modify: `src/lib/server-env-schema.ts` (+ test), `src/lib/server-env.ts`, `src/app/api/video-usage/route.ts`, `.github/workflows/ci.yml`, `.env.example`, `docs/setup/fase-3-infra.md`, `e2e/helpers.ts`, `e2e/videos-public.spec.ts`

**Interfaces:**
- Produces:
  - `videoMonthKey(now: Date): string` → `'AAAA-MM'` no fuso de São Paulo
  - `nextMonthStartLabel(now: Date): string` → ex.: `'1º de outubro'`
  - `buildQuotaEmail(input: { ownerName: string; vitrineNames: string[]; quotaGb: number; now: Date; panelUrl: string }): { subject: string; text: string; html: string }`
  - `type EmailEnv = { driver: 'off' } | { driver: 'fake' } | { driver: 'resend'; apiKey: string; from: string }`, `parseEmailEnv(source)`, `getEmailEnv()`
  - `sendEmail(message: { to: string; subject: string; text: string; html: string; idempotencyKey?: string }): Promise<void>`
  - `notifyVideoQuotaExceeded(admin: SupabaseClient<Database>, ownerId: string): Promise<void>`
  - e2e: `readFakeEmails(to: string): Promise<{ to: string; subject: string; text: string }[]>`
- Textos exatos: assunto `A franquia de vídeo deste mês acabou`.

- [ ] **Step 1: Testes (falhando)**

`src/lib/email/quota-email.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildQuotaEmail, nextMonthStartLabel, videoMonthKey } from './quota-email'

describe('datas no fuso de São Paulo', () => {
  it('mês da franquia', () => {
    expect(videoMonthKey(new Date('2026-09-17T12:00:00Z'))).toBe('2026-09')
    // 1º de outubro, 01:00 UTC = 30 de setembro, 22:00 em São Paulo
    expect(videoMonthKey(new Date('2026-10-01T01:00:00Z'))).toBe('2026-09')
  })

  it('início do próximo mês por extenso', () => {
    expect(nextMonthStartLabel(new Date('2026-09-17T12:00:00Z'))).toBe('1º de outubro')
    expect(nextMonthStartLabel(new Date('2026-12-20T12:00:00Z'))).toBe('1º de janeiro')
  })
})

describe('buildQuotaEmail', () => {
  const base = {
    ownerName: 'Ana',
    vitrineNames: ['Loja da Ana'],
    quotaGb: 1024,
    now: new Date('2026-09-17T12:00:00Z'),
    panelUrl: 'https://app.agenn.com.br/painel',
  }

  it('monta assunto e texto', () => {
    const email = buildQuotaEmail(base)
    expect(email.subject).toBe('A franquia de vídeo deste mês acabou')
    expect(email.text).toBe(
      [
        'Olá, Ana!',
        '',
        'A franquia de vídeo deste mês (1024 GB) foi usada por completo.',
        '',
        'Até 1º de outubro, os itens de Loja da Ana mostram só as fotos. Os vídeos voltam sozinhos no próximo mês e nada foi apagado.',
        '',
        'Acompanhe o consumo em: https://app.agenn.com.br/painel',
        '',
        'Equipe Agenn Vitrine',
      ].join('\n'),
    )
  })

  it('várias vitrines, nome vazio e HTML escapado', () => {
    const email = buildQuotaEmail({ ...base, ownerName: '', vitrineNames: ['A', 'B <b>', 'C'] })
    expect(email.text.startsWith('Olá!')).toBe(true)
    expect(email.text).toContain('os itens de A, B <b> e C mostram')
    expect(email.html).toContain('A, B &lt;b&gt; e C')
    expect(email.html).toContain('<a href="https://app.agenn.com.br/painel">')
  })
})
```

Acrescente em `src/lib/server-env-schema.test.ts`:

```ts
import { parseEmailEnv } from './server-env-schema'

describe('parseEmailEnv', () => {
  it('desligado por padrão', () => {
    expect(parseEmailEnv({})).toEqual({ driver: 'off' })
  })

  it('resend exige chave e remetente', () => {
    expect(() => parseEmailEnv({ EMAIL_DRIVER: 'resend' })).toThrow(/RESEND_API_KEY/)
    expect(
      parseEmailEnv({ EMAIL_DRIVER: 'resend', RESEND_API_KEY: 're_x', EMAIL_FROM: 'Agenn Vitrine <nao-responda@agenn.com.br>' }),
    ).toEqual({ driver: 'resend', apiKey: 're_x', from: 'Agenn Vitrine <nao-responda@agenn.com.br>' })
  })

  it('fake só fora de produção', () => {
    expect(parseEmailEnv({ EMAIL_DRIVER: 'fake' })).toEqual({ driver: 'fake' })
    expect(() => parseEmailEnv({ EMAIL_DRIVER: 'fake', VERCEL_ENV: 'production' })).toThrow(/produção/)
  })
})
```

Run: `npm test -- src/lib/email src/lib/server-env-schema.test.ts` → FAIL.

- [ ] **Step 2: Mensagem**

`src/lib/email/quota-email.ts`:

```ts
const TIME_ZONE = 'America/Sao_Paulo'

function yearMonth(now: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, year: 'numeric', month: 'numeric' }).formatToParts(now)
  return {
    year: Number(parts.find((part) => part.type === 'year')!.value),
    month: Number(parts.find((part) => part.type === 'month')!.value),
  }
}

export function videoMonthKey(now: Date): string {
  const { year, month } = yearMonth(now)
  return `${year}-${String(month).padStart(2, '0')}`
}

export function nextMonthStartLabel(now: Date): string {
  const { year, month } = yearMonth(now)
  const next = new Date(Date.UTC(month === 12 ? year + 1 : year, month % 12, 15))
  const name = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', month: 'long' }).format(next)
  return `1º de ${name}`
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? 'suas vitrines'
  return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function buildQuotaEmail(input: {
  ownerName: string
  vitrineNames: string[]
  quotaGb: number
  now: Date
  panelUrl: string
}): { subject: string; text: string; html: string } {
  const greeting = input.ownerName.trim() ? `Olá, ${input.ownerName.trim()}!` : 'Olá!'
  const until = nextMonthStartLabel(input.now)
  const vitrines = listNames(input.vitrineNames)
  const paragraphs = [
    greeting,
    `A franquia de vídeo deste mês (${input.quotaGb} GB) foi usada por completo.`,
    `Até ${until}, os itens de ${vitrines} mostram só as fotos. Os vídeos voltam sozinhos no próximo mês e nada foi apagado.`,
    `Acompanhe o consumo em: ${input.panelUrl}`,
    'Equipe Agenn Vitrine',
  ]

  const html = [
    `<p>${escapeHtml(greeting)}</p>`,
    `<p>${escapeHtml(paragraphs[1])}</p>`,
    `<p>${escapeHtml(paragraphs[2])}</p>`,
    `<p>Acompanhe o consumo em: <a href="${escapeHtml(input.panelUrl)}">${escapeHtml(input.panelUrl)}</a></p>`,
    '<p>Equipe Agenn Vitrine</p>',
  ].join('\n')

  return { subject: 'A franquia de vídeo deste mês acabou', text: paragraphs.join('\n\n'), html }
}
```

- [ ] **Step 3: Variáveis e envio**

Em `src/lib/server-env-schema.ts`:

```ts
const emailSchema = z
  .object({
    EMAIL_DRIVER: z.enum(['off', 'fake', 'resend']).default('off'),
    RESEND_API_KEY: z.string().default(''),
    EMAIL_FROM: z.string().default(''),
    VERCEL_ENV: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.EMAIL_DRIVER === 'resend' && (!value.RESEND_API_KEY || !value.EMAIL_FROM)) {
      ctx.addIssue({ code: 'custom', message: 'RESEND_API_KEY e EMAIL_FROM são obrigatórias com EMAIL_DRIVER=resend.' })
    }
    if (value.EMAIL_DRIVER === 'fake' && value.VERCEL_ENV === 'production') {
      ctx.addIssue({ code: 'custom', message: 'EMAIL_DRIVER=fake não pode ser usado em produção.' })
    }
  })

export type EmailEnv = { driver: 'off' } | { driver: 'fake' } | { driver: 'resend'; apiKey: string; from: string }

export function parseEmailEnv(source: Source): EmailEnv {
  const value = emailSchema.parse(source)
  if (value.EMAIL_DRIVER === 'resend') return { driver: 'resend', apiKey: value.RESEND_API_KEY, from: value.EMAIL_FROM }
  return { driver: value.EMAIL_DRIVER }
}
```

Em `src/lib/server-env.ts`: `export const getEmailEnv = () => parseEmailEnv(process.env)` (ampliando o import).

`src/lib/email/send-email.ts`:

```ts
import 'server-only'
import { mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { getEmailEnv } from '@/lib/server-env'

export type EmailMessage = { to: string; subject: string; text: string; html: string; idempotencyKey?: string }

// Só CI e desenvolvimento: e-mails viram arquivos JSON para os testes lerem.
const FAKE_EMAIL_DIR = path.join(os.tmpdir(), 'agenn-vitrine-email')

export async function sendEmail(message: EmailMessage): Promise<void> {
  const config = getEmailEnv()
  if (config.driver === 'off') return

  if (config.driver === 'fake') {
    await mkdir(FAKE_EMAIL_DIR, { recursive: true })
    await writeFile(
      path.join(FAKE_EMAIL_DIR, `${Date.now()}-${crypto.randomUUID()}.json`),
      JSON.stringify({ to: message.to, subject: message.subject, text: message.text }),
    )
    return
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      ...(message.idempotencyKey ? { 'Idempotency-Key': message.idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from: config.from,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
  })
  if (!response.ok) throw new Error(`Resend ${response.status}: ${await response.text()}`)
}
```

`src/features/videos/notify-quota.ts`:

```ts
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildQuotaEmail, videoMonthKey } from '@/lib/email/quota-email'
import { sendEmail } from '@/lib/email/send-email'
import { env } from '@/lib/env'
import { buildAppUrl } from '@/lib/hosts/urls'
import type { Database } from '@/lib/supabase/database.types'

// Spec 3: ao passar da franquia, o dono é avisado no painel e por e-mail.
// Chamado só quando add_video_usage informa que a franquia acabou de estourar (uma vez por mês).
export async function notifyVideoQuotaExceeded(admin: SupabaseClient<Database>, ownerId: string): Promise<void> {
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(ownerId)
  if (userError) throw userError
  const email = userData.user?.email
  if (!email) return

  const [{ data: profile }, { data: vitrines }, { data: planId }] = await Promise.all([
    admin.from('profiles').select('name').eq('id', ownerId).maybeSingle(),
    admin.from('vitrines').select('name').eq('owner_id', ownerId).order('position').order('created_at'),
    admin.rpc('effective_plan_id', { p_user_id: ownerId }),
  ])
  const { data: plan } = await admin.from('plans').select('monthly_video_gb').eq('id', planId ?? 'free').single()

  const now = new Date()
  const message = buildQuotaEmail({
    ownerName: profile?.name ?? '',
    vitrineNames: (vitrines ?? []).map((vitrine) => vitrine.name),
    quotaGb: plan?.monthly_video_gb ?? 1024,
    now,
    panelUrl: buildAppUrl('/painel', env.NEXT_PUBLIC_ROOT_DOMAIN),
  })
  await sendEmail({ to: email, ...message, idempotencyKey: `video-quota-${ownerId}-${videoMonthKey(now)}` })
}
```

- [ ] **Step 4: Disparo sem atrasar a vitrine**

Leia antes `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md`.

Em `src/app/api/video-usage/route.ts`, troque o import `import { NextResponse, type NextRequest } from 'next/server'` por `import { after, NextResponse, type NextRequest } from 'next/server'`, importe `notifyVideoQuotaExceeded` de `@/features/videos/notify-quota` e, dentro do `if (result?.crossed_quota)`, depois do `revalidateVitrine(...)`:

```ts
      const ownerId = result.usage_owner_id
      after(async () => {
        try {
          await notifyVideoQuotaExceeded(admin, ownerId)
        } catch (error) {
          Sentry.captureException(error)
        }
      })
```

- [ ] **Step 5: CI e documentação**

- `.github/workflows/ci.yml`, job `e2e`, em `env:`: `EMAIL_DRIVER: fake`.
- `.env.example`, ao fim:

```bash
# E-mails do sistema: off (padrão), fake (CI/local, grava em disco) ou resend
EMAIL_DRIVER=off
RESEND_API_KEY=
EMAIL_FROM=Agenn Vitrine <nao-responda@agenn.com.br>
```

- `docs/setup/fase-3-infra.md`: nova seção **Resend (e-mail de franquia)** com os 6 passos do início deste bloco e a tabela de variáveis.

- [ ] **Step 6: e2e**

Acrescente em `e2e/helpers.ts` (juntando os imports aos existentes; `path` já foi importado no Bloco 4):

```ts
import { readdir, readFile } from 'node:fs/promises'
import os from 'node:os'

export async function readFakeEmails(to: string) {
  const dir = path.join(os.tmpdir(), 'agenn-vitrine-email')
  const files = await readdir(dir).catch(() => [] as string[])
  const emails = await Promise.all(
    files.map(async (file) => JSON.parse(await readFile(path.join(dir, file), 'utf8')) as { to: string; subject: string; text: string }),
  )
  return emails.filter((email) => email.to === to)
}
```

Em `e2e/videos-public.spec.ts`, no teste "relatório de consumo soma bytes e franquia estourada esconde os vídeos", depois de `expect(crossing.status()).toBe(204)`:

```ts
  await expect
    .poll(async () => (await readFakeEmails(user.email)).map((email) => email.subject), { timeout: 10_000 })
    .toEqual(['A franquia de vídeo deste mês acabou'])
```

e acrescente `readFakeEmails` ao import.

- [ ] **Step 7: Commit, PR e merge do bloco**

```bash
npm run lint && npm run typecheck && npm test
git add -A src e2e .github .env.example docs
git commit -m "feat(email): aviso por e-mail quando a franquia de vídeo estoura (Resend, sem atrasar a vitrine)"
git push -u origin HEAD
gh pr create --fill --base master
gh pr checks --watch
```

**Fim do Bloco 6:** domínio verificado no Resend e variáveis na Vercel (Production) → autorização → merge. Conferência na nuvem: com uma conta de teste, no Supabase dev, pôr `video_usage_monthly.bytes_delivered` do mês em `1099511627000` para o dono; abrir um item com vídeo na vitrine pelo celular por alguns segundos; o e-mail "A franquia de vídeo deste mês acabou" chega (conferir também em **Resend → Emails**) e a vitrine passa a mostrar só as fotos. Depois, voltar o valor para `0` e `over_quota` para `false`.

---

# Bloco 7 — Tarefas diárias (Vercel Cron)

Branch: `fase-3/bloco-7-cron`.

### Task 14: Rota diária

**Files:**
- Create: `src/app/api/cron/diaria/route.ts`, `e2e/cron.spec.ts`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: `media_cleanup_candidates`, `cleanup_expired_rows`, `subdomains_over_quota_last_month`, `deleteMediaRows`, `revalidateVitrine`, `getCronSecret`
- Produces: `GET /api/cron/diaria` com `Authorization: Bearer <CRON_SECRET>` → `200 { media, orders, rateLimits, revalidated }` | `401` | `503`

- [ ] **Step 1: Rota**

`src/app/api/cron/diaria/route.ts`:

```ts
import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'
import { deleteMediaRows } from '@/lib/media/remove-media'
import { getCronSecret } from '@/lib/server-env'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { revalidateVitrine } from '@/lib/vitrines/cache'

const BATCH = 100

// Spec 6.4 (parte sem Stripe): mídias órfãs e falhas, pedidos expirados, limites antigos
// e revalidação das vitrines de quem estourou a franquia no mês anterior.
export async function GET(request: Request) {
  let secret: string
  try {
    secret = getCronSecret()
  } catch (error) {
    Sentry.captureException(error)
    return NextResponse.json({ error: 'Cron indisponível.' }, { status: 503 })
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  try {
    const admin = createSupabaseAdminClient()

    const { data: candidates, error: candidatesError } = await admin.rpc('media_cleanup_candidates')
    if (candidatesError) throw candidatesError
    const rows = candidates ?? []
    for (let start = 0; start < rows.length; start += BATCH) {
      await deleteMediaRows(admin, rows.slice(start, start + BATCH))
    }

    const { data: expired, error: expiredError } = await admin.rpc('cleanup_expired_rows')
    if (expiredError) throw expiredError

    const { data: subdomains, error: subdomainsError } = await admin.rpc('subdomains_over_quota_last_month')
    if (subdomainsError) throw subdomainsError
    revalidateVitrine(...(subdomains ?? []))

    return NextResponse.json({
      media: rows.length,
      orders: expired?.[0]?.orders_deleted ?? 0,
      rateLimits: expired?.[0]?.rate_limits_deleted ?? 0,
      revalidated: subdomains?.length ?? 0,
    })
  } catch (error) {
    Sentry.captureException(error)
    return NextResponse.json({ error: 'Falha na tarefa diária.' }, { status: 500 })
  }
}
```

Se o tipo gerado de `subdomains_over_quota_last_month` vier como `string[]`, o spread funciona direto; se vier como `{ subdomains_over_quota_last_month: string }[]`, mapeie para o campo antes do spread.

- [ ] **Step 2: Agendamento**

`vercel.json`:

```json
{
  "regions": ["gru1"],
  "crons": [{ "path": "/api/cron/diaria", "schedule": "0 7 * * *" }]
}
```

(07:00 UTC = 04:00 em São Paulo.)

- [ ] **Step 3: e2e**

`e2e/cron.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { APP_URL } from '../playwright.config'
import { createAdminClient, createConfirmedUser, seedVitrine } from './helpers'

const secret = process.env.CRON_SECRET ?? 'ci-cron-secret-somente-para-testes'

test('tarefa diária exige o segredo e apaga envios órfãos antigos', async ({ request }) => {
  const unauthorized = await request.get(`${APP_URL}/api/cron/diaria`)
  expect(unauthorized.status()).toBe(401)

  const user = await createConfirmedUser('cron')
  const vitrine = await seedVitrine(user.id)
  const admin = createAdminClient()
  const { data: orphan } = await admin
    .from('media')
    .insert({
      owner_id: user.id,
      vitrine_id: vitrine.id,
      item_id: null,
      role: 'cover',
      kind: 'image',
      storage_paths: { '480': `${user.id}/${vitrine.id}/orfa-480.webp` },
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select('id')
    .single()
    .throwOnError()
  const { data: recent } = await admin
    .from('media')
    .insert({
      owner_id: user.id,
      vitrine_id: vitrine.id,
      item_id: null,
      role: 'cover',
      kind: 'image',
      storage_paths: { '480': `${user.id}/${vitrine.id}/recente-480.webp` },
    })
    .select('id')
    .single()
    .throwOnError()

  const response = await request.get(`${APP_URL}/api/cron/diaria`, { headers: { authorization: `Bearer ${secret}` } })
  expect(response.status()).toBe(200)
  const body = await response.json()
  expect(body.media).toBeGreaterThanOrEqual(1)

  const { data: remaining } = await admin.from('media').select('id').in('id', [orphan.id, recent.id])
  expect((remaining ?? []).map((row) => row.id)).toEqual([recent.id])
})
```

Os testes rodam em série (`workers: 1`) e outros testes podem deixar envios recentes; por isso só o órfão antigo é afirmado.

- [ ] **Step 4: Commit, PR e merge do bloco**

```bash
npm run lint && npm run typecheck && npm test
git add -A src e2e vercel.json
git commit -m "feat(cron): tarefa diária de limpeza de mídias, pedidos e limites, e revalidação na virada da franquia"
git push -u origin HEAD
gh pr create --fill --base master
gh pr checks --watch
```

**Fim do Bloco 7:** confirmar `CRON_SECRET` na Vercel (Production) → autorização → merge. Conferência na nuvem: **Vercel → Settings → Cron Jobs** lista `/api/cron/diaria`; o botão **Run** executa e o log mostra `200` com o resumo. A pasta órfã antiga do Bunny Storage (`56561127-…`) não tem linha no banco: apagar à mão.

---

# Bloco 8 — Fechamento

Branch: `fase-3/bloco-8-fechamento`.

### Task 15: Fluxo completo com vídeo, guia e conferência

**Files:**
- Modify: `e2e/fluxo-completo.spec.ts`, `docs/setup/fase-3-infra.md`, `README.md`

- [ ] **Step 1: Fluxo completo com vídeo**

Em `e2e/fluxo-completo.spec.ts`, depois de salvar o item e antes de abrir a vitrine pública, acrescente o vídeo ao item (conta gratuita, 1 vídeo permitido):

```ts
  await page.getByRole('link', { name: 'Editar' }).click()
  await page.getByLabel('Vídeo', { exact: true }).setInputFiles(videoFixture('vertical-3s'))
  await expect(page.getByText('Processando o vídeo…')).toBeVisible({ timeout: 20_000 })
  const itemId = page.url().split('/').pop()!
  const media = await mediaOfItem(itemId)
  await sendBunnyWebhook(request, media!.bunny_video_id!)
  await expect(page.getByText('Vídeo pronto')).toBeVisible({ timeout: 15_000 })
```

e, depois de abrir a tela do item na vitrine pública, antes de clicar no botão:

```ts
  await expect(page.getByRole('dialog', { name: 'X-Bacon' }).locator(`video[data-media-id="${media!.id}"]`)).toHaveCount(1)
```

Inclua `request` nos parâmetros do teste e os imports `mediaOfItem`, `sendBunnyWebhook`, `videoFixture`.

- [ ] **Step 2: Guia e README**

Em `docs/setup/fase-3-infra.md`, acrescente:
- **6. Conferência em produção:**
  1. Enviar um vídeo vertical de celular (até 60 s) num item: ver progresso, "Processando o vídeo…" e "Vídeo pronto".
  2. Derrubar o Wi-Fi no meio de um envio grande e religar: aparece "Conexão caiu, retomando…" e o envio continua.
  3. Tentar um vídeo de 70 s: recusado antes do envio com o motivo.
  4. Na vitrine pelo celular (4G): listagem sem vídeo; abrir o item toca sem som em loop; "Ativar som"; fechar interrompe o download.
  5. No iPhone (Safari): o vídeo toca pelo HLS nativo.
  6. Conta Pro: banner em vídeo horizontal; com "Reduzir movimento" ligado no sistema, fica só a imagem.
  7. No Supabase dev, `video_usage_monthly` do dono soma bytes; em Minhas vitrines, "Franquia do mês" mostra o valor.
  8. Excluir o item com vídeo: o vídeo some da biblioteca do Bunny Stream.
  9. Vercel → Cron Jobs → Run: resposta `200`.
  10. E-mail de franquia: seguir a conferência do fim do Bloco 6 (chega o e-mail e a vitrine mostra só fotos).
- **7. Pendências registradas:** regra dos 90 dias e conferência do Stripe (Fase 5); duplicar item não copia o vídeo; envio de vídeo abandonado ocupa a vaga do plano até a limpeza diária (até 24 h).

No `README.md`, na seção "Como testar", acrescente: "Os testes de vídeo usam o driver `fake` do Stream e vídeos WebM gerados com ffmpeg no CI (`scripts/make-video-fixtures.mjs`). A reprodução real (HLS do Bunny) é conferida na nuvem."

- [ ] **Step 3: PR e merge**

```bash
npm run lint && npm run typecheck && npm test
git add e2e/fluxo-completo.spec.ts docs/setup/fase-3-infra.md README.md
git commit -m "test(e2e): fluxo completo com vídeo; docs(infra): conferência da Fase 3"
git push -u origin HEAD
gh pr create --fill --base master
gh pr checks --watch
```

Autorização → merge → conferência em produção com o usuário (Step 2) → atualizar a memória (`fase-3-pendencias`).

---

## Cobertura da spec nesta fase

| Spec | Onde |
|---|---|
| 3 — limites de vídeo (quantidade, 60 s, 500 MB) | Tasks 3 (trigger), 4 (validação), 7 (rota), 9 (painel) |
| 3 — franquia 1 TB, só capa ao estourar, aviso no painel e por e-mail | Tasks 3, 10, 11, 9 (painel), 13 (e-mail) |
| 4.1 — `video_usage_monthly` | Task 3 |
| 4.3 — `media` de vídeo (`bunny_video_id`, `duration_seconds`, `aspect`, `status`) | Tasks 3, 7 |
| 4.7 — 1 vídeo visível no gratuito; banner só no Pro | Task 10 |
| 4.8 — trava de vídeos no banco | Task 3 |
| 6.2.1 — recusa antes do envio (60 s, 500 MB, banner horizontal) | Tasks 4, 8 |
| 6.2.2 — rota valida limites e franquia, cria vídeo, assinatura TUS | Tasks 6, 7 |
| 6.2.3 — envio direto retomável com progresso, `processing` | Task 8 |
| 6.2.4 — webhook consulta a API, atualiza status/duração/proporção, revalida | Task 7 |
| 6.2.5 — `failed` + "Tentar novamente" | Tasks 7, 8 |
| 6.2 — configuração da biblioteca | Task 1 |
| 6.3 — listagem sem JS de vídeo; hls.js sob demanda; vídeo primeiro no carrossel; pausa e destrói; banner com poster, Save-Data e movimento reduzido | Tasks 10, 12 |
| 6.4 — limpeza de órfãs/falhas; consumo; pedidos e limites antigos; apagar no Bunny ao apagar | Tasks 3, 6, 11, 14; itens do Stripe → Fase 5 |
| 6.4 — validação da API de estatísticas | Seção "Validação pedida pela spec" |
| 7.1 — revalidar ao terminar o vídeo | Task 7 |
| 8.2 — uso do plano (vídeos e franquia) | Task 9 |
| 8.5 — espaço Vídeo com progresso e status | Tasks 8, 9 |
| 10 — envio interrompido, fora do limite, processamento falhou | Tasks 4, 8 |
| 11 — webhook do Bunny com API simulada | Tasks 7 (driver fake), 9 e 15 (e2e) |

