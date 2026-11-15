import { describe, expect, it } from "vitest";
import { safeReturnTo, loginHref } from "../src/features/auth/redirects";
describe("destinos del login", () => {
  it("permite volver a una ficha de álbum interna y rechaza rutas arbitrarias", () => {
    const path = "/albumes/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    expect(safeReturnTo(path)).toBe(path);
    expect(safeReturnTo("/albumes/https://evil.test")).toBe("/aportar");
  });
  it("conserva filtros, moods repetidos y descartes", () => {
    const target = "/descubrir?context=driving&mood=bright&mood=nostalgic&skip=abc#resenas";
    expect(safeReturnTo(target)).toBe(target);
    expect(new URL(loginHref(target), "https://local.test").searchParams.get("next")).toBe(target);
  });
  it("rechaza destinos externos, protocolos, rutas de Auth y controles", () => {
    for (const value of [undefined, ["/"], "https://evil.test", "//evil.test", "/\\evil.test", "javascript:alert(1)", "/login", "/auth/callback", "/%2f%2fevil.test", "/aportar\n", "/unknown", "/../login"]) expect(safeReturnTo(value)).toBe("/aportar");
  });
});
