import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ createClient: vi.fn(), getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../src/lib/supabase/server", () => ({ createClient: mocks.createClient }));
import { setVoteAction } from "../src/features/recommendations/actions";

const recommendationId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
beforeEach(() => {
  mocks.createClient.mockResolvedValue({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc });
  mocks.getUser.mockResolvedValue({ data: { user: { id: "verified-user" } }, error: null });
});
describe("Server Action de votos", () => {
  it("rechaza IDs inválidos y cualquier intento de enviar userId o likes", async () => {
    for (const input of [{ recommendationId: "x", voted: true }, { recommendationId, voted: true, userId: "forged" }, { recommendationId, voted: true, likes: 999 }]) expect(await setVoteAction(input)).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it("comprueba la sesión en servidor antes de la mutación", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    expect(await setVoteAction({ recommendationId, voted: true })).toMatchObject({ ok: false, code: "AUTH_REQUIRED" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("envía solo ID y estado deseado y devuelve el contador de PostgreSQL", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [{ likes: 12, has_voted: true }], error: null });
    expect(await setVoteAction({ recommendationId, voted: true })).toEqual({ ok: true, data: { likes: 12, has_voted: true } });
    expect(mocks.rpc).toHaveBeenCalledWith("set_recommendation_vote", { p_recommendation_id: recommendationId, p_voted: true });
  });
  it("traduce errores sin filtrar detalles internos", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "secret SQL details" } });
    expect(await setVoteAction({ recommendationId, voted: true })).toMatchObject({ ok: false, code: "FORBIDDEN" });
    mocks.rpc.mockRejectedValueOnce(new Error("secret connection string"));
    const result = await setVoteAction({ recommendationId, voted: false });
    expect(result).toMatchObject({ ok: false, code: "UNAVAILABLE" });
    expect(JSON.stringify(result)).not.toContain("secret");
  });
});
