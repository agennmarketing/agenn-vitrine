begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- As vitrines e os vídeos nascem com a conta no Pro: as travas de plano valem em
-- qualquer papel, inclusive aqui.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000005c1', 'expirou@plano.com'),
  ('00000000-0000-0000-0000-0000000005c2', 'assinante@plano.com');
insert into public.subscriptions (user_id, plan_id, status) values
  ('00000000-0000-0000-0000-0000000005c1', 'pro', 'active'),
  ('00000000-0000-0000-0000-0000000005c2', 'pro', 'active');

insert into public.vitrines (id, owner_id, type, subdomain, name, default_button_text, position) values
  ('00000000-0000-0000-0000-00000000f501', '00000000-0000-0000-0000-0000000005c1', 'produtos', 'plano-um', 'Primeira', 'Solicitar orçamento', 0),
  ('00000000-0000-0000-0000-00000000f502', '00000000-0000-0000-0000-0000000005c1', 'produtos', 'plano-dois', 'Segunda', 'Solicitar orçamento', 1),
  ('00000000-0000-0000-0000-00000000f503', '00000000-0000-0000-0000-0000000005c1', 'produtos', 'plano-tres', 'Terceira', 'Solicitar orçamento', 2),
  ('00000000-0000-0000-0000-00000000f504', '00000000-0000-0000-0000-0000000005c2', 'produtos', 'plano-assinante', 'Do assinante', 'Solicitar orçamento', 0);

insert into public.categories (id, owner_id, vitrine_id, name) values
  ('00000000-0000-0000-0000-00000000c501', '00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-00000000f501', 'Geral'),
  ('00000000-0000-0000-0000-00000000c502', '00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-00000000f502', 'Geral');

insert into public.items (id, owner_id, vitrine_id, category_id, name, price_cents) values
  ('00000000-0000-0000-0000-00000000e501', '00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-00000000f501', '00000000-0000-0000-0000-00000000c501', 'A', 100),
  ('00000000-0000-0000-0000-00000000e502', '00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-00000000f502', '00000000-0000-0000-0000-00000000c502', 'B', 100),
  ('00000000-0000-0000-0000-00000000e503', '00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-00000000f502', '00000000-0000-0000-0000-00000000c502', 'C', 100);

insert into public.media (id, owner_id, vitrine_id, item_id, role, kind, status, bunny_video_id) values
  ('00000000-0000-0000-0000-00000000d501', '00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-00000000f501', '00000000-0000-0000-0000-00000000e501', 'video', 'video', 'ready', 'guid-plano-1'),
  ('00000000-0000-0000-0000-00000000d502', '00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-00000000f502', '00000000-0000-0000-0000-00000000e502', 'video', 'video', 'ready', 'guid-plano-2'),
  ('00000000-0000-0000-0000-00000000d503', '00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-00000000f502', '00000000-0000-0000-0000-00000000e503', 'video', 'video', 'ready', 'guid-plano-3');

-- A conta saiu do Pro há 100 dias.
update public.subscriptions
set status = 'canceled', pro_ended_at = now() - interval '100 days'
where user_id = '00000000-0000-0000-0000-0000000005c1';

select is(public.effective_plan_id('00000000-0000-0000-0000-0000000005c1'), 'free', 'assinatura cancelada volta ao gratuito');

select lives_ok(
  $$ select public.sync_vitrine_status('00000000-0000-0000-0000-0000000005c1') $$,
  'congela o que passa do limite do plano'
);
select results_eq(
  $$ select subdomain from public.vitrines where owner_id = '00000000-0000-0000-0000-0000000005c1' and status = 'active' $$,
  $$ values ('plano-um'::text) $$,
  'no gratuito fica só a primeira vitrine'
);
select is(
  (select count(*)::int from public.vitrines where owner_id = '00000000-0000-0000-0000-0000000005c1' and status = 'frozen'),
  2,
  'as outras ficam congeladas'
);
select set_eq(
  $$ select public.sync_vitrine_status('00000000-0000-0000-0000-0000000005c1') $$,
  $$ values ('plano-um'::text), ('plano-dois'::text), ('plano-tres'::text) $$,
  'devolve todos os subdomínios do dono para revalidar'
);

