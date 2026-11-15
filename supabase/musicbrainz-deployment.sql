begin;
alter table public.albums add column musicbrainz_id uuid unique;
alter table public.albums drop constraint albums_external_identity;
alter table public.albums add constraint albums_external_identity check (spotify_id is not null or deezer_id is not null or musicbrainz_id is not null);
create index albums_catalog_match_idx on public.albums (lower(btrim(title)), lower(btrim(artists[1])), release_year);


-- La RPC solo acepta peticiones del servidor con metadatos ya verificados.
-- Una transacción evita álbumes huérfanos si la reseña no cumple las restricciones.
create or replace function public.publish_recommendation(
  p_user_id uuid, p_provider text, p_external_id text, p_metadata jsonb,
  p_contexts public.listening_context[], p_energy smallint, p_moods public.mood[],
  p_language public.album_language, p_comment text
) returns table (album_id uuid, recommendation_id uuid, created boolean)
language plpgsql security invoker set search_path = '' as $$
declare
  resolved_album uuid;
  resolved_recommendation uuid;
  was_created boolean;
begin
  if p_user_id is null or p_provider not in ('deezer', 'spotify', 'musicbrainz') or p_provider is null
    or p_external_id is null then raise exception 'invalid publication' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_provider || ':' || p_external_id, 1));
  select a.id into resolved_album from public.albums a
    where (p_provider = 'deezer' and a.deezer_id = p_external_id)
       or (p_provider = 'spotify' and a.spotify_id = p_external_id)
       or (p_provider = 'musicbrainz' and a.musicbrainz_id = case when p_provider = 'musicbrainz' then p_external_id::uuid end);
  if resolved_album is null then
    if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then
      raise exception 'verified metadata required' using errcode = '22023';
    end if;
    -- Coincidencia conservadora entre catálogos: mismo título, artista principal y año conocido.
    -- No fusionar ediciones ambiguas ni adivinar por similitud de texto.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(lower(btrim(p_metadata->>'title')) || ':' || lower(btrim(p_metadata->'artists'->>0)) || ':' || coalesce(p_metadata->>'release_year','unknown'), 2));
    select a.id into resolved_album from public.albums a
      where lower(btrim(a.title)) = lower(btrim(p_metadata->>'title'))
        and lower(btrim(a.artists[1])) = lower(btrim(p_metadata->'artists'->>0))
        and a.release_year = (p_metadata->>'release_year')::smallint
      order by a.created_at, a.id limit 1;
    if resolved_album is null then
    insert into public.albums (deezer_id, spotify_id, musicbrainz_id, title, artists, release_year, genres, cover_url, source_url, platform_links, links_resolved_at)
    values (
      case when p_provider = 'deezer' then p_external_id end,
      case when p_provider = 'spotify' then p_external_id end,
      case when p_provider = 'musicbrainz' then p_external_id::uuid end,
      p_metadata->>'title', array(select jsonb_array_elements_text(p_metadata->'artists')),
      (p_metadata->>'release_year')::smallint,
      array(select jsonb_array_elements_text(p_metadata->'genres')),
      p_metadata->>'cover_url', p_metadata->>'source_url',
      coalesce(p_metadata->'platform_links', '{}'::jsonb), (p_metadata->>'links_resolved_at')::timestamptz
    ) returning id into resolved_album;
    else
      update public.albums set
        musicbrainz_id = case when p_provider = 'musicbrainz' then coalesce(musicbrainz_id,p_external_id::uuid) else musicbrainz_id end,
        deezer_id = case when p_provider = 'deezer' then coalesce(deezer_id,p_external_id) else deezer_id end,
        spotify_id = case when p_provider = 'spotify' then coalesce(spotify_id,p_external_id) else spotify_id end,
        platform_links = platform_links || coalesce(p_metadata->'platform_links','{}'::jsonb),
        links_resolved_at = coalesce((p_metadata->>'links_resolved_at')::timestamptz,links_resolved_at)
      where id = resolved_album;
    end if;
  end if;
  insert into public.recommendations (user_id, album_id, contexts, energy, moods, language, comment)
  values (p_user_id, resolved_album, p_contexts, p_energy, p_moods, p_language, btrim(p_comment))
  on conflict on constraint recommendations_user_album_key do nothing returning id into resolved_recommendation;
  was_created := found;
  if not was_created then
    select r.id into resolved_recommendation from public.recommendations r where r.user_id = p_user_id and r.album_id = resolved_album;
  end if;
  return query select resolved_album, resolved_recommendation, was_created;
end;
$$;
revoke all on function public.publish_recommendation(uuid, text, text, jsonb, public.listening_context[], smallint, public.mood[], public.album_language, text) from public, anon, authenticated;
grant execute on function public.publish_recommendation(uuid, text, text, jsonb, public.listening_context[], smallint, public.mood[], public.album_language, text) to service_role;


