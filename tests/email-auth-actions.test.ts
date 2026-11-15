import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ client: vi.fn(), request: vi.fn(), verify: vi.fn(), signOut: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../src/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("../src/features/auth/origin", () => ({ getAuthOrigin: async () => "http://localhost:3000" }));
import { requestEmailLinkAction, signOutAction } from "../src/features/auth/actions";
beforeEach(() => {
  vi.resetAllMocks(); mocks.client.mockResolvedValue({ auth: { signInWithOtp: mocks.request, verifyOtp: mocks.verify, signOut: mocks.signOut } });
});
describe("acceso por enlace de correo", () => {
  it("valida correo y código antes de contactar con Auth", async () => {
    expect(await requestEmailLinkAction({ email: "invalid" })).toMatchObject({ ok: false });
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("solicita el acceso sin devolver secretos y conserva errores genéricos", async () => {
    mocks.request.mockResolvedValueOnce({ error: null });
    expect(await requestEmailLinkAction({ email: "test@example.com" })).toEqual({ ok: true });
    expect(mocks.request).toHaveBeenCalledWith({ email: "test@example.com", options: { shouldCreateUser: true, emailRedirectTo: "http://localhost:3000/auth/callback?next=%2Faportar" } });
    mocks.request.mockResolvedValueOnce({ error: { message: "secret backend detail" } });
    const response = await requestEmailLinkAction({ email: "test@example.com" });
    expect(response).toMatchObject({ ok: false }); expect(JSON.stringify(response)).not.toContain("secret");
  });
  it("sanea el destino del enlace de acceso", async () => {
    mocks.request.mockResolvedValueOnce({ error: null });
    await requestEmailLinkAction({ email: "test@example.com", next: "https://evil.test" });
    expect(mocks.request).toHaveBeenCalledWith(expect.objectContaining({ options: expect.objectContaining({ emailRedirectTo: "http://localhost:3000/auth/callback?next=%2Faportar" }) }));
  });
  it("cierra solo la sesión actual y no devuelve un éxito falso si falla", async () => {
    mocks.signOut.mockResolvedValueOnce({ error: null });
    expect(await signOutAction()).toEqual({ ok: true });
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    mocks.signOut.mockRejectedValueOnce(new Error("private token"));
    const result = await signOutAction();
    expect(result).toMatchObject({ ok: false }); expect(JSON.stringify(result)).not.toContain("private token");
  });
});
