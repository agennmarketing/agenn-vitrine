# Agendamento de serviços — design

Data: 2026-09-21. Aprovado pelo usuário no chat (com autorização para commit e deploy).

## Objetivo

Transformar o fluxo de serviços em **vitrine + agendamento**. O cliente escolhe o serviço, uma data com
disponibilidade, um horário livre, informa nome, WhatsApp e observação opcional e confirma. O agendamento é
salvo, bloqueia a agenda (duração + intervalo) e aparece na aba **Agenda** do painel. O público nunca vê a
agenda: só datas com horário livre e, depois de escolher a data, só os horários livres.

Produtos continua no código, oculto da interface.

## Decisões

| Tema | Decisão |
| --- | --- |
| Onde o dono vê | Aba **Agenda** no editor (só vitrines de serviços). Sem integração externa. |
| WhatsApp | Tela de confirmação + botão opcional "Avisar no WhatsApp" com a mensagem pronta. |
| Capacidade | Um atendimento por vez (uma agenda por vitrine). |
| Status | Confirmado na hora; o dono pode cancelar (libera o horário). |
| Regras | Horários por dia (editáveis), intervalo entre atendimentos, antecedência mínima, janela de dias, bloqueios avulsos. |
| Grade | Horários a cada 30 min a partir da abertura; o serviço termina até o fechamento. |
| Observação do serviço | Aviso público ao cliente (`items.notice`), mostrado no popup e na confirmação. |
| Duração | Obrigatória em serviços. Serviços antigos sem duração recebem 60 min. |
| CTA | "Agendar horário" (migração troca quem ainda usa o padrão antigo). |
| Fuso | America/Sao_Paulo, UTC−3 fixo (sem horário de verão desde 2019). |

## Dados

- `items.notice` (1–300, opcional).
- `vitrines.booking_buffer_minutes` (0–120, padrão 0), `booking_min_notice_minutes` (0–10080, padrão 60),
  `booking_max_days_ahead` (1–180, padrão 30). `business_hours` passa a ser editável na Agenda.
- `booking_blocks`: bloqueio avulso `[starts_at, ends_at)` com motivo opcional. Dono lê, cria e remove.
- `appointments`: retrato do serviço (nome, preço em texto, duração), cliente (nome, WhatsApp E.164,
  observação), `starts_at`, `ends_at` (= início + duração), `blocked_until` (= fim + intervalo), `status`
  (`confirmed`/`cancelled`), `code` de 4 caracteres único por vitrine. Dono lê e cancela; ninguém cria pelo
  cliente do Supabase — só `book_appointment` (service_role).
- **Sem dupla reserva**: `exclude using gist (vitrine_id with =, tstzrange(starts_at, blocked_until) with &&)
  where (status = 'confirmed')` (btree_gist). `book_appointment` trava a linha da vitrine, confere bloqueios
  e insere; conflito vira `slot_unavailable`.

## Motor de disponibilidade (`src/lib/booking/availability.ts`, puro)

Um início `s` na data `d` é livre quando:

1. `d` é dia de atendimento e `s` está na grade de 30 min a partir da abertura, com `s + duração ≤ fechamento`;
2. `s ≥ agora + antecedência mínima` e `d ≤ hoje + janela`;
3. `[s, s + duração + intervalo)` não cruza `[início, blocked_until)` de agendamento confirmado;
4. `[s, s + duração)` não cruza bloqueio avulso.

## API pública (host da vitrine)

- `GET /api/agenda?item=<id>` → `{ dates }` (datas com pelo menos um horário livre).
- `GET /api/agenda?item=<id>&data=AAAA-MM-DD` → `{ times }`.
- `POST /api/agendamentos` → valida, limita por IP, recalcula os horários, confere o pedido e chama
  `book_appointment`. 201 `{ code, … }`; 409 quando o horário acabou de ser reservado; 422 dados inválidos.

Nenhuma resposta traz nome, horário ocupado ou qualquer dado de outro cliente.

## Interface

- Vitrine: botão "Agendar horário"; passos no popup: data → horário → nome → WhatsApp → observação → Confirmar.
  Confirmação com serviço, data, horário, valor, aviso, código e "Avisar no WhatsApp". Se o horário foi tomado,
  aviso e a lista de horários é recarregada.
- Painel: aba **Agenda** com próximos agendamentos por dia (cliente, serviço, WhatsApp, Cancelar), regras
  (horários por dia, intervalo, antecedência, janela) e bloqueios (adicionar/remover). Cadastro do serviço com
  duração obrigatória e "Aviso ao cliente".

## Testes

- Vitest: motor (grade, intervalo, fechamento, antecedência, janela, bloqueios, ocupados), validação do pedido,
  mensagem do WhatsApp.
- pgTAP: exclusão recusa sobreposição, cancelar libera, bloqueio recusa, RLS.
- e2e: agendar pela vitrine, horário ocupado some, cancelar pela Agenda devolve o horário.
