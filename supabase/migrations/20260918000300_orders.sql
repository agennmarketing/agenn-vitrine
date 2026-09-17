-- Códigos de pedido (spec 4.5 e 5.2) e limite de requisições

create table public.order_snapshots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  vitrine_id uuid not null references public.vitrines (id) on delete cascade,
  code text not null check (code ~ '^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '90 days',
  unique (owner_id, code)
);

create index order_snapshots_expires_idx on public.order_snapshots (expires_at);

-- Grava o pedido. Um código só é reaproveitado depois de expirar.
create function public.insert_order_snapshot(p_vitrine_id uuid, p_code text, p_payload jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
begin
  select v.owner_id into v_owner_id
  from public.vitrines v
  where v.id = p_vitrine_id and v.status = 'active';
  if v_owner_id is null then
    raise exception 'vitrine_not_found' using errcode = 'P0001';
  end if;

  delete from public.order_snapshots o
  where o.owner_id = v_owner_id and o.code = p_code and o.expires_at <= now();

  insert into public.order_snapshots (owner_id, vitrine_id, code, payload)
  values (v_owner_id, p_vitrine_id, p_code, p_payload);
  return true;
exception
  when unique_violation then
    return false;
end;
$$;

revoke execute on function public.insert_order_snapshot(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.insert_order_snapshot(uuid, text, jsonb) to service_role;

create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, window_start)
);

-- Janela fixa: conta e responde se ainda está dentro do limite.
create function public.hit_rate_limit(p_key text, p_limit int, p_window_seconds int)
returns boolean
language sql
security definer
set search_path = ''
as $$
  insert into public.rate_limits as r (key, window_start, count)
  values (
    p_key,
    to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds),
    1
  )
  on conflict (key, window_start) do update set count = r.count + 1
  returning count <= p_limit;
$$;

revoke execute on function public.hit_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, int, int) to service_role;

alter table public.order_snapshots enable row level security;
alter table public.rate_limits enable row level security;

revoke all on public.order_snapshots from anon, authenticated;
grant select on public.order_snapshots to authenticated;
create policy "dono lê os próprios pedidos" on public.order_snapshots
  for select to authenticated using ((select auth.uid()) = owner_id);

revoke all on public.rate_limits from anon, authenticated;
