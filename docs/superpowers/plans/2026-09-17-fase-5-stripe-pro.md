# Fase 5 — Pro com Stripe: Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O dono assina o Pro com cartão pelo Stripe Checkout, gerencia a assinatura no Customer Portal e vê plano, consumo e preços no painel; os webhooks espelham a assinatura em `subscriptions`; ao voltar para o gratuito as vitrines que passam do limite são congeladas (com tela para escolher qual fica), e a tarefa diária confere as assinaturas com o Stripe, avisa no dia 83 e apaga os vídeos excedentes 90 dias depois do fim do Pro.

**Architecture:** Mesmo app Next.js 16 das fases anteriores. A cobrança fica atrás de uma interface (`Billing`) com dois drivers, como mídia, vídeo e e-mail: `stripe` em produção e `fake` no CI (rotas `/api/dev-billing/*` simulam o checkout e o portal e disparam o webhook assinado de verdade). As regras de plano continuam no banco: o webhook grava `subscriptions` pelo cliente admin e chama `sync_vitrine_status`, que congela/descongela as vitrines conforme `effective_plan_id` e devolve os subdomínios para revalidar. O mapeamento de status do Stripe → plano, carência e fim do Pro é função pura testada no Vitest. A regra dos 90 dias e o aviso do dia 83 entram na tarefa diária já existente.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase (Postgres + RLS), Stripe Node SDK 22 (API `2026-08-26.dahlia`), Zod, Vitest, Playwright, pgTAP, GitHub Actions, Resend.

**Spec:** `docs/superpowers/specs/2026-09-16-agenn-vitrine-design.md`. Seções usadas: 3 (limites e preço do Pro), 4.1 (`subscriptions`, `stripe_events`), 4.7 (o que é calculado no gratuito), 4.8 (só o servidor escreve `subscriptions` e `stripe_events`), 6.4 (tarefas diárias: 90 dias, aviso do dia 83, conferência com o Stripe), 7.1 (vitrine congelada), 8.2 (uso do plano), 8.7 (Plano e assinatura), 8.9 (cadeado e selo), 9 (assinatura no Stripe), 10 (webhook perdido, limite de plano), 11 e 12 (Fase 5).

