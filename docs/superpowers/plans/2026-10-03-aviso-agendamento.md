# Aviso de agendamento para o dono — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Todo agendamento feito pela vitrine avisa o dono por e-mail (chave liga/desliga) e por Web Push nos aparelhos onde ele ativou.

**Architecture:** O `POST /api/agendamentos` agenda com `after()` o `notifyOwnerOfAppointment`, que carrega o agendamento e o dono e entrega pelos dois canais com `Promise.allSettled` (um falhar não derruba o outro). Textos saem de funções puras; o envio de push fica atrás de `sendPush` com drivers `webpush`/`fake`/`off`, no mesmo formato do `sendEmail`. A aba Conta ganha o cartão "Avisos de agendamento" (chave do e-mail + ativar push no aparelho), e o `public/sw.js` passa a mostrar a notificação.

**Tech Stack:** Next 16.3.5 (App Router, server actions, `after`), Supabase (Postgres + RLS, pgTAP), `web-push` 3.x, zod 4, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-03-aviso-agendamento-design.md`

## Global Constraints

- Branch `feat/aviso-agendamento` (já criado, em cima de `feat/logo-preco-supabase-afiliado`).
- Marca visível ao usuário: **Vitrimove** (nunca "Agenn" em texto de tela/e-mail/notificação). E-mails assinam "Equipe Vitrimove".
- Horários no fuso de São Paulo, **UTC−3 fixo** (mesma regra de `src/lib/booking/availability.ts`).
- Avisos nunca atrasam nem mudam a resposta do agendamento: rodam em `after()`, erros vão ao Sentry.
- Chave de idempotência do e-mail: `appointment-<id do agendamento>`.
- Drivers falsos (`PUSH_DRIVER=fake`) proibidos em produção (`APP_ENV`/`VERCEL_ENV` = `production`).
- `VAPID_SUBJECT` = `mailto:agenn.sistema@gmail.com` em produção.
- `src/lib/supabase/database.types.ts` é escrito à mão e precisa bater **exatamente** com o gerado (o CI faz `git diff --exit-code`): tabelas em ordem alfabética, colunas em ordem alfabética.
- Arquivos de código com `'server-only'` não podem ser importados por testes vitest (exceto `import type`).
- Sem Docker local: `npm run test:db` e `npm run test:e2e` rodam no CI do PR. Localmente: `npm test`, `npm run lint`, `npm run typecheck`.
- Comentários em português, curtos, no tom do código vizinho.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Agendamento perto da meia-noite** (ex.: 23:30 em SP = 02:30Z do dia seguinte) — data e dia da semana do aviso têm de ser os de São Paulo, não os de UTC. Teste em Task 3.
2. **Inscrição de push expirada (404/410)** convivendo com uma válida — a válida recebe e a expirada some do banco, sem erro no Sentry. Teste em Task 4 (unitário) e Task 6 (e2e).
3. **Falha do Resend com push ligado** — o push sai mesmo assim e a falha é reportada. Teste em Task 4.
4. **Mesmo aparelho ativado por outra conta** — a inscrição passa para a conta nova e a antiga deixa de receber. Teste em Task 2 (RLS impede a conta nova de ver a linha antiga) + Task 8 (action usa upsert pelo service_role).
5. **Observação com HTML** (`<b>oi</b>`) ou nome com `&` — o e-mail escapa o conteúdo. Teste em Task 3.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/server-env-schema.ts` (+test) | `parsePushEnv` — driver e chaves VAPID |
| `src/lib/server-env.ts` | `getPushEnv` |
| `src/lib/env-schema.ts` (+test), `src/lib/env.ts` | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` |
| `supabase/migrations/20261003000000_aviso_agendamento.sql` | coluna `notify_booking_email`, tabela `push_subscriptions` + RLS |
| `supabase/tests/database/16_aviso_agendamento.test.sql` | RLS de `push_subscriptions` e grant da chave |
| `src/lib/supabase/database.types.ts` | tipos à mão |
| `src/lib/notifications/appointment-message.ts` (+test) | textos do e-mail e do push (puro) |
| `src/lib/push/types.ts` | `PushTarget`, `PushPayload`, `PushResult` |
| `src/lib/push/send-push.ts` | `sendPush` com drivers (server-only) |
| `src/features/booking/deliver-notice.ts` (+test) | decide e dispara os canais (puro, deps injetadas) |
| `src/features/booking/notify-owner.ts` | carrega dados do banco e chama `deliverAppointmentNotice` (server-only) |
| `src/app/api/agendamentos/route.ts` | chama o aviso em `after()` |
| `public/sw.js` | eventos `push` e `notificationclick` |
| `src/lib/notifications/push-support.ts` (+test) | estado de suporte no navegador, detecção de iOS, chave VAPID em bytes (puro) |
| `src/lib/notifications/push-subscription.ts` (+test) | schema zod da inscrição |
| `src/features/notifications/actions.ts` | server actions (chave do e-mail, salvar/remover inscrição, teste) |
| `src/app/app/(painel)/painel/conta/booking-notices.tsx` | cartão cliente |
| `src/app/app/(painel)/painel/conta/page.tsx` | monta o cartão para vitrine de serviços |
| `src/lib/legal/privacy.ts`, `src/lib/legal/company.ts`, `src/lib/legal/legal.test.ts` | privacidade |
| `e2e/helpers.ts`, `e2e/aviso-agendamento.spec.ts` | e2e |
| `.github/workflows/ci.yml`, `.env.example`, `docs/setup/aviso-agendamento.md` | ambiente e roteiro |

---

### Task 1: Variáveis de ambiente do push

**Files:**
- Modify: `src/lib/server-env-schema.ts` (acrescentar no fim, depois de `parseNetlifyDomainsEnv`)
- Modify: `src/lib/server-env.ts`
- Modify: `src/lib/server-env-schema.test.ts`
- Modify: `src/lib/env-schema.ts`, `src/lib/env.ts`, `src/lib/env-schema.test.ts`
- Modify: `.env.example`, `.github/workflows/ci.yml`

**Interfaces:**
- Produces: `parsePushEnv(source): PushEnv`, `type PushEnv = { driver: 'off' } | { driver: 'fake' } | { driver: 'webpush'; publicKey: string; privateKey: string; subject: string }`, `getPushEnv(): PushEnv`, `env.NEXT_PUBLIC_VAPID_PUBLIC_KEY: string` (trim, padrão `''`).

- [ ] **Step 1: Testes que falham** — acrescentar em `src/lib/server-env-schema.test.ts` (incluir `parsePushEnv` no import):

```ts
describe('parsePushEnv', () => {
  const keys = {
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'BPub',
    VAPID_PRIVATE_KEY: 'priv',
    VAPID_SUBJECT: 'mailto:agenn.sistema@gmail.com',
  }

  it('desligado por padrão', () => {
    expect(parsePushEnv({})).toEqual({ driver: 'off' })
  })

  it('webpush exige as três chaves e subject mailto: ou https:', () => {
    expect(() => parsePushEnv({ PUSH_DRIVER: 'webpush' })).toThrow(/VAPID/)
    expect(() => parsePushEnv({ PUSH_DRIVER: 'webpush', ...keys, VAPID_SUBJECT: 'agenn' })).toThrow(/VAPID_SUBJECT/)
    expect(parsePushEnv({ PUSH_DRIVER: 'webpush', ...keys })).toEqual({
      driver: 'webpush',
      publicKey: 'BPub',
      privateKey: 'priv',
      subject: 'mailto:agenn.sistema@gmail.com',
    })
  })

  it('fake só fora de produção', () => {
    expect(parsePushEnv({ PUSH_DRIVER: 'fake' })).toEqual({ driver: 'fake' })
    expect(() => parsePushEnv({ PUSH_DRIVER: 'fake', APP_ENV: 'production' })).toThrow(/produção/)
  })
})
```

E em `src/lib/env-schema.test.ts`, dentro do `describe('parseEnv')`:

```ts
  it('chave pública do push: vazia por padrão e sem espaços', () => {
    expect(parseEnv(base).NEXT_PUBLIC_VAPID_PUBLIC_KEY).toBe('')
    expect(parseEnv({ ...base, NEXT_PUBLIC_VAPID_PUBLIC_KEY: ' BPub ' }).NEXT_PUBLIC_VAPID_PUBLIC_KEY).toBe('BPub')
  })
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/server-env-schema.test.ts src/lib/env-schema.test.ts`
Expected: FAIL (`parsePushEnv` não exportado; propriedade `undefined`).

- [ ] **Step 3: Implementar** — no fim de `src/lib/server-env-schema.ts`:

```ts
// Notificação push do aviso de agendamento. Sem driver (local, CI sem e2e) nada é enviado.
const pushSchema = z
  .object({
    PUSH_DRIVER: z.enum(['off', 'fake', 'webpush']).default('off'),
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().trim().default(''),
    VAPID_PRIVATE_KEY: z.string().trim().default(''),
    VAPID_SUBJECT: z.string().trim().default(''),
    APP_ENV: z.string().optional(),
    VERCEL_ENV: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.PUSH_DRIVER === 'webpush') {
      if (!value.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !value.VAPID_PRIVATE_KEY || !value.VAPID_SUBJECT) {
        ctx.addIssue({ code: 'custom', message: 'NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e VAPID_SUBJECT são obrigatórias com PUSH_DRIVER=webpush.' })
      } else if (!/^(mailto:|https:)/.test(value.VAPID_SUBJECT)) {
        ctx.addIssue({ code: 'custom', message: 'VAPID_SUBJECT precisa começar com mailto: ou https:.' })
      }
    }
    if (value.PUSH_DRIVER === 'fake' && inProduction(value)) {
      ctx.addIssue({ code: 'custom', message: 'PUSH_DRIVER=fake não pode ser usado em produção.' })
    }
  })

