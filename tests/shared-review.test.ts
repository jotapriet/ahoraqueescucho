import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ client: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), single: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../src/lib/supabase/server", () => ({ createClient: m.client }));
import { getSharedReview } from "../src/features/recommendations/share-data";
import { recommendationPath, prioritizeSharedReview } from "../src/features/recommendations/share";
import { resultFixture } from "./fixtures/recommendation";
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
it("destaca reseñas fuera de la primera página sin alterar el cursor ni duplicarlas", () => {
  const page = { ...resultFixture.reviews, nextOffset: 12, total: 20 };
  const target = { ...page.reviews[0], id };
  const result = prioritizeSharedReview(page, target);
  expect(result.reviews[0]).toEqual(target);
  expect(result.nextOffset).toBe(12); expect(result.total).toBe(20);
  expect(prioritizeSharedReview(result, target).reviews.filter(review => review.id === id)).toHaveLength(1);
});
beforeEach(() => { vi.resetAllMocks(); const chain = { select: m.select, eq: m.eq, maybeSingle: m.single }; m.client.mockResolvedValue({ from: m.from }); for (const fn of [m.from, m.select, m.eq]) fn.mockReturnValue(chain); m.single.mockResolvedValue({ data: null, error: null }); });
it("comparte un enlace estable al álbum y al ancla de la reseña", () => { expect(recommendationPath(id, id)).toBe(`/albumes/${id}?resena=${id}#resena-${id}`); });
it("valida el identificador y limita la reseña al álbum del enlace", async () => {
  expect(await getSharedReview(id, "invalid")).toBeNull(); expect(m.client).not.toHaveBeenCalled();
  expect(await getSharedReview(id, id)).toBeNull();
  expect(m.eq).toHaveBeenCalledWith("album_id", id); expect(m.eq).toHaveBeenCalledWith("id", id);
});
it("distingue una reseña retirada de un error de consulta", async () => {
  expect(await getSharedReview(id, id)).toBeNull();
  m.single.mockResolvedValue({ data: null, error: { message: "private" } });
  await expect(getSharedReview(id, id)).rejects.toThrow("No se pudo cargar la reseña compartida.");
});
