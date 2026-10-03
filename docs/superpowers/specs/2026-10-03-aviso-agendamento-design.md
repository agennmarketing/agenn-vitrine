# Aviso de agendamento para o dono — design

Data: 2026-10-03
Branch: `feat/aviso-agendamento`

## Objetivo

Hoje o dono só fica sabendo de um agendamento novo se a cliente tocar em "Avisar no WhatsApp"
ou se ele abrir o painel. Para negócio de agenda isso é essencial: todo agendamento feito pela
vitrine passa a avisar o dono **por e-mail** (sempre disponível, sem configurar nada) e **por
notificação push** nos aparelhos onde ele ativou (PWA do painel).

Sucesso = um agendamento feito pela vitrine chega ao dono em segundos, por e-mail e/ou push,
sem atrasar a resposta para a cliente e sem quebrar o agendamento se um dos canais falhar.

## Escopo

Dentro:
- Aviso de **agendamento novo** (único evento: a cliente não cancela pela vitrine).
- Destinatário: só o dono da vitrine (profissionais não têm login).
- E-mail via Resend (infra existente) com chave liga/desliga.
- Web Push com VAPID via biblioteca `web-push`, opt-in por aparelho.
- Cartão "Avisos de agendamento" na aba Conta.

Fora (não fazer agora):
- Lembrete antes do horário, aviso para a cliente, aviso de cancelamento, push para profissionais.
- Serviços de terceiros (OneSignal/Firebase).

## Fluxo no agendamento

1. `POST /api/agendamentos` grava pelo `book_appointment` como hoje e responde 201.
2. Logo antes de responder, agenda com `after()` a chamada `notifyOwnerOfAppointment(admin, appointmentId)`
   (mesmo padrão do e-mail de franquia em `src/app/api/video-usage/route.ts`). A cliente nunca espera.
3. `src/features/booking/notify-owner.ts` (server-only):
   - carrega o agendamento (serviço, início, profissional, nome/WhatsApp/observação da cliente),
     a vitrine e o dono; lê `profiles.notify_booking_email` e o e-mail do dono (`auth.admin.getUserById`);
   - **e-mail**, se a chave estiver ligada: `sendEmail` com `idempotencyKey = appointment-<id>`;
   - **push**, para cada linha de `push_subscriptions` do dono: `sendPush`; resposta 404/410 do
     servidor de push apaga a linha;
   - os dois canais rodam com `Promise.allSettled`: um falhar não impede o outro; cada falha vai ao Sentry.
4. Textos montados por funções puras em `src/lib/notifications/appointment-message.ts`:
   - e-mail — assunto `Novo agendamento: <serviço>, <dia abreviado> <dd/mm> às <hh:mm>`; corpo (texto e
     HTML) com serviço, data/hora, profissional (se houver), nome e WhatsApp da cliente (link `wa.me`),
     observação (se houver) e botão "Ver na agenda" → `buildAppUrl('/painel/agenda')`;
   - push — título `Novo agendamento`, corpo `<cliente> · <serviço> · <dia> <dd/mm> <hh:mm>`,
     `url: /painel/agenda`, `tag: appointment-<id>`.
   - Datas sempre no fuso de São Paulo (UTC−3 fixo, como `src/lib/booking/availability.ts`).

## Dados (uma migração)

- `profiles.notify_booking_email boolean not null default true`.
- `push_subscriptions`:
  - `id uuid pk default gen_random_uuid()`
  - `owner_id uuid not null references auth.users on delete cascade`
  - `endpoint text not null unique`
  - `p256dh text not null`, `auth text not null`
  - `user_agent text not null default ''`
  - `created_at timestamptz not null default now()`
  - índice em `owner_id`.
  - RLS: `select`/`insert`/`delete` só com `owner_id = auth.uid()`; sem `update`. Envio lê pelo service_role.
  - Se o mesmo `endpoint` já existir (aparelho reinscrito por outra conta), a server action substitui a
    linha (apaga a antiga pelo service_role e insere a nova) — um aparelho pertence a uma conta só.