export type PushEnv =
  | { driver: 'off' }
  | { driver: 'fake' }
  | { driver: 'webpush'; publicKey: string; privateKey: string; subject: string }

export function parsePushEnv(source: Source): PushEnv {
  const value = pushSchema.parse(source)
  if (value.PUSH_DRIVER === 'webpush') {
    return {
      driver: 'webpush',
      publicKey: value.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      privateKey: value.VAPID_PRIVATE_KEY,
      subject: value.VAPID_SUBJECT,
    }
  }
  return { driver: value.PUSH_DRIVER }
}
```

Em `src/lib/server-env.ts`: acrescentar `parsePushEnv` ao import (ordem alfabética) e, no fim:

```ts
export const getPushEnv = () => parsePushEnv(process.env)
```

Em `src/lib/env-schema.ts`, depois de `NEXT_PUBLIC_VIDEO_CDN_BASE_URL`:

```ts
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().trim().default(''),
```

Em `src/lib/env.ts`, no objeto passado a `parseEnv`:

```ts
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
```

Em `.env.example`, logo depois do bloco `EMAIL_FROM=...`:

```
# Notificação push do aviso de agendamento: off (padrão), fake (CI/local, grava em disco) ou webpush
# Gere o par com: npx web-push generate-vapid-keys
PUSH_DRIVER=off
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:agenn.sistema@gmail.com
```

Em `.github/workflows/ci.yml`, no `env:` do job de e2e, logo depois de `EMAIL_DRIVER: fake`:

```yaml
      PUSH_DRIVER: fake
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/server-env-schema.test.ts src/lib/env-schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server-env-schema.ts src/lib/server-env-schema.test.ts src/lib/server-env.ts src/lib/env-schema.ts src/lib/env-schema.test.ts src/lib/env.ts .env.example .github/workflows/ci.yml
git commit -m "feat(push): variáveis de ambiente do aviso por notificação

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Banco — chave do e-mail e tabela de inscrições

**Files:**
- Create: `supabase/migrations/20261003000000_aviso_agendamento.sql`
- Create: `supabase/tests/database/16_aviso_agendamento.test.sql`
- Modify: `src/lib/supabase/database.types.ts` (bloco `profiles` ~linha 850 e nova tabela entre `profiles` e `rate_limits`)

**Interfaces:**
- Produces: `profiles.notify_booking_email boolean` (padrão `true`, `authenticated` pode atualizar a própria); tabela `push_subscriptions (id, owner_id, endpoint unique, p256dh, auth, user_agent, created_at)`.

- [ ] **Step 1: Teste pgTAP que falha** — `supabase/tests/database/16_aviso_agendamento.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000007a1', 'ana@aviso.com'),
  ('00000000-0000-0000-0000-0000000007a2', 'bia@aviso.com');

select is(
  (select notify_booking_email from public.profiles where id = '00000000-0000-0000-0000-0000000007a1'),
  true, 'e-mail de agendamento vem ligado'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000007a1","role":"authenticated"}', true);

select lives_ok(
  $$ update public.profiles set notify_booking_email = false where id = '00000000-0000-0000-0000-0000000007a1' $$,
  'dono desliga o próprio e-mail'
);
select lives_ok(
  $$ insert into public.push_subscriptions (owner_id, endpoint, p256dh, auth)
     values ('00000000-0000-0000-0000-0000000007a1', 'https://push.example/ana', 'p', 'a') $$,
  'dono cadastra o próprio aparelho'
);
select throws_ok(
  $$ insert into public.push_subscriptions (owner_id, endpoint, p256dh, auth)
     values ('00000000-0000-0000-0000-0000000007a2', 'https://push.example/bia', 'p', 'a') $$,
  '42501', null, 'não cadastra aparelho em nome de outro'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000007a2","role":"authenticated"}', true);
select is((select count(*)::int from public.push_subscriptions), 0, 'outro dono não vê os aparelhos da Ana');
delete from public.push_subscriptions where endpoint = 'https://push.example/ana';

reset role;
select is(
  (select count(*)::int from public.push_subscriptions where endpoint = 'https://push.example/ana'),
  1, 'outro dono não apaga o aparelho da Ana'
);

delete from auth.users where id = '00000000-0000-0000-0000-0000000007a1';
select is(
  (select count(*)::int from public.push_subscriptions where endpoint = 'https://push.example/ana'),
  0, 'excluir a conta apaga os aparelhos'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Migração** — `supabase/migrations/20261003000000_aviso_agendamento.sql`:

```sql
-- Aviso de agendamento para o dono: e-mail (com chave) e notificação push por aparelho.

alter table public.profiles add column notify_booking_email boolean not null default true;
grant update (notify_booking_email) on public.profiles to authenticated;

-- Um aparelho (endpoint do navegador) pertence a uma conta só. Quem envia é o service_role.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text not null default '',
  created_at timestamptz not null default now()
);

create index push_subscriptions_owner_idx on public.push_subscriptions (owner_id);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, delete on public.push_subscriptions to authenticated;

create policy "dono lê os próprios aparelhos" on public.push_subscriptions
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "dono cadastra os próprios aparelhos" on public.push_subscriptions
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "dono apaga os próprios aparelhos" on public.push_subscriptions
  for delete to authenticated using ((select auth.uid()) = owner_id);
```

- [ ] **Step 3: Tipos à mão** — em `src/lib/supabase/database.types.ts`, no bloco `profiles`, acrescentar `notify_booking_email` entre `name` e `updated_at` nos três formatos:

```ts
        Row: {
          active_session_id: string | null
          created_at: string
          id: string
          name: string
          notify_booking_email: boolean
          updated_at: string
        }
        Insert: {
          active_session_id?: string | null
          created_at?: string
          id: string
          name?: string
          notify_booking_email?: boolean
          updated_at?: string
        }
        Update: {
          active_session_id?: string | null
          created_at?: string
          id?: string
          name?: string
          notify_booking_email?: boolean
          updated_at?: string
        }
```

E, entre o fechamento de `profiles` (`Relationships: []` + `}`) e `rate_limits: {`:

```ts
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          owner_id: string
          p256dh: string
          user_agent: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          owner_id: string
          p256dh: string
          user_agent?: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          owner_id?: string
          p256dh?: string
          user_agent?: string
        }
        Relationships: []
      }
```

- [ ] **Step 4: Conferir o que dá localmente**

Run: `npm run typecheck`
Expected: PASS. (pgTAP e a comparação dos tipos gerados rodam no job `db` do CI do PR.)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261003000000_aviso_agendamento.sql supabase/tests/database/16_aviso_agendamento.test.sql src/lib/supabase/database.types.ts
git commit -m "feat(db): chave do e-mail de agendamento e aparelhos com push

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Textos do aviso (e-mail e push)

**Files:**
- Create: `src/lib/notifications/appointment-message.ts`
- Test: `src/lib/notifications/appointment-message.test.ts`

**Interfaces:**
- Consumes: `escapeHtml` (`src/lib/email/html.ts`), `formatPhone` (`src/lib/whatsapp/phone.ts`).
- Produces:
  - `type AppointmentNotice = { id: string; serviceName: string; startsAt: string; professionalName: string | null; customerName: string; customerPhone: string; notes: string | null }`
  - `appointmentWhen(startsAt: string): { day: string; time: string }` — ex. `{ day: 'sáb 03/10', time: '14:00' }`
  - `buildAppointmentEmail(notice: AppointmentNotice, input: { ownerName: string; agendaUrl: string }): { subject: string; text: string; html: string }`
  - `buildAppointmentPush(notice: AppointmentNotice): PushPayload` (`PushPayload` de `src/lib/push/types.ts`, criado aqui)
  - `src/lib/push/types.ts`: `PushTarget = { endpoint: string; p256dh: string; auth: string }`, `PushPayload = { title: string; body: string; url: string; tag: string }`, `PushResult = 'sent' | 'gone' | 'off'`

- [ ] **Step 1: Teste que falha** — `src/lib/notifications/appointment-message.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { appointmentWhen, buildAppointmentEmail, buildAppointmentPush, type AppointmentNotice } from './appointment-message'

