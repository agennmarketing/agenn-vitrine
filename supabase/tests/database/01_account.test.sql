begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@teste.com', '{"name":"Ana"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bia@teste.com', '{"full_name":"Bia Google"}'),
  ('00000000-0000-0000-0000-00000000000c', 'caio@teste.com', '{}');

select is((select name from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 'Ana', 'profile usa name do cadastro');
select is((select name from public.profiles where id = '00000000-0000-0000-0000-00000000000b'), 'Bia Google', 'profile usa full_name do Google');
select is((select name from public.profiles where id = '00000000-0000-0000-0000-00000000000c'), '', 'profile sem nome fica vazio');

-- Toda conta nova começa o teste grátis de 7 dias, sem cartão.
select is(
  (select subscription_status from public.subscriptions where user_id = '00000000-0000-0000-0000-00000000000a'),
  'trialing',
  'conta nova começa em teste'
);
select is(
  (select trial_ends_at - trial_started_at from public.subscriptions where user_id = '00000000-0000-0000-0000-00000000000a'),
  interval '7 days',
  'o teste dura 7 dias'
);
select is(public.effective_plan_id('00000000-0000-0000-0000-00000000000a'), 'essencial', 'teste valendo = essencial');

update public.subscriptions set trial_ends_at = now() - interval '1 minute';
select is(public.effective_plan_id('00000000-0000-0000-0000-00000000000a'), 'bloqueado', 'teste vencido sem assinatura = bloqueado');

update public.subscriptions set status = 'active' where user_id = '00000000-0000-0000-0000-00000000000a';
update public.subscriptions set status = 'past_due', grace_until = now() + interval '2 days'
where user_id = '00000000-0000-0000-0000-00000000000b';
update public.subscriptions set status = 'past_due', grace_until = now() - interval '1 day'
where user_id = '00000000-0000-0000-0000-00000000000c';

select is(public.effective_plan_id('00000000-0000-0000-0000-00000000000a'), 'essencial', 'assinatura ativa = essencial');
select is(public.effective_plan_id('00000000-0000-0000-0000-00000000000b'), 'essencial', 'past_due dentro da carência = essencial');
select is(public.effective_plan_id('00000000-0000-0000-0000-00000000000c'), 'bloqueado', 'past_due fora da carência = bloqueado');
select is(public.effective_plan_id('00000000-0000-0000-0000-0000000000ff'), 'bloqueado', 'sem assinatura = bloqueado');

set local role anon;
select is((select count(*)::int from public.plans), 2, 'visitante lê os planos');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","session_id":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select is((select count(*)::int from public.profiles), 1, 'usuário vê só o próprio profile');
select is((select count(*)::int from public.subscriptions), 1, 'usuário vê só a própria assinatura');
select lives_ok($$ update public.profiles set name = 'Ana Maria' where id = '00000000-0000-0000-0000-00000000000a' $$, 'usuário altera o próprio nome');
select throws_ok($$ update public.profiles set active_session_id = gen_random_uuid() where id = '00000000-0000-0000-0000-00000000000a' $$, '42501', null, 'usuário não altera active_session_id direto');
select throws_ok($$ insert into public.subscriptions (user_id, plan_id, status) values ('00000000-0000-0000-0000-00000000000a', 'essencial', 'active') $$, '42501', null, 'usuário não grava assinatura');
select lives_ok($$ select public.claim_session() $$, 'claim_session executa');
select is((select active_session_id::text from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), '11111111-1111-1111-1111-111111111111', 'claim_session grava a sessão do JWT');
select is((select (public.my_entitlements()).id), 'essencial', 'my_entitlements retorna o plano efetivo');
select throws_ok($$ select public.effective_plan_id('00000000-0000-0000-0000-00000000000b') $$, '42501', null, 'effective_plan_id não é exposto ao usuário');

select * from finish();
rollback;
