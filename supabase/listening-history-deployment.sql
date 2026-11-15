begin;
create table public.listened_albums (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  album_id uuid not null references public.albums(id) on delete cascade,
  listened_on date not null check (listened_on between date '1900-01-01' and (now() at time zone 'Europe/Madrid')::date),
  note text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, album_id)
);
create index listened_albums_history_idx on public.listened_albums(user_id, listened_on desc, album_id);
create index listened_albums_album_idx on public.listened_albums(album_id);
create trigger listened_albums_updated before update on public.listened_albums
for each row execute function public.touch_updated_at();
alter table public.listened_albums enable row level security;
revoke all on public.listened_albums from public, anon, authenticated;
grant select, delete on public.listened_albums to authenticated;
grant insert(user_id, album_id, listened_on, note) on public.listened_albums to authenticated;
grant update(listened_on, note) on public.listened_albums to authenticated;
grant all on public.listened_albums to service_role;
create policy listened_owner_read on public.listened_albums for select to authenticated using (user_id = (select auth.uid()));
create policy listened_owner_insert on public.listened_albums for insert to authenticated with check (user_id = (select auth.uid()));
create policy listened_owner_update on public.listened_albums for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy listened_owner_delete on public.listened_albums for delete to authenticated using (user_id = (select auth.uid()));

-- Una sola transacción: si falla la escritura, el pendiente tampoco se elimina.
-- Un reintento sin pendiente conserva la fecha y nota ya guardadas.
create function public.mark_album_listened(p_album_id uuid, p_listened_on date, p_note text default null)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare viewer uuid := auth.uid(); moved uuid;
begin
  if viewer is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_album_id is null or p_listened_on is null
    or p_listened_on not between date '1900-01-01' and (now() at time zone 'Europe/Madrid')::date
    or char_length(p_note) > 1000 then
    raise exception 'invalid listening entry' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(viewer::text || ':' || p_album_id::text, 3));
  delete from public.saved_albums where user_id = viewer and album_id = p_album_id returning album_id into moved;
  if moved is null then
    if exists(select 1 from public.listened_albums where user_id = viewer and album_id = p_album_id) then return false; end if;
    raise exception 'album is not pending' using errcode = 'P0002';
  end if;
  insert into public.listened_albums(user_id, album_id, listened_on, note)
  values(viewer, p_album_id, p_listened_on, nullif(btrim(p_note), ''))
  on conflict(user_id, album_id) do update set listened_on = excluded.listened_on, note = excluded.note;
  return true;
end;
$$;
revoke all on function public.mark_album_listened(uuid,date,text) from public, anon;
grant execute on function public.mark_album_listened(uuid,date,text) to authenticated;


insert into supabase_migrations.schema_migrations(version,name,statements) values ('202611140001','listening_history',array[$listening_migration$begin;

create table public.listened_albums (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  album_id uuid not null references public.albums(id) on delete cascade,
  listened_on date not null check (listened_on between date '1900-01-01' and (now() at time zone 'Europe/Madrid')::date),
  note text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, album_id)
);
create index listened_albums_history_idx on public.listened_albums(user_id, listened_on desc, album_id);
create index listened_albums_album_idx on public.listened_albums(album_id);
create trigger listened_albums_updated before update on public.listened_albums
for each row execute function public.touch_updated_at();
alter table public.listened_albums enable row level security;
revoke all on public.listened_albums from public, anon, authenticated;
grant select, delete on public.listened_albums to authenticated;
grant insert(user_id, album_id, listened_on, note) on public.listened_albums to authenticated;
grant update(listened_on, note) on public.listened_albums to authenticated;
grant all on public.listened_albums to service_role;
create policy listened_owner_read on public.listened_albums for select to authenticated using (user_id = (select auth.uid()));
create policy listened_owner_insert on public.listened_albums for insert to authenticated with check (user_id = (select auth.uid()));
create policy listened_owner_update on public.listened_albums for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy listened_owner_delete on public.listened_albums for delete to authenticated using (user_id = (select auth.uid()));

-- Una sola transacción: si falla la escritura, el pendiente tampoco se elimina.
-- Un reintento sin pendiente conserva la fecha y nota ya guardadas.
create function public.mark_album_listened(p_album_id uuid, p_listened_on date, p_note text default null)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare viewer uuid := auth.uid(); moved uuid;
begin
  if viewer is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_album_id is null or p_listened_on is null
    or p_listened_on not between date '1900-01-01' and (now() at time zone 'Europe/Madrid')::date
    or char_length(p_note) > 1000 then
    raise exception 'invalid listening entry' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(viewer::text || ':' || p_album_id::text, 3));
  delete from public.saved_albums where user_id = viewer and album_id = p_album_id returning album_id into moved;
  if moved is null then
    if exists(select 1 from public.listened_albums where user_id = viewer and album_id = p_album_id) then return false; end if;
    raise exception 'album is not pending' using errcode = 'P0002';
  end if;
  insert into public.listened_albums(user_id, album_id, listened_on, note)
  values(viewer, p_album_id, p_listened_on, nullif(btrim(p_note), ''))
  on conflict(user_id, album_id) do update set listened_on = excluded.listened_on, note = excluded.note;
  return true;
end;
$$;
revoke all on function public.mark_album_listened(uuid,date,text) from public, anon;
grant execute on function public.mark_album_listened(uuid,date,text) to authenticated;

commit;
$listening_migration$]);
commit;
