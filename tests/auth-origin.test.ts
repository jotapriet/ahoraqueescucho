import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ headers: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
import { getAuthOrigin } from "../src/features/auth/origin";
afterEach(() => vi.unstubAllEnvs());
describe("origen de los enlaces de acceso", () => {
  it("conserva el origen local del navegador y el puerto de desarrollo", async () => {
    vi.stubEnv("APP_URL", ""); vi.stubEnv("NODE_ENV", "development");
    mocks.headers.mockResolvedValue(new Headers({ origin: "http://127.0.0.1:3001" }));
    expect(await getAuthOrigin()).toBe("http://127.0.0.1:3001");
  });
  it("no utiliza hosts ajenos enviados por el cliente", async () => {
    vi.stubEnv("APP_URL", ""); vi.stubEnv("NODE_ENV", "development");
    mocks.headers.mockResolvedValue(new Headers({ origin: "https://evil.test" }));
    await expect(getAuthOrigin()).rejects.toThrow();
  });
  it("exige un origen configurado en producción y rechaza protocolos inseguros", async () => {
    vi.stubEnv("APP_URL", ""); vi.stubEnv("NODE_ENV", "production");
    await expect(getAuthOrigin()).rejects.toThrow();
    vi.stubEnv("APP_URL", "http://example.com"); await expect(getAuthOrigin()).rejects.toThrow();
    vi.stubEnv("APP_URL", "https://music.example.com"); expect(await getAuthOrigin()).toBe("https://music.example.com");
  });
});