const notice: AppointmentNotice = {
  id: '11111111-1111-4111-8111-111111111111',
  serviceName: 'Corte',
  startsAt: '2026-10-03T17:00:00.000Z',
  professionalName: null,
  customerName: 'Maria Silva',
  customerPhone: '+5511988887777',
  notes: null,
}

describe('appointmentWhen', () => {
  it('dia e hora em São Paulo', () => {
    expect(appointmentWhen('2026-10-03T17:00:00.000Z')).toEqual({ day: 'sáb 03/10', time: '14:00' })
  })

  it('perto da meia-noite vale o dia de São Paulo, não o de UTC', () => {
    expect(appointmentWhen('2026-10-04T02:30:00.000Z')).toEqual({ day: 'sáb 03/10', time: '23:30' })
  })
})

describe('buildAppointmentEmail', () => {
  const input = { ownerName: 'Ana', agendaUrl: 'https://app.vitrimove.site/painel/agenda' }

  it('assunto e texto com o essencial', () => {
    const email = buildAppointmentEmail(notice, input)
    expect(email.subject).toBe('Novo agendamento: Corte, sáb 03/10 às 14:00')
    expect(email.text).toBe(
      [
        'Olá, Ana!',
        '',
        'Entrou um agendamento novo pela sua vitrine.',
        '',
        'Serviço: Corte\nQuando: sáb 03/10 às 14:00\nCliente: Maria Silva\nWhatsApp: +55 11 98888-7777',
        '',
        'Ver na agenda: https://app.vitrimove.site/painel/agenda',
        '',
        'Equipe Vitrimove',
      ].join('\n'),
    )
    expect(email.html).toContain('href="https://wa.me/5511988887777"')
    expect(email.html).toContain('href="https://app.vitrimove.site/painel/agenda"')
  })

  it('com profissional e observação; sem nome do dono', () => {
    const email = buildAppointmentEmail({ ...notice, professionalName: 'Bia', notes: 'unha curta' }, { ...input, ownerName: ' ' })
    expect(email.text.startsWith('Olá!')).toBe(true)
    expect(email.text).toContain('Profissional: Bia')
    expect(email.text).toContain('Observação: unha curta')
  })

  it('escapa o que a cliente digitou', () => {
    const email = buildAppointmentEmail({ ...notice, customerName: 'Rê & Cia', notes: '<b>oi</b>' }, input)
    expect(email.html).toContain('Rê &amp; Cia')
    expect(email.html).toContain('&lt;b&gt;oi&lt;/b&gt;')
    expect(email.html).not.toContain('<b>oi</b>')
  })
})

