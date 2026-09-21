-- Onboarding de serviços com agendamento: o assistente passa a perguntar o segmento
-- do negócio (só personaliza textos e exemplos; a vitrine continua do tipo 'servicos'),
-- Instagram, endereço e horários de atendimento. Todos opcionais no banco, para que
-- vitrines antigas (e as de produtos, ocultas da interface) continuem válidas.

alter table public.vitrines
  add column service_segment text
    check (service_segment in ('nail', 'cabelo', 'lash', 'sobrancelha', 'barbearia', 'estetica', 'outro')),
  add column instagram text
    check (instagram ~ '^[a-z0-9._]{1,30}$'),
  add column address text
    check (char_length(address) between 1 and 200),
  -- Lista de dias abertos: [{ "day": 0-6 (0 = domingo), "open": "09:00", "close": "18:00" }]
  add column business_hours jsonb
    check (jsonb_typeof(business_hours) = 'array');

grant insert (service_segment, instagram, address, business_hours) on public.vitrines to authenticated;
grant update (service_segment, instagram, address, business_hours) on public.vitrines to authenticated;

-- A assinatura muda (parâmetros novos com padrão): remove a antiga para não haver
-- duas versões ambíguas. Chamadas com os 8 parâmetros antigos continuam valendo.
drop function public.create_vitrine(text, text, text, text, text, text, text, text[]);

create function public.create_vitrine(
  p_type text,
  p_subdomain text,
  p_name text,
  p_theme text,
  p_default_button_text text,
  p_whatsapp_label text,
  p_whatsapp_phone text,
  p_categories text[],
  p_service_segment text default null,
  p_instagram text default null,
  p_address text default null,
  p_business_hours jsonb default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_vitrine_id uuid;
  v_contact_id uuid;
  v_category text;
  v_position int := 0;
begin
  insert into public.vitrines (
    type, subdomain, name, theme, default_button_text, cart_enabled,
    service_segment, instagram, address, business_hours
  )
  values (
    p_type, p_subdomain, p_name, p_theme, p_default_button_text, p_type in ('produtos', 'comida'),
    p_service_segment, p_instagram, p_address, p_business_hours
  )
  returning id into v_vitrine_id;

  insert into public.whatsapp_contacts (vitrine_id, label, phone_e164)
  values (v_vitrine_id, p_whatsapp_label, p_whatsapp_phone)
  returning id into v_contact_id;

  update public.vitrines set primary_whatsapp_id = v_contact_id where id = v_vitrine_id;

  foreach v_category in array coalesce(p_categories, '{}'::text[]) loop
    insert into public.categories (vitrine_id, name, position) values (v_vitrine_id, v_category, v_position);
    v_position := v_position + 1;
  end loop;

  return v_vitrine_id;
end;
$$;

revoke execute on function public.create_vitrine(text, text, text, text, text, text, text, text[], text, text, text, jsonb) from public, anon;
grant execute on function public.create_vitrine(text, text, text, text, text, text, text, text[], text, text, text, jsonb) to authenticated;
