# Fase 4 — Complementos, sacola e vitrine de Comida: Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O dono monta uma biblioteca de grupos de complementos (inclusive sabores de pizza), liga os grupos aos itens e configura a sacola e o formulário do pedido; o cliente escolhe complementos, quantidade e observação, junta vários itens numa sacola guardada no aparelho, preenche o formulário e envia ao WhatsApp a mensagem completa com código de pedido; o simulador recalcula tudo com os complementos; a vitrine de Comida passa a ser criada pelo assistente.

**Architecture:** Mesmo app Next.js 16 das fases anteriores. O banco ganha `addon_groups`, `addon_options`, `item_addon_groups` e `checkout_settings` (criado por trigger para toda vitrine). As regras ficam em funções puras testadas com Vitest: seleção e preço de complementos, sacola (linhas, junção, reconciliação, totais), validação do formulário e mensagem da sacola. A vitrine pública recebe os grupos já montados no catálogo estático; a sacola vive em `localStorage` por vitrine, com fallback em memória. `POST /api/orders` passa a validar complementos no servidor e gravar os preços do momento; o simulador soma complementos pelos preços atuais.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase (Postgres + RLS), Zod, Vitest, Playwright, pgTAP, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-16-agenn-vitrine-design.md`. Seções usadas: 1 (tipo Comida), 3 (sacola e complementos em todos os planos), 4.2 (`checkout_settings`), 4.4, 4.5 (payload com complementos e observação), 4.6 (regras 2 e 3), 7.2 (ícone da sacola), 7.3 (complementos, quantidade, observação, botão "Adicionar · R$ X", validação), 7.4, 7.5 (mensagem da sacola e complementos no botão direto), 8.3 (Comida no assistente, `checkout_settings` padrão, sacola ligada só em Comida), 8.4 (abas Complementos e Sacola e mensagens), 8.5 (grupos no item), 8.6 (simulador com complementos), 11 e 12 (Fase 4).

**Base:** Fases 1–3 concluídas (PRs até #21). Planos anteriores em `docs/superpowers/plans/`. Guias em `docs/setup/`.

---

## Como trabalhar nesta fase

Igual às Fases 2 e 3:

- Uma branch e um PR por bloco: `fase-4/bloco-N-<nome>`.
- Localmente só `npm run lint`, `npm run typecheck`, `npm test`. pgTAP, tipos do banco, build e Playwright rodam no CI.
- **Rotina de migração:** push → job `db` gera `database-types` (falha esperada no diff) → `gh run download <run-id> --name database-types --dir <scratchpad>/types` → copiar para `src/lib/supabase/database.types.ts` → commit.
- Merge só com CI verde e autorização do usuário. O job `migrate` aplica migrações no Supabase dev.
- `gh` em `C:\Program Files\GitHub CLI\gh.exe` (no bash: `export PATH="$PATH:/c/Program Files/GitHub CLI"`).
- Não há passo de infraestrutura do usuário nesta fase.

**Lições das fases anteriores que valem aqui:**
- Joins do PostgREST entre `media` e `vitrines` precisam da dica `vitrines!media_vitrine_id_fkey(...)`; sempre conferir o `error` das consultas.
- `getByLabel` do Playwright casa por trecho: use `{ exact: true }` quando um rótulo é começo de outro.
- Botões que trocam de `type` na mesma posição precisam de `key` diferente.
- Tipos gerados exigem colunas preenchidas por trigger (ex.: `items.code`): converter com comentário.
- Trechos "Acrescente em" do plano não substituem o arquivo inteiro.
- Crases de Markdown nunca dentro de `bash -c`/`node -e` com aspas duplas: usar arquivo de script.

---

## Global Constraints

- **Idioma:** textos visíveis em português do Brasil; identificadores em inglês.
- **Planos:** sacola, complementos, vários WhatsApp e simulador existem no gratuito e no Pro (spec 3). Nenhuma trava de plano nesta fase.
- **Modos do formulário:** cada `*_mode` vale `off`, `optional` ou `required`.
- **Opções de pagamento padrão:** `{Pix, Cartão na entrega, Dinheiro}`. Com "Dinheiro", o formulário pergunta `Troco para quanto?` (opcional).
- **Observação do item:** até 140 caracteres. **Observação geral da sacola:** até 300 caracteres.
- **Preço (spec 4.6):**
  1. base = variação ou item, promoção quando houver; `on_request` fica fora da soma;
  2. grupo `standard`: soma de `price_cents × qty` de cada opção;
  3. grupo `flavors`: soma ao preço base o **maior** preço ou a **média arredondada para cima em centavos** das opções escolhidas (`flavor_price_rule`);
  4. total da linha = (base + complementos) × quantidade.
- **Seleção de complementos:** a contagem de um grupo é a soma das quantidades escolhidas nele; precisa ficar entre `min_select` e `max_select`. `required` ⇔ `min_select ≥ 1`. Sem `allow_repeat`, cada opção vale no máximo 1. Grupos `flavors` nunca têm `allow_repeat`.
- **Selos (spec 7.3):** obrigatório → `Obrigatório · escolha N` (ou `Obrigatório · escolha N a M` quando mínimo ≠ máximo); opcional → `Opcional · até M`.
- **Botão do item:** sacola ligada → `Adicionar · R$ X` (sem valor com preços ocultos ou item sob consulta); sacola desligada → texto do item ou da vitrine e envio direto.
- **Barra da sacola:** `Ver sacola · N itens · R$ X` (`1 item` no singular; sem valor com preços ocultos; `+ itens sob consulta` quando houver).
- **Mensagem da sacola (spec 7.5), exatamente:**

```
*Pedido #K7F2 – Burger do Zé*

2x *X-Bacon* (cód. 104)
   • Ponto: Ao ponto
   • Adicionais: 2x Bacon, 1x Cheddar
   • Obs: sem cebola

1x *Coca-Cola lata* (cód. 210)

Retirada · Nome: Ana · Pagamento: Pix
```

  - Sem código de pedido: `*Pedido – Burger do Zé*`.
  - Variação: `*X-Bacon – Duplo*`.
  - Linha de complementos: `   • {grupo}: {opções}`; com `allow_repeat`, cada opção como `Nx Nome`; sem, só o nome.
  - Rodapé, nesta ordem e separado por ` · `: `Retirada` ou `Entrega` + `Endereço: …`; `Nome: …`; `Pagamento: …` (com Dinheiro e troco: `Pagamento: Dinheiro (troco para R$ 50,00)`); `Agendado para DD/MM às HH:MM`; `Obs: …` (observação geral). Sem nenhuma parte, sem rodapé.
  - Nenhum valor em reais, exceto o troco.
- **Botão direto com complementos:** as mesmas linhas `   • …` (e `   • Obs: …`) depois de uma linha em branco.
- **Payload do pedido:** nunca guarda nome, endereço, pagamento, data ou observação geral (spec 4.5). Guarda por linha: item, código, nome, quantidade, variação, complementos (`group_id`, `group_name`, `option_id`, `name`, `qty`, `price_cents`), observação do item, `unit_price_cents` (base) e `addons_unit_cents`.
- **Sacola no aparelho:** `localStorage` com a chave `agenn-sacola:{vitrineId}`, sempre dentro de `try/catch`; sem armazenamento, só em memória (spec 7.4).
- **Segurança:** toda tabela nova com RLS, `revoke all … from anon, authenticated` e grants por coluna; tabelas filhas conferem o dono do pai.
- **Design:** sem etapas de refinamento visual (fase de design dedicada depois).

---

## Decisões desta fase

| Tema | Decisão | Motivo |
|---|---|---|
| `checkout_settings` padrão | Criado por trigger ao inserir a vitrine (e para as já existentes). Comida: nome, retirada/entrega e pagamento obrigatórios, data off, observações opcionais. Serviços: nome obrigatório, data e horário opcionais, observações opcionais, resto off. Produtos: nome e observações opcionais, resto off | A spec pede "padrão" sem detalhar; valores pensados para cada tipo, editáveis na aba. |
| Contagem em grupos | Soma das quantidades escolhidas | Permite "Adicionais: até 5" contando `2x Bacon` como 2. |
| Quantidade do item | Só com a sacola ligada | A mensagem do botão direto (spec 7.5) não tem quantidade. A observação aparece nos dois modos. |
| Sabores | Quantidade sempre 1 por sabor; preço pela regra do grupo, somado ao preço base | "½ calabresa ½ calabresa" não faz sentido; a regra da spec usa o preço das opções escolhidas. |
| Salvar grupo | Grupo e opções salvos por ação do servidor; opções sincronizadas por id (não apaga e recria) | Preserva os ids que estão em sacolas e pedidos. |
| Editar linha da sacola | Abre a tela do item preenchida; o botão vira `Salvar alterações · R$ X` | Spec 7.4 pede editar; reaproveita a mesma tela. |
| Envio da sacola | Vai para o WhatsApp principal da vitrine | Uma sacola pode misturar itens com WhatsApp diferentes; a spec só define o botão direto por item. |
| Sacola após enviar | Esvaziada ao abrir o WhatsApp | Evita reenviar o mesmo pedido por engano. |
| Duplicar item | Copia também os grupos ligados | Mesmo comportamento das variações. |
| Modelos de grupo | Constante no código, pré-preenchem o formulário (nada é salvo até "Salvar grupo") | Spec 8.4: "modelos prontos". |

---

## Mapa de arquivos

```
supabase/migrations/20260920000000_addons_checkout.sql
supabase/tests/database/09_addons_checkout.test.sql

src/lib/addons/addons.ts                          # tipos, selos, validação da seleção, preço e linhas da mensagem (+ test)
src/lib/addons/templates.ts                       # modelos prontos (+ test)
src/lib/cart/cart.ts                              # linhas da sacola: juntar, quantidade, remover, trocar, guardar (+ test)
src/lib/cart/reconcile.ts                         # conferir com o catálogo, preço da linha e totais (+ test)
src/lib/cart/checkout.ts                          # tipos e validação do formulário (+ test)
src/lib/whatsapp/cart-message.ts                  # mensagem da sacola e linhas do botão direto (+ test)
src/lib/pricing/price.ts                          # (sem mudança; lineTotalCents já recebe complementos)
src/lib/vitrines/vitrine-types.ts                 # Comida no assistente (+ test)
src/lib/vitrines/schemas.ts                       # addonGroupSchema, checkoutSettingsSchema, itemSchema.addonGroupIds (+ test)
src/lib/orders/snapshot.ts                        # linhas com complementos (+ test)
src/lib/simulator/simulate.ts                     # complementos no recálculo e no resumo (+ test)

src/features/addons/actions.ts                    # salvar e excluir grupos
src/features/addons/queries.ts                    # grupos da vitrine para painel e item
src/features/vitrines/actions.ts                  # updateCheckoutAction (troca updateMessagesAction)
src/features/items/actions.ts                     # sincroniza item_addon_groups; duplicar copia
src/features/items/queries.ts                     # grupos ligados ao item
src/features/simulator/actions.ts                 # itens com grupos
src/features/public/build-catalog.ts              # grupos no item; sacola e formulário na vitrine (+ test)
src/features/public/load-vitrine.ts
src/app/api/orders/route.ts                       # complementos no pedido

src/app/app/(painel)/painel/vitrines/[id]/editor-tabs.tsx
src/app/app/(painel)/painel/vitrines/[id]/complementos/page.tsx
src/app/app/(painel)/painel/vitrines/[id]/complementos/addon-groups.tsx
src/app/app/(painel)/painel/vitrines/[id]/mensagens/page.tsx
src/app/app/(painel)/painel/vitrines/[id]/mensagens/messages-form.tsx
src/app/app/(painel)/painel/vitrines/[id]/itens/item-form.tsx
src/app/app/(painel)/painel/vitrines/[id]/itens/novo/page.tsx
src/app/app/(painel)/painel/vitrines/[id]/itens/[itemId]/page.tsx
src/app/app/(painel)/painel/vitrines/nova/wizard.tsx
src/app/app/(painel)/painel/simulador/simulator.tsx

src/app/v/[subdomain]/addon-picker.tsx            # grupos na tela do item
src/app/v/[subdomain]/cart-store.ts               # sacola em localStorage + useSyncExternalStore
src/app/v/[subdomain]/cart-sheet.tsx              # sacola, formulário e envio
src/app/v/[subdomain]/item-sheet.tsx              # complementos, quantidade, observação, adicionar/editar
src/app/v/[subdomain]/send-direct.ts              # complementos e observação no botão direto
src/app/v/[subdomain]/send-cart.ts                # pedido da sacola
src/app/v/[subdomain]/catalog.tsx                 # ícone e barra da sacola

e2e/helpers.ts                                    # seedAddonGroup, linkAddonGroup, setCheckout
e2e/addons-panel.spec.ts
e2e/cart.spec.ts
e2e/fluxo-completo.spec.ts                        # Comida com sacola
docs/setup/fase-4-conferencia.md
```

---

# Bloco 0 — Banco: complementos e formulário da sacola

Branch: `fase-4/bloco-0-banco`.

### Task 1: Tabelas, trigger do formulário padrão e RLS

**Files:**
- Create: `supabase/migrations/20260920000000_addons_checkout.sql`, `supabase/tests/database/09_addons_checkout.test.sql`

**Interfaces:**
- Produces (SQL):
  - `addon_groups (id, owner_id, vitrine_id, name, kind, required, min_select, max_select, allow_repeat, flavor_price_rule, position, created_at, updated_at)`
  - `addon_options (id, owner_id, group_id, name, price_cents, sold_out, position, created_at, updated_at)`
  - `item_addon_groups (owner_id, item_id, group_id, position, created_at)`, PK `(item_id, group_id)`; erro `invalid_reference:addon_group` se item e grupo forem de vitrines diferentes
  - `checkout_settings (id, owner_id, vitrine_id único, name_mode, fulfillment_mode, payment_mode, schedule_mode, notes_mode, payment_options, created_at, updated_at)`, criado pelo trigger `vitrines_create_checkout_settings`

- [ ] **Step 1: Migração**

`supabase/migrations/20260920000000_addons_checkout.sql`:

```sql
-- Complementos (spec 4.4) e formulário da sacola (spec 4.2)

create table public.addon_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  vitrine_id uuid not null references public.vitrines (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  kind text not null default 'standard' check (kind in ('standard', 'flavors')),
  required boolean not null default false,
  min_select int not null default 0 check (min_select between 0 and 20),
  max_select int not null default 1 check (max_select between 1 and 20),
  allow_repeat boolean not null default false,
  flavor_price_rule text check (flavor_price_rule in ('max', 'average')),
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint addon_groups_min_max check (min_select <= max_select),
  constraint addon_groups_required_min check (required = (min_select > 0)),
  constraint addon_groups_flavor_rule check ((kind = 'flavors') = (flavor_price_rule is not null)),
  constraint addon_groups_flavors_no_repeat check (kind <> 'flavors' or not allow_repeat)
);

create index addon_groups_vitrine_idx on public.addon_groups (vitrine_id, position);

create trigger addon_groups_set_updated_at
  before update on public.addon_groups
  for each row execute function public.set_updated_at();