describe('buildAppointmentPush', () => {
  it('título, resumo e destino', () => {
    expect(buildAppointmentPush(notice)).toEqual({
      title: 'Novo agendamento',
      body: 'Maria Silva · Corte · sáb 03/10 14:00',
      url: '/painel/agenda',
      tag: 'appointment-11111111-1111-4111-8111-111111111111',
    })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/notifications/appointment-message.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar** — `src/lib/push/types.ts`:

```ts
// Aparelho inscrito (o que o navegador devolve no pushManager.subscribe) e o que vai nele.
export type PushTarget = { endpoint: string; p256dh: string; auth: string }

export type PushPayload = { title: string; body: string; url: string; tag: string }

// 'gone' = o servidor de push diz que a inscrição não existe mais; 'off' = driver desligado.
export type PushResult = 'sent' | 'gone' | 'off'
```

`src/lib/notifications/appointment-message.ts`:

```ts
import { escapeHtml } from '@/lib/email/html'
import type { PushPayload } from '@/lib/push/types'
import { formatPhone } from '@/lib/whatsapp/phone'

export type AppointmentNotice = {
  id: string
  serviceName: string
  startsAt: string
  professionalName: string | null
  customerName: string
  customerPhone: string
  notes: string | null
}

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const pad = (value: number) => String(value).padStart(2, '0')

// São Paulo em UTC−3 fixo, a mesma regra do motor da agenda.
export function appointmentWhen(startsAt: string): { day: string; time: string } {
  const local = new Date(new Date(startsAt).getTime() - 3 * 3_600_000)
  return {
    day: `${WEEKDAYS[local.getUTCDay()]} ${pad(local.getUTCDate())}/${pad(local.getUTCMonth() + 1)}`,
    time: `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`,
  }
}

export function buildAppointmentEmail(
  notice: AppointmentNotice,
  input: { ownerName: string; agendaUrl: string },
): { subject: string; text: string; html: string } {
  const { day, time } = appointmentWhen(notice.startsAt)
  const when = `${day} às ${time}`
  const greeting = input.ownerName.trim() ? `Olá, ${input.ownerName.trim()}!` : 'Olá!'
  const phone = formatPhone(notice.customerPhone)
  const whatsappUrl = `https://wa.me/${notice.customerPhone.replace(/\D/g, '')}`

  const details: [string, string][] = [
    ['Serviço', notice.serviceName],
    ['Quando', when],
    ...(notice.professionalName ? ([['Profissional', notice.professionalName]] as [string, string][]) : []),
    ['Cliente', notice.customerName],
    ['WhatsApp', phone],
    ...(notice.notes ? ([['Observação', notice.notes]] as [string, string][]) : []),
  ]

  const text = [
    greeting,
    'Entrou um agendamento novo pela sua vitrine.',
    details.map(([label, value]) => `${label}: ${value}`).join('\n'),
    `Ver na agenda: ${input.agendaUrl}`,
    'Equipe Vitrimove',
  ].join('\n\n')

  const detailHtml = details
    .map(([label, value]) =>
      label === 'WhatsApp'
        ? `<strong>${label}:</strong> <a href="${escapeHtml(whatsappUrl)}">${escapeHtml(value)}</a>`
        : `<strong>${label}:</strong> ${escapeHtml(value)}`,
    )
    .join('<br>\n')

  const html = [
    `<p>${escapeHtml(greeting)}</p>`,
    '<p>Entrou um agendamento novo pela sua vitrine.</p>',
    `<p>${detailHtml}</p>`,
    `<p><a href="${escapeHtml(input.agendaUrl)}">Ver na agenda</a></p>`,
    '<p>Equipe Vitrimove</p>',
  ].join('\n')

  return { subject: `Novo agendamento: ${notice.serviceName}, ${when}`, text, html }
}

export function buildAppointmentPush(notice: AppointmentNotice): PushPayload {
  const { day, time } = appointmentWhen(notice.startsAt)
  return {
    title: 'Novo agendamento',
    body: `${notice.customerName} · ${notice.serviceName} · ${day} ${time}`,
    url: '/painel/agenda',
    tag: `appointment-${notice.id}`,
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/notifications/appointment-message.test.ts`
Expected: PASS. Se só a linha do WhatsApp divergir, rode `node -e "console.log(require('libphonenumber-js/min').parsePhoneNumberFromString('+5511988887777').formatInternational())"` e ajuste o texto esperado do teste para a saída real de `formatPhone` (é ela que o painel já mostra).

- [ ] **Step 5: Commit**

```bash
git add src/lib/push/types.ts src/lib/notifications/appointment-message.ts src/lib/notifications/appointment-message.test.ts
git commit -m "feat(aviso): textos do e-mail e do push de agendamento novo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Envio — `sendPush` e entrega pelos dois canais

**Files:**
- Modify: `package.json`/`package-lock.json` (`npm i web-push` e `npm i -D @types/web-push`)
- Create: `src/lib/push/send-push.ts`
- Create: `src/features/booking/deliver-notice.ts`
- Test: `src/features/booking/deliver-notice.test.ts`
- Create: `src/features/booking/notify-owner.ts`

**Interfaces:**
- Consumes: `getPushEnv` (Task 1), `PushTarget/PushPayload/PushResult`, `AppointmentNotice`, `buildAppointmentEmail`, `buildAppointmentPush` (Task 3), `sendEmail`/`EmailMessage` (`src/lib/email/send-email.ts`).
- Produces:
  - `sendPush(target: PushTarget, payload: PushPayload): Promise<PushResult>`
  - `type NoticeRecipient = { email: string | null; ownerName: string; emailEnabled: boolean; subscriptions: PushTarget[] }`
  - `type NoticeDeps = { sendEmail: (message: EmailMessage) => Promise<void>; sendPush: (target: PushTarget, payload: PushPayload) => Promise<PushResult>; removeSubscription: (endpoint: string) => Promise<void>; report: (error: unknown) => void }`
  - `deliverAppointmentNotice(notice: AppointmentNotice, recipient: NoticeRecipient, agendaUrl: string, deps: NoticeDeps): Promise<void>`
  - `notifyOwnerOfAppointment(admin: SupabaseClient<Database>, appointmentId: string): Promise<void>`
  - Driver `fake` grava `{ endpoint, title, body, url, tag }` em `os.tmpdir()/agenn-vitrine-push/*.json` e devolve `'gone'` quando o endpoint contém `/gone/`.

- [ ] **Step 1: Dependência**

Run: `npm i web-push && npm i -D @types/web-push`
Expected: `web-push` em `dependencies`, `@types/web-push` em `devDependencies`.

- [ ] **Step 2: Teste que falha** — `src/features/booking/deliver-notice.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import type { AppointmentNotice } from '@/lib/notifications/appointment-message'
import { deliverAppointmentNotice, type NoticeDeps, type NoticeRecipient } from './deliver-notice'

const notice: AppointmentNotice = {
  id: 'ap-1',
  serviceName: 'Corte',
  startsAt: '2026-10-03T17:00:00.000Z',
  professionalName: null,
  customerName: 'Maria Silva',
  customerPhone: '+5511988887777',
  notes: null,
}
const phone = { endpoint: 'https://push.example/ok', p256dh: 'p', auth: 'a' }
const oldPhone = { endpoint: 'https://push.example/velho', p256dh: 'p', auth: 'a' }
const recipient: NoticeRecipient = { email: 'ana@x.com', ownerName: 'Ana', emailEnabled: true, subscriptions: [phone] }
const agendaUrl = 'https://app.vitrimove.site/painel/agenda'

function deps(overrides: Partial<NoticeDeps> = {}): NoticeDeps {
  return {
    sendEmail: vi.fn(async () => {}),
    sendPush: vi.fn(async () => 'sent' as const),
    removeSubscription: vi.fn(async () => {}),
    report: vi.fn(),
    ...overrides,
  }
}

describe('deliverAppointmentNotice', () => {
  it('manda e-mail com chave de idempotência e push para cada aparelho', async () => {
    const d = deps()
    await deliverAppointmentNotice(notice, recipient, agendaUrl, d)
    expect(d.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'ana@x.com', idempotencyKey: 'appointment-ap-1', subject: 'Novo agendamento: Corte, sáb 03/10 às 14:00' }),
    )
    expect(d.sendPush).toHaveBeenCalledWith(phone, expect.objectContaining({ title: 'Novo agendamento', url: '/painel/agenda' }))
    expect(d.report).not.toHaveBeenCalled()
  })

  it('chave desligada ou dono sem e-mail: só push', async () => {
    const off = deps()
    await deliverAppointmentNotice(notice, { ...recipient, emailEnabled: false }, agendaUrl, off)
    expect(off.sendEmail).not.toHaveBeenCalled()
    expect(off.sendPush).toHaveBeenCalledTimes(1)

    const noEmail = deps()
    await deliverAppointmentNotice(notice, { ...recipient, email: null }, agendaUrl, noEmail)
    expect(noEmail.sendEmail).not.toHaveBeenCalled()
  })

  it('aparelho expirado sai da lista e o válido recebe', async () => {
    const d = deps({ sendPush: vi.fn(async (target) => (target.endpoint === oldPhone.endpoint ? 'gone' : 'sent') as 'gone' | 'sent') })
    await deliverAppointmentNotice(notice, { ...recipient, subscriptions: [oldPhone, phone] }, agendaUrl, d)
    expect(d.sendPush).toHaveBeenCalledTimes(2)
    expect(d.removeSubscription).toHaveBeenCalledWith(oldPhone.endpoint)
    expect(d.removeSubscription).toHaveBeenCalledTimes(1)
    expect(d.report).not.toHaveBeenCalled()
  })

  it('e-mail falhando não impede o push, e a falha é reportada', async () => {
    const failure = new Error('Resend 500')
    const d = deps({ sendEmail: vi.fn(async () => Promise.reject(failure)) })
    await deliverAppointmentNotice(notice, recipient, agendaUrl, d)
    expect(d.sendPush).toHaveBeenCalledTimes(1)
    expect(d.report).toHaveBeenCalledWith(failure)
  })

  it('push falhando num aparelho não impede os outros nem o e-mail', async () => {
    const failure = new Error('push 500')
    const d = deps({ sendPush: vi.fn(async (target) => (target.endpoint === oldPhone.endpoint ? Promise.reject(failure) : 'sent')) })
    await deliverAppointmentNotice(notice, { ...recipient, subscriptions: [oldPhone, phone] }, agendaUrl, d)
    expect(d.sendEmail).toHaveBeenCalledTimes(1)
    expect(d.sendPush).toHaveBeenCalledTimes(2)
    expect(d.removeSubscription).not.toHaveBeenCalled()
    expect(d.report).toHaveBeenCalledWith(failure)
  })
})
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/features/booking/deliver-notice.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 4: Implementar** — `src/features/booking/deliver-notice.ts`:

```ts
import type { EmailMessage } from '@/lib/email/send-email'
import { buildAppointmentEmail, buildAppointmentPush, type AppointmentNotice } from '@/lib/notifications/appointment-message'
import type { PushPayload, PushResult, PushTarget } from '@/lib/push/types'

export type NoticeRecipient = { email: string | null; ownerName: string; emailEnabled: boolean; subscriptions: PushTarget[] }

export type NoticeDeps = {
  sendEmail: (message: EmailMessage) => Promise<void>
  sendPush: (target: PushTarget, payload: PushPayload) => Promise<PushResult>
  removeSubscription: (endpoint: string) => Promise<void>
  report: (error: unknown) => void
}

// Entrega o aviso de agendamento novo. Cada canal (e cada aparelho) vai por conta
// própria: um falhar não impede os outros, e a falha só é reportada.
export async function deliverAppointmentNotice(
  notice: AppointmentNotice,
  recipient: NoticeRecipient,
  agendaUrl: string,
  deps: NoticeDeps,
): Promise<void> {
  const tasks: Promise<unknown>[] = []

  if (recipient.emailEnabled && recipient.email) {
    const message = buildAppointmentEmail(notice, { ownerName: recipient.ownerName, agendaUrl })
    tasks.push(deps.sendEmail({ to: recipient.email, ...message, idempotencyKey: `appointment-${notice.id}` }))
  }

  const payload = buildAppointmentPush(notice)
  for (const target of recipient.subscriptions) {
    tasks.push(
      deps.sendPush(target, payload).then(async (result) => {
        if (result === 'gone') await deps.removeSubscription(target.endpoint)
      }),
    )
  }

  const results = await Promise.allSettled(tasks)
  for (const result of results) if (result.status === 'rejected') deps.report(result.reason)
}
```

`src/lib/push/send-push.ts`:

```ts
import 'server-only'
import { mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import webpush from 'web-push'
import { getPushEnv } from '@/lib/server-env'
import type { PushPayload, PushResult, PushTarget } from './types'

// Só CI e desenvolvimento: as notificações viram arquivos JSON para os testes lerem.
const FAKE_PUSH_DIR = path.join(os.tmpdir(), 'agenn-vitrine-push')

export async function sendPush(target: PushTarget, payload: PushPayload): Promise<PushResult> {
  const config = getPushEnv()
  if (config.driver === 'off') return 'off'

  if (config.driver === 'fake') {
    await mkdir(FAKE_PUSH_DIR, { recursive: true })
    await writeFile(
      path.join(FAKE_PUSH_DIR, `${Date.now()}-${crypto.randomUUID()}.json`),
      JSON.stringify({ endpoint: target.endpoint, ...payload }),
    )
    // Endpoint com /gone/ simula o aparelho que desinstalou o app.
    return target.endpoint.includes('/gone/') ? 'gone' : 'sent'
  }

  try {
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify(payload),
      {
        vapidDetails: { subject: config.subject, publicKey: config.publicKey, privateKey: config.privateKey },
        TTL: 60 * 60,
        urgency: 'high',
      },
    )
    return 'sent'
  } catch (error) {
    // 404/410: a inscrição expirou ou o app foi desinstalado — o aparelho sai da lista.
    if (error instanceof webpush.WebPushError && (error.statusCode === 404 || error.statusCode === 410)) return 'gone'
    throw error
  }
}
```

`src/features/booking/notify-owner.ts`:

```ts
import 'server-only'
import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email/send-email'
import { env } from '@/lib/env'
import { buildAppUrl } from '@/lib/hosts/urls'
import { sendPush } from '@/lib/push/send-push'
import type { Database } from '@/lib/supabase/database.types'
import { deliverAppointmentNotice } from './deliver-notice'

// Avisa o dono de um agendamento novo feito pela vitrine: e-mail (se a chave estiver
// ligada) e push nos aparelhos que ele ativou. Chamado em after(), depois da resposta.
export async function notifyOwnerOfAppointment(admin: SupabaseClient<Database>, appointmentId: string): Promise<void> {
  const { data: appointment, error } = await admin
    .from('appointments')
    .select('id, owner_id, service_name, starts_at, professional_name, customer_name, customer_phone, notes')
    .eq('id', appointmentId)
    .single()
  if (error) throw error

  const ownerId = appointment.owner_id
  const [{ data: userData, error: userError }, { data: profile }, { data: subscriptions, error: subscriptionsError }] =
    await Promise.all([
      admin.auth.admin.getUserById(ownerId),
      admin.from('profiles').select('name, notify_booking_email').eq('id', ownerId).maybeSingle(),
      admin.from('push_subscriptions').select('endpoint, p256dh, auth').eq('owner_id', ownerId),
    ])
  if (userError) throw userError
  if (subscriptionsError) throw subscriptionsError

  await deliverAppointmentNotice(
    {
      id: appointment.id,
      serviceName: appointment.service_name,
      startsAt: appointment.starts_at,
      professionalName: appointment.professional_name,
      customerName: appointment.customer_name,
      customerPhone: appointment.customer_phone,
      notes: appointment.notes,
    },
    {
      email: userData.user?.email ?? null,
      ownerName: profile?.name ?? '',
      emailEnabled: profile?.notify_booking_email ?? true,
      subscriptions: subscriptions ?? [],
    },
    buildAppUrl('/painel/agenda', env.NEXT_PUBLIC_ROOT_DOMAIN),
    {
      sendEmail,
      sendPush,
      removeSubscription: async (endpoint) => {
        await admin.from('push_subscriptions').delete().eq('endpoint', endpoint).throwOnError()
      },
      report: (failure) => Sentry.captureException(failure),
    },
  )
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/features/booking/deliver-notice.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/push/send-push.ts src/features/booking/deliver-notice.ts src/features/booking/deliver-notice.test.ts src/features/booking/notify-owner.ts
git commit -m "feat(aviso): envio do aviso de agendamento por e-mail e push

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Disparar o aviso no agendamento

**Files:**
- Modify: `src/app/api/agendamentos/route.ts` (imports e bloco `if (id) {`)

**Interfaces:**
- Consumes: `notifyOwnerOfAppointment` (Task 4).

- [ ] **Step 1: Implementar** — trocar o import de `next/server` e acrescentar o do aviso:

```ts
import { after, NextResponse, type NextRequest } from 'next/server'
import { notifyOwnerOfAppointment } from '@/features/booking/notify-owner'
```

E no começo do bloco `if (id) {`, antes do `return NextResponse.json(...)`:

```ts
      if (id) {
        // O aviso ao dono sai depois da resposta: a cliente não espera o e-mail nem o push.
        after(() => notifyOwnerOfAppointment(admin, id).catch((failure) => Sentry.captureException(failure)))
        return NextResponse.json(
```

- [ ] **Step 2: Conferir**

Run: `npm run typecheck && npm run lint`
Expected: PASS. (O teste de ponta a ponta deste fluxo é a Task 6.)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/agendamentos/route.ts
git commit -m "feat(agenda): avisa o dono a cada agendamento feito pela vitrine

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: E2E do aviso

**Files:**
- Modify: `e2e/helpers.ts` (depois de `readFakeEmails`)
- Create: `e2e/aviso-agendamento.spec.ts`

**Interfaces:**
- Consumes: driver `fake` de e-mail e push; endpoint com `/gone/` devolve `'gone'` (Task 4).
- Produces: `readFakePushes(endpoint: string): Promise<{ endpoint: string; title: string; body: string; url: string; tag: string }[]>`

- [ ] **Step 1: Helper** — em `e2e/helpers.ts`, logo depois de `readFakeEmails`:

```ts
export async function readFakePushes(endpoint: string) {
  const dir = path.join(os.tmpdir(), 'agenn-vitrine-push')
  const files = await readdir(dir).catch(() => [] as string[])
  const pushes = await Promise.all(
    files.map(
      async (file) =>
        JSON.parse(await readFile(path.join(dir, file), 'utf8')) as { endpoint: string; title: string; body: string; url: string; tag: string },
    ),
  )
  return pushes.filter((push) => push.endpoint === endpoint)
}
```

- [ ] **Step 2: Spec** — `e2e/aviso-agendamento.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import {
  createAdminClient,
  createConfirmedUser,
  openAgenda,
  readFakeEmails,
  readFakePushes,
  seedItem,
  seedVitrine,
  tomorrowInSaoPaulo,
} from './helpers'

const vitrineUrl = (subdomain: string) => `http://${subdomain}.localhost:3000/`

test('agendamento pela vitrine avisa o dono por e-mail e push', async ({ page }) => {
  const user = await createConfirmedUser('aviso')
  const vitrine = await seedVitrine(user.id, { type: 'servicos', name: 'Studio Aviso' })
  await openAgenda(vitrine.id)
  const item = await seedItem(vitrine, user.id, { name: 'Corte', priceCents: 5000, durationMinutes: 60 })

  const okEndpoint = `https://push.example/ok/${crypto.randomUUID()}`
  const goneEndpoint = `https://push.example/gone/${crypto.randomUUID()}`
  await createAdminClient()
    .from('push_subscriptions')
    .insert([
      { owner_id: user.id, endpoint: okEndpoint, p256dh: 'p', auth: 'a' },
      { owner_id: user.id, endpoint: goneEndpoint, p256dh: 'p', auth: 'a' },
    ])
    .throwOnError()

  const book = (time: string, name: string) =>
    page.request.post(`${vitrineUrl(vitrine.subdomain)}api/agendamentos`, {
      data: { itemId: item.id, date: tomorrowInSaoPaulo(), time, name, whatsapp: '11988887777', notes: 'unha curta' },
    })

  expect((await book('10:00', 'Maria Silva')).status()).toBe(201)

  await expect
    .poll(async () => (await readFakeEmails(user.email)).filter((email) => email.text.includes('Maria Silva')).length, { timeout: 15_000 })
    .toBe(1)
  const [email] = (await readFakeEmails(user.email)).filter((e) => e.text.includes('Maria Silva'))
  expect(email.subject).toMatch(/^Novo agendamento: Corte, \S+ \d{2}\/\d{2} às 10:00$/)
  expect(email.text).toContain('Observação: unha curta')

  await expect.poll(async () => (await readFakePushes(okEndpoint)).length, { timeout: 15_000 }).toBe(1)
  const [push] = await readFakePushes(okEndpoint)
  expect(push.title).toBe('Novo agendamento')
  expect(push.body).toMatch(/^Maria Silva · Corte · \S+ \d{2}\/\d{2} 10:00$/)
  expect(push.url).toBe('/painel/agenda')

  // O aparelho que desinstalou o app sai da lista.
  await expect
    .poll(async () => {
      const { count } = await createAdminClient()
        .from('push_subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('endpoint', goneEndpoint)
      return count
    })
    .toBe(0)

  // Com a chave do e-mail desligada, só o push chega.
  await createAdminClient().from('profiles').update({ notify_booking_email: false }).eq('id', user.id).throwOnError()
  expect((await book('14:00', 'João Souza')).status()).toBe(201)
  await expect
    .poll(async () => (await readFakePushes(okEndpoint)).filter((p) => p.body.startsWith('João Souza')).length, { timeout: 15_000 })
    .toBe(1)
  expect((await readFakeEmails(user.email)).filter((e) => e.text.includes('João Souza'))).toHaveLength(0)
})
```

- [ ] **Step 3: Conferir**

Run: `npm run lint && npm run typecheck`
Expected: PASS. A spec roda no job e2e do CI (build de produção, `PUSH_DRIVER=fake`, `EMAIL_DRIVER=fake`). Para rodar localmente com Supabase de pé: `PUSH_DRIVER=fake` e `EMAIL_DRIVER=fake` no `.env.local`, depois `npm run build && npx playwright test e2e/aviso-agendamento.spec.ts --project=desktop`.

- [ ] **Step 4: Commit**

```bash
git add e2e/helpers.ts e2e/aviso-agendamento.spec.ts
git commit -m "test(e2e): aviso de agendamento por e-mail e push

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Service worker mostra a notificação

**Files:**
- Modify: `public/sw.js` (comentário do topo e fim do arquivo)

**Interfaces:**
- Consumes: payload `{ title, body, url, tag }` (Task 3).

- [ ] **Step 1: Implementar** — no comentário do topo, acrescentar o item:

```js
 * - notificação push (aviso de agendamento para o dono): mostra e, ao tocar, abre a
 *   agenda do painel. As vitrines usam este mesmo arquivo, mas nunca se inscrevem.
```

No fim de `public/sw.js`:

```js
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = {}
  }
  const title = data.title || 'Vitrimove'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      tag: data.tag,
      icon: '/brand/vitrimove-marca-512.png',
      badge: '/brand/vitrimove-marca-512.png',
      data: { url: data.url || '/painel/agenda' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/painel/agenda', self.location.origin).href
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin)
      if (open) {
        await open.focus()
        if ('navigate' in open) await open.navigate(target)
        return
      }
      await self.clients.openWindow(target)
    })(),
  )
})
```

- [ ] **Step 2: Conferir a sintaxe**

Run: `node --check public/sw.js`
Expected: sem saída (OK). Conferência real (notificação aparecendo e o toque abrindo a agenda) fica no roteiro manual da Task 9.

- [ ] **Step 3: Commit**

```bash
git add public/sw.js
git commit -m "feat(pwa): service worker mostra o aviso de agendamento

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Cartão "Avisos de agendamento" na aba Conta

**Files:**
- Create: `src/lib/notifications/push-support.ts`, test `src/lib/notifications/push-support.test.ts`
- Create: `src/lib/notifications/push-subscription.ts`, test `src/lib/notifications/push-subscription.test.ts`
- Create: `src/features/notifications/actions.ts`
- Create: `src/app/app/(painel)/painel/conta/booking-notices.tsx`
- Modify: `src/app/app/(painel)/painel/conta/page.tsx`
- Modify: `e2e/aviso-agendamento.spec.ts` (segundo teste)

**Interfaces:**
- Consumes: `sendPush` (Task 4), `env.NEXT_PUBLIC_VAPID_PUBLIC_KEY` (Task 1), tabela/coluna da Task 2, `Switch`, `Button`, `FormMessage`.
- Produces:
  - `type PushSupport = 'unsupported' | 'ios-needs-install' | 'denied' | 'ready'`
  - `pushSupport(input: { hasServiceWorker: boolean; hasPushManager: boolean; hasNotification: boolean; isIos: boolean; standalone: boolean; permission: string }): PushSupport`
  - `isIosDevice(userAgent: string, platform: string, maxTouchPoints: number): boolean`
  - `vapidKeyBytes(base64url: string): Uint8Array`
  - `pushSubscriptionSchema` (zod) → `{ endpoint: string; keys: { p256dh: string; auth: string }; userAgent: string }`
  - Actions: `setBookingEmailAction(enabled: boolean): Promise<FormState>`, `savePushSubscriptionAction(input: unknown): Promise<FormState>`, `removePushSubscriptionAction(endpoint: string): Promise<FormState>`, `sendTestPushAction(endpoint: string): Promise<FormState>`
  - `<BookingNotices emailEnabled: boolean; endpoints: string[]; vapidPublicKey: string />`

- [ ] **Step 1: Testes que falham** — `src/lib/notifications/push-support.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isIosDevice, pushSupport, vapidKeyBytes } from './push-support'

const full = { hasServiceWorker: true, hasPushManager: true, hasNotification: true, isIos: false, standalone: false, permission: 'default' }

describe('pushSupport', () => {
  it('pronto quando o navegador tem tudo', () => {
    expect(pushSupport(full)).toBe('ready')
  })

  it('iPhone fora do app instalado pede para instalar, mesmo sem PushManager', () => {
    expect(pushSupport({ ...full, isIos: true, hasPushManager: false })).toBe('ios-needs-install')
    expect(pushSupport({ ...full, isIos: true, standalone: true })).toBe('ready')
  })

  it('sem as APIs: sem suporte', () => {
    expect(pushSupport({ ...full, hasPushManager: false })).toBe('unsupported')
    expect(pushSupport({ ...full, hasServiceWorker: false })).toBe('unsupported')
  })

  it('permissão negada', () => {
    expect(pushSupport({ ...full, permission: 'denied' })).toBe('denied')
  })
})

describe('isIosDevice', () => {
  it('iPhone e iPad (inclusive iPad que se diz Mac)', () => {
    expect(isIosDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)', 'iPhone', 5)).toBe(true)
    expect(isIosDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 5)).toBe(true)
    expect(isIosDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 0)).toBe(false)
    expect(isIosDevice('Mozilla/5.0 (Linux; Android 14; Pixel 7)', 'Linux armv8l', 5)).toBe(false)
  })
})

describe('vapidKeyBytes', () => {
  it('decodifica base64url', () => {
    expect(Array.from(vapidKeyBytes('AQID_-8'))).toEqual([1, 2, 3, 255, 239])
  })
})
```

`src/lib/notifications/push-subscription.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { pushSubscriptionSchema } from './push-subscription'

const valid = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
  keys: { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' },
  userAgent: 'Chrome',
}

describe('pushSubscriptionSchema', () => {
  it('aceita a inscrição do navegador', () => {
    expect(pushSubscriptionSchema.parse(valid)).toEqual(valid)
    expect(pushSubscriptionSchema.parse({ ...valid, userAgent: undefined }).userAgent).toBe('')
  })

  it('recusa endpoint sem https e chaves fora de base64url', () => {
    expect(pushSubscriptionSchema.safeParse({ ...valid, endpoint: 'http://x.com/a' }).success).toBe(false)
    expect(pushSubscriptionSchema.safeParse({ ...valid, keys: { ...valid.keys, auth: 'a b' } }).success).toBe(false)
  })

  it('corta o user agent longo', () => {
    expect(pushSubscriptionSchema.parse({ ...valid, userAgent: 'x'.repeat(500) }).userAgent).toHaveLength(300)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/notifications/push-support.test.ts src/lib/notifications/push-subscription.test.ts`
Expected: FAIL (módulos não existem).

- [ ] **Step 3: Implementar os módulos puros** — `src/lib/notifications/push-support.ts`:

```ts
// O que o cartão de avisos pode oferecer neste navegador. Sem zod nem DOM: testável.
export type PushSupport = 'unsupported' | 'ios-needs-install' | 'denied' | 'ready'

export function pushSupport(input: {
  hasServiceWorker: boolean
  hasPushManager: boolean
  hasNotification: boolean
  isIos: boolean
  standalone: boolean
  permission: string
}): PushSupport {
  // No iPhone o push só existe no app instalado na tela de início (iOS 16.4+).
  if (input.isIos && !input.standalone) return 'ios-needs-install'
  if (!input.hasServiceWorker || !input.hasPushManager || !input.hasNotification) return 'unsupported'
  if (input.permission === 'denied') return 'denied'
  return 'ready'
}

// iPad com iPadOS se apresenta como Mac; o toque denuncia.
export function isIosDevice(userAgent: string, platform: string, maxTouchPoints: number): boolean {
  return /iPad|iPhone|iPod/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1)
}

// applicationServerKey do pushManager.subscribe: a chave pública VAPID em bytes.
export function vapidKeyBytes(base64url: string): Uint8Array {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from(raw, (char) => char.charCodeAt(0))
}
```

`src/lib/notifications/push-subscription.ts`:

```ts
import { z } from 'zod'

const BASE64URL = /^[A-Za-z0-9_-]+$/

// Inscrição que o navegador devolve no pushManager.subscribe (toJSON) + o nome do navegador.
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().startsWith('https://').max(1000),
  keys: z.object({
    p256dh: z.string().regex(BASE64URL).max(200),
    auth: z.string().regex(BASE64URL).max(100),
  }),
  userAgent: z
    .string()
    .default('')
    .transform((value) => value.slice(0, 300)),
})
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/notifications/push-support.test.ts src/lib/notifications/push-subscription.test.ts`
Expected: PASS.

- [ ] **Step 5: Server actions** — `src/features/notifications/actions.ts`:

```ts
'use server'

import * as Sentry from '@sentry/nextjs'
import { redirect } from 'next/navigation'
import type { FormState } from '@/lib/forms/form-state'
import { pushSubscriptionSchema } from '@/lib/notifications/push-subscription'
import { sendPush } from '@/lib/push/send-push'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'

async function currentUser() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/entrar')
  return { supabase, user }
}

export async function setBookingEmailAction(enabled: boolean): Promise<FormState> {
  const { supabase, user } = await currentUser()
  const { error } = await supabase.from('profiles').update({ notify_booking_email: enabled === true }).eq('id', user.id)
  if (error) return { error: 'Não foi possível salvar. Tente novamente.' }
  return { success: enabled ? 'Você vai receber um e-mail a cada agendamento.' : 'E-mails de agendamento desligados.' }
}

export async function savePushSubscriptionAction(input: unknown): Promise<FormState> {
  const { user } = await currentUser()
  const parsed = pushSubscriptionSchema.safeParse(input)
  if (!parsed.success) return { error: 'Não foi possível ativar neste aparelho.' }

  // Um aparelho pertence a uma conta só: se outra conta já usava este endpoint, ele passa
  // para quem está logado agora. Por isso a gravação é pelo service_role, não pela RLS.
  const { error } = await createSupabaseAdminClient()
    .from('push_subscriptions')
    .upsert(
      {
        owner_id: user.id,
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
        user_agent: parsed.data.userAgent,
      },
      { onConflict: 'endpoint' },
    )
  if (error) {
    Sentry.captureException(error)
    return { error: 'Não foi possível ativar neste aparelho.' }
  }
  return { success: 'Pronto! Este aparelho vai avisar cada agendamento novo.' }
}

export async function removePushSubscriptionAction(endpoint: string): Promise<FormState> {
  const { supabase } = await currentUser()
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', String(endpoint))
  if (error) return { error: 'Não foi possível desativar. Tente novamente.' }
  return { success: 'Notificações desativadas neste aparelho.' }
}

export async function sendTestPushAction(endpoint: string): Promise<FormState> {
  const { supabase } = await currentUser()
  // A RLS só devolve o aparelho se ele for de quem está logado.
  const { data: target } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('endpoint', String(endpoint))
    .maybeSingle()
  if (!target) return { error: 'Ative as notificações neste aparelho primeiro.' }

  try {
    const result = await sendPush(target, {
      title: 'Teste do Vitrimove',
      body: 'Assim chega o aviso de cada agendamento novo.',
      url: '/painel/agenda',
      tag: 'teste',
    })
    if (result === 'gone') {
      await createSupabaseAdminClient().from('push_subscriptions').delete().eq('endpoint', target.endpoint)
      return { error: 'Este aparelho não recebe mais. Ative de novo.' }
    }
    if (result === 'off') return { error: 'As notificações estão desligadas no servidor.' }
    return { success: 'Enviado. A notificação deve chegar em instantes.' }
  } catch (error) {
    Sentry.captureException(error)
    return { error: 'Não foi possível enviar o teste agora.' }
  }
}
```

- [ ] **Step 6: Cartão cliente** — `src/app/app/(painel)/painel/conta/booking-notices.tsx`:

```tsx
'use client'

import { useEffect, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { Spinner } from '@/components/ui/submit-button'
import { Switch } from '@/components/ui/switch'
import {
  removePushSubscriptionAction,
  savePushSubscriptionAction,
  sendTestPushAction,
  setBookingEmailAction,
} from '@/features/notifications/actions'
import type { FormState } from '@/lib/forms/form-state'
import { isIosDevice, pushSupport, vapidKeyBytes, type PushSupport } from '@/lib/notifications/push-support'

type DeviceState = 'loading' | PushSupport | 'on' | 'off'

function readSupport(): PushSupport {
  return pushSupport({
    hasServiceWorker: 'serviceWorker' in navigator,
    hasPushManager: 'PushManager' in window,
    hasNotification: 'Notification' in window,
    isIos: isIosDevice(navigator.userAgent, navigator.platform, navigator.maxTouchPoints),
    standalone: window.matchMedia('(display-mode: standalone)').matches,
    permission: 'Notification' in window ? Notification.permission : 'default',
  })
}

const DEVICE_HINTS: Partial<Record<DeviceState, string>> = {
  unsupported: 'Este navegador não recebe notificações. Os e-mails continuam chegando.',
  'ios-needs-install': 'Para receber no iPhone, adicione o Vitrimove à tela de início e abra por lá.',
  denied: 'As notificações estão bloqueadas para este site. Libere nas configurações do navegador e volte aqui.',
}

export function BookingNotices({
  emailEnabled,
  endpoints,
  vapidPublicKey,
}: {
  emailEnabled: boolean
  endpoints: string[]
  vapidPublicKey: string
}) {
  const [email, setEmail] = useState(emailEnabled)
  const [device, setDevice] = useState<DeviceState>('loading')
  const [endpoint, setEndpoint] = useState<string | null>(null)
  const [message, setMessage] = useState<FormState>({})
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    const support = readSupport()
    if (support !== 'ready' || !vapidPublicKey) {
      setDevice(vapidPublicKey ? support : 'unsupported')
      return
    }
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        const known = subscription && endpoints.includes(subscription.endpoint)
        setEndpoint(known ? subscription.endpoint : null)
        setDevice(known ? 'on' : 'off')
      })
      .catch(() => setDevice('off'))
  }, [endpoints, vapidPublicKey])

  function toggleEmail() {
    const next = !email
    setEmail(next)
    startTransition(async () => {
      const result = await setBookingEmailAction(next)
      if (result.error) setEmail(!next)
      setMessage(result)
    })
  }

  function enable() {
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          setDevice(permission === 'denied' ? 'denied' : 'off')
          return
        }
        const registration = await navigator.serviceWorker.ready
        const subscription =
          (await registration.pushManager.getSubscription()) ??
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: vapidKeyBytes(vapidPublicKey),
          }))
        const json = subscription.toJSON()
        const result = await savePushSubscriptionAction({
          endpoint: json.endpoint,
          keys: json.keys,
          userAgent: navigator.userAgent,
        })
        setMessage(result)
        if (!result.error) {
          setEndpoint(subscription.endpoint)
          setDevice('on')
        }
      } catch {
        setMessage({ error: 'Não foi possível ativar neste aparelho.' })
      }
    })
  }

  function disable() {
    if (!endpoint) return
    startTransition(async () => {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      await subscription?.unsubscribe().catch(() => false)
      const result = await removePushSubscriptionAction(endpoint)
      setMessage(result)
      if (!result.error) {
        setEndpoint(null)
        setDevice('off')
      }
    })
  }

  function test() {
    if (!endpoint) return
    startTransition(async () => setMessage(await sendTestPushAction(endpoint)))
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span id="booking-email-label" className="text-[1.0625rem] font-extrabold text-ink">
            Receber e-mail a cada agendamento
          </span>
          <span className="text-sm font-semibold leading-5 text-ink-muted">Chega no e-mail da sua conta.</span>
        </div>
        <Switch checked={email} onClick={toggleEmail} disabled={pending} aria-labelledby="booking-email-label" />
      </div>

      <div className="flex flex-col gap-3 border-t border-line pt-5">
        <h3 className="text-[1.0625rem] font-extrabold text-ink">Notificação neste aparelho</h3>
        {device === 'loading' ? <Spinner /> : null}
        {DEVICE_HINTS[device] ? <p className="text-sm font-semibold leading-5 text-ink-muted">{DEVICE_HINTS[device]}</p> : null}
        {device === 'off' || device === 'ready' ? (
          <>
            <p className="text-sm font-semibold leading-5 text-ink-muted">
              O celular avisa na hora, mesmo com o app fechado. Ative em cada aparelho que você usa.
            </p>
            <Button type="button" onClick={enable} disabled={pending} aria-busy={pending} className="w-full sm:w-auto sm:self-start">
              {pending ? <Spinner /> : null}
              Ativar neste aparelho
            </Button>
          </>
        ) : null}
        {device === 'on' ? (
          <>
            <p className="text-sm font-semibold leading-5 text-ink-muted">Ativado. Este aparelho avisa cada agendamento novo.</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="secondary" onClick={test} disabled={pending}>
                Enviar teste
              </Button>
              <Button type="button" variant="ghost" onClick={disable} disabled={pending}>
                Desativar
              </Button>
            </div>
          </>
        ) : null}
      </div>

      <FormMessage error={message.error} success={message.success} />
    </div>
  )
}
```

Antes de usar, confira em `src/components/ui/button.tsx` que `secondary` e `ghost` estão em `ButtonVariant` (o código cita os dois na linha 25; `secondary` é usado em `page.tsx`). Se `Spinner` em `submit-button.tsx` exigir props, siga o uso de `name-form.tsx` (`<Spinner />`).

- [ ] **Step 7: Montar na página** — em `src/app/app/(painel)/painel/conta/page.tsx`:

Imports: acrescentar `BellRing` ao import de `lucide-react` (ordem alfabética: `BellRing, KeyRound, LogOut, ShieldCheck, TriangleAlert, UserRound`), `import { env } from '@/lib/env'` e `import { BookingNotices } from './booking-notices'`.

Trocar a consulta do perfil por:

```tsx
  const [{ data: profile }, { data: vitrines }, { data: subscriptions }] = await Promise.all([
    supabase.from('profiles').select('name, notify_booking_email').eq('id', user.id).single(),
    supabase.from('vitrines').select('type').eq('owner_id', user.id),
    supabase.from('push_subscriptions').select('endpoint'),
  ])
  // Avisos de agendamento só fazem sentido para quem tem agenda (vitrine de serviços).
  const hasAgenda = (vitrines ?? []).some((vitrine) => vitrine.type === 'servicos')
