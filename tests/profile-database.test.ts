import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const db = new PGlite();
const first = "11111111-1111-4111-8111-111111111111";
const second = "22222222-2222-4222-8222-222222222222";
async function asUser(id: string, role = "authenticated") {
  await db.exec(`reset role; set role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
}
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth, public to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
    grant usage on schema storage to anon,authenticated;
    grant select,insert,delete on storage.objects to authenticated;
  `);
  for (const file of ["202611120001_initial_schema.sql", "202611130001_recommendation_results.sql", "202611130002_publish_recommendation.sql", "202611130003_curator_profiles.sql", "202611130004_random_inspiration.sql", "202611130005_musicbrainz_catalog.sql", "202611140001_listening_history.sql", "202611140002_surprise_recommendations.sql", "202611140003_curator_collections.sql"]) await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  await db.query("insert into auth.users values ($1),($2)", [first, second]);
}, 30000);
afterAll(() => db.close());


it("permite elegir una única vez un nick normalizado y evita duplicados", async () => {
  await asUser(first);
  expect((await db.query("select public.claim_profile_nick('  Mi_Nick  ') as nick")).rows[0]).toEqual({ nick: "mi_nick" });
  await expect(db.query("select public.claim_profile_nick('otro_nick')")).rejects.toMatchObject({ code: "42501" });
  await expect(db.query("update public.profiles set nick='nuevo' where id=$1", [first])).rejects.toMatchObject({ code: "42501" });
  await asUser(second);
  await expect(db.query("select public.claim_profile_nick('MI_NICK')")).rejects.toMatchObject({ code: "23505" });
  await expect(db.query("select public.claim_profile_nick('@invalido')")).rejects.toMatchObject({ code: "22023" });
  expect((await db.query("select public.claim_profile_nick('segundo') as nick")).rows[0]).toEqual({ nick: "segundo" });
});
it("impide renombrar incluso por la vía privilegiada y mantiene editable la foto propia", async () => {
  await asUser(first);
  await db.query("update public.profiles set avatar_url='https://example.test/photo.jpg' where id=$1", [first]);
  expect((await db.query("update public.profiles set avatar_url=null where id=$1 returning id", [second])).rows).toEqual([]);
  await db.exec("reset role");
  await expect(db.query("update public.profiles set nick=null where id=$1", [first])).rejects.toMatchObject({ code: "42501" });
});
it("permite fotos solo en la carpeta propia y no permite borrarlas a otra persona", async () => {
  await asUser(first);
  await db.query("insert into storage.objects(bucket_id,name) values('avatars',$1)", [`${first}/photo.png`]);
  await expect(db.query("insert into storage.objects(bucket_id,name) values('avatars',$1)", [`${second}/forged.png`])).rejects.toMatchObject({ code: "42501" });
  await asUser(second);
  expect((await db.query("delete from storage.objects returning id")).rows).toEqual([]);
  await asUser(first);
  expect((await db.query("delete from storage.objects returning id")).rows).toHaveLength(1);
});
it("expone la identidad pública sin dar acceso anónimo a pendientes", async () => {
  await asUser("", "anon");
  expect((await db.query("select nick from public.profiles where id=$1", [first])).rows[0]).toEqual({ nick: "mi_nick" });
  await expect(db.query("select * from public.saved_albums")).rejects.toMatchObject({ code: "42501" });
  await expect(db.query("select public.claim_profile_nick('anonimo')")).rejects.toMatchObject({ code: "42501" });
});
it("la cubeta devuelve hasta tres álbumes distintos, públicos y aportados, sin duplicar por reseñas", async () => {
  await asUser("", "anon");
  expect((await db.query("select * from public.random_inspiration_albums()")).rows).toEqual([]);
  await db.exec("reset role");
  const albums = await db.query<{ id: string }>("insert into public.albums(deezer_id,title,artists,source_url) select n::text,'Disco '||n,array['Artista'],'https://www.deezer.com/album/'||n from generate_series(1,5) n returning id");
  for (const album of albums.rows.slice(0,4)) await db.query("insert into public.recommendations(user_id,album_id,contexts,energy,moods,language,comment) values($1,$2,array['relaxing_home']::public.listening_context[],2,array['introspective']::public.mood[],'instrumental','Escúchalo despacio.')", [first, album.id]);
  await db.query("insert into public.recommendations(user_id,album_id,contexts,energy,moods,language,comment) values($1,$2,array['relaxing_home']::public.listening_context[],2,array['introspective']::public.mood[],'instrumental','Otra recomendación.')", [second, albums.rows[0].id]);
  await asUser("", "anon");
  const selection = (await db.query<{ id: string }>("select * from public.random_inspiration_albums()")).rows;
  expect(selection).toHaveLength(3);
  expect(new Set(selection.map(row => row.id)).size).toBe(3);
  expect(selection.every(row => albums.rows.slice(0,4).some(album => album.id === row.id))).toBe(true);
  await db.exec("reset role");
  await db.query("delete from public.recommendations where album_id <> $1", [albums.rows[0].id]);
  await asUser("", "anon");
  expect((await db.query("select * from public.random_inspiration_albums()")).rows).toHaveLength(1);
});
it("reutiliza un álbum entre Deezer y MusicBrainz e impide duplicar la recomendación del autor", async () => {
  await asUser(first, "service_role");
  const mbid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const metadata = { title: "Mismo álbum", artists: ["Mismo artista"], release_year: 2020, genres: [], cover_url: null, source_url: "https://www.deezer.com/album/901", platform_links: {}, links_resolved_at: null };
  const sql = "select * from public.publish_recommendation($1,$2,$3,$4::jsonb,array['active_listening']::public.listening_context[],2::smallint,array['bright']::public.mood[],'instrumental','Una escucha completa.')";
  const original = (await db.query<{ album_id: string; created: boolean }>(sql, [first, "deezer", "901", metadata])).rows[0];
  const next = (await db.query<{ album_id: string; created: boolean }>(sql, [second, "musicbrainz", mbid, { ...metadata, source_url: `https://musicbrainz.org/release-group/${mbid}` }])).rows[0];
  expect(next).toMatchObject({ album_id: original.album_id, created: true });
  expect((await db.query(sql, [first, "musicbrainz", mbid, null])).rows[0]).toMatchObject({ album_id: original.album_id, created: false });
  expect((await db.query("select musicbrainz_id,deezer_id from public.albums where id=$1", [original.album_id])).rows[0]).toEqual({ musicbrainz_id: mbid, deezer_id: "901" });
});
it("publica un álbum de MusicBrainz sin necesitar identificadores de Deezer ni Spotify", async () => {
  await asUser(second, "service_role");
  const mbid = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const metadata = { title: "Un álbum independiente", artists: ["Otro artista"], release_year: 2001, genres: [], cover_url: null, source_url: `https://musicbrainz.org/release-group/${mbid}`, platform_links: {}, links_resolved_at: null };
  const sql = "select * from public.publish_recommendation($1,'musicbrainz',$2,$3::jsonb,array['active_listening']::public.listening_context[],2::smallint,array['bright']::public.mood[],'instrumental','Escucha sin depender de una tienda.')";
  const result = (await db.query<{ album_id: string; created: boolean }>(sql, [second, mbid, metadata])).rows[0];
  expect(result.created).toBe(true);
  expect((await db.query("select musicbrainz_id,deezer_id,spotify_id from public.albums where id=$1", [result.album_id])).rows[0]).toEqual({ musicbrainz_id: mbid, deezer_id: null, spotify_id: null });
  expect((await db.query(sql, [second, mbid, null])).rows[0]).toMatchObject({ album_id: result.album_id, created: false });
});

