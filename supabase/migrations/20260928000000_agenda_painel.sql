-- Agenda do painel: o dono conclui e remarca agendamentos, além de cancelar.

alter table public.appointments add column completed_at timestamptz;

alter table public.appointments drop constraint appointments_status_check;
alter table public.appointments
  add constraint appointments_status_check check (status in ('confirmed', 'completed', 'cancelled'));

grant update (completed_at) on public.appointments to authenticated;

create index appointments_vitrine_status_idx on public.appointments (vitrine_id, status, starts_at);

-- Remarca um agendamento confirmado do próprio dono. Mesma regra da vitrine: a vitrine
-- fica travada, bloqueios e outros agendamentos são conferidos e a duração não muda.
-- O intervalo usado é o atual da vitrine. 'slot_unavailable' se o horário não está livre.
create function public.reschedule_appointment(p_appointment_id uuid, p_starts_at timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appointment public.appointments%rowtype;
  v_vitrine public.vitrines%rowtype;
  v_ends timestamptz;
  v_blocked timestamptz;
begin
  select * into v_appointment from public.appointments a
  where a.id = p_appointment_id and a.owner_id = (select auth.uid()) and a.status = 'confirmed';
  if v_appointment.id is null then
    raise exception 'appointment_not_found' using errcode = 'P0001';
  end if;

  if p_starts_at < now() then
    raise exception 'slot_in_past' using errcode = 'P0001';
  end if;

  select * into v_vitrine from public.vitrines v where v.id = v_appointment.vitrine_id for update;

  v_ends := p_starts_at + make_interval(mins => v_appointment.duration_minutes);
  v_blocked := v_ends + make_interval(mins => v_vitrine.booking_buffer_minutes);

  if exists (
    select 1 from public.booking_blocks b
    where b.vitrine_id = v_appointment.vitrine_id and b.starts_at < v_ends and b.ends_at > p_starts_at
  ) then
    raise exception 'slot_unavailable' using errcode = 'P0001';
  end if;

  update public.appointments
  set starts_at = p_starts_at, ends_at = v_ends, blocked_until = v_blocked
  where id = p_appointment_id and status = 'confirmed';
  if not found then
    raise exception 'appointment_not_found' using errcode = 'P0001';
  end if;
exception
  when exclusion_violation then
    raise exception 'slot_unavailable' using errcode = 'P0001';
end;
$$;

revoke execute on function public.reschedule_appointment(uuid, timestamptz) from public, anon;
grant execute on function public.reschedule_appointment(uuid, timestamptz) to authenticated;