create table public.addon_options (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  group_id uuid not null references public.addon_groups (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  price_cents int not null default 0 check (price_cents >= 0),
  sold_out boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index addon_options_group_idx on public.addon_options (group_id, position);

create trigger addon_options_set_updated_at
  before update on public.addon_options
  for each row execute function public.set_updated_at();

create table public.item_addon_groups (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  group_id uuid not null references public.addon_groups (id) on delete cascade,
  position int not null default 0,
  created_at timestamptz not null default now(),
  primary key (item_id, group_id)
);

create index item_addon_groups_group_idx on public.item_addon_groups (group_id);

-- Item e grupo precisam ser da mesma vitrine.
create function public.item_addon_groups_check_vitrine()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.items i
    join public.addon_groups g on g.vitrine_id = i.vitrine_id
    where i.id = new.item_id and g.id = new.group_id
  ) then
    raise exception 'invalid_reference:addon_group' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function public.item_addon_groups_check_vitrine() from public, anon, authenticated;

create trigger item_addon_groups_check_vitrine
  before insert or update on public.item_addon_groups
  for each row execute function public.item_addon_groups_check_vitrine();

create table public.checkout_settings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  vitrine_id uuid not null unique references public.vitrines (id) on delete cascade,
  name_mode text not null default 'optional' check (name_mode in ('off', 'optional', 'required')),
  fulfillment_mode text not null default 'off' check (fulfillment_mode in ('off', 'optional', 'required')),
  payment_mode text not null default 'off' check (payment_mode in ('off', 'optional', 'required')),
  schedule_mode text not null default 'off' check (schedule_mode in ('off', 'optional', 'required')),
  notes_mode text not null default 'optional' check (notes_mode in ('off', 'optional', 'required')),
  payment_options text[] not null default array['Pix', 'Cartão na entrega', 'Dinheiro']
    check (cardinality(payment_options) <= 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint checkout_payment_options_when_used check (payment_mode = 'off' or cardinality(payment_options) > 0)
);

create trigger checkout_settings_set_updated_at
  before update on public.checkout_settings
  for each row execute function public.set_updated_at();

-- Formulário padrão por tipo de vitrine (spec 8.3).
create function public.default_checkout_settings(p_vitrine_id uuid, p_owner_id uuid, p_type text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.checkout_settings (vitrine_id, owner_id, name_mode, fulfillment_mode, payment_mode, schedule_mode, notes_mode)
  values (
    p_vitrine_id,
    p_owner_id,
    case p_type when 'produtos' then 'optional' else 'required' end,
    case p_type when 'comida' then 'required' else 'off' end,
    case p_type when 'comida' then 'required' else 'off' end,
    case p_type when 'servicos' then 'optional' else 'off' end,
    'optional'
  )
  on conflict (vitrine_id) do nothing;
$$;

revoke execute on function public.default_checkout_settings(uuid, uuid, text) from public, anon, authenticated;

create function public.vitrines_create_checkout_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.default_checkout_settings(new.id, new.owner_id, new.type);
  return null;
end;
$$;

revoke execute on function public.vitrines_create_checkout_settings() from public, anon, authenticated;

create trigger vitrines_create_checkout_settings
  after insert on public.vitrines
  for each row execute function public.vitrines_create_checkout_settings();

-- Vitrines que já existem.
select public.default_checkout_settings(v.id, v.owner_id, v.type) from public.vitrines v;

-- RLS e privilégios
alter table public.addon_groups enable row level security;
alter table public.addon_options enable row level security;
alter table public.item_addon_groups enable row level security;
alter table public.checkout_settings enable row level security;

revoke all on public.addon_groups from anon, authenticated;
grant select, delete on public.addon_groups to authenticated;
grant insert (vitrine_id, name, kind, required, min_select, max_select, allow_repeat, flavor_price_rule, position)
  on public.addon_groups to authenticated;
grant update (name, kind, required, min_select, max_select, allow_repeat, flavor_price_rule, position)
  on public.addon_groups to authenticated;

create policy "dono lê os próprios grupos" on public.addon_groups
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "dono cria grupos nas próprias vitrines" on public.addon_groups
  for insert to authenticated with check (
    (select auth.uid()) = owner_id
    and exists (select 1 from public.vitrines v where v.id = vitrine_id and v.owner_id = (select auth.uid()))
  );
create policy "dono altera os próprios grupos" on public.addon_groups
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "dono exclui os próprios grupos" on public.addon_groups
  for delete to authenticated using ((select auth.uid()) = owner_id);

revoke all on public.addon_options from anon, authenticated;
grant select, delete on public.addon_options to authenticated;
grant insert (group_id, name, price_cents, sold_out, position) on public.addon_options to authenticated;
grant update (name, price_cents, sold_out, position) on public.addon_options to authenticated;

create policy "dono lê as próprias opções" on public.addon_options
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "dono cria opções nos próprios grupos" on public.addon_options
  for insert to authenticated with check (
    (select auth.uid()) = owner_id
    and exists (select 1 from public.addon_groups g where g.id = group_id and g.owner_id = (select auth.uid()))
  );
create policy "dono altera as próprias opções" on public.addon_options
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "dono exclui as próprias opções" on public.addon_options
  for delete to authenticated using ((select auth.uid()) = owner_id);

revoke all on public.item_addon_groups from anon, authenticated;
grant select, delete on public.item_addon_groups to authenticated;
grant insert (item_id, group_id, position) on public.item_addon_groups to authenticated;
grant update (position) on public.item_addon_groups to authenticated;

create policy "dono lê os próprios vínculos de grupo" on public.item_addon_groups
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "dono liga grupos aos próprios itens" on public.item_addon_groups
  for insert to authenticated with check (
    (select auth.uid()) = owner_id
    and exists (select 1 from public.items i where i.id = item_id and i.owner_id = (select auth.uid()))
  );
create policy "dono reordena os próprios vínculos" on public.item_addon_groups
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "dono desliga os próprios vínculos" on public.item_addon_groups
  for delete to authenticated using ((select auth.uid()) = owner_id);

revoke all on public.checkout_settings from anon, authenticated;
grant select on public.checkout_settings to authenticated;
grant update (name_mode, fulfillment_mode, payment_mode, schedule_mode, notes_mode, payment_options)
  on public.checkout_settings to authenticated;

create policy "dono lê o próprio formulário" on public.checkout_settings
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "dono altera o próprio formulário" on public.checkout_settings
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
```

- [ ] **Step 2: pgTAP**

`supabase/tests/database/09_addons_checkout.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000004a1', 'dono@addons.com'),
  ('00000000-0000-0000-0000-0000000004a2', 'outro@addons.com');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000004a1","role":"authenticated"}', true);

select lives_ok(
  $$ select public.create_vitrine('comida', 'addons-burger', 'Burger', 'light', 'Pedir', 'Principal', '+5511987654321', array['Lanches']) $$,
  'cria vitrine de comida'
);
select results_eq(
  $$ select name_mode, fulfillment_mode, payment_mode, schedule_mode, notes_mode
     from public.checkout_settings c join public.vitrines v on v.id = c.vitrine_id where v.subdomain = 'addons-burger' $$,
  $$ values ('required', 'required', 'required', 'off', 'optional') $$,
  'comida recebe formulário padrão com retirada/entrega e pagamento obrigatórios'
);
select is(
  (select payment_options from public.checkout_settings c join public.vitrines v on v.id = c.vitrine_id where v.subdomain = 'addons-burger'),
  array['Pix', 'Cartão na entrega', 'Dinheiro'],
  'opções de pagamento padrão'
);
select is((select cart_enabled from public.vitrines where subdomain = 'addons-burger'), true, 'sacola ligada em comida');

reset role;
select set_config('test.vitrine', (select id::text from public.vitrines where subdomain = 'addons-burger'), true);
insert into public.categories (id, owner_id, vitrine_id, name)
values ('00000000-0000-0000-0000-00000000c401', '00000000-0000-0000-0000-0000000004a1', current_setting('test.vitrine')::uuid, 'Pizzas');
insert into public.items (id, owner_id, vitrine_id, category_id, name, price_cents)
values ('00000000-0000-0000-0000-00000000e401', '00000000-0000-0000-0000-0000000004a1', current_setting('test.vitrine')::uuid, '00000000-0000-0000-0000-00000000c401', 'X-Bacon', 2590);
set local role authenticated;

select lives_ok(
  format(
    $$ insert into public.addon_groups (vitrine_id, name, kind, required, min_select, max_select, allow_repeat) values (%L, 'Adicionais', 'standard', false, 0, 5, true) $$,
    current_setting('test.vitrine')
  ),
  'dono cria grupo'
);
select throws_ok(
  format(
    $$ insert into public.addon_groups (vitrine_id, name, required, min_select, max_select) values (%L, 'Errado', true, 0, 1) $$,
    current_setting('test.vitrine')
  ),
  '23514', null, 'obrigatório exige mínimo ≥ 1'
);
select throws_ok(
  format(
    $$ insert into public.addon_groups (vitrine_id, name, kind, min_select, max_select, allow_repeat, flavor_price_rule) values (%L, 'Sabores', 'flavors', 0, 2, true, 'max') $$,
    current_setting('test.vitrine')
  ),
  '23514', null, 'sabores não repetem'
);
select throws_ok(
  format(
    $$ insert into public.addon_groups (vitrine_id, name, kind, min_select, max_select) values (%L, 'Sabores', 'flavors', 1, 2) $$,
    current_setting('test.vitrine')
  ),
  '23514', null, 'sabores exigem regra de preço'
);
select throws_ok(
  format(
    $$ insert into public.addon_groups (vitrine_id, name, min_select, max_select) values (%L, 'Invertido', 3, 2) $$,
    current_setting('test.vitrine')
  ),
  '23514', null, 'mínimo não passa do máximo'
);

select lives_ok(
  $$ insert into public.addon_options (group_id, name, price_cents) select id, 'Bacon', 400 from public.addon_groups where name = 'Adicionais' $$,
  'dono cria opção'
);
select lives_ok(
  $$ insert into public.item_addon_groups (item_id, group_id, position) select '00000000-0000-0000-0000-00000000e401', id, 0 from public.addon_groups where name = 'Adicionais' $$,
  'dono liga grupo ao item'
);
select lives_ok(
  $$ update public.checkout_settings set payment_mode = 'optional', payment_options = array['Pix'] $$,
  'dono altera o formulário'
);
select throws_ok(
  $$ update public.checkout_settings set payment_mode = 'required', payment_options = array[]::text[] $$,
  '23514', null, 'pagamento ligado exige ao menos uma opção'
);
select throws_ok(
  $$ update public.checkout_settings set vitrine_id = gen_random_uuid() $$,
  '42501', null, 'formulário não troca de vitrine'
);

-- Outro dono
reset role;
select set_config('test.group', (select id::text from public.addon_groups where name = 'Adicionais'), true);
insert into public.vitrines (id, owner_id, type, subdomain, name, default_button_text)
values ('00000000-0000-0000-0000-00000000f402', '00000000-0000-0000-0000-0000000004a2', 'comida', 'addons-outro', 'Outro', 'Pedir');
insert into public.addon_groups (id, owner_id, vitrine_id, name) values
  ('00000000-0000-0000-0000-00000000a402', '00000000-0000-0000-0000-0000000004a2', '00000000-0000-0000-0000-00000000f402', 'Alheio');
select is(
  (select count(*)::int from public.checkout_settings where vitrine_id = '00000000-0000-0000-0000-00000000f402'),
  1,
  'insert direto também cria o formulário'
);
select throws_ok(
  $$ insert into public.item_addon_groups (owner_id, item_id, group_id) values ('00000000-0000-0000-0000-0000000004a1', '00000000-0000-0000-0000-00000000e401', '00000000-0000-0000-0000-00000000a402') $$,
  'P0001', 'invalid_reference:addon_group', 'grupo de outra vitrine é recusado'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000004a2","role":"authenticated"}', true);
select is((select count(*)::int from public.addon_options), 0, 'outro dono não vê opções alheias');
select throws_ok(
  format($$ insert into public.addon_options (group_id, name) values (%L, 'Invasora') $$, current_setting('test.group')),
  '42501', null, 'outro dono não cria opção em grupo alheio'
);

select * from finish();
rollback;
```

- [ ] **Step 3: Rotina de migração, PR e merge**

```bash
git add supabase
git commit -m "feat(db): complementos, vínculos com itens e formulário da sacola com padrão por tipo"
git push -u origin HEAD
gh pr create --fill --base master
```

Esperar o job `db` (09 ok e falha só no diff dos tipos), baixar `database-types`, copiar, commitar `chore(db): tipos gerados`, push, CI verde.

**Fim do Bloco 0:** autorização → merge → `migrate` aplica a migração no Supabase dev (inclui criar `checkout_settings` para as vitrines existentes).

---

# Bloco 1 — Regras puras

Branch: `fase-4/bloco-1-regras`. Só Vitest.

### Task 2: Complementos e modelos prontos

**Files:**
- Create: `src/lib/addons/addons.ts`, `src/lib/addons/addons.test.ts`, `src/lib/addons/templates.ts`, `src/lib/addons/templates.test.ts`

**Interfaces:**
- Produces:
  - `type AddonOption = { id: string; name: string; priceCents: number; soldOut: boolean }`
  - `type AddonGroup = { id: string; name: string; kind: 'standard' | 'flavors'; required: boolean; minSelect: number; maxSelect: number; allowRepeat: boolean; flavorPriceRule: 'max' | 'average' | null; options: AddonOption[] }`
  - `type AddonSelection = { optionId: string; qty: number }`
  - `groupBadge(group: AddonGroup): string`
  - `validateAddonSelections(groups: AddonGroup[], selections: AddonSelection[]): { ok: true; selections: AddonSelection[] } | { ok: false; groupId: string | null; message: string }`
  - `addonsUnitCents(groups: AddonGroup[], selections: AddonSelection[]): number`
  - `addonMessageLines(groups: AddonGroup[], selections: AddonSelection[]): string[]`
  - `type AddonTemplate = { key: string; label: string; group: Omit<AddonGroup, 'id' | 'options'>; options: { name: string; priceCents: number }[] }`
  - `ADDON_TEMPLATES: AddonTemplate[]`

- [ ] **Step 1: Testes (falhando)**

`src/lib/addons/addons.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { addonMessageLines, addonsUnitCents, groupBadge, validateAddonSelections, type AddonGroup } from './addons'

const ponto: AddonGroup = {
  id: 'g-ponto', name: 'Ponto', kind: 'standard', required: true, minSelect: 1, maxSelect: 1, allowRepeat: false, flavorPriceRule: null,
  options: [
    { id: 'o-mal', name: 'Mal passado', priceCents: 0, soldOut: false },
    { id: 'o-ponto', name: 'Ao ponto', priceCents: 0, soldOut: false },
  ],
}
const adicionais: AddonGroup = {
  id: 'g-adic', name: 'Adicionais', kind: 'standard', required: false, minSelect: 0, maxSelect: 5, allowRepeat: true, flavorPriceRule: null,
  options: [
    { id: 'o-bacon', name: 'Bacon', priceCents: 400, soldOut: false },
    { id: 'o-cheddar', name: 'Cheddar', priceCents: 300, soldOut: false },
    { id: 'o-ovo', name: 'Ovo', priceCents: 250, soldOut: true },
  ],
}
const sabores: AddonGroup = {
  id: 'g-sab', name: 'Sabores', kind: 'flavors', required: true, minSelect: 1, maxSelect: 2, allowRepeat: false, flavorPriceRule: 'average',
  options: [
    { id: 'o-cala', name: 'Calabresa', priceCents: 4990, soldOut: false },
    { id: 'o-4q', name: 'Quatro queijos', priceCents: 5491, soldOut: false },
  ],
}

describe('groupBadge (spec 7.3)', () => {
  it('obrigatório e opcional', () => {
    expect(groupBadge(ponto)).toBe('Obrigatório · escolha 1')
    expect(groupBadge(sabores)).toBe('Obrigatório · escolha 1 a 2')
    expect(groupBadge(adicionais)).toBe('Opcional · até 5')
  })
})

describe('validateAddonSelections', () => {
  it('aceita, junta repetidas e ordena como os grupos', () => {
    expect(
      validateAddonSelections([ponto, adicionais], [
        { optionId: 'o-cheddar', qty: 1 },
        { optionId: 'o-bacon', qty: 1 },
        { optionId: 'o-ponto', qty: 1 },
        { optionId: 'o-bacon', qty: 1 },
      ]),
    ).toEqual({
      ok: true,
      selections: [
        { optionId: 'o-ponto', qty: 1 },
        { optionId: 'o-bacon', qty: 2 },
        { optionId: 'o-cheddar', qty: 1 },
      ],
    })
  })

  it('obrigatório sem escolha', () => {
    expect(validateAddonSelections([ponto], [])).toEqual({ ok: false, groupId: 'g-ponto', message: 'Escolha uma opção em Ponto.' })
    expect(validateAddonSelections([{ ...sabores, minSelect: 2 }], [{ optionId: 'o-cala', qty: 1 }])).toEqual({
      ok: false,
      groupId: 'g-sab',
      message: 'Escolha pelo menos 2 opções em Sabores.',
    })
  })

  it('passar do máximo, repetir sem permissão, esgotado e opção desconhecida', () => {
    expect(validateAddonSelections([adicionais], [{ optionId: 'o-bacon', qty: 6 }])).toEqual({
      ok: false,
      groupId: 'g-adic',
      message: 'Escolha até 5 opções em Adicionais.',
    })
    expect(validateAddonSelections([ponto], [{ optionId: 'o-ponto', qty: 2 }])).toEqual({
      ok: false,
      groupId: 'g-ponto',
      message: 'Em Ponto, escolha cada opção só uma vez.',
    })
    expect(validateAddonSelections([adicionais], [{ optionId: 'o-ovo', qty: 1 }])).toEqual({
      ok: false,
      groupId: 'g-adic',
      message: 'Ovo está esgotado.',
    })
    expect(validateAddonSelections([ponto], [{ optionId: 'x', qty: 1 }])).toEqual({
      ok: false,
      groupId: null,
      message: 'Uma opção escolhida não está mais disponível.',
    })
    expect(validateAddonSelections([adicionais], [{ optionId: 'o-bacon', qty: 0 }]).ok).toBe(false)
  })
})

describe('addonsUnitCents (spec 4.6)', () => {
  it('padrão: soma preço × quantidade', () => {
    expect(addonsUnitCents([adicionais], [{ optionId: 'o-bacon', qty: 2 }, { optionId: 'o-cheddar', qty: 1 }])).toBe(1100)
  })

  it('sabores: maior preço ou média arredondada para cima', () => {
    const escolha = [{ optionId: 'o-cala', qty: 1 }, { optionId: 'o-4q', qty: 1 }]
    expect(addonsUnitCents([sabores], escolha)).toBe(5241)
    expect(addonsUnitCents([{ ...sabores, flavorPriceRule: 'max' }], escolha)).toBe(5491)
    expect(addonsUnitCents([sabores], [])).toBe(0)
  })

  it('soma grupos diferentes', () => {
    expect(addonsUnitCents([ponto, adicionais, sabores], [
      { optionId: 'o-ponto', qty: 1 },
      { optionId: 'o-bacon', qty: 1 },
      { optionId: 'o-cala', qty: 1 },
    ])).toBe(5390)
  })
})

it('addonMessageLines no formato da mensagem (spec 7.5)', () => {
  expect(
    addonMessageLines([ponto, adicionais], [
      { optionId: 'o-bacon', qty: 2 },
      { optionId: 'o-ponto', qty: 1 },
      { optionId: 'o-cheddar', qty: 1 },
    ]),
  ).toEqual(['   • Ponto: Ao ponto', '   • Adicionais: 2x Bacon, 1x Cheddar'])
})
```

`src/lib/addons/templates.test.ts`:

```ts
import { expect, it } from 'vitest'
import { ADDON_TEMPLATES } from './templates'

it('modelos prontos da spec 8.4, todos válidos', () => {
  expect(ADDON_TEMPLATES.map((t) => t.label)).toEqual([
    'Ponto da carne',
    'Adicionais',
    'Molhos',
    'Tamanho',
    'Sabores de pizza',
    'Bebida do combo',
  ])
  for (const { group, options } of ADDON_TEMPLATES) {
    expect(options.length).toBeGreaterThan(0)
    expect(group.minSelect).toBeLessThanOrEqual(group.maxSelect)
    expect(group.required).toBe(group.minSelect > 0)
    expect(group.kind === 'flavors').toBe(group.flavorPriceRule !== null)
    if (group.kind === 'flavors') expect(group.allowRepeat).toBe(false)
  }
})
```

Run: `npm test -- src/lib/addons` → FAIL.

- [ ] **Step 2: Implementação**

`src/lib/addons/addons.ts`:

```ts
export type AddonOption = { id: string; name: string; priceCents: number; soldOut: boolean }

export type AddonGroup = {
  id: string
  name: string
  kind: 'standard' | 'flavors'
  required: boolean
  minSelect: number
  maxSelect: number
  allowRepeat: boolean
  flavorPriceRule: 'max' | 'average' | null
  options: AddonOption[]
}

export type AddonSelection = { optionId: string; qty: number }

export function groupBadge(group: AddonGroup): string {
  if (group.minSelect > 0) {
    return group.minSelect === group.maxSelect
      ? `Obrigatório · escolha ${group.minSelect}`
      : `Obrigatório · escolha ${group.minSelect} a ${group.maxSelect}`
  }
  return `Opcional · até ${group.maxSelect}`
}

type Located = { group: AddonGroup; groupIndex: number; option: AddonOption; optionIndex: number }

function locate(groups: AddonGroup[]): Map<string, Located> {
  const map = new Map<string, Located>()
  groups.forEach((group, groupIndex) =>
    group.options.forEach((option, optionIndex) => map.set(option.id, { group, groupIndex, option, optionIndex })),
  )
  return map
}

// Junta quantidades da mesma opção e ignora opções que não existem.
function mergeKnown(groups: AddonGroup[], selections: AddonSelection[]) {
  const located = locate(groups)
  const qtyByOption = new Map<string, number>()
  for (const selection of selections) {
    if (!located.has(selection.optionId)) continue
    qtyByOption.set(selection.optionId, (qtyByOption.get(selection.optionId) ?? 0) + selection.qty)
  }
  return [...qtyByOption.entries()]
    .map(([optionId, qty]) => ({ ...located.get(optionId)!, qty }))
    .sort((a, b) => a.groupIndex - b.groupIndex || a.optionIndex - b.optionIndex)
}

export function validateAddonSelections(
  groups: AddonGroup[],
  selections: AddonSelection[],
): { ok: true; selections: AddonSelection[] } | { ok: false; groupId: string | null; message: string } {
  const located = locate(groups)
  for (const selection of selections) {
    if (!located.has(selection.optionId)) {
      return { ok: false, groupId: null, message: 'Uma opção escolhida não está mais disponível.' }
    }
    if (!Number.isInteger(selection.qty) || selection.qty < 1) {
      return { ok: false, groupId: located.get(selection.optionId)!.group.id, message: 'Quantidade inválida.' }
    }
  }

  const merged = mergeKnown(groups, selections)
  for (const { group, option, qty } of merged) {
    if (option.soldOut) return { ok: false, groupId: group.id, message: `${option.name} está esgotado.` }
    if (qty > 1 && (!group.allowRepeat || group.kind === 'flavors')) {
      return { ok: false, groupId: group.id, message: `Em ${group.name}, escolha cada opção só uma vez.` }
    }
  }

  for (const group of groups) {
    const count = merged.filter((entry) => entry.group.id === group.id).reduce((sum, entry) => sum + entry.qty, 0)
    if (count < group.minSelect) {
      const message =
        group.minSelect === 1
          ? `Escolha uma opção em ${group.name}.`
          : `Escolha pelo menos ${group.minSelect} opções em ${group.name}.`
      return { ok: false, groupId: group.id, message }
    }
    if (count > group.maxSelect) {
      const noun = group.maxSelect === 1 ? 'opção' : 'opções'
      return { ok: false, groupId: group.id, message: `Escolha até ${group.maxSelect} ${noun} em ${group.name}.` }
    }
  }

  return { ok: true, selections: merged.map(({ option, qty }) => ({ optionId: option.id, qty })) }
}

// Spec 4.6, regras 2 e 3.
export function addonsUnitCents(groups: AddonGroup[], selections: AddonSelection[]): number {
  const merged = mergeKnown(groups, selections)
  let total = 0
  for (const group of groups) {
    const chosen = merged.filter((entry) => entry.group.id === group.id)
    if (chosen.length === 0) continue
    if (group.kind === 'flavors') {
      const prices = chosen.map((entry) => entry.option.priceCents)
      total +=
        group.flavorPriceRule === 'max'
          ? Math.max(...prices)
          : Math.ceil(prices.reduce((sum, price) => sum + price, 0) / prices.length)
    } else {
      total += chosen.reduce((sum, entry) => sum + entry.option.priceCents * entry.qty, 0)
    }
  }
  return total
}

export function addonMessageLines(groups: AddonGroup[], selections: AddonSelection[]): string[] {
  const merged = mergeKnown(groups, selections)
  const lines: string[] = []
  for (const group of groups) {
    const chosen = merged.filter((entry) => entry.group.id === group.id)
    if (chosen.length === 0) continue
    const parts = chosen.map((entry) => (group.allowRepeat ? `${entry.qty}x ${entry.option.name}` : entry.option.name))
    lines.push(`   • ${group.name}: ${parts.join(', ')}`)
  }
  return lines
}
```

`src/lib/addons/templates.ts`:

```ts
import type { AddonGroup } from './addons'

export type AddonTemplate = {
  key: string
  label: string
  group: Omit<AddonGroup, 'id' | 'options'>
  options: { name: string; priceCents: number }[]
}

// Spec 8.4: modelos prontos. Preenchem o formulário; o dono ajusta e salva.
export const ADDON_TEMPLATES: AddonTemplate[] = [
  {
    key: 'ponto',
    label: 'Ponto da carne',
    group: { name: 'Ponto da carne', kind: 'standard', required: true, minSelect: 1, maxSelect: 1, allowRepeat: false, flavorPriceRule: null },
    options: [
      { name: 'Mal passado', priceCents: 0 },
      { name: 'Ao ponto', priceCents: 0 },
      { name: 'Bem passado', priceCents: 0 },
    ],
  },
  {
    key: 'adicionais',
    label: 'Adicionais',
    group: { name: 'Adicionais', kind: 'standard', required: false, minSelect: 0, maxSelect: 5, allowRepeat: true, flavorPriceRule: null },
    options: [
      { name: 'Bacon', priceCents: 400 },
      { name: 'Cheddar', priceCents: 300 },
      { name: 'Ovo', priceCents: 250 },
      { name: 'Cebola caramelizada', priceCents: 300 },
    ],
  },
  {
    key: 'molhos',
    label: 'Molhos',
    group: { name: 'Molhos', kind: 'standard', required: false, minSelect: 0, maxSelect: 3, allowRepeat: false, flavorPriceRule: null },
    options: [
      { name: 'Maionese da casa', priceCents: 0 },
      { name: 'Barbecue', priceCents: 0 },
      { name: 'Mostarda e mel', priceCents: 0 },
    ],
  },
  {
    key: 'tamanho',
    label: 'Tamanho',
    group: { name: 'Tamanho', kind: 'standard', required: true, minSelect: 1, maxSelect: 1, allowRepeat: false, flavorPriceRule: null },
    options: [
      { name: 'Pequeno', priceCents: 0 },
      { name: 'Médio', priceCents: 500 },
      { name: 'Grande', priceCents: 1000 },
    ],
  },
  {
    key: 'sabores',
    label: 'Sabores de pizza',
    group: { name: 'Sabores', kind: 'flavors', required: true, minSelect: 1, maxSelect: 2, allowRepeat: false, flavorPriceRule: 'max' },
    options: [
      { name: 'Calabresa', priceCents: 4990 },
      { name: 'Marguerita', priceCents: 4590 },
      { name: 'Frango com catupiry', priceCents: 5290 },
      { name: 'Quatro queijos', priceCents: 5490 },
    ],
  },
  {
    key: 'bebida',
    label: 'Bebida do combo',
    group: { name: 'Bebida', kind: 'standard', required: true, minSelect: 1, maxSelect: 1, allowRepeat: false, flavorPriceRule: null },
    options: [
      { name: 'Coca-Cola lata', priceCents: 0 },
      { name: 'Guaraná lata', priceCents: 0 },
      { name: 'Água sem gás', priceCents: 0 },
    ],
  },
]
```

Run: `npm test -- src/lib/addons` → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/addons
git commit -m "feat(complementos): selos, validação da escolha, preço (padrão e sabores), linhas da mensagem e modelos"
```

---

### Task 3: Sacola, formulário e mensagem

**Files:**
- Create: `src/lib/cart/cart.ts`, `src/lib/cart/cart.test.ts`, `src/lib/cart/reconcile.ts`, `src/lib/cart/reconcile.test.ts`, `src/lib/cart/checkout.ts`, `src/lib/cart/checkout.test.ts`, `src/lib/whatsapp/cart-message.ts`, `src/lib/whatsapp/cart-message.test.ts`

**Interfaces:**
- Consumes: `AddonGroup`, `AddonSelection`, `validateAddonSelections`, `addonsUnitCents`; `unitPriceCents`, `lineTotalCents`, `orderTotal`, `PricedItem`, `PricedVariation`; `parseBRLToCents`, `formatBRL`
- Produces:
  - `MAX_LINE_QTY = 99`, `type CartLine = { key: string; itemId: string; variationId: string | null; qty: number; note: string; addons: AddonSelection[] }`, `type NewCartLine = Omit<CartLine, 'key'>`
  - `cartLineKey(line: NewCartLine): string`, `addToCart(lines, line: NewCartLine): CartLine[]`, `setLineQty(lines, key, qty): CartLine[]`, `removeLine(lines, key): CartLine[]`, `replaceLine(lines, key, line: NewCartLine): CartLine[]`
  - `cartStorageKey(vitrineId: string): string`, `parseStoredCart(raw: string | null): CartLine[]`, `serializeCart(lines: CartLine[]): string`
  - `type CartCatalogItem = PricedItem & { id: string; code: string; name: string; soldOut: boolean; variations: (PricedVariation & { id: string; name: string; soldOut: boolean })[]; addonGroups: AddonGroup[] }`
  - `reconcileCart(lines, items: ReadonlyMap<string, CartCatalogItem>): { lines: CartLine[]; removedNames: string[] }`
  - `lineUnitCents(line: NewCartLine, item: CartCatalogItem): number | null`
  - `cartSummary(lines, items): { count: number; total: { totalCents: number; hasOnRequest: boolean } }`
  - `type FieldMode = 'off' | 'optional' | 'required'`
  - `type CheckoutSettings = { nameMode: FieldMode; fulfillmentMode: FieldMode; paymentMode: FieldMode; scheduleMode: FieldMode; notesMode: FieldMode; paymentOptions: string[] }`
  - `type CheckoutInput = { name: string; fulfillment: string; address: string; payment: string; changeFor: string; date: string; time: string; notes: string }`, `EMPTY_CHECKOUT_INPUT`
  - `type CheckoutValue = { name: string | null; fulfillment: 'retirada' | 'entrega' | null; address: string | null; payment: string | null; changeForCents: number | null; schedule: { date: string; time: string } | null; notes: string | null }`
  - `CASH_OPTION = 'Dinheiro'`, `todayInSaoPaulo(now?: Date): string`
  - `validateCheckout(settings, input, today: string): { ok: true; value: CheckoutValue } | { ok: false; errors: Partial<Record<keyof CheckoutInput, string>> }`
  - `type CartMessageLine = { qty: number; itemName: string; variationName: string | null; code: string; addonLines: string[]; note: string | null }`
  - `buildCartMessage(input: { vitrineName: string; orderCode: string | null; lines: CartMessageLine[]; checkout: CheckoutValue }): string`
  - `withNoteLine(addonLines: string[], note: string | null): string[]`

- [ ] **Step 1: Testes (falhando)**

`src/lib/cart/cart.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { addToCart, cartLineKey, parseStoredCart, removeLine, replaceLine, serializeCart, setLineQty } from './cart'

const xBacon = { itemId: 'i1', variationId: null, qty: 1, note: '', addons: [{ optionId: 'o-bacon', qty: 2 }] }

describe('linhas da sacola', () => {
  it('mesma escolha junta quantidade; escolha diferente vira outra linha', () => {
    let lines = addToCart([], xBacon)
    lines = addToCart(lines, { ...xBacon, qty: 2 })
    expect(lines).toHaveLength(1)
    expect(lines[0].qty).toBe(3)
    lines = addToCart(lines, { ...xBacon, note: 'sem cebola' })
    expect(lines).toHaveLength(2)
  })

  it('ordem dos complementos não muda a chave e o limite é 99', () => {
    const a = cartLineKey({ ...xBacon, addons: [{ optionId: 'x', qty: 1 }, { optionId: 'y', qty: 1 }] })
    const b = cartLineKey({ ...xBacon, addons: [{ optionId: 'y', qty: 1 }, { optionId: 'x', qty: 1 }] })
    expect(a).toBe(b)
    expect(addToCart([], { ...xBacon, qty: 150 })[0].qty).toBe(99)
  })

  it('quantidade, remover e trocar', () => {
    const lines = addToCart([], xBacon)
    const key = lines[0].key
    expect(setLineQty(lines, key, 5)[0].qty).toBe(5)
    expect(setLineQty(lines, key, 0)).toEqual([])
    expect(removeLine(lines, key)).toEqual([])
    const replaced = replaceLine(lines, key, { ...xBacon, note: 'bem passado' })
    expect(replaced).toHaveLength(1)
    expect(replaced[0].note).toBe('bem passado')
  })

  it('trocar para uma escolha que já existe junta as linhas', () => {
    let lines = addToCart([], xBacon)
    lines = addToCart(lines, { ...xBacon, note: 'x' })
    const merged = replaceLine(lines, lines[1].key, { ...xBacon, qty: 4 })
    expect(merged).toHaveLength(1)
    expect(merged[0].qty).toBe(5)
  })
})

describe('guardar no aparelho', () => {
  it('ida e volta', () => {
    const lines = addToCart([], xBacon)
    expect(parseStoredCart(serializeCart(lines))).toEqual(lines)
  })

  it('conteúdo inválido vira sacola vazia', () => {
    expect(parseStoredCart(null)).toEqual([])
    expect(parseStoredCart('{')).toEqual([])
    expect(parseStoredCart('{"version":2,"lines":[]}')).toEqual([])
    expect(parseStoredCart('{"version":1,"lines":[{"itemId":"i1","qty":0}]}')).toEqual([])
  })
})
```

`src/lib/cart/reconcile.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { AddonGroup } from '@/lib/addons/addons'
import { addToCart } from './cart'
import { cartSummary, lineUnitCents, reconcileCart, type CartCatalogItem } from './reconcile'

const adicionais: AddonGroup = {
  id: 'g', name: 'Adicionais', kind: 'standard', required: false, minSelect: 0, maxSelect: 5, allowRepeat: true, flavorPriceRule: null,
  options: [{ id: 'bacon', name: 'Bacon', priceCents: 400, soldOut: false }],
}

const xBacon: CartCatalogItem = {
  id: 'i1', code: '104', name: 'X-Bacon', priceType: 'fixed', priceCents: 2590, promoPriceCents: null, soldOut: false,
  variations: [], addonGroups: [adicionais],
}
const pizza: CartCatalogItem = {
  id: 'i2', code: '105', name: 'Pizza', priceType: 'fixed', priceCents: null, promoPriceCents: null, soldOut: false,
  variations: [{ id: 'grande', name: 'Grande', priceCents: 6000, promoPriceCents: 5500, soldOut: false }], addonGroups: [],
}
const consulta: CartCatalogItem = {
  id: 'i3', code: '106', name: 'Bolo sob encomenda', priceType: 'on_request', priceCents: null, promoPriceCents: null, soldOut: false,
  variations: [], addonGroups: [],
}
const items = new Map([xBacon, pizza, consulta].map((item) => [item.id, item]))

describe('preço e totais', () => {
  it('base mais complementos', () => {
    expect(lineUnitCents({ itemId: 'i1', variationId: null, qty: 1, note: '', addons: [{ optionId: 'bacon', qty: 2 }] }, xBacon)).toBe(3390)
    expect(lineUnitCents({ itemId: 'i2', variationId: 'grande', qty: 1, note: '', addons: [] }, pizza)).toBe(5500)
    expect(lineUnitCents({ itemId: 'i3', variationId: null, qty: 1, note: '', addons: [] }, consulta)).toBeNull()
  })

  it('resumo da sacola', () => {
    let lines = addToCart([], { itemId: 'i1', variationId: null, qty: 2, note: '', addons: [{ optionId: 'bacon', qty: 1 }] })
    lines = addToCart(lines, { itemId: 'i3', variationId: null, qty: 1, note: '', addons: [] })
    expect(cartSummary(lines, items)).toEqual({ count: 3, total: { totalCents: 5980, hasOnRequest: true } })
  })
})

describe('reconcileCart (spec 7.4)', () => {
  it('remove itens apagados, esgotados, variação sumida ou complemento inválido e avisa', () => {
    let lines = addToCart([], { itemId: 'i1', variationId: null, qty: 1, note: '', addons: [] })
    lines = addToCart(lines, { itemId: 'sumiu', variationId: null, qty: 1, note: '', addons: [] })
    lines = addToCart(lines, { itemId: 'i2', variationId: 'pequena', qty: 1, note: '', addons: [] })
    lines = addToCart(lines, { itemId: 'i1', variationId: null, qty: 1, note: 'x', addons: [{ optionId: 'bacon', qty: 9 }] })

    const result = reconcileCart(lines, items)
    expect(result.lines.map((line) => line.itemId)).toEqual(['i1'])
    expect(result.removedNames).toEqual(['Um item', 'Pizza', 'X-Bacon'])

    const soldOut = new Map(items).set('i1', { ...xBacon, soldOut: true })
    expect(reconcileCart(result.lines, soldOut)).toEqual({ lines: [], removedNames: ['X-Bacon'] })
  })
})
```

`src/lib/cart/checkout.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { EMPTY_CHECKOUT_INPUT, todayInSaoPaulo, validateCheckout, type CheckoutSettings } from './checkout'

const comida: CheckoutSettings = {
  nameMode: 'required', fulfillmentMode: 'required', paymentMode: 'required', scheduleMode: 'optional', notesMode: 'optional',
  paymentOptions: ['Pix', 'Cartão na entrega', 'Dinheiro'],
}
const today = '2026-09-17'

describe('validateCheckout', () => {
  it('obrigatórios vazios', () => {
    expect(validateCheckout(comida, EMPTY_CHECKOUT_INPUT, today)).toEqual({
      ok: false,
      errors: {
        name: 'Informe seu nome.',
        fulfillment: 'Escolha retirada ou entrega.',
        payment: 'Escolha a forma de pagamento.',
      },
    })
  })

  it('entrega exige endereço; dinheiro aceita troco', () => {
    const input = { ...EMPTY_CHECKOUT_INPUT, name: ' Ana ', fulfillment: 'entrega', payment: 'Dinheiro', changeFor: '50' }
    expect(validateCheckout(comida, input, today)).toEqual({
      ok: false,
      errors: { address: 'Informe o endereço de entrega.' },
    })
    expect(validateCheckout(comida, { ...input, address: 'Rua A, 10' }, today)).toEqual({
      ok: true,
      value: {
        name: 'Ana',
        fulfillment: 'entrega',
        address: 'Rua A, 10',
        payment: 'Dinheiro',
        changeForCents: 5000,
        schedule: null,
        notes: null,
      },
    })
  })

  it('pagamento fora da lista, troco inválido, data no passado e horário faltando', () => {
    const base = { ...EMPTY_CHECKOUT_INPUT, name: 'Ana', fulfillment: 'retirada' }
    expect(validateCheckout(comida, { ...base, payment: 'Boleto' }, today)).toEqual({
      ok: false,
      errors: { payment: 'Escolha uma forma de pagamento da lista.' },
    })
    expect(validateCheckout(comida, { ...base, payment: 'Dinheiro', changeFor: 'abc' }, today)).toEqual({
      ok: false,
      errors: { changeFor: 'Valor inválido. Ex.: 50,00' },
    })
    expect(validateCheckout(comida, { ...base, payment: 'Pix', date: '2026-09-16', time: '19:30' }, today)).toEqual({
      ok: false,
      errors: { date: 'Escolha uma data a partir de hoje.' },
    })
    expect(validateCheckout(comida, { ...base, payment: 'Pix', date: '2026-09-20' }, today)).toEqual({
      ok: false,
      errors: { time: 'Informe o horário.' },
    })
  })

  it('campos desligados são ignorados e observação tem limite', () => {
    const off: CheckoutSettings = { ...comida, nameMode: 'off', fulfillmentMode: 'off', paymentMode: 'off', scheduleMode: 'off' }
    expect(validateCheckout(off, { ...EMPTY_CHECKOUT_INPUT, name: 'Ana', payment: 'Pix', notes: ' sem pressa ' }, today)).toEqual({
      ok: true,
      value: { name: null, fulfillment: null, address: null, payment: null, changeForCents: null, schedule: null, notes: 'sem pressa' },
    })
    expect(validateCheckout(off, { ...EMPTY_CHECKOUT_INPUT, notes: 'x'.repeat(301) }, today)).toEqual({
      ok: false,
      errors: { notes: 'Use até 300 caracteres.' },
    })
  })
})

it('hoje em São Paulo', () => {
  expect(todayInSaoPaulo(new Date('2026-09-18T02:00:00Z'))).toBe('2026-09-17')
})
```

`src/lib/whatsapp/cart-message.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildCartMessage, withNoteLine } from './cart-message'

const retiradaAna = {
  name: 'Ana', fulfillment: 'retirada' as const, address: null, payment: 'Pix', changeForCents: null, schedule: null, notes: null,
}

describe('buildCartMessage (spec 7.5)', () => {
  it('exemplo da spec', () => {
    expect(
      buildCartMessage({
        vitrineName: 'Burger do Zé',
        orderCode: 'K7F2',
        lines: [
          {
            qty: 2, itemName: 'X-Bacon', variationName: null, code: '104',
            addonLines: ['   • Ponto: Ao ponto', '   • Adicionais: 2x Bacon, 1x Cheddar'], note: 'sem cebola',
          },
          { qty: 1, itemName: 'Coca-Cola lata', variationName: null, code: '210', addonLines: [], note: null },
        ],
        checkout: retiradaAna,
      }),
    ).toBe(
      [
        '*Pedido #K7F2 – Burger do Zé*',
        '',
        '2x *X-Bacon* (cód. 104)',
        '   • Ponto: Ao ponto',
        '   • Adicionais: 2x Bacon, 1x Cheddar',
        '   • Obs: sem cebola',
        '',
        '1x *Coca-Cola lata* (cód. 210)',
        '',
        'Retirada · Nome: Ana · Pagamento: Pix',
      ].join('\n'),
    )
  })

  it('sem código, variação, entrega, troco, agendamento e observação geral', () => {
    expect(
      buildCartMessage({
        vitrineName: 'Pizzaria',
        orderCode: null,
        lines: [{ qty: 1, itemName: 'Pizza', variationName: 'Grande', code: '301', addonLines: [], note: null }],
        checkout: {
          name: 'Bia', fulfillment: 'entrega', address: 'Rua A, 10', payment: 'Dinheiro', changeForCents: 10000,
          schedule: { date: '2026-09-20', time: '19:30' }, notes: 'Portão azul',
        },
      }),
    ).toBe(
      [
        '*Pedido – Pizzaria*',
        '',
        '1x *Pizza – Grande* (cód. 301)',
        '',
        'Entrega · Endereço: Rua A, 10 · Nome: Bia · Pagamento: Dinheiro (troco para R$ 100,00) · Agendado para 20/09 às 19:30 · Obs: Portão azul',
      ].join('\n'),
    )
  })

  it('formulário vazio não gera rodapé', () => {
    const empty = { name: null, fulfillment: null, address: null, payment: null, changeForCents: null, schedule: null, notes: null }
    expect(
      buildCartMessage({
        vitrineName: 'Loja',
        orderCode: 'AB23',
        lines: [{ qty: 1, itemName: 'Camiseta', variationName: null, code: '101', addonLines: [], note: null }],
        checkout: empty,
      }),
    ).toBe('*Pedido #AB23 – Loja*\n\n1x *Camiseta* (cód. 101)')
  })
})

it('withNoteLine acrescenta a observação do item', () => {
  expect(withNoteLine(['   • Ponto: Ao ponto'], 'sem sal')).toEqual(['   • Ponto: Ao ponto', '   • Obs: sem sal'])
  expect(withNoteLine([], null)).toEqual([])
})
```

Run: `npm test -- src/lib/cart src/lib/whatsapp/cart-message.test.ts` → FAIL.

- [ ] **Step 2: Implementação**

`src/lib/cart/cart.ts`:

```ts
import { z } from 'zod'
import type { AddonSelection } from '@/lib/addons/addons'

export const MAX_LINE_QTY = 99
const MAX_LINES = 50

export type CartLine = {
  key: string
  itemId: string
  variationId: string | null
  qty: number
  note: string
  addons: AddonSelection[]
}

export type NewCartLine = Omit<CartLine, 'key'>

export function cartLineKey(line: NewCartLine): string {
  const addons = [...line.addons]
    .sort((a, b) => a.optionId.localeCompare(b.optionId))
    .map((addon) => `${addon.optionId}x${addon.qty}`)
    .join(',')
  return [line.itemId, line.variationId ?? '-', addons, line.note.trim()].join('|')
}

const clampQty = (qty: number) => Math.max(1, Math.min(MAX_LINE_QTY, Math.floor(qty)))

export function addToCart(lines: CartLine[], line: NewCartLine): CartLine[] {
  const normalized = { ...line, note: line.note.trim() }
  const key = cartLineKey(normalized)
  if (lines.some((existing) => existing.key === key)) {
    return lines.map((existing) => (existing.key === key ? { ...existing, qty: clampQty(existing.qty + line.qty) } : existing))
  }
  if (lines.length >= MAX_LINES) return lines
  return [...lines, { ...normalized, qty: clampQty(line.qty), key }]
}

export function setLineQty(lines: CartLine[], key: string, qty: number): CartLine[] {
  if (qty < 1) return removeLine(lines, key)
  return lines.map((line) => (line.key === key ? { ...line, qty: clampQty(qty) } : line))
}

export function removeLine(lines: CartLine[], key: string): CartLine[] {
  return lines.filter((line) => line.key !== key)
}

export function replaceLine(lines: CartLine[], key: string, line: NewCartLine): CartLine[] {
  const index = lines.findIndex((existing) => existing.key === key)
  const rest = removeLine(lines, key)
  const normalized = { ...line, note: line.note.trim() }
  const newKey = cartLineKey(normalized)
  const same = rest.find((existing) => existing.key === newKey)
  if (same) return setLineQty(rest, newKey, same.qty + line.qty)
  const next = [...rest]
  next.splice(index < 0 ? next.length : index, 0, { ...normalized, qty: clampQty(line.qty), key: newKey })
  return next
}

export function cartStorageKey(vitrineId: string): string {
  return `agenn-sacola:${vitrineId}`
}

const storedSchema = z.object({
  version: z.literal(1),
  lines: z
    .array(
      z.object({
        itemId: z.string().min(1),
        variationId: z.string().nullable(),
        qty: z.number().int().min(1).max(MAX_LINE_QTY),
        note: z.string().max(140),
        addons: z.array(z.object({ optionId: z.string().min(1), qty: z.number().int().min(1).max(20) })).max(30),
      }),
    )
    .max(MAX_LINES),
})

export function parseStoredCart(raw: string | null): CartLine[] {
  if (!raw) return []
  try {
    const parsed = storedSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) return []
    return parsed.data.lines.reduce<CartLine[]>((lines, line) => addToCart(lines, line), [])
  } catch {
    return []
  }
}

export function serializeCart(lines: CartLine[]): string {
  return JSON.stringify({ version: 1, lines: lines.map(({ key: _key, ...line }) => line) })
}
```

`src/lib/cart/reconcile.ts`:

```ts
import { addonsUnitCents, validateAddonSelections, type AddonGroup } from '@/lib/addons/addons'
import { lineTotalCents, orderTotal, unitPriceCents, type PricedItem, type PricedVariation } from '@/lib/pricing/price'
import type { CartLine, NewCartLine } from './cart'

export type CartCatalogItem = PricedItem & {
  id: string
  code: string
  name: string
  soldOut: boolean
  variations: (PricedVariation & { id: string; name: string; soldOut: boolean })[]
  addonGroups: AddonGroup[]
}

function isAvailable(line: NewCartLine, item: CartCatalogItem): boolean {
  if (item.soldOut) return false
  if (item.variations.length > 0) {
    const variation = item.variations.find((v) => v.id === line.variationId)
    if (!variation || variation.soldOut) return false
  } else if (line.variationId) {
    return false
  }
  return validateAddonSelections(item.addonGroups, line.addons).ok
}

// Spec 7.4: ao abrir, confere com os dados atuais e remove o que não dá mais para pedir.
export function reconcileCart(lines: CartLine[], items: ReadonlyMap<string, CartCatalogItem>) {
  const kept: CartLine[] = []
  const removedNames: string[] = []
  for (const line of lines) {
    const item = items.get(line.itemId)
    if (item && isAvailable(line, item)) {
      kept.push(line)
      continue
    }
    const name = item?.name ?? 'Um item'
    if (!removedNames.includes(name)) removedNames.push(name)
  }
  return { lines: kept, removedNames }
}

export function lineUnitCents(line: NewCartLine, item: CartCatalogItem): number | null {
  const variation = line.variationId ? (item.variations.find((v) => v.id === line.variationId) ?? null) : null
  const base = unitPriceCents(item, variation)
  if (base === null) return null
  return base + addonsUnitCents(item.addonGroups, line.addons)
}

export function cartSummary(lines: CartLine[], items: ReadonlyMap<string, CartCatalogItem>) {
  const known = lines.filter((line) => items.has(line.itemId))
  return {
    count: known.reduce((sum, line) => sum + line.qty, 0),
    total: orderTotal(known.map((line) => lineTotalCents(lineUnitCents(line, items.get(line.itemId)!), line.qty))),
  }
}
```

`src/lib/cart/checkout.ts`:

```ts
import { parseBRLToCents } from '@/lib/money/money'

export type FieldMode = 'off' | 'optional' | 'required'

export type CheckoutSettings = {
  nameMode: FieldMode
  fulfillmentMode: FieldMode
  paymentMode: FieldMode
  scheduleMode: FieldMode
  notesMode: FieldMode
  paymentOptions: string[]
}

export type CheckoutInput = {
  name: string
  fulfillment: string
  address: string
  payment: string
  changeFor: string
  date: string
  time: string
  notes: string
}

export type CheckoutValue = {
  name: string | null
  fulfillment: 'retirada' | 'entrega' | null
  address: string | null
  payment: string | null
  changeForCents: number | null
  schedule: { date: string; time: string } | null
  notes: string | null
}

export const EMPTY_CHECKOUT_INPUT: CheckoutInput = {
  name: '', fulfillment: '', address: '', payment: '', changeFor: '', date: '', time: '', notes: '',
}

export const CASH_OPTION = 'Dinheiro'

export function todayInSaoPaulo(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export function validateCheckout(
  settings: CheckoutSettings,
  input: CheckoutInput,
  today: string,
): { ok: true; value: CheckoutValue } | { ok: false; errors: Partial<Record<keyof CheckoutInput, string>> } {
  const errors: Partial<Record<keyof CheckoutInput, string>> = {}
  const value: CheckoutValue = {
    name: null, fulfillment: null, address: null, payment: null, changeForCents: null, schedule: null, notes: null,
  }

  if (settings.nameMode !== 'off') {
    const name = input.name.trim()
    if (!name && settings.nameMode === 'required') errors.name = 'Informe seu nome.'
    else if (name.length > 60) errors.name = 'Use até 60 caracteres.'
    else value.name = name || null
  }

  if (settings.fulfillmentMode !== 'off') {
    const fulfillment = input.fulfillment
    if (fulfillment !== 'retirada' && fulfillment !== 'entrega') {
      if (settings.fulfillmentMode === 'required') errors.fulfillment = 'Escolha retirada ou entrega.'
    } else {
      value.fulfillment = fulfillment
      if (fulfillment === 'entrega') {
        const address = input.address.trim()
        if (!address) errors.address = 'Informe o endereço de entrega.'
        else if (address.length > 200) errors.address = 'Use até 200 caracteres.'
        else value.address = address
      }
    }
  }

  if (settings.paymentMode !== 'off') {
    const payment = input.payment.trim()
    if (!payment) {
      if (settings.paymentMode === 'required') errors.payment = 'Escolha a forma de pagamento.'
    } else if (!settings.paymentOptions.includes(payment)) {
      errors.payment = 'Escolha uma forma de pagamento da lista.'
    } else {
      value.payment = payment
      if (payment === CASH_OPTION && input.changeFor.trim()) {
        const cents = parseBRLToCents(input.changeFor)
        if (cents === null) errors.changeFor = 'Valor inválido. Ex.: 50,00'
        else value.changeForCents = cents
      }
    }
  }

  if (settings.scheduleMode !== 'off') {
    const date = input.date.trim()
    const time = input.time.trim()
    if (date || time || settings.scheduleMode === 'required') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.date = 'Informe a data.'
      else if (date < today) errors.date = 'Escolha uma data a partir de hoje.'
      if (!/^\d{2}:\d{2}$/.test(time)) errors.time = 'Informe o horário.'
      if (!errors.date && !errors.time) value.schedule = { date, time }
    }
  }

  if (settings.notesMode !== 'off') {
    const notes = input.notes.trim()
    if (!notes && settings.notesMode === 'required') errors.notes = 'Escreva a observação.'
    else if (notes.length > 300) errors.notes = 'Use até 300 caracteres.'
    else value.notes = notes || null
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, value }
}
```

`src/lib/whatsapp/cart-message.ts`:

```ts
import type { CheckoutValue } from '@/lib/cart/checkout'
import { formatBRL } from '@/lib/money/money'

export type CartMessageLine = {
  qty: number
  itemName: string
  variationName: string | null
  code: string
  addonLines: string[]
  note: string | null
}

export function withNoteLine(addonLines: string[], note: string | null): string[] {
  return note ? [...addonLines, `   • Obs: ${note}`] : addonLines
}

function footer(checkout: CheckoutValue): string | null {
  const parts: string[] = []
  if (checkout.fulfillment === 'retirada') parts.push('Retirada')
  if (checkout.fulfillment === 'entrega') {
    parts.push('Entrega')
    if (checkout.address) parts.push(`Endereço: ${checkout.address}`)
  }
  if (checkout.name) parts.push(`Nome: ${checkout.name}`)
  if (checkout.payment) {
    const change = checkout.changeForCents !== null ? ` (troco para ${formatBRL(checkout.changeForCents)})` : ''
    parts.push(`Pagamento: ${checkout.payment}${change}`)
  }
  if (checkout.schedule) {
    const [, month, day] = checkout.schedule.date.split('-')
    parts.push(`Agendado para ${day}/${month} às ${checkout.schedule.time}`)
  }
  if (checkout.notes) parts.push(`Obs: ${checkout.notes}`)
  return parts.length > 0 ? parts.join(' · ') : null
}

// Spec 7.5: a mensagem não leva valores (só o troco).
export function buildCartMessage(input: {
  vitrineName: string
  orderCode: string | null
  lines: CartMessageLine[]
  checkout: CheckoutValue
}): string {
  const header = input.orderCode
    ? `*Pedido #${input.orderCode} – ${input.vitrineName}*`
    : `*Pedido – ${input.vitrineName}*`
  const blocks = input.lines.map((line) => {
    const label = line.variationName ? `${line.itemName} – ${line.variationName}` : line.itemName
    return [`${line.qty}x *${label}* (cód. ${line.code})`, ...withNoteLine(line.addonLines, line.note)].join('\n')
  })
  const end = footer(input.checkout)
  return [header, ...blocks, ...(end ? [end] : [])].join('\n\n')
}
```

Run: `npm test -- src/lib/cart src/lib/whatsapp/cart-message.test.ts` → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/cart src/lib/whatsapp/cart-message.ts src/lib/whatsapp/cart-message.test.ts
git commit -m "feat(sacola): linhas, guardar no aparelho, conferência com o catálogo, formulário e mensagem"
```

---

### Task 4: Comida no assistente e formulários do painel

**Files:**
- Modify: `src/lib/vitrines/vitrine-types.ts` (+ test), `src/lib/vitrines/schemas.ts` (+ test)

**Interfaces:**
- Produces:
  - `WIZARD_VITRINE_TYPES = ['produtos', 'servicos', 'comida']`
  - `addonGroupSchema` → `{ name; kind: 'standard' | 'flavors'; required: boolean; minSelect: number; maxSelect: number; allowRepeat: boolean; flavorPriceRule: 'max' | 'average' | null; options: { id: string | null; name: string; priceCents: number; soldOut: boolean }[] }`; `type AddonGroupInput`
  - `checkoutSettingsSchema` → `{ cartEnabled: boolean; cartButtonText: string; defaultButtonText: string; nameMode; fulfillmentMode; paymentMode; scheduleMode; notesMode: FieldMode; paymentOptions: string[] }`
  - `itemSchema` devolve também `addonGroupIds: string[]`
  - `messagesSchema` continua até a Task 6, que troca a ação da aba e o remove

- [ ] **Step 1: Testes (falhando)**

Em `src/lib/vitrines/vitrine-types.test.ts`, troque `expect(WIZARD_VITRINE_TYPES).toEqual(['produtos', 'servicos'])` por `expect(WIZARD_VITRINE_TYPES).toEqual(['produtos', 'servicos', 'comida'])`.

Em `src/lib/vitrines/schemas.test.ts`:
- no `valid` de `itemSchema`, acrescente `addonGroupIds: '[]'` e, no teste "converte os campos do formulário", `addonGroupIds: []` no `toMatchObject`;
- no teste de mensagens do `createVitrineSchema`, troque `type: 'comida'` por `type: 'bebidas'` (continua inválido);
- acrescente:

```ts
describe('addonGroupSchema', () => {
  const group = {
    name: 'Adicionais', kind: 'standard', required: '', minSelect: '0', maxSelect: '5', allowRepeat: 'on', flavorPriceRule: '',
    options: JSON.stringify([{ name: 'Bacon', price: '4,00', soldOut: false }]),
  }

  it('converte e normaliza', () => {
    expect(addonGroupSchema.parse(group)).toEqual({
      name: 'Adicionais', kind: 'standard', required: false, minSelect: 0, maxSelect: 5, allowRepeat: true, flavorPriceRule: null,
      options: [{ id: null, name: 'Bacon', priceCents: 400, soldOut: false }],
    })
  })

  it('obrigatório força mínimo 1; sabores não repetem e exigem regra', () => {
    expect(addonGroupSchema.parse({ ...group, required: 'on', minSelect: '0' }).minSelect).toBe(1)
    expect(addonGroupSchema.parse({ ...group, kind: 'flavors', flavorPriceRule: 'average' })).toMatchObject({ allowRepeat: false, flavorPriceRule: 'average' })
    expect(addonGroupSchema.safeParse({ ...group, kind: 'flavors' }).error!.issues[0].message).toBe('Escolha a regra de preço dos sabores.')
  })

  it('mensagens', () => {
    expect(addonGroupSchema.safeParse({ ...group, options: '[]' }).error!.issues[0].message).toBe('Adicione pelo menos uma opção.')
    expect(addonGroupSchema.safeParse({ ...group, required: 'on', minSelect: '6' }).error!.issues[0].message).toBe(
      'O mínimo não pode passar do máximo.',
    )
    expect(addonGroupSchema.safeParse({ ...group, maxSelect: '0' }).error!.issues[0].message).toBe('Informe um número de 1 a 20.')
  })
})

describe('checkoutSettingsSchema', () => {
  const form = {
    cartEnabled: 'on', cartButtonText: 'Enviar pedido', defaultButtonText: 'Pedir',
    nameMode: 'required', fulfillmentMode: 'required', paymentMode: 'required', scheduleMode: 'off', notesMode: 'optional',
    paymentOptions: 'Pix\nCartão na entrega\n\nPix\nDinheiro',
  }

  it('converte as formas de pagamento (uma por linha)', () => {
    expect(checkoutSettingsSchema.parse(form)).toEqual({
      cartEnabled: true, cartButtonText: 'Enviar pedido', defaultButtonText: 'Pedir',
      nameMode: 'required', fulfillmentMode: 'required', paymentMode: 'required', scheduleMode: 'off', notesMode: 'optional',
      paymentOptions: ['Pix', 'Cartão na entrega', 'Dinheiro'],
    })
  })

  it('pagamento ligado exige ao menos uma forma', () => {
    expect(checkoutSettingsSchema.safeParse({ ...form, paymentOptions: ' ' }).error!.issues[0]).toMatchObject({
      path: ['paymentOptions'],
      message: 'Informe pelo menos uma forma de pagamento.',
    })
    expect(checkoutSettingsSchema.parse({ ...form, paymentMode: 'off', paymentOptions: '' }).paymentOptions).toEqual([])
  })
})
```

(e importe `addonGroupSchema` e `checkoutSettingsSchema` no topo.)

Run: `npm test -- src/lib/vitrines` → FAIL.

- [ ] **Step 2: Implementação**

Em `src/lib/vitrines/vitrine-types.ts`:

```ts
export const WIZARD_VITRINE_TYPES = ['produtos', 'servicos', 'comida'] as const satisfies readonly VitrineType[]
```

(apague o comentário "Comida entra no assistente na Fase 4…").

Em `src/lib/vitrines/schemas.ts`:

1. Mantenha `messagesSchema` por enquanto (a Task 6 o remove).
2. Depois de `const checkbox = …`, acrescente:

```ts
const intField = (min: number, max: number) =>
  z
    .string()
    .trim()
    .transform((value, ctx) => {
      const number = Number(value)
      if (!value || !Number.isInteger(number) || number < min || number > max) {
        ctx.addIssue({ code: 'custom', message: `Informe um número de ${min} a ${max}.` })
        return z.NEVER
      }
      return number
    })

const fieldMode = z.enum(['off', 'optional', 'required'], 'Escolha uma opção.')
```

3. Depois de `itemSchema`/`ItemInput` (o `money` e o `jsonArray` já estão definidos antes), acrescente:

```ts
const addonOptionInput = z.object({
  id: z.uuid().nullish().transform((value) => value ?? null),
  name: z.string().trim().min(1, 'Informe o nome da opção.').max(40, 'Use até 40 caracteres.'),
  price: z.string().default(''),
  soldOut: z.boolean().default(false),
})

export const addonGroupSchema = z
  .object({
    name: z.string().trim().min(1, 'Informe o nome do grupo.').max(40, 'Use até 40 caracteres.'),
    kind: z.enum(['standard', 'flavors'], 'Escolha o tipo do grupo.'),
    required: checkbox,
    minSelect: intField(0, 20),
    maxSelect: intField(1, 20),
    allowRepeat: checkbox,
    flavorPriceRule: z.union([z.enum(['max', 'average']), z.literal('')]).transform((value) => value || null),
    options: jsonArray(addonOptionInput, 50),
  })
  .superRefine((data, ctx) => {
    if (data.options.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'Adicione pelo menos uma opção.' })
    }
    data.options.forEach((option, index) => {
      if (option.price.trim() && parseBRLToCents(option.price) === null) {
        ctx.addIssue({ code: 'custom', path: ['options'], message: `Preço inválido na opção ${index + 1}. Ex.: 4,00` })
      }
    })
    const min = data.required ? Math.max(1, data.minSelect) : 0
    if (min > data.maxSelect) {
      ctx.addIssue({ code: 'custom', path: ['minSelect'], message: 'O mínimo não pode passar do máximo.' })
    }
    if (data.kind === 'flavors' && !data.flavorPriceRule) {
      ctx.addIssue({ code: 'custom', path: ['flavorPriceRule'], message: 'Escolha a regra de preço dos sabores.' })
    }
  })
  .transform((data) => ({
    name: data.name,
    kind: data.kind,
    required: data.required,
    minSelect: data.required ? Math.max(1, data.minSelect) : 0,
    maxSelect: data.maxSelect,
    allowRepeat: data.kind === 'flavors' ? false : data.allowRepeat,
    flavorPriceRule: data.kind === 'flavors' ? data.flavorPriceRule : null,
    options: data.options.map((option) => ({
      id: option.id,
      name: option.name,
      priceCents: option.price.trim() ? (parseBRLToCents(option.price) ?? 0) : 0,
      soldOut: option.soldOut,
    })),
  }))

export type AddonGroupInput = z.output<typeof addonGroupSchema>

export const checkoutSettingsSchema = z
  .object({
    cartEnabled: checkbox,
    cartButtonText: z.string().trim().min(1, 'Informe o texto do botão da sacola.').max(30, 'Use até 30 caracteres.'),
    defaultButtonText: z.string().trim().min(1, 'Informe o texto do botão.').max(30, 'Use até 30 caracteres.'),
    nameMode: fieldMode,
    fulfillmentMode: fieldMode,
    paymentMode: fieldMode,
    scheduleMode: fieldMode,
    notesMode: fieldMode,
    paymentOptions: z.string().transform((value, ctx) => {
      const options = [...new Set(value.split(/\r?\n/).map((option) => option.trim()).filter(Boolean))]
      if (options.length > 10 || options.some((option) => option.length > 30)) {
        ctx.addIssue({ code: 'custom', message: 'Até 10 formas de pagamento, com até 30 caracteres cada.' })
        return z.NEVER
      }
      return options
    }),
  })
  .superRefine((data, ctx) => {
    if (data.paymentMode !== 'off' && data.paymentOptions.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['paymentOptions'], message: 'Informe pelo menos uma forma de pagamento.' })
    }
  })
```

4. Em `itemSchema`, depois de `videoMediaId`: `addonGroupIds: jsonArray(z.uuid(), 20),` e, no `.transform`, `addonGroupIds: data.addonGroupIds,`.

5. O import de `parseBRLToCents` já existe no arquivo.

Run: `npm test` → PASS. `npm run typecheck` → PASS.

- [ ] **Step 3: Commit, PR e merge do bloco**

```bash
npm run lint && npm run typecheck && npm test
git add -A src
git commit -m "feat(vitrines): Comida no assistente e formulários de complementos e da sacola"
git push -u origin HEAD
gh pr create --fill --base master
gh pr checks --watch
```

Com `comida` no assistente, o e2e `vitrines.spec.ts` continua passando (escolhe Produtos/Serviços). **Fim do Bloco 1:** autorização → merge.

---

# Bloco 2 — Painel: complementos, sacola e Comida

Branch: `fase-4/bloco-2-painel`.

### Task 5: Aba Complementos

**Files:**
- Create: `src/lib/addons/rows.ts`, `src/lib/addons/rows.test.ts`, `src/features/addons/queries.ts`, `src/features/addons/actions.ts`, `src/app/app/(painel)/painel/vitrines/[id]/complementos/page.tsx`, `src/app/app/(painel)/painel/vitrines/[id]/complementos/addon-groups.tsx`
- Modify: `src/app/app/(painel)/painel/vitrines/[id]/editor-tabs.tsx`

**Interfaces:**
- Consumes: `AddonGroup`, `ADDON_TEMPLATES`, `addonGroupSchema`, `centsToInput`
- Produces:
  - `type AddonGroupRow = { id: string; name: string; kind: string; required: boolean; min_select: number; max_select: number; allow_repeat: boolean; flavor_price_rule: string | null; position: number; addon_options: { id: string; name: string; price_cents: number; sold_out: boolean; position: number }[] }`
  - `ADDON_GROUP_COLUMNS` (string do select com as opções)
  - `toAddonGroup(row: AddonGroupRow): AddonGroup` (opções em ordem de `position`)
  - `listAddonGroups(vitrineId: string): Promise<AddonGroup[]>`
  - `saveAddonGroupAction(vitrineId: string, groupId: string | null, prev: FormState, formData: FormData): Promise<FormState>`
  - `deleteAddonGroupAction(vitrineId: string, groupId: string): Promise<FormState>`
- Textos (testes): aba `Complementos`; select `Começar de um modelo` (opção `Em branco` + rótulos dos modelos); formulários com `aria-label` `Novo grupo` ou `Grupo {nome}`; campos `Nome do grupo`, `Tipo` (`Padrão` / `Sabores de pizza`), `Obrigatório`, `Mínimo`, `Máximo`, `Permitir repetir a mesma opção`, `Preço dos sabores` (`Maior preço` / `Média`); linhas `Nome da opção {n}`, `Preço da opção {n}`, `Opção {n} esgotada`, `Remover opção {n}`; botões `Adicionar opção`, `Salvar grupo`, `Excluir grupo`; mensagens `Grupo salvo.`, `Grupo excluído.`

- [ ] **Step 1: Conversão das linhas (teste falhando)**

`src/lib/addons/rows.test.ts`:

```ts
import { expect, it } from 'vitest'
import { toAddonGroup } from './rows'

it('linha do banco vira AddonGroup com opções em ordem', () => {
  expect(
    toAddonGroup({
      id: 'g', name: 'Sabores', kind: 'flavors', required: true, min_select: 1, max_select: 2, allow_repeat: false,
      flavor_price_rule: 'average', position: 0,
      addon_options: [
        { id: 'b', name: 'Marguerita', price_cents: 4590, sold_out: true, position: 1 },
        { id: 'a', name: 'Calabresa', price_cents: 4990, sold_out: false, position: 0 },
      ],
    }),
  ).toEqual({
    id: 'g', name: 'Sabores', kind: 'flavors', required: true, minSelect: 1, maxSelect: 2, allowRepeat: false, flavorPriceRule: 'average',
    options: [
      { id: 'a', name: 'Calabresa', priceCents: 4990, soldOut: false },
      { id: 'b', name: 'Marguerita', priceCents: 4590, soldOut: true },
    ],
  })
})
```

Run: `npm test -- src/lib/addons/rows.test.ts` → FAIL.

- [ ] **Step 2: Implementação da conversão**

`src/lib/addons/rows.ts`:

```ts
import type { AddonGroup } from './addons'

export const ADDON_GROUP_COLUMNS =
  'id, name, kind, required, min_select, max_select, allow_repeat, flavor_price_rule, position, addon_options(id, name, price_cents, sold_out, position)'

export type AddonGroupRow = {
  id: string
  name: string
  kind: string
  required: boolean
  min_select: number
  max_select: number
  allow_repeat: boolean
  flavor_price_rule: string | null
  position: number
  addon_options: { id: string; name: string; price_cents: number; sold_out: boolean; position: number }[]
}

export function toAddonGroup(row: AddonGroupRow): AddonGroup {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind === 'flavors' ? 'flavors' : 'standard',
    required: row.required,
    minSelect: row.min_select,
    maxSelect: row.max_select,
    allowRepeat: row.allow_repeat,
    flavorPriceRule: row.flavor_price_rule === 'max' || row.flavor_price_rule === 'average' ? row.flavor_price_rule : null,
    options: [...row.addon_options]
      .sort((a, b) => a.position - b.position)
      .map((option) => ({ id: option.id, name: option.name, priceCents: option.price_cents, soldOut: option.sold_out })),
  }
}
```

Run: `npm test -- src/lib/addons/rows.test.ts` → PASS.

- [ ] **Step 3: Consulta e ações**

`src/features/addons/queries.ts`:

```ts
import 'server-only'
import { getPanelSession } from '@/features/vitrines/queries'
import { ADDON_GROUP_COLUMNS, toAddonGroup, type AddonGroupRow } from '@/lib/addons/rows'

export async function listAddonGroups(vitrineId: string) {
  const { supabase } = await getPanelSession()
  const { data, error } = await supabase
    .from('addon_groups')
    .select(ADDON_GROUP_COLUMNS)
    .eq('vitrine_id', vitrineId)
    .order('position')
    .order('created_at')
  if (error) throw error
  return ((data ?? []) as AddonGroupRow[]).map(toAddonGroup)
}
```

`src/features/addons/actions.ts`:

```ts
'use server'

import { redirect } from 'next/navigation'
import { requireActionUser } from '@/lib/auth/action-user'
import { fieldErrorsFromZod, readFormFields, type FormState } from '@/lib/forms/form-state'
import { revalidateVitrine } from '@/lib/vitrines/cache'
import { mapDbError } from '@/lib/vitrines/db-errors'
import { addonGroupSchema, type AddonGroupInput } from '@/lib/vitrines/schemas'

const GROUP_FIELDS = ['name', 'kind', 'required', 'minSelect', 'maxSelect', 'allowRepeat', 'flavorPriceRule', 'options'] as const

async function ownedVitrine(vitrineId: string) {
  const { supabase } = await requireActionUser()
  const { data: vitrine } = await supabase.from('vitrines').select('id, subdomain').eq('id', vitrineId).maybeSingle()
  if (!vitrine) redirect('/painel')
  return { supabase, vitrine }
}

type ServerClient = Awaited<ReturnType<typeof requireActionUser>>['supabase']

// Sincroniza por id: opções que continuam mantêm o id (sacolas e pedidos apontam para ele).
async function syncOptions(supabase: ServerClient, groupId: string, options: AddonGroupInput['options']) {
  const { data: existing, error: existingError } = await supabase.from('addon_options').select('id').eq('group_id', groupId)
  if (existingError) return mapDbError(existingError)
  const keep = new Set(options.map((option) => option.id).filter(Boolean))
  const removed = (existing ?? []).map((option) => option.id).filter((id) => !keep.has(id))
  if (removed.length) {
    const { error } = await supabase.from('addon_options').delete().in('id', removed)
    if (error) return mapDbError(error)
  }
  for (const [position, option] of options.entries()) {
    const values = { name: option.name, price_cents: option.priceCents, sold_out: option.soldOut, position }
    const { error } = option.id
      ? await supabase.from('addon_options').update(values).eq('id', option.id).eq('group_id', groupId)
      : await supabase.from('addon_options').insert({ ...values, group_id: groupId })
    if (error) return mapDbError(error)
  }
  return null
}

export async function saveAddonGroupAction(
  vitrineId: string,
  groupId: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const fields = readFormFields(formData, GROUP_FIELDS)
  const parsed = addonGroupSchema.safeParse(fields)
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error), values: fields }
  const input = parsed.data

  const { supabase, vitrine } = await ownedVitrine(vitrineId)
  const row = {
    name: input.name,
    kind: input.kind,
    required: input.required,
    min_select: input.minSelect,
    max_select: input.maxSelect,
    allow_repeat: input.allowRepeat,
    flavor_price_rule: input.flavorPriceRule,
  }

  let savedId = groupId
  if (!groupId) {
    const { count } = await supabase
      .from('addon_groups')
      .select('id', { count: 'exact', head: true })
      .eq('vitrine_id', vitrineId)
    const { data, error } = await supabase
      .from('addon_groups')
      .insert({ ...row, vitrine_id: vitrineId, position: count ?? 0 })
      .select('id')
      .single()
    if (error) return { error: mapDbError(error), values: fields }
    savedId = data.id
  } else {
    const { error } = await supabase.from('addon_groups').update(row).eq('id', groupId).eq('vitrine_id', vitrineId)
    if (error) return { error: mapDbError(error), values: fields }
  }

  const optionsError = await syncOptions(supabase, savedId!, input.options)
  if (optionsError) return { error: optionsError, values: fields }

  revalidateVitrine(vitrine.subdomain)
  return { success: 'Grupo salvo.', values: fields }
}

export async function deleteAddonGroupAction(vitrineId: string, groupId: string): Promise<FormState> {
  const { supabase, vitrine } = await ownedVitrine(vitrineId)
  const { error } = await supabase.from('addon_groups').delete().eq('id', groupId).eq('vitrine_id', vitrineId)
  if (error) return { error: mapDbError(error) }
  revalidateVitrine(vitrine.subdomain)
  return { success: 'Grupo excluído.' }
}
```

- [ ] **Step 4: Tela**

`src/app/app/(painel)/painel/vitrines/[id]/complementos/page.tsx`:

```tsx
import { listAddonGroups } from '@/features/addons/queries'
import { getMyVitrine } from '@/features/vitrines/queries'
import { AddonGroups } from './addon-groups'

export const metadata = { title: 'Complementos' }

export default async function ComplementosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await getMyVitrine(id)
  const groups = await listAddonGroups(id)
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-muted">
        Grupos de complementos podem ser usados em vários itens. Depois de salvar, ligue os grupos no editor de cada item.
      </p>
      <AddonGroups vitrineId={id} groups={groups} />
    </div>
  )
}
```

`src/app/app/(painel)/painel/vitrines/[id]/complementos/addon-groups.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { deleteAddonGroupAction, saveAddonGroupAction } from '@/features/addons/actions'
import type { AddonGroup } from '@/lib/addons/addons'
import { ADDON_TEMPLATES } from '@/lib/addons/templates'
import type { FormState } from '@/lib/forms/form-state'
import { centsToInput } from '@/lib/money/money'

type OptionRow = { key: string; id: string | null; name: string; price: string; soldOut: boolean }
type Draft = {
  name: string
  kind: 'standard' | 'flavors'
  required: boolean
  minSelect: number
  maxSelect: number
  allowRepeat: boolean
  flavorPriceRule: 'max' | 'average' | null
  options: OptionRow[]
}

const newKey = () => Math.random().toString(36).slice(2)
const selectClass = 'h-11 w-full rounded-control border border-line-strong bg-surface px-3 text-base'

const BLANK: Draft = {
  name: '', kind: 'standard', required: false, minSelect: 0, maxSelect: 1, allowRepeat: false, flavorPriceRule: null,
  options: [{ key: 'blank', id: null, name: '', price: '', soldOut: false }],
}

function draftFromGroup(group: AddonGroup): Draft {
  return {
    ...group,
    options: group.options.map((option) => ({
      key: option.id, id: option.id, name: option.name, price: centsToInput(option.priceCents), soldOut: option.soldOut,
    })),
  }
}

export function AddonGroups({ vitrineId, groups }: { vitrineId: string; groups: AddonGroup[] }) {
  const router = useRouter()
  const [template, setTemplate] = useState('')
  const [draftVersion, setDraftVersion] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)

  const templateDraft: Draft = (() => {
    const found = ADDON_TEMPLATES.find((item) => item.key === template)
    if (!found) return BLANK
    return {
      ...found.group,
      options: found.options.map((option) => ({ key: newKey(), id: null, name: option.name, price: centsToInput(option.priceCents), soldOut: false })),
    }
  })()

  return (
    <div className="flex flex-col gap-4">
      <div aria-live="polite">
        <FormMessage success={notice ?? undefined} />
      </div>

      <Card className="flex flex-col gap-4 p-5">
        <h2 className="text-lg font-medium">Novo grupo</h2>
        <Field label="Começar de um modelo" htmlFor="addon-template">
          <select
            id="addon-template"
            value={template}
            onChange={(event) => {
              setTemplate(event.target.value)
              setDraftVersion((version) => version + 1)
            }}
            className={selectClass}
          >
            <option value="">Em branco</option>
            {ADDON_TEMPLATES.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>
        <AddonGroupForm
          key={`novo-${draftVersion}`}
          vitrineId={vitrineId}
          groupId={null}
          initial={templateDraft}
          onSaved={() => {
            setNotice('Grupo salvo.')
            setTemplate('')
            setDraftVersion((version) => version + 1)
            router.refresh()
          }}
        />
      </Card>

      {groups.map((group) => (
        <Card key={group.id} className="flex flex-col gap-3 p-5">
          <AddonGroupForm
            // Remonta quando os ids das opções mudam: opções recém-criadas ganham id e o próximo
            // "Salvar grupo" atualiza em vez de recriar (sacolas guardam esses ids).
            key={`${group.id}-${group.options.map((option) => option.id).join(',')}`}
            vitrineId={vitrineId}
            groupId={group.id}
            initial={draftFromGroup(group)}
            onSaved={() => router.refresh()}
          />
          <DeleteGroupButton
            vitrineId={vitrineId}
            groupId={group.id}
            onDeleted={(message) => {
              setNotice(message)
              router.refresh()
            }}
          />
        </Card>
      ))}
    </div>
  )
}

function DeleteGroupButton(props: { vitrineId: string; groupId: string; onDeleted: (message: string) => void }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="ghost"
        className="self-start"
        disabled={pending}
        onClick={() => {
          if (!window.confirm('Excluir este grupo? Ele sai de todos os itens.')) return
          startTransition(async () => {
            const result = await deleteAddonGroupAction(props.vitrineId, props.groupId)
            if (result.error) setError(result.error)
            else props.onDeleted(result.success ?? 'Grupo excluído.')
          })
        }}
      >
        Excluir grupo
      </Button>
      <FormMessage error={error ?? undefined} />
    </div>
  )
}

function AddonGroupForm(props: {
  vitrineId: string
  groupId: string | null
  initial: Draft
  onSaved: () => void
}) {
  const prefix = props.groupId ?? 'novo'
  const [kind, setKind] = useState(props.initial.kind)
  const [required, setRequired] = useState(props.initial.required)
  const [options, setOptions] = useState<OptionRow[]>(props.initial.options)
  const [state, formAction, pending] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await saveAddonGroupAction(props.vitrineId, props.groupId, prev, formData)
    if (result.success) props.onSaved()
    return result
  }, {})
  const errors = state.fieldErrors ?? {}

  const updateOption = (key: string, patch: Partial<OptionRow>) =>
    setOptions((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))

  return (
    <form
      action={formAction}
      noValidate
      aria-label={props.groupId ? `Grupo ${props.initial.name}` : 'Novo grupo'}
      className="flex flex-col gap-4"
    >
      <input
        type="hidden"
        name="options"
        value={JSON.stringify(options.map(({ id, name, price, soldOut }) => ({ id, name, price, soldOut })))}
      />
      <Field label="Nome do grupo" htmlFor={`${prefix}-name`} error={errors.name}>
        <Input id={`${prefix}-name`} name="name" maxLength={40} defaultValue={props.initial.name} invalid={!!errors.name} />
      </Field>
      <Field label="Tipo" htmlFor={`${prefix}-kind`}>
        <select
          id={`${prefix}-kind`}
          name="kind"
          value={kind}
          onChange={(event) => setKind(event.target.value as Draft['kind'])}
          className={selectClass}
        >
          <option value="standard">Padrão</option>
          <option value="flavors">Sabores de pizza</option>
        </select>
      </Field>
      <label className="flex items-center gap-2">
        <input type="checkbox" name="required" checked={required} onChange={(event) => setRequired(event.target.checked)} />
        Obrigatório
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        {required ? (
          <Field label="Mínimo" htmlFor={`${prefix}-min`} error={errors.minSelect}>
            <Input id={`${prefix}-min`} name="minSelect" inputMode="numeric" defaultValue={String(Math.max(1, props.initial.minSelect))} invalid={!!errors.minSelect} />
          </Field>
        ) : (
          <input type="hidden" name="minSelect" value="0" />
        )}
        <Field label="Máximo" htmlFor={`${prefix}-max`} error={errors.maxSelect}>
          <Input id={`${prefix}-max`} name="maxSelect" inputMode="numeric" defaultValue={String(props.initial.maxSelect)} invalid={!!errors.maxSelect} />
        </Field>
      </div>
      {kind === 'flavors' ? (
        <Field label="Preço dos sabores" htmlFor={`${prefix}-rule`} error={errors.flavorPriceRule}>
          <select id={`${prefix}-rule`} name="flavorPriceRule" defaultValue={props.initial.flavorPriceRule ?? 'max'} className={selectClass}>
            <option value="max">Maior preço</option>
            <option value="average">Média</option>
          </select>
        </Field>
      ) : (
        <>
          <input type="hidden" name="flavorPriceRule" value="" />
          <label className="flex items-center gap-2">
            <input type="checkbox" name="allowRepeat" defaultChecked={props.initial.allowRepeat} />
            Permitir repetir a mesma opção
          </label>
        </>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium">Opções</legend>
        {errors.options ? (
          <p role="alert" className="text-sm text-danger">
            {errors.options}
          </p>
        ) : null}
        {options.map((row, index) => {
          const n = index + 1
          return (
            <div key={row.key} className="grid gap-2 rounded-control border border-line p-3 sm:grid-cols-4">
              <Input aria-label={`Nome da opção ${n}`} placeholder="Nome" maxLength={40} value={row.name} onChange={(e) => updateOption(row.key, { name: e.target.value })} />
              <Input aria-label={`Preço da opção ${n}`} placeholder="0,00" inputMode="decimal" value={row.price} onChange={(e) => updateOption(row.key, { price: e.target.value })} />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  aria-label={`Opção ${n} esgotada`}
                  checked={row.soldOut}
                  onChange={(e) => updateOption(row.key, { soldOut: e.target.checked })}
                />
                Esgotada
              </label>
              <Button variant="ghost" aria-label={`Remover opção ${n}`} onClick={() => setOptions((rows) => rows.filter((r) => r.key !== row.key))}>
                Remover
              </Button>
            </div>
          )
        })}
        <Button
          variant="secondary"
          className="self-start"
          disabled={options.length >= 50}
          onClick={() => setOptions((rows) => [...rows, { key: newKey(), id: null, name: '', price: '', soldOut: false }])}
        >
          Adicionar opção
        </Button>
      </fieldset>

      <FormMessage error={state.error} success={props.groupId ? state.success : undefined} />
      <Button type="submit" disabled={pending} className="self-start">
        Salvar grupo
      </Button>
    </form>
  )
}
```

Em `editor-tabs.tsx`, acrescente `['complementos', 'Complementos']` logo depois de `['itens', 'Itens']`.

- [ ] **Step 5: Commit**

```bash
npm run lint && npm run typecheck && npm test
git add -A src
git commit -m "feat(painel): aba Complementos com modelos prontos, sabores e opções"
```

---

### Task 6: Aba Sacola e mensagens e Comida no assistente

**Files:**
- Modify: `src/features/vitrines/actions.ts`, `src/lib/vitrines/schemas.ts`, `src/app/app/(painel)/painel/vitrines/[id]/mensagens/page.tsx`, `src/app/app/(painel)/painel/vitrines/[id]/mensagens/messages-form.tsx`, `src/app/app/(painel)/painel/vitrines/nova/wizard.tsx`

**Interfaces:**
- Consumes: `checkoutSettingsSchema`
- Produces: `updateCheckoutAction(vitrineId: string, prev: FormState, formData: FormData): Promise<FormState>` (substitui `updateMessagesAction`; `messagesSchema` sai de `schemas.ts`)
- Textos (testes): `Texto padrão do botão` (mantido), `Usar sacola`, `Texto do botão da sacola`, título `Formulário da sacola`, selects `Nome`, `Retirada ou entrega`, `Forma de pagamento`, `Data e horário`, `Observações` com opções `Desligado`, `Opcional`, `Obrigatório`; `Formas de pagamento (uma por linha)`; botão `Salvar mensagens` e sucesso `Mensagens salvas.` (mantidos); assistente com a opção `Comida`.

- [ ] **Step 1: Ação**

Em `src/features/vitrines/actions.ts`, troque `updateMessagesAction` inteira por:

```ts
const CHECKOUT_FIELDS = [
  'cartEnabled', 'cartButtonText', 'defaultButtonText',
  'nameMode', 'fulfillmentMode', 'paymentMode', 'scheduleMode', 'notesMode', 'paymentOptions',
] as const

export async function updateCheckoutAction(vitrineId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const fields = readFormFields(formData, CHECKOUT_FIELDS)
  const parsed = checkoutSettingsSchema.safeParse(fields)
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error), values: fields }
  const input = parsed.data

  const { supabase, vitrine } = await loadOwnedVitrine(vitrineId)
  const { error: vitrineError } = await supabase
    .from('vitrines')
    .update({ cart_enabled: input.cartEnabled, cart_button_text: input.cartButtonText, default_button_text: input.defaultButtonText })
    .eq('id', vitrineId)
  if (vitrineError) return { error: mapDbError(vitrineError), values: fields }

  const { error } = await supabase
    .from('checkout_settings')
    .update({
      name_mode: input.nameMode,
      fulfillment_mode: input.fulfillmentMode,
      payment_mode: input.paymentMode,
      schedule_mode: input.scheduleMode,
      notes_mode: input.notesMode,
      payment_options: input.paymentOptions,
    })
    .eq('vitrine_id', vitrineId)
  if (error) return { error: mapDbError(error), values: fields }

  revalidateVitrine(vitrine.subdomain)
  return { success: 'Mensagens salvas.', values: fields }
}
```

No import de `@/lib/vitrines/schemas`, troque `messagesSchema` por `checkoutSettingsSchema`. Em `src/lib/vitrines/schemas.ts`, apague `messagesSchema`.

- [ ] **Step 2: Tela**

`mensagens/page.tsx`:

```tsx
import { getMyVitrine, getPanelSession } from '@/features/vitrines/queries'
import { MessagesForm } from './messages-form'

export const metadata = { title: 'Sacola e mensagens' }

export default async function MensagensPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const vitrine = await getMyVitrine(id)
  const { supabase } = await getPanelSession()
  const { data: checkout, error } = await supabase
    .from('checkout_settings')
    .select('name_mode, fulfillment_mode, payment_mode, schedule_mode, notes_mode, payment_options')
    .eq('vitrine_id', id)
    .single()
  if (error) throw error

  return (
    <MessagesForm
      vitrineId={id}
      initial={{
        cartEnabled: vitrine.cart_enabled ? 'on' : '',
        cartButtonText: vitrine.cart_button_text,
        defaultButtonText: vitrine.default_button_text,
        nameMode: checkout.name_mode,
        fulfillmentMode: checkout.fulfillment_mode,
        paymentMode: checkout.payment_mode,
        scheduleMode: checkout.schedule_mode,
        notesMode: checkout.notes_mode,
        paymentOptions: checkout.payment_options.join('\n'),
      }}
    />
  )
}
```

`mensagens/messages-form.tsx` (reescrever):

```tsx
'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { UnsavedChangesGuard } from '@/components/ui/unsaved-changes'
import { updateCheckoutAction } from '@/features/vitrines/actions'

type Values = {
  cartEnabled: string
  cartButtonText: string
  defaultButtonText: string
  nameMode: string
  fulfillmentMode: string
  paymentMode: string
  scheduleMode: string
  notesMode: string
  paymentOptions: string
}

const MODE_FIELDS = [
  ['nameMode', 'Nome'],
  ['fulfillmentMode', 'Retirada ou entrega'],
  ['paymentMode', 'Forma de pagamento'],
  ['scheduleMode', 'Data e horário'],
  ['notesMode', 'Observações'],
] as const

const selectClass = 'h-11 w-full rounded-control border border-line-strong bg-surface px-3 text-base'

export function MessagesForm({ vitrineId, initial }: { vitrineId: string; initial: Values }) {
  const [state, formAction, pending] = useActionState(updateCheckoutAction.bind(null, vitrineId), { values: initial })
  const errors = state.fieldErrors ?? {}
  const values = (state.values ?? initial) as Values

  return (
    <Card className="p-5">
      <form id="messages-form" action={formAction} noValidate className="flex flex-col gap-5">
        <Field label="Texto padrão do botão" htmlFor="defaultButtonText" error={errors.defaultButtonText}>
          <Input id="defaultButtonText" name="defaultButtonText" maxLength={30} defaultValue={values.defaultButtonText} invalid={!!errors.defaultButtonText} />
        </Field>
        <p className="text-sm text-ink-muted">A mensagem personalizada de cada item fica em Itens → Avançado.</p>

        <label className="flex items-center gap-2">
          <input type="checkbox" name="cartEnabled" defaultChecked={values.cartEnabled === 'on'} />
          Usar sacola
        </label>
        <Field label="Texto do botão da sacola" htmlFor="cartButtonText" error={errors.cartButtonText}>
          <Input id="cartButtonText" name="cartButtonText" maxLength={30} defaultValue={values.cartButtonText} invalid={!!errors.cartButtonText} />
        </Field>

        <fieldset className="flex flex-col gap-3">
          <legend className="font-medium">Formulário da sacola</legend>
          {MODE_FIELDS.map(([name, label]) => (
            <Field key={name} label={label} htmlFor={name}>
              <select id={name} name={name} defaultValue={values[name]} className={selectClass}>
                <option value="off">Desligado</option>
                <option value="optional">Opcional</option>
                <option value="required">Obrigatório</option>
              </select>
            </Field>
          ))}
          <Field label="Formas de pagamento (uma por linha)" htmlFor="paymentOptions" error={errors.paymentOptions}>
            <textarea
              id="paymentOptions"
              name="paymentOptions"
              rows={4}
              defaultValue={values.paymentOptions}
              className="w-full rounded-control border border-line-strong bg-surface px-3.5 py-2.5 text-base"
            />
          </Field>
          <p className="text-sm text-ink-muted">Com &quot;Dinheiro&quot;, o formulário pergunta &quot;Troco para quanto?&quot;.</p>
        </fieldset>

        <FormMessage error={state.error} success={state.success} />
        <Button type="submit" disabled={pending} className="self-start">
          Salvar mensagens
        </Button>
      </form>
      <UnsavedChangesGuard formId="messages-form" />
    </Card>
  )
}
```

- [ ] **Step 3: Comida no assistente**

Em `wizard.tsx`, na lista de tipos do primeiro passo, acrescente depois de Serviços:

```tsx
            ['comida', 'Comida', 'Hamburguerias, pizzarias e lanchonetes. Botão "Pedir" e sacola ligada.'],
```

- [ ] **Step 4: Commit**

```bash
npm run lint && npm run typecheck && npm test
git add -A src
git commit -m "feat(painel): aba Sacola e mensagens com formulário da sacola e Comida no assistente"
```

---

### Task 7: Grupos no editor de item e e2e do painel

**Files:**
- Modify: `src/features/items/queries.ts`, `src/features/items/actions.ts`, `src/app/app/(painel)/painel/vitrines/[id]/itens/item-form.tsx`, `.../itens/novo/page.tsx`, `.../itens/[itemId]/page.tsx`, `e2e/helpers.ts`
- Create: `e2e/addons-panel.spec.ts`

(`...` = `src/app/app/(painel)/painel/vitrines/[id]`)

**Interfaces:**
- Produces:
  - `getItemFormOptions(...).addonGroups: { id: string; name: string }[]`
  - `getItemForEdit(...).addonGroupIds: string[]` (em ordem de `position`)
  - `saveItemAction` sincroniza `item_addon_groups`; `duplicateItemAction` copia os vínculos
  - e2e: `seedVitrine(ownerId, { type?: 'produtos' | 'servicos' | 'comida', … })`; `seedAddonGroup(vitrine, ownerId, group)` → `{ id, options: { id, name }[] }`; `linkAddonGroup(ownerId, itemId, groupId, position?)`; `setCheckout(vitrineId, patch)`; `setCart(vitrineId, enabled)`
- Textos: seção `Complementos` no editor de item com uma caixa por grupo (rótulo = nome do grupo); sem grupos, `Nenhum grupo criado. Crie grupos na aba Complementos.`

- [ ] **Step 1: Consultas e ações**

Em `src/features/items/queries.ts`:
- `getItemFormOptions`: acrescente ao `Promise.all` `supabase.from('addon_groups').select('id, name').eq('vitrine_id', vitrineId).order('position').order('created_at')` e devolva `addonGroups: groups.data ?? []`.
- `getItemForEdit`: no `select`, acrescente `item_addon_groups(group_id, position)` e, no retorno, `addonGroupIds: [...(item.item_addon_groups ?? [])].sort((a, b) => a.position - b.position).map((link) => link.group_id)`.

Em `src/features/items/actions.ts`:
- `'addonGroupIds'` em `ITEM_FIELDS`;
- função nova:

```ts
async function syncAddonGroups(supabase: ServerClient, itemId: string, groupIds: string[]) {
  const { error: deleteError } = await supabase.from('item_addon_groups').delete().eq('item_id', itemId)
  if (deleteError) return mapDbError(deleteError)
  if (groupIds.length === 0) return null
  const { error } = await supabase
    .from('item_addon_groups')
    .insert(groupIds.map((groupId, position) => ({ item_id: itemId, group_id: groupId, position })))
  return error ? mapDbError(error) : null
}
```

- em `saveItemAction`, depois de `syncVariations`:

```ts
  const addonError = await syncAddonGroups(supabase, savedId!, input.addonGroupIds)
  if (addonError) return { error: addonError, ...keepValues }
```

- em `ownedItem`, o `select` passa a ser `'*, vitrines(subdomain), item_variations(*), item_addon_groups(group_id, position)'`; em `duplicateItemAction`, depois de copiar as variações:

```ts
  const links = (item.item_addon_groups ?? []).map((link) => ({ item_id: copy.id, group_id: link.group_id, position: link.position }))
  if (links.length) await supabase.from('item_addon_groups').insert(links)
```

- [ ] **Step 2: Formulário do item**

Em `item-form.tsx`:
- prop nova `addonGroups: { id: string; name: string }[]`;
- estado `const [groupIds, setGroupIds] = useState<string[]>(item?.addonGroupIds ?? [])` e, no `<form>`, `<input type="hidden" name="addonGroupIds" value={JSON.stringify(groupIds)} />`;
- antes de `<details … Avançado>`:

```tsx
          <fieldset className="flex flex-col gap-2">
            <legend className="font-medium">Complementos</legend>
            {props.addonGroups.length === 0 ? (
              <p className="text-sm text-ink-muted">Nenhum grupo criado. Crie grupos na aba Complementos.</p>
            ) : (
              props.addonGroups.map((group) => (
                <label key={group.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={groupIds.includes(group.id)}
                    onChange={(event) =>
                      setGroupIds((ids) => (event.target.checked ? [...ids, group.id] : ids.filter((id) => id !== group.id)))
                    }
                  />
                  {group.name}
                </label>
              ))
            )}
            <p className="text-sm text-ink-muted">Os grupos aparecem na ordem em que foram marcados.</p>
          </fieldset>
```

Em `itens/novo/page.tsx` e `itens/[itemId]/page.tsx`, passe `addonGroups={options.addonGroups}`.

- [ ] **Step 3: Helpers de e2e**

Em `e2e/helpers.ts`:
- em `seedVitrine`, o tipo de `options.type` passa a ser `'produtos' | 'servicos' | 'comida'`, `default_button_text` vira `{ produtos: 'Solicitar orçamento', servicos: 'Agendar', comida: 'Pedir' }[type]` e o insert ganha `cart_enabled: type === 'comida'`;
- acrescente:

```ts
export async function seedAddonGroup(
  vitrine: SeededVitrine,
  ownerId: string,
  group: {
    name: string
    kind?: 'standard' | 'flavors'
    required?: boolean
    minSelect?: number
    maxSelect?: number
    allowRepeat?: boolean
    flavorPriceRule?: 'max' | 'average' | null
    options: { name: string; priceCents?: number; soldOut?: boolean }[]
  },
) {
  const admin = createAdminClient()
  const required = group.required ?? false
  const { data: created } = await admin
    .from('addon_groups')
    .insert({
      owner_id: ownerId,
      vitrine_id: vitrine.id,
      name: group.name,
      kind: group.kind ?? 'standard',
      required,
      min_select: group.minSelect ?? (required ? 1 : 0),
      max_select: group.maxSelect ?? 1,
      allow_repeat: group.allowRepeat ?? false,
      flavor_price_rule: group.flavorPriceRule ?? null,
    })
    .select('id')
    .single()
    .throwOnError()
  const { data: options } = await admin
    .from('addon_options')
    .insert(
      group.options.map((option, position) => ({
        owner_id: ownerId,
        group_id: created.id,
        name: option.name,
        price_cents: option.priceCents ?? 0,
        sold_out: option.soldOut ?? false,
        position,
      })),
    )
    .select('id, name, position')
    .throwOnError()
  return {
    id: created.id as string,
    options: (options as { id: string; name: string; position: number }[]).sort((a, b) => a.position - b.position),
  }
}

export async function linkAddonGroup(ownerId: string, itemId: string, groupId: string, position = 0) {
  await createAdminClient()
    .from('item_addon_groups')
    .insert({ owner_id: ownerId, item_id: itemId, group_id: groupId, position })
    .throwOnError()
}

export async function setCheckout(vitrineId: string, patch: Record<string, unknown>) {
  await createAdminClient().from('checkout_settings').update(patch).eq('vitrine_id', vitrineId).throwOnError()
}

export async function setCart(vitrineId: string, enabled: boolean) {
  await createAdminClient().from('vitrines').update({ cart_enabled: enabled }).eq('id', vitrineId).throwOnError()
}
```

- [ ] **Step 4: e2e**

`e2e/addons-panel.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { createConfirmedUser, seedItem, seedVitrine, signIn, uniqueSubdomain } from './helpers'

test('grupos a partir de modelos, ligados ao item, e formulário da sacola', async ({ page }) => {
  const user = await createConfirmedUser('complementos')
  const vitrine = await seedVitrine(user.id, { type: 'comida' })
  const item = await seedItem(vitrine, user.id, { name: 'X-Bacon', priceCents: 2590 })
  await signIn(page, user.email, user.password)

  await page.goto(`/painel/vitrines/${vitrine.id}/complementos`)
  const novo = page.getByRole('form', { name: 'Novo grupo' })
  await novo.getByRole('button', { name: 'Salvar grupo' }).click()
  await expect(novo.getByText('Informe o nome do grupo.')).toBeVisible()

  await page.getByLabel('Começar de um modelo').selectOption({ label: 'Ponto da carne' })
  await expect(page.getByRole('form', { name: 'Novo grupo' }).getByLabel('Nome do grupo')).toHaveValue('Ponto da carne')
  await page.getByRole('form', { name: 'Novo grupo' }).getByRole('button', { name: 'Salvar grupo' }).click()
  await expect(page.getByText('Grupo salvo.')).toBeVisible()
  await expect(page.getByRole('form', { name: 'Grupo Ponto da carne' })).toBeVisible()

  await page.getByLabel('Começar de um modelo').selectOption({ label: 'Sabores de pizza' })
  const sabores = page.getByRole('form', { name: 'Novo grupo' })
  await expect(sabores.getByLabel('Tipo')).toHaveValue('flavors')
  await sabores.getByLabel('Preço dos sabores').selectOption({ label: 'Média' })
  await sabores.getByRole('button', { name: 'Salvar grupo' }).click()
  await expect(page.getByRole('form', { name: 'Grupo Sabores' })).toBeVisible()
  await expect(page.getByRole('form', { name: 'Grupo Sabores' }).getByLabel('Preço dos sabores')).toHaveValue('average')

  await page.goto(`/painel/vitrines/${vitrine.id}/itens/${item.id}`)
  await page.getByLabel('Ponto da carne').check()
  await page.getByLabel('Sabores').check()
  await page.getByRole('button', { name: 'Salvar item' }).click()
  await expect(page.getByText('Item salvo.')).toBeVisible()
  await page.goto(`/painel/vitrines/${vitrine.id}/itens/${item.id}`)
  await expect(page.getByLabel('Ponto da carne')).toBeChecked()
  await expect(page.getByLabel('Sabores')).toBeChecked()

  await page.goto(`/painel/vitrines/${vitrine.id}/mensagens`)
  await expect(page.getByLabel('Usar sacola')).toBeChecked()
  await expect(page.getByLabel('Retirada ou entrega')).toHaveValue('required')
  await page.getByLabel('Formas de pagamento (uma por linha)').fill('')
  await page.getByRole('button', { name: 'Salvar mensagens' }).click()
  await expect(page.getByText('Informe pelo menos uma forma de pagamento.')).toBeVisible()
  await page.getByLabel('Formas de pagamento (uma por linha)').fill('Pix\nDinheiro')
  await page.getByRole('button', { name: 'Salvar mensagens' }).click()
  await expect(page.getByText('Mensagens salvas.')).toBeVisible()
})

test('assistente cria vitrine de Comida com sacola ligada', async ({ page }) => {
  const user = await createConfirmedUser('comida')
  await signIn(page, user.email, user.password)

  await page.goto('/painel/vitrines/nova')
  await page.getByLabel('Comida').check()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByLabel('Nome da vitrine').fill('Burger Teste')
  await page.getByLabel('Endereço da vitrine', { exact: true }).fill(uniqueSubdomain('burger'))
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByLabel('WhatsApp', { exact: true }).fill('(11) 98765-4321')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByRole('button', { name: 'Criar vitrine' }).click()
  await expect(page.getByRole('heading', { name: 'Lanches' })).toBeVisible()

  await page.getByRole('link', { name: 'Sacola e mensagens' }).click()
  await expect(page.getByLabel('Usar sacola')).toBeChecked()
  await expect(page.getByLabel('Texto padrão do botão')).toHaveValue('Pedir')
  await expect(page.getByLabel('Forma de pagamento', { exact: true })).toHaveValue('required')
})
```

- [ ] **Step 5: Commit, PR e merge do bloco**

```bash
npm run lint && npm run typecheck && npm test
git add -A src e2e
git commit -m "feat(itens): grupos de complementos no editor de item e na duplicação"
git push -u origin HEAD
gh pr create --fill --base master
gh pr checks --watch
```

**Fim do Bloco 2:** autorização → merge. Conferência na nuvem: criar uma vitrine de Comida, criar "Adicionais" e "Sabores de pizza" pelos modelos, ligar a um item, ajustar o formulário da sacola.

---

# Bloco 3 — Pedido e simulador com complementos

Branch: `fase-4/bloco-3-pedido`.

### Task 8: Pedido com complementos

**Files:**
- Modify: `src/lib/addons/rows.ts` (+ test), `src/lib/orders/snapshot.ts` (+ test), `src/app/api/orders/route.ts`

**Interfaces:**
- Consumes: `validateAddonSelections`, `addonsUnitCents`, `AddonGroup`, `toAddonGroup`, `AddonGroupRow`
- Produces:
  - `groupsFromLinks(links: { position: number; addon_groups: AddonGroupRow | null }[]): AddonGroup[]`
  - `orderRequestSchema`: cada linha ganha `addons: { optionId: uuid; qty: 1..20 }[]` (máx. 30, padrão `[]`)
  - `type SnapshotSourceItem = { id; code; name; price_type; price_cents; promo_price_cents; sold_out; item_variations: {…}[]; addon_groups: AddonGroup[] }`
  - `type SnapshotAddon = { group_id: string; group_name: string; option_id: string; name: string; qty: number; price_cents: number }`
  - `type SnapshotLine = { item_id; code; name; qty; variation: { id; name } | null; addons: SnapshotAddon[]; note: string | null; unit_price_cents: number | null; addons_unit_cents: number }`
  - `buildSnapshotPayload` ganha o motivo `'addons_invalid'`

- [ ] **Step 1: Testes (falhando)**

Em `src/lib/addons/rows.test.ts`, acrescente:

```ts
import { groupsFromLinks } from './rows'

it('groupsFromLinks ordena pelos vínculos e ignora grupo ausente', () => {
  const row = (id: string) => ({
    id, name: id, kind: 'standard', required: false, min_select: 0, max_select: 1, allow_repeat: false,
    flavor_price_rule: null, position: 0, addon_options: [],
  })
  expect(groupsFromLinks([
    { position: 1, addon_groups: row('b') },
    { position: 0, addon_groups: row('a') },
    { position: 2, addon_groups: null },
  ]).map((group) => group.id)).toEqual(['a', 'b'])
})
```

Em `src/lib/orders/snapshot.test.ts`:
- nos três itens de `items`, acrescente `addon_groups: []`;
- no teste de `orderRequestSchema`, o esperado passa a ser `lines: [{ itemId: uuid(1), variationId: null, qty: 1, note: '', addons: [] }]`;
- no teste "usa nomes e preços atuais…", a linha esperada ganha `addons_unit_cents: 0`;
- acrescente:

```ts
describe('complementos', () => {
  const burger = {
    id: uuid(4), code: '104', name: 'X-Bacon', price_type: 'fixed' as const, price_cents: 2590, promo_price_cents: null, sold_out: false,
    item_variations: [],
    addon_groups: [
      {
        id: uuid(40), name: 'Ponto', kind: 'standard' as const, required: true, minSelect: 1, maxSelect: 1, allowRepeat: false, flavorPriceRule: null,
        options: [{ id: uuid(41), name: 'Ao ponto', priceCents: 0, soldOut: false }],
      },
      {
        id: uuid(42), name: 'Adicionais', kind: 'standard' as const, required: false, minSelect: 0, maxSelect: 5, allowRepeat: true, flavorPriceRule: null,
        options: [{ id: uuid(43), name: 'Bacon', priceCents: 400, soldOut: false }],
      },
    ],
  }

  it('grava complementos com preços do momento', () => {
    const result = buildSnapshotPayload(
      [{ itemId: uuid(4), variationId: null, qty: 2, note: 'sem cebola', addons: [{ optionId: uuid(43), qty: 2 }, { optionId: uuid(41), qty: 1 }] }],
      [burger],
    )
    expect(result).toEqual({
      ok: true,
      payload: {
        items: [
          {
            item_id: uuid(4), code: '104', name: 'X-Bacon', qty: 2, variation: null, note: 'sem cebola',
            unit_price_cents: 2590, addons_unit_cents: 800,
            addons: [
              { group_id: uuid(40), group_name: 'Ponto', option_id: uuid(41), name: 'Ao ponto', qty: 1, price_cents: 0 },
              { group_id: uuid(42), group_name: 'Adicionais', option_id: uuid(43), name: 'Bacon', qty: 2, price_cents: 400 },
            ],
          },
        ],
      },
    })
  })

  it('escolha inválida é recusada', () => {
    expect(buildSnapshotPayload([{ itemId: uuid(4), variationId: null, qty: 1, note: '', addons: [] }], [burger])).toEqual({
      ok: false,
      reason: 'addons_invalid',
    })
    expect(
      buildSnapshotPayload([{ itemId: uuid(4), variationId: null, qty: 1, note: '', addons: [{ optionId: uuid(99), qty: 1 }] }], [burger]),
    ).toEqual({ ok: false, reason: 'addons_invalid' })
  })
})
```

(nos demais testes, as linhas passadas a `buildSnapshotPayload` ganham `addons: []`.)

Run: `npm test -- src/lib/orders src/lib/addons` → FAIL.

- [ ] **Step 2: Implementação**

Em `src/lib/addons/rows.ts`, acrescente:

```ts
export function groupsFromLinks(links: { position: number; addon_groups: AddonGroupRow | null }[]): AddonGroup[] {
  return [...links]
    .sort((a, b) => a.position - b.position)
    .flatMap((link) => (link.addon_groups ? [toAddonGroup(link.addon_groups)] : []))
}
```

Substitua `src/lib/orders/snapshot.ts` por:

```ts
import { z } from 'zod'
import { addonsUnitCents, validateAddonSelections, type AddonGroup } from '@/lib/addons/addons'
import { unitPriceCents, type PriceType } from '@/lib/pricing/price'

export const orderRequestSchema = z.object({
  lines: z
    .array(
      z.object({
        itemId: z.uuid(),
        variationId: z.uuid().nullable().default(null),
        qty: z.number().int().min(1).max(99),
        note: z.string().trim().max(140).default(''),
        addons: z
          .array(z.object({ optionId: z.uuid(), qty: z.number().int().min(1).max(20) }))
          .max(30)
          .default([]),
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
  addon_groups: AddonGroup[]
}

export type SnapshotAddon = {
  group_id: string
  group_name: string
  option_id: string
  name: string
  qty: number
  price_cents: number
}

export type SnapshotLine = {
  item_id: string
  code: string
  name: string
  qty: number
  variation: { id: string; name: string } | null
  addons: SnapshotAddon[]
  note: string | null
  unit_price_cents: number | null
  addons_unit_cents: number
}

type BuildResult =
  | { ok: true; payload: { items: SnapshotLine[] } }
  | { ok: false; reason: 'item_not_found' | 'sold_out' | 'variation_required' | 'variation_not_found' | 'addons_invalid' }

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

    const check = validateAddonSelections(item.addon_groups, line.addons)
    if (!check.ok) return { ok: false, reason: 'addons_invalid' }
    const addons = check.selections.map((selection) => {
      const group = item.addon_groups.find((g) => g.options.some((option) => option.id === selection.optionId))!
      const option = group.options.find((o) => o.id === selection.optionId)!
      return {
        group_id: group.id,
        group_name: group.name,
        option_id: option.id,
        name: option.name,
        qty: selection.qty,
        price_cents: option.priceCents,
      }
    })

    result.push({
      item_id: item.id,
      code: item.code,
      name: item.name,
      qty: line.qty,
      variation: variation ? { id: variation.id, name: variation.name } : null,
      addons,
      note: line.note || null,
      unit_price_cents: unitPriceCents(
        { priceType: item.price_type, priceCents: item.price_cents, promoPriceCents: item.promo_price_cents },
        variation ? { priceCents: variation.price_cents, promoPriceCents: variation.promo_price_cents } : null,
      ),
      addons_unit_cents: addonsUnitCents(item.addon_groups, check.selections),
    })
  }
  return { ok: true, payload: { items: result } }
}
```

Em `src/app/api/orders/route.ts`:
- o `select` dos itens passa a ser:

```ts
      .select(
        'id, code, name, price_type, price_cents, promo_price_cents, sold_out, item_variations(id, name, price_cents, promo_price_cents, sold_out), item_addon_groups(position, addon_groups(id, name, kind, required, min_select, max_select, allow_repeat, flavor_price_rule, position, addon_options(id, name, price_cents, sold_out, position)))',
      )
```

- e a chamada vira:

```ts
    type ItemWithLinks = Omit<SnapshotSourceItem, 'addon_groups'> & {
      item_addon_groups: { position: number; addon_groups: AddonGroupRow | null }[]
    }
    const sourceItems: SnapshotSourceItem[] = ((items ?? []) as unknown as ItemWithLinks[]).map(({ item_addon_groups, ...item }) => ({
      ...item,
      addon_groups: groupsFromLinks(item_addon_groups),
    }))
    const snapshot = buildSnapshotPayload(parsed.data.lines, sourceItems)
```

(import de `groupsFromLinks` e `type AddonGroupRow` de `@/lib/addons/rows`.)

Run: `npm test` → PASS. `npm run typecheck` → PASS.

- [ ] **Step 3: Commit**

```bash
git add -A src
git commit -m "feat(pedidos): complementos validados no servidor e gravados com os preços do momento"
```

---

### Task 9: Simulador com complementos

**Files:**
- Modify: `src/lib/simulator/simulate.ts` (+ test), `src/features/simulator/actions.ts`, `src/app/app/(painel)/painel/simulador/simulator.tsx`, `e2e/simulator.spec.ts`

**Interfaces:**
- Produces:
  - `SimulatorItem.addonGroups?: AddonGroup[]`
  - `SimulatorLineInput.addons?: AddonSelection[]`
  - `SimulatedLine.addonLines: string[]`; `status` ganha `'addon_removed'`
  - `linesFromSnapshot` lê `addons` e soma `addons_unit_cents` ao preço anterior
  - `buildPricedSummary` escreve as linhas de complementos abaixo de cada item
- Textos: aviso `Complemento não existe mais`; campos manuais `{opção} em {item}` (número de 0 a 20).

- [ ] **Step 1: Testes (falhando)**

Em `src/lib/simulator/simulate.test.ts`:
- o teste de `linesFromSnapshot` passa a esperar `addons: []` na linha;
- acrescente:

```ts
describe('complementos', () => {
  const adicionais = {
    id: 'g', name: 'Adicionais', kind: 'standard' as const, required: false, minSelect: 0, maxSelect: 5, allowRepeat: true, flavorPriceRule: null,
    options: [{ id: 'bacon', name: 'Bacon', priceCents: 500, soldOut: false }],
  }
  const burger: SimulatorItem = {
    id: 'b', code: '110', name: 'X-Bacon', vitrineName: 'Burger', deleted: false, soldOut: false, priceType: 'fixed',
    priceCents: 2590, promoPriceCents: null, variations: [], addonGroups: [adicionais],
  }
  const map = new Map([['b', burger]])

  it('preço atual inclui complementos e compara com o enviado', () => {
    const lines = linesFromSnapshot({
      items: [
        {
          item_id: 'b', code: '110', name: 'X-Bacon', qty: 2, variation: null, note: null, unit_price_cents: 2590, addons_unit_cents: 800,
          addons: [{ group_id: 'g', group_name: 'Adicionais', option_id: 'bacon', name: 'Bacon', qty: 2, price_cents: 400 }],
        },
      ],
    })
    expect(lines[0]).toMatchObject({ addons: [{ optionId: 'bacon', qty: 2 }], previousUnitCents: 3390 })
    const result = simulateOrder(lines, map)
    expect(result.lines[0]).toMatchObject({
      unitCents: 3590, subtotalCents: 7180, status: 'price_changed', addonLines: ['   • Adicionais: 2x Bacon'],
    })
    expect(buildPricedSummary(result, 'M4X9')).toBe(
      ['*Pedido #M4X9*', '', '2x X-Bacon (cód. 110) – R$ 35,90 = R$ 71,80', '   • Adicionais: 2x Bacon', '', '*Total: R$ 71,80*'].join('\n'),
    )
  })

  it('complemento apagado fica fora do total', () => {
    const result = simulateOrder([{ itemId: 'b', variationId: null, qty: 1, addons: [{ optionId: 'sumiu', qty: 1 }] }], map)
    expect(result.lines[0]).toMatchObject({ status: 'addon_removed', subtotalCents: null })
    expect(result.total).toEqual({ totalCents: 0, hasOnRequest: false })
  })
})
```

Run: `npm test -- src/lib/simulator` → FAIL.

- [ ] **Step 2: Implementação**

Substitua `src/lib/simulator/simulate.ts` por:

```ts
import { addonMessageLines, addonsUnitCents, type AddonGroup, type AddonSelection } from '@/lib/addons/addons'
import { formatBRL } from '@/lib/money/money'
import { formatOrderTotal, lineTotalCents, orderTotal, unitPriceCents, type PriceType } from '@/lib/pricing/price'

export type SimulatorItem = {
  id: string; code: string; name: string; vitrineName: string; deleted: boolean; soldOut: boolean
  priceType: PriceType; priceCents: number | null; promoPriceCents: number | null
  variations: { id: string; name: string; priceCents: number; promoPriceCents: number | null }[]
  addonGroups?: AddonGroup[]
}

export type SimulatorLineInput = {
  itemId: string
  variationId: string | null
  qty: number
  addons?: AddonSelection[]
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
  status: 'ok' | 'price_changed' | 'removed' | 'variation_removed' | 'addon_removed'
  previousUnitCents: number | null
  addonLines: string[]
}

export function simulateOrder(lines: readonly SimulatorLineInput[], items: ReadonlyMap<string, SimulatorItem>) {
  const simulated: SimulatedLine[] = lines.map((line) => {
    const item = items.get(line.itemId)
    const previousUnitCents = line.previousUnitCents ?? null
    const addons = line.addons ?? []
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
        addonLines: [],
      }
    }
    const groups = item.addonGroups ?? []
    const addonLines = addonMessageLines(groups, addons)
    const variation = line.variationId ? item.variations.find((v) => v.id === line.variationId) : null
    if (line.variationId && !variation) {
      return {
        name: item.name, code: item.code, variationName: line.snapshotVariationName ?? null, qty: line.qty,
        unitCents: null, subtotalCents: null, status: 'variation_removed', previousUnitCents, addonLines,
      }
    }
    const knownOptions = new Set(groups.flatMap((group) => group.options.map((option) => option.id)))
    if (addons.some((addon) => !knownOptions.has(addon.optionId))) {
      return {
        name: item.name, code: item.code, variationName: variation?.name ?? null, qty: line.qty,
        unitCents: null, subtotalCents: null, status: 'addon_removed', previousUnitCents, addonLines,
      }
    }
    const base = unitPriceCents(item, variation ?? null)
    const unitCents = base === null ? null : base + addonsUnitCents(groups, addons)
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
      addonLines,
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
      variation: { id: string; name: string } | null
      addons?: { option_id: string; qty: number }[]
      unit_price_cents: number | null
      addons_unit_cents?: number
    }
    return {
      itemId: line.item_id,
      variationId: line.variation?.id ?? null,
      qty: line.qty,
      addons: (line.addons ?? []).map((addon) => ({ optionId: addon.option_id, qty: addon.qty })),
      previousUnitCents: line.unit_price_cents === null ? null : line.unit_price_cents + (line.addons_unit_cents ?? 0),
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
      const main = line.unitCents === null
        ? `${prefix} – sob consulta`
        : `${prefix} – ${formatBRL(line.unitCents)} = ${formatBRL(line.subtotalCents!)}`
      return [main, ...line.addonLines].join('\n')
    })
  const title = orderCode ? `*Pedido #${orderCode}*` : '*Resumo*'
  return [title, '', ...lines, '', `*Total: ${formatOrderTotal(result.total)}*`].join('\n')
}
```

Em `src/features/simulator/actions.ts`:
- `ITEM_COLUMNS` ganha no fim `, item_addon_groups(position, addon_groups(id, name, kind, required, min_select, max_select, allow_repeat, flavor_price_rule, position, addon_options(id, name, price_cents, sold_out, position)))`;
- `ItemRow` ganha `item_addon_groups: { position: number; addon_groups: AddonGroupRow | null }[]`;
- `toSimulatorItem` ganha `addonGroups: groupsFromLinks(row.item_addon_groups)`.

Em `simulator.tsx`:
- em `SimulationTable`, abaixo da linha principal: `line.addonLines.map((text) => <span key={text} className="text-sm text-ink-muted">{text.trim()}</span>)` e, para `status === 'addon_removed'`, `<span className="text-sm text-danger">Complemento não existe mais</span>`;
- em `ManualMode`: `ManualLine` ganha `addons: AddonSelection[]` (começa `[]`); para cada grupo de `item.addonGroups ?? []`, um `<fieldset>` com `<legend>{group.name}</legend>` e, por opção, um campo numérico `aria-label={`${option.name} em ${item.name}`}` (0 a 20) cujo valor é a quantidade dessa opção em `line.addons`; ao mudar, troca a quantidade (0 remove). As linhas passadas a `simulateOrder` incluem `addons`.

- [ ] **Step 3: e2e**

Em `e2e/simulator.spec.ts`, acrescente (importando `linkAddonGroup` e `seedAddonGroup`):

```ts
test('simulador soma complementos pelo código e no modo manual', async ({ page }) => {
  const user = await createConfirmedUser('simulador-complementos')
  const vitrine = await seedVitrine(user.id, { type: 'comida' })
  const burger = await seedItem(vitrine, user.id, { name: 'X-Bacon', priceCents: 2590 })
  const group = await seedAddonGroup(vitrine, user.id, {
    name: 'Adicionais', maxSelect: 5, allowRepeat: true,
    options: [{ name: 'Bacon', priceCents: 400 }, { name: 'Cheddar', priceCents: 300 }],
  })
  await linkAddonGroup(user.id, burger.id, group.id)
  const bacon = group.options[0]

  await createAdminClient()
    .rpc('insert_order_snapshot', {
      p_vitrine_id: vitrine.id,
      p_code: 'M4X9',
      p_payload: {
        items: [
          {
            item_id: burger.id, code: burger.code, name: 'X-Bacon', qty: 2, variation: null, note: null,
            unit_price_cents: 2590, addons_unit_cents: 800,
            addons: [{ group_id: group.id, group_name: 'Adicionais', option_id: bacon.id, name: 'Bacon', qty: 2, price_cents: 400 }],
          },
        ],
      },
    })
    .throwOnError()

  await signIn(page, user.email, user.password)
  await page.goto('/painel/simulador')
  await page.getByLabel('Código do pedido').fill('M4X9')
  await page.getByRole('button', { name: 'Consultar' }).click()
  await expect(page.getByText('• Adicionais: 2x Bacon').first()).toBeVisible()
  await expect(page.getByText('R$ 67,80').first()).toBeVisible()

  await page.getByLabel('Código do item').fill(burger.code)
  await page.getByRole('button', { name: 'Adicionar' }).click()
  await page.getByLabel('Cheddar em X-Bacon').fill('1')
  await expect(page.getByText('R$ 28,90').first()).toBeVisible()
})
```

- [ ] **Step 4: Commit, PR e merge do bloco**

```bash
npm run lint && npm run typecheck && npm test
git add -A src e2e
git commit -m "feat(simulador): complementos no recálculo, no modo manual e no resumo com valores"
git push -u origin HEAD
gh pr create --fill --base master
gh pr checks --watch
```

**Fim do Bloco 3:** autorização → merge.

---

# Bloco 4 — Vitrine: complementos e sacola

Branch: `fase-4/bloco-4-vitrine`.

### Task 10: Catálogo com grupos, sacola e formulário

**Files:**
- Modify: `src/features/public/build-catalog.ts` (+ test), `src/features/public/load-vitrine.ts`

**Interfaces:**
- Consumes: `groupsFromLinks`, `AddonGroupRow`, `AddonGroup`, `CheckoutSettings`
- Produces:
  - `CatalogRows.vitrine` ganha `cart_enabled: boolean; cart_button_text: string`
  - `CatalogRows.checkout: { name_mode: string; fulfillment_mode: string; payment_mode: string; schedule_mode: string; notes_mode: string; payment_options: string[] } | null`
  - `CatalogRows.addonLinks: { item_id: string; position: number; addon_groups: AddonGroupRow | null }[]`
  - `PublicItem.addonGroups: AddonGroup[]`
  - `PublicVitrine` ganha `cartEnabled: boolean; cartButtonText: string; checkout: CheckoutSettings`

- [ ] **Step 1: Testes (falhando)**

Em `build-catalog.test.ts`:
- em `base.vitrine`, acrescente `cart_enabled: true, cart_button_text: 'Enviar pedido'`;
- em `base`, acrescente:

```ts
  checkout: {
    name_mode: 'required', fulfillment_mode: 'optional', payment_mode: 'off', schedule_mode: 'off', notes_mode: 'optional',
    payment_options: ['Pix'],
  },
  addonLinks: [
    {
      item_id: 'i2', position: 1,
      addon_groups: {
        id: 'g-b', name: 'Adicionais', kind: 'standard', required: false, min_select: 0, max_select: 5, allow_repeat: true,
        flavor_price_rule: null, position: 0, addon_options: [{ id: 'o1', name: 'Bacon', price_cents: 400, sold_out: false, position: 0 }],
      },
    },
    {
      item_id: 'i2', position: 0,
      addon_groups: {
        id: 'g-a', name: 'Ponto', kind: 'standard', required: true, min_select: 1, max_select: 1, allow_repeat: false,
        flavor_price_rule: null, position: 1, addon_options: [{ id: 'o2', name: 'Ao ponto', price_cents: 0, sold_out: false, position: 0 }],
      },
    },
  ],
```

- acrescente:

```ts
describe('sacola e complementos', () => {
  it('grupos do item na ordem do vínculo; itens sem grupo ficam vazios', () => {
    const [first, second] = buildPublicCatalog(base, 'https://cdn', 'https://vz').categories[0].items
    expect(first.addonGroups.map((group) => group.name)).toEqual(['Ponto', 'Adicionais'])
    expect(second.addonGroups).toEqual([])
  })

  it('sacola e formulário da vitrine', () => {
    const catalog = buildPublicCatalog(base, 'https://cdn', 'https://vz')
    expect([catalog.cartEnabled, catalog.cartButtonText]).toEqual([true, 'Enviar pedido'])
    expect(catalog.checkout).toEqual({
      nameMode: 'required', fulfillmentMode: 'optional', paymentMode: 'off', scheduleMode: 'off', notesMode: 'optional', paymentOptions: ['Pix'],
    })
    expect(buildPublicCatalog({ ...base, checkout: null }, 'https://cdn', 'https://vz').checkout).toEqual({
      nameMode: 'optional', fulfillmentMode: 'off', paymentMode: 'off', scheduleMode: 'off', notesMode: 'optional', paymentOptions: [],
    })
  })
})
```

Run: `npm test -- src/features/public` → FAIL.

- [ ] **Step 2: Implementação**

Em `build-catalog.ts`:

```ts
import type { AddonGroup } from '@/lib/addons/addons'
import { groupsFromLinks, type AddonGroupRow } from '@/lib/addons/rows'
import type { CheckoutSettings, FieldMode } from '@/lib/cart/checkout'
```

- `CatalogRows.vitrine` ganha `cart_enabled: boolean; cart_button_text: string`;
- `CatalogRows` ganha:

```ts
  checkout: {
    name_mode: string; fulfillment_mode: string; payment_mode: string; schedule_mode: string; notes_mode: string; payment_options: string[]
  } | null
  addonLinks: { item_id: string; position: number; addon_groups: AddonGroupRow | null }[]
```

- `PublicItem` ganha `addonGroups: AddonGroup[]`; `PublicVitrine` ganha `cartEnabled: boolean; cartButtonText: string; checkout: CheckoutSettings`.
- antes do `return` final:

```ts
  const mode = (value: string | undefined, fallback: FieldMode): FieldMode =>
    value === 'off' || value === 'optional' || value === 'required' ? value : fallback
  const checkout: CheckoutSettings = {
    nameMode: mode(rows.checkout?.name_mode, 'optional'),
    fulfillmentMode: mode(rows.checkout?.fulfillment_mode, 'off'),
    paymentMode: mode(rows.checkout?.payment_mode, 'off'),
    scheduleMode: mode(rows.checkout?.schedule_mode, 'off'),
    notesMode: mode(rows.checkout?.notes_mode, 'optional'),
    paymentOptions: rows.checkout?.payment_options ?? [],
  }
```

- em `toItem`: `addonGroups: groupsFromLinks(rows.addonLinks.filter((link) => link.item_id === row.id)),`
- no retorno: `cartEnabled: vitrine.cart_enabled, cartButtonText: vitrine.cart_button_text, checkout,`

Em `load-vitrine.ts`:
- o `select` da vitrine ganha `cart_enabled, cart_button_text`;
- o `Promise.all` ganha `admin.from('checkout_settings').select('name_mode, fulfillment_mode, payment_mode, schedule_mode, notes_mode, payment_options').eq('vitrine_id', vitrine.id).maybeSingle()` (conferir o `error`);
- junto das variações, busque os vínculos quando houver itens:

```ts
  const addonLinks = itemIds.length
    ? await admin
        .from('item_addon_groups')
        .select('item_id, position, addon_groups(id, name, kind, required, min_select, max_select, allow_repeat, flavor_price_rule, position, addon_options(id, name, price_cents, sold_out, position))')
        .in('item_id', itemIds)
    : { data: [], error: null }
  if (addonLinks.error) throw addonLinks.error
```

- em `buildPublicCatalog`, passe `checkout: checkout.data ?? null` e `addonLinks: (addonLinks.data ?? []) as unknown as CatalogRows['addonLinks']`.

Run: `npm test -- src/features/public` → PASS. `npm run typecheck` → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/public
git commit -m "feat(vitrine): grupos de complementos, sacola e formulário no catálogo"
```

---

### Task 11: Complementos, quantidade e observação na tela do item

**Files:**
- Create: `src/app/v/[subdomain]/addon-picker.tsx`
- Modify (reescrever): `src/app/v/[subdomain]/item-sheet.tsx`, `src/app/v/[subdomain]/send-direct.ts`

**Interfaces:**
- Consumes: `groupBadge`, `validateAddonSelections`, `addonMessageLines`, `lineUnitCents`, `withNoteLine`, `NewCartLine`, `CartLine`
- Produces:
  - `<AddonPicker groups showPrices selections onChange errorGroupId errorMessage />`
  - `requestOrderCode(lines: { itemId: string; variationId: string | null; qty: number; note: string; addons: AddonSelection[] }[]): Promise<string | null>`
  - `sendDirect(vitrine, item, choice: { variation: { id: string; name: string } | null; addons: AddonSelection[]; note: string }): Promise<void>`
  - `ItemSheetProps = { vitrine; item; onClose; cart?: { initial?: CartLine; onSubmit: (line: NewCartLine) => void } }`
- Textos: selos de `groupBadge`; passos `Aumentar {opção}` / `Diminuir {opção}`; `Quantidade` com `Aumentar quantidade` / `Diminuir quantidade`; `Observação` (140); botões `Adicionar · R$ X`, `Adicionar`, `Salvar alterações · R$ X`, `Salvar alterações`.

- [ ] **Step 1: Seletor de complementos**

`src/app/v/[subdomain]/addon-picker.tsx`:

```tsx
'use client'

import { groupBadge, type AddonGroup, type AddonSelection } from '@/lib/addons/addons'
import { formatBRL } from '@/lib/money/money'

function qtyOf(selections: AddonSelection[], optionId: string) {
  return selections.find((selection) => selection.optionId === optionId)?.qty ?? 0
}

function withQty(selections: AddonSelection[], optionId: string, qty: number): AddonSelection[] {
  const rest = selections.filter((selection) => selection.optionId !== optionId)
  return qty > 0 ? [...rest, { optionId, qty }] : rest
}

export function AddonPicker({
  groups,
  showPrices,
  selections,
  onChange,
  errorGroupId,
  errorMessage,
}: {
  groups: AddonGroup[]
  showPrices: boolean
  selections: AddonSelection[]
  onChange: (next: AddonSelection[]) => void
  errorGroupId: string | null
  errorMessage: string | null
}) {
  return (
    <div className="mt-5 flex flex-col gap-4">
      {groups.map((group) => {
        const count = group.options.reduce((sum, option) => sum + qtyOf(selections, option.id), 0)
        const full = count >= group.maxSelect
        const single = group.minSelect > 0 && group.maxSelect === 1 && !group.allowRepeat
        const hasError = errorGroupId === group.id

        return (
          <fieldset
            key={group.id}
            id={`addon-group-${group.id}`}
            className={`flex flex-col gap-2 rounded-control border p-3 ${hasError ? 'border-danger' : 'border-line'}`}
          >
            <legend className="px-1 font-medium">{group.name}</legend>
            <p className="text-xs text-ink-muted">{groupBadge(group)}</p>
            {group.options.map((option) => {
              const qty = qtyOf(selections, option.id)
              const price =
                showPrices && option.priceCents > 0
                  ? group.kind === 'flavors'
                    ? ` · ${formatBRL(option.priceCents)}`
                    : ` · + ${formatBRL(option.priceCents)}`
                  : ''
              const label = `${option.name}${price}${option.soldOut ? ' · Esgotado' : ''}`

              if (group.allowRepeat && group.kind === 'standard') {
                return (
                  <div key={option.id} className={`flex items-center justify-between gap-2 ${option.soldOut ? 'opacity-60' : ''}`}>
                    <span>{label}</span>
                    <span className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={`Diminuir ${option.name}`}
                        disabled={qty === 0}
                        onClick={() => onChange(withQty(selections, option.id, qty - 1))}
                        className="size-9 rounded-full border border-line-strong disabled:opacity-40"
                      >
                        −
                      </button>
                      <span aria-live="polite" className="w-5 text-center">{qty}</span>
                      <button
                        type="button"
                        aria-label={`Aumentar ${option.name}`}
                        disabled={option.soldOut || full}
                        onClick={() => onChange(withQty(selections, option.id, qty + 1))}
                        className="size-9 rounded-full border border-line-strong disabled:opacity-40"
                      >
                        +
                      </button>
                    </span>
                  </div>
                )
              }

              if (single) {
                return (
                  <label key={option.id} className={`flex items-center gap-2 ${option.soldOut ? 'opacity-60' : ''}`}>
                    <input
                      type="radio"
                      name={`group-${group.id}`}
                      disabled={option.soldOut}
                      checked={qty > 0}
                      onChange={() =>
                        onChange([
                          ...selections.filter((selection) => !group.options.some((o) => o.id === selection.optionId)),
                          { optionId: option.id, qty: 1 },
                        ])
                      }
                    />
                    {label}
                  </label>
                )
              }

              return (
                <label key={option.id} className={`flex items-center gap-2 ${option.soldOut ? 'opacity-60' : ''}`}>
                  <input
                    type="checkbox"
                    disabled={option.soldOut || (full && qty === 0)}
                    checked={qty > 0}
                    onChange={(event) => onChange(withQty(selections, option.id, event.target.checked ? 1 : 0))}
                  />
                  {label}
                </label>
              )
            })}
            {hasError && errorMessage ? (
              <p role="alert" className="text-sm text-danger">
                {errorMessage}
              </p>
            ) : null}
          </fieldset>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Envio direto com complementos**

Substitua `src/app/v/[subdomain]/send-direct.ts` por:

```ts
import type { PublicItem, PublicVitrine } from '@/features/public/build-catalog'
import { addonMessageLines, type AddonSelection } from '@/lib/addons/addons'
import { isValidOrderCode } from '@/lib/codes/order-code'
import { withNoteLine } from '@/lib/whatsapp/cart-message'
import { buildDirectMessage, buildWhatsAppUrl } from '@/lib/whatsapp/messages'

export type OrderLineRequest = {
  itemId: string
  variationId: string | null
  qty: number
  note: string
  addons: AddonSelection[]
}

export async function requestOrderCode(lines: OrderLineRequest[]): Promise<string | null> {
  try {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lines }),
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
  choice: { variation: { id: string; name: string } | null; addons: AddonSelection[]; note: string },
): Promise<void> {
  const phone = item.whatsappPhone ?? vitrine.primaryPhone
  if (!phone) return
  const note = choice.note.trim()
  const orderCode = await requestOrderCode([
    { itemId: item.id, variationId: choice.variation?.id ?? null, qty: 1, note, addons: choice.addons },
  ])
  const text = buildDirectMessage({
    vitrineType: vitrine.type,
    vitrineName: vitrine.name,
    itemName: item.name,
    itemCode: item.code,
    variationName: choice.variation?.name ?? null,
    orderCode,
    customTemplate: item.customMessage,
    addonLines: withNoteLine(addonMessageLines(item.addonGroups, choice.addons), note || null),
  })
  window.location.assign(buildWhatsAppUrl(phone, text))
}
```

- [ ] **Step 3: Tela do item**

Substitua `src/app/v/[subdomain]/item-sheet.tsx` por:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import type { PublicItem, PublicVitrine } from '@/features/public/build-catalog'
import { validateAddonSelections, type AddonSelection } from '@/lib/addons/addons'
import type { CartLine, NewCartLine } from '@/lib/cart/cart'
import { lineUnitCents } from '@/lib/cart/reconcile'
import { formatBRL } from '@/lib/money/money'
import { formatPriceLabel, priceLabel } from '@/lib/pricing/price'
import { AddonPicker } from './addon-picker'
import { sendDirect } from './send-direct'
import { VideoPlayer } from './video-player'

export type ItemSheetProps = {
  vitrine: PublicVitrine
  item: PublicItem
  onClose: () => void
  cart?: { initial?: CartLine; onSubmit: (line: NewCartLine) => void }
}

export default function ItemSheet({ vitrine, item, onClose, cart }: ItemSheetProps) {
  const [variationId, setVariationId] = useState<string | null>(cart?.initial?.variationId ?? null)
  const [addons, setAddons] = useState<AddonSelection[]>(cart?.initial?.addons ?? [])
  const [qty, setQty] = useState(cart?.initial?.qty ?? 1)
  const [note, setNote] = useState(cart?.initial?.note ?? '')
  const [missingVariation, setMissingVariation] = useState(false)
  const [addonError, setAddonError] = useState<{ groupId: string | null; message: string } | null>(null)
  const [sending, setSending] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const closeRef = useRef<HTMLButtonElement>(null)
  const choicesRef = useRef<HTMLFieldSetElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const variation = item.variations.find((v) => v.id === variationId) ?? null
  const phone = item.whatsappPhone ?? vitrine.primaryPhone
  const images = [item.cover, ...item.gallery].filter((image) => image !== null)
  const line: NewCartLine = { itemId: item.id, variationId, qty, note, addons }
  const unitCents = lineUnitCents(line, item)
  const hasChoice = variation !== null || addons.length > 0
  const showPrice = vitrine.showPrices && !(variation && item.priceType === 'on_request')
  const headerPrice = hasChoice && unitCents !== null ? formatBRL(unitCents) : formatPriceLabel(priceLabel(item, item.variations))

  function validate(): boolean {
    if (item.variations.length > 0 && !variation) {
      setMissingVariation(true)
      choicesRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      return false
    }
    const check = validateAddonSelections(item.addonGroups, addons)
    if (!check.ok) {
      setAddonError({ groupId: check.groupId, message: check.message })
      if (check.groupId) {
        document.getElementById(`addon-group-${check.groupId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
      return false
    }
    setAddonError(null)
    return true
  }

  async function onPrimary() {
    if (!validate()) return
    const normalized = validateAddonSelections(item.addonGroups, addons)
    const chosen = normalized.ok ? normalized.selections : addons
    if (cart) {
      cart.onSubmit({ itemId: item.id, variationId, qty, note: note.trim(), addons: chosen })
      return
    }
    setSending(true)
    await sendDirect(vitrine, item, {
      variation: variation ? { id: variation.id, name: variation.name } : null,
      addons: chosen,
      note,
    })
    // Se o navegador bloquear a abertura do WhatsApp, o botão volta a funcionar.
    setTimeout(() => setSending(false), 3000)
  }

  let buttonLabel: string
  if (cart) {
    const verb = cart.initial ? 'Salvar alterações' : 'Adicionar'
    buttonLabel = vitrine.showPrices && unitCents !== null ? `${verb} · ${formatBRL(unitCents * qty)}` : verb
  } else {
    buttonLabel = item.buttonText ?? vitrine.defaultButtonText
  }
  let disabled = sending
  if (item.soldOut) {
    buttonLabel = 'Esgotado'
    disabled = true
  } else if (!cart && !phone) {
    buttonLabel = 'WhatsApp não configurado'
    disabled = true
  } else if (sending) {
    buttonLabel = 'Abrindo o WhatsApp…'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={item.name}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-card bg-surface text-ink md:max-w-[640px] md:rounded-card"
      >
        <div className="flex justify-end p-2">
          <button ref={closeRef} type="button" onClick={onClose} className="rounded-control px-3 py-2 text-sm">
            Fechar
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {vitrine.showMedia && (item.video || images.length > 0) ? (
            <div
              className="-mx-4 mb-4 flex snap-x snap-mandatory overflow-x-auto"
              onScroll={(event) => {
                const el = event.currentTarget
                setActiveIndex(el.clientWidth ? Math.round(el.scrollLeft / el.clientWidth) : 0)
              }}
            >
              {/* Spec 6.3: vídeo primeiro. Fora da vista, o player desmonta (pausa e destrói). */}
              {item.video ? (
                <div className="w-full shrink-0 snap-center md:w-1/2">
                  {activeIndex === 0 ? (
                    <VideoPlayer video={item.video} className="aspect-[4/5] w-full bg-black object-cover" />
                  ) : item.video.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.video.posterUrl} alt="" className="aspect-[4/5] w-full object-cover" />
                  ) : (
                    <div className="aspect-[4/5] w-full bg-black" />
                  )}
                </div>
              ) : null}
              {images.map((image) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={image.large}
                  src={image.large}
                  srcSet={`${image.small} ${image.smallWidth}w, ${image.large} ${image.largeWidth}w`}
                  sizes="(min-width: 768px) 640px, 100vw"
                  alt=""
                  className="aspect-[4/5] w-full shrink-0 snap-center object-cover md:w-1/2"
                />
              ))}
            </div>
          ) : null}

          <h2 className="text-xl font-semibold">{item.name}</h2>
          {showPrice ? <p className="mt-1 text-lg">{headerPrice}</p> : null}
          {item.durationMinutes ? <p className="text-sm text-ink-muted">{item.durationMinutes} min</p> : null}
          {item.description ? <p className="mt-3 whitespace-pre-line text-ink-muted">{item.description}</p> : null}
          {item.tags.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1">
              {item.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-subtle px-2 py-0.5 text-xs">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          {item.variations.length > 0 ? (
            <fieldset
              ref={choicesRef}
              className={`mt-5 flex flex-col gap-2 rounded-control border p-3 ${missingVariation ? 'border-danger' : 'border-line'}`}
            >
              <legend className="px-1 font-medium">Escolha uma opção</legend>
              <p className="text-xs text-ink-muted">Obrigatório · escolha 1</p>
              {item.variations.map((option) => (
                <label key={option.id} className={`flex items-center gap-2 ${option.soldOut ? 'opacity-60' : ''}`}>
                  <input
                    type="radio"
                    name="variation"
                    value={option.id}
                    disabled={option.soldOut}
                    checked={variationId === option.id}
                    onChange={() => {
                      setVariationId(option.id)
                      setMissingVariation(false)
                    }}
                  />
                  <span>
                    {option.name}
                    {vitrine.showPrices && item.priceType !== 'on_request'
                      ? ` · ${formatBRL(option.promoPriceCents ?? option.priceCents)}`
                      : ''}
                    {option.soldOut ? ' · Esgotado' : ''}
                  </span>
                </label>
              ))}
              {missingVariation ? (
                <p role="alert" className="text-sm text-danger">
                  Escolha uma opção.
                </p>
              ) : null}
            </fieldset>
          ) : null}

          {item.addonGroups.length > 0 ? (
            <AddonPicker
              groups={item.addonGroups}
              showPrices={vitrine.showPrices}
              selections={addons}
              onChange={(next) => {
                setAddons(next)
                setAddonError(null)
              }}
              errorGroupId={addonError?.groupId ?? null}
              errorMessage={addonError?.message ?? null}
            />
          ) : null}
          {addonError && !addonError.groupId ? (
            <p role="alert" className="mt-2 text-sm text-danger">
              {addonError.message}
            </p>
          ) : null}

          <label className="mt-5 flex flex-col gap-1 text-sm">
            Observação
            <textarea
              value={note}
              maxLength={140}
              rows={2}
              onChange={(event) => setNote(event.target.value)}
              className="rounded-control border border-line-strong bg-surface px-3 py-2 text-base"
            />
            <span className="self-end text-xs text-ink-muted">{note.length}/140</span>
          </label>
        </div>

        <div className="flex items-center gap-3 border-t border-line p-4">
          {cart ? (
            <div className="flex items-center gap-2" aria-label="Quantidade" role="group">
              <button
                type="button"
                aria-label="Diminuir quantidade"
                disabled={qty <= 1}
                onClick={() => setQty((value) => Math.max(1, value - 1))}
                className="size-10 rounded-full border border-line-strong disabled:opacity-40"
              >
                −
              </button>
              <span aria-live="polite" className="w-6 text-center">{qty}</span>
              <button
                type="button"
                aria-label="Aumentar quantidade"
                disabled={qty >= 99}
                onClick={() => setQty((value) => Math.min(99, value + 1))}
                className="size-10 rounded-full border border-line-strong disabled:opacity-40"
              >
                +
              </button>
            </div>
          ) : null}
          <button
            type="button"
            disabled={disabled}
            onClick={onPrimary}
            className="h-12 flex-1 rounded-control bg-brand font-semibold text-brand-ink disabled:opacity-60"
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
```

`PublicItem` é compatível com `CartCatalogItem` (mesmos campos de preço, variações, `soldOut` e `addonGroups`), por isso `lineUnitCents(line, item)` compila sem conversão.

- [ ] **Step 4: Commit**

```bash
npm run lint && npm run typecheck && npm test
git add -A src
git commit -m "feat(vitrine): complementos com selos, quantidade e observação na tela do item e no botão direto"
```

---

### Task 12: Sacola na vitrine

**Files:**
- Create: `src/app/v/[subdomain]/cart-store.ts`, `src/app/v/[subdomain]/cart-sheet.tsx`, `src/app/v/[subdomain]/send-cart.ts`, `e2e/cart.spec.ts`
- Modify: `src/app/v/[subdomain]/catalog.tsx`

**Interfaces:**
- Consumes: `addToCart`, `replaceLine`, `setLineQty`, `removeLine`, `parseStoredCart`, `serializeCart`, `cartStorageKey`, `reconcileCart`, `cartSummary`, `lineUnitCents`, `validateCheckout`, `todayInSaoPaulo`, `EMPTY_CHECKOUT_INPUT`, `CASH_OPTION`, `buildCartMessage`, `addonMessageLines`, `requestOrderCode`, `buildWhatsAppUrl`, `formatOrderTotal`
- Produces:
  - `useCart(vitrineId: string): { lines: CartLine[]; setLines: (lines: CartLine[]) => void }`
  - `buildCartWhatsAppUrl(vitrine: PublicVitrine, lines: CartLine[], items: ReadonlyMap<string, PublicItem>, checkout: CheckoutValue): Promise<string | null>`
  - `<CartSheet vitrine lines setLines items onEdit onClose />` (export default, carregado sob demanda)
- Textos (testes): botão do topo `Abrir sacola` (`Sacola (N)`); barra `Ver sacola · N itens · R$ X`; diálogo `Sacola`; `Sua sacola está vazia.`; aviso `Alguns itens saíram da sacola porque não estão mais disponíveis: …`; passos `Aumentar {item}` / `Diminuir {item}`; botões `Editar`, `Remover`; `Total: …`; campos `Nome`, grupo `Como você quer receber?` com `Retirada` / `Entrega`, `Endereço de entrega`, `Forma de pagamento` (primeira opção `Escolha`), `Troco para quanto?`, `Data`, `Horário`, `Observações`; botão com `cartButtonText` (ex.: `Enviar pedido`); `Abrindo o WhatsApp…`.

- [ ] **Step 1: Sacola guardada no aparelho**

`src/app/v/[subdomain]/cart-store.ts`:

```ts
'use client'

