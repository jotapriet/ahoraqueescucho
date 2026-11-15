import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ client: vi.fn(), oauth: vi.fn(), providers: vi.fn(), redirect: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("../src/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("../src/lib/supabase/env", () => ({ getSupabaseEnv: () => ({ url: "https://project.supabase.co", key: "public" }) }));
vi.mock("../src/features/auth/origin", () => ({ getAuthOrigin: async () => "http://localhost:3000" }));
vi.mock("../src/features/auth/providers", () => ({ getOAuthProviders: mocks.providers }));
import { signInWithOAuthAction } from "../src/features/auth/actions";
function input(provider = "google", next = "/perfil") { const form = new FormData(); form.set("provider", provider); form.set("next", next); return form; }
beforeEach(() => {
  vi.resetAllMocks();
  mocks.providers.mockResolvedValue(["google", "apple"]);
  mocks.client.mockResolvedValue({ auth: { signInWithOAuth: mocks.oauth } });
  mocks.redirect.mockImplementation(() => { throw new Error("NEXT_REDIRECT"); });
});
it.each(["google", "apple"])("inicia %s y conserva el destino", async provider => {
  mocks.oauth.mockResolvedValue({ data: { url: `https://project.supabase.co/auth/v1/authorize?provider=${provider}` }, error: null });
  await expect(signInWithOAuthAction({ message: "" }, input(provider))).rejects.toThrow("NEXT_REDIRECT");
  expect(mocks.oauth).toHaveBeenCalledWith({ provider, options: { redirectTo: "http://localhost:3000/auth/callback?next=%2Fperfil", skipBrowserRedirect: true } });
  expect(mocks.redirect).toHaveBeenCalledOnce();
});
it("rechaza proveedores no admitidos y desactivados", async () => {
  await signInWithOAuthAction({ message: "" }, input("github"));
  mocks.providers.mockResolvedValue([]);
  await signInWithOAuthAction({ message: "" }, input());
  expect(mocks.client).not.toHaveBeenCalled();
});
it("sanea el retorno y rechaza una URL de autorización externa", async () => {
  mocks.oauth.mockResolvedValue({ data: { url: "https://evil.test/authorize" }, error: null });
  const result = await signInWithOAuthAction({ message: "" }, input("google", "https://evil.test"));
  expect(result.message).toContain("segura");
  expect(mocks.oauth).toHaveBeenCalledWith(expect.objectContaining({ options: expect.objectContaining({ redirectTo: "http://localhost:3000/auth/callback?next=%2Faportar" }) }));
  expect(mocks.redirect).not.toHaveBeenCalled();
});
