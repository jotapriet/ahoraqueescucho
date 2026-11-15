import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ client: vi.fn(), exchange: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../src/lib/supabase/server", () => ({ createClient: mocks.client }));
import { NextRequest } from "next/server";
import { GET } from "../src/app/auth/callback/route";
beforeEach(() => { vi.resetAllMocks(); mocks.client.mockResolvedValue({ auth: { exchangeCodeForSession: mocks.exchange }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { nick: "curador" }, error: null }) }) }) }) }); });
describe("callback PKCE", () => {
  it("dirige al alta de identidad conservando el destino original si falta el nick", async () => {
    mocks.exchange.mockResolvedValueOnce({ data: { user: { id: "user" }, session: { access_token: "secret" } }, error: null });
    mocks.client.mockResolvedValueOnce({ auth: { exchangeCodeForSession: mocks.exchange }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { nick: null }, error: null }) }) }) }) });
    const response = await GET(new NextRequest("http://localhost:3000/auth/callback?code=new-user&next=%2Fdescubrir%3Fenergy%3D3"));
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/perfil");
    expect(location.searchParams.get("next")).toBe("/descubrir?energy=3");
  });
  it("intercambia el código antes de redirigir a la ruta interna y desactiva el caché", async () => {
    mocks.exchange.mockResolvedValueOnce({ data: { user: { id: "user" }, session: { access_token: "secret" } }, error: null });
    const response = await GET(new NextRequest("http://localhost:3000/auth/callback?code=test-code&next=%2Fdescubrir%3Fenergy%3D3"));
    expect(mocks.exchange).toHaveBeenCalledWith("test-code");
    expect(response.headers.get("location")).toBe("http://localhost:3000/descubrir?energy=3");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("location")).not.toContain("secret");
  });
  it("lleva enlaces caducados al login sin filtrar errores del proveedor", async () => {
    mocks.exchange.mockResolvedValueOnce({ data: { user: null, session: null }, error: { message: "private details" } });
    const response = await GET(new NextRequest("http://localhost:3000/auth/callback?code=expired&next=https://evil.test"));
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login"); expect(location.searchParams.get("error")).toBe("invalid-link");
    expect(location.searchParams.get("next")).toBe("/aportar"); expect(location.href).not.toContain("private");
  });
  it("no intercambia códigos ausentes o acompañados de un error", async () => {
    await GET(new NextRequest("http://localhost:3000/auth/callback?error=access_denied&code=ignored"));
    await GET(new NextRequest("http://localhost:3000/auth/callback"));
    expect(mocks.exchange).not.toHaveBeenCalled();
  });
});
