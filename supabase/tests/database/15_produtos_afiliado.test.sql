begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000006a1', 'loja@afiliado.com'),
  ('00000000-0000-0000-0000-0000000006a2', 'afiliada@afiliado.com'),
  ('00000000-0000-0000-0000-0000000006a3', 'studio@afiliado.com');

set local role authenticated;

-- Produtos próprios: o padrão continua com sacola e WhatsApp.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000006a1","role":"authenticated"}', true);
select lives_ok(
  $$ select public.create_vitrine('produtos', 'afi-loja', 'Loja', 'light', 'Adicionar à sacola', 'Principal', '+5511987654321', array['Destaques']) $$,
  'produtos sem modo informado é criada'
);
select results_eq(
  $$ select product_mode, cart_enabled, primary_whatsapp_id is not null from public.vitrines where subdomain = 'afi-loja' $$,
  $$ values ('proprios'::text, true, true) $$,
  'sem modo vira produtos próprios, com sacola e WhatsApp'
);

-- Afiliado: sem sacola e sem WhatsApp.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000006a2","role":"authenticated"}', true);
select throws_ok(
  $$ select public.create_vitrine('produtos', 'afi-erro', 'Erro', 'light', 'Comprar agora', 'Principal', '+5511987654321', null, p_product_mode => 'afiliado') $$,
  '22023', null, 'afiliado não recebe WhatsApp'
);
select lives_ok(
  $$ select public.create_vitrine('produtos', 'afi-achados', 'Achados', 'light', 'Comprar agora', 'Principal', null, array['Achados'], p_product_mode => 'afiliado') $$,
  'afiliado é criada sem WhatsApp'
);
select results_eq(
  $$ select product_mode, cart_enabled, primary_whatsapp_id is null from public.vitrines where subdomain = 'afi-achados' $$,
  $$ values ('afiliado'::text, false, true) $$,
  'afiliado nasce sem sacola e sem WhatsApp'
);
select is(
  (select count(*)::int from public.whatsapp_contacts c join public.vitrines v on v.id = c.vitrine_id where v.subdomain = 'afi-achados'),
  0, 'afiliado não tem contato de WhatsApp'
);

reset role;

-- Serviços pedem WhatsApp e não têm modo de produto.
select throws_ok(
  $$ select public.create_vitrine('servicos', 'afi-studio', 'Studio', 'light', 'Agendar horário', 'Principal', null, null) $$,
  '22023', null, 'sem WhatsApp só no afiliado'
);
select throws_ok(
  $$ insert into public.vitrines (owner_id, type, subdomain, name, default_button_text, product_mode)
     values ('00000000-0000-0000-0000-0000000006a3', 'servicos', 'afi-servico', 'Serviço', 'Agendar horário', 'afiliado') $$,
  '23514', null, 'modo de produto só existe em vitrine de produtos'
);

select * from finish();
rollback;
