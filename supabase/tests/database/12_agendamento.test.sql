begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000003c1', 'dono@agenda.com'),
  ('00000000-0000-0000-0000-0000000003c2', 'outro@agenda.com');
insert into public.vitrines (id, owner_id, type, subdomain, name, default_button_text, booking_buffer_minutes) values
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000003c1', 'servicos', 'agenda-dono', 'Studio', 'Agendar horário', 15),
  ('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-0000000003c2', 'produtos', 'agenda-loja', 'Loja', 'Adicionar à sacola', 0);
insert into public.categories (id, owner_id, vitrine_id, name) values
  ('00000000-0000-0000-0000-00000000d0c1', '00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-00000000d001', 'Unhas'),
  ('00000000-0000-0000-0000-00000000d0c2', '00000000-0000-0000-0000-0000000003c2', '00000000-0000-0000-0000-00000000d002', 'Geral');
insert into public.items (id, owner_id, vitrine_id, category_id, name, price_cents, duration_minutes) values
  ('00000000-0000-0000-0000-00000000d0e1', '00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000d0c1', 'Manicure', 4000, 60),
  ('00000000-0000-0000-0000-00000000d0e2', '00000000-0000-0000-0000-0000000003c2', '00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-00000000d0c2', 'Camiseta', 5000, null);

set local role service_role;

select isnt(
  public.book_appointment('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000d0e1', 'AB23',
    '2030-01-07 12:00+00', 'Maria', '+5511912345678', '', 'R$ 40,00'),
  null, 'agenda o horário'
);
select is(
  (select blocked_until from public.appointments where code = 'AB23'),
  '2030-01-07 13:15+00'::timestamptz, 'bloqueia a duração mais o intervalo'
);
select is((select notes from public.appointments where code = 'AB23'), null, 'observação vazia vira nula');
select throws_ok(
  $$ select public.book_appointment('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000d0e1', 'CD34',
    '2030-01-07 13:00+00', 'João', '+5511912345679', null, null) $$,
  'P0001', 'slot_unavailable', 'horário dentro do intervalo é recusado'
);
select isnt(
  public.book_appointment('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000d0e1', 'CD34',
    '2030-01-07 13:15+00', 'João', '+5511912345679', null, null),
  null, 'logo depois do intervalo é livre'
);
select is(
  public.book_appointment('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000d0e1', 'AB23',
    '2030-01-08 12:00+00', 'Ana', '+5511912345670', null, null),
  null, 'código repetido devolve null para tentar outro'
);

reset role;
insert into public.booking_blocks (owner_id, vitrine_id, starts_at, ends_at) values
  ('00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-00000000d001', '2030-01-09 15:00+00', '2030-01-09 16:00+00');
set local role service_role;
select throws_ok(
  $$ select public.book_appointment('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000d0e1', 'EF45',
    '2030-01-09 14:30+00', 'Ana', '+5511912345670', null, null) $$,
  'P0001', 'slot_unavailable', 'bloqueio avulso é respeitado'
);
select throws_ok(
  $$ select public.book_appointment('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-00000000d0e2', 'EF45',
    '2030-01-09 14:30+00', 'Ana', '+5511912345670', null, null) $$,
  'P0001', 'vitrine_not_found', 'vitrine de produtos não agenda'
);

reset role;
select throws_ok(
  $$ insert into public.appointments (owner_id, vitrine_id, code, service_name, duration_minutes, customer_name, customer_phone, starts_at, ends_at, blocked_until)
     values ('00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-00000000d001', 'GH67', 'X', 30, 'Y', '+5511912345670',
       '2030-01-07 12:30+00', '2030-01-07 13:00+00', '2030-01-07 13:00+00') $$,
  '23P01', null, 'o banco recusa sobreposição mesmo fora da função'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000003c1","role":"authenticated"}', true);
select is((select count(*)::int from public.appointments), 2, 'dono lê os próprios agendamentos');
select throws_ok(
  $$ select public.book_appointment('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000d0e1', 'JK89',
    '2030-01-10 12:00+00', 'Ana', '+5511912345670', null, null) $$,
  '42501', null, 'usuário não agenda direto pela função'
);
update public.appointments set status = 'cancelled', cancelled_at = now() where code = 'AB23';
select is((select status from public.appointments where code = 'AB23'), 'cancelled', 'dono cancela');
insert into public.booking_blocks (vitrine_id, starts_at, ends_at, reason)
values ('00000000-0000-0000-0000-00000000d001', '2030-01-11 12:00+00', '2030-01-11 13:00+00', 'Folga');
select is((select count(*)::int from public.booking_blocks), 2, 'dono cria bloqueio');

reset role;
set local role service_role;
select isnt(
  public.book_appointment('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000d0e1', 'MN23',
    '2030-01-07 12:00+00', 'Bia', '+5511912345671', null, null),
  null, 'cancelar libera o horário'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000003c2","role":"authenticated"}', true);
select is((select count(*)::int from public.appointments), 0, 'outro usuário não lê os agendamentos');
select throws_ok(
  $$ insert into public.booking_blocks (vitrine_id, starts_at, ends_at)
     values ('00000000-0000-0000-0000-00000000d001', '2030-01-12 12:00+00', '2030-01-12 13:00+00') $$,
  '42501', null, 'outro usuário não bloqueia a agenda alheia'
);

select * from finish();
rollback;
