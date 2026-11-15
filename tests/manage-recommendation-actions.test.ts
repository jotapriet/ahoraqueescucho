import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ client: vi.fn(), user: vi.fn(), from: vi.fn(), update: vi.fn(), remove: vi.fn(), eq: vi.fn(), select: vi.fn(), single: vi.fn(), invalidate: vi.fn() }));
vi.mock("../src/lib/supabase/server", () => ({ createClient: m.client }));
vi.mock("next/cache", () => ({ revalidatePath: m.invalidate }));
import { editRecommendationAction, withdrawRecommendationAction } from "../src/features/contributions/manage-actions";
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const input = { recommendationId: id, contexts: ["relaxing_home"], moods: ["bright"], energy: 2, language: "es", comment: "Corregido" };
beforeEach(() => {
  vi.resetAllMocks();
  const chain = { update: m.update, delete: m.remove, eq: m.eq, select: m.select, maybeSingle: m.single };
  for (const fn of [m.from, m.update, m.remove, m.eq, m.select]) fn.mockReturnValue(chain);
  m.client.mockResolvedValue({ auth: { getUser: m.user }, from: m.from });
  m.user.mockResolvedValue({ data: { user: { id: "verified-user" } }, error: null });
  m.single.mockResolvedValue({ data: { album_id: id }, error: null });
});
it("rechaza cambios de autor, álbum, votos y datos inválidos antes de escribir", async () => {
  for (const extra of [{ user_id: "forged" }, { album_id: id }, { likes: 999 }, { comment: " " }, { energy: 9 }]) expect(await editRecommendationAction({ ...input, ...extra })).toMatchObject({ ok: false });
  expect(m.client).not.toHaveBeenCalled();
});
it("exige sesión y filtra siempre por el usuario verificado para editar o retirar", async () => {
  m.user.mockResolvedValueOnce({ data: { user: null }, error: null });
  expect(await editRecommendationAction(input)).toMatchObject({ ok: false }); expect(m.update).not.toHaveBeenCalled();
  expect(await editRecommendationAction(input)).toEqual({ ok: true });
  expect(m.eq).toHaveBeenCalledWith("user_id", "verified-user");
  expect(m.update).toHaveBeenCalledWith({ contexts: ["relaxing_home"], moods: ["bright"], energy: 2, language: "es", comment: "Corregido" });
  expect(await withdrawRecommendationAction({ recommendationId: id })).toEqual({ ok: true });
  expect(m.from.mock.calls.every(([table]) => table === "recommendations")).toBe(true);
});
it("no informa éxito ni invalida datos cuando RLS no encuentra una fila propia", async () => {
  m.single.mockResolvedValue({ data: null, error: null });
  expect(await editRecommendationAction(input)).toMatchObject({ ok: false });
  expect(await withdrawRecommendationAction({ recommendationId: id })).toMatchObject({ ok: false });
  expect(m.invalidate).not.toHaveBeenCalled();
});
