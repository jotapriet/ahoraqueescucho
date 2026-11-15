"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getReviews } from "./queries";
import { reportInput, reviewsInput, savedInput, voteInput, type MutationResult, type ReviewsPage } from "./schema";

const unavailable = { ok: false, code: "UNAVAILABLE", message: "No se pudo guardar el cambio. Inténtalo de nuevo." } as const;
const invalid = { ok: false, code: "INVALID_INPUT", message: "Revisa los datos e inténtalo de nuevo." } as const;
const authRequired = { ok: false, code: "AUTH_REQUIRED", message: "Necesitas iniciar sesión para participar en la colección." } as const;

export async function setVoteAction(input: unknown): Promise<MutationResult<{ likes: number; has_voted: boolean }>> {
  const parsed = voteInput.safeParse(input);
  if (!parsed.success) return invalid;
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return authRequired;
    const { data, error } = await supabase.rpc("set_recommendation_vote", { p_recommendation_id: parsed.data.recommendationId, p_voted: parsed.data.voted });
    if (error) {
      if (error.code === "42501") return { ok: false, code: "FORBIDDEN", message: "No puedes votar tu propia reseña." };
      if (error.code === "P0002" || error.code === "23503") return { ok: false, code: "NOT_FOUND", message: "Esta reseña ya no está disponible." };
      if (error.code === "28000") return authRequired;
      return unavailable;
    }
    const result = z.array(z.object({ likes: z.number().int().nonnegative(), has_voted: z.boolean() })).length(1).safeParse(data);
    if (!result.success) return unavailable;
    // El carrusel aplica la respuesta sin reordenarse mientras se está leyendo.
    return { ok: true, data: result.data[0] };
  } catch { return unavailable; }
}

export async function setSavedAlbumAction(input: unknown): Promise<MutationResult<{ saved: boolean }>> {
  const parsed = savedInput.safeParse(input);
  if (!parsed.success) return invalid;
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return authRequired;
    const { albumId, saved } = parsed.data;
    const response = saved
      ? await supabase.from("saved_albums").upsert({ user_id: user.id, album_id: albumId }, { onConflict: "user_id,album_id", ignoreDuplicates: true })
      : await supabase.from("saved_albums").delete().eq("user_id", user.id).eq("album_id", albumId);
    if (response.error) return unavailable;
    return { ok: true, data: { saved } };
  } catch { return unavailable; }
}

export async function reportRecommendationAction(input: unknown): Promise<MutationResult<{ reported: true }>> {
  const parsed = reportInput.safeParse(input);
  if (!parsed.success) return invalid;
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return authRequired;
    const { recommendationId, reason } = parsed.data;
    const { error } = await supabase.from("recommendation_reports").upsert({ user_id: user.id, recommendation_id: recommendationId, reason }, { onConflict: "recommendation_id,user_id", ignoreDuplicates: true });
    if (error) return unavailable;
    return { ok: true, data: { reported: true } };
  } catch { return unavailable; }
}

export async function getReviewsAction(input: unknown): Promise<MutationResult<ReviewsPage>> {
  const parsed = reviewsInput.safeParse(input);
  if (!parsed.success) return invalid;
  try { return { ok: true, data: await getReviews(parsed.data.albumId, parsed.data.offset) }; }
  catch { return { ok: false, code: "UNAVAILABLE", message: "No se pudieron cargar las reseñas. Inténtalo de nuevo." }; }
}
