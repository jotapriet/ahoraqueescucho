begin;
-- NULL representa exclusivamente un alta pendiente de elegir identidad.
alter table public.profiles add column nick text unique
  check (nick ~ '^[a-z0-9_]{3,24}$');

create function public.protect_profile_nick() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.nick is not null and new.nick is distinct from old.nick then
    raise exception 'nick is immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.protect_profile_nick() from public, anon, authenticated;
create trigger profiles_nick_immutable before update on public.profiles
for each row execute function public.protect_profile_nick();

-- Nunca conceder UPDATE(nick) a los clientes. El primer registro es atómico.
create function public.claim_profile_nick(p_nick text) returns text
language plpgsql security definer set search_path = '' as $$
declare chosen text := lower(btrim(p_nick));
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if chosen is null or chosen !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'invalid nick' using errcode = '22023';
  end if;
  update public.profiles set nick = chosen where id = auth.uid() and nick is null;
  if not found then raise exception 'nick already chosen' using errcode = '42501'; end if;
  return chosen;
end;
$$;
revoke all on function public.claim_profile_nick(text) from public, anon;
grant execute on function public.claim_profile_nick(text) to authenticated;

create function public.require_curator_nick() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles where id = new.user_id and nick is not null) then
    raise exception 'choose a nick before publishing' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.require_curator_nick() from public, anon, authenticated;
create trigger recommendations_require_nick before insert on public.recommendations
for each row execute function public.require_curator_nick();

create or replace view public.recommendation_details with (security_invoker = true) as
select r.id, r.album_id, r.user_id, r.contexts, r.energy, r.moods, r.language,
  r.comment, r.created_at, p.display_name, s.likes,
  exists (select 1 from public.recommendation_votes v
    where v.recommendation_id = r.id and v.user_id = (select auth.uid())) as has_voted,
  p.nick, p.avatar_url
from public.recommendations r
join public.profiles p on p.id = r.user_id
join public.recommendation_stats s on s.recommendation_id = r.id;

-- Fotos públicas; las escrituras solo se permiten dentro de la carpeta propia.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 786432, array['image/jpeg','image/png','image/webp']);
create policy avatars_owner_insert on storage.objects for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_owner_select on storage.objects for select to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_owner_delete on storage.objects for delete to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Las políticas de saved_albums permanecen exclusivas del propietario.

insert into supabase_migrations.schema_migrations(version,name,statements) values ('202611130003','curator_profiles',array[$profile_migration$begin;

-- NULL representa exclusivamente un alta pendiente de elegir identidad.
alter table public.profiles add column nick text unique
  check (nick ~ '^[a-z0-9_]{3,24}$');

create function public.protect_profile_nick() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.nick is not null and new.nick is distinct from old.nick then
    raise exception 'nick is immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.protect_profile_nick() from public, anon, authenticated;
create trigger profiles_nick_immutable before update on public.profiles
for each row execute function public.protect_profile_nick();

-- Nunca conceder UPDATE(nick) a los clientes. El primer registro es atómico.
create function public.claim_profile_nick(p_nick text) returns text
language plpgsql security definer set search_path = '' as $$
declare chosen text := lower(btrim(p_nick));
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if chosen is null or chosen !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'invalid nick' using errcode = '22023';
  end if;
  update public.profiles set nick = chosen where id = auth.uid() and nick is null;
  if not found then raise exception 'nick already chosen' using errcode = '42501'; end if;
  return chosen;
end;
$$;
revoke all on function public.claim_profile_nick(text) from public, anon;
grant execute on function public.claim_profile_nick(text) to authenticated;

create function public.require_curator_nick() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles where id = new.user_id and nick is not null) then
    raise exception 'choose a nick before publishing' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.require_curator_nick() from public, anon, authenticated;
create trigger recommendations_require_nick before insert on public.recommendations
for each row execute function public.require_curator_nick();

create or replace view public.recommendation_details with (security_invoker = true) as
select r.id, r.album_id, r.user_id, r.contexts, r.energy, r.moods, r.language,
  r.comment, r.created_at, p.display_name, s.likes,
  exists (select 1 from public.recommendation_votes v
    where v.recommendation_id = r.id and v.user_id = (select auth.uid())) as has_voted,
  p.nick, p.avatar_url
from public.recommendations r
join public.profiles p on p.id = r.user_id
join public.recommendation_stats s on s.recommendation_id = r.id;

-- Fotos públicas; las escrituras solo se permiten dentro de la carpeta propia.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 786432, array['image/jpeg','image/png','image/webp']);
create policy avatars_owner_insert on storage.objects for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_owner_select on storage.objects for select to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_owner_delete on storage.objects for delete to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Las políticas de saved_albums permanecen exclusivas del propietario.
commit;
$profile_migration$]);
commit;
