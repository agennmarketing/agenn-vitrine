-- Plano único: Essencial (R$ 79,90/mês), com 7 dias de teste grátis sem cartão.
-- Sai o Gratuito e sai o Pro. Quem não assinou e passou do teste fica sem acesso:
-- painel travado e vitrine fora do ar, mas nada é apagado; ao assinar, tudo volta.

-- Planos: 'essencial' herda os limites do antigo Pro; 'bloqueado' é o estado sem
-- acesso (limites zerados), nunca oferecido como plano.
insert into public.plans (
  id, name, max_vitrines, max_items_per_vitrine, max_videos_per_vitrine, max_videos_per_account,
  max_video_seconds, max_video_upload_mb, monthly_video_gb, allow_branding, show_watermark
)
select 'essencial', 'Essencial', 1, p.max_items_per_vitrine, p.max_videos_per_vitrine, p.max_videos_per_account,
  p.max_video_seconds, p.max_video_upload_mb, p.monthly_video_gb, true, false
from public.plans p
where p.id = 'pro';

insert into public.plans (
  id, name, max_vitrines, max_items_per_vitrine, max_videos_per_vitrine, max_videos_per_account,
  max_video_seconds, max_video_upload_mb, monthly_video_gb, allow_branding, show_watermark
)
select 'bloqueado', 'Sem acesso', 0, 0, 0, 0, p.max_video_seconds, p.max_video_upload_mb, 0, false, false
from public.plans p
where p.id = 'pro';

alter table public.subscriptions alter column plan_id set default 'essencial';
update public.subscriptions set plan_id = 'essencial' where plan_id <> 'essencial';

-- A limpeza dos vídeos 90 dias depois do fim do Pro sai: os dados ficam guardados.
drop function public.accounts_to_warn_video_cleanup(int);
drop function public.videos_to_delete_after_pro(int);
drop function public.excess_video_media(uuid[]);
drop function public.users_pro_ended_between(int, int);
drop function public.choose_active_vitrine(uuid);
drop index public.subscriptions_pro_ended_idx;

delete from public.plans where id in ('free', 'pro');

-- Teste grátis e situação da assinatura.
alter table public.subscriptions
  add column trial_started_at timestamptz default now(),
  add column trial_ends_at timestamptz default now() + interval '7 days',
  add column subscription_status text not null default 'trialing'
    check (subscription_status in ('trialing', 'active', 'expired', 'canceled'));

-- Quem já pagava continua ativo, sem teste. Os demais ganham 7 dias a partir de agora.
update public.subscriptions s
set subscription_status = 'active', trial_started_at = null, trial_ends_at = null
where s.status in ('active', 'trialing')
   or (s.status = 'past_due' and s.grace_until > now());

insert into public.subscriptions (user_id)
select u.id from auth.users u
where not exists (select 1 from public.subscriptions s where s.user_id = u.id);

-- Plano efetivo: assinatura em dia (ou na carência do cartão) ou teste ainda valendo.
create or replace function public.effective_plan_id(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1
      from public.subscriptions s
      where s.user_id = p_user_id
        and (
          s.status in ('active', 'trialing')
          or (s.status = 'past_due' and s.grace_until > now())
          or s.trial_ends_at > now()
        )
    ) then 'essencial'
    else 'bloqueado'
  end;
$$;

-- Toda conta nova começa o teste na hora, sem cartão.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', ''), 80)
  );
  insert into public.subscriptions (user_id, trial_started_at, trial_ends_at, subscription_status)
  values (new.id, now(), now() + interval '7 days', 'trialing')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Fim do teste sem assinatura: marca 'expired' e tira a vitrine do ar (sem apagar nada).
-- Sem `p_user_id`, passa por todas as contas (tarefa diária). Devolve os subdomínios
-- para revalidar.
create function public.expire_trials(p_user_id uuid default null)
returns setof text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  update public.subscriptions s
  set subscription_status = 'expired'
  where s.subscription_status = 'trialing'
    and s.trial_ends_at <= now()
    and (p_user_id is null or s.user_id = p_user_id)
    and public.effective_plan_id(s.user_id) = 'bloqueado';

  for v_owner in
    select distinct v.owner_id
    from public.vitrines v
    where v.status = 'active'
      and (p_user_id is null or v.owner_id = p_user_id)
      and public.effective_plan_id(v.owner_id) = 'bloqueado'
  loop
    return query select public.sync_vitrine_status(v_owner);
  end loop;
end;
$$;

revoke execute on function public.expire_trials(uuid) from public, anon, authenticated;
grant execute on function public.expire_trials(uuid) to service_role;

-- Sem acesso, a vitrine não recebe agendamentos, mesmo antes de a tarefa diária congelá-la.
create function public.appointments_require_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.effective_plan_id(new.owner_id) <> 'essencial' then
    raise exception 'vitrine_not_found' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function public.appointments_require_access() from public, anon, authenticated;

create trigger appointments_require_access
  before insert on public.appointments
  for each row execute function public.appointments_require_access();