```

E, entre o `Block` "Perfil" e o `Block` "Segurança":

```tsx
          {hasAgenda ? (
            <Block
              icon={<BellRing className="size-6" strokeWidth={2.5} />}
              title="Avisos de agendamento"
              description="Saiba na hora quando uma cliente marcar um horário."
            >
              <BookingNotices
                emailEnabled={profile?.notify_booking_email ?? true}
                endpoints={(subscriptions ?? []).map((subscription) => subscription.endpoint)}
                vapidPublicKey={env.NEXT_PUBLIC_VAPID_PUBLIC_KEY}
              />
            </Block>
          ) : null}
```

- [ ] **Step 8: E2E da chave** — acrescentar em `e2e/aviso-agendamento.spec.ts` (incluir `signIn` no import):

```ts
test('Conta: chave do e-mail de agendamento só para quem tem agenda', async ({ page }) => {
  const user = await createConfirmedUser('aviso-conta')
  await seedVitrine(user.id, { type: 'servicos', name: 'Studio Conta' })

  await signIn(page, user.email, user.password)
  await page.goto('/painel/conta')
  const card = page.getByRole('region', { name: 'Avisos de agendamento' })
  const toggle = page.getByRole('switch', { name: 'Receber e-mail a cada agendamento' })
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await toggle.click()
  await expect(page.getByText('E-mails de agendamento desligados.')).toBeVisible()
  await expect(toggle).toHaveAttribute('aria-checked', 'false')

  const { data } = await createAdminClient().from('profiles').select('notify_booking_email').eq('id', user.id).single().throwOnError()
  expect(data?.notify_booking_email).toBe(false)
  await expect(card.getByRole('heading', { name: 'Notificação neste aparelho' })).toBeVisible()
})

