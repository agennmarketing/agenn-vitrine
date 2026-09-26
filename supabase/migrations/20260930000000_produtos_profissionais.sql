-- Duas mudanças de produto, no mínimo de banco que elas exigem:
--
-- 1. Vitrine de produtos: o assistente volta a criar vitrines do tipo 'produtos'
--    (a coluna já aceitava o valor) e cada produto passa a ter forma de venda —
--    pedido pelo WhatsApp (entra na sacola) ou link externo (botão "Comprar agora").
--    As configurações de pedido ganham telefone, retirada/entrega separados e um
--    aviso do lojista.
-- 2. Vitrine de serviços: profissionais, os serviços que cada um faz e a agenda de
--    cada um. Agendamento passa a ser por profissional; sem profissional cadastrado
--    tudo continua exatamente como hoje (um atendimento por vez na vitrine).
--
-- Nada é renomeado e nenhum dado existente muda de sentido: toda vitrine que já
-- existe continua sendo de serviços, com sale_mode 'whatsapp' nos itens e
-- professional_id nulo nos agendamentos.

-- ---------------------------------------------------------------------------
-- 1. Produtos: forma de venda do item
-- ---------------------------------------------------------------------------

alter table public.items
  add column sale_mode text not null default 'whatsapp' check (sale_mode in ('whatsapp', 'link')),
  add column external_url text check (external_url ~ '^https://' and char_length(external_url) <= 500),
  -- Link externo exige endereço; venda pelo WhatsApp não guarda endereço nenhum.
  add constraint items_external_url_when_link check (
    (sale_mode = 'link') = (external_url is not null)
  );

grant insert (sale_mode, external_url) on public.items to authenticated;
grant update (sale_mode, external_url) on public.items to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Configurações de pedido (só usadas pelas vitrines com sacola)
-- ---------------------------------------------------------------------------

alter table public.checkout_settings
  add column phone_mode text not null default 'off' check (phone_mode in ('off', 'optional', 'required')),
  add column allow_pickup boolean not null default true,
  add column allow_delivery boolean not null default true,
  add column extra_note text check (char_length(btrim(extra_note)) between 1 and 300),
  -- Perguntar "retirada ou entrega" sem oferecer nenhuma das duas não faz sentido.
  add constraint checkout_fulfillment_needs_option check (
    fulfillment_mode = 'off' or allow_pickup or allow_delivery
  );

grant update (phone_mode, allow_pickup, allow_delivery, extra_note) on public.checkout_settings to authenticated;

