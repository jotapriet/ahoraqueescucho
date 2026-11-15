begin;
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text not null primary key, statements text[], name text);

-- 202611120001_initial_schema.sql
create type public.listening_context as enum ('active_listening', 'focus_work', 'driving', 'party', 'relaxing_home');
create type public.mood as enum ('melancholic', 'euphoric', 'introspective', 'dark', 'bright', 'nostalgic');
create type public.album_language as enum ('instrumental', 'es', 'en', 'other');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Curador' check (char_length(btrim(display_name)) between 1 and 60),
  avatar_url text check (avatar_url is null or avatar_url ~ '^https://'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.albums (
  id uuid primary key default gen_random_uuid(),
  spotify_id text unique check (spotify_id is null or spotify_id ~ '^[A-Za-z0-9]{22}$'),
  deezer_id text unique check (deezer_id is null or deezer_id ~ '^[0-9]+$'),
  title text not null check (char_length(btrim(title)) between 1 and 500),
  artists text[] not null check (cardinality(artists) > 0 and array_position(artists, null) is null),
  release_year smallint check (release_year between 1800 and 2200),
  genres text[] not null default '{}',
  cover_url text check (cover_url is null or cover_url ~ '^https://'),
  source_url text not null check (source_url ~ '^https://'),
  platform_links jsonb not null default '{}'::jsonb check (
    jsonb_typeof(platform_links) = 'object' and
    platform_links - array['spotify', 'appleMusic', 'youtubeMusic', 'bandcamp', 'tidal']::text[] = '{}'::jsonb and
    not jsonb_path_exists(platform_links, '$.* ? (@.type() != "string")')
  ),
  links_resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint albums_external_identity check (spotify_id is not null or deezer_id is not null)
);

create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  album_id uuid not null references public.albums(id) on delete cascade,
  contexts public.listening_context[] not null,
  energy smallint not null check (energy between 1 and 5),
  moods public.mood[] not null,
  language public.album_language not null,
  comment text not null check (char_length(btrim(comment)) between 1 and 280),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recommendations_user_album_key unique (user_id, album_id),
  constraint recommendations_contexts_valid check (
    cardinality(contexts) between 1 and 5 and array_position(contexts, null) is null
  ),
  constraint recommendations_moods_valid check (
    cardinality(moods) between 1 and 6 and array_position(moods, null) is null
  )
);