- `database.types.ts` atualizado à mão seguindo a ordem alfabética do gerado.

## Ambiente

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:agenn.sistema@gmail.com`).
- `PUSH_DRIVER`: `webpush` | `fake` | `off`, validado em `server-env-schema.ts` (com testes), no mesmo
  formato do `EMAIL_DRIVER`. `webpush` exige as três chaves. `fake` grava JSON em
  `os.tmpdir()/agenn-vitrine-push` para o e2e. `off` não envia.
- `src/lib/push/send-push.ts` (server-only): `sendPush(subscription, payload)` → `{ ok } | { gone }`.
- Par de chaves gerado com `npx web-push generate-vapid-keys`; o usuário cadastra na Netlify.

## Service worker (`public/sw.js`)

- `push`: lê o JSON `{ title, body, url, tag }` e chama `showNotification` com o ícone do painel
  (`/brand/vitrimove-marca-512.png`, o ícone do manifesto do painel), `badge`, `tag` e `data.url`.
- `notificationclick`: fecha a notificação; foca uma janela do mesmo host já aberta e navega para
  `data.url`; senão `clients.openWindow(data.url)`.
- As vitrines usam o mesmo arquivo, mas nunca se inscrevem — nada muda para a cliente.

## Tela: cartão "Avisos de agendamento" na aba Conta

Só aparece se o dono tem vitrine do tipo serviços.

- Chave **"Receber e-mail a cada agendamento"** — server action grava `notify_booking_email`.
- **"Notificação neste aparelho"** — componente cliente com estados:
  - *sem suporte* (sem `serviceWorker`/`PushManager`/`Notification`): "Este navegador não recebe
    notificações. Os e-mails continuam chegando.";
  - *iPhone/iPad fora do app instalado* (iOS sem `display-mode: standalone`): "Para receber no iPhone,
    adicione o Vitrimove à tela de início e abra por lá.";
  - *permissão negada*: explica como liberar nas configurações do navegador;
  - *desligado*: botão "Ativar neste aparelho" → `Notification.requestPermission()` →
    `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })` → server action salva;
  - *ligado* (há inscrição no navegador e no banco): "Desativar" (unsubscribe + apaga a linha) e
    "Enviar teste" (server action envia um push de teste só para esse endpoint).
- Server actions validam com zod (endpoint `https`, chaves base64url) e exigem sessão.

## Privacidade

`src/lib/legal/privacy.ts`: acrescentar que, ao ativar notificações, guardamos o endereço de push do
aparelho e o nome do navegador, apagados ao desativar ou ao excluir a conta.

## Tratamento de erros

- Falha de e-mail ou push nunca muda a resposta do agendamento (roda em `after()`, erros ao Sentry).
- Inscrição expirada (404/410) é apagada; outros erros de push são só registrados.
- Sem dono com e-mail ou sem inscrições: nada a fazer, sem erro.

## Testes

- Unitário (vitest): textos de e-mail e push (data/hora em SP, com e sem profissional/observação);
  `server-env-schema` com `PUSH_DRIVER`; decisão de canais em `notify-owner` com dependências injetadas
  (chave desligada → sem e-mail; 410 → apaga inscrição; falha de um canal não impede o outro).
- Banco (`test:db`): RLS de `push_subscriptions` (dono vê/insere/apaga só as próprias).
- E2E (build de produção, drivers `fake`): agendar pela vitrine → e-mail fake gravado; desligar a chave
  na Conta → nenhum e-mail; inscrição fake no banco → push fake gravado.
- Roteiro manual pós-deploy (`docs/setup/aviso-agendamento.md`): ativar no Android (Chrome) e no iPhone
  com o app instalado, "Enviar teste", fazer um agendamento real e conferir e-mail e push.
