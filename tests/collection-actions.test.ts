import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ client: vi.fn(), user: vi.fn(), rpc: vi.fn(), revalidate: vi.fn() }));
vi.mock("../src/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { saveCollectionAction, deleteCollectionAction } from "../src/features/collections/actions";
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const input = { id, title: "Una tarde", introduction: "Dos discos para escuchar.", albumIds: [id, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"] };
beforeEach(() => { vi.resetAllMocks(); mocks.client.mockResolvedValue({ auth: { getUser: mocks.user }, rpc: mocks.rpc }); mocks.user.mockResolvedValue({ data: { user: { id: "verified" } }, error: null }); mocks.rpc.mockResolvedValue({ data: id, error: null }); });
it("rechaza autor inyectado, duplicados y falta de sesión antes de mutar", async () => {
  expect(await saveCollectionAction({ ...input, userId: "forged" })).toMatchObject({ ok: false });
  expect(await saveCollectionAction({ ...input, albumIds: [id, id] })).toMatchObject({ ok: false });
  expect(mocks.client).not.toHaveBeenCalled();
  mocks.user.mockResolvedValue({ data: { user: null }, error: null });
  expect(await saveCollectionAction(input)).toMatchObject({ ok: false });
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("publica mediante la RPC atómica sin aceptar autor del navegador", async () => {
  expect(await saveCollectionAction(input)).toEqual({ ok: true, id });
  expect(mocks.rpc).toHaveBeenCalledWith("save_curator_collection", { p_id: id, p_title: input.title, p_introduction: input.introduction, p_album_ids: input.albumIds });
  expect(mocks.revalidate).toHaveBeenCalledWith("/curadores/[nick]", "page");
});
it("no invalida páginas al denegar una edición ajena ni filtra errores internos", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "secret detail" } });
  expect(await saveCollectionAction(input)).toEqual({ ok: false, message: "Solo su autor puede editar esta colección." });
  expect(mocks.revalidate).not.toHaveBeenCalled();
  expect(await deleteCollectionAction({ id })).toMatchObject({ ok: false });
});
