"use server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type SurpriseResult = { ok: true; albumId: string } | { ok: false; code: "INVALID_INPUT" | "AUTH_REQUIRED" | "EMPTY" | "UNAVAILABLE"; message: string };

export async function getSurpriseAlbumAction(input: unknown): Promise<SurpriseResult> {
  const parsed = z.object({ excludeListened: z.boolean() }).strict().safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT", message: "Revisa la opción de discos ya escuchados." };
  try {
    const supabase = await createClient();
    if (parsed.data.excludeListened) {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) return { ok: false, code: "AUTH_REQUIRED", message: "Inicia sesión para excluir tus escuchas o desmarca esa opción." };
    }
    // Nunca cachear una selección aleatoria ni una respuesta derivada del historial personal.
    const { data, error } = await supabase.rpc("surprise_album", { p_exclude_listened: parsed.data.excludeListened });
    if (error) throw new Error("Surprise unavailable");
    const rows = z.array(z.object({ album_id: z.uuid() })).max(1).safeParse(data);
    if (!rows.success) throw new Error("Invalid surprise result");
    if (!rows.data.length) return { ok: false, code: "EMPTY", message: parsed.data.excludeListened ? "No hay discos sin escuchar disponibles ahora. Puedes incluir los ya escuchados o aportar uno a la colección." : "La colección espera sus primeros discos. Comparte una recomendación para empezar." };
    return { ok: true, albumId: rows.data[0].album_id };
  } catch { return { ok: false, code: "UNAVAILABLE", message: "No se pudo sacar un disco de la cubeta. Vuelve a intentarlo." }; }
}
