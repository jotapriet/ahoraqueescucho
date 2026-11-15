import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ client: vi.fn(), user: vi.fn(), rpc: vi.fn() }));
vi.mock("../src/lib/supabase/server", () => ({ createClient: mocks.client }));
import { getSurpriseAlbumAction } from "../src/features/discovery/surprise";
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.client.mockResolvedValue({ auth: { getUser: mocks.user }, rpc: mocks.rpc });
  mocks.user.mockResolvedValue({ data: { user: { id: "verified-user" } }, error: null });
  mocks.rpc.mockResolvedValue({ data: [{ album_id: id }], error: null });
});
it("rechaza filtros, usuarios ajenos y opciones inválidas", async () => {
  for (const input of [{ excludeListened: "true" }, { excludeListened: true, userId: "forged" }, { excludeListened: false, mood: "bright" }]) expect(await getSurpriseAlbumAction(input)).toMatchObject({ ok: false, code: "INVALID_INPUT" });
  expect(mocks.client).not.toHaveBeenCalled();
});
it("permite sorpresas sin sesión cuando no se excluyen escuchados", async () => {
  expect(await getSurpriseAlbumAction({ excludeListened: false })).toEqual({ ok: true, albumId: id });
  expect(mocks.user).not.toHaveBeenCalled();
  expect(mocks.rpc).toHaveBeenCalledWith("surprise_album", { p_exclude_listened: false });
});
it("verifica la sesión antes de usar el historial y no recibe un ID de usuario", async () => {
  expect(await getSurpriseAlbumAction({ excludeListened: true })).toMatchObject({ ok: true });
  expect(mocks.rpc).toHaveBeenCalledWith("surprise_album", { p_exclude_listened: true });
  mocks.rpc.mockClear(); mocks.user.mockResolvedValue({ data: { user: null }, error: null });
  expect(await getSurpriseAlbumAction({ excludeListened: true })).toMatchObject({ ok: false, code: "AUTH_REQUIRED" });
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("no relaja la exclusión ni devuelve un disco oído si no quedan opciones", async () => {
  mocks.rpc.mockResolvedValue({ data: [], error: null });
  expect(await getSurpriseAlbumAction({ excludeListened: true })).toMatchObject({ ok: false, code: "EMPTY" });
  expect(mocks.rpc).toHaveBeenCalledOnce();
});
it("rechaza respuestas manipuladas y no filtra errores del backend", async () => {
  mocks.rpc.mockResolvedValue({ data: [{ album_id: "https://evil.test" }], error: null });
  expect(await getSurpriseAlbumAction({ excludeListened: false })).toMatchObject({ ok: false, code: "UNAVAILABLE" });
  mocks.rpc.mockRejectedValue(new Error("private connection details"));
  expect(JSON.stringify(await getSurpriseAlbumAction({ excludeListened: false }))).not.toContain("private");
});
