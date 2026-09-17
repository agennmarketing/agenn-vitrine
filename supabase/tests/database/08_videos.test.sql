begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000003c1', 'livre@videos.com'),
  ('00000000-0000-0000-0000-0000000003c2', 'pro@videos.com');
insert into public.subscriptions (user_id, plan_id, status) values
  ('00000000-0000-0000-0000-0000000003c2', 'pro', 'active');

insert into public.vitrines (id, owner_id, type, subdomain, name, default_button_text) values
  ('00000000-0000-0000-0000-00000000f301', '00000000-0000-0000-0000-0000000003c1', 'produtos', 'videos-livre', 'Livre', 'Solicitar orçamento'),
  ('00000000-0000-0000-0000-00000000f302', '00000000-0000-0000-0000-0000000003c2', 'produtos', 'videos-pro-1', 'Pro 1', 'Solicitar orçamento'),
  ('00000000-0000-0000-0000-00000000f303', '00000000-0000-0000-0000-0000000003c2', 'produtos', 'videos-pro-2', 'Pro 2', 'Solicitar orçamento');
insert into public.categories (id, owner_id, vitrine_id, name) values
  ('00000000-0000-0000-0000-00000000c301', '00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-00000000f301', 'Geral'),
  ('00000000-0000-0000-0000-00000000c302', '00000000-0000-0000-0000-0000000003c2', '00000000-0000-0000-0000-00000000f302', 'Geral');
insert into public.items (id, owner_id, vitrine_id, category_id, name, price_cents) values
  ('00000000-0000-0000-0000-00000000e301', '00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-00000000f301', '00000000-0000-0000-0000-00000000c301', 'A', 100),
  ('00000000-0000-0000-0000-00000000e302', '00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-00000000f301', '00000000-0000-0000-0000-00000000c301', 'B', 100),
  ('00000000-0000-0000-0000-00000000e303', '00000000-0000-0000-0000-0000000003c2', '00000000-0000-0000-0000-00000000f302', '00000000-0000-0000-0000-00000000c302', 'C', 100),
  ('00000000-0000-0000-0000-00000000e304', '00000000-0000-0000-0000-0000000003c2', '00000000-0000-0000-0000-00000000f302', '00000000-0000-0000-0000-00000000c302', 'D', 100);

-- Gratuito: 1 vídeo
insert into public.media (id, owner_id, vitrine_id, item_id, role, kind, status, bunny_video_id) values
  ('00000000-0000-0000-0000-00000000d301', '00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-00000000f301', '00000000-0000-0000-0000-00000000e301', 'video', 'video', 'ready', 'guid-livre-1');
select throws_ok(
  $$ insert into public.media (owner_id, vitrine_id, item_id, role, kind, status, bunny_video_id) values ('00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-00000000f301', '00000000-0000-0000-0000-00000000e302', 'video', 'video', 'processing', 'guid-livre-2') $$,
  'P0001', 'plan_limit:videos_vitrine', 'gratuito não passa de 1 vídeo'
);

update public.media set status = 'failed' where id = '00000000-0000-0000-0000-00000000d301';
select lives_ok(
  $$ insert into public.media (owner_id, vitrine_id, item_id, role, kind, status, bunny_video_id) values ('00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-00000000f301', '00000000-0000-0000-0000-00000000e302', 'video', 'video', 'processing', 'guid-livre-3') $$,
  'vídeo com falha não conta no limite'
);
select throws_ok(
  $$ insert into public.media (owner_id, vitrine_id, item_id, role, kind, status, bunny_video_id) values ('00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-00000000f301', null, 'banner', 'video', 'processing', 'guid-livre-3') $$,
  '23505', null, 'bunny_video_id é único'
);
select lives_ok(
  $$ insert into public.media (owner_id, vitrine_id, item_id, role, kind, status, bunny_video_id) values ('00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-00000000f301', null, 'banner', 'video', 'processing', 'guid-livre-banner') $$,
  'banner em vídeo não conta no limite de vídeos de item'
);

