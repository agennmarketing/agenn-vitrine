-- Assinatura Pro: eventos do Stripe, congelamento das vitrines e regra dos 90 dias
-- (spec 4.1, 4.7, 4.8, 6.4, 8.7 e 9)

-- Garante que cada evento do Stripe seja processado uma vez só (spec 4.1).
create table public.stripe_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);

alter table public.stripe_events enable row level security;
revoke all on public.stripe_events from anon, authenticated;

create index subscriptions_pro_ended_idx on public.subscriptions (pro_ended_at)
  where pro_ended_at is not null;

-- Congelamento (spec 4.7 e 8.7): ficam ativas as primeiras `max_vitrines` vitrines
-- na ordem do painel; `p_keep_id` é a escolha do dono. Devolve todos os subdomínios
-- porque qualquer mudança de plano muda a página gerada (marca d'água, logo, cor,
-- 10 itens e 1 vídeo do gratuito).
create function public.sync_vitrine_status(p_user_id uuid, p_keep_id uuid default null)
returns setof text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max int;
begin
  select p.max_vitrines into v_max
  from public.plans p
  where p.id = public.effective_plan_id(p_user_id);

  with ordenadas as (
    select
      v.id,
      case
        when row_number() over (
          order by coalesce(v.id = p_keep_id, false) desc, v.position, v.created_at
        ) <= v_max then 'active'
        else 'frozen'
      end as novo_status
    from public.vitrines v
    where v.owner_id = p_user_id
  )
  update public.vitrines v
  set status = o.novo_status
  from ordenadas o
  where v.id = o.id
    and v.status is distinct from o.novo_status;

  return query select v.subdomain from public.vitrines v where v.owner_id = p_user_id;
end;
$$;

revoke execute on function public.sync_vitrine_status(uuid, uuid) from public, anon, authenticated;
grant execute on function public.sync_vitrine_status(uuid, uuid) to service_role;

-- Escolha do dono quando a conta volta ao gratuito com mais de uma vitrine (spec 8.7).
create function public.choose_active_vitrine(p_vitrine_id uuid)
returns setof text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  select v.owner_id into v_owner from public.vitrines v where v.id = p_vitrine_id;
  if v_owner is null or v_owner is distinct from auth.uid() then
    raise exception 'vitrine_not_found' using errcode = 'P0001';
  end if;
  return query select public.sync_vitrine_status(v_owner, p_vitrine_id);
end;
$$;

revoke execute on function public.choose_active_vitrine(uuid) from public, anon;
grant execute on function public.choose_active_vitrine(uuid) to authenticated;

-- Contas que saíram do Pro numa janela de dias e continuam no gratuito (spec 6.4).
create function public.users_pro_ended_between(p_from_days int, p_to_days int default null)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.user_id
  from public.subscriptions s
  where s.pro_ended_at is not null
    and s.pro_ended_at <= now() - make_interval(days => p_from_days)
    and (p_to_days is null or s.pro_ended_at > now() - make_interval(days => p_to_days))
    and public.effective_plan_id(s.user_id) = 'free';
$$;

revoke execute on function public.users_pro_ended_between(int, int) from public, anon, authenticated;

-- Vídeos que passam do limite do gratuito, na mesma ordem em que a vitrine os
-- mostraria (spec 4.7): o primeiro fica, o resto é candidato à limpeza.
create function public.excess_video_media(p_user_ids uuid[])
returns table (id uuid, owner_id uuid, subdomain text, storage_paths jsonb, bunny_video_id text)
language sql
stable
security definer
set search_path = ''
as $$
  with ranked as (
    select
      m.id,
      m.owner_id,
      v.subdomain,
      m.storage_paths,
      m.bunny_video_id,
      row_number() over (
        partition by m.owner_id
        order by v.position, v.created_at, c.position nulls last, i.position, i.created_at
      ) as ordem
    from public.media m
    join public.items i on i.id = m.item_id and i.deleted_at is null
    join public.vitrines v on v.id = m.vitrine_id
    left join public.categories c on c.id = i.category_id
    where m.owner_id = any (p_user_ids)
      and m.role = 'video'
  )
  select r.id, r.owner_id, r.subdomain, r.storage_paths, r.bunny_video_id
  from ranked r
  where r.ordem > (
    select coalesce(p.max_videos_per_account, 2147483647) from public.plans p where p.id = 'free'
  );
$$;

revoke execute on function public.excess_video_media(uuid[]) from public, anon, authenticated;

create function public.videos_to_delete_after_pro(p_days int default 90)
returns table (id uuid, owner_id uuid, subdomain text, storage_paths jsonb, bunny_video_id text)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.owner_id, e.subdomain, e.storage_paths, e.bunny_video_id
  from public.excess_video_media(array(select u from public.users_pro_ended_between(p_days) u)) e;
$$;

revoke execute on function public.videos_to_delete_after_pro(int) from public, anon, authenticated;
grant execute on function public.videos_to_delete_after_pro(int) to service_role;

-- Aviso do dia 83: janela de um dia, para sair uma vez por conta (spec 6.4).
create function public.accounts_to_warn_video_cleanup(p_warn_days int default 83)
returns table (user_id uuid, videos_to_delete int, pro_ended_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.user_id, count(e.id)::int, s.pro_ended_at
  from public.subscriptions s
  join public.excess_video_media(
    array(select u from public.users_pro_ended_between(p_warn_days, p_warn_days + 1) u)
  ) e on e.owner_id = s.user_id
  group by s.user_id, s.pro_ended_at;
$$;

revoke execute on function public.accounts_to_warn_video_cleanup(int) from public, anon, authenticated;
grant execute on function public.accounts_to_warn_video_cleanup(int) to service_role;
