begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000d1', 'livre@teste.com', '{"name":"Livre"}');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","session_id":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is((select (public.my_entitlements()).id), 'free', 'conta sem assinatura recebe o gratuito');
select is((select (public.my_entitlements()).max_vitrines), 1, 'gratuito permite 1 vitrine');
select is((select (public.my_entitlements()).show_watermark), true, 'gratuito mostra marca d''água');

reset role;
set local role anon;
select throws_ok($$ select * from public.profiles $$, '42501', null, 'visitante não lê perfis');
select throws_ok($$ select * from public.subscriptions $$, '42501', null, 'visitante não lê assinaturas');
select throws_ok($$ select public.my_entitlements() $$, '42501', null, 'visitante não chama my_entitlements');
select throws_ok($$ select public.claim_session() $$, '42501', null, 'visitante não chama claim_session');

select * from finish();
rollback;
