import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
const mocks = vi.hoisted(() => ({ links: vi.fn(), match: vi.fn(), mbLinks: vi.fn() }));
vi.mock("../src/features/music/actions", () => ({ getAlbumLinksAction: mocks.links }));
vi.mock("../src/lib/music/musicbrainz", () => ({ matchMusicBrainzAlbum: mocks.match, getMusicBrainzLinks: mocks.mbLinks }));
import { getListeningLinks, platformSearches, type ListeningAlbum } from "../src/features/music/listening";
const album: ListeningAlbum = { id: "album", title: "Un disco", artists: ["Artista"], release_year: 2000, deezer_id: "123", spotify_id: null, musicbrainz_id: null, source_url: "https://www.deezer.com/album/123", platform_links: {} };
beforeEach(() => { vi.resetAllMocks(); mocks.links.mockResolvedValue({ ok: false }); mocks.match.mockResolvedValue(null); });
it("usa MusicBrainz cuando el proveedor de enlaces falla y conserva la plataforma original", async () => {
  mocks.match.mockResolvedValue({ id: "matched" });
  mocks.mbLinks.mockResolvedValue({ links: { bandcamp: "https://artist.bandcamp.com/album/album" } });
  expect(await getListeningLinks(album)).toEqual({ deezer: "https://www.deezer.com/album/123", bandcamp: "https://artist.bandcamp.com/album/album" });
  expect(mocks.match).toHaveBeenCalledWith(album.title, album.artists, album.release_year);
});
it("conserva enlaces validados si falla una fuente y rechaza hosts arbitrarios guardados", async () => {
  mocks.links.mockRejectedValue(new Error("offline"));
  expect(await getListeningLinks({ ...album, platform_links: { spotify: "https://evil.test/album/123" } })).toEqual({ deezer: "https://www.deezer.com/album/123" });
});
it("construye búsquedas codificadas, sin confundirlas con enlaces directos", () => {
  const searches = platformSearches('Disco & "otro"', ["Artista"]);
  expect(searches).toHaveLength(5);
  expect(new URL(searches[1].url).searchParams.get("term")).toBe('Artista Disco & "otro"');
  expect(searches.every(item => new URL(item.url).protocol === "https:")).toBe(true);
});
