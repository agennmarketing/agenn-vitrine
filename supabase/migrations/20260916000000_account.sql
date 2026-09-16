-- Conta: planos, perfis e assinaturas

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Planos: todos os limites vivem aqui (spec seção 3)
create table public.plans (
  id text primary key,
  name text not null,
  max_vitrines int not null,
  max_items_per_vitrine int not null,
  max_videos_per_vitrine int not null,
  max_videos_per_account int,
  max_video_seconds int not null,
  max_video_upload_mb int not null,
  monthly_video_gb int not null,
  allow_branding boolean not null,
  show_watermark boolean not null
);

insert into public.plans values
  ('free', 'Gratuito', 1, 10, 1, 1, 60, 500, 1024, false, true),
  ('pro', 'Pro', 3, 300, 50, null, 60, 500, 1024, true, false);

-- Perfis
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  active_session_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Assinaturas (escritas só pelo servidor)
create table public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  plan_id text not null default 'free' references public.plans (id),
  status text not null default 'none',
  interval text check (interval in ('month', 'year')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  grace_until timestamptz,
  pro_ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- Plano efetivo (uso interno: triggers e servidor)
create function public.effective_plan_id(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select case
        when s.status in ('active', 'trialing') then s.plan_id
        when s.status = 'past_due' and s.grace_until > now() then s.plan_id
      end
      from public.subscriptions s
      where s.user_id = p_user_id
    ),
    'free'
  );
$$;

revoke execute on function public.effective_plan_id(uuid) from public, anon, authenticated;

-- Limites do usuário logado
create function public.my_entitlements()
returns public.plans
language sql
stable
security definer
set search_path = ''
as $$
  select p.* from public.plans p where p.id = public.effective_plan_id(auth.uid());
$$;

revoke execute on function public.my_entitlements() from public, anon;
grant execute on function public.my_entitlements() to authenticated;

-- Sessão única: grava a sessão do JWT atual como a ativa
create function public.claim_session()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles
  set active_session_id = (auth.jwt() ->> 'session_id')::uuid
  where id = auth.uid();
$$;

revoke execute on function public.claim_session() from public, anon;
grant execute on function public.claim_session() to authenticated;

-- RLS e privilégios
alter table public.plans enable row level security;
alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;

revoke all on public.plans from anon, authenticated;
grant select on public.plans to anon, authenticated;
create policy "planos são públicos" on public.plans
  for select to anon, authenticated using (true);

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (name) on public.profiles to authenticated;
create policy "dono lê o próprio perfil" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "dono altera o próprio perfil" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

revoke all on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;
create policy "dono lê a própria assinatura" on public.subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);
