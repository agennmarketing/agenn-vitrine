begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- Três contas: o teste venceu sem assinatura, assinante e teste ainda valendo.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000005c1', 'expirou@plano.com'),
  ('00000000-0000-0000-0000-0000000005c2', 'assinante@plano.com'),
  ('00000000-0000-0000-0000-0000000005c3', 'testando@plano.com');
update public.subscriptions set status = 'active', subscription_status = 'active'
where user_id = '00000000-0000-0000-0000-0000000005c2';

insert into public.vitrines (id, owner_id, type, subdomain, name, default_button_text) values
  ('00000000-0000-0000-0000-00000000f501', '00000000-0000-0000-0000-0000000005c1', 'servicos', 'plano-expirou', 'Expirou', 'Agendar horário'),
  ('00000000-0000-0000-0000-00000000f502', '00000000-0000-0000-0000-0000000005c2', 'servicos', 'plano-assinante', 'Assinante', 'Agendar horário'),
  ('00000000-0000-0000-0000-00000000f503', '00000000-0000-0000-0000-0000000005c3', 'servicos', 'plano-testando', 'Testando', 'Agendar horário');
insert into public.categories (id, owner_id, vitrine_id, name) values
  ('00000000-0000-0000-0000-00000000c501', '00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-00000000f501', 'Geral');
insert into public.items (id, owner_id, vitrine_id, category_id, name, price_cents, duration_minutes) values
  ('00000000-0000-0000-0000-00000000e501', '00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-00000000f501', '00000000-0000-0000-0000-00000000c501', 'Corte', 5000, 60);

-- O teste da primeira conta acabou.
update public.subscriptions set trial_ends_at = now() - interval '1 minute'
where user_id = '00000000-0000-0000-0000-0000000005c1';

select is(public.effective_plan_id('00000000-0000-0000-0000-0000000005c1'), 'bloqueado', 'teste vencido sem assinatura fica sem acesso');
select is(public.effective_plan_id('00000000-0000-0000-0000-0000000005c3'), 'essencial', 'teste valendo tem o Essencial');

set local role service_role;
select throws_ok(
  $$ select public.book_appointment('00000000-0000-0000-0000-00000000f501', '00000000-0000-0000-0000-00000000e501', 'AB23',
    '2030-01-07 12:00+00', 'Maria', '+5511912345678', null, null) $$,
  'P0001', 'vitrine_not_found', 'sem acesso não recebe agendamento, mesmo antes da tarefa diária'
);
select set_eq(
  $$ select public.expire_trials() $$,
  $$ values ('plano-expirou'::text) $$,
  'a tarefa diária tira do ar só a vitrine de quem ficou sem acesso'
);
reset role;

select is(
  (select subscription_status from public.subscriptions where user_id = '00000000-0000-0000-0000-0000000005c1'),
  'expired',
  'o teste vencido vira expired'
);
select is(
  (select status from public.vitrines where id = '00000000-0000-0000-0000-00000000f501'),
  'frozen',
  'a vitrine sai do ar'
);
select is(
  (select count(*)::int from public.vitrines where status = 'active' and id in ('00000000-0000-0000-0000-00000000f502', '00000000-0000-0000-0000-00000000f503')),
  2,
  'assinante e quem está no teste continuam no ar'
);
select is(
  (select subscription_status from public.subscriptions where user_id = '00000000-0000-0000-0000-0000000005c3'),
  'trialing',
  'teste valendo não muda'
);
select is(
  (select count(*)::int from public.items where owner_id = '00000000-0000-0000-0000-0000000005c1'),
  1,
  'nada é apagado'
);
select throws_ok(
  $$ insert into public.items (owner_id, vitrine_id, category_id, name) values ('00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-00000000f501', '00000000-0000-0000-0000-00000000c501', 'Novo') $$,
  'P0001', 'plan_limit:items', 'sem acesso não cria serviço'
);

set local role service_role;
select is(
  (select count(*)::int from public.expire_trials()),
  0,
  'rodar de novo não faz nada'
);
reset role;

-- Assinou: o webhook grava a assinatura e sincroniza as vitrines.
update public.subscriptions set status = 'active', subscription_status = 'active'
where user_id = '00000000-0000-0000-0000-0000000005c1';
set local role service_role;
select lives_ok(
  $$ select public.sync_vitrine_status('00000000-0000-0000-0000-0000000005c1') $$,
  'sincroniza ao assinar'
);
reset role;
select is(
  (select status from public.vitrines where id = '00000000-0000-0000-0000-00000000f501'),
  'active',
  'assinar reativa a vitrine na hora'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000005c1","role":"authenticated"}', true);
select throws_ok(
  $$ select 1 from public.stripe_events $$,
  '42501', null, 'stripe_events não é exposta ao dono'
);
select throws_ok(
  $$ select public.sync_vitrine_status('00000000-0000-0000-0000-0000000005c1') $$,
  '42501', null, 'sync_vitrine_status não é exposta ao dono'
);
select throws_ok(
  $$ select public.expire_trials() $$,
  '42501', null, 'expire_trials não é exposta ao dono'
);

select * from finish();
rollback;
