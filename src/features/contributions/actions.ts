"use server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAlbumAction, getAlbumLinksAction } from "@/features/music/actions";
import { getCatalogProvider } from "./config";
import { contributionSchema, type PublishResult } from "./schema";

export async function publishRecommendationAction(input: unknown): Promise<PublishResult> {
  const parsed = contributionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT", message: "Elige un disco, al menos un contexto y un mood, un idioma y un comentario de hasta 280 caracteres." };
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { ok: false, code: "AUTH_REQUIRED", message: "Inicia sesión para publicar. Tu recomendación sigue en el formulario." };
    const profile = await supabase.from("profiles").select("nick").eq("id", user.id).maybeSingle();
    if (profile.error) throw new Error("Profile unavailable");
    if (!profile.data?.nick) return { ok: false, code: "INVALID_INPUT", message: "Elige primero tu nick definitivo en Mi perfil para firmar tus recomendaciones." };
    const data = parsed.data;
    if (data.album.provider !== "musicbrainz" && data.album.provider !== "deezer" && data.album.provider !== getCatalogProvider()) return { ok: false, code: "INVALID_INPUT", message: "Selecciona el álbum desde el catálogo de esta colección." };
    const admin = createAdminClient();
    const externalColumn = data.album.provider === "musicbrainz" ? "musicbrainz_id" : data.album.provider === "deezer" ? "deezer_id" : "spotify_id";
    const existing = await supabase.from("albums").select("id,links_resolved_at").eq(externalColumn, data.album.id).maybeSingle();
    if (existing.error) throw new Error("Catalog unavailable");
    let metadata: Record<string, unknown> | null = null;
    let linksPending = existing.data ? !existing.data.links_resolved_at : false;
    if (!existing.data) {
      // El cliente solo envía proveedor/ID; título, portada y enlaces no son de confianza.
      const albumResult = await getAlbumAction(data.album);
      if (!albumResult.ok) return { ok: false, code: "CATALOG_ERROR", message: albumResult.error.message };
      const linksResult = await getAlbumLinksAction(data.album);
      const album = albumResult.data;
      linksPending = !linksResult.ok;
      metadata = {
        title: album.title, artists: album.artists, release_year: album.releaseYear, genres: album.genres,
        cover_url: album.coverUrl, source_url: album.sourceUrl,
        platform_links: linksResult.ok ? linksResult.data.links : album.provider === "spotify" ? { spotify: album.sourceUrl } : {},
        links_resolved_at: linksResult.ok ? linksResult.data.resolvedAt : null,
      };
    }
    const response = await admin.rpc("publish_recommendation", {
      p_user_id: user.id, p_provider: data.album.provider, p_external_id: data.album.id, p_metadata: metadata,
      p_contexts: data.contexts, p_energy: data.energy, p_moods: data.moods, p_language: data.language, p_comment: data.comment,
    });
    const result = z.array(z.object({ album_id: z.uuid(), recommendation_id: z.uuid(), created: z.boolean() })).length(1).safeParse(response.data);
    if (response.error || !result.success) throw new Error("Publication unavailable");
    return { ok: true, data: { albumId: result.data[0].album_id, recommendationId: result.data[0].recommendation_id, created: result.data[0].created, linksPending } };
  } catch { return { ok: false, code: "UNAVAILABLE", message: "No se pudo publicar la recomendación. Tu texto sigue aquí para volver a intentarlo." }; }
}
