begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000d1', 'longo@teste.com', jsonb_build_object('full_name', repeat('a', 200))),
  ('00000000-0000-0000-0000-0000000000d2', 'outro@teste.com', '{"name":"Outro"}');

select is(
  (select char_length(name) from public.profiles where id = '00000000-0000-0000-0000-0000000000d1'),
  80,
  'nome longo do cadastro é cortado em 80 caracteres'
);

select lives_ok(
  $$ update public.profiles set name = repeat('b', 80) where id = '00000000-0000-0000-0000-0000000000d1' $$,
  'nome com 80 caracteres é aceito'
);
select throws_ok(
  $$ update public.profiles set name = repeat('b', 81) where id = '00000000-0000-0000-0000-0000000000d1' $$,
  '23514',
  null,
  'nome com 81 caracteres é recusado'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';

select lives_ok(
  $$ update public.profiles set name = 'Invasor' where id = '00000000-0000-0000-0000-0000000000d2' $$,
  'update no perfil de outro usuário não gera erro'
);
select is(
  (select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-0000000000d2'),
  0,
  'usuário não enxerga o perfil de outro'
);

reset role;
select is(
  (select name from public.profiles where id = '00000000-0000-0000-0000-0000000000d2'),
  'Outro',
  'nome de outro usuário continua igual (0 linhas afetadas)'
);

select * from finish();
rollback;
