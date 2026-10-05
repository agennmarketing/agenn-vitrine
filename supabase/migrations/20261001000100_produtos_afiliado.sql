-- Vitrine de produtos com dois jeitos de vender, escolhidos no assistente:
--   'proprios' — produtos da própria loja: sacola e pedido no WhatsApp (o que já existia);
--   'afiliado' — cada produto leva direto ao link de afiliado: sem sacola e sem WhatsApp.
-- Serviços (e as antigas de comida) não têm modo. As de produtos que já existem são de produtos próprios;
-- nulo numa vitrine de produtos também vale como 'proprios' (é o que o app entende).

alter table public.vitrines add column product_mode text check (product_mode in ('proprios', 'afiliado'));

update public.vitrines set product_mode = 'proprios' where type = 'produtos';

alter table public.vitrines
  add constraint vitrines_product_mode_only_produtos check (product_mode is null or type = 'produtos');

-- Escolhido na criação e fixo depois: só insert.
grant insert (product_mode) on public.vitrines to authenticated;

-- Assinatura nova (p_product_mode) e WhatsApp opcional: o afiliado não informa número.
drop function public.create_vitrine(text, text, text, text, text, text, text, text[], text, text, text, jsonb);

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
  p_business_hours jsonb default null,
  p_product_mode text default null
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
  v_mode text := case when p_type = 'produtos' then coalesce(p_product_mode, 'proprios') end;
begin
  if v_mode = 'afiliado' and p_whatsapp_phone is not null then
    raise exception 'A vitrine de afiliado não usa WhatsApp' using errcode = '22023';
  end if;
  if v_mode is distinct from 'afiliado' and p_whatsapp_phone is null then
    raise exception 'Informe o WhatsApp da vitrine' using errcode = '22023';
  end if;

  insert into public.vitrines (
    type, subdomain, name, theme, default_button_text, cart_enabled,
    service_segment, instagram, address, business_hours, product_mode
  )
  values (
    p_type, p_subdomain, p_name, p_theme, p_default_button_text,
    -- Serviços têm v_mode nulo: sem o coalesce, `false or null` daria nulo na coluna not null.
    p_type = 'comida' or coalesce(v_mode = 'proprios', false),
    p_service_segment, p_instagram, p_address, p_business_hours, v_mode
  )
  returning id into v_vitrine_id;

  if p_whatsapp_phone is not null then
    insert into public.whatsapp_contacts (vitrine_id, label, phone_e164)
    values (v_vitrine_id, p_whatsapp_label, p_whatsapp_phone)
    returning id into v_contact_id;

    update public.vitrines set primary_whatsapp_id = v_contact_id where id = v_vitrine_id;
  end if;

  foreach v_category in array coalesce(p_categories, '{}'::text[]) loop
    insert into public.categories (vitrine_id, name, position) values (v_vitrine_id, v_category, v_position);
    v_position := v_position + 1;
  end loop;

  return v_vitrine_id;
end;
$$;

revoke execute on function public.create_vitrine(text, text, text, text, text, text, text, text[], text, text, text, jsonb, text) from public, anon;
grant execute on function public.create_vitrine(text, text, text, text, text, text, text, text[], text, text, text, jsonb, text) to authenticated;
