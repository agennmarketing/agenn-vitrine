begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'sessao@teste.com');
insert into auth.sessions (id, user_id) values
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-0000000000e1');

set local role authenticated;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e1","session_id":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
select is(public.session_state(), 'current', 'sessão existente sem sessão ativa marcada = current');

select public.claim_session();
select is(public.session_state(), 'current', 'sessão que é a ativa = current');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e1","session_id":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
select is(public.session_state(), 'revoked', 'session_id fora de auth.sessions = revoked');

reset role;
insert into auth.sessions (id, user_id) values
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-0000000000e1');
set local role authenticated;
select is(public.session_state(), 'replaced', 'sessão válida mas não ativa = replaced');

reset role;
set local role anon;
select throws_ok($$ select public.session_state() $$, '42501', null, 'visitante não chama session_state');

select * from finish();
rollback;
