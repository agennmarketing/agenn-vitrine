-- Vídeo no Mux no lugar do Bunny Stream: o identificador do vídeo passa a ser o
-- asset do Mux, e a mídia guarda também o upload, o playback e a miniatura.

alter table public.media rename column bunny_video_id to mux_asset_id;
alter index public.media_bunny_video_id_key rename to media_mux_asset_id_key;

alter table public.media
  add column mux_upload_id text,
  add column mux_playback_id text,
  add column thumbnail_url text;

-- O upload é criado antes do asset: é por ele que o webhook acha a mídia.
create unique index media_mux_upload_id_key on public.media (mux_upload_id) where mux_upload_id is not null;

-- Os guids que estavam na coluna são do Bunny e não existem no Mux. Ficam como falha
-- para o dono reenviar; a limpeza diária remove as linhas mortas depois de 24 h.
update public.media set mux_asset_id = null, status = 'failed' where kind = 'video' and mux_asset_id is not null;

-- Limite de 15 segundos por vídeo (os 50 por vitrine já são o teto do Pro).
update public.plans set max_video_seconds = 15;

-- Funções que devolviam bunny_video_id.
drop function public.media_cleanup_candidates(interval);
create function public.media_cleanup_candidates(p_older_than interval default interval '24 hours')
returns table (id uuid, storage_paths jsonb, mux_asset_id text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.storage_paths, m.mux_asset_id
  from public.media m
  where (m.status = 'failed' and m.updated_at < now() - p_older_than)
     or (m.status = 'processing' and m.created_at < now() - p_older_than)
     or (m.item_id is null and m.role in ('cover', 'gallery', 'video') and m.created_at < now() - p_older_than);
$$;

revoke execute on function public.media_cleanup_candidates(interval) from public, anon, authenticated;
grant execute on function public.media_cleanup_candidates(interval) to service_role;

drop function public.videos_to_delete_after_pro(int);
drop function public.excess_video_media(uuid[]);

create function public.excess_video_media(p_user_ids uuid[])
returns table (id uuid, owner_id uuid, subdomain text, storage_paths jsonb, mux_asset_id text)
language sql
stable
security definer
set search_path = ''
as $$
  with ranked as (
    select
      m.id,
      m.owner_id,
      v.subdomain,
      m.storage_paths,
      m.mux_asset_id,
      row_number() over (
        partition by m.owner_id
        order by v.position, v.created_at, c.position nulls last, i.position, i.created_at
      ) as ordem
    from public.media m
    join public.items i on i.id = m.item_id and i.deleted_at is null
    join public.vitrines v on v.id = m.vitrine_id
    left join public.categories c on c.id = i.category_id
    where m.owner_id = any (p_user_ids)
      and m.role = 'video'
  )
  select r.id, r.owner_id, r.subdomain, r.storage_paths, r.mux_asset_id
  from ranked r
  where r.ordem > (
    select coalesce(p.max_videos_per_account, 2147483647) from public.plans p where p.id = 'free'
  );
$$;

revoke execute on function public.excess_video_media(uuid[]) from public, anon, authenticated;

create function public.videos_to_delete_after_pro(p_days int default 90)
returns table (id uuid, owner_id uuid, subdomain text, storage_paths jsonb, mux_asset_id text)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.owner_id, e.subdomain, e.storage_paths, e.mux_asset_id
  from public.excess_video_media(array(select u from public.users_pro_ended_between(p_days) u)) e;
$$;

revoke execute on function public.videos_to_delete_after_pro(int) from public, anon, authenticated;
grant execute on function public.videos_to_delete_after_pro(int) to service_role;
