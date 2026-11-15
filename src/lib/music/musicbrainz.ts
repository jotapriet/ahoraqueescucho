import "server-only";
import { z } from "zod";
import { MusicError } from "./errors";
import { fetchJson } from "./http";
import { albumSourceUrl, releaseYear, safePlatformUrl } from "./urls";
import type { MusicAlbum, Platform, PlatformLinks, ResolvedLinks } from "./types";

const credit = z.object({ name: z.string().optional(), artist: z.object({ name: z.string() }) });
const groupSchema = z.object({ id: z.uuid(), title: z.string().min(1), "primary-type": z.string().optional(), "artist-credit": z.array(credit).min(1), "first-release-date": z.string().optional(), genres: z.array(z.object({ name: z.string() })).optional(), relations: z.array(z.object({ url: z.object({ resource: z.string() }).optional() })).optional() });
let queue: Promise<unknown> = Promise.resolve();
let nextRequest = 0;
let queued = 0;

// Límite por proceso. Despliegues con réplicas/IP compartida necesitan un limitador distribuido.
async function request(path: string, params: Record<string, string>): Promise<unknown> {
  if (queued >= 4) throw new MusicError("RATE_LIMITED", "MusicBrainz está atendiendo otras consultas. Espera unos segundos.", 3);
  queued++;
  const work = queue.then(async () => {
    const wait = Math.max(0, nextRequest - Date.now());
    if (wait) await new Promise(resolve => setTimeout(resolve, wait));
    nextRequest = Date.now() + 1100;
    const url = new URL(`https://musicbrainz.org/ws/2/${path}`);
    url.search = new URLSearchParams({ ...params, fmt: "json" }).toString();
    return fetchJson(url, { headers: { "User-Agent": "AhoraQueEscucho/0.1 (https://jprietom.dev)", Accept: "application/json" } });
  }).finally(() => { queued--; });
  queue = work.catch(() => undefined);
  return work;
}
function quoted(value: string) { return `"${value.replace(/[\\"]/g, " ")}"`; }
function linksFromRelations(relations: Array<{ url?: { resource: string } }> = []): PlatformLinks {
  const links: PlatformLinks = {};
  for (const relation of relations) for (const platform of ["spotify", "appleMusic", "youtubeMusic", "bandcamp", "tidal"] as Platform[]) {
    if (!relation.url) continue;
    const safe = safePlatformUrl(platform, relation.url.resource);
    // Una relación de artista o pista no debe presentarse como enlace a un álbum.
    if (safe && (/\/album\//.test(new URL(safe).pathname) || (platform === "tidal" && /\/album\//.test(safe)) || (platform === "youtubeMusic" && new URL(safe).searchParams.has("list")))) links[platform] ??= safe;
  }
  return links;
}
function normalize(group: z.infer<typeof groupSchema>): MusicAlbum {
  const ref = { provider: "musicbrainz" as const, id: group.id };
  return { ...ref, title: group.title, artists: [...new Set(group["artist-credit"].map(item => item.name ?? item.artist.name))], releaseYear: releaseYear(group["first-release-date"]), genres: (group.genres ?? []).map(item => item.name), coverUrl: `https://coverartarchive.org/release-group/${group.id}/front-500`, sourceUrl: albumSourceUrl(ref), links: linksFromRelations(group.relations) };
}
export async function searchMusicBrainzAlbums(query: string, limit: number): Promise<MusicAlbum[]> {
  const terms = query.split(/\s+/).filter(Boolean).map(term => `(releasegroup:${quoted(term)} OR artist:${quoted(term)})`).join(" AND ");
  const data = z.object({ "release-groups": z.array(groupSchema) }).safeParse(await request("release-group/", { query: `(artist:${quoted(query)}^3 OR (${terms})) AND primarytype:album`, limit: String(limit) }));
  if (!data.success) throw new MusicError("INVALID_RESPONSE", "MusicBrainz devolvió un catálogo no válido.");
  return data.data["release-groups"].filter(group => group["primary-type"] === "Album").slice(0, limit).map(normalize);
}
export async function getMusicBrainzAlbum(id: string): Promise<MusicAlbum> {
  const data = groupSchema.safeParse(await request(`release-group/${id}`, { inc: "artist-credits+genres+url-rels" }));
  if (!data.success || data.data.id !== id || data.data["primary-type"] !== "Album") throw new MusicError("INVALID_RESPONSE", "MusicBrainz no devolvió un álbum válido.");
  const album = normalize(data.data);
  // La ausencia de portada no impide recomendar un álbum.
  try {
    const response = await fetch(`https://coverartarchive.org/release-group/${id}`, { signal: AbortSignal.timeout(5000), headers: { Accept: "application/json" }, cache: "no-store" });
    const art = response.ok ? await response.json() : null;
    if (!Array.isArray(art?.images) || !art.images.some((image: { front?: boolean }) => image.front === true)) album.coverUrl = null;
  } catch { album.coverUrl = null; }
  return album;
}
export async function getMusicBrainzLinks(album: MusicAlbum): Promise<ResolvedLinks> {
  const links: PlatformLinks = { ...album.links };
  try {
  const search = z.object({ releases: z.array(z.object({ id: z.uuid(), "release-group": z.object({ id: z.uuid() }) })) }).safeParse(await request("release/", { query: `rgid:${album.id} AND format:"Digital Media" AND status:official`, limit: "1" }));
  const release = search.success ? search.data.releases.find(item => item["release-group"].id === album.id) : null;
  if (release) {
    const detail = z.object({ id: z.uuid(), "release-group": z.object({ id: z.uuid() }), relations: z.array(z.object({ url: z.object({ resource: z.string() }).optional() })).optional() }).safeParse(await request(`release/${release.id}`, { inc: "url-rels+release-groups" }));
    if (detail.success && detail.data.id === release.id && detail.data["release-group"].id === album.id) Object.assign(links, linksFromRelations(detail.data.relations));
  }
  } catch (error) {
    if (!Object.keys(links).length) throw error;
  }
  if (!Object.keys(links).length) throw new MusicError("NOT_FOUND", "No encontramos enlaces directos para este álbum.");
  return { links, resolvedAt: new Date().toISOString() };
}

export async function matchMusicBrainzAlbum(title: string, artists: string[], year: number | null): Promise<MusicAlbum | null> {
  const data = z.object({ "release-groups": z.array(groupSchema) }).safeParse(await request("release-group/", { query: `releasegroup:${quoted(title)} AND artist:${quoted(artists[0] ?? "")} AND primarytype:album`, limit: "5" }));
  if (!data.success) return null;
  const normal = (value: string) => value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
  const matches = data.data["release-groups"].map(normalize).filter(album => normal(album.title) === normal(title) && album.artists.some(name => artists.some(artist => normal(name) === normal(artist))));
  if (matches.length === 1) return matches[0];
  const sameYear = matches.filter(album => year !== null && album.releaseYear === year);
  return sameYear.length === 1 ? sameYear[0] : null;
}