**Base:** Fases 1–4 concluídas (PRs até #27, merge `e83e990`). Planos anteriores em `docs/superpowers/plans/`. Guias em `docs/setup/`.

**O que já existe e não se repete aqui:** as tabelas `plans` e `subscriptions`, `effective_plan_id`, `my_entitlements`, as travas de vitrines/itens/vídeos, a marca d'água, o bloqueio de logo/cor/banner, os 10 itens e 1 vídeo do gratuito e o status `frozen` da vitrine pública já foram feitos nas Fases 1–3. Esta fase liga o dinheiro a eles.

---

## Como trabalhar nesta fase

Igual às Fases 2, 3 e 4:

- Uma branch e um PR por bloco: `fase-5/bloco-N-<nome>`.
- Localmente só `npm run lint`, `npm run typecheck`, `npm test`. pgTAP, tipos do banco, build e Playwright rodam no CI.
- **Rotina de migração:** push → job `db` gera `database-types` (falha esperada no diff) → `gh run download <run-id> --name database-types --dir <scratchpad>/types` → copiar para `src/lib/supabase/database.types.ts` → commit.
- Merge só com CI verde e autorização do usuário. O job `migrate` aplica migrações no Supabase dev.
- `gh` em `C:\Program Files\GitHub CLI\gh.exe` (no bash: `export PATH="$PATH:/c/Program Files/GitHub CLI"`).
- **Passo do usuário nesta fase:** ligar o webhook, o Customer Portal e as retentativas no painel do Stripe e salvar as variáveis na Vercel (Bloco 0, `docs/setup/fase-5-infra.md`). O produto e os dois preços já existem na conta do usuário; o plano só precisa dos ids (`price_...`), que entram como variáveis de ambiente.
- **O Bloco 4 só pode ser mergeado depois** que `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTH` e `STRIPE_PRICE_YEAR` estiverem na Vercel (Production), senão a rota do webhook responde 503 em produção. Até lá o CI usa o driver falso e não depende de nada disso.

**Lições das fases anteriores que valem aqui:**
- Joins do PostgREST entre `media` e `vitrines` precisam da dica `vitrines!media_vitrine_id_fkey(...)`; sempre conferir o `error` das consultas.
- `getByLabel` do Playwright casa por trecho: use `{ exact: true }` quando um rótulo é começo de outro.
- Depois de um clique que navega para fora (checkout, portal), `await page.waitForURL(...)` antes do próximo `page.goto`.
- Tipos gerados exigem colunas preenchidas por trigger: converter com comentário.
- Trechos "Acrescente em" do plano não substituem o arquivo inteiro.
- Crases de Markdown nunca dentro de `bash -c`/`node -e` com aspas duplas: usar arquivo de script.

---

## Global Constraints

- **Idioma:** textos visíveis em português do Brasil; identificadores em inglês.
- **Preços (spec 3):** Pro por R$ 149,90/mês ou R$ 1.499/ano, em BRL, **só com cartão**. Os valores vêm dos preços do Stripe (`STRIPE_PRICE_MONTH`, `STRIPE_PRICE_YEAR`), nunca escritos no código.
- **Mapeamento de status (spec 9), exatamente:**

  | Status no Stripe | Resultado |
  |---|---|
  | `active`, `trialing` | Pro |
  | `past_due` | Pro com `grace_until` = primeira falha + 7 dias; depois disso, gratuito |
  | `canceled`, `unpaid`, `incomplete_expired` | Gratuito, com `pro_ended_at = agora` |
  | `incomplete`, `paused` | Gratuito, sem mexer em `pro_ended_at` |

- **Carência:** `grace_until` é gravado **uma vez** (na primeira falha) e mantido nos eventos seguintes enquanto o status continuar `past_due`. `pro_ended_at` também só é gravado uma vez, e volta a `null` quando a conta fica Pro de novo.
- **`plan_id`:** o único plano vendido é o `pro`; a linha de `subscriptions` guarda sempre `plan_id = 'pro'` e quem decide se vale é o `status` + `grace_until` (é assim que `public.effective_plan_id` já funciona desde a Fase 1).
- **Eventos tratados (spec 9):** `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`. Qualquer outro tipo responde `{ ignored: true }` com 200.
- **A cada evento, buscar a assinatura no Stripe** (spec 9) e gravar o que voltou; o corpo do evento só serve para achar o id da assinatura.
- **Idempotência:** um evento já presente em `stripe_events` não é processado de novo. A linha só é gravada **depois** de aplicar a assinatura, para que uma falha (500) seja reprocessada na retentativa do Stripe.
- **API do Stripe 2026-08-26 (SDK 22):** a assinatura **não tem** `current_period_end` no topo — ele vive em `subscription.items.data[0].current_period_end`; a fatura **não tem** `invoice.subscription` — o id vem de `invoice.parent.subscription_details.subscription`.
- **Toda mudança de plano (spec 9):** grava `subscriptions`, chama `sync_vitrine_status` e revalida **todas** as vitrines do dono (a marca d'água, o logo, a cor, os 10 itens e o 1 vídeo do gratuito são calculados na geração da página).
- **Congelamento (spec 4.7 e 8.7):** no gratuito ficam ativas as primeiras `plans.max_vitrines` vitrines na ordem `position, created_at`; as demais viram `frozen`. O dono pode escolher qual fica; sem escolha, fica a mais antiga. Voltando ao Pro, todas voltam a `active`.
- **Regra dos 90 dias (spec 6.4):** contas com `pro_ended_at` há mais de 90 dias perdem os vídeos que passam do limite do gratuito (fica o primeiro na ordem da vitrine). O aviso por e-mail sai no dia 83.
- **Segurança (spec 4.8):** `stripe_events` sem nenhum grant para `anon`/`authenticated`; `subscriptions` continua só de leitura para o dono; funções novas são `security definer` com `revoke` e grant só para quem precisa.
- **Erros (spec 10):** limite de plano nunca vira erro genérico — sempre convite para o Pro (`mapDbError`, já existente); falha ao abrir checkout/portal mostra mensagem em português e vai para o Sentry.
- **Chaves do Stripe nunca no cliente:** todas as chamadas ficam em Server Actions e rotas; nada de `NEXT_PUBLIC_STRIPE_*`.
- **Design:** sem etapas de refinamento visual (fase de design dedicada depois).

---

## Decisões desta fase

| Tema | Decisão | Motivo |
|---|---|---|
| Driver de cobrança | `BILLING_DRIVER=stripe\|fake`, igual a mídia, vídeo e e-mail; `fake` proibido em produção pelo schema de ambiente | O CI não tem chaves do Stripe; o driver falso cobre checkout, portal, webhook e congelamento sem rede. |
| Verificação de assinatura do webhook | Sempre pelo SDK do Stripe (`constructEventAsync`), inclusive com o driver falso | É só criptografia, não precisa de rede; os testes assinam com `stripe.webhooks.generateTestHeaderString`. |
| Stripe CLI | Só na conferência manual em produção (`docs/setup/fase-5-infra.md`), não no CI | Evita deixar o CI dependente da conta e da rede do usuário. |
| Customer | Criado por nós na primeira tentativa de assinatura (`customers.create` com `metadata.user_id`) e guardado em `subscriptions.stripe_customer_id` antes de abrir o checkout | A spec pede `metadata.user_id`; guardando antes, um webhook que chegue primeiro já acha o dono. |
| Dono do evento | `subscription.metadata.user_id`; se faltar, a linha de `subscriptions` com aquele `stripe_customer_id` | Dois caminhos independentes evitam evento órfão. |
| Preços na tela | Buscados no Stripe pelos ids configurados, em cache de 1 h na memória do processo; se a API falhar, a tela mostra os botões sem valor | Reajuste no Stripe aparece sem deploy; sem cache seria uma chamada por visita. |
| `plan_id` da linha | Sempre `'pro'` | Só existe um plano pago; quem decide o plano efetivo é o `status` (função da Fase 1). |
| Congelamento | Feito no banco (`sync_vitrine_status`), nunca no app | Mesma regra vale para webhook, cron e escolha do dono; `vitrines.status` não tem grant de update para o dono. |
| Tela de escolha | Aparece no `/painel/plano` sempre que o dono tem mais vitrines do que o plano permite | Spec 8.7; sem escolha, a mais antiga já ficou ativa. |
| Vídeos apagados aos 90 dias | Só os que passam do limite do gratuito, na ordem que a vitrine mostraria; o primeiro fica | Spec 4.7 e 6.4: o gratuito mostra 1 vídeo, e ele não pode sumir. |
| Itens acima de 10 | Nunca são apagados | Spec 4.7: no gratuito eles só deixam de aparecer; voltando ao Pro reaparecem. |
| Retentativas de cobrança | Configuradas no painel do Stripe (7 dias e depois cancelar) | Spec 9; é ajuste de conta, não de código. |
| Excluir conta | Fica na Fase 6 | Spec 12 coloca "excluir conta" no acabamento; aqui só o que é assinatura. |

---

## Mapa de arquivos

```
supabase/migrations/20260921000000_billing.sql
supabase/tests/database/10_billing.test.sql

.env.example                                      # catálogo das variáveis de cobrança
src/lib/server-env-schema.ts                      # parseBillingEnv (+ test)
src/lib/server-env.ts                             # getBillingEnv
src/lib/dates/format.ts                           # formatDateBR (+ test)
src/lib/billing/types.ts                          # tipos comuns aos dois drivers
src/lib/billing/status.ts                         # status → linha de subscriptions, resumo da tela (+ test)
src/lib/billing/prices.ts                         # cartões de preço e economia do anual (+ test)
src/lib/billing/stripe-events.ts                  # cliente, verificação de assinatura e extração de ids
src/lib/billing/stripe-billing.ts                 # driver de produção
src/lib/billing/fake-billing.ts                   # driver do CI e do desenvolvimento
src/lib/billing/billing.ts                        # interface Billing + getBilling()
src/lib/email/html.ts                             # escapeHtml compartilhado
src/lib/email/quota-email.ts                      # passa a importar escapeHtml
src/lib/email/video-cleanup-email.ts              # aviso do dia 83 (+ test)

src/features/billing/apply-subscription.ts        # grava subscriptions, congela e revalida
src/features/billing/reconcile.ts                 # conferência diária com o Stripe
src/features/billing/video-cleanup.ts             # aviso do dia 83 e limpeza dos 90 dias
src/features/billing/queries.ts                   # assinatura do dono e preços
src/features/billing/actions.ts                   # checkout, portal e escolha da vitrine ativa

src/app/api/webhooks/stripe/route.ts
src/app/api/dev-billing/checkout/route.ts         # só com BILLING_DRIVER=fake
src/app/api/dev-billing/portal/route.ts           # só com BILLING_DRIVER=fake
src/app/api/cron/diaria/route.ts                  # + conferência, aviso e limpeza

src/app/app/(painel)/painel/plano/page.tsx
src/app/app/(painel)/painel/plano/subscribe-form.tsx
src/app/app/(painel)/painel/plano/active-vitrine-form.tsx
src/app/app/(painel)/layout.tsx                   # link "Plano" na navegação
src/app/app/(painel)/painel/page.tsx              # convites apontam para /painel/plano
src/app/app/(painel)/painel/vitrines/nova/page.tsx
src/app/app/(painel)/painel/vitrines/[id]/aparencia/appearance-form.tsx

e2e/helpers.ts                                    # setSubscription, signStripeWebhook, stripeEvent
e2e/billing-webhook.spec.ts
e2e/billing-panel.spec.ts
e2e/cron.spec.ts                                  # + 90 dias e aviso do dia 83
e2e/fluxo-completo.spec.ts                        # assinar → 3 vitrines → cancelar → congelar
docs/setup/fase-5-infra.md
docs/setup/fase-5-conferencia.md
```

---

# Bloco 0 — Base: dependência, variáveis e infraestrutura

Branch: `fase-5/bloco-0-infra`.

### Task 1: Dependência do Stripe, variáveis de ambiente e documento de infraestrutura

**Files:**
- Modify: `package.json`, `.env.example`, `src/lib/server-env-schema.ts`, `src/lib/server-env-schema.test.ts`, `src/lib/server-env.ts`, `.github/workflows/ci.yml`
- Create: `docs/setup/fase-5-infra.md`

**Interfaces:**
- Produces: `parseBillingEnv(source: Record<string, string | undefined>): BillingEnv`, com
  `type BillingEnv = { driver: 'stripe' | 'fake'; secretKey: string; webhookSecret: string; priceMonth: string; priceYear: string }`,
  e `getBillingEnv(): BillingEnv` em `src/lib/server-env.ts`.

- [ ] **Step 1: Instalar o SDK do Stripe**

```bash
npm install stripe@^22.6.2
```

Confira que `package.json` ficou com `"stripe": "^22.6.2"` em `dependencies` e que `package-lock.json` mudou.

- [ ] **Step 2: Teste que falha para as variáveis de cobrança**

Acrescente em `src/lib/server-env-schema.test.ts`:

```ts
describe('parseBillingEnv', () => {
  const stripeEnv = {
    BILLING_DRIVER: 'stripe',
    STRIPE_SECRET_KEY: 'sk_test_123',
    STRIPE_WEBHOOK_SECRET: 'whsec_123456789',
    STRIPE_PRICE_MONTH: 'price_mes',
    STRIPE_PRICE_YEAR: 'price_ano',
  }

  it('lê a configuração do Stripe', () => {
    expect(parseBillingEnv(stripeEnv)).toEqual({
      driver: 'stripe',
      secretKey: 'sk_test_123',
      webhookSecret: 'whsec_123456789',
      priceMonth: 'price_mes',
      priceYear: 'price_ano',
    })
  })

  it('exige chave e preços com o driver stripe', () => {
    expect(() => parseBillingEnv({ ...stripeEnv, STRIPE_PRICE_YEAR: '' })).toThrow()
    expect(() => parseBillingEnv({ ...stripeEnv, STRIPE_SECRET_KEY: '' })).toThrow()
  })

  it('exige o segredo do webhook nos dois drivers', () => {
    expect(() => parseBillingEnv({ ...stripeEnv, STRIPE_WEBHOOK_SECRET: 'curto' })).toThrow()
    expect(() => parseBillingEnv({ BILLING_DRIVER: 'fake' })).toThrow()
  })

  it('aceita o driver falso fora de produção e recusa na Vercel', () => {
    expect(parseBillingEnv({ BILLING_DRIVER: 'fake', STRIPE_WEBHOOK_SECRET: 'whsec_de_teste' }).driver).toBe('fake')
    expect(() =>
      parseBillingEnv({ BILLING_DRIVER: 'fake', STRIPE_WEBHOOK_SECRET: 'whsec_de_teste', VERCEL_ENV: 'production' }),
    ).toThrow()
  })
})
```

Acrescente `parseBillingEnv` ao `import` que já existe no topo do arquivo de teste.

- [ ] **Step 3: Rodar o teste e ver falhar**

Run: `npx vitest run src/lib/server-env-schema.test.ts`
Expected: FAIL com `parseBillingEnv is not a function` (ou erro de importação).

- [ ] **Step 4: Implementar o schema**

Acrescente no fim de `src/lib/server-env-schema.ts`:

```ts
const billingSchema = z
  .object({
    BILLING_DRIVER: z.enum(['stripe', 'fake']).default('stripe'),
    STRIPE_SECRET_KEY: z.string().default(''),
    STRIPE_WEBHOOK_SECRET: z.string().default(''),
    STRIPE_PRICE_MONTH: z.string().default(''),
    STRIPE_PRICE_YEAR: z.string().default(''),
    VERCEL_ENV: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.BILLING_DRIVER === 'stripe' &&
      (!value.STRIPE_SECRET_KEY || !value.STRIPE_PRICE_MONTH || !value.STRIPE_PRICE_YEAR)
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'STRIPE_SECRET_KEY, STRIPE_PRICE_MONTH e STRIPE_PRICE_YEAR são obrigatórias com o driver stripe.',
      })
    }
    // Os dois drivers conferem a assinatura do webhook com o SDK do Stripe.
    if (value.STRIPE_WEBHOOK_SECRET.length < 8) {
      ctx.addIssue({ code: 'custom', message: 'STRIPE_WEBHOOK_SECRET não configurada.' })
    }
    if (value.BILLING_DRIVER === 'fake' && value.VERCEL_ENV === 'production') {
      ctx.addIssue({ code: 'custom', message: 'BILLING_DRIVER=fake não pode ser usado em produção.' })
    }
  })

export type BillingEnv = {
  driver: 'stripe' | 'fake'
  secretKey: string
  webhookSecret: string
  priceMonth: string
  priceYear: string
}

export function parseBillingEnv(source: Source): BillingEnv {
  const value = billingSchema.parse(source)
  return {
    driver: value.BILLING_DRIVER,
    secretKey: value.STRIPE_SECRET_KEY,
    webhookSecret: value.STRIPE_WEBHOOK_SECRET,
    priceMonth: value.STRIPE_PRICE_MONTH,
    priceYear: value.STRIPE_PRICE_YEAR,
  }
}
```

Acrescente em `src/lib/server-env.ts` (no `import` e no fim do arquivo):

```ts
export const getBillingEnv = () => parseBillingEnv(process.env)
```

- [ ] **Step 5: Rodar o teste e ver passar**

Run: `npx vitest run src/lib/server-env-schema.test.ts`
Expected: PASS.

- [ ] **Step 6: Variáveis do CI e do `.env.example`**

Em `.github/workflows/ci.yml`, no bloco `env:` do job `e2e`, acrescente depois de `EMAIL_DRIVER: fake`:

```yaml
      BILLING_DRIVER: fake
      STRIPE_WEBHOOK_SECRET: whsec-ci-somente-para-testes
```

E no fim de `.env.example` (é o catálogo das variáveis do projeto; os valores reais moram
no `.env.local`, que o Git ignora):

```
# Cobrança: stripe (produção) ou fake (CI/local, checkout e portal simulados)
BILLING_DRIVER=fake
STRIPE_SECRET_KEY=
# Segredo de assinatura do endpoint de webhook (whsec_...); obrigatório nos dois drivers
STRIPE_WEBHOOK_SECRET=whsec-local-somente-para-testes
# Ids dos preços do produto Pro no Stripe (price_...)
STRIPE_PRICE_MONTH=
STRIPE_PRICE_YEAR=
```

- [ ] **Step 7: Documento de infraestrutura**

`docs/setup/fase-5-infra.md`:

```markdown
# Fase 5 — Infraestrutura (Stripe)

O produto "Pro" e os dois preços em BRL (mensal e anual) já existem na conta. Falta ligar o
resto. Faça tudo primeiro em **modo de teste** e repita em **modo ao vivo** antes do lançamento —
as chaves, o segredo do webhook e os ids de preço são diferentes nos dois modos.

## 1. Ids dos preços

Painel do Stripe → Catálogo de produtos → Pro → copie os dois ids que começam com `price_`:
um do plano mensal (R$ 149,90) e um do anual (R$ 1.499,00). Confirme que os dois estão em BRL e
são recorrentes.

## 2. Webhook

Painel → Desenvolvedores → Webhooks → Adicionar destino:

- URL: `https://app.agenn.com.br/api/webhooks/stripe`
- Versão da API: a **mais recente** oferecida na lista (nunca anterior a `2025-03-31.basil`)
- Eventos (marcar exatamente estes seis, sem "Selecionar tudo"): `checkout.session.completed`,
  `customer.subscription.created`, `customer.subscription.updated`,
  `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`
- Destino: eventos da própria conta (não "Contas Conectadas")
- Depois de criar, copie o **segredo de assinatura** (`whsec_...`).

## 3. Retentativas e cancelamento (spec 9)

Painel → Configurações → Faturamento → Assinaturas e e-mails → Gerenciar pagamentos malsucedidos:

- Tentar de novo por **7 dias**
- Ao fim das tentativas: **cancelar a assinatura**

## 4. Customer Portal

Painel → Configurações → Faturamento → Portal do cliente:

- Ligar: cancelar assinatura **no fim do período pago**, atualizar forma de pagamento, ver faturas
- Ligar a troca entre os preços mensal e anual do produto Pro
- Desligar: alterar quantidade
- URL de retorno padrão: `https://app.agenn.com.br/painel/plano`

## 5. Variáveis na Vercel (`agenn-vitrine-v1`, Production e Preview)

| Variável | Valor |
|---|---|
| `BILLING_DRIVER` | `stripe` |
| `STRIPE_SECRET_KEY` | `sk_live_...` (Secret) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` (Secret) |
| `STRIPE_PRICE_MONTH` | `price_...` do mensal |
| `STRIPE_PRICE_YEAR` | `price_...` do anual |

`BILLING_DRIVER=fake` é recusado em produção pelo próprio código. Depois de salvar, faça um
Redeploy — as variáveis só valem no próximo deploy.

## 6. Conferência com a Stripe CLI (modo de teste)

Com as variáveis de teste num `.env.local`:

```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
stripe trigger checkout.session.completed
stripe trigger invoice.payment_failed
stripe trigger customer.subscription.deleted
```

Cada evento deve responder 200 e mudar a linha do dono em `subscriptions`. Um evento repetido
responde `{"duplicated":true}`.

## 7. Pendências registradas

- Excluir conta (cancelar a assinatura no Stripe e apagar dados) fica na Fase 6.
- Pix e boleto continuam fora do escopo (spec 13): só cartão.
- Cupons e promoções não estão ligados no checkout.
```

- [ ] **Step 8: Verificação e PR**

```bash
npm run lint && npm run typecheck && npm test
git add package.json package-lock.json .env.example src/lib/server-env-schema.ts src/lib/server-env-schema.test.ts src/lib/server-env.ts .github/workflows/ci.yml docs/setup/fase-5-infra.md
git commit -m "chore(billing): SDK do Stripe, variáveis de cobrança e guia de infraestrutura"
git push -u origin HEAD
gh pr create --fill --base master
gh pr checks --watch
```

Autorização → merge.

---
# Bloco 1 — Banco: eventos, congelamento e regra dos 90 dias

Branch: `fase-5/bloco-1-banco`.

### Task 2: Tabela de eventos, congelamento de vitrines e seleção dos vídeos excedentes

**Files:**
- Create: `supabase/migrations/20260921000000_billing.sql`, `supabase/tests/database/10_billing.test.sql`
- Modify: `src/lib/supabase/database.types.ts` (gerado pelo CI)

**Interfaces:**
- Produces (SQL):
  - `stripe_events (id text primary key, type text, processed_at timestamptz)` — sem grants para `anon`/`authenticated`
  - `sync_vitrine_status(p_user_id uuid, p_keep_id uuid default null) returns setof text` — congela/descongela pelo plano efetivo e devolve **todos** os subdomínios do dono (service_role)
  - `choose_active_vitrine(p_vitrine_id uuid) returns setof text` — mesma coisa para o dono logado, conferindo `auth.uid()` (authenticated)
  - `users_pro_ended_between(p_from_days int, p_to_days int default null) returns setof uuid`
  - `excess_video_media(p_user_ids uuid[]) returns table (id uuid, owner_id uuid, subdomain text, storage_paths jsonb, bunny_video_id text)`
  - `videos_to_delete_after_pro(p_days int default 90) returns table (id uuid, owner_id uuid, subdomain text, storage_paths jsonb, bunny_video_id text)` (service_role)
  - `accounts_to_warn_video_cleanup(p_warn_days int default 83) returns table (user_id uuid, videos_to_delete int, pro_ended_at timestamptz)` (service_role)

- [ ] **Step 1: Migração**

`supabase/migrations/20260921000000_billing.sql`:

```sql
-- Assinatura Pro: eventos do Stripe, congelamento das vitrines e regra dos 90 dias
-- (spec 4.1, 4.7, 4.8, 6.4, 8.7 e 9)

-- Garante que cada evento do Stripe seja processado uma vez só (spec 4.1).
create table public.stripe_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);

alter table public.stripe_events enable row level security;
revoke all on public.stripe_events from anon, authenticated;

create index subscriptions_pro_ended_idx on public.subscriptions (pro_ended_at)
  where pro_ended_at is not null;

-- Congelamento (spec 4.7 e 8.7): ficam ativas as primeiras `max_vitrines` vitrines
-- na ordem do painel; `p_keep_id` é a escolha do dono. Devolve todos os subdomínios
-- porque qualquer mudança de plano muda a página gerada (marca d'água, logo, cor,
-- 10 itens e 1 vídeo do gratuito).
create function public.sync_vitrine_status(p_user_id uuid, p_keep_id uuid default null)
returns setof text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max int;
begin
  select p.max_vitrines into v_max
  from public.plans p
  where p.id = public.effective_plan_id(p_user_id);

  with ordenadas as (
    select
      v.id,
      case
        when row_number() over (
          order by coalesce(v.id = p_keep_id, false) desc, v.position, v.created_at
        ) <= v_max then 'active'
        else 'frozen'
      end as novo_status
    from public.vitrines v
    where v.owner_id = p_user_id
  )
  update public.vitrines v
  set status = o.novo_status
  from ordenadas o
  where v.id = o.id
    and v.status is distinct from o.novo_status;

  return query select v.subdomain from public.vitrines v where v.owner_id = p_user_id;
end;
$$;

revoke execute on function public.sync_vitrine_status(uuid, uuid) from public, anon, authenticated;
grant execute on function public.sync_vitrine_status(uuid, uuid) to service_role;

-- Escolha do dono quando a conta volta ao gratuito com mais de uma vitrine (spec 8.7).
create function public.choose_active_vitrine(p_vitrine_id uuid)
returns setof text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  select v.owner_id into v_owner from public.vitrines v where v.id = p_vitrine_id;
  if v_owner is null or v_owner is distinct from auth.uid() then
    raise exception 'vitrine_not_found' using errcode = 'P0001';
  end if;
  return query select public.sync_vitrine_status(v_owner, p_vitrine_id);
end;
$$;

revoke execute on function public.choose_active_vitrine(uuid) from public, anon;
grant execute on function public.choose_active_vitrine(uuid) to authenticated;

-- Contas que saíram do Pro numa janela de dias e continuam no gratuito (spec 6.4).
create function public.users_pro_ended_between(p_from_days int, p_to_days int default null)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.user_id
  from public.subscriptions s
  where s.pro_ended_at is not null
    and s.pro_ended_at <= now() - make_interval(days => p_from_days)
    and (p_to_days is null or s.pro_ended_at > now() - make_interval(days => p_to_days))
    and public.effective_plan_id(s.user_id) = 'free';
$$;

revoke execute on function public.users_pro_ended_between(int, int) from public, anon, authenticated;

-- Vídeos que passam do limite do gratuito, na mesma ordem em que a vitrine os
-- mostraria (spec 4.7): o primeiro fica, o resto é candidato à limpeza.
create function public.excess_video_media(p_user_ids uuid[])
returns table (id uuid, owner_id uuid, subdomain text, storage_paths jsonb, bunny_video_id text)
language sql
stable
security definer
set search_path = ''
as $$
  with ranked as (
    select
      m.id,
      m.owner_id,
      v.subdomain,
      m.storage_paths,
      m.bunny_video_id,
      row_number() over (
        partition by m.owner_id
        order by v.position, v.created_at, c.position nulls last, i.position, i.created_at
      ) as ordem
    from public.media m
    join public.items i on i.id = m.item_id and i.deleted_at is null
    join public.vitrines v on v.id = m.vitrine_id
    left join public.categories c on c.id = i.category_id
    where m.owner_id = any (p_user_ids)
      and m.role = 'video'
  )
  select r.id, r.owner_id, r.subdomain, r.storage_paths, r.bunny_video_id
  from ranked r
  where r.ordem > (
    select coalesce(p.max_videos_per_account, 2147483647) from public.plans p where p.id = 'free'
  );
$$;

revoke execute on function public.excess_video_media(uuid[]) from public, anon, authenticated;

create function public.videos_to_delete_after_pro(p_days int default 90)
returns table (id uuid, owner_id uuid, subdomain text, storage_paths jsonb, bunny_video_id text)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.owner_id, e.subdomain, e.storage_paths, e.bunny_video_id
  from public.excess_video_media(array(select u from public.users_pro_ended_between(p_days) u)) e;
$$;

revoke execute on function public.videos_to_delete_after_pro(int) from public, anon, authenticated;
grant execute on function public.videos_to_delete_after_pro(int) to service_role;

-- Aviso do dia 83: janela de um dia, para sair uma vez por conta (spec 6.4).
create function public.accounts_to_warn_video_cleanup(p_warn_days int default 83)
returns table (user_id uuid, videos_to_delete int, pro_ended_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.user_id, count(e.id)::int, s.pro_ended_at
  from public.subscriptions s
  join public.excess_video_media(
    array(select u from public.users_pro_ended_between(p_warn_days, p_warn_days + 1) u)
  ) e on e.owner_id = s.user_id
  group by s.user_id, s.pro_ended_at;
$$;

revoke execute on function public.accounts_to_warn_video_cleanup(int) from public, anon, authenticated;
grant execute on function public.accounts_to_warn_video_cleanup(int) to service_role;
```

- [ ] **Step 2: Teste pgTAP**

`supabase/tests/database/10_billing.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- As vitrines e os vídeos nascem com a conta no Pro: as travas de plano valem em
-- qualquer papel, inclusive aqui.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000005c1', 'expirou@plano.com'),
  ('00000000-0000-0000-0000-0000000005c2', 'assinante@plano.com');
insert into public.subscriptions (user_id, plan_id, status) values
  ('00000000-0000-0000-0000-0000000005c1', 'pro', 'active'),
  ('00000000-0000-0000-0000-0000000005c2', 'pro', 'active');

insert into public.vitrines (id, owner_id, type, subdomain, name, default_button_text, position) values
  ('00000000-0000-0000-0000-00000000f501', '00000000-0000-0000-0000-0000000005c1', 'produtos', 'plano-um', 'Primeira', 'Solicitar orçamento', 0),
  ('00000000-0000-0000-0000-00000000f502', '00000000-0000-0000-0000-0000000005c1', 'produtos', 'plano-dois', 'Segunda', 'Solicitar orçamento', 1),
  ('00000000-0000-0000-0000-00000000f503', '00000000-0000-0000-0000-0000000005c1', 'produtos', 'plano-tres', 'Terceira', 'Solicitar orçamento', 2),
  ('00000000-0000-0000-0000-00000000f504', '00000000-0000-0000-0000-0000000005c2', 'produtos', 'plano-assinante', 'Do assinante', 'Solicitar orçamento', 0);

insert into public.categories (id, owner_id, vitrine_id, name) values
  ('00000000-0000-0000-0000-00000000c501', '00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-00000000f501', 'Geral'),
  ('00000000-0000-0000-0000-00000000c502', '00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-00000000f502', 'Geral');

insert into public.items (id, owner_id, vitrine_id, category_id, name, price_cents) values
  ('00000000-0000-0000-0000-00000000e501', '00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-00000000f501', '00000000-0000-0000-0000-00000000c501', 'A', 100),
  ('00000000-0000-0000-0000-00000000e502', '00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-00000000f502', '00000000-0000-0000-0000-00000000c502', 'B', 100),
  ('00000000-0000-0000-0000-00000000e503', '00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-00000000f502', '00000000-0000-0000-0000-00000000c502', 'C', 100);

insert into public.media (id, owner_id, vitrine_id, item_id, role, kind, status, bunny_video_id) values
  ('00000000-0000-0000-0000-00000000d501', '00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-00000000f501', '00000000-0000-0000-0000-00000000e501', 'video', 'video', 'ready', 'guid-plano-1'),
  ('00000000-0000-0000-0000-00000000d502', '00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-00000000f502', '00000000-0000-0000-0000-00000000e502', 'video', 'video', 'ready', 'guid-plano-2'),
  ('00000000-0000-0000-0000-00000000d503', '00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-00000000f502', '00000000-0000-0000-0000-00000000e503', 'video', 'video', 'ready', 'guid-plano-3');

-- A conta saiu do Pro há 100 dias.
update public.subscriptions
set status = 'canceled', pro_ended_at = now() - interval '100 days'
where user_id = '00000000-0000-0000-0000-0000000005c1';

select is(public.effective_plan_id('00000000-0000-0000-0000-0000000005c1'), 'free', 'assinatura cancelada volta ao gratuito');

select lives_ok(
  $$ select public.sync_vitrine_status('00000000-0000-0000-0000-0000000005c1') $$,
  'congela o que passa do limite do plano'
);
select results_eq(
  $$ select subdomain from public.vitrines where owner_id = '00000000-0000-0000-0000-0000000005c1' and status = 'active' $$,
  $$ values ('plano-um'::text) $$,
  'no gratuito fica só a primeira vitrine'
);
select is(
  (select count(*)::int from public.vitrines where owner_id = '00000000-0000-0000-0000-0000000005c1' and status = 'frozen'),
  2,
  'as outras ficam congeladas'
);
select set_eq(
  $$ select public.sync_vitrine_status('00000000-0000-0000-0000-0000000005c1') $$,
  $$ values ('plano-um'::text), ('plano-dois'::text), ('plano-tres'::text) $$,
  'devolve todos os subdomínios do dono para revalidar'
);

select lives_ok(
  $$ select public.sync_vitrine_status('00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-00000000f503') $$,
  'aceita a escolha do dono'
);
select results_eq(
  $$ select subdomain from public.vitrines where owner_id = '00000000-0000-0000-0000-0000000005c1' and status = 'active' $$,
  $$ values ('plano-tres'::text) $$,
  'a vitrine escolhida fica no lugar da mais antiga'
);

update public.subscriptions set status = 'active', pro_ended_at = null
where user_id = '00000000-0000-0000-0000-0000000005c1';
select lives_ok(
  $$ select public.sync_vitrine_status('00000000-0000-0000-0000-0000000005c1') $$,
  'roda de novo ao voltar para o Pro'
);
select is(
  (select count(*)::int from public.vitrines where owner_id = '00000000-0000-0000-0000-0000000005c1' and status = 'active'),
  3,
  'no Pro todas as vitrines voltam a ativas'
);

update public.subscriptions set status = 'canceled', pro_ended_at = now() - interval '100 days'
where user_id = '00000000-0000-0000-0000-0000000005c1';

set local role service_role;
select set_eq(
  $$ select bunny_video_id from public.videos_to_delete_after_pro(90) $$,
  $$ values ('guid-plano-2'::text), ('guid-plano-3'::text) $$,
  'apaga só os vídeos que passam do limite do gratuito'
);
select is(
  (select count(*)::int from public.videos_to_delete_after_pro(120)),
  0,
  'quem saiu do Pro há 100 dias ainda não entra na janela de 120'
);
select is(
  (select count(*)::int from public.videos_to_delete_after_pro(90) where owner_id = '00000000-0000-0000-0000-0000000005c2'),
  0,
  'assinante ativo não perde vídeos'
);
select is(
  (select count(*)::int from public.accounts_to_warn_video_cleanup(83)),
  0,
  'fora da janela do dia 83 não avisa'
);

reset role;
update public.subscriptions set pro_ended_at = now() - interval '83 days' - interval '2 hours'
where user_id = '00000000-0000-0000-0000-0000000005c1';
set local role service_role;
select results_eq(
  $$ select user_id, videos_to_delete from public.accounts_to_warn_video_cleanup(83) $$,
  $$ values ('00000000-0000-0000-0000-0000000005c1'::uuid, 2) $$,
  'avisa no dia 83 com a quantidade de vídeos'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000005c1","role":"authenticated"}', true);
select throws_ok(
  $$ select 1 from public.stripe_events $$,
  '42501', null, 'stripe_events não é exposta ao dono'
);
select throws_ok(
  $$ select public.sync_vitrine_status('00000000-0000-0000-0000-0000000005c1') $$,
  '42501', null, 'sync_vitrine_status não é exposta ao dono'
);
select throws_ok(
  $$ select public.videos_to_delete_after_pro(90) $$,
  '42501', null, 'a limpeza dos 90 dias não é exposta ao dono'
);
select lives_ok(
  $$ select public.choose_active_vitrine('00000000-0000-0000-0000-00000000f502') $$,
  'o dono escolhe qual vitrine fica ativa'
);
select results_eq(
  $$ select subdomain from public.vitrines where owner_id = '00000000-0000-0000-0000-0000000005c1' and status = 'active' $$,
  $$ values ('plano-dois'::text) $$,
  'a escolha do dono vale'
);
select throws_ok(
  $$ select public.choose_active_vitrine('00000000-0000-0000-0000-00000000f504') $$,
  'P0001', 'vitrine_not_found', 'ninguém escolhe a vitrine de outro dono'
);

select * from finish();
rollback;
```

- [ ] **Step 3: Rodar o pgTAP**

Localmente não há Docker (ver `docs/setup/fase-2-infra.md`): quem valida é o CI. Se o Supabase local estiver disponível:

Run: `npx supabase test db`
Expected: `10_billing.test.sql .. ok` e o total de testes subindo de 121 para 141.

- [ ] **Step 4: Push, tipos do banco e PR**

```bash
npm run lint && npm run typecheck && npm test
git add supabase/migrations/20260921000000_billing.sql supabase/tests/database/10_billing.test.sql
git commit -m "feat(db): eventos do Stripe, congelamento de vitrines e regra dos 90 dias"
git push -u origin HEAD
gh pr create --fill --base master
gh pr checks --watch
```

O job `db` vai falhar no passo "Tipos commitados estão atualizados" (esperado). Baixe o artefato e commite:

```bash
gh run download <run-id> --name database-types --dir "$SCRATCHPAD/types"
cp "$SCRATCHPAD/types/database.types.ts" src/lib/supabase/database.types.ts
git add src/lib/supabase/database.types.ts
git commit -m "chore(db): tipos gerados da Fase 5"
git push
gh pr checks --watch
```

Autorização → merge → o job `migrate` aplica no Supabase dev.

---
# Bloco 2 — Regras puras: status, preços e aviso

Branch: `fase-5/bloco-2-regras`.

### Task 3: Status do Stripe → linha de `subscriptions` e resumo da tela

**Files:**
- Create: `src/lib/dates/format.ts`, `src/lib/dates/format.test.ts`, `src/lib/billing/types.ts`, `src/lib/billing/status.ts`, `src/lib/billing/status.test.ts`

**Interfaces:**
- Produces:
  - `formatDateBR(value: Date | string | null): string` — `dd/mm/aaaa` no fuso de São Paulo, `''` para `null`
  - `type BillingInterval = 'month' | 'year'`, `type BillingStatus`, `type BillingSubscription`, `type BillingPrice`, `type BillingEvent` (`src/lib/billing/types.ts`)
  - `subscriptionRowFrom(subscription: BillingSubscription, previous: PreviousRow, now: Date): SubscriptionRow`
  - `isProNow(row: { status: string; grace_until: string | null } | null, now: Date): boolean`
  - `describeSubscription(row: SubscriptionView | null, now: Date): SubscriptionSummary`
  - `GRACE_DAYS = 7`

- [ ] **Step 1: Teste que falha para a data**

`src/lib/dates/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { formatDateBR } from './format'

describe('formatDateBR', () => {
  it('mostra a data no fuso de São Paulo', () => {
    expect(formatDateBR('2026-12-01T12:00:00.000Z')).toBe('01/12/2026')
    expect(formatDateBR(new Date('2026-03-10T23:30:00.000Z'))).toBe('10/03/2026')
  })

  it('usa o dia em São Paulo, não em UTC', () => {
    expect(formatDateBR('2026-01-01T02:00:00.000Z')).toBe('31/12/2025')
  })

  it('devolve vazio sem data', () => {
    expect(formatDateBR(null)).toBe('')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/dates/format.test.ts`
Expected: FAIL — o módulo `./format` não existe.

- [ ] **Step 3: Implementar a data**

`src/lib/dates/format.ts`:

```ts
const DATE_BR = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

export function formatDateBR(value: Date | string | null): string {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? '' : DATE_BR.format(date)
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/dates/format.test.ts`
Expected: PASS.

- [ ] **Step 5: Tipos da cobrança**

`src/lib/billing/types.ts`:

```ts
export type BillingInterval = 'month' | 'year'

// Espelho dos status do Stripe (spec 9).
export type BillingStatus =
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused'

export type BillingSubscription = {
  id: string
  customerId: string
  /** Vem de `subscription.metadata.user_id`; nulo quando o Stripe não tem o dado. */
  userId: string | null
  status: BillingStatus
  interval: BillingInterval | null
  /** ISO; na API 2026-08-26 o período vive no item da assinatura. */
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
}

export type BillingPrice = { id: string; interval: BillingInterval; amountCents: number }

export type BillingEvent = { id: string; type: string; subscriptionId: string | null; customerId: string | null }
```

- [ ] **Step 6: Teste que falha para o mapeamento de status**

`src/lib/billing/status.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { describeSubscription, isProNow, subscriptionRowFrom } from './status'
import type { BillingStatus, BillingSubscription } from './types'

const NOW = new Date('2026-09-17T12:00:00.000Z')

function subscription(status: BillingStatus, overrides: Partial<BillingSubscription> = {}): BillingSubscription {
  return {
    id: 'sub_1',
    customerId: 'cus_1',
    userId: 'user-1',
    status,
    interval: 'month',
    currentPeriodEnd: '2026-10-17T12:00:00.000Z',
    cancelAtPeriodEnd: false,
    ...overrides,
  }
}

describe('subscriptionRowFrom', () => {
  it('assinatura ativa vira Pro sem carência', () => {
    expect(subscriptionRowFrom(subscription('active'), null, NOW)).toEqual({
      plan_id: 'pro',
      status: 'active',
      interval: 'month',
      current_period_end: '2026-10-17T12:00:00.000Z',
      cancel_at_period_end: false,
      grace_until: null,
      pro_ended_at: null,
    })
  })

  it('período de teste também é Pro', () => {
    expect(subscriptionRowFrom(subscription('trialing'), null, NOW).grace_until).toBeNull()
  })

  it('primeira falha dá 7 dias de carência', () => {
    const row = subscriptionRowFrom(subscription('past_due'), null, NOW)
    expect(row.grace_until).toBe('2026-09-24T12:00:00.000Z')
    expect(row.pro_ended_at).toBeNull()
  })

  it('falhas seguintes mantêm a carência da primeira', () => {
    const previous = { status: 'past_due', grace_until: '2026-09-20T00:00:00.000Z', pro_ended_at: null }
    expect(subscriptionRowFrom(subscription('past_due'), previous, NOW).grace_until).toBe('2026-09-20T00:00:00.000Z')
  })

  it('cancelada, não paga e expirada voltam ao gratuito e marcam o fim do Pro', () => {
    for (const status of ['canceled', 'unpaid', 'incomplete_expired'] as const) {
      const row = subscriptionRowFrom(subscription(status), null, NOW)
      expect([row.grace_until, row.pro_ended_at]).toEqual([null, NOW.toISOString()])
    }
  })

  it('não muda o fim do Pro já registrado', () => {
    const previous = { status: 'canceled', grace_until: null, pro_ended_at: '2026-06-01T00:00:00.000Z' }
    expect(subscriptionRowFrom(subscription('canceled'), previous, NOW).pro_ended_at).toBe('2026-06-01T00:00:00.000Z')
  })

  it('voltar ao Pro limpa carência e fim do Pro', () => {
    const previous = { status: 'canceled', grace_until: null, pro_ended_at: '2026-06-01T00:00:00.000Z' }
    expect(subscriptionRowFrom(subscription('active'), previous, NOW).pro_ended_at).toBeNull()
  })

  it('incompleta não é Pro nem encerra nada', () => {
    const row = subscriptionRowFrom(subscription('incomplete'), null, NOW)
    expect([row.grace_until, row.pro_ended_at]).toEqual([null, null])
  })

  it('guarda o cancelamento agendado e o intervalo', () => {
    const row = subscriptionRowFrom(subscription('active', { cancelAtPeriodEnd: true, interval: 'year' }), null, NOW)
    expect([row.cancel_at_period_end, row.interval]).toEqual([true, 'year'])
  })
})

describe('isProNow', () => {
  it('vale para ativa, teste e carência em dia', () => {
    expect(isProNow({ status: 'active', grace_until: null }, NOW)).toBe(true)
    expect(isProNow({ status: 'trialing', grace_until: null }, NOW)).toBe(true)
    expect(isProNow({ status: 'past_due', grace_until: '2026-09-24T12:00:00.000Z' }, NOW)).toBe(true)
  })

  it('não vale sem assinatura nem depois da carência', () => {
    expect(isProNow(null, NOW)).toBe(false)
    expect(isProNow({ status: 'past_due', grace_until: '2026-09-10T12:00:00.000Z' }, NOW)).toBe(false)
    expect(isProNow({ status: 'canceled', grace_until: null }, NOW)).toBe(false)
  })
})

describe('describeSubscription', () => {
  const base = {
    stripe_customer_id: 'cus_1',
    interval: 'month' as const,
    current_period_end: '2026-10-17T12:00:00.000Z',
    cancel_at_period_end: false,
    grace_until: null,
    pro_ended_at: null,
  }

  it('sem assinatura convida para o Pro', () => {
    const summary = describeSubscription(null, NOW)
    expect([summary.pro, summary.title, summary.showSubscribe, summary.showPortal]).toEqual([
      false,
      'Plano Gratuito',
      true,
      false,
    ])
  })

  it('assinatura ativa mostra a renovação', () => {
    const summary = describeSubscription({ ...base, status: 'active' }, NOW)
    expect(summary.pro).toBe(true)
    expect(summary.detail).toBe('Renova em 17/10/2026.')
    expect([summary.showSubscribe, summary.showPortal]).toEqual([false, true])
  })

  it('cancelamento agendado mostra até quando vale', () => {
    const summary = describeSubscription({ ...base, status: 'active', cancel_at_period_end: true }, NOW)
    expect(summary.detail).toBe('Cancelamento agendado: o Pro vale até 17/10/2026.')
  })

  it('pagamento pendente pede atualização até o fim da carência', () => {
    const summary = describeSubscription(
      { ...base, status: 'past_due', grace_until: '2026-09-24T12:00:00.000Z' },
      NOW,
    )
    expect(summary.pro).toBe(true)
    expect(summary.detail).toBe(
      'Não conseguimos cobrar seu cartão. Atualize o pagamento até 24/09/2026 para não perder o Pro.',
    )
  })

  it('Pro encerrado lembra a regra dos 90 dias e mantém o portal', () => {
    const summary = describeSubscription(
      { ...base, status: 'canceled', current_period_end: null, pro_ended_at: '2026-08-01T12:00:00.000Z' },
      NOW,
    )
    expect([summary.pro, summary.showSubscribe, summary.showPortal]).toEqual([false, true, true])
    expect(summary.detail).toBe(
      'Seu Pro terminou em 01/08/2026. Os vídeos que passam do limite do gratuito são apagados 90 dias depois.',
    )
  })
})
```

- [ ] **Step 7: Rodar e ver falhar**

Run: `npx vitest run src/lib/billing/status.test.ts`
Expected: FAIL — `./status` não existe.

- [ ] **Step 8: Implementar o mapeamento**

`src/lib/billing/status.ts`:

```ts
import { formatDateBR } from '@/lib/dates/format'
import type { BillingInterval, BillingStatus, BillingSubscription } from './types'

// Spec 9: o Stripe tenta cobrar por 7 dias antes de cancelar.
export const GRACE_DAYS = 7
const DAY_MS = 86_400_000

export type SubscriptionRow = {
  plan_id: 'pro'
  status: string
  interval: BillingInterval | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  grace_until: string | null
  pro_ended_at: string | null
}

export type PreviousRow = { status: string; grace_until: string | null; pro_ended_at: string | null } | null

const PRO: readonly BillingStatus[] = ['active', 'trialing']
const ENDED: readonly BillingStatus[] = ['canceled', 'unpaid', 'incomplete_expired']

export function subscriptionRowFrom(
  subscription: BillingSubscription,
  previous: PreviousRow,
  now: Date,
): SubscriptionRow {
  const base = {
    plan_id: 'pro' as const,
    status: subscription.status,
    interval: subscription.interval,
    current_period_end: subscription.currentPeriodEnd,
    cancel_at_period_end: subscription.cancelAtPeriodEnd,
  }

  if (PRO.includes(subscription.status)) {
    return { ...base, grace_until: null, pro_ended_at: null }
  }
  if (subscription.status === 'past_due') {
    // A carência é da primeira falha: só cria se ainda não existir.
    const kept = previous?.status === 'past_due' ? previous.grace_until : null
    return {
      ...base,
      grace_until: kept ?? new Date(now.getTime() + GRACE_DAYS * DAY_MS).toISOString(),
      pro_ended_at: null,
    }
  }
  if (ENDED.includes(subscription.status)) {
    return { ...base, grace_until: null, pro_ended_at: previous?.pro_ended_at ?? now.toISOString() }
  }
  // incomplete e paused: ainda não virou Pro, nada a encerrar.
  return { ...base, grace_until: null, pro_ended_at: previous?.pro_ended_at ?? null }
}

export function isProNow(row: { status: string; grace_until: string | null } | null, now: Date): boolean {
  if (!row) return false
  if (row.status === 'active' || row.status === 'trialing') return true
  return row.status === 'past_due' && row.grace_until !== null && new Date(row.grace_until) > now
}

export type SubscriptionView = {
  stripe_customer_id: string | null
  status: string
  interval: BillingInterval | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  grace_until: string | null
  pro_ended_at: string | null
}

export type SubscriptionSummary = {
  pro: boolean
  title: string
  detail: string
  showSubscribe: boolean
  showPortal: boolean
}

const FREE_PITCH =
  'Assine o Pro para ter 3 vitrines, 300 itens por vitrine, 50 vídeos por vitrine, logo, cor da marca e banner — e tirar a marca d’água.'

export function describeSubscription(row: SubscriptionView | null, now: Date): SubscriptionSummary {
  const pro = isProNow(row, now)
  const showPortal = Boolean(row?.stripe_customer_id)

  if (!row || !pro) {
    const detail = row?.pro_ended_at
      ? `Seu Pro terminou em ${formatDateBR(row.pro_ended_at)}. Os vídeos que passam do limite do gratuito são apagados 90 dias depois.`
      : FREE_PITCH
    return { pro: false, title: 'Plano Gratuito', detail, showSubscribe: true, showPortal }
  }

  let detail: string
  if (row.status === 'past_due') {
    detail = `Não conseguimos cobrar seu cartão. Atualize o pagamento até ${formatDateBR(row.grace_until)} para não perder o Pro.`
  } else if (row.cancel_at_period_end) {
    detail = `Cancelamento agendado: o Pro vale até ${formatDateBR(row.current_period_end)}.`
  } else if (row.status === 'trialing') {
    detail = `Período de teste até ${formatDateBR(row.current_period_end)}.`
  } else {
    detail = row.current_period_end ? `Renova em ${formatDateBR(row.current_period_end)}.` : 'Assinatura ativa.'
  }

  return { pro: true, title: 'Plano Pro', detail, showSubscribe: false, showPortal: true }
}
```

- [ ] **Step 9: Rodar e ver passar**

Run: `npx vitest run src/lib/billing src/lib/dates`
Expected: PASS (todos os casos do Step 6).

- [ ] **Step 10: Commit**

```bash
npm run lint && npm run typecheck && npm test
git add src/lib/dates src/lib/billing/types.ts src/lib/billing/status.ts src/lib/billing/status.test.ts
git commit -m "feat(billing): mapeamento de status do Stripe e resumo da assinatura"
```

---

### Task 4: Cartões de preço e e-mail do dia 83

**Files:**
- Create: `src/lib/billing/prices.ts`, `src/lib/billing/prices.test.ts`, `src/lib/email/html.ts`, `src/lib/email/video-cleanup-email.ts`, `src/lib/email/video-cleanup-email.test.ts`
- Modify: `src/lib/email/quota-email.ts`

**Interfaces:**
- Consumes: `BillingPrice` (Task 3), `formatBRL` de `@/lib/money/money`, `formatDateBR` (Task 3)
- Produces:
  - `priceCards(prices: BillingPrice[]): PriceCard[]` com `type PriceCard = { interval: BillingInterval; priceId: string; amountCents: number; title: string; note: string }`
  - `escapeHtml(value: string): string` em `src/lib/email/html.ts`
  - `buildVideoCleanupEmail(input: { ownerName: string; videosCount: number; proEndedAt: Date | string; deleteAt: Date | string; panelUrl: string }): { subject: string; text: string; html: string }`

- [ ] **Step 1: Teste que falha para os preços**

`src/lib/billing/prices.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { priceCards } from './prices'

const MONTH = { id: 'price_mes', interval: 'month' as const, amountCents: 14990 }
const YEAR = { id: 'price_ano', interval: 'year' as const, amountCents: 149900 }

describe('priceCards', () => {
  it('monta os dois cartões na ordem mensal, anual', () => {
    expect(priceCards([YEAR, MONTH])).toEqual([
      {
        interval: 'month',
        priceId: 'price_mes',
        amountCents: 14990,
        title: 'R$ 149,90 por mês',
        note: 'Cobrança mensal no cartão. Cancele quando quiser.',
      },
      {
        interval: 'year',
        priceId: 'price_ano',
        amountCents: 149900,
        title: 'R$ 1.499,00 por ano',
        note: 'Economize 17% em relação ao mensal.',
      },
    ])
  })

  it('sem o mensal, o anual não fala em economia', () => {
    expect(priceCards([YEAR])[0].note).toBe('Cobrança anual no cartão.')
  })

  it('sem preços, sem cartões', () => {
    expect(priceCards([])).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/billing/prices.test.ts`
Expected: FAIL — `./prices` não existe.

- [ ] **Step 3: Implementar os cartões**

`src/lib/billing/prices.ts`:

```ts
import { formatBRL } from '@/lib/money/money'
import type { BillingInterval, BillingPrice } from './types'

export type PriceCard = {
  interval: BillingInterval
  priceId: string
  amountCents: number
  title: string
  note: string
}

export function priceCards(prices: BillingPrice[]): PriceCard[] {
  const month = prices.find((price) => price.interval === 'month')
  const year = prices.find((price) => price.interval === 'year')
  const cards: PriceCard[] = []

  if (month) {
    cards.push({
      interval: 'month',
      priceId: month.id,
      amountCents: month.amountCents,
      title: `${formatBRL(month.amountCents)} por mês`,
      note: 'Cobrança mensal no cartão. Cancele quando quiser.',
    })
  }
  if (year) {
    const fullYear = month ? month.amountCents * 12 : 0
    const savings = fullYear > year.amountCents ? Math.round(((fullYear - year.amountCents) / fullYear) * 100) : 0
    cards.push({
      interval: 'year',
      priceId: year.id,
      amountCents: year.amountCents,
      title: `${formatBRL(year.amountCents)} por ano`,
      note: savings > 0 ? `Economize ${savings}% em relação ao mensal.` : 'Cobrança anual no cartão.',
    })
  }
  return cards
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/billing/prices.test.ts`
Expected: PASS.

- [ ] **Step 5: Teste que falha para o e-mail do dia 83**

`src/lib/email/video-cleanup-email.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildVideoCleanupEmail } from './video-cleanup-email'

const input = {
  ownerName: 'Ana',
  videosCount: 3,
  proEndedAt: '2026-06-26T12:00:00.000Z',
  deleteAt: '2026-09-24T12:00:00.000Z',
  panelUrl: 'https://app.agenn.com.br/painel/plano',
}

describe('buildVideoCleanupEmail', () => {
  it('avisa a data, a quantidade e o caminho para manter', () => {
    const email = buildVideoCleanupEmail(input)
    expect(email.subject).toBe('Seus vídeos serão apagados em 7 dias')
    expect(email.text).toContain('Olá, Ana!')
    expect(email.text).toContain('Seu plano Pro terminou em 26/06/2026')
    expect(email.text).toContain('Em 24/09/2026, 3 vídeos serão apagados')
    expect(email.text).toContain('https://app.agenn.com.br/painel/plano')
    expect(email.html).toContain('<a href="https://app.agenn.com.br/painel/plano">')
  })

  it('usa o singular com um vídeo só', () => {
    expect(buildVideoCleanupEmail({ ...input, videosCount: 1 }).text).toContain('1 vídeo será apagado')
  })

  it('funciona sem nome', () => {
    expect(buildVideoCleanupEmail({ ...input, ownerName: '  ' }).text).toContain('Olá!')
  })
})
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `npx vitest run src/lib/email/video-cleanup-email.test.ts`
Expected: FAIL — `./video-cleanup-email` não existe.

- [ ] **Step 7: Extrair o `escapeHtml` e escrever o e-mail**

`src/lib/email/html.ts`:

```ts
export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
```

Em `src/lib/email/quota-email.ts`, apague a função local `escapeHtml` e acrescente no topo:

```ts
import { escapeHtml } from './html'
```

`src/lib/email/video-cleanup-email.ts`:

```ts
import { formatDateBR } from '@/lib/dates/format'
import { escapeHtml } from './html'

// Spec 6.4: aviso do dia 83, sete dias antes de apagar os vídeos excedentes.
export function buildVideoCleanupEmail(input: {
  ownerName: string
  videosCount: number
  proEndedAt: Date | string
  deleteAt: Date | string
  panelUrl: string
}): { subject: string; text: string; html: string } {
  const greeting = input.ownerName.trim() ? `Olá, ${input.ownerName.trim()}!` : 'Olá!'
  const videos =
    input.videosCount === 1 ? '1 vídeo será apagado' : `${input.videosCount} vídeos serão apagados`
  const paragraphs = [
    greeting,
    `Seu plano Pro terminou em ${formatDateBR(input.proEndedAt)} e a conta voltou ao gratuito, que mostra 1 vídeo.`,
    `Em ${formatDateBR(input.deleteAt)}, ${videos} e não será possível recuperar.`,
    `Para manter todos, assine o Pro de novo em: ${input.panelUrl}`,
    'Equipe Agenn Vitrine',
  ]

  const html = [
    `<p>${escapeHtml(paragraphs[0])}</p>`,
    `<p>${escapeHtml(paragraphs[1])}</p>`,
    `<p>${escapeHtml(paragraphs[2])}</p>`,
    `<p>Para manter todos, assine o Pro de novo em: <a href="${escapeHtml(input.panelUrl)}">${escapeHtml(input.panelUrl)}</a></p>`,
    '<p>Equipe Agenn Vitrine</p>',
  ].join('\n')

  return { subject: 'Seus vídeos serão apagados em 7 dias', text: paragraphs.join('\n\n'), html }
}
```

- [ ] **Step 8: Rodar tudo e ver passar**

Run: `npm test`
Expected: PASS, inclusive `quota-email.test.ts` (o `escapeHtml` mudou de lugar, não de comportamento).

- [ ] **Step 9: PR do bloco**

```bash
npm run lint && npm run typecheck && npm test
git add src/lib/billing src/lib/email src/lib/dates
git commit -m "feat(billing): cartões de preço e e-mail do aviso dos 90 dias"
git push -u origin HEAD
gh pr create --fill --base master
gh pr checks --watch
```

Autorização → merge.

---
# Bloco 3 — Camada de cobrança: driver do Stripe e driver falso

Branch: `fase-5/bloco-3-cobranca`.

### Task 5: Interface `Billing` e driver do Stripe

**Files:**
- Create: `src/lib/billing/stripe-events.ts`, `src/lib/billing/stripe-billing.ts`, `src/lib/billing/billing.ts`

**Interfaces:**
- Consumes: `BillingEnv` (Task 1), `BillingEvent`, `BillingPrice`, `BillingSubscription`, `BillingInterval` (Task 3)
- Produces:
  - `createStripeClient(secretKey: string): Stripe`
  - `subscriptionIdFromEvent(event: Stripe.Event): string | null`, `customerIdFromEvent(event: Stripe.Event): string | null`
  - `parseStripeEvent(stripe: Stripe, raw: string, signature: string | null, secret: string): Promise<BillingEvent | null>`
  - `normalizeSubscription(subscription: Stripe.Subscription): BillingSubscription`
  - `interface Billing` com `ensureCustomer`, `createCheckoutSession`, `createPortalSession`, `getSubscription`, `listPrices`, `parseEvent`, `priceIdFor`
  - `getBilling(): Billing`

- [ ] **Step 1: Verificação de assinatura e extração de ids**

`src/lib/billing/stripe-events.ts`:

```ts
import 'server-only'
import Stripe from 'stripe'
import type { BillingEvent } from './types'

// O SDK não faz nenhuma chamada até ser usado, então o driver falso também usa este
// cliente — ele só precisa da parte de criptografia do webhook.
export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey || 'sk_test_driver_falso')
}