describe("historial privado de escuchas", () => {
  const albumId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  const mark = (date = "2026-01-01", note: string | null = " Una nota privada. ") => db.query<{ marked: boolean }>("select public.mark_album_listened($1,$2::date,$3) as marked", [albumId, date, note]);
  beforeAll(async () => {
    await db.exec("reset role");
    await db.query("insert into public.albums(id,deezer_id,title,artists,source_url) values($1,'999001','Disco del diario',array['Artista'],'https://www.deezer.com/album/999001')", [albumId]);
  });
  beforeEach(async () => {
    await db.exec("reset role");
    await db.query("delete from public.listened_albums where album_id=$1", [albumId]);
    await db.query("delete from public.saved_albums where album_id=$1", [albumId]);
    await asUser(first);
    await db.query("insert into public.saved_albums(album_id) values($1)", [albumId]);
  });
  it("mueve el disco de pendientes al historial con fecha y nota normalizada", async () => {
    expect((await mark()).rows[0]).toEqual({ marked: true });
    expect((await db.query("select * from public.saved_albums where album_id=$1", [albumId])).rows).toEqual([]);
    expect((await db.query("select listened_on::text,note from public.listened_albums where album_id=$1", [albumId])).rows[0]).toEqual({ listened_on: "2026-01-01", note: "Una nota privada." });
  });
  it("los reintentos no duplican ni sobrescriben la escucha ya guardada", async () => {
    await mark();
    expect((await mark("2026-01-02", "Un reintento distinto")).rows[0]).toEqual({ marked: false });
    expect((await db.query("select listened_on::text,note from public.listened_albums where album_id=$1", [albumId])).rows).toEqual([{ listened_on: "2026-01-01", note: "Una nota privada." }]);
  });
  it("acepta nota vacía y permite corregir fecha y nota propias", async () => {
    await mark("2026-01-01", "  ");
    expect((await db.query("select note from public.listened_albums where album_id=$1", [albumId])).rows[0]).toEqual({ note: null });
    await db.query("update public.listened_albums set listened_on='2026-01-02',note='Corregida' where album_id=$1", [albumId]);
    expect((await db.query("select note from public.listened_albums where album_id=$1", [albumId])).rows[0]).toEqual({ note: "Corregida" });
  });
  it("impide que otro usuario lea, edite, borre o suplante el historial", async () => {
    await mark(); await asUser(second);
    expect((await db.query("select * from public.listened_albums")).rows).toEqual([]);
    expect((await db.query("update public.listened_albums set note='Ajena' returning album_id")).rows).toEqual([]);
    expect((await db.query("delete from public.listened_albums returning album_id")).rows).toEqual([]);
    await expect(db.query("insert into public.listened_albums(user_id,album_id,listened_on) values($1,$2,'2026-01-01')", [first, albumId])).rejects.toMatchObject({ code: "42501" });
    await expect(mark()).rejects.toMatchObject({ code: "P0002" });
  });
  it("no permite acceso anónimo ni llamadas sin identidad", async () => {
    await asUser("", "anon");
    await expect(db.query("select * from public.listened_albums")).rejects.toMatchObject({ code: "42501" });
    await expect(mark()).rejects.toMatchObject({ code: "42501" });
    await asUser(""); await expect(mark()).rejects.toMatchObject({ code: "28000" });
  });
  it("valida antes de mover y conserva el pendiente cuando la inserción falla", async () => {
    await expect(mark("2999-01-01")).rejects.toMatchObject({ code: "22023" });
    await expect(mark("2026-01-01", "x".repeat(1001))).rejects.toMatchObject({ code: "22023" });
    await db.exec("reset role; alter table public.listened_albums add constraint test_history_write_failure check(note is distinct from 'force-rollback')");
    try {
      await asUser(first);
      await expect(mark("2026-01-01", "force-rollback")).rejects.toMatchObject({ code: "23514" });
      expect((await db.query("select album_id from public.saved_albums where album_id=$1", [albumId])).rows).toHaveLength(1);
      expect((await db.query("select * from public.listened_albums")).rows).toEqual([]);
    } finally { await db.exec("reset role; alter table public.listened_albums drop constraint test_history_write_failure"); }
  });
});

