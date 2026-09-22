begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000001a1', 'dono@itens.com'),
  ('00000000-0000-0000-0000-0000000001a2', 'outro@itens.com');

insert into public.vitrines (id, owner_id, type, subdomain, name, default_button_text) values
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000001a1', 'produtos', 'itens-dono', 'Dono', 'Solicitar orçamento'),
  ('00000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-0000000001a2', 'produtos', 'itens-outro', 'Outro', 'Solicitar orçamento');
insert into public.categories (id, owner_id, vitrine_id, name) values
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-00000000a001', 'Geral'),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-0000000001a2', '00000000-0000-0000-0000-00000000a002', 'Alheia');

-- O dono não escolhe o id do item (sem grant na coluna); este primeiro item, com id
-- fixo para os testes seguintes, é criado como postgres. Os triggers valem igual.
insert into public.items (id, owner_id, vitrine_id, category_id, name, price_cents)
values ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c001', 'Primeiro', 1000);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000001a1","role":"authenticated"}', true);
select is((select code from public.items where id = '00000000-0000-0000-0000-00000000e001'), '101', 'primeiro código automático é 101');

insert into public.items (vitrine_id, category_id, name, code) values
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c001', 'Personalizado', 'x1'),
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c001', 'Pula', '102');
select is((select code from public.items where name = 'Personalizado'), 'X1', 'código personalizado vira maiúsculo');

insert into public.items (vitrine_id, category_id, name) values
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c001', 'Automático');
select is((select code from public.items where name = 'Automático'), '103', 'automático pula código já usado');
select is(public.peek_next_item_code(), '104', 'peek mostra o próximo sem consumir');

select throws_ok(
  $$ insert into public.items (vitrine_id, category_id, name, code) values ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c001', 'Repetido', 'X1') $$,
  'P0001', 'item_code_taken', 'código repetido é recusado'
);

update public.items set code = 'NOVO' where id = '00000000-0000-0000-0000-00000000e001';
select throws_ok(
  $$ insert into public.items (vitrine_id, category_id, name, code) values ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c001', 'Reuso', '101') $$,
  'P0001', 'item_code_taken', 'código antigo nunca é reaproveitado'
);
select lives_ok(
  $$ update public.items set code = '101' where id = '00000000-0000-0000-0000-00000000e001' $$,
  'item pode voltar ao próprio código antigo'
);
select is(public.is_item_code_available('x1'), false, 'x1 indisponível');
select is(public.is_item_code_available('zz9'), true, 'zz9 disponível');
select is(public.is_item_code_available('NOVO', '00000000-0000-0000-0000-00000000e001'), true, 'código do próprio item conta como disponível');

select throws_ok(
  $$ insert into public.items (vitrine_id, category_id, name) values ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c002', 'Categoria alheia') $$,
  'P0001', 'invalid_reference:category', 'categoria de outra vitrine é recusada'
);

-- Limite do Essencial: já há 4 itens; completa 300.
insert into public.items (vitrine_id, category_id, name)
select '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c001', 'Lote ' || g from generate_series(1, 296) g;
select throws_ok(
  $$ insert into public.items (vitrine_id, category_id, name) values ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c001', 'Além do limite') $$,
  'P0001', 'plan_limit:items', 'essencial não passa de 300 itens'
);

update public.items set deleted_at = now() where name = 'Lote 1';
select lives_ok(
  $$ insert into public.items (vitrine_id, category_id, name) values ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c001', 'Depois de apagar') $$,
  'item apagado não conta no limite'
);
select throws_ok(
  $$ update public.items set deleted_at = null where name = 'Lote 1' $$,
  'P0001', 'item_deleted', 'item apagado não volta'
);

-- Sem teste nem assinatura valendo, nada novo é criado.
reset role;
update public.items set deleted_at = now() where name = 'Lote 2';
update public.subscriptions set trial_ends_at = now() - interval '1 minute'
where user_id = '00000000-0000-0000-0000-0000000001a1';
set local role authenticated;
select throws_ok(
  $$ insert into public.items (vitrine_id, category_id, name) values ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c001', 'Sem acesso') $$,
  'P0001', 'plan_limit:items', 'sem acesso não cria item'
);

select throws_ok(
  $$ insert into public.media (owner_id, vitrine_id, role, kind, storage_paths) values ('00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-00000000a001', 'logo', 'image', '{}') $$,
  '42501', null, 'dono não grava mídia direto'
);

-- Outro usuário
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000001a2","role":"authenticated"}', true);
select is((select count(*)::int from public.items), 0, 'outro usuário não vê itens alheios');
select throws_ok(
  $$ insert into public.item_variations (item_id, name, price_cents) values ('00000000-0000-0000-0000-00000000e001', 'Invasora', 100) $$,
  '42501', null, 'outro usuário não cria variação em item alheio'
);

-- Mídias (servidor)
reset role;
insert into public.media (id, owner_id, vitrine_id, item_id, role, kind, storage_paths) values
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000e001', 'cover', 'image', '{"480":"a","1080":"b"}'),
  ('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-00000000a001', null, 'logo', 'image', '{"128":"a","512":"b"}'),
  ('00000000-0000-0000-0000-00000000d003', '00000000-0000-0000-0000-0000000001a2', '00000000-0000-0000-0000-00000000a002', null, 'logo', 'image', '{"128":"a","512":"b"}');

select throws_ok(
  $$ insert into public.media (owner_id, vitrine_id, item_id, role, kind, storage_paths) values ('00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000e001', 'cover', 'image', '{}') $$,
  '23505', null, 'uma capa por item'
);
select throws_ok(
  $$ insert into public.media (owner_id, vitrine_id, item_id, role, kind, position, storage_paths) values ('00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000e001', 'gallery', 'image', 3, '{}') $$,
  '23514', null, 'no máximo duas imagens de galeria'
);
select throws_ok(
  $$ update public.vitrines set logo_media_id = '00000000-0000-0000-0000-00000000d003' where id = '00000000-0000-0000-0000-00000000a001' $$,
  'P0001', 'invalid_reference:logo', 'logo de outra vitrine é recusado'
);

update public.vitrines set logo_media_id = '00000000-0000-0000-0000-00000000d002' where id = '00000000-0000-0000-0000-00000000a001';
delete from public.vitrines where id = '00000000-0000-0000-0000-00000000a001';
select is(
  (select count(*)::int from public.item_codes where owner_id = '00000000-0000-0000-0000-0000000001a1' and item_id is null),
  (select count(*)::int from public.item_codes where owner_id = '00000000-0000-0000-0000-0000000001a1'),
  'excluir a vitrine mantém os códigos, sem item'
);

select * from finish();
rollback;
