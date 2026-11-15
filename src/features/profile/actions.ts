"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { avatarLimit, imageFormat, nickPattern, safeAvatarUrl } from "./identity";

type ProfileResult = { ok: boolean; message: string };
export async function claimNickAction(_previous: ProfileResult, form: FormData): Promise<ProfileResult> {
  const nick = String(form.get("nick") ?? "").trim().toLowerCase();
  if (!nickPattern.test(nick)) return { ok: false, message: "Usa entre 3 y 24 letras minúsculas, números o guiones bajos." };
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { ok: false, message: "Inicia sesión para elegir tu nick." };
    const { error } = await supabase.rpc("claim_profile_nick", { p_nick: nick });
    if (error) return { ok: false, message: error.code === "23505" ? "Ese nick ya está ocupado. Elige otro." : error.code === "42501" ? "Tu nick ya está elegido y no se puede cambiar." : "No se pudo guardar el nick. Inténtalo de nuevo." };
    revalidatePath("/", "layout");
    return { ok: true, message: "Tu nick ya forma parte de la colección." };
  } catch { return { ok: false, message: "No se pudo guardar el nick. Inténtalo de nuevo." }; }
}

export async function updateAvatarAction(_previous: ProfileResult, form: FormData): Promise<ProfileResult> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { ok: false, message: "Inicia sesión para cambiar tu foto." };
    const profile = await supabase.from("profiles").select("avatar_url").eq("id", user.id).single();
    if (profile.error) throw new Error("Profile unavailable");
    const remove = form.get("remove") === "true";
    let path: string | null = null;
    let avatarUrl: string | null = null;
    if (!remove) {
      const file = form.get("avatar");
      if (!(file instanceof File) || file.size === 0 || file.size > avatarLimit) return { ok: false, message: "Elige una imagen JPG, PNG o WebP de hasta 768 KB." };
      const bytes = new Uint8Array(await file.arrayBuffer());
      const format = imageFormat(bytes);
      if (!format) return { ok: false, message: "La imagen debe ser un archivo JPG, PNG o WebP válido." };
      path = `${user.id}/${crypto.randomUUID()}.${format.extension}`;
      const upload = await supabase.storage.from("avatars").upload(path, bytes, { contentType: format.mime, upsert: false, cacheControl: "3600" });
      if (upload.error) return { ok: false, message: "No se pudo subir la foto. Inténtalo de nuevo." };
      avatarUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    }
    const updated = await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", user.id).select("id").single();
    if (updated.error || !updated.data) {
      if (path) await supabase.storage.from("avatars").remove([path]);
      throw new Error("Profile update failed");
    }
    const oldUrl = safeAvatarUrl(profile.data.avatar_url, user.id);
    // La limpieza no debe convertir una actualización ya confirmada en un falso fallo.
    if (oldUrl) {
      try { await supabase.storage.from("avatars").remove([new URL(oldUrl).pathname.split("/avatars/")[1]]); }
      catch { /* El objeto anterior puede limpiarse más tarde; la identidad ya se guardó. */ }
    }
    revalidatePath("/", "layout");
    return { ok: true, message: remove ? "Foto retirada." : "Foto actualizada." };
  } catch { return { ok: false, message: "No se pudo cambiar la foto. Inténtalo de nuevo." }; }
}