describe("recomendaciones por sorpresa", () => {
  const a = "ffffffff-ffff-4fff-8fff-fffffffffff1";
  const b = "ffffffff-ffff-4fff-8fff-fffffffffff2";
  const orphan = "ffffffff-ffff-4fff-8fff-fffffffffff3";
  const pick = (exclude: boolean) => db.query<{ album_id: string }>("select * from public.surprise_album($1)", [exclude]);
  const heard = (id: string) => db.query("insert into public.listened_albums(album_id,listened_on) values($1,'2026-01-01')", [id]);
  beforeAll(async () => {
    await db.exec("reset role");
    for (const [index, id] of [a, b, orphan].entries()) await db.query("insert into public.albums(id,deezer_id,title,artists,source_url) values($1,$2,'Álbum sorpresa',array['Artista'],'https://www.deezer.com/album/'||$2)", [id, String(999010 + index)]);
  });
  beforeEach(async () => {
    await db.exec("reset role; delete from public.listened_albums; delete from public.recommendations");
    for (const id of [a, b]) await db.query("insert into public.recommendations(user_id,album_id,contexts,energy,moods,language,comment) values($1,$2,array['party']::public.listening_context[],5,array['dark']::public.mood[],'es','Sin los filtros habituales.')", [first, id]);
  });
  it("permite una sorpresa pública sin conceder acceso al historial privado", async () => {
    await asUser("", "anon");
    const result = await pick(false);
    expect(result.rows).toHaveLength(1); expect([a, b]).toContain(result.rows[0].album_id);
    await expect(db.query("select * from public.listened_albums")).rejects.toMatchObject({ code: "42501" });
    await expect(pick(true)).rejects.toMatchObject({ code: "28000" });
  });
  it("excluye las escuchas del usuario que pide la sorpresa", async () => {
    await asUser(first); await heard(a);
    expect((await pick(true)).rows).toEqual([{ album_id: b }]);
  });
  it("no utiliza el historial de otro usuario para personalizar la selección", async () => {
    await asUser(first); await heard(a);
    await asUser(second); await heard(b);
    expect((await pick(true)).rows).toEqual([{ album_id: a }]);
  });
  it("no ofrece escuchados ni álbumes sin aportaciones cuando se agotan las opciones", async () => {
    await asUser(first); await heard(a); await heard(b);
    expect((await pick(true)).rows).toEqual([]);
    const withoutExclusion = (await pick(false)).rows;
    expect(withoutExclusion).toHaveLength(1); expect([a, b]).toContain(withoutExclusion[0].album_id);
  });
  it("devuelve vacío si la colección no tiene recomendaciones", async () => {
    await db.exec("reset role; delete from public.recommendations");
    await asUser("", "anon"); expect((await pick(false)).rows).toEqual([]);
  });
});

