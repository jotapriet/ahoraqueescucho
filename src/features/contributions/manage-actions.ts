"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { editRecommendationInput, withdrawRecommendationInput, type ManageResult } from "./manage-schema";

const failed = { ok: false, message: "No se pudo confirmar el cambio. Vuelve a cargar tus aportaciones antes de reintentarlo." } as const;
function invalidate(albumId: string) {
  revalidatePath("/perfil");
  revalidatePath("/curadores/[nick]", "page");
  revalidatePath(`/albumes/${albumId}`);
  revalidatePath("/descubrir");
  revalidatePath("/");
}
export async function editRecommendationAction(input: unknown): Promise<ManageResult> {
  const parsed = editRecommendationInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Elige contexto, mood, energía e idioma y un comentario de entre 1 y 280 caracteres." };
  try {
    const client = await createClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return { ok: false, message: "Inicia sesión para editar tu aportación." };
    const { recommendationId, ...changes } = parsed.data;
    // La sesión verificada y RLS limitan la escritura. El álbum y el autor son inmutables.
    const { data, error } = await client.from("recommendations").update(changes).eq("id", recommendationId).eq("user_id", user.id).select("album_id").maybeSingle();
    if (error) return failed;
    if (!data) return { ok: false, message: "Esta aportación ya no existe o pertenece a otra persona." };
    const albumId = z.uuid().parse(data.album_id);
    invalidate(albumId);
    return { ok: true };
  } catch { return failed; }
}
export async function withdrawRecommendationAction(input: unknown): Promise<ManageResult> {
  const parsed = withdrawRecommendationInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "La aportación no es válida." };
  try {
    const client = await createClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return { ok: false, message: "Inicia sesión para retirar tu aportación." };
    const { data, error } = await client.from("recommendations").delete().eq("id", parsed.data.recommendationId).eq("user_id", user.id).select("album_id").maybeSingle();
    if (error) return failed;
    if (!data) return { ok: false, message: "Esta aportación ya no existe o pertenece a otra persona." };
    invalidate(z.uuid().parse(data.album_id));
    return { ok: true };
  } catch { return failed; }
}
