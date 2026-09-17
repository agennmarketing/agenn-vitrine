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