describe("colecciones temáticas", () => {
  const id = "cccccccc-cccc-4ccc-8ccc-ccccccccccc1";
  const a = "cccccccc-cccc-4ccc-8ccc-ccccccccccc2";
  const b = "cccccccc-cccc-4ccc-8ccc-ccccccccccc3";
  const orphan = "cccccccc-cccc-4ccc-8ccc-ccccccccccc4";
  const save = (ids = [a, b], title = "Tarde de lluvia") => db.query("select public.save_curator_collection($1,$2,'Una escucha tranquila.',$3::uuid[])", [id, title, ids]);
  beforeAll(async () => {
    await db.exec("reset role");
    for (const [index, album] of [a, b, orphan].entries()) await db.query("insert into public.albums(id,deezer_id,title,artists,source_url) values($1,$2,'Selección lluvia',array['Artista'],'https://www.deezer.com/album/'||$2)", [album, String(999030 + index)]);
  });
  beforeEach(async () => {
    await db.exec("reset role; delete from public.curator_collections");
    for (const album of [a, b]) await db.query("insert into public.recommendations(user_id,album_id,contexts,energy,moods,language,comment) values($1,$2,array['party']::public.listening_context[],3,array['dark']::public.mood[],'es','Una selección.') on conflict(user_id,album_id) do nothing", [first, album]);
    await asUser(first);
  });
  it("publica atómicamente, reordena y permite reintentar sin duplicar", async () => {
    await save(); await save([b, a]);
    expect((await db.query("select album_id from public.curator_collection_albums where collection_id=$1 order by position", [id])).rows).toEqual([{ album_id: b }, { album_id: a }]);
    expect((await db.query("select id from public.curator_collections")).rows).toHaveLength(1);
    await asUser("", "anon");
    expect((await db.query("select title from public.curator_collections")).rows).toEqual([{ title: "Tarde de lluvia" }]);
    await expect(db.query("select * from public.listened_albums")).rejects.toMatchObject({ code: "42501" });
  });
  it("impide suplantar al autor y escribir directamente en las tablas", async () => {
    await save(); await asUser(second);
    await expect(save()).rejects.toMatchObject({ code: "42501" });
    await expect(db.query("select public.delete_curator_collection($1)", [id])).rejects.toMatchObject({ code: "42501" });
    await expect(db.query("delete from public.curator_collection_albums")).rejects.toMatchObject({ code: "42501" });
    await asUser("", "anon"); await expect(save()).rejects.toMatchObject({ code: "42501" });
    await asUser(""); await expect(save()).rejects.toMatchObject({ code: "28000" });
  });
  it("rechaza repeticiones, tamaños incorrectos y discos sin aportaciones conservando la versión anterior", async () => {
    await save();
    for (const ids of [[a], [a, a], Array(13).fill(a)]) await expect(save(ids)).rejects.toMatchObject({ code: "22023" });
    await expect(save([a, orphan], "Título nuevo")).rejects.toMatchObject({ code: "P0002" });
    expect((await db.query("select title from public.curator_collections where id=$1", [id])).rows[0]).toEqual({ title: "Tarde de lluvia" });
    expect((await db.query("select album_id from public.curator_collection_albums where collection_id=$1", [id])).rows).toHaveLength(2);
  });
  it("elimina solo la selección y busca únicamente discos aportados", async () => {
    await save(); await db.query("select public.delete_curator_collection($1)", [id]);
    expect((await db.query("select * from public.curator_collection_albums")).rows).toHaveLength(0);
    expect((await db.query("select id from public.albums where id=$1", [a])).rows).toHaveLength(1);
    await asUser("", "anon");
    expect((await db.query("select id from public.search_collection_albums('Selección lluvia')")).rows).toHaveLength(2);
    expect((await db.query("select id from public.search_collection_albums('%')")).rows).toHaveLength(0);
  });
});