import { useSyncExternalStore } from 'react'
import { cartStorageKey, parseStoredCart, serializeCart, type CartLine } from '@/lib/cart/cart'

type CartStore = {
  get: () => CartLine[]
  set: (lines: CartLine[]) => void
  subscribe: (listener: () => void) => () => void
}

const EMPTY: CartLine[] = []
const stores = new Map<string, CartStore>()

// Spec 7.4: localStorage por vitrine, sempre em try/catch; sem armazenamento, só em memória.
function createStore(vitrineId: string): CartStore {
  const key = cartStorageKey(vitrineId)
  let lines: CartLine[] | null = null
  const listeners = new Set<() => void>()

  const read = () => {
    try {
      return parseStoredCart(window.localStorage.getItem(key))
    } catch {
      return []
    }
  }

  return {
    get() {
      if (lines === null) lines = read()
      return lines
    },
    set(next) {
      lines = next
      try {
        window.localStorage.setItem(key, serializeCart(next))
      } catch {
        // Sem armazenamento (modo privado, cota): segue só em memória.
      }
      listeners.forEach((listener) => listener())
    },
    subscribe(listener) {
      listeners.add(listener)
      const onStorage = (event: StorageEvent) => {
        if (event.key !== key) return
        lines = read()
        listener()
      }
      window.addEventListener('storage', onStorage)
      return () => {
        listeners.delete(listener)
        window.removeEventListener('storage', onStorage)
      }
    },
  }
}

