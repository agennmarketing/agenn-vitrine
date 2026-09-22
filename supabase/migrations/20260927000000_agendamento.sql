-- Agendamento de serviços: o cliente escolhe data e horário livres na vitrine e o
-- horário fica reservado (duração do serviço + intervalo configurado). O dono vê e
-- cancela na aba Agenda. O público nunca lê estas tabelas: a vitrine consulta só
-- datas e horários livres pela API, e o agendamento entra por book_appointment.

create extension if not exists btree_gist with schema extensions;

-- Aviso público do serviço ("Chegue 10 min antes") e duração obrigatória a partir daqui:
-- serviços antigos sem duração passam a valer 60 min (o dono ajusta depois).
alter table public.items
  add column notice text check (char_length(btrim(notice)) between 1 and 300);

grant insert (notice) on public.items to authenticated;
grant update (notice) on public.items to authenticated;

update public.items i
set duration_minutes = 60
from public.vitrines v
where v.id = i.vitrine_id and v.type = 'servicos' and i.duration_minutes is null;

-- Regras da agenda (uma por vitrine).
alter table public.vitrines
  add column booking_buffer_minutes int not null default 0 check (booking_buffer_minutes between 0 and 120),
  add column booking_min_notice_minutes int not null default 60 check (booking_min_notice_minutes between 0 and 10080),
  add column booking_max_days_ahead int not null default 30 check (booking_max_days_ahead between 1 and 180);

grant update (booking_buffer_minutes, booking_min_notice_minutes, booking_max_days_ahead) on public.vitrines to authenticated;

-- O botão do serviço agora agenda de verdade.
update public.vitrines
set default_button_text = 'Agendar horário'
where type = 'servicos' and default_button_text in ('Quero esse serviço', 'Agendar');

-- Bloqueios avulsos: folga, feriado, almoço.
create table public.booking_blocks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  vitrine_id uuid not null references public.vitrines (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text check (char_length(btrim(reason)) between 1 and 80),
  created_at timestamptz not null default now(),
  constraint booking_blocks_range check (ends_at > starts_at)
);

create index booking_blocks_vitrine_idx on public.booking_blocks (vitrine_id, starts_at);

alter table public.booking_blocks enable row level security;
revoke all on public.booking_blocks from anon, authenticated;
grant select, delete on public.booking_blocks to authenticated;
grant insert (vitrine_id, starts_at, ends_at, reason) on public.booking_blocks to authenticated;

create policy "dono lê os próprios bloqueios" on public.booking_blocks
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "dono cria bloqueios nas próprias vitrines" on public.booking_blocks
  for insert to authenticated with check (
    (select auth.uid()) = owner_id
    and exists (select 1 from public.vitrines v where v.id = vitrine_id and v.owner_id = (select auth.uid()))
  );
create policy "dono remove os próprios bloqueios" on public.booking_blocks
  for delete to authenticated using ((select auth.uid()) = owner_id);

-- Agendamentos. O serviço é guardado como retrato: editar ou excluir o serviço não
-- muda o que já foi marcado.
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  vitrine_id uuid not null references public.vitrines (id) on delete cascade,
  item_id uuid references public.items (id) on delete set null,
  code text not null check (code ~ '^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$'),
  service_name text not null check (char_length(btrim(service_name)) between 1 and 80),
  price_text text check (char_length(price_text) between 1 and 60),
  duration_minutes int not null check (duration_minutes between 1 and 1440),
  customer_name text not null check (char_length(btrim(customer_name)) between 1 and 60),
  customer_phone text not null check (customer_phone ~ '^\+[1-9][0-9]{7,14}$'),
  notes text check (char_length(btrim(notes)) between 1 and 300),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- Fim do atendimento + intervalo: é esse trecho que fica indisponível.
  blocked_until timestamptz not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint appointments_range check (ends_at > starts_at and blocked_until >= ends_at),
  constraint appointments_code_unique unique (vitrine_id, code),
  -- Um atendimento por vez: dois agendamentos confirmados nunca se sobrepõem.
  constraint appointments_no_overlap exclude using gist (
    vitrine_id extensions.gist_uuid_ops with =,
    tstzrange(starts_at, blocked_until) with &&
  ) where (status = 'confirmed')
);

create index appointments_vitrine_starts_idx on public.appointments (vitrine_id, starts_at);

alter table public.appointments enable row level security;
revoke all on public.appointments from anon, authenticated;
grant select on public.appointments to authenticated;
grant update (status, cancelled_at) on public.appointments to authenticated;

create policy "dono lê os próprios agendamentos" on public.appointments
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "dono altera os próprios agendamentos" on public.appointments
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

-- Grava o agendamento. A API já conferiu horário de atendimento, grade, antecedência
-- e janela; aqui a vitrine fica travada enquanto se confere o que muda com o tempo
-- (serviço ativo, bloqueios, outros agendamentos). Devolve null se o código já existe
-- (a API tenta outro); 'slot_unavailable' se o horário não está mais livre.
create function public.book_appointment(
  p_vitrine_id uuid,
  p_item_id uuid,
  p_code text,
  p_starts_at timestamptz,
  p_customer_name text,
  p_customer_phone text,
  p_notes text,
  p_price_text text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vitrine public.vitrines%rowtype;
  v_item public.items%rowtype;
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

  v_ends := p_starts_at + make_interval(mins => coalesce(v_item.duration_minutes, 60));
  v_blocked := v_ends + make_interval(mins => v_vitrine.booking_buffer_minutes);

  if exists (
    select 1 from public.booking_blocks b
    where b.vitrine_id = p_vitrine_id and b.starts_at < v_ends and b.ends_at > p_starts_at
  ) then
    raise exception 'slot_unavailable' using errcode = 'P0001';
  end if;

  insert into public.appointments (
    owner_id, vitrine_id, item_id, code, service_name, price_text, duration_minutes,
    customer_name, customer_phone, notes, starts_at, ends_at, blocked_until
  )
  values (
    v_vitrine.owner_id, p_vitrine_id, p_item_id, p_code, v_item.name, p_price_text,
    coalesce(v_item.duration_minutes, 60), btrim(p_customer_name), p_customer_phone,
    nullif(btrim(p_notes), ''), p_starts_at, v_ends, v_blocked
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

revoke execute on function public.book_appointment(uuid, uuid, text, timestamptz, text, text, text, text) from public, anon, authenticated;
grant execute on function public.book_appointment(uuid, uuid, text, timestamptz, text, text, text, text) to service_role;