-- Pro: vários vídeos e em mais de uma vitrine
insert into public.media (owner_id, vitrine_id, item_id, role, kind, status, bunny_video_id) values
  ('00000000-0000-0000-0000-0000000003c2', '00000000-0000-0000-0000-00000000f302', '00000000-0000-0000-0000-00000000e303', 'video', 'video', 'ready', 'guid-pro-1');
select lives_ok(
  $$ insert into public.media (owner_id, vitrine_id, item_id, role, kind, status, bunny_video_id) values ('00000000-0000-0000-0000-0000000003c2', '00000000-0000-0000-0000-00000000f302', '00000000-0000-0000-0000-00000000e304', 'video', 'video', 'ready', 'guid-pro-2') $$,
  'Pro envia mais de um vídeo'
);

-- Franquia
select is(public.current_video_month(), date_trunc('month', now() at time zone 'America/Sao_Paulo')::date, 'mês em São Paulo');

set local role service_role;
select is(
  (select crossed_quota from public.add_video_usage('00000000-0000-0000-0000-00000000d301', 1000)),
  null,
  'vídeo que não está pronto não soma'
);
select is(
  (select crossed_quota from public.add_video_usage((select id from public.media where bunny_video_id = 'guid-pro-1'), 1000)),
  false,
  'primeira soma não estoura'
);
select is(
  (select crossed_quota from public.add_video_usage((select id from public.media where bunny_video_id = 'guid-pro-1'), 1099511627776)),
  true,
  'passar de 1024 GB estoura e avisa'
);
select is(
  (select crossed_quota from public.add_video_usage((select id from public.media where bunny_video_id = 'guid-pro-1'), 10)),
  false,
  'depois de estourado não avisa de novo'
);
select is(public.is_over_video_quota('00000000-0000-0000-0000-0000000003c2'), true, 'is_over_video_quota');
select is(
  (select bytes_delivered from public.video_usage_monthly where user_id = '00000000-0000-0000-0000-0000000003c2'),
  1099511628786::bigint,
  'bytes somados'
);

-- Limpezas
reset role;
insert into public.media (owner_id, vitrine_id, item_id, role, kind, status, storage_paths, created_at, updated_at) values
  ('00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-00000000f301', null, 'cover', 'image', 'ready', '{"480":"velha"}', now() - interval '2 days', now() - interval '2 days'),
  ('00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-00000000f301', null, 'cover', 'image', 'ready', '{"480":"nova"}', now(), now());
-- O trigger set_updated_at sobrescreveria a data; desligado só nesta atualização.
alter table public.media disable trigger media_set_updated_at;
update public.media set updated_at = now() - interval '2 days' where bunny_video_id = 'guid-livre-1';
alter table public.media enable trigger media_set_updated_at;
insert into public.order_snapshots (owner_id, vitrine_id, code, payload, expires_at) values
  ('00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-00000000f301', 'AB23', '{}', now() - interval '1 day');
insert into public.rate_limits (key, window_start, count) values ('antigo', now() - interval '3 days', 1);
insert into public.video_usage_monthly (user_id, month, bytes_delivered, over_quota) values
  ('00000000-0000-0000-0000-0000000003c1', (public.current_video_month() - interval '1 month')::date, 5, true);

set local role service_role;
select ok(
  exists (select 1 from public.media_cleanup_candidates() c where c.storage_paths ->> '480' = 'velha'),
  'capa nunca vinculada há mais de 24 h é candidata'
);
select ok(
  not exists (select 1 from public.media_cleanup_candidates() c where c.storage_paths ->> '480' = 'nova'),
  'envio recente não é candidato'
);
select ok(
  exists (select 1 from public.media_cleanup_candidates() c where c.bunny_video_id = 'guid-livre-1'),
  'vídeo com falha antiga é candidato'
);
select results_eq(
  $$ select orders_deleted, rate_limits_deleted from public.cleanup_expired_rows() $$,
  $$ values (1, 1) $$,
  'apaga pedido expirado e limite antigo'
);
select ok(
  'videos-livre' in (select public.subdomains_over_quota_last_month()),
  'lista vitrines de quem estourou no mês anterior'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000003c2","role":"authenticated"}', true);
select is((select videos_count from public.my_video_usage()), 2, 'my_video_usage conta os vídeos do dono');

select * from finish();
rollback;