function idOf(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value && typeof (value as { id: unknown }).id === 'string') {
    return (value as { id: string }).id
  }
  return null
}

export function subscriptionIdFromEvent(event: Stripe.Event): string | null {
  const object = event.data.object as Record<string, unknown>
  if (event.type.startsWith('customer.subscription.')) return idOf(object.id)
  if (event.type === 'checkout.session.completed') return idOf(object.subscription)
  // Faturas: de 2025-03-31.basil em diante o id vive em parent.subscription_details;
  // antes disso ficava em invoice.subscription. Aceitar as duas formas deixa a rota
  // imune à versão de API escolhida no endpoint de webhook.
  const parent = object.parent as { subscription_details?: { subscription?: unknown } } | null | undefined
  return idOf(parent?.subscription_details?.subscription) ?? idOf(object.subscription)
}

export function customerIdFromEvent(event: Stripe.Event): string | null {
  return idOf((event.data.object as Record<string, unknown>).customer)
}

export async function parseStripeEvent(
  stripe: Stripe,
  raw: string,
  signature: string | null,
  secret: string,
): Promise<BillingEvent | null> {
  if (!signature) return null
  try {
    const event = await stripe.webhooks.constructEventAsync(raw, signature, secret)
    return {
      id: event.id,
      type: event.type,
      subscriptionId: subscriptionIdFromEvent(event),
      customerId: customerIdFromEvent(event),
    }
  } catch {
    // Assinatura inválida, corpo alterado ou fora da tolerância: a rota responde 401.
    return null
  }
}
```

- [ ] **Step 2: Interface do driver**

`src/lib/billing/billing.ts`:

```ts
import 'server-only'
import { getBillingEnv } from '@/lib/server-env'
import { createFakeBilling } from './fake-billing'
import { createStripeBilling } from './stripe-billing'
import type { BillingEvent, BillingInterval, BillingPrice, BillingSubscription } from './types'

