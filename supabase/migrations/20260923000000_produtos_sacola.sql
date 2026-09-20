-- Vitrine de produtos: a sacola faz parte do fluxo (o botão do produto é
-- "Adicionar à sacola" e o fechamento monta a mensagem do WhatsApp).
-- Serviços continuam sem sacola.

create or replace function public.create_vitrine(
  p_type text,
  p_subdomain text,
  p_name text,
  p_theme text,
  p_default_button_text text,
  p_whatsapp_label text,
  p_whatsapp_phone text,
  p_categories text[]
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
  insert into public.vitrines (type, subdomain, name, theme, default_button_text, cart_enabled)
  values (p_type, p_subdomain, p_name, p_theme, p_default_button_text, p_type in ('produtos', 'comida'))
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

-- Vitrines de produtos já criadas passam a ter a sacola.
update public.vitrines set cart_enabled = true where type = 'produtos' and cart_enabled = false;