-- Vitrine de produtos nova já pede o telefone do cliente (opcional).
create or replace function public.default_checkout_settings(p_vitrine_id uuid, p_owner_id uuid, p_type text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.checkout_settings (
    vitrine_id, owner_id, name_mode, phone_mode, fulfillment_mode, payment_mode, schedule_mode, notes_mode
  )
  values (
    p_vitrine_id,
    p_owner_id,
    case p_type when 'produtos' then 'optional' else 'required' end,
    case p_type when 'servicos' then 'off' else 'optional' end,
    case p_type when 'comida' then 'required' else 'off' end,
    case p_type when 'comida' then 'required' else 'off' end,
    case p_type when 'servicos' then 'optional' else 'off' end,
    'optional'
  )
  on conflict (vitrine_id) do nothing;
$$;

revoke execute on function public.default_checkout_settings(uuid, uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Profissionais
-- ---------------------------------------------------------------------------

create table public.professionals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  vitrine_id uuid not null references public.vitrines (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  active boolean not null default true,
  position int not null default 0,
  -- Mesma forma de vitrines.business_hours: [{ "day": 0-6, "open": "09:00", "close": "18:00" }].
  -- Nulo = o profissional atende nos horários da vitrine.
  business_hours jsonb check (jsonb_typeof(business_hours) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index professionals_vitrine_idx on public.professionals (vitrine_id, position);

create trigger professionals_set_updated_at
  before update on public.professionals
  for each row execute function public.set_updated_at();

alter table public.professionals enable row level security;
revoke all on public.professionals from anon, authenticated;
grant select, delete on public.professionals to authenticated;
grant insert (vitrine_id, name, active, position, business_hours) on public.professionals to authenticated;
grant update (name, active, position, business_hours) on public.professionals to authenticated;

create policy "dono lê os próprios profissionais" on public.professionals
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "dono cria profissionais nas próprias vitrines" on public.professionals
  for insert to authenticated with check (
    (select auth.uid()) = owner_id
    and exists (select 1 from public.vitrines v where v.id = vitrine_id and v.owner_id = (select auth.uid()))
  );
create policy "dono altera os próprios profissionais" on public.professionals
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "dono remove os próprios profissionais" on public.professionals
  for delete to authenticated using ((select auth.uid()) = owner_id);

-- Quem faz o quê: um profissional atende vários serviços e um serviço é atendido
-- por vários profissionais.
create table public.professional_items (
  professional_id uuid not null references public.professionals (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (professional_id, item_id)
);

create index professional_items_item_idx on public.professional_items (item_id);

-- Profissional e serviço precisam ser da mesma vitrine (mesmo molde do
-- item_addon_groups_check_vitrine).
create function public.professional_items_check_vitrine()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.professionals p
    join public.items i on i.id = new.item_id
    where p.id = new.professional_id and i.vitrine_id = p.vitrine_id
  ) then
    raise exception 'professional_item_mismatch' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function public.professional_items_check_vitrine() from public, anon, authenticated;

create trigger professional_items_check_vitrine
  before insert or update on public.professional_items
  for each row execute function public.professional_items_check_vitrine();

alter table public.professional_items enable row level security;
revoke all on public.professional_items from anon, authenticated;
grant select, delete on public.professional_items to authenticated;
grant insert (professional_id, item_id) on public.professional_items to authenticated;

create policy "dono lê os próprios vínculos" on public.professional_items
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "dono cria vínculos dos próprios profissionais" on public.professional_items
  for insert to authenticated with check (
    (select auth.uid()) = owner_id
    and exists (select 1 from public.professionals p where p.id = professional_id and p.owner_id = (select auth.uid()))
  );
create policy "dono remove os próprios vínculos" on public.professional_items
  for delete to authenticated using ((select auth.uid()) = owner_id);

-- ---------------------------------------------------------------------------
-- 4. Foto do profissional: mais um papel de mídia, quadrado como a logo
-- ---------------------------------------------------------------------------

alter table public.media
  add column professional_id uuid references public.professionals (id) on delete cascade;

alter table public.media drop constraint media_role_check;
alter table public.media
  add constraint media_role_check check (role in ('cover', 'gallery', 'video', 'logo', 'banner', 'avatar'));

alter table public.media drop constraint media_kind_for_role;
alter table public.media add constraint media_kind_for_role check (
  (role in ('cover', 'gallery', 'logo', 'avatar') and kind = 'image')
  or (role = 'video' and kind = 'video')
  or role = 'banner'
);

alter table public.media add constraint media_professional_only_for_avatar check (
  professional_id is null or role = 'avatar'
);

create unique index media_one_avatar_per_professional on public.media (professional_id)
  where role = 'avatar' and professional_id is not null;

-- ---------------------------------------------------------------------------
-- 5. Agendamento por profissional
-- ---------------------------------------------------------------------------

alter table public.appointments
  -- O profissional é guardado como retrato, igual ao serviço: excluir o
  -- profissional não apaga o que já foi marcado.
  add column professional_id uuid references public.professionals (id) on delete set null,
  add column professional_name text check (char_length(btrim(professional_name)) between 1 and 60);

create index appointments_professional_idx on public.appointments (professional_id, starts_at)
  where professional_id is not null;

-- Antes: um atendimento por vez na vitrine. Agora: um atendimento por vez para cada
-- profissional, e a vitrine inteira quando o agendamento não tem profissional
-- (é o caso de tudo que já existe, então a regra antiga continua valendo lá).
alter table public.appointments drop constraint appointments_no_overlap;
alter table public.appointments add constraint appointments_no_overlap exclude using gist (
  (coalesce(professional_id, vitrine_id)) extensions.gist_uuid_ops with =,
  tstzrange(starts_at, blocked_until) with &&
) where (status = 'confirmed');

-- A assinatura muda (mais um parâmetro): remove a antiga para não ficarem duas.
drop function public.book_appointment(uuid, uuid, text, timestamptz, text, text, text, text);

create function public.book_appointment(
  p_vitrine_id uuid,
  p_item_id uuid,
  p_code text,
  p_starts_at timestamptz,
  p_customer_name text,
  p_customer_phone text,
  p_notes text,
  p_price_text text,
  p_professional_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vitrine public.vitrines%rowtype;
  v_item public.items%rowtype;
  v_professional public.professionals%rowtype;
  v_ends timestamptz;
  v_blocked timestamptz;
  v_id uuid;
begin
  select * into v_vitrine from public.vitrines v where v.id = p_vitrine_id for update;
  if v_vitrine.id is null or v_vitrine.status <> 'active' or v_vitrine.type <> 'servicos' then
    raise exception 'vitrine_not_found' using errcode = 'P0001';
  end if;

  select * into v_item from public.items i
  where i.id = p_item_id and i.vitrine_id = p_vitrine_id and i.deleted_at is null and not i.sold_out;
  if v_item.id is null then
    raise exception 'item_unavailable' using errcode = 'P0001';
  end if;

  if p_professional_id is not null then
    select * into v_professional from public.professionals p
    where p.id = p_professional_id and p.vitrine_id = p_vitrine_id and p.active;
    if v_professional.id is null then
      raise exception 'professional_unavailable' using errcode = 'P0001';
    end if;
    if not exists (
      select 1 from public.professional_items pi
      where pi.professional_id = p_professional_id and pi.item_id = p_item_id
    ) then
      raise exception 'professional_unavailable' using errcode = 'P0001';
    end if;
  end if;

  v_ends := p_starts_at + make_interval(mins => coalesce(v_item.duration_minutes, 60));
  v_blocked := v_ends + make_interval(mins => v_vitrine.booking_buffer_minutes);

  if exists (
    select 1 from public.booking_blocks b
    where b.vitrine_id = p_vitrine_id and b.starts_at < v_ends and b.ends_at > p_starts_at
  ) then
    raise exception 'slot_unavailable' using errcode = 'P0001';
  end if;

  -- Sem profissional, a vitrine inteira fica ocupada (regra antiga). Com profissional,
  -- conflita com a agenda dele e também com agendamentos sem profissional, que
  -- ocupam o negócio todo.
  if exists (
    select 1 from public.appointments a
    where a.vitrine_id = p_vitrine_id
      and a.status = 'confirmed'
      and a.starts_at < v_blocked
      and a.blocked_until > p_starts_at
      and (p_professional_id is null or a.professional_id is null or a.professional_id = p_professional_id)
  ) then
    raise exception 'slot_unavailable' using errcode = 'P0001';
  end if;

  insert into public.appointments (
    owner_id, vitrine_id, item_id, code, service_name, price_text, duration_minutes,
    customer_name, customer_phone, notes, starts_at, ends_at, blocked_until,
    professional_id, professional_name
  )
  values (
    v_vitrine.owner_id, p_vitrine_id, p_item_id, p_code, v_item.name, p_price_text,
    coalesce(v_item.duration_minutes, 60), btrim(p_customer_name), p_customer_phone,
    nullif(btrim(p_notes), ''), p_starts_at, v_ends, v_blocked,
    p_professional_id, v_professional.name
  )
  returning id into v_id;
  return v_id;
exception
  when exclusion_violation then
    raise exception 'slot_unavailable' using errcode = 'P0001';
  when unique_violation then
    return null;
end;
$$;

revoke execute on function public.book_appointment(uuid, uuid, text, timestamptz, text, text, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.book_appointment(uuid, uuid, text, timestamptz, text, text, text, text, uuid)
  to service_role;

-- Remarcar continua igual, só que a checagem de sobreposição agora olha a agenda do
-- profissional do agendamento (o profissional em si não muda ao remarcar).
create or replace function public.reschedule_appointment(p_appointment_id uuid, p_starts_at timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appointment public.appointments%rowtype;
  v_vitrine public.vitrines%rowtype;
  v_ends timestamptz;
  v_blocked timestamptz;
begin
  select * into v_appointment from public.appointments a
  where a.id = p_appointment_id and a.owner_id = (select auth.uid()) and a.status = 'confirmed';
  if v_appointment.id is null then
    raise exception 'appointment_not_found' using errcode = 'P0001';
  end if;

  if p_starts_at < now() then
    raise exception 'slot_in_past' using errcode = 'P0001';
  end if;

  select * into v_vitrine from public.vitrines v where v.id = v_appointment.vitrine_id for update;

  v_ends := p_starts_at + make_interval(mins => v_appointment.duration_minutes);
  v_blocked := v_ends + make_interval(mins => v_vitrine.booking_buffer_minutes);

  if exists (
    select 1 from public.booking_blocks b
    where b.vitrine_id = v_appointment.vitrine_id and b.starts_at < v_ends and b.ends_at > p_starts_at
  ) then
    raise exception 'slot_unavailable' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.appointments a
    where a.vitrine_id = v_appointment.vitrine_id
      and a.id <> p_appointment_id
      and a.status = 'confirmed'
      and a.starts_at < v_blocked
      and a.blocked_until > p_starts_at
      and (
        v_appointment.professional_id is null
        or a.professional_id is null
        or a.professional_id = v_appointment.professional_id
      )
  ) then
    raise exception 'slot_unavailable' using errcode = 'P0001';
  end if;

  update public.appointments
  set starts_at = p_starts_at, ends_at = v_ends, blocked_until = v_blocked
  where id = p_appointment_id and status = 'confirmed';
  if not found then
    raise exception 'appointment_not_found' using errcode = 'P0001';
  end if;
exception
  when exclusion_violation then
    raise exception 'slot_unavailable' using errcode = 'P0001';
end;
$$;

revoke execute on function public.reschedule_appointment(uuid, timestamptz) from public, anon;
grant execute on function public.reschedule_appointment(uuid, timestamptz) to authenticated;
