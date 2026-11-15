import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  browser: vi.fn(), server: vi.fn(), cookies: vi.fn(),
  cookieStore: { getAll: vi.fn(), set: vi.fn() },
}));
vi.mock("server-only", () => ({}));
vi.mock("@supabase/ssr", () => ({ createBrowserClient: mocks.browser, createServerClient: mocks.server }));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));

import { createClient as createBrowserClient } from "../src/lib/supabase/client";
import { createClient as createServerClient } from "../src/lib/supabase/server";
import { updateSession } from "../src/lib/supabase/session";
import { NextRequest } from "next/server";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-key");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "legacy-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "private-service-key");
  mocks.cookies.mockResolvedValue(mocks.cookieStore);
  mocks.cookieStore.getAll.mockReturnValue([{ name: "session", value: "value" }]);
  mocks.cookieStore.set.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("clientes Supabase", () => {
  it("el navegador solo recibe la clave pública", () => {
    createBrowserClient();
    expect(mocks.browser).toHaveBeenCalledWith("https://project.supabase.co", "public-key");
    expect(JSON.stringify(mocks.browser.mock.calls)).not.toContain("private-service-key");
  });

  it("acepta la clave anon alternativa y detecta configuración ausente", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    createBrowserClient();
    expect(mocks.browser).toHaveBeenCalledWith("https://project.supabase.co", "legacy-key");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect(() => createBrowserClient()).toThrow("configuración pública");
  });

  it("crea el cliente de servidor por petición y propaga las cookies", async () => {
    await createServerClient();
    await createServerClient();
    expect(mocks.server).toHaveBeenCalledTimes(2);
    const options = mocks.server.mock.calls[0][2];
    expect(options.cookies.getAll()).toEqual([{ name: "session", value: "value" }]);
    options.cookies.setAll([{ name: "session", value: "new-value", options: { httpOnly: true } }]);
    expect(mocks.cookieStore.set).toHaveBeenCalledWith("session", "new-value", { httpOnly: true });
  });

  it("propaga la sesión renovada a petición y respuesta sin permitir caché público", async () => {
    const getUser = vi.fn();
    mocks.server.mockImplementationOnce((_url, _key, options) => ({ auth: { getUser: async () => {
      getUser();
      options.cookies.setAll([{ name: "session", value: "fresh", options: { httpOnly: true, path: "/" } }]);
      return { data: { user: { id: "user" } }, error: null };
    } } }));
    const request = new NextRequest("https://example.com/perfil");
    const response = await updateSession(request);
    expect(getUser).toHaveBeenCalledOnce();
    expect(request.cookies.get("session")?.value).toBe("fresh");
    expect(response.cookies.get("session")?.value).toBe("fresh");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