export interface Billing {
  /** Devolve o id do Customer, criando um com `metadata.user_id` na primeira vez (spec 9). */
  ensureCustomer(input: {
    userId: string
    email: string
    name: string
    customerId: string | null
  }): Promise<string>
  createCheckoutSession(input: {
    userId: string
    customerId: string
    priceId: string
    successUrl: string
    cancelUrl: string
  }): Promise<string>
  createPortalSession(input: { customerId: string; returnUrl: string }): Promise<string>
  getSubscription(subscriptionId: string): Promise<BillingSubscription | null>
  listPrices(): Promise<BillingPrice[]>
  parseEvent(raw: string, signature: string | null): Promise<BillingEvent | null>
  priceIdFor(interval: BillingInterval): string
}

export function getBilling(): Billing {
  const config = getBillingEnv()
  return config.driver === 'fake' ? createFakeBilling(config) : createStripeBilling(config)
}
```

- [ ] **Step 3: Driver do Stripe**

`src/lib/billing/stripe-billing.ts`:

```ts
import 'server-only'
import Stripe from 'stripe'
import type { BillingEnv } from '@/lib/server-env-schema'
import type { Billing } from './billing'
import { createStripeClient, parseStripeEvent } from './stripe-events'
import type { BillingInterval, BillingPrice, BillingStatus, BillingSubscription } from './types'

const PRICE_TTL_MS = 60 * 60 * 1000
let priceCache: { at: number; prices: BillingPrice[] } | null = null

function intervalOf(value: string | null | undefined): BillingInterval | null {
  return value === 'month' || value === 'year' ? value : null
}

function toIso(seconds: number | null | undefined): string | null {
  return typeof seconds === 'number' ? new Date(seconds * 1000).toISOString() : null
}

// Spec 9 / API 2026-08-26: o período vive no item da assinatura, não no topo.
export function normalizeSubscription(subscription: Stripe.Subscription): BillingSubscription {
  const item = subscription.items.data[0]
  return {
    id: subscription.id,
    customerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
    userId: subscription.metadata?.user_id ?? null,
    status: subscription.status as BillingStatus,
    interval: intervalOf(item?.price.recurring?.interval ?? null),
    currentPeriodEnd: toIso(item?.current_period_end),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  }
}

