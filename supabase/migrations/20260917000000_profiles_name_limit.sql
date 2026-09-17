-- Limita o nome do perfil a 80 caracteres (mesmo limite do formulário).

alter table public.profiles
  add constraint profiles_name_length check (char_length(name) <= 80);

-- Nomes vindos do cadastro ou do Google são cortados para não violar o limite.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', ''), 80)
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
