begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

-- Uma conta com um pouco de tudo: apagar o usuário precisa levar todo o resto junto.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000006c1', 'sai@conta.com');
insert into public.subscriptions (user_id, plan_id, status, stripe_customer_id)
  values ('00000000-0000-0000-0000-0000000006c1', 'pro', 'active', 'cus_teste_conta');

insert into public.vitrines (id, owner_id, type, subdomain, name, default_button_text) values
  ('00000000-0000-0000-0000-00000000f601', '00000000-0000-0000-0000-0000000006c1', 'comida', 'conta-que-sai', 'Sai', 'Pedir');
insert into public.categories (id, owner_id, vitrine_id, name) values
  ('00000000-0000-0000-0000-00000000c601', '00000000-0000-0000-0000-0000000006c1', '00000000-0000-0000-0000-00000000f601', 'Geral');
insert into public.items (id, owner_id, vitrine_id, category_id, name, price_cents) values
  ('00000000-0000-0000-0000-00000000e601', '00000000-0000-0000-0000-0000000006c1', '00000000-0000-0000-0000-00000000f601', '00000000-0000-0000-0000-00000000c601', 'Item', 100);
insert into public.media (owner_id, vitrine_id, item_id, role, kind, status, storage_paths) values
  ('00000000-0000-0000-0000-0000000006c1', '00000000-0000-0000-0000-00000000f601', '00000000-0000-0000-0000-00000000e601', 'cover', 'image', 'ready', '{"480":"a/b-480.webp"}'::jsonb);
insert into public.addon_groups (id, owner_id, vitrine_id, name) values
  ('00000000-0000-0000-0000-00000000a601', '00000000-0000-0000-0000-0000000006c1', '00000000-0000-0000-0000-00000000f601', 'Adicionais');
insert into public.addon_options (owner_id, group_id, name, price_cents) values
  ('00000000-0000-0000-0000-0000000006c1', '00000000-0000-0000-0000-00000000a601', 'Bacon', 200);
insert into public.order_snapshots (owner_id, vitrine_id, code, payload, expires_at) values
  ('00000000-0000-0000-0000-0000000006c1', '00000000-0000-0000-0000-00000000f601', 'AB23', '{}'::jsonb, now() + interval '90 days');

select is(
  (select count(*)::int from public.item_codes where owner_id = '00000000-0000-0000-0000-0000000006c1'),
  1,
  'o código do item foi registrado pelo gatilho'
);

delete from auth.users where id = '00000000-0000-0000-0000-0000000006c1';

select is(
  (
    select
      (select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000006c1')
      + (select count(*) from public.subscriptions where user_id = '00000000-0000-0000-0000-0000000006c1')
      + (select count(*) from public.vitrines where owner_id = '00000000-0000-0000-0000-0000000006c1')
      + (select count(*) from public.categories where owner_id = '00000000-0000-0000-0000-0000000006c1')
      + (select count(*) from public.items where owner_id = '00000000-0000-0000-0000-0000000006c1')
      + (select count(*) from public.media where owner_id = '00000000-0000-0000-0000-0000000006c1')
      + (select count(*) from public.item_codes where owner_id = '00000000-0000-0000-0000-0000000006c1')
      + (select count(*) from public.addon_groups where owner_id = '00000000-0000-0000-0000-0000000006c1')
      + (select count(*) from public.addon_options where owner_id = '00000000-0000-0000-0000-0000000006c1')
      + (select count(*) from public.order_snapshots where owner_id = '00000000-0000-0000-0000-0000000006c1')
      + (select count(*) from public.checkout_settings where owner_id = '00000000-0000-0000-0000-0000000006c1')
  )::int,
  0,
  'apagar o usuário leva todos os dados dele junto'
);

select is(
  (select count(*)::int from public.plans),
  2,
  'dados compartilhados continuam de pé'
);

select * from finish();
rollback;