export function createStripeBilling(config: BillingEnv): Billing {
  const stripe = createStripeClient(config.secretKey)

  return {
    priceIdFor: (interval) => (interval === 'year' ? config.priceYear : config.priceMonth),

    async ensureCustomer({ userId, email, name, customerId }) {
      if (customerId) return customerId
      const customer = await stripe.customers.create({
        email: email || undefined,
        name: name.trim() || undefined,
        metadata: { user_id: userId },
      })
      return customer.id
    },

    async createCheckoutSession({ userId, customerId, priceId, successUrl, cancelUrl }) {
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        client_reference_id: userId,
        line_items: [{ price: priceId, quantity: 1 }],
        // Spec 9: pagamento só com cartão.
        payment_method_types: ['card'],
        locale: 'pt-BR',
        success_url: successUrl,
        cancel_url: cancelUrl,
        subscription_data: { metadata: { user_id: userId } },
      })
      if (!session.url) throw new Error('Checkout criado sem URL')
      return session.url
    },

    async createPortalSession({ customerId, returnUrl }) {
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
        locale: 'pt-BR',
      })
      return session.url
    },

    async getSubscription(subscriptionId) {
      try {
        return normalizeSubscription(await stripe.subscriptions.retrieve(subscriptionId))
      } catch (error) {
        // Assinatura apagada no Stripe: não é falha nossa.
        if (error instanceof Stripe.errors.StripeInvalidRequestError && error.statusCode === 404) return null
        throw error
      }
    },

    // Cache no processo: reajuste no Stripe aparece em até 1 h, sem uma chamada por visita.
    async listPrices() {
      if (priceCache && Date.now() - priceCache.at < PRICE_TTL_MS) return priceCache.prices
      const prices = await Promise.all(
        [config.priceMonth, config.priceYear].map((id) => stripe.prices.retrieve(id)),
      )
      const list = prices.flatMap((price) => {
        const interval = intervalOf(price.recurring?.interval ?? null)
        return interval !== null && price.unit_amount !== null
          ? [{ id: price.id, interval, amountCents: price.unit_amount }]
          : []
      })
      priceCache = { at: Date.now(), prices: list }
      return list
    },

    parseEvent: (raw, signature) => parseStripeEvent(stripe, raw, signature, config.webhookSecret),
  }
}
```

- [ ] **Step 4: Conferir os tipos**

Run: `npm run typecheck`
Expected: um erro só, dizendo que `./fake-billing` não existe (a próxima task cria).

- [ ] **Step 5: Commit**

```bash
git add src/lib/billing/stripe-events.ts src/lib/billing/stripe-billing.ts src/lib/billing/billing.ts
git commit -m "feat(billing): driver do Stripe e verificação do webhook"
```

---

### Task 6: Driver falso e rotas de desenvolvimento

**Files:**
- Create: `src/lib/billing/fake-billing.ts`, `src/app/api/dev-billing/checkout/route.ts`, `src/app/api/dev-billing/portal/route.ts`

**Interfaces:**
- Consumes: `Billing` (Task 5), `BillingEnv` (Task 1), `BillingSubscription` (Task 3)
- Produces:
  - `createFakeBilling(config: BillingEnv): Billing`
  - `readFakeSession(id: string)`, `writeFakeSubscription(subscription: BillingSubscription)`, `findFakeSubscriptionByCustomer(customerId: string)`
  - `sendFakeWebhook(request: Request, type: string, object: Record<string, unknown>): Promise<void>`
  - Rotas `GET /api/dev-billing/checkout?sessao=…` e `GET /api/dev-billing/portal?cliente=…&retorno=…[&acao=agendar|cancelar]`, ambas 404 fora do driver falso

- [ ] **Step 1: Driver falso**

`src/lib/billing/fake-billing.ts`:

```ts
import 'server-only'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { getBillingEnv } from '@/lib/server-env'
import type { BillingEnv } from '@/lib/server-env-schema'
import type { Billing } from './billing'
import { createStripeClient, parseStripeEvent } from './stripe-events'
import type { BillingInterval, BillingPrice, BillingSubscription } from './types'

// Só CI e desenvolvimento: clientes, assinaturas e sessões viram arquivos JSON no
// diretório temporário, como o driver falso de vídeo da Fase 3.
const ROOT = path.join(os.tmpdir(), 'agenn-vitrine-billing')
const ID = /^[a-z]+_fake_[0-9a-f-]{36}$/

export const FAKE_PRICE_MONTH = 'price_fake_mes'
export const FAKE_PRICE_YEAR = 'price_fake_ano'

const FAKE_PRICES: BillingPrice[] = [
  { id: FAKE_PRICE_MONTH, interval: 'month', amountCents: 14990 },
  { id: FAKE_PRICE_YEAR, interval: 'year', amountCents: 149900 },
]

export type FakeCheckoutSession = {
  id: string
  userId: string
  customerId: string
  interval: BillingInterval
  successUrl: string
}

function fileFor(id: string) {
  if (!ID.test(id)) throw new Error(`id falso inválido: ${id}`)
  return path.join(ROOT, `${id}.json`)
}

async function read<T>(id: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(fileFor(id), 'utf8')) as T
  } catch {
    return null
  }
}

async function write(id: string, value: unknown) {
  await mkdir(ROOT, { recursive: true })
  await writeFile(fileFor(id), JSON.stringify(value))
}

export function readFakeSession(id: string) {
  return read<FakeCheckoutSession>(id)
}

export async function writeFakeSubscription(subscription: BillingSubscription) {
  await write(subscription.id, subscription)
}

export async function findFakeSubscriptionByCustomer(customerId: string): Promise<BillingSubscription | null> {
  const files = await readdir(ROOT).catch(() => [] as string[])
  const subscriptions = await Promise.all(
    files
      .filter((file) => file.startsWith('sub_fake_'))
      .map((file) => read<BillingSubscription>(file.replace(/\.json$/, ''))),
  )
  return subscriptions.find((subscription) => subscription?.customerId === customerId) ?? null
}

// Faz o papel do Stripe: manda o evento assinado para o nosso próprio webhook.
export async function sendFakeWebhook(
  request: Request,
  type: string,
  object: Record<string, unknown>,
): Promise<void> {
  const config = getBillingEnv()
  const stripe = createStripeClient(config.secretKey)
  const body = JSON.stringify({
    id: `evt_fake_${crypto.randomUUID()}`,
    object: 'event',
    type,
    data: { object },
  })
  const signature = stripe.webhooks.generateTestHeaderString({ payload: body, secret: config.webhookSecret })
  const response = await fetch(new URL('/api/webhooks/stripe', request.url), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': signature },
    body,
  })
  if (!response.ok) throw new Error(`webhook falso respondeu ${response.status}`)
}

export function createFakeBilling(config: BillingEnv): Billing {
  const stripe = createStripeClient(config.secretKey)

  return {
    priceIdFor: (interval) => (interval === 'year' ? FAKE_PRICE_YEAR : FAKE_PRICE_MONTH),

    async ensureCustomer({ customerId }) {
      return customerId ?? `cus_fake_${crypto.randomUUID()}`
    },

    async createCheckoutSession({ userId, customerId, priceId, successUrl }) {
      const id = `cs_fake_${crypto.randomUUID()}`
      const session: FakeCheckoutSession = {
        id,
        userId,
        customerId,
        interval: priceId === FAKE_PRICE_YEAR ? 'year' : 'month',
        successUrl,
      }
      await write(id, session)
      return `/api/dev-billing/checkout?sessao=${id}`
    },

    async createPortalSession({ customerId, returnUrl }) {
      return `/api/dev-billing/portal?cliente=${customerId}&retorno=${encodeURIComponent(returnUrl)}`
    },

    getSubscription: (subscriptionId) => read<BillingSubscription>(subscriptionId),

    async listPrices() {
      return FAKE_PRICES
    },

    parseEvent: (raw, signature) => parseStripeEvent(stripe, raw, signature, config.webhookSecret),
  }
}
```

- [ ] **Step 2: Rota do checkout falso**

`src/app/api/dev-billing/checkout/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { readFakeSession, sendFakeWebhook, writeFakeSubscription } from '@/lib/billing/fake-billing'
import type { BillingSubscription } from '@/lib/billing/types'
import { getBillingEnv } from '@/lib/server-env'

const DAY_MS = 86_400_000

// Só CI e desenvolvimento: "paga" a sessão, cria a assinatura falsa, dispara o
// webhook assinado (como faria o Stripe) e volta para o painel.
export async function GET(request: Request) {
  if (getBillingEnv().driver !== 'fake') return new NextResponse(null, { status: 404 })

  const sessionId = new URL(request.url).searchParams.get('sessao') ?? ''
  const session = await readFakeSession(sessionId).catch(() => null)
  if (!session) return new NextResponse(null, { status: 404 })

  const subscription: BillingSubscription = {
    id: `sub_fake_${crypto.randomUUID()}`,
    customerId: session.customerId,
    userId: session.userId,
    status: 'active',
    interval: session.interval,
    currentPeriodEnd: new Date(Date.now() + (session.interval === 'year' ? 365 : 30) * DAY_MS).toISOString(),
    cancelAtPeriodEnd: false,
  }
  await writeFakeSubscription(subscription)
  await sendFakeWebhook(request, 'checkout.session.completed', {
    id: session.id,
    object: 'checkout.session',
    customer: session.customerId,
    subscription: subscription.id,
  })

  return NextResponse.redirect(new URL(session.successUrl, request.url))
}
```

- [ ] **Step 3: Rota do portal falso**

`src/app/api/dev-billing/portal/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { findFakeSubscriptionByCustomer, sendFakeWebhook, writeFakeSubscription } from '@/lib/billing/fake-billing'
import { escapeHtml } from '@/lib/email/html'
import { getBillingEnv } from '@/lib/server-env'