create table public.recommendation_votes (
  recommendation_id uuid not null references public.recommendations(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (recommendation_id, user_id)
);

create table public.saved_albums (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  album_id uuid not null references public.albums(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, album_id)
);

-- Persistencia y moderación del botón «Etiquetas incorrectas».
create table public.recommendation_reports (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references public.recommendations(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (recommendation_id, user_id)
);

create index recommendations_moods_gin on public.recommendations using gin (moods);
create index recommendations_contexts_gin on public.recommendations using gin (contexts);
create index recommendations_energy_language_idx on public.recommendations (energy, language);
create index recommendations_album_idx on public.recommendations (album_id);
create index recommendations_user_history_idx on public.recommendations (user_id, created_at desc);
create index votes_user_idx on public.recommendation_votes (user_id);
create index saved_albums_album_idx on public.saved_albums (album_id);
create index saved_albums_history_idx on public.saved_albums (user_id, created_at desc);
create index reports_queue_idx on public.recommendation_reports (status, created_at);
create index reports_user_idx on public.recommendation_reports (user_id);

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_updated before update on public.profiles for each row execute function public.touch_updated_at();
create trigger albums_updated before update on public.albums for each row execute function public.touch_updated_at();
create trigger recommendations_updated before update on public.recommendations for each row execute function public.touch_updated_at();

-- Perfil mínimo: no publicar emails ni copiar metadata sin validar.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
insert into public.profiles (id) select id from auth.users on conflict (id) do nothing;

-- Normalizar arrays para impedir repetir etiquetas y alterar la afinidad.
create function public.normalize_recommendation_tags() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.contexts := array(select distinct tag from unnest(new.contexts) as tag order by tag);
  new.moods := array(select distinct tag from unnest(new.moods) as tag order by tag);
  return new;
end;
$$;
revoke all on function public.normalize_recommendation_tags() from public, anon, authenticated;
create trigger normalize_tags before insert or update on public.recommendations
for each row execute function public.normalize_recommendation_tags();

alter table public.profiles enable row level security;
alter table public.albums enable row level security;
alter table public.recommendations enable row level security;
alter table public.recommendation_votes enable row level security;
alter table public.saved_albums enable row level security;
alter table public.recommendation_reports enable row level security;

revoke all on public.profiles, public.albums, public.recommendations,
  public.recommendation_votes, public.saved_albums, public.recommendation_reports from anon, authenticated;

grant select on public.profiles, public.albums, public.recommendations, public.recommendation_votes to anon, authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;
grant insert (user_id, album_id, contexts, energy, moods, language, comment) on public.recommendations to authenticated;
grant update (contexts, energy, moods, language, comment) on public.recommendations to authenticated;
grant delete on public.recommendations to authenticated;
grant insert (recommendation_id, user_id), delete on public.recommendation_votes to authenticated;
grant select, delete on public.saved_albums to authenticated;
grant insert (user_id, album_id) on public.saved_albums to authenticated;
grant select, delete on public.recommendation_reports to authenticated;
grant insert (recommendation_id, user_id, reason) on public.recommendation_reports to authenticated;
grant all on public.profiles, public.albums, public.recommendations,
  public.recommendation_votes, public.saved_albums, public.recommendation_reports to service_role;

create policy profiles_public_read on public.profiles for select to anon, authenticated using (true);
create policy profiles_owner_update on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- Crear/eliminar perfiles: trigger de Auth y eliminación de cuenta desde el servidor.
create policy albums_public_read on public.albums for select to anon, authenticated using (true);
-- Escritura del catálogo exclusivamente con service_role, tras verificar proveedor en servidor.
create policy recommendations_public_read on public.recommendations for select to anon, authenticated using (true);
create policy recommendations_owner_insert on public.recommendations for insert to authenticated with check (user_id = (select auth.uid()));
create policy recommendations_owner_update on public.recommendations for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy recommendations_owner_delete on public.recommendations for delete to authenticated using (user_id = (select auth.uid()));
-- Votos públicos para permitir agregados con security_invoker; no incluir datos privados aquí.
create policy votes_public_read on public.recommendation_votes for select to anon, authenticated using (true);
create policy votes_owner_insert on public.recommendation_votes for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (
    select 1 from public.recommendations r where r.id = recommendation_id and r.user_id <> (select auth.uid())
  )
);
create policy votes_owner_delete on public.recommendation_votes for delete to authenticated using (user_id = (select auth.uid()));
create policy saved_owner_read on public.saved_albums for select to authenticated using (user_id = (select auth.uid()));
create policy saved_owner_insert on public.saved_albums for insert to authenticated with check (user_id = (select auth.uid()));
create policy saved_owner_delete on public.saved_albums for delete to authenticated using (user_id = (select auth.uid()));
create policy reports_owner_read on public.recommendation_reports for select to authenticated using (user_id = (select auth.uid()));
create policy reports_owner_insert on public.recommendation_reports for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (
    select 1 from public.recommendations r where r.id = recommendation_id and r.user_id <> (select auth.uid())
  )
);
create policy reports_owner_delete on public.recommendation_reports for delete to authenticated using (user_id = (select auth.uid()));
-- Sin UPDATE para votos/pendientes; estado de reportes solo desde moderación en servidor.

create view public.recommendation_stats with (security_invoker = true) as
select r.id as recommendation_id, count(v.user_id)::bigint as likes
from public.recommendations r
left join public.recommendation_votes v on v.recommendation_id = r.id
group by r.id;

create view public.curator_stats with (security_invoker = true) as
select p.id as user_id,
  (select count(*) from public.recommendations r where r.user_id = p.id) as recommendations_count,
  (select count(*) from public.recommendation_votes v
   join public.recommendations r on r.id = v.recommendation_id where r.user_id = p.id) as likes_received
from public.profiles p;
grant select on public.recommendation_stats, public.curator_stats to anon, authenticated, service_role;

