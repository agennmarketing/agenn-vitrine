-- Estado da sessão do JWT atual numa única consulta (usado pelo proxy e pelas
-- rotas de API). Substitui getUser() + select em profiles.
--   anonymous: sem usuário no JWT
--   revoked:   a sessão do JWT não existe mais em auth.sessions (saiu, "sair de todos")
--   replaced:  outra sessão foi marcada como ativa (sessão única)
--   current:   sessão válida e ativa
create function public.session_state()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when auth.uid() is null then 'anonymous'
    when not exists (
      select 1
      from auth.sessions s
      where s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid
        and s.user_id = auth.uid()
    ) then 'revoked'
    when exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.active_session_id is not null
        and p.active_session_id is distinct from nullif(auth.jwt() ->> 'session_id', '')::uuid
    ) then 'replaced'
    else 'current'
  end;
$$;

revoke execute on function public.session_state() from public, anon;
grant execute on function public.session_state() to authenticated;