function storeFor(vitrineId: string): CartStore {
  let store = stores.get(vitrineId)
  if (!store) {
    store = createStore(vitrineId)
    stores.set(vitrineId, store)
  }
  return store
}

export function useCart(vitrineId: string) {
  const store = storeFor(vitrineId)
  const lines = useSyncExternalStore(store.subscribe, store.get, () => EMPTY)
  return { lines, setLines: store.set }
}
```

- [ ] **Step 2: Montar o envio**

`src/app/v/[subdomain]/send-cart.ts`:

```ts
import type { PublicItem, PublicVitrine } from '@/features/public/build-catalog'
import { addonMessageLines } from '@/lib/addons/addons'
import type { CartLine } from '@/lib/cart/cart'
import type { CheckoutValue } from '@/lib/cart/checkout'
import { buildCartMessage } from '@/lib/whatsapp/cart-message'
import { buildWhatsAppUrl } from '@/lib/whatsapp/messages'
import { requestOrderCode } from './send-direct'

// A sacola vai para o WhatsApp principal da vitrine. Falha no código do pedido
// não bloqueia: a mensagem sai sem código (spec 7.5).
export async function buildCartWhatsAppUrl(
  vitrine: PublicVitrine,
  lines: CartLine[],
  items: ReadonlyMap<string, PublicItem>,
  checkout: CheckoutValue,
): Promise<string | null> {
  if (!vitrine.primaryPhone || lines.length === 0) return null
  const orderCode = await requestOrderCode(
    lines.map((line) => ({ itemId: line.itemId, variationId: line.variationId, qty: line.qty, note: line.note, addons: line.addons })),
  )
  const message = buildCartMessage({
    vitrineName: vitrine.name,
    orderCode,
    checkout,
    lines: lines.flatMap((line) => {
      const item = items.get(line.itemId)
      if (!item) return []
      const variation = line.variationId ? item.variations.find((v) => v.id === line.variationId) : null
      return [
        {
          qty: line.qty,
          itemName: item.name,
          variationName: variation?.name ?? null,
          code: item.code,
          addonLines: addonMessageLines(item.addonGroups, line.addons),
          note: line.note || null,
        },
      ]
    }),
  })
  return buildWhatsAppUrl(vitrine.primaryPhone, message)
}
```

- [ ] **Step 3: Tela da sacola**

`src/app/v/[subdomain]/cart-sheet.tsx`:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import type { PublicItem, PublicVitrine } from '@/features/public/build-catalog'
import { addonMessageLines } from '@/lib/addons/addons'
import { removeLine, setLineQty, type CartLine } from '@/lib/cart/cart'
import {
  CASH_OPTION,
  EMPTY_CHECKOUT_INPUT,
  todayInSaoPaulo,
  validateCheckout,
  type CheckoutInput,
} from '@/lib/cart/checkout'
import { cartSummary, lineUnitCents, reconcileCart } from '@/lib/cart/reconcile'
import { formatBRL } from '@/lib/money/money'
import { formatOrderTotal, lineTotalCents } from '@/lib/pricing/price'
import { buildCartWhatsAppUrl } from './send-cart'

const inputClass = 'h-11 w-full rounded-control border border-line-strong bg-surface px-3 text-base'

export default function CartSheet({
  vitrine,
  lines,
  setLines,
  items,
  onEdit,
  onClose,
}: {
  vitrine: PublicVitrine
  lines: CartLine[]
  setLines: (lines: CartLine[]) => void
  items: ReadonlyMap<string, PublicItem>
  onEdit: (line: CartLine) => void
  onClose: () => void
}) {
  // Spec 7.4: ao abrir, confere com os dados atuais.
  const [removedNames] = useState(() => reconcileCart(lines, items).removedNames)
  const [input, setInput] = useState<CheckoutInput>(EMPTY_CHECKOUT_INPUT)
  const [errors, setErrors] = useState<Partial<Record<keyof CheckoutInput, string>>>({})
  const [sending, setSending] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const reconciled = reconcileCart(lines, items)
    if (reconciled.removedNames.length > 0) setLines(reconciled.lines)
    // Só na abertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    closeRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const summary = cartSummary(lines, items)
  const settings = vitrine.checkout
  const set = (field: keyof CheckoutInput) => (value: string) => setInput((current) => ({ ...current, [field]: value }))
  const errorText = (field: keyof CheckoutInput) =>
    errors[field] ? (
      <p role="alert" className="text-sm text-danger">
        {errors[field]}
      </p>
    ) : null

  async function onSubmit() {
    const result = validateCheckout(settings, input, todayInSaoPaulo())
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    setSending(true)
    const url = await buildCartWhatsAppUrl(vitrine, lines, items, result.value)
    if (!url) {
      setSending(false)
      return
    }
    setLines([])
    window.location.assign(url)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sacola"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-card bg-surface text-ink md:max-w-[640px] md:rounded-card"
      >
        <div className="flex items-center justify-between p-4">
          <h2 className="text-xl font-semibold">Sacola</h2>
          <button ref={closeRef} type="button" onClick={onClose} className="rounded-control px-3 py-2 text-sm">
            Fechar
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {removedNames.length > 0 ? (
            <p role="status" className="mb-3 rounded-control bg-subtle p-3 text-sm">
              Alguns itens saíram da sacola porque não estão mais disponíveis: {removedNames.join(', ')}.
            </p>
          ) : null}

          {lines.length === 0 ? <p className="text-ink-muted">Sua sacola está vazia.</p> : null}

          <ul className="flex flex-col divide-y divide-line">
            {lines.map((line) => {
              const item = items.get(line.itemId)
              if (!item) return null
              const variation = line.variationId ? item.variations.find((v) => v.id === line.variationId) : null
              const label = variation ? `${item.name} – ${variation.name}` : item.name
              const subtotal = lineTotalCents(lineUnitCents(line, item), line.qty)
              return (
                <li key={line.key} className="flex flex-col gap-1 py-3">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{label}</span>
                    {vitrine.showPrices ? <span>{subtotal === null ? 'Sob consulta' : formatBRL(subtotal)}</span> : null}
                  </div>
                  {addonMessageLines(item.addonGroups, line.addons).map((text) => (
                    <span key={text} className="text-sm text-ink-muted">
                      {text.trim().replace(/^• /, '')}
                    </span>
                  ))}
                  {line.note ? <span className="text-sm text-ink-muted">Obs: {line.note}</span> : null}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      aria-label={`Diminuir ${item.name}`}
                      onClick={() => setLines(setLineQty(lines, line.key, line.qty - 1))}
                      className="size-9 rounded-full border border-line-strong"
                    >
                      −
                    </button>
                    <span aria-live="polite" className="w-6 text-center">{line.qty}</span>
                    <button
                      type="button"
                      aria-label={`Aumentar ${item.name}`}
                      disabled={line.qty >= 99}
                      onClick={() => setLines(setLineQty(lines, line.key, line.qty + 1))}
                      className="size-9 rounded-full border border-line-strong disabled:opacity-40"
                    >
                      +
                    </button>
                    <button type="button" onClick={() => onEdit(line)} className="rounded-control px-3 py-2 text-sm underline">
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => setLines(removeLine(lines, line.key))}
                      className="rounded-control px-3 py-2 text-sm underline"
                    >
                      Remover
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>

          {vitrine.showPrices && lines.length > 0 ? (
            <p className="mt-3 font-semibold">Total: {formatOrderTotal(summary.total)}</p>
          ) : null}

          {lines.length > 0 ? (
            <div className="mt-5 flex flex-col gap-4">
              {settings.nameMode !== 'off' ? (
                <label className="flex flex-col gap-1 text-sm">
                  Nome
                  <input className={inputClass} value={input.name} maxLength={60} autoComplete="name" onChange={(e) => set('name')(e.target.value)} />
                  {errorText('name')}
                </label>
              ) : null}

              {settings.fulfillmentMode !== 'off' ? (
                <fieldset className="flex flex-col gap-2">
                  <legend className="text-sm">Como você quer receber?</legend>
                  {(
                    [
                      ['retirada', 'Retirada'],
                      ['entrega', 'Entrega'],
                    ] as const
                  ).map(([value, label]) => (
                    <label key={value} className="flex items-center gap-2">
                      <input type="radio" name="fulfillment" checked={input.fulfillment === value} onChange={() => set('fulfillment')(value)} />
                      {label}
                    </label>
                  ))}
                  {errorText('fulfillment')}
                  {input.fulfillment === 'entrega' ? (
                    <label className="flex flex-col gap-1 text-sm">
                      Endereço de entrega
                      <input className={inputClass} value={input.address} maxLength={200} autoComplete="street-address" onChange={(e) => set('address')(e.target.value)} />
                      {errorText('address')}
                    </label>
                  ) : null}
                </fieldset>
              ) : null}

              {settings.paymentMode !== 'off' ? (
                <label className="flex flex-col gap-1 text-sm">
                  Forma de pagamento
                  <select className={inputClass} value={input.payment} onChange={(e) => set('payment')(e.target.value)}>
                    <option value="">Escolha</option>
                    {settings.paymentOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  {errorText('payment')}
                </label>
              ) : null}
              {input.payment === CASH_OPTION ? (
                <label className="flex flex-col gap-1 text-sm">
                  Troco para quanto?
                  <input className={inputClass} inputMode="decimal" placeholder="50,00" value={input.changeFor} onChange={(e) => set('changeFor')(e.target.value)} />
                  {errorText('changeFor')}
                </label>
              ) : null}

              {settings.scheduleMode !== 'off' ? (
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1 text-sm">
                    Data
                    <input type="date" className={inputClass} value={input.date} min={todayInSaoPaulo()} onChange={(e) => set('date')(e.target.value)} />
                    {errorText('date')}
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Horário
                    <input type="time" className={inputClass} value={input.time} onChange={(e) => set('time')(e.target.value)} />
                    {errorText('time')}
                  </label>
                </div>
              ) : null}

              {settings.notesMode !== 'off' ? (
                <label className="flex flex-col gap-1 text-sm">
                  Observações
                  <textarea
                    rows={3}
                    maxLength={300}
                    value={input.notes}
                    onChange={(e) => set('notes')(e.target.value)}
                    className="rounded-control border border-line-strong bg-surface px-3 py-2 text-base"
                  />
                  {errorText('notes')}
                </label>
              ) : null}
            </div>
          ) : null}
        </div>

        {lines.length > 0 ? (
          <div className="border-t border-line p-4">
            <button
              type="button"
              disabled={sending || !vitrine.primaryPhone}
              onClick={onSubmit}
              className="h-12 w-full rounded-control bg-brand font-semibold text-brand-ink disabled:opacity-60"
            >
              {!vitrine.primaryPhone ? 'WhatsApp não configurado' : sending ? 'Abrindo o WhatsApp…' : vitrine.cartButtonText}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
```

