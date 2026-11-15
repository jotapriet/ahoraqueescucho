begin;

-- Un álbum por tarjeta, aunque tenga varias recomendaciones; nunca pendientes privados.
create function public.random_inspiration_albums()
returns table(id uuid, title text, artists text[], release_year smallint, cover_url text, source_url text)
language sql volatile security invoker set search_path = '' as $$
  select a.id, a.title, a.artists, a.release_year, a.cover_url, a.source_url
  from public.albums a
  where exists (select 1 from public.recommendations r where r.album_id = a.id)
  order by random()
  limit 3;
$$;
revoke all on function public.random_inspiration_albums() from public;
grant execute on function public.random_inspiration_albums() to anon, authenticated;

commit;
