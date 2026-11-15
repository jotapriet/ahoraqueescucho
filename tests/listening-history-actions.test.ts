import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ client: vi.fn(), user: vi.fn(), rpc: vi.fn(), revalidate: vi.fn(), update: vi.fn(), eq: vi.fn(), single: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("../src/lib/supabase/server", () => ({ createClient: mocks.client }));
import { markListenedAction, updateListeningAction } from "../src/features/listening-history/actions";
const input = { albumId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", listenedOn: "2026-01-01", note: " Mi nota. " };
beforeEach(() => {
  vi.resetAllMocks();
  const query = { eq: mocks.eq, select: () => ({ maybeSingle: mocks.single }) };
  mocks.eq.mockReturnValue(query); mocks.update.mockReturnValue(query);
  mocks.client.mockResolvedValue({ auth: { getUser: mocks.user }, rpc: mocks.rpc, from: () => ({ update: mocks.update }) });
  mocks.user.mockResolvedValue({ data: { user: { id: "verified-user" } }, error: null });
});
it("rechaza fechas, notas e identidades manipuladas antes de llamar a Supabase", async () => {
  for (const invalid of [{ ...input, userId: "forged" }, { ...input, listenedOn: "2026-02-30" }, { ...input, listenedOn: "2999-01-01" }, { ...input, note: "x".repeat(1001) }]) expect(await markListenedAction(invalid)).toMatchObject({ ok: false, code: "INVALID_INPUT" });
  expect(mocks.client).not.toHaveBeenCalled();
});
it("no mueve ni edita sin sesión verificada", async () => {
  mocks.user.mockResolvedValue({ data: { user: null }, error: null });
  expect(await markListenedAction(input)).toMatchObject({ ok: false, code: "AUTH_REQUIRED" });
  expect(await updateListeningAction(input)).toMatchObject({ ok: false, code: "AUTH_REQUIRED" });
  expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
});
it.each([true, false])("confirma una transición o reintento idempotente (%s) y actualiza el perfil", async value => {
  mocks.rpc.mockResolvedValue({ data: value, error: null });
  expect(await markListenedAction(input)).toEqual({ ok: true, data: { listened: true } });
  expect(mocks.rpc).toHaveBeenCalledWith("mark_album_listened", { p_album_id: input.albumId, p_listened_on: input.listenedOn, p_note: "Mi nota." });
  expect(mocks.revalidate).toHaveBeenCalledWith("/perfil");
});
it("no simula éxito ni filtra errores internos si falla el traslado", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { code: "server_failure", message: "private database details" } });
  const result = await markListenedAction(input);
  expect(result).toMatchObject({ ok: false }); expect(JSON.stringify(result)).not.toContain("private");
  expect(mocks.revalidate).not.toHaveBeenCalled();
});
it("edita exclusivamente la entrada del usuario verificado y acepta nota vacía", async () => {
  mocks.single.mockResolvedValue({ data: { album_id: input.albumId }, error: null });
  expect(await updateListeningAction({ ...input, note: "  " })).toMatchObject({ ok: true });
  expect(mocks.update).toHaveBeenCalledWith({ listened_on: input.listenedOn, note: null });
  expect(mocks.eq.mock.calls).toEqual([["user_id", "verified-user"], ["album_id", input.albumId]]);
});
