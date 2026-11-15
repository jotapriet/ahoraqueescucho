import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// Ejecutar el callback sin almacenamiento de Next en tests unitarios.
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

import { getAlbumAction, getAlbumLinksAction, searchAlbumsAction } from "../src/features/music/actions";
import { safePlatformUrl } from "../src/lib/music/urls";

const spotifyId = "1ATL5GLyefJaxhQzSPVrLX";
const deezerAlbum = {
  id: 123, title: "Un disco", artist: { name: "Artista" },
  cover_xl: "https://cdn-images.dzcdn.net/images/cover/test/1000x1000.jpg",
};
const fetchMock = vi.fn<typeof fetch>();
function respond(value: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(value), { status, headers });
}

beforeEach(() => { vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset(); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("acciones del catálogo", () => {
  it("rechaza entradas, proveedor y límites inválidos antes de llamar a la API", async () => {
    for (const input of [null, { query: "a" }, { query: "abc", provider: "other" }, { query: "abc", limit: 100 }, { query: "abc\n".trim() + "\u0000" }]) {
      expect(await searchAlbumsAction(input)).toMatchObject({ ok: false, error: { code: "INVALID_INPUT" } });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("normaliza Deezer y codifica la búsqueda sin concatenar parámetros", async () => {
    fetchMock.mockResolvedValueOnce(respond({ data: [deezerAlbum] }));
    const result = await searchAlbumsAction({ query: "  rock & jazz  " });
    expect(result).toMatchObject({ ok: true, data: [{ provider: "deezer", id: "123", title: "Un disco", releaseYear: null, genres: [], sourceUrl: "https://www.deezer.com/album/123" }] });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get("q")).toBe("rock & jazz");
    expect(url.searchParams.get("limit")).toBe("8");
  });

  it("completa año, géneros y colaboradores al seleccionar Deezer", async () => {
    fetchMock.mockResolvedValueOnce(respond({ ...deezerAlbum, release_date: "1997-06-16", genres: { data: [{ name: "Rock" }] }, contributors: [{ name: "Artista" }, { name: "Invitado" }] }));
    expect(await getAlbumAction({ provider: "deezer", id: "123" })).toMatchObject({ ok: true, data: { releaseYear: 1997, genres: ["Rock"], artists: ["Artista", "Invitado"] } });
  });

  it("no acepta una URL ni un ID que altere la ruta", async () => {
    expect(await getAlbumLinksAction({ provider: "deezer", id: "123/../../internal" })).toMatchObject({ ok: false, error: { code: "INVALID_INPUT" } });
    expect(await getAlbumLinksAction({ url: "http://127.0.0.1" })).toMatchObject({ ok: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("detecta errores de Deezer aunque use HTTP 200", async () => {
    fetchMock.mockResolvedValueOnce(respond({ error: { code: 800, message: "private upstream message" } }));
    expect(await getAlbumAction({ provider: "deezer", id: "123" })).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  });

  it("rechaza respuestas incompletas o un álbum con ID diferente", async () => {
    fetchMock.mockResolvedValueOnce(respond({ data: [{ id: 1 }] }));
    expect(await searchAlbumsAction({ query: "hola" })).toMatchObject({ ok: false, error: { code: "INVALID_RESPONSE" } });
    fetchMock.mockResolvedValueOnce(respond({ ...deezerAlbum, id: 124 }));
    expect(await getAlbumAction({ provider: "deezer", id: "123" })).toMatchObject({ ok: false, error: { code: "INVALID_RESPONSE" } });
  });

  it("devuelve límites del proveedor y fallos de conexión sin exponer excepciones", async () => {
    fetchMock.mockResolvedValueOnce(respond({}, 429, { "retry-after": "42" }));
    expect(await searchAlbumsAction({ query: "hola" })).toMatchObject({ ok: false, error: { code: "RATE_LIMITED", retryAfterSeconds: 42 } });
    fetchMock.mockRejectedValueOnce(new Error("secret infrastructure details"));
    const result = await searchAlbumsAction({ query: "hola" });
    expect(result).toMatchObject({ ok: false, error: { code: "UNAVAILABLE" } });
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("Spotify sin credenciales falla explícitamente, sin fallback oculto", async () => {
    vi.stubEnv("SPOTIFY_CLIENT_ID", ""); vi.stubEnv("SPOTIFY_CLIENT_SECRET", "");
    expect(await searchAlbumsAction({ query: "hola", provider: "spotify" })).toMatchObject({ ok: false, error: { code: "CONFIGURATION" } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Spotify comparte Client Credentials entre peticiones concurrentes y oculta el token", async () => {
    vi.stubEnv("SPOTIFY_CLIENT_ID", "client"); vi.stubEnv("SPOTIFY_CLIENT_SECRET", "secret");
    fetchMock.mockImplementation(async (input) => {
      if (String(input).includes("accounts.spotify.com")) return respond({ access_token: "private-token", token_type: "Bearer", expires_in: 3600 });
      return respond({ albums: { items: [{ id: spotifyId, name: "Álbum", artists: [{ name: "Artista" }], release_date: "2020", images: [{ url: "https://i.scdn.co/image/small", width: 64 }, { url: "https://i.scdn.co/image/large", width: 640 }] }] } });
    });
    const results = await Promise.all([searchAlbumsAction({ query: "uno", provider: "spotify" }), searchAlbumsAction({ query: "dos", provider: "spotify" })]);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("accounts.spotify.com"))).toHaveLength(1);
    expect(results[0]).toMatchObject({ ok: true, data: [{ releaseYear: 2020, coverUrl: "https://i.scdn.co/image/large" }] });
    expect(JSON.stringify(results)).not.toContain("private-token");
  });
});

describe("Odesli", () => {
  it("solo conserva plataformas permitidas con entidades de álbum y URLs seguras", async () => {
    fetchMock.mockResolvedValueOnce(respond({
      entitiesByUniqueId: { a: { type: "album" }, t: { type: "song" } },
      linksByPlatform: {
        spotify: { entityUniqueId: "a", url: `https://open.spotify.com/album/${spotifyId}` },
        bandcamp: { entityUniqueId: "a", url: "https://artist.bandcamp.com/album/test" },
        appleMusic: { entityUniqueId: "a", url: "https://music.apple.com.evil.test/album/123" },
        youtubeMusic: { entityUniqueId: "t", url: "https://music.youtube.com/watch?v=123" },
        tidal: { entityUniqueId: "missing", url: "https://tidal.com/album/123" },
      },
    }));
    const result = await getAlbumLinksAction({ provider: "spotify", id: spotifyId });
    expect(result).toMatchObject({ ok: true, data: { links: { spotify: `https://open.spotify.com/album/${spotifyId}`, bandcamp: "https://artist.bandcamp.com/album/test" } } });
    if (result.ok) expect(Object.keys(result.data.links)).toHaveLength(2);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.origin).toBe("https://api.song.link");
    expect(url.searchParams.get("url")).toBe(`https://open.spotify.com/album/${spotifyId}`);
  });

  it("distingue ausencia de enlaces de una autorización rechazada", async () => {
    fetchMock.mockResolvedValueOnce(respond({ entitiesByUniqueId: {}, linksByPlatform: {} }));
    expect(await getAlbumLinksAction({ provider: "deezer", id: "123" })).toMatchObject({ ok: true, data: { links: {} } });
    fetchMock.mockResolvedValueOnce(respond({}, 401));
    expect(await getAlbumLinksAction({ provider: "deezer", id: "123" })).toMatchObject({ ok: false, error: { code: "CONFIGURATION" } });
  });

  it("rechaza esquemas, credenciales, puertos y hosts engañosos", () => {
    for (const url of ["javascript:alert(1)", "http://open.spotify.com/album/test", "https://user:pass@open.spotify.com/album/test", "https://open.spotify.com:8443/album/test", "https://open.spotify.com.evil.com/album/test"]) {
      expect(safePlatformUrl("spotify", url)).toBeNull();
    }
  });
});
