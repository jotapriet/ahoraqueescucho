import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const db = new PGlite();
const author = "11111111-1111-4111-8111-111111111111";
const listener = "22222222-2222-4222-8222-222222222222";
const third = "33333333-3333-4333-8333-333333333333";
const album = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const recommendation = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

async function asUser(id: string | null, role = "authenticated") {
  await db.exec(`reset role; set role ${role};`);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id ?? ""]);
}
async function vote(voted: boolean) {
  return (await db.query<{ likes: number; has_voted: boolean }>("select * from public.set_recommendation_vote($1, $2)", [recommendation, voted])).rows[0];
}

beforeAll(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
  `);
  for (const file of ["202611120001_initial_schema.sql", "202611130001_recommendation_results.sql", "202611130002_publish_recommendation.sql"]) {
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  }
  await db.query("insert into auth.users(id) values ($1), ($2), ($3)", [author, listener, third]);
  await db.query("insert into public.albums(id,deezer_id,title,artists,source_url) values ($1,'123','Álbum de prueba',array['Artista'],'https://www.deezer.com/album/123')", [album]);
  await db.query("insert into public.recommendations(id,user_id,album_id,contexts,energy,moods,language,comment) values ($1,$2,$3,array['relaxing_home']::public.listening_context[],2,array['introspective']::public.mood[],'instrumental','Un disco para escuchar despacio.')", [recommendation, author, album]);
}, 30_000);
beforeEach(async () => {
  await db.exec("reset role; delete from public.recommendation_votes; delete from public.saved_albums; delete from public.recommendation_reports;");
  await db.query("delete from public.recommendations where id <> $1", [recommendation]);
  await db.query("delete from public.albums where id <> $1", [album]);
});

describe("publicación transaccional", () => {
  const metadata = { title: "Otro disco", artists: ["Otro artista"], release_year: 2020, genres: ["Ambient"], cover_url: null, source_url: "https://www.deezer.com/album/999", platform_links: {}, links_resolved_at: null };
  const sql = "select * from public.publish_recommendation($1,'deezer',$2,$3::jsonb,array['relaxing_home']::public.listening_context[],2::smallint,array['introspective']::public.mood[],'instrumental',$4)";
  async function publish(user = listener, id = "999", details: unknown = metadata, comment = "Un disco que merece tiempo.") {
    return (await db.query<{ album_id: string; recommendation_id: string; created: boolean }>(sql, [user, id, details === null ? null : JSON.stringify(details), comment])).rows[0];
  }
  it("no permite invocar la publicación privilegiada con una sesión normal o anónima", async () => {
    await asUser(listener); await expect(publish()).rejects.toMatchObject({ code: "42501" });
    await asUser(null, "anon"); await expect(publish()).rejects.toMatchObject({ code: "42501" });
  });
  it("crea un álbum y una reseña; los reintentos conservan la reseña original", async () => {
    await asUser(null, "service_role");
    const first = await publish(); expect(first.created).toBe(true);
    const retry = await publish(listener, "999", null, "No debe sustituir el comentario.");
    expect(retry).toEqual({ ...first, created: false });
    const rows = await db.query("select comment from public.recommendations where id=$1", [first.recommendation_id]);
    expect(rows.rows[0]).toMatchObject({ comment: "Un disco que merece tiempo." });
  });
  it("comparte el registro de álbum entre varios usuarios", async () => {
    await asUser(null, "service_role");
    const first = await publish(); const second = await publish(third, "999", null);
    expect(second.album_id).toBe(first.album_id); expect(second.recommendation_id).not.toBe(first.recommendation_id);
    expect((await db.query("select id from public.albums where deezer_id='999'")).rows).toHaveLength(1);
  });
  it("revierte el alta del álbum si la reseña falla y no acepta metadatos ausentes", async () => {
    await asUser(null, "service_role");
    await expect(publish(listener, "999", metadata, "x".repeat(281))).rejects.toMatchObject({ code: "23514" });
    expect((await db.query("select id from public.albums where deezer_id='999'")).rows).toHaveLength(0);
    await expect(publish(listener, "999", null)).rejects.toMatchObject({ code: "22023" });
  });
});
afterAll(async () => { await db.close(); });

describe("migraciones, votos y RLS en PostgreSQL", () => {
  it("añade y retira votos de forma idempotente, actualizando la reputación real", async () => {
    await asUser(listener);
    expect(await vote(true)).toMatchObject({ likes: 1, has_voted: true });
    expect(await vote(true)).toMatchObject({ likes: 1, has_voted: true });
    expect((await db.query<{ likes_received: number }>("select likes_received from public.curator_stats where user_id=$1", [author])).rows[0].likes_received).toBe(1);
    expect(await vote(false)).toMatchObject({ likes: 0, has_voted: false });
    expect(await vote(false)).toMatchObject({ likes: 0, has_voted: false });
    expect((await db.query<{ likes_received: number }>("select likes_received from public.curator_stats where user_id=$1", [author])).rows[0].likes_received).toBe(0);
  });
  it("prohíbe autovotos incluso al invocar la RPC directamente", async () => {
    await asUser(author);
    await expect(vote(true)).rejects.toMatchObject({ code: "42501" });
  });
  it("deniega RPC a anónimos y sesiones sin identidad", async () => {
    await asUser(null, "anon"); await expect(vote(true)).rejects.toMatchObject({ code: "42501" });
    await asUser(null); await expect(vote(true)).rejects.toMatchObject({ code: "28000" });
  });
  it("un usuario no puede retirar el voto de otra persona ni falsificar su ID", async () => {
    await asUser(listener); await vote(true);
    await asUser(third); expect(await vote(false)).toMatchObject({ likes: 1, has_voted: false });
    await expect(db.query("insert into public.recommendation_votes(recommendation_id,user_id) values ($1,$2)", [recommendation, listener])).rejects.toMatchObject({ code: "42501" });
  });
  it("la vista aplica identidad del lector y expone etiquetas originales", async () => {
    await asUser(listener); await vote(true);
    expect((await db.query("select has_voted, array_to_json(moods) as moods, likes from public.recommendation_details")).rows[0]).toMatchObject({ has_voted: true, likes: 1, moods: ["introspective"] });
    await asUser(third);
    expect((await db.query("select has_voted from public.recommendation_details")).rows[0]).toMatchObject({ has_voted: false });
  });
  it("pendientes y reportes quedan privados y sus estados no son editables por cliente", async () => {
    await asUser(listener);
    await db.query("insert into public.saved_albums(album_id) values ($1)", [album]);
    await db.query("insert into public.recommendation_reports(recommendation_id, reason) values ($1,'No encaja el mood')", [recommendation]);
    await expect(db.exec("update public.recommendation_reports set status='reviewed'")).rejects.toMatchObject({ code: "42501" });
    await asUser(third);
    expect((await db.query("select * from public.saved_albums")).rows).toEqual([]);
    expect((await db.query("select * from public.recommendation_reports")).rows).toEqual([]);
  });
  it("los descartes excluyen el álbum sin relajar contexto, energía ni moods", async () => {
    await asUser(null, "anon");
    const sql = "select * from public.discover_albums('relaxing_home', 2, array['introspective']::public.mood[], null, $1::uuid[], 1)";
    expect((await db.query(sql, [[]])).rows).toHaveLength(1);
    expect((await db.query(sql, [[album]])).rows).toHaveLength(0);
    expect((await db.query("select * from public.album_mood_stats")).rows[0]).toMatchObject({ mood: "introspective", recommendations: 1 });
  });
  it("rechaza referencias inexistentes y estados nulos", async () => {
    await asUser(listener);
    await expect(db.query("select * from public.set_recommendation_vote($1,true)", [album])).rejects.toMatchObject({ code: "P0002" });
    await expect(db.query("select * from public.set_recommendation_vote($1,null)", [recommendation])).rejects.toMatchObject({ code: "22023" });
  });
});
