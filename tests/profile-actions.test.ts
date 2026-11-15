import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ client: vi.fn(), user: vi.fn(), rpc: vi.fn(), upload: vi.fn(), update: vi.fn(), refresh: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.refresh }));
vi.mock("../src/lib/supabase/server", () => ({ createClient: mocks.client }));
import { claimNickAction, updateAvatarAction } from "../src/features/profile/actions";
const initial = { ok: false, message: "" };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ data: { user: { id: "user" } }, error: null });
  mocks.client.mockResolvedValue({ auth: { getUser: mocks.user }, rpc: mocks.rpc,
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { avatar_url: null }, error: null }) }) }), update: mocks.update }),
    storage: { from: () => ({ upload: mocks.upload }) },
  });
});
it("elige el nick con identidad de sesión y trata duplicados sin filtrar errores", async () => {
  const form = new FormData(); form.set("nick", "Mi_Nick");
  mocks.rpc.mockResolvedValue({ error: { code: "23505", message: "private details" } });
  const response = await claimNickAction(initial, form);
  expect(response.message).toContain("ocupado");
  expect(mocks.rpc).toHaveBeenCalledWith("claim_profile_nick", { p_nick: "mi_nick" });
  expect(JSON.stringify(response)).not.toContain("private");
});
it("no actualiza perfiles ni Storage sin usuario verificado", async () => {
  mocks.user.mockResolvedValue({ data: { user: null }, error: null });
  const form = new FormData(); form.set("nick", "curador");
  expect((await claimNickAction(initial, form)).ok).toBe(false);
  expect((await updateAvatarAction(initial, form)).ok).toBe(false);
  expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.upload).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
});
it("rechaza archivos disfrazados de imagen y archivos demasiado grandes antes de subir", async () => {
  const form = new FormData(); form.set("avatar", new File(["<svg/>"], "photo.jpg", { type: "image/jpeg" }));
  expect((await updateAvatarAction(initial, form)).ok).toBe(false);
  form.set("avatar", new File([new Uint8Array(800000)], "photo.png", { type: "image/png" }));
  expect((await updateAvatarAction(initial, form)).ok).toBe(false);
  expect(mocks.upload).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
});
it("sube una foto con nombre generado en la carpeta propia y guarda solo la URL confirmada", async () => {
  const single = vi.fn().mockResolvedValue({ data: { id: "user" }, error: null });
  const update = vi.fn(() => ({ eq: () => ({ select: () => ({ single }) }) }));
  mocks.upload.mockResolvedValue({ error: null });
  mocks.client.mockResolvedValueOnce({ auth: { getUser: mocks.user },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { avatar_url: null }, error: null }) }) }), update }),
    storage: { from: () => ({ upload: mocks.upload, getPublicUrl: (path: string) => ({ data: { publicUrl: `https://project.supabase.co/storage/v1/object/public/avatars/${path}` } }) }) },
  });
  const form = new FormData(); form.set("avatar", new File([new Uint8Array([137,80,78,71,13,10,26,10])], "untrusted-name.svg", { type: "image/svg+xml" }));
  expect((await updateAvatarAction(initial, form)).ok).toBe(true);
  expect(mocks.upload).toHaveBeenCalledWith(expect.stringMatching(/^user\/[a-f0-9-]+\.png$/), expect.any(Uint8Array), expect.objectContaining({ contentType: "image/png", upsert: false }));
  expect(update).toHaveBeenCalledWith({ avatar_url: expect.stringMatching(/\/avatars\/user\/[a-f0-9-]+\.png$/) });
  expect(mocks.refresh).toHaveBeenCalledWith("/", "layout");
});
