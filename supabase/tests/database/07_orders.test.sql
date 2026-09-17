begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000002b1', 'dono@pedidos.com'),
  ('00000000-0000-0000-0000-0000000002b2', 'outro@pedidos.com');
insert into public.vitrines (id, owner_id, type, subdomain, name, default_button_text) values
  ('00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-0000000002b1', 'produtos', 'pedidos-dono', 'Dono', 'Solicitar orçamento');

set local role service_role;

select is(public.insert_order_snapshot('00000000-0000-0000-0000-00000000b001', 'K7F2', '{"items":[]}'), true, 'grava o pedido');
select is(public.insert_order_snapshot('00000000-0000-0000-0000-00000000b001', 'K7F2', '{"items":[]}'), false, 'código em uso devolve false');

reset role;
update public.order_snapshots set expires_at = now() - interval '1 day' where code = 'K7F2';
set local role service_role;
select is(public.insert_order_snapshot('00000000-0000-0000-0000-00000000b001', 'K7F2', '{"items":[]}'), true, 'código expirado é reaproveitado');

select throws_ok(
  $$ select public.insert_order_snapshot('00000000-0000-0000-0000-00000000b001', 'K0F2', '{"items":[]}') $$,
  '23514', null, 'código com caractere ambíguo é recusado'
);

select is(public.hit_rate_limit('ip:teste', 2, 3600), true, '1ª requisição');
select is(public.hit_rate_limit('ip:teste', 2, 3600), true, '2ª requisição');
select is(public.hit_rate_limit('ip:teste', 2, 3600), false, '3ª passa do limite');

reset role;
update public.vitrines set status = 'frozen' where id = '00000000-0000-0000-0000-00000000b001';
set local role service_role;
select throws_ok(
  $$ select public.insert_order_snapshot('00000000-0000-0000-0000-00000000b001', 'AB23', '{"items":[]}') $$,
  'P0001', 'vitrine_not_found', 'vitrine congelada não recebe pedidos'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000002b1","role":"authenticated"}', true);
select is((select count(*)::int from public.order_snapshots), 1, 'dono lê os próprios pedidos');
select throws_ok(
  $$ select public.insert_order_snapshot('00000000-0000-0000-0000-00000000b001', 'CD34', '{}') $$,
  '42501', null, 'usuário não grava pedido direto'
);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000002b2","role":"authenticated"}', true);
select is((select count(*)::int from public.order_snapshots), 0, 'outro usuário não lê os pedidos');

select * from finish();
rollback;
