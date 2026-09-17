begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000004a1', 'dono@addons.com'),
  ('00000000-0000-0000-0000-0000000004a2', 'outro@addons.com');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000004a1","role":"authenticated"}', true);

select lives_ok(
  $$ select public.create_vitrine('comida', 'addons-burger', 'Burger', 'light', 'Pedir', 'Principal', '+5511987654321', array['Lanches']) $$,
  'cria vitrine de comida'
);
select results_eq(
  $$ select name_mode, fulfillment_mode, payment_mode, schedule_mode, notes_mode
     from public.checkout_settings c join public.vitrines v on v.id = c.vitrine_id where v.subdomain = 'addons-burger' $$,
  $$ values ('required', 'required', 'required', 'off', 'optional') $$,
  'comida recebe formulário padrão com retirada/entrega e pagamento obrigatórios'
);
select is(
  (select payment_options from public.checkout_settings c join public.vitrines v on v.id = c.vitrine_id where v.subdomain = 'addons-burger'),
  array['Pix', 'Cartão na entrega', 'Dinheiro'],
  'opções de pagamento padrão'
);
select is((select cart_enabled from public.vitrines where subdomain = 'addons-burger'), true, 'sacola ligada em comida');

reset role;
select set_config('test.vitrine', (select id::text from public.vitrines where subdomain = 'addons-burger'), true);
insert into public.categories (id, owner_id, vitrine_id, name)
values ('00000000-0000-0000-0000-00000000c401', '00000000-0000-0000-0000-0000000004a1', current_setting('test.vitrine')::uuid, 'Pizzas');
insert into public.items (id, owner_id, vitrine_id, category_id, name, price_cents)
values ('00000000-0000-0000-0000-00000000e401', '00000000-0000-0000-0000-0000000004a1', current_setting('test.vitrine')::uuid, '00000000-0000-0000-0000-00000000c401', 'X-Bacon', 2590);
set local role authenticated;

select lives_ok(
  format(
    $$ insert into public.addon_groups (vitrine_id, name, kind, required, min_select, max_select, allow_repeat) values (%L, 'Adicionais', 'standard', false, 0, 5, true) $$,
    current_setting('test.vitrine')
  ),
  'dono cria grupo'
);
select throws_ok(
  format(
    $$ insert into public.addon_groups (vitrine_id, name, required, min_select, max_select) values (%L, 'Errado', true, 0, 1) $$,
    current_setting('test.vitrine')
  ),
  '23514', null, 'obrigatório exige mínimo ≥ 1'
);
select throws_ok(
  format(
    $$ insert into public.addon_groups (vitrine_id, name, kind, min_select, max_select, allow_repeat, flavor_price_rule) values (%L, 'Sabores', 'flavors', 0, 2, true, 'max') $$,
    current_setting('test.vitrine')
  ),
  '23514', null, 'sabores não repetem'
);
select throws_ok(
  format(
    $$ insert into public.addon_groups (vitrine_id, name, kind, min_select, max_select) values (%L, 'Sabores', 'flavors', 1, 2) $$,
    current_setting('test.vitrine')
  ),
  '23514', null, 'sabores exigem regra de preço'
);
select throws_ok(
  format(
    $$ insert into public.addon_groups (vitrine_id, name, min_select, max_select) values (%L, 'Invertido', 3, 2) $$,
    current_setting('test.vitrine')
  ),
  '23514', null, 'mínimo não passa do máximo'
);

select lives_ok(
  $$ insert into public.addon_options (group_id, name, price_cents) select id, 'Bacon', 400 from public.addon_groups where name = 'Adicionais' $$,
  'dono cria opção'
);
select lives_ok(
  $$ insert into public.item_addon_groups (item_id, group_id, position) select '00000000-0000-0000-0000-00000000e401', id, 0 from public.addon_groups where name = 'Adicionais' $$,
  'dono liga grupo ao item'
);
select lives_ok(
  $$ update public.checkout_settings set payment_mode = 'optional', payment_options = array['Pix'] $$,
  'dono altera o formulário'
);
select throws_ok(
  $$ update public.checkout_settings set payment_mode = 'required', payment_options = array[]::text[] $$,
  '23514', null, 'pagamento ligado exige ao menos uma opção'
);
select throws_ok(
  $$ update public.checkout_settings set vitrine_id = gen_random_uuid() $$,
  '42501', null, 'formulário não troca de vitrine'
);

-- Outro dono
reset role;
select set_config('test.group', (select id::text from public.addon_groups where name = 'Adicionais'), true);
insert into public.vitrines (id, owner_id, type, subdomain, name, default_button_text)
values ('00000000-0000-0000-0000-00000000f402', '00000000-0000-0000-0000-0000000004a2', 'comida', 'addons-outro', 'Outro', 'Pedir');
insert into public.addon_groups (id, owner_id, vitrine_id, name) values
  ('00000000-0000-0000-0000-00000000a402', '00000000-0000-0000-0000-0000000004a2', '00000000-0000-0000-0000-00000000f402', 'Alheio');
select is(
  (select count(*)::int from public.checkout_settings where vitrine_id = '00000000-0000-0000-0000-00000000f402'),
  1,
  'insert direto também cria o formulário'
);
select throws_ok(
  $$ insert into public.item_addon_groups (owner_id, item_id, group_id) values ('00000000-0000-0000-0000-0000000004a1', '00000000-0000-0000-0000-00000000e401', '00000000-0000-0000-0000-00000000a402') $$,
  'P0001', 'invalid_reference:addon_group', 'grupo de outra vitrine é recusado'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000004a2","role":"authenticated"}', true);
select is((select count(*)::int from public.addon_options), 0, 'outro dono não vê opções alheias');
select throws_ok(
  format($$ insert into public.addon_options (group_id, name) values (%L, 'Invasora') $$, current_setting('test.group')),
  '42501', null, 'outro dono não cria opção em grupo alheio'
);

select * from finish();
rollback;
