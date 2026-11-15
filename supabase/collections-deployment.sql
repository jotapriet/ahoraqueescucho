begin;
create table public.curator_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check(char_length(btrim(title)) between 3 and 100),
  introduction text not null check(char_length(btrim(introduction)) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.curator_collection_albums (
  collection_id uuid not null references public.curator_collections(id) on delete cascade,
  album_id uuid not null references public.albums(id) on delete restrict,
  position smallint not null check(position between 1 and 12),
  primary key(collection_id, album_id),
  unique(collection_id, position)
);
create index curator_collections_user_idx on public.curator_collections(user_id, updated_at desc, id);
create index curator_collections_directory_idx on public.curator_collections(updated_at desc, id);
create index curator_collection_albums_album_idx on public.curator_collection_albums(album_id);
create trigger curator_collections_updated before update on public.curator_collections
for each row execute function public.touch_updated_at();
alter table public.curator_collections enable row level security;
alter table public.curator_collection_albums enable row level security;
revoke all on public.curator_collections, public.curator_collection_albums from public, anon, authenticated;
grant select on public.curator_collections, public.curator_collection_albums to anon, authenticated;
grant all on public.curator_collections, public.curator_collection_albums to service_role;
create policy collections_public_read on public.curator_collections for select to anon, authenticated using(true);
create policy collection_albums_public_read on public.curator_collection_albums for select to anon, authenticated using(true);

-- Solo estas funciones pueden escribir desde una sesión normal. Se publica el conjunto
-- completo en una transacción, sin exponer borradores incompletos ni permitir cambiar de autor.
create function public.save_curator_collection(p_id uuid, p_title text, p_introduction text, p_album_ids uuid[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); owner_id uuid;
begin
  if actor is null then raise exception 'authentication required' using errcode='28000'; end if;
  if not exists(select 1 from public.profiles where id=actor and nick is not null) then
    raise exception 'choose a nick first' using errcode='23514';
  end if;
  if p_id is null or p_title is null or char_length(btrim(p_title)) not between 3 and 100
    or p_introduction is null or char_length(btrim(p_introduction)) not between 1 and 1000
    or p_album_ids is null or cardinality(p_album_ids) not between 2 and 12
    or array_position(p_album_ids,null) is not null
    or (select count(distinct a) from unnest(p_album_ids) a) <> cardinality(p_album_ids) then
    raise exception 'invalid collection' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text,4));
  select user_id into owner_id from public.curator_collections where id=p_id;
  if owner_id is not null and owner_id <> actor then raise exception 'not owner' using errcode='42501'; end if;
  if exists(select 1 from unnest(p_album_ids) a where not exists(select 1 from public.recommendations r where r.album_id=a)) then
    raise exception 'album not in collection' using errcode='P0002';
  end if;
  if owner_id is null then
    insert into public.curator_collections(id,user_id,title,introduction) values(p_id,actor,btrim(p_title),btrim(p_introduction));
  else
    update public.curator_collections set title=btrim(p_title), introduction=btrim(p_introduction) where id=p_id and user_id=actor;
    delete from public.curator_collection_albums where collection_id=p_id;
  end if;
  insert into public.curator_collection_albums(collection_id,album_id,position)
    select p_id, a.id, a.ord::smallint from unnest(p_album_ids) with ordinality as a(id,ord);
  return p_id;
end;
$$;
revoke all on function public.save_curator_collection(uuid,text,text,uuid[]) from public, anon;
grant execute on function public.save_curator_collection(uuid,text,text,uuid[]) to authenticated;

create function public.delete_curator_collection(p_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); owner_id uuid;
begin
  if actor is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_id is null then raise exception 'invalid collection' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text,4));
  select user_id into owner_id from public.curator_collections where id=p_id;
  if owner_id is null then return false; end if;
  if owner_id <> actor then raise exception 'not owner' using errcode='42501'; end if;
  delete from public.curator_collections where id=p_id and user_id=actor;
  return found;
end;
$$;
revoke all on function public.delete_curator_collection(uuid) from public, anon;
grant execute on function public.delete_curator_collection(uuid) to authenticated;

create function public.search_collection_albums(p_query text default '')
returns table(id uuid,title text,artists text[],cover_url text)
language sql stable security invoker set search_path = '' as $$
  select a.id,a.title,a.artists,a.cover_url from public.albums a
  where char_length(p_query) <= 120
    and exists(select 1 from public.recommendations r where r.album_id=a.id)
    and (btrim(p_query)='' or position(lower(btrim(p_query)) in lower(a.title || ' ' || array_to_string(a.artists,' '))) > 0)
  order by a.created_at desc,a.id limit 12;
