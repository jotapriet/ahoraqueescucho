"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { listeningInput } from "./schema";
import type { MutationResult } from "@/features/recommendations/schema";

const invalid = { ok: false, code: "INVALID_INPUT", message: "Elige una fecha de escucha válida, hasta hoy, y una nota de hasta 1000 caracteres." } as const;
const unauthorized = { ok: false, code: "AUTH_REQUIRED", message: "Inicia sesión para guardar tu historial de escuchas." } as const;
const unavailable = { ok: false, code: "UNAVAILABLE", message: "No se pudo guardar la escucha. Tus datos siguen aquí para reintentar." } as const;

export async function markListenedAction(input: unknown): Promise<MutationResult<{ listened: true }>> {
  const parsed = listeningInput.safeParse(input);
  if (!parsed.success) return invalid;
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return unauthorized;
    const { data, error } = await supabase.rpc("mark_album_listened", { p_album_id: parsed.data.albumId, p_listened_on: parsed.data.listenedOn, p_note: parsed.data.note || null });
    if (error) {
      if (error.code === "P0002") return { ok: false, code: "NOT_FOUND", message: "Este disco ya no está en tus pendientes. Actualiza tu perfil." };
      if (error.code === "22023") return invalid;
      if (error.code === "28000") return unauthorized;
      return unavailable;
    }
    if (typeof data !== "boolean") return unavailable;
    revalidatePath("/perfil");
    return { ok: true, data: { listened: true } };
  } catch { return unavailable; }
}

export async function updateListeningAction(input: unknown): Promise<MutationResult<{ listened: true }>> {
  const parsed = listeningInput.safeParse(input);
  if (!parsed.success) return invalid;
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return unauthorized;
    const { data, error } = await supabase.from("listened_albums")
      .update({ listened_on: parsed.data.listenedOn, note: parsed.data.note || null })
      .eq("user_id", user.id).eq("album_id", parsed.data.albumId).select("album_id").maybeSingle();
    if (error) return unavailable;
    if (!data) return { ok: false, code: "NOT_FOUND", message: "Esta escucha ya no está disponible." };
    revalidatePath("/perfil");
    return { ok: true, data: { listened: true } };
  } catch { return unavailable; }
}