Se o lint recusar o `eslint-disable` de `exhaustive-deps` (regra não configurada), remova o comentário; o efeito continua com `[]`.

- [ ] **Step 4: Topo, barra e edição no catálogo**

Em `catalog.tsx`:

1. Imports:

```tsx
import { addToCart, replaceLine, type CartLine } from '@/lib/cart/cart'
import { cartSummary } from '@/lib/cart/reconcile'
import { formatOrderTotal } from '@/lib/pricing/price'
import { useCart } from './cart-store'

const CartSheet = dynamic(() => import('./cart-sheet'), { ssr: false })
```

(`formatOrderTotal` vem junto com `formatPriceLabel` e `priceLabel` no import existente de `@/lib/pricing/price`.)

2. No começo de `Catalog`:

```tsx
  const { lines, setLines } = useCart(vitrine.id)
  const [cartOpen, setCartOpen] = useState(false)
  const [editing, setEditing] = useState<CartLine | null>(null)
  const itemsById = useMemo(
    () => new Map(vitrine.categories.flatMap((category) => category.items).map((item) => [item.id, item])),
    [vitrine.categories],
  )
  const summary = cartSummary(lines, itemsById)
  const cartLabel = `Ver sacola · ${summary.count} ${summary.count === 1 ? 'item' : 'itens'}${
    vitrine.showPrices ? ` · ${formatOrderTotal(summary.total)}` : ''
  }`
```