describe("gestión de aportaciones propias", () => {
  const album = "dddddddd-dddd-4ddd-8ddd-ddddddddddd1";
  const review = "dddddddd-dddd-4ddd-8ddd-ddddddddddd2";
  beforeAll(async () => {
    await db.exec("reset role");
    await db.query("insert into public.albums(id,deezer_id,title,artists,source_url) values($1,'999099','Disco compartido',array['Artista'],'https://www.deezer.com/album/999099')", [album]);
  });
  beforeEach(async () => {
    await db.exec("reset role");
    await db.query("delete from public.recommendations where album_id=$1", [album]);
    await db.query("insert into public.recommendations(id,user_id,album_id,contexts,energy,moods,language,comment) values($1,$2,$3,array['relaxing_home']::public.listening_context[],2,array['bright']::public.mood[],'es','Original')", [review,first,album]);
    await asUser(second);
    await db.query("select public.set_recommendation_vote($1,true)", [review]);
  });
  it("permite corregir comentario y etiquetas propias conservando votos e identidad", async () => {
    await asUser(first);
    await db.query("update public.recommendations set comment='Corregido',contexts=array['active_listening']::public.listening_context[],energy=4,moods=array['dark']::public.mood[],language='en' where id=$1", [review]);
    expect((await db.query("select user_id,album_id,comment,energy,moods::text[] as moods from public.recommendations where id=$1", [review])).rows[0]).toMatchObject({ user_id:first,album_id:album,comment:'Corregido',energy:4,moods:['dark'] });
    expect((await db.query("select * from public.recommendation_votes where recommendation_id=$1", [review])).rows).toHaveLength(1);
    await expect(db.query("update public.recommendations set album_id=$1 where id=$2", [album,review])).rejects.toMatchObject({code:'42501'});
    await expect(db.query("update public.recommendations set comment='' where id=$1", [review])).rejects.toMatchObject({code:'23514'});
  });
  it("RLS impide editar o retirar la reseña de otra persona y deniega anónimos", async () => {
    expect((await db.query("update public.recommendations set comment='Ajeno' where id=$1 returning id", [review])).rows).toEqual([]);
    expect((await db.query("delete from public.recommendations where id=$1 returning id", [review])).rows).toEqual([]);
    await asUser('', 'anon'); await expect(db.query("delete from public.recommendations where id=$1", [review])).rejects.toMatchObject({code:'42501'});
  });
  it("retira solo la reseña propia y sus votos; mantiene disco, pendientes y otras reseñas", async () => {
    await db.query("insert into public.recommendations(user_id,album_id,contexts,energy,moods,language,comment) values($1,$2,array['relaxing_home']::public.listening_context[],2,array['bright']::public.mood[],'es','Otra persona')", [second,album]);
    await db.query("insert into public.saved_albums(user_id,album_id) values($1,$2) on conflict do nothing", [second,album]);
    await asUser(first); await db.query("delete from public.recommendations where id=$1", [review]);
    expect((await db.query("select * from public.recommendation_votes where recommendation_id=$1", [review])).rows).toHaveLength(0);
    expect((await db.query("select user_id from public.recommendations where album_id=$1", [album])).rows).toEqual([{user_id:second}]);
    expect((await db.query("select id from public.albums where id=$1", [album])).rows).toHaveLength(1);
    await asUser(second); expect((await db.query("select album_id from public.saved_albums where album_id=$1", [album])).rows).toHaveLength(1);
    await db.query("delete from public.recommendations where album_id=$1", [album]);
    expect((await db.query("select id from public.albums where id=$1", [album])).rows).toHaveLength(1);
  });
});
