import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ client: vi.fn(), admin: vi.fn(), user: vi.fn(), existing: vi.fn(), rpc: vi.fn(), album: vi.fn(), links: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../src/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("../src/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("../src/features/music/actions", () => ({ getAlbumAction: mocks.album, getAlbumLinksAction: mocks.links }));
import { publishRecommendationAction } from "../src/features/contributions/actions";
const input = { album: { provider: "deezer", id: "123" }, contexts: ["relaxing_home"], energy: 2, moods: ["introspective"], language: "instrumental", comment: "Para escuchar sin ninguna prisa." };
const albumId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const recommendationId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("MUSIC_CATALOG_PROVIDER", "deezer");
  mocks.client.mockResolvedValue({ auth: { getUser: mocks.user }, from: (table: string) => ({ select: () => ({ eq: () => ({ maybeSingle: table === "profiles" ? async () => ({ data: { nick: "curador" }, error: null }) : mocks.existing }) }) }) });
  mocks.user.mockResolvedValue({ data: { user: { id: "verified-user" } }, error: null });
  mocks.admin.mockReturnValue({ rpc: mocks.rpc });
  mocks.existing.mockResolvedValue({ data: null, error: null });
  mocks.album.mockResolvedValue({ ok: true, data: { provider: "deezer", id: "123", title: "Verified title", artists: ["Artist"], releaseYear: 2020, genres: [], coverUrl: null, sourceUrl: "https://www.deezer.com/album/123" } });
  mocks.links.mockResolvedValue({ ok: true, data: { links: {}, resolvedAt: "2026-11-13T10:00:00Z" } });
  mocks.rpc.mockResolvedValue({ data: [{ album_id: albumId, recommendation_id: recommendationId, created: true }], error: null });
});
afterEach(() => vi.unstubAllEnvs());
describe("publicar desde el servidor", () => {
  it("solicita completar el nick antes de usar catálogo o permisos privilegiados", async () => {
    mocks.client.mockResolvedValueOnce({ auth: { getUser: mocks.user }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { nick: null }, error: null }) }) }) }) });
    expect(await publishRecommendationAction(input)).toMatchObject({ ok: false, code: "INVALID_INPUT", message: expect.stringContaining("nick definitivo") });
    expect(mocks.admin).not.toHaveBeenCalled(); expect(mocks.album).not.toHaveBeenCalled();
  });
  it("valida etiquetas, longitud e intentos de suplantar identidad o metadatos", async () => {
    for (const invalid of [{ ...input, moods: [] }, { ...input, comment: "x".repeat(281) }, { ...input, userId: "forged" }, { ...input, title: "forged" }]) expect(await publishRecommendationAction(invalid)).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("no usa el cliente privilegiado sin verificar la sesión", async () => {
    mocks.user.mockResolvedValueOnce({ data: { user: null }, error: null });
    expect(await publishRecommendationAction(input)).toMatchObject({ ok: false, code: "AUTH_REQUIRED" });
    expect(mocks.admin).not.toHaveBeenCalled(); expect(mocks.album).not.toHaveBeenCalled();
  });
  it("obtiene metadatos en servidor e identidad verificada para la transacción", async () => {
    expect(await publishRecommendationAction(input)).toMatchObject({ ok: true, data: { created: true, linksPending: false } });
    expect(mocks.rpc).toHaveBeenCalledWith("publish_recommendation", expect.objectContaining({ p_user_id: "verified-user", p_provider: "deezer", p_metadata: expect.objectContaining({ title: "Verified title" }) }));
  });
  it("reutiliza álbumes existentes sin depender de los proveedores externos", async () => {
    mocks.existing.mockResolvedValueOnce({ data: { id: albumId, links_resolved_at: "2026-11-13T10:00:00Z" }, error: null });
    expect(await publishRecommendationAction(input)).toMatchObject({ ok: true });
    expect(mocks.album).not.toHaveBeenCalled(); expect(mocks.links).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith("publish_recommendation", expect.objectContaining({ p_metadata: null }));
  });
  it("no pierde la aportación si Odesli falla", async () => {
    mocks.links.mockResolvedValueOnce({ ok: false, error: { code: "CONFIGURATION", message: "No access" } });
    expect(await publishRecommendationAction(input)).toMatchObject({ ok: true, data: { linksPending: true } });
    expect(mocks.rpc).toHaveBeenCalledWith("publish_recommendation", expect.objectContaining({ p_metadata: expect.objectContaining({ links_resolved_at: null, platform_links: {} }) }));
  });
  it("rechaza un proveedor diferente al canónico y no publica metadatos si el catálogo falla", async () => {
    expect(await publishRecommendationAction({ ...input, album: { provider: "spotify", id: "1ATL5GLyefJaxhQzSPVrLX" } })).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    mocks.album.mockResolvedValueOnce({ ok: false, error: { code: "NOT_FOUND", message: "Álbum no encontrado." } });
    expect(await publishRecommendationAction(input)).toMatchObject({ ok: false, code: "CATALOG_ERROR" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("oculta errores internos y devuelve el estado de duplicado", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [{ album_id: albumId, recommendation_id: recommendationId, created: false }], error: null });
    expect(await publishRecommendationAction(input)).toMatchObject({ ok: true, data: { created: false } });
    mocks.rpc.mockRejectedValueOnce(new Error("secret connection string"));
    const response = await publishRecommendationAction(input);
    expect(response).toMatchObject({ ok: false, code: "UNAVAILABLE" }); expect(JSON.stringify(response)).not.toContain("secret");
  });
});
