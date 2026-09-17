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