// Só CI e desenvolvimento: faz o papel do Customer Portal, com as duas saídas que
// interessam aos testes — cancelar no fim do período e cancelar agora.
export async function GET(request: Request) {
  if (getBillingEnv().driver !== 'fake') return new NextResponse(null, { status: 404 })

  const url = new URL(request.url)
  const customerId = url.searchParams.get('cliente') ?? ''
  const back = url.searchParams.get('retorno') ?? '/painel/plano'
  const action = url.searchParams.get('acao')

  const subscription = await findFakeSubscriptionByCustomer(customerId)
  if (!subscription) return new NextResponse(null, { status: 404 })

  if (action === 'agendar' || action === 'cancelar') {
    const updated =
      action === 'agendar'
        ? { ...subscription, cancelAtPeriodEnd: true }
        : { ...subscription, status: 'canceled' as const, cancelAtPeriodEnd: false }
    await writeFakeSubscription(updated)
    await sendFakeWebhook(
      request,
      action === 'agendar' ? 'customer.subscription.updated' : 'customer.subscription.deleted',
      { id: updated.id, object: 'subscription', customer: customerId },
    )
    return NextResponse.redirect(new URL(back, request.url))
  }

  const base = `${url.pathname}?cliente=${encodeURIComponent(customerId)}&retorno=${encodeURIComponent(back)}`
  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Portal de teste</title></head>
<body>
<h1>Portal de teste</h1>
<p>Assinatura ${escapeHtml(subscription.id)} — ${escapeHtml(subscription.status)}.</p>
<p><a href="${escapeHtml(base)}&acao=agendar">Cancelar no fim do período</a></p>
<p><a href="${escapeHtml(base)}&acao=cancelar">Cancelar agora</a></p>
<p><a href="${escapeHtml(back)}">Voltar ao painel</a></p>
</body></html>`
  return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
}
```

- [ ] **Step 4: Verificação e PR do bloco**

```bash
npm run lint && npm run typecheck && npm test
git add src/lib/billing/fake-billing.ts src/app/api/dev-billing
git commit -m "feat(billing): driver falso do Stripe com checkout e portal de desenvolvimento"
git push -u origin HEAD
gh pr create --fill --base master
gh pr checks --watch
```

O build do CI precisa passar mesmo sem as rotas serem chamadas. Autorização → merge.

---

# Bloco 4 — Webhook e aplicação da assinatura

Branch: `fase-5/bloco-4-webhook`.

### Task 7: Gravar a assinatura, congelar e revalidar

**Files:**
- Create: `src/features/billing/apply-subscription.ts`, `src/app/api/webhooks/stripe/route.ts`

**Interfaces:**
- Consumes: `subscriptionRowFrom` (Task 3), `getBilling` (Task 5), `sync_vitrine_status` (Task 2), `revalidateVitrine` de `@/lib/vitrines/cache`
- Produces:
  - `resolveUserId(admin: SupabaseClient<Database>, subscription: BillingSubscription): Promise<string | null>`
  - `applySubscription(admin: SupabaseClient<Database>, userId: string, subscription: BillingSubscription, now?: Date): Promise<string[]>` — devolve os subdomínios revalidados
  - `POST /api/webhooks/stripe`

- [ ] **Step 1: Aplicar a assinatura**

`src/features/billing/apply-subscription.ts`:

```ts
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { subscriptionRowFrom } from '@/lib/billing/status'
import type { BillingSubscription } from '@/lib/billing/types'
import type { Database } from '@/lib/supabase/database.types'
import { revalidateVitrine } from '@/lib/vitrines/cache'

type Admin = SupabaseClient<Database>

// O dono vem do metadata da assinatura; se faltar, pelo Customer já guardado.
export async function resolveUserId(admin: Admin, subscription: BillingSubscription): Promise<string | null> {
  if (subscription.userId) return subscription.userId
  const { data, error } = await admin
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', subscription.customerId)
    .maybeSingle()
  if (error) throw error
  return data?.user_id ?? null
}

// Spec 9: toda mudança de plano grava a assinatura, ajusta o status das vitrines e
// revalida todas elas (a página gerada depende do plano).
export async function applySubscription(
  admin: Admin,
  userId: string,
  subscription: BillingSubscription,
  now: Date = new Date(),
): Promise<string[]> {
  const { data: previous, error: previousError } = await admin
    .from('subscriptions')
    .select('status, grace_until, pro_ended_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (previousError) throw previousError

  const row = subscriptionRowFrom(subscription, previous ?? null, now)
  const { error } = await admin.from('subscriptions').upsert({
    user_id: userId,
    stripe_customer_id: subscription.customerId,
    stripe_subscription_id: subscription.id,
    ...row,
  })
  if (error) throw error

  const { data: subdomains, error: syncError } = await admin.rpc('sync_vitrine_status', { p_user_id: userId })
  if (syncError) throw syncError

  const list = subdomains ?? []
  revalidateVitrine(...list)
  return list
}
```

- [ ] **Step 2: Rota do webhook**

`src/app/api/webhooks/stripe/route.ts`:

```ts
import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'
import { applySubscription, resolveUserId } from '@/features/billing/apply-subscription'
import { getBilling, type Billing } from '@/lib/billing/billing'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

// Spec 9: só estes eventos mexem na assinatura.
const HANDLED = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
])

export async function POST(request: Request) {
  const raw = await request.text()

  let billing: Billing
  try {
    billing = getBilling()
  } catch (error) {
    Sentry.captureException(error)
    return NextResponse.json({ error: 'Cobrança indisponível.' }, { status: 503 })
  }

  const event = await billing.parseEvent(raw, request.headers.get('stripe-signature'))
  if (!event) return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 401 })
  if (!HANDLED.has(event.type)) return NextResponse.json({ ignored: true })

  try {
    const admin = createSupabaseAdminClient()

    // Idempotência (spec 4.1): evento já processado não volta a mexer em nada.
    const { data: seen, error: seenError } = await admin
      .from('stripe_events')
      .select('id')
      .eq('id', event.id)
      .maybeSingle()
    if (seenError) throw seenError
    if (seen) return NextResponse.json({ duplicated: true })

    if (!event.subscriptionId) return NextResponse.json({ ignored: true })

    // Spec 9: o estado sempre vem do Stripe, não do corpo do evento.
    const subscription = await billing.getSubscription(event.subscriptionId)
    if (!subscription) return NextResponse.json({ ignored: true })

    const userId = await resolveUserId(admin, subscription)
    if (!userId) {
      Sentry.captureMessage(`Assinatura sem dono no Stripe: ${subscription.id}`)
      return NextResponse.json({ ignored: true })
    }

    const subdomains = await applySubscription(admin, userId, subscription)

    // Só marca como processado depois de aplicar: uma falha volta na retentativa do Stripe.
    const { error: markError } = await admin
      .from('stripe_events')
      .upsert({ id: event.id, type: event.type }, { ignoreDuplicates: true })
    if (markError) throw markError

    return NextResponse.json({ status: subscription.status, revalidated: subdomains.length })
  } catch (error) {
    Sentry.captureException(error)
    // 500 faz o Stripe tentar de novo.
    return NextResponse.json({ error: 'Falha ao processar o evento.' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Verificação**

Run: `npm run lint && npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/billing/apply-subscription.ts src/app/api/webhooks/stripe
git commit -m "feat(billing): webhook do Stripe grava a assinatura e congela as vitrines"
```

---

### Task 8: Testes de ponta a ponta do webhook

**Files:**
- Modify: `e2e/helpers.ts`
- Create: `e2e/billing-webhook.spec.ts`

**Interfaces:**
- Produces (helpers):
  - `setSubscription(userId: string, fields: {...}): Promise<void>`
  - `signStripeWebhook(body: string): string`
  - `sendStripeEvent(request: APIRequestContext, type: string, object: Record<string, unknown>, id?: string)`
  - `fakeSubscription(fields: { customerId: string; userId?: string | null; status?: string; interval?: 'month' | 'year'; cancelAtPeriodEnd?: boolean }): Promise<string>` — grava a assinatura falsa e devolve o id

- [ ] **Step 1: Ajudantes de teste**

Acrescente em `e2e/helpers.ts` (e no topo: `import { mkdir, writeFile } from 'node:fs/promises'` junto dos imports que já existem e `import Stripe from 'stripe'`):

```ts
export async function setSubscription(
  userId: string,
  fields: {
    status?: string
    planId?: 'free' | 'pro'
    customerId?: string | null
    subscriptionId?: string | null
    currentPeriodEnd?: string | null
    cancelAtPeriodEnd?: boolean
    graceUntil?: string | null
    proEndedAt?: string | null
  } = {},
) {
  const admin = createAdminClient()
  await admin
    .from('subscriptions')
    .upsert({
      user_id: userId,
      plan_id: fields.planId ?? 'pro',
      status: fields.status ?? 'active',
      stripe_customer_id: fields.customerId ?? null,
      stripe_subscription_id: fields.subscriptionId ?? null,
      current_period_end: fields.currentPeriodEnd ?? null,
      cancel_at_period_end: fields.cancelAtPeriodEnd ?? false,
      grace_until: fields.graceUntil ?? null,
      pro_ended_at: fields.proEndedAt ?? null,
    })
    .throwOnError()
}

export async function setVitrineStatus(vitrineId: string, status: 'active' | 'frozen') {
  await createAdminClient().from('vitrines').update({ status }).eq('id', vitrineId).throwOnError()
}

export async function vitrineStatuses(ownerId: string) {
  const { data } = await createAdminClient()
    .from('vitrines')
    .select('subdomain, status')
    .eq('owner_id', ownerId)
    .order('position')
    .order('created_at')
    .throwOnError()
  return (data ?? []).map((row) => `${row.subdomain}:${row.status}`)
}

export async function readSubscription(userId: string) {
  const { data } = await createAdminClient()
    .from('subscriptions')
    .select('status, plan_id, interval, grace_until, pro_ended_at, cancel_at_period_end, stripe_subscription_id')
    .eq('user_id', userId)
    .maybeSingle()
    .throwOnError()
  return data
}

// Mesma criptografia do Stripe: o driver falso confere a assinatura de verdade.
export function signStripeWebhook(body: string) {
  const stripe = new Stripe('sk_test_e2e')
  return stripe.webhooks.generateTestHeaderString({
    payload: body,
    secret: process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec-ci-somente-para-testes',
  })
}

export async function sendStripeEvent(
  request: APIRequestContext,
  type: string,
  object: Record<string, unknown>,
  id = `evt_fake_${crypto.randomUUID()}`,
) {
  const body = JSON.stringify({ id, object: 'event', type, data: { object } })
  return request.post(`${APP_URL}/api/webhooks/stripe`, {
    data: body,
    headers: { 'content-type': 'application/json', 'stripe-signature': signStripeWebhook(body) },
  })
}

// Escreve direto no armazenamento do driver falso (mesmo formato de fake-billing.ts).
export async function fakeSubscription(fields: {
  customerId: string
  userId?: string | null
  status?: string
  interval?: 'month' | 'year'
  cancelAtPeriodEnd?: boolean
  currentPeriodEnd?: string | null
}) {
  const id = `sub_fake_${crypto.randomUUID()}`
  const dir = path.join(os.tmpdir(), 'agenn-vitrine-billing')
  await mkdir(dir, { recursive: true })
  await writeFile(
    path.join(dir, `${id}.json`),
    JSON.stringify({
      id,
      customerId: fields.customerId,
      userId: fields.userId ?? null,
      status: fields.status ?? 'active',
      interval: fields.interval ?? 'month',
      currentPeriodEnd: fields.currentPeriodEnd ?? new Date(Date.now() + 30 * 86_400_000).toISOString(),
      cancelAtPeriodEnd: fields.cancelAtPeriodEnd ?? false,
    }),
  )
  return id
}
```

- [ ] **Step 2: Teste do webhook**

`e2e/billing-webhook.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { APP_URL } from '../playwright.config'
import {
  createConfirmedUser,
  fakeSubscription,
  readSubscription,
  seedVitrine,
  sendStripeEvent,
  setSubscription,
  setVitrineStatus,
  uniqueSubdomain,
  vitrineStatuses,
} from './helpers'

test('webhook recusa assinatura inválida e ignora evento fora da lista', async ({ request }) => {
  const semAssinatura = await request.post(`${APP_URL}/api/webhooks/stripe`, {
    data: JSON.stringify({ id: 'evt_1', type: 'invoice.paid', data: { object: {} } }),
    headers: { 'content-type': 'application/json' },
  })
  expect(semAssinatura.status()).toBe(401)

  const outroTipo = await sendStripeEvent(request, 'customer.created', { id: 'cus_fake_x', object: 'customer' })
  expect(outroTipo.status()).toBe(200)
  expect(await outroTipo.json()).toEqual({ ignored: true })
})

test('checkout completo deixa a conta Pro e descongela as vitrines', async ({ request }) => {
  const user = await createConfirmedUser('webhook-pro')
  const customerId = `cus_fake_${crypto.randomUUID()}`
  await setSubscription(user.id, { status: 'none', planId: 'free', customerId })

  const primeira = await seedVitrine(user.id, { subdomain: uniqueSubdomain('wh-a') })
  await setSubscription(user.id, { status: 'active', customerId })
  const segunda = await seedVitrine(user.id, { subdomain: uniqueSubdomain('wh-b') })
  await setSubscription(user.id, { status: 'none', planId: 'free', customerId })
  // Como se a conta tivesse voltado ao gratuito antes: a segunda vitrine está congelada.
  await setVitrineStatus(segunda.id, 'frozen')

  const subscriptionId = await fakeSubscription({ customerId, userId: user.id })
  const response = await sendStripeEvent(request, 'checkout.session.completed', {
    id: 'cs_fake_um',
    object: 'checkout.session',
    customer: customerId,
    subscription: subscriptionId,
  })
  expect(response.status()).toBe(200)
  expect((await response.json()).status).toBe('active')

  const row = await readSubscription(user.id)
  expect([row?.status, row?.plan_id, row?.interval]).toEqual(['active', 'pro', 'month'])
  expect(await vitrineStatuses(user.id)).toEqual([`${primeira.subdomain}:active`, `${segunda.subdomain}:active`])
  await expect
    .poll(async () => (await request.get(`http://${segunda.subdomain}.localhost:3000/`)).status())
    .toBe(200)
})

test('evento repetido não é processado duas vezes', async ({ request }) => {
  const user = await createConfirmedUser('webhook-repetido')
  const customerId = `cus_fake_${crypto.randomUUID()}`
  await setSubscription(user.id, { status: 'none', planId: 'free', customerId })
  const subscriptionId = await fakeSubscription({ customerId, userId: user.id })

  const eventId = `evt_fake_${crypto.randomUUID()}`
  const object = { id: 'sub_evento', object: 'subscription', customer: customerId, subscription: subscriptionId }
  const primeira = await sendStripeEvent(request, 'checkout.session.completed', object, eventId)
  expect((await primeira.json()).status).toBe('active')

  const repetida = await sendStripeEvent(request, 'checkout.session.completed', object, eventId)
  expect(await repetida.json()).toEqual({ duplicated: true })
})

test('falha de pagamento dá carência de 7 dias e o cancelamento congela o excedente', async ({ request }) => {
  const user = await createConfirmedUser('webhook-carencia')
  const customerId = `cus_fake_${crypto.randomUUID()}`
  await setSubscription(user.id, { status: 'active', customerId })
  const antiga = await seedVitrine(user.id, { subdomain: uniqueSubdomain('wh-c') })
  const nova = await seedVitrine(user.id, { subdomain: uniqueSubdomain('wh-d') })

  const pastDue = await fakeSubscription({ customerId, userId: user.id, status: 'past_due' })
  await sendStripeEvent(request, 'invoice.payment_failed', {
    id: 'in_fake_1',
    object: 'invoice',
    customer: customerId,
    parent: { type: 'subscription_details', subscription_details: { subscription: pastDue } },
  })
  const emCarencia = await readSubscription(user.id)
  expect(emCarencia?.status).toBe('past_due')
  expect(new Date(emCarencia!.grace_until!).getTime()).toBeGreaterThan(Date.now() + 6 * 86_400_000)
  // Ainda é Pro: as duas vitrines continuam no ar.
  expect((await request.get(`http://${nova.subdomain}.localhost:3000/`)).status()).toBe(200)

  const cancelada = await fakeSubscription({ customerId, userId: user.id, status: 'canceled' })
  await sendStripeEvent(request, 'customer.subscription.deleted', {
    id: cancelada,
    object: 'subscription',
    customer: customerId,
  })
  const encerrada = await readSubscription(user.id)
  expect(encerrada?.status).toBe('canceled')
  expect(encerrada?.pro_ended_at).not.toBeNull()
  expect(await vitrineStatuses(user.id)).toEqual([`${antiga.subdomain}:active`, `${nova.subdomain}:frozen`])

  // Spec 7.1: vitrine congelada continua respondendo 200, com o aviso no lugar do catálogo.
  await expect
    .poll(async () => (await request.get(`http://${nova.subdomain}.localhost:3000/`)).text())
    .toContain('Vitrine indisponível no momento')
  expect(await (await request.get(`http://${antiga.subdomain}.localhost:3000/`)).text()).not.toContain(
    'Vitrine indisponível no momento',
  )
})
```

Observações para quem executa:
- `seedVitrine` só cria a segunda vitrine com a conta em Pro (a trava do banco vale sempre); por isso o teste alterna o status antes de semear.
- Vitrine congelada **não** responde 404: `src/app/v/[subdomain]/page.tsx` devolve 200 com "Vitrine indisponível no momento" (spec 7.1). O 404 é só para subdomínio inexistente. Por isso as asserções olham o corpo, e o `expect.poll` espera a revalidação por tag.

- [ ] **Step 3: Rodar os testes**

Run: `npx playwright test e2e/billing-webhook.spec.ts` (ou confie no CI, que é onde o Supabase local existe)
Expected: 4 testes passando; o total do CI sobe de 84 para 88.

- [ ] **Step 4: PR do bloco**

```bash
npm run lint && npm run typecheck && npm test
git add e2e/helpers.ts e2e/billing-webhook.spec.ts
git commit -m "test(e2e): webhook do Stripe, carência e congelamento"
git push -u origin HEAD
gh pr create --fill --base master
gh pr checks --watch
```

**Antes do merge:** confirme com o usuário que as variáveis do Stripe já estão na Vercel (Bloco 0, seção 5) — sem elas a rota responde 503 em produção. Autorização → merge → conferir no deploy que `POST /api/webhooks/stripe` sem assinatura responde 401.

---
# Bloco 5 — Painel: Plano e assinatura

Branch: `fase-5/bloco-5-painel`.

### Task 9: Consultas e ações da assinatura

**Files:**
- Create: `src/features/billing/queries.ts`, `src/features/billing/actions.ts`

**Interfaces:**
- Consumes: `getPanelSession`, `requireActionUser`, `getBilling` (Task 5), `describeSubscription`/`SubscriptionView` (Task 3), `choose_active_vitrine` (Task 2)
- Produces:
  - `getMySubscription(): Promise<SubscriptionView | null>`
  - `getPlanPrices(): Promise<BillingPrice[]>`
  - `startCheckoutAction(prev: FormState, formData: FormData): Promise<FormState>` (campo `interval`)
  - `openPortalAction(prev: FormState, formData: FormData): Promise<FormState>`
  - `chooseActiveVitrineAction(prev: FormState, formData: FormData): Promise<FormState>` (campo `vitrineId`)

- [ ] **Step 1: Consultas**

`src/features/billing/queries.ts`:

```ts
import 'server-only'
import * as Sentry from '@sentry/nextjs'
import { getPanelSession } from '@/features/vitrines/queries'
import { getBilling } from '@/lib/billing/billing'
import type { SubscriptionView } from '@/lib/billing/status'
import type { BillingPrice } from '@/lib/billing/types'

export async function getMySubscription(): Promise<SubscriptionView | null> {
  const { supabase, userId } = await getPanelSession()
  const { data, error } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id, status, interval, current_period_end, cancel_at_period_end, grace_until, pro_ended_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    ...data,
    interval: data.interval === 'month' || data.interval === 'year' ? data.interval : null,
  }
}

// Preço indisponível não pode derrubar a tela: os botões aparecem sem valor.
export async function getPlanPrices(): Promise<BillingPrice[]> {
  try {
    return await getBilling().listPrices()
  } catch (error) {
    Sentry.captureException(error)
    return []
  }
}
```

- [ ] **Step 2: Ações**

`src/features/billing/actions.ts`:

```ts
'use server'

import * as Sentry from '@sentry/nextjs'
import { redirect } from 'next/navigation'
import { requireActionUser } from '@/lib/auth/action-user'
import { getBilling } from '@/lib/billing/billing'
import type { BillingInterval } from '@/lib/billing/types'
import { env } from '@/lib/env'
import type { FormState } from '@/lib/forms/form-state'
import { buildAppUrl } from '@/lib/hosts/urls'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { revalidateVitrine } from '@/lib/vitrines/cache'
import { mapDbError } from '@/lib/vitrines/db-errors'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CHECKOUT_FAILED = 'Não foi possível abrir o pagamento. Tente de novo em instantes.'
const PORTAL_FAILED = 'Não foi possível abrir o gerenciamento da assinatura. Tente de novo em instantes.'

export async function startCheckoutAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const interval: BillingInterval = formData.get('interval') === 'year' ? 'year' : 'month'
  const { supabase, user } = await requireActionUser()

  let url: string
  try {
    const billing = getBilling()
    const admin = createSupabaseAdminClient()
    const [{ data: row }, { data: profile }] = await Promise.all([
      admin.from('subscriptions').select('stripe_customer_id').eq('user_id', user.id).maybeSingle(),
      supabase.from('profiles').select('name').eq('id', user.id).maybeSingle(),
    ])

    const customerId = await billing.ensureCustomer({
      userId: user.id,
      email: user.email ?? '',
      name: profile?.name ?? '',
      customerId: row?.stripe_customer_id ?? null,
    })
    // Guarda o Customer antes de abrir o checkout: um webhook que chegue primeiro
    // já encontra o dono pela coluna stripe_customer_id.
    if (customerId !== row?.stripe_customer_id) {
      const { error } = await admin.from('subscriptions').upsert({ user_id: user.id, stripe_customer_id: customerId })
      if (error) throw error
    }

    url = await billing.createCheckoutSession({
      userId: user.id,
      customerId,
      priceId: billing.priceIdFor(interval),
      successUrl: buildAppUrl('/painel/plano?assinatura=ok', env.NEXT_PUBLIC_ROOT_DOMAIN),
      cancelUrl: buildAppUrl('/painel/plano', env.NEXT_PUBLIC_ROOT_DOMAIN),
    })
  } catch (error) {
    Sentry.captureException(error)
    return { error: CHECKOUT_FAILED }
  }
  redirect(url)
}

export async function openPortalAction(_prev: FormState, _formData: FormData): Promise<FormState> {
  const { user } = await requireActionUser()

  let url: string
  try {
    const admin = createSupabaseAdminClient()
    const { data: row, error } = await admin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) throw error
    if (!row?.stripe_customer_id) return { error: 'Você ainda não tem assinatura para gerenciar.' }

    url = await getBilling().createPortalSession({
      customerId: row.stripe_customer_id,
      returnUrl: buildAppUrl('/painel/plano', env.NEXT_PUBLIC_ROOT_DOMAIN),
    })
  } catch (error) {
    Sentry.captureException(error)
    return { error: PORTAL_FAILED }
  }
  redirect(url)
}

// Spec 8.7: com mais vitrines do que o plano permite, o dono escolhe qual fica ativa.
export async function chooseActiveVitrineAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const vitrineId = String(formData.get('vitrineId') ?? '')
  if (!UUID.test(vitrineId)) return { error: 'Escolha uma vitrine.' }

  const { supabase } = await requireActionUser()
  const { data: subdomains, error } = await supabase.rpc('choose_active_vitrine', { p_vitrine_id: vitrineId })
  if (error) return { error: mapDbError(error) }

  revalidateVitrine(...(subdomains ?? []))
  return { success: 'Vitrine ativa atualizada.' }
}
```

- [ ] **Step 3: Verificação**

Run: `npm run lint && npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/billing/queries.ts src/features/billing/actions.ts
git commit -m "feat(painel): ações de checkout, portal e escolha da vitrine ativa"
```

---

### Task 10: Tela "Plano e assinatura" e convites para o Pro

**Files:**
- Create: `src/app/app/(painel)/painel/plano/page.tsx`, `src/app/app/(painel)/painel/plano/subscribe-form.tsx`, `src/app/app/(painel)/painel/plano/active-vitrine-form.tsx`
- Modify: `src/app/app/(painel)/layout.tsx`, `src/app/app/(painel)/painel/page.tsx`, `src/app/app/(painel)/painel/vitrines/nova/page.tsx`, `src/app/app/(painel)/painel/vitrines/[id]/aparencia/appearance-form.tsx`

**Interfaces:**
- Consumes: `getMySubscription`, `getPlanPrices` (Task 9), `describeSubscription` (Task 3), `priceCards` (Task 4), `getEntitlements`/`listMyVitrines`/`getVideoUsage` (já existentes)
- Produces: rota `/painel/plano`; componentes `SubscribeForm`, `PortalForm`, `ActiveVitrineForm`

- [ ] **Step 1: Botões de assinatura e portal**

`src/app/app/(painel)/painel/plano/subscribe-form.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { openPortalAction, startCheckoutAction } from '@/features/billing/actions'