insert into supabase_migrations.schema_migrations(version,name,statements) values ('202611130005','musicbrainz_catalog',array[$mb_migration$begin;

alter table public.albums add column musicbrainz_id uuid unique;
alter table public.albums drop constraint albums_external_identity;
alter table public.albums add constraint albums_external_identity check (spotify_id is not null or deezer_id is not null or musicbrainz_id is not null);
create index albums_catalog_match_idx on public.albums (lower(btrim(title)), lower(btrim(artists[1])), release_year);


-- La RPC solo acepta peticiones del servidor con metadatos ya verificados.
-- Una transacción evita álbumes huérfanos si la reseña no cumple las restricciones.
create or replace function public.publish_recommendation(
  p_user_id uuid, p_provider text, p_external_id text, p_metadata jsonb,
  p_contexts public.listening_context[], p_energy smallint, p_moods public.mood[],
  p_language public.album_language, p_comment text
) returns table (album_id uuid, recommendation_id uuid, created boolean)
language plpgsql security invoker set search_path = '' as $$
declare
  resolved_album uuid;
  resolved_recommendation uuid;
  was_created boolean;
begin
  if p_user_id is null or p_provider not in ('deezer', 'spotify', 'musicbrainz') or p_provider is null
    or p_external_id is null then raise exception 'invalid publication' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_provider || ':' || p_external_id, 1));
  select a.id into resolved_album from public.albums a
    where (p_provider = 'deezer' and a.deezer_id = p_external_id)
       or (p_provider = 'spotify' and a.spotify_id = p_external_id)
       or (p_provider = 'musicbrainz' and a.musicbrainz_id = case when p_provider = 'musicbrainz' then p_external_id::uuid end);
  if resolved_album is null then
    if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then
      raise exception 'verified metadata required' using errcode = '22023';
    end if;
    -- Coincidencia conservadora entre catálogos: mismo título, artista principal y año conocido.
    -- No fusionar ediciones ambiguas ni adivinar por similitud de texto.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(lower(btrim(p_metadata->>'title')) || ':' || lower(btrim(p_metadata->'artists'->>0)) || ':' || coalesce(p_metadata->>'release_year','unknown'), 2));
    select a.id into resolved_album from public.albums a
      where lower(btrim(a.title)) = lower(btrim(p_metadata->>'title'))
        and lower(btrim(a.artists[1])) = lower(btrim(p_metadata->'artists'->>0))
        and a.release_year = (p_metadata->>'release_year')::smallint
      order by a.created_at, a.id limit 1;
    if resolved_album is null then
    insert into public.albums (deezer_id, spotify_id, musicbrainz_id, title, artists, release_year, genres, cover_url, source_url, platform_links, links_resolved_at)
    values (
      case when p_provider = 'deezer' then p_external_id end,
      case when p_provider = 'spotify' then p_external_id end,
      case when p_provider = 'musicbrainz' then p_external_id::uuid end,
      p_metadata->>'title', array(select jsonb_array_elements_text(p_metadata->'artists')),
      (p_metadata->>'release_year')::smallint,
      array(select jsonb_array_elements_text(p_metadata->'genres')),
      p_metadata->>'cover_url', p_metadata->>'source_url',
      coalesce(p_metadata->'platform_links', '{}'::jsonb), (p_metadata->>'links_resolved_at')::timestamptz
    ) returning id into resolved_album;
    else
      update public.albums set
        musicbrainz_id = case when p_provider = 'musicbrainz' then coalesce(musicbrainz_id,p_external_id::uuid) else musicbrainz_id end,
        deezer_id = case when p_provider = 'deezer' then coalesce(deezer_id,p_external_id) else deezer_id end,
        spotify_id = case when p_provider = 'spotify' then coalesce(spotify_id,p_external_id) else spotify_id end,
        platform_links = platform_links || coalesce(p_metadata->'platform_links','{}'::jsonb),
        links_resolved_at = coalesce((p_metadata->>'links_resolved_at')::timestamptz,links_resolved_at)
      where id = resolved_album;
    end if;
  end if;
  insert into public.recommendations (user_id, album_id, contexts, energy, moods, language, comment)
  values (p_user_id, resolved_album, p_contexts, p_energy, p_moods, p_language, btrim(p_comment))
  on conflict on constraint recommendations_user_album_key do nothing returning id into resolved_recommendation;
  was_created := found;
  if not was_created then
    select r.id into resolved_recommendation from public.recommendations r where r.user_id = p_user_id and r.album_id = resolved_album;
  end if;
  return query select resolved_album, resolved_recommendation, was_created;
end;
$$;
revoke all on function public.publish_recommendation(uuid, text, text, jsonb, public.listening_context[], smallint, public.mood[], public.album_language, text) from public, anon, authenticated;
grant execute on function public.publish_recommendation(uuid, text, text, jsonb, public.listening_context[], smallint, public.mood[], public.album_language, text) to service_role;

commit;
$mb_migration$]);
commit;