-- Un resultado por álbum. Todos los criterios se evalúan sobre UNA misma reseña.
-- Los moods usan afinidad parcial; contexto/idioma (si existe) y energía son filtros.
create function public.discover_albums(
  p_context public.listening_context,
  p_energy integer,
  p_moods public.mood[] default '{}'::public.mood[],
  p_language public.album_language default null,
  p_excluded uuid[] default '{}'::uuid[],
  p_limit integer default 12
) returns table (album_id uuid, recommendation_id uuid, mood_affinity integer, energy_distance integer, likes bigint)
language sql stable security invoker set search_path = '' as $$
  with candidates as (
    select r.album_id, r.id as recommendation_id,
      (select count(distinct m)::integer from unnest(r.moods) m
       where m = any(coalesce(p_moods, '{}'::public.mood[]))) as mood_affinity,
      abs(r.energy - p_energy) as energy_distance,
      s.likes
    from public.recommendations r
    join public.recommendation_stats s on s.recommendation_id = r.id
    where p_energy between 1 and 5
      and r.energy between p_energy - 1 and p_energy + 1
      and r.contexts @> array[p_context]
      and (coalesce(cardinality(p_moods), 0) = 0 or r.moods && p_moods)
      and (p_language is null or r.language = p_language)
      and not (r.album_id = any(coalesce(p_excluded, '{}'::uuid[])))
  ), ranked as (
    select c.*, row_number() over (
      partition by c.album_id order by c.mood_affinity desc, c.likes desc, c.energy_distance, c.recommendation_id
    ) as position from candidates c
  )
  select r.album_id, r.recommendation_id, r.mood_affinity, r.energy_distance, r.likes
  from ranked r where r.position = 1
  order by r.mood_affinity desc, r.likes desc, r.energy_distance, r.album_id
  limit least(greatest(coalesce(p_limit, 12), 1), 50);
