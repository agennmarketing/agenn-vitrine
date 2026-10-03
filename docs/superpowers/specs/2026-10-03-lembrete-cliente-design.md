# Lembrete de agendamento para a cliente — design

Data: 2026-10-03
Branch: `feat/aviso-agendamento` (depende da base de push do aviso ao dono)
Depende de: `docs/superpowers/specs/2026-10-03-aviso-agendamento-design.md` e do plano
`docs/superpowers/plans/2026-10-03-aviso-agendamento.md` — `web-push`, variáveis VAPID,
`sendPush`/`PushTarget`/`PushResult` e o evento `push` do `public/sw.js` vêm de lá.

## Objetivo

Reduzir faltas: a cliente que pedir recebe uma **notificação push 24 h antes** do horário
agendado. É o recurso mais pedido nesse mercado e vira argumento de venda. Só push — nada de
WhatsApp, SMS ou e-mail para a cliente.

Sucesso = cliente que ativou recebe exatamente um lembrete ~24 h antes, com atalho para avisar
pelo WhatsApp se não puder ir; o dono vê na Agenda que o lembrete foi ativado/enviado.

## Decisões

- Oferecido em **qualquer navegador com push** (Android/Chrome e computador sem instalar; iPhone
  só com o app na tela de início — a tela ensina a instalar).
- Envio **24 h antes**, verificado de hora em hora. Quem agenda com **menos de 24 h** de
  antecedência não recebe lembrete (o bloco nem aparece).
- Sem chave para o dono: o lembrete só vai para quem pediu.

## Fora do escopo

Cliente cancelar/remarcar sozinha, lembrete por WhatsApp/SMS/e-mail, segundo lembrete (2 h antes),
mudanças na página de vendas.

## Experiência da cliente (vitrine)

Na tela de confirmação do `src/app/v/[subdomain]/booking-flow.tsx` (passo `done`):

- Bloco "Me lembrar um dia antes" com botão **Ativar lembrete**, só se faltar mais de 24 h para o
  horário. Estados (reaproveita `pushSupport`/`isIosDevice`/`vapidKeyBytes` de
  `src/lib/notifications/push-support.ts`):
  - *pronto*: pede permissão → `pushManager.subscribe` → `POST /api/agendamentos/lembrete` →
    "Pronto! Você recebe um lembrete 24 h antes.";
  - *permissão já concedida* (agendou antes neste aparelho): ativa sozinho ao abrir a confirmação e
    mostra "Lembrete ativado.";
  - *iPhone fora do app instalado*: "Para receber o lembrete no iPhone, adicione esta página à tela
    de início e abra por lá.";
  - *sem suporte*, *permissão negada* ou sem `NEXT_PUBLIC_VAPID_PUBLIC_KEY`: o bloco não aparece.
- Falha ao ativar: mensagem curta "Não foi possível ativar o lembrete." — a confirmação do
  agendamento continua valendo.

## API

- `POST /api/agendamentos` passa a devolver também `id` (uuid do agendamento) no 201.
- `POST /api/agendamentos/lembrete` — corpo `{ appointmentId, endpoint, keys: { p256dh, auth } }`:
  - vitrine pelo host (`vitrineSubdomain`), mesmo rate limit dos agendamentos (chave `lembretes`);
  - valida com `pushSubscriptionSchema` + `isUuid`;
  - confere: agendamento desta vitrine, `status = 'confirmed'`, `starts_at - created_at > 24 h` e
    `starts_at > now() + 24 h`; senão 404/422 com mensagem curta;
  - grava em `appointment_reminders` (upsert por `(appointment_id, endpoint)`) e liga
    `appointments.reminder_opt_in = true`; responde 204.

## Dados (uma migração)

- `appointments.reminder_opt_in boolean not null default false`
- `appointments.reminder_sent_at timestamptz`
- `appointment_reminders`:
  - `id uuid pk default gen_random_uuid()`
  - `appointment_id uuid not null references public.appointments on delete cascade`
  - `endpoint text not null`, `p256dh text not null`, `auth text not null`
  - `created_at timestamptz not null default now()`
  - `unique (appointment_id, endpoint)`
  - RLS ligada, **sem policies**; `revoke all` de `anon` e `authenticated`. Só o service_role usa.
- Dois triggers em `appointments`:
  - `before update`: `starts_at` mudou (remarcação) → `new.reminder_sent_at := null`, para o lembrete
    valer para o novo horário. Se o novo horário já estiver a menos de 24 h, o lembrete sai na hora
    cheia seguinte (a antecedência é medida contra `created_at`, que não muda) — aceitável e útil;
  - `after update`: `status` virou `cancelled` → apaga as linhas de `appointment_reminders` do
    agendamento.
- RPC `claim_due_reminders(p_limit int)` — `security definer`, só service_role. Numa única
  instrução, marca `reminder_sent_at = now()` e devolve `id` dos agendamentos com:
  `status = 'confirmed'`, `reminder_sent_at is null`, `starts_at > now()`,
  `starts_at <= now() + interval '24 hours'`, `starts_at - created_at >= interval '24 hours'` e
  existe linha em `appointment_reminders`; ordenados por `starts_at`, limitados a `p_limit`
  (`for update skip locked`). Marcar antes de enviar = no máximo um lembrete (no pior caso, nenhum).
