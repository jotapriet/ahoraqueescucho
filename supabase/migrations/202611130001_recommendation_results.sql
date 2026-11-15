begin;

-- Vista pública con RLS heredado; estado personal calculado con la identidad del JWT.
create view public.recommendation_details with (security_invoker = true) as
select r.id, r.album_id, r.user_id, r.contexts, r.energy, r.moods, r.language,
  r.comment, r.created_at, p.display_name, s.likes,
  exists (select 1 from public.recommendation_votes v
    where v.recommendation_id = r.id and v.user_id = (select auth.uid())) as has_voted
from public.recommendations r
join public.profiles p on p.id = r.user_id
join public.recommendation_stats s on s.recommendation_id = r.id;
grant select on public.recommendation_details to anon, authenticated;

create view public.album_mood_stats with (security_invoker = true) as
select r.album_id, tag as mood, count(*)::bigint as recommendations
from public.recommendations r cross join lateral unnest(r.moods) as tag
group by r.album_id, tag;
grant select on public.album_mood_stats to anon, authenticated;

-- Setter idempotente. La identidad siempre procede del JWT, nunca de parámetros.
create function public.set_recommendation_vote(p_recommendation_id uuid, p_voted boolean)
returns table (likes bigint, has_voted boolean)
language plpgsql security invoker set search_path = '' as $$
declare
  caller uuid := auth.uid();
  author uuid;
begin
  if caller is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_voted is null then raise exception 'vote state required' using errcode = '22023'; end if;
  -- Serializa peticiones simultáneas del mismo usuario y reseña.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(caller::text || ':' || p_recommendation_id::text, 0));
  select r.user_id into author from public.recommendations r where r.id = p_recommendation_id;
  if not found then raise exception 'recommendation not found' using errcode = 'P0002'; end if;
  if author = caller then raise exception 'self vote forbidden' using errcode = '42501'; end if;
  if p_voted then
    insert into public.recommendation_votes (recommendation_id, user_id)
    values (p_recommendation_id, caller) on conflict do nothing;
  else
    delete from public.recommendation_votes v where v.recommendation_id = p_recommendation_id and v.user_id = caller;
  end if;
  return query select count(*)::bigint,
    exists (select 1 from public.recommendation_votes mine where mine.recommendation_id = p_recommendation_id and mine.user_id = caller)
    from public.recommendation_votes votes where votes.recommendation_id = p_recommendation_id;
end;
$$;
revoke all on function public.set_recommendation_vote(uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_recommendation_vote(uuid, boolean) to authenticated;

commit;