$$;
revoke all on function public.discover_albums(public.listening_context, integer, public.mood[], public.album_language, uuid[], integer) from public, anon, authenticated;
grant execute on function public.discover_albums(public.listening_context, integer, public.mood[], public.album_language, uuid[], integer) to anon, authenticated, service_role;
insert into supabase_migrations.schema_migrations(version,name,statements) values ('202611120001','initial_schema',array[$aqe_migration_0$begin;

create type public.listening_context as enum ('active_listening', 'focus_work', 'driving', 'party', 'relaxing_home');
create type public.mood as enum ('melancholic', 'euphoric', 'introspective', 'dark', 'bright', 'nostalgic');
create type public.album_language as enum ('instrumental', 'es', 'en', 'other');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Curador' check (char_length(btrim(display_name)) between 1 and 60),
  avatar_url text check (avatar_url is null or avatar_url ~ '^https://'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.albums (
  id uuid primary key default gen_random_uuid(),
  spotify_id text unique check (spotify_id is null or spotify_id ~ '^[A-Za-z0-9]{22}$'),
  deezer_id text unique check (deezer_id is null or deezer_id ~ '^[0-9]+$'),
  title text not null check (char_length(btrim(title)) between 1 and 500),
  artists text[] not null check (cardinality(artists) > 0 and array_position(artists, null) is null),
  release_year smallint check (release_year between 1800 and 2200),
  genres text[] not null default '{}',
  cover_url text check (cover_url is null or cover_url ~ '^https://'),
  source_url text not null check (source_url ~ '^https://'),
  platform_links jsonb not null default '{}'::jsonb check (
    jsonb_typeof(platform_links) = 'object' and
    platform_links - array['spotify', 'appleMusic', 'youtubeMusic', 'bandcamp', 'tidal']::text[] = '{}'::jsonb and
    not jsonb_path_exists(platform_links, '$.* ? (@.type() != "string")')
  ),
  links_resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint albums_external_identity check (spotify_id is not null or deezer_id is not null)
);

create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  album_id uuid not null references public.albums(id) on delete cascade,
  contexts public.listening_context[] not null,
  energy smallint not null check (energy between 1 and 5),
  moods public.mood[] not null,
  language public.album_language not null,
  comment text not null check (char_length(btrim(comment)) between 1 and 280),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recommendations_user_album_key unique (user_id, album_id),
  constraint recommendations_contexts_valid check (
    cardinality(contexts) between 1 and 5 and array_position(contexts, null) is null
  ),
  constraint recommendations_moods_valid check (
    cardinality(moods) between 1 and 6 and array_position(moods, null) is null
  )
);

create table public.recommendation_votes (
  recommendation_id uuid not null references public.recommendations(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (recommendation_id, user_id)
);

create table public.saved_albums (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  album_id uuid not null references public.albums(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, album_id)
);

-- Persistencia y moderación del botón «Etiquetas incorrectas».
create table public.recommendation_reports (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references public.recommendations(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (recommendation_id, user_id)
);

create index recommendations_moods_gin on public.recommendations using gin (moods);
create index recommendations_contexts_gin on public.recommendations using gin (contexts);
create index recommendations_energy_language_idx on public.recommendations (energy, language);
create index recommendations_album_idx on public.recommendations (album_id);
create index recommendations_user_history_idx on public.recommendations (user_id, created_at desc);
create index votes_user_idx on public.recommendation_votes (user_id);
create index saved_albums_album_idx on public.saved_albums (album_id);
create index saved_albums_history_idx on public.saved_albums (user_id, created_at desc);
create index reports_queue_idx on public.recommendation_reports (status, created_at);
create index reports_user_idx on public.recommendation_reports (user_id);

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_updated before update on public.profiles for each row execute function public.touch_updated_at();
create trigger albums_updated before update on public.albums for each row execute function public.touch_updated_at();
create trigger recommendations_updated before update on public.recommendations for each row execute function public.touch_updated_at();

-- Perfil mínimo: no publicar emails ni copiar metadata sin validar.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
insert into public.profiles (id) select id from auth.users on conflict (id) do nothing;

-- Normalizar arrays para impedir repetir etiquetas y alterar la afinidad.
create function public.normalize_recommendation_tags() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.contexts := array(select distinct tag from unnest(new.contexts) as tag order by tag);
  new.moods := array(select distinct tag from unnest(new.moods) as tag order by tag);
  return new;
end;
$$;
revoke all on function public.normalize_recommendation_tags() from public, anon, authenticated;
create trigger normalize_tags before insert or update on public.recommendations
for each row execute function public.normalize_recommendation_tags();

alter table public.profiles enable row level security;
alter table public.albums enable row level security;
alter table public.recommendations enable row level security;
alter table public.recommendation_votes enable row level security;
alter table public.saved_albums enable row level security;
alter table public.recommendation_reports enable row level security;

revoke all on public.profiles, public.albums, public.recommendations,
  public.recommendation_votes, public.saved_albums, public.recommendation_reports from anon, authenticated;

grant select on public.profiles, public.albums, public.recommendations, public.recommendation_votes to anon, authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;
grant insert (user_id, album_id, contexts, energy, moods, language, comment) on public.recommendations to authenticated;
grant update (contexts, energy, moods, language, comment) on public.recommendations to authenticated;
grant delete on public.recommendations to authenticated;
grant insert (recommendation_id, user_id), delete on public.recommendation_votes to authenticated;
grant select, delete on public.saved_albums to authenticated;
grant insert (user_id, album_id) on public.saved_albums to authenticated;
grant select, delete on public.recommendation_reports to authenticated;
grant insert (recommendation_id, user_id, reason) on public.recommendation_reports to authenticated;
grant all on public.profiles, public.albums, public.recommendations,
  public.recommendation_votes, public.saved_albums, public.recommendation_reports to service_role;

create policy profiles_public_read on public.profiles for select to anon, authenticated using (true);
create policy profiles_owner_update on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- Crear/eliminar perfiles: trigger de Auth y eliminación de cuenta desde el servidor.
create policy albums_public_read on public.albums for select to anon, authenticated using (true);
-- Escritura del catálogo exclusivamente con service_role, tras verificar proveedor en servidor.
create policy recommendations_public_read on public.recommendations for select to anon, authenticated using (true);
create policy recommendations_owner_insert on public.recommendations for insert to authenticated with check (user_id = (select auth.uid()));
create policy recommendations_owner_update on public.recommendations for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy recommendations_owner_delete on public.recommendations for delete to authenticated using (user_id = (select auth.uid()));
-- Votos públicos para permitir agregados con security_invoker; no incluir datos privados aquí.
create policy votes_public_read on public.recommendation_votes for select to anon, authenticated using (true);
create policy votes_owner_insert on public.recommendation_votes for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (
    select 1 from public.recommendations r where r.id = recommendation_id and r.user_id <> (select auth.uid())
  )
);
create policy votes_owner_delete on public.recommendation_votes for delete to authenticated using (user_id = (select auth.uid()));
create policy saved_owner_read on public.saved_albums for select to authenticated using (user_id = (select auth.uid()));
create policy saved_owner_insert on public.saved_albums for insert to authenticated with check (user_id = (select auth.uid()));
create policy saved_owner_delete on public.saved_albums for delete to authenticated using (user_id = (select auth.uid()));
create policy reports_owner_read on public.recommendation_reports for select to authenticated using (user_id = (select auth.uid()));
create policy reports_owner_insert on public.recommendation_reports for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (
    select 1 from public.recommendations r where r.id = recommendation_id and r.user_id <> (select auth.uid())
  )
);
create policy reports_owner_delete on public.recommendation_reports for delete to authenticated using (user_id = (select auth.uid()));
-- Sin UPDATE para votos/pendientes; estado de reportes solo desde moderación en servidor.

create view public.recommendation_stats with (security_invoker = true) as
select r.id as recommendation_id, count(v.user_id)::bigint as likes
from public.recommendations r
left join public.recommendation_votes v on v.recommendation_id = r.id
group by r.id;

create view public.curator_stats with (security_invoker = true) as
select p.id as user_id,
  (select count(*) from public.recommendations r where r.user_id = p.id) as recommendations_count,
  (select count(*) from public.recommendation_votes v
   join public.recommendations r on r.id = v.recommendation_id where r.user_id = p.id) as likes_received
from public.profiles p;
grant select on public.recommendation_stats, public.curator_stats to anon, authenticated, service_role;

-- Un resultado por álbum. Todos los criterios se evalúan sobre UNA misma reseña.
-- Los moods usan afinidad parcial; contexto/idioma (si existe) y energía son filtros.
create function public.discover_albums(
  p_context public.listening_context,
  p_energy integer,
  p_moods public.mood[] default '{}'::public.mood[],
  p_language public.album_language default null,
  p_excluded uuid[] default '{}'::uuid[],
  p_limit integer default 12
) returns table (album_id uuid, recommendation_id uuid, mood_affinity integer, energy_distance integer, likes bigint)
language sql stable security invoker set search_path = '' as $$
  with candidates as (
    select r.album_id, r.id as recommendation_id,
      (select count(distinct m)::integer from unnest(r.moods) m
       where m = any(coalesce(p_moods, '{}'::public.mood[]))) as mood_affinity,
      abs(r.energy - p_energy) as energy_distance,
      s.likes
    from public.recommendations r
    join public.recommendation_stats s on s.recommendation_id = r.id
    where p_energy between 1 and 5
      and r.energy between p_energy - 1 and p_energy + 1
      and r.contexts @> array[p_context]
      and (coalesce(cardinality(p_moods), 0) = 0 or r.moods && p_moods)
      and (p_language is null or r.language = p_language)
      and not (r.album_id = any(coalesce(p_excluded, '{}'::uuid[])))
  ), ranked as (
    select c.*, row_number() over (
      partition by c.album_id order by c.mood_affinity desc, c.likes desc, c.energy_distance, c.recommendation_id
    ) as position from candidates c
  )
  select r.album_id, r.recommendation_id, r.mood_affinity, r.energy_distance, r.likes
  from ranked r where r.position = 1
  order by r.mood_affinity desc, r.likes desc, r.energy_distance, r.album_id
  limit least(greatest(coalesce(p_limit, 12), 1), 50);
$$;
revoke all on function public.discover_albums(public.listening_context, integer, public.mood[], public.album_language, uuid[], integer) from public, anon, authenticated;
grant execute on function public.discover_albums(public.listening_context, integer, public.mood[], public.album_language, uuid[], integer) to anon, authenticated, service_role;

commit;
$aqe_migration_0$]);

-- 202611130001_recommendation_results.sql
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
insert into supabase_migrations.schema_migrations(version,name,statements) values ('202611130001','recommendation_results',array[$aqe_migration_1$begin;

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
$aqe_migration_1$]);

-- 202611130002_publish_recommendation.sql
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
insert into supabase_migrations.schema_migrations(version,name,statements) values ('202611130002','publish_recommendation',array[$aqe_migration_2$begin;

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
$aqe_migration_2$]);

commit;
