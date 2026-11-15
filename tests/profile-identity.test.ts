import { afterEach, expect, it, vi } from "vitest";
import { imageFormat, safeAvatarUrl } from "../src/features/profile/identity";
afterEach(() => vi.unstubAllEnvs());
it("solo permite fotos de Storage en la carpeta del curador, sin URLs de rastreo externas", () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  const user = "11111111-1111-4111-8111-111111111111";
  const url = `https://project.supabase.co/storage/v1/object/public/avatars/${user}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png`;
  expect(safeAvatarUrl(url, user)).toBe(url);
  expect(safeAvatarUrl(url, "22222222-2222-4222-8222-222222222222")).toBeNull();
  expect(safeAvatarUrl("https://tracking.test/image.png", user)).toBeNull();
  expect(safeAvatarUrl(url + "?track=1", user)).toBeNull();
});
it("determina el formato por contenido y rechaza SVG/HTML", () => {
  expect(imageFormat(new Uint8Array([137,80,78,71,13,10,26,10]))?.mime).toBe("image/png");
  expect(imageFormat(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
});
