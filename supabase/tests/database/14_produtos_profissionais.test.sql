begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000005c1', 'dono@profissionais.com'),
  ('00000000-0000-0000-0000-0000000005c2', 'outro@profissionais.com');
insert into public.vitrines (id, owner_id, type, subdomain, name, default_button_text, booking_buffer_minutes) values
  ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000005c1', 'servicos', 'prof-studio', 'Studio', 'Agendar horário', 0),
  ('00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-0000000005c2', 'produtos', 'prof-loja', 'Loja', 'Adicionar à sacola', 0);
insert into public.categories (id, owner_id, vitrine_id, name) values
  ('00000000-0000-0000-0000-00000000f0c1', '00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-00000000f001', 'Unhas'),
  ('00000000-0000-0000-0000-00000000f0c2', '00000000-0000-0000-0000-0000000005c2', '00000000-0000-0000-0000-00000000f002', 'Geral');
insert into public.items (id, owner_id, vitrine_id, category_id, name, price_cents, duration_minutes) values
  ('00000000-0000-0000-0000-00000000f0e1', '00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000f0c1', 'Manicure', 4000, 60),
  ('00000000-0000-0000-0000-00000000f0e2', '00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000f0c1', 'Pedicure', 5000, 60),
  ('00000000-0000-0000-0000-00000000f0e3', '00000000-0000-0000-0000-0000000005c2', '00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-00000000f0c2', 'Camiseta', 5000, null);

-- Forma de venda do produto ------------------------------------------------

select is(
  (select sale_mode from public.items where id = '00000000-0000-0000-0000-00000000f0e3'),
  'whatsapp', 'item existente nasce vendendo pelo WhatsApp'
);
select throws_ok(
  $$ update public.items set sale_mode = 'link' where id = '00000000-0000-0000-0000-00000000f0e3' $$,
  '23514', null, 'link externo sem endereço é recusado'
);
select lives_ok(
  $$ update public.items set sale_mode = 'link', external_url = 'https://loja.exemplo.com/camiseta'
     where id = '00000000-0000-0000-0000-00000000f0e3' $$,
  'link externo com endereço é aceito'
);
select throws_ok(
  $$ update public.items set external_url = 'javascript:alert(1)' where id = '00000000-0000-0000-0000-00000000f0e3' $$,
  '23514', null, 'endereço precisa ser https'
);

-- Configurações de pedido ---------------------------------------------------

select is(
  (select phone_mode from public.checkout_settings where vitrine_id = '00000000-0000-0000-0000-00000000f002'),
  'optional', 'vitrine de produtos já pede o telefone'
);
select is(
  (select phone_mode from public.checkout_settings where vitrine_id = '00000000-0000-0000-0000-00000000f001'),
  'off', 'vitrine de serviços não pede telefone na sacola'
);
select throws_ok(
  $$ update public.checkout_settings set fulfillment_mode = 'required', allow_pickup = false, allow_delivery = false
     where vitrine_id = '00000000-0000-0000-0000-00000000f002' $$,
  '23514', null, 'perguntar retirada/entrega sem oferecer nenhuma é recusado'
);

-- Profissionais -------------------------------------------------------------

insert into public.professionals (id, owner_id, vitrine_id, name) values
  ('00000000-0000-0000-0000-00000000fa01', '00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-00000000f001', 'Ana'),
  ('00000000-0000-0000-0000-00000000fa02', '00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-00000000f001', 'Bia');
insert into public.professional_items (professional_id, item_id, owner_id) values
  ('00000000-0000-0000-0000-00000000fa01', '00000000-0000-0000-0000-00000000f0e1', '00000000-0000-0000-0000-0000000005c1'),
  ('00000000-0000-0000-0000-00000000fa02', '00000000-0000-0000-0000-00000000f0e1', '00000000-0000-0000-0000-0000000005c1');

select throws_ok(
  $$ insert into public.professional_items (professional_id, item_id, owner_id) values
     ('00000000-0000-0000-0000-00000000fa01', '00000000-0000-0000-0000-00000000f0e3', '00000000-0000-0000-0000-0000000005c1') $$,
  'P0001', 'professional_item_mismatch', 'profissional não atende serviço de outra vitrine'
);

set local role service_role;

select isnt(
  public.book_appointment('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000f0e1', 'AB23',
    '2030-03-04 12:00+00', 'Maria', '+5511912345678', null, null, '00000000-0000-0000-0000-00000000fa01'),
  null, 'agenda com a Ana'
);
select throws_ok(
  $$ select public.book_appointment('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000f0e1', 'CD34',
     '2030-03-04 12:30+00', 'João', '+5511912345679', null, null, '00000000-0000-0000-0000-00000000fa01') $$,
  'P0001', 'slot_unavailable', 'a mesma profissional não recebe dois no mesmo horário'
);
select isnt(
  public.book_appointment('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000f0e1', 'CD34',
    '2030-03-04 12:30+00', 'João', '+5511912345679', null, null, '00000000-0000-0000-0000-00000000fa02'),
  null, 'outra profissional atende no mesmo horário'
);
select is(
  (select professional_name from public.appointments where code = 'AB23'),
  'Ana', 'o nome da profissional fica guardado no agendamento'
);
select throws_ok(
  $$ select public.book_appointment('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000f0e2', 'EF45',
     '2030-03-05 12:00+00', 'Rita', '+5511912345671', null, null, '00000000-0000-0000-0000-00000000fa01') $$,
  'P0001', 'professional_unavailable', 'profissional que não faz o serviço é recusada'
);
select throws_ok(
  $$ select public.book_appointment('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000f0e1', 'GH56',
     '2030-03-04 12:00+00', 'Rita', '+5511912345671', null, null) $$,
  'P0001', 'slot_unavailable', 'sem profissional, o horário ocupado do negócio continua ocupado'
);

select * from finish();
rollback;
