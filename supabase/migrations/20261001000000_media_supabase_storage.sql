-- Imagens saem do Bunny e passam a morar no Supabase Storage.
-- Bucket público: a vitrine lê pela URL pública; só o servidor grava (chave secreta, sem política de escrita).
-- No Supabase local o Storage fica desligado (config.toml) e o schema storage não existe: aí não há o que criar.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('media', 'media', true, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
    on conflict (id) do update
      set public = excluded.public,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;
  end if;
end
$$;
