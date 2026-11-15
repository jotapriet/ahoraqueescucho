import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../src/lib/supabase/server", () => ({ createClient: async () => ({ rpc: mocks.rpc }) }));
import { getInspirationAlbums } from "../src/features/discovery/inspiration";
beforeEach(() => vi.resetAllMocks());
it("usa la selección del servidor y conserva los enlaces y portadas válidos", async () => {
  mocks.rpc.mockResolvedValue({ data: [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", title: "Disco de la colección", artists: ["Artista"], release_year: 2020, cover_url: "https://cdn-images.dzcdn.net/images/cover/test/1000x1000.jpg", source_url: "https://www.deezer.com/album/123" }], error: null });
  const result = await getInspirationAlbums();
  expect(mocks.rpc).toHaveBeenCalledWith("random_inspiration_albums");
  expect(result.available).toBe(true);
  expect(result.albums[0]).toMatchObject({ title: "Disco de la colección", source_url: "https://www.deezer.com/album/123" });
});
it("distingue colección vacía de fallo de consulta sin añadir discos fijos", async () => {
  mocks.rpc.mockResolvedValueOnce({ data: [], error: null });
  expect(await getInspirationAlbums()).toEqual({ available: true, albums: [] });
  mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "unavailable" } });
  expect(await getInspirationAlbums()).toEqual({ available: false, albums: [] });
});