3. No topo, ao lado do nome (dentro do primeiro `div` de `header`, depois do bloco do nome):

```tsx
          {vitrine.cartEnabled ? (
            <button
              type="button"
              aria-label="Abrir sacola"
              onClick={() => setCartOpen(true)}
              className="ml-auto shrink-0 rounded-full border border-line-strong px-3 py-2 text-sm"
            >
              Sacola ({summary.count})
            </button>
          ) : null}
```

4. Troque a linha final que renderiza `ItemSheet` por:

```tsx
      {itemCode && openItemData ? (
        <ItemSheet
          vitrine={vitrine}
          item={openItemData}
          onClose={closeItem}
          cart={
            vitrine.cartEnabled
              ? {
                  onSubmit: (line) => {
                    setLines(addToCart(lines, line))
                    closeItem()
                  },
                }
              : undefined
          }
        />
      ) : null}

      {editing && itemsById.get(editing.itemId) ? (
        <ItemSheet
          vitrine={vitrine}
          item={itemsById.get(editing.itemId)!}
          onClose={() => setEditing(null)}
          cart={{
            initial: editing,
            onSubmit: (line) => {
              setLines(replaceLine(lines, editing.key, line))
              setEditing(null)
              setCartOpen(true)
            },
          }}
        />
      ) : null}

      {cartOpen ? (
        <CartSheet
          vitrine={vitrine}
          lines={lines}
          setLines={setLines}
          items={itemsById}
          onEdit={(line) => {
            setCartOpen(false)
            setEditing(line)
          }}
          onClose={() => setCartOpen(false)}
        />
      ) : null}

      {vitrine.cartEnabled && summary.count > 0 && !cartOpen && !editing && !itemCode ? (
        <div className="fixed inset-x-0 bottom-0 z-40 p-4">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="mx-auto block h-12 w-full max-w-md rounded-control bg-brand font-semibold text-brand-ink shadow-lg"
          >
            {cartLabel}
          </button>
        </div>
      ) : null}
```