select lives_ok(
  $$ select public.sync_vitrine_status('00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-00000000f503') $$,
  'aceita a escolha do dono'
);
select results_eq(
  $$ select subdomain from public.vitrines where owner_id = '00000000-0000-0000-0000-0000000005c1' and status = 'active' $$,
  $$ values ('plano-tres'::text) $$,
  'a vitrine escolhida fica no lugar da mais antiga'
);

update public.subscriptions set status = 'active', pro_ended_at = null
where user_id = '00000000-0000-0000-0000-0000000005c1';
select lives_ok(
  $$ select public.sync_vitrine_status('00000000-0000-0000-0000-0000000005c1') $$,
  'roda de novo ao voltar para o Pro'
);
select is(
  (select count(*)::int from public.vitrines where owner_id = '00000000-0000-0000-0000-0000000005c1' and status = 'active'),
  3,
  'no Pro todas as vitrines voltam a ativas'
);

update public.subscriptions set status = 'canceled', pro_ended_at = now() - interval '100 days'
where user_id = '00000000-0000-0000-0000-0000000005c1';

set local role service_role;
select set_eq(
  $$ select bunny_video_id from public.videos_to_delete_after_pro(90) $$,
  $$ values ('guid-plano-2'::text), ('guid-plano-3'::text) $$,
  'apaga só os vídeos que passam do limite do gratuito'
);
select is(
  (select count(*)::int from public.videos_to_delete_after_pro(120)),
  0,
  'quem saiu do Pro há 100 dias ainda não entra na janela de 120'
);
select is(
  (select count(*)::int from public.videos_to_delete_after_pro(90) where owner_id = '00000000-0000-0000-0000-0000000005c2'),
  0,
  'assinante ativo não perde vídeos'
);
select is(
  (select count(*)::int from public.accounts_to_warn_video_cleanup(83)),
  0,
  'fora da janela do dia 83 não avisa'
);

reset role;
update public.subscriptions set pro_ended_at = now() - interval '83 days' - interval '2 hours'
where user_id = '00000000-0000-0000-0000-0000000005c1';
set local role service_role;
select results_eq(
  $$ select user_id, videos_to_delete from public.accounts_to_warn_video_cleanup(83) $$,
  $$ values ('00000000-0000-0000-0000-0000000005c1'::uuid, 2) $$,
  'avisa no dia 83 com a quantidade de vídeos'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000005c1","role":"authenticated"}', true);
select throws_ok(
  $$ select 1 from public.stripe_events $$,
  '42501', null, 'stripe_events não é exposta ao dono'
);
select throws_ok(
  $$ select public.sync_vitrine_status('00000000-0000-0000-0000-0000000005c1') $$,
  '42501', null, 'sync_vitrine_status não é exposta ao dono'
);
select throws_ok(
  $$ select public.videos_to_delete_after_pro(90) $$,
  '42501', null, 'a limpeza dos 90 dias não é exposta ao dono'
);
select lives_ok(
  $$ select public.choose_active_vitrine('00000000-0000-0000-0000-00000000f502') $$,
  'o dono escolhe qual vitrine fica ativa'
);
select results_eq(
  $$ select subdomain from public.vitrines where owner_id = '00000000-0000-0000-0000-0000000005c1' and status = 'active' $$,
  $$ values ('plano-dois'::text) $$,
  'a escolha do dono vale'
);
select throws_ok(
  $$ select public.choose_active_vitrine('00000000-0000-0000-0000-00000000f504') $$,
  'P0001', 'vitrine_not_found', 'ninguém escolhe a vitrine de outro dono'
);

select * from finish();
rollback;