export function SubscribeForm({ interval, label }: { interval: 'month' | 'year'; label: string }) {
  const [state, formAction, pending] = useActionState(startCheckoutAction, {})
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="interval" value={interval} />
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {label}
      </Button>
      <FormMessage error={state.error} />
    </form>
  )
}

export function PortalForm() {
  const [state, formAction, pending] = useActionState(openPortalAction, {})
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Button type="submit" variant="secondary" disabled={pending} aria-busy={pending}>
        Gerenciar assinatura
      </Button>
      <FormMessage error={state.error} />
    </form>
  )
}
```

- [ ] **Step 2: Escolha da vitrine ativa**

`src/app/app/(painel)/painel/plano/active-vitrine-form.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { chooseActiveVitrineAction } from '@/features/billing/actions'

export function ActiveVitrineForm({
  vitrines,
  maxVitrines,
}: {
  vitrines: { id: string; name: string; status: string }[]
  maxVitrines: number
}) {
  const [state, formAction, pending] = useActionState(chooseActiveVitrineAction, {})
  const current = vitrines.find((vitrine) => vitrine.status === 'active')?.id ?? vitrines[0]?.id

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium">Escolha qual vitrine fica ativa</legend>
        <p className="text-sm text-ink-muted">
          Seu plano permite {maxVitrines} {maxVitrines === 1 ? 'vitrine' : 'vitrines'}. As outras ficam congeladas, sem
          perder nada, e voltam ao ar quando você assinar o Pro.
        </p>
        {vitrines.map((vitrine) => (
          <label key={vitrine.id} className="flex items-center gap-3">
            <input type="radio" name="vitrineId" value={vitrine.id} defaultChecked={vitrine.id === current} />
            <span>
              {vitrine.name} · {vitrine.status === 'active' ? 'ativa' : 'congelada'}
            </span>
          </label>
        ))}
      </fieldset>
      <FormMessage error={state.error} success={state.success} />
      <Button type="submit" disabled={pending} aria-busy={pending} className="self-start">
        Salvar escolha
      </Button>
    </form>
  )
}
```

- [ ] **Step 3: A tela**

`src/app/app/(painel)/painel/plano/page.tsx`:

```tsx
import { Card } from '@/components/ui/card'
import { getMySubscription, getPlanPrices } from '@/features/billing/queries'
import { getEntitlements, getVideoUsage, listMyVitrines } from '@/features/vitrines/queries'
import { priceCards } from '@/lib/billing/prices'
import { describeSubscription } from '@/lib/billing/status'
import { formatGigabytes } from '@/lib/video/rules'
import { ActiveVitrineForm } from './active-vitrine-form'
import { PortalForm, SubscribeForm } from './subscribe-form'

export const metadata = { title: 'Plano e assinatura' }

const FALLBACK_LABEL: Record<'month' | 'year', string> = {
  month: 'Assinar o plano mensal',
  year: 'Assinar o plano anual',
}

