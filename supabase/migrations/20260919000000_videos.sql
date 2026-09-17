-- Vídeos: travas do plano, franquia mensal e limpezas diárias (spec 3, 4.1, 4.8 e 6.4)

create unique index media_bunny_video_id_key on public.media (bunny_video_id) where bunny_video_id is not null;

-- Trava do plano: vídeos de item por vitrine e por conta (banner em vídeo não conta).
create function public.enforce_video_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_per_vitrine int;
  v_per_account int;
begin
  if new.kind <> 'video' or new.role <> 'video' then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('videos:' || new.owner_id::text, 0));
  select p.max_videos_per_vitrine, p.max_videos_per_account
  into v_per_vitrine, v_per_account
  from public.plans p
  where p.id = public.effective_plan_id(new.owner_id);

  if (
    select count(*) from public.media m
    where m.vitrine_id = new.vitrine_id and m.role = 'video' and m.status <> 'failed'
  ) >= v_per_vitrine then
    raise exception 'plan_limit:videos_vitrine' using errcode = 'P0001', hint = v_per_vitrine::text;
  end if;

  if v_per_account is not null and (
    select count(*) from public.media m
    where m.owner_id = new.owner_id and m.role = 'video' and m.status <> 'failed'
  ) >= v_per_account then
    raise exception 'plan_limit:videos_account' using errcode = 'P0001', hint = v_per_account::text;
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_video_limits() from public, anon, authenticated;

create trigger media_enforce_video_limits
  before insert on public.media
  for each row execute function public.enforce_video_limits();

-- Franquia mensal de entrega de vídeo
create table public.video_usage_monthly (
  user_id uuid not null references auth.users (id) on delete cascade,
  month date not null,
  bytes_delivered bigint not null default 0 check (bytes_delivered >= 0),
  over_quota boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, month)
);

create trigger video_usage_monthly_set_updated_at
  before update on public.video_usage_monthly
  for each row execute function public.set_updated_at();

create function public.current_video_month()
returns date
language sql
stable
set search_path = ''
as $$
  select date_trunc('month', now() at time zone 'America/Sao_Paulo')::date;
$$;

-- Soma bytes entregues ao mês do dono do vídeo e diz se a franquia acabou de estourar.
create function public.add_video_usage(p_media_id uuid, p_bytes bigint)
returns table (usage_owner_id uuid, crossed_quota boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_limit bigint;
  v_before boolean;
  v_after boolean;
  v_month date := public.current_video_month();
  v_bytes bigint := greatest(coalesce(p_bytes, 0), 0);
begin
  select m.owner_id into v_owner
  from public.media m
  where m.id = p_media_id and m.kind = 'video' and m.status = 'ready';
  if v_owner is null then
    return;
  end if;

  select p.monthly_video_gb::bigint * 1073741824 into v_limit
  from public.plans p
  where p.id = public.effective_plan_id(v_owner);

  select u.over_quota into v_before
  from public.video_usage_monthly u
  where u.user_id = v_owner and u.month = v_month;

  insert into public.video_usage_monthly as u (user_id, month, bytes_delivered, over_quota)
  values (v_owner, v_month, v_bytes, v_bytes > v_limit)
  on conflict (user_id, month) do update
    set bytes_delivered = u.bytes_delivered + v_bytes,
        over_quota = u.bytes_delivered + v_bytes > v_limit
  returning u.over_quota into v_after;

  usage_owner_id := v_owner;
  crossed_quota := not coalesce(v_before, false) and v_after;
  return next;
end;
$$;

revoke execute on function public.add_video_usage(uuid, bigint) from public, anon, authenticated;
grant execute on function public.add_video_usage(uuid, bigint) to service_role;

create function public.is_over_video_quota(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select u.over_quota from public.video_usage_monthly u
     where u.user_id = p_user_id and u.month = public.current_video_month()),
    false
  );
$$;

revoke execute on function public.is_over_video_quota(uuid) from public, anon, authenticated;
grant execute on function public.is_over_video_quota(uuid) to service_role;

create function public.my_video_usage()
returns table (videos_count int, bytes_delivered bigint, over_quota boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*)::int from public.media m
     where m.owner_id = auth.uid() and m.role = 'video' and m.status <> 'failed'),
    coalesce((select u.bytes_delivered from public.video_usage_monthly u
              where u.user_id = auth.uid() and u.month = public.current_video_month()), 0),
    coalesce((select u.over_quota from public.video_usage_monthly u
              where u.user_id = auth.uid() and u.month = public.current_video_month()), false);
$$;

revoke execute on function public.my_video_usage() from public, anon;
grant execute on function public.my_video_usage() to authenticated;

-- Limpeza diária: falhas e processamentos parados há mais de 24 h, e mídias de item
-- nunca vinculadas (envios de item que não foi salvo).
create function public.media_cleanup_candidates(p_older_than interval default interval '24 hours')
returns table (id uuid, storage_paths jsonb, bunny_video_id text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.storage_paths, m.bunny_video_id
  from public.media m
  where (m.status = 'failed' and m.updated_at < now() - p_older_than)
     or (m.status = 'processing' and m.created_at < now() - p_older_than)
     or (m.item_id is null and m.role in ('cover', 'gallery', 'video') and m.created_at < now() - p_older_than);
$$;

revoke execute on function public.media_cleanup_candidates(interval) from public, anon, authenticated;
grant execute on function public.media_cleanup_candidates(interval) to service_role;

create function public.cleanup_expired_rows()
returns table (orders_deleted int, rate_limits_deleted int)
language plpgsql
security definer
set search_path = ''
as $$
begin
  with deleted as (
    delete from public.order_snapshots o where o.expires_at <= now() returning 1
  )
  select count(*)::int into orders_deleted from deleted;

  with deleted as (
    delete from public.rate_limits r where r.window_start < now() - interval '2 days' returning 1
  )
  select count(*)::int into rate_limits_deleted from deleted;

  return next;
end;
$$;

revoke execute on function public.cleanup_expired_rows() from public, anon, authenticated;
grant execute on function public.cleanup_expired_rows() to service_role;

-- Virada do mês: vitrines de quem estourou no mês anterior precisam voltar a mostrar vídeos.
create function public.subdomains_over_quota_last_month()
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select v.subdomain
  from public.vitrines v
  join public.video_usage_monthly u on u.user_id = v.owner_id
  where u.over_quota
    and u.month = (public.current_video_month() - interval '1 month')::date;
$$;

revoke execute on function public.subdomains_over_quota_last_month() from public, anon, authenticated;
grant execute on function public.subdomains_over_quota_last_month() to service_role;

alter table public.video_usage_monthly enable row level security;
revoke all on public.video_usage_monthly from anon, authenticated;
grant select on public.video_usage_monthly to authenticated;
create policy "dono lê o próprio consumo de vídeo" on public.video_usage_monthly
  for select to authenticated using ((select auth.uid()) = user_id);
