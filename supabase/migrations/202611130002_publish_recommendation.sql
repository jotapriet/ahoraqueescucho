begin;

-- La RPC solo acepta peticiones del servidor con metadatos ya verificados.
-- Una transacción evita álbumes huérfanos si la reseña no cumple las restricciones.
create function public.publish_recommendation(
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
  if p_user_id is null or p_provider not in ('deezer', 'spotify') or p_provider is null
    or p_external_id is null then raise exception 'invalid publication' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_provider || ':' || p_external_id, 1));
  select a.id into resolved_album from public.albums a
    where (p_provider = 'deezer' and a.deezer_id = p_external_id)
       or (p_provider = 'spotify' and a.spotify_id = p_external_id);
  if resolved_album is null then
    if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then
      raise exception 'verified metadata required' using errcode = '22023';
    end if;
    insert into public.albums (deezer_id, spotify_id, title, artists, release_year, genres, cover_url, source_url, platform_links, links_resolved_at)
    values (
      case when p_provider = 'deezer' then p_external_id end,
      case when p_provider = 'spotify' then p_external_id end,
      p_metadata->>'title', array(select jsonb_array_elements_text(p_metadata->'artists')),
      (p_metadata->>'release_year')::smallint,
      array(select jsonb_array_elements_text(p_metadata->'genres')),
      p_metadata->>'cover_url', p_metadata->>'source_url',
      coalesce(p_metadata->'platform_links', '{}'::jsonb), (p_metadata->>'links_resolved_at')::timestamptz
    ) returning id into resolved_album;
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