export default async function PlanoPage({ searchParams }: { searchParams: Promise<{ assinatura?: string }> }) {
  const [{ assinatura }, subscription, plan, vitrines, usage, prices] = await Promise.all([
    searchParams,
    getMySubscription(),
    getEntitlements(),
    listMyVitrines(),
    getVideoUsage(),
    getPlanPrices(),
  ])

  const summary = describeSubscription(subscription, new Date())
  const cards = priceCards(prices)
  const intervals: ('month' | 'year')[] = ['month', 'year']
  const overLimit = vitrines.length > plan.max_vitrines

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Plano e assinatura</h1>

      {assinatura === 'ok' ? (
        <Card className="px-5 py-4">
          <p>
            {summary.pro
              ? 'Assinatura confirmada. Bom proveito!'
              : 'Pagamento recebido. Em instantes o Pro aparece aqui.'}
          </p>
        </Card>
      ) : null}

      <Card className="flex flex-col gap-2 px-5 py-4">
        <h2 className="text-lg font-medium">{summary.title}</h2>
        <p className="text-ink-muted">{summary.detail}</p>
        <p className="text-sm text-ink-muted">
          Vitrines: {vitrines.length} de {plan.max_vitrines} · Itens por vitrine: até {plan.max_items_per_vitrine} ·
          Vídeos: {usage.videosCount}
          {plan.max_videos_per_account !== null ? ` de ${plan.max_videos_per_account}` : ''} · Franquia do mês:{' '}
          {formatGigabytes(usage.bytesDelivered)} de {plan.monthly_video_gb} GB
        </p>
        {summary.showPortal ? <PortalForm /> : null}
      </Card>

      {summary.showSubscribe ? (
        <Card className="flex flex-col gap-4 px-5 py-4">
          <div>
            <h2 className="text-lg font-medium">Assinar o Pro</h2>
            <p className="text-sm text-ink-muted">Pagamento no cartão, pelo Stripe. Cancele quando quiser.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {intervals.map((interval) => {
              const card = cards.find((item) => item.interval === interval)
              return (
                <div key={interval} className="flex flex-col gap-2 rounded-control bg-subtle p-4">
                  <p className="font-medium">{card?.title ?? FALLBACK_LABEL[interval]}</p>
                  {card ? <p className="text-sm text-ink-muted">{card.note}</p> : null}
                  <SubscribeForm
                    interval={interval}
                    label={card ? `Assinar por ${card.title}` : FALLBACK_LABEL[interval]}
                  />
                </div>
              )
            })}
          </div>
        </Card>
      ) : null}

      {overLimit ? (
        <Card className="px-5 py-4">
          <ActiveVitrineForm
            vitrines={vitrines.map((vitrine) => ({ id: vitrine.id, name: vitrine.name, status: vitrine.status }))}
            maxVitrines={plan.max_vitrines}
          />
        </Card>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 4: Link "Plano" na navegação**

Em `src/app/app/(painel)/layout.tsx`, dentro do `<nav>`, entre "Simulador" e "Conta":

```tsx
            <Link href="/painel/plano" className="rounded-control px-3 py-2 hover:bg-canvas">
              Plano
            </Link>
```

E troque o bloco do plano no canto direito para levar à tela (o link do nome continua indo para `/painel/conta`):

```tsx
            <Link href="/painel/plano" className="text-xs text-ink-muted hover:underline">
              Plano {plan?.name ?? 'Gratuito'}
            </Link>
```

Atenção: hoje esse texto está **dentro** do `<Link href="/painel/conta">`. Tire o `<span>` de dentro dele e coloque este `<Link>` como irmão, senão vira link dentro de link (HTML inválido e aviso do React).

- [ ] **Step 5: Convites para o Pro apontando para a tela (spec 8.9)**

Em `src/app/app/(painel)/painel/page.tsx`, no `Card` de limite:

```tsx
        <Card className="flex flex-col items-start gap-2 px-5 py-4">
          <p>{mapDbError({ message: 'plan_limit:vitrines', hint: String(plan.max_vitrines) })}</p>
          <Link href="/painel/plano" className={buttonClasses('secondary')}>
            Ver o plano Pro
          </Link>
        </Card>
```

Em `src/app/app/(painel)/painel/vitrines/nova/page.tsx`, no bloco que aparece com o limite atingido, acrescente o mesmo link (o arquivo já importa `Link` e `buttonClasses`; se não importar, acrescente).

Em `src/app/app/(painel)/painel/vitrines/[id]/aparencia/appearance-form.tsx`, dentro da caixa "Recurso do plano Pro":

```tsx
            <div className="rounded-control bg-subtle p-3 text-sm">
              <p className="font-medium">Recurso do plano Pro</p>
              <p className="text-ink-muted">Assine o Pro para usar logo, cor da marca e banner.</p>
              <Link href="/painel/plano" className="underline">
                Ver o plano Pro
              </Link>
            </div>
```

Acrescente `import Link from 'next/link'` no topo do arquivo.

- [ ] **Step 6: Verificação**

Run: `npm run lint && npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add "src/app/app/(painel)"
git commit -m "feat(painel): tela Plano e assinatura e convites para o Pro"
```

---

### Task 11: Testes de ponta a ponta do painel

**Files:**
- Create: `e2e/billing-panel.spec.ts`

**Interfaces:**
- Consumes: helpers `createConfirmedUser`, `seedVitrine`, `signIn`, `uniqueSubdomain`, `vitrineStatuses` (Task 8)

- [ ] **Step 1: Teste do fluxo do painel**

`e2e/billing-panel.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { createConfirmedUser, seedVitrine, signIn, uniqueSubdomain, vitrineStatuses } from './helpers'

test('assina o Pro, cancela pelo portal e escolhe a vitrine que fica ativa', async ({ page }) => {
  const user = await createConfirmedUser('plano')
  const primeira = await seedVitrine(user.id, { name: 'Loja Um', subdomain: uniqueSubdomain('pl-a') })
  await signIn(page, user.email, user.password)

  await page.goto('/painel/plano')
  await expect(page.getByRole('heading', { name: 'Plano Gratuito' })).toBeVisible()

  await page.getByRole('button', { name: 'Assinar por R$ 149,90 por mês' }).click()
  await page.waitForURL(/\/painel\/plano\?assinatura=ok$/)
  await expect(page.getByText('Assinatura confirmada. Bom proveito!')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Plano Pro' })).toBeVisible()
  await expect(page.getByText('Renova em')).toBeVisible()

  // Com o Pro, a segunda vitrine passa na trava do banco.
  const segunda = await seedVitrine(user.id, { name: 'Loja Dois', subdomain: uniqueSubdomain('pl-b') })

  await page.getByRole('button', { name: 'Gerenciar assinatura' }).click()
  await page.waitForURL(/\/api\/dev-billing\/portal/)
  await page.getByRole('link', { name: 'Cancelar agora' }).click()
  await page.waitForURL(/\/painel\/plano$/)
  await expect(page.getByRole('heading', { name: 'Plano Gratuito' })).toBeVisible()

  await expect(page.getByText('Escolha qual vitrine fica ativa')).toBeVisible()
  expect(await vitrineStatuses(user.id)).toEqual([`${primeira.subdomain}:active`, `${segunda.subdomain}:frozen`])

  await page.getByRole('radio', { name: /Loja Dois/ }).check()
  await page.getByRole('button', { name: 'Salvar escolha' }).click()
  await expect(page.getByText('Vitrine ativa atualizada.')).toBeVisible()
  expect(await vitrineStatuses(user.id)).toEqual([`${primeira.subdomain}:frozen`, `${segunda.subdomain}:active`])
})

test('cadeado da aparência e limite de vitrines levam à tela do plano', async ({ page }) => {
  const user = await createConfirmedUser('cadeado')
  const vitrine = await seedVitrine(user.id)
  await signIn(page, user.email, user.password)

  await page.goto(`/painel/vitrines/${vitrine.id}/aparencia`)
  await expect(page.getByText('Recurso do plano Pro')).toBeVisible()
  await page.getByRole('link', { name: 'Ver o plano Pro' }).click()
  await expect(page).toHaveURL(/\/painel\/plano$/)

  await page.goto('/painel/vitrines/nova')
  await page.getByRole('link', { name: 'Ver o plano Pro' }).click()
  await expect(page).toHaveURL(/\/painel\/plano$/)
})

test('assinatura anual mostra a economia', async ({ page }) => {
  const user = await createConfirmedUser('plano-anual')
  await seedVitrine(user.id)
  await signIn(page, user.email, user.password)

  await page.goto('/painel/plano')
  await expect(page.getByText('R$ 1.499,00 por ano')).toBeVisible()
  await expect(page.getByText('Economize 17% em relação ao mensal.')).toBeVisible()

  await page.getByRole('button', { name: 'Assinar por R$ 1.499,00 por ano' }).click()
  await page.waitForURL(/\/painel\/plano\?assinatura=ok$/)
  await expect(page.getByRole('heading', { name: 'Plano Pro' })).toBeVisible()
})
```

Observação: os preços do driver falso são os mesmos da spec (R$ 149,90 e R$ 1.499,00), por isso os rótulos batem com os textos acima.

- [ ] **Step 2: Rodar**

Run: `npx playwright test e2e/billing-panel.spec.ts` (ou confie no CI)
Expected: 3 testes passando; o total sobe de 88 para 91.

- [ ] **Step 3: PR do bloco**

```bash
npm run lint && npm run typecheck && npm test
git add e2e/billing-panel.spec.ts
git commit -m "test(e2e): tela do plano, checkout e escolha da vitrine ativa"
git push -u origin HEAD
gh pr create --fill --base master
gh pr checks --watch
```

Autorização → merge.

---
# Bloco 6 — Tarefa diária: conferência com o Stripe e regra dos 90 dias

Branch: `fase-5/bloco-6-tarefa-diaria`.

### Task 12: Conferência das assinaturas, aviso do dia 83 e limpeza dos 90 dias

**Files:**
- Create: `src/features/billing/reconcile.ts`, `src/features/billing/video-cleanup.ts`
- Modify: `src/app/api/cron/diaria/route.ts`

**Interfaces:**
- Consumes: `getBilling` (Task 5), `applySubscription` (Task 7), `isProNow` (Task 3), `buildVideoCleanupEmail` (Task 4), `videos_to_delete_after_pro` e `accounts_to_warn_video_cleanup` (Task 2), `deleteMediaRows` de `@/lib/media/remove-media`
- Produces:
  - `reconcileSubscriptions(admin: SupabaseClient<Database>): Promise<{ checked: number; updated: number }>`
  - `warnVideoCleanup(admin: SupabaseClient<Database>): Promise<number>`
  - `deleteVideosAfterPro(admin: SupabaseClient<Database>): Promise<number>`
  - `GET /api/cron/diaria` passa a devolver também `subscriptions`, `videoWarnings` e `videosDeleted`

- [ ] **Step 1: Conferência diária (spec 6.4 e 10 — "webhook perdido")**

`src/features/billing/reconcile.ts`:

```ts
import 'server-only'
import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getBilling } from '@/lib/billing/billing'
import { isProNow } from '@/lib/billing/status'
import type { Database } from '@/lib/supabase/database.types'
import { revalidateVitrine } from '@/lib/vitrines/cache'
import { applySubscription } from './apply-subscription'

type Admin = SupabaseClient<Database>

function sameInstant(a: string | null, b: string | null): boolean {
  if (!a || !b) return !a && !b
  return new Date(a).getTime() === new Date(b).getTime()
}

// Spec 10: se um webhook se perder, a conferência diária corrige.
export async function reconcileSubscriptions(admin: Admin, limit = 500): Promise<{ checked: number; updated: number }> {
  const { data: rows, error } = await admin
    .from('subscriptions')
    .select('user_id, stripe_subscription_id, status, current_period_end, cancel_at_period_end, grace_until')
    .not('stripe_subscription_id', 'is', null)
    .limit(limit)
  if (error) throw error

  const billing = getBilling()
  let updated = 0

  for (const row of rows ?? []) {
    try {
      const subscription = await billing.getSubscription(row.stripe_subscription_id!)
      if (!subscription) continue

      const unchanged =
        subscription.status === row.status &&
        subscription.cancelAtPeriodEnd === row.cancel_at_period_end &&
        sameInstant(subscription.currentPeriodEnd, row.current_period_end)

      if (unchanged) {
        // A carência vence com o tempo, sem evento novo: o congelamento também.
        if (row.status === 'past_due' && !isProNow(row, new Date())) {
          const { data: subdomains, error: syncError } = await admin.rpc('sync_vitrine_status', {
            p_user_id: row.user_id,
          })
          if (syncError) throw syncError
          revalidateVitrine(...(subdomains ?? []))
        }
        continue
      }

      await applySubscription(admin, row.user_id, subscription)
      updated++
    } catch (error) {
      // Uma assinatura com problema não pode parar a fila.
      Sentry.captureException(error)
    }
  }

  return { checked: rows?.length ?? 0, updated }
}
```

- [ ] **Step 2: Aviso do dia 83 e limpeza dos 90 dias**

`src/features/billing/video-cleanup.ts`:

```ts
import 'server-only'
import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email/send-email'
import { buildVideoCleanupEmail } from '@/lib/email/video-cleanup-email'
import { env } from '@/lib/env'
import { buildAppUrl } from '@/lib/hosts/urls'
import { deleteMediaRows } from '@/lib/media/remove-media'
import type { Database } from '@/lib/supabase/database.types'
import { revalidateVitrine } from '@/lib/vitrines/cache'

type Admin = SupabaseClient<Database>

const DAY_MS = 86_400_000
const WARN_DAYS = 83
const DELETE_DAYS = 90
const BATCH = 100

// Spec 6.4: o aviso sai no dia 83, sete dias antes de apagar.
export async function warnVideoCleanup(admin: Admin): Promise<number> {
  const { data: accounts, error } = await admin.rpc('accounts_to_warn_video_cleanup', { p_warn_days: WARN_DAYS })
  if (error) throw error

  let sent = 0
  for (const account of accounts ?? []) {
    try {
      const { data: userData, error: userError } = await admin.auth.admin.getUserById(account.user_id)
      if (userError) throw userError
      const email = userData.user?.email
      if (!email) continue

      const { data: profile } = await admin.from('profiles').select('name').eq('id', account.user_id).maybeSingle()
      const proEndedAt = new Date(account.pro_ended_at)
      const message = buildVideoCleanupEmail({
        ownerName: profile?.name ?? '',
        videosCount: account.videos_to_delete,
        proEndedAt,
        deleteAt: new Date(proEndedAt.getTime() + DELETE_DAYS * DAY_MS),
        panelUrl: buildAppUrl('/painel/plano', env.NEXT_PUBLIC_ROOT_DOMAIN),
      })
      await sendEmail({
        to: email,
        ...message,
        idempotencyKey: `video-cleanup-${account.user_id}-${proEndedAt.toISOString().slice(0, 10)}`,
      })
      sent++
    } catch (error) {
      // Um e-mail que falha não pode parar a fila.
      Sentry.captureException(error)
    }
  }
  return sent
}

// Spec 6.4: 90 dias depois do fim do Pro, os vídeos que passam do limite do
// gratuito saem do banco e do Bunny. O primeiro vídeo fica (spec 4.7).
export async function deleteVideosAfterPro(admin: Admin): Promise<number> {
  const { data: rows, error } = await admin.rpc('videos_to_delete_after_pro', { p_days: DELETE_DAYS })
  if (error) throw error

  const list = rows ?? []
  for (let start = 0; start < list.length; start += BATCH) {
    await deleteMediaRows(admin, list.slice(start, start + BATCH))
  }
  revalidateVitrine(...list.map((row) => row.subdomain))
  return list.length
}
```

- [ ] **Step 3: Ligar na tarefa diária**

Em `src/app/api/cron/diaria/route.ts`, acrescente os imports:

```ts
import { reconcileSubscriptions } from '@/features/billing/reconcile'
import { deleteVideosAfterPro, warnVideoCleanup } from '@/features/billing/video-cleanup'
```

Troque o comentário do topo por:

```ts
// Spec 6.4: mídias órfãs e falhas, pedidos expirados, limites antigos, revalidação de
// quem estourou a franquia, conferência das assinaturas com o Stripe, aviso do dia 83
// e limpeza dos vídeos 90 dias depois do fim do Pro.
```

E, dentro do `try`, depois do bloco `subdomains_over_quota_last_month` e antes do `return`:

```ts
    const subscriptions = await reconcileSubscriptions(admin)
    const videoWarnings = await warnVideoCleanup(admin)
    const videosDeleted = await deleteVideosAfterPro(admin)
```

Acrescente os três no corpo da resposta:

```ts
    return NextResponse.json({
      media: rows.length,
      orders: expired?.[0]?.orders_deleted ?? 0,
      rateLimits: expired?.[0]?.rate_limits_deleted ?? 0,
      revalidated: subdomains?.length ?? 0,
      subscriptions,
      videoWarnings,
      videosDeleted,
    })
```

- [ ] **Step 4: Verificação**

Run: `npm run lint && npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/billing/reconcile.ts src/features/billing/video-cleanup.ts src/app/api/cron/diaria/route.ts
git commit -m "feat(cron): conferência das assinaturas, aviso do dia 83 e limpeza dos 90 dias"
```

---

### Task 13: Testes de ponta a ponta da tarefa diária

**Files:**
- Modify: `e2e/cron.spec.ts`

**Interfaces:**
- Consumes: helpers `setSubscription`, `readSubscription`, `fakeSubscription` (Task 8), `seedItem`, `seedVideo`, `readFakeEmails` (já existentes)

- [ ] **Step 1: Três testes novos**

Acrescente em `e2e/cron.spec.ts` (e complete os imports com
`fakeSubscription, readFakeEmails, readSubscription, seedItem, seedVideo, setSubscription`):

```ts
const DAY_MS = 86_400_000

test('90 dias depois do fim do Pro, os vídeos excedentes são apagados', async ({ request }) => {
  const user = await createConfirmedUser('cron-90-dias')
  await setSubscription(user.id, { status: 'active' })
  const vitrine = await seedVitrine(user.id)
  const primeiro = await seedItem(vitrine, user.id, { name: 'Com vídeo 1' })
  const segundo = await seedItem(vitrine, user.id, { name: 'Com vídeo 2' })
  const mantido = await seedVideo(vitrine, user.id, primeiro.id)
  const apagado = await seedVideo(vitrine, user.id, segundo.id)
  await setSubscription(user.id, {
    status: 'canceled',
    proEndedAt: new Date(Date.now() - 100 * DAY_MS).toISOString(),
  })

  const response = await request.get(`${APP_URL}/api/cron/diaria`, {
    headers: { authorization: `Bearer ${secret}` },
  })
  expect(response.status()).toBe(200)
  expect((await response.json()).videosDeleted).toBeGreaterThanOrEqual(1)

  const admin = createAdminClient()
  const { data: restantes } = await admin.from('media').select('id').in('id', [mantido.id, apagado.id])
  expect((restantes ?? []).map((row) => row.id)).toEqual([mantido.id])
})

test('no dia 83 o dono recebe o aviso por e-mail', async ({ request }) => {
  const user = await createConfirmedUser('cron-aviso')
  await setSubscription(user.id, { status: 'active' })
  const vitrine = await seedVitrine(user.id)
  const primeiro = await seedItem(vitrine, user.id, { name: 'Vídeo A' })
  const segundo = await seedItem(vitrine, user.id, { name: 'Vídeo B' })
  await seedVideo(vitrine, user.id, primeiro.id)
  await seedVideo(vitrine, user.id, segundo.id)
  await setSubscription(user.id, {
    status: 'canceled',
    proEndedAt: new Date(Date.now() - 83 * DAY_MS - 2 * 60 * 60 * 1000).toISOString(),
  })

  const response = await request.get(`${APP_URL}/api/cron/diaria`, {
    headers: { authorization: `Bearer ${secret}` },
  })
  expect(response.status()).toBe(200)

  const emails = await readFakeEmails(user.email)
  const aviso = emails.find((email) => email.subject === 'Seus vídeos serão apagados em 7 dias')
  expect(aviso?.text).toContain('1 vídeo será apagado')
})

test('a conferência diária corrige uma assinatura cancelada sem webhook', async ({ request }) => {
  const user = await createConfirmedUser('cron-conferencia')
  const customerId = `cus_fake_${crypto.randomUUID()}`
  const subscriptionId = await fakeSubscription({ customerId, userId: user.id, status: 'canceled' })
  // O banco ainda acha que está ativa: é o webhook que se perdeu.
  await setSubscription(user.id, { status: 'active', customerId, subscriptionId })

  const response = await request.get(`${APP_URL}/api/cron/diaria`, {
    headers: { authorization: `Bearer ${secret}` },
  })
  expect(response.status()).toBe(200)
  expect((await response.json()).subscriptions.updated).toBeGreaterThanOrEqual(1)

  const row = await readSubscription(user.id)
  expect(row?.status).toBe('canceled')
  expect(row?.pro_ended_at).not.toBeNull()
})
```

Observação: o vídeo do **primeiro** item continua no ar porque o gratuito mostra 1 vídeo (spec 4.7); por isso o e-mail fala em "1 vídeo será apagado" quando há 2.

- [ ] **Step 2: Rodar**

Run: `npx playwright test e2e/cron.spec.ts` (ou confie no CI)
Expected: 4 testes no arquivo; total do CI sobe de 91 para 94.

- [ ] **Step 3: PR do bloco**

```bash
npm run lint && npm run typecheck && npm test
git add e2e/cron.spec.ts
git commit -m "test(e2e): regra dos 90 dias, aviso do dia 83 e conferência com o Stripe"
git push -u origin HEAD
gh pr create --fill --base master
gh pr checks --watch
```

Autorização → merge → conferir no deploy que `GET /api/cron/diaria` sem segredo responde 401.

---

# Bloco 7 — Fechamento

Branch: `fase-5/bloco-7-fechamento`.

### Task 14: Fluxo completo do Pro e conferência em produção

**Files:**
- Modify: `e2e/fluxo-completo.spec.ts`
- Create: `docs/setup/fase-5-conferencia.md`

- [ ] **Step 1: Fluxo completo (spec 11 — bloqueios do gratuito e congelamento)**

Acrescente em `e2e/fluxo-completo.spec.ts` (complete os imports com
`uniqueSubdomain, vitrineStatuses`):

```ts
test('Pro: marca d’água some ao assinar e volta ao cancelar, congelando a segunda vitrine', async ({ page }) => {
  const user = await createConfirmedUser('fluxo-pro')
  const primeira = await seedVitrine(user.id, { name: 'Loja Pro', subdomain: uniqueSubdomain('fp-a') })
  await seedItem(primeira, user.id, { name: 'Camiseta', priceCents: 5990 })
  await signIn(page, user.email, user.password)

  await page.goto(`http://${primeira.subdomain}.localhost:3000/`)
  await expect(page.getByText('Feito com Agenn Vitrine')).toBeVisible()

  await page.goto('/painel/plano')
  await page.getByRole('button', { name: 'Assinar por R$ 149,90 por mês' }).click()
  await page.waitForURL(/\/painel\/plano\?assinatura=ok$/)
  await expect(page.getByRole('heading', { name: 'Plano Pro' })).toBeVisible()

  // A revalidação por tag acontece no webhook: a vitrine é gerada de novo sem marca d'água.
  await page.goto(`http://${primeira.subdomain}.localhost:3000/`)
  await expect(page.getByText('Feito com Agenn Vitrine')).toBeHidden()

  const segunda = await seedVitrine(user.id, { name: 'Loja Dois', subdomain: uniqueSubdomain('fp-b') })
  await page.goto(`http://${segunda.subdomain}.localhost:3000/`)
  await expect(page.getByRole('heading', { name: 'Loja Dois' })).toBeVisible()

  await page.goto('/painel/plano')
  await page.getByRole('button', { name: 'Gerenciar assinatura' }).click()
  await page.waitForURL(/\/api\/dev-billing\/portal/)
  await page.getByRole('link', { name: 'Cancelar agora' }).click()
  await page.waitForURL(/\/painel\/plano$/)

  expect(await vitrineStatuses(user.id)).toEqual([`${primeira.subdomain}:active`, `${segunda.subdomain}:frozen`])
  await page.goto(`http://${primeira.subdomain}.localhost:3000/`)
  await expect(page.getByText('Feito com Agenn Vitrine')).toBeVisible()
  // Spec 7.1: congelada responde 200 com o aviso no lugar do catálogo.
  await page.goto(`http://${segunda.subdomain}.localhost:3000/`)
  await expect(page.getByRole('heading', { name: 'Vitrine indisponível no momento' })).toBeVisible()
})
```

- [ ] **Step 2: Conferência em produção**

`docs/setup/fase-5-conferencia.md`:

```markdown
# Fase 5 — Conferência em produção

Antes de começar: `docs/setup/fase-5-infra.md` feito (webhook, portal, retentativas e
variáveis na Vercel). Faça o roteiro primeiro em **modo de teste** com o cartão
`4242 4242 4242 4242`, depois repita o essencial em modo ao vivo.

1. **Tela do plano:** `app.agenn.com.br/painel/plano` mostra "Plano Gratuito", o consumo
   (vitrines, itens, vídeos, franquia) e os dois preços vindos do Stripe (R$ 149,90 e
   R$ 1.499,00, com a economia do anual).
2. **Checkout:** "Assinar por R$ 149,90 por mês" abre o Stripe em português, só com cartão.
   Pagar volta para o painel com "Assinatura confirmada".
3. **Assinatura no banco:** no Supabase, `subscriptions` tem `status = active`,
   `stripe_customer_id`, `stripe_subscription_id`, `interval = month` e `current_period_end`.
   No Stripe, o Customer tem `metadata.user_id` igual ao id do usuário.
4. **Pro na prática:** criar a 2ª e a 3ª vitrine; logo, cor da marca e banner deixam de ter
   cadeado; a marca d'água some da vitrine pública; o 11º item é aceito.
5. **Portal:** "Gerenciar assinatura" abre o Customer Portal; cancelar no fim do período
   mostra "Cancelamento agendado: o Pro vale até DD/MM/AAAA" no painel.
6. **Falha de pagamento (modo de teste):** trocar o cartão para `4000 0000 0000 0341` e
   forçar uma cobrança; o painel mostra "Não conseguimos cobrar seu cartão. Atualize o
   pagamento até DD/MM/AAAA" e o Pro continua valendo (carência de 7 dias).
7. **Cancelamento:** cancelar agora pelo portal (ou `stripe subscriptions cancel`) e conferir:
   plano volta a Gratuito, a tela pede "Escolha qual vitrine fica ativa", as outras vitrines
   respondem "Vitrine indisponível no momento", a marca d'água volta e os itens acima de 10
   somem da vitrine (nada é apagado).
8. **Escolha da vitrine ativa:** escolher a segunda vitrine e conferir que ela volta ao ar e a
   primeira congela.
9. **Reassinar:** assinar de novo e conferir que tudo volta sozinho — vitrines, itens, vídeos,
   logo e banner — sem refazer nada.
10. **Webhook:** em Desenvolvedores → Webhooks, todos os eventos com resposta 200. Reenviar um
    evento já entregue deve responder `{"duplicated":true}`.
11. **Tarefa diária:** `curl -H "Authorization: Bearer $CRON_SECRET" https://app.agenn.com.br/api/cron/diaria`
    responde 200 com `subscriptions`, `videoWarnings` e `videosDeleted`. Sem o segredo, 401.

## Pendências registradas

- Excluir conta (cancelar no Stripe e apagar dados e mídias) fica na Fase 6.
- Pix e boleto continuam fora do escopo (spec 13).
- A regra dos 90 dias só apaga **vídeos**; itens acima de 10 nunca são apagados (spec 4.7).
- O aviso do dia 83 depende de `EMAIL_DRIVER=resend` configurado na Fase 3.
- Sem Stripe CLI no CI: a integração real é conferida por este roteiro.
```

- [ ] **Step 3: PR e fechamento**

```bash
npm run lint && npm run typecheck && npm test
git add e2e/fluxo-completo.spec.ts docs/setup/fase-5-conferencia.md
git commit -m "test(e2e): fluxo completo do Pro; docs: conferência da Fase 5"
git push -u origin HEAD
gh pr create --fill --base master
gh pr checks --watch
```

Autorização → merge → conferência com o usuário → memória `fase-5-pendencias`.

---

## Cobertura da spec nesta fase

| Spec | Onde |
|---|---|
| 3 — preço do Pro (mensal e anual, só cartão) | Tasks 1, 4, 5, 10 |
| 4.1 — `stripe_events`, colunas de `subscriptions` | Tasks 2, 3, 7 |
| 4.7 — congelamento e o que o gratuito mostra | Tasks 2, 7, 14 (já implementado na geração da página nas Fases 2–3) |
| 4.8 — só o servidor escreve assinatura e eventos | Tasks 2 (grants e pgTAP), 7 |
| 6.4 — conferência diária com o Stripe, aviso do dia 83, regra dos 90 dias | Tasks 2, 12, 13 |
| 7.1 — vitrine congelada some do ar; revalidação ao mudar de plano | Tasks 7, 14 |
| 8.2 — uso do plano no painel | Task 10 |
| 8.7 — plano, consumo, assinar, gerenciar, escolher a vitrine ativa | Tasks 9, 10, 11 |
| 8.9 — cadeado e selo levam ao convite | Tasks 10, 11 |
| 9 — checkout, Customer com `metadata.user_id`, webhook, idempotência, mapeamento de status, carência de 7 dias, cancelamento no fim do período | Tasks 3, 5, 7, 8 |
| 10 — webhook perdido (conferência diária), limite de plano com convite, erro de checkout em português | Tasks 9, 10, 12 |
| 11 — unitários (status, preços, e-mail), integração (webhook), e2e (bloqueios do gratuito, congelamento) | Tasks 3, 4, 8, 11, 13, 14 |
| 12 — Fase 5 completa | Todas |

## Fora desta fase

- **Excluir conta** (spec 8.8) e QR Code, termos e política: Fase 6.
- **Pix, boleto e planos pagos adicionais** (spec 13): fora do escopo.
- **Fase de design** (visual do painel e da vitrine): fase dedicada, depois.
