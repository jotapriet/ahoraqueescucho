import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
import { getAlbumAction, searchAlbumsAction } from "../src/features/music/actions";
import { getMusicBrainzLinks } from "../src/lib/music/musicbrainz";
const id = "17d74d52-c92b-3b8d-9f87-218ab2d1c4a0";
const group = { id, title: "Un álbum", "primary-type": "Album", "first-release-date": "1998-04-20", "artist-credit": [{ name: "Artista", artist: { name: "Artista" } }] };
afterEach(() => vi.unstubAllGlobals());
it("busca álbumes en MusicBrainz con identificación y sin una clave privada", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ "release-groups": [group] })));
  vi.stubGlobal("fetch", fetcher);
  expect(await searchAlbumsAction({ query: "Un álbum", provider: "musicbrainz" })).toMatchObject({ ok: true, data: [{ id, provider: "musicbrainz", title: "Un álbum", releaseYear: 1998, sourceUrl: `https://musicbrainz.org/release-group/${id}` }] });
  expect(fetcher.mock.calls[0][1].headers["User-Agent"]).toContain("jprietom.dev");
  expect(new URL(fetcher.mock.calls[0][0]).hostname).toBe("musicbrainz.org");
});
it("rechaza identificadores ajenos antes de consultar el proveedor", async () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  expect(await getAlbumAction({ provider: "musicbrainz", id: "../../internal" })).toMatchObject({ ok: false });
  expect(fetcher).not.toHaveBeenCalled();
});
it("solo usa enlaces de una edición perteneciente al álbum seleccionado", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ releases: [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "release-group": { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" } }] }))));
  await expect(getMusicBrainzLinks({ provider: "musicbrainz", id, title: "Un álbum", artists: ["Artista"], releaseYear: 1998, genres: [], coverUrl: null, sourceUrl: `https://musicbrainz.org/release-group/${id}` })).rejects.toMatchObject({ code: "NOT_FOUND" });
});
