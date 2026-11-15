begin;
create function public.surprise_album(p_exclude_listened boolean default false)
returns table(album_id uuid) language plpgsql volatile security invoker set search_path = '' as $$
begin
  if p_exclude_listened is null then raise exception 'invalid option' using errcode = '22023'; end if;
  if p_exclude_listened then
    if auth.uid() is null then raise exception 'authentication required' using errcode = '28000'; end if;
    return query
      select a.id from public.albums a
      where exists(select 1 from public.recommendations r where r.album_id = a.id)
        and not exists(select 1 from public.listened_albums l where l.album_id = a.id and l.user_id = (select auth.uid()))
      order by random() limit 1;
  else
    -- Rama independiente: los visitantes no necesitan permiso sobre el historial privado.
    return query
      select a.id from public.albums a
      where exists(select 1 from public.recommendations r where r.album_id = a.id)
      order by random() limit 1;
  end if;
end;
$$;
revoke all on function public.surprise_album(boolean) from public;
grant execute on function public.surprise_album(boolean) to anon, authenticated;


insert into supabase_migrations.schema_migrations(version,name,statements) values ('202611140002','surprise_recommendations',array[$surprise_migration$begin;

create function public.surprise_album(p_exclude_listened boolean default false)
returns table(album_id uuid) language plpgsql volatile security invoker set search_path = '' as $$
begin
  if p_exclude_listened is null then raise exception 'invalid option' using errcode = '22023'; end if;
  if p_exclude_listened then
    if auth.uid() is null then raise exception 'authentication required' using errcode = '28000'; end if;
    return query
      select a.id from public.albums a
      where exists(select 1 from public.recommendations r where r.album_id = a.id)
        and not exists(select 1 from public.listened_albums l where l.album_id = a.id and l.user_id = (select auth.uid()))
      order by random() limit 1;
  else
    -- Rama independiente: los visitantes no necesitan permiso sobre el historial privado.
    return query
      select a.id from public.albums a
      where exists(select 1 from public.recommendations r where r.album_id = a.id)
      order by random() limit 1;
  end if;
end;
$$;
revoke all on function public.surprise_album(boolean) from public;
grant execute on function public.surprise_album(boolean) to anon, authenticated;

commit;
$surprise_migration$]);
commit;