5. Para a barra não cobrir o rodapé, acrescente `pb-24` ao `<main>` quando `vitrine.cartEnabled`.

- [ ] **Step 5: e2e**

`e2e/cart.spec.ts`:

```ts
import { expect, test, type Page } from '@playwright/test'
import {
  createAdminClient,
  createConfirmedUser,
  linkAddonGroup,
  seedAddonGroup,
  seedItem,
  seedVitrine,
} from './helpers'

const vitrineUrl = (subdomain: string) => `http://${subdomain}.localhost:3000/`
const ORDER = '[23456789A-HJ-NP-Z]{4}'

async function captureWhatsApp(page: Page) {
  await page.route('https://wa.me/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: 'ok' }))
  return page.waitForRequest(/^https:\/\/wa\.me\//)
}

test('sacola: complementos, quantidade, guarda no aparelho, formulário e mensagem completa', async ({ page }) => {
  const user = await createConfirmedUser('sacola')
  const vitrine = await seedVitrine(user.id, { type: 'comida', name: 'Burger do Zé', phone: '+5511912345678' })
  const burger = await seedItem(vitrine, user.id, { name: 'X-Bacon', priceCents: 2590 })
  const coca = await seedItem(vitrine, user.id, { name: 'Coca-Cola lata', priceCents: 600 })
  const ponto = await seedAddonGroup(vitrine, user.id, {
    name: 'Ponto', required: true, options: [{ name: 'Mal passado' }, { name: 'Ao ponto' }],
  })
  const adicionais = await seedAddonGroup(vitrine, user.id, {
    name: 'Adicionais', maxSelect: 5, allowRepeat: true, options: [{ name: 'Bacon', priceCents: 400 }, { name: 'Cheddar', priceCents: 300 }],
  })
  await linkAddonGroup(user.id, burger.id, ponto.id, 0)
  await linkAddonGroup(user.id, burger.id, adicionais.id, 1)

  await page.goto(vitrineUrl(vitrine.subdomain))
  await expect(page.getByRole('button', { name: 'Abrir sacola' })).toBeVisible()

  await page.getByRole('button', { name: 'X-Bacon' }).click()
  const sheet = page.getByRole('dialog', { name: 'X-Bacon' })
  await expect(sheet.getByText('Obrigatório · escolha 1')).toBeVisible()
  await expect(sheet.getByText('Opcional · até 5')).toBeVisible()
  await sheet.getByRole('button', { name: 'Adicionar · R$ 25,90' }).click()
  await expect(sheet.getByText('Escolha uma opção em Ponto.')).toBeVisible()

  await sheet.getByLabel('Ao ponto').check()
  await sheet.getByRole('button', { name: 'Aumentar Bacon' }).click()
  await sheet.getByRole('button', { name: 'Aumentar Bacon' }).click()
  await sheet.getByRole('button', { name: 'Aumentar Cheddar' }).click()
  await sheet.getByRole('button', { name: 'Aumentar quantidade' }).click()
  await sheet.getByLabel('Observação').fill('sem cebola')
  await sheet.getByRole('button', { name: 'Adicionar · R$ 73,80' }).click()
  await expect(page.getByRole('button', { name: 'Ver sacola · 2 itens · R$ 73,80' })).toBeVisible()

  await page.getByRole('button', { name: 'Coca-Cola lata' }).click()
  await page.getByRole('dialog', { name: 'Coca-Cola lata' }).getByRole('button', { name: 'Adicionar · R$ 6,00' }).click()
  await expect(page.getByRole('button', { name: 'Ver sacola · 3 itens · R$ 79,80' })).toBeVisible()

  await page.reload()
  await page.getByRole('button', { name: 'Ver sacola · 3 itens · R$ 79,80' }).click()
  const cart = page.getByRole('dialog', { name: 'Sacola' })
  await cart.getByRole('button', { name: 'Enviar pedido' }).click()
  await expect(cart.getByText('Informe seu nome.')).toBeVisible()
  await expect(cart.getByText('Escolha retirada ou entrega.')).toBeVisible()
  await expect(cart.getByText('Escolha a forma de pagamento.')).toBeVisible()

  await cart.getByLabel('Nome').fill('Ana')
  await cart.getByLabel('Retirada').check()
  await cart.getByLabel('Forma de pagamento').selectOption('Pix')
  const whatsapp = captureWhatsApp(page)
  await cart.getByRole('button', { name: 'Enviar pedido' }).click()
  const url = new URL((await whatsapp).url())
  expect(url.pathname).toBe('/5511912345678')
  expect(url.searchParams.get('text')).toMatch(
    new RegExp(
      [
        `^\\*Pedido #(${ORDER}) – Burger do Zé\\*`,
        '',
        `2x \\*X-Bacon\\* \\(cód\\. ${burger.code}\\)`,
        '   • Ponto: Ao ponto',
        '   • Adicionais: 2x Bacon, 1x Cheddar',
        '   • Obs: sem cebola',
        '',
        `1x \\*Coca-Cola lata\\* \\(cód\\. ${coca.code}\\)`,
        '',
        'Retirada · Nome: Ana · Pagamento: Pix$',
      ].join('\\n'),
    ),
  )

  const orderCode = url.searchParams.get('text')!.match(new RegExp(`#(${ORDER})`))![1]
  const { data: snapshot } = await createAdminClient()
    .from('order_snapshots')
    .select('payload')
    .eq('owner_id', user.id)
    .eq('code', orderCode)
    .single()
    .throwOnError()
  expect(snapshot.payload.items[0]).toMatchObject({ qty: 2, unit_price_cents: 2590, addons_unit_cents: 1100 })
  expect(JSON.stringify(snapshot.payload)).not.toContain('Ana')

  await page.goto(vitrineUrl(vitrine.subdomain))
  await expect(page.getByRole('button', { name: 'Abrir sacola' })).toHaveText('Sacola (0)')
})

test('sacola com item que não existe mais avisa e remove', async ({ page }) => {
  const user = await createConfirmedUser('sacola-reconcilia')
  const vitrine = await seedVitrine(user.id, { type: 'comida' })
  const item = await seedItem(vitrine, user.id, { name: 'Suco', priceCents: 800 })

  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [
      `agenn-sacola:${vitrine.id}`,
      JSON.stringify({
        version: 1,
        lines: [
          { itemId: item.id, variationId: null, qty: 1, note: '', addons: [] },
          { itemId: '00000000-0000-4000-8000-000000000999', variationId: null, qty: 1, note: '', addons: [] },
        ],
      }),
    ],
  )
  await page.goto(vitrineUrl(vitrine.subdomain))
  await page.getByRole('button', { name: 'Abrir sacola' }).click()
  const cart = page.getByRole('dialog', { name: 'Sacola' })
  await expect(cart.getByText('Alguns itens saíram da sacola porque não estão mais disponíveis: Um item.')).toBeVisible()
  await expect(cart.getByText('Suco')).toBeVisible()
  await expect(cart.getByText('Total: R$ 8,00')).toBeVisible()
})

test('sabores de pizza pela média e botão direto com complementos', async ({ page }) => {
  const user = await createConfirmedUser('sabores')
  const pizzaria = await seedVitrine(user.id, { type: 'comida', name: 'Pizzaria' })
  const pizza = await seedItem(pizzaria, user.id, { name: 'Pizza grande', priceCents: 0 })
  const sabores = await seedAddonGroup(pizzaria, user.id, {
    name: 'Sabores', kind: 'flavors', required: true, maxSelect: 2, flavorPriceRule: 'average',
    options: [{ name: 'Calabresa', priceCents: 4990 }, { name: 'Quatro queijos', priceCents: 5491 }],
  })
  await linkAddonGroup(user.id, pizza.id, sabores.id)

  await page.goto(vitrineUrl(pizzaria.subdomain))
  await page.getByRole('button', { name: 'Pizza grande' }).click()
  const sheet = page.getByRole('dialog', { name: 'Pizza grande' })
  await sheet.getByLabel('Calabresa').check()
  await sheet.getByLabel('Quatro queijos').check()
  await expect(sheet.getByRole('button', { name: 'Adicionar · R$ 52,41' })).toBeVisible()

  // Botão direto (sacola desligada) numa vitrine de produtos, de outro dono (plano grátis: 1 vitrine)
  const lojista = await createConfirmedUser('direto-complementos')
  const loja = await seedVitrine(lojista.id, { name: 'Loja' })
  const camiseta = await seedItem(loja, lojista.id, { name: 'Camiseta', priceCents: 5000 })
  const tamanho = await seedAddonGroup(loja, lojista.id, {
    name: 'Tamanho', required: true, options: [{ name: 'P' }, { name: 'G', priceCents: 1000 }],
  })
  await linkAddonGroup(lojista.id, camiseta.id, tamanho.id)

  await page.goto(vitrineUrl(loja.subdomain))
  await page.getByRole('button', { name: 'Camiseta' }).click()
  const direto = page.getByRole('dialog', { name: 'Camiseta' })
  await direto.getByRole('radio', { name: /^G/ }).check()
  await direto.getByLabel('Observação').fill('presente')
  const whatsapp = captureWhatsApp(page)
  await direto.getByRole('button', { name: 'Solicitar orçamento' }).click()
  expect(new URL((await whatsapp).url()).searchParams.get('text')).toMatch(
    new RegExp(`\\(cód\\. ${camiseta.code}\\)\\. Pedido #${ORDER}\\n\\n   • Tamanho: G\\n   • Obs: presente$`),
  )
})
```

- [ ] **Step 6: Commit, PR e merge do bloco**

```bash
npm run lint && npm run typecheck && npm test
git add -A src e2e
git commit -m "feat(vitrine): sacola com guardar no aparelho, conferência, edição, formulário e mensagem completa"
git push -u origin HEAD
gh pr create --fill --base master
gh pr checks --watch
```

Conferir no log do build que `/v/[subdomain]` continua `●`.

**Fim do Bloco 4:** autorização → merge. Conferência na nuvem (celular): numa vitrine de Comida, montar um pedido com dois itens e complementos, fechar o navegador e voltar (a sacola continua), enviar pelo formulário e conferir a mensagem no WhatsApp.

---

# Bloco 5 — Fechamento

Branch: `fase-4/bloco-5-fechamento`.

### Task 13: Fluxo completo de Comida e conferência

**Files:**
- Modify: `e2e/fluxo-completo.spec.ts`
- Create: `docs/setup/fase-4-conferencia.md`

- [ ] **Step 1: Fluxo completo com sacola (spec 11)**

Acrescente em `e2e/fluxo-completo.spec.ts`:

```ts
test('Comida: vitrine → complementos pelo modelo → item → sacola → WhatsApp → simulador', async ({ page }) => {
  const user = await createConfirmedUser('fluxo-comida')
  await signIn(page, user.email, user.password)

  const subdomain = uniqueSubdomain('lanche')
  await page.goto('/painel/vitrines/nova')
  await page.getByLabel('Comida').check()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByLabel('Nome da vitrine').fill('Lanche Bom')
  await page.getByLabel('Endereço da vitrine', { exact: true }).fill(subdomain)
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByLabel('WhatsApp', { exact: true }).fill('(11) 98765-4321')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByRole('button', { name: 'Criar vitrine' }).click()
  await expect(page).toHaveURL(/\/itens$/)
  const vitrinePath = page.url().replace(/\/itens$/, '')

  await page.goto(`${vitrinePath}/complementos`)
  await page.getByLabel('Começar de um modelo').selectOption({ label: 'Adicionais' })
  await page.getByRole('form', { name: 'Novo grupo' }).getByRole('button', { name: 'Salvar grupo' }).click()
  await expect(page.getByRole('form', { name: 'Grupo Adicionais' })).toBeVisible()

  await page.goto(`${vitrinePath}/itens/novo`)
  await uploadImage(page, 'Capa', await makeTestImage(page))
  await page.getByLabel('Nome', { exact: true }).fill('X-Salada')
  await page.getByLabel('Categoria').selectOption({ label: 'Lanches' })
  await page.getByLabel('Preço', { exact: true }).fill('22,00')
  await page.getByLabel('Adicionais').check()
  await page.getByRole('button', { name: 'Salvar item' }).click()
  await expect(page.getByText('Item salvo.')).toBeVisible()

  await page.goto(`http://${subdomain}.localhost:3000/`)
  await page.getByRole('button', { name: 'X-Salada' }).click()
  const sheet = page.getByRole('dialog', { name: 'X-Salada' })
  await sheet.getByRole('button', { name: 'Aumentar Bacon' }).click()
  await sheet.getByRole('button', { name: 'Adicionar · R$ 26,00' }).click()
  await page.getByRole('button', { name: 'Ver sacola · 1 item · R$ 26,00' }).click()

  const cart = page.getByRole('dialog', { name: 'Sacola' })
  await cart.getByLabel('Nome').fill('Rui')
  await cart.getByLabel('Entrega').check()
  await cart.getByLabel('Endereço de entrega').fill('Rua das Flores, 100')
  await cart.getByLabel('Forma de pagamento').selectOption('Dinheiro')
  await cart.getByLabel('Troco para quanto?').fill('50')
  await page.route('https://wa.me/**', (route) => route.fulfill({ status: 200, body: 'ok' }))
  const whatsapp = page.waitForRequest(/^https:\/\/wa\.me\//)
  await cart.getByRole('button', { name: 'Enviar pedido' }).click()
  const text = new URL((await whatsapp).url()).searchParams.get('text')!
  expect(text).toContain('1x *X-Salada* (cód. 101)\n   • Adicionais: 1x Bacon')
  expect(text).toContain('Entrega · Endereço: Rua das Flores, 100 · Nome: Rui · Pagamento: Dinheiro (troco para R$ 50,00)')
  const orderCode = text.match(/#([23456789A-HJ-NP-Z]{4})/)![1]

  await page.goto('/painel/simulador')
  await page.getByLabel('Código do pedido').fill(orderCode)
  await page.getByRole('button', { name: 'Consultar' }).click()
  await expect(page.getByText('R$ 26,00').first()).toBeVisible()
})
```

- [ ] **Step 2: Conferência em produção**

`docs/setup/fase-4-conferencia.md`:

```markdown
# Fase 4 — Conferência em produção

Sem novas variáveis ou serviços. Conferir em `app.agenn.com.br` e numa vitrine pública, no celular:

1. Criar uma vitrine de **Comida** pelo assistente: categorias Lanches e Bebidas, sacola ligada, formulário com nome, retirada/entrega e pagamento obrigatórios.
2. **Complementos:** criar "Ponto da carne", "Adicionais" e "Sabores de pizza" pelos modelos; editar preços; marcar uma opção como esgotada.
3. **Itens:** ligar grupos a um lanche e a uma pizza; duplicar o lanche e conferir que a cópia mantém os grupos.
4. **Vitrine:** abrir o lanche, ver os selos ("Obrigatório · escolha 1", "Opcional · até 5"); tentar adicionar sem escolher o ponto (rola até o grupo e mostra o erro); escolher, somar adicionais e quantidade; conferir "Adicionar · R$ X".
5. **Pizza:** dois sabores; preço pela regra escolhida (maior ou média).
6. **Sacola:** barra "Ver sacola · N itens · R$ X"; fechar o navegador e voltar (a sacola continua); editar uma linha; mudar quantidade; remover.
7. **Formulário:** erros dos obrigatórios; Entrega pede endereço; Dinheiro pergunta o troco.
8. **Envio:** mensagem no WhatsApp igual ao modelo da spec 7.5, com `Pedido #XXXX`; a sacola fica vazia depois.
9. **Simulador:** o código do pedido mostra os complementos e o total certo; mudar o preço de um adicional no painel e consultar de novo mostra "Preço mudou desde o envio".
10. **Loja ou serviço com sacola desligada:** botão direto com complementos e observação nas linhas abaixo da mensagem.
11. **Aba Sacola e mensagens:** desligar a sacola numa vitrine de Comida volta ao botão direto; ligar numa vitrine de Produtos mostra a sacola.

## Pendências registradas

- Arrastar para reordenar grupos, opções e vínculos (hoje: ordem de criação e ordem de marcação no item) → fase de design.
- Taxa de entrega por bairro e pedido mínimo continuam fora do escopo (spec 13).
- Sacola não sincroniza entre aparelhos (fica no aparelho, como a spec pede).
```

- [ ] **Step 3: PR e merge**

```bash
npm run lint && npm run typecheck && npm test
git add e2e/fluxo-completo.spec.ts docs/setup/fase-4-conferencia.md
git commit -m "test(e2e): fluxo completo de Comida com sacola; docs: conferência da Fase 4"
git push -u origin HEAD
gh pr create --fill --base master
gh pr checks --watch
```

Autorização → merge → conferência com o usuário → memória `fase-4-pendencias`.

---

## Cobertura da spec nesta fase

| Spec | Onde |
|---|---|
| 1 — tipo Comida ("Pedir") | Tasks 4, 6 |
| 3 — sacola, complementos e simulador em todos os planos | Sem trava (todas as tasks) |
| 4.2 — `checkout_settings` (modos, opções, troco) | Tasks 1, 3, 6, 12 |
| 4.4 — grupos, opções, vínculos, sabores | Tasks 1, 2, 5, 7 |
| 4.5 — payload com complementos e observação, sem dados pessoais | Task 8 (e2e na Task 12) |
| 4.6 — regras 2 e 3 (padrão e sabores) | Tasks 2, 3, 8, 9 |
| 7.2 — ícone da sacola no topo | Task 12 |
| 7.3 — selos, quantidade, observação 140, "Adicionar · R$ X", validação com rolagem | Task 11 |
| 7.4 — localStorage com fallback, barra, editar/quantidade/remover, conferência, formulário, observação 300 | Tasks 3, 12 |
| 7.5 — mensagem da sacola; complementos no botão direto; sem código em caso de falha | Tasks 3, 11, 12 |
| 8.3 — Comida no assistente, `checkout_settings` padrão, sacola só em Comida | Tasks 1, 4, 6 |
| 8.4 — abas Complementos (modelos) e Sacola e mensagens | Tasks 5, 6 |
| 8.5 — grupos no editor de item | Task 7 |
| 8.6 — simulador com complementos | Task 9 |
| 11 — cálculo, mensagens, formulário (unitários); fluxo com sacola (e2e) | Tasks 2, 3, 12, 13 |

