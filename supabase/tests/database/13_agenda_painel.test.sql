begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000004c1', 'dono@painel-agenda.com'),
  ('00000000-0000-0000-0000-0000000004c2', 'outro@painel-agenda.com');
insert into public.vitrines (id, owner_id, type, subdomain, name, default_button_text, booking_buffer_minutes) values
  ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000004c1', 'servicos', 'painel-agenda', 'Studio', 'Agendar horário', 15);
insert into public.categories (id, owner_id, vitrine_id, name) values
  ('00000000-0000-0000-0000-00000000e0c1', '00000000-0000-0000-0000-0000000004c1', '00000000-0000-0000-0000-00000000e001', 'Unhas');
insert into public.items (id, owner_id, vitrine_id, category_id, name, price_cents, duration_minutes) values
  ('00000000-0000-0000-0000-00000000e0e1', '00000000-0000-0000-0000-0000000004c1', '00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000e0c1', 'Manicure', 4000, 60);
insert into public.booking_blocks (owner_id, vitrine_id, starts_at, ends_at) values
  ('00000000-0000-0000-0000-0000000004c1', '00000000-0000-0000-0000-00000000e001', '2030-02-05 12:00+00', '2030-02-05 13:00+00');

set local role service_role;
select public.book_appointment('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000e0e1', 'AB23',
  '2030-02-04 12:00+00', 'Maria', '+5511912345678', null, null);
select public.book_appointment('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000e0e1', 'CD34',
  '2030-02-04 15:00+00', 'João', '+5511912345679', null, null);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000004c2","role":"authenticated"}', true);
select throws_ok(
  $$ select public.reschedule_appointment((select id from public.appointments where code = 'AB23'), '2030-02-04 18:00+00') $$,
  'P0001', 'appointment_not_found', 'outro usuário não remarca'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000004c1","role":"authenticated"}', true);
select public.reschedule_appointment((select id from public.appointments where code = 'AB23'), '2030-02-04 13:00+00');
select is(
  (select blocked_until from public.appointments where code = 'AB23'),
  '2030-02-04 14:15+00'::timestamptz, 'dono remarca: duração e intervalo acompanham o novo início'
);
select throws_ok(
  $$ select public.reschedule_appointment((select id from public.appointments where code = 'AB23'), '2030-02-04 14:30+00') $$,
  'P0001', 'slot_unavailable', 'não remarca em cima de outro agendamento'
);
select throws_ok(
  $$ select public.reschedule_appointment((select id from public.appointments where code = 'AB23'), '2030-02-05 11:30+00') $$,
  'P0001', 'slot_unavailable', 'não remarca em cima de um bloqueio'
);
select throws_ok(
  $$ select public.reschedule_appointment((select id from public.appointments where code = 'AB23'), '2020-02-04 13:00+00') $$,
  'P0001', 'slot_in_past', 'não remarca para o passado'
);

update public.appointments set status = 'completed', completed_at = now() where code = 'AB23';
select is((select status from public.appointments where code = 'AB23'), 'completed', 'dono conclui');
select throws_ok(
  $$ select public.reschedule_appointment((select id from public.appointments where code = 'AB23'), '2030-02-06 13:00+00') $$,
  'P0001', 'appointment_not_found', 'concluído não é remarcado'
);

select * from finish();
rollback;
