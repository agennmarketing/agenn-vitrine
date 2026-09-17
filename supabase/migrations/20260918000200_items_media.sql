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