test('Conta: sem vitrine de serviços, sem cartão de avisos', async ({ page }) => {
  const user = await createConfirmedUser('aviso-produtos')
  await seedVitrine(user.id, { type: 'produtos', name: 'Loja' })
  await signIn(page, user.email, user.password)
  await page.goto('/painel/conta')
  await expect(page.getByRole('heading', { name: 'Perfil' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Avisos de agendamento' })).toHaveCount(0)
})
```

O `getByRole('region', { name })` exige que a `<section>` do `Block` tenha nome acessível. Em `page.tsx`, dentro de `Block`, antes do `return`:

```tsx
  // Liga a seção ao título para leitores de tela (e para os testes acharem a região).
  const headingId = `bloco-${title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
```

Na `<section ...>` acrescente `aria-labelledby={headingId}` e no `<h2 ...>` acrescente `id={headingId}`. Confira `seedVitrine` em `e2e/helpers.ts:109` para os campos aceitos (`type`, `name`).

- [ ] **Step 9: Conferir**

Run: `npm test && npm run lint && npm run typecheck`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/lib/notifications/push-support.ts src/lib/notifications/push-support.test.ts src/lib/notifications/push-subscription.ts src/lib/notifications/push-subscription.test.ts src/features/notifications/actions.ts "src/app/app/(painel)/painel/conta/booking-notices.tsx" "src/app/app/(painel)/painel/conta/page.tsx" e2e/aviso-agendamento.spec.ts
git commit -m "feat(conta): cartão Avisos de agendamento com e-mail e push por aparelho

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Privacidade e roteiro de produção

**Files:**
- Modify: `src/lib/legal/privacy.ts` (seções 2 e 5)
- Modify: `src/lib/legal/company.ts` (`LEGAL_VERSION`)
- Modify: `src/lib/legal/legal.test.ts`
- Create: `docs/setup/aviso-agendamento.md`

- [ ] **Step 1: Teste que falha** — em `src/lib/legal/legal.test.ts`, dentro de `describe('política de privacidade')`:

```ts
  it('explica o endereço de notificação do aparelho', () => {
    const texto = PRIVACY.flatMap((section) => section.paragraphs).join(' ')
    expect(texto).toContain('notificações')
    expect(texto).toContain('endereço de notificação')
  })
```

Run: `npx vitest run src/lib/legal/legal.test.ts` → Expected: FAIL.

- [ ] **Step 2: Implementar** — em `src/lib/legal/privacy.ts`, seção "2. Quais dados tratamos", depois do parágrafo "Do uso do serviço: ...":

```ts
      'Se você ativa as notificações de agendamento num aparelho, guardamos o endereço de notificação que o navegador cria para ele e o nome do navegador. Eles são apagados quando você desativa as notificações, quando o navegador avisa que o endereço não vale mais ou quando você exclui a conta.',
```

Na seção "5. Com quem compartilhamos", no fim do primeiro parágrafo, trocar `e Google (apenas se você escolher entrar com o Google).` por:

```
e Google (apenas se você escolher entrar com o Google). As notificações no celular passam pelo serviço de notificação do próprio navegador (Google, Apple ou Mozilla) e levam apenas o resumo do agendamento.
```

Em `src/lib/legal/company.ts`: `export const LEGAL_VERSION = '2026-10-03'`.

Run: `npx vitest run src/lib/legal` → Expected: PASS.

- [ ] **Step 3: Roteiro** — `docs/setup/aviso-agendamento.md`:

```markdown
# Aviso de agendamento — configuração e conferência

## Variáveis na Netlify (produção)

1. Gere o par de chaves uma vez: `npx web-push generate-vapid-keys`.
2. Cadastre:
   - `PUSH_DRIVER=webpush`
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY=<Public Key>`
   - `VAPID_PRIVATE_KEY=<Private Key>`
   - `VAPID_SUBJECT=mailto:agenn.sistema@gmail.com`
3. Faça um novo deploy (a chave pública entra no build).

Trocar o par de chaves invalida todos os aparelhos ativados: cada dono precisa ativar de novo.

## Conferência depois do deploy

1. Android (Chrome): entre no painel, Conta → Avisos de agendamento → "Ativar neste aparelho" → permitir.
   Toque em "Enviar teste": a notificação "Teste do Vitrimove" chega; tocar nela abre a Agenda.
2. iPhone (iOS 16.4+): no Safari, Compartilhar → "Adicionar à Tela de Início"; abra pelo ícone, ative e
   envie o teste. No Safari comum, o cartão deve pedir para instalar.
3. Faça um agendamento real pela vitrine (outro aparelho ou aba anônima): chegam o e-mail
   "Novo agendamento: …" e a notificação "Novo agendamento" nos aparelhos ativados.
4. Desligue "Receber e-mail a cada agendamento", agende de novo: só a notificação chega.
5. Sentry: nenhum erro novo de `notifyOwnerOfAppointment` ou `sendPush`.
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/legal/privacy.ts src/lib/legal/company.ts src/lib/legal/legal.test.ts docs/setup/aviso-agendamento.md
git commit -m "docs: privacidade do push e roteiro do aviso de agendamento

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Verificação final e PR

- [ ] **Step 1:** Run: `npm test && npm run lint && npm run typecheck && npm run build` — Expected: tudo PASS; no `next build`, `/api/agendamentos` continua `ƒ`.
- [ ] **Step 2:** `git push -u origin feat/aviso-agendamento` e abrir o PR contra o branch base certo: se `feat/logo-preco-supabase-afiliado` ainda não estiver no `master`, PR com base nele (ou esperar o merge dele e rebasear).
- [ ] **Step 3:** Conferir no CI: jobs `checks`, `db` (pgTAP 16 + diff dos tipos) e `e2e` (`aviso-agendamento.spec.ts`) verdes.
- [ ] **Step 4:** Depois do merge e deploy: seguir `docs/setup/aviso-agendamento.md`.