$$;
revoke all on function public.search_collection_albums(text) from public;
grant execute on function public.search_collection_albums(text) to anon, authenticated;
insert into supabase_migrations.schema_migrations(version,name,statements) values ('202611140003','curator_collections',array[$collections_migration$begin;

create table public.curator_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check(char_length(btrim(title)) between 3 and 100),
  introduction text not null check(char_length(btrim(introduction)) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.curator_collection_albums (
  collection_id uuid not null references public.curator_collections(id) on delete cascade,
  album_id uuid not null references public.albums(id) on delete restrict,
  position smallint not null check(position between 1 and 12),
  primary key(collection_id, album_id),
  unique(collection_id, position)
);
create index curator_collections_user_idx on public.curator_collections(user_id, updated_at desc, id);
create index curator_collections_directory_idx on public.curator_collections(updated_at desc, id);
create index curator_collection_albums_album_idx on public.curator_collection_albums(album_id);
create trigger curator_collections_updated before update on public.curator_collections
for each row execute function public.touch_updated_at();
alter table public.curator_collections enable row level security;
alter table public.curator_collection_albums enable row level security;
revoke all on public.curator_collections, public.curator_collection_albums from public, anon, authenticated;
grant select on public.curator_collections, public.curator_collection_albums to anon, authenticated;
grant all on public.curator_collections, public.curator_collection_albums to service_role;
create policy collections_public_read on public.curator_collections for select to anon, authenticated using(true);
create policy collection_albums_public_read on public.curator_collection_albums for select to anon, authenticated using(true);

-- Solo estas funciones pueden escribir desde una sesión normal. Se publica el conjunto
-- completo en una transacción, sin exponer borradores incompletos ni permitir cambiar de autor.
create function public.save_curator_collection(p_id uuid, p_title text, p_introduction text, p_album_ids uuid[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); owner_id uuid;
begin
  if actor is null then raise exception 'authentication required' using errcode='28000'; end if;
  if not exists(select 1 from public.profiles where id=actor and nick is not null) then
    raise exception 'choose a nick first' using errcode='23514';
  end if;
  if p_id is null or p_title is null or char_length(btrim(p_title)) not between 3 and 100
    or p_introduction is null or char_length(btrim(p_introduction)) not between 1 and 1000
    or p_album_ids is null or cardinality(p_album_ids) not between 2 and 12
    or array_position(p_album_ids,null) is not null
    or (select count(distinct a) from unnest(p_album_ids) a) <> cardinality(p_album_ids) then
    raise exception 'invalid collection' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text,4));
  select user_id into owner_id from public.curator_collections where id=p_id;
  if owner_id is not null and owner_id <> actor then raise exception 'not owner' using errcode='42501'; end if;
  if exists(select 1 from unnest(p_album_ids) a where not exists(select 1 from public.recommendations r where r.album_id=a)) then
    raise exception 'album not in collection' using errcode='P0002';
  end if;
  if owner_id is null then
    insert into public.curator_collections(id,user_id,title,introduction) values(p_id,actor,btrim(p_title),btrim(p_introduction));
  else
    update public.curator_collections set title=btrim(p_title), introduction=btrim(p_introduction) where id=p_id and user_id=actor;
    delete from public.curator_collection_albums where collection_id=p_id;
  end if;
  insert into public.curator_collection_albums(collection_id,album_id,position)
    select p_id, a.id, a.ord::smallint from unnest(p_album_ids) with ordinality as a(id,ord);
  return p_id;
end;
$$;
revoke all on function public.save_curator_collection(uuid,text,text,uuid[]) from public, anon;
grant execute on function public.save_curator_collection(uuid,text,text,uuid[]) to authenticated;

create function public.delete_curator_collection(p_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); owner_id uuid;
begin
  if actor is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_id is null then raise exception 'invalid collection' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text,4));
  select user_id into owner_id from public.curator_collections where id=p_id;
  if owner_id is null then return false; end if;
  if owner_id <> actor then raise exception 'not owner' using errcode='42501'; end if;
  delete from public.curator_collections where id=p_id and user_id=actor;
  return found;
end;
$$;
revoke all on function public.delete_curator_collection(uuid) from public, anon;
grant execute on function public.delete_curator_collection(uuid) to authenticated;

create function public.search_collection_albums(p_query text default '')
returns table(id uuid,title text,artists text[],cover_url text)
language sql stable security invoker set search_path = '' as $$
  select a.id,a.title,a.artists,a.cover_url from public.albums a
  where char_length(p_query) <= 120
    and exists(select 1 from public.recommendations r where r.album_id=a.id)
    and (btrim(p_query)='' or position(lower(btrim(p_query)) in lower(a.title || ' ' || array_to_string(a.artists,' '))) > 0)
  order by a.created_at desc,a.id limit 12;
$$;
revoke all on function public.search_collection_albums(text) from public;
grant execute on function public.search_collection_albums(text) to anon, authenticated;

commit;
$collections_migration$]);
commit;
