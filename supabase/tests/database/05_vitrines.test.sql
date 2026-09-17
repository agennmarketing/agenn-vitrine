begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'ana@vitrine.com'),
  ('00000000-0000-0000-0000-0000000000f2', 'bia@vitrine.com'),
  ('00000000-0000-0000-0000-0000000000f3', 'pro@vitrine.com');
insert into public.subscriptions (user_id, plan_id, status) values
  ('00000000-0000-0000-0000-0000000000f3', 'pro', 'active');

set local role authenticated;

-- Ana (gratuito)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);

select lives_ok(
  $$ select public.create_vitrine('produtos', 'loja-ana', 'Loja da Ana', 'light', 'Solicitar orçamento', 'Principal', '+5511987654321', array['Destaques', 'Novidades']) $$,
  'create_vitrine cria a vitrine'
);
select is(
  (select w.phone_e164 from public.vitrines v join public.whatsapp_contacts w on w.id = v.primary_whatsapp_id where v.subdomain = 'loja-ana'),
  '+5511987654321',
  'WhatsApp principal criado e ligado'
);
select is(
  (select array_agg(c.name order by c.position) from public.categories c join public.vitrines v on v.id = c.vitrine_id where v.subdomain = 'loja-ana'),
  array['Destaques', 'Novidades'],
  'categorias de exemplo na ordem'
);
select throws_ok(
  $$ select public.create_vitrine('servicos', 'ana-dois', 'Ana 2', 'light', 'Agendar', 'Principal', '+5511987654321', array[]::text[]) $$,
  'P0001', 'plan_limit:vitrines', 'gratuito não cria a segunda vitrine'
);
select throws_ok(
  $$ update public.vitrines set type = 'servicos' where subdomain = 'loja-ana' $$,
  '42501', null, 'tipo é imutável'
);
select throws_ok(
  $$ update public.vitrines set status = 'frozen' where subdomain = 'loja-ana' $$,
  '42501', null, 'status só pelo servidor'
);
select is(public.is_subdomain_available('LOJA-ANA'), false, 'subdomínio em uso fica indisponível');
select is(
  public.is_subdomain_available('loja-ana', (select id from public.vitrines where subdomain = 'loja-ana')),
  true,
  'o próprio subdomínio fica disponível para a vitrine dona'
);

-- Pro
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f3","role":"authenticated"}', true);
select lives_ok(
  $$ select public.create_vitrine('produtos', 'pro-um', 'Pro 1', 'dark', 'Solicitar orçamento', 'Principal', '+5511912345678', null) $$,
  'pro cria a primeira'
);
select lives_ok(
  $$ select public.create_vitrine('servicos', 'pro-dois', 'Pro 2', 'light', 'Agendar', 'Principal', '+5511912345678', null) $$,
  'pro cria a segunda'
);
select throws_ok(
  $$ select public.create_vitrine('produtos', 'Loja-Ana', 'Cópia', 'light', 'Solicitar orçamento', 'Principal', '+5511912345678', null) $$,
  '23514', null, 'subdomínio com maiúscula viola o formato'
);
select throws_ok(
  $$ select public.create_vitrine('produtos', 'admin', 'Admin', 'light', 'Solicitar orçamento', 'Principal', '+5511912345678', null) $$,
  '23514', null, 'subdomínio reservado é recusado'
);
select throws_ok(
  $$ select public.create_vitrine('produtos', 'loja-ana', 'Cópia', 'light', 'Solicitar orçamento', 'Principal', '+5511912345678', null) $$,
  '23505', null, 'subdomínio duplicado é recusado'
);

-- Bia não enxerga nem escreve na vitrine da Ana. O id é lido como postgres,
-- porque com as claims da Bia o select voltaria vazio.
reset role;
select set_config('test.ana_vitrine', (select id::text from public.vitrines where subdomain = 'loja-ana'), true);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f2","role":"authenticated"}', true);
select is((select count(*)::int from public.vitrines), 0, 'Bia não vê vitrines alheias');
select throws_ok(
  format(
    $$ insert into public.whatsapp_contacts (vitrine_id, label, phone_e164) values (%L, 'Invasor', '+5511900000000') $$,
    current_setting('test.ana_vitrine')
  ),
  '42501', null, 'Bia não cria contato na vitrine da Ana'
);

reset role;
set local role anon;
select throws_ok($$ select * from public.vitrines $$, '42501', null, 'visitante não lê vitrines direto');

select * from finish();
rollback;