- `cleanup_expired_rows` (tarefa diária) passa a apagar `appointment_reminders` de agendamentos com
  `starts_at < now()` ou `status <> 'confirmed'`.
- `database.types.ts` à mão, ordem alfabética.

## Envio de hora em hora

- `netlify/functions/cron-lembretes.ts`, `schedule: '5 * * * *'`, mesmo formato da
  `cron-diaria.ts`: `GET /api/cron/lembretes` com `Authorization: Bearer ${CRON_SECRET}`.
- `src/app/api/cron/lembretes/route.ts`: confere o segredo (igual à diária); chama
  `claim_due_reminders(100)`; para cada id carrega agendamento (serviço, início, profissional,
  código), vitrine (nome, subdomínio, logo, WhatsApp principal) e as inscrições; envia com
  `sendPush`, no máximo 10 ao mesmo tempo; depois apaga as inscrições do agendamento (enviadas,
  expiradas 404/410 ou com erro). Erros vão ao Sentry; a rota responde `{ sent, failed }`.
- Sobrou mais de 100: saem na hora seguinte (a janela não tem limite inferior além de `now()`).

## Notificação

Texto por função pura em `src/lib/notifications/reminder-message.ts`:

- `icon`: logo da vitrine (versão pequena) ou `/brand/vitrimove-marca-512.png`.
- `title`: `Lembrete: amanhã às 14:00` — "amanhã"/"hoje"/`sáb 04/10` comparando o dia do horário
  com o dia do envio, ambos em São Paulo (UTC−3 fixo).
- `body`: `Corte no Studio Bela, com Bia. Não vai conseguir ir? Avise pelo WhatsApp.`
  (sem profissional: `Corte no Studio Bela. Não vai conseguir ir? Avise pelo WhatsApp.`)
- `url`: raiz da vitrine (`buildVitrineUrl`).
- `actions`: `[{ action: 'whatsapp', title: 'Avisar no WhatsApp' }]` com `whatsappUrl` =
  `https://wa.me/<WhatsApp principal>?text=` + `Olá! Tenho horário amanhã às 14:00 (Corte, código AB23) e não vou conseguir ir.`
  (sem WhatsApp principal: sem a ação).
- `tag`: `reminder-<id>`.

`PushPayload` ganha campos opcionais `icon?: string`, `actions?: { action: string; title: string }[]`
e `whatsappUrl?: string`. No `public/sw.js`: o `push` usa `data.icon` quando vier e repassa
`actions`; o `notificationclick` com `event.action === 'whatsapp'` abre `data.whatsappUrl`
(`clients.openWindow`), senão segue o fluxo atual com `data.url`.

## Painel (Agenda)

`src/app/app/(painel)/painel/agenda/appointments.tsx`: no card do agendamento, selo
"Lembrete enviado" quando `reminder_sent_at` existe, senão "Lembrete ativado" quando
`reminder_opt_in` é verdadeiro. A consulta da página passa a ler as duas colunas.

## Privacidade

`src/lib/legal/privacy.ts`, parágrafo do cliente que agenda: se a cliente ativa o lembrete,
guardamos o endereço de notificação do aparelho dela só para enviar esse lembrete, apagado logo
após o envio, ou quando o agendamento passa ou é cancelado; o dono é o controlador.
`LEGAL_VERSION` atualizado.

## Tratamento de erros

- Ativar o lembrete nunca afeta o agendamento já confirmado.
- Falha de envio: registrada no Sentry; o agendamento fica marcado como lembrado (sem reenvio).
- Cron sem segredo/segredo errado: 503/401, como a diária.

## Testes

- Unitário: `reminder-message` (amanhã/hoje/data, com e sem profissional, com e sem WhatsApp,
  link `wa.me` com texto codificado); validação do corpo da rota de lembrete.
- pgTAP: `claim_due_reminders` respeita janela de 24 h, antecedência mínima de 24 h, cancelado,
  sem inscrição e não devolve o mesmo agendamento duas vezes; trigger zera `reminder_sent_at` ao
  remarcar e apaga inscrições ao cancelar; anon/authenticated não leem `appointment_reminders`.
- E2E (build de produção, `PUSH_DRIVER=fake`): agendar pela API para daqui a 2 dias → ativar com
  inscrição fake → ajustar pelo admin `starts_at`/`ends_at`/`blocked_until` para daqui a 23 h e
  `created_at` para 3 dias atrás → chamar `/api/cron/lembretes` com o segredo → push fake com o
  título e a ação de WhatsApp; segunda chamada não envia de novo; Agenda mostra "Lembrete enviado".
- Roteiro manual (acrescentar em `docs/setup/aviso-agendamento.md`): ativar o lembrete num Android
  real, adiantar o horário pelo SQL do Supabase, esperar a hora cheia e conferir notificação e botão.
